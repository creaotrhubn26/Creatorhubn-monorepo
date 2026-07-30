/**
 * role-room-mcp-registry.ts — capability-register for The Role Room MCP-server.
 *
 * Én deklarativ liste dekker HELE Role Room på tvers av ALLE moduser: hvert
 * verktøy sier hvilke moduser/faner det hører til, hvilket scope det krever, og
 * hvordan det leser data (via scopede spørringer — aldri rå, uautorisert SQL).
 * Å utvide dekningen = legge til en entry, ikke skrive ny server-kode.
 *
 * Modus-bevissthet: `modes` speiler frontendens ProfessionMode (+ «education»)
 * — dokumentert speil av
 * frontend/client/src/components/role-room/config/professionMode.ts. Serveren
 * kan filtrere verktøy-katalogen per modus, og hvert prosjekt-scopet kall
 * håndhever eier/medlem-tilgang (samme regel som UI-fanene).
 */

import type { Pool } from "pg";
import { hasScope } from "./role-room-integrations-v1-routes.js";
import { mcpCanAccessProject } from "./role-room-mcp-auth.js";
import { newEntityId } from "./_shared-ids.js";
import { listExpiringRights } from "./role-room-buyout-service.js";
import { checkEquipmentAvailability } from "./role-room-equipment-availability.js";
import { getProjectPipeline } from "./role-room-role-status-service.js";
import { getBudgetOnboardingState } from "./role-room-budget-onboarding.js";
import { listChecklistTemplates } from "./role-room-checklist-templates.js";
// Gjenbruker den herdede, consent-gatede talent-søk-motoren (IKKE reimplementert):
// buildSearchSql håndhever aktivt samtykke (HAVING bool_or basic/full_profile),
// maskByScopes maskerer PII etter delte scopes. PII-kritisk → deles 1:1 med UI.
import {
  fetchAgencyForUser, parseFilters, buildSearchSql, maskByScopes,
} from "./role-room-agency-search-routes.js";

/** Dokumentert speil av frontendens ProfessionMode + utdannings-modus. */
export const ROLE_ROOM_MODES = [
  "production", "photographer", "content_producer", "content_creator",
  "dance_studio", "dance_freelance", "education",
] as const;
export type RoleRoomMode = (typeof ROLE_ROOM_MODES)[number];

/** Alle produksjons-lignende moduser (deler casting/produksjons-domenet). */
const PROD_MODES: RoleRoomMode[] = ["production", "photographer", "content_producer", "content_creator"];
/** Dans-modusene (eget dans-domene: koreografi, klasser, forestillinger). */
const DANCE_MODES: RoleRoomMode[] = ["dance_studio", "dance_freelance"];

export interface McpCallContext {
  userId: string;
  scopes: string[];
  apiKeyId: string;
}

/** Feil som mapper til JSON-RPC-feilkoder i ruteren. */
export class McpToolError extends Error {
  constructor(public code: number, message: string) { super(message); }
}

export interface McpCapability {
  name: string;
  description: string;
  scope: string;                 // v1-scope som kreves (f.eks. projects.read)
  modes: RoleRoomMode[] | "*";    // hvilke moduser verktøyet hører til (katalog/filter)
  projectScoped: boolean;         // krever projectId + eier/medlem-sjekk
  mutates?: boolean;              // true = skriver (utkast). Default read-only → readOnlyHint.
  inputSchema: Record<string, unknown>;
  handler: (pool: Pool, ctx: McpCallContext, args: Record<string, unknown>) => Promise<unknown>;
}

// ── Delte hjelpere ────────────────────────────────────────────────────────
const OBJ = (props: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: "object", properties: props, required, additionalProperties: false,
});
const STR = (description: string) => ({ type: "string", description });

// ── Paginering ──────────────────────────────────────────────────────────────
// List-verktøyene returnerte tidligere en bar array med hardkodet LIMIT. En
// agent kunne dermed ikke se om den hadde fått alt: 50 rader av 54 ser
// identisk ut med 50 av 50. Alle list-verktøy tar nå limit/offset og
// returnerer et `pagination`-objekt ved siden av rad-arrayen.
//
// Selve rad-nøkkelen beholdes uendret, slik at eksisterende klienter ikke
// brekker — `pagination` er additivt.

/** Felles argumenter for paginering. Spres inn i list-verktøyenes skjema. */
const PAGE_ARGS = {
  limit: { type: "number", description: "Maks antall rader i denne siden" },
  offset: { type: "number", description: "Hopp over så mange rader (default 0)" },
};

export interface PageArgs {
  limit: number;
  offset: number;
}

export interface PageInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Leser limit/offset fra verktøyargumentene. Ugyldige verdier faller
 * tilbake til defaults framfor å feile — en agent som sender limit=0 eller
 * limit="mange" skal få et fornuftig svar, ikke en feilmelding.
 */
export function readPageArgs(
  args: Record<string, unknown>,
  defaultLimit: number,
  maxLimit: number,
): PageArgs {
  const rawLimit = Number(args.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit;

  const rawOffset = Number(args.offset);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}

export function buildPageInfo(total: number, page: PageArgs): PageInfo {
  return {
    total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.offset + page.limit < total,
  };
}

interface ListSpec {
  /** Nøkkelen rad-arrayen legges på, f.eks. "roles". */
  key: string;
  columns: string;
  from: string;
  /** WHERE-uttrykk uten «WHERE». Tom streng = ingen filtrering. */
  where: string;
  params: unknown[];
  orderBy: string;
  defaultLimit: number;
  maxLimit?: number;
  /**
   * Uttrykk å telle. Default `*`. Må settes til `DISTINCT <kolonne>` når
   * FROM-en har en JOIN som kan duplisere rader — ellers teller totalen
   * join-treff i stedet for entiteter.
   */
  countExpr?: string;
}

/**
 * Kjører en liste-spørring med paginering + totaltelling. Telle-spørringen
 * bruker samme FROM/WHERE som rad-spørringen, slik at totalen alltid svarer
 * til det klienten faktisk kan bla gjennom.
 */
async function paginatedList(
  pool: Pool,
  spec: ListSpec,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const page = readPageArgs(args, spec.defaultLimit, spec.maxLimit ?? spec.defaultLimit * 4);
  const whereSql = spec.where.trim() ? `WHERE ${spec.where}` : "";

  const rowsPromise = pool.query(
    `SELECT ${spec.columns} FROM ${spec.from} ${whereSql} ORDER BY ${spec.orderBy}
      LIMIT $${spec.params.length + 1} OFFSET $${spec.params.length + 2}`,
    [...spec.params, page.limit, page.offset],
  );
  const countPromise = pool.query(
    `SELECT COUNT(${spec.countExpr ?? "*"})::int AS total FROM ${spec.from} ${whereSql}`,
    spec.params,
  );

  const [rows, count] = await Promise.all([rowsPromise, countPromise]);
  return {
    [spec.key]: rows.rows,
    pagination: buildPageInfo(Number(count.rows[0]?.total ?? 0), page),
  };
}

/**
 * Paginering for listene som ligger som JSONB-blober i legacy_compat_store —
 * de kan ikke telles i SQL, så vi skjærer i minnet. Blobene er små (tilbud,
 * kontrakter, shot-lists per prosjekt).
 */
export function paginateArray(
  key: string,
  items: unknown[],
  args: Record<string, unknown>,
  defaultLimit = 100,
): Record<string, unknown> {
  const page = readPageArgs(args, defaultLimit, 500);
  return {
    [key]: items.slice(page.offset, page.offset + page.limit),
    pagination: buildPageInfo(items.length, page),
  };
}

// ── Utkast-register ─────────────────────────────────────────────────────────
// Utkast-verktøyene merker radene sine med metadata->>'source' = 'mcp'.
// Forvaltnings-verktøyene under bruker den markøren som eneste inngang, slik
// at de aldri kan røre rader en produsent har laget selv.

interface DraftEntity {
  table: string;
  idCol: string;
  titleCol: string;
  createdAtCol: string;
  /** Statusene raden kan ha så lenge den er et uåpnet utkast. */
  draftStatuses: string[];
  /** True når tabellen har published_at (mig. 293) og vi kan kreve NULL. */
  hasPublishedAt: boolean;
}

const DRAFT_ENTITIES = {
  task: {
    table: "role_room_phase_timeline_items",
    idCol: "id", titleCol: "title", createdAtCol: "created_at",
    draftStatuses: ["draft"], hasPublishedAt: true,
  },
  budget_item: {
    table: "role_room_budget_items",
    idCol: "id", titleCol: "item_name", createdAtCol: "created_at",
    draftStatuses: ["draft"], hasPublishedAt: true,
  },
  review: {
    table: "role_room_client_reviews",
    idCol: "id", titleCol: "title", createdAtCol: "created_at",
    // rr_request_review oppretter med status 'pending'.
    draftStatuses: ["pending"], hasPublishedAt: true,
  },
  client_material: {
    table: "role_room_client_materials",
    idCol: "id", titleCol: "title", createdAtCol: "created_at",
    draftStatuses: ["draft"], hasPublishedAt: false,
  },
} as const satisfies Record<string, DraftEntity>;

export const DRAFT_ENTITY_TYPES = Object.keys(DRAFT_ENTITIES) as Array<keyof typeof DRAFT_ENTITIES>;
export type DraftEntityType = (typeof DRAFT_ENTITY_TYPES)[number];

export function isDraftEntityType(v: string): v is DraftEntityType {
  return Object.prototype.hasOwnProperty.call(DRAFT_ENTITIES, v);
}

/**
 * Vilkåret som avgjør om en rad er et slettbart agent-utkast. Alle tre
 * leddene må holde: agent-markør, fortsatt utkast-status, og ikke publisert.
 */
function draftGuardSql(entity: DraftEntity): string {
  const statuses = entity.draftStatuses.map((s) => `'${s}'`).join(", ");
  const published = entity.hasPublishedAt ? " AND published_at IS NULL" : "";
  return `metadata->>'source' = 'mcp' AND status IN (${statuses})${published}`;
}

function readDraftRef(args: Record<string, unknown>): {
  entity: DraftEntity;
  entityType: DraftEntityType;
  draftId: string;
} {
  const entityType = typeof args.entityType === "string" ? args.entityType.trim() : "";
  if (!isDraftEntityType(entityType)) {
    throw new McpToolError(-32602, `Ukjent entityType. Gyldige: ${DRAFT_ENTITY_TYPES.join(", ")}.`);
  }
  const draftId = typeof args.draftId === "string" ? args.draftId.trim() : "";
  if (!draftId) throw new McpToolError(-32602, "draftId er påkrevd.");
  return { entity: DRAFT_ENTITIES[entityType], entityType, draftId };
}

async function requireProject(pool: Pool, ctx: McpCallContext, args: Record<string, unknown>): Promise<string> {
  const projectId = typeof args.projectId === "string" ? args.projectId.trim() : "";
  if (!projectId) throw new McpToolError(-32602, "projectId er påkrevd.");
  if (!(await mcpCanAccessProject(pool, projectId, ctx.userId))) {
    throw new McpToolError(-32004, `Ingen tilgang til prosjekt ${projectId}.`);
  }
  return projectId;
}

// ── Register ────────────────────────────────────────────────────────────────
export const ROLE_ROOM_CAPABILITIES: McpCapability[] = [
  {
    name: "rr_list_projects",
    description: "List Role Room-prosjekter (casting/produksjon) som nøkkelens bruker eier eller er medlem av. Returnerer id, navn, status, type og sist oppdatert.",
    scope: "projects.read", modes: "*", projectScoped: false,
    inputSchema: OBJ({ status: STR("Valgfritt statusfilter"), ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      const status = typeof args.status === "string" ? args.status.trim() : "";
      const params: unknown[] = [ctx.userId];
      if (status) params.push(status);
      return paginatedList(pool, {
        key: "projects",
        // DISTINCT fordi LEFT JOIN mot casting_user_roles kan gi duplikater.
        columns: "DISTINCT p.id, p.name, p.status, p.project_type, p.updated_at",
        from: `casting_projects p
           LEFT JOIN casting_user_roles r ON r.project_id = p.id AND r.user_id = $1 AND r.deactivated_at IS NULL`,
        where: `(p.created_by = $1 OR r.user_id IS NOT NULL)${status ? " AND p.status = $2" : ""}`,
        params,
        orderBy: "p.updated_at DESC NULLS LAST",
        defaultLimit: 50,
        maxLimit: 200,
        countExpr: "DISTINCT p.id",
      }, args);
    },
  },
  {
    name: "rr_get_project",
    description: "Hent ett Role Room-prosjekt med detaljer (eier/medlem-tilgang kreves).",
    scope: "projects.read", modes: "*", projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id") }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const r = await pool.query(
        `SELECT id, name, description, status, project_type, genre, start_date, end_date, currency, updated_at
           FROM casting_projects WHERE id = $1 LIMIT 1`, [projectId]);
      if (Number(r.rowCount ?? 0) === 0) throw new McpToolError(-32004, "Prosjektet finnes ikke.");
      return { project: r.rows[0] };
    },
  },
  {
    name: "rr_list_project_members",
    description: "List team/crew-medlemmer (aktive) på et prosjekt med rolle. Dekker Team-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "members",
        columns: "user_id, email, role, added_by, created_at",
        from: "casting_user_roles",
        where: "project_id = $1 AND deactivated_at IS NULL",
        params: [projectId],
        orderBy: "created_at",
        defaultLimit: 200,
      }, args);
    },
  },
  {
    name: "rr_list_candidates",
    description: "List medvirkende/kandidater på et prosjekt (prosjektets egne casting-data — kun for prosjektmedlemmer). Dekker Kandidater-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), status: STR("Valgfritt statusfilter"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const status = typeof args.status === "string" ? args.status.trim() : "";
      const params: unknown[] = [projectId];
      if (status) params.push(status);
      return paginatedList(pool, {
        key: "candidates",
        columns: "id, name, email, agency, status, rating, assigned_roles, consent_status, updated_at",
        from: "casting_candidates",
        where: `project_id = $1${status ? " AND status = $2" : ""}`,
        params,
        orderBy: "updated_at DESC NULLS LAST",
        defaultLimit: 100,
        maxLimit: 500,
      }, args);
    },
  },
  {
    name: "rr_list_auditions",
    description: "List auditions/prøvespill på et prosjekt (tittel, rolle, dato, status). Dekker Auditions-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "auditions",
        columns: "id, title, role_name, location_name, date, start_time, end_time, status",
        from: "auditions",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "date DESC NULLS LAST",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_whoami",
    description: "Diagnostikk: hvilken bruker/konto tilkoblingen er autentisert som (userId), hvilke scopes, og en oversikt over hva økta har tilgang til (antall prosjekter man eier/er medlem av, utdannings-kull, egen talent-profil). Nyttig for å bekrefte at handshaken traff riktig konto.",
    scope: "projects.read", modes: "*", projectScoped: false,
    inputSchema: OBJ({}),
    handler: async (pool, ctx) => {
      const [proj, coh, tal] = await Promise.all([
        pool.query(
          `SELECT count(DISTINCT p.id)::int AS n FROM casting_projects p
             LEFT JOIN casting_user_roles r ON r.project_id = p.id AND r.user_id = $1 AND r.deactivated_at IS NULL
            WHERE p.created_by = $1 OR r.user_id IS NOT NULL`, [ctx.userId]),
        pool.query(`SELECT count(*)::int AS n FROM role_room_education_cohorts WHERE owner_user_id = $1`, [ctx.userId]),
        pool.query(`SELECT EXISTS(SELECT 1 FROM talents WHERE owner_user_id = $1) AS has`, [ctx.userId]),
      ]);
      return {
        userId: ctx.userId,
        scopes: ctx.scopes,
        access: {
          projects: proj.rows[0].n,
          educationCohorts: coh.rows[0].n,
          hasTalentProfile: tal.rows[0].has === true,
        },
      };
    },
  },
  {
    name: "rr_get_my_talent_profile",
    description: "Hent den innloggede brukerens EGEN talent-/skuespillerprofil i Role Room Talents (ikke andres — det krever samtykke-gated agency-søk).",
    scope: "projects.read", modes: "*", projectScoped: false,
    inputSchema: OBJ({}),
    handler: async (pool, ctx) => {
      const r = await pool.query(
        `SELECT id, display_name, city, country, bio, agency_name, represented, playing_age_min, playing_age_max,
                gender, skills, languages, dialects, availability_status, willing_to_travel, profile_status, updated_at
           FROM talents WHERE owner_user_id = $1 LIMIT 1`, [ctx.userId]);
      return { talent: r.rows[0] ?? null };
    },
  },
  {
    name: "rr_list_cohorts",
    description: "List utdannings-kull som nøkkelens bruker eier (utdannings-modus). Dekker Kull-fanen.",
    scope: "projects.read", modes: ["education"], projectScoped: false,
    inputSchema: OBJ({ includeArchived: { type: "boolean", description: "Ta med arkiverte kull" }, ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      return paginatedList(pool, {
        key: "cohorts",
        columns: "id, name, program, term, archived, updated_at",
        from: "role_room_education_cohorts",
        where: `owner_user_id = $1${args.includeArchived ? "" : " AND archived IS NOT TRUE"}`,
        params: [ctx.userId],
        orderBy: "updated_at DESC",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_list_students",
    description: "List studenter i et eid utdannings-kull (utdannings-modus). Dekker Studenter-fanen.",
    scope: "projects.read", modes: ["education"], projectScoped: false,
    inputSchema: OBJ({ cohortId: STR("Kullets id"), ...PAGE_ARGS }, ["cohortId"]),
    handler: async (pool, ctx, args) => {
      const cohortId = typeof args.cohortId === "string" ? args.cohortId.trim() : "";
      if (!cohortId) throw new McpToolError(-32602, "cohortId er påkrevd.");
      const owns = await pool.query(`SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`, [cohortId, ctx.userId]);
      if (Number(owns.rowCount ?? 0) === 0) throw new McpToolError(-32004, "Ingen tilgang til dette kullet.");
      return paginatedList(pool, {
        key: "students",
        columns: "id, name, email, student_number, status",
        from: "role_room_education_students",
        where: "cohort_id = $1",
        params: [cohortId],
        orderBy: "name",
        defaultLimit: 200,
        maxLimit: 1000,
      }, args);
    },
  },

  // ── Casting/produksjon (PROD_MODES) ──────────────────────────────────────
  {
    name: "rr_list_roles",
    description: "List roller som skal castes på et prosjekt (navn, alder/kjønn, status, tildelt kandidat). Dekker Roller-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "roles",
        // playing_age_min/max + gender_options er de strukturerte feltene;
        // age_range/gender beholdes som fritekst-visning.
        columns:
          "id, name, description, age_range, playing_age_min, playing_age_max, " +
          "gender, gender_options, role_type, status, assigned_candidate_id",
        from: "casting_roles",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "created_at",
        defaultLimit: 100,
        maxLimit: 500,
      }, args);
    },
  },
  {
    name: "rr_list_locations",
    description: "List lokasjoner på et prosjekt (navn, adresse, type). Dekker Lokasjoner-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "locations",
        columns: "id, name, address, type, access_notes",
        from: "casting_locations",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "name",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_list_props",
    description: "List rekvisitter på et prosjekt (navn, kategori, antall, tilgjengelighet). Dekker Rekvisitter-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "props",
        columns: "id, name, category, quantity, availability",
        from: "casting_props",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "name",
        defaultLimit: 100,
        maxLimit: 500,
      }, args);
    },
  },
  {
    name: "rr_list_production_days",
    description: "List produksjonsdager/opptaksdager på et prosjekt (dato, status, notat). Dekker Produksjonsplan-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "productionDays",
        columns: "id, date, status, notes, location_id",
        from: "casting_production_days",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "date",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_list_manuscripts",
    description: "List manus på et prosjekt (kun metadata: tittel, format, versjon, status — ikke selve teksten). Dekker Story Arc/manus.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "manuscripts",
        columns: "id, title, format, version, status, updated_at",
        from: "casting_manuscripts",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "updated_at DESC",
        defaultLimit: 50,
        maxLimit: 200,
      }, args);
    },
  },
  {
    name: "rr_list_scenes",
    description: "List scener på et prosjekt (scenenr, tittel, INT/EXT, tid, karakterer). Valgfritt filtrer på manuskript.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), manuscriptId: STR("Valgfritt: filtrer på ett manus"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const manuscriptId = typeof args.manuscriptId === "string" ? args.manuscriptId.trim() : "";
      const params: unknown[] = [projectId];
      if (manuscriptId) params.push(manuscriptId);
      return paginatedList(pool, {
        key: "scenes",
        columns: "id, scene_number, title, int_ext, time_of_day, setting, characters",
        from: "casting_scenes",
        where: `project_id = $1${manuscriptId ? " AND manuscript_id = $2" : ""}`,
        params,
        orderBy: "scene_number",
        defaultLimit: 200,
        maxLimit: 1000,
      }, args);
    },
  },
  {
    name: "rr_list_equipment",
    description: "List utstyr tilgjengelig for et prosjekt (prosjektets eget + globalt katalog-utstyr). Dekker Utstyr.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "equipment",
        columns: "id, name, brand, model, category, status, quantity, is_global",
        from: "casting_equipment",
        where: "project_id = $1 OR is_global = TRUE",
        params: [projectId],
        orderBy: "name",
        defaultLimit: 100,
        maxLimit: 500,
      }, args);
    },
  },

  // ── Producer-arbeidsflyt (planlegging/økonomi/godkjenning/brief) ──────────
  {
    name: "rr_list_timeline",
    description: "List planlegger/tidslinje-oppgaver på et prosjekt (fase, tittel, eier, frist, status). Dekker Producer-tidslinje.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), phase: STR("Valgfritt fase-filter (pre/prod/post)"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const phase = typeof args.phase === "string" ? args.phase.trim() : "";
      const params: unknown[] = [projectId];
      if (phase) params.push(phase);
      return paginatedList(pool, {
        key: "timeline",
        columns: "id, phase, title, description, due_at, status",
        from: "role_room_phase_timeline_items",
        where: `project_id = $1${phase ? " AND phase = $2" : ""}`,
        params,
        orderBy: "sort_order, due_at NULLS LAST",
        defaultLimit: 100,
        maxLimit: 500,
      }, args);
    },
  },
  {
    name: "rr_list_budget_items",
    description: "List budsjettlinjer på et prosjekt (fase, kategori, estimat/godkjent/faktisk, status). Dekker Producer-økonomi.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "budgetItems",
        columns: "id, phase, category, item_name, estimate, approved, actual, currency, status",
        from: "role_room_budget_items",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "sort_order",
        defaultLimit: 100,
        maxLimit: 500,
      }, args);
    },
  },
  {
    name: "rr_list_client_reviews",
    description: "List klient-godkjenninger på et prosjekt (type, mål, status, forfall). Dekker Producer-godkjenning.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), status: STR("Valgfritt statusfilter"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const status = typeof args.status === "string" ? args.status.trim() : "";
      const params: unknown[] = [projectId];
      if (status) params.push(status);
      return paginatedList(pool, {
        key: "reviews",
        columns: "id, review_type, title, target_entity_type, status, due_at, decision_at",
        from: "role_room_client_reviews",
        where: `project_id = $1${status ? " AND status = $2" : ""}`,
        params,
        orderBy: "requested_at DESC",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_get_client_intake",
    description: "Hent klient-brief for et prosjekt (mål, leveranser, målgruppe, budskap, føringer). Dekker Client intake.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id") }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const r = await pool.query(
        `SELECT project_goal, deliverables, target_audience, key_message, timing_constraints, brand_notes, additional_notes, updated_at
           FROM role_room_client_intake WHERE project_id = $1 LIMIT 1`, [projectId]);
      return { intake: r.rows[0] ?? null };
    },
  },
  {
    name: "rr_list_client_materials",
    description: "List referansemateriell/lenker klienten har delt på et prosjekt (tittel, type, URL, fase). Dekker Client materials.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "materials",
        columns: "id, entry_type, title, external_url, phase, status",
        from: "role_room_client_materials",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "created_at DESC",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },

  // ── Utdanning (education-modus, eier-scopet) ─────────────────────────────
  {
    name: "rr_list_assignments",
    description: "List oppgaver/arbeidskrav i utdannings-workspacet (tittel, frist, status, vurderingsform, eksamen). Valgfritt filtrer på kull.",
    scope: "projects.read", modes: ["education"], projectScoped: false,
    inputSchema: OBJ({ cohortId: STR("Valgfritt: filtrer på ett kull"), ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      const cohortId = typeof args.cohortId === "string" ? args.cohortId.trim() : "";
      const params: unknown[] = [ctx.userId];
      if (cohortId) params.push(cohortId);
      return paginatedList(pool, {
        key: "assignments",
        columns: "id, cohort_id, title, due_at, status, vurderingsform, is_arbeidskrav, is_exam, course_id",
        from: "role_room_education_assignments",
        where: `owner_user_id = $1${cohortId ? " AND cohort_id = $2" : ""}`,
        params,
        orderBy: "due_at NULLS LAST",
        defaultLimit: 100,
        maxLimit: 500,
      }, args);
    },
  },
  {
    name: "rr_list_courses",
    description: "List emner i utdannings-workspacet (kode, tittel, studiepoeng, semester, vurderingsform). Dekker Emner-fanen.",
    scope: "projects.read", modes: ["education"], projectScoped: false,
    inputSchema: OBJ({ cohortId: STR("Valgfritt: filtrer på ett kull"), ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      const cohortId = typeof args.cohortId === "string" ? args.cohortId.trim() : "";
      const params: unknown[] = [ctx.userId];
      if (cohortId) params.push(cohortId);
      return paginatedList(pool, {
        key: "courses",
        columns: "id, cohort_id, code, title, credits, term, vurderingsform",
        from: "role_room_education_courses",
        where: `owner_user_id = $1${cohortId ? " AND cohort_id = $2" : ""}`,
        params,
        orderBy: "code",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_list_education_productions",
    description: "List studentproduksjoner (koblet til ekte casting_projects) i utdannings-workspacet. Dekker Studentproduksjoner-fanen.",
    scope: "projects.read", modes: ["education"], projectScoped: false,
    inputSchema: OBJ({ cohortId: STR("Valgfritt: filtrer på ett kull"), ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      const cohortId = typeof args.cohortId === "string" ? args.cohortId.trim() : "";
      const params: unknown[] = [ctx.userId];
      if (cohortId) params.push(cohortId);
      return paginatedList(pool, {
        key: "productions",
        columns: "id, cohort_id, project_id, title, updated_at",
        from: "role_room_education_productions",
        where: `owner_user_id = $1${cohortId ? " AND cohort_id = $2" : ""}`,
        params,
        orderBy: "updated_at DESC",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_list_groups",
    description: "List grupper i et eid utdannings-kull. Dekker Grupper.",
    scope: "projects.read", modes: ["education"], projectScoped: false,
    inputSchema: OBJ({ cohortId: STR("Kullets id"), ...PAGE_ARGS }, ["cohortId"]),
    handler: async (pool, ctx, args) => {
      const cohortId = typeof args.cohortId === "string" ? args.cohortId.trim() : "";
      if (!cohortId) throw new McpToolError(-32602, "cohortId er påkrevd.");
      return paginatedList(pool, {
        key: "groups",
        columns: "id, name",
        from: "role_room_education_groups",
        where: "owner_user_id = $1 AND cohort_id = $2",
        params: [ctx.userId, cohortId],
        orderBy: "name",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },

  // ── Avtaler (compat-store: legacy_compat_store JSONB-blober per prosjekt) ──
  {
    name: "rr_list_offers",
    description: "List tilbud sendt til kandidater på et prosjekt. Dekker Avtaler/tilbud.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const r = await pool.query(`SELECT store_value FROM legacy_compat_store WHERE store_key = $1 LIMIT 1`, [`casting:offers:${projectId}`]);
      return paginateArray("offers", (r.rows[0]?.store_value as unknown[]) ?? [], args);
    },
  },
  {
    name: "rr_list_contracts",
    description: "List kontrakter på et prosjekt (status/type). Dekker Avtaler/kontrakter.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const r = await pool.query(`SELECT store_value FROM legacy_compat_store WHERE store_key = $1 LIMIT 1`, [`casting:contracts:${projectId}`]);
      return paginateArray("contracts", (r.rows[0]?.store_value as unknown[]) ?? [], args);
    },
  },
  {
    name: "rr_list_shot_lists",
    description: "List shot-lists (bilde-/opptaksplaner) på et prosjekt. Dekker Storyboard/shot-list.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const r = await pool.query(`SELECT store_value FROM legacy_compat_store WHERE store_key = $1 LIMIT 1`, [`casting:shot-lists:${projectId}`]);
      return paginateArray("shotLists", (r.rows[0]?.store_value as unknown[]) ?? [], args);
    },
  },

  // ── Dans (dance_studio/dance_freelance) — egne SQL-tabeller, eier-scopet ──
  {
    name: "rr_list_dance_pieces",
    description: "List koreografier/danseverk (tittel, koreograf, musikk, varighet). Dekker Verk-fanen (dans).",
    scope: "projects.read", modes: DANCE_MODES, projectScoped: false,
    inputSchema: OBJ({ ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      return paginatedList(pool, {
        key: "pieces",
        columns: "id, title, choreographer, music_title, total_duration_sec, updated_at",
        from: "dance_choreography",
        where: "owner_user_id = $1",
        params: [ctx.userId],
        orderBy: "updated_at DESC",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_list_dance_performances",
    description: "List forestillinger (tittel, dato, sted, status, billetter). Dekker Forestillinger-fanen (dans).",
    scope: "projects.read", modes: DANCE_MODES, projectScoped: false,
    inputSchema: OBJ({ ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      return paginatedList(pool, {
        key: "performances",
        columns: "id, title, performance_date, venue, status, capacity, tickets_sold",
        from: "dance_performance",
        where: "owner_user_id = $1",
        params: [ctx.userId],
        orderBy: "performance_date DESC NULLS LAST",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_list_dance_classes",
    description: "List klasser/timeplan (tittel, type, tidspunkt, instruktør, rom). Dekker Klasser-fanen (dansestudio).",
    scope: "projects.read", modes: ["dance_studio"], projectScoped: false,
    inputSchema: OBJ({ ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      return paginatedList(pool, {
        key: "classes",
        columns: "id, title, kind, schedule_pattern, starts_at, ends_at, instructor_id, room_id, max_students",
        from: "dance_class",
        where: "owner_user_id = $1",
        params: [ctx.userId],
        orderBy: "starts_at NULLS LAST",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },
  {
    name: "rr_list_dance_instructors",
    description: "List instruktører (navn, stiler, kontrakt, timer). Dekker Instruktører-fanen (dansestudio).",
    scope: "projects.read", modes: ["dance_studio"], projectScoped: false,
    inputSchema: OBJ({ ...PAGE_ARGS }),
    handler: async (pool, ctx, args) => {
      return paginatedList(pool, {
        key: "instructors",
        columns: "id, display_name, styles, contract_kind, hours_logged",
        from: "dance_instructor",
        where: "owner_user_id = $1",
        params: [ctx.userId],
        orderBy: "display_name",
        defaultLimit: 100,
        maxLimit: 300,
      }, args);
    },
  },

  // ── Fase 2: UTKAST-verktøy (skriver, men KUN upubliserte utkast som en
  // produsent må godkjenne/publisere i UI). Aldri auto-utsendelse utad. ──────
  {
    name: "rr_draft_task",
    description: "Opprett en UTKASTS-oppgave i prosjektets planlegger (tidslinje). Utkastet er upublisert (status=draft) og må godkjennes/publiseres av en produsent i UI-et — det sender ingenting utad. Krever projects.write.",
    scope: "projects.write", modes: PROD_MODES, projectScoped: true, mutates: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      title: STR("Oppgavens tittel"),
      description: STR("Valgfri beskrivelse"),
      phase: { type: "string", description: "Fase: pre | production | post (default production)" },
    }, ["projectId", "title"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) throw new McpToolError(-32602, "title er påkrevd.");
      const phase = typeof args.phase === "string" && args.phase.trim() ? args.phase.trim() : "production";
      const description = typeof args.description === "string" ? args.description.trim() : null;
      const ins = await pool.query(
        `INSERT INTO role_room_phase_timeline_items (id, project_id, phase, title, description, status, created_by, metadata)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,'draft',$5,'{"source":"mcp","draft":true}'::jsonb) RETURNING id`,
        [projectId, phase, title, description, ctx.userId]);
      return { ok: true, id: ins.rows[0].id, status: "draft", note: "Upublisert utkast — publiseres/godkjennes i Role Room-UI." };
    },
  },
  {
    name: "rr_draft_budget_item",
    description: "Opprett en UTKASTS-budsjettlinje på et prosjekt (upublisert, status=draft — må godkjennes/publiseres i UI). Sender ingenting utad. Krever projects.write.",
    scope: "projects.write", modes: PROD_MODES, projectScoped: true, mutates: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      itemName: STR("Budsjettlinjens navn"),
      category: STR("Kategori (f.eks. utstyr, lønn, reise)"),
      estimate: { type: "number", description: "Estimert beløp" },
      phase: { type: "string", description: "Fase: pre | production | post (default production)" },
    }, ["projectId", "itemName", "category"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const itemName = typeof args.itemName === "string" ? args.itemName.trim() : "";
      const category = typeof args.category === "string" ? args.category.trim() : "";
      if (!itemName || !category) throw new McpToolError(-32602, "itemName og category er påkrevd.");
      const phase = typeof args.phase === "string" && args.phase.trim() ? args.phase.trim() : "production";
      const estimate = Number.isFinite(Number(args.estimate)) ? Number(args.estimate) : 0;
      const ins = await pool.query(
        `INSERT INTO role_room_budget_items (id, project_id, phase, category, item_name, estimate, status, created_by, metadata)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,'draft',$6,'{"source":"mcp","draft":true}'::jsonb) RETURNING id`,
        [projectId, phase, category, itemName, estimate, ctx.userId]);
      return { ok: true, id: ins.rows[0].id, status: "draft", note: "Upublisert utkast — publiseres/godkjennes i Role Room-UI." };
    },
  },
  {
    name: "rr_request_review",
    description: "Opprett en UTKASTS-forespørsel om klient-godkjenning på et prosjekt (upublisert, status=pending — produsenten publiserer/sender den i UI). Sender ingenting til klient automatisk. Krever projects.write.",
    scope: "projects.write", modes: PROD_MODES, projectScoped: true, mutates: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      title: STR("Hva skal godkjennes"),
      reviewType: { type: "string", description: "Type (f.eks. cut, storyboard, general) — default general" },
      description: STR("Valgfri beskrivelse"),
    }, ["projectId", "title"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) throw new McpToolError(-32602, "title er påkrevd.");
      const reviewType = typeof args.reviewType === "string" && args.reviewType.trim() ? args.reviewType.trim() : "general";
      const description = typeof args.description === "string" ? args.description.trim() : null;
      const ins = await pool.query(
        `INSERT INTO role_room_client_reviews (id, project_id, review_type, title, description, status, requested_by_user_id, metadata)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,'pending',$5,'{"source":"mcp","draft":true}'::jsonb) RETURNING id`,
        [projectId, reviewType, title, description, ctx.userId]);
      return { ok: true, id: ins.rows[0].id, status: "pending", note: "Upublisert godkjennings-forespørsel — publiseres/sendes til klient i Role Room-UI." };
    },
  },
  {
    name: "rr_draft_client_material",
    description: "Legg til et UTKAST av referansemateriell/lenke på et prosjekt (status=draft — bekreftes i UI). Sender ingenting utad. Krever projects.write.",
    scope: "projects.write", modes: PROD_MODES, projectScoped: true, mutates: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      title: STR("Tittel"),
      entryType: { type: "string", description: "Type: reference | link (default reference)" },
      externalUrl: STR("Valgfri URL"),
      phase: { type: "string", description: "Fase: pre | production | post" },
    }, ["projectId", "title"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) throw new McpToolError(-32602, "title er påkrevd.");
      const entryType = typeof args.entryType === "string" && args.entryType.trim() ? args.entryType.trim() : "reference";
      const externalUrl = typeof args.externalUrl === "string" ? args.externalUrl.trim() : null;
      const phase = typeof args.phase === "string" ? args.phase.trim() : null;
      const ins = await pool.query(
        `INSERT INTO role_room_client_materials (id, project_id, entry_type, title, external_url, phase, status, created_by_user_id, metadata)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,'draft',$6,'{"source":"mcp","draft":true}'::jsonb) RETURNING id`,
        [projectId, entryType, title, externalUrl, phase, ctx.userId]);
      return { ok: true, id: ins.rows[0].id, status: "draft", note: "Upublisert utkast — bekreftes i Role Room-UI." };
    },
  },

  {
    name: "rr_list_checklist_templates",
    description: "List sjekkliste-maler for produksjonsfaser, med de som passer prosjekttypen først. Malene gir en tom tidslinje innhold — punktene er handlinger med frist regnet fra opptaksstart.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const p = await pool.query<{ project_type: string | null }>(
        `SELECT project_type FROM casting_projects WHERE id = $1 LIMIT 1`, [projectId]);
      const templates = await listChecklistTemplates(pool, p.rows[0]?.project_type ?? null);
      return paginateArray("templates", templates, args);
    },
  },
  {
    name: "rr_budget_onboarding",
    description: "Sjekker om prosjektet trenger hjelp i gang med budsjettet: antall linjer, sum, om en nudge er relevant, og hvilke maler som passer prosjekttypen. Maser ikke på nye prosjekter uten aktivitet.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id") }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return getBudgetOnboardingState(pool, projectId);
    },
  },
  {
    name: "rr_role_pipeline",
    description: "Fordelingen av roller per steg i casting-trakta (kladd → utlyst → prøvespill → kortliste → tilbud → signert, pluss på vent/avlyst). Tomme steg tas med, fordi et hull midt i trakta er nettopp det man vil se.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id") }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return getProjectPipeline(pool, projectId);
    },
  },
  {
    name: "rr_check_equipment_availability",
    description: "Sjekk om utstyr er ledig i en periode FØR booking. Returnerer lagerantall, hvor mye som er booket i perioden, hvor mye som er ledig, og hvilke bookinger som eventuelt er i veien. Rygg-mot-rygg-utleie (én slutter når neste starter) regnes ikke som konflikt.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      equipmentId: STR("Utstyrets id"),
      startDate: STR("Fra (ISO-tidspunkt)"),
      endDate: STR("Til (ISO-tidspunkt)"),
      quantity: { type: "number", description: "Antall enheter det spørres om (default 1)" },
    }, ["projectId", "equipmentId", "startDate", "endDate"]),
    handler: async (pool, ctx, args) => {
      await requireProject(pool, ctx, args);
      const equipmentId = typeof args.equipmentId === "string" ? args.equipmentId.trim() : "";
      const startDate = typeof args.startDate === "string" ? args.startDate.trim() : "";
      const endDate = typeof args.endDate === "string" ? args.endDate.trim() : "";
      if (!equipmentId || !startDate || !endDate) {
        throw new McpToolError(-32602, "equipmentId, startDate og endDate er påkrevd.");
      }
      try {
        return await checkEquipmentAvailability(pool, {
          equipmentId,
          startDate,
          endDate,
          quantity: typeof args.quantity === "number" ? args.quantity : undefined,
        });
      } catch (err) {
        if (/Ukjent utstyr/.test((err as Error).message)) {
          throw new McpToolError(-32004, "Fant ikke utstyret.");
        }
        throw err;
      }
    },
  },

  // ── Buyout / rettigheter ─────────────────────────────────────────────────
  {
    name: "rr_list_buyout_terms",
    description: "List strukturerte buyout-vilkår på et prosjekt: territorier, medieflater, rettighetsperiode, eksklusivitet, opsjon og vederlag. For reklame er dette selve kontrakten.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "buyoutTerms",
        columns:
          "id, contract_id, candidate_id, role_id, territories, territories_note, " +
          "media_channels, starts_at, ends_at, unlimited, exclusivity, exclusivity_category, " +
          "renewal_option, renewal_fee, renewal_notice_days, fee, currency",
        from: "role_room_buyout_terms",
        where: "project_id = $1",
        params: [projectId],
        orderBy: "ends_at NULLS LAST",
        defaultLimit: 100,
        maxLimit: 500,
      }, args);
    },
  },
  {
    name: "rr_list_expiring_rights",
    description: "List rettigheter som utløper snart på et prosjekt, sortert med de mest akutte først. Allerede utløpte har negativ daysRemaining. Evigvarende kjøp utelates. renewalDeadlinePassed=true betyr at fristen for å utøve forlengelsesopsjonen er gått ut.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      withinDays: { type: "number", description: "Hvor mange dager fram i tid (default 90)" },
      limit: { type: "number", description: "Maks antall rader (default 200)" },
    }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const rights = await listExpiringRights(pool, {
        projectId,
        withinDays: typeof args.withinDays === "number" ? args.withinDays : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
      });
      return {
        rights,
        expired: rights.filter((r) => Number(r.days_remaining) < 0).length,
      };
    },
  },

  // ── Utkast-forvaltning: list / hent / slett ──────────────────────────────
  // Uten disse kunne en agent opprette utkast, men aldri se eller rydde dem
  // igjen — testutkast ble liggende i produsentens planlegger. Verktøyene
  // her ser KUN rader som bærer markøren metadata->>'source' = 'mcp' og som
  // fortsatt er upubliserte. Ekte produsentdata kan altså ikke slettes.
  {
    name: "rr_list_drafts",
    description: "List utkast opprettet via MCP på et prosjekt (planlegger-oppgaver, budsjettlinjer, godkjennings-forespørsler, referansemateriell). Viser kun upubliserte agent-utkast — ikke produsentens egne rader. Bruk denne for å finne igjen og rydde bort testutkast.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      entityType: STR(`Valgfritt filter: ${DRAFT_ENTITY_TYPES.join(" | ")}`),
      ...PAGE_ARGS,
    }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const filter = typeof args.entityType === "string" ? args.entityType.trim() : "";
      if (filter && !isDraftEntityType(filter)) {
        throw new McpToolError(-32602, `Ukjent entityType. Gyldige: ${DRAFT_ENTITY_TYPES.join(", ")}.`);
      }
      const types = filter ? [filter as DraftEntityType] : [...DRAFT_ENTITY_TYPES];
      const page = readPageArgs(args, 100, 500);

      // UNION ALL over utkast-tabellene, normalisert til én form.
      const union = types
        .map((t) => {
          const e = DRAFT_ENTITIES[t];
          return `SELECT '${t}'::text AS entity_type, ${e.idCol}::text AS id, ${e.titleCol} AS title,
                         status::text AS status, ${e.createdAtCol} AS created_at
                    FROM ${e.table}
                   WHERE project_id = $1 AND ${draftGuardSql(e)}`;
        })
        .join(" UNION ALL ");

      const [rows, count] = await Promise.all([
        pool.query(
          `SELECT * FROM (${union}) d ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [projectId, page.limit, page.offset],
        ),
        pool.query(`SELECT COUNT(*)::int AS total FROM (${union}) d`, [projectId]),
      ]);

      return {
        drafts: rows.rows,
        pagination: buildPageInfo(Number(count.rows[0]?.total ?? 0), page),
      };
    },
  },
  {
    name: "rr_get_draft",
    description: "Hent ett MCP-opprettet utkast med detaljer. Krever entityType + draftId. Returnerer feil hvis raden ikke er et upublisert agent-utkast.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      entityType: STR(`En av: ${DRAFT_ENTITY_TYPES.join(" | ")}`),
      draftId: STR("Utkastets id"),
    }, ["projectId", "entityType", "draftId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const { entity, draftId } = readDraftRef(args);
      const r = await pool.query(
        `SELECT * FROM ${entity.table}
          WHERE ${entity.idCol}::text = $1 AND project_id = $2 AND ${draftGuardSql(entity)} LIMIT 1`,
        [draftId, projectId],
      );
      if (Number(r.rowCount ?? 0) === 0) {
        throw new McpToolError(-32004, "Fant ikke et upublisert MCP-utkast med denne id-en.");
      }
      return { draft: r.rows[0] };
    },
  },
  {
    name: "rr_delete_draft",
    description: "Slett et MCP-opprettet utkast. Sletter KUN rader som bærer agent-markøren og fortsatt er upubliserte — publiserte rader og produsentens egne data røres ikke. Krever projects.write.",
    scope: "projects.write", modes: PROD_MODES, projectScoped: true, mutates: true,
    inputSchema: OBJ({
      projectId: STR("Prosjektets id"),
      entityType: STR(`En av: ${DRAFT_ENTITY_TYPES.join(" | ")}`),
      draftId: STR("Utkastets id"),
    }, ["projectId", "entityType", "draftId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const { entity, draftId, entityType } = readDraftRef(args);
      const r = await pool.query(
        `DELETE FROM ${entity.table}
          WHERE ${entity.idCol}::text = $1 AND project_id = $2 AND ${draftGuardSql(entity)}
          RETURNING ${entity.idCol}::text AS id`,
        [draftId, projectId],
      );
      if (Number(r.rowCount ?? 0) === 0) {
        // Bevisst samme feil som «finnes ikke»: en agent skal ikke kunne
        // kartlegge publiserte rader ved å prøve å slette dem.
        throw new McpToolError(-32004, "Fant ikke et upublisert MCP-utkast med denne id-en.");
      }
      return { ok: true, deleted: { entityType, id: r.rows[0].id } };
    },
  },

  // ── Syntese / agent-vennlig ──────────────────────────────────────────────
  {
    name: "rr_project_summary",
    description: "Aggregert status for ett prosjekt i ett kall: roller (totalt/tildelt), antall kandidater og crew, neste opptaksdag, budsjett (sum estimat/godkjent/faktisk), og antall åpne klient-godkjenninger. Ideelt for «gi meg statusen på X».",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id") }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const [proj, roles, cands, crew, nextDay, budget, reviews] = await Promise.all([
        pool.query(`SELECT name, status, project_type FROM casting_projects WHERE id = $1`, [projectId]),
        pool.query(`SELECT count(*)::int AS total, count(assigned_candidate_id)::int AS assigned FROM casting_roles WHERE project_id = $1`, [projectId]),
        pool.query(`SELECT count(*)::int AS n FROM casting_candidates WHERE project_id = $1`, [projectId]),
        pool.query(`SELECT count(*)::int AS n FROM casting_user_roles WHERE project_id = $1 AND deactivated_at IS NULL`, [projectId]),
        pool.query(`SELECT min(date) AS d FROM casting_production_days WHERE project_id = $1 AND date >= CURRENT_DATE`, [projectId]),
        pool.query(`SELECT coalesce(sum(estimate),0) AS estimate, coalesce(sum(approved),0) AS approved, coalesce(sum(actual),0) AS actual FROM role_room_budget_items WHERE project_id = $1`, [projectId]),
        pool.query(`SELECT count(*)::int AS n FROM role_room_client_reviews WHERE project_id = $1 AND status = 'pending'`, [projectId]),
      ]);
      const p = proj.rows[0] ?? {};
      const r = roles.rows[0] ?? { total: 0, assigned: 0 };
      const b = budget.rows[0] ?? {};
      return {
        project: { id: projectId, name: p.name, status: p.status, type: p.project_type },
        roles: { total: r.total, assigned: r.assigned, unassigned: r.total - r.assigned },
        candidates: cands.rows[0].n,
        crew: crew.rows[0].n,
        nextProductionDay: nextDay.rows[0].d ?? null,
        budget: { estimate: Number(b.estimate ?? 0), approved: Number(b.approved ?? 0), actual: Number(b.actual ?? 0) },
        openClientReviews: reviews.rows[0].n,
      };
    },
  },

  // ── Dypere lese-detalj ───────────────────────────────────────────────────
  {
    name: "rr_get_candidate",
    description: "Hent detaljer om én kandidat/medvirkende på et prosjekt (navn, kontakt, byrå, status, rating, notater, tildelte roller, samtykke-status).",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), candidateId: STR("Kandidatens id") }, ["projectId", "candidateId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const candidateId = typeof args.candidateId === "string" ? args.candidateId.trim() : "";
      if (!candidateId) throw new McpToolError(-32602, "candidateId er påkrevd.");
      const r = await pool.query(
        `SELECT id, name, email, phone, agency, status, rating, notes, assigned_roles, consent_status, updated_at
           FROM casting_candidates WHERE id = $1 AND project_id = $2 LIMIT 1`, [candidateId, projectId]);
      if (Number(r.rowCount ?? 0) === 0) throw new McpToolError(-32004, "Kandidaten finnes ikke i dette prosjektet.");
      return { candidate: r.rows[0] };
    },
  },
  {
    name: "rr_list_equipment_bookings",
    description: "List utstyrsreservasjoner på et prosjekt (utstyr, fra/til-dato, status, antall). Dekker Utstyr-bookinger.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), ...PAGE_ARGS }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      return paginatedList(pool, {
        key: "bookings",
        columns: "b.id, b.equipment_id, e.name AS equipment_name, b.start_date, b.end_date, b.status, b.quantity",
        from: "equipment_bookings b LEFT JOIN casting_equipment e ON e.id = b.equipment_id",
        where: "b.project_id = $1",
        params: [projectId],
        orderBy: "b.start_date NULLS LAST",
        defaultLimit: 100,
        maxLimit: 300,
        // LEFT JOIN på utstyr kan ikke duplisere (e.id er PK), så COUNT(*)
        // teller reservasjoner korrekt.
      }, args);
    },
  },

  // ── Utkast (utdanning) ───────────────────────────────────────────────────
  {
    name: "rr_draft_assignment",
    description: "Opprett en UTKASTS-oppgave i utdannings-workspacet (status=draft — faglærer publiserer i UI). Valgfritt knyttet til et eid kull. Krever projects.write.",
    scope: "projects.write", modes: ["education"], projectScoped: false, mutates: true,
    inputSchema: OBJ({
      title: STR("Oppgavens tittel"),
      brief: STR("Valgfri oppgavetekst/brief"),
      cohortId: STR("Valgfritt: knytt til et eid kull"),
      dueAt: STR("Valgfri frist (ISO-dato)"),
    }, ["title"]),
    handler: async (pool, ctx, args) => {
      const title = typeof args.title === "string" ? args.title.trim() : "";
      if (!title) throw new McpToolError(-32602, "title er påkrevd.");
      const cohortId = typeof args.cohortId === "string" && args.cohortId.trim() ? args.cohortId.trim() : null;
      if (cohortId) {
        const owns = await pool.query(`SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`, [cohortId, ctx.userId]);
        if (Number(owns.rowCount ?? 0) === 0) throw new McpToolError(-32004, "Ingen tilgang til dette kullet.");
      }
      const brief = typeof args.brief === "string" ? args.brief.trim() : null;
      const dueAt = typeof args.dueAt === "string" && args.dueAt.trim() ? args.dueAt.trim() : null;
      const id = newEntityId("assignment");
      await pool.query(
        `INSERT INTO role_room_education_assignments (id, owner_user_id, cohort_id, title, brief, due_at, status, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,'draft','{"source":"mcp","draft":true}'::jsonb)`,
        [id, ctx.userId, cohortId, title, brief, dueAt]);
      return { ok: true, id, status: "draft", note: "Upublisert oppgave-utkast — publiseres i utdannings-workspacet." };
    },
  },

  // ── Talents (byrå-marketplace, samtykke-gated PII) ──────────────────────────
  {
    name: "rr_search_talents",
    description:
      "Søk i The Role Room Talents-registeret (byrå-representerte skuespillere/utøvere). KREVER at nøkkelens bruker tilhører et byrå. Returnerer KUN talenter som har gitt DITT byrå aktivt samtykke, og hvert felt er maskert etter hvilke scopes talentet har delt (samtykke-transparens, GDPR). Filtre: fritekst, sted, kjønn, spillalder, språk, ferdigheter, dialekter, tilgjengelighet, selftape, representasjon.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: false,
    inputSchema: OBJ({
      q: STR("Fritekstsøk (navn, bio, ferdigheter)"),
      location: STR("Sted/by"),
      gender: STR("Kjønn"),
      ageMin: { type: "number", description: "Min spillalder" },
      ageMax: { type: "number", description: "Maks spillalder" },
      languages: { type: "array", items: { type: "string" }, description: "Språk (må matche alle oppgitte)" },
      skills: { type: "array", items: { type: "string" }, description: "Ferdigheter" },
      dialects: { type: "array", items: { type: "string" }, description: "Dialekter" },
      availability: STR("Tilgjengelighetsstatus (f.eks. available)"),
      hasSelftape: { type: "boolean", description: "Kun talenter med selftape/showreel" },
      representation: STR("Representasjonsstatus"),
      limit: { type: "number", description: "Maks antall (default 50, maks 200)" },
    }),
    handler: async (pool, ctx, args) => {
      // Talent-søk er byrå-scopet, ikke prosjekt-scopet. Løs nøkkelens byrå;
      // ingen byrå → tydelig feil (verktøyet er kun for representerende byråer).
      const agency = await fetchAgencyForUser(pool, ctx.userId);
      if (!agency) {
        throw new McpToolError(-32004,
          "Talent-søk krever en byrå-konto i The Role Room Talents — nøkkelens bruker tilhører ikke et byrå.");
      }
      // Reflekter MCP-argumentene til query-formatet parseFilters forventer,
      // så vi arver ÉN kanonisk filter-parser (arrays, tall, defaults).
      const filters = parseFilters({
        q: args.q, location: args.location, gender: args.gender,
        age_min: args.ageMin, age_max: args.ageMax,
        languages: args.languages, skills: args.skills, dialects: args.dialects,
        availability: args.availability,
        has_selftape: args.hasSelftape === true ? "true" : undefined,
        representation: args.representation, limit: args.limit,
      });
      // demo=false → ekte data. buildSearchSql = consent-gaten; maskByScopes =
      // PII-maskeringen. Begge gjenbrukt 1:1 fra UI-søket (ikke reimplementert).
      const { sql, params } = buildSearchSql(agency.type, agency.id, filters, false);
      const result = await pool.query(sql, params);
      const talents = result.rows.map(maskByScopes);
      return {
        agency: { name: agency.name, type: agency.type },
        count: talents.length,
        filters,
        talents,
        note: "Kun talenter med aktivt samtykke til ditt byrå; felt maskert etter delte scopes.",
      };
    },
  },
];

/** Verktøy nøkkelen har scope for (+ valgfritt modus-filter) → MCP tool-definisjoner. */
export function listCapabilitiesFor(scopes: string[], mode?: string): McpCapability[] {
  return ROLE_ROOM_CAPABILITIES.filter((c) => {
    if (!hasScope(scopes, c.scope)) return false;
    if (mode && c.modes !== "*" && !c.modes.includes(mode as RoleRoomMode)) return false;
    return true;
  });
}

export function findCapability(name: string): McpCapability | undefined {
  return ROLE_ROOM_CAPABILITIES.find((c) => c.name === name);
}

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

/** Dokumentert speil av frontendens ProfessionMode + utdannings-modus. */
export const ROLE_ROOM_MODES = [
  "production", "photographer", "content_producer", "content_creator",
  "dance_studio", "dance_freelance", "education",
] as const;
export type RoleRoomMode = (typeof ROLE_ROOM_MODES)[number];

/** Alle produksjons-lignende moduser (deler casting/produksjons-domenet). */
const PROD_MODES: RoleRoomMode[] = ["production", "photographer", "content_producer", "content_creator"];

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
  inputSchema: Record<string, unknown>;
  handler: (pool: Pool, ctx: McpCallContext, args: Record<string, unknown>) => Promise<unknown>;
}

// ── Delte hjelpere ────────────────────────────────────────────────────────
const OBJ = (props: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: "object", properties: props, required, additionalProperties: false,
});
const STR = (description: string) => ({ type: "string", description });

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
    inputSchema: OBJ({ status: STR("Valgfritt statusfilter"), limit: { type: "number", description: "Maks antall (default 50)" } }),
    handler: async (pool, ctx, args) => {
      const limit = Math.min(Number(args.limit) || 50, 200);
      const status = typeof args.status === "string" ? args.status.trim() : "";
      const r = await pool.query(
        `SELECT DISTINCT p.id, p.name, p.status, p.project_type, p.updated_at
           FROM casting_projects p
           LEFT JOIN casting_user_roles r ON r.project_id = p.id AND r.user_id = $1 AND r.deactivated_at IS NULL
          WHERE (p.created_by = $1 OR r.user_id IS NOT NULL) ${status ? "AND p.status = $3" : ""}
          ORDER BY p.updated_at DESC NULLS LAST LIMIT $2`,
        status ? [ctx.userId, limit, status] : [ctx.userId, limit],
      );
      return { projects: r.rows };
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
    inputSchema: OBJ({ projectId: STR("Prosjektets id") }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const r = await pool.query(
        `SELECT user_id, email, role, added_by, created_at
           FROM casting_user_roles WHERE project_id = $1 AND deactivated_at IS NULL ORDER BY created_at`, [projectId]);
      return { members: r.rows };
    },
  },
  {
    name: "rr_list_candidates",
    description: "List medvirkende/kandidater på et prosjekt (prosjektets egne casting-data — kun for prosjektmedlemmer). Dekker Kandidater-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id"), status: STR("Valgfritt statusfilter") }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const status = typeof args.status === "string" ? args.status.trim() : "";
      const r = await pool.query(
        `SELECT id, name, email, agency, status, rating, assigned_roles, consent_status, updated_at
           FROM casting_candidates WHERE project_id = $1 ${status ? "AND status = $2" : ""}
          ORDER BY updated_at DESC NULLS LAST LIMIT 500`,
        status ? [projectId, status] : [projectId]);
      return { candidates: r.rows };
    },
  },
  {
    name: "rr_list_auditions",
    description: "List auditions/prøvespill på et prosjekt (tittel, rolle, dato, status). Dekker Auditions-fanen.",
    scope: "projects.read", modes: PROD_MODES, projectScoped: true,
    inputSchema: OBJ({ projectId: STR("Prosjektets id") }, ["projectId"]),
    handler: async (pool, ctx, args) => {
      const projectId = await requireProject(pool, ctx, args);
      const r = await pool.query(
        `SELECT id, title, role_name, location_name, date, start_time, end_time, status
           FROM auditions WHERE project_id = $1 ORDER BY date DESC NULLS LAST LIMIT 200`, [projectId]);
      return { auditions: r.rows };
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
    inputSchema: OBJ({ includeArchived: { type: "boolean", description: "Ta med arkiverte kull" } }),
    handler: async (pool, ctx, args) => {
      const r = await pool.query(
        `SELECT id, name, program, term, archived, updated_at FROM role_room_education_cohorts
          WHERE owner_user_id = $1 ${args.includeArchived ? "" : "AND archived IS NOT TRUE"} ORDER BY updated_at DESC`,
        [ctx.userId]);
      return { cohorts: r.rows };
    },
  },
  {
    name: "rr_list_students",
    description: "List studenter i et eid utdannings-kull (utdannings-modus). Dekker Studenter-fanen.",
    scope: "projects.read", modes: ["education"], projectScoped: false,
    inputSchema: OBJ({ cohortId: STR("Kullets id") }, ["cohortId"]),
    handler: async (pool, ctx, args) => {
      const cohortId = typeof args.cohortId === "string" ? args.cohortId.trim() : "";
      if (!cohortId) throw new McpToolError(-32602, "cohortId er påkrevd.");
      const owns = await pool.query(`SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`, [cohortId, ctx.userId]);
      if (Number(owns.rowCount ?? 0) === 0) throw new McpToolError(-32004, "Ingen tilgang til dette kullet.");
      const r = await pool.query(
        `SELECT id, name, email, student_number, status FROM role_room_education_students WHERE cohort_id = $1 ORDER BY name`, [cohortId]);
      return { students: r.rows };
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

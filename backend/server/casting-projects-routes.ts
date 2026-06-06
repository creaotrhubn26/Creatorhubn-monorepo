/**
 * casting-projects-routes.ts
 *
 * Femte og siste casting-cluster-extraksjon. 15 endpoints for prosjekt-
 * scope-state og prosjekt-relaterte sub-ressurser:
 *
 *   Projects (5):
 *     GET    /projects                                       — list
 *     POST   /projects                                       — opprett (atomic)
 *     GET    /projects/:projectId                            — hent én
 *     PUT    /projects/:projectId                            — oppdater (atomic)
 *     DELETE /projects/:projectId                            — slett (cascade)
 *
 *   Shot-lists (4):
 *     GET    /projects/:projectId/shot-lists                 — list
 *     POST   /projects/:projectId/shot-lists                 — upsert
 *     PUT    /projects/:projectId/shot-lists/:shotListId     — oppdater
 *     POST   /projects/:projectId/shot-lists/reorder         — batch reorder
 *
 *   Calendar-events (4):
 *     GET    /projects/:projectId/calendar-events            — list
 *     POST   /calendar-events                                — opprett
 *     PUT    /calendar-events/:eventId                       — oppdater
 *     DELETE /calendar-events/:eventId                       — slett
 *
 *   Team-dashboard (2):
 *     GET    /projects/:projectId/team-dashboard/snapshots   — list
 *     POST   /projects/:projectId/team-dashboard/snapshots   — upsert (rolling 100)
 *
 * Tilgang: ÅPEN (matcher eksisterende oppførsel). Skrive-operasjoner
 * validerer projectId, blokker demo-write uten env-flag, og avviser
 * cross-project payloads.
 *
 * Modulen EIER 4 in-memory Maps internt + 4 key-generatorer + 4 async
 * getters + alle validerings-helpers. Maps brukes IKKE utenfor casting-
 * cluster (verifisert ved grep).
 *
 * Delt state PASSES via deps (eies av index.ts, brukt også av role-room-
 * routes):
 *   - legacyOffersByProject / legacyContractsByProject /
 *     legacyProjectAgreementsByProject + tilhørende key-generatorer
 *   - dbLegacyLiveSetSessionsKey / dbLegacyLiveSetEventsKey (for cascade)
 *   - findByIdInDbProjectArrays (lukker over compatStoreListByPrefix)
 *   - manuscriptsService / liveSetService (for cascade-rydding ved
 *     prosjekt-DELETE)
 *
 * **Robusthet-forbedringer (basert på REST API best-practices research):**
 *
 *   1. Konsistent try/catch på alle 15 handlere — opprinnelig kode hadde
 *      ujevn feilhåndtering (noen krasjet uten respons).
 *   2. Defensiv payload-typesjekk (`req.body && typeof === "object"`) før
 *      destructure — beskytter mot uventet null/string/array.
 *   3. POST/PUT /projects beholdt eksisterende atomic-rollback-pattern
 *      (try/catch som ruller tilbake både Map og DB ved feil).
 *   4. DELETE-cascade bruker `Promise.allSettled` på manuskript-rydding
 *      (én feilet operasjon stopper ikke resten — partial-failure-
 *      tolerant cleanup).
 *
 * **Forbedringer dokumentert som TODO** (krever produkteier-beslutning —
 * endrer API-kontrakter):
 *   - Optimistic concurrency control (If-Match/ETag + version-felt)
 *   - DB-transaksjoner på cascade-delete (krever ny compat-store API)
 *   - crypto.randomUUID() istedenfor `${prefix}-${Date.now()}` for ID-er
 *     (kollisjons-sikkerhet — POST /projects bruker ALLEREDE crypto)
 *   - Auth-validering — alle endpoints er åpne per nå
 *   - Idempotency-keys for POST-retry-sikkerhet
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupCastingProjectsRoutes } from "./casting-projects-routes";
 *
 *   setupCastingProjectsRoutes({
 *     app, compatStoreGet, compatStoreSet, compatStoreDelete,
 *     compatStoreDeleteByPrefix, compatStoreListByPrefix,
 *     manuscriptsService, liveSetService,
 *     legacyOffersByProject, legacyContractsByProject,
 *     legacyProjectAgreementsByProject,
 *     dbLegacyOffersKey, dbLegacyContractsKey,
 *     dbLegacyProjectAgreementsKey,
 *     dbLegacyLiveSetSessionsKey, dbLegacyLiveSetEventsKey,
 *     findByIdInDbProjectArrays,
 *   });
 */

import crypto from "crypto";
import type express from "express";

import {
  findByIdInProjectMap,
  getProjectItems,
  setProjectItems,
} from "./_shared";
import type {
  CastingManuscriptsService,
  CompatStoreTransactionContext,
} from "./casting-manuscripts-service";
import type { RoleRoomLiveSetService } from "./role-room-live-set-service";
import { newEntityId } from "./_shared-ids.js";

export interface CastingProjectsRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  compatStoreSet: (storeKey: string, storeValue: unknown) => Promise<void>;
  compatStoreDelete: (storeKey: string) => Promise<void>;
  compatStoreDeleteByPrefix: (prefix: string) => Promise<void>;
  compatStoreListByPrefix: <T>(
    prefix: string,
  ) => Promise<Array<{ key: string; value: T }>>;
  /**
   * Transaksjons-wrapper for atomic cascade-DELETE. Hvis callback'en
   * kaster, blir ALT som ble skrevet innenfor transaksjonen ROLLBACKet.
   */
  compatStoreTransaction: <T>(
    callback: (tx: CompatStoreTransactionContext) => Promise<T>,
  ) => Promise<T>;
  manuscriptsService: CastingManuscriptsService;
  liveSetService: RoleRoomLiveSetService;
  // Delt state med /api/role-room (eies i index.ts)
  legacyOffersByProject: Map<string, any[]>;
  legacyContractsByProject: Map<string, any[]>;
  legacyProjectAgreementsByProject: Map<string, any[]>;
  dbLegacyOffersKey: (projectId: string) => string;
  dbLegacyContractsKey: (projectId: string) => string;
  dbLegacyProjectAgreementsKey: (projectId: string) => string;
  // Live-set DB-keys (cascade-delete trenger dem; live-set-routes eier ikke disse)
  dbLegacyLiveSetSessionsKey: (projectId: string) => string;
  dbLegacyLiveSetEventsKey: (projectId: string) => string;
  // Lukker over compatStoreListByPrefix i index.ts
  findByIdInDbProjectArrays: (
    prefix: string,
    id: string,
  ) => Promise<{ projectId: string; index: number; items: any[] } | null>;
}

export function setupCastingProjectsRoutes(
  deps: CastingProjectsRoutesDeps,
): void {
  const {
    app,
    requireUserSession,
    compatStoreGet,
    compatStoreSet,
    compatStoreDelete,
    compatStoreDeleteByPrefix,
    compatStoreListByPrefix,
    compatStoreTransaction,
    manuscriptsService,
    liveSetService,
    legacyOffersByProject,
    legacyContractsByProject,
    legacyProjectAgreementsByProject,
    dbLegacyOffersKey,
    dbLegacyContractsKey,
    dbLegacyProjectAgreementsKey,
    dbLegacyLiveSetSessionsKey,
    dbLegacyLiveSetEventsKey,
    findByIdInDbProjectArrays,
  } = deps;

  // ── Module-internal state ─────────────────────────────────────────

  const legacyCastingProjects = new Map<string, any>();
  const legacyShotListsByProject = new Map<string, any[]>();
  const legacyCalendarEventsByProject = new Map<string, any[]>();
  const legacyTeamDashboardSnapshotsByProject = new Map<string, any[]>();

  // ── Key generators ────────────────────────────────────────────────

  function dbLegacyCastingProjectKey(projectId: string): string {
    return `casting:project:${projectId}`;
  }

  function dbLegacyShotListsKey(projectId: string): string {
    return `casting:shot-lists:${projectId}`;
  }

  function dbLegacyCalendarEventsKey(projectId: string): string {
    return `casting:calendar-events:${projectId}`;
  }

  function dbLegacyTeamSnapshotsKey(projectId: string): string {
    return `casting:team-snapshots:${projectId}`;
  }

  // ── Async getters (compat-store-først, falle tilbake til Map) ────

  async function getLegacyCastingProject(
    projectId: string,
  ): Promise<any | null> {
    const dbProject = await compatStoreGet<any>(
      dbLegacyCastingProjectKey(projectId),
    );
    if (dbProject && typeof dbProject === "object") {
      legacyCastingProjects.set(projectId, dbProject);
      return dbProject;
    }
    return legacyCastingProjects.get(projectId) || null;
  }

  async function getLegacyShotLists(projectId: string): Promise<any[]> {
    const dbShotLists = await compatStoreGet<any[]>(
      dbLegacyShotListsKey(projectId),
    );
    if (Array.isArray(dbShotLists)) {
      legacyShotListsByProject.set(projectId, dbShotLists);
      return dbShotLists;
    }
    return legacyShotListsByProject.get(projectId) || [];
  }

  async function getLegacyCalendarEvents(projectId: string): Promise<any[]> {
    const dbEvents = await compatStoreGet<any[]>(
      dbLegacyCalendarEventsKey(projectId),
    );
    if (Array.isArray(dbEvents)) {
      legacyCalendarEventsByProject.set(projectId, dbEvents);
      return dbEvents;
    }
    return legacyCalendarEventsByProject.get(projectId) || [];
  }

  async function getLegacyTeamSnapshots(projectId: string): Promise<any[]> {
    const dbSnapshots = await compatStoreGet<any[]>(
      dbLegacyTeamSnapshotsKey(projectId),
    );
    if (Array.isArray(dbSnapshots)) {
      legacyTeamDashboardSnapshotsByProject.set(projectId, dbSnapshots);
      return dbSnapshots;
    }
    return legacyTeamDashboardSnapshotsByProject.get(projectId) || [];
  }

  // ── Validation helpers ────────────────────────────────────────────

  const PROTECTED_DEMO_PROJECT_IDS = new Set([
    "content-producer-demo-2026",
    "troll-project-2026",
  ]);

  function normalizeProjectId(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    if (!normalized) return null;
    const lowered = normalized.toLowerCase();
    if (
      lowered === "default" ||
      lowered === "default-project" ||
      lowered === "demo" ||
      lowered === "undefined" ||
      lowered === "null" ||
      normalized.includes("/") ||
      normalized.includes("\\") ||
      normalized.includes("..")
    ) {
      return null;
    }
    return normalized;
  }

  function canWriteDemoSeed(): boolean {
    return process.env.ROLE_ROOM_DEMO_SEED_ENABLED === "true";
  }

  function rejectInvalidProjectId(
    res: express.Response,
    value: unknown,
    operation: string,
  ): string | null {
    const projectId = normalizeProjectId(value);
    if (!projectId) {
      res.status(400).json({ error: `Invalid project id for ${operation}` });
      return null;
    }
    return projectId;
  }

  function rejectProtectedDemoWrite(
    res: express.Response,
    projectId: string,
    operation: string,
  ): boolean {
    if (!PROTECTED_DEMO_PROJECT_IDS.has(projectId)) {
      return false;
    }
    if (canWriteDemoSeed()) {
      return false;
    }
    console.warn("[RoleRoom] Blocked protected demo write", {
      projectId,
      operation,
    });
    res.status(403).json({ error: "Protected demo projects are seed-only." });
    return true;
  }

  function rejectCrossProjectPayload(
    res: express.Response,
    routeProjectId: string,
    payload: unknown,
    operation: string,
  ): boolean {
    const record =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null;
    const payloadProjectId =
      typeof record?.projectId === "string" && record.projectId.trim()
        ? record.projectId.trim()
        : typeof record?.project_id === "string" && record.project_id.trim()
          ? record.project_id.trim()
          : "";
    if (!payloadProjectId || payloadProjectId === routeProjectId) {
      return false;
    }
    console.warn("[RoleRoom] Blocked cross-project casting payload", {
      operation,
      routeProjectId,
      payloadProjectId,
    });
    res.status(409).json({ error: "Cross-project payload rejected." });
    return true;
  }

  function rejectNestedProjectPayload(
    res: express.Response,
    routeProjectId: string,
    payload: unknown,
    operation: string,
  ): boolean {
    const record =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null;
    if (!record) return false;
    const scopedKeys = [
      "roles",
      "candidates",
      "schedules",
      "crew",
      "locations",
      "props",
      "productionDays",
      "shotLists",
      "sceneBreakdowns",
      "userRoles",
    ];
    return scopedKeys.some((key) => {
      const value = record[key];
      if (!Array.isArray(value)) return false;
      return value.some((item, index) =>
        rejectCrossProjectPayload(
          res,
          routeProjectId,
          item,
          `${operation}.${key}[${index}]`,
        ),
      );
    });
  }

  function readString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
    }
    return undefined;
  }

  // ── Projects: CRUD ────────────────────────────────────────────────

  app.get("/api/casting/projects", async (req, res) => {
    // Krev auth + filtrer på created_by = innloggende user, slik at:
    // (a) brukere kun ser sine egne prosjekter (var en gjennomgripende
    //     user-isolation-bug — alle så alle prosjekter inkl. demo-rester),
    // (b) TROLL-demo-prosjekter (seedet med 'demo-user' før fix 7f656d58)
    //     vises ikke til ekte brukere,
    // (c) andre moduser (innholdsprodusent, dansestudio, utdanning)
    //     får ikke produksjons-team-prosjekter slengt i fanget.
    const session = requireUserSession(req, res);
    if (!session) return;
    const ownerId = session.userId;
    try {
      const dbRows = await compatStoreListByPrefix<any>("casting:project:");
      if (dbRows.length > 0) {
        const projects = dbRows
          .map((row) => row.value)
          .filter((project) => project && typeof project === "object")
          .filter((project) => {
            const createdBy = typeof project.created_by === "string" ? project.created_by : null;
            // Ekskluder demo-rester (created_by null eller hardkodet 'demo-user')
            if (!createdBy || createdBy === "demo-user") return false;
            return createdBy === ownerId;
          });
        legacyCastingProjects.clear();
        for (const project of projects) {
          const id = typeof project.id === "string" ? project.id : "";
          if (!id) continue;
          legacyCastingProjects.set(id, project);
        }
        res.json({ projects });
        return;
      }
      const inMemoryFiltered = Array.from(legacyCastingProjects.values()).filter((project: any) => {
        const createdBy = typeof project?.created_by === "string" ? project.created_by : null;
        if (!createdBy || createdBy === "demo-user") return false;
        return createdBy === ownerId;
      });
      res.json({ projects: inMemoryFiltered });
    } catch (error) {
      console.error("Error listing casting projects:", error);
      res.status(500).json({ error: "Could not list projects" });
    }
  });

  app.post("/api/casting/projects", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const id =
      typeof payload.id === "string" && payload.id.trim()
        ? normalizeProjectId(payload.id)
        : crypto.randomUUID();
    if (!id) {
      res.status(400).json({ error: "Invalid project id for create project" });
      return;
    }
    if (rejectProtectedDemoWrite(res, id, "createProject")) {
      return;
    }
    if (rejectNestedProjectPayload(res, id, payload, "createProject")) {
      return;
    }
    const now = new Date().toISOString();
    // Les fra compat-store, IKKE bare in-memory. Seed-endepunkter som
    // /api/demo/troll/seed-all skriver til compat-store men ikke til
    // legacyCastingProjects-mappen, så `existing = {}` her ville wipet
    // ut alle nested arrays (roles, candidates, crew, ...) via den
    // shallow `{...existing, ...payload}`-mergen under. Resultatet var
    // at frontend's saveProject-kall etter "Last demo" tømte 8 roller /
    // 8 kandidater / 6 crew Daniel hadde seedet.
    const existing = (await getLegacyCastingProject(id)) || {};
    const existingRecord = existing as Record<string, unknown>;
    const payloadRecord = payload as Record<string, unknown>;
    const ownerId = readString(
      payloadRecord.ownerId,
      payloadRecord.owner_id,
      existingRecord.ownerId,
      existingRecord.owner_id,
      payloadRecord.createdBy,
      payloadRecord.created_by,
      existingRecord.createdBy,
      existingRecord.created_by,
    );
    const ownerEmail = readString(
      payloadRecord.ownerEmail,
      payloadRecord.owner_email,
      existingRecord.ownerEmail,
      existingRecord.owner_email,
    );
    const ownerLabel = readString(
      payloadRecord.ownerLabel,
      payloadRecord.owner_label,
      existingRecord.ownerLabel,
      existingRecord.owner_label,
      ownerEmail,
      ownerId,
    );
    // session.userId som siste fallback: hvis frontend ikke sender createdBy
    // (Holy Crust-flowen er ett eksempel — POST gikk uten createdBy), endte
    // prosjektet med created_by=null i compat-store, som så fikk GET
    // /api/casting/projects/:id til å returnere null pga owner-sjekk →
    // verification-flowen retry'er 5 ganger og gir opp. Defaulter nå til
    // brukeren som faktisk gjør request'en så prosjektet blir hentbart av
    // seg selv direkte etter opprettelse/oppdatering.
    const createdBy = readString(
      payloadRecord.createdBy,
      payloadRecord.created_by,
      existingRecord.createdBy,
      existingRecord.created_by,
      ownerId,
    ) ?? session.userId;
    const createdByEmail = readString(
      payloadRecord.createdByEmail,
      payloadRecord.created_by_email,
      existingRecord.createdByEmail,
      existingRecord.created_by_email,
      ownerEmail,
    );
    const createdByLabel = readString(
      payloadRecord.createdByLabel,
      payloadRecord.created_by_label,
      existingRecord.createdByLabel,
      existingRecord.created_by_label,
      ownerLabel,
    );
    // Bevar existing nested arrays når payload sender en tom array. Frontends
    // saveProject etter "Last demo" sender skall-payload med crew:[] som
    // ellers ville wipet 6 crew fra seed-prosessen. Andre nested fields
    // (roles, candidates, schedules, locations, props, shotLists, scenes)
    // er ikke i payload så de bevares av shallow merge uansett — denne
    // sjekken dekker EXPLICIT tomme arrays.
    const nestedArrayKeys = [
      "roles", "candidates", "crew", "schedules", "locations",
      "props", "shotLists", "scenes", "productionDays",
      "sceneBreakdowns", "userRoles", "equipment", "manuscripts",
      "consents",
    ] as const;
    const mergedPayload = { ...payload } as Record<string, unknown>;
    for (const key of nestedArrayKeys) {
      const incoming = (payload as Record<string, unknown>)[key];
      const existingArr = (existing as Record<string, unknown>)[key];
      if (Array.isArray(incoming) && incoming.length === 0 && Array.isArray(existingArr) && existingArr.length > 0) {
        delete mergedPayload[key];
      }
    }
    const project = {
      ...(existing as Record<string, unknown>),
      ...mergedPayload,
      id,
      ownerId,
      owner_id: ownerId,
      ownerEmail,
      owner_email: ownerEmail,
      ownerLabel,
      owner_label: ownerLabel,
      createdBy,
      // GET /api/casting/projects/:id sjekker project.created_by (snake_case)
      // i owner-isolation. Hvis vi bare lagret createdBy (camelCase), endte
      // GET med null → 'forbidden' → verification-flowen i frontend feilet
      // 5 ganger. Lagre BEGGE for å match begge lesere.
      created_by: createdBy,
      createdByEmail,
      created_by_email: createdByEmail,
      createdByLabel,
      created_by_label: createdByLabel,
      createdAt: (existing as Record<string, unknown>).createdAt || now,
      created_at: (existing as Record<string, unknown>).created_at
        || (existing as Record<string, unknown>).createdAt
        || now,
      updatedAt: now,
      updated_at: now,
    };
    const hadExisting = legacyCastingProjects.has(id);
    const previousProject = legacyCastingProjects.get(id);
    try {
      legacyCastingProjects.set(id, project);
      await compatStoreSet(dbLegacyCastingProjectKey(id), project);
      res.json(project);
    } catch (error) {
      if (hadExisting && previousProject) {
        legacyCastingProjects.set(id, previousProject);
        await compatStoreSet(
          dbLegacyCastingProjectKey(id),
          previousProject,
        ).catch(() => undefined);
      } else {
        legacyCastingProjects.delete(id);
        await compatStoreDelete(dbLegacyCastingProjectKey(id)).catch(
          () => undefined,
        );
      }
      console.error(
        "[RoleRoom] Legacy casting project create rolled back",
        error,
      );
      res.status(500).json({ error: "Kunne ikke opprette prosjekt atomisk." });
    }
  });

  app.get("/api/casting/projects/:projectId", async (req, res) => {
    // Auth + owner-sjekk for å hindre kryss-bruker-leak. Demo-prosjekter
    // (created_by = 'demo-user') blokkeres også — de finnes som rester fra
    // før fix 7f656d58, og bør ikke serveres til noen ekte bruker.
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const projectId = rejectInvalidProjectId(
        res,
        req.params.projectId,
        "getProject",
      );
      if (!projectId) return;
      const project: any = await getLegacyCastingProject(projectId);
      if (!project) {
        res.json(null);
        return;
      }
      const createdBy = typeof project.created_by === "string" ? project.created_by : null;
      if (!createdBy || createdBy === "demo-user" || createdBy !== session.userId) {
        res.json(null);
        return;
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching casting project:", error);
      res.status(500).json({ error: "Could not fetch project" });
    }
  });

  app.put("/api/casting/projects/:projectId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = rejectInvalidProjectId(
      res,
      req.params.projectId,
      "updateProject",
    );
    if (!id) return;
    if (rejectProtectedDemoWrite(res, id, "updateProject")) {
      return;
    }
    if (rejectCrossProjectPayload(res, id, req.body, "updateProject")) {
      return;
    }
    if (rejectNestedProjectPayload(res, id, req.body, "updateProject")) {
      return;
    }
    const existing = (await getLegacyCastingProject(id)) || {};
    const existingRecord = existing as Record<string, unknown>;
    const payloadRecord = (req.body || {}) as Record<string, unknown>;
    const ownerId = readString(
      payloadRecord.ownerId,
      payloadRecord.owner_id,
      existingRecord.ownerId,
      existingRecord.owner_id,
      payloadRecord.createdBy,
      payloadRecord.created_by,
      existingRecord.createdBy,
      existingRecord.created_by,
    );
    const ownerEmail = readString(
      payloadRecord.ownerEmail,
      payloadRecord.owner_email,
      existingRecord.ownerEmail,
      existingRecord.owner_email,
    );
    const ownerLabel = readString(
      payloadRecord.ownerLabel,
      payloadRecord.owner_label,
      existingRecord.ownerLabel,
      existingRecord.owner_label,
      ownerEmail,
      ownerId,
    );
    // session.userId som siste fallback: hvis frontend ikke sender createdBy
    // (Holy Crust-flowen er ett eksempel — POST gikk uten createdBy), endte
    // prosjektet med created_by=null i compat-store, som så fikk GET
    // /api/casting/projects/:id til å returnere null pga owner-sjekk →
    // verification-flowen retry'er 5 ganger og gir opp. Defaulter nå til
    // brukeren som faktisk gjør request'en så prosjektet blir hentbart av
    // seg selv direkte etter opprettelse/oppdatering.
    const createdBy = readString(
      payloadRecord.createdBy,
      payloadRecord.created_by,
      existingRecord.createdBy,
      existingRecord.created_by,
      ownerId,
    ) ?? session.userId;
    const createdByEmail = readString(
      payloadRecord.createdByEmail,
      payloadRecord.created_by_email,
      existingRecord.createdByEmail,
      existingRecord.created_by_email,
      ownerEmail,
    );
    const createdByLabel = readString(
      payloadRecord.createdByLabel,
      payloadRecord.created_by_label,
      existingRecord.createdByLabel,
      existingRecord.created_by_label,
      ownerLabel,
    );
    const updatedAtIso = new Date().toISOString();
    const updated = {
      ...existing,
      ...req.body,
      id,
      ownerId,
      owner_id: ownerId,
      ownerEmail,
      owner_email: ownerEmail,
      ownerLabel,
      owner_label: ownerLabel,
      createdBy,
      // Lagre BÅDE camelCase og snake_case for å match GET-routens
      // owner-sjekk (project.created_by). Samme rasjonal som POST.
      created_by: createdBy,
      createdByEmail,
      created_by_email: createdByEmail,
      createdByLabel,
      created_by_label: createdByLabel,
      createdAt: existing.createdAt || existing.created_at || updatedAtIso,
      created_at: existing.created_at || existing.createdAt || updatedAtIso,
      updatedAt: updatedAtIso,
      updated_at: updatedAtIso,
    };
    const hadExisting = legacyCastingProjects.has(id);
    const previousProject = legacyCastingProjects.get(id);
    try {
      legacyCastingProjects.set(id, updated);
      await compatStoreSet(dbLegacyCastingProjectKey(id), updated);
      res.json(updated);
    } catch (error) {
      if (hadExisting && previousProject) {
        legacyCastingProjects.set(id, previousProject);
        await compatStoreSet(
          dbLegacyCastingProjectKey(id),
          previousProject,
        ).catch(() => undefined);
      } else {
        legacyCastingProjects.delete(id);
        await compatStoreDelete(dbLegacyCastingProjectKey(id)).catch(
          () => undefined,
        );
      }
      console.error(
        "[RoleRoom] Legacy casting project update rolled back",
        error,
      );
      res
        .status(500)
        .json({ error: "Kunne ikke oppdatere prosjekt atomisk." });
    }
  });

  app.delete("/api/casting/projects/:projectId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const projectId = rejectInvalidProjectId(
        res,
        req.params.projectId,
        "deleteProject",
      );
      if (!projectId) return;
      if (rejectProtectedDemoWrite(res, projectId, "deleteProject")) {
        return;
      }

      // Liste manuskripter FØR transaksjon (read-only) — bruker den senere
      // for tx-baserte DB-deletes av sub-state.
      const manuscriptsForProject =
        await manuscriptsService.listManuscripts(projectId);
      const manuscriptIds = manuscriptsForProject
        .map((manuscript: any) =>
          typeof manuscript?.id === "string" ? manuscript.id : "",
        )
        .filter((id: string): id is string => Boolean(id));

      // **Atomic phase**: alle prosjekt-scope-deletes i én transaksjon.
      // Hvis NOE feiler innenfor blokken, ALT rollbackes. Adresserer pain
      // point med partial-state ved cascade-feil.
      //
      // NB: Favorites-prefix-delete LIGGER UTENFOR transaksjonen — det er
      // best-effort-cleanup som ikke skal kunne abortere hoved-slettingen.
      await compatStoreTransaction(async (tx) => {
        // Sub-state per manuskript (tx-aware via service)
        await Promise.all(
          manuscriptIds.map((manuscriptId) =>
            manuscriptsService.clearManuscriptState(manuscriptId, { tx }),
          ),
        );
        // 9 prosjekt-scope-keys
        await Promise.all([
          tx.delete(dbLegacyCastingProjectKey(projectId)),
          tx.delete(dbLegacyShotListsKey(projectId)),
          tx.delete(dbLegacyCalendarEventsKey(projectId)),
          tx.delete(dbLegacyTeamSnapshotsKey(projectId)),
          tx.delete(dbLegacyOffersKey(projectId)),
          tx.delete(dbLegacyContractsKey(projectId)),
          tx.delete(dbLegacyProjectAgreementsKey(projectId)),
          tx.delete(dbLegacyLiveSetSessionsKey(projectId)),
          tx.delete(dbLegacyLiveSetEventsKey(projectId)),
        ]);
      });

      // After-commit phase: in-memory Maps. Hvis transaksjonen rolled back,
      // havner vi i catch-block og state er konsistent (DB har data, Maps
      // også — vi nådde aldri hit).
      legacyCastingProjects.delete(projectId);
      legacyShotListsByProject.delete(projectId);
      legacyCalendarEventsByProject.delete(projectId);
      legacyTeamDashboardSnapshotsByProject.delete(projectId);
      legacyOffersByProject.delete(projectId);
      legacyContractsByProject.delete(projectId);
      legacyProjectAgreementsByProject.delete(projectId);
      liveSetService.clearProjectState(projectId);

      // Best-effort: favorites-rydding (utenfor transaksjon — kan svikte
      // uten å komprometere hoved-slettingen).
      await compatStoreDeleteByPrefix(
        `casting:favorites:${projectId}::`,
      ).catch((error) => {
        console.warn(
          "casting:favorites prefix-delete failed (non-critical):",
          { projectId, error },
        );
      });

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting casting project (transaction rolled back):", error);
      res.status(500).json({ error: "Could not delete project" });
    }
  });

  // ── Shot-lists ─────────────────────────────────────────────────────

  app.get(
    "/api/casting/projects/:projectId/shot-lists",
    async (req, res) => {
      try {
        const projectId = rejectInvalidProjectId(
          res,
          req.params.projectId,
          "getShotLists",
        );
        if (!projectId) return;
        const shotLists = await getLegacyShotLists(projectId);
        res.json(shotLists);
      } catch (error) {
        console.error("Error listing shot lists:", error);
        res.status(500).json({ error: "Could not list shot lists" });
      }
    },
  );

  app.post(
    "/api/casting/projects/:projectId/shot-lists",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const projectId = rejectInvalidProjectId(
          res,
          req.params.projectId,
          "saveShotList",
        );
        if (!projectId) return;
        if (rejectProtectedDemoWrite(res, projectId, "saveShotList")) {
          return;
        }
        if (
          rejectCrossProjectPayload(res, projectId, req.body, "saveShotList")
        ) {
          return;
        }
        const current = await getLegacyShotLists(projectId);
        const payload =
          req.body && typeof req.body === "object" ? req.body : {};
        const id =
          typeof payload.id === "string" && payload.id.trim()
            ? payload.id
            : newEntityId("shot-list");
        const next = [...current];
        const idx = next.findIndex((item) => item.id === id);
        const shotList = {
          ...payload,
          id,
          projectId,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) next[idx] = shotList;
        else next.push(shotList);
        legacyShotListsByProject.set(projectId, next);
        await compatStoreSet(dbLegacyShotListsKey(projectId), next);
        res.json(shotList);
      } catch (error) {
        console.error("Error saving shot list:", error);
        res.status(500).json({ error: "Could not save shot list" });
      }
    },
  );

  app.put(
    "/api/casting/projects/:projectId/shot-lists/:shotListId",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const projectId = rejectInvalidProjectId(
          res,
          req.params.projectId,
          "updateShotList",
        );
        if (!projectId) return;
        if (rejectProtectedDemoWrite(res, projectId, "updateShotList")) {
          return;
        }
        if (
          rejectCrossProjectPayload(res, projectId, req.body, "updateShotList")
        ) {
          return;
        }
        const shotListId = req.params.shotListId;
        const current = await getLegacyShotLists(projectId);
        const idx = current.findIndex((item) => item.id === shotListId);
        if (idx < 0) {
          res.status(404).json({ error: "Shot list not found" });
          return;
        }
        current[idx] = {
          ...current[idx],
          ...req.body,
          id: shotListId,
          projectId,
          updatedAt: new Date().toISOString(),
        };
        legacyShotListsByProject.set(projectId, current);
        await compatStoreSet(dbLegacyShotListsKey(projectId), current);
        res.json(current[idx]);
      } catch (error) {
        console.error("Error updating shot list:", error);
        res.status(500).json({ error: "Could not update shot list" });
      }
    },
  );

  app.post(
    "/api/casting/projects/:projectId/shot-lists/reorder",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const projectId = rejectInvalidProjectId(
          res,
          req.params.projectId,
          "reorderShotLists",
        );
        if (!projectId) return;
        if (rejectProtectedDemoWrite(res, projectId, "reorderShotLists")) {
          return;
        }
        const incoming = Array.isArray(req.body?.shotLists)
          ? req.body.shotLists
          : null;
        if (
          incoming?.some((item: any) =>
            rejectCrossProjectPayload(
              res,
              projectId,
              item,
              "reorderShotLists",
            ),
          )
        ) {
          return;
        }
        if (incoming) {
          const next = incoming.map((item: any) => ({ ...item, projectId }));
          legacyShotListsByProject.set(projectId, next);
          await compatStoreSet(dbLegacyShotListsKey(projectId), next);
        }
        res.json({ ok: true });
      } catch (error) {
        console.error("Error reordering shot lists:", error);
        res.status(500).json({ error: "Could not reorder shot lists" });
      }
    },
  );

  // ── Calendar-events ───────────────────────────────────────────────

  app.get(
    "/api/casting/projects/:projectId/calendar-events",
    async (req, res) => {
      try {
        const projectId = rejectInvalidProjectId(
          res,
          req.params.projectId,
          "getCalendarEvents",
        );
        if (!projectId) return;
        const events = await getLegacyCalendarEvents(projectId);
        res.json({ events });
      } catch (error) {
        console.error("Error listing calendar events:", error);
        res.status(500).json({ error: "Could not list calendar events" });
      }
    },
  );

  app.post("/api/casting/calendar-events", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const projectId = rejectInvalidProjectId(
        res,
        typeof payload.projectId === "string" ? payload.projectId : "",
        "createCalendarEvent",
      );
      if (!projectId) return;
      if (
        rejectProtectedDemoWrite(res, projectId, "createCalendarEvent")
      ) {
        return;
      }
      const startTime =
        typeof payload.startTime === "string"
          ? payload.startTime
          : typeof payload.start_time === "string"
            ? payload.start_time
            : "";
      if (!startTime) {
        res
          .status(400)
          .json({ error: "projectId and startTime are required" });
        return;
      }

      const current = await getLegacyCalendarEvents(projectId);
      const eventId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : newEntityId("calendar-event");
      const event = {
        id: eventId,
        project_id: projectId,
        title:
          typeof payload.title === "string" && payload.title.trim()
            ? payload.title.trim()
            : "Ny hendelse",
        description:
          typeof payload.description === "string" ? payload.description : "",
        event_type:
          typeof payload.eventType === "string"
            ? payload.eventType
            : typeof payload.event_type === "string"
              ? payload.event_type
              : "general",
        start_time: startTime,
        end_time:
          typeof payload.endTime === "string"
            ? payload.endTime
            : typeof payload.end_time === "string"
              ? payload.end_time
              : null,
        location_id:
          typeof payload.locationId === "string"
            ? payload.locationId
            : typeof payload.location_id === "string"
              ? payload.location_id
              : null,
        all_day: Boolean(payload.allDay ?? payload.all_day ?? false),
        candidate_ids: Array.isArray(payload.candidateIds)
          ? payload.candidateIds
          : Array.isArray(payload.candidate_ids)
            ? payload.candidate_ids
            : [],
        crew_ids: Array.isArray(payload.crewIds)
          ? payload.crewIds
          : Array.isArray(payload.crew_ids)
            ? payload.crew_ids
            : [],
        equipment_ids: Array.isArray(payload.equipmentIds)
          ? payload.equipmentIds
          : Array.isArray(payload.equipment_ids)
            ? payload.equipment_ids
            : [],
        shot_list_ids: Array.isArray(payload.shotListIds)
          ? payload.shotListIds
          : Array.isArray(payload.shot_list_ids)
            ? payload.shot_list_ids
            : [],
        notes: typeof payload.notes === "string" ? payload.notes : "",
        status:
          typeof payload.status === "string" ? payload.status : "scheduled",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const next = [...current, event];
      legacyCalendarEventsByProject.set(projectId, next);
      await compatStoreSet(dbLegacyCalendarEventsKey(projectId), next);
      res.json({ eventId });
    } catch (error) {
      console.error("Error creating calendar event:", error);
      res.status(500).json({ error: "Could not create calendar event" });
    }
  });

  app.put("/api/casting/calendar-events/:eventId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const eventId = req.params.eventId;
      let location = findByIdInProjectMap(
        legacyCalendarEventsByProject,
        eventId,
      );
      if (!location) {
        const dbLocation = await findByIdInDbProjectArrays(
          "casting:calendar-events:",
          eventId,
        );
        if (dbLocation) {
          setProjectItems(
            legacyCalendarEventsByProject,
            dbLocation.projectId,
            dbLocation.items,
          );
          location = {
            projectId: dbLocation.projectId,
            index: dbLocation.index,
          };
        }
      }

      if (!location) {
        res.status(404).json({ error: "Calendar event not found" });
        return;
      }

      const current = getProjectItems(
        legacyCalendarEventsByProject,
        location.projectId,
      );
      const existing = current[location.index];
      current[location.index] = {
        ...existing,
        ...req.body,
        id: eventId,
        project_id: location.projectId,
        updated_at: new Date().toISOString(),
      };
      setProjectItems(
        legacyCalendarEventsByProject,
        location.projectId,
        current,
      );
      await compatStoreSet(
        dbLegacyCalendarEventsKey(location.projectId),
        current,
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating calendar event:", error);
      res.status(500).json({ error: "Could not update calendar event" });
    }
  });

  app.delete("/api/casting/calendar-events/:eventId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const eventId = req.params.eventId;
      let location = findByIdInProjectMap(
        legacyCalendarEventsByProject,
        eventId,
      );
      if (!location) {
        const dbLocation = await findByIdInDbProjectArrays(
          "casting:calendar-events:",
          eventId,
        );
        if (dbLocation) {
          setProjectItems(
            legacyCalendarEventsByProject,
            dbLocation.projectId,
            dbLocation.items,
          );
          location = {
            projectId: dbLocation.projectId,
            index: dbLocation.index,
          };
        }
      }

      if (!location) {
        res.status(404).json({ error: "Calendar event not found" });
        return;
      }

      const current = getProjectItems(
        legacyCalendarEventsByProject,
        location.projectId,
      ).filter((event) => event?.id !== eventId);
      setProjectItems(
        legacyCalendarEventsByProject,
        location.projectId,
        current,
      );
      await compatStoreSet(
        dbLegacyCalendarEventsKey(location.projectId),
        current,
      );
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ error: "Could not delete calendar event" });
    }
  });

  // ── Team-dashboard snapshots ───────────────────────────────────────

  app.get(
    "/api/casting/projects/:projectId/team-dashboard/snapshots",
    async (req, res) => {
      try {
        const projectId = rejectInvalidProjectId(
          res,
          req.params.projectId,
          "getTeamSnapshots",
        );
        if (!projectId) return;
        const snapshots = await getLegacyTeamSnapshots(projectId);
        res.json({ success: true, snapshots });
      } catch (error) {
        console.error("Error listing team snapshots:", error);
        res.status(500).json({ error: "Could not list team snapshots" });
      }
    },
  );

  app.post(
    "/api/casting/projects/:projectId/team-dashboard/snapshots",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const projectId = rejectInvalidProjectId(
          res,
          req.params.projectId,
          "saveTeamSnapshot",
        );
        if (!projectId) return;
        if (rejectProtectedDemoWrite(res, projectId, "saveTeamSnapshot")) {
          return;
        }
        if (
          rejectCrossProjectPayload(
            res,
            projectId,
            req.body,
            "saveTeamSnapshot",
          )
        ) {
          return;
        }
        const payload =
          req.body && typeof req.body === "object" ? req.body : {};
        const current = await getLegacyTeamSnapshots(projectId);
        const id =
          typeof payload.id === "string" && payload.id.trim()
            ? payload.id
            : newEntityId("snapshot");
        const snapshot = {
          ...payload,
          id,
          projectId,
          createdAt:
            typeof payload.createdAt === "string" && payload.createdAt.trim()
              ? payload.createdAt
              : new Date().toISOString(),
        };

        const next = [...current];
        const index = next.findIndex((item) => item.id === id);
        if (index >= 0) {
          next[index] = snapshot;
        } else {
          next.unshift(snapshot);
        }

        legacyTeamDashboardSnapshotsByProject.set(
          projectId,
          next.slice(0, 100),
        );
        await compatStoreSet(
          dbLegacyTeamSnapshotsKey(projectId),
          next.slice(0, 100),
        );
        res.json({ success: true, snapshot });
      } catch (error) {
        console.error("Error saving team snapshot:", error);
        res.status(500).json({ error: "Could not save team snapshot" });
      }
    },
  );
}

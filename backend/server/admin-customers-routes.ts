/**
 * admin-customers-routes.ts
 *
 * Oversikt-fanen → kunder & prosjekter (kritisk fra audit). Stub-endpoints
 * som returnerer 200 med tomme aggregater nå slik at AdminDashboard kan
 * rendre. Senere kobles dette mot brukere + casting_projects-tabellene.
 *
 * Inneholder også profession-types-templates som hører hjemme i kunde-
 * profil-domenet (admin-misc-routes.ts er låst for parallelle agenter).
 *
 * Endpoints:
 *   GET  /api/admin/customer-projects-overview         — aggregert KPI
 *   GET  /api/admin/customers-detailed                 — liste
 *   GET  /api/admin/projects-detailed                  — liste
 *   GET  /api/admin/profession-types/templates         — 5 default-templates
 *   POST /api/admin/profession-types/templates/:id/activate
 *
 * Alle krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminCustomersRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const PROFESSION_TEMPLATES = [
  {
    id: "fotograf",
    label: "Fotograf",
    defaultRoles: ["Fotograf", "Andre-fotograf", "Editor"],
    defaultRates: { hourly: 950, fullDay: 7500, halfDay: 4500 },
  },
  {
    id: "videograf",
    label: "Videograf",
    defaultRoles: ["Videograf", "Gaffer", "Lyd", "Editor"],
    defaultRates: { hourly: 1100, fullDay: 8500, halfDay: 5000 },
  },
  {
    id: "eventplanlegger",
    label: "Eventplanlegger",
    defaultRoles: ["Eventansvarlig", "Koordinator", "Assistent"],
    defaultRates: { hourly: 850, fullDay: 6800, halfDay: 4000 },
  },
  {
    id: "danseinstruktor",
    label: "Danseinstruktør",
    defaultRoles: ["Hovedinstruktør", "Assistentinstruktør", "Koreograf"],
    defaultRates: { hourly: 700, fullDay: 5500, halfDay: 3200 },
  },
  {
    id: "musiker",
    label: "Musiker",
    defaultRoles: ["Hovedmusiker", "Bandmedlem", "Lydtekniker"],
    defaultRates: { hourly: 900, fullDay: 7000, halfDay: 4200 },
  },
];

// ── Defensiv kolonne-helper ─────────────────────────────────────
// Schema drift'er mellom miljøer (lokal, Neon-prod). Vi MÅ scope'e
// til `public` siden Neon har en parallell `legacy`-schema med samme
// tabellnavn — uten schema-filter blir col-settet en union av begge,
// og kolonne-sjekkene blir falsk-positive.
async function tableExists(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_name = $1
            AND table_schema = 'public'
       ) AS exists`,
      [table],
    );
    return Boolean(r.rows[0]?.exists);
  } catch {
    return false;
  }
}

async function columnsOf(pool: Pool, table: string): Promise<Set<string>> {
  try {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = $1
          AND table_schema = 'public'`,
      [table],
    );
    return new Set(r.rows.map((row) => row.column_name));
  } catch {
    return new Set();
  }
}

export function setupAdminCustomersRoutes(
  deps: AdminCustomersRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET /api/admin/customer-projects-overview ────────────────
  // Aggregert KPI for "Kunder & Prosjekter"-fanen. Returnerer både
  // `stats`-shape (forventet av CustomerProjectsPanel.tsx) og flat
  // top-level shape som task-spec'en beskriver, slik at begge fungerer.
  app.get("/api/admin/customer-projects-overview", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      // Brukere
      let totalCustomers = 0;
      if (await tableExists(pool, "users")) {
        try {
          const r = await pool.query<{ n: string }>(
            `SELECT COUNT(*)::text AS n FROM users`,
          );
          totalCustomers = Number(r.rows[0]?.n ?? 0);
        } catch (err) {
          console.warn("[admin-customers] users count failed:", err);
        }
      }

      // casting_projects: split etter status
      const castingByStatus: Record<string, number> = {};
      let castingTotal = 0;
      if (await tableExists(pool, "casting_projects")) {
        const cols = await columnsOf(pool, "casting_projects");
        const statusExpr = cols.has("status")
          ? "COALESCE(status, 'active')"
          : "'active'::text";
        try {
          const r = await pool.query<{ status: string; n: string }>(
            `SELECT ${statusExpr} AS status, COUNT(*)::text AS n
               FROM casting_projects
              GROUP BY ${statusExpr}`,
          );
          for (const row of r.rows) {
            const s = String(row.status ?? "active");
            castingByStatus[s] = (castingByStatus[s] ?? 0) + Number(row.n);
            castingTotal += Number(row.n);
          }
        } catch (err) {
          console.warn("[admin-customers] casting_projects agg failed:", err);
        }
      }

      // photographer_client_galleries
      const galleryByStatus: Record<string, number> = {};
      let galleryTotal = 0;
      if (await tableExists(pool, "photographer_client_galleries")) {
        const cols = await columnsOf(pool, "photographer_client_galleries");
        const statusExpr = cols.has("status")
          ? "COALESCE(status, 'active')"
          : "'active'::text";
        try {
          const r = await pool.query<{ status: string; n: string }>(
            `SELECT ${statusExpr} AS status, COUNT(*)::text AS n
               FROM photographer_client_galleries
              GROUP BY ${statusExpr}`,
          );
          for (const row of r.rows) {
            const s = String(row.status ?? "active");
            galleryByStatus[s] = (galleryByStatus[s] ?? 0) + Number(row.n);
            galleryTotal += Number(row.n);
          }
        } catch (err) {
          console.warn(
            "[admin-customers] photographer_client_galleries agg failed:",
            err,
          );
        }
      }

      // creator_hub/projects (generelle prosjekter — vi mapper denne til "creatorhub"-typen)
      const projectsByStatus: Record<string, number> = {};
      let creatorhubTotal = 0;
      if (await tableExists(pool, "projects")) {
        const cols = await columnsOf(pool, "projects");
        const statusExpr = cols.has("status")
          ? "COALESCE(status, 'active')"
          : "'active'::text";
        try {
          const r = await pool.query<{ status: string; n: string }>(
            `SELECT ${statusExpr} AS status, COUNT(*)::text AS n
               FROM projects
              GROUP BY ${statusExpr}`,
          );
          for (const row of r.rows) {
            const s = String(row.status ?? "active");
            projectsByStatus[s] = (projectsByStatus[s] ?? 0) + Number(row.n);
            creatorhubTotal += Number(row.n);
          }
        } catch (err) {
          console.warn("[admin-customers] projects agg failed:", err);
        }
      }

      // Slå sammen alle status-buckets til total projectsByStatus
      const mergedByStatus: Record<string, number> = {};
      for (const m of [castingByStatus, galleryByStatus, projectsByStatus]) {
        for (const [k, v] of Object.entries(m)) {
          mergedByStatus[k] = (mergedByStatus[k] ?? 0) + v;
        }
      }

      const totalProjects = castingTotal + galleryTotal + creatorhubTotal;
      const activeProjects =
        (mergedByStatus.active ?? 0) +
        (mergedByStatus.in_progress ?? 0) +
        (mergedByStatus.draft ?? 0);
      const completedProjects =
        (mergedByStatus.completed ?? 0) +
        (mergedByStatus.done ?? 0) +
        (mergedByStatus.archived ?? 0);

      res.json({
        totalCustomers,
        totalProjects,
        projectsByStatus: mergedByStatus,
        // nested `stats`-shape forventet av frontend CustomerProjectsPanel.tsx
        stats: {
          totalCustomers,
          activeProjects,
          completedProjects,
          totalRevenue: 0,
        },
        // ekstra breakdown for debugging / fremtidig UI
        breakdown: {
          casting: { total: castingTotal, byStatus: castingByStatus },
          galleries: { total: galleryTotal, byStatus: galleryByStatus },
          creatorhub: { total: creatorhubTotal, byStatus: projectsByStatus },
        },
      });
    } catch (err) {
      console.error("[admin-customers] overview failed:", err);
      res.status(500).json({ error: "customer_projects_overview_failed" });
    }
  });

  // ── GET /api/admin/customers-detailed?limit=50&offset=0 ──────
  app.get("/api/admin/customers-detailed", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1),
        500,
      );
      const offset = Math.max(
        parseInt(String(req.query.offset ?? "0"), 10) || 0,
        0,
      );

      if (!(await tableExists(pool, "users"))) {
        return res.json({ customers: [], total: 0 });
      }

      const cols = await columnsOf(pool, "users");
      const idCol = cols.has("id") ? "id" : null;
      if (!idCol) {
        return res.json({ customers: [], total: 0 });
      }
      const emailExpr = cols.has("email") ? "email" : "NULL::text";
      const firstNameExpr = cols.has("first_name") ? "first_name" : "NULL::text";
      const lastNameExpr = cols.has("last_name") ? "last_name" : "NULL::text";
      // schema drift: drizzle-schema sier "phone_number", Neon-public bruker "phone"
      const phoneExpr = cols.has("phone_number")
        ? "phone_number"
        : cols.has("phone")
          ? "phone"
          : "NULL::text";
      const createdAtExpr = cols.has("created_at")
        ? "created_at"
        : "NULL::timestamptz";
      const lastLoginExpr = cols.has("last_login_at")
        ? "last_login_at"
        : "NULL::timestamptz";

      // total
      let total = 0;
      try {
        const r = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM users`,
        );
        total = Number(r.rows[0]?.n ?? 0);
      } catch (err) {
        console.warn("[admin-customers] users total failed:", err);
      }

      // hent siden
      let rows: Array<{
        id: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        created_at: string | null;
        last_login_at: string | null;
      }> = [];
      try {
        const r = await pool.query<{
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          created_at: string | null;
          last_login_at: string | null;
        }>(
          `SELECT ${idCol} AS id,
                  ${emailExpr} AS email,
                  ${firstNameExpr} AS first_name,
                  ${lastNameExpr} AS last_name,
                  ${phoneExpr} AS phone,
                  ${createdAtExpr} AS created_at,
                  ${lastLoginExpr} AS last_login_at
             FROM users
            ORDER BY ${cols.has("created_at") ? "created_at DESC NULLS LAST" : idCol}
            LIMIT $1 OFFSET $2`,
          [limit, offset],
        );
        rows = r.rows;
      } catch (err) {
        console.warn("[admin-customers] users page failed:", err);
      }

      // Per-bruker prosjekt-antall: aggreger fra casting_projects.created_by +
      // photographer_client_galleries.photographer_id + projects.user_id.
      const ids = rows.map((u) => u.id);
      const countByUser = new Map<string, number>();
      if (ids.length > 0) {
        const incr = (uid: string | null | undefined, n: number) => {
          if (!uid) return;
          countByUser.set(uid, (countByUser.get(uid) ?? 0) + n);
        };

        if (await tableExists(pool, "casting_projects")) {
          const c = await columnsOf(pool, "casting_projects");
          if (c.has("created_by")) {
            try {
              const r = await pool.query<{ uid: string; n: string }>(
                `SELECT created_by AS uid, COUNT(*)::text AS n
                   FROM casting_projects
                  WHERE created_by = ANY($1::varchar[])
                  GROUP BY created_by`,
                [ids],
              );
              for (const row of r.rows) incr(row.uid, Number(row.n));
            } catch (err) {
              console.warn("[admin-customers] casting count failed:", err);
            }
          }
        }

        if (await tableExists(pool, "photographer_client_galleries")) {
          const c = await columnsOf(pool, "photographer_client_galleries");
          if (c.has("photographer_id")) {
            try {
              const r = await pool.query<{ uid: string; n: string }>(
                `SELECT photographer_id AS uid, COUNT(*)::text AS n
                   FROM photographer_client_galleries
                  WHERE photographer_id = ANY($1::varchar[])
                  GROUP BY photographer_id`,
                [ids],
              );
              for (const row of r.rows) incr(row.uid, Number(row.n));
            } catch (err) {
              console.warn("[admin-customers] gallery count failed:", err);
            }
          }
        }

        if (await tableExists(pool, "projects")) {
          const c = await columnsOf(pool, "projects");
          if (c.has("user_id")) {
            try {
              const r = await pool.query<{ uid: string; n: string }>(
                `SELECT user_id AS uid, COUNT(*)::text AS n
                   FROM projects
                  WHERE user_id = ANY($1::text[])
                  GROUP BY user_id`,
                [ids],
              );
              for (const row of r.rows) incr(row.uid, Number(row.n));
            } catch (err) {
              console.warn("[admin-customers] projects count failed:", err);
            }
          }
        }
      }

      const customers = rows.map((u) => {
        const name =
          [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
          u.email ||
          u.id;
        const projectCount = countByUser.get(u.id) ?? 0;
        return {
          id: u.id,
          email: u.email,
          name,
          phone: u.phone,
          signedUpAt: u.created_at,
          lastActive: u.last_login_at,
          projectCount,
          // bakoverkompatibilitet med CustomerProjectsPanel.tsx
          activeProjects: projectCount,
          totalValue: 0,
        };
      });

      res.json({ customers, total });
    } catch (err) {
      console.error("[admin-customers] customers-detailed failed:", err);
      res.status(500).json({ error: "customers_detailed_failed" });
    }
  });

  // ── GET /api/admin/projects-detailed?limit=50 ────────────────
  // Slår sammen casting_projects + photographer_client_galleries + projects.
  app.get("/api/admin/projects-detailed", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1),
        500,
      );

      type Row = {
        id: string;
        title: string | null;
        ownerId: string | null;
        ownerEmail: string | null;
        status: string | null;
        createdAt: string | null;
        type: "casting" | "gallery" | "creatorhub";
      };
      const allRows: Row[] = [];

      // casting_projects
      if (await tableExists(pool, "casting_projects")) {
        const cols = await columnsOf(pool, "casting_projects");
        const titleExpr = cols.has("name")
          ? "name"
          : cols.has("title")
            ? "title"
            : "NULL::text";
        const ownerExpr = cols.has("created_by")
          ? "created_by"
          : "NULL::text";
        const statusExpr = cols.has("status") ? "status" : "NULL::text";
        const createdExpr = cols.has("created_at")
          ? "created_at"
          : "NULL::timestamptz";
        try {
          const r = await pool.query<{
            id: string;
            title: string | null;
            owner_id: string | null;
            status: string | null;
            created_at: string | null;
          }>(
            `SELECT id::text AS id,
                    ${titleExpr} AS title,
                    ${ownerExpr} AS owner_id,
                    ${statusExpr} AS status,
                    ${createdExpr} AS created_at
               FROM casting_projects
              ORDER BY ${cols.has("created_at") ? "created_at DESC NULLS LAST" : "id"}
              LIMIT $1`,
            [limit],
          );
          for (const row of r.rows) {
            allRows.push({
              id: row.id,
              title: row.title,
              ownerId: row.owner_id,
              ownerEmail: null,
              status: row.status,
              createdAt: row.created_at,
              type: "casting",
            });
          }
        } catch (err) {
          console.warn("[admin-customers] casting_projects list failed:", err);
        }
      }

      // photographer_client_galleries
      if (await tableExists(pool, "photographer_client_galleries")) {
        const cols = await columnsOf(pool, "photographer_client_galleries");
        const titleExpr = cols.has("project_title")
          ? "project_title"
          : "NULL::text";
        const ownerExpr = cols.has("photographer_id")
          ? "photographer_id"
          : "NULL::text";
        const clientEmailExpr = cols.has("client_email")
          ? "client_email"
          : "NULL::text";
        const statusExpr = cols.has("status") ? "status" : "NULL::text";
        const createdExpr = cols.has("created_at")
          ? "created_at"
          : "NULL::timestamptz";
        try {
          const r = await pool.query<{
            id: string;
            title: string | null;
            owner_id: string | null;
            client_email: string | null;
            status: string | null;
            created_at: string | null;
          }>(
            `SELECT id::text AS id,
                    ${titleExpr} AS title,
                    ${ownerExpr} AS owner_id,
                    ${clientEmailExpr} AS client_email,
                    ${statusExpr} AS status,
                    ${createdExpr} AS created_at
               FROM photographer_client_galleries
              ORDER BY ${cols.has("created_at") ? "created_at DESC NULLS LAST" : "id"}
              LIMIT $1`,
            [limit],
          );
          for (const row of r.rows) {
            allRows.push({
              id: row.id,
              title: row.title,
              ownerId: row.owner_id,
              ownerEmail: row.client_email,
              status: row.status,
              createdAt: row.created_at,
              type: "gallery",
            });
          }
        } catch (err) {
          console.warn(
            "[admin-customers] photographer_client_galleries list failed:",
            err,
          );
        }
      }

      // projects (creatorhub/general)
      if (await tableExists(pool, "projects")) {
        const cols = await columnsOf(pool, "projects");
        const titleExpr = cols.has("title")
          ? "title"
          : cols.has("name")
            ? "name"
            : "NULL::text";
        const ownerExpr = cols.has("user_id") ? "user_id" : "NULL::text";
        const statusExpr = cols.has("status") ? "status" : "NULL::text";
        // projects.created_at er text i schema — cast til timestamptz når mulig.
        const createdExpr = cols.has("created_at")
          ? "created_at::text"
          : "NULL::text";
        try {
          const r = await pool.query<{
            id: string;
            title: string | null;
            owner_id: string | null;
            status: string | null;
            created_at: string | null;
          }>(
            `SELECT id::text AS id,
                    ${titleExpr} AS title,
                    ${ownerExpr} AS owner_id,
                    ${statusExpr} AS status,
                    ${createdExpr} AS created_at
               FROM projects
              ORDER BY id DESC
              LIMIT $1`,
            [limit],
          );
          for (const row of r.rows) {
            allRows.push({
              id: row.id,
              title: row.title,
              ownerId: row.owner_id,
              ownerEmail: null,
              status: row.status,
              createdAt: row.created_at,
              type: "creatorhub",
            });
          }
        } catch (err) {
          console.warn("[admin-customers] projects list failed:", err);
        }
      }

      // Slå opp eier-email batch'et fra users.
      const ownerIds = Array.from(
        new Set(
          allRows
            .map((r) => r.ownerId)
            .filter((v): v is string => Boolean(v)),
        ),
      );
      const emailByUser = new Map<string, string>();
      if (ownerIds.length > 0 && (await tableExists(pool, "users"))) {
        const userCols = await columnsOf(pool, "users");
        if (userCols.has("email")) {
          try {
            const r = await pool.query<{ id: string; email: string | null }>(
              `SELECT id::text AS id, email FROM users WHERE id::text = ANY($1::text[])`,
              [ownerIds],
            );
            for (const row of r.rows) {
              if (row.email) emailByUser.set(row.id, row.email);
            }
          } catch (err) {
            console.warn("[admin-customers] owner email lookup failed:", err);
          }
        }
      }

      const projects = allRows
        .sort((a, b) => {
          // createdAt kan være Date (fra timestamp-kolonner) eller string;
          // bruk String() for å trygt sammenligne i begge tilfeller.
          const ad = a.createdAt ? String(a.createdAt) : "";
          const bd = b.createdAt ? String(b.createdAt) : "";
          if (ad === bd) return 0;
          return ad < bd ? 1 : -1;
        })
        .slice(0, limit)
        .map((r) => ({
          id: r.id,
          title: r.title ?? "Uten navn",
          name: r.title ?? "Uten navn", // alias for UI
          ownerId: r.ownerId,
          ownerEmail: r.ownerEmail ?? (r.ownerId ? emailByUser.get(r.ownerId) ?? null : null),
          customerName: r.ownerEmail ?? (r.ownerId ? emailByUser.get(r.ownerId) ?? null : null),
          status: r.status,
          createdAt: r.createdAt,
          type: r.type,
          value: 0,
          deadline: null,
        }));

      res.json({ projects, total: projects.length });
    } catch (err) {
      console.error("[admin-customers] projects-detailed failed:", err);
      res.status(500).json({ error: "projects_detailed_failed" });
    }
  });

  app.get("/api/admin/profession-types/templates", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      res.json(PROFESSION_TEMPLATES);
    } catch (err) {
      console.error("[admin-customers] profession-templates failed:", err);
      res.status(500).json({ error: "profession_templates_failed" });
    }
  });

  app.post(
    "/api/admin/profession-types/templates/:templateId/activate",
    async (req, res) => {
      try {
        if (!requireAdminSession(req, res)) return;
        const templateId = String(req.params.templateId || "");
        const template = PROFESSION_TEMPLATES.find((t) => t.id === templateId);
        if (!template) {
          return res.status(404).json({ error: "template_not_found" });
        }
        // TODO: persist activation i admin_settings / profession_types.
        res.json({ success: true, activated: template });
      } catch (err) {
        console.error("[admin-customers] activate-template failed:", err);
        res.status(500).json({ error: "activate_template_failed" });
      }
    },
  );
}

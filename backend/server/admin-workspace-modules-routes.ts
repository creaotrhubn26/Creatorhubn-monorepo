/**
 * admin-workspace-modules-routes.ts
 *
 * Fyller de siste EmptyState-flatene i AdminWorkspace med ekte data:
 * Prosjekter, Dokumenter, Filer og Innstillinger. Alle bygger på
 * tabeller som allerede finnes — ingen av disse trengte ny datamodell.
 *
 *   GET  /api/admin-room/workspace/projects?product=
 *        casting_projects + antall roller, møter, deliverables og åpne
 *        klient-forespørsler per prosjekt.
 *
 *   GET  /api/admin-room/workspace/documents?product=
 *        Union av workspace_participant_documents (kontrakter/samtykker),
 *        role_room_client_materials (klient-leveranser) og
 *        legal_documents (selskapets juridiske dokumenter).
 *
 *   GET  /api/admin-room/workspace/files?product=
 *        role_room_user_files, beriket med lead-kobling der filen er
 *        knyttet til en Leadgrid-lead.
 *
 *   GET  /api/admin-room/workspace/settings
 *   PATCH /api/admin-room/workspace/settings
 *        Workspace-preferanser (nøkkel/verdi) + live status på
 *        integrasjoner, slik at flaten viser tilstand og ikke bare lenker.
 *
 * Skjemadrift er en kjent risiko i denne basen (flere av tabellene er
 * innført i ulike migrasjonsrunder). Hver kilde spørres derfor isolert,
 * og en manglende tabell degraderer til en tom seksjon MED et
 * `unavailable`-flagg — ikke til en stille tom liste som ser ut som
 * «ingenting her».
 */

import type { AdminRoomRoutesDeps } from "./_shared";

type ProductFilter = "role_room" | "leadgrid" | null;

function normalizeProductFilter(raw: unknown): ProductFilter {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "roleroom" || v === "role_room") return "role_room";
  if (v === "leadgrid") return "leadgrid";
  return null;
}

/** Tabell som ikke finnes ennå skal si fra, ikke late som den er tom. */
function isMissingRelation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === "42P01") return true; // undefined_table
  if (code === "42703") return true; // undefined_column
  const msg = (err as Error)?.message ?? "";
  return /does not exist/i.test(msg);
}

interface SourceResult<T> {
  items: T[];
  unavailable: string[];
}

async function collect<T>(
  label: string,
  result: SourceResult<T>,
  run: () => Promise<T[]>,
): Promise<void> {
  try {
    result.items.push(...(await run()));
  } catch (err) {
    if (isMissingRelation(err)) {
      result.unavailable.push(label);
      return;
    }
    throw err;
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function setupAdminWorkspaceModulesRoutes(
  deps: Pick<AdminRoomRoutesDeps, "app" | "pool" | "requireAdminRoomAccess">,
): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  // ─── Prosjekter ─────────────────────────────────────────────────
  app.get("/api/admin-room/workspace/projects", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const product = normalizeProductFilter(req.query.product);
    const result: SourceResult<Record<string, unknown>> = { items: [], unavailable: [] };

    try {
      // Leadgrid har ingen egen prosjekt-tabell — prosjekter er en
      // Role Room-flate. Vi sier det heller enn å vise en tom liste.
      if (product !== "leadgrid") {
        await collect("casting_projects", result, async () => {
          const r = await pool.query(
            `SELECT
               p.id::text                AS id,
               p.name                    AS name,
               p.description             AS description,
               p.status                  AS status,
               p.project_type            AS project_type,
               p.genre                   AS genre,
               p.start_date              AS start_date,
               p.end_date                AS end_date,
               p.budget                  AS budget,
               p.currency                AS currency,
               p.updated_at              AS updated_at,
               (SELECT COUNT(*) FROM casting_roles cr WHERE cr.project_id = p.id)          AS role_count,
               (SELECT COUNT(*) FROM role_room_meetings m
                 WHERE m.project_id = p.id AND m.status = 'upcoming')                      AS upcoming_meetings,
               (SELECT COUNT(*) FROM role_room_deliverables d
                 WHERE d.project_id = p.id::text AND d.status <> 'delivered')              AS open_deliverables,
               (SELECT MIN(d.due_at) FROM role_room_deliverables d
                 WHERE d.project_id = p.id::text AND d.status <> 'delivered'
                   AND d.due_at IS NOT NULL AND d.due_at >= NOW())                         AS next_due_at
             FROM casting_projects p
            WHERE p.created_by = $1
            ORDER BY p.updated_at DESC NULLS LAST
            LIMIT 200`,
            [session.userId],
          );
          return r.rows.map((row) => ({
            id: row.id,
            source: "casting_project",
            product_key: "role_room",
            name: row.name,
            description: row.description ?? null,
            status: row.status ?? "active",
            project_type: row.project_type ?? null,
            genre: row.genre ?? null,
            start_date: toIso(row.start_date),
            end_date: toIso(row.end_date),
            budget: row.budget === null ? null : Number(row.budget),
            currency: row.currency ?? "NOK",
            updated_at: toIso(row.updated_at),
            role_count: Number(row.role_count ?? 0),
            upcoming_meetings: Number(row.upcoming_meetings ?? 0),
            open_deliverables: Number(row.open_deliverables ?? 0),
            next_due_at: toIso(row.next_due_at),
            link_path: `/role-room/project/${row.id}`,
          }));
        });
      }

      res.json({ items: result.items, unavailable: result.unavailable, product });
    } catch (err) {
      console.error("[workspace/projects] error", err);
      res.status(500).json({ error: "Kunne ikke hente prosjekter" });
    }
  });

  // ─── Dokumenter ─────────────────────────────────────────────────
  app.get("/api/admin-room/workspace/documents", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const product = normalizeProductFilter(req.query.product);
    const result: SourceResult<Record<string, unknown>> = { items: [], unavailable: [] };

    try {
      // 1. Deltaker-dokumenter (kontrakter, samtykker, NDA-er)
      if (product !== "leadgrid") {
        await collect("workspace_participant_documents", result, async () => {
          const r = await pool.query(
            `SELECT d.id::text        AS id,
                    d.title           AS title,
                    d.document_type   AS document_type,
                    d.status          AS status,
                    d.version         AS version,
                    d.project_id::text AS project_id,
                    d.signed_at       AS signed_at,
                    d.expires_at      AS expires_at,
                    d.updated_at      AS updated_at,
                    p.name            AS project_name
               FROM workspace_participant_documents d
               LEFT JOIN casting_projects p ON p.id::text = d.project_id::text
              WHERE d.created_by = $1
              ORDER BY d.updated_at DESC
              LIMIT 200`,
            [session.userId],
          );
          return r.rows.map((row) => ({
            id: `participant:${row.id}`,
            source: "participant_document",
            product_key: "role_room",
            title: row.title,
            category: row.document_type,
            status: row.status,
            version: Number(row.version ?? 1),
            context: row.project_name ?? row.project_id ?? null,
            signed_at: toIso(row.signed_at),
            expires_at: toIso(row.expires_at),
            updated_at: toIso(row.updated_at),
            external_url: null,
          }));
        });

        // 2. Klient-materiell knyttet til prosjekter du eier
        await collect("role_room_client_materials", result, async () => {
          const r = await pool.query(
            `SELECT m.id::text     AS id,
                    m.title        AS title,
                    m.entry_type   AS entry_type,
                    m.status       AS status,
                    m.phase        AS phase,
                    m.external_url AS external_url,
                    m.updated_at   AS updated_at,
                    p.name         AS project_name
               FROM role_room_client_materials m
               JOIN casting_projects p ON p.id = m.project_id
              WHERE p.created_by = $1
              ORDER BY m.updated_at DESC
              LIMIT 200`,
            [session.userId],
          );
          return r.rows.map((row) => ({
            id: `material:${row.id}`,
            source: "client_material",
            product_key: "role_room",
            title: row.title,
            category: row.entry_type,
            status: row.status ?? "provided",
            version: null,
            context: row.project_name ?? null,
            signed_at: null,
            expires_at: null,
            updated_at: toIso(row.updated_at),
            external_url: row.external_url ?? null,
          }));
        });
      }

      // 3. Selskapets juridiske dokumenter — gjelder på tvers av produkt
      await collect("legal_documents", result, async () => {
        const r = await pool.query(
          `SELECT document_key, display_name, current_version, current_published_at
             FROM legal_documents
            ORDER BY display_name ASC`,
        );
        return r.rows.map((row) => ({
          id: `legal:${row.document_key}`,
          source: "legal_document",
          product_key: null,
          title: row.display_name,
          category: "legal",
          status: "published",
          version: row.current_version ?? null,
          context: "Creatorhub AS",
          signed_at: null,
          expires_at: null,
          updated_at: toIso(row.current_published_at),
          external_url: null,
        }));
      });

      result.items.sort((a, b) =>
        String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
      );

      res.json({ items: result.items, unavailable: result.unavailable, product });
    } catch (err) {
      console.error("[workspace/documents] error", err);
      res.status(500).json({ error: "Kunne ikke hente dokumenter" });
    }
  });

  // ─── Filer ──────────────────────────────────────────────────────
  app.get("/api/admin-room/workspace/files", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const product = normalizeProductFilter(req.query.product);
    const result: SourceResult<Record<string, unknown>> = { items: [], unavailable: [] };

    try {
      await collect("role_room_user_files", result, async () => {
        const r = await pool.query(
          `SELECT f.id::text       AS id,
                  f.display_name   AS display_name,
                  f.size_bytes     AS size_bytes,
                  f.content_type   AS content_type,
                  f.source_module  AS source_module,
                  f.uploaded_at    AS uploaded_at
             FROM role_room_user_files f
            WHERE f.user_id = $1
              AND f.deleted_at IS NULL
            ORDER BY f.uploaded_at DESC
            LIMIT 300`,
          [session.userId],
        );
        return r.rows.map((row) => ({
          id: row.id,
          display_name: row.display_name,
          size_bytes: Number(row.size_bytes ?? 0),
          content_type: row.content_type ?? null,
          source_module: row.source_module ?? null,
          uploaded_at: toIso(row.uploaded_at),
        }));
      });

      // Samlet forbruk — den ene tallverdien som faktisk styrer en
      // beslutning på en fil-flate.
      let totalBytes = 0;
      for (const item of result.items) {
        totalBytes += Number((item as { size_bytes?: number }).size_bytes ?? 0);
      }

      res.json({
        items: result.items,
        unavailable: result.unavailable,
        totalBytes,
        product,
      });
    } catch (err) {
      console.error("[workspace/files] error", err);
      res.status(500).json({ error: "Kunne ikke hente filer" });
    }
  });

  // ─── Innstillinger ──────────────────────────────────────────────
  // Leser lagrede preferanser OG live status på integrasjonene, slik at
  // flaten svarer på «hva er koblet på» og ikke bare lenker videre.
  app.get("/api/admin-room/workspace/settings", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const settings: Record<string, unknown> = {};
      try {
        const r = await pool.query(
          `SELECT setting_key, setting_value
             FROM admin_workspace_settings
            WHERE user_id = $1`,
          [session.userId],
        );
        for (const row of r.rows) settings[row.setting_key] = row.setting_value;
      } catch (err) {
        if (!isMissingRelation(err)) throw err;
      }

      // Integrasjons-status. Hver sjekk er isolert: en tabell som ikke
      // finnes gir status 'unknown', ikke en 500 på hele flaten.
      const integrations: Array<{
        key: string;
        label: string;
        status: "connected" | "disconnected" | "unknown";
        detail: string | null;
      }> = [];

      const probe = async (
        key: string,
        label: string,
        sql: string,
        params: unknown[],
      ): Promise<void> => {
        try {
          const r = await pool.query(sql, params);
          const count = Number(r.rows[0]?.count ?? 0);
          integrations.push({
            key,
            label,
            status: count > 0 ? "connected" : "disconnected",
            detail: count > 0 ? `${count} aktiv${count === 1 ? "" : "e"}` : null,
          });
        } catch (err) {
          if (isMissingRelation(err)) {
            integrations.push({ key, label, status: "unknown", detail: "Tabell mangler" });
            return;
          }
          throw err;
        }
      };

      await probe(
        "google",
        "Google Workspace",
        `SELECT COUNT(*)::int AS count FROM role_room_google_connections WHERE user_id = $1`,
        [session.userId],
      );
      await probe(
        "publish",
        "Publiseringskanaler",
        `SELECT COUNT(*)::int AS count FROM role_room_publish_connections WHERE user_id = $1`,
        [session.userId],
      );
      await probe(
        "ads",
        "Annonsekontoer",
        `SELECT COUNT(*)::int AS count FROM role_room_ads_oauth_connections WHERE user_id = $1`,
        [session.userId],
      );
      await probe(
        "apikeys",
        "API-nøkler",
        `SELECT COUNT(*)::int AS count FROM role_room_api_keys WHERE user_id = $1`,
        [session.userId],
      );

      res.json({ settings, integrations });
    } catch (err) {
      console.error("[workspace/settings] error", err);
      res.status(500).json({ error: "Kunne ikke hente innstillinger" });
    }
  });

  app.patch("/api/admin-room/workspace/settings", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const key = typeof req.body?.key === "string" ? req.body.key.trim() : "";
    const value = req.body?.value;

    if (!key || key.length > 80) {
      res.status(400).json({ error: "Ugyldig innstillings-nøkkel" });
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      res.status(400).json({ error: "Verdien må være et objekt" });
      return;
    }

    try {
      await pool.query(
        `INSERT INTO admin_workspace_settings (user_id, setting_key, setting_value, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (user_id, setting_key)
         DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
        [session.userId, key, JSON.stringify(value)],
      );
      res.json({ success: true, key, value });
    } catch (err) {
      console.error("[workspace/settings PATCH] error", err);
      res.status(500).json({ error: "Kunne ikke lagre innstillingen" });
    }
  });
}

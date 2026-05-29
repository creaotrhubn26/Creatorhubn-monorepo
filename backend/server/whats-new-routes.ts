/**
 * whats-new-routes.ts
 *
 * Felles "Hva er nytt"-system på tvers av Role Room-modi.
 *
 *   GET  /api/whats-new?mode=...               — public (krever ikke admin),
 *                                                 returnerer publiserte oppføringer
 *                                                 for gitt modus
 *   GET  /api/admin-room/whats-new              — admin, lister ALLE oppføringer
 *                                                 (inkl. upubliserte) på tvers av modi
 *   POST   /api/admin-room/whats-new            — admin opprette
 *   PATCH  /api/admin-room/whats-new/:id        — admin oppdatere
 *   DELETE /api/admin-room/whats-new/:id        — admin slette
 *
 * Tabellen `whats_new_entries` (migrasjon 192) eier dataen. Admin Room CRUD-
 * panelet bruker admin-rutene; HelpButton i hver workspace bruker public-GET.
 */

import type { AdminRoomRoutesDeps } from "./_shared";
import { asString } from "./_shared";

const VALID_KINDS = new Set(["feature", "improvement", "fix"]);

function asKind(value: unknown): string {
  const v = asString(value);
  if (v && VALID_KINDS.has(v)) return v;
  return "feature";
}

function asBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function asInteger(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function rowToEntry(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    mode: row.mode as string,
    kind: row.kind as string,
    date:
      row.entry_date instanceof Date
        ? (row.entry_date as Date).toISOString().slice(0, 10)
        : row.entry_date == null
          ? null
          : String(row.entry_date),
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    published: row.published as boolean,
    displayOrder: row.display_order as number,
    createdAt: row.created_at instanceof Date ? (row.created_at as Date).toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? (row.updated_at as Date).toISOString() : String(row.updated_at),
  };
}

export function setupWhatsNewRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  // Idempotent tabell-init: hindrer 500 fra GET /api/whats-new når
  // migration 192 ikke har kjørt på en gitt instans (Render bygger uten å
  // kjøre migrations automatisk). Trygt å re-kjøre — IF NOT EXISTS dropper
  // forsøket hvis tabellen finnes fra før.
  void pool.query(
    `CREATE TABLE IF NOT EXISTS whats_new_entries (
      id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
      mode text NOT NULL,
      kind text NOT NULL DEFAULT 'feature',
      entry_date date,
      title text NOT NULL,
      description text,
      published boolean NOT NULL DEFAULT true,
      display_order integer NOT NULL DEFAULT 0,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_whats_new_mode_published
      ON whats_new_entries(mode, published, display_order DESC, entry_date DESC);`,
  ).catch((err) => console.warn('[whats-new-routes] table ensure failed:', err));

  // ─── PUBLIC: hentes av HelpButton i hver workspace ───────────────────────
  // ?mode=production           → returnerer production-feed
  // ?mode=production,global    → merger production + global
  // Accept comma-separated så HelpButton kan inkludere 'global' i én request.
  app.get("/api/whats-new", async (req, res) => {
    const raw = asString(req.query.mode);
    if (!raw) {
      res.status(400).json({ error: "mode_required" });
      return;
    }
    const modes = Array.from(
      new Set(
        raw
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m.length > 0 && m.length <= 64),
      ),
    );
    if (modes.length === 0) {
      res.status(400).json({ error: "mode_required" });
      return;
    }
    try {
      const result = await pool.query(
        `SELECT * FROM whats_new_entries
          WHERE mode = ANY($1::text[]) AND published = true
          ORDER BY display_order DESC, entry_date DESC NULLS LAST, created_at DESC
          LIMIT 100`,
        [modes],
      );
      res.json({ items: result.rows.map(rowToEntry) });
    } catch (err) {
      console.error("whats-new public list error", err);
      res.status(500).json({ error: "Kunne ikke hente oppføringer" });
    }
  });

  // ─── ADMIN: full CRUD ────────────────────────────────────────────────────
  app.get("/api/admin-room/whats-new", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const mode = asString(req.query.mode);
    try {
      const result = mode
        ? await pool.query(
            `SELECT * FROM whats_new_entries
              WHERE mode = $1
              ORDER BY display_order DESC, entry_date DESC NULLS LAST, created_at DESC`,
            [mode],
          )
        : await pool.query(
            `SELECT * FROM whats_new_entries
              ORDER BY mode ASC, display_order DESC, entry_date DESC NULLS LAST, created_at DESC`,
          );
      res.json({ items: result.rows.map(rowToEntry) });
    } catch (err) {
      console.error("whats-new admin list error", err);
      res.status(500).json({ error: "Kunne ikke hente oppføringer" });
    }
  });

  app.post("/api/admin-room/whats-new", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mode = asString(body.mode);
    const title = asString(body.title);
    if (!mode) {
      res.status(400).json({ error: "mode er påkrevd" });
      return;
    }
    if (!title) {
      res.status(400).json({ error: "title er påkrevd" });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO whats_new_entries
           (mode, kind, entry_date, title, description, published, display_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          mode,
          asKind(body.kind),
          asString(body.date),
          title,
          asString(body.description),
          asBoolean(body.published, true),
          asInteger(body.displayOrder, 0),
          session.userId,
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "whats_new",
        entityId: result.rows[0].id,
        action: "created",
        summary: `${mode}: ${title}`,
      });
      res.status(201).json({ item: rowToEntry(result.rows[0]) });
    } catch (err) {
      console.error("whats-new admin create error", err);
      res.status(500).json({ error: "Kunne ikke opprette oppføring" });
    }
  });

  app.patch("/api/admin-room/whats-new/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [req.params.id];
    const push = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if ("mode" in body) push("mode", asString(body.mode));
    if ("kind" in body) push("kind", asKind(body.kind));
    if ("date" in body) push("entry_date", asString(body.date));
    if ("title" in body) push("title", asString(body.title));
    if ("description" in body) push("description", asString(body.description));
    if ("published" in body) push("published", asBoolean(body.published, true));
    if ("displayOrder" in body) push("display_order", asInteger(body.displayOrder, 0));
    if (sets.length === 0) {
      res.status(400).json({ error: "ingen_endringer" });
      return;
    }
    sets.push(`updated_at = now()`);
    try {
      const result = await pool.query(
        `UPDATE whats_new_entries SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
        params,
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "whats_new",
        entityId: req.params.id,
        action: "updated",
        summary: result.rows[0].title as string,
      });
      res.json({ item: rowToEntry(result.rows[0]) });
    } catch (err) {
      console.error("whats-new admin patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere oppføring" });
    }
  });

  app.delete("/api/admin-room/whats-new/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM whats_new_entries WHERE id = $1 RETURNING title`,
        [req.params.id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "whats_new",
        entityId: req.params.id,
        action: "deleted",
        summary: result.rows[0].title as string,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("whats-new admin delete error", err);
      res.status(500).json({ error: "Kunne ikke slette oppføring" });
    }
  });
}

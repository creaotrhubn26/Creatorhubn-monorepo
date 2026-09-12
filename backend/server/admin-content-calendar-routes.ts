/**
 * admin-content-calendar-routes.ts
 *
 * Backend for "Content Calendar"-tab i marketing-fanen i Admin Room.
 * Lar admin planlegge content-publisering på tvers av platformer:
 * draft → scheduled → published, gruppert i campaigns.
 *
 * Endpoints (alle krever admin-room-tilgang via requireAdminRoomAccess):
 *   GET    /api/content-calendar?from=ISO&to=ISO&status=scheduled
 *   GET    /api/content-calendar/stats
 *   GET    /api/content-calendar/campaigns
 *   POST   /api/content-calendar
 *   PUT    /api/content-calendar/:id
 *   POST   /api/content-calendar/:id/schedule
 *   POST   /api/content-calendar/:id/publish
 *   DELETE /api/content-calendar/:id
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupAdminContentCalendarRoutes } from "./admin-content-calendar-routes";
 *
 *   setupAdminContentCalendarRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity,
 *   });
 *
 * Defensiv mot manglende tabeller: alle endpoints fanger Postgres 42P01
 * (undefined_table) og returnerer tomme svar / nyttige feilmeldinger i
 * stedet for 500. Marketing-fanen kan rendres uten å vise feilmelding
 * selv om migrasjon 252 ikke er kjørt ennå.
 */

import type { AdminRoomRoutesDeps } from "./_shared";

// ─── Konstanter ──────────────────────────────────────────────────────
const VALID_CONTENT_TYPES = new Set<string>([
  "post",
  "reel",
  "story",
  "blog",
  "newsletter",
  "video",
]);
const VALID_STATUSES = new Set<string>([
  "draft",
  "scheduled",
  "published",
  "failed",
]);

// ─── Helpers ────────────────────────────────────────────────────────
function isUndefinedTableError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: string }).code === "42P01";
  }
  return false;
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function readInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim().length > 0) {
      out.push(entry.trim());
    }
  }
  return out;
}

function readIsoTimestamp(value: unknown): string | null {
  const s = readString(value);
  if (!s) return null;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// author_user_id-kolonnen er UUID. Session-userIder under lokal dev kan være
// "local-admin" e.l. — vi tvinger derfor til null hvis det ikke ser ut som UUID.
function asUuidOrNull(value: unknown): string | null {
  const s = readString(value);
  if (!s) return null;
  return UUID_RE.test(s) ? s : null;
}

// ─── Row-typer ──────────────────────────────────────────────────────
interface ItemRow {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  platforms: string[] | null;
  status: string;
  scheduled_for: Date | string | null;
  published_at: Date | string | null;
  campaign_id: string | null;
  asset_urls: string[] | null;
  copy_text: string | null;
  hashtags: string[] | null;
  author_user_id: string | null;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  budget_nok: number | null;
  goal: string | null;
  is_active: boolean;
  created_at: Date | string;
}

function serializeItem(row: ItemRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    contentType: row.content_type,
    platforms: row.platforms ?? [],
    status: row.status,
    scheduledFor: toIsoOrNull(row.scheduled_for),
    publishedAt: toIsoOrNull(row.published_at),
    campaignId: row.campaign_id,
    assetUrls: row.asset_urls ?? [],
    copyText: row.copy_text,
    hashtags: row.hashtags ?? [],
    authorUserId: row.author_user_id,
    notes: row.notes,
    createdAt: toIsoOrNull(row.created_at),
    updatedAt: toIsoOrNull(row.updated_at),
  };
}

function serializeCampaign(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: row.start_date instanceof Date
      ? row.start_date.toISOString().slice(0, 10)
      : (row.start_date ?? null),
    endDate: row.end_date instanceof Date
      ? row.end_date.toISOString().slice(0, 10)
      : (row.end_date ?? null),
    budgetNok: row.budget_nok,
    goal: row.goal,
    isActive: row.is_active,
    createdAt: toIsoOrNull(row.created_at),
  };
}

// ─── Setup ──────────────────────────────────────────────────────────
export function setupAdminContentCalendarRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  // ── GET /api/content-calendar — list items ────────────────────────
  app.get("/api/content-calendar", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const from = readIsoTimestamp(req.query.from);
    const to = readIsoTimestamp(req.query.to);
    const status = readString(req.query.status);

    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (expr: (idx: number) => string, value: unknown) => {
      params.push(value);
      conditions.push(expr(params.length));
    };

    if (from) push((i) => `(scheduled_for >= $${i} OR published_at >= $${i})`, from);
    if (to) push((i) => `(scheduled_for <= $${i} OR published_at <= $${i})`, to);
    if (status) {
      if (!VALID_STATUSES.has(status)) {
        res.status(400).json({
          error: `status må være en av: ${[...VALID_STATUSES].join(", ")}`,
        });
        return;
      }
      push((i) => `status = $${i}`, status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const result = await pool.query<ItemRow>(
        `SELECT * FROM content_calendar_items
         ${whereClause}
         ORDER BY COALESCE(scheduled_for, created_at) DESC
         LIMIT 500`,
        params,
      );
      const items = result.rows.map(serializeItem);
      res.json({ items, total: items.length });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        res.json({ items: [], total: 0 });
        return;
      }
      console.error("content-calendar list error", err);
      res.status(500).json({ error: "Kunne ikke hente content-calendar" });
    }
  });

  // ── GET /api/content-calendar/stats ───────────────────────────────
  // NB: må deklareres FØR /api/content-calendar/:id ville matche,
  // men siden vi ikke har GET /:id her er rekkefølgen ikke kritisk.
  app.get("/api/content-calendar/stats", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const totalsResult = await pool.query<{
        total_items: string;
        scheduled_count: string;
        published_count: string;
        upcoming_next_7d: string;
      }>(
        `SELECT
           COUNT(*)::text AS total_items,
           COUNT(*) FILTER (WHERE status = 'scheduled')::text AS scheduled_count,
           COUNT(*) FILTER (WHERE status = 'published')::text AS published_count,
           COUNT(*) FILTER (
             WHERE status = 'scheduled'
               AND scheduled_for IS NOT NULL
               AND scheduled_for >= now()
               AND scheduled_for <= now() + interval '7 days'
           )::text AS upcoming_next_7d
         FROM content_calendar_items`,
      );

      const byTypeResult = await pool.query<{ type: string; count: string }>(
        `SELECT content_type AS type, COUNT(*)::text AS count
           FROM content_calendar_items
           GROUP BY content_type
           ORDER BY count DESC`,
      );

      const byPlatformResult = await pool.query<{ platform: string; count: string }>(
        `SELECT platform, COUNT(*)::text AS count
           FROM (
             SELECT unnest(platforms) AS platform FROM content_calendar_items
           ) sub
           GROUP BY platform
           ORDER BY count DESC`,
      );

      const totals = totalsResult.rows[0] ?? {
        total_items: "0",
        scheduled_count: "0",
        published_count: "0",
        upcoming_next_7d: "0",
      };

      res.json({
        totalItems: Number(totals.total_items) || 0,
        scheduledCount: Number(totals.scheduled_count) || 0,
        publishedCount: Number(totals.published_count) || 0,
        byContentType: byTypeResult.rows.map((r) => ({
          type: r.type,
          count: Number(r.count) || 0,
        })),
        byPlatform: byPlatformResult.rows.map((r) => ({
          platform: r.platform,
          count: Number(r.count) || 0,
        })),
        upcomingNext7d: Number(totals.upcoming_next_7d) || 0,
      });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        res.json({
          totalItems: 0,
          scheduledCount: 0,
          publishedCount: 0,
          byContentType: [],
          byPlatform: [],
          upcomingNext7d: 0,
        });
        return;
      }
      console.error("content-calendar stats error", err);
      res.status(500).json({ error: "Kunne ikke hente content-calendar stats" });
    }
  });

  // ── GET /api/content-calendar/campaigns ───────────────────────────
  app.get("/api/content-calendar/campaigns", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const result = await pool.query<CampaignRow>(
        `SELECT * FROM content_calendar_campaigns
         ORDER BY is_active DESC, created_at DESC
         LIMIT 200`,
      );
      const campaigns = result.rows.map(serializeCampaign);
      res.json({ campaigns, total: campaigns.length });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        res.json({ campaigns: [], total: 0 });
        return;
      }
      console.error("content-calendar campaigns error", err);
      res.status(500).json({ error: "Kunne ikke hente campaigns" });
    }
  });

  // ── POST /api/content-calendar — create item ──────────────────────
  app.post("/api/content-calendar", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = readString(body.title);
    if (!title) {
      res.status(400).json({ error: "title er påkrevd" });
      return;
    }

    const contentType = readString(body.contentType) ?? "post";
    if (!VALID_CONTENT_TYPES.has(contentType)) {
      res.status(400).json({
        error: `contentType må være en av: ${[...VALID_CONTENT_TYPES].join(", ")}`,
      });
      return;
    }
    const status = readString(body.status) ?? "draft";
    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({
        error: `status må være en av: ${[...VALID_STATUSES].join(", ")}`,
      });
      return;
    }

    const platforms = readStringArray(body.platforms) ?? ["instagram", "linkedin"];
    const assetUrls = readStringArray(body.assetUrls) ?? [];
    const hashtags = readStringArray(body.hashtags) ?? [];
    const description = readString(body.description);
    const scheduledFor = readIsoTimestamp(body.scheduledFor);
    const publishedAt = readIsoTimestamp(body.publishedAt);
    const campaignId = asUuidOrNull(body.campaignId);
    const copyText = readString(body.copyText);
    const notes = readString(body.notes);
    const authorUserId = asUuidOrNull(session.userId);

    try {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO content_calendar_items
           (title, description, content_type, platforms, status,
            scheduled_for, published_at, campaign_id,
            asset_urls, copy_text, hashtags, author_user_id, notes)
         VALUES ($1, $2, $3, $4::text[], $5,
                 $6, $7, $8,
                 $9::text[], $10, $11::text[], $12, $13)
         RETURNING id`,
        [
          title,
          description,
          contentType,
          platforms,
          status,
          scheduledFor,
          publishedAt,
          campaignId,
          assetUrls,
          copyText,
          hashtags,
          authorUserId,
          notes,
        ],
      );

      const id = result.rows[0].id;
      logAdminActivity({
        userId: session.userId,
        entityType: "content_calendar_item",
        entityId: id,
        action: "created",
        summary: `Opprettet "${title}" (${contentType})`,
      }).catch(() => undefined);

      res.status(201).json({ success: true, id });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        res.status(503).json({ error: "content_calendar_items finnes ikke — kjør migrasjon 252" });
        return;
      }
      console.error("content-calendar create error", err);
      res.status(500).json({ error: "Kunne ikke opprette content-calendar item" });
    }
  });

  // ── PUT /api/content-calendar/:id — patch item via COALESCE ───────
  // Bruker COALESCE($N, kolonne) slik at ikke-medsendte felter beholdes.
  // Klienten sender null/undefined for det den ikke vil endre.
  app.put("/api/content-calendar/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;

    // Valider hvis status er satt
    const status = readString(body.status);
    if (status !== null && !VALID_STATUSES.has(status)) {
      res.status(400).json({
        error: `status må være en av: ${[...VALID_STATUSES].join(", ")}`,
      });
      return;
    }
    const contentType = readString(body.contentType);
    if (contentType !== null && !VALID_CONTENT_TYPES.has(contentType)) {
      res.status(400).json({
        error: `contentType må være en av: ${[...VALID_CONTENT_TYPES].join(", ")}`,
      });
      return;
    }

    const title = readString(body.title);
    const description = readString(body.description);
    const platforms = readStringArray(body.platforms);
    const scheduledFor = readIsoTimestamp(body.scheduledFor);
    const publishedAt = readIsoTimestamp(body.publishedAt);
    const campaignId = asUuidOrNull(body.campaignId);
    const assetUrls = readStringArray(body.assetUrls);
    const copyText = readString(body.copyText);
    const hashtags = readStringArray(body.hashtags);
    const notes = readString(body.notes);

    try {
      const result = await pool.query<ItemRow>(
        `UPDATE content_calendar_items SET
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           content_type = COALESCE($4, content_type),
           platforms = COALESCE($5::text[], platforms),
           status = COALESCE($6, status),
           scheduled_for = COALESCE($7, scheduled_for),
           published_at = COALESCE($8, published_at),
           campaign_id = COALESCE($9, campaign_id),
           asset_urls = COALESCE($10::text[], asset_urls),
           copy_text = COALESCE($11, copy_text),
           hashtags = COALESCE($12::text[], hashtags),
           notes = COALESCE($13, notes),
           updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.id,
          title,
          description,
          contentType,
          platforms,
          status,
          scheduledFor,
          publishedAt,
          campaignId,
          assetUrls,
          copyText,
          hashtags,
          notes,
        ],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Item ikke funnet" });
        return;
      }

      logAdminActivity({
        userId: session.userId,
        entityType: "content_calendar_item",
        entityId: req.params.id,
        action: "updated",
        summary: `Oppdaterte "${result.rows[0].title}"`,
      }).catch(() => undefined);

      res.json({ success: true, item: serializeItem(result.rows[0]) });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        res.status(503).json({ error: "content_calendar_items finnes ikke — kjør migrasjon 252" });
        return;
      }
      console.error("content-calendar update error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere content-calendar item" });
    }
  });

  // ── POST /api/content-calendar/:id/schedule ───────────────────────
  app.post("/api/content-calendar/:id/schedule", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const scheduledFor = readIsoTimestamp(body.scheduledFor);
    if (!scheduledFor) {
      res.status(400).json({ error: "scheduledFor må være en gyldig ISO-timestamp" });
      return;
    }

    try {
      const result = await pool.query<{ id: string; title: string }>(
        `UPDATE content_calendar_items
            SET status = 'scheduled',
                scheduled_for = $2,
                updated_at = now()
          WHERE id = $1
          RETURNING id, title`,
        [req.params.id, scheduledFor],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Item ikke funnet" });
        return;
      }

      logAdminActivity({
        userId: session.userId,
        entityType: "content_calendar_item",
        entityId: req.params.id,
        action: "scheduled",
        summary: `Planla "${result.rows[0].title}" til ${scheduledFor}`,
      }).catch(() => undefined);

      res.json({ success: true });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        res.status(503).json({ error: "content_calendar_items finnes ikke — kjør migrasjon 252" });
        return;
      }
      console.error("content-calendar schedule error", err);
      res.status(500).json({ error: "Kunne ikke planlegge item" });
    }
  });

  // ── POST /api/content-calendar/:id/publish ────────────────────────
  app.post("/api/content-calendar/:id/publish", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const result = await pool.query<{ id: string; title: string; published_at: Date | string }>(
        `UPDATE content_calendar_items
            SET status = 'published',
                published_at = now(),
                updated_at = now()
          WHERE id = $1
          RETURNING id, title, published_at`,
        [req.params.id],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Item ikke funnet" });
        return;
      }

      const publishedAt = toIsoOrNull(result.rows[0].published_at);

      logAdminActivity({
        userId: session.userId,
        entityType: "content_calendar_item",
        entityId: req.params.id,
        action: "published",
        summary: `Publiserte "${result.rows[0].title}"`,
      }).catch(() => undefined);

      res.json({ success: true, publishedAt });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        res.status(503).json({ error: "content_calendar_items finnes ikke — kjør migrasjon 252" });
        return;
      }
      console.error("content-calendar publish error", err);
      res.status(500).json({ error: "Kunne ikke publisere item" });
    }
  });

  // ── DELETE /api/content-calendar/:id ──────────────────────────────
  app.delete("/api/content-calendar/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const result = await pool.query<{ id: string; title: string }>(
        `DELETE FROM content_calendar_items WHERE id = $1 RETURNING id, title`,
        [req.params.id],
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Item ikke funnet" });
        return;
      }

      logAdminActivity({
        userId: session.userId,
        entityType: "content_calendar_item",
        entityId: req.params.id,
        action: "deleted",
        summary: `Slettet "${result.rows[0].title}"`,
      }).catch(() => undefined);

      res.json({ success: true });
    } catch (err) {
      if (isUndefinedTableError(err)) {
        res.status(503).json({ error: "content_calendar_items finnes ikke — kjør migrasjon 252" });
        return;
      }
      console.error("content-calendar delete error", err);
      res.status(500).json({ error: "Kunne ikke slette item" });
    }
  });
}

/**
 * admin-room-industry-targets-routes.ts
 *
 * CRUD for Tier-1 industry-target-CRM som driver engagement-systemet
 * i TheRoleRoom-Content-Marketing-Plan.md. Lagrer 500 personene Daniel
 * ønsker mental availability hos (CDs, produsenter, NSF, NFI, presse).
 *
 * - GET    /api/admin-room/industry-targets             — list (filter på tier/segment)
 * - POST   /api/admin-room/industry-targets             — create
 * - PATCH  /api/admin-room/industry-targets/:id         — update
 * - DELETE /api/admin-room/industry-targets/:id         — delete
 * - POST   /api/admin-room/industry-targets/:id/engagement — log engagement
 * - GET    /api/admin-room/industry-targets/stats       — aggregat for dashboard
 */

import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, asJsonbArray, asJsonbObject } from "./_shared";

const VALID_TIERS = new Set(["T1", "T2", "T3"]);
const VALID_SEGMENTS = new Set([
  "casting_director",
  "producer",
  "director",
  "actor",
  "press",
  "nfi",
  "nsf",
  "skuda",
  "agency",
  "other",
]);
const VALID_STATUSES = new Set([
  "cold",
  "warm",
  "engaged",
  "advocate",
  "paused",
]);
const VALID_ENGAGEMENT_KINDS = new Set([
  "comment",
  "dm",
  "email",
  "meeting",
  "phone",
  "event",
  "mention",
  "post_share",
  "other",
]);

export function setupAdminIndustryTargetsRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  app.get("/api/admin-room/industry-targets", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const tierFilter = asString(req.query.tier);
    const segmentFilter = asString(req.query.segment);
    const statusFilter = asString(req.query.status);

    const where: string[] = ["user_id = $1"];
    const params: unknown[] = [session.userId];
    if (tierFilter && VALID_TIERS.has(tierFilter)) {
      params.push(tierFilter);
      where.push(`tier = $${params.length}`);
    }
    if (segmentFilter && VALID_SEGMENTS.has(segmentFilter)) {
      params.push(segmentFilter);
      where.push(`segment = $${params.length}`);
    }
    if (statusFilter && VALID_STATUSES.has(statusFilter)) {
      params.push(statusFilter);
      where.push(`status = $${params.length}`);
    }

    try {
      const result = await pool.query(
        `SELECT * FROM role_room_industry_targets
          WHERE ${where.join(" AND ")}
          ORDER BY
            CASE tier WHEN 'T1' THEN 1 WHEN 'T2' THEN 2 WHEN 'T3' THEN 3 ELSE 4 END,
            last_engaged_at DESC NULLS LAST,
            full_name ASC`,
        params,
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("[admin-room industry-targets] list error", err);
      res.status(500).json({ error: "Kunne ikke hente targets" });
    }
  });

  app.get("/api/admin-room/industry-targets/stats", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const totals = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE tier = 'T1')::int AS tier_t1,
           COUNT(*) FILTER (WHERE tier = 'T2')::int AS tier_t2,
           COUNT(*) FILTER (WHERE tier = 'T3')::int AS tier_t3,
           COUNT(*) FILTER (WHERE status = 'engaged')::int AS engaged,
           COUNT(*) FILTER (WHERE status = 'advocate')::int AS advocates,
           COUNT(*) FILTER (WHERE last_engaged_at > NOW() - INTERVAL '30 days')::int AS active_last_30d
         FROM role_room_industry_targets
         WHERE user_id = $1`,
        [session.userId],
      );
      const tier1Comments = await pool.query(
        `SELECT COUNT(*)::int AS count
           FROM role_room_industry_engagements e
           JOIN role_room_industry_targets t ON t.id = e.target_id
          WHERE e.user_id = $1
            AND t.tier = 'T1'
            AND e.kind = 'comment'
            AND e.occurred_at > NOW() - INTERVAL '30 days'`,
        [session.userId],
      );
      res.json({
        totals: totals.rows[0] ?? {},
        tier1CommentsLast30d: tier1Comments.rows[0]?.count ?? 0,
      });
    } catch (err) {
      console.error("[admin-room industry-targets] stats error", err);
      res.status(500).json({ error: "Kunne ikke hente stats" });
    }
  });

  app.post("/api/admin-room/industry-targets", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const fullName = asString(body.fullName);
    if (!fullName) {
      res.status(400).json({ error: "fullName er påkrevd" });
      return;
    }
    const tier = asString(body.tier, "T2") ?? "T2";
    const segment = asString(body.segment, "producer") ?? "producer";
    const status = asString(body.status, "cold") ?? "cold";
    if (!VALID_TIERS.has(tier) || !VALID_SEGMENTS.has(segment) || !VALID_STATUSES.has(status)) {
      res.status(400).json({ error: "Ugyldig tier/segment/status" });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO role_room_industry_targets
           (user_id, full_name, role_title, company, segment, tier, status,
            linkedin_url, instagram_handle, email, phone, city, notes,
            next_action, next_action_due, tags, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb)
         RETURNING *`,
        [
          session.userId,
          fullName,
          asString(body.roleTitle),
          asString(body.company),
          segment,
          tier,
          status,
          asString(body.linkedinUrl),
          asString(body.instagramHandle),
          asString(body.email),
          asString(body.phone),
          asString(body.city),
          asString(body.notes),
          asString(body.nextAction),
          asString(body.nextActionDue),
          asJsonbArray(body.tags),
          asJsonbObject(body.metadata),
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "industry_target",
        entityId: result.rows[0].id,
        action: "created",
        summary: `${result.rows[0].full_name} (${result.rows[0].tier})`,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("[admin-room industry-targets] create error", err);
      res.status(500).json({ error: "Kunne ikke opprette target" });
    }
  });

  app.patch("/api/admin-room/industry-targets/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const id = req.params.id;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: string[] = [];
    const params: unknown[] = [];
    function set(column: string, value: unknown, cast?: string) {
      params.push(value);
      const placeholder = cast ? `$${params.length}::${cast}` : `$${params.length}`;
      updates.push(`${column} = ${placeholder}`);
    }
    if (body.fullName !== undefined) set("full_name", asString(body.fullName));
    if (body.roleTitle !== undefined) set("role_title", asString(body.roleTitle));
    if (body.company !== undefined) set("company", asString(body.company));
    if (body.segment !== undefined) {
      const next = asString(body.segment);
      if (!next || !VALID_SEGMENTS.has(next)) {
        res.status(400).json({ error: "Ugyldig segment" });
        return;
      }
      set("segment", next);
    }
    if (body.tier !== undefined) {
      const next = asString(body.tier);
      if (!next || !VALID_TIERS.has(next)) {
        res.status(400).json({ error: "Ugyldig tier" });
        return;
      }
      set("tier", next);
    }
    if (body.status !== undefined) {
      const next = asString(body.status);
      if (!next || !VALID_STATUSES.has(next)) {
        res.status(400).json({ error: "Ugyldig status" });
        return;
      }
      set("status", next);
    }
    if (body.linkedinUrl !== undefined) set("linkedin_url", asString(body.linkedinUrl));
    if (body.instagramHandle !== undefined) set("instagram_handle", asString(body.instagramHandle));
    if (body.email !== undefined) set("email", asString(body.email));
    if (body.phone !== undefined) set("phone", asString(body.phone));
    if (body.city !== undefined) set("city", asString(body.city));
    if (body.notes !== undefined) set("notes", asString(body.notes));
    if (body.nextAction !== undefined) set("next_action", asString(body.nextAction));
    if (body.nextActionDue !== undefined) set("next_action_due", asString(body.nextActionDue));
    if (body.tags !== undefined) set("tags", asJsonbArray(body.tags), "jsonb");
    if (body.metadata !== undefined) set("metadata", asJsonbObject(body.metadata), "jsonb");

    if (updates.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    updates.push(`updated_at = NOW()`);
    params.push(session.userId);
    params.push(id);
    try {
      const result = await pool.query(
        `UPDATE role_room_industry_targets
            SET ${updates.join(", ")}
          WHERE user_id = $${params.length - 1} AND id = $${params.length}
          RETURNING *`,
        params,
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Target ikke funnet" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "industry_target",
        entityId: id,
        action: "updated",
        summary: result.rows[0].full_name,
      });
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("[admin-room industry-targets] update error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere target" });
    }
  });

  app.delete("/api/admin-room/industry-targets/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM role_room_industry_targets WHERE user_id = $1 AND id = $2 RETURNING id, full_name`,
        [session.userId, req.params.id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Target ikke funnet" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "industry_target",
        entityId: result.rows[0].id,
        action: "deleted",
        summary: result.rows[0].full_name,
      });
      res.status(204).end();
    } catch (err) {
      console.error("[admin-room industry-targets] delete error", err);
      res.status(500).json({ error: "Kunne ikke slette target" });
    }
  });

  app.post("/api/admin-room/industry-targets/:id/engagement", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const kind = asString(body.kind);
    if (!kind || !VALID_ENGAGEMENT_KINDS.has(kind)) {
      res.status(400).json({ error: "Ugyldig kind" });
      return;
    }
    const direction = asString(body.direction, "outbound") ?? "outbound";
    if (!["inbound", "outbound"].includes(direction)) {
      res.status(400).json({ error: "direction må være inbound eller outbound" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const targetCheck = await client.query(
        `SELECT id FROM role_room_industry_targets WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      if (targetCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Target ikke funnet" });
        return;
      }
      const engagement = await client.query(
        `INSERT INTO role_room_industry_engagements
           (target_id, user_id, kind, direction, channel, summary, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [
          req.params.id,
          session.userId,
          kind,
          direction,
          asString(body.channel),
          asString(body.summary),
          asJsonbObject(body.metadata),
        ],
      );
      const updated = await client.query(
        `UPDATE role_room_industry_targets
            SET last_engaged_at = NOW(),
                last_engaged_kind = $1,
                engagement_count = engagement_count + 1,
                updated_at = NOW()
          WHERE id = $2
          RETURNING *`,
        [kind, req.params.id],
      );
      await client.query("COMMIT");
      res.status(201).json({ engagement: engagement.rows[0], target: updated.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[admin-room industry-targets] engagement error", err);
      res.status(500).json({ error: "Kunne ikke logge engagement" });
    } finally {
      client.release();
    }
  });
}

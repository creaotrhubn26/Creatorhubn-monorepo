/**
 * admin-room-marketing-segments-routes.ts
 *
 * HTTP-API for «målrettet markedsføring»-broen (fase 1). Definer segmenter,
 * forhåndsvis medlemstall, og materialiser til en Google Customer Match-audience.
 * Samme admin-guard-mønster som admin-room-industry-targets-routes.
 *
 *   GET    /api/admin-room/marketing-segments               → { items }  (m/ audiences)
 *   POST   /api/admin-room/marketing-segments               body { name, source?, filters? }
 *   GET    /api/admin-room/marketing-segments/:id/preview   → { total, sample, note? }
 *   POST   /api/admin-room/marketing-segments/:id/materialize  body { customerId }
 *   DELETE /api/admin-room/marketing-segments/:id
 */

import type { AdminRoomRoutesDeps } from "./_shared.js";
import {
  createSegment,
  deleteSegment,
  getSegment,
  listSegmentAudiences,
  listSegments,
  materializeToGoogleCustomerMatch,
  resolveSegmentMembers,
} from "./marketing-segments-service.js";

/** Maskerer e-post for preview — vis at data finnes uten å lekke full PII. */
function maskEmail(e: string): string {
  const [user, domain] = e.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

export function setupAdminMarketingSegmentsRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  app.get("/api/admin-room/marketing-segments", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const items = await listSegments(pool, session.userId);
      const withAudiences = await Promise.all(
        items.map(async (s) => ({ ...s, audiences: await listSegmentAudiences(pool, s.id) })),
      );
      res.json({ items: withAudiences });
    } catch (err) {
      console.error("[marketing-segments] list error", err);
      res.status(500).json({ error: "list_failed" });
    }
  });

  app.post("/api/admin-room/marketing-segments", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = req.body ?? {};
    if (!body.name || typeof body.name !== "string") {
      return res.status(400).json({ error: "name_required" });
    }
    try {
      const segment = await createSegment(pool, session.userId, {
        name: body.name,
        source: body.source,
        filters: body.filters ?? {},
      });
      await logAdminActivity({
        userId: session.userId,
        entityType: "marketing_segment",
        entityId: segment.id,
        action: "created",
        summary: `${segment.name} (${segment.source})`,
      }).catch(() => {});
      res.status(201).json({ segment });
    } catch (err) {
      console.error("[marketing-segments] create error", err);
      res.status(500).json({ error: "create_failed" });
    }
  });

  app.get("/api/admin-room/marketing-segments/:id/preview", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const segment = await getSegment(pool, session.userId, req.params.id);
      if (!segment) return res.status(404).json({ error: "not_found" });
      const { emails, total, note } = await resolveSegmentMembers(pool, segment);
      res.json({ total, sample: emails.slice(0, 3).map(maskEmail), note });
    } catch (err) {
      console.error("[marketing-segments] preview error", err);
      res.status(500).json({ error: "preview_failed" });
    }
  });

  app.post("/api/admin-room/marketing-segments/:id/materialize", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const customerId = String(req.body?.customerId ?? "").replace(/-/g, "").trim();
    if (!/^\d{10}$/.test(customerId)) {
      return res
        .status(400)
        .json({ error: "customerId_required", detail: "Google Ads customer-ID (10 sifre)" });
    }
    try {
      const segment = await getSegment(pool, session.userId, req.params.id);
      if (!segment) return res.status(404).json({ error: "not_found" });
      const result = await materializeToGoogleCustomerMatch(pool, {
        segment,
        customerId,
        producerUserId: session.userId,
      });
      await logAdminActivity({
        userId: session.userId,
        entityType: "marketing_segment",
        entityId: segment.id,
        action: "materialized",
        summary: `${segment.name} → ${result.platform} (${result.memberCount} medlemmer, ${result.ok ? "synced" : "failed"})`,
      }).catch(() => {});
      res.json(result);
    } catch (err) {
      console.error("[marketing-segments] materialize error", err);
      res.status(500).json({ error: "materialize_failed" });
    }
  });

  app.delete("/api/admin-room/marketing-segments/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const deleted = await deleteSegment(pool, session.userId, req.params.id);
      res.json({ deleted });
    } catch (err) {
      console.error("[marketing-segments] delete error", err);
      res.status(500).json({ error: "delete_failed" });
    }
  });
}

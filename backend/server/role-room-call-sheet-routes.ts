import { createHash, randomBytes } from "node:crypto";
import type express from "express";
import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { aiRateLimit } from "./ai-rate-limiter.js";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import { resolveTabAccessLevel, viewerMeetsTabLevel } from "./role-room-tab-access.js";

export interface CallSheetRoutesDeps { app: express.Application; pool: Pool; requireUserSession: (req: any, res: any) => any }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{40,80}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECIPIENTS = 100;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_SNAPSHOT_BYTES = 256 * 1024;
const sendLimit = aiRateLimit({ windowMs: 60_000, max: 5, label: "Call sheet send" });
const reminderLimit = aiRateLimit({ windowMs: 60_000, max: 5, label: "Call sheet reminder" });
const receiptLimit = aiRateLimit({ windowMs: 60_000, max: 30, label: "Call sheet receipt" });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const publicBase = () => (process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com").replace(/\/+$/, "");

// Mirrors the roles whose standard workspace preset owns call-sheet
// distribution. Explicit project overrides still win. Unknown/legacy roles are
// deliberately denied for the external side effect even though read-only tab
// routing remains backwards-compatible elsewhere.
const DEFAULT_CALL_SHEET_MANAGERS = new Set([
  "producer",
  "production_manager",
  "production_coordinator",
  "first_ad",
  "first_assistant_director",
  "1st_ad",
  "second_ad",
  "second_assistant_director",
  "2nd_ad",
]);

async function canManageCallSheetDistribution(
  pool: Pool,
  projectId: string,
  viewerId: string,
): Promise<boolean> {
  const explicitLevel = await resolveTabAccessLevel(pool, projectId, viewerId, "callsheet");
  if (explicitLevel !== null) return explicitLevel === "manage";
  try {
    const result = await pool.query(
      `SELECT role FROM casting_user_roles
        WHERE project_id = $1 AND user_id = $2 AND deactivated_at IS NULL LIMIT 1`,
      [projectId, viewerId],
    );
    const role = typeof result.rows[0]?.role === "string"
      ? result.rows[0].role.trim().toLowerCase().replace(/[\s-]+/g, "_")
      : "";
    return DEFAULT_CALL_SHEET_MANAGERS.has(role);
  } catch (error) {
    console.error("[role-room-call-sheet] could not resolve distribution role:", error);
    return false;
  }
}

function receiptPage(input: { subject?: string; acknowledged?: boolean; expired?: boolean }): string {
  const title = input.expired ? "Lenken er utløpt" : input.acknowledged ? "Mottak bekreftet" : "Bekreft call sheet";
  const body = input.expired ? "Be produksjonen sende en ny call sheet." : input.acknowledged ? "Produksjonen kan nå se at du har mottatt call sheeten." : `Du bekrefter at du har mottatt «${esc(input.subject || "Call sheet")}».`;
  const form = !input.expired && !input.acknowledged ? '<form method="post"><button type="submit">Bekreft mottak</button></form>' : "";
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:Inter,system-ui,sans-serif;background:#07110f;color:#f8fafc;margin:0;display:grid;min-height:100vh;place-items:center}.card{max-width:520px;margin:24px;padding:32px;border:1px solid #285e57;border-radius:16px;background:#0f1f1c}h1{font-size:1.7rem}p{color:#cbd5e1;line-height:1.6}button{min-height:48px;border:0;border-radius:10px;padding:0 20px;background:#14b8a6;color:#042f2e;font-weight:800;font-size:1rem}</style></head><body><main class="card"><p>The Role Room</p><h1>${title}</h1><p>${body}</p>${form}</main></body></html>`;
}

export function setupRoleRoomCallSheetRoutes({ app, pool, requireUserSession }: CallSheetRoutesDeps): void {
  app.get("/api/role-room/projects/:projectId/call-sheet-deliveries", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!(await canAccessRoleRoomProject(pool, session.userId, projectId)) || !(await viewerMeetsTabLevel(pool, projectId, session.userId, "callsheet", "view"))) return res.status(403).json({ error: "ingen_tilgang" });
    const dayId = typeof req.query.productionDayId === "string" ? req.query.productionDayId.trim() : "";
    const { rows } = await pool.query(`SELECT d.id,d.production_day_id,d.revision,d.subject,d.status,d.supersedes_delivery_id,d.content_hash,d.snapshot,d.retracted_at,d.created_at,COUNT(r.id)::int total,COUNT(r.id) FILTER (WHERE r.delivery_status='sent')::int sent,COUNT(r.id) FILTER (WHERE r.delivery_status='failed')::int failed,COUNT(r.id) FILTER (WHERE r.acknowledged_at IS NOT NULL)::int acknowledged FROM role_room_call_sheet_deliveries d LEFT JOIN role_room_call_sheet_recipients r ON r.delivery_id=d.id WHERE d.project_id=$1 AND ($2='' OR d.production_day_id=$2) GROUP BY d.id ORDER BY d.revision DESC,d.created_at DESC LIMIT 25`, [projectId, dayId]);
    const deliveryIds = rows.map((row) => row.id);
    const recipientRows = deliveryIds.length
      ? (await pool.query(`SELECT id,delivery_id,recipient_name,recipient_email,delivery_status,failure_reason,sent_at,acknowledged_at,reminder_count,last_reminded_at FROM role_room_call_sheet_recipients WHERE delivery_id=ANY($1::uuid[]) ORDER BY recipient_name NULLS LAST,recipient_email`, [deliveryIds])).rows
      : [];
    const eventRows = deliveryIds.length
      ? (await pool.query(`SELECT id,delivery_id,event_type,actor_user_id,recipient_id,details,created_at FROM role_room_call_sheet_events WHERE delivery_id=ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 250`, [deliveryIds])).rows
      : [];
    const recipientsByDelivery = new Map<string, Array<Record<string, unknown>>>();
    for (const recipient of recipientRows) {
      const list = recipientsByDelivery.get(recipient.delivery_id) ?? [];
      list.push({
        id: recipient.id,
        name: recipient.recipient_name,
        email: recipient.recipient_email,
        deliveryStatus: recipient.delivery_status,
        failureReason: recipient.failure_reason,
        sentAt: recipient.sent_at,
        acknowledgedAt: recipient.acknowledged_at,
        reminderCount: recipient.reminder_count,
        lastRemindedAt: recipient.last_reminded_at,
      });
      recipientsByDelivery.set(recipient.delivery_id, list);
    }
    const eventsByDelivery = new Map<string, Array<Record<string, unknown>>>();
    for (const event of eventRows) {
      const list = eventsByDelivery.get(event.delivery_id) ?? [];
      list.push({
        id: event.id,
        type: event.event_type,
        actorUserId: event.actor_user_id,
        recipientId: event.recipient_id,
        details: event.details,
        createdAt: event.created_at,
      });
      eventsByDelivery.set(event.delivery_id, list);
    }
    res.json({ deliveries: rows.map((r) => ({
      id: r.id,
      productionDayId: r.production_day_id,
      revision: r.revision,
      subject: r.subject,
      status: r.status,
      supersedesDeliveryId: r.supersedes_delivery_id,
      contentHash: r.content_hash,
      snapshot: r.snapshot,
      retractedAt: r.retracted_at,
      createdAt: r.created_at,
      total: r.total,
      sent: r.sent,
      failed: r.failed,
      acknowledged: r.acknowledged,
      recipients: recipientsByDelivery.get(r.id) ?? [],
      events: eventsByDelivery.get(r.id) ?? [],
    })) });
  });

  app.post("/api/role-room/call-sheets/send", sendLimit, async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
      if (!projectId) return res.status(400).json({ error: "projectId er påkrevd.", sent: 0, total: 0, results: [] });
      if (!(await canAccessRoleRoomProject(pool, session.userId, projectId)) || !(await canManageCallSheetDistribution(pool, projectId, session.userId))) return res.status(403).json({ error: "ingen_tilgang", sent: 0, total: 0, results: [] });
      const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim().replace(/[\r\n]+/g, " ").slice(0, 200) : "Call Sheet";
      const html = typeof body.html === "string" ? body.html : "";
      const dayId = typeof body.productionDayId === "string" ? body.productionDayId.trim().slice(0, 255) : null;
      const supersedesDeliveryId = typeof body.supersedesDeliveryId === "string" && body.supersedesDeliveryId.trim()
        ? body.supersedesDeliveryId.trim()
        : null;
      if (supersedesDeliveryId && !UUID_RE.test(supersedesDeliveryId)) return res.status(400).json({ error: "Ugyldig revisjonsreferanse.", sent: 0, total: 0, results: [] });
      const snapshotInput = body.snapshot && typeof body.snapshot === "object" && !Array.isArray(body.snapshot)
        ? body.snapshot
        : {};
      let snapshotJson = "{}";
      try { snapshotJson = JSON.stringify(snapshotInput); } catch { return res.status(400).json({ error: "Ugyldig revisjonsdata.", sent: 0, total: 0, results: [] }); }
      const raw = Array.isArray(body.recipients) ? body.recipients : [];
      if (raw.length > MAX_RECIPIENTS) return res.status(400).json({ error: `For mange mottakere (maks ${MAX_RECIPIENTS} per utsending).`, sent: 0, total: 0, results: [] });
      const seen = new Set<string>();
      const recipients = raw.map((value) => { const r = value && typeof value === "object" ? value as Record<string, unknown> : {}; return { name: typeof r.name === "string" ? r.name.trim().slice(0, 255) : "", email: typeof r.email === "string" ? r.email.trim().toLowerCase() : "" }; }).filter((r) => { if (r.email.length > 320 || !EMAIL_RE.test(r.email) || seen.has(r.email)) return false; seen.add(r.email); return true; });
      if (!recipients.length) return res.status(400).json({ error: "Ingen gyldige e-postmottakere.", sent: 0, total: 0, results: [] });
      if (!html.trim()) return res.status(400).json({ error: "Mangler call-sheet-innhold.", sent: 0, total: 0, results: [] });
      if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) return res.status(413).json({ error: "Call sheeten er for stor til å sendes.", sent: 0, total: 0, results: [] });
      if (Buffer.byteLength(snapshotJson, "utf8") > MAX_SNAPSHOT_BYTES) return res.status(413).json({ error: "Revisjonsdataene er for store.", sent: 0, total: 0, results: [] });
      const contentHash = createHash("sha256").update(snapshotJson).digest("hex");
      const delivery = await pool.query(
        `WITH revision_lock AS (
           SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || COALESCE($2, ''), 0))
         ), latest_published AS (
           SELECT d.id FROM role_room_call_sheet_deliveries d, revision_lock
           WHERE d.project_id=$1 AND d.production_day_id IS NOT DISTINCT FROM $2 AND d.status='published'
           ORDER BY d.revision DESC,d.created_at DESC LIMIT 1
         ), requested_previous AS (
           SELECT d.id FROM role_room_call_sheet_deliveries d
           WHERE d.id=$7::uuid AND d.project_id=$1 AND d.production_day_id IS NOT DISTINCT FROM $2 AND d.status='published'
         ), target AS (
           SELECT CASE WHEN $7::uuid IS NULL THEN (SELECT id FROM latest_published) ELSE (SELECT id FROM requested_previous) END AS id
         ), next_revision AS (
           SELECT COALESCE(MAX(d.revision),0)+1 AS revision
           FROM role_room_call_sheet_deliveries d, revision_lock
           WHERE d.project_id=$1 AND d.production_day_id IS NOT DISTINCT FROM $2
         ), permitted AS (
           SELECT revision FROM next_revision
           WHERE $7::uuid IS NULL OR EXISTS (SELECT 1 FROM requested_previous)
         ), superseded AS (
           UPDATE role_room_call_sheet_deliveries d SET status='superseded',updated_at=NOW()
           FROM target,permitted WHERE d.id=target.id RETURNING d.id
         ), inserted AS (
           INSERT INTO role_room_call_sheet_deliveries(project_id,production_day_id,revision,subject,sent_by_user_id,status,supersedes_delivery_id,content_hash,snapshot)
           SELECT $1,$2,permitted.revision,$3,$4,'published',target.id,$5,$6::jsonb
           FROM permitted,target LEFT JOIN superseded ON superseded.id=target.id
           RETURNING id,revision,supersedes_delivery_id
         ), event AS (
           INSERT INTO role_room_call_sheet_events(delivery_id,project_id,production_day_id,actor_user_id,event_type,details)
           SELECT inserted.id,$1,$2,$4,'published',jsonb_build_object('recipientCount',$8::integer,'supersedesDeliveryId',inserted.supersedes_delivery_id)
           FROM inserted
         ) SELECT id,revision,supersedes_delivery_id FROM inserted`,
        [projectId, dayId, subject, session.userId, contentHash, snapshotJson, supersedesDeliveryId, recipients.length],
      );
      const deliveryId = delivery.rows[0]?.id;
      const revision = delivery.rows[0]?.revision;
      if (!deliveryId) {
        if (supersedesDeliveryId) return res.status(409).json({ error: "Revisjonen du forsøkte å erstatte er ikke lenger aktiv. Last inn historikken på nytt.", sent: 0, total: 0, results: [] });
        throw new Error("delivery_not_created");
      }
      const results: Array<{ email: string; sent: boolean; reason: string | null; acknowledged: boolean }> = [];
      for (const recipient of recipients) {
        const token = randomBytes(32).toString("base64url");
        const inserted = await pool.query(`INSERT INTO role_room_call_sheet_recipients(delivery_id,recipient_name,recipient_email,token_hash) VALUES($1,$2,$3,$4) RETURNING id`, [deliveryId, recipient.name || null, recipient.email, hashToken(token)]);
        const recipientId = inserted.rows[0]?.id;
        const url = `${publicBase()}/api/role-room/call-sheets/acknowledge/${token}`;
        try {
          const out = await sendTransactionalEmail({ to: recipient.email, subject, html: `${recipient.name ? `<p>Hei ${esc(recipient.name)},</p>` : ""}${html}<p style="margin:20px 0"><a href="${url}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Bekreft mottak</a></p>`, text: `${subject}. Bekreft mottak: ${url}`, fromLabel: "The Role Room", kind: "role_room_call_sheet", projectId, sentByUserId: session.userId, pool });
          await pool.query(`UPDATE role_room_call_sheet_recipients SET delivery_status=$2,failure_reason=$3,provider_message_id=$4,sent_at=CASE WHEN $2='sent' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$1`, [recipientId, out.sent ? "sent" : "failed", out.reason, out.messageId]);
          results.push({ email: recipient.email, sent: out.sent, reason: out.reason, acknowledged: false });
        } catch { await pool.query(`UPDATE role_room_call_sheet_recipients SET delivery_status='failed',failure_reason='send_failed',updated_at=NOW() WHERE id=$1`, [recipientId]); results.push({ email: recipient.email, sent: false, reason: "send_failed", acknowledged: false }); }
      }
      const sent = results.filter((r) => r.sent).length;
      await pool.query(
        `INSERT INTO role_room_call_sheet_events(delivery_id,project_id,production_day_id,actor_user_id,event_type,details) VALUES($1,$2,$3,$4,'delivery_completed',jsonb_build_object('sent',$5::integer,'failed',$6::integer,'total',$7::integer))`,
        [deliveryId, projectId, dayId, session.userId, sent, recipients.length - sent, recipients.length],
      ).catch((error) => console.error("[role-room-call-sheet] could not persist delivery event:", error));
      res.json({ deliveryId, revision, sent, total: recipients.length, acknowledged: 0, results });
    } catch (error) { console.error("Error sending call sheet:", error); res.status(500).json({ error: "Kunne ikke sende call sheet." }); }
  });

  app.post("/api/role-room/call-sheet-deliveries/:deliveryId/remind", reminderLimit, async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const deliveryId = String(req.params.deliveryId || "").trim();
      if (!UUID_RE.test(deliveryId)) return res.status(404).json({ error: "utsending_ikke_funnet" });
      const deliveryResult = await pool.query(`SELECT id,project_id,production_day_id,subject,status FROM role_room_call_sheet_deliveries WHERE id=$1 LIMIT 1`, [deliveryId]);
      const delivery = deliveryResult.rows[0];
      if (!delivery) return res.status(404).json({ error: "utsending_ikke_funnet" });
      if (!(await canAccessRoleRoomProject(pool, session.userId, delivery.project_id)) || !(await canManageCallSheetDistribution(pool, delivery.project_id, session.userId))) return res.status(403).json({ error: "ingen_tilgang" });
      if (delivery.status !== "published") return res.status(409).json({ error: "Kun den aktive revisjonen kan få påminnelser." });

      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const requestedIds = Array.isArray(body.recipientIds)
        ? [...new Set(body.recipientIds.filter((value): value is string => typeof value === "string" && UUID_RE.test(value)))].slice(0, MAX_RECIPIENTS)
        : null;
      const recipientResult = await pool.query(
        `SELECT id,recipient_name,recipient_email FROM role_room_call_sheet_recipients WHERE delivery_id=$1 AND delivery_status='sent' AND acknowledged_at IS NULL AND ($2::uuid[] IS NULL OR id=ANY($2::uuid[])) ORDER BY recipient_name NULLS LAST,recipient_email LIMIT ${MAX_RECIPIENTS}`,
        [deliveryId, requestedIds],
      );
      const results: Array<{ id: string; email: string; sent: boolean; reason: string | null }> = [];
      for (const recipient of recipientResult.rows) {
        const token = randomBytes(32).toString("base64url");
        const tokenHash = hashToken(token);
        const inserted = await pool.query(`INSERT INTO role_room_call_sheet_recipient_tokens(recipient_id,token_hash) VALUES($1,$2) RETURNING id`, [recipient.id, tokenHash]);
        const tokenId = inserted.rows[0]?.id;
        const url = `${publicBase()}/api/role-room/call-sheets/acknowledge/${token}`;
        try {
          const subject = `Påminnelse · ${String(delivery.subject || "Call Sheet")}`.slice(0, 200);
          const out = await sendTransactionalEmail({
            to: recipient.recipient_email,
            subject,
            html: `${recipient.recipient_name ? `<p>Hei ${esc(recipient.recipient_name)},</p>` : ""}<p>Dette er en påminnelse om å bekrefte at du har mottatt call sheeten.</p><p style="margin:20px 0"><a href="${url}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Bekreft mottak</a></p>`,
            text: `${subject}. Bekreft mottak: ${url}`,
            fromLabel: "The Role Room",
            kind: "role_room_call_sheet",
            projectId: delivery.project_id,
            sentByUserId: session.userId,
            pool,
          });
          if (!out.sent) {
            if (tokenId) await pool.query(`DELETE FROM role_room_call_sheet_recipient_tokens WHERE id=$1`, [tokenId]);
            results.push({ id: recipient.id, email: recipient.recipient_email, sent: false, reason: out.reason || "send_failed" });
            continue;
          }
          await pool.query(`UPDATE role_room_call_sheet_recipients SET reminder_count=reminder_count+1,last_reminded_at=NOW(),updated_at=NOW() WHERE id=$1`, [recipient.id]);
          results.push({ id: recipient.id, email: recipient.recipient_email, sent: true, reason: null });
        } catch {
          if (tokenId) await pool.query(`DELETE FROM role_room_call_sheet_recipient_tokens WHERE id=$1`, [tokenId]);
          results.push({ id: recipient.id, email: recipient.recipient_email, sent: false, reason: "send_failed" });
        }
      }
      const reminded = results.filter((result) => result.sent).length;
      if (reminded > 0) {
        await pool.query(
          `INSERT INTO role_room_call_sheet_events(delivery_id,project_id,production_day_id,actor_user_id,event_type,details) VALUES($1,$2,$3,$4,'reminded',jsonb_build_object('reminded',$5::integer,'requested',$6::integer))`,
          [deliveryId, delivery.project_id, delivery.production_day_id, session.userId, reminded, recipientResult.rows.length],
        ).catch((error) => console.error("[role-room-call-sheet] could not persist reminder event:", error));
      }
      res.json({ deliveryId, reminded, total: recipientResult.rows.length, results });
    } catch (error) {
      console.error("Error reminding call sheet recipients:", error);
      res.status(500).json({ error: "Kunne ikke sende påminnelse." });
    }
  });

  app.post("/api/role-room/call-sheet-deliveries/:deliveryId/retract", sendLimit, async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const deliveryId = String(req.params.deliveryId || "").trim();
      if (!UUID_RE.test(deliveryId)) return res.status(404).json({ error: "utsending_ikke_funnet" });
      const lookup = await pool.query(`SELECT id,project_id,production_day_id,status FROM role_room_call_sheet_deliveries WHERE id=$1 LIMIT 1`, [deliveryId]);
      const delivery = lookup.rows[0];
      if (!delivery) return res.status(404).json({ error: "utsending_ikke_funnet" });
      if (!(await canAccessRoleRoomProject(pool, session.userId, delivery.project_id)) || !(await canManageCallSheetDistribution(pool, delivery.project_id, session.userId))) return res.status(403).json({ error: "ingen_tilgang" });
      if (delivery.status === "retracted") return res.json({ deliveryId, status: "retracted", alreadyRetracted: true });
      if (delivery.status !== "published") return res.status(409).json({ error: "Bare den aktive revisjonen kan trekkes tilbake." });
      const reason = req.body && typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
      const result = await pool.query(
        `WITH retracted AS (
           UPDATE role_room_call_sheet_deliveries
           SET status='retracted',retracted_at=NOW(),retracted_by_user_id=$2,updated_at=NOW()
           WHERE id=$1 AND status='published'
           RETURNING id,project_id,production_day_id
         ), expired_recipients AS (
           UPDATE role_room_call_sheet_recipients r SET expires_at=NOW(),updated_at=NOW()
           FROM retracted WHERE r.delivery_id=retracted.id RETURNING r.id
         ), expired_reminders AS (
           UPDATE role_room_call_sheet_recipient_tokens t SET expires_at=NOW()
           FROM expired_recipients r WHERE t.recipient_id=r.id RETURNING t.id
         ), event AS (
           INSERT INTO role_room_call_sheet_events(delivery_id,project_id,production_day_id,actor_user_id,event_type,details)
           SELECT id,project_id,production_day_id,$2,'retracted',jsonb_build_object('reason',$3::text) FROM retracted
         ) SELECT id FROM retracted`,
        [deliveryId, session.userId, reason],
      );
      if (!result.rows[0]) return res.status(409).json({ error: "Revisjonen ble endret av en annen bruker. Last inn historikken på nytt." });
      return res.json({ deliveryId, status: "retracted", alreadyRetracted: false });
    } catch (error) {
      console.error("Error retracting call sheet:", error);
      return res.status(500).json({ error: "Kunne ikke trekke tilbake call sheeten." });
    }
  });

  app.get("/api/role-room/call-sheets/acknowledge/:token", receiptLimit, async (req, res) => {
    const token = String(req.params.token || ""); if (!TOKEN_RE.test(token)) return res.status(404).type("html").send(receiptPage({ expired: true }));
    const { rows } = await pool.query(`WITH matched AS (SELECT r.id AS recipient_id,r.acknowledged_at,r.expires_at,d.subject FROM role_room_call_sheet_recipients r JOIN role_room_call_sheet_deliveries d ON d.id=r.delivery_id WHERE r.token_hash=$1 AND d.status='published' UNION ALL SELECT r.id AS recipient_id,r.acknowledged_at,t.expires_at,d.subject FROM role_room_call_sheet_recipient_tokens t JOIN role_room_call_sheet_recipients r ON r.id=t.recipient_id JOIN role_room_call_sheet_deliveries d ON d.id=r.delivery_id WHERE t.token_hash=$1 AND d.status='published' LIMIT 1) SELECT acknowledged_at,expires_at,subject FROM matched`, [hashToken(token)]);
    const row = rows[0]; if (!row || new Date(row.expires_at).getTime() < Date.now()) return res.status(404).type("html").send(receiptPage({ expired: true }));
    res.type("html").send(receiptPage({ subject: row.subject, acknowledged: Boolean(row.acknowledged_at) }));
  });
  app.post("/api/role-room/call-sheets/acknowledge/:token", receiptLimit, async (req, res) => {
    const token = String(req.params.token || ""); if (!TOKEN_RE.test(token)) return res.status(404).type("html").send(receiptPage({ expired: true }));
    const { rows } = await pool.query(`WITH matched AS (
      SELECT r.id AS recipient_id,r.delivery_id,NULL::uuid AS token_id,r.acknowledged_at AS previous_acknowledged_at,d.project_id,d.production_day_id
      FROM role_room_call_sheet_recipients r JOIN role_room_call_sheet_deliveries d ON d.id=r.delivery_id
      WHERE r.token_hash=$1 AND r.expires_at>NOW() AND d.status='published'
      UNION ALL
      SELECT t.recipient_id,r.delivery_id,t.id AS token_id,r.acknowledged_at AS previous_acknowledged_at,d.project_id,d.production_day_id
      FROM role_room_call_sheet_recipient_tokens t JOIN role_room_call_sheet_recipients r ON r.id=t.recipient_id JOIN role_room_call_sheet_deliveries d ON d.id=r.delivery_id
      WHERE t.token_hash=$1 AND t.expires_at>NOW() AND d.status='published' LIMIT 1
    ),updated_recipient AS (
      UPDATE role_room_call_sheet_recipients r SET acknowledged_at=COALESCE(r.acknowledged_at,NOW()),updated_at=NOW()
      FROM matched m WHERE r.id=m.recipient_id RETURNING r.acknowledged_at,m.recipient_id,m.delivery_id,m.previous_acknowledged_at,m.project_id,m.production_day_id
    ),updated_token AS (
      UPDATE role_room_call_sheet_recipient_tokens t SET used_at=COALESCE(t.used_at,NOW()) FROM matched m WHERE t.id=m.token_id RETURNING t.id
    ),event AS (
      INSERT INTO role_room_call_sheet_events(delivery_id,project_id,production_day_id,recipient_id,event_type,details)
      SELECT delivery_id,project_id,production_day_id,recipient_id,'acknowledged','{}'::jsonb FROM updated_recipient WHERE previous_acknowledged_at IS NULL
    ) SELECT acknowledged_at FROM updated_recipient`, [hashToken(token)]);
    if (!rows[0]) return res.status(404).type("html").send(receiptPage({ expired: true }));
    res.type("html").send(receiptPage({ acknowledged: true }));
  });
}

import { createHash, randomBytes } from "node:crypto";
import type express from "express";
import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { aiRateLimit } from "./ai-rate-limiter.js";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import { viewerMeetsTabLevel } from "./role-room-tab-access.js";

export interface CallSheetRoutesDeps { app: express.Application; pool: Pool; requireUserSession: (req: any, res: any) => any }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{40,80}$/;
const MAX_RECIPIENTS = 100;
const sendLimit = aiRateLimit({ windowMs: 60_000, max: 5, label: "Call sheet send" });
const receiptLimit = aiRateLimit({ windowMs: 60_000, max: 30, label: "Call sheet receipt" });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const publicBase = () => (process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com").replace(/\/+$/, "");

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
    const { rows } = await pool.query(`SELECT d.id,d.production_day_id,d.revision,d.subject,d.created_at,COUNT(r.id)::int total,COUNT(r.id) FILTER (WHERE r.delivery_status='sent')::int sent,COUNT(r.id) FILTER (WHERE r.acknowledged_at IS NOT NULL)::int acknowledged FROM role_room_call_sheet_deliveries d LEFT JOIN role_room_call_sheet_recipients r ON r.delivery_id=d.id WHERE d.project_id=$1 AND ($2='' OR d.production_day_id=$2) GROUP BY d.id ORDER BY d.created_at DESC LIMIT 25`, [projectId, dayId]);
    res.json({ deliveries: rows.map((r) => ({ id: r.id, productionDayId: r.production_day_id, revision: r.revision, subject: r.subject, createdAt: r.created_at, total: r.total, sent: r.sent, acknowledged: r.acknowledged })) });
  });

  app.post("/api/role-room/call-sheets/send", sendLimit, async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
      if (!projectId) return res.status(400).json({ error: "projectId er påkrevd.", sent: 0, total: 0, results: [] });
      if (!(await canAccessRoleRoomProject(pool, session.userId, projectId)) || !(await viewerMeetsTabLevel(pool, projectId, session.userId, "callsheet", "manage"))) return res.status(403).json({ error: "ingen_tilgang", sent: 0, total: 0, results: [] });
      const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim().slice(0, 200) : "Call Sheet";
      const html = typeof body.html === "string" ? body.html : "";
      const dayId = typeof body.productionDayId === "string" ? body.productionDayId.trim().slice(0, 255) : null;
      const revision = Number.isInteger(body.revision) && Number(body.revision) > 0 ? Math.min(Number(body.revision), 100000) : 1;
      const raw = Array.isArray(body.recipients) ? body.recipients : [];
      if (raw.length > MAX_RECIPIENTS) return res.status(400).json({ error: `For mange mottakere (maks ${MAX_RECIPIENTS} per utsending).`, sent: 0, total: 0, results: [] });
      const seen = new Set<string>();
      const recipients = raw.map((value) => { const r = value && typeof value === "object" ? value as Record<string, unknown> : {}; return { name: typeof r.name === "string" ? r.name.trim().slice(0, 255) : "", email: typeof r.email === "string" ? r.email.trim().toLowerCase() : "" }; }).filter((r) => { if (!EMAIL_RE.test(r.email) || seen.has(r.email)) return false; seen.add(r.email); return true; });
      if (!recipients.length) return res.status(400).json({ error: "Ingen gyldige e-postmottakere.", sent: 0, total: 0, results: [] });
      if (!html.trim()) return res.status(400).json({ error: "Mangler call-sheet-innhold.", sent: 0, total: 0, results: [] });
      const delivery = await pool.query(`INSERT INTO role_room_call_sheet_deliveries(project_id,production_day_id,revision,subject,sent_by_user_id) VALUES($1,$2,$3,$4,$5) RETURNING id`, [projectId, dayId, revision, subject, session.userId]);
      const deliveryId = delivery.rows[0]?.id; if (!deliveryId) throw new Error("delivery_not_created");
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
      res.json({ deliveryId, revision, sent, total: recipients.length, acknowledged: 0, results });
    } catch (error) { console.error("Error sending call sheet:", error); res.status(500).json({ error: "Kunne ikke sende call sheet." }); }
  });

  app.get("/api/role-room/call-sheets/acknowledge/:token", receiptLimit, async (req, res) => {
    const token = String(req.params.token || ""); if (!TOKEN_RE.test(token)) return res.status(404).type("html").send(receiptPage({ expired: true }));
    const { rows } = await pool.query(`SELECT r.acknowledged_at,r.expires_at,d.subject FROM role_room_call_sheet_recipients r JOIN role_room_call_sheet_deliveries d ON d.id=r.delivery_id WHERE r.token_hash=$1 LIMIT 1`, [hashToken(token)]);
    const row = rows[0]; if (!row || new Date(row.expires_at).getTime() < Date.now()) return res.status(404).type("html").send(receiptPage({ expired: true }));
    res.type("html").send(receiptPage({ subject: row.subject, acknowledged: Boolean(row.acknowledged_at) }));
  });
  app.post("/api/role-room/call-sheets/acknowledge/:token", receiptLimit, async (req, res) => {
    const token = String(req.params.token || ""); if (!TOKEN_RE.test(token)) return res.status(404).type("html").send(receiptPage({ expired: true }));
    const { rows } = await pool.query(`UPDATE role_room_call_sheet_recipients SET acknowledged_at=COALESCE(acknowledged_at,NOW()),updated_at=NOW() WHERE token_hash=$1 AND expires_at>NOW() RETURNING acknowledged_at`, [hashToken(token)]);
    if (!rows[0]) return res.status(404).type("html").send(receiptPage({ expired: true }));
    res.type("html").send(receiptPage({ acknowledged: true }));
  });
}

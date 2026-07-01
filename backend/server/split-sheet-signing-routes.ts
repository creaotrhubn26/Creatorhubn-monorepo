/**
 * split-sheet-signing-routes.ts — bidragsyter-oversikt + digital signering.
 *
 * Gjenbruker split_sheets (access_code) + split_sheet_contributors (signed_at,
 * signature_data). Produsenten slår på signering (får delingslenke); bandet/
 * bidragsyterne åpner en offentlig ws-portal via koden, ser hele fordelingen, og
 * signerer godkjennelse. Ingen konto nødvendig for bidragsytere.
 */
import type express from "express";
import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service";

const APP_URL = (process.env.PUBLIC_APP_URL || "https://creatorhubn.com").replace(/\/+$/, "");
const escH = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const genCode = () => {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // uten forvekslbare tegn
  let s = ""; for (let i = 0; i < 10; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};
const parseAmount = (desc?: string): number => {
  const m = String(desc || "").match(/(\d[\d\s.]*)\s*kr/i);
  return m ? Number(m[1].replace(/[\s.]/g, "")) || 0 : 0;
};

export interface SplitSheetSigningDeps {
  app: express.Application;
  pool: Pool;
  getSplitSheetUserId: (req: any) => string;
}

export function setupSplitSheetSigningRoutes(deps: SplitSheetSigningDeps): void {
  const { app, pool, getSplitSheetUserId } = deps;

  // ── Audit-logg: append-only hendelser (aktivert/åpnet/signert/fullført) ──────
  let auditReady = false;
  const ensureAudit = async () => {
    if (auditReady) return;
    await pool.query(`CREATE TABLE IF NOT EXISTS split_sheet_signing_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), split_sheet_id UUID NOT NULL, event_type TEXT NOT NULL, actor_name TEXT, contributor_id UUID, method TEXT, ip TEXT, detail TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sse_sheet ON split_sheet_signing_events (split_sheet_id, created_at)`).catch(() => undefined);
    auditReady = true;
  };
  const logEvent = async (sheetId: string, eventType: string, opts: any = {}) => {
    try {
      await ensureAudit();
      await pool.query(
        `INSERT INTO split_sheet_signing_events (split_sheet_id, event_type, actor_name, contributor_id, method, ip, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [sheetId, eventType, opts.actorName || null, opts.contributorId || null, opts.method || null, opts.ip || null, opts.detail || null],
      );
    } catch { /* best-effort */ }
  };
  const ipOf = (req: any) => (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || null;

  // Slå på signering for et ark → sikre access_code, status=pending_signatures.
  app.post("/api/split-sheets/:id/enable-signing", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      const own = await pool.query(`SELECT id, access_code FROM split_sheets WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [req.params.id, userId]).catch(() => ({ rows: [] as any[] }));
      if (!own.rows.length) return res.status(404).json({ error: "not_found" });
      let code = own.rows[0].access_code;
      if (!code) {
        code = genCode();
        await pool.query(`UPDATE split_sheets SET access_code = $1, status = 'pending_signatures', updated_at = NOW() WHERE id = $2::uuid`, [code, req.params.id]);
      } else {
        await pool.query(`UPDATE split_sheets SET status = 'pending_signatures', updated_at = NOW() WHERE id = $1::uuid`, [req.params.id]);
      }
      void logEvent(req.params.id, "signing_enabled", { actorName: "Produsent", ip: ipOf(req) });
      res.json({ ok: true, accessCode: code, shareUrl: `${APP_URL}/signer/${code}` });
    } catch (e) { console.error("enable-signing", e); res.status(500).json({ error: "failed" }); }
  });

  // Send signeringslenken DIREKTE til bidragsyterne på e-post (Resend).
  app.post("/api/split-sheets/:id/send-invites", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      const own = await pool.query(`SELECT id, title, access_code FROM split_sheets WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [req.params.id, userId]).catch(() => ({ rows: [] as any[] }));
      if (!own.rows.length) return res.status(404).json({ error: "not_found" });
      let code = own.rows[0].access_code;
      if (!code) { code = genCode(); await pool.query(`UPDATE split_sheets SET access_code = $1, status = 'pending_signatures', updated_at = NOW() WHERE id = $2::uuid`, [code, req.params.id]); }
      const link = `${APP_URL}/signer/${code}`;
      const title = own.rows[0].title || "Split sheet";
      const c = await pool.query(`SELECT id, name, email FROM split_sheet_contributors WHERE split_sheet_id = $1::uuid AND email IS NOT NULL AND email <> '' AND signed_at IS NULL`, [req.params.id]).catch(() => ({ rows: [] as any[] }));
      let sent = 0;
      for (const m of c.rows) {
        const html = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px;color:#1a1a1a">Godkjenn fordelingen 🎵</h2><p style="font-size:15px;color:#333;line-height:1.6">Hei ${escH(m.name)},<br><br>Du er lagt til i split sheet-en «<b>${escH(title)}</b>». Se hele fordelingen og signer din godkjennelse:</p><div style="margin:22px 0"><a href="${link}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Se &amp; signer</a></div><p style="font-size:12px;color:#999">Du trenger ingen konto. Har du CreatorHub-konto med samme e-post, finner du avtalen igjen under «Mine avtaler».</p></div>`;
        const text = `Hei ${m.name}. Du er lagt til i split sheet «${title}». Se fordelingen og signer: ${link}`;
        try { const r = await sendTransactionalEmail({ to: m.email, subject: `Godkjenn split sheet: ${title}`, html, text, fromLabel: "CreatorHub", kind: "split_sheet_invite", pool }); if (r.sent) sent++; } catch { /* */ }
        await pool.query(`UPDATE split_sheet_contributors SET invitation_sent_at = NOW(), invitation_status = 'sent', updated_at = NOW() WHERE id = $1::uuid`, [m.id]).catch(() => undefined);
      }
      void logEvent(req.params.id, "invites_sent", { actorName: "Produsent", detail: `${sent} sendt`, ip: ipOf(req) });
      res.json({ ok: true, sent, total: c.rows.length, shareUrl: link });
    } catch (e) { console.error("send-invites", e); res.status(500).json({ error: "failed" }); }
  });

  // Produsentens status: hvem har signert (per ark).
  app.get("/api/split-sheets/:id/signing-status", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      const own = await pool.query(`SELECT id, title, access_code, status, description FROM split_sheets WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [req.params.id, userId]).catch(() => ({ rows: [] as any[] }));
      if (!own.rows.length) return res.status(404).json({ error: "not_found" });
      const s = own.rows[0];
      const c = await pool.query(`SELECT id, name, email, role, percentage, signed_at FROM split_sheet_contributors WHERE split_sheet_id = $1::uuid ORDER BY order_index`, [req.params.id]).catch(() => ({ rows: [] as any[] }));
      const contributors = c.rows.map((x: any) => ({ id: x.id, name: x.name, email: x.email, role: x.role, percentage: Number(x.percentage) || 0, signed: !!x.signed_at, signedAt: x.signed_at }));
      await ensureAudit();
      const ev = await pool.query(`SELECT event_type, actor_name, method, ip, detail, created_at FROM split_sheet_signing_events WHERE split_sheet_id = $1::uuid ORDER BY created_at DESC LIMIT 100`, [req.params.id]).catch(() => ({ rows: [] as any[] }));
      res.json({
        title: s.title, accessCode: s.access_code, status: s.status,
        shareUrl: s.access_code ? `${APP_URL}/signer/${s.access_code}` : null,
        contributors, signedCount: contributors.filter((x: any) => x.signed).length, total: contributors.length,
        events: ev.rows.map((e: any) => ({ type: e.event_type, actor: e.actor_name, method: e.method, ip: e.ip, detail: e.detail, at: e.created_at })),
      });
    } catch (e) { console.error("signing-status", e); res.status(500).json({ error: "failed" }); }
  });

  // ── OFFENTLIG: bidragsyter-oversikt via kode (ingen konto) ───────────────────
  app.get("/api/public/split-sheet/:code", async (req, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const s = await pool.query(`SELECT id, title, description, status FROM split_sheets WHERE UPPER(access_code) = $1 LIMIT 1`, [code]).catch(() => ({ rows: [] as any[] }));
      if (!s.rows.length) return res.status(404).json({ error: "not_found" });
      const sheet = s.rows[0];
      const c = await pool.query(`SELECT id, name, email, role, percentage, signed_at FROM split_sheet_contributors WHERE split_sheet_id = $1::uuid ORDER BY order_index`, [sheet.id]).catch(() => ({ rows: [] as any[] }));
      const amount = parseAmount(sheet.description);
      const contributors = c.rows.map((x: any) => ({
        id: x.id, name: x.name, role: x.role, percentage: Number(x.percentage) || 0,
        amountKr: amount ? Math.round((Number(x.percentage) || 0) / 100 * amount) : null,
        signed: !!x.signed_at,
      }));
      void logEvent(sheet.id, "viewed", { ip: ipOf(req) });
      res.json({
        title: sheet.title, amount: amount || null, status: sheet.status,
        contributors, allSigned: contributors.length > 0 && contributors.every((x: any) => x.signed),
      });
    } catch (e) { console.error("public split-sheet", e); res.status(500).json({ error: "failed" }); }
  });

  // ── OFFENTLIG: bidragsyter signerer godkjennelse ─────────────────────────────
  app.post("/api/public/split-sheet/:code/sign", async (req, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const contributorId = String(req.body?.contributorId || "").trim();
      const signerName = String(req.body?.signerName || "").trim();
      // Tegnet signatur (finger/penn) som data-URL (png), valgfri — identitet = navn.
      const signatureImage = typeof req.body?.signatureImage === "string" && req.body.signatureImage.startsWith("data:image") ? req.body.signatureImage.slice(0, 200000) : null;
      const method = signatureImage ? "drawn" : "typed";
      if (!contributorId || !signerName) return res.status(400).json({ error: "missing_fields" });
      const s = await pool.query(`SELECT id FROM split_sheets WHERE UPPER(access_code) = $1 LIMIT 1`, [code]).catch(() => ({ rows: [] as any[] }));
      if (!s.rows.length) return res.status(404).json({ error: "not_found" });
      const sheetId = s.rows[0].id;
      const upd = await pool.query(
        `UPDATE split_sheet_contributors SET signed_at = NOW(),
            signature_data = $1::jsonb, updated_at = NOW()
          WHERE id = $2::uuid AND split_sheet_id = $3::uuid AND signed_at IS NULL RETURNING id`,
        [JSON.stringify({ signerName, method, signatureImage, signedVia: "workspace-portal", ip: (req.headers["x-forwarded-for"] || "").toString().split(",")[0] || null }), contributorId, sheetId],
      ).catch(() => ({ rows: [] as any[] }));
      // Alle signert? → marker arket ferdig.
      const cnt = await pool.query(`SELECT COUNT(*)::int total, COUNT(signed_at)::int signed FROM split_sheet_contributors WHERE split_sheet_id = $1::uuid`, [sheetId]).catch(() => ({ rows: [{ total: 0, signed: 0 }] }));
      const allSigned = cnt.rows[0].total > 0 && cnt.rows[0].total === cnt.rows[0].signed;
      if (upd.rows.length > 0) void logEvent(sheetId, "signed", { actorName: signerName, contributorId, method, ip: ipOf(req) });
      if (allSigned) { await pool.query(`UPDATE split_sheets SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`, [sheetId]).catch(() => undefined); void logEvent(sheetId, "completed", { ip: ipOf(req) }); }
      // Push-varsel til produsenten (Resend) om at noen signerte.
      if (upd.rows.length > 0) void (async () => {
        try {
          const o = await pool.query(
            `SELECT ss.title, COALESCE(cu.email, u.email) AS owner_email
               FROM split_sheets ss LEFT JOIN creatorhub_users cu ON cu.id = ss.user_id LEFT JOIN users u ON u.id = ss.user_id
              WHERE ss.id = $1::uuid LIMIT 1`, [sheetId]);
          const row = o.rows[0]; if (!row?.owner_email) return;
          const remaining = Number(cnt.rows[0].total) - Number(cnt.rows[0].signed);
          const title = row.title || "Split sheet";
          const subject = allSigned ? `Alle har signert: ${title}` : `${signerName} signerte «${title}»`;
          const html = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px;color:#1a1a1a">${allSigned ? "Fullt signert ✓" : "Ny signatur ✍️"}</h2><p style="font-size:15px;color:#333"><b>${escH(signerName)}</b> har godkjent fordelingen «${escH(title)}» (${method === "drawn" ? "tegnet" : "skrevet"} signatur).</p><p style="font-size:14px;color:#333">${allSigned ? "Alle bidragsytere har nå signert." : `Gjenstår: ${remaining} bidragsyter${remaining === 1 ? "" : "e"}.`}</p><div style="margin:18px 0"><a href="${APP_URL}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Se status i workspacet</a></div></div>`;
          const text = `${signerName} signerte «${title}». ${allSigned ? "Alle har signert." : remaining + " gjenstår."}`;
          await sendTransactionalEmail({ to: row.owner_email, subject, html, text, fromLabel: "CreatorHub", kind: "split_sheet_signed", pool });
        } catch { /* */ }
      })();
      res.json({ ok: true, alreadySigned: upd.rows.length === 0, allSigned });
    } catch (e) { console.error("public sign", e); res.status(500).json({ error: "failed" }); }
  });

  // ── «Mine avtaler» — split sheets den innloggede brukeren er bidragsyter på ───
  // Matcher på bidragsyter-e-post = brukerens e-post, så et bandmedlem som senere
  // lager konto ser avtalene de har signert/er del av (uansett hvem som eier arket).
  app.get("/api/my-split-sheets", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      if (!userId) return res.json({ agreements: [] });
      const em = await pool.query(
        `SELECT email FROM creatorhub_users WHERE id = $1 UNION SELECT email FROM users WHERE id = $1`,
        [userId],
      ).catch(() => ({ rows: [] as any[] }));
      const emails = em.rows.map((r: any) => String(r.email || "").toLowerCase()).filter(Boolean);
      if (!emails.length) return res.json({ agreements: [] });
      const r = await pool.query(
        `SELECT ss.id, ss.title, ss.status, ss.access_code, ss.description, ss.created_at, ss.completed_at,
                c.name AS my_name, c.role AS my_role, c.percentage AS my_percentage, c.signed_at AS my_signed_at,
                (SELECT COUNT(*)::int FROM split_sheet_contributors x WHERE x.split_sheet_id = ss.id) AS total,
                (SELECT COUNT(signed_at)::int FROM split_sheet_contributors x WHERE x.split_sheet_id = ss.id) AS signed
           FROM split_sheets ss
           JOIN split_sheet_contributors c ON c.split_sheet_id = ss.id
          WHERE LOWER(c.email) = ANY($1::text[])
          ORDER BY ss.created_at DESC LIMIT 100`,
        [emails],
      ).catch(() => ({ rows: [] as any[] }));
      const agreements = r.rows.map((x: any) => ({
        id: x.id, title: x.title, status: x.status, accessCode: x.access_code,
        amount: parseAmount(x.description) || null, createdAt: x.created_at, completedAt: x.completed_at,
        myRole: x.my_role, mySharePct: Number(x.my_percentage) || 0, mySigned: !!x.my_signed_at,
        signedCount: x.signed, total: x.total,
        viewUrl: x.access_code ? `${APP_URL}/signer/${x.access_code}` : null,
      }));
      res.json({ agreements });
    } catch (e) { console.error("my-split-sheets", e); res.json({ agreements: [] }); }
  });
}

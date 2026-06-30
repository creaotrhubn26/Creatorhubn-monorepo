/**
 * contact-forms-routes.ts — egendefinerte kontaktskjemaer (drag-and-drop bygger).
 *
 * Produsenten designer sitt eget skjema (vilkårlige felter), får en hostet lenke
 * (/skjema/:token) + embed. Innsendinger lander som FORESPØRSLER i client_submissions
 * med vendor_email bakt inn fra eieren (så ruting/innboks-match aldri bommer), og
 * utløser samme e-post-varsel + in-app badge som vanlige forespørsler.
 *
 * Felt-modell (fields jsonb): [{ id, type, label, placeholder, required, options[], mapTo }]
 *   type ∈ text|email|tel|textarea|select|date|number|checkbox|radio
 *   mapTo ∈ name|email|phone|projectType|eventDate|budget|location|description | null (→ form_data)
 */
import type express from "express";
import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service";

const APP_URL = (process.env.PUBLIC_APP_URL || "https://creatorhubn.com").replace(/\/+$/, "");
const escH = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const STD_COLS = new Set(["name", "email", "phone", "projectType", "eventDate", "budget", "location", "description"]);

const DEFAULT_FIELDS = [
  { id: "f_name", type: "text", label: "Navn", placeholder: "Ditt navn", required: true, options: [], mapTo: "name" },
  { id: "f_email", type: "email", label: "E-post", placeholder: "din@epost.no", required: true, options: [], mapTo: "email" },
  { id: "f_phone", type: "tel", label: "Telefon", placeholder: "+47 …", required: false, options: [], mapTo: "phone" },
  { id: "f_msg", type: "textarea", label: "Hva kan vi hjelpe deg med?", placeholder: "Beskriv prosjektet …", required: true, options: [], mapTo: "description" },
];

export interface ContactFormsDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => { userId: string; email: string; name?: string } | null;
}

export function setupContactFormsRoutes(deps: ContactFormsDeps): void {
  const { app, pool, requireUserSession } = deps;

  let schemaReady = false;
  async function ensureSchema() {
    if (schemaReady) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id VARCHAR(64) NOT NULL,
        token TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL DEFAULT 'Kontakt oss',
        intro TEXT,
        fields JSONB NOT NULL DEFAULT '[]',
        branding JSONB NOT NULL DEFAULT '{}',
        vendor_email TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        submission_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`).catch(() => undefined);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_forms_owner ON contact_forms(owner_user_id)`).catch(() => undefined);
    schemaReady = true;
  }

  const mapForm = (r: any, withInternal = false) => ({
    id: r.id,
    token: r.token,
    title: r.title,
    intro: r.intro || "",
    fields: Array.isArray(r.fields) ? r.fields : [],
    branding: r.branding || {},
    isActive: r.is_active !== false,
    submissionCount: r.submission_count || 0,
    ...(withInternal ? { vendorEmail: r.vendor_email, createdAt: r.created_at, updatedAt: r.updated_at } : {}),
    shareUrl: `${APP_URL}/skjema/${r.token}`,
  });

  // ── Authed CRUD ────────────────────────────────────────────────────────────
  app.get("/api/contact-forms", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      await ensureSchema();
      const r = await pool.query(`SELECT * FROM contact_forms WHERE owner_user_id = $1 ORDER BY created_at DESC`, [s.userId]);
      res.json({ forms: r.rows.map((x) => mapForm(x, true)) });
    } catch (e) { console.error("GET contact-forms", e); res.json({ forms: [] }); }
  });

  app.post("/api/contact-forms", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      await ensureSchema();
      const token = "cf_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      const title = String(req.body?.title || "Kontakt oss").slice(0, 200);
      const fields = Array.isArray(req.body?.fields) && req.body.fields.length ? req.body.fields : DEFAULT_FIELDS;
      const r = await pool.query(
        `INSERT INTO contact_forms (owner_user_id, token, title, intro, fields, branding, vendor_email)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [s.userId, token, title, String(req.body?.intro || "").slice(0, 2000), JSON.stringify(fields), JSON.stringify(req.body?.branding || {}), s.email],
      );
      res.status(201).json({ form: mapForm(r.rows[0], true) });
    } catch (e) { console.error("POST contact-forms", e); res.status(500).json({ error: "create_failed" }); }
  });

  app.get("/api/contact-forms/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      await ensureSchema();
      const r = await pool.query(`SELECT * FROM contact_forms WHERE id = $1::uuid AND owner_user_id = $2`, [req.params.id, s.userId]).catch(() => ({ rows: [] }));
      if (!r.rows.length) return res.status(404).json({ error: "not_found" });
      res.json({ form: mapForm(r.rows[0], true) });
    } catch (e) { console.error("GET contact-form", e); res.status(500).json({ error: "failed" }); }
  });

  app.put("/api/contact-forms/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      await ensureSchema();
      const sets: string[] = []; const params: any[] = [];
      const set = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };
      if (req.body?.title != null) set("title", String(req.body.title).slice(0, 200));
      if (req.body?.intro != null) set("intro", String(req.body.intro).slice(0, 2000));
      if (Array.isArray(req.body?.fields)) set("fields", JSON.stringify(req.body.fields));
      if (req.body?.branding != null) set("branding", JSON.stringify(req.body.branding));
      if (req.body?.isActive != null) set("is_active", !!req.body.isActive);
      if (!sets.length) return res.json({ ok: true });
      sets.push("updated_at = NOW()");
      params.push(req.params.id); params.push(s.userId);
      const r = await pool.query(
        `UPDATE contact_forms SET ${sets.join(", ")} WHERE id = $${params.length - 1}::uuid AND owner_user_id = $${params.length} RETURNING *`,
        params,
      ).catch(() => ({ rows: [] }));
      if (!r.rows.length) return res.status(404).json({ error: "not_found" });
      res.json({ form: mapForm(r.rows[0], true) });
    } catch (e) { console.error("PUT contact-form", e); res.status(500).json({ error: "update_failed" }); }
  });

  app.delete("/api/contact-forms/:id", async (req, res) => {
    const s = requireUserSession(req, res); if (!s) return;
    try {
      await ensureSchema();
      await pool.query(`DELETE FROM contact_forms WHERE id = $1::uuid AND owner_user_id = $2`, [req.params.id, s.userId]).catch(() => undefined);
      res.json({ ok: true });
    } catch (e) { console.error("DELETE contact-form", e); res.status(500).json({ error: "failed" }); }
  });

  // ── Offentlig: hent skjema-definisjon for rendering (ingen eier-data) ─────────
  app.get("/api/public/contact-form/:token", async (req, res) => {
    try {
      await ensureSchema();
      const r = await pool.query(`SELECT * FROM contact_forms WHERE token = $1 AND is_active = TRUE`, [req.params.token]).catch(() => ({ rows: [] }));
      if (!r.rows.length) return res.status(404).json({ error: "not_found" });
      const f = r.rows[0];
      res.json({ title: f.title, intro: f.intro || "", fields: Array.isArray(f.fields) ? f.fields : [], branding: f.branding || {} });
    } catch (e) { console.error("GET public contact-form", e); res.status(500).json({ error: "failed" }); }
  });

  // ── Offentlig: innsending → client_submissions (forespørsel) + varsel ────────
  app.post("/api/public/contact-form/:token", async (req, res) => {
    try {
      await ensureSchema();
      const fr = await pool.query(`SELECT * FROM contact_forms WHERE token = $1 AND is_active = TRUE`, [req.params.token]).catch(() => ({ rows: [] }));
      if (!fr.rows.length) return res.status(404).json({ error: "unknown_form" });
      const form = fr.rows[0];
      const fields = Array.isArray(form.fields) ? form.fields : [];
      const answers = (req.body?.answers && typeof req.body.answers === "object") ? req.body.answers : {};

      const col: Record<string, any> = {};
      const custom: Record<string, any> = {};
      for (const f of fields) {
        const v = answers[f.id];
        if (v == null || v === "" || (Array.isArray(v) && !v.length)) {
          if (f.required) return res.status(400).json({ error: "missing_required", field: f.label || f.id });
          continue;
        }
        const val = Array.isArray(v) ? v.join(", ") : String(v);
        if (f.mapTo && STD_COLS.has(f.mapTo)) col[f.mapTo] = val;
        else custom[f.label || f.id] = val;
      }
      const name = col.name || "Ukjent";
      const email = col.email;
      if (!email) return res.status(400).json({ error: "email_required" });

      const ins = await pool.query(
        `INSERT INTO client_submissions
           (id, name, email, phone, project_type, event_date, location, budget, description,
            form_data, vendor_email, priority, category, status, submission_type, data, submitted_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'medium','inquiry','new','inquiry','{}',NOW(),NOW(),NOW())
         RETURNING id`,
        [name, email, col.phone || null, col.projectType || null, col.eventDate || null, col.location || null,
         col.budget || null, col.description || null, JSON.stringify(custom), form.vendor_email],
      );
      await pool.query(`UPDATE contact_forms SET submission_count = submission_count + 1 WHERE id = $1::uuid`, [form.id]).catch(() => undefined);

      // E-post-varsel til produsenten (Resend) — idet forespørselen lander.
      void (async () => {
        try {
          const toEmail = form.vendor_email;
          if (!toEmail) return;
          const rows: [string, string][] = [
            col.projectType ? ["Type", col.projectType] : null,
            col.eventDate ? ["Dato", col.eventDate] : null,
            col.budget ? ["Budsjett", String(col.budget)] : null,
            col.location ? ["Sted", col.location] : null,
            col.phone ? ["Telefon", col.phone] : null,
            ...Object.entries(custom).map(([k, v]) => [k, String(v)] as [string, string]),
          ].filter(Boolean) as [string, string][];
          const table = rows.map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">${escH(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${escH(v)}</td></tr>`).join("");
          const html = `<div style="font-family:-apple-system,sans-serif;max-width:540px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px;color:#1a1a1a">Ny forespørsel 🎉</h2><p style="font-size:15px;color:#333;line-height:1.6"><b>${escH(name)}</b> (${escH(email)}) sendte deg en forespørsel via «${escH(form.title)}».</p>${table ? `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">${table}</table>` : ""}${col.description ? `<blockquote style="border-left:3px solid #ff8c00;margin:12px 0;padding:8px 16px;color:#333">«${escH(col.description)}»</blockquote>` : ""}<div style="margin:20px 0"><a href="${APP_URL}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Se forespørselen</a></div><p style="font-size:12px;color:#999">Du finner den under «Forespørsler» i workspacet.</p></div>`;
          const text = `Ny forespørsel fra ${name} (${email}) via «${form.title}».` + rows.map(([k, v]) => ` ${k}: ${v}.`).join("") + (col.description ? ` «${col.description}»` : "");
          await sendTransactionalEmail({ to: toEmail, subject: `Ny forespørsel fra ${name}${col.projectType ? " – " + col.projectType : ""}`, html, text, fromLabel: "CreatorHub", kind: "inquiry_received", pool });
        } catch (e: any) { console.warn("[contact-form] notify failed:", e?.message); }
      })();

      const thanks = (form.branding && form.branding.thankYouMessage) || "Takk! Vi tar kontakt snart.";
      res.status(201).json({ ok: true, id: ins.rows[0].id, message: thanks });
    } catch (e) { console.error("POST public contact-form", e); res.status(500).json({ error: "submit_failed" }); }
  });
}

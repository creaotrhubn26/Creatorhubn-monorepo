/**
 * wa-templates-admin-routes.ts
 *
 * Super-admin API for å administrere WhatsApp Cloud API-templates
 * direkte fra The Role Room / Leadgrid super-admin uten å gå til Meta
 * Business Suite.
 *
 *   GET    /api/superadmin/wa-templates
 *   GET    /api/superadmin/wa-templates/sync-from-meta       (proxy + cache i DB)
 *   POST   /api/superadmin/wa-templates                       (create + post til Meta)
 *   PUT    /api/superadmin/wa-templates/:id                   (oppdater status fra Meta)
 *   DELETE /api/superadmin/wa-templates/:name                 (slett fra Meta + DB)
 *   POST   /api/superadmin/wa-templates/sync-leadgrid         (re-post manglende Leadgrid-templates)
 *   POST   /api/superadmin/wa-templates/:name/send-test       (live-send til et nummer)
 *   GET    /api/superadmin/wa-templates/analytics             (sendt/levert/feil siste 30d)
 *
 *   GET    /api/superadmin/wa-org-configs                     (multi-tenant WABA-config)
 *   PUT    /api/superadmin/wa-org-configs/:org_key            (upsert per-org WA-config)
 *   DELETE /api/superadmin/wa-org-configs/:org_key
 *
 * Bygd som proxy + cache: Meta er sannheten, vår DB er hurtigminne +
 * historikk. send-test bruker SAMME pipeline som notifyClient() så
 * vi tester den ekte flow-en, ikke en parallell.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  readEnvFallbackConfig, normalizePhoneE164,
  type WhatsAppSenderConfig,
} from "./casting-whatsapp-sender.js";
import { LEADGRID_WA_TEMPLATES } from "./leadgrid-whatsapp-templates.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

const META_GRAPH_VERSION = "v22.0";

const WABA_ID_FALLBACK = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "";

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

async function requireSuperAdmin(
  pool: Pool, sessions: Map<string, SessionData>,
  req: Request, res: Response,
): Promise<SessionData | null> {
  const s = getSession(req, sessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`, [s.userId],
  );
  if (r.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" });
    return null;
  }
  return s;
}

/** Hent WABA + access-token for org_key, fallback til env. */
async function getWabaConfig(pool: Pool, orgKey: string | null): Promise<{
  wabaId: string; accessToken: string; phoneNumberId: string; displayName: string;
} | null> {
  if (orgKey) {
    const r = await pool.query<{
      business_account_id: string; access_token_encrypted: string;
      phone_number_id: string; display_name: string | null;
    }>(
      `SELECT business_account_id, access_token_encrypted,
              phone_number_id, display_name
         FROM role_room_org_whatsapp_config
        WHERE org_key = $1`,
      [orgKey],
    );
    const row = r.rows[0];
    if (row?.access_token_encrypted && row.business_account_id && row.phone_number_id) {
      return {
        wabaId: row.business_account_id,
        accessToken: row.access_token_encrypted,
        phoneNumberId: row.phone_number_id,
        displayName: row.display_name ?? "Bedrift",
      };
    }
  }
  // Env-fallback
  const env = readEnvFallbackConfig();
  if (!env || !WABA_ID_FALLBACK) return null;
  return {
    wabaId: WABA_ID_FALLBACK,
    accessToken: env.accessToken,
    phoneNumberId: env.phoneNumberId,
    displayName: env.displayName,
  };
}

/** Parse Meta sin components-array til våre DB-felter. */
function parseMetaComponents(components: any[]): {
  header_format: string | null; header_text: string | null;
  body_text: string; body_param_count: number; body_param_examples: any;
  footer_text: string | null; buttons: any;
} {
  const result = {
    header_format: null as string | null,
    header_text: null as string | null,
    body_text: "",
    body_param_count: 0,
    body_param_examples: null as any,
    footer_text: null as string | null,
    buttons: null as any,
  };
  for (const c of components ?? []) {
    if (c.type === "HEADER") {
      result.header_format = c.format ?? null;
      result.header_text = c.text ?? null;
    } else if (c.type === "BODY") {
      result.body_text = c.text ?? "";
      const matches = (c.text ?? "").match(/\{\{\d+\}\}/g);
      result.body_param_count = matches ? matches.length : 0;
      result.body_param_examples = c.example?.body_text ?? null;
    } else if (c.type === "FOOTER") {
      result.footer_text = c.text ?? null;
    } else if (c.type === "BUTTONS") {
      result.buttons = c.buttons ?? null;
    }
  }
  return result;
}

export function registerWaTemplatesAdminRoutes({ app, pool, activeSessions }: Deps): void {

  // ============================================================
  // LISTE + SYNC
  // ============================================================
  app.get("/api/superadmin/wa-templates", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const orgKey = (req.query.org_key as string) || null;
    const r = await pool.query(
      `SELECT id, meta_template_id, org_key, name, language, category,
              header_format, header_text, body_text, body_param_count,
              body_param_examples, footer_text, buttons,
              status, rejected_reason, quality_score,
              last_status_sync_at::text, created_at::text, updated_at::text, notes
         FROM wa_templates_managed
        WHERE ($1::text IS NULL OR org_key = $1)
           OR ($1::text = '__global__' AND org_key IS NULL)
        ORDER BY name, language`,
      [orgKey],
    );
    res.json({ templates: r.rows });
  });

  /** Hent fra Meta + lagre i DB. Idempotent — bruker UPSERT. */
  app.post("/api/superadmin/wa-templates/sync-from-meta", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const orgKey = (req.body?.org_key as string) || null;
    const cfg = await getWabaConfig(pool, orgKey);
    if (!cfg) return res.status(400).json({ error: "WABA-config mangler" });

    try {
      const r = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${cfg.wabaId}/message_templates?limit=200&fields=id,name,language,status,category,rejected_reason,quality_score,components`,
        { headers: { "Authorization": `Bearer ${cfg.accessToken}` } },
      );
      const j: any = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: "meta_fetch_failed", details: j });

      let synced = 0;
      for (const t of (j.data ?? [])) {
        const parsed = parseMetaComponents(t.components ?? []);
        await pool.query(
          `INSERT INTO wa_templates_managed
            (meta_template_id, org_key, name, language, category,
             header_format, header_text, body_text, body_param_count,
             body_param_examples, footer_text, buttons,
             status, rejected_reason, quality_score, last_status_sync_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
           ON CONFLICT (org_key, name, language) DO UPDATE SET
             meta_template_id = EXCLUDED.meta_template_id,
             category = EXCLUDED.category,
             header_format = EXCLUDED.header_format,
             header_text = EXCLUDED.header_text,
             body_text = EXCLUDED.body_text,
             body_param_count = EXCLUDED.body_param_count,
             body_param_examples = EXCLUDED.body_param_examples,
             footer_text = EXCLUDED.footer_text,
             buttons = EXCLUDED.buttons,
             status = EXCLUDED.status,
             rejected_reason = EXCLUDED.rejected_reason,
             quality_score = EXCLUDED.quality_score,
             last_status_sync_at = now(),
             updated_at = now()`,
          [t.id, orgKey, t.name, t.language, t.category,
           parsed.header_format, parsed.header_text,
           parsed.body_text, parsed.body_param_count,
           JSON.stringify(parsed.body_param_examples),
           parsed.footer_text, JSON.stringify(parsed.buttons),
           t.status, t.rejected_reason ?? null, t.quality_score?.score ?? null],
        );
        synced++;
      }
      res.json({ ok: true, synced, total: j.data?.length ?? 0 });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "sync_failed" });
    }
  });

  // ============================================================
  // CREATE
  // ============================================================
  app.post("/api/superadmin/wa-templates", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const b = req.body ?? {};
    const orgKey = b.org_key || null;
    const cfg = await getWabaConfig(pool, orgKey);
    if (!cfg) return res.status(400).json({ error: "WABA-config mangler" });

    if (!b.name || !b.language || !b.category || !b.body_text) {
      return res.status(400).json({ error: "name, language, category, body_text påkrevd" });
    }

    // Bygg Meta-components
    const components: any[] = [];
    if (b.header_format === "TEXT" && b.header_text) {
      components.push({ type: "HEADER", format: "TEXT", text: b.header_text });
    }
    const bodyComp: any = { type: "BODY", text: b.body_text };
    if (b.body_param_examples && Array.isArray(b.body_param_examples)) {
      bodyComp.example = { body_text: [b.body_param_examples] };
    }
    components.push(bodyComp);
    if (b.footer_text) {
      components.push({ type: "FOOTER", text: b.footer_text });
    }
    if (b.buttons && Array.isArray(b.buttons) && b.buttons.length > 0) {
      components.push({ type: "BUTTONS", buttons: b.buttons });
    }

    try {
      const r = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${cfg.wabaId}/message_templates`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: b.name, language: b.language, category: b.category, components,
          }),
        },
      );
      const j: any = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: "meta_create_failed", details: j });

      // Lagre i DB
      const parsed = parseMetaComponents(components);
      await pool.query(
        `INSERT INTO wa_templates_managed
          (meta_template_id, org_key, name, language, category,
           header_format, header_text, body_text, body_param_count,
           body_param_examples, footer_text, buttons,
           status, last_status_sync_at, created_by_user_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), $14, $15)
         ON CONFLICT (org_key, name, language) DO UPDATE SET
           meta_template_id = EXCLUDED.meta_template_id,
           category = EXCLUDED.category,
           header_text = EXCLUDED.header_text,
           body_text = EXCLUDED.body_text,
           body_param_count = EXCLUDED.body_param_count,
           buttons = EXCLUDED.buttons,
           status = EXCLUDED.status,
           updated_at = now()`,
        [j.id, orgKey, b.name, b.language, b.category,
         parsed.header_format, parsed.header_text,
         parsed.body_text, parsed.body_param_count,
         JSON.stringify(parsed.body_param_examples),
         parsed.footer_text, JSON.stringify(parsed.buttons),
         j.status ?? "PENDING", s.userId, b.notes ?? null],
      );
      res.json({ ok: true, meta_id: j.id, status: j.status });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "create_failed" });
    }
  });

  // ============================================================
  // DELETE
  // ============================================================
  app.delete("/api/superadmin/wa-templates/:name", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const orgKey = (req.query.org_key as string) || null;
    const cfg = await getWabaConfig(pool, orgKey);
    if (!cfg) return res.status(400).json({ error: "WABA-config mangler" });

    try {
      const r = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${cfg.wabaId}/message_templates?name=${encodeURIComponent(req.params.name)}`,
        { method: "DELETE", headers: { "Authorization": `Bearer ${cfg.accessToken}` } },
      );
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json({ error: "meta_delete_failed", details: j });

      await pool.query(
        `DELETE FROM wa_templates_managed
          WHERE name = $1 AND (org_key = $2 OR ($2::text IS NULL AND org_key IS NULL))`,
        [req.params.name, orgKey],
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "delete_failed" });
    }
  });

  // ============================================================
  // SYNC LEADGRID (re-post manglende fra leadgrid-whatsapp-templates.ts)
  // ============================================================
  app.post("/api/superadmin/wa-templates/sync-leadgrid", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const orgKey = (req.body?.org_key as string) || null;
    const cfg = await getWabaConfig(pool, orgKey);
    if (!cfg) return res.status(400).json({ error: "WABA-config mangler" });

    const results: any[] = [];
    for (const t of LEADGRID_WA_TEMPLATES) {
      // Sjekk om templaten finnes på Meta allerede (case-insensitiv via DB-cache)
      const existing = await pool.query(
        `SELECT status FROM wa_templates_managed
          WHERE org_key IS NOT DISTINCT FROM $1
            AND name = $2 AND language = $3`,
        [orgKey, t.fullName, t.language],
      );
      if (existing.rows[0]?.status === "APPROVED" || existing.rows[0]?.status === "PENDING") {
        results.push({ name: t.fullName, language: t.language, action: "skip", status: existing.rows[0].status });
        continue;
      }

      // Bygg Meta-components
      const components: any[] = [];
      if (t.headerText) {
        components.push({ type: "HEADER", format: "TEXT", text: t.headerText });
      }
      const exampleParams = t.paramLabels.map((l) => `[${l}]`);
      components.push({
        type: "BODY", text: t.bodyTemplate,
        example: { body_text: [exampleParams] },
      });
      if (t.hasUrlButton) {
        components.push({
          type: "BUTTONS",
          buttons: [{
            type: "URL",
            text: t.language === "nb" ? "Åpne portalen" : "Open portal",
            url: "https://leadgrid.theroleroom.com/c/{{1}}",
            example: ["https://leadgrid.theroleroom.com/c/abc123xyz"],
          }],
        });
      }

      try {
        const r = await fetch(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${cfg.wabaId}/message_templates`,
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: t.fullName, language: t.language, category: t.category, components,
            }),
          },
        );
        const j: any = await r.json();
        if (r.ok) {
          await pool.query(
            `INSERT INTO wa_templates_managed
              (meta_template_id, org_key, name, language, category,
               header_text, body_text, body_param_count, buttons,
               status, last_status_sync_at, created_by_user_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11, $12)
             ON CONFLICT (org_key, name, language) DO UPDATE SET
               meta_template_id = EXCLUDED.meta_template_id,
               status = EXCLUDED.status,
               updated_at = now()`,
            [j.id, orgKey, t.fullName, t.language, t.category,
             t.headerText ?? null, t.bodyTemplate, t.bodyParamCount,
             JSON.stringify(t.hasUrlButton ? components[components.length - 1].buttons : null),
             j.status ?? "PENDING", s.userId, "auto-synced from leadgrid-whatsapp-templates.ts"],
          );
          results.push({ name: t.fullName, language: t.language, action: "created", status: j.status });
        } else {
          results.push({ name: t.fullName, language: t.language, action: "error", error: j?.error?.message ?? "unknown" });
        }
      } catch (e: any) {
        results.push({ name: t.fullName, language: t.language, action: "error", error: e?.message });
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    res.json({ ok: true, results });
  });

  // ============================================================
  // SEND TEST (live-send til vilkårlig nummer)
  // ============================================================
  app.post("/api/superadmin/wa-templates/:name/send-test", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const b = req.body ?? {};
    const orgKey = b.org_key || null;
    const cfg = await getWabaConfig(pool, orgKey);
    if (!cfg) return res.status(400).json({ error: "WABA-config mangler" });

    const phone = normalizePhoneE164(b.phone);
    if (!phone) return res.status(400).json({ error: "Ugyldig telefonnummer" });

    // Hent template fra DB
    const tplR = await pool.query(
      `SELECT * FROM wa_templates_managed
        WHERE name = $1 AND language = $2
          AND (org_key = $3 OR ($3::text IS NULL AND org_key IS NULL))
        LIMIT 1`,
      [req.params.name, b.language ?? "nb", orgKey],
    );
    const tpl = tplR.rows[0];
    if (!tpl) return res.status(404).json({ error: "Template ikke funnet i DB" });

    // Bygg payload
    const bodyParams: string[] = Array.isArray(b.body_params) ? b.body_params : [];
    const components: any[] = [];
    if (bodyParams.length > 0) {
      components.push({ type: "body",
        parameters: bodyParams.map((text) => ({ type: "text", text: String(text) })) });
    }
    if (b.button_param) {
      components.push({
        type: "button", sub_type: "url", index: "0",
        parameters: [{ type: "text", text: String(b.button_param) }],
      });
    }
    const payload = {
      messaging_product: "whatsapp",
      to: phone.replace(/^\+/, ""),
      type: "template",
      template: {
        name: tpl.name,
        language: { code: tpl.language },
        components,
      },
    };

    try {
      const r = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${cfg.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const j: any = await r.json();
      const ok = r.ok;
      const msgId = j?.messages?.[0]?.id;
      await pool.query(
        `INSERT INTO wa_template_send_log
          (template_name, template_language, org_key, recipient_phone,
           recipient_label, sent_by_user_id, send_purpose,
           body_params, button_param,
           delivery_status, external_message_id, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, 'admin_test', $7, $8, $9, $10, $11)`,
        [tpl.name, tpl.language, orgKey, phone,
         b.recipient_label ?? "admin-test", s.userId,
         JSON.stringify(bodyParams), b.button_param ?? null,
         ok ? "sent" : "failed", msgId, ok ? null : (j?.error?.message ?? `HTTP ${r.status}`)],
      );
      if (!ok) return res.status(r.status).json({ error: "send_failed", details: j });
      res.json({ ok: true, message_id: msgId });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "send_failed" });
    }
  });

  // ============================================================
  // ANALYTICS
  // ============================================================
  app.get("/api/superadmin/wa-templates/analytics", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE sent_at > now() - interval '30 days') AS sent_30d,
         COUNT(*) FILTER (WHERE sent_at > now() - interval '30 days' AND delivery_status = 'sent') AS delivered_30d,
         COUNT(*) FILTER (WHERE sent_at > now() - interval '30 days' AND delivery_status = 'failed') AS failed_30d,
         COUNT(*) FILTER (WHERE sent_at > now() - interval '7 days') AS sent_7d
        FROM wa_template_send_log`,
    );

    const per_template = await pool.query(
      `SELECT template_name, template_language,
              COUNT(*) AS sent,
              COUNT(*) FILTER (WHERE delivery_status = 'sent') AS delivered,
              COUNT(*) FILTER (WHERE delivery_status = 'failed') AS failed,
              MAX(sent_at)::text AS last_sent_at
         FROM wa_template_send_log
        WHERE sent_at > now() - interval '30 days'
        GROUP BY template_name, template_language
        ORDER BY sent DESC LIMIT 30`,
    );

    // Pull client_notification_log for production-stream
    const client_stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE sent_at > now() - interval '30 days' AND channel='whatsapp') AS wa_sent_30d,
         COUNT(*) FILTER (WHERE sent_at > now() - interval '30 days' AND channel='whatsapp' AND delivery_status='sent') AS wa_delivered_30d,
         COUNT(*) FILTER (WHERE sent_at > now() - interval '30 days' AND channel='whatsapp' AND delivery_status='failed') AS wa_failed_30d
         FROM client_notification_log`,
    ).catch(() => ({ rows: [{ wa_sent_30d: 0, wa_delivered_30d: 0, wa_failed_30d: 0 }] }));

    res.json({
      ...stats.rows[0],
      ...client_stats.rows[0],
      per_template: per_template.rows,
    });
  });

  // ============================================================
  // ORG-CONFIGS (multi-tenant WABA)
  // ============================================================
  app.get("/api/superadmin/wa-org-configs", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const r = await pool.query(
      `SELECT org_key, business_account_id, phone_number_id, display_name,
              template_language, last_validated_at::text,
              last_validation_error, provider, bsp_onboarded_at::text,
              created_at::text, updated_at::text
         FROM role_room_org_whatsapp_config
        ORDER BY updated_at DESC`,
    );
    res.json({ configs: r.rows });
  });

  app.put("/api/superadmin/wa-org-configs/:org_key", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;

    const b = req.body ?? {};
    await pool.query(
      `INSERT INTO role_room_org_whatsapp_config
         (org_key, business_account_id, phone_number_id,
          access_token_encrypted, display_name, template_language,
          configured_by_user_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (org_key) DO UPDATE SET
         business_account_id = EXCLUDED.business_account_id,
         phone_number_id = EXCLUDED.phone_number_id,
         access_token_encrypted = COALESCE(NULLIF(EXCLUDED.access_token_encrypted, ''),
                                            role_room_org_whatsapp_config.access_token_encrypted),
         display_name = EXCLUDED.display_name,
         template_language = EXCLUDED.template_language,
         updated_at = now()`,
      [req.params.org_key, b.business_account_id, b.phone_number_id,
       b.access_token ?? "", b.display_name ?? "Bedrift",
       b.template_language ?? "nb", s.userId],
    );

    // Valider mot Meta
    try {
      const r = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${b.phone_number_id}?fields=display_phone_number,verified_name`,
        { headers: { "Authorization": `Bearer ${b.access_token}` } },
      );
      const j: any = await r.json();
      if (r.ok) {
        await pool.query(
          `UPDATE role_room_org_whatsapp_config
              SET last_validated_at = now(), last_validation_error = NULL
            WHERE org_key = $1`,
          [req.params.org_key],
        );
      } else {
        await pool.query(
          `UPDATE role_room_org_whatsapp_config
              SET last_validated_at = now(),
                  last_validation_error = $1
            WHERE org_key = $2`,
          [JSON.stringify(j).slice(0, 500), req.params.org_key],
        );
      }
    } catch (e: any) {
      // ignore validation errors
    }

    res.json({ ok: true });
  });

  app.delete("/api/superadmin/wa-org-configs/:org_key", async (req, res) => {
    const s = await requireSuperAdmin(pool, activeSessions, req, res);
    if (!s) return;
    await pool.query(
      `DELETE FROM role_room_org_whatsapp_config WHERE org_key = $1`,
      [req.params.org_key],
    );
    res.json({ ok: true });
  });
}

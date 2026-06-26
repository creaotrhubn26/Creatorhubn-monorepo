/**
 * prototype-report-routes.ts
 *
 * Fremdriftsrapport på e-post om prototype-testerne (innlogget? sett velkomst?
 * sist aktiv? hendelser/feedback/oppdrag). Sendes til en konfigurerbar mottaker
 * (default daniel@creatorhubn.com) — endres i admin-dashbordet. Kan trigges
 * manuelt («Send nå») eller via ukentlig cron.
 *
 * Innstillinger ligger i prototype_report_settings (singleton-rad), opprettet
 * lazily siden start-scriptet ikke kjører migrate.sh på hver deploy.
 */

import type express from "express";
import type { Pool } from "pg";
import { composeEmail } from "./email-design-system";
import { sendTransactionalEmail } from "./transactional-email-service";

interface Deps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId?: string; email?: string; role?: string } | null | undefined;
  adminRoles: Set<string>;
}

const DEFAULT_RECIPIENT = "daniel@creatorhubn.com";

export function setupPrototypeReportRoutes({ app, pool, getActiveSessionFromRequest, adminRoles }: Deps): void {
  let settingsReady: Promise<void> | null = null;
  const ensureSettings = (): Promise<void> => {
    if (!settingsReady) {
      settingsReady = pool
        .query(
          `CREATE TABLE IF NOT EXISTS prototype_report_settings (
            id INT PRIMARY KEY DEFAULT 1,
            recipient_email VARCHAR(320) NOT NULL DEFAULT '${DEFAULT_RECIPIENT}',
            enabled BOOLEAN NOT NULL DEFAULT true,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_by VARCHAR(255),
            CONSTRAINT prototype_report_settings_singleton CHECK (id = 1)
          )`,
        )
        .then(() =>
          pool.query(
            `INSERT INTO prototype_report_settings (id, recipient_email) VALUES (1, $1)
             ON CONFLICT (id) DO NOTHING`,
            [DEFAULT_RECIPIENT],
          ),
        )
        .then(() => undefined)
        .catch((e) => {
          settingsReady = null;
          console.error("[prototype-report] ensureSettings failed", e);
        });
    }
    return settingsReady;
  };

  const adminFromReq = (req: express.Request): { userId: string; email: string } | null => {
    const s = getActiveSessionFromRequest(req);
    const role = String((s as any)?.role || "").trim().toLowerCase();
    if (!s || !adminRoles.has(role)) return null;
    return { userId: String((s as any).userId || ""), email: String((s as any).email || "") };
  };

  const getSettings = async (): Promise<{ recipientEmail: string; enabled: boolean }> => {
    await ensureSettings();
    const r = (await pool.query(`SELECT recipient_email, enabled FROM prototype_report_settings WHERE id = 1`)).rows[0];
    return {
      recipientEmail: r?.recipient_email || DEFAULT_RECIPIENT,
      enabled: r?.enabled !== false,
    };
  };

  const buildReport = async (): Promise<{ testerCount: number; html: string; text: string; subject: string }> => {
    let testers: any[] = [];
    try {
      testers = (
        await pool.query(`
          SELECT v.vendor_name, u.email, v.prototype_until,
                 (SELECT max(created_at) FROM prototype_activity_signals s WHERE s.user_id = v.user_id) AS last_active,
                 (SELECT count(*) FROM prototype_activity_signals s WHERE s.user_id = v.user_id) AS events_total,
                 (SELECT count(*) FROM prototype_activity_signals s WHERE s.user_id = v.user_id AND s.created_at > now() - interval '7 days') AS events_7d,
                 (SELECT count(*) FROM prototype_activity_signals s WHERE s.user_id = v.user_id AND s.event_type = 'welcome_seen') AS welcome_cnt,
                 (SELECT count(*) FROM prototype_feedback f WHERE f.user_id = v.user_id) AS feedback_count,
                 (SELECT count(*) FROM editing_jobs j WHERE j.vendor_id = v.user_id) AS jobs_count
            FROM vendor_onboarding_profiles v
            LEFT JOIN users u ON u.id = v.user_id
           WHERE v.vendor_type = 'editing' AND v.partner_type = 'prototype' AND v.approval_status = 'approved'
           ORDER BY last_active DESC NULLS LAST
        `)
      ).rows;
    } catch (e) {
      console.error("[prototype-report] build query failed", e);
    }

    const esc = (s: unknown) =>
      String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));

    const rowsHtml = testers
      .map((t) => {
        const lastActive = t.last_active ? new Date(t.last_active) : null;
        const loggedIn = !!lastActive;
        const lastStr = lastActive ? lastActive.toLocaleString("nb-NO") : "Aldri logget inn";
        const welcome = Number(t.welcome_cnt || 0) > 0 ? " · 👋 sett velkomst" : "";
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${esc(t.vendor_name || "—")}</strong><br><span style="color:#888;font-size:12px;">${esc(t.email || "")}</span></td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${loggedIn ? "🟢 Innlogget" : "⚪ Ikke ennå"}${welcome}<br><span style="color:#888;font-size:12px;">Sist aktiv: ${esc(lastStr)}</span></td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(t.events_7d || 0)} / ${Number(t.events_total || 0)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(t.feedback_count || 0)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(t.jobs_count || 0)}</td>
        </tr>`;
      })
      .join("");

    const tableHtml =
      testers.length === 0
        ? `<p>Ingen aktive prototype-testere ennå.</p>`
        : `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">
             <thead><tr style="text-align:left;color:#666;">
               <th style="padding:8px;">Tester</th>
               <th style="padding:8px;">Status</th>
               <th style="padding:8px;text-align:center;">Hendelser 7d/totalt</th>
               <th style="padding:8px;text-align:center;">Feedback</th>
               <th style="padding:8px;text-align:center;">Oppdrag</th>
             </tr></thead><tbody>${rowsHtml}</tbody></table>`;

    const subject = `Prototype-testere — fremdriftsrapport (${testers.length} aktive)`;
    const { html, text } = composeEmail({
      category: "general",
      brand: "creatorhub",
      subject,
      headline: "Prototype-testere — fremdrift",
      subhead: "Creatorhub",
      body: "Her er statusen på de aktive prototype-testerne. Du kan endre mottaker eller slå av rapporten i admin-dashbordet (Redigeringspartnere → Prototype-testere).",
      bodyHtml: tableHtml,
      footer: {
        reason:
          "Du mottar denne fordi du er satt som mottaker av prototype-rapporten. Endre mottaker eller skru av i admin-dashbordet.",
      },
    });
    return { testerCount: testers.length, html, text, subject };
  };

  const sendReport = async (
    sentBy: string | null,
  ): Promise<{ sent: boolean; recipient: string; testerCount: number; skipped?: string }> => {
    const settings = await getSettings();
    if (!settings.enabled) {
      return { sent: false, recipient: settings.recipientEmail, testerCount: 0, skipped: "disabled" };
    }
    const report = await buildReport();
    await sendTransactionalEmail({
      to: settings.recipientEmail,
      subject: report.subject,
      html: report.html,
      text: report.text,
      fromLabel: "Creatorhub",
      kind: "prototype_tester_report",
      sentByUserId: sentBy,
      pool,
    });
    return { sent: true, recipient: settings.recipientEmail, testerCount: report.testerCount };
  };

  // ─── GET innstillinger (admin) ──────────────────────────────────
  app.get("/api/superadmin/prototype-report/settings", async (req, res) => {
    if (!adminFromReq(req)) return res.status(403).json({ error: "Admin-tilgang kreves" });
    try {
      res.json(await getSettings());
    } catch (e) {
      console.error("[prototype-report:get]", e);
      res.status(500).json({ error: "failed" });
    }
  });

  // ─── PUT innstillinger (admin) — endre mottaker / på-av ──────────
  app.put("/api/superadmin/prototype-report/settings", async (req, res) => {
    const admin = adminFromReq(req);
    if (!admin) return res.status(403).json({ error: "Admin-tilgang kreves" });
    try {
      await ensureSettings();
      const body = (req.body || {}) as Record<string, unknown>;
      const email = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
      const enabled = body.enabled === undefined ? null : !!body.enabled;
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: "Ugyldig e-postadresse" });
      }
      await pool.query(
        `UPDATE prototype_report_settings
            SET recipient_email = COALESCE($1, recipient_email),
                enabled = COALESCE($2, enabled),
                updated_at = now(), updated_by = $3
          WHERE id = 1`,
        [email || null, enabled, admin.userId],
      );
      res.json(await getSettings());
    } catch (e) {
      console.error("[prototype-report:put]", e);
      res.status(500).json({ error: "failed" });
    }
  });

  // ─── POST «Send nå» (admin) ─────────────────────────────────────
  app.post("/api/superadmin/prototype-report/send-now", async (req, res) => {
    const admin = adminFromReq(req);
    if (!admin) return res.status(403).json({ error: "Admin-tilgang kreves" });
    try {
      res.json(await sendReport(admin.userId));
    } catch (e) {
      console.error("[prototype-report:send-now]", e);
      res.status(500).json({ error: "failed" });
    }
  });

  // ─── POST cron (dual-auth: cron-token ELLER admin) ──────────────
  app.post("/api/cron/prototype-tester-report", async (req, res) => {
    const cronToken = req.headers["x-cron-trigger-token"] as string | undefined;
    const expected = process.env.CRON_TRIGGER_TOKEN;
    const viaToken = !!expected && !!cronToken && cronToken === expected;
    if (!viaToken && !adminFromReq(req)) return res.status(403).json({ error: "Ikke autorisert" });
    try {
      res.json(await sendReport(null));
    } catch (e) {
      console.error("[prototype-report:cron]", e);
      res.status(500).json({ error: "failed" });
    }
  });
}

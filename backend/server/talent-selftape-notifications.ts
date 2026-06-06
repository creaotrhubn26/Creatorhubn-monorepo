/**
 * talent-selftape-notifications.ts
 *
 * Fase E av Self-Tape Studio — varsler via Resend e-post når en
 * casting-aktør ser eller shortlister en self-tape.
 *
 * Designprinsipper:
 *  - Best-effort: feiler ALDRI hovedflyten (view-tracking / status-endring)
 *  - Idempotent per (submission_id, event_type) — vi sender bare første
 *    `viewed` + første `shortlisted` per submission. Re-views sender ikke.
 *  - Norsk innhold. Lenker tilbake til /talents/profil (Mine delte self-tapes)
 *    så talenten kan se detaljer eller revoke direkte.
 *  - Logger til transactional_email_log via sendTransactionalEmail
 *  - Hopper over hvis talenten har skrudd av varsler (`talents.metadata.notify_selftape = false`)
 *
 * Wired inn fra:
 *  - POST /casting-roles/selftapes/submissions/:id/view  → varsler 'viewed'
 *  - PATCH /submissions/:id  ved status='shortlisted'    → varsler 'shortlisted'
 */

import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service.js";

export type SelftapeNotificationKind = "viewed" | "shortlisted";

interface TalentRow {
  display_name: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
}

interface ContextRow {
  submission_id: string;
  selftape_project_name: string | null;
  take_number: number | null;
  target_type: "agency_direct" | "private_link" | "role_specific" | string;
  agency_name: string | null;
  casting_project_name: string | null;
  casting_role_name: string | null;
  view_count: number;
  talent: TalentRow;
}

/**
 * Hovedinngang. Kalles fra route-handler etter at view/status-endring er
 * skrevet til DB. Async men awaited ikke (eller `void`-d) av hovedflyt.
 */
export async function notifySelftapeActivity(
  pool: Pool,
  args: {
    submissionId: string;
    kind: SelftapeNotificationKind;
    /** Hvem som utløste eventet (e-post eller "Produksjon"-label) */
    actorLabel?: string | null;
  },
): Promise<void> {
  try {
    const ctx = await loadContext(pool, args.submissionId);
    if (!ctx) return;

    // Idempotens: sjekk om vi allerede har sendt denne typen for denne submission
    const dup = await pool.query(
      `SELECT 1 FROM talent_selftape_submission_events
        WHERE submission_id = $1::uuid
          AND event_type = $2
          AND details ? 'notification_sent_at'
        LIMIT 1`,
      [args.submissionId, args.kind],
    );
    if (dup.rowCount) return;

    // Sjekk talent-preferanse
    if (talentOptedOut(ctx.talent)) return;
    if (!ctx.talent.email) return;

    const subject = buildSubject(ctx, args.kind);
    const { html, text } = buildBody(ctx, args.kind, args.actorLabel ?? null);

    const result = await sendTransactionalEmail({
      to: ctx.talent.email,
      subject,
      html,
      text,
      fromLabel: "The Role Room",
      kind: `selftape_${args.kind}`,
      pool,
    });

    // Marker som sendt så vi ikke duplicate-sender ved fremtidige visninger
    if (result.sent) {
      await pool.query(
        `INSERT INTO talent_selftape_submission_events
           (submission_id, event_type, actor_label, details)
         VALUES ($1::uuid, $2, 'notification', $3::jsonb)`,
        [
          args.submissionId,
          args.kind,
          JSON.stringify({
            notification_sent_at: new Date().toISOString(),
            provider: result.provider,
            message_id: result.messageId,
            actor: args.actorLabel ?? null,
          }),
        ],
      );
    } else if (result.reason && result.reason !== "missing_email_config") {
      // Logg svikt slik at retry-jobb kan plukke opp senere (Fase E+)
      console.warn(
        `[selftape-notify] submission=${args.submissionId} kind=${args.kind} reason=${result.reason} err=${result.errorMessage ?? "?"}`,
      );
    }
  } catch (err) {
    // BEST-EFFORT — aldri kaskader feil
    console.error("[selftape-notify] failed", err);
  }
}

async function loadContext(pool: Pool, submissionId: string): Promise<ContextRow | null> {
  const r = await pool.query(
    `SELECT s.id::text                AS submission_id,
            s.target_type,
            s.view_count,
            p.name                     AS selftape_project_name,
            t.take_number,
            a.name                     AS agency_name,
            cp.name                    AS casting_project_name,
            cr.name                    AS casting_role_name,
            tl.display_name            AS talent_display_name,
            u.email                    AS talent_email,
            tl.metadata                AS talent_metadata
       FROM talent_selftape_submissions s
       JOIN talent_selftape_projects p   ON p.id = s.project_id
       JOIN talents tl                   ON tl.id = p.talent_id
       LEFT JOIN users u                 ON u.id = tl.user_id
       LEFT JOIN talent_selftape_takes t ON t.id = s.take_id
       LEFT JOIN agency_orgs a           ON a.id = s.agency_org_id
       LEFT JOIN casting_projects cp     ON cp.id = s.casting_project_id
       LEFT JOIN casting_roles cr        ON cr.id = s.casting_role_id
      WHERE s.id = $1::uuid
      LIMIT 1`,
    [submissionId],
  );
  if (!r.rowCount) return null;
  const row = r.rows[0];
  return {
    submission_id: row.submission_id,
    selftape_project_name: row.selftape_project_name,
    take_number: row.take_number,
    target_type: row.target_type,
    agency_name: row.agency_name,
    casting_project_name: row.casting_project_name,
    casting_role_name: row.casting_role_name,
    view_count: row.view_count ?? 0,
    talent: {
      display_name: row.talent_display_name,
      email: row.talent_email,
      metadata: row.talent_metadata ?? null,
    },
  };
}

function talentOptedOut(talent: TalentRow): boolean {
  const meta = talent.metadata;
  if (!meta || typeof meta !== "object") return false;
  // Talenten kan sette flag i ProfilePage (kommer i Fase E+); inntil videre:
  if ((meta as { notify_selftape?: boolean }).notify_selftape === false) return true;
  if ((meta as { notifications?: { selftape?: boolean } }).notifications?.selftape === false) return true;
  return false;
}

function targetLabel(ctx: ContextRow): string {
  if (ctx.target_type === "agency_direct") return ctx.agency_name ?? "byrået";
  if (ctx.target_type === "private_link") return "din private lenke";
  return ctx.casting_project_name
    ? `${ctx.casting_project_name}${ctx.casting_role_name ? ` (${ctx.casting_role_name})` : ""}`
    : "rollen";
}

function buildSubject(ctx: ContextRow, kind: SelftapeNotificationKind): string {
  const target = targetLabel(ctx);
  if (kind === "viewed") {
    return `${target} har sett self-tapen din 🎬`;
  }
  return `Du er shortlistet for ${target} ⭐`;
}

function buildBody(
  ctx: ContextRow,
  kind: SelftapeNotificationKind,
  actor: string | null,
): { html: string; text: string } {
  const firstName = (ctx.talent.display_name ?? "").split(" ")[0] || "Hei";
  const target = targetLabel(ctx);
  const takeLabel = ctx.take_number ? `Take ${ctx.take_number}` : "Self-tapen";
  const projectName = ctx.selftape_project_name ?? "self-tape-prosjektet";

  const baseUrl = process.env.ROLE_ROOM_PUBLIC_URL
    ?? process.env.PUBLIC_BASE_URL
    ?? "https://theroleroom.com";
  const sharedLink = `${baseUrl}/talents/profil#mine-delte`;

  const isShortlisted = kind === "shortlisted";
  const headline = isShortlisted
    ? "Gratulerer — du er shortlistet"
    : "Self-tapen din er sett";
  const intro = isShortlisted
    ? `Veldig fin nyhet, ${firstName}! ${target} har plassert deg på shortlisten etter å ha sett ${takeLabel.toLowerCase()} fra <strong>${escapeHtml(projectName)}</strong>.`
    : `${firstName} — ${target}${actor ? ` (${escapeHtml(actor)})` : ""} har nettopp sett ${takeLabel.toLowerCase()} fra <strong>${escapeHtml(projectName)}</strong>.`;

  const ctaLabel = isShortlisted ? "Se aktiviteten" : "Se hele oversikten";

  const html = [
    `<!doctype html>`,
    `<html><body style="margin:0;padding:0;background:#0a0118;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0118;padding:32px 16px;">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#150b2e;border:1px solid rgba(168,85,247,0.18);border-radius:14px;overflow:hidden;">`,
    `<tr><td style="padding:32px 32px 8px;">`,
    `<div style="display:inline-block;background:linear-gradient(135deg,#a855f7 0%,#d946ef 100%);color:#fff;font-weight:700;font-size:12px;letter-spacing:0.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:16px;">${isShortlisted ? "Shortlistet" : "Sett"}</div>`,
    `<h1 style="color:#f5f3ff;font-size:22px;line-height:1.25;margin:0 0 12px;">${escapeHtml(headline)}</h1>`,
    `<p style="color:#c4b5fd;font-size:15px;line-height:1.55;margin:0 0 20px;">${intro}</p>`,
    `<a href="${sharedLink}" style="display:inline-block;background:linear-gradient(135deg,#a855f7 0%,#d946ef 100%);color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;box-shadow:0 4px 14px rgba(168,85,247,0.38);">${escapeHtml(ctaLabel)}</a>`,
    `</td></tr>`,
    `<tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(168,85,247,0.10);">`,
    `<p style="color:#8b7ec4;font-size:12px;line-height:1.5;margin:0;">Du kan til enhver tid trekke tilbake tilgangen fra <a href="${sharedLink}" style="color:#c084fc;">Mine delte self-tapes</a> i profilen din. Disse varslene kan slås av i innstillinger.</p>`,
    `</td></tr></table>`,
    `</td></tr></table>`,
    `</body></html>`,
  ].join("\n");

  const text = [
    headline,
    "",
    isShortlisted
      ? `${firstName}! ${target} har plassert deg på shortlisten etter å ha sett ${takeLabel.toLowerCase()} fra "${projectName}".`
      : `${firstName} — ${target}${actor ? ` (${actor})` : ""} har sett ${takeLabel.toLowerCase()} fra "${projectName}".`,
    "",
    `${ctaLabel}: ${sharedLink}`,
    "",
    "Du kan trekke tilbake tilgangen fra Mine delte self-tapes i profilen.",
  ].join("\n");

  return { html, text };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

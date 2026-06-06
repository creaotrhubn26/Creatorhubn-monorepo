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
import { composeEmail, type EmailCategory } from "./email-design-system.js";

export type SelftapeNotificationKind = "viewed" | "shortlisted" | "reminder_to_upload";

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

    // Idempotens: sjekk om vi allerede har sendt denne typen for denne submission.
    // For reminder: 1 påminnelse per 24h (ikke per submission lifetime).
    const idempotencyWindow = args.kind === "reminder_to_upload"
      ? "AND created_at > now() - INTERVAL '24 hours'"
      : "";
    const dup = await pool.query(
      `SELECT 1 FROM talent_selftape_submission_events
        WHERE submission_id = $1::uuid
          AND event_type = $2
          AND details ? 'notification_sent_at'
          ${idempotencyWindow}
        LIMIT 1`,
      [args.submissionId, args.kind],
    );
    if (dup.rowCount) return;

    // Sjekk talent-preferanse
    if (talentOptedOut(ctx.talent)) return;
    if (!ctx.talent.email) return;

    const subject = buildSubject(ctx, args.kind);
    const composed = buildComposed(ctx, args.kind, args.actorLabel ?? null);

    const result = await sendTransactionalEmail({
      to: ctx.talent.email,
      subject,
      html: composed.html,
      text: composed.text,
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
    return `${target} har sett self-tapen din`;
  }
  if (kind === "reminder_to_upload") {
    return `Påminnelse: last opp self-tape for ${target}`;
  }
  return `Du er shortlistet for ${target}`;
}

function buildComposed(
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
  const uploadLink = `${baseUrl}/talents/self-tapes`;

  const isShortlisted = kind === "shortlisted";
  const isReminder = kind === "reminder_to_upload";

  const category: EmailCategory = isShortlisted
    ? "shortlisted"
    : isReminder
      ? "reminder"
      : "viewed";

  const headline = isShortlisted
    ? "Gratulerer — du er shortlistet"
    : isReminder
      ? `Vi venter på din self-tape for ${target}`
      : "Self-tapen din er sett";

  const subhead = isShortlisted
    ? `Veldig fin nyhet, ${firstName}! ${target} har plassert deg på shortlisten etter å ha sett ${takeLabel.toLowerCase()} fra "${projectName}".`
    : isReminder
      ? `${firstName} — produksjonsteamet for "${projectName}" venter på at du laster opp en self-tape.${actor ? ` (Sendt av ${actor})` : ""}`
      : `${firstName} — ${target}${actor ? ` (${actor})` : ""} har nettopp sett ${takeLabel.toLowerCase()} fra "${projectName}".`;

  const ctaLabel = isReminder
    ? "Last opp self-tape"
    : isShortlisted ? "Se aktiviteten" : "Se hele oversikten";
  const ctaHref = isReminder ? uploadLink : sharedLink;

  return composeEmail({
    category,
    subject: headline,
    preheader: subhead.slice(0, 140),
    headline,
    subhead,
    cta: { label: ctaLabel, href: ctaHref },
    footer: {
      reason: "Du kan trekke tilbake tilgangen fra Mine delte self-tapes i profilen. Varslene kan slås av i innstillinger.",
      preferencesUrl: `${baseUrl}/talents/innstillinger`,
    },
  });
}

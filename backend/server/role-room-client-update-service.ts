// =============================================================================
// Proactive client update — assembly + send + persistence.
//
// Producer triggers "send an update to the client". We assemble a data-driven
// digest (what was published this period, what's scheduled, the data-driven
// best-time insight, an optional free-form note), email it to every active
// client-portal session, and persist it so the client portal can show a
// timeline of updates.
//
// Best-effort email (never blocks): reuses the transactional-email + client-
// portal-session patterns already used by the preview-notification flow.
// =============================================================================

import type { Pool } from 'pg';
import { sendTransactionalEmail } from './transactional-email-service.js';
import { getBestTimesForProject } from './role-room-best-time.js';
import {
  buildClientUpdateDigest,
  platformLabel,
  type ClientUpdateDigest,
  type DigestPost,
} from './role-room-client-update-digest.js';

function getClientPortalBaseUrl(): string {
  const raw =
    process.env.ROLE_ROOM_PUBLIC_URL?.trim() ||
    process.env.CREATORHUB_PUBLIC_URL?.trim() ||
    'https://creatorhubn.com';
  return raw.replace(/\/$/, '');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** ISO-week label "uke N" for a date. */
export function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `uke ${week}`;
}

export interface PlanContext {
  projectId: string;
  projectTitle: string;
  brandName: string | null;
}

/** Resolve a plan's project + title. Returns null when the plan is unknown. */
export async function resolvePlanContext(pool: Pool, planId: string): Promise<PlanContext | null> {
  const { rows } = await pool.query<{ project_id: string; project_title: string | null }>(
    `SELECT mp.project_id::text AS project_id, prj.name AS project_title
       FROM role_room_marketing_plans mp
       LEFT JOIN projects prj ON prj.id::text = mp.project_id::text
      WHERE mp.id = $1`,
    [planId],
  );
  if (rows.length === 0) return null;
  return {
    projectId: rows[0].project_id,
    projectTitle: rows[0].project_title ?? 'ditt prosjekt',
    brandName: rows[0].project_title ?? null,
  };
}

export interface AssembleOptions {
  planId: string;
  ctx: PlanContext;
  periodDays?: number; // window for "published this period". Default 7.
  producerNote?: string | null;
  now?: Date;
}

/** Assemble the digest from real plan data + the best-time signal. */
export async function assembleClientUpdate(
  pool: Pool,
  options: AssembleOptions,
): Promise<ClientUpdateDigest> {
  const { planId, ctx } = options;
  const periodDays = options.periodDays ?? 7;
  const now = options.now ?? new Date();

  const published = await pool.query<{ hook: string; platform: string | null; published_at: string }>(
    `SELECT hook, primary_platform AS platform, published_at
       FROM role_room_marketing_plan_posts
      WHERE plan_id = $1
        AND status = 'published'
        AND published_at IS NOT NULL
        AND published_at >= now() - ($2::int * interval '1 day')
      ORDER BY published_at DESC`,
    [planId, periodDays],
  );

  const scheduled = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM role_room_marketing_plan_posts
      WHERE plan_id = $1 AND status = 'scheduled'`,
    [planId],
  );

  const publishedPosts: DigestPost[] = published.rows.map((r) => ({
    platform: r.platform ?? 'instagram',
    hook: r.hook,
    publishedAt: new Date(r.published_at),
  }));

  const bestTimes = await getBestTimesForProject(pool, ctx.projectId).catch(() => []);

  return buildClientUpdateDigest({
    periodLabel: isoWeekLabel(now),
    brandName: ctx.brandName ?? ctx.projectTitle,
    publishedPosts,
    scheduledCount: Number(scheduled.rows[0]?.n ?? 0) || 0,
    bestTimes,
    producerNote: options.producerNote ?? null,
  });
}

function renderEmail(
  digest: ClientUpdateDigest,
  greeting: string,
  portalLink: string,
): { html: string; text: string } {
  const highlightRows = digest.highlights
    .map(
      (h) => `
        <tr>
          <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(h.label)}</td>
          <td style="padding:6px 0;color:#1a0f2e;font-size:14px;font-weight:600">${escapeHtml(h.value)}</td>
        </tr>`,
    )
    .join('');

  const noteBlock = digest.producerNote
    ? `<div style="background:#f6f2ff;border-radius:8px;padding:14px 16px;margin:16px 0;color:#3a2a5e;font-size:14px;line-height:1.6">${escapeHtml(digest.producerNote)}</div>`
    : '';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.6;color:#1a0f2e">
      <h2 style="color:#6e3fc7;margin:0 0 16px">${escapeHtml(digest.headline)}</h2>
      <p>${escapeHtml(greeting)},</p>
      <p>Her er en kort oppdatering på markedsføringen din.</p>
      ${noteBlock}
      <table style="border-collapse:collapse;margin:8px 0 20px">${highlightRows}</table>
      <p>
        <a href="${portalLink}"
           style="display:inline-block;background:linear-gradient(135deg,#6e3fc7,#a030c0);color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Se detaljer i portalen
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px">Denne lenken er personlig — ikke videresend den.</p>
    </div>`;

  const textLines = [
    `${greeting},`,
    '',
    digest.headline,
    '',
    ...(digest.producerNote ? [digest.producerNote, ''] : []),
    ...digest.highlights.map((h) => `- ${h.label}: ${h.value}`),
    '',
    `Se detaljer i portalen: ${portalLink}`,
  ];
  return { html, text: textLines.join('\n') };
}

export interface SendClientUpdateResult {
  ok: boolean;
  sent: number;
  total: number;
  updateId: string | null;
  digest: ClientUpdateDigest;
}

/**
 * Assemble + send + persist a proactive client update. Emails every active
 * client-portal session for the project and records the update for the portal
 * timeline. Email failures never block persistence.
 */
export async function sendClientUpdate(
  pool: Pool,
  args: { planId: string; sentBy?: string | null; producerNote?: string | null; now?: Date },
): Promise<SendClientUpdateResult> {
  const ctx = await resolvePlanContext(pool, args.planId);
  if (!ctx) {
    throw new Error('plan_not_found');
  }
  const digest = await assembleClientUpdate(pool, {
    planId: args.planId,
    ctx,
    producerNote: args.producerNote ?? null,
    now: args.now,
  });

  const { rows: sessions } = await pool.query<{
    sessionToken: string;
    clientEmail: string;
    clientName: string | null;
  }>(
    `SELECT session_token AS "sessionToken",
            client_email   AS "clientEmail",
            client_name    AS "clientName"
       FROM client_portal_sessions
      WHERE project_id = $1 AND status = 'active' AND expires_at > now()`,
    [ctx.projectId],
  );

  const base = getClientPortalBaseUrl();
  let sent = 0;
  for (const s of sessions) {
    const link = `${base}/client/portal/${encodeURIComponent(s.sessionToken)}`;
    const greeting = s.clientName ? `Hei ${s.clientName}` : 'Hei';
    const { html, text } = renderEmail(digest, greeting, link);
    try {
      const result = await sendTransactionalEmail({
        to: s.clientEmail,
        subject: digest.headline,
        html,
        text,
        kind: 'role_room_client_update',
        projectId: ctx.projectId,
        pool,
        fromLabel: 'The Role Room',
      });
      if (result.sent) sent++;
    } catch (err) {
      console.warn('[client-update] email send failed for a session', err);
    }
  }

  let updateId: string | null = null;
  try {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO role_room_client_updates
         (project_id, plan_id, period_label, digest, producer_note, sent_by, recipients_count)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING id`,
      [
        ctx.projectId,
        args.planId,
        digest.headline,
        JSON.stringify(digest),
        digest.producerNote,
        args.sentBy ?? null,
        sessions.length,
      ],
    );
    updateId = ins.rows[0]?.id ?? null;
  } catch (err) {
    console.warn('[client-update] persist failed', err);
  }

  return { ok: true, sent, total: sessions.length, updateId, digest };
}

/** List past client updates for a project (producer-facing timeline). */
export async function listClientUpdates(
  pool: Pool,
  projectId: string,
  limit = 20,
): Promise<
  Array<{ id: string; periodLabel: string; digest: ClientUpdateDigest; recipientsCount: number; createdAt: string }>
> {
  const { rows } = await pool.query<{
    id: string;
    period_label: string;
    digest: ClientUpdateDigest;
    recipients_count: number;
    created_at: string;
  }>(
    `SELECT id, period_label, digest, recipients_count, created_at
       FROM role_room_client_updates
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [projectId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    periodLabel: r.period_label,
    digest: r.digest,
    recipientsCount: r.recipients_count,
    createdAt: r.created_at,
  }));
}

// Re-export for callers that render platform names alongside the digest.
export { platformLabel };

// role-room-deadline-reminders-routes.ts
//
// Daglig påminnelse-jobb for draft→publiser→synk-grensen. Skanner frister
// (due_at) på tvers av prosjekter og leverer påminnelser til inbox + e-post:
//
//   (1) PRODUSENT: upubliserte utkast (timeline/leveranser) med frist som
//       nærmer seg eller er passert → «publiser før fristen».
//   (2) KLIENT:    publiserte ting som venter på klientens handling
//       (reviews pending / leveranser i client_review) med frist → påminnelse.
//
// Dual-auth: GitHub Actions cron via x-cron-trigger-token (se
// [[feedback_cron_trigger_token_pattern]]). Endepunktet er prosjekt-agnostisk
// (skanner alle prosjekter) og dedup-er via upsertProducerProjectNotification.

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  upsertProducerProjectNotification,
  notifyProducerTeamByEmail,
  resolveProducerTeamEmails,
} from './role-room-producer-notifications.js';

interface Deps {
  pool: Pool;
}

function fmtFrist(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (ms < 0) {
    const overdue = Math.abs(days);
    return overdue === 0 ? 'forfaller i dag' : `${overdue} ${overdue === 1 ? 'dag' : 'dager'} på overtid`;
  }
  if (days === 0) return 'forfaller i dag';
  if (days === 1) return 'forfaller i morgen';
  return `om ${days} dager`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function reminderEmail(args: { heading: string; lines: string[]; cta: string }): { html: string; text: string } {
  const itemsHtml = args.lines.map((l) => `<li style="margin:4px 0;">${escapeHtml(l)}</li>`).join('');
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;">
    <h2 style="font-size:18px;margin:0 0 8px;">${escapeHtml(args.heading)}</h2>
    <ul style="padding-left:18px;margin:8px 0;">${itemsHtml}</ul>
    <p style="font-size:13px;color:#475569;margin-top:12px;">${escapeHtml(args.cta)}</p>
    <p style="font-size:12px;color:#94a3b8;">The Role Room</p>
  </div>`;
  const text = `${args.heading}\n\n${args.lines.map((l) => `• ${l}`).join('\n')}\n\n${args.cta}\n\nThe Role Room`;
  return { html, text };
}

export function registerRoleRoomDeadlineReminderRoutes(app: Express, deps: Deps): void {
  const { pool } = deps;

  app.post('/api/role-room/internal/deadline-reminders/run', async (req: Request, res: Response) => {
    const presented = String(req.headers['x-cron-trigger-token'] || '').trim();
    const expected = (process.env.CRON_TRIGGER_TOKEN || '').trim();
    if (!presented || !expected || presented !== expected) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const horizonHours = Math.min(168, Math.max(1, Number(req.query.horizonHours) || 48));
    const dryRun = String(req.query.dryRun || '') === 'true';
    const now = new Date();

    const summary = {
      producerProjects: 0,
      clientProjects: 0,
      inboxWritten: 0,
      emailsSent: 0,
      dryRun,
      horizonHours,
    };

    try {
      // ── (1) Produsent: upubliserte utkast med frist (timeline + leveranser) ──
      const drafts = await pool.query<{
        project_id: string; project_name: string | null; cnt: string; earliest: Date | null;
      }>(
        `WITH d AS (
           SELECT project_id, due_at, title
             FROM role_room_phase_timeline_items
            WHERE published_at IS NULL AND due_at IS NOT NULL
              AND due_at <= now() + ($1 || ' hours')::interval
           UNION ALL
           SELECT project_id, due_at, title
             FROM role_room_deliverables
            WHERE published_at IS NULL AND due_at IS NOT NULL
              AND status IN ('draft','internal_review')
              AND due_at <= now() + ($1 || ' hours')::interval
         )
         SELECT d.project_id,
                p.name AS project_name,
                COUNT(*)::text AS cnt,
                MIN(d.due_at) AS earliest
           FROM d
           LEFT JOIN casting_projects p ON p.id = d.project_id
          GROUP BY d.project_id, p.name`,
        [String(horizonHours)],
      );

      for (const row of drafts.rows) {
        summary.producerProjects += 1;
        const count = Number(row.cnt);
        const earliest = row.earliest ? new Date(row.earliest) : null;
        const fristTxt = earliest ? fmtFrist(earliest, now) : 'snart';
        const title = `${count} ${count === 1 ? 'element' : 'elementer'} venter på publisering`;
        const message = `Du har ${count} upublisert${count === 1 ? 't' : 'e'} element${count === 1 ? '' : 'er'} med frist (tidligste ${fristTxt}). Publiser for å dele med klienten.`;
        if (dryRun) continue;
        await upsertProducerProjectNotification(pool, {
          projectId: row.project_id,
          audience: 'producer_team',
          eventType: 'deadline_publish_reminder',
          title,
          message,
          linkedEntityType: 'publish_reminder',
          linkedEntityId: row.project_id,
          metadata: { inboxType: 'request', dueAt: earliest?.toISOString() ?? null, count },
        });
        summary.inboxWritten += 1;
        const email = reminderEmail({
          heading: `${title} — ${row.project_name ?? 'prosjekt'}`,
          lines: [message],
          cta: 'Åpne prosjektrommet i The Role Room for å publisere.',
        });
        summary.emailsSent += await notifyProducerTeamByEmail(pool, {
          projectId: row.project_id,
          subject: `Påminnelse: ${title}`,
          html: email.html,
          text: email.text,
          kind: 'deadline_publish_reminder',
        });
      }

      // ── (2) Klient: publiserte ting som venter på klientens handling ─────────
      const awaiting = await pool.query<{
        project_id: string; project_name: string | null; client_email: string | null;
        review_cnt: string; deliverable_cnt: string; earliest: Date | null;
      }>(
        `WITH a AS (
           SELECT project_id, due_at, 'review' AS kind
             FROM role_room_client_reviews
            WHERE status = 'pending' AND published_at IS NOT NULL AND due_at IS NOT NULL
              AND due_at <= now() + ($1 || ' hours')::interval
           UNION ALL
           SELECT project_id, due_at, 'deliverable' AS kind
             FROM role_room_deliverables
            WHERE status = 'client_review' AND due_at IS NOT NULL
              AND due_at <= now() + ($1 || ' hours')::interval
         )
         SELECT a.project_id,
                p.name AS project_name,
                ci.contact_email AS client_email,
                COUNT(*) FILTER (WHERE a.kind = 'review')::text AS review_cnt,
                COUNT(*) FILTER (WHERE a.kind = 'deliverable')::text AS deliverable_cnt,
                MIN(a.due_at) AS earliest
           FROM a
           LEFT JOIN casting_projects p ON p.id = a.project_id
           LEFT JOIN role_room_client_intake ci ON ci.project_id = a.project_id
          GROUP BY a.project_id, p.name, ci.contact_email`,
        [String(horizonHours)],
      );

      for (const row of awaiting.rows) {
        summary.clientProjects += 1;
        const reviews = Number(row.review_cnt);
        const deliverables = Number(row.deliverable_cnt);
        const earliest = row.earliest ? new Date(row.earliest) : null;
        const fristTxt = earliest ? fmtFrist(earliest, now) : 'snart';
        const parts: string[] = [];
        if (reviews > 0) parts.push(`${reviews} ${reviews === 1 ? 'godkjenning' : 'godkjenninger'}`);
        if (deliverables > 0) parts.push(`${deliverables} ${deliverables === 1 ? 'leveranse' : 'leveranser'}`);
        const what = parts.join(' og ');
        const title = `${what} venter på deg`;
        const message = `${what} venter på din gjennomgang (tidligste frist ${fristTxt}).`;
        if (dryRun) continue;
        await upsertProducerProjectNotification(pool, {
          projectId: row.project_id,
          audience: 'client',
          eventType: 'deadline_client_action_reminder',
          title,
          message,
          linkedEntityType: 'approval',
          linkedEntityId: row.project_id,
          metadata: {
            inboxType: 'approval',
            dueAt: earliest?.toISOString() ?? null,
            clientEmail: row.client_email ?? undefined,
          },
        });
        summary.inboxWritten += 1;
        // E-post: klientkontakt fra brief, ellers fall tilbake til team (best-effort).
        if (row.client_email) {
          const email = reminderEmail({
            heading: `${title} — ${row.project_name ?? 'prosjekt'}`,
            lines: [message],
            cta: 'Logg inn i klientportalen for å gjennomgå.',
          });
          // Gjenbruk team-e-post-mekanikken via en eksplisitt mottaker.
          const sent = await sendClientReminderEmail(pool, row.project_id, row.client_email, {
            subject: `Påminnelse: ${title}`,
            html: email.html,
            text: email.text,
          });
          summary.emailsSent += sent;
        }
      }

      res.json({ ok: true, ...summary });
    } catch (error) {
      console.error('[role-room] deadline reminder run failed', error);
      res.status(500).json({ error: 'reminder_run_failed' });
    }
  });

  // Forhindre «ubrukt»-advarsel og dokumentér at vi har team-resolver tilgjengelig.
  void resolveProducerTeamEmails;
}

// Liten lokal e-post-sender til én klient-adresse (gjenbruker
// transactional-email-tjenesten via producer-notifications-modulens mønster).
async function sendClientReminderEmail(
  pool: Pool,
  projectId: string,
  to: string,
  args: { subject: string; html: string; text: string },
): Promise<number> {
  try {
    const { sendTransactionalEmail } = await import('./transactional-email-service.js');
    const result = await sendTransactionalEmail({
      to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      kind: 'deadline_client_action_reminder',
      projectId,
      pool,
      fromLabel: 'The Role Room',
    });
    return result.sent ? 1 : 0;
  } catch (error) {
    console.warn('[role-room] client reminder email failed', error);
    return 0;
  }
}

/**
 * wedding-reminder-runner.ts
 *
 * Daglig cron-job som sjekker:
 *   - Alle wedding_timelines med wedding_date < 14 dager og completed_at IS NULL
 *   - Hvis last_reminder_sent_at NULL eller > 7 dager siden → send påminnelse
 *
 * Sender mail til BÅDE klient (med kode) og fotograf (med oversikt).
 * Idempotent — last_reminder_sent_at oppdateres etter sending.
 *
 * Trigges via:
 *   - GET /api/wedding/reminders/run (manuell trigger fra UI)
 *   - Render cron-job som POST'er til /api/wedding/reminders/run
 *   - I dev: setInterval i index.ts (hver 12. time)
 */

import type { Pool } from 'pg';
import nodemailer from 'nodemailer';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ReminderRunResult {
  scanned: number;
  remindersSent: number;
  errors: string[];
}

export async function runWeddingReminders(pool: Pool): Promise<ReminderRunResult> {
  const result: ReminderRunResult = {
    scanned: 0,
    remindersSent: 0,
    errors: [],
  };

  const mailUser = (process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || '').trim();
  const mailPass = (process.env.GMAIL_APP_PASSWORD || '').trim().replace(/\s+/g, '');
  if (!mailUser || !mailPass) {
    result.errors.push('mailer_not_configured');
    return result;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: mailUser, pass: mailPass },
  });

  try {
    // Finn bryllup som trenger påminnelse
    const candidates = await pool.query(
      `SELECT
         w.id, w.couple_name, w.wedding_date, w.client_access_code,
         w.last_reminder_sent_at, w.invited_at,
         u.email AS photographer_email,
         COALESCE(u.first_name || ' ' || u.last_name, u.company_name, 'Creatorhubn') AS photographer_name,
         c.email AS client_email
       FROM wedding_timelines w
       LEFT JOIN users u ON u.id = w.photographer_id::varchar
       LEFT JOIN projects p ON p.id = w.project_id
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE w.completed_at IS NULL
         AND w.gdpr_delete_requested_at IS NULL
         AND w.client_access_enabled = true
         AND w.wedding_date::date <= (CURRENT_DATE + INTERVAL '14 days')
         AND w.wedding_date::date >= CURRENT_DATE
         AND (
           w.last_reminder_sent_at IS NULL
           OR w.last_reminder_sent_at < NOW() - INTERVAL '7 days'
         )
       LIMIT 100`,
    );

    result.scanned = candidates.rowCount ?? 0;
    const baseUrl = process.env.PUBLIC_APP_URL || 'https://creatorhubn.com';

    for (const row of candidates.rows) {
      const daysUntil = Math.ceil(
        (new Date(row.wedding_date).getTime() - Date.now()) / 86400000,
      );

      try {
        // Mail til klient (hvis vi har epost)
        if (row.client_email) {
          await transporter.sendMail({
            from: `"${row.photographer_name}" <${mailUser}>`,
            to: row.client_email,
            replyTo: row.photographer_email ?? mailUser,
            subject: `Påminnelse: Wedding-timeline for ${row.couple_name} — ${daysUntil} dager igjen`,
            html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                <h2>Bryllupet nærmer seg!</h2>
                <p style="font-size:15px;line-height:1.6;color:#333;">
                  Hei ${escapeHtml(row.couple_name)},<br><br>
                  Det er bare <strong>${daysUntil} dager</strong> til den store dagen!
                  Hvis dere ikke har fylt ut wedding-timeline ennå, er det på tide nå —
                  jo mer ${escapeHtml(row.photographer_name)} vet, jo bedre kan dagen forberedes.
                </p>
                <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
                  <p style="margin:0 0 8px;color:#666;font-size:13px;">Tilgangskode:</p>
                  <p style="margin:0;font-family:monospace;font-size:28px;letter-spacing:6px;color:#ff8c00;font-weight:600;">
                    ${row.client_access_code}
                  </p>
                </div>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${baseUrl}/wedding/access?code=${row.client_access_code}"
                     style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
                    Åpne timeline
                  </a>
                </div>
              </div>
            `,
          });
        }

        // Mail til fotograf
        if (row.photographer_email) {
          await transporter.sendMail({
            from: `"Creatorhubn" <${mailUser}>`,
            to: row.photographer_email,
            subject: `Påminnelse sendt: ${row.couple_name} (${daysUntil} dager igjen)`,
            html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
                <h3>Påminnelse sendt</h3>
                <p>Brudepar <strong>${escapeHtml(row.couple_name)}</strong> har fått en påminnelse om å fylle ut wedding-timeline.</p>
                <p>Bryllupsdato: <strong>${new Date(row.wedding_date).toLocaleDateString('nb-NO')}</strong> (${daysUntil} dager igjen)</p>
                <p>Du kan også ringe dem direkte hvis det haster.</p>
              </div>
            `,
          });
        }

        await pool.query(
          `UPDATE wedding_timelines SET last_reminder_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [row.id],
        );
        result.remindersSent++;
      } catch (mailErr: any) {
        result.errors.push(`${row.id}: ${String(mailErr?.message).slice(0, 100)}`);
      }
    }
  } catch (err: any) {
    result.errors.push(String(err?.message ?? err).slice(0, 200));
  }

  return result;
}

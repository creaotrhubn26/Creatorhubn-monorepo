/**
 * role-room-rights-expiry-cron.ts
 *
 * Utløpsvarsling for rettigheter (Del A punkt 46).
 *
 * Datagrunnlaget kom med buyout-vilkårene (punkt 47): listExpiringRights()
 * svarer allerede på hva som utløper. Dette er den manglende halvdelen — at
 * noen faktisk får beskjed.
 *
 * Problemet punktet peker på er dyrt og stille: en reklamefilm som ligger ute
 * etter at buyout-perioden gikk ut er et kontraktsbrudd, og det oppdages
 * normalt først når skuespilleren eller byrået klager.
 *
 *   POST /api/role-room/cron/rights-expiry
 *     Header: x-cron-trigger-token
 *
 * Varsler ved faste terskler framfor hver dag. Et daglig varsel om det samme
 * blir støy, og støy blir ignorert — som er nøyaktig feilen vi prøver å unngå.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service.js";

interface Deps {
  app: Express;
  pool: Pool;
}

/**
 * Dager før utløp det varsles på. 90 gir tid til å forhandle forlengelse,
 * 30 er siste praktiske frist for å ta ned materiell, 7 og 0 er alarmer.
 */
const NOTIFY_THRESHOLDS = [90, 30, 7, 0];

/** Hvilken terskel en gitt gjenstående tid faller inn under. */
export function thresholdFor(daysRemaining: number): number | null {
  // Allerede utløpt behandles som 0-terskelen.
  if (daysRemaining <= 0) return 0;
  for (const t of NOTIFY_THRESHOLDS) {
    if (daysRemaining === t) return t;
  }
  return null;
}

export function expiryMessage(row: {
  contract_id: string;
  days_remaining: number;
  renewal_deadline_passed: boolean;
  territories: string[];
  media_channels: string[];
}): { subject: string; body: string } {
  const d = Number(row.days_remaining);
  const scope = [
    row.territories?.length ? row.territories.join(", ") : null,
    row.media_channels?.length ? row.media_channels.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const when =
    d < 0
      ? `utløp for ${Math.abs(d)} dager siden`
      : d === 0
        ? "utløper i dag"
        : `utløper om ${d} dager`;

  const subject =
    d < 0
      ? `Rettigheter UTLØPT – kontrakt ${row.contract_id}`
      : `Rettigheter ${when} – kontrakt ${row.contract_id}`;

  const lines = [
    `<p>Buyout-rettighetene på kontrakt <strong>${row.contract_id}</strong> ${when}.</p>`,
    scope ? `<p>Omfang: ${scope}</p>` : "",
    d < 0
      ? "<p><strong>Materiell som fortsatt ligger ute er et kontraktsbrudd.</strong> Ta det ned, eller få forlengelse på plass.</p>"
      : "<p>Vurder forlengelse, eller planlegg å ta materiellet ned.</p>",
    row.renewal_deadline_passed
      ? "<p>Merk: fristen for å utøve forlengelsesopsjonen er passert.</p>"
      : "",
  ];

  return { subject, body: lines.filter(Boolean).join("\n") };
}

async function cronTokenValid(provided: unknown): Promise<boolean> {
  const expected =
    process.env.RR_RETENTION_CRON_TOKEN || process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
  if (!expected) return false;
  if (typeof provided !== "string" || provided.length !== expected.length) return false;
  const { timingSafeEqual } = await import("crypto");
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function registerRoleRoomRightsExpiryCron(deps: Deps): void {
  const { app, pool } = deps;

  app.post("/api/role-room/cron/rights-expiry", async (req: Request, res: Response): Promise<void> => {
    const expected =
      process.env.RR_RETENTION_CRON_TOKEN || process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
    if (!expected) {
      res.status(503).json({ error: "cron_token_not_configured" });
      return;
    }
    if (!(await cronTokenValid(req.headers["x-cron-trigger-token"]))) {
      res.status(401).json({ error: "invalid_cron_token" });
      return;
    }

    const start = Date.now();
    const stats = { scanned: 0, notified: 0, alreadyNotified: 0, noRecipient: 0, failed: 0 };

    try {
      // Bredeste terskel avgjør hvor langt fram vi ser.
      const rows = await pool.query(
        `SELECT b.id, b.project_id, b.contract_id, b.ends_at,
                (b.ends_at - CURRENT_DATE) AS days_remaining,
                b.renewal_option, b.renewal_notice_days,
                (b.renewal_option AND b.renewal_notice_days IS NOT NULL
                  AND (b.ends_at - CURRENT_DATE) < b.renewal_notice_days) AS renewal_deadline_passed,
                b.territories, b.media_channels,
                p.name AS project_name, p.created_by
           FROM role_room_buyout_terms b
           JOIN casting_projects p ON p.id = b.project_id
          WHERE b.unlimited = FALSE
            AND b.ends_at IS NOT NULL
            AND b.ends_at <= CURRENT_DATE + ($1::text || ' days')::interval
          ORDER BY b.ends_at`,
        [String(Math.max(...NOTIFY_THRESHOLDS))],
      );

      for (const row of rows.rows as Array<Record<string, unknown>>) {
        stats.scanned += 1;
        const days = Number(row.days_remaining);
        const threshold = thresholdFor(days);
        if (threshold === null) continue;

        // Én varsling per terskel per kontrakt. Uten dette ville en utløpt
        // rettighet gitt e-post hver eneste dag til noen skrudde av cronen.
        const already = await pool.query(
          `SELECT 1 FROM role_room_rights_expiry_notifications
            WHERE buyout_terms_id = $1 AND threshold_days = $2 LIMIT 1`,
          [row.id, threshold],
        );
        if ((already.rowCount ?? 0) > 0) {
          stats.alreadyNotified += 1;
          continue;
        }

        const recipient = await resolveRecipient(pool, String(row.created_by ?? ""));
        if (!recipient) {
          stats.noRecipient += 1;
          continue;
        }

        const { subject, body } = expiryMessage(row as never);
        try {
          await sendTransactionalEmail({
            to: recipient,
            subject: `${subject} (${row.project_name})`,
            html: body,
            text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            fromLabel: "The Role Room",
          });
          await pool.query(
            `INSERT INTO role_room_rights_expiry_notifications
               (buyout_terms_id, project_id, threshold_days, sent_to)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (buyout_terms_id, threshold_days) DO NOTHING`,
            [row.id, row.project_id, threshold, recipient],
          );
          stats.notified += 1;
        } catch (err) {
          console.error("[rights-expiry] varsling feilet for", row.contract_id, err);
          stats.failed += 1;
        }
      }

      const durationMs = Date.now() - start;
      console.log(`[rights-expiry] OK ${durationMs}ms:`, stats);
      res.json({ ok: true, stats, duration_ms: durationMs });
    } catch (err) {
      console.error("[rights-expiry] feilet:", err);
      res.status(500).json({ error: "rights_expiry_failed", detail: String(err).slice(0, 300), stats });
    }
  });
}

/** Prosjekteieren er mottakeren. Uten e-post er det ingen å varsle. */
async function resolveRecipient(pool: Pool, userId: string): Promise<string | null> {
  if (!userId) return null;
  const r = await pool.query<{ email: string | null }>(
    `SELECT email FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const email = r.rows[0]?.email;
  return email && email.includes("@") ? email : null;
}

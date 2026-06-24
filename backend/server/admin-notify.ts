/**
 * admin-notify.ts — én delt mekanisme for "admin skal ALLTID få beskjed" om
 * innkommende hendelser (leads, søknader, bookinger, signups …), MED full
 * attribusjon: hvor det kom fra (kilde) og hvilken CTA/kampanje/side.
 *
 * To kanaler, begge best-effort (en feil her skal ALDRI velte selve
 * innsendingen — kall fire-and-forget med `void`):
 *   1. E-post til alle super_admins (når de ikke er innlogget).
 *   2. En rad i `admin_inbound_alerts` — admin-varsel-innboksen + datakilden for
 *      CRM-oversikten (IKKE `admin_notifications`, som er kringkasting TIL
 *      brukere). Leses av GET /api/admin/inbound-alerts.
 *
 * Wiring: kall `notifyAdmins(pool, event)` rett etter at en ny innkommende rad
 * er opprettet — eller la capture-middleware (admin-inbound-capture.ts) gjøre
 * det sentralt for alle registrerte innkommende ruter.
 */
import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service";

export type AdminInboundEvent = {
  /** Maskin-lesbar kategori, f.eks. "editing_partner_application", "lead". */
  type: string;
  /**
   * Menneske-lesbar KILDE — hvor hendelsen kom fra. MÅ alltid stå tydelig.
   * F.eks. "Editing-marketplace · partner-skjema", "theroleroom.com · /for-byraer".
   */
  source: string;
  /** Kort tittel — del av e-post-emne + varsel-tittel. */
  title: string;
  /** Detalj-linje (selskap, kontakt, land, beløp …). */
  summary?: string;
  /** Hvilken CTA/knapp utløste innsendingen (f.eks. "Book demo", "Bli partner"). */
  cta?: string | null;
  /** Siden/URL-en innsendingen kom fra (page eller Referer). */
  page?: string | null;
  /** UTM-attribusjon: { source, medium, campaign, content, term }. */
  utm?: Record<string, string> | null;
  /** Admin-dyplenke (default /admin). */
  link?: string;
  /** Kilde-radens id, for sporing/dedup. */
  relatedId?: string | null;
};

const ADMIN_BASE = process.env.CREATORHUB_PUBLIC_URL ?? "https://creatorhubn.com";

let alertsTableReady: Promise<void> | null = null;
function ensureAlertsTable(pool: Pool): Promise<void> {
  if (!alertsTableReady) {
    alertsTableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS admin_inbound_alerts (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type        TEXT NOT NULL,
          source      TEXT NOT NULL DEFAULT 'ukjent',
          title       TEXT NOT NULL,
          summary     TEXT,
          cta         TEXT,
          page        TEXT,
          utm         JSONB,
          link        TEXT,
          related_id  TEXT,
          read_at     TIMESTAMPTZ,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(async () => {
        // Idempotente kolonne-tillegg for eldre tabeller.
        for (const col of [
          "source TEXT NOT NULL DEFAULT 'ukjent'",
          "cta TEXT",
          "page TEXT",
          "utm JSONB",
        ]) {
          await pool
            .query(`ALTER TABLE admin_inbound_alerts ADD COLUMN IF NOT EXISTS ${col}`)
            .catch(() => undefined);
        }
        await pool
          .query(
            `CREATE INDEX IF NOT EXISTS idx_admin_inbound_alerts_unread
               ON admin_inbound_alerts (created_at DESC) WHERE read_at IS NULL`,
          )
          .catch(() => undefined);
      })
      .catch((err) => {
        console.warn("[admin-notify] kunne ikke sikre admin_inbound_alerts:", err);
        alertsTableReady = null;
      });
  }
  return alertsTableReady ?? Promise.resolve();
}

/**
 * Varsle alle super_admins om en innkommende hendelse. Best-effort på begge
 * kanaler; logger og svelger feil slik at kallstedet aldri feiler.
 */
export async function notifyAdmins(pool: Pool, event: AdminInboundEvent): Promise<void> {
  const link = event.link
    ? event.link.startsWith("http")
      ? event.link
      : `${ADMIN_BASE}${event.link}`
    : `${ADMIN_BASE}/admin`;

  // 1) In-app varsel-innboks (= CRM-oversiktens datakilde)
  try {
    await ensureAlertsTable(pool);
    await pool.query(
      `INSERT INTO admin_inbound_alerts (type, source, title, summary, cta, page, utm, link, related_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        event.type,
        event.source,
        event.title,
        event.summary ?? null,
        event.cta ?? null,
        event.page ?? null,
        event.utm ? JSON.stringify(event.utm) : null,
        link,
        event.relatedId ?? null,
      ],
    );
  } catch (err) {
    console.error("[admin-notify] in-app insert feilet:", err);
  }

  // 2) E-post til alle super_admins — KILDE + CTA tydelig i emne og body.
  try {
    const admins = await pool.query<{ email: string }>(
      `SELECT email FROM users WHERE role = 'super_admin' AND email IS NOT NULL`,
    );
    const ctaLine = event.cta ? `CTA: ${event.cta}` : "";
    const utmLine = event.utm
      ? `Kampanje: ${[event.utm.campaign, event.utm.source, event.utm.medium].filter(Boolean).join(" / ")}`
      : "";
    const metaHtml = [
      `<strong>Kilde:</strong> ${event.source}`,
      event.cta ? `<strong>CTA:</strong> ${event.cta}` : "",
      event.page ? `<strong>Side:</strong> ${event.page}` : "",
      utmLine ? `<strong>${utmLine}</strong>` : "",
    ]
      .filter(Boolean)
      .join("<br/>");
    const metaText = [`Kilde: ${event.source}`, ctaLine, event.page ? `Side: ${event.page}` : "", utmLine]
      .filter(Boolean)
      .join("\n");
    for (const a of admins.rows) {
      try {
        await sendTransactionalEmail({
          to: a.email,
          subject: `[${event.source}] ${event.title}`,
          html:
            `<p><strong>${event.title}</strong></p>` +
            (event.summary ? `<p>${event.summary}</p>` : "") +
            `<p>${metaHtml}</p>` +
            `<p><a href="${link}">Åpne i admin</a></p>`,
          text: `${event.title}\n${event.summary ?? ""}\n${metaText}\nÅpne i admin: ${link}`,
          kind: "admin_inbound_notify",
          pool,
        });
      } catch (err) {
        console.error("[admin-notify] e-post feilet:", err);
      }
    }
  } catch (err) {
    console.error("[admin-notify] super_admin-oppslag feilet:", err);
  }
}

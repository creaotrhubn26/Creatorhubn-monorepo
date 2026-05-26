/**
 * tester-enterprise-offer-routes.ts — Slice 9X.57
 *
 * Team-prototype-testere som fullfører programmet får tilbud om Enterprise:
 *   - 3 mnd gratis (Stripe trial_period_days)
 *   - 25 % rabatt i 12 mnd etter trial (Stripe coupon, auto-opprettet)
 *   - Pris-grunnlag: eksisterende Enterprise-plan
 *     (CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE)
 *
 * Trigger: setInterval ved oppstart + hver time finner team-master-invites
 * med (program_ends_at - 14 dager < NOW) AND no existing offer.
 *
 * Endpoints:
 *   GET    /api/tester-enterprise-offer/me           — innlogget master ser sitt aktive offer
 *   POST   /api/tester-enterprise-offer/:id/checkout — start Stripe Checkout
 *   POST   /api/tester-enterprise-offer/:id/decline  — registrer avslag
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";
import type Stripe from "stripe";
import nodemailer from "nodemailer";

export interface TesterEnterpriseOfferDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: any;
  getPricingUserId: (req: any) => string;
  /** Resolver for å hente Stripe-klient + Enterprise-price-ID. */
  stripeClient: Stripe | null;
  enterprisePriceIdMonthly: string | null;
  enterprisePriceIdYearly: string | null;
}

const OFFER_TRIGGER_DAYS_BEFORE_END = 14;
const OFFER_VALID_DAYS = 30; // Etter offer opprettes — har 30 dager å akseptere
const FREE_MONTHS = 3;
const DISCOUNT_PCT = 25;
const DISCOUNT_MONTHS = 12;
const COUPON_ID = "TESTER_TEAM_25OFF_12M";

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tester_enterprise_offers (
      id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tester_master_invite_id     UUID NOT NULL,
      team_size_at_offer          INTEGER NOT NULL,
      free_months                 INTEGER NOT NULL DEFAULT 3,
      discount_pct_after_free     INTEGER NOT NULL DEFAULT 25,
      discount_months_after_free  INTEGER NOT NULL DEFAULT 12,
      status                      VARCHAR(20) NOT NULL DEFAULT 'sent',
      sent_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at                  TIMESTAMPTZ NOT NULL,
      accepted_at                 TIMESTAMPTZ,
      declined_at                 TIMESTAMPTZ,
      stripe_checkout_session_id  TEXT,
      stripe_subscription_id      TEXT,
      stripe_customer_id          TEXT,
      email_sent_at               TIMESTAMPTZ,
      reminder_sent_at            TIMESTAMPTZ,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => undefined);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tester_enterprise_offers_master
       ON tester_enterprise_offers (tester_master_invite_id)`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_tester_enterprise_offers_status
       ON tester_enterprise_offers (status, expires_at)`,
  ).catch(() => undefined);
}

function getMailer(): nodemailer.Transporter | null {
  const mailUser = (process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "").trim();
  const mailPass = (process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
  if (!mailUser || !mailPass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user: mailUser, pass: mailPass } });
}

/**
 * Oppretter eller henter en cache-bar Stripe-coupon for 25 % i 12 mnd.
 */
async function ensureDiscountCoupon(stripe: Stripe): Promise<string> {
  try {
    await stripe.coupons.retrieve(COUPON_ID);
    return COUPON_ID;
  } catch {
    // Finnes ikke — opprett
    try {
      await stripe.coupons.create({
        id: COUPON_ID,
        percent_off: DISCOUNT_PCT,
        duration: "repeating",
        duration_in_months: DISCOUNT_MONTHS,
        name: "Tester-team rabatt (25 % i 12 mnd etter 3 mnd gratis)",
      });
      return COUPON_ID;
    } catch (err) {
      console.error("[tester-enterprise] Couldn't create coupon:", err);
      throw err;
    }
  }
}

/**
 * Kjøres ved oppstart + hver time. Finner team-mastere som nærmer seg
 * program-slutt og oppretter offer hvis det ikke finnes ett alt.
 */
export async function runOfferCreationSweep(pool: any): Promise<{ created: number; errors: number }> {
  await ensureSchema(pool);
  const triggerThreshold = `${OFFER_TRIGGER_DAYS_BEFORE_END} days`;
  let created = 0;
  let errors = 0;
  try {
    const masters = await pool.query(
      `SELECT ti.id, ti.email, ti.name, ti.max_team_size, ti.program_ends_at
         FROM prototype_tester_invites ti
         LEFT JOIN tester_enterprise_offers off
           ON off.tester_master_invite_id = ti.id
        WHERE ti.team_role = 'master'
          AND ti.status = 'accepted'
          AND ti.program_ends_at > NOW()
          AND ti.program_ends_at < (NOW() + INTERVAL '${triggerThreshold}')
          AND off.id IS NULL`,
    );
    const expiresAt = new Date(Date.now() + OFFER_VALID_DAYS * 24 * 3600 * 1000);
    const mailer = getMailer();

    for (const m of masters.rows) {
      try {
        const ins = await pool.query(
          `INSERT INTO tester_enterprise_offers
             (tester_master_invite_id, team_size_at_offer, free_months,
              discount_pct_after_free, discount_months_after_free, expires_at, email_sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [m.id, m.max_team_size, FREE_MONTHS, DISCOUNT_PCT, DISCOUNT_MONTHS, expiresAt, mailer ? new Date() : null],
        );
        created++;

        // Send e-post (best effort)
        if (mailer) {
          const mailUser = process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "";
          const offerLink = `https://creatorhubn.com/tester-enterprise-offer/${ins.rows[0].id}`;
          mailer.sendMail({
            from: `"Creatorhubn" <${mailUser}>`,
            to: m.email,
            subject: "Vi vil ha teamet ditt videre på Enterprise — 3 mnd gratis",
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
                <h2 style="margin:0 0 16px;">Hei ${m.name},</h2>
                <p style="line-height:1.6;">
                  Tester-programmet ditt for <b>${m.max_team_size} personer</b> nærmer seg slutten
                  (${new Date(m.program_ends_at).toLocaleDateString("nb-NO")}). Vi har sett at teamet
                  ditt har brukt plattformen aktivt og vil gjerne ha dere videre.
                </p>
                <p style="line-height:1.6;"><b>Vårt tilbud:</b></p>
                <ul style="line-height:1.8;">
                  <li><b>3 måneder gratis Enterprise</b> for hele teamet</li>
                  <li>Deretter <b>25 % rabatt</b> på Enterprise-prisen i <b>12 måneder</b></li>
                  <li>Beholder alle features dere har testet</li>
                  <li>Alt fakturert i NOK inkl. mva</li>
                </ul>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${offerLink}" style="display:inline-block;background:#ffba6c;color:#150d05;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:700;">
                    Se tilbudet og fortsett til betaling
                  </a>
                </div>
                <p style="font-size:13px;color:#666;line-height:1.5;">
                  Tilbudet gjelder i ${OFFER_VALID_DAYS} dager. Etter det fortsetter teamet
                  uten Enterprise-tilgang (men beholder kontoer på Basic-tier).
                </p>
              </div>`,
          }).catch((err) => console.error("[tester-enterprise] mail failed:", err?.message || err));
        }
      } catch (err) {
        console.error("[tester-enterprise] failed to create offer for", m.id, err);
        errors++;
      }
    }
  } catch (err) {
    console.error("[tester-enterprise] sweep failed:", err);
  }
  return { created, errors };
}

export function setupTesterEnterpriseOfferRoutes(deps: TesterEnterpriseOfferDeps): void {
  const { app, requireUserSession, pool, getPricingUserId, stripeClient, enterprisePriceIdMonthly } = deps;

  // ─── GET /api/tester-enterprise-offer/me ────────────────────
  app.get("/api/tester-enterprise-offer/me", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.json({ offer: null });
      await ensureSchema(pool);
      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (userR.rowCount === 0) return res.json({ offer: null });
      const email = String(userR.rows[0].email).toLowerCase();

      const r = await pool.query(
        `SELECT off.*, ti.email AS master_email, ti.name AS master_name, ti.program_ends_at
           FROM tester_enterprise_offers off
           JOIN prototype_tester_invites ti ON ti.id = off.tester_master_invite_id
          WHERE LOWER(ti.email) = $1
            AND off.status = 'sent'
            AND off.expires_at > NOW()
          ORDER BY off.sent_at DESC LIMIT 1`,
        [email],
      );
      if (r.rowCount === 0) return res.json({ offer: null });
      const row = r.rows[0];
      res.json({
        offer: {
          id: row.id,
          teamSize: row.team_size_at_offer,
          freeMonths: row.free_months,
          discountPct: row.discount_pct_after_free,
          discountMonths: row.discount_months_after_free,
          expiresAt: row.expires_at,
          programEndsAt: row.program_ends_at,
        },
      });
    } catch (err) {
      console.error("GET /tester-enterprise-offer/me:", err);
      res.json({ offer: null });
    }
  });

  // ─── POST /api/tester-enterprise-offer/:id/checkout ─────────
  app.post("/api/tester-enterprise-offer/:id/checkout", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      if (!stripeClient || !enterprisePriceIdMonthly) {
        return res.status(503).json({
          error: "Stripe Enterprise er ikke konfigurert (mangler CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE)",
        });
      }
      await ensureSchema(pool);

      const offerR = await pool.query(
        `SELECT off.*, ti.email AS master_email, ti.name AS master_name
           FROM tester_enterprise_offers off
           JOIN prototype_tester_invites ti ON ti.id = off.tester_master_invite_id
          WHERE off.id = $1 AND off.status = 'sent' AND off.expires_at > NOW()
          LIMIT 1`,
        [req.params.id],
      );
      if (offerR.rowCount === 0) return res.status(404).json({ error: "Tilbud ikke funnet eller utløpt" });
      const offer = offerR.rows[0];

      // Sjekk at innlogget bruker faktisk er masteren
      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (userR.rowCount === 0 || String(userR.rows[0].email).toLowerCase() !== String(offer.master_email).toLowerCase()) {
        return res.status(403).json({ error: "Du er ikke master for dette tilbudet" });
      }

      // Sørg for at rabatt-coupon-en finnes
      const couponId = await ensureDiscountCoupon(stripeClient);

      const baseUrl = req.headers.origin || `https://${req.headers.host || "creatorhubn.com"}`;
      const session = await stripeClient.checkout.sessions.create({
        mode: "subscription",
        success_url: `${baseUrl}/tester-enterprise-offer/${offer.id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/tester-enterprise-offer/${offer.id}`,
        customer_email: offer.master_email,
        billing_address_collection: "auto",
        allow_promotion_codes: false,
        locale: "nb",
        client_reference_id: `tester_enterprise_offer:${offer.id}`,
        line_items: [
          {
            quantity: offer.team_size_at_offer,
            price: enterprisePriceIdMonthly,
          },
        ],
        subscription_data: {
          trial_period_days: offer.free_months * 30, // 3 mnd ≈ 90 dager
          metadata: {
            tester_enterprise_offer_id: String(offer.id),
            tester_team_size: String(offer.team_size_at_offer),
            origin: "tester_program_conversion",
          },
        },
        discounts: [{ coupon: couponId }],
        metadata: {
          tester_enterprise_offer_id: String(offer.id),
        },
      });

      // Lagre session-ID slik at webhook kan koble seg på
      await pool.query(
        `UPDATE tester_enterprise_offers SET stripe_checkout_session_id = $1, updated_at = NOW() WHERE id = $2`,
        [session.id, offer.id],
      );

      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error("POST /tester-enterprise-offer/:id/checkout:", err);
      res.status(500).json({ error: err?.message || "Kunne ikke opprette Stripe Checkout" });
    }
  });

  // ─── POST /api/tester-enterprise-offer/:id/decline ──────────
  app.post("/api/tester-enterprise-offer/:id/decline", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      await ensureSchema(pool);
      const r = await pool.query(
        `UPDATE tester_enterprise_offers
           SET status = 'declined', declined_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'sent'
        RETURNING id`,
        [req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Tilbud ikke funnet" });
      res.json({ success: true });
    } catch (err) {
      console.error("POST /tester-enterprise-offer/:id/decline:", err);
      res.status(500).json({ error: "Kunne ikke registrere avslag" });
    }
  });
}

/**
 * Webhook-handler: kalles fra hovedrouter når Stripe sender
 * checkout.session.completed med client_reference_id som matcher
 * tester_enterprise_offer:<id>-mønsteret.
 */
export async function handleTesterEnterpriseOfferWebhook(
  pool: any,
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  try {
    const ref = String(session.client_reference_id || "");
    const match = ref.match(/^tester_enterprise_offer:(.+)$/);
    if (!match) return false;
    const offerId = match[1];
    await ensureSchema(pool);
    await pool.query(
      `UPDATE tester_enterprise_offers
         SET status = 'accepted',
             accepted_at = NOW(),
             stripe_subscription_id = $1,
             stripe_customer_id = $2,
             updated_at = NOW()
        WHERE id = $3 AND status = 'sent'`,
      [
        String(session.subscription || ""),
        String(session.customer || ""),
        offerId,
      ],
    );
    console.log(`[tester-enterprise] Offer ${offerId} accepted via Stripe webhook`);
    return true;
  } catch (err) {
    console.error("[tester-enterprise] webhook failed:", err);
    return false;
  }
}

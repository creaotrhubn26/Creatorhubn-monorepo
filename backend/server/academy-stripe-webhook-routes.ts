// Academy Stripe webhook-handler.
//
// Lytter på Stripe Connect-events relevante for Academy-payouts og
// synker dem tilbake til DB:
//
//   account.updated      → sync instructor.payouts_enabled +
//                          requirements.currently_due + onboarding_status
//   transfer.created     → academy_transfers status 'pending' → 'in_transit'
//   transfer.updated     → samme (oppdater metadata). Stripe markerer
//                          transfer.reversed=true når midler reverseres
//                          → vi flagger status='reversed' + reverser
//                          academy_payouts (paid → approved).
//   transfer.reversed    → academy_transfers status 'reversed' + reverser
//                          academy_payouts.
//   payout.paid          → fra Connect-konto (instructor); marker
//                          academy_transfers 'paid' når payout-id matcher
//                          source_transaction el. metadata.
//   payout.failed        → academy_transfers 'failed' + reverser payout.
//   charge.refunded      → academy_refunds-rad + marker enrollment
//                          'refunded'. Hvis transfer er gjort, flagg
//                          clawback (manuell reversal-handling).
//
// Webhook-events dedupliseres via academy_stripe_webhook_events.
// Signaturer verifiseres mot STRIPE_ACADEMY_WEBHOOK_SECRET (eller den
// generelle CREATORHUB_STRIPE_WEBHOOK_SECRET hvis academy-specific
// ikke er satt).
//
// I dev (NODE_ENV !== 'production') tillates webhook uten signatur for
// e2e-testing — da parses body som JSON direkte.
//
// Wires fra index.ts:
//   setupAcademyStripeWebhookRoutes({ app, pool });
//
// Endpoint:
//   POST /api/webhooks/stripe/academy

import express from "express";
import type { Pool } from "pg";
import Stripe from "stripe";

export interface AcademyStripeWebhookRoutesDeps {
  app: express.Application;
  pool: Pool;
}

let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.CREATORHUB_STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key.trim());
  return stripeClient;
}

function getAcademyWebhookSecret(): string | null {
  const key =
    process.env.STRIPE_ACADEMY_WEBHOOK_SECRET ||
    process.env.CREATORHUB_STRIPE_WEBHOOK_SECRET;
  return key && key.trim().length > 0 ? key.trim() : null;
}

function isUndefinedTableError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: string }).code === "42P01";
  }
  return false;
}

export function setupAcademyStripeWebhookRoutes(
  deps: AcademyStripeWebhookRoutesDeps,
): void {
  const { app, pool } = deps;

  app.post(
    "/api/webhooks/stripe/academy",
    // Stripe krever raw body for signaturverifisering. Hvis en annen
    // body-parser har konsumert body før denne handleren, vil
    // constructEvent feile — derfor scoped raw-parser pr. route.
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      const stripe = getStripeClient();
      const webhookSecret = getAcademyWebhookSecret();
      const signatureHeader = req.headers["stripe-signature"];
      const rawBody = req.body as Buffer;

      let event: Stripe.Event;
      try {
        if (stripe && webhookSecret) {
          if (typeof signatureHeader !== "string" || !signatureHeader.trim()) {
            return res
              .status(400)
              .json({ error: "missing_stripe_signature_header" });
          }
          event = stripe.webhooks.constructEvent(
            rawBody,
            signatureHeader,
            webhookSecret,
          );
        } else if (process.env.NODE_ENV === "production") {
          // Produksjon krever signatur — feil hardt.
          return res.status(503).json({
            error: "academy_webhook_secret_missing",
            message:
              "STRIPE_ACADEMY_WEBHOOK_SECRET må være satt i produksjon",
          });
        } else {
          // Dev / e2e: parse uten signatur.
          event = JSON.parse(rawBody.toString("utf8")) as Stripe.Event;
        }
      } catch (err) {
        console.error(
          "[academy-stripe-webhook] signature verification failed:",
          err,
        );
        return res.status(400).json({ error: "webhook_signature_failed" });
      }

      // Idempotency: dedupliser via academy_stripe_webhook_events.
      try {
        const dup = await pool.query(
          "SELECT status FROM academy_stripe_webhook_events WHERE stripe_event_id = $1",
          [event.id],
        );
        if ((dup.rowCount ?? 0) > 0) {
          return res.json({
            received: true,
            duplicate: true,
            previousStatus: dup.rows[0]?.status ?? null,
          });
        }
        await pool.query(
          `INSERT INTO academy_stripe_webhook_events
             (stripe_event_id, event_type, status)
           VALUES ($1, $2, 'received')
           ON CONFLICT (stripe_event_id) DO NOTHING`,
          [event.id, event.type],
        );
      } catch (err) {
        if (isUndefinedTableError(err)) {
          console.error(
            "[academy-stripe-webhook] table missing — migrasjon 255 ikke kjørt",
          );
          return res.status(503).json({
            error: "academy_webhook_table_missing",
            message: "Migrasjon 255 må kjøres først",
          });
        }
        console.error("[academy-stripe-webhook] dedup-check failed:", err);
        // Fortsett uansett — bedre å risikere duplikat-prosessering enn å
        // mister event helt. Stripe vil retry'e ellers.
      }

      try {
        switch (event.type) {
          case "account.updated": {
            const account = event.data.object as Stripe.Account;
            const payoutsEnabled = !!account.payouts_enabled;
            const chargesEnabled = !!account.charges_enabled;
            const currentlyDue = (account.requirements?.currently_due ??
              []) as string[];
            const disabled = !!account.requirements?.disabled_reason;
            await pool.query(
              `UPDATE academy_instructors
                  SET payouts_enabled = $2,
                      charges_enabled = $3,
                      requirements_currently_due = $4,
                      onboarding_status =
                        CASE WHEN $2 = TRUE THEN 'enabled'
                             WHEN $5 = TRUE THEN 'restricted'
                             ELSE 'pending'
                        END,
                      onboarding_completed_at = COALESCE(
                        onboarding_completed_at,
                        CASE WHEN $2 = TRUE THEN now() ELSE NULL END
                      )
                WHERE stripe_account_id = $1`,
              [
                account.id,
                payoutsEnabled,
                chargesEnabled,
                currentlyDue,
                disabled,
              ],
            );
            break;
          }

          case "transfer.created": {
            const transfer = event.data.object as Stripe.Transfer;
            await pool.query(
              `UPDATE academy_transfers
                  SET status = CASE WHEN status = 'pending' THEN 'in_transit'
                                    ELSE status END,
                      metadata = metadata || $2::jsonb
                WHERE stripe_transfer_id = $1`,
              [
                transfer.id,
                JSON.stringify({
                  amount: transfer.amount,
                  currency: transfer.currency,
                  updated_at: new Date().toISOString(),
                }),
              ],
            );
            // Marker enrollments som transferred for å speile at midler
            // er flyttet til instructor's Connect-konto.
            await pool.query(
              `UPDATE academy_enrollments
                  SET payout_status = 'transferred'
                WHERE stripe_transfer_id = $1
                  AND payout_status != 'refunded'`,
              [transfer.id],
            );
            break;
          }

          case "transfer.updated": {
            const transfer = event.data.object as Stripe.Transfer;
            // Stripe markerer transfer.reversed=true når midlene reverseres.
            const reversedAmount = transfer.amount_reversed ?? 0;
            const fullyReversed =
              reversedAmount > 0 && reversedAmount >= (transfer.amount ?? 0);
            if (fullyReversed) {
              await pool.query(
                `UPDATE academy_transfers
                    SET status = 'reversed', reversed_at = now()
                  WHERE stripe_transfer_id = $1`,
                [transfer.id],
              );
              // Reverser payout (paid → approved) slik at admin kan
              // håndtere på nytt.
              await pool.query(
                `UPDATE academy_payouts
                    SET status = 'approved', paid_at = NULL
                  WHERE stripe_transfer_id = $1`,
                [transfer.id],
              );
              await pool.query(
                `UPDATE academy_enrollments
                    SET payout_status = 'reversed'
                  WHERE stripe_transfer_id = $1`,
                [transfer.id],
              );
            } else {
              await pool.query(
                `UPDATE academy_transfers
                    SET metadata = metadata || $2::jsonb
                  WHERE stripe_transfer_id = $1`,
                [
                  transfer.id,
                  JSON.stringify({
                    amount_reversed: reversedAmount,
                    updated_at: new Date().toISOString(),
                  }),
                ],
              );
            }
            break;
          }

          case "transfer.reversed": {
            const transfer = event.data.object as Stripe.Transfer;
            await pool.query(
              `UPDATE academy_transfers
                  SET status = 'reversed', reversed_at = now()
                WHERE stripe_transfer_id = $1`,
              [transfer.id],
            );
            await pool.query(
              `UPDATE academy_payouts
                  SET status = 'approved', paid_at = NULL
                WHERE stripe_transfer_id = $1`,
              [transfer.id],
            );
            await pool.query(
              `UPDATE academy_enrollments
                  SET payout_status = 'reversed'
                WHERE stripe_transfer_id = $1`,
              [transfer.id],
            );
            break;
          }

          case "payout.paid": {
            // Connect-konto sin payout fra Stripe-balance → bank. Vi
            // bruker source_transaction-feltet på vår academy_transfers
            // som proxy hvis Stripe har koblet den.
            const payout = event.data.object as Stripe.Payout;
            await pool.query(
              `UPDATE academy_transfers
                  SET status = 'paid', completed_at = now()
                WHERE source_transaction = $1
                   OR stripe_transfer_id = $1`,
              [payout.id],
            );
            break;
          }

          case "payout.failed": {
            const payout = event.data.object as Stripe.Payout & {
              failure_code?: string;
              failure_message?: string;
            };
            await pool.query(
              `UPDATE academy_transfers
                  SET status = 'failed',
                      failure_code = $2,
                      failure_message = $3,
                      completed_at = now()
                WHERE source_transaction = $1
                   OR stripe_transfer_id = $1`,
              [
                payout.id,
                payout.failure_code || "unknown",
                payout.failure_message || "",
              ],
            );
            await pool.query(
              `UPDATE academy_payouts
                  SET status = 'approved', paid_at = NULL
                WHERE stripe_transfer_id IN (
                  SELECT stripe_transfer_id FROM academy_transfers
                   WHERE source_transaction = $1
                )`,
              [payout.id],
            );
            break;
          }

          case "charge.refunded": {
            const charge = event.data.object as Stripe.Charge;
            const refundList = charge.refunds?.data ?? [];
            const refund = refundList[refundList.length - 1];
            if (!refund) break;

            // Slå opp enrollment via charge_id.
            const e = await pool.query<{
              id: string;
              stripe_transfer_id: string | null;
              instructor_revenue_nok: number | null;
              platform_fee_nok: number | null;
              payout_status: string | null;
            }>(
              `SELECT id::text                AS id,
                      stripe_transfer_id      AS stripe_transfer_id,
                      instructor_revenue_nok  AS instructor_revenue_nok,
                      platform_fee_nok        AS platform_fee_nok,
                      payout_status           AS payout_status
                 FROM academy_enrollments
                WHERE stripe_charge_id = $1`,
              [charge.id],
            );
            if ((e.rowCount ?? 0) === 0) break;

            const enrollment = e.rows[0];
            const refundAmountNok = Math.round(refund.amount / 100);
            // Beregn clawback proporsjonalt (vanligvis 80/20 men respekter
            // faktisk revenue-split lagret på enrollment).
            const platformFeeReversed = enrollment.platform_fee_nok
              ? Math.round(
                  (refundAmountNok * enrollment.platform_fee_nok) /
                    Math.max(
                      1,
                      (enrollment.platform_fee_nok ?? 0) +
                        (enrollment.instructor_revenue_nok ?? 0),
                    ),
                )
              : Math.round(refundAmountNok * 0.2);
            const instructorClawback = refundAmountNok - platformFeeReversed;

            // Slå opp evt. transfer som matcher denne enrollment.
            let relatedTransferId: string | null = null;
            if (enrollment.stripe_transfer_id) {
              const tr = await pool.query<{ id: string }>(
                `SELECT id::text AS id FROM academy_transfers
                  WHERE stripe_transfer_id = $1`,
                [enrollment.stripe_transfer_id],
              );
              if ((tr.rowCount ?? 0) > 0) relatedTransferId = tr.rows[0].id;
            }

            await pool.query(
              `INSERT INTO academy_refunds
                 (enrollment_id, stripe_refund_id, stripe_charge_id,
                  amount_refunded_nok, platform_fee_reversed_nok,
                  instructor_clawback_nok, related_transfer_id, reason)
               VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8)
               ON CONFLICT (stripe_refund_id) DO NOTHING`,
              [
                enrollment.id,
                refund.id,
                charge.id,
                refundAmountNok,
                platformFeeReversed,
                instructorClawback,
                relatedTransferId,
                refund.reason || "requested_by_customer",
              ],
            );

            await pool.query(
              `UPDATE academy_enrollments
                  SET status = 'refunded', payout_status = 'refunded'
                WHERE id = $1::uuid`,
              [enrollment.id],
            );
            // TODO: hvis enrollment.payout_status var 'transferred',
            //   kall stripe.transfers.createReversal() for å hente penger
            //   tilbake fra instruktør-konto. Per nå: clawback-beløp er
            //   loggført i academy_refunds.instructor_clawback_nok slik
            //   at admin kan håndtere manuelt.
            break;
          }

          default:
            // Ukjente event-typer: bare logg + marker som processed.
            break;
        }

        await pool.query(
          `UPDATE academy_stripe_webhook_events
              SET status = 'processed', processed_at = now()
            WHERE stripe_event_id = $1`,
          [event.id],
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          "[academy-stripe-webhook] handler error for",
          event.type,
          err,
        );
        try {
          await pool.query(
            `UPDATE academy_stripe_webhook_events
                SET status = 'failed', error_message = $2
              WHERE stripe_event_id = $1`,
            [event.id, message.slice(0, 500)],
          );
        } catch {
          /* ignorer */
        }
        // Returner 500 slik at Stripe retry'er.
        return res.status(500).json({ received: false, error: "handler_failed" });
      }

      return res.json({ received: true });
    },
  );
}

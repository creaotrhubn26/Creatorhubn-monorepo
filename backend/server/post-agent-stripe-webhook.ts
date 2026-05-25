/**
 * Stripe webhook handler for The Role Room Post Agent.
 *
 * Listens for subscription/payment events and keeps the
 * `role_room_agent_entitlements` table in sync, so canceled subscriptions
 * lose AI-proxy access automatically (no waiting for the next entitlement
 * check, no manual cleanup).
 *
 * Mount in index.ts BEFORE express.json() middleware:
 *
 *   app.post(
 *     "/api/post-agent/webhooks/stripe",
 *     express.raw({ type: "application/json" }),
 *     handlePostAgentStripeWebhook(pool),
 *   );
 *
 * Configure in Stripe Dashboard:
 *   Events to send:
 *     - customer.subscription.updated
 *     - customer.subscription.deleted
 *     - invoice.payment_failed
 *   Webhook secret → env var STRIPE_WEBHOOK_SECRET_POST_AGENT
 */

import type { Request, Response } from 'express';
import type { Pool } from 'pg';

interface PostAgentWebhookDeps {
  pool: Pool;
}

/** Returns true if the subscription contains a Post Agent price as a line item. */
function hasPostAgentItem(items: Array<{ price?: { id?: string } }> | undefined): boolean {
  const monthly = process.env.STRIPE_PRICE_POST_AGENT_MONTHLY;
  const yearly = process.env.STRIPE_PRICE_POST_AGENT_YEARLY;
  if (!items) return false;
  return items.some((it) => {
    const id = it?.price?.id;
    return id && (id === monthly || id === yearly);
  });
}

async function findUserIdForCustomer(pool: Pool, customerId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM subscriptions
       WHERE stripe_customer_id = $1
       ORDER BY start_date DESC LIMIT 1`,
      [customerId],
    );
    if (rows[0]?.user_id) return rows[0].user_id;
  } catch {
    // schema may differ; fall through to next strategy
  }
  // Some schemas store the mapping elsewhere — try users table
  try {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE stripe_customer_id = $1 LIMIT 1`,
      [customerId],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function grantPostAgentEntitlement(pool: Pool, userId: string, subscriptionId: string): Promise<void> {
  await pool.query(
    `INSERT INTO role_room_agent_entitlements (user_id, status, source, notes)
     VALUES ($1, 'active', 'plan_pro', $2)
     ON CONFLICT DO NOTHING`,
    [userId, `Post Agent add-on active (sub ${subscriptionId})`],
  );
}

async function revokePostAgentEntitlement(pool: Pool, userId: string, reason: string): Promise<void> {
  await pool.query(
    `UPDATE role_room_agent_entitlements
     SET revoked_at = NOW(), updated_at = NOW(),
         notes = COALESCE(notes, '') || E'\nRevoked: ' || $2
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason],
  );
}

export function handlePostAgentStripeWebhook({ pool }: PostAgentWebhookDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_POST_AGENT;
    if (!stripeSecret) {
      res.status(503).json({ error: 'stripe_not_configured' });
      return;
    }

    const signature = req.headers['stripe-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ''), 'utf8');

    let event: { type: string; data: { object: unknown } };
    try {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(stripeSecret);
      if (webhookSecret) {
        if (typeof signature !== 'string' || !signature.trim()) {
          res.status(400).json({ error: 'missing_signature' });
          return;
        }
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret) as typeof event;
      } else if (process.env.NODE_ENV === 'production') {
        // Refuse to process unverified events in prod
        res.status(503).json({ error: 'webhook_secret_missing' });
        return;
      } else {
        event = JSON.parse(rawBody.toString('utf8')) as typeof event;
      }
    } catch (err) {
      console.error('[post-agent-webhook] signature verification failed:', err);
      res.status(400).json({ error: 'signature_invalid', detail: (err as Error).message });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          // Lazy-onboarding: standalone Post Agent buyers come in via Checkout.
          // Stripe creates the customer + subscription, but our DB has no
          // user↔customer mapping yet. Write that mapping here so subsequent
          // .subscription.updated events can resolve back to our user.
          const sess = event.data.object as {
            id: string;
            mode?: string;
            customer?: string;
            subscription?: string;
            client_reference_id?: string;
            metadata?: Record<string, string>;
          };
          if (sess.mode !== 'subscription' || sess.metadata?.product !== 'post_agent_standalone') {
            // Other checkout flows are handled elsewhere — no-op for us.
            break;
          }
          const userId = sess.client_reference_id || sess.metadata?.role_room_user_id || null;
          const customerId = typeof sess.customer === 'string' ? sess.customer : null;
          const subscriptionId = typeof sess.subscription === 'string' ? sess.subscription : null;
          if (!userId || !customerId || !subscriptionId) {
            console.warn('[post-agent-webhook] checkout.completed missing fields:', {
              hasUserId: !!userId, hasCustomer: !!customerId, hasSub: !!subscriptionId,
            });
            break;
          }
          try {
            // Map user → customer in users table (best-effort).
            await pool.query(
              `UPDATE users SET stripe_customer_id = $1 WHERE id = $2 AND (stripe_customer_id IS NULL OR stripe_customer_id = '')`,
              [customerId, userId],
            );
          } catch (e) {
            console.warn('[post-agent-webhook] users.stripe_customer_id update failed:', (e as Error).message);
          }
          try {
            // Insert subscriptions-row so syncStripeQuantity can find it on next grant.
            await pool.query(
              `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, start_date)
               VALUES ($1, $2, $3, 'active', NOW())
               ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = 'active'`,
              [userId, customerId, subscriptionId],
            );
          } catch (e) {
            console.warn('[post-agent-webhook] subscriptions insert failed:', (e as Error).message);
          }
          await grantPostAgentEntitlement(pool, userId, subscriptionId);
          console.log(`[post-agent-webhook] standalone-checkout completed user=${userId} sub=${subscriptionId}`);
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.created': {
          const sub = event.data.object as {
            id: string;
            customer: string;
            status: string;
            items?: { data?: Array<{ price?: { id?: string } }> };
          };
          const customerId = typeof sub.customer === 'string' ? sub.customer : String(sub.customer);
          const userId = await findUserIdForCustomer(pool, customerId);
          if (!userId) {
            console.warn(`[post-agent-webhook] no user for customer=${customerId}`);
            break;
          }
          const hasItem = hasPostAgentItem(sub.items?.data);
          if (hasItem && (sub.status === 'active' || sub.status === 'trialing')) {
            await grantPostAgentEntitlement(pool, userId, sub.id);
            console.log(`[post-agent-webhook] granted user=${userId} sub=${sub.id} status=${sub.status}`);
          } else if (!hasItem) {
            await revokePostAgentEntitlement(pool, userId, `Post Agent item removed from sub ${sub.id}`);
            console.log(`[post-agent-webhook] revoked (item removed) user=${userId} sub=${sub.id}`);
          } else if (sub.status === 'past_due' || sub.status === 'canceled' || sub.status === 'unpaid') {
            await revokePostAgentEntitlement(pool, userId, `Subscription status=${sub.status}`);
            console.log(`[post-agent-webhook] revoked (sub ${sub.status}) user=${userId} sub=${sub.id}`);
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as { id: string; customer: string };
          const customerId = typeof sub.customer === 'string' ? sub.customer : String(sub.customer);
          const userId = await findUserIdForCustomer(pool, customerId);
          if (userId) {
            await revokePostAgentEntitlement(pool, userId, `Subscription canceled (${sub.id})`);
            console.log(`[post-agent-webhook] revoked (sub canceled) user=${userId} sub=${sub.id}`);
          }
          break;
        }
        case 'invoice.payment_failed': {
          const inv = event.data.object as { customer: string; subscription?: string };
          const customerId = typeof inv.customer === 'string' ? inv.customer : String(inv.customer);
          const userId = await findUserIdForCustomer(pool, customerId);
          if (userId) {
            // Soft-revoke on payment failure — user can re-pay to restore. We
            // don't revoke immediately, just log; Stripe will move the sub to
            // past_due / unpaid which a subsequent .updated event will handle.
            console.log(`[post-agent-webhook] payment failed for user=${userId} sub=${inv.subscription ?? '?'}`);
          }
          break;
        }
        default:
          // Other event types ignored — we only care about the ones above.
          break;
      }
      res.json({ received: true, event_type: event.type });
    } catch (err) {
      console.error('[post-agent-webhook] handler error:', err);
      res.status(500).json({ error: 'handler_failed', detail: (err as Error).message });
    }
  };
}

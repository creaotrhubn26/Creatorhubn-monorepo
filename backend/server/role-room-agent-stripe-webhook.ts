/**
 * Stripe webhook handlers for The Role Room Agent add-on.
 *
 * Identifies events by the `metadata.product = 'role_room_agent'` tag we
 * attach at checkout creation. Events without that tag are ignored so
 * the handler can run alongside existing Role Room / CreatorHub billing
 * handlers without interference.
 *
 * Writes go through role-room-agent-entitlements so the DB invariant
 * (one active entitlement per user) stays intact.
 */

import type { Pool } from 'pg';
import type Stripe from 'stripe';

import {
  grantAddonEntitlement,
} from './role-room-agent-entitlements.js';

const AGENT_PRODUCT_TAG = 'role_room_agent';

function isAgentMetadata(metadata: Record<string, string> | null | undefined): boolean {
  if (!metadata) return false;
  return metadata.product === AGENT_PRODUCT_TAG;
}

function extractUserId(
  metadata: Record<string, string> | null | undefined,
  clientReferenceId: string | null | undefined,
): string | null {
  const meta = metadata ?? {};
  if (typeof meta.role_room_user_id === 'string' && meta.role_room_user_id.trim().length > 0) {
    return meta.role_room_user_id.trim();
  }
  if (typeof clientReferenceId === 'string' && clientReferenceId.trim().length > 0) {
    return clientReferenceId.trim();
  }
  return null;
}

/**
 * `checkout.session.completed` — create / refresh the active entitlement
 * for the user. Idempotent: if called twice with the same subscription
 * ID it just re-inserts over the same logical row (the previous row is
 * revoked_at-marked by grantAddonEntitlement).
 */
export async function handleAgentCheckoutSessionCompleted(
  pool: Pool,
  session: Stripe.Checkout.Session,
): Promise<{ matched: boolean }> {
  if (!isAgentMetadata(session.metadata)) return { matched: false };

  const userId = extractUserId(session.metadata, session.client_reference_id ?? null);
  if (!userId) return { matched: true };

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) return { matched: true };

  const priceId = process.env.STRIPE_ROLE_ROOM_AGENT_PRICE_ID ?? 'unknown';

  try {
    await grantAddonEntitlement(pool, userId, subscriptionId, priceId);
    console.log(
      `[role-room-agent-entitlement] Granted add-on entitlement for user=${userId} subscription=${subscriptionId}`,
    );
  } catch (error) {
    console.error('[role-room-agent-entitlement] checkout grant failed', error);
  }
  return { matched: true };
}

/**
 * `customer.subscription.deleted` or status transitions to a
 * non-allowed state. Revoke the matching entitlement row by
 * stripe_subscription_id.
 */
export async function handleAgentSubscriptionRevoked(
  pool: Pool,
  subscription: Stripe.Subscription | Stripe.Invoice,
  reason: string,
): Promise<{ matched: boolean }> {
  const metadata = (subscription as Stripe.Subscription).metadata
    ?? (subscription as Stripe.Invoice)?.metadata
    ?? undefined;
  const subscriptionId =
    'id' in subscription && typeof subscription.id === 'string'
      ? subscription.id
      : null;

  if (!isAgentMetadata(metadata) && subscriptionId == null) {
    return { matched: false };
  }

  // Even when metadata is missing on deletion events (Stripe sometimes
  // strips it), if we recognize the subscription_id we still revoke.
  if (!subscriptionId) return { matched: isAgentMetadata(metadata) };

  try {
    const result = await pool.query(
      `UPDATE role_room_agent_entitlements
          SET revoked_at = now(),
              status = 'expired',
              notes = COALESCE(notes, '') || E'\nRevoked via Stripe: ' || $2,
              updated_at = now()
        WHERE stripe_subscription_id = $1
          AND revoked_at IS NULL`,
      [subscriptionId, reason],
    );
    if ((result.rowCount ?? 0) > 0) {
      console.log(
        `[role-room-agent-entitlement] Revoked entitlement for subscription=${subscriptionId} reason=${reason}`,
      );
      return { matched: true };
    }
  } catch (error) {
    console.error('[role-room-agent-entitlement] revoke failed', error);
  }
  return { matched: isAgentMetadata(metadata) };
}

/**
 * Handle invoice.payment_failed — downgrade to expired so the agent
 * is temporarily blocked until the customer pays again. Stripe will
 * re-emit subscription.updated when the invoice eventually pays,
 * at which point we would want to grant again; the current add-on
 * flow is simple enough that we just let the user re-checkout if
 * they want to restore access.
 */
export async function handleAgentPaymentFailed(
  pool: Pool,
  invoice: Stripe.Invoice,
): Promise<{ matched: boolean }> {
  // Invoice.subscription is present at runtime on most Stripe API
  // versions, but its typing varies across SDK releases — access via an
  // `any` cast so we're resilient to both 'string' and expanded shapes.
  const rawInvoiceSubscription = (invoice as unknown as { subscription?: unknown }).subscription;
  const subscriptionId =
    typeof rawInvoiceSubscription === 'string'
      ? rawInvoiceSubscription
      : (rawInvoiceSubscription as { id?: string } | null | undefined)?.id ?? null;
  if (!subscriptionId) return { matched: false };
  // Synthesize a subscription-shaped object so the revoke helper can
  // pick up the id via its existing branch.
  const subscriptionLike = {
    id: subscriptionId,
    metadata: invoice.metadata ?? undefined,
  } as unknown as Stripe.Subscription;
  return handleAgentSubscriptionRevoked(pool, subscriptionLike, 'invoice.payment_failed');
}

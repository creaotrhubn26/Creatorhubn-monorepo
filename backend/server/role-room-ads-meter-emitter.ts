/**
 * role-room-ads-meter-emitter.ts
 *
 * Implementerer den MeterEmitter-flaten som syncCampaignSpend allerede
 * forventer (role-room-ads-sync.ts), men som inntil nå har vært
 * uimplementert — `runAdsAttributionSweepWithDefaults` har sendt `null`
 * og dermed aldri pushet til Stripe.
 *
 * Modulen er selvstendig (ingen sirkulær import med index.ts):
 *   - Konstruerer sin egen Stripe-klient fra env.
 *   - Slår opp stripe_customer_id ved å snake gjennom users → invite_requests
 *     (samme snapshot-mønster som resolveStripeCustomerForCastingProject).
 *   - Cacher (userId → customerId) per emitter-instans.
 *
 * Env-styring (default: AV — produksjons-trygt):
 *   ROLE_ROOM_STRIPE_METER_ADS_FEE_ENABLED = "true"   // master-bryter
 *   STRIPE_SECRET_KEY (eller STRIPE_API_KEY)
 *
 * Når enten env-bryteren er av eller Stripe-nøkkelen mangler, returnerer
 * builderen `null` og cron-en faller tilbake til dagens oppførsel
 * (ledger-skriv uten Stripe-push). Hvert emit som ikke finner en kunde-
 * mapping returnerer også `null` — feilen er "best-effort", aldri kastet.
 *
 * Verdien som sendes til Stripe er `valueNok = spendNok` (uendret fra
 * sync-koden). For å fakturere selve påslaget konfigureres Stripe Meter
 * Price med påslags-raten (f.eks. 0.20 NOK per enhet). Alternativt kan
 * sync.ts endres til å sende `managementFeeNok` direkte — det er en
 * separat avgjørelse fordi det også krever test-oppdatering.
 */

import type { Pool } from 'pg';
import Stripe from 'stripe';
import type { MeterEmitter } from './role-room-ads-sync.js';

function isEnabled(): boolean {
  const raw = process.env.ROLE_ROOM_STRIPE_METER_ADS_FEE_ENABLED;
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'true';
}

function readStripeSecret(): string | null {
  const key = (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '').trim();
  return key ? key : null;
}

interface AccessSnapshot {
  stripeCustomerId?: unknown;
}

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== 'string' || !value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function extractStripeCustomerId(messageJson: string | null | undefined): string | null {
  const parsed = safeJsonParse(messageJson) as AccessSnapshot | null;
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = (parsed as AccessSnapshot).stripeCustomerId;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function buildRoleRoomAdsMeterEmitter(pool: Pool): MeterEmitter | null {
  if (!isEnabled()) return null;
  const secret = readStripeSecret();
  if (!secret) return null;

  const stripe = new Stripe(secret);
  const cache = new Map<string, string | null>();

  async function resolveCustomerId(userId: string): Promise<string | null> {
    if (cache.has(userId)) return cache.get(userId) ?? null;
    try {
      const userRes = await pool.query<{ email: string | null }>(
        `SELECT LOWER(COALESCE(email, '')) AS email FROM users WHERE id::text = $1 LIMIT 1`,
        [userId],
      );
      const email = userRes.rows[0]?.email?.trim() || '';
      if (!email) { cache.set(userId, null); return null; }

      const inviteRes = await pool.query<{ message: string | null }>(
        `SELECT message FROM invite_requests
          WHERE source = 'role_room' AND LOWER(email) = $1
          ORDER BY created_at DESC
          LIMIT 10`,
        [email],
      );
      for (const row of inviteRes.rows) {
        const cid = extractStripeCustomerId(row.message);
        if (cid) { cache.set(userId, cid); return cid; }
      }
      cache.set(userId, null);
      return null;
    } catch (err) {
      console.warn('[ads-meter] customer_lookup_failed', { userId, error: String(err) });
      return null;
    }
  }

  return {
    async emit({ eventName, valueNok, userId, identifier, usageDate }) {
      try {
        const customerId = await resolveCustomerId(userId);
        if (!customerId) {
          console.warn('[ads-meter] no_customer', { userId, identifier, eventName });
          return null;
        }
        const value = String(Math.max(0, Math.round(valueNok)));
        const timestampMs = new Date(usageDate).getTime();
        const timestamp = Number.isFinite(timestampMs)
          ? Math.floor(timestampMs / 1000)
          : Math.floor(Date.now() / 1000);
        const event = await stripe.billing.meterEvents.create({
          event_name: eventName,
          payload: { stripe_customer_id: customerId, value },
          identifier,
          timestamp,
        });
        return event.identifier ?? identifier;
      } catch (error) {
        console.warn('[ads-meter] emit_failed', {
          eventName,
          identifier,
          error: String(error),
        });
        return null;
      }
    },
  };
}

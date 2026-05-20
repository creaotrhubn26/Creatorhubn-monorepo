/**
 * ga4-measurement-protocol — Slice 9X.70
 *
 * Server-side GA4-tracking. Brukes spesielt for events som skjer
 * uten en bruker-session i nettleseren (Stripe webhooks, cron-jobs,
 * scheduled emails). Skriver til GA4 via Measurement Protocol v2.
 *
 * Krever miljøvariabler:
 *   GA4_MEASUREMENT_ID   (f.eks. "G-XXXXXXXXXX")
 *   GA4_API_SECRET       (opprettes i GA4 → Admin → Data Streams → API secrets)
 *
 * Hvis disse mangler, no-op'er funksjonen (logger advarsel én gang).
 */

let warnedMissing = false;

interface MPEventParams {
  [key: string]: string | number | boolean | null | undefined;
}

interface SendMPOptions {
  /** Anonym klient-ID. Bruk Stripe customer-ID eller en deterministisk hash. */
  clientId: string;
  userId?: string;
  events: Array<{ name: string; params?: MPEventParams }>;
}

/**
 * Sender events til GA4 Measurement Protocol v2.
 * Fire-and-forget — kaster ikke feil oppover.
 */
export async function sendGA4Event(opts: SendMPOptions): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID
    || process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
    || process.env.VITE_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    if (!warnedMissing) {
      console.warn('[ga4-mp] GA4_MEASUREMENT_ID eller GA4_API_SECRET mangler — server-side events ikke sendt.');
      warnedMissing = true;
    }
    return;
  }

  try {
    // Rens params — GA4 MP godtar bare string/number/boolean
    const cleanedEvents = opts.events.map((ev) => ({
      name: ev.name,
      params: ev.params
        ? Object.entries(ev.params).reduce((acc, [k, v]) => {
            if (v != null && v !== '') acc[k] = v;
            return acc;
          }, {} as Record<string, any>)
        : undefined,
    }));

    const body = {
      client_id: opts.clientId,
      user_id: opts.userId,
      events: cleanedEvents,
      // server-side hendelse — la GA4 vite om timestamp
      timestamp_micros: Date.now() * 1000,
    };

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[ga4-mp] HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err: any) {
    console.warn('[ga4-mp] send failed:', err.message);
  }
}

/**
 * Convenience-wrapper for Stripe webhook-events. Bruker Stripe customer-ID
 * som client_id slik at events havner på samme bruker som registrerte seg
 * fra nettleseren (forutsatt at frontend sender customer-ID til GA4 ved login).
 */
export function trackStripeEvent(
  stripeCustomerId: string,
  eventName: string,
  params?: MPEventParams,
  userId?: string,
): void {
  // Fire-and-forget
  sendGA4Event({
    clientId: stripeCustomerId || `anon-${Date.now()}`,
    userId,
    events: [{ name: `creatorhub_${eventName}`, params }],
  }).catch(() => undefined);
}

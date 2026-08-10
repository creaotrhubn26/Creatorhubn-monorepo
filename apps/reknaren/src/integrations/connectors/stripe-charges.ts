/**
 * Stripe one-time charges-connector: henter betalte enkeltbetalinger UTEN
 * tilknyttet faktura (Checkout/Payment Links) — gapet `stripe-sync` (fakturaer)
 * ikke dekker — og gjør hver til et kvitteringsbilag i innboksen. Ærlig inaktiv
 * uten Stripe-nøkkel.
 */
import type { StripeReadPort } from '../stripe.js';
import { StripeAuthError } from '../stripe.js';
import { receiptXml, type ConnectorFetch, type SourceConnector } from './port.js';

export class StripeChargesConnector implements SourceConnector {
  readonly id = 'stripe-charges';
  readonly label = 'Stripe — enkeltbetalinger';
  readonly description = 'Betalte one-time charges uten faktura (Checkout/Payment Links) → bilag til godkjenning.';

  constructor(private readonly stripe: StripeReadPort | undefined) {}

  configured(): boolean {
    return Boolean(this.stripe?.hasApiKey);
  }

  async fetch(cursor: string | null): Promise<ConnectorFetch> {
    if (!this.stripe || !this.stripe.hasApiKey) throw new StripeAuthError('Stripe er ikke konfigurert.');
    const sinceUnix = cursor ? Number(cursor) : undefined;
    const charges = await this.stripe.listCharges(sinceUnix);
    let maxUnix = sinceUnix ?? 0;
    const records = charges.map((c) => {
      const unix = Math.floor(new Date(`${c.date}T00:00:00Z`).getTime() / 1000);
      if (unix > maxUnix) maxUnix = unix;
      const vendorName = c.customerName ?? c.customerEmail ?? 'Stripe-kunde';
      return {
        externalId: c.id,
        summary: `${c.description} (${c.currency})`,
        occurredAt: c.date,
        amountMinor: c.amountMinor,
        currency: c.currency,
        vendorName,
        documentType: 'payment_confirmation' as const,
        receiptXml: receiptXml({
          source: 'stripe-charges',
          externalId: c.id,
          date: c.date,
          amountMinor: c.amountMinor,
          currency: c.currency,
          description: c.description,
          vendorName,
          extra: { CustomerEmail: c.customerEmail, ReceiptUrl: c.receiptUrl },
        }),
      };
    });
    // Neste synk starter etter nyeste sett (Stripe created[gte] er inklusiv, så +1).
    return { records, nextCursor: records.length ? String(maxUnix + 1) : cursor };
  }
}

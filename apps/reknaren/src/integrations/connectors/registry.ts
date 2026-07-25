/**
 * Register av tilgjengelige inngående connectorer. Nye kilder legges til her —
 * hver bak SourceConnector-porten, med ærlig `configured()`.
 */
import type { StripeReadPort } from '../stripe.js';
import type { SourceConnector } from './port.js';
import { StripeChargesConnector } from './stripe-charges.js';

export function buildConnectorRegistry(deps: { stripe?: StripeReadPort | undefined }): Record<string, SourceConnector> {
  const connectors: SourceConnector[] = [new StripeChargesConnector(deps.stripe)];
  return Object.fromEntries(connectors.map((c) => [c.id, c]));
}

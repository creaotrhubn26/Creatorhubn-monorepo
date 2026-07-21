/**
 * Stripe → Ledgerly inntektssynk.
 *
 * For hver BETALT Stripe-faktura (Creatorhub / The Role Room / Leadgrid):
 *   1. Kunden upsertes i `customers` (match på e-post innen org, ellers ny).
 *   2. En UTKAST-salgsfaktura opprettes (`createInvoiceDraft`) — IKKE bokført.
 *      Mennesket godkjenner ved å utstede fakturaen; da bokføres inntekten.
 *      Kjerneinvarianten «motoren beregner, mennesket godkjenner» holdes.
 *   3. Importen registreres i `stripe_imports` (idempotens: én gang per faktura).
 *
 * Beløp kommer ordrett fra Stripe (bigint øre). VAT-behandlingen er KONFIGURERBAR
 * og MÅ fagkontrolleres: default er utgående kode '6' (omsetning utenfor mva-loven,
 * 0 %) + konto 3100 (salgsinntekt, avgiftsfri) — en provisorisk antakelse om at
 * selger IKKE er mva-registrert (som CREATORHUB AS i dag) og derfor ikke legger på
 * utgående mva. Fakturamotoren krever en UTGÅENDE mva-kode, og den eksakte koden er
 * en regnskapsfaglig vurdering — derfor lages UTKAST (ikke bokført), slik at
 * mennesket setter riktig kode/konto før utstedelse. Blir selskapet mva-registrert,
 * må dette settes om. Ikke-NOK-fakturaer hoppes over ærlig (utkast er NOK-innenlands).
 */

import { newId } from '../shared/ids.js';
import type { Actor } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import type { RuleRegister } from '../rules/register.js';
import { createInvoiceDraft } from '../invoicing/service.js';
import { ensureProductDimensions, productDimensionCode } from '../ops/products.js';
import { AI_REVENUE_ACCOUNT, isAiUsageLine } from '../ops/ai-accounts.js';
import type { StripeReadPort } from './stripe.js';

export interface StripeSyncOptions {
  organizationId: string;
  actor: Actor;
  /** Utgående MVA-kode på inntektslinjen. Default '6' (utenfor mva-loven, 0 %). */
  vatCode?: string;
  /** Inntektskonto. Default '3100' (salgsinntekt, avgiftsfri). */
  revenueAccount?: string;
  /** Kun fakturaer opprettet etter dette (unix-sekunder). */
  sinceUnix?: number;
}

export interface StripeSyncResult {
  imported: number;
  alreadyImported: number;
  skippedCurrency: number;
  customersCreated: number;
  /** Utkast-faktura- id-er som ble opprettet (til videre godkjenning). */
  draftInvoiceIds: string[];
  /** Fagkontroll-forbehold på VAT-behandlingen. */
  reviewNote: string;
}

const REVIEW_NOTE =
  'Utkast opprettet med provisorisk mva-kode 6 (utenfor mva-loven, 0 %) og konto 3100. ' +
  'Dette MÅ fagkontrolleres før utstedelse — default forutsetter at selger ikke er ' +
  'mva-registrert (ingen utgående mva).';

export async function syncStripeRevenue(
  db: Db,
  rules: RuleRegister,
  stripe: StripeReadPort,
  opts: StripeSyncOptions,
): Promise<StripeSyncResult> {
  const vatCode = opts.vatCode ?? '6';
  const revenueAccount = opts.revenueAccount ?? '3100';
  const invoices = await stripe.listPaidInvoices(opts.sinceUnix); // kaster uten nøkkel

  // Sikre at produktlinjene (Creatorhub/Role Room/Leadgrid) finnes som dimensjoner,
  // slik at inntekt kan segmenteres per produkt. Idempotent.
  await ensureProductDimensions(db, opts.organizationId, opts.actor);

  const result: StripeSyncResult = {
    imported: 0,
    alreadyImported: 0,
    skippedCurrency: 0,
    customersCreated: 0,
    draftInvoiceIds: [],
    reviewNote: REVIEW_NOTE,
  };

  for (const inv of invoices) {
    if (!inv.id) continue;

    // Idempotens: allerede importert?
    const existing = await db.query(
      `SELECT 1 FROM stripe_imports WHERE organization_id = $1 AND stripe_invoice_id = $2`,
      [opts.organizationId, inv.id],
    );
    if ((existing.rowCount ?? 0) > 0) {
      result.alreadyImported++;
      continue;
    }

    // Ikke-NOK hoppes over ærlig (utkast-fakturaen er NOK-innenlands).
    if (inv.currency !== 'NOK') {
      await db.query(
        `INSERT INTO stripe_imports
           (id, organization_id, stripe_invoice_id, stripe_customer_id, source_product,
            amount_minor, currency, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'skipped_currency')
         ON CONFLICT (organization_id, stripe_invoice_id) DO NOTHING`,
        [newId(), opts.organizationId, inv.id, inv.stripeCustomerId, inv.sourceProduct, inv.amountMinor.toString(), inv.currency],
      );
      result.skippedCurrency++;
      continue;
    }

    // 1. Upsert kunde (match på e-post innen org, ellers opprett).
    const { customerId, created } = await upsertCustomer(db, opts, inv.customerName, inv.customerEmail);
    if (created) result.customersCreated++;

    // 2. Utkast-salgsfaktura (ikke bokført — mennesket utsteder). Itemisert:
    // én linje per Stripe-linje = hva kunden faktisk betalte for.
    const items =
      inv.lineItems.length > 0
        ? inv.lineItems
        : [
            {
              description: inv.description,
              amountMinor: inv.amountMinor,
              quantity: 1,
              periodStart: inv.periodStart,
              periodEnd: inv.periodEnd,
              sourceProduct: inv.sourceProduct,
            },
          ];
    const lines = items.map((li) => {
      const period = li.periodStart && li.periodEnd ? ` (${li.periodStart} – ${li.periodEnd})` : '';
      const qty = li.quantity > 1 ? ` ×${li.quantity}` : '';
      const code = productDimensionCode(li.sourceProduct);
      // AI-/bruksbaserte linjer bokføres på egen AI-inntektskonto (3210) → AI-margin.
      const account = isAiUsageLine(li.description) ? AI_REVENUE_ACCOUNT : revenueAccount;
      return {
        description: `${li.description}${qty}${period}`.slice(0, 500),
        quantityThousandths: 1000n, // hele linjebeløpet som én enhet (eksakt, ingen avrunding)
        unitPriceMinor: li.amountMinor, // Stripe-linjebeløp; eks. mva (kode 6 = 0 %)
        vatCode,
        revenueAccount: account,
        ...(code ? { project: code } : {}),
      };
    });
    const draft = await createInvoiceDraft(db, rules, {
      organizationId: opts.organizationId,
      actor: opts.actor,
      customerId,
      invoiceDate: inv.date,
      lines,
    });

    // 3. Registrer importen (idempotens-anker + sporbarhet til Stripe).
    await db.query(
      `INSERT INTO stripe_imports
         (id, organization_id, stripe_invoice_id, stripe_customer_id, source_product,
          customer_id, invoice_id, amount_minor, currency, status,
          stripe_number, hosted_invoice_url, period_start, period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'imported',$10,$11,$12,$13)
       ON CONFLICT (organization_id, stripe_invoice_id) DO NOTHING`,
      [
        newId(), opts.organizationId, inv.id, inv.stripeCustomerId, inv.sourceProduct,
        customerId, draft.id, inv.amountMinor.toString(), inv.currency,
        inv.number, inv.hostedInvoiceUrl, inv.periodStart, inv.periodEnd,
      ],
    );

    result.imported++;
    result.draftInvoiceIds.push(draft.id);
  }

  return result;
}

async function upsertCustomer(
  db: Db,
  opts: StripeSyncOptions,
  name: string | null,
  email: string | null,
): Promise<{ customerId: string; created: boolean }> {
  if (email) {
    const found = await db.query<{ id: string }>(
      `SELECT id FROM customers WHERE organization_id = $1 AND lower(email) = lower($2) LIMIT 1`,
      [opts.organizationId, email],
    );
    if (found.rows[0]) return { customerId: found.rows[0].id, created: false };
  }
  const id = newId();
  await db.query(
    `INSERT INTO customers (id, organization_id, name, email, created_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, opts.organizationId, name?.trim() || email || 'Stripe-kunde', email, opts.actor.userId],
  );
  return { customerId: id, created: true };
}

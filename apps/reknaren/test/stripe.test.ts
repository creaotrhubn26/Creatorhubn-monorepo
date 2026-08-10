import { describe, expect, it } from 'vitest';
import {
  StripeApiClient,
  StripeAuthError,
  StaticStripeStub,
  deriveSourceProduct,
} from '../src/integrations/stripe.js';

function fakeFetch(pages: Array<{ status?: number; body?: unknown }>) {
  const calls: string[] = [];
  let i = 0;
  const impl = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push(url);
    const p = pages[Math.min(i++, pages.length - 1)]!;
    const status = p.status ?? 200;
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => p.body,
      text: async () => '',
    };
  };
  return { impl, calls };
}

const invoiceRaw = (over: Record<string, unknown> = {}) => ({
  id: 'in_1',
  customer: 'cus_1',
  customer_name: 'Kari Nordmann',
  customer_email: 'kari@example.com',
  amount_paid: 49900,
  currency: 'nok',
  description: 'Leadgrid Solo Pro',
  created: 1_767_225_600, // 2026-01-01
  status: 'paid',
  ...over,
});

describe('StripeApiClient (kun LES)', () => {
  it('uten nøkkel: hasApiKey=false og listPaidInvoices kaster FØR nettverkskall', async () => {
    const { impl, calls } = fakeFetch([{ body: {} }]);
    const client = new StripeApiClient(undefined, impl);
    expect(client.hasApiKey).toBe(false);
    await expect(client.listPaidInvoices()).rejects.toBeInstanceOf(StripeAuthError);
    expect(calls).toHaveLength(0);
  });

  it('mapper Stripe-faktura til domenetype (øre som bigint, valuta store bokstaver, dato)', async () => {
    const { impl, calls } = fakeFetch([{ body: { data: [invoiceRaw()], has_more: false } }]);
    const client = new StripeApiClient('sk_test_x', impl);
    const list = await client.listPaidInvoices();
    expect(list).toHaveLength(1);
    const inv = list[0]!;
    expect(inv.amountMinor).toBe(49900n);
    expect(inv.currency).toBe('NOK');
    expect(inv.customerEmail).toBe('kari@example.com');
    expect(inv.date).toBe('2026-01-01');
    expect(inv.sourceProduct).toBe('leadgrid');
    expect(calls[0]).toContain('/invoices?');
    expect(calls[0]).toContain('status=paid');
  });

  it('fanger itemiserte linjer + fakturanummer + kvitterings-lenke + periode', async () => {
    const { impl } = fakeFetch([
      {
        body: {
          data: [
            {
              id: 'in_1',
              number: 'CH-0007',
              hosted_invoice_url: 'https://invoice.stripe.com/i/abc',
              customer: 'cus_1',
              customer_name: 'Kari Nordmann',
              customer_email: 'kari@example.com',
              amount_paid: 74900,
              currency: 'nok',
              created: 1_767_225_600,
              status: 'paid',
              period_start: 1_767_225_600,
              period_end: 1_769_904_000,
              lines: {
                data: [
                  { description: 'Leadgrid Solo Pro', amount: 49900, quantity: 1, period: { start: 1_767_225_600, end: 1_769_904_000 }, price: { product: 'prod_lg' } },
                  { description: 'The Role Room Studio', amount: 25000, quantity: 2, price: { nickname: 'Role Room plan' } },
                ],
              },
            },
          ],
          has_more: false,
        },
      },
    ]);
    const client = new StripeApiClient('sk_test_x', impl);
    const inv = (await client.listPaidInvoices())[0]!;
    expect(inv.number).toBe('CH-0007');
    expect(inv.hostedInvoiceUrl).toContain('invoice.stripe.com');
    expect(inv.periodStart).toBe('2026-01-01');
    expect(inv.lineItems).toHaveLength(2);
    expect(inv.lineItems[0]).toMatchObject({ description: 'Leadgrid Solo Pro', amountMinor: 49900n, sourceProduct: 'leadgrid', periodStart: '2026-01-01' });
    expect(inv.lineItems[1]).toMatchObject({ description: 'The Role Room Studio', amountMinor: 25000n, quantity: 2, sourceProduct: 'role_room' });
  });

  it('følger paginering (has_more) med starting_after', async () => {
    const { impl, calls } = fakeFetch([
      { body: { data: [invoiceRaw({ id: 'in_1' })], has_more: true } },
      { body: { data: [invoiceRaw({ id: 'in_2' })], has_more: false } },
    ]);
    const client = new StripeApiClient('sk_test_x', impl);
    const list = await client.listPaidInvoices();
    expect(list.map((i) => i.id)).toEqual(['in_1', 'in_2']);
    expect(calls[1]).toContain('starting_after=in_1');
  });

  it('401 fra Stripe → StripeAuthError', async () => {
    const client = new StripeApiClient('sk_bad', fakeFetch([{ status: 401 }]).impl);
    await expect(client.listPaidInvoices()).rejects.toBeInstanceOf(StripeAuthError);
  });
});

describe('deriveSourceProduct', () => {
  it('kjenner igjen produktene fra metadata/beskrivelse', () => {
    expect(deriveSourceProduct({ description: 'The Role Room Studio' })).toBe('role_room');
    expect(deriveSourceProduct({ metadata: { product: 'leadgrid-solo-pro' } })).toBe('leadgrid');
    expect(deriveSourceProduct({ description: 'CreatorHub Enterprise' })).toBe('creatorhub');
    expect(deriveSourceProduct({ description: 'noe helt annet' })).toBeNull();
  });
});

describe('StaticStripeStub', () => {
  it('leverer forhåndsdefinerte fakturaer', async () => {
    const stub = new StaticStripeStub([
      { id: 'in_9', number: null, hostedInvoiceUrl: null, stripeCustomerId: 'cus_9', customerName: 'X', customerEmail: null, amountMinor: 1000n, currency: 'NOK', description: 'd', date: '2026-02-01', periodStart: null, periodEnd: null, lineItems: [], sourceProduct: null },
    ]);
    expect((await stub.listPaidInvoices())[0]!.id).toBe('in_9');
  });

  it('uten nøkkel kaster StripeAuthError', async () => {
    const stub = new StaticStripeStub([], { hasApiKey: false });
    await expect(stub.listPaidInvoices()).rejects.toBeInstanceOf(StripeAuthError);
  });
});

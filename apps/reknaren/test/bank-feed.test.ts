import { describe, expect, it } from 'vitest';
import {
  BankFeedError,
  BankFeedNotConfiguredError,
  GoCardlessBankFeedProvider,
  UnconfiguredBankFeedProvider,
  mapGcTransaction,
} from '../src/bank/feed.js';

function fakeFetch(routes: (url: string, init: { method: string; body?: string }) => { status: number; body?: unknown }) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];
  const impl = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const r = routes(url, init);
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body, text: async () => '' };
  };
  return { impl, calls };
}

describe('mapGcTransaction', () => {
  it('normaliserer beløp til øre-bigint med fortegn, aldri flyttall', () => {
    const debit = mapGcTransaction({
      transactionId: 'tx-1',
      bookingDate: '2026-02-10',
      transactionAmount: { amount: '-1234.56', currency: 'NOK' },
      remittanceInformationUnstructured: 'Faktura 5012',
      creditorName: 'Elkjøp Norge AS',
    });
    expect(debit).toEqual({
      externalId: 'tx-1',
      bookedDate: '2026-02-10',
      amountMinor: -123456n,
      currency: 'NOK',
      description: 'Faktura 5012',
      counterparty: 'Elkjøp Norge AS',
    });

    const credit = mapGcTransaction({
      internalTransactionId: 'tx-2',
      bookingDate: '2026-02-11',
      transactionAmount: { amount: '5000.00', currency: 'NOK' },
      debtorName: 'Kunde AS',
    });
    expect(credit?.amountMinor).toBe(500000n);
    expect(credit?.counterparty).toBe('Kunde AS');
    expect(credit?.description).toBe('Innbetaling');
  });

  it('hopper over transaksjoner uten ID/dato/beløp eller med nullbeløp', () => {
    expect(mapGcTransaction({ bookingDate: '2026-02-10', transactionAmount: { amount: '10.00' } })).toBeNull();
    expect(mapGcTransaction({ transactionId: 'x', transactionAmount: { amount: '10.00' } })).toBeNull();
    expect(mapGcTransaction({ transactionId: 'x', bookingDate: '2026-02-10' })).toBeNull();
    expect(
      mapGcTransaction({ transactionId: 'x', bookingDate: '2026-02-10', transactionAmount: { amount: '0.00' } }),
    ).toBeNull();
  });
});

describe('GoCardlessBankFeedProvider', () => {
  it('uten legitimasjon: configured=false, fetch kaster FØR nettverkskall', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const provider = new GoCardlessBankFeedProvider(undefined, impl);
    expect(provider.configured).toBe(false);
    await expect(provider.fetchTransactions({ connectionId: 'acc-1' })).rejects.toBeInstanceOf(
      BankFeedNotConfiguredError,
    );
    expect(calls).toHaveLength(0);
  });

  it('henter token, så transaksjoner, og normaliserer «booked»', async () => {
    const { impl, calls } = fakeFetch((url) => {
      if (url.endsWith('/token/new/')) return { status: 200, body: { access: 'tok-123' } };
      if (url.includes('/accounts/acc-1/transactions/')) {
        return {
          status: 200,
          body: {
            transactions: {
              booked: [
                {
                  transactionId: 'a',
                  bookingDate: '2026-02-10',
                  transactionAmount: { amount: '-100.00', currency: 'NOK' },
                  remittanceInformationUnstructured: 'Leverandør',
                  creditorName: 'Strøm AS',
                },
                { transactionId: 'bad', bookingDate: '2026-02-10' }, // droppes
              ],
              pending: [{ transactionId: 'p', bookingDate: '2026-02-12', transactionAmount: { amount: '9.00' } }],
            },
          },
        };
      }
      return { status: 404 };
    });
    const provider = new GoCardlessBankFeedProvider({ secretId: 'id', secretKey: 'key' }, impl);
    const result = await provider.fetchTransactions({ connectionId: 'acc-1', sinceDate: '2026-02-01' });

    // kun «booked», ugyldige droppet, pending ignorert
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({ externalId: 'a', amountMinor: -10000n, counterparty: 'Strøm AS' });
    expect(result.sinceDate).toBe('2026-02-01');
    // token først, deretter Bearer + date_from-filter
    expect(calls[0]!.url).toContain('/token/new/');
    expect(calls[1]!.headers.authorization).toBe('Bearer tok-123');
    expect(calls[1]!.url).toContain('date_from=2026-02-01');
  });

  it('401 fra aggregatoren → NotConfigured; 500 → BankFeedError', async () => {
    const unauth = new GoCardlessBankFeedProvider(
      { secretId: 'id', secretKey: 'key' },
      fakeFetch(() => ({ status: 401 })).impl,
    );
    await expect(unauth.fetchTransactions({ connectionId: 'acc-1' })).rejects.toBeInstanceOf(
      BankFeedNotConfiguredError,
    );
    const err = new GoCardlessBankFeedProvider(
      { secretId: 'id', secretKey: 'key' },
      fakeFetch((url) => (url.endsWith('/token/new/') ? { status: 200, body: { access: 't' } } : { status: 500 })).impl,
    );
    await expect(err.fetchTransactions({ connectionId: 'acc-1' })).rejects.toBeInstanceOf(BankFeedError);
  });
});

describe('UnconfiguredBankFeedProvider', () => {
  it('er ærlig inaktiv og kaster NotConfigured', async () => {
    const p = new UnconfiguredBankFeedProvider();
    expect(p.configured).toBe(false);
    await expect(p.fetchTransactions()).rejects.toBeInstanceOf(BankFeedNotConfiguredError);
  });
});

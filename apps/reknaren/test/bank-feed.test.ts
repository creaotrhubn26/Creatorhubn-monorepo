import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  BankFeedError,
  BankFeedNotConfiguredError,
  EnableBankingBankFeedProvider,
  GoCardlessBankFeedProvider,
  UnconfiguredBankFeedProvider,
  mapEnableTransaction,
  mapGcTransaction,
} from '../src/bank/feed.js';

function fakeFetch(routes: (url: string, init: { method: string; body?: string }) => { status: number; body?: unknown }) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string | undefined }> = [];
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

  it('lister institusjoner, oppretter requisition og henter konto-ID-er', async () => {
    const { impl, calls } = fakeFetch((url, init) => {
      if (url.endsWith('/token/new/')) return { status: 200, body: { access: 'tok' } };
      if (url.includes('/institutions/?country=no'))
        return { status: 200, body: [{ id: 'DNB_DNBANOKK', name: 'DNB', bic: 'DNBANOKK' }, { id: 'x' /* mangler navn */ }] };
      if (url.endsWith('/requisitions/') && init.method === 'POST')
        return { status: 201, body: { id: 'req-1', link: 'https://ob.gocardless.com/psd2/start/req-1/DNB' } };
      if (url.includes('/requisitions/req-1/'))
        return { status: 200, body: { status: 'LN', accounts: ['acc-a', 'acc-b'] } };
      return { status: 404 };
    });
    const p = new GoCardlessBankFeedProvider({ secretId: 'id', secretKey: 'key' }, impl);

    const banks = await p.listInstitutions('NO');
    expect(banks).toEqual([{ id: 'DNB_DNBANOKK', name: 'DNB', bic: 'DNBANOKK' }]); // uten navn droppet

    const link = await p.createRequisition({ institutionId: 'DNB_DNBANOKK', redirectUrl: 'https://app/cb', reference: 'org:acct' });
    expect(link).toEqual({ requisitionId: 'req-1', link: 'https://ob.gocardless.com/psd2/start/req-1/DNB' });
    const reqBody = JSON.parse(calls.find((c) => c.url.endsWith('/requisitions/'))!.body as string);
    expect(reqBody).toMatchObject({ institution_id: 'DNB_DNBANOKK', redirect: 'https://app/cb', reference: 'org:acct' });

    const accts = await p.completeConsent({ requisitionId: 'req-1' });
    expect(accts).toEqual({ status: 'LN', accountIds: ['acc-a', 'acc-b'] });
  });

  it('linking-metodene er også ærlig inaktive uten legitimasjon', async () => {
    const p = new GoCardlessBankFeedProvider(undefined, fakeFetch(() => ({ status: 200, body: {} })).impl);
    await expect(p.listInstitutions('NO')).rejects.toBeInstanceOf(BankFeedNotConfiguredError);
    await expect(p.createRequisition({ institutionId: 'x', redirectUrl: 'u', reference: 'r' })).rejects.toBeInstanceOf(
      BankFeedNotConfiguredError,
    );
    await expect(p.completeConsent({ requisitionId: 'req' })).rejects.toBeInstanceOf(BankFeedNotConfiguredError);
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

describe('mapEnableTransaction', () => {
  it('normaliserer med fortegn fra credit_debit_indicator', () => {
    const debit = mapEnableTransaction({
      entry_reference: 'e-1',
      booking_date: '2026-02-10',
      transaction_amount: { amount: '1234.56', currency: 'NOK' },
      credit_debit_indicator: 'DBIT',
      remittance_information: ['Faktura', '5012'],
      creditor: { name: 'Strøm AS' },
    });
    expect(debit).toEqual({
      externalId: 'e-1',
      bookedDate: '2026-02-10',
      amountMinor: -123456n,
      currency: 'NOK',
      description: 'Faktura 5012',
      counterparty: 'Strøm AS',
    });
    const credit = mapEnableTransaction({
      booking_date: '2026-02-11',
      transaction_amount: { amount: '500.00', currency: 'NOK' },
      credit_debit_indicator: 'CRDT',
      debtor: { name: 'Kunde AS' },
    });
    expect(credit?.amountMinor).toBe(50000n);
    expect(credit?.counterparty).toBe('Kunde AS');
    // uten entry_reference bygges en deterministisk id
    expect(credit?.externalId).toBe('2026-02-11:50000:Innbetaling');
  });

  it('hopper over ugyldig dato/beløp/null', () => {
    expect(mapEnableTransaction({ transaction_amount: { amount: '10.00' } })).toBeNull();
    expect(mapEnableTransaction({ booking_date: '2026-02-10' })).toBeNull();
    expect(
      mapEnableTransaction({ booking_date: '2026-02-10', transaction_amount: { amount: '0.00' }, credit_debit_indicator: 'CRDT' }),
    ).toBeNull();
  });
});

describe('EnableBankingBankFeedProvider', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const cfg = { applicationId: 'app-123', privateKeyPem: pem };
  const decodeJwtHeader = (auth: string) =>
    JSON.parse(Buffer.from(auth.replace('Bearer ', '').split('.')[0]!, 'base64url').toString());

  it('uten legitimasjon: configured=false, fetch kaster FØR nettverkskall', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const p = new EnableBankingBankFeedProvider(undefined, impl);
    expect(p.configured).toBe(false);
    await expect(p.listInstitutions('NO')).rejects.toBeInstanceOf(BankFeedNotConfiguredError);
    expect(calls).toHaveLength(0);
  });

  it('signerer selv-signert RS256-JWT (kid=app-ID) og går gjennom hele flyten', async () => {
    const { impl, calls } = fakeFetch((url, init) => {
      if (url.includes('/aspsps?country=NO')) return { status: 200, body: { aspsps: [{ name: 'DNB', bic: 'DNBANOKK' }, {}] } };
      if (url.endsWith('/auth') && init.method === 'POST')
        return { status: 200, body: { url: 'https://tilsl.enablebanking.com/auth/xyz', authorization_id: 'auth-9' } };
      if (url.endsWith('/sessions') && init.method === 'POST')
        return { status: 200, body: { session_id: 's-1', accounts: ['acc-uid-1', { uid: 'acc-uid-2' }] } };
      if (url.includes('/accounts/acc-uid-1/transactions'))
        return {
          status: 200,
          body: {
            transactions: [
              {
                entry_reference: 't-1',
                booking_date: '2026-02-10',
                transaction_amount: { amount: '99.00', currency: 'NOK' },
                credit_debit_indicator: 'DBIT',
                remittance_information: ['Leie'],
                creditor: { name: 'Utleier AS' },
              },
            ],
          },
        };
      return { status: 404 };
    });
    const p = new EnableBankingBankFeedProvider(cfg, impl, 20000, () => 1_700_000_000);

    const banks = await p.listInstitutions('NO');
    expect(banks).toEqual([{ id: 'DNB', name: 'DNB', bic: 'DNBANOKK' }]);
    expect(decodeJwtHeader(calls[0]!.headers.authorization!)).toMatchObject({ alg: 'RS256', typ: 'JWT', kid: 'app-123' });

    const link = await p.createRequisition({ institutionId: 'DNB', redirectUrl: 'https://app/cb', reference: 'org:acct' });
    expect(link).toEqual({ requisitionId: 'auth-9', link: 'https://tilsl.enablebanking.com/auth/xyz' });
    const authBody = JSON.parse(calls.find((c) => c.url.endsWith('/auth'))!.body as string);
    expect(authBody).toMatchObject({ aspsp: { name: 'DNB', country: 'NO' }, redirect_url: 'https://app/cb', state: 'org:acct', psu_type: 'business' });

    const accts = await p.completeConsent({ code: 'consent-code' });
    expect(accts).toEqual({ status: 'AUTHORIZED', accountIds: ['acc-uid-1', 'acc-uid-2'] });
    expect(JSON.parse(calls.find((c) => c.url.endsWith('/sessions'))!.body as string)).toEqual({ code: 'consent-code' });

    const feed = await p.fetchTransactions({ connectionId: 'acc-uid-1', sinceDate: '2026-02-01' });
    expect(feed.transactions).toHaveLength(1);
    expect(feed.transactions[0]).toMatchObject({ externalId: 't-1', amountMinor: -9900n, counterparty: 'Utleier AS' });
  });

  it('krever code i completeConsent; 401 → NotConfigured', async () => {
    const okAuth = new EnableBankingBankFeedProvider(cfg, fakeFetch(() => ({ status: 200, body: {} })).impl);
    await expect(okAuth.completeConsent({ requisitionId: 'x' })).rejects.toBeInstanceOf(BankFeedError);
    const unauth = new EnableBankingBankFeedProvider(cfg, fakeFetch(() => ({ status: 401 })).impl);
    await expect(unauth.listInstitutions('NO')).rejects.toBeInstanceOf(BankFeedNotConfiguredError);
  });
});

/**
 * Bank-feed: hent kontotransaksjoner automatisk fra en PSD2/open banking-
 * aggregator, i stedet for manuell CSV-import. Ligger bak en port slik at resten
 * av bankmodulen (idempotent import på `externalId`, matching, godkjenning) er
 * uendret — feed-en LEVERER bare normaliserte `BankTransactionInput`, den bokfører
 * ingenting selv.
 *
 * Konkret implementasjon: GoCardless Bank Account Data (tidl. Nordigen) — den
 * facto gratis PSD2-aggregatoren som dekker norske banker. Reelle endepunkter,
 * men ærlig status: uten `REKNAREN_GOCARDLESS_SECRET_ID` + `_SECRET_KEY` er den
 * IKKE aktiv og `fetchTransactions` kaster `BankFeedNotConfiguredError` FØR
 * nettverkskall. `fetchImpl` er injiserbar for test.
 *
 * MERK: selve bank-samtykket (requisition/end-user agreement) opprettes i
 * aggregatorens flyt; her tar vi imot den ferdige `connectionId` (aggregatorens
 * konto-ID) og henter transaksjonene for den.
 */
import { createSign } from 'node:crypto';
import type { BankTransactionInput } from './import.js';
import { moneyFromDecimalString } from '../shared/money.js';

export class BankFeedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BankFeedError';
  }
}

export class BankFeedNotConfiguredError extends BankFeedError {
  constructor(message: string) {
    super(message);
    this.name = 'BankFeedNotConfiguredError';
  }
}

export interface BankFeedResult {
  transactions: BankTransactionInput[];
  /** Hentet fra og med (ISO) — for åpenhet i loggen. */
  sinceDate?: string;
}

/** En bank hos aggregatoren, til bank-velgeren i samtykkeflyten. */
export interface BankInstitution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
}

/** Resultat av å opprette en samtykke-forespørsel (requisition). */
export interface RequisitionLink {
  requisitionId: string;
  /** URL brukeren må besøke for å logge inn i banken og gi samtykke. */
  link: string;
}

/** Status + konto-ID-er et fullført samtykke peker på. */
export interface RequisitionAccounts {
  status: string;
  accountIds: string[];
}

/**
 * Det aggregatoren trenger for å fullføre samtykket etter bank-redirect. Ulike
 * leverandører bruker ulike token: GoCardless slår opp på server-lagret
 * `requisitionId`; Enable Banking bytter inn `code` fra redirect-URL-en.
 */
export interface ConsentCompletion {
  requisitionId?: string;
  code?: string;
}

export interface BankFeedProvider {
  readonly name: string;
  /** Er feed-en konfigurert? Styrer ærlig status. */
  readonly configured: boolean;
  /** Lister banker aggregatoren støtter i et land (ISO-2, f.eks. 'NO'). */
  listInstitutions(country: string): Promise<BankInstitution[]>;
  /** Starter samtykkeflyten mot en valgt bank → lenke brukeren besøker. */
  createRequisition(params: {
    institutionId: string;
    redirectUrl: string;
    reference: string;
  }): Promise<RequisitionLink>;
  /** Fullfører samtykket etter redirect → konto-ID-ene tilgangen gir. */
  completeConsent(params: ConsentCompletion): Promise<RequisitionAccounts>;
  /** Henter normaliserte transaksjoner for en tilkoblet konto. */
  fetchTransactions(params: { connectionId: string; sinceDate?: string }): Promise<BankFeedResult>;
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

export interface GoCardlessConfig {
  secretId: string;
  secretKey: string;
}

/** Rå GoCardless-transaksjon (delmengde vi bruker). Feltnavn følger deres API. */
interface GcTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount?: { amount?: string; currency?: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  creditorName?: string;
  debtorName?: string;
  creditorAccount?: { bban?: string; iban?: string };
}

/**
 * Normaliserer én GoCardless-transaksjon til `BankTransactionInput`. Beløp parses
 * EKSAKT (aldri flyttall); fortegn beholdes (negativt = utbetaling). Returnerer
 * null når obligatoriske felt (ID, dato, beløp) mangler — da hoppes den over.
 */
export function mapGcTransaction(tx: GcTransaction): BankTransactionInput | null {
  const externalId = tx.transactionId ?? tx.internalTransactionId;
  const bookedDate = tx.bookingDate ?? tx.valueDate;
  const amountStr = tx.transactionAmount?.amount;
  if (!externalId || !bookedDate || !amountStr || !/^\d{4}-\d{2}-\d{2}$/.test(bookedDate)) return null;

  const currency = tx.transactionAmount?.currency ?? 'NOK';
  let amountMinor: bigint;
  try {
    const negative = amountStr.trim().startsWith('-');
    const magnitude = moneyFromDecimalString(amountStr.replace(/^[-+]/, '').trim(), currency).minorUnits;
    amountMinor = negative ? -magnitude : magnitude;
  } catch {
    return null;
  }
  if (amountMinor === 0n) return null;

  const description =
    tx.remittanceInformationUnstructured ??
    tx.remittanceInformationUnstructuredArray?.join(' ') ??
    (amountMinor < 0n ? 'Utbetaling' : 'Innbetaling');
  const counterparty = amountMinor < 0n ? tx.creditorName : tx.debtorName;

  return {
    externalId,
    bookedDate,
    amountMinor,
    currency,
    description,
    ...(counterparty ? { counterparty } : {}),
  };
}

const GC_BASE = 'https://bankaccountdata.gocardless.com/api/v2';

export class GoCardlessBankFeedProvider implements BankFeedProvider {
  readonly name = 'gocardless';
  private token: string | null = null;

  constructor(
    private readonly config: GoCardlessConfig | undefined,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 20000,
  ) {}

  get configured(): boolean {
    return Boolean(this.config?.secretId && this.config?.secretKey);
  }

  private async request(
    path: string,
    init: { method: string; headers?: Record<string, string>; body?: string },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${GC_BASE}${path}`, {
        method: init.method,
        headers: { accept: 'application/json', ...(init.headers ?? {}) },
        ...(init.body ? { body: init.body } : {}),
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        throw new BankFeedNotConfiguredError(`GoCardless avviste legitimasjonen (${res.status}).`);
      }
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 200);
        throw new BankFeedError(`GoCardless svarte med status ${res.status}. ${detail}`.trim(), res.status);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    const c = this.config as GoCardlessConfig;
    const body = (await this.request('/token/new/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret_id: c.secretId, secret_key: c.secretKey }),
    })) as { access?: string };
    if (!body.access) throw new BankFeedError('GoCardless returnerte ikke et access-token.');
    this.token = body.access;
    return this.token;
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new BankFeedNotConfiguredError(
        'Bank-feed er ikke konfigurert (REKNAREN_GOCARDLESS_SECRET_ID + REKNAREN_GOCARDLESS_SECRET_KEY mangler).',
      );
    }
  }

  async listInstitutions(country: string): Promise<BankInstitution[]> {
    this.ensureConfigured();
    const token = await this.ensureToken();
    const body = (await this.request(`/institutions/?country=${encodeURIComponent(country.toLowerCase())}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })) as Array<{ id?: string; name?: string; bic?: string; logo?: string }>;
    return (Array.isArray(body) ? body : [])
      .filter((i): i is { id: string; name: string; bic?: string; logo?: string } => Boolean(i.id && i.name))
      .map((i) => ({ id: i.id, name: i.name, ...(i.bic ? { bic: i.bic } : {}), ...(i.logo ? { logo: i.logo } : {}) }));
  }

  async createRequisition(params: {
    institutionId: string;
    redirectUrl: string;
    reference: string;
  }): Promise<RequisitionLink> {
    this.ensureConfigured();
    const token = await this.ensureToken();
    const body = (await this.request('/requisitions/', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        institution_id: params.institutionId,
        redirect: params.redirectUrl,
        reference: params.reference,
        user_language: 'NO',
      }),
    })) as { id?: string; link?: string };
    if (!body.id || !body.link) throw new BankFeedError('GoCardless returnerte ikke requisition-ID/lenke.');
    return { requisitionId: body.id, link: body.link };
  }

  async completeConsent(params: ConsentCompletion): Promise<RequisitionAccounts> {
    this.ensureConfigured();
    const requisitionId = params.requisitionId;
    if (!requisitionId) throw new BankFeedError('GoCardless krever requisitionId for å fullføre samtykket.');
    const token = await this.ensureToken();
    const body = (await this.request(`/requisitions/${encodeURIComponent(requisitionId)}/`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })) as { status?: string; accounts?: string[] };
    return { status: body.status ?? 'UNKNOWN', accountIds: Array.isArray(body.accounts) ? body.accounts : [] };
  }

  async fetchTransactions(params: { connectionId: string; sinceDate?: string }): Promise<BankFeedResult> {
    this.ensureConfigured();
    const token = await this.ensureToken();
    const query = params.sinceDate ? `?date_from=${encodeURIComponent(params.sinceDate)}` : '';
    const body = (await this.request(`/accounts/${encodeURIComponent(params.connectionId)}/transactions/${query}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })) as { transactions?: { booked?: GcTransaction[] } };

    const booked = body.transactions?.booked ?? [];
    const transactions = booked
      .map(mapGcTransaction)
      .filter((t): t is BankTransactionInput => t !== null);
    return { transactions, ...(params.sinceDate ? { sinceDate: params.sinceDate } : {}) };
  }
}

/** Ærlig no-op når ingen aggregator er konfigurert. */
export class UnconfiguredBankFeedProvider implements BankFeedProvider {
  readonly name = 'none';
  readonly configured = false;
  private fail(): never {
    throw new BankFeedNotConfiguredError('Ingen bank-feed er konfigurert. Bruk manuell CSV-import.');
  }
  async listInstitutions(): Promise<BankInstitution[]> {
    this.fail();
  }
  async createRequisition(): Promise<RequisitionLink> {
    this.fail();
  }
  async completeConsent(): Promise<RequisitionAccounts> {
    this.fail();
  }
  async fetchTransactions(): Promise<BankFeedResult> {
    this.fail();
  }
}

// ── Enable Banking (nordisk PSD2-aggregator) ─────────────────────────────────

const EB_BASE = 'https://api.enablebanking.com';

export interface EnableBankingConfig {
  applicationId: string;
  /** RSA privatnøkkel (PEM) lastet ned da appen ble registrert hos Enable Banking. */
  privateKeyPem: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Enable Banking autentiserer med en SELV-SIGNERT RS256-JWT (ingen token-exchange):
 * header `kid`=application-ID, `iss`=enablebanking.com, `aud`=api.enablebanking.com.
 * Signeres med Nodes `crypto` — ingen ekstra avhengighet (samme mønster som
 * Maskinporten-klienten).
 */
function signEnableJwt(cfg: EnableBankingConfig, nowSeconds: number): string {
  const header = { typ: 'JWT', alg: 'RS256', kid: cfg.applicationId };
  const claims = { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: nowSeconds, exp: nowSeconds + 3600 };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(cfg.privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}

interface EbTransaction {
  entry_reference?: string;
  transaction_amount?: { amount?: string; currency?: string };
  credit_debit_indicator?: string; // CRDT (inn) | DBIT (ut)
  booking_date?: string;
  value_date?: string;
  remittance_information?: string[];
  creditor?: { name?: string };
  debtor?: { name?: string };
}

/**
 * Normaliserer én Enable Banking-transaksjon til `BankTransactionInput`. Fortegn
 * fra `credit_debit_indicator` (DBIT = negativ), beløp EKSAKT til øre (aldri
 * flyttall). Mangler `entry_reference` bygges en deterministisk id fra dato+beløp+
 * tekst (stabil idempotensnøkkel). Ugyldig dato/beløp eller nullbeløp → null.
 */
export function mapEnableTransaction(tx: EbTransaction): BankTransactionInput | null {
  const bookedDate = tx.booking_date ?? tx.value_date;
  const amountStr = tx.transaction_amount?.amount;
  if (!bookedDate || !amountStr || !/^\d{4}-\d{2}-\d{2}$/.test(bookedDate)) return null;
  const currency = tx.transaction_amount?.currency ?? 'NOK';
  let magnitude: bigint;
  try {
    magnitude = moneyFromDecimalString(amountStr.replace(/^[-+]/, '').trim(), currency).minorUnits;
  } catch {
    return null;
  }
  const debit = (tx.credit_debit_indicator ?? '').toUpperCase() === 'DBIT';
  const amountMinor = debit ? -magnitude : magnitude;
  if (amountMinor === 0n) return null;
  const description =
    tx.remittance_information && tx.remittance_information.length
      ? tx.remittance_information.join(' ')
      : debit
        ? 'Utbetaling'
        : 'Innbetaling';
  const counterparty = debit ? tx.creditor?.name : tx.debtor?.name;
  const externalId = tx.entry_reference ?? `${bookedDate}:${amountMinor.toString()}:${description}`.slice(0, 200);
  return { externalId, bookedDate, amountMinor, currency, description, ...(counterparty ? { counterparty } : {}) };
}

export class EnableBankingBankFeedProvider implements BankFeedProvider {
  readonly name = 'enablebanking';

  constructor(
    private readonly config: EnableBankingConfig | undefined,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 20000,
    private readonly nowSeconds: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  get configured(): boolean {
    return Boolean(this.config?.applicationId && this.config?.privateKeyPem);
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new BankFeedNotConfiguredError(
        'Bank-feed er ikke konfigurert (REKNAREN_ENABLEBANKING_APP_ID + REKNAREN_ENABLEBANKING_PRIVATE_KEY mangler).',
      );
    }
  }

  private authHeader(): string {
    return `Bearer ${signEnableJwt(this.config as EnableBankingConfig, this.nowSeconds())}`;
  }

  private async request(
    path: string,
    init: { method: string; body?: string },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${EB_BASE}${path}`, {
        method: init.method,
        headers: { accept: 'application/json', 'content-type': 'application/json', authorization: this.authHeader() },
        ...(init.body ? { body: init.body } : {}),
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        throw new BankFeedNotConfiguredError(`Enable Banking avviste legitimasjonen (${res.status}).`);
      }
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 200);
        throw new BankFeedError(`Enable Banking svarte med status ${res.status}. ${detail}`.trim(), res.status);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async listInstitutions(country: string): Promise<BankInstitution[]> {
    this.ensureConfigured();
    const body = (await this.request(`/aspsps?country=${encodeURIComponent(country.toUpperCase())}`, {
      method: 'GET',
    })) as { aspsps?: Array<{ name?: string; bic?: string; logo?: string }> };
    return (body.aspsps ?? [])
      .filter((a): a is { name: string; bic?: string; logo?: string } => Boolean(a.name))
      .map((a) => ({ id: a.name, name: a.name, ...(a.bic ? { bic: a.bic } : {}), ...(a.logo ? { logo: a.logo } : {}) }));
  }

  async createRequisition(params: {
    institutionId: string;
    redirectUrl: string;
    reference: string;
  }): Promise<RequisitionLink> {
    this.ensureConfigured();
    const validUntil = new Date((this.nowSeconds() + 90 * 24 * 3600) * 1000).toISOString();
    const body = (await this.request('/auth', {
      method: 'POST',
      body: JSON.stringify({
        access: { valid_until: validUntil },
        aspsp: { name: params.institutionId, country: 'NO' },
        state: params.reference,
        redirect_url: params.redirectUrl,
        psu_type: 'business',
      }),
    })) as { url?: string; authorization_id?: string };
    if (!body.url) throw new BankFeedError('Enable Banking returnerte ikke en samtykkelenke.');
    return { requisitionId: body.authorization_id ?? '', link: body.url };
  }

  async completeConsent(params: ConsentCompletion): Promise<RequisitionAccounts> {
    this.ensureConfigured();
    if (!params.code) {
      throw new BankFeedError('Enable Banking krever «code» fra redirect-URL-en for å fullføre samtykket.');
    }
    const body = (await this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ code: params.code }),
    })) as { session_id?: string; accounts?: Array<string | { uid?: string }> };
    const ids = (body.accounts ?? [])
      .map((a) => (typeof a === 'string' ? a : a.uid))
      .filter((x): x is string => Boolean(x));
    return { status: ids.length ? 'AUTHORIZED' : 'PENDING', accountIds: ids };
  }

  async fetchTransactions(params: { connectionId: string; sinceDate?: string }): Promise<BankFeedResult> {
    this.ensureConfigured();
    const query = params.sinceDate ? `?date_from=${encodeURIComponent(params.sinceDate)}` : '';
    const body = (await this.request(`/accounts/${encodeURIComponent(params.connectionId)}/transactions${query}`, {
      method: 'GET',
    })) as { transactions?: EbTransaction[] };
    const transactions = (body.transactions ?? [])
      .map(mapEnableTransaction)
      .filter((t): t is BankTransactionInput => t !== null);
    return { transactions, ...(params.sinceDate ? { sinceDate: params.sinceDate } : {}) };
  }
}

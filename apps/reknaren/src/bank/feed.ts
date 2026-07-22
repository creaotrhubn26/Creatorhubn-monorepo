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

/** Status + konto-ID-er en fullført requisition peker på. */
export interface RequisitionAccounts {
  status: string;
  accountIds: string[];
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
  /** Henter konto-ID-ene en (forhåpentlig fullført) requisition gir tilgang til. */
  getRequisitionAccounts(requisitionId: string): Promise<RequisitionAccounts>;
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

  async getRequisitionAccounts(requisitionId: string): Promise<RequisitionAccounts> {
    this.ensureConfigured();
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
  async getRequisitionAccounts(): Promise<RequisitionAccounts> {
    this.fail();
  }
  async fetchTransactions(): Promise<BankFeedResult> {
    this.fail();
  }
}

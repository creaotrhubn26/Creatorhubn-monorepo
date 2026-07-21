/**
 * Stripe-lesing (kun LES) — henter betalte fakturaer slik at betalende kunder hos
 * Creatorhub / The Role Room / Leadgrid kan registreres i regnskapet.
 *
 * Prinsipp: beløp kommer ordrett fra Stripe (bigint i minste valutaenhet — øre for
 * NOK). Ingen tall utledes av AI. Klienten muterer ALDRI noe i Stripe (kun GET).
 * Uten nøkkel (`REKNAREN_STRIPE_SECRET_KEY`) er integrasjonen ærlig inaktiv:
 * `listPaidInvoices` kaster `StripeError` før nettverkskall.
 *
 * Anbefalt: en Stripe RESTRICTED key med kun lese-tilgang til Invoices/Customers.
 */

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

export class StripeAuthError extends StripeError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = 'StripeAuthError';
  }
}

/** Én linje på Stripe-fakturaen — «hva» kunden betalte for. */
export interface StripeLineItem {
  description: string;
  /** Linjebeløp i minste valutaenhet (øre for NOK), eks. evt. mva. */
  amountMinor: bigint;
  /** Antall (heltall; default 1). */
  quantity: number;
  /** Faktureringsperiode for linjen (ISO yyyy-mm-dd), når oppgitt. */
  periodStart: string | null;
  periodEnd: string | null;
  /** Kilde-produkt for denne linjen ('creatorhub'|'role_room'|'leadgrid'|null). */
  sourceProduct: string | null;
}

export interface StripePaidInvoice {
  /** Stripe-faktura-id (in_…). Idempotensnøkkel. */
  id: string;
  /** Menneskelesbart Stripe-fakturanummer (f.eks. ABCD-0001). */
  number: string | null;
  /** Lenke til Stripe-fakturaen/kvitteringen (full kildedetalj). */
  hostedInvoiceUrl: string | null;
  stripeCustomerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  /** Betalt beløp i minste valutaenhet (øre for NOK). */
  amountMinor: bigint;
  /** ISO 4217, store bokstaver (NOK, USD, …). */
  currency: string;
  /** Kort samlebeskrivelse — brukes når det ikke finnes linjer. */
  description: string;
  /** Fakturadato (ISO yyyy-mm-dd), utledet fra Stripes created/finalized. */
  date: string;
  /** Faktureringsperiode for fakturaen (ISO yyyy-mm-dd), når oppgitt. */
  periodStart: string | null;
  periodEnd: string | null;
  /** Itemiserte linjer — hva kunden faktisk betalte for. */
  lineItems: StripeLineItem[];
  /**
   * Kilde-produkt utledet av Stripe-metadata/linjer når mulig
   * ('creatorhub' | 'role_room' | 'leadgrid' | null).
   */
  sourceProduct: string | null;
}

export interface StripeReadPort {
  /** Er en Stripe-nøkkel konfigurert? Styrer ærlig statusrapportering. */
  readonly hasApiKey: boolean;
  /**
   * Alle betalte fakturaer, valgfritt kun de opprettet etter `sinceUnix`
   * (unix-sekunder). Kaster `StripeAuthError` uten nøkkel (før nettverkskall).
   */
  listPaidInvoices(sinceUnix?: number): Promise<StripePaidInvoice[]>;
}

type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

const STRIPE_API = 'https://api.stripe.com/v1';

interface StripeLineRaw {
  description?: string | null;
  amount?: number;
  quantity?: number;
  period?: { start?: number; end?: number } | null;
  price?: { product?: string | null; nickname?: string | null } | null;
  plan?: { nickname?: string | null } | null;
  metadata?: Record<string, string>;
}

interface StripeInvoiceRaw {
  id?: string;
  number?: string | null;
  hosted_invoice_url?: string | null;
  customer?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  amount_paid?: number;
  currency?: string;
  description?: string | null;
  created?: number;
  period_start?: number;
  period_end?: number;
  status?: string;
  lines?: { data?: StripeLineRaw[] };
  metadata?: Record<string, string>;
}

function unixToDate(u?: number | null): string | null {
  return typeof u === 'number' && u > 0 ? new Date(u * 1000).toISOString().slice(0, 10) : null;
}

/** Utleder kilde-produkt fra metadata/beskrivelse. Best-effort, ellers null. */
export function deriveSourceProduct(inv: {
  metadata?: Record<string, string>;
  description?: string | null;
  lineText?: string | null;
}): string | null {
  const hay = [
    inv.metadata?.['product'],
    inv.metadata?.['app'],
    inv.description,
    inv.lineText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/role.?room|the ?role/.test(hay)) return 'role_room';
  if (/leadgrid|lead ?map/.test(hay)) return 'leadgrid';
  if (/creatorhub|creator ?hub|post ?agent/.test(hay)) return 'creatorhub';
  return null;
}

export class StripeApiClient implements StripeReadPort {
  constructor(
    private readonly apiKey: string | undefined = undefined,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 15000,
    private readonly baseUrl: string = STRIPE_API,
  ) {}

  get hasApiKey(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async listPaidInvoices(sinceUnix?: number): Promise<StripePaidInvoice[]> {
    if (!this.hasApiKey) {
      throw new StripeAuthError(
        'Stripe er ikke konfigurert (REKNAREN_STRIPE_SECRET_KEY mangler). Inntektssynk er ikke aktiv.',
      );
    }
    const out: StripePaidInvoice[] = [];
    let startingAfter: string | undefined;
    // Stripe-paginering: maks 100 pr. side, følg has_more.
    for (let page = 0; page < 100; page++) {
      const params = new URLSearchParams({ status: 'paid', limit: '100' });
      if (sinceUnix) params.set('created[gte]', String(sinceUnix));
      if (startingAfter) params.set('starting_after', startingAfter);
      const body = await this.get(`/invoices?${params.toString()}`);
      const data = Array.isArray(body.data) ? (body.data as StripeInvoiceRaw[]) : [];
      for (const inv of data) out.push(mapInvoice(inv));
      if (!body.has_more || data.length === 0) break;
      startingAfter = data[data.length - 1]?.id;
      if (!startingAfter) break;
    }
    return out;
  }

  private async get(path: string): Promise<{ data?: unknown[]; has_more?: boolean }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { authorization: `Bearer ${this.apiKey}`, accept: 'application/json' },
      });
      if (res.status === 401) throw new StripeAuthError('Stripe avviste nøkkelen (401).', 401);
      if (!res.ok) throw new StripeError(`Stripe svarte med status ${res.status}.`, res.status);
      return (await res.json()) as { data?: unknown[]; has_more?: boolean };
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapInvoice(inv: StripeInvoiceRaw): StripePaidInvoice {
  const rawLines = inv.lines?.data ?? [];
  const lineItems: StripeLineItem[] = rawLines.map((l) => {
    const desc =
      (l.description && l.description.trim()) ||
      (l.price?.nickname && l.price.nickname.trim()) ||
      (l.plan?.nickname && l.plan.nickname.trim()) ||
      'Linje';
    return {
      description: desc,
      amountMinor: BigInt(l.amount ?? 0),
      quantity: typeof l.quantity === 'number' && l.quantity > 0 ? l.quantity : 1,
      periodStart: unixToDate(l.period?.start),
      periodEnd: unixToDate(l.period?.end),
      sourceProduct: deriveSourceProduct({
        ...(l.metadata ? { metadata: l.metadata } : {}),
        description: l.description ?? null,
        lineText: l.price?.nickname ?? l.plan?.nickname ?? null,
      }),
    };
  });
  const firstLine = rawLines[0];
  const description =
    (inv.description && inv.description.trim()) ||
    (firstLine?.description && firstLine.description.trim()) ||
    'Stripe-faktura';
  const date = unixToDate(inv.created) ?? new Date().toISOString().slice(0, 10);
  return {
    id: inv.id ?? '',
    number: inv.number ?? null,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    stripeCustomerId: inv.customer ?? null,
    customerName: inv.customer_name ?? null,
    customerEmail: inv.customer_email ?? null,
    amountMinor: BigInt(inv.amount_paid ?? 0),
    currency: (inv.currency ?? 'nok').toUpperCase(),
    description,
    date,
    periodStart: unixToDate(inv.period_start),
    periodEnd: unixToDate(inv.period_end),
    lineItems,
    sourceProduct:
      lineItems.find((li) => li.sourceProduct)?.sourceProduct ??
      deriveSourceProduct({
        ...(inv.metadata ? { metadata: inv.metadata } : {}),
        description: inv.description ?? null,
        lineText: firstLine?.description ?? null,
      }),
  };
}

/** Test-/sandboxstub: deterministiske betalte fakturaer uten nettverk. */
export class StaticStripeStub implements StripeReadPort {
  readonly hasApiKey: boolean;

  constructor(
    private readonly invoices: StripePaidInvoice[] = [],
    opts: { hasApiKey?: boolean } = {},
  ) {
    this.hasApiKey = opts.hasApiKey ?? true;
  }

  async listPaidInvoices(sinceUnix?: number): Promise<StripePaidInvoice[]> {
    if (!this.hasApiKey) throw new StripeAuthError('Stub uten Stripe-nøkkel.');
    return this.invoices;
  }
}

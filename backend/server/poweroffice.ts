/**
 * server/poweroffice.ts
 *
 * PowerOffice Go v2-klient for Creatorhubn fotograf-faktura.
 *
 * Auth: OAuth 2.0 client_credentials (RFC 6749 §4.4)
 *   POST {AUTH_URL}
 *     Authorization: Basic base64(APPLICATION_KEY:CLIENT_KEY)
 *     Ocp-Apim-Subscription-Key: {SUBSCRIPTION_KEY}
 *     body: grant_type=client_credentials
 *
 * Access-token har 20-min TTL og caches per tenant. APPLICATION_KEY og
 * SUBSCRIPTION_KEY er developer-shared (ENV); clientKey er per-tenant.
 *
 * Faktura-flow (PO Go v2 har INGEN POST /OutgoingInvoices — den er
 * read-only). Vi bruker SalesOrders + CreateAndSendInvoice:
 *
 *   1. ensureCustomer    → POST /Customers (eller GET-finn eksisterende) → customerId
 *   2. ensureProduct     → POST /Products (eller GET-finn eksisterende) → productId
 *   3. createSalesOrder  → POST /SalesOrders med CustomerId → salesOrderId
 *   4. addLines          → POST /SalesOrders/{id}/Lines (én per linje)
 *   5. sendInvoice       → POST /SalesOrders/{id}/CreateAndSendInvoice
 *                          (returnerer 202 Accepted — asynkron)
 *
 * Docs:
 *   https://developer.poweroffice.net/documentation
 *   Swagger: https://prdm0go0stor0apiv20eurw.z6.web.core.windows.net/
 */

const APPLICATION_KEY = process.env.POWEROFFICE_APPLICATION_KEY || '';
const SUBSCRIPTION_KEY_PRIMARY = process.env.POWEROFFICE_SUBSCRIPTION_KEY || '';
const SUBSCRIPTION_KEY_SECONDARY = process.env.POWEROFFICE_SUBSCRIPTION_KEY_SECONDARY || '';
const AUTH_URL = process.env.POWEROFFICE_AUTH_URL || 'https://goapi.poweroffice.net/Demo/OAuth/Token';
const BASE_URL = process.env.POWEROFFICE_BASE_URL || 'https://goapi.poweroffice.net/demo/v2';

let activeSubscriptionKey: 'primary' | 'secondary' = 'primary';

function currentSubscriptionKey(): string {
  if (activeSubscriptionKey === 'secondary' && SUBSCRIPTION_KEY_SECONDARY) {
    return SUBSCRIPTION_KEY_SECONDARY;
  }
  return SUBSCRIPTION_KEY_PRIMARY;
}

function otherSubscriptionKey(): string | null {
  if (activeSubscriptionKey === 'primary' && SUBSCRIPTION_KEY_SECONDARY) {
    return SUBSCRIPTION_KEY_SECONDARY;
  }
  if (activeSubscriptionKey === 'secondary' && SUBSCRIPTION_KEY_PRIMARY) {
    return SUBSCRIPTION_KEY_PRIMARY;
  }
  return null;
}

function isSubscriptionRejection(status: number): boolean {
  return status === 401 || status === 403;
}

export function isPowerOfficeConfigured(): boolean {
  return !!(APPLICATION_KEY && SUBSCRIPTION_KEY_PRIMARY);
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const TOKEN_TTL_MS = 19 * 60 * 1000;

export class PowerOfficeAuthError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'PowerOfficeAuthError';
  }
}

export class PowerOfficeApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly body?: unknown) {
    super(message);
    this.name = 'PowerOfficeApiError';
  }
}

async function fetchAccessToken(clientKey: string): Promise<string> {
  if (!isPowerOfficeConfigured()) {
    throw new PowerOfficeAuthError('PowerOffice keys not configured (POWEROFFICE_APPLICATION_KEY + POWEROFFICE_SUBSCRIPTION_KEY)');
  }
  const basic = Buffer.from(`${APPLICATION_KEY}:${clientKey}`).toString('base64');

  const doFetch = async (subKey: string) => fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Ocp-Apim-Subscription-Key': subKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  let res = await doFetch(currentSubscriptionKey());

  if (isSubscriptionRejection(res.status)) {
    const other = otherSubscriptionKey();
    if (other) {
      console.warn('[poweroffice] subscription-key rejected, rotating to backup');
      res = await doFetch(other);
      if (res.ok) {
        activeSubscriptionKey = activeSubscriptionKey === 'primary' ? 'secondary' : 'primary';
      }
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new PowerOfficeAuthError(
      `Token exchange failed (${res.status}): ${body.slice(0, 300)}`,
      res.status,
    );
  }

  const json = await res.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new PowerOfficeAuthError('Token response missing access_token');
  }
  return json.access_token;
}

export async function getAccessToken(clientKey: string): Promise<string> {
  const cached = tokenCache.get(clientKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }
  const accessToken = await fetchAccessToken(clientKey);
  tokenCache.set(clientKey, { accessToken, expiresAt: Date.now() + TOKEN_TTL_MS });
  return accessToken;
}

export function invalidateToken(clientKey: string): void {
  tokenCache.delete(clientKey);
}

export async function verifyClientKey(clientKey: string): Promise<boolean> {
  try {
    await fetchAccessToken(clientKey);
    return true;
  } catch (err) {
    if (err instanceof PowerOfficeAuthError) return false;
    throw err;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
}

export async function call<T = unknown>(clientKey: string, opts: RequestOptions): Promise<T> {
  if (!isPowerOfficeConfigured()) {
    throw new PowerOfficeAuthError('PowerOffice not configured');
  }

  const url = new URL(BASE_URL.replace(/\/$/, '') + opts.path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const doRequest = async (token: string, subKey: string): Promise<Response> =>
    fetch(url.toString(), {
      method: opts.method || 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': subKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

  let token = await getAccessToken(clientKey);
  let res = await doRequest(token, currentSubscriptionKey());

  if (res.status === 401) {
    invalidateToken(clientKey);
    token = await getAccessToken(clientKey);
    res = await doRequest(token, currentSubscriptionKey());
  }

  if (isSubscriptionRejection(res.status)) {
    const other = otherSubscriptionKey();
    if (other) {
      console.warn('[poweroffice] API call rejected subscription-key, rotating to backup');
      res = await doRequest(token, other);
      if (res.ok) {
        activeSubscriptionKey = activeSubscriptionKey === 'primary' ? 'secondary' : 'primary';
      }
    }
  }

  if (!res.ok) {
    let body: unknown = undefined;
    try { body = await res.json(); } catch { body = await res.text().catch(() => ''); }
    throw new PowerOfficeApiError(
      `PowerOffice ${opts.method || 'GET'} ${opts.path} failed (${res.status})`,
      res.status,
      body,
    );
  }

  if (res.status === 204) return undefined as T;
  // PO Go v2 GET-collection returnerer noen ganger { items: [...], totalCount }
  // og noen ganger bare en bar array; POST/single returnerer DTO direkte.
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────
// PowerOffice Go v2 DTO-typer (kun feltene vi bruker)
// ─────────────────────────────────────────────────────────────────────

interface CustomerDto {
  Id: number;
  Number?: number;
  Name?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  EmailAddress?: string | null;
}

interface ProductDto {
  Id: number;
  Code?: string | null;
  Name?: string | null;
}

interface SalesOrderDto {
  Id: string;            // uuid
  SalesOrderNo?: number;
  CustomerId?: number;
}

interface SendInvoiceRequestDto {
  Id?: string;
  Status?: string;
  // Andre felt finnes; vi bruker ikke dem.
}

// ─────────────────────────────────────────────────────────────────────
// Domene-input fra invoice-route
// ─────────────────────────────────────────────────────────────────────

export type CustomerType = 'person' | 'company';

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPriceNet: number;   // eks MVA — PO bruker dette som ProductUnitPrice
}

export interface CreateInvoiceInput {
  clientKey: string;
  /** Lagret PO-product-id fra forrige tilkobling. null hvis vi må opprette. */
  cachedProductId: number | null;
  customer: {
    type: CustomerType;
    /** For person: full name vi splitter til first/last. For company: brukes som Name. */
    name: string;
    email: string;
    organizationNumber?: string | null;  // bare company
    phone?: string | null;
  };
  reference?: string | null;             // ekstern kunde-referanse (prosjekt-tittel)
  lines: InvoiceLineInput[];
  /** PdfByEmail | Auto | EHF | Efaktura | AvtaleGiro | PdfPrintForDownload */
  deliveryType?: 'Auto' | 'PdfByEmail' | 'EHF' | 'Efaktura' | 'AvtaleGiro' | 'PdfPrintForDownload';
}

export interface CreateInvoiceResult {
  /** PO sin SalesOrder Id (uuid). Lagres som external_invoice_id. */
  salesOrderId: string;
  /** SalesOrderNo (autogen, før sending). null hvis ikke returnert. */
  salesOrderNumber: number | null;
  /** Produkt-id vi (kanskje) opprettet — caller skal lagre denne tilbake. */
  productId: number;
  /** True hvis vi opprettet produktet i denne kjøringen (caller bør lagre default_product_id). */
  productJustCreated: boolean;
  /** Status fra send-request. Den faktiske fakturanummer kommer asynkront i PO. */
  sendStatus: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Customer
// ─────────────────────────────────────────────────────────────────────

function splitName(full: string): { first: string; last: string } {
  const trimmed = full.trim();
  if (!trimmed) return { first: '', last: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return {
    first: parts.slice(0, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

async function findCustomerByEmail(clientKey: string, email: string): Promise<CustomerDto | null> {
  // PO Go v2 GET /Customers støtter ?emailAddresses=<email>&PageSize=1.
  // Returnerer:
  //   200 + bare array av CustomerDto (verifisert mot demo)
  //   204 No Content når ingen treff
  //   evt. { items: [...] } i andre miljøer (defensiv)
  type Resp = CustomerDto[] | { items?: CustomerDto[] } | undefined;
  const res = await call<Resp>(clientKey, {
    method: 'GET',
    path: '/Customers',
    query: { emailAddresses: email, PageSize: 1 },
  }).catch(() => null);
  if (!res) return null;
  const arr = Array.isArray(res) ? res : (res.items ?? []);
  return arr[0] ?? null;
}

async function ensureCustomer(clientKey: string, c: CreateInvoiceInput['customer']): Promise<number> {
  const existing = await findCustomerByEmail(clientKey, c.email);
  if (existing?.Id) return existing.Id;

  const body: Record<string, unknown> = {
    EmailAddress: c.email,
    InvoiceEmailAddress: c.email,
    PhoneNumber: c.phone ?? undefined,
    IsPerson: c.type === 'person',
  };

  if (c.type === 'person') {
    const { first, last } = splitName(c.name);
    body.FirstName = first || c.name;
    // PO krever LastName når IsPerson=true. Fallback til '-' hvis brukeren
    // bare ga ett ord (PO godtar dette og gir bedre signal enn å feile).
    body.LastName = last || '-';
  } else {
    body.Name = c.name;
    if (c.organizationNumber) body.OrganizationNumber = c.organizationNumber;
  }

  const created = await call<CustomerDto>(clientKey, {
    method: 'POST',
    path: '/Customers',
    body,
  });
  if (!created?.Id) {
    throw new PowerOfficeApiError('Customer create returnerte ikke Id', 502, created);
  }
  return created.Id;
}

// ─────────────────────────────────────────────────────────────────────
// Product (auto-opprett "Creatorhubn fotograf-tjeneste" per tenant)
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_PRODUCT_CODE = 'CHUB-FOTO';
const DEFAULT_PRODUCT_NAME = 'Creatorhubn fotograf-tjeneste';
// 3000 = "Salgsinntekter, avgiftspliktig" i norsk standardkontoplan.
// Eksisterer i alle PO Go-tenants som standardkonto for tjeneste-salg.
const DEFAULT_SALES_ACCOUNT = 3000;

async function findProductByCode(clientKey: string, code: string): Promise<ProductDto | null> {
  type Resp = ProductDto[] | { items?: ProductDto[] };
  const res = await call<Resp>(clientKey, {
    method: 'GET',
    path: '/Products',
    query: { codes: code, PageSize: 1 },
  }).catch(() => null);
  if (!res) return null;
  const arr = Array.isArray(res) ? res : (res.items ?? []);
  return arr[0] ?? null;
}

/** Returnerer { productId, justCreated }. Validerer cachedProductId mot tenant. */
async function ensureProduct(
  clientKey: string,
  cachedProductId: number | null,
): Promise<{ productId: number; justCreated: boolean }> {
  if (cachedProductId) {
    // Vi har en cached id. Anta at den er gyldig — om den er arkivert
    // eller feil, vil POST /Lines feile og caller får 502 m. tydelig
    // feilmelding. Sparing av et GET /Products/{id}-kall per faktura.
    return { productId: cachedProductId, justCreated: false };
  }

  // Først: finn eksisterende ved code (idempotent ved gjentatt connect).
  const existing = await findProductByCode(clientKey, DEFAULT_PRODUCT_CODE);
  if (existing?.Id) return { productId: existing.Id, justCreated: true };

  const created = await call<ProductDto>(clientKey, {
    method: 'POST',
    path: '/Products',
    body: {
      Code: DEFAULT_PRODUCT_CODE,
      Name: DEFAULT_PRODUCT_NAME,
      Description: 'Auto-opprettet av Creatorhubn ved første faktura-push',
      ProductType: 'Service',
      UnitOfMeasureCode: 'EA',
      StandardSalesAccount: DEFAULT_SALES_ACCOUNT,
      IsStockItem: false,
    },
  });
  if (!created?.Id) {
    throw new PowerOfficeApiError('Product create returnerte ikke Id', 502, created);
  }
  return { productId: created.Id, justCreated: true };
}

// ─────────────────────────────────────────────────────────────────────
// SalesOrder + Lines + Send
// ─────────────────────────────────────────────────────────────────────

/**
 * Opprett salgsordre med alle linjer i ett enkelt kall.
 *
 * Merk: POST /SalesOrders finnes IKKE — vi må bruke /SalesOrders/Complete
 * som tar SalesOrderLines inline. Verifisert mot demo-tenant 2026-05-31.
 */
async function createSalesOrderWithLines(
  clientKey: string,
  customerId: number,
  productId: number,
  lines: InvoiceLineInput[],
  reference?: string | null,
): Promise<SalesOrderDto> {
  const today = new Date().toISOString().slice(0, 10);
  const body = {
    CustomerId: customerId,
    SalesOrderDate: today,
    CurrencyCode: 'NOK',
    CustomerReference: reference?.slice(0, 100) ?? null,
    SalesOrderLines: lines.map((line, idx) => ({
      LineType: 'Normal',
      ProductId: productId,
      Description: line.description.slice(0, 500),
      Quantity: line.quantity,
      ProductUnitPrice: line.unitPriceNet,
      UnitOfMeasureCode: 'EA',
      SortOrder: idx,
    })),
  };
  const created = await call<SalesOrderDto>(clientKey, {
    method: 'POST',
    path: '/SalesOrders/Complete',
    body,
  });
  if (!created?.Id) {
    throw new PowerOfficeApiError('SalesOrder create returnerte ikke Id', 502, created);
  }
  return created;
}

async function sendInvoice(
  clientKey: string,
  salesOrderId: string,
  emailAddress: string,
  deliveryType: NonNullable<CreateInvoiceInput['deliveryType']>,
): Promise<SendInvoiceRequestDto> {
  // 202 Accepted — async. Body er SendInvoiceRequestPostDto. Bare
  // DeliveryType + EmailAddress er nødvendig; resten arves fra ordren.
  const res = await call<SendInvoiceRequestDto>(clientKey, {
    method: 'POST',
    path: `/SalesOrders/${encodeURIComponent(salesOrderId)}/CreateAndSendInvoice`,
    body: {
      DeliveryType: deliveryType,
      EmailAddress: emailAddress,
    },
  });
  return res ?? {};
}

// ─────────────────────────────────────────────────────────────────────
// Public entry-point
// ─────────────────────────────────────────────────────────────────────

export async function createInvoiceViaSalesOrder(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const { productId, justCreated } = await ensureProduct(input.clientKey, input.cachedProductId);
  const customerId = await ensureCustomer(input.clientKey, input.customer);

  // /SalesOrders/Complete oppretter ordre + alle linjer i ett kall.
  const so = await createSalesOrderWithLines(
    input.clientKey,
    customerId,
    productId,
    input.lines,
    input.reference,
  );

  const sendReq = await sendInvoice(
    input.clientKey,
    so.Id,
    input.customer.email,
    input.deliveryType ?? 'Auto',
  );

  return {
    salesOrderId: so.Id,
    salesOrderNumber: so.SalesOrderNo ?? null,
    productId,
    productJustCreated: justCreated,
    sendStatus: sendReq.Status ?? null,
  };
}

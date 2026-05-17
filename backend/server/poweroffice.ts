/**
 * server/poweroffice.ts
 *
 * Port av Tidsflyt sin PowerOffice Go v2-klient, tilpasset Creatorhubn
 * sin photographer e2e (faktura-push for prosjekt-oppdrag).
 *
 * Auth er OAuth 2.0 client_credentials (RFC 6749 §4.4):
 *   POST {AUTH_URL}
 *     Authorization: Basic base64(APPLICATION_KEY:CLIENT_KEY)
 *     Ocp-Apim-Subscription-Key: {SUBSCRIPTION_KEY}
 *     body: grant_type=client_credentials
 *
 * Access-token har 20-min TTL og caches per tenant (per photographer-id
 * sin clientKey). APPLICATION_KEY og SUBSCRIPTION_KEY er developer-shared
 * (ENV); clientKey er per-tenant (limt inn av fotograf i innstillinger).
 *
 * Docs: https://developer.poweroffice.net/documentation/authentication
 */

const APPLICATION_KEY = process.env.POWEROFFICE_APPLICATION_KEY || '';
const SUBSCRIPTION_KEY_PRIMARY = process.env.POWEROFFICE_SUBSCRIPTION_KEY || '';
const SUBSCRIPTION_KEY_SECONDARY = process.env.POWEROFFICE_SUBSCRIPTION_KEY_SECONDARY || '';
const AUTH_URL = process.env.POWEROFFICE_AUTH_URL || 'https://goapi.poweroffice.net/Demo/OAuth/Token';
const BASE_URL = process.env.POWEROFFICE_BASE_URL || 'https://goapi.poweroffice.net/demo/v2';

// APIM-rotering — primary brukes først, rotér til secondary ved 401/403.
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
  query?: Record<string, string | number | undefined>;
}

export async function call<T = unknown>(clientKey: string, opts: RequestOptions): Promise<T> {
  if (!isPowerOfficeConfigured()) {
    throw new PowerOfficeAuthError('PowerOffice not configured');
  }

  const url = new URL(BASE_URL.replace(/\/$/, '') + opts.path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
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
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────
// Photographer-spesifikke invoice-helpers
// ─────────────────────────────────────────────────────────────────────────

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;    // eks MVA
  vatRate?: number;     // % (25, 12, 0)
}

export interface CreateInvoiceInput {
  clientKey: string;
  clientName: string;
  clientEmail: string;
  invoiceDate?: string;        // YYYY-MM-DD, default i dag
  dueDate?: string;            // YYYY-MM-DD, default +14d
  reference?: string;          // prosjekt-tittel eller intern referanse
  lines: InvoiceLine[];
}

export interface CreateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string | null;
  status: string | null;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Sikrer at en kunde finnes i PowerOffice (matcher på email/navn) og
 * returnerer customerCode. PowerOffice Go API gir POST /Customers og
 * GET /Customers?email=... — vi prøver lookup først, ellers create.
 */
async function ensureCustomerCode(input: { clientKey: string; clientName: string; clientEmail: string }): Promise<string> {
  // Lookup via email
  try {
    const lookup = await call<{ data?: Array<{ code?: string; emailAddress?: string }> }>(input.clientKey, {
      method: 'GET',
      path: '/Customers',
      query: { '$filter': `emailAddress eq '${input.clientEmail.replace(/'/g, "''")}'`, '$top': 1 },
    });
    const existing = lookup?.data?.[0]?.code;
    if (existing) return String(existing);
  } catch (err) {
    // Lookup-failure er ikke fatal — vi prøver create.
    console.warn('[poweroffice] customer lookup failed, falling back to create:', err);
  }

  // Create — PowerOffice Go forventer minimum name + emailAddress.
  const created = await call<{ code?: string; data?: { code?: string } }>(input.clientKey, {
    method: 'POST',
    path: '/Customers',
    body: {
      name: input.clientName,
      emailAddress: input.clientEmail,
      isPerson: true,
    },
  });
  const code = created?.code ?? created?.data?.code;
  if (!code) throw new PowerOfficeApiError('Customer create returnerte ikke code', 500, created);
  return String(code);
}

/**
 * Opprett faktura i PowerOffice Go. Returnerer invoice-id/nummer som
 * lagres på prosjektet vårt for å unngå dobbel-fakturering.
 *
 * Endepunkt: POST /OutgoingInvoices (PowerOffice Go v2). Field-navnene
 * matcher PowerOffice sin OutgoingInvoice-modell; om en tenant har
 * tilpasset feltene, returneres en 400 med detalj som vi videresender.
 */
export async function createOutgoingInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const customerCode = await ensureCustomerCode({
    clientKey: input.clientKey,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
  });

  const invoiceDate = input.invoiceDate || new Date().toISOString().slice(0, 10);
  const dueDate = input.dueDate || addDaysIso(14);

  const payload = {
    customerCode,
    invoiceDate,
    dueDate,
    yourReference: input.reference?.slice(0, 100) ?? null,
    invoiceLines: input.lines.map((l) => ({
      description: l.description.slice(0, 200),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate ?? 25,
    })),
  };

  const created = await call<{ id?: string | number; invoiceNumber?: string | number; status?: string; data?: any }>(
    input.clientKey,
    { method: 'POST', path: '/OutgoingInvoices', body: payload },
  );

  const data = created?.data ?? created;
  const invoiceId = data?.id != null ? String(data.id) : null;
  const invoiceNumber = data?.invoiceNumber != null ? String(data.invoiceNumber) : null;

  if (!invoiceId) {
    throw new PowerOfficeApiError('PowerOffice returnerte ikke invoice-id', 502, created);
  }

  return {
    invoiceId,
    invoiceNumber,
    status: data?.status ?? null,
  };
}

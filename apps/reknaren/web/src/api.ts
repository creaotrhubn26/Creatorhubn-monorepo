/**
 * Tynn API-klient. Token holdes i minne + sessionStorage (dev-innlogging).
 * Beløp kommer som strenger i øre fra API-et og formateres i ui-laget —
 * aldri via flyttall.
 */

let token: string | null = sessionStorage.getItem('reknaren.token');
let currentOrgId: string | null = sessionStorage.getItem('reknaren.orgId');

export function setToken(t: string): void {
  token = t;
  sessionStorage.setItem('reknaren.token', t);
}

export function setUserEmail(email: string): void {
  sessionStorage.setItem('reknaren.email', email);
}

export function getUserEmail(): string | null {
  return sessionStorage.getItem('reknaren.email');
}

export function setOrgId(id: string): void {
  currentOrgId = id;
  sessionStorage.setItem('reknaren.orgId', id);
}

export function getOrgId(): string | null {
  return currentOrgId;
}

export function isLoggedIn(): boolean {
  return token !== null;
}

export function logout(): void {
  token = null;
  currentOrgId = null;
  sessionStorage.clear();
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? `Feil (${res.status})`, res.status, json?.error?.code);
  }
  return json as T;
}

/** Henter rått innhold (f.eks. HTML-salgsdokument) med auth-header. */
export async function apiText(path: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { headers });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiError(json?.error?.message ?? `Feil (${res.status})`, res.status, json?.error?.code);
  }
  return res.text();
}

/** Formaterer øre (streng/bigint) som kroner med norsk format. */
export function kr(minor: string | number | null | undefined): string {
  if (minor === null || minor === undefined) return '–';
  const v = BigInt(minor);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${neg ? '−' : ''}${whole},${frac} kr`;
}

/* ── Kodebibliotek: vanlig norsk foran tekniske koder ──────────────────── */

export interface AccountInfo {
  number: string;
  name: string;
  friendlyName: string;
  plainExplanation: string;
}

export interface VatCodeInfo {
  code: string;
  name: string;
  plainExplanation: string;
}

interface CodeLibrary {
  accounts: Map<string, AccountInfo>;
  vatCodes: Map<string, VatCodeInfo>;
}

let codeLibraryPromise: Promise<CodeLibrary> | null = null;

/** Lastes én gang per session; brukes til å vise vennlige navn i hele UI-et. */
export function loadCodeLibrary(orgId: string): Promise<CodeLibrary> {
  codeLibraryPromise ??= (async () => {
    const [accounts, vatCodes] = await Promise.all([
      api<AccountInfo[]>('GET', `/api/organizations/${orgId}/code-library/accounts`),
      api<VatCodeInfo[]>('GET', `/api/organizations/${orgId}/code-library/vat-codes`),
    ]);
    return {
      accounts: new Map(accounts.map((a) => [a.number, a])),
      vatCodes: new Map(vatCodes.map((v) => [v.code, v])),
    };
  })();
  return codeLibraryPromise;
}

/** Parser kronebeløp ("1 200,50" / "1200.50") til øre-streng — uten flyttall. */
export function parseKrToMinor(value: string): string {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!m) throw new Error(`Ugyldig beløp: «${value}»`);
  return `${m[1]}${(m[2] ?? '').padEnd(2, '0')}`;
}

export const STATUS_LABELS: Record<string, string> = {
  received: 'Mottatt',
  scanning: 'Skannes',
  extracted: 'Klar til kontroll',
  needs_review: 'Trenger gjennomgang',
  approved: 'Godkjent',
  posted: 'Bokført',
  rejected: 'Avvist',
  duplicate: 'Duplikat',
  quarantined: 'Karantene (sikkerhet)',
  unmatched: 'Ikke avstemt',
  matched: 'Avstemt',
  suggested: 'Foreslått',
};

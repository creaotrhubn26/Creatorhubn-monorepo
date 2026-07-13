/**
 * Tynn API-klient. Token holdes i minne + sessionStorage (dev-innlogging).
 * Beløp kommer som strenger i øre fra API-et og formateres i ui-laget —
 * aldri via flyttall.
 */

let token: string | null = sessionStorage.getItem('ledgerly.token');
let currentOrgId: string | null = sessionStorage.getItem('ledgerly.orgId');

export function setToken(t: string): void {
  token = t;
  sessionStorage.setItem('ledgerly.token', t);
}

export function setOrgId(id: string): void {
  currentOrgId = id;
  sessionStorage.setItem('ledgerly.orgId', id);
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
  method: 'GET' | 'POST',
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

/**
 * Magiske innloggingslenker (passordløs, produksjonssikker).
 *
 * Flyt: brukeren oppgir e-post → serveren sender en signert, tidsbegrenset lenke
 * (kun til e-poster på tillatelseslisten) → klikk verifiserer og gir en sesjon.
 * Gjenbruker HMAC-signering med samme REKNAREN_AUTH_SECRET, men med eget
 * «magic:»-prefiks slik at en magisk token ALDRI kan brukes som sesjonstoken.
 *
 * Erstatter dev-login i produksjon (som er av der). Ingen passord lagres.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Magiske lenker er kortlivde. */
export const MAGIC_TTL_MS = 15 * 60 * 1000;

interface MagicPayload {
  email: string;
  p: 'magic';
  iat: number;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(`magic:${data}`).digest('base64url');
}

export function createMagicToken(email: string, secret: string, nowMs: number = Date.now()): string {
  const payload: MagicPayload = { email: email.trim().toLowerCase(), p: 'magic', iat: nowMs };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

/** Returnerer e-posten hvis tokenet er gyldig og ikke utløpt, ellers null. */
export function verifyMagicToken(token: string, secret: string, nowMs: number = Date.now()): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];
  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as MagicPayload;
    if (p.p !== 'magic' || typeof p.email !== 'string' || typeof p.iat !== 'number') return null;
    if (nowMs - p.iat > MAGIC_TTL_MS) return null;
    return p.email;
  } catch {
    return null;
  }
}

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Tillatt hvis eksakt e-post-treff, eller '@domene'-oppføring som matcher domenet. */
export function isAllowedEmail(email: string, allowlist: string[]): boolean {
  const e = email.trim().toLowerCase();
  return allowlist.includes(e) || allowlist.some((a) => a.startsWith('@') && e.endsWith(a));
}

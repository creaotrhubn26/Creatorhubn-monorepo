/**
 * API-autentisering (MVP): HMAC-signerte tokens utstedt av dev-login.
 *
 * PRODUKSJONSSTATUS: Dette er en utviklingsmekanisme. Produksjon krever
 * OIDC/BankID med MFA og sikre sessions (se docs/security-threat-model.md
 * og docs/known-limitations.md). Autorisasjonsmodellen (RBAC per organisasjon)
 * er derimot reell og håndheves på alle endepunkter.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  issuedAt: number;
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function resolveAuthSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.REKNAREN_AUTH_SECRET;
  if (secret) return secret;
  if ((env.NODE_ENV ?? 'development') === 'production') {
    throw new Error('REKNAREN_AUTH_SECRET må settes i produksjon.');
  }
  return 'dev-only-secret-not-for-production';
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function issueToken(payload: AuthTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(token: string, secret: string): AuthTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];
  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (typeof payload.userId !== 'string' || typeof payload.issuedAt !== 'number') return null;
    if (Date.now() - payload.issuedAt > TOKEN_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

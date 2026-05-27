/**
 * consent-portal-routes.ts — mountes under /api/consent.
 *
 * Casting-samtykke (GDPR / signatur — inkl. mindreårige). Erstatter den tidligere
 * stub-en der tilgangskoder ble generert client-side med Math.random() og portal-
 * endepunktene ikke fantes i backend.
 *
 *   • POST /issue          — innlogget: opprett/oppdater samtykke i casting_consents
 *                            med server-generert (kryptografisk) tilgangskode.
 *   • GET  /portal/access  — offentlig: signer slår opp samtykke via tilgangskode (+ PIN/passord).
 *   • POST /portal/sign     — offentlig: signer samtykket (lagrer signatur + signed_at).
 *
 * Sikkerhet: tilgangskode genereres med crypto.randomInt. PIN/passord lagres som
 * SHA-256-hash (saltet med tilgangskoden) i details-kolonnen — aldri i klartekst.
 * Offentlige endepunkt er rate-limited mot brute-force.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import type { Pool } from 'pg';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string };

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === 'string' ? bearer.trim() : '';
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) { activeSessions?.set(token, persisted); return persisted; }
  return null;
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    (req as AuthedRequest).userId = session.userId;
    next();
  };
}

// ── Schema: legg til details-kolonne + unik indeks på access_code (idempotent) ──
let schemaReadyPromise: Promise<void> | null = null;
async function ensureConsentPortalSchema(pool: Pool): Promise<void> {
  await pool.query(`ALTER TABLE casting_consents ADD COLUMN IF NOT EXISTS details JSONB`);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS casting_consents_access_code_key
       ON casting_consents (access_code) WHERE access_code IS NOT NULL`,
  );
}
function schemaReady(pool: Pool): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureConsentPortalSchema(pool).catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  return schemaReadyPromise;
}

// ── Kode-/credential-helpere ──
// Uten lett forvekslelige tegn (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codeSegment(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}
function generateAccessCode(): string {
  return `CONS-${codeSegment(4)}-${codeSegment(4)}-${codeSegment(4)}`;
}
function hashCredential(accessCode: string, value: string): string {
  return createHash('sha256').update(`${accessCode}:${value}`).digest('hex');
}

// ── Rate limiting (in-memory, per ip+kode) ──
const attempts = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 10 * 60_000;
const RL_MAX = 10;
function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RL_MAX;
}
function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd) || req.socket.remoteAddress || 'unknown';
  return String(raw).split(',')[0].trim();
}

function safeJsonParse(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return undefined; }
}

function mapConsentRow(row: Record<string, any>) {
  const details = (row.details as Record<string, any>) || {};
  return {
    id: row.id,
    candidateId: row.candidate_id,
    candidate_id: row.candidate_id,
    projectId: row.project_id,
    project_id: row.project_id,
    type: row.type,
    title: details.title ?? undefined,
    description: details.description ?? undefined,
    document: details.document ?? undefined,
    signed: row.status === 'signed',
    signatureData: safeJsonParse(row.signature_data),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

const issueBody = z.object({
  consentId: z.string().min(1).optional(),
  projectId: z.string().min(1),
  candidateId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  document: z.string().optional(),
  candidateName: z.string().optional(),
  projectName: z.string().optional(),
  pin: z.string().min(1).max(64).optional(),
  password: z.string().min(1).max(128).optional(),
  expiresDays: z.number().int().positive().max(365).optional(),
});

const signBody = z.object({
  accessCode: z.string().min(1),
  pin: z.string().optional(),
  password: z.string().optional(),
  signatureData: z
    .object({
      signature: z.string().min(1),
      signed_by: z.string().min(1),
      signed_at: z.string().optional(),
      ip_address: z.string().optional(),
      user_agent: z.string().optional(),
    })
    .passthrough(),
});

export interface CreateConsentPortalRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createConsentPortalRouter(
  pool: Pool,
  deps: CreateConsentPortalRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // ── POST /issue (innlogget) ──
  router.post('/issue', auth, async (req, res) => {
    try {
      await schemaReady(pool);
    } catch (err) {
      res.status(500).json({ error: 'schema_unavailable', detail: String(err) });
      return;
    }
    const parsed = issueBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const b = parsed.data;
    const id = b.consentId ?? `consent-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const accessCode = generateAccessCode();
    const expiresAt = b.expiresDays ? new Date(Date.now() + b.expiresDays * 86_400_000) : null;
    const details: Record<string, unknown> = {
      title: b.title ?? null,
      description: b.description ?? null,
      document: b.document ?? null,
      candidateName: b.candidateName ?? null,
      projectName: b.projectName ?? null,
      pinHash: b.pin ? hashCredential(accessCode, b.pin) : null,
      passwordHash: b.password ? hashCredential(accessCode, b.password) : null,
    };
    try {
      await pool.query(
        `INSERT INTO casting_consents
           (id, project_id, candidate_id, type, status, access_code, expires_at, details, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           access_code = EXCLUDED.access_code,
           expires_at  = EXCLUDED.expires_at,
           details     = EXCLUDED.details,
           updated_at  = NOW()`,
        [id, b.projectId, b.candidateId, b.type, accessCode, expiresAt, JSON.stringify(details)],
      );
      res.status(201).json({
        success: true,
        id,
        accessCode,
        portalUrl: `/consent-portal?consent_code=${encodeURIComponent(accessCode)}`,
      });
    } catch (err) {
      res.status(500).json({ error: 'issue_failed', detail: String(err) });
    }
  });

  // ── GET /portal/access (offentlig) ──
  router.get('/portal/access', async (req, res) => {
    try {
      await schemaReady(pool);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke validere tilgang' });
      return;
    }
    const accessCode =
      typeof req.query.access_code === 'string' ? req.query.access_code.trim().toUpperCase() : '';
    const pin = typeof req.query.pin === 'string' ? req.query.pin.trim() : '';
    const password = typeof req.query.password === 'string' ? req.query.password.trim() : '';
    if (!accessCode) {
      res.status(400).json({ error: 'Tilgangskode er påkrevd' });
      return;
    }
    if (rateLimited(`${clientIp(req)}:${accessCode}`)) {
      res.status(429).json({ error: 'For mange forsøk. Prøv igjen senere.' });
      return;
    }
    try {
      const result = await pool.query('SELECT * FROM casting_consents WHERE access_code = $1', [accessCode]);
      const row = result.rows[0];
      if (!row) {
        res.status(404).json({ error: 'Ugyldig tilgangskode' });
        return;
      }
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        res.status(410).json({ error: 'Tilgangskoden er utløpt' });
        return;
      }
      const details = (row.details as Record<string, any>) || {};
      const requiresPin = Boolean(details.pinHash);
      const requiresPassword = Boolean(details.passwordHash);
      if (requiresPin && (!pin || hashCredential(accessCode, pin) !== details.pinHash)) {
        res.status(401).json({ requiresPin, requiresPassword, error: pin ? 'Feil PIN' : undefined });
        return;
      }
      if (requiresPassword && (!password || hashCredential(accessCode, password) !== details.passwordHash)) {
        res.status(401).json({ requiresPin, requiresPassword, error: password ? 'Feil passord' : undefined });
        return;
      }
      res.json({
        success: true,
        consent: mapConsentRow(row),
        candidateName: details.candidateName ?? '',
        projectName: details.projectName ?? '',
      });
    } catch {
      res.status(500).json({ error: 'Kunne ikke validere tilgang' });
    }
  });

  // ── POST /portal/sign (offentlig) ──
  router.post('/portal/sign', async (req, res) => {
    try {
      await schemaReady(pool);
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke signere samtykke' });
      return;
    }
    const parsed = signBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Ugyldig signaturdata' });
      return;
    }
    const accessCode = parsed.data.accessCode.trim().toUpperCase();
    const pin = parsed.data.pin?.trim() ?? '';
    const password = parsed.data.password?.trim() ?? '';
    if (rateLimited(`${clientIp(req)}:${accessCode}`)) {
      res.status(429).json({ error: 'For mange forsøk. Prøv igjen senere.' });
      return;
    }
    try {
      const result = await pool.query('SELECT * FROM casting_consents WHERE access_code = $1', [accessCode]);
      const row = result.rows[0];
      if (!row) {
        res.status(404).json({ error: 'Ugyldig tilgangskode' });
        return;
      }
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        res.status(410).json({ error: 'Tilgangskoden er utløpt' });
        return;
      }
      const details = (row.details as Record<string, any>) || {};
      if (details.pinHash && (!pin || hashCredential(accessCode, pin) !== details.pinHash)) {
        res.status(401).json({ requiresPin: true, error: 'Feil PIN' });
        return;
      }
      if (details.passwordHash && (!password || hashCredential(accessCode, password) !== details.passwordHash)) {
        res.status(401).json({ requiresPassword: true, error: 'Feil passord' });
        return;
      }
      if (row.status === 'signed') {
        res.status(409).json({ error: 'Samtykket er allerede signert' });
        return;
      }
      const signatureData = {
        ...parsed.data.signatureData,
        signed_at: parsed.data.signatureData.signed_at || new Date().toISOString(),
        ip_address: parsed.data.signatureData.ip_address || clientIp(req),
        user_agent: parsed.data.signatureData.user_agent || req.headers['user-agent'] || '',
      };
      await pool.query(
        `UPDATE casting_consents
            SET status = 'signed', signed_at = NOW(), signature_data = $2, updated_at = NOW()
          WHERE id = $1`,
        [row.id, JSON.stringify(signatureData)],
      );
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Kunne ikke signere samtykke' });
    }
  });

  return router;
}

/**
 * API-nøkler for det åpne integrasjonslaget. En nøkkel gir et eksternt system
 * scopet, tilbakekallbar tilgang til én virksomhets data — bygget på det SAMME
 * rettighetsvokabularet (access/permissions) som resten av app-en.
 *
 * Sikkerhet: full nøkkel genereres med kryptografisk tilfeldighet, vises KUN én
 * gang, og lagres aldri — kun sha256-hashen. Oppslag skjer på hash (konstant tid
 * er unødvendig her siden nøkkelen er høy-entropi og slås opp via unik indeks).
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { PERMISSIONS, type Permission } from '../access/permissions.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';

const KEY_PREFIX = 'rk_live_';

function hashKey(fullKey: string): string {
  return createHash('sha256').update(fullKey).digest('hex');
}

export interface ApiKeyDto {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function validateScopes(scopes: string[]): Permission[] {
  const valid = new Set<string>(PERMISSIONS);
  const out: Permission[] = [];
  for (const s of scopes) {
    if (!valid.has(s)) throw new ValidationError(`Ukjent scope: ${s}`);
    out.push(s as Permission);
  }
  if (out.length === 0) throw new ValidationError('Minst ett scope kreves.');
  return out;
}

export async function createApiKey(
  db: Db,
  params: { organizationId: string; actor: Actor; name: string; scopes: string[] },
): Promise<{ apiKey: ApiKeyDto; secret: string }> {
  if (!params.name.trim()) throw new ValidationError('Navn kreves.');
  const scopes = validateScopes(params.scopes);
  // rk_live_ + 32 tilfeldige byte (64 hex-tegn) = høy entropi.
  const random = randomBytes(32).toString('hex');
  const fullKey = `${KEY_PREFIX}${random}`;
  const keyPrefix = `${KEY_PREFIX}${random.slice(0, 6)}`; // trygt visnings-prefiks
  const id = newId();
  await withTransaction(db, async (client) => {
    await client.query(
      `INSERT INTO api_keys (id, organization_id, name, key_prefix, key_hash, scopes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, params.organizationId, params.name.trim(), keyPrefix, hashKey(fullKey), scopes, params.actor.userId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'api_key.created',
      entityType: 'api_key',
      entityId: id,
      newValue: { name: params.name.trim(), scopes },
    });
  });
  return {
    apiKey: { id, name: params.name.trim(), keyPrefix, scopes, createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null },
    secret: fullKey,
  };
}

export async function listApiKeys(db: Db, organizationId: string): Promise<ApiKeyDto[]> {
  const rows = (
    await db.query(
      `SELECT id, name, key_prefix, scopes, created_at, last_used_at, revoked_at
       FROM api_keys WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId],
    )
  ).rows;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.key_prefix,
    scopes: r.scopes ?? [],
    createdAt: new Date(r.created_at).toISOString(),
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
    revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
  }));
}

export async function revokeApiKey(
  db: Db,
  params: { organizationId: string; actor: Actor; keyId: string },
): Promise<void> {
  await withTransaction(db, async (client) => {
    const res = await client.query(
      `UPDATE api_keys SET revoked_at = now(), revoked_by = $3
       WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL`,
      [params.keyId, params.organizationId, params.actor.userId],
    );
    if ((res.rowCount ?? 0) === 0) throw new NotFoundError('Nøkkelen finnes ikke eller er allerede tilbakekalt.');
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'api_key.revoked',
      entityType: 'api_key',
      entityId: params.keyId,
    });
  });
}

export interface ResolvedApiKey {
  keyId: string;
  organizationId: string;
  scopes: string[];
}

/** Slår opp en API-nøkkel (aktiv, ikke tilbakekalt). Oppdaterer last_used_at. */
export async function resolveApiKey(db: Db, fullKey: string): Promise<ResolvedApiKey | null> {
  if (!fullKey.startsWith(KEY_PREFIX)) return null;
  const row = (
    await db.query(
      `SELECT id, organization_id, scopes FROM api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL`,
      [hashKey(fullKey)],
    )
  ).rows[0];
  if (!row) return null;
  // Ikke-blokkerende bruksstempel.
  void db.query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => undefined);
  return { keyId: row.id, organizationId: row.organization_id, scopes: row.scopes ?? [] };
}

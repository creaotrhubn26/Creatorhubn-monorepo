// Storage-providers routes — per-bruker S3-kompatible cloud-backup-creds.
//
// Brukes til offsite-backup-destinasjoner i Creatorhub One Desk.
// Fotografen oppretter selv en Backblaze-konto, genererer en
// application key, og limer inn key_id + application_key her. Vi
// validerer (kaller faktisk b2_authorize_account) før vi lagrer
// kryptert, og returnerer ALDRI plaintext til frontend etter
// opprettelse.
//
// Bruk i One Desk: dit-backup-routes.ts har ett endepunkt
// `/api/dit/projects/:id/destinations/with-creds` som autentiseres
// med helper-token og returnerer dekrypterte creds — det er den
// eneste veien plaintext forlater backend.

import express, { Router, Request, Response } from 'express';
import type { Pool } from 'pg';
import * as crypto from 'crypto';
import {
  encryptGoogleToken,
  decryptGoogleToken,
} from './google-oauth-shared.js';

const B2_API_BASE = 'https://api.backblazeb2.com/b2api/v3';

interface ProviderRow {
  id: string;
  user_id: string;
  provider: string;
  account_label: string;
  validated_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

interface B2AuthResponse {
  apiInfo?: {
    storageApi?: {
      apiUrl?: string;
      downloadUrl?: string;
      bucketId?: string | null;
      allowed?: {
        bucketId?: string | null;
        bucketName?: string | null;
        capabilities?: string[];
      };
    };
  };
  accountId?: string;
  authorizationToken?: string;
}

/**
 * Kall mot Backblaze for å verifisere at (key_id, app_key) faktisk
 * autoriserer. Returnerer accountId + tillatte capabilities ved suksess.
 */
async function validateB2Creds(
  keyId: string,
  applicationKey: string,
): Promise<{ ok: true; data: B2AuthResponse } | { ok: false; error: string }> {
  const credBytes = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');
  try {
    const resp = await fetch(`${B2_API_BASE}/b2_authorize_account`, {
      method: 'GET',
      headers: { Authorization: `Basic ${credBytes}` },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return {
        ok: false,
        error: `Backblaze avviste credsen (HTTP ${resp.status}): ${body.slice(0, 200)}`,
      };
    }
    const data = (await resp.json()) as B2AuthResponse;
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: `Kunne ikke nå Backblaze: ${err?.message || err}` };
  }
}

export interface StorageProvidersRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}

export function setupStorageProvidersRoutes(deps: StorageProvidersRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // Idempotent schema-ensure — kjøres ved første request hvis migrasjon
  // 232 ikke har kjørt ennå (defensiv mot deploy-rekkefølge).
  let schemaReady: Promise<void> | null = null;
  const ensureSchema = (): Promise<void> => {
    if (!schemaReady) {
      schemaReady = pool
        .query(
          `CREATE TABLE IF NOT EXISTS user_storage_providers (
             id varchar PRIMARY KEY,
             user_id varchar NOT NULL,
             provider varchar(32) NOT NULL,
             account_label text NOT NULL,
             key_id_encrypted text NOT NULL,
             application_key_encrypted text NOT NULL,
             validated_at timestamptz,
             last_used_at timestamptz,
             created_at timestamptz NOT NULL DEFAULT now()
           );
           CREATE UNIQUE INDEX IF NOT EXISTS user_storage_providers_unique
             ON user_storage_providers (user_id, provider, account_label);
           CREATE INDEX IF NOT EXISTS user_storage_providers_user_idx
             ON user_storage_providers (user_id);`,
        )
        .then(() => undefined);
    }
    return schemaReady;
  };

  // POST /api/storage/providers — opprett + validér mot Backblaze
  app.post('/api/storage/providers', async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await ensureSchema();

    const body = (req.body ?? {}) as Record<string, unknown>;
    const provider = String(body.provider ?? '').trim();
    const accountLabel = String(body.account_label ?? '').trim();
    const keyId = String(body.key_id ?? '').trim();
    const applicationKey = String(body.application_key ?? '').trim();

    if (provider !== 'b2') {
      return res.status(400).json({ success: false, error: 'Kun provider="b2" støttes i v1' });
    }
    if (!accountLabel || !keyId || !applicationKey) {
      return res.status(400).json({
        success: false,
        error: 'account_label, key_id og application_key er påkrevd',
      });
    }
    if (accountLabel.length > 100 || keyId.length > 200 || applicationKey.length > 200) {
      return res.status(400).json({ success: false, error: 'For lange verdier' });
    }

    // Steg 1: validér mot Backblaze
    const validation = await validateB2Creds(keyId, applicationKey);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Steg 2: krypter og lagre
    const keyIdEnc = encryptGoogleToken(keyId);
    const appKeyEnc = encryptGoogleToken(applicationKey);
    if (!keyIdEnc || !appKeyEnc) {
      console.error('[storage-providers] encryption failed — sjekk encryption-key env-vars');
      return res
        .status(500)
        .json({ success: false, error: 'Krypteringsnøkkel ikke konfigurert på server' });
    }

    const id = `usp_${crypto.randomUUID()}`;
    try {
      await pool.query(
        `INSERT INTO user_storage_providers
           (id, user_id, provider, account_label, key_id_encrypted, application_key_encrypted, validated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (user_id, provider, account_label)
         DO UPDATE SET
           key_id_encrypted = EXCLUDED.key_id_encrypted,
           application_key_encrypted = EXCLUDED.application_key_encrypted,
           validated_at = now()`,
        [id, session.userId, provider, accountLabel, keyIdEnc, appKeyEnc],
      );
      return res.json({
        success: true,
        provider: {
          id,
          provider,
          account_label: accountLabel,
          validated_at: new Date().toISOString(),
        },
        // Hint til frontend om hva som er tilgjengelig — IKKE selve credsen
        capabilities: validation.data.apiInfo?.storageApi?.allowed?.capabilities ?? [],
      });
    } catch (err: any) {
      console.error('[storage-providers] insert failed:', err?.message || err);
      return res
        .status(500)
        .json({ success: false, error: 'Kunne ikke lagre storage-provider' });
    }
  });

  // GET /api/storage/providers — liste over brukerens providers (uten plaintext-creds)
  app.get('/api/storage/providers', async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await ensureSchema();

    try {
      const result = await pool.query<ProviderRow>(
        `SELECT id, user_id, provider, account_label, validated_at, last_used_at, created_at
           FROM user_storage_providers
          WHERE user_id = $1
          ORDER BY created_at DESC`,
        [session.userId],
      );
      return res.json({
        success: true,
        providers: result.rows.map((r) => ({
          id: r.id,
          provider: r.provider,
          account_label: r.account_label,
          validated_at: r.validated_at?.toISOString() ?? null,
          last_used_at: r.last_used_at?.toISOString() ?? null,
          created_at: r.created_at.toISOString(),
        })),
      });
    } catch (err: any) {
      console.error('[storage-providers] list failed:', err?.message || err);
      return res.status(500).json({ success: false, error: 'Kunne ikke hente providers' });
    }
  });

  // DELETE /api/storage/providers/:id — fjern provider (sletter ikke filer på Backblaze!)
  app.delete('/api/storage/providers/:id', async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    await ensureSchema();

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id påkrevd' });
    try {
      const result = await pool.query(
        `DELETE FROM user_storage_providers WHERE id = $1 AND user_id = $2`,
        [id, session.userId],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Provider ikke funnet' });
      }
      return res.json({
        success: true,
        warning:
          'Provider-en er fjernet fra Creatorhub. Eksisterende filer i Backblaze-bucket er IKKE slettet — administrer dem i Backblaze-konsollen.',
      });
    } catch (err: any) {
      console.error('[storage-providers] delete failed:', err?.message || err);
      return res.status(500).json({ success: false, error: 'Kunne ikke fjerne' });
    }
  });
}

/**
 * Henter dekrypterte creds for en spesifikk provider — brukes av
 * dit-backup-routes.ts når One Desk spør om destinasjoner med creds.
 * MÅ kun kalles etter Bearer helper-token-validering.
 */
export async function getDecryptedProviderCreds(
  pool: Pool,
  providerId: string,
): Promise<{ key_id: string; application_key: string } | null> {
  try {
    const result = await pool.query<{
      key_id_encrypted: string;
      application_key_encrypted: string;
    }>(
      `SELECT key_id_encrypted, application_key_encrypted
         FROM user_storage_providers
        WHERE id = $1`,
      [providerId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const keyId = decryptGoogleToken(row.key_id_encrypted);
    const applicationKey = decryptGoogleToken(row.application_key_encrypted);
    if (!keyId || !applicationKey) return null;
    // Fire-and-forget last_used_at-oppdatering
    pool
      .query(`UPDATE user_storage_providers SET last_used_at = now() WHERE id = $1`, [providerId])
      .catch(() => {});
    return { key_id: keyId, application_key: applicationKey };
  } catch (err) {
    console.error('[storage-providers] decrypt failed:', err);
    return null;
  }
}

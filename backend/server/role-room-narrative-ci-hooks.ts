/**
 * Story Graph Fase 8c — CI-bevis-webhook.
 *
 * Spillbygget (Xcode/CI) setter leveransegater med bevis via en HMAC-signert webhook,
 * i stedet for at «bestått» settes for hånd. To offentlige innganger, begge montert i
 * index.ts FØR den globale express.json() (body-parser hopper over når req._body alt er
 * satt, så rå body til HMAC finnes bare der — samme grunn som Stripe-webhookene):
 *
 *   POST /api/role-room/narrative/hooks/ci/:hookId            JSON + X-StoryGraph-Signature-256
 *   POST /api/role-room/narrative/hooks/ci/:hookId/evidence   multipart + X-StoryGraph-Hook
 *
 * Gate-skriving går alltid gjennom svc.setSceneGate med checked_by = 'ci:<hookId>', så
 * regelen «bestått krever bevis» gjelder også for CI. Alle leveringer logges — også avviste.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import type { Pool } from 'pg';
import { z } from 'zod';

import * as svc from './role-room-narrative-service.js';
import { createTokenRateLimiter } from './narrative-rate-limit.js';
import { putCreatorHubObject } from './creatorhub-object-storage.js';
import { broadcastEventToRoom, narrativeRoomKey } from './websocket-chat.js';

export const CI_SIGNATURE_HEADER = 'x-storygraph-signature-256';
export const CI_HOOK_AUTH_HEADER = 'x-storygraph-hook';
export const CI_EVIDENCE_MAX_BYTES = 50 * 1024 * 1024;
const CI_PAYLOAD_LIMIT = '256kb';

type Row = Record<string, unknown>;
const id = (prefix: string) => `${prefix}_${randomUUID()}`;

// ─── Signatur ────────────────────────────────────────────────────────

/** `X-StoryGraph-Signature-256: sha256=<hex>` over rå body (samme form som Meta/Stripe). */
export function verifyStoryGraphSignature(rawBody: Buffer, signatureHeader: string | string[] | undefined, secret: string): boolean {
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const provided = header.slice('sha256='.length).trim();
  if (provided.length !== 64) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(provided, 'hex'); const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

export function signStoryGraphPayload(rawBody: Buffer | string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

function secretsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8'); const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  try { return timingSafeEqual(ab, bb); } catch { return false; }
}

// ─── Payload ─────────────────────────────────────────────────────────

export const ciEvidencePayloadSchema = z.object({
  /** Arbeids-ID (P01, G03A) eller scenekode. */
  scene: z.string().trim().min(1).max(40),
  gate: z.enum(['script_coverage', 'greybox', 'characters_animation', 'playthrough', 'picture', 'audio']),
  status: z.enum(['passed', 'failed', 'in_progress']),
  evidence: z.string().max(5000).optional(),
  evidenceRefs: z.array(z.string().max(500)).max(50).optional(),
  commitSha: z.string().regex(/^[0-9a-f]{7,40}$/i).optional(),
  runUrl: z.string().url().max(1000).optional(),
  build: z.string().max(200).optional(),
});
export type CiEvidencePayload = z.infer<typeof ciEvidencePayloadSchema>;

// ─── DB ──────────────────────────────────────────────────────────────

export interface NarrativeCiHook {
  id: string; projectId: string; label: string; createdBy: string | null; createdAt: string;
  revokedAt: string | null; lastDeliveryAt: string | null; deliveryCount: number;
}
export interface NarrativeCiDelivery {
  id: string; hookId: string; projectId: string; receivedAt: string; status: 'applied' | 'rejected';
  sceneCode: string | null; gateKey: string | null; gateStatus: string | null; error: string | null;
  commitSha: string | null; runUrl: string | null;
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
function mapHook(r: Row): NarrativeCiHook {
  return {
    id: String(r.id), projectId: String(r.project_id), label: String(r.label ?? ''), createdBy: r.created_by == null ? null : String(r.created_by),
    createdAt: iso(r.created_at) ?? new Date(0).toISOString(), revokedAt: iso(r.revoked_at), lastDeliveryAt: iso(r.last_delivery_at), deliveryCount: Number(r.delivery_count ?? 0),
  };
}
function mapDelivery(r: Row): NarrativeCiDelivery {
  return {
    id: String(r.id), hookId: String(r.hook_id), projectId: String(r.project_id), receivedAt: iso(r.received_at) ?? new Date(0).toISOString(),
    status: String(r.status) as NarrativeCiDelivery['status'], sceneCode: r.scene_code == null ? null : String(r.scene_code),
    gateKey: r.gate_key == null ? null : String(r.gate_key), gateStatus: r.gate_status == null ? null : String(r.gate_status),
    error: r.error == null ? null : String(r.error), commitSha: r.commit_sha == null ? null : String(r.commit_sha), runUrl: r.run_url == null ? null : String(r.run_url),
  };
}

/** Oppretter hook; hemmeligheten returneres ÉN gang (lagres i klartekst fordi HMAC trenger den). */
export async function createCiHook(db: svc.Queryable, projectId: string, userId: string, label: string): Promise<{ hook: NarrativeCiHook; secret: string }> {
  const secret = `sgh_${randomBytes(32).toString('base64url')}`;
  const { rows } = await db.query(
    `INSERT INTO narrative_ci_hooks (id, project_id, label, secret, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id('nch'), projectId, label.trim().slice(0, 200), secret, userId],
  );
  return { hook: mapHook(rows[0] as Row), secret };
}

export async function listCiHooks(db: svc.Queryable, projectId: string): Promise<NarrativeCiHook[]> {
  const { rows } = await db.query(`SELECT * FROM narrative_ci_hooks WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]);
  return (rows as Row[]).map(mapHook);
}

export async function revokeCiHook(db: svc.Queryable, projectId: string, hookId: string): Promise<NarrativeCiHook | null> {
  const { rows } = await db.query(
    `UPDATE narrative_ci_hooks SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1 AND project_id = $2 RETURNING *`,
    [hookId, projectId],
  );
  return rows[0] ? mapHook(rows[0] as Row) : null;
}

export async function listCiDeliveries(db: svc.Queryable, projectId: string, opts: { hookId?: string; limit?: number } = {}): Promise<NarrativeCiDelivery[]> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 200));
  const { rows } = opts.hookId
    ? await db.query(`SELECT * FROM narrative_ci_deliveries WHERE project_id = $1 AND hook_id = $2 ORDER BY received_at DESC LIMIT $3`, [projectId, opts.hookId, limit])
    : await db.query(`SELECT * FROM narrative_ci_deliveries WHERE project_id = $1 ORDER BY received_at DESC LIMIT $2`, [projectId, limit]);
  return (rows as Row[]).map(mapDelivery);
}

interface ActiveHook { id: string; projectId: string; secret: string }
async function findActiveHook(db: svc.Queryable, hookId: string): Promise<ActiveHook | null> {
  if (!/^nch_[0-9a-f-]{36}$/.test(hookId)) return null;
  const { rows } = await db.query(`SELECT id, project_id, secret FROM narrative_ci_hooks WHERE id = $1 AND revoked_at IS NULL LIMIT 1`, [hookId]);
  const r = rows[0] as Row | undefined;
  return r ? { id: String(r.id), projectId: String(r.project_id), secret: String(r.secret) } : null;
}

async function recordDelivery(db: svc.Queryable, hook: ActiveHook, status: 'applied' | 'rejected', f: { sceneCode?: string | null; gateKey?: string | null; gateStatus?: string | null; error?: string | null; commitSha?: string | null; runUrl?: string | null; payload: unknown }): Promise<void> {
  await db.query(
    `INSERT INTO narrative_ci_deliveries (id, hook_id, project_id, status, scene_code, gate_key, gate_status, error, commit_sha, run_url, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
    [id('ncd'), hook.id, hook.projectId, status, f.sceneCode ?? null, f.gateKey ?? null, f.gateStatus ?? null, f.error ?? null, f.commitSha ?? null, f.runUrl ?? null, JSON.stringify(f.payload ?? {})],
  );
  await db.query(`UPDATE narrative_ci_hooks SET last_delivery_at = now(), delivery_count = delivery_count + 1 WHERE id = $1`, [hook.id]);
}

export type CiApplyResult =
  | { applied: true; sceneId: string; sceneCode: string; gate: svc.NarrativeSceneGate }
  | { applied: false; error: 'unknown_scene' | 'gate_evidence_required' };

/** Slår opp scenen på arbeids-ID eller kode og setter gaten som 'ci:<hookId>'. */
export async function applyCiEvidence(db: svc.Queryable, hook: ActiveHook, payload: CiEvidencePayload): Promise<CiApplyResult> {
  const key = payload.scene.trim().toUpperCase();
  const { rows } = await db.query(
    `SELECT id, code FROM narrative_scenes WHERE project_id = $1 AND (upper(working_id) = $2 OR upper(code) = $2) ORDER BY (upper(working_id) = $2) DESC LIMIT 1`,
    [hook.projectId, key],
  );
  const scene = rows[0] as Row | undefined;
  if (!scene) return { applied: false, error: 'unknown_scene' };
  const refs = [...(payload.evidenceRefs ?? [])];
  if (payload.commitSha) refs.push(`commit:${payload.commitSha}`);
  if (payload.runUrl) refs.push(`run:${payload.runUrl}`);
  if (payload.build) refs.push(`build:${payload.build}`);
  const evidence = [payload.evidence?.trim() ?? '', payload.runUrl ? `CI-kjøring: ${payload.runUrl}` : ''].filter(Boolean).join('\n');
  try {
    const gate = await svc.setSceneGate(db, hook.projectId, String(scene.id), payload.gate, `ci:${hook.id}`, { status: payload.status, evidence, evidenceRefs: refs });
    if (!gate) return { applied: false, error: 'unknown_scene' };
    return { applied: true, sceneId: String(scene.id), sceneCode: String(scene.code), gate };
  } catch (err) {
    if (err instanceof svc.GateEvidenceRequiredError) return { applied: false, error: 'gate_evidence_required' };
    throw err;
  }
}

// ─── Bevis-artefakt → S3 → narrative_assets(storage_key) ─────────────

export interface StoredEvidenceAsset { assetId: string; ref: string; storageKey: string; name: string; sizeBytes: number }

export async function storeEvidenceAsset(db: svc.Queryable, projectId: string, sceneId: string, gateKey: string, userId: string, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }): Promise<StoredEvidenceAsset | null> {
  const safeName = file.originalname.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'bevis';
  const storageKey = `narrative/${projectId}/evidence/${sceneId}/${gateKey}/${randomUUID()}-${safeName}`;
  const ok = await putCreatorHubObject(storageKey, file.buffer, file.mimetype || 'application/octet-stream', { projectId, sceneId, gateKey });
  if (!ok) return null;
  const assetId = id('nas');
  await db.query(
    `INSERT INTO narrative_assets (id, project_id, kind, name, storage_key, external_url, mime, size_bytes, folder_path, created_by)
       VALUES ($1, $2, 'file', $3, $4, NULL, $5, $6, $7, $8)`,
    [assetId, projectId, safeName, storageKey, file.mimetype || null, file.size, `bevis/${gateKey}`, userId],
  );
  return { assetId, ref: `asset:${assetId}`, storageKey, name: safeName, sizeBytes: file.size };
}

// ─── Express-handlere (monteres i index.ts før express.json) ─────────

export interface CiHookHandlerDeps {
  broadcast?: (room: string, message: unknown) => number;
}

export function createNarrativeCiHookHandlers(pool: Pool, deps: CiHookHandlerDeps = {}): { webhook: RequestHandler[]; evidenceUpload: RequestHandler[] } {
  const broadcast = deps.broadcast ?? broadcastEventToRoom;
  const limiter = createTokenRateLimiter({ windowMs: 60_000, max: 120 });
  const hookIdOf = (req: Request) => { const v = (req.params as Record<string, string | string[] | undefined>).hookId; return Array.isArray(v) ? String(v[0] ?? '') : String(v ?? ''); };

  const webhook = async (req: Request, res: Response) => {
    const hookId = hookIdOf(req);
    if (limiter.hit(hookId)) { res.status(429).set('Retry-After', '60').json({ error: 'rate_limited' }); return; }
    if (!Buffer.isBuffer(req.body)) { res.status(400).json({ error: 'raw_body_required', message: 'Send JSON med Content-Type: application/json.' }); return; }
    const hook = await findActiveHook(pool, hookId);
    // Ukjent hook og ugyldig signatur gir samme svar (ingen enumerering).
    if (!hook || !verifyStoryGraphSignature(req.body, req.headers[CI_SIGNATURE_HEADER], hook.secret)) { res.status(401).json({ error: 'invalid_signature' }); return; }
    let json: unknown;
    try { json = JSON.parse(req.body.toString('utf8')); } catch { json = null; }
    const parsed = ciEvidencePayloadSchema.safeParse(json);
    if (!parsed.success) {
      await recordDelivery(pool, hook, 'rejected', { error: 'invalid_payload', payload: json });
      res.status(400).json({ ok: false, status: 'rejected', error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }
    const p = parsed.data;
    try {
      const result = await applyCiEvidence(pool, hook, p);
      if (!result.applied) {
        await recordDelivery(pool, hook, 'rejected', { sceneCode: p.scene, gateKey: p.gate, gateStatus: p.status, error: result.error, commitSha: p.commitSha ?? null, runUrl: p.runUrl ?? null, payload: p });
        res.status(422).json({ ok: false, status: 'rejected', error: result.error });
        return;
      }
      await recordDelivery(pool, hook, 'applied', { sceneCode: result.sceneCode, gateKey: p.gate, gateStatus: p.status, commitSha: p.commitSha ?? null, runUrl: p.runUrl ?? null, payload: p });
      try {
        broadcast(narrativeRoomKey(hook.projectId), {
          type: 'narrative:graph_changed',
          payload: { kind: 'scene', ids: [result.sceneId], actorUserId: `ci:${hook.id}`, at: new Date().toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch { /* best-effort */ }
      res.json({ ok: true, status: 'applied', scene: result.sceneCode, gate: result.gate });
    } catch (err) {
      console.error('[narrative-ci] webhook error', err);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  };

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CI_EVIDENCE_MAX_BYTES, files: 1 } });
  const uploadMiddleware: RequestHandler = (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) { res.status((err as { code?: string }).code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'bad_upload' }); return; }
      next();
    });
  };
  const evidenceUpload = async (req: Request, res: Response) => {
    const hookId = hookIdOf(req);
    if (limiter.hit(hookId)) { res.status(429).set('Retry-After', '60').json({ error: 'rate_limited' }); return; }
    const auth = req.headers[CI_HOOK_AUTH_HEADER];
    const raw = Array.isArray(auth) ? auth[0] : auth;
    const [authHookId, ...rest] = String(raw ?? '').split(':');
    const providedSecret = rest.join(':');
    const hook = await findActiveHook(pool, hookId);
    if (!hook || authHookId !== hookId || !providedSecret || !secretsEqual(providedSecret, hook.secret)) { res.status(401).json({ error: 'invalid_hook_credentials' }); return; }
    const file = (req as Request & { file?: { buffer: Buffer; originalname: string; mimetype: string; size: number } }).file;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sceneKey = String(body.scene ?? '').trim().toUpperCase();
    const gateKey = String(body.gate ?? '').trim();
    if (!file || !sceneKey || !(svc.NARRATIVE_GATE_KEYS as readonly string[]).includes(gateKey)) { res.status(400).json({ error: 'invalid_request', message: 'Trenger feltene file, scene og gate.' }); return; }
    try {
      const { rows } = await pool.query(`SELECT id, code FROM narrative_scenes WHERE project_id = $1 AND (upper(working_id) = $2 OR upper(code) = $2) LIMIT 1`, [hook.projectId, sceneKey]);
      const scene = rows[0] as Row | undefined;
      if (!scene) { res.status(422).json({ error: 'unknown_scene' }); return; }
      const stored = await storeEvidenceAsset(pool, hook.projectId, String(scene.id), gateKey, `ci:${hook.id}`, file);
      if (!stored) { res.status(503).json({ error: 'storage_unavailable', message: 'Objektlager er ikke konfigurert.' }); return; }
      res.status(201).json({ ok: true, ...stored });
    } catch (err) {
      console.error('[narrative-ci] evidence upload error', err);
      res.status(500).json({ error: 'internal_error' });
    }
  };

  return {
    webhook: [express.raw({ type: 'application/json', limit: CI_PAYLOAD_LIMIT }), webhook],
    evidenceUpload: [uploadMiddleware, evidenceUpload],
  };
}

/**
 * role-room-agent-routes.ts — Role Room Agent's profile-recommendations
 * + publish-orchestration. Used by the AdminRoom "🤖 Role Room Agent" tab.
 *
 * Endpoints (all gated by requireAdminOrDemoBypass):
 *
 *   POST /api/role-room/agent/profile-recommendations
 *     Body: { brandKey: string; bootstrap?: ProfileRecBootstrap; useCache?: boolean }
 *     - If bootstrap omitted, defaults to THEROLERROOM_BOOTSTRAP for brand "theroleroom".
 *     - useCache=true (default) returns the latest cached rec if bootstrap-hash matches.
 *     - Returns the full ProfileRecommendations object.
 *
 *   GET /api/role-room/agent/profile-recommendations/latest?brandKey=...
 *     Latest stored recommendation for a brand. Returns 404 if none.
 *
 *   POST /api/role-room/agent/profile-recommendations/publish
 *     Body: { recommendationId: number; platform: "facebook"|"instagram"|...;
 *             field: "about"|"website"|"phone"|"cta"; pageId?: string; pageAccessToken?: string }
 *     - Pushes the field to Meta API (FB Page only — IG bio is not API-updatable).
 *     - Logs to agent_profile_publish_log.
 *     - Returns { success, status, response } from Meta.
 *
 *   GET /api/role-room/agent/profile-publish-log?brandKey=...
 *     History of publishes for a brand.
 */

import type { Application, Request, Response } from 'express';
import crypto from 'node:crypto';
import type { Pool } from 'pg';
import {
  generateProfileRecommendations,
  THEROLERROOM_BOOTSTRAP,
  type ProfileRecBootstrap,
  type ProfileRecommendations,
} from './role-room-agent-profile-recommendations.js';

export interface SetupAgentRoutesDeps {
  app: Application;
  pool: Pool;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

function bootstrapHash(b: ProfileRecBootstrap): string {
  // Stable hash for cache-key. Order-insensitive sort of keys.
  const canonical = JSON.stringify(b, Object.keys(b).sort());
  return crypto.createHash('sha1').update(canonical).digest('hex');
}

function resolveBootstrap(brandKey: string, body: Record<string, unknown>): ProfileRecBootstrap {
  if (body.bootstrap && typeof body.bootstrap === 'object') {
    return body.bootstrap as ProfileRecBootstrap;
  }
  if (brandKey === 'theroleroom') return THEROLERROOM_BOOTSTRAP;
  throw new Error(`No bootstrap provided and no default for brandKey "${brandKey}"`);
}

export function setupRoleRoomAgentRoutes(deps: SetupAgentRoutesDeps): void {
  const { app, pool, requireAdminOrDemoBypass } = deps;

  // ── POST /api/role-room/agent/profile-recommendations ────────────────────
  app.post('/api/role-room/agent/profile-recommendations', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const brandKey = typeof body.brandKey === 'string' && body.brandKey.trim() ? body.brandKey.trim() : 'theroleroom';
    const useCache = body.useCache !== false; // default true

    let bootstrap: ProfileRecBootstrap;
    try {
      bootstrap = resolveBootstrap(brandKey, body);
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }

    const hash = bootstrapHash(bootstrap);

    // Cache-lookup: if same hash within 24h, return cached.
    if (useCache) {
      try {
        const cacheR = await pool.query(
          `SELECT id, recommendations_json, generated_with_model, cost_nok, generated_at
           FROM agent_profile_recommendations
           WHERE brand_key = $1 AND bootstrap_hash = $2
             AND generated_at > now() - interval '24 hours'
           ORDER BY generated_at DESC LIMIT 1`,
          [brandKey, hash],
        );
        if (cacheR.rowCount && cacheR.rowCount > 0) {
          const row = cacheR.rows[0];
          res.json({
            ok: true,
            cached: true,
            recommendationId: row.id,
            recommendations: row.recommendations_json,
            generatedWithModel: row.generated_with_model,
            costNok: row.cost_nok ? Number(row.cost_nok) : null,
            generatedAt: row.generated_at,
          });
          return;
        }
      } catch (err) {
        console.warn('[agent-routes] cache-lookup failed, continuing to generate', err);
      }
    }

    const recs = await generateProfileRecommendations(bootstrap);
    if (!recs) {
      res.status(502).json({ ok: false, error: 'claude_generation_failed' });
      return;
    }

    let recommendationId: number | null = null;
    try {
      const ins = await pool.query(
        `INSERT INTO agent_profile_recommendations
           (brand_key, bootstrap_hash, recommendations_json, generated_with_model, cost_nok)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [brandKey, hash, recs, recs.generatedWithModel, recs.usage?.costNok ?? null],
      );
      recommendationId = ins.rows[0]?.id ?? null;
    } catch (err) {
      console.error('[agent-routes] failed to persist recommendation', err);
    }

    res.json({
      ok: true,
      cached: false,
      recommendationId,
      recommendations: recs,
      generatedWithModel: recs.generatedWithModel,
      costNok: recs.usage?.costNok ?? null,
    });
  });

  // ── GET /api/role-room/agent/profile-recommendations/latest ──────────────
  app.get('/api/role-room/agent/profile-recommendations/latest', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const brandKey = typeof req.query.brandKey === 'string' && req.query.brandKey.trim()
      ? req.query.brandKey.trim()
      : 'theroleroom';
    try {
      const r = await pool.query(
        `SELECT id, recommendations_json, generated_with_model, cost_nok, generated_at
         FROM agent_profile_recommendations
         WHERE brand_key = $1
         ORDER BY generated_at DESC LIMIT 1`,
        [brandKey],
      );
      if (!r.rowCount || r.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'no_recommendations_yet' });
        return;
      }
      const row = r.rows[0];
      res.json({
        ok: true,
        recommendationId: row.id,
        recommendations: row.recommendations_json,
        generatedWithModel: row.generated_with_model,
        costNok: row.cost_nok ? Number(row.cost_nok) : null,
        generatedAt: row.generated_at,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'db_query_failed', detail: String(err) });
    }
  });

  // ── POST /api/role-room/agent/profile-recommendations/publish ────────────
  // Pushes a single field to Meta API + logs the result. Currently only FB Page
  // fields work via API (about, website, phone, cta). IG/TikTok bios must be
  // copied manually — those calls log status="manual_copy" so the history shows
  // intent without claiming the API succeeded.
  app.post('/api/role-room/agent/profile-recommendations/publish', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const recommendationId = typeof body.recommendationId === 'number' ? body.recommendationId : null;
    const platform = typeof body.platform === 'string' ? body.platform.trim() : '';
    const field = typeof body.field === 'string' ? body.field.trim() : '';
    const value = typeof body.value === 'string' ? body.value : '';
    const brandKey = typeof body.brandKey === 'string' && body.brandKey.trim() ? body.brandKey.trim() : 'theroleroom';

    if (!platform || !field || !value) {
      res.status(400).json({ ok: false, error: 'platform + field + value required' });
      return;
    }

    // Resolve Page-token: prefer explicit, fall back to THEROLERROOM env for brand "theroleroom".
    let pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
    let pageAccessToken = typeof body.pageAccessToken === 'string' ? body.pageAccessToken.trim() : '';
    if (!pageId && brandKey === 'theroleroom') pageId = (process.env.THEROLERROOM_PAGE_ID || '').trim();
    if (!pageAccessToken && brandKey === 'theroleroom') pageAccessToken = (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || '').trim();

    const PUSHABLE_FIELDS: Record<string, string> = {
      // facebook + field-name we POST to /v21.0/{page-id}
      'facebook:about': 'about',
      'facebook:description': 'description',
      'facebook:website': 'website',
      'facebook:phone': 'phone',
    };
    const apiField = PUSHABLE_FIELDS[`${platform}:${field}`];

    if (!apiField) {
      // Not API-pushable — log as manual_copy and return success.
      try {
        await pool.query(
          `INSERT INTO agent_profile_publish_log
             (brand_key, platform, field, value, status, recommendation_id)
           VALUES ($1, $2, $3, $4, 'manual_copy', $5)`,
          [brandKey, platform, field, value, recommendationId],
        );
      } catch (err) {
        console.warn('[agent-routes] publish-log insert failed', err);
      }
      res.json({
        ok: true,
        status: 'manual_copy',
        message: `${platform}.${field} cannot be updated via API. Logged for record; copy-paste into platform.`,
      });
      return;
    }

    if (!pageId || !pageAccessToken) {
      res.status(503).json({ ok: false, error: 'pageId + pageAccessToken required for facebook publish' });
      return;
    }

    const params = new URLSearchParams({
      [apiField]: value,
      access_token: pageAccessToken,
    });
    let apiResponse: unknown = null;
    let success = false;
    let errorMessage: string | null = null;
    try {
      const upstream = await fetch(
        `${META_GRAPH_BASE}/${encodeURIComponent(pageId)}`,
        { method: 'POST', body: params },
      );
      apiResponse = await upstream.json().catch(() => ({}));
      if (upstream.ok) {
        success = true;
      } else {
        const err = (apiResponse as Record<string, unknown>)?.error as Record<string, unknown> | undefined;
        errorMessage = typeof err?.message === 'string' ? err.message : `status ${upstream.status}`;
      }
    } catch (err) {
      errorMessage = String(err);
    }

    try {
      await pool.query(
        `INSERT INTO agent_profile_publish_log
           (brand_key, platform, field, value, status, api_response, error_message, recommendation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          brandKey, platform, field, value,
          success ? 'success' : 'failed',
          JSON.stringify(apiResponse),
          errorMessage,
          recommendationId,
        ],
      );
    } catch (err) {
      console.warn('[agent-routes] publish-log insert failed', err);
    }

    res.status(success ? 200 : 502).json({
      ok: success,
      status: success ? 'success' : 'failed',
      apiResponse,
      errorMessage,
    });
  });

  // ── GET /api/role-room/agent/profile-publish-log ─────────────────────────
  app.get('/api/role-room/agent/profile-publish-log', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const brandKey = typeof req.query.brandKey === 'string' && req.query.brandKey.trim()
      ? req.query.brandKey.trim()
      : 'theroleroom';
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    try {
      const r = await pool.query(
        `SELECT id, platform, field, value, status, error_message, recommendation_id, published_at
         FROM agent_profile_publish_log
         WHERE brand_key = $1
         ORDER BY published_at DESC
         LIMIT $2`,
        [brandKey, limit],
      );
      res.json({
        ok: true,
        brandKey,
        entries: r.rows.map((row) => ({
          id: row.id,
          platform: row.platform,
          field: row.field,
          value: row.value,
          status: row.status,
          errorMessage: row.error_message,
          recommendationId: row.recommendation_id,
          publishedAt: row.published_at,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'db_query_failed', detail: String(err) });
    }
  });
}

/**
 * role-room-post-drafts-routes.ts
 *
 * CRUD + publish-bro for AI-genererte post-utkast. Brukt av Marketing
 * Cockpit's "Skriv dette innlegget"-knapp → draft → admin redigerer →
 * publiser direkte til Meta API.
 *
 * Endepunkter (alle requireAdminOrDemoBypass):
 *   POST   /api/role-room/agent/compose-post-from-insight
 *   GET    /api/role-room/agent/post-drafts?brandKey=&status=
 *   PATCH  /api/role-room/agent/post-drafts/:id
 *   POST   /api/role-room/agent/post-drafts/:id/publish
 *   DELETE /api/role-room/agent/post-drafts/:id
 */

import type { Application, Request, Response } from 'express';
import type { Pool } from 'pg';
import { composePost, type ComposePostInput } from './role-room-post-composer-claude.js';
import { THEROLERROOM_BOOTSTRAP } from './role-room-agent-profile-recommendations.js';
import { dispatchPublish } from './social-publisher.js';

export interface SetupPostDraftsRoutesDeps {
  app: Application;
  pool: Pool;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/**
 * For IG-publish: vi trenger data:image/...;base64,... format. Drafts kan
 * ha enten en publicly-tilgjengelig HTTP-URL (image_url) eller en pre-
 * generert base64-string (image_data_url). Denne resolveren preferer
 * base64 og faller tilbake til å fetche+konvertere HTTP-URL.
 */
async function resolveImageDataUrl(draft: Record<string, unknown>): Promise<string | null> {
  const dataUrl = typeof draft.image_data_url === 'string' ? draft.image_data_url.trim() : '';
  if (dataUrl.startsWith('data:image/')) return dataUrl;

  const httpUrl = typeof draft.image_url === 'string' ? draft.image_url.trim() : '';
  if (!httpUrl) return null;
  if (!/^https?:\/\//i.test(httpUrl)) return null;

  try {
    const resp = await fetch(httpUrl);
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn('[post-drafts] resolveImageDataUrl fetch failed', err);
    return null;
  }
}

/**
 * For TikTok-publish: resolver til video-data-URL. Drafts kan ha video_data_url
 * (base64) eller video_url (HTTP MP4). Vi prefererer base64.
 */
async function resolveVideoDataUrl(draft: Record<string, unknown>): Promise<string | null> {
  const dataUrl = typeof draft.video_data_url === 'string' ? draft.video_data_url.trim() : '';
  if (dataUrl.startsWith('data:video/')) return dataUrl;

  const httpUrl = typeof draft.video_url === 'string' ? draft.video_url.trim() : '';
  if (!httpUrl) return null;
  if (!/^https?:\/\//i.test(httpUrl)) return null;
  // TikTok-publisher tolererer HTTP-URL direkte (fetchVideoBytes håndterer begge),
  // så vi returnerer URL-en som den er.
  return httpUrl;
}

async function resolveTikTokConnectionExists(pool: Pool, userId: string): Promise<boolean> {
  try {
    const r = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM role_room_tiktok_connections
          WHERE user_id = $1
            AND access_token_encrypted IS NOT NULL
            AND connection_state IN ('connected', 'active')
       ) AS exists`,
      [userId],
    );
    return r.rows[0]?.exists === true;
  } catch (err) {
    console.warn('[post-drafts] resolveTikTokConnectionExists failed', err);
    return false;
  }
}

async function resolveIgConnectionId(pool: Pool, userId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ id: string }>(
      `SELECT id FROM role_room_instagram_connections
        WHERE user_id = $1
          AND ig_business_account_id IS NOT NULL
          AND access_token_encrypted IS NOT NULL
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.id ?? null;
  } catch (err) {
    console.warn('[post-drafts] resolveIgConnectionId failed', err);
    return null;
  }
}

let cachedMarketingUserId: string | null = null;
async function resolveMarketingUserId(pool: Pool): Promise<string | null> {
  if (cachedMarketingUserId) return cachedMarketingUserId;
  const envId = (process.env.ROLE_ROOM_MARKETING_USER_ID || '').trim();
  if (envId) {
    cachedMarketingUserId = envId;
    return envId;
  }
  try {
    const r = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'daniel@creatorhubn.com' LIMIT 1`,
    );
    if (r.rows[0]?.id) {
      cachedMarketingUserId = r.rows[0].id;
      return r.rows[0].id;
    }
  } catch (err) {
    console.warn('[post-drafts] resolveMarketingUserId failed', err);
  }
  return null;
}

function mapDraftRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: Number(row.id),
    brandKey: row.brand_key,
    platform: row.platform,
    status: row.status,
    sourceInsight: row.source_insight,
    sourceAction: row.source_action,
    sourceReportId: row.source_report_id ? Number(row.source_report_id) : null,
    caption: row.caption,
    hashtags: row.hashtags || [],
    imageBrief: row.image_brief,
    ctaText: row.cta_text,
    ctaLink: row.cta_link,
    suggestedPublishTime: row.suggested_publish_time,
    generatedWithModel: row.generated_with_model,
    costNok: row.cost_nok ? Number(row.cost_nok) : null,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    externalPostId: row.external_post_id,
    publishError: row.publish_error,
    autoPublishEnabled: row.auto_publish_enabled === true,
    autoPublishAttempts: row.auto_publish_attempts ? Number(row.auto_publish_attempts) : 0,
    autoPublishAttemptedAt: row.auto_publish_attempted_at ?? null,
    imageUrl: row.image_url ?? null,
    hasImageData: typeof row.image_data_url === 'string' && row.image_data_url.length > 0,
    videoUrl: row.video_url ?? null,
    hasVideoData: typeof row.video_data_url === 'string' && row.video_data_url.length > 0,
  };
}

export function setupPostDraftsRoutes(deps: SetupPostDraftsRoutesDeps): void {
  const { app, pool, requireAdminOrDemoBypass } = deps;

  // ── POST compose-post-from-insight ────────────────────────────────────────
  app.post('/api/role-room/agent/compose-post-from-insight', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const brandKey = typeof body.brandKey === 'string' && body.brandKey.trim() ? body.brandKey.trim() : 'theroleroom';
    const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const insightTitle = typeof body.insightTitle === 'string' ? body.insightTitle.trim() : '';
    const insightBody = typeof body.insightBody === 'string' ? body.insightBody.trim() : '';
    const insightCategory = typeof body.insightCategory === 'string' ? body.insightCategory.trim() : 'opportunity';
    const actionableStep = typeof body.actionableStep === 'string' ? body.actionableStep.trim() : '';
    const sourceReportId = typeof body.sourceReportId === 'number' ? body.sourceReportId : null;

    if (!['facebook', 'instagram', 'linkedin', 'tiktok'].includes(platform)) {
      res.status(400).json({ ok: false, error: 'platform must be facebook|instagram|linkedin|tiktok' });
      return;
    }
    if (!insightTitle || !actionableStep) {
      res.status(400).json({ ok: false, error: 'insightTitle + actionableStep required' });
      return;
    }

    const composeInput: ComposePostInput = {
      brand: {
        name: THEROLERROOM_BOOTSTRAP.companyName,
        industry: THEROLERROOM_BOOTSTRAP.industry,
        voice: THEROLERROOM_BOOTSTRAP.toneOfVoice?.voice,
        positioning: THEROLERROOM_BOOTSTRAP.positioning,
        contentPillars: THEROLERROOM_BOOTSTRAP.contentPillars,
        website: THEROLERROOM_BOOTSTRAP.primaryWebsite,
      },
      insight: {
        title: insightTitle,
        body: insightBody,
        category: insightCategory as ComposePostInput['insight']['category'],
      },
      actionableStep,
      platform: platform as ComposePostInput['platform'],
      language: 'nb',
    };

    const composed = await composePost(composeInput);
    if (!composed) {
      res.status(502).json({ ok: false, error: 'claude_composition_failed' });
      return;
    }

    let draftId: number | null = null;
    try {
      const ins = await pool.query(
        `INSERT INTO marketing_post_drafts
           (brand_key, platform, status, source_insight, source_action, source_report_id,
            caption, hashtags, image_brief, cta_text, cta_link, suggested_publish_time,
            generated_with_model, cost_nok)
         VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          brandKey, platform, insightTitle, actionableStep, sourceReportId,
          composed.caption, JSON.stringify(composed.hashtags || []),
          composed.imageBrief, composed.ctaText, composed.ctaLink,
          composed.suggestedPublishTime ? new Date(composed.suggestedPublishTime) : null,
          composed.generatedWithModel, composed.usage?.costNok ?? null,
        ],
      );
      draftId = Number(ins.rows[0]?.id ?? 0);
    } catch (err) {
      console.error('[post-drafts] persist failed', err);
    }

    res.json({
      ok: true,
      draftId,
      composed,
    });
  });

  // ── GET post-drafts list ─────────────────────────────────────────────────
  app.get('/api/role-room/agent/post-drafts', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const brandKey = typeof req.query.brandKey === 'string' && req.query.brandKey.trim()
      ? req.query.brandKey.trim() : 'theroleroom';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);

    const wheres = ['brand_key = $1'];
    const values: unknown[] = [brandKey];
    if (status) { wheres.push(`status = $${values.length + 1}`); values.push(status); }

    try {
      const r = await pool.query(
        `SELECT * FROM marketing_post_drafts
         WHERE ${wheres.join(' AND ')}
         ORDER BY generated_at DESC
         LIMIT ${limit}`,
        values,
      );
      res.json({
        ok: true,
        brandKey,
        drafts: r.rows.map(mapDraftRow),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── PATCH post-drafts/:id ────────────────────────────────────────────────
  app.patch('/api/role-room/agent/post-drafts/:id', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ ok: false, error: 'invalid id' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 2;
    if (typeof body.caption === 'string')      { fields.push(`caption = $${idx++}`); values.push(body.caption); fields.push(`status = 'edited'`); }
    if (Array.isArray(body.hashtags))          { fields.push(`hashtags = $${idx++}`); values.push(JSON.stringify(body.hashtags)); }
    if (typeof body.imageBrief === 'string')   { fields.push(`image_brief = $${idx++}`); values.push(body.imageBrief); }
    if (typeof body.ctaText === 'string')      { fields.push(`cta_text = $${idx++}`); values.push(body.ctaText); }
    if (typeof body.ctaLink === 'string')      { fields.push(`cta_link = $${idx++}`); values.push(body.ctaLink); }
    if (typeof body.imageUrl === 'string' || body.imageUrl === null) {
      fields.push(`image_url = $${idx++}`);
      values.push(typeof body.imageUrl === 'string' ? body.imageUrl.trim() || null : null);
    }
    if (typeof body.imageDataUrl === 'string' || body.imageDataUrl === null) {
      fields.push(`image_data_url = $${idx++}`);
      values.push(typeof body.imageDataUrl === 'string' ? body.imageDataUrl : null);
    }
    if (typeof body.videoUrl === 'string' || body.videoUrl === null) {
      fields.push(`video_url = $${idx++}`);
      values.push(typeof body.videoUrl === 'string' ? body.videoUrl.trim() || null : null);
    }
    if (typeof body.videoDataUrl === 'string' || body.videoDataUrl === null) {
      fields.push(`video_data_url = $${idx++}`);
      values.push(typeof body.videoDataUrl === 'string' ? body.videoDataUrl : null);
    }
    if ('suggestedPublishTime' in body) {
      // null = unschedule. String = ISO 8601 → parse to Date.
      const raw = body.suggestedPublishTime;
      if (raw === null) {
        fields.push(`suggested_publish_time = NULL`);
      } else if (typeof raw === 'string' && raw.trim()) {
        const parsed = new Date(raw);
        if (Number.isFinite(parsed.getTime())) {
          fields.push(`suggested_publish_time = $${idx++}`);
          values.push(parsed);
        }
      }
    }
    if (typeof body.autoPublishEnabled === 'boolean') {
      fields.push(`auto_publish_enabled = $${idx++}`);
      values.push(body.autoPublishEnabled);
      if (body.autoPublishEnabled === true) {
        // Reset attempt-counter når admin re-enabler — gir frisk retry
        fields.push(`auto_publish_attempts = 0`);
        fields.push(`auto_publish_attempted_at = NULL`);
      }
    }
    if (fields.length === 0) {
      res.status(400).json({ ok: false, error: 'no updatable fields' });
      return;
    }
    fields.push(`updated_at = now()`);

    try {
      const r = await pool.query(
        `UPDATE marketing_post_drafts SET ${fields.join(', ')}
         WHERE id = $1
         RETURNING *`,
        [id, ...values],
      );
      if (!r.rowCount) { res.status(404).json({ ok: false, error: 'draft not found' }); return; }
      res.json({ ok: true, draft: mapDraftRow(r.rows[0]) });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── DELETE post-drafts/:id ───────────────────────────────────────────────
  app.delete('/api/role-room/agent/post-drafts/:id', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid id' }); return; }
    try {
      const r = await pool.query('DELETE FROM marketing_post_drafts WHERE id = $1', [id]);
      res.json({ ok: true, deleted: r.rowCount ?? 0 });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── GET content-calendar ─────────────────────────────────────────────────
  // Returnerer drafts + publiserte posts i et dato-vindu pluss en separat
  // "unscheduled"-bucket (drafts uten suggested_publish_time).
  app.get('/api/role-room/marketing-cockpit/content-calendar', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const brandKey = typeof req.query.brandKey === 'string' && req.query.brandKey.trim()
      ? req.query.brandKey.trim() : 'theroleroom';
    const fromStr = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const toStr = typeof req.query.to === 'string' ? req.query.to.trim() : '';

    // Default: 30 dager bakover + 30 dager fram
    const now = Date.now();
    const from = fromStr ? new Date(fromStr) : new Date(now - 30 * 86_400_000);
    const to = toStr ? new Date(toStr) : new Date(now + 30 * 86_400_000);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
      res.status(400).json({ ok: false, error: 'invalid from/to date' });
      return;
    }

    try {
      // 1. Drafts med scheduled-time i vindu (eller publiserte i vindu)
      const scheduled = await pool.query(
        `SELECT id, platform, status, caption, hashtags, image_brief,
                cta_text, cta_link, source_insight, suggested_publish_time,
                published_at, external_post_id, generated_at,
                auto_publish_enabled, auto_publish_attempts, auto_publish_attempted_at,
                image_url,
                (image_data_url IS NOT NULL) AS has_image_data,
                video_url,
                (video_data_url IS NOT NULL) AS has_video_data,
                (SELECT row_to_json(s)
                 FROM (
                   SELECT engagement_rate, reach, reactions_total, comments_count
                   FROM post_engagement_snapshots
                   WHERE draft_id = marketing_post_drafts.id AND fetch_error IS NULL
                   ORDER BY snapshot_at DESC LIMIT 1
                 ) s) AS latest_engagement
         FROM marketing_post_drafts
         WHERE brand_key = $1
           AND (
             (suggested_publish_time IS NOT NULL AND suggested_publish_time BETWEEN $2 AND $3)
             OR (published_at IS NOT NULL AND published_at BETWEEN $2 AND $3)
           )
         ORDER BY COALESCE(published_at, suggested_publish_time) ASC`,
        [brandKey, from, to],
      );

      // 2. Unscheduled drafts (ingen suggested_publish_time, ikke publisert ennå)
      const unscheduled = await pool.query(
        `SELECT id, platform, status, caption, hashtags, image_brief,
                cta_text, cta_link, source_insight, generated_at,
                auto_publish_enabled, auto_publish_attempts, auto_publish_attempted_at,
                image_url,
                (image_data_url IS NOT NULL) AS has_image_data,
                video_url,
                (video_data_url IS NOT NULL) AS has_video_data
         FROM marketing_post_drafts
         WHERE brand_key = $1
           AND suggested_publish_time IS NULL
           AND status IN ('draft', 'edited')
         ORDER BY generated_at DESC
         LIMIT 50`,
        [brandKey],
      );

      const mapRow = (row: Record<string, unknown>) => ({
        id: Number(row.id),
        platform: row.platform,
        status: row.status,
        caption: row.caption,
        hashtags: row.hashtags || [],
        imageBrief: row.image_brief,
        ctaText: row.cta_text,
        ctaLink: row.cta_link,
        sourceInsight: row.source_insight,
        suggestedPublishTime: row.suggested_publish_time,
        publishedAt: row.published_at,
        externalPostId: row.external_post_id,
        generatedAt: row.generated_at,
        latestEngagement: row.latest_engagement || null,
        autoPublishEnabled: row.auto_publish_enabled === true,
        autoPublishAttempts: row.auto_publish_attempts ? Number(row.auto_publish_attempts) : 0,
        autoPublishAttemptedAt: row.auto_publish_attempted_at ?? null,
        imageUrl: row.image_url ?? null,
        hasImageData: row.has_image_data === true,
        videoUrl: row.video_url ?? null,
        hasVideoData: row.has_video_data === true,
      });

      res.json({
        ok: true,
        from: from.toISOString(),
        to: to.toISOString(),
        brandKey,
        scheduled: scheduled.rows.map(mapRow),
        unscheduled: unscheduled.rows.map(mapRow),
        counts: {
          scheduled: scheduled.rowCount ?? 0,
          unscheduled: unscheduled.rowCount ?? 0,
          published: scheduled.rows.filter((r) => r.status === 'published').length,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── POST post-drafts/:id/publish ─────────────────────────────────────────
  // For FB: direct POST to /v21.0/{page-id}/feed med THEROLERROOM env-tokens.
  // For IG/LinkedIn/TikTok: not yet wired — markeres som "manual_copy" status.
  app.post('/api/role-room/agent/post-drafts/:id/publish', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid id' }); return; }

    try {
      const r = await pool.query('SELECT * FROM marketing_post_drafts WHERE id = $1', [id]);
      if (!r.rowCount) { res.status(404).json({ ok: false, error: 'draft not found' }); return; }
      const draft = r.rows[0];
      const platform = String(draft.platform);

      if (platform === 'facebook') {
        const pageId = (process.env.THEROLERROOM_PAGE_ID || '').trim();
        const pageToken = (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || '').trim();
        if (!pageId || !pageToken) {
          res.status(503).json({ ok: false, error: 'THEROLERROOM_PAGE_ID/TOKEN not configured' });
          return;
        }

        // Build message: caption + hashtags appended
        const hashtags = Array.isArray(draft.hashtags) ? draft.hashtags as string[] : [];
        const message = draft.caption + (hashtags.length > 0 ? '\n\n' + hashtags.join(' ') : '');

        const params = new URLSearchParams({
          message,
          access_token: pageToken,
        });
        if (draft.cta_link) {
          // Use link-attachment format so FB renders CTA-card
          params.set('link', String(draft.cta_link));
        }

        const upstream = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`, {
          method: 'POST', body: params,
        });
        const apiResponse = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
        if (upstream.ok && typeof apiResponse.id === 'string') {
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'published', published_at = now(),
                 external_post_id = $2, raw_publish_response = $3, publish_error = NULL,
                 updated_at = now()
             WHERE id = $1`,
            [id, String(apiResponse.id), JSON.stringify(apiResponse)],
          );
          res.json({
            ok: true,
            status: 'published',
            externalPostId: apiResponse.id,
            permalink: `https://www.facebook.com/${apiResponse.id}`,
          });
          return;
        } else {
          const errMsg = ((apiResponse.error as Record<string, unknown>)?.message as string) || `status ${upstream.status}`;
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'failed', publish_error = $2, raw_publish_response = $3, updated_at = now()
             WHERE id = $1`,
            [id, errMsg, JSON.stringify(apiResponse)],
          );
          res.status(502).json({
            ok: false, status: 'failed', error: errMsg, apiResponse,
          });
          return;
        }
      } else if (platform === 'linkedin') {
        // LinkedIn UGC via registrert publisher. Henter user_id fra
        // env (ROLE_ROOM_MARKETING_USER_ID) — fallback til daniel-konto.
        const userId = await resolveMarketingUserId(pool);
        if (!userId) {
          res.status(503).json({
            ok: false,
            error: 'Ingen marketing-bruker konfigurert. Sett ROLE_ROOM_MARKETING_USER_ID eller opprett bruker daniel@creatorhubn.com.',
          });
          return;
        }

        const hashtags = Array.isArray(draft.hashtags) ? draft.hashtags as string[] : [];
        const caption = String(draft.caption || '') + (hashtags.length > 0 ? '\n\n' + hashtags.join(' ') : '');
        const ctaLink = draft.cta_link ? String(draft.cta_link).trim() : '';

        const result = await dispatchPublish('linkedin', {
          connectionId: userId,
          userId,
          projectId: 'role-room-marketing',
          mediaKind: ctaLink ? 'link' : 'text',
          caption,
          extras: ctaLink ? { link: ctaLink } : undefined,
          scheduledFor: null,
        });

        if (result.ok && result.status === 'published') {
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'published', published_at = now(),
                 external_post_id = $2, raw_publish_response = $3, publish_error = NULL,
                 updated_at = now()
             WHERE id = $1`,
            [id, result.externalPostId ?? null, JSON.stringify(result.raw ?? result)],
          );
          res.json({
            ok: true,
            status: 'published',
            externalPostId: result.externalPostId,
            permalink: result.permalink,
          });
          return;
        }

        const errMsg = result.error || result.reason || `LinkedIn publish status: ${result.status}`;
        await pool.query(
          `UPDATE marketing_post_drafts
           SET status = 'failed', publish_error = $2, raw_publish_response = $3, updated_at = now()
           WHERE id = $1`,
          [id, errMsg, JSON.stringify(result.raw ?? result)],
        );
        res.status(502).json({
          ok: false, status: 'failed', error: errMsg, reason: result.reason,
        });
        return;
      } else if (platform === 'instagram') {
        // IG container-flow via registrert publisher. Krever:
        //   1) en IG-connection (role_room_instagram_connections) for marketing-bruker
        //   2) et bilde — enten image_data_url (base64) eller image_url (offentlig HTTP)
        const userId = await resolveMarketingUserId(pool);
        if (!userId) {
          res.status(503).json({
            ok: false,
            error: 'Ingen marketing-bruker konfigurert. Sett ROLE_ROOM_MARKETING_USER_ID eller opprett bruker daniel@creatorhubn.com.',
          });
          return;
        }

        const connectionId = await resolveIgConnectionId(pool, userId);
        if (!connectionId) {
          const errMsg = 'Ingen aktiv IG Business-tilkobling funnet for marketing-brukeren. Koble til IG på nytt.';
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'failed', publish_error = $2, updated_at = now()
             WHERE id = $1`,
            [id, errMsg],
          );
          res.status(503).json({ ok: false, status: 'failed', reason: 'connection_not_found', error: errMsg });
          return;
        }

        const imageDataUrl = await resolveImageDataUrl(draft);
        if (!imageDataUrl) {
          const errMsg = 'IG-publish krever bilde. Sett image_url (offentlig HTTP-URL) eller image_data_url (base64) på draften.';
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'failed', publish_error = $2, updated_at = now()
             WHERE id = $1`,
            [id, errMsg],
          );
          res.status(400).json({ ok: false, status: 'failed', reason: 'image_required', error: errMsg });
          return;
        }

        const hashtags = Array.isArray(draft.hashtags) ? draft.hashtags as string[] : [];
        const caption = String(draft.caption || '') + (hashtags.length > 0 ? '\n\n' + hashtags.join(' ') : '');

        const result = await dispatchPublish('instagram', {
          connectionId,
          userId,
          projectId: 'role-room-marketing',
          mediaKind: 'image',
          caption,
          imageUrl: imageDataUrl,
          scheduledFor: null,
        });

        if (result.ok && result.status === 'published') {
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'published', published_at = now(),
                 external_post_id = $2, raw_publish_response = $3, publish_error = NULL,
                 updated_at = now()
             WHERE id = $1`,
            [id, result.externalPostId ?? null, JSON.stringify(result.raw ?? result)],
          );
          res.json({
            ok: true,
            status: 'published',
            externalPostId: result.externalPostId,
            permalink: result.permalink,
          });
          return;
        }

        if (result.ok && (result.status === 'queued' || result.status === 'scheduled')) {
          // IG-jobben er kø-lagt og publisher worker fyrer den senere.
          // Markerer drafts som 'edited' (siden vi har commitet til publish)
          // og lagrer jobId for sporing. NB: vi oppdaterer ikke til 'published'
          // før Meta bekrefter; engagement-workeren plukker den opp via
          // external_post_id-feltet senere.
          res.json({
            ok: true,
            status: result.status,
            jobId: result.jobId,
            message: `IG-jobb ${result.status}. Worker fullfører innen 60s.`,
          });
          return;
        }

        const errMsg = result.error || result.reason || `Instagram publish status: ${result.status}`;
        await pool.query(
          `UPDATE marketing_post_drafts
           SET status = 'failed', publish_error = $2, raw_publish_response = $3, updated_at = now()
           WHERE id = $1`,
          [id, errMsg, JSON.stringify(result.raw ?? result)],
        );
        res.status(502).json({
          ok: false, status: 'failed', error: errMsg, reason: result.reason,
        });
        return;
      } else if (platform === 'tiktok') {
        // TikTok Content Posting API via registrert publisher. Krever:
        //   1) en TikTok-connection (role_room_tiktok_connections) med video.upload-scope
        //   2) en video — enten video_data_url (base64 data:video/mp4) eller video_url (HTTP MP4)
        const userId = await resolveMarketingUserId(pool);
        if (!userId) {
          res.status(503).json({
            ok: false,
            error: 'Ingen marketing-bruker konfigurert. Sett ROLE_ROOM_MARKETING_USER_ID eller opprett bruker daniel@creatorhubn.com.',
          });
          return;
        }

        const hasConn = await resolveTikTokConnectionExists(pool, userId);
        if (!hasConn) {
          const errMsg = 'Ingen aktiv TikTok-tilkobling funnet for marketing-brukeren. Koble til TikTok-konto for The Role Room.';
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'failed', publish_error = $2, updated_at = now()
             WHERE id = $1`,
            [id, errMsg],
          );
          res.status(503).json({ ok: false, status: 'failed', reason: 'connection_not_found', error: errMsg });
          return;
        }

        const videoUrl = await resolveVideoDataUrl(draft);
        if (!videoUrl) {
          const errMsg = 'TikTok-publish krever video. Sett video_url (offentlig HTTP-link til MP4) eller video_data_url (base64) på draften.';
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'failed', publish_error = $2, updated_at = now()
             WHERE id = $1`,
            [id, errMsg],
          );
          res.status(400).json({ ok: false, status: 'failed', reason: 'video_required', error: errMsg });
          return;
        }

        const hashtags = Array.isArray(draft.hashtags) ? draft.hashtags as string[] : [];
        const caption = String(draft.caption || '') + (hashtags.length > 0 ? '\n\n' + hashtags.join(' ') : '');

        const result = await dispatchPublish('tiktok', {
          connectionId: userId,
          userId,
          projectId: 'role-room-marketing',
          mediaKind: 'video',
          caption,
          videoUrl,
          scheduledFor: null,
        });

        if (result.ok && result.status === 'published') {
          await pool.query(
            `UPDATE marketing_post_drafts
             SET status = 'published', published_at = now(),
                 external_post_id = $2, raw_publish_response = $3, publish_error = NULL,
                 updated_at = now()
             WHERE id = $1`,
            [id, result.externalPostId ?? null, JSON.stringify(result.raw ?? result)],
          );
          res.json({
            ok: true,
            status: 'published',
            externalPostId: result.externalPostId,
            permalink: result.permalink,
          });
          return;
        }

        if (result.ok && (result.status === 'queued' || result.status === 'scheduled')) {
          // INBOX_DELIVERED: TikTok inbox-flow — videoen ligger i brukerens
          // app-inbox og må publiseres derfra. Markerer som edited + lagrer
          // publishId i external_post_id slik at engagement-tracking kan finne den.
          await pool.query(
            `UPDATE marketing_post_drafts
             SET external_post_id = $2, raw_publish_response = $3, updated_at = now()
             WHERE id = $1`,
            [id, result.externalPostId ?? result.jobId ?? null, JSON.stringify(result.raw ?? result)],
          );
          res.json({
            ok: true,
            status: result.status,
            jobId: result.jobId,
            reason: result.reason,
            message: result.reason === 'inbox_delivered'
              ? 'Video sendt til TikTok-app-inbox. Åpne TikTok-app for å fullføre publisering.'
              : `TikTok-jobb ${result.status}.`,
          });
          return;
        }

        const errMsg = result.error || result.reason || `TikTok publish status: ${result.status}`;
        await pool.query(
          `UPDATE marketing_post_drafts
           SET status = 'failed', publish_error = $2, raw_publish_response = $3, updated_at = now()
           WHERE id = $1`,
          [id, errMsg, JSON.stringify(result.raw ?? result)],
        );
        res.status(502).json({
          ok: false, status: 'failed', error: errMsg, reason: result.reason,
        });
        return;
      } else {
        // Ukjent platform — marker som manual_copy
        await pool.query(
          `UPDATE marketing_post_drafts
           SET status = 'manual_copy', updated_at = now()
           WHERE id = $1`,
          [id],
        );
        res.json({
          ok: true,
          status: 'manual_copy',
          message: `Auto-publish for ${platform} ikke implementert ennå. Caption + hashtags klare for copy-paste.`,
        });
        return;
      }
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
}

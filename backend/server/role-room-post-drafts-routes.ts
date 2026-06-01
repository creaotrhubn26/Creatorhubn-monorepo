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

export interface SetupPostDraftsRoutesDeps {
  app: Application;
  pool: Pool;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

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
      } else {
        // IG/LinkedIn/TikTok — not auto-publish yet
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

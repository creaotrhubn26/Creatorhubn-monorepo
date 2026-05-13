/**
 * community-presence-routes.ts
 *
 * API for å koordinere ekstern presence på community-plattformer
 * (Product Hunt, Reddit, IndieHackers, BetaList, Hacker News, Discord,
 * film-blogger osv.). AdminRoom-tab driver workflow; The Role Room
 * Agent kan generere post-utkast via en separat tool-endpoint.
 *
 * Tabeller (migrasjon 143):
 *   - community_channels  → plattformene vi spores på
 *   - community_posts     → enkelt-poster per kanal (utkast/scheduled/published)
 *   - outreach_contacts   → journalister, bloggere, community-managers
 *
 * Auth: alle endpoints krever requireAdminSession (admin-only — dette
 * er internt vekst-verktøy, ikke produkt-feature).
 *
 * Robusthet:
 *   - Slug-/ID-validering (kun a-z 0-9 og bindestreker)
 *   - Whitelist på PATCH-felter
 *   - Catch-all 500 ved DB-feil med console.error for log-debug
 */

import type express from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  fetchRedditPostEngagement,
  searchRedditMentions,
  isRedditOAuthConfigured,
} from './reddit-engagement-service.js';

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface CommunityPresenceRoutesDeps {
  app: express.Express;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

interface CommunityChannelRow {
  id: string;
  channel_type: string;
  display_name: string;
  handle: string | null;
  url: string | null;
  audience_size: number | null;
  notes: string | null;
  status: string;
  priority: number;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

interface CommunityPostRow {
  id: string;
  channel_id: string;
  post_type: string;
  title: string;
  body: string | null;
  audience_tag: string | null;
  status: string;
  scheduled_for: Date | null;
  published_at: Date | null;
  published_url: string | null;
  upvotes: number | null;
  comments_count: number | null;
  ai_generated: boolean;
  ai_model: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

interface OutreachContactRow {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  email: string | null;
  twitter_handle: string | null;
  linkedin_url: string | null;
  priority: number;
  status: string;
  last_contacted: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

function isoOrNull(d: Date | null): string | undefined {
  return d ? d.toISOString() : undefined;
}

function serializeChannel(row: CommunityChannelRow): Record<string, unknown> {
  return {
    id: row.id,
    channel_type: row.channel_type,
    display_name: row.display_name,
    handle: row.handle ?? undefined,
    url: row.url ?? undefined,
    audience_size: row.audience_size ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    priority: row.priority,
    created_at: isoOrNull(row.created_at),
    updated_at: isoOrNull(row.updated_at),
  };
}

function serializePost(row: CommunityPostRow): Record<string, unknown> {
  return {
    id: row.id,
    channel_id: row.channel_id,
    post_type: row.post_type,
    title: row.title,
    body: row.body ?? undefined,
    audience_tag: row.audience_tag ?? undefined,
    status: row.status,
    scheduled_for: isoOrNull(row.scheduled_for),
    published_at: isoOrNull(row.published_at),
    published_url: row.published_url ?? undefined,
    upvotes: row.upvotes ?? undefined,
    comments_count: row.comments_count ?? undefined,
    ai_generated: row.ai_generated,
    ai_model: row.ai_model ?? undefined,
    created_at: isoOrNull(row.created_at),
    updated_at: isoOrNull(row.updated_at),
  };
}

function serializeContact(row: OutreachContactRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? undefined,
    organization: row.organization ?? undefined,
    email: row.email ?? undefined,
    twitter_handle: row.twitter_handle ?? undefined,
    linkedin_url: row.linkedin_url ?? undefined,
    priority: row.priority,
    status: row.status,
    last_contacted: isoOrNull(row.last_contacted),
    notes: row.notes ?? undefined,
    created_at: isoOrNull(row.created_at),
    updated_at: isoOrNull(row.updated_at),
  };
}

export function setupCommunityPresenceRoutes(deps: CommunityPresenceRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ═══════════════════════════════════════════════════════════
  // CHANNELS
  // ═══════════════════════════════════════════════════════════

  app.get('/api/admin/community/channels', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query<CommunityChannelRow>(
        'SELECT * FROM community_channels ORDER BY priority ASC, display_name ASC',
      );
      return res.json({ success: true, channels: result.rows.map(serializeChannel) });
    } catch (error) {
      console.error('[community] list channels failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste kanaler', channels: [] });
    }
  });

  app.post('/api/admin/community/channels', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const channelType = String(body.channel_type ?? '').trim();
    const displayName = String(body.display_name ?? '').trim();
    if (!channelType || !displayName) {
      return res.status(400).json({ success: false, error: 'channel_type og display_name er påkrevd' });
    }
    const id = `cc_${randomUUID()}`;
    try {
      const result = await pool.query<CommunityChannelRow>(
        `INSERT INTO community_channels (id, channel_type, display_name, handle, url, audience_size, notes, status, priority, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          id,
          channelType.slice(0, 40),
          displayName.slice(0, 200),
          body.handle ?? null,
          body.url ?? null,
          body.audience_size ?? null,
          body.notes ?? null,
          body.status ?? 'planned',
          Number.isFinite(body.priority) ? body.priority : 3,
          session.email,
        ],
      );
      return res.json({ success: true, channel: serializeChannel(result.rows[0]) });
    } catch (error) {
      console.error('[community] create channel failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke opprette kanal' });
    }
  });

  app.patch('/api/admin/community/channels/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id påkrevd' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const allowed = ['display_name', 'handle', 'url', 'audience_size', 'notes', 'status', 'priority'] as const;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (f in body) {
        sets.push(`${f} = $${idx}`);
        params.push(body[f] ?? null);
        idx += 1;
      }
    }
    if (sets.length === 0) return res.status(400).json({ success: false, error: 'Ingen felt å oppdatere' });
    params.push(id);
    try {
      const result = await pool.query<CommunityChannelRow>(
        `UPDATE community_channels SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Kanal ikke funnet' });
      return res.json({ success: true, channel: serializeChannel(result.rows[0]) });
    } catch (error) {
      console.error('[community] update channel failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke oppdatere' });
    }
  });

  app.delete('/api/admin/community/channels/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || '').trim();
    try {
      const result = await pool.query('DELETE FROM community_channels WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Kanal ikke funnet' });
      return res.json({ success: true });
    } catch (error) {
      console.error('[community] delete channel failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke slette' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // POSTS
  // ═══════════════════════════════════════════════════════════

  app.get('/api/admin/community/posts', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const channelId = req.query.channelId ? String(req.query.channelId) : null;
    try {
      const result = channelId
        ? await pool.query<CommunityPostRow>(
            'SELECT * FROM community_posts WHERE channel_id = $1 ORDER BY scheduled_for DESC NULLS LAST, created_at DESC',
            [channelId],
          )
        : await pool.query<CommunityPostRow>(
            'SELECT * FROM community_posts ORDER BY scheduled_for DESC NULLS LAST, created_at DESC LIMIT 100',
          );
      return res.json({ success: true, posts: result.rows.map(serializePost) });
    } catch (error) {
      console.error('[community] list posts failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste posts', posts: [] });
    }
  });

  app.post('/api/admin/community/posts', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const channelId = String(body.channel_id ?? '').trim();
    const title = String(body.title ?? '').trim();
    if (!channelId || !title) {
      return res.status(400).json({ success: false, error: 'channel_id og title er påkrevd' });
    }
    const id = `cp_${randomUUID()}`;
    try {
      const result = await pool.query<CommunityPostRow>(
        `INSERT INTO community_posts
         (id, channel_id, post_type, title, body, audience_tag, status, scheduled_for, ai_generated, ai_model, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          id,
          channelId,
          body.post_type ?? 'launch_post',
          title.slice(0, 500),
          body.body ?? null,
          body.audience_tag ?? null,
          body.status ?? 'draft',
          body.scheduled_for ?? null,
          body.ai_generated === true,
          body.ai_model ?? null,
          session.email,
        ],
      );
      return res.json({ success: true, post: serializePost(result.rows[0]) });
    } catch (error) {
      console.error('[community] create post failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke opprette post' });
    }
  });

  app.patch('/api/admin/community/posts/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const allowed = [
      'title', 'body', 'audience_tag', 'status', 'scheduled_for', 'published_at',
      'published_url', 'upvotes', 'comments_count', 'post_type',
    ] as const;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (f in body) {
        sets.push(`${f} = $${idx}`);
        params.push(body[f] ?? null);
        idx += 1;
      }
    }
    if (sets.length === 0) return res.status(400).json({ success: false, error: 'Ingen felt' });
    params.push(id);
    try {
      const result = await pool.query<CommunityPostRow>(
        `UPDATE community_posts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Post ikke funnet' });
      return res.json({ success: true, post: serializePost(result.rows[0]) });
    } catch (error) {
      console.error('[community] update post failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke oppdatere' });
    }
  });

  app.delete('/api/admin/community/posts/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || '').trim();
    try {
      const result = await pool.query('DELETE FROM community_posts WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Post ikke funnet' });
      return res.json({ success: true });
    } catch (error) {
      console.error('[community] delete post failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke slette' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // OUTREACH CONTACTS
  // ═══════════════════════════════════════════════════════════

  app.get('/api/admin/community/contacts', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query<OutreachContactRow>(
        'SELECT * FROM outreach_contacts ORDER BY priority ASC, last_contacted DESC NULLS LAST, name ASC',
      );
      return res.json({ success: true, contacts: result.rows.map(serializeContact) });
    } catch (error) {
      console.error('[community] list contacts failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke laste kontakter', contacts: [] });
    }
  });

  app.post('/api/admin/community/contacts', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'name er påkrevd' });
    const id = `oc_${randomUUID()}`;
    try {
      const result = await pool.query<OutreachContactRow>(
        `INSERT INTO outreach_contacts
         (id, name, role, organization, email, twitter_handle, linkedin_url, priority, status, last_contacted, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          id,
          name.slice(0, 200),
          body.role ?? null,
          body.organization ?? null,
          body.email ?? null,
          body.twitter_handle ?? null,
          body.linkedin_url ?? null,
          Number.isFinite(body.priority) ? body.priority : 3,
          body.status ?? 'not_contacted',
          body.last_contacted ?? null,
          body.notes ?? null,
          session.email,
        ],
      );
      return res.json({ success: true, contact: serializeContact(result.rows[0]) });
    } catch (error) {
      console.error('[community] create contact failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke opprette kontakt' });
    }
  });

  app.patch('/api/admin/community/contacts/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const allowed = [
      'name', 'role', 'organization', 'email', 'twitter_handle', 'linkedin_url',
      'priority', 'status', 'last_contacted', 'notes',
    ] as const;
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (f in body) {
        sets.push(`${f} = $${idx}`);
        params.push(body[f] ?? null);
        idx += 1;
      }
    }
    if (sets.length === 0) return res.status(400).json({ success: false, error: 'Ingen felt' });
    params.push(id);
    try {
      const result = await pool.query<OutreachContactRow>(
        `UPDATE outreach_contacts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Kontakt ikke funnet' });
      return res.json({ success: true, contact: serializeContact(result.rows[0]) });
    } catch (error) {
      console.error('[community] update contact failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke oppdatere' });
    }
  });

  app.delete('/api/admin/community/contacts/:id', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || '').trim();
    try {
      const result = await pool.query('DELETE FROM outreach_contacts WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Kontakt ikke funnet' });
      return res.json({ success: true });
    } catch (error) {
      console.error('[community] delete contact failed:', error);
      return res.status(500).json({ success: false, error: 'Kunne ikke slette' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // REDDIT — engagement-refresh + mentions-søk
  // ═══════════════════════════════════════════════════════════
  // Bruker Reddit's offentlige JSON-API (ingen OAuth nødvendig).
  // Krever bare manuell trigger; ingen auto-refresh ennå.

  app.post('/api/admin/community/posts/:id/refresh-reddit', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.id || '').trim();
    if (!postId) return res.status(400).json({ success: false, error: 'post-id påkrevd' });

    try {
      const postResult = await pool.query<CommunityPostRow>(
        'SELECT * FROM community_posts WHERE id = $1',
        [postId],
      );
      if (postResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Post ikke funnet' });
      }
      const post = postResult.rows[0];
      if (!post.published_url) {
        return res.status(400).json({ success: false, error: 'Post mangler published_url' });
      }

      const engagement = await fetchRedditPostEngagement(post.published_url);
      if (!engagement) {
        return res.status(400).json({
          success: false,
          error: 'Kunne ikke hente Reddit-data (er URL en gyldig Reddit-post?)',
        });
      }

      const updated = await pool.query<CommunityPostRow>(
        `UPDATE community_posts
         SET upvotes = $1, comments_count = $2
         WHERE id = $3
         RETURNING *`,
        [engagement.upvotes, engagement.comments_count, postId],
      );

      return res.json({
        success: true,
        post: serializePost(updated.rows[0]),
        engagement,
      });
    } catch (error) {
      console.error('[community] reddit-refresh failed:', error);
      return res.status(500).json({
        success: false,
        error: `Reddit-refresh feilet: ${(error as Error).message}`,
      });
    }
  });

  // Status-endpoint: lar AdminRoom vise om OAuth er konfigurert
  app.get('/api/admin/community/reddit/status', (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    res.json({
      success: true,
      oauth_configured: isRedditOAuthConfigured(),
      mode: isRedditOAuthConfigured() ? 'oauth' : 'public-json',
    });
  });

  app.get('/api/admin/community/reddit/mentions', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const query = String(req.query.q || 'The Role Room').trim();
    if (!query) return res.status(400).json({ success: false, error: 'q (søkeord) påkrevd' });

    try {
      const mentions = await searchRedditMentions(query);
      return res.json({ success: true, query, mentions });
    } catch (error) {
      console.error('[community] reddit-mentions failed:', error);
      return res.status(500).json({
        success: false,
        error: `Reddit-mentions feilet: ${(error as Error).message}`,
        mentions: [],
      });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // AI POST DRAFT — for Role Room Agent integration
  // ═══════════════════════════════════════════════════════════
  // Returnerer en mal-streng for et community-post-utkast basert på
  // kanal-type og topic. Agenten kaller dette og fyller inn dynamisk
  // innhold etterpå. Lar admin se template-en separat fra agenten
  // selv.
  app.get('/api/admin/community/post-template', async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const channelType = String(req.query.channel_type || '').trim().toLowerCase();
    const topic = String(req.query.topic || '').trim() || 'The Role Room';

    const templates: Record<string, { title: string; body: string }> = {
      product_hunt: {
        title: `🎬 ${topic} — Norway's casting OS for film and content production`,
        body: `Hi Product Hunt 👋\n\nWe're launching ${topic} — a Norwegian casting and production platform for film, TV and content creators.\n\nWhat makes it different:\n- Built for the Nordic market (Norwegian language, GDPR-safe EU/EEA hosting)\n- Integrated AI agent that suggests candidates and summarizes pipelines\n- All-in-one: casting, manuscript, storyboard, crew, shoot day in one workspace\n- Free for students and indie creators\n\nWe'd love your feedback — what would make this 10× better for YOUR workflow?\n\nLink: https://theroleroom.com`,
      },
      hacker_news: {
        title: `Show HN: ${topic} – casting and production OS for Nordic film and TV`,
        body: `Hi HN,\n\nI've been building ${topic} for the past N months — a casting and production platform for Nordic film, TV and content production.\n\nWhy this exists: existing tools (StudioBinder, MovieMagic) are built for Hollywood, lack Norwegian language support, and require US-region data hosting. The Role Room is built for the Nordic market with:\n\n- Norwegian + English UI\n- EU/EEA-only data hosting (GDPR-compliant)\n- AI agent (Anthropic Claude) integrated for casting workflow\n- Everything in one workspace: casting, scripts, storyboard, crew, shoot day, contracts\n\nTech: React/TypeScript frontend, Node/Postgres backend, Anthropic Claude for AI.\n\nFree for students and indie creators. Happy to answer questions about the architecture, the AI agent design, or how we approach GDPR for media production data.\n\nLink: https://theroleroom.com`,
      },
      indie_hackers: {
        title: `Building ${topic} — Norway's casting OS (build-in-public update)`,
        body: `Hey IH 👋\n\nQuick update on ${topic}:\n\n**Where we are**\n- N paying customers\n- N kandidater administrert i live-prosjekter\n- N produksjoner kjørt gjennom platformen\n\n**What we learned this week**\n- [insight 1]\n- [insight 2]\n- [insight 3]\n\n**What's next**\n- [next step]\n\nQuestion for the community: [open question]\n\nLink: https://theroleroom.com`,
      },
      reddit: {
        title: `[Resource] Free Nordic casting + production tool (gratis for studenter/indie)`,
        body: `Hi r/{subreddit} 👋\n\nDisclosure: I'm one of the people building ${topic}, but this post is meant to share something genuinely useful — not just self-promote.\n\nWe've built a casting and production tool that's free for students, indie filmmakers, and small productions. It covers:\n\n- Casting pipeline (roles, candidates, audition scheduling, self-tape)\n- Manus + storyboard + shotlist in one workspace\n- Crew + location + equipment coordination\n- Call sheet generation\n\nWe're Nordic-focused so the UI is Norwegian + English, and data stays in EU.\n\nIf this is useful, link: https://theroleroom.com — feedback genuinely appreciated. If not, mods please delete.`,
      },
      beta_list: {
        title: `${topic} — Norway's casting OS for film and content production`,
        body: `${topic} is a casting and production platform for Nordic film, TV and content creators. Built for the Norwegian market with native language support, GDPR-safe EU/EEA hosting, and an integrated AI agent.\n\nAll-in-one workspace: casting (roles, candidates, audition), manuscript, storyboard, crew, shoot day, contracts.\n\nFree tier for students and indie creators.\n\nhttps://theroleroom.com`,
      },
    };

    const template = templates[channelType] ?? {
      title: `${topic} — short intro`,
      body: `${topic} is a Norwegian casting and production platform. Free for students and indie creators. Link: https://theroleroom.com`,
    };

    return res.json({ success: true, template });
  });
}

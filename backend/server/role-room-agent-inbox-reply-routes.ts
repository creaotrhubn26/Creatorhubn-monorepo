/**
 * role-room-agent-inbox-reply-routes.ts — Phase 2b inbox reply-drafting route.
 *
 * One endpoint:
 *   POST /api/role-room/social/inbox/:eventId/draft-reply
 *     body: { brandVoice?, instructions? }
 *     → { success: true, draft } | 4xx/404/429
 *
 * Guards mirror the other social routes: feature flag 'role-room-agent-producer'
 * + requireAdminSession. Per-user rate limit via checkEndpointRateLimit
 * ('inbox_draft_reply', 20/min), translated to HTTP 429 + Retry-After in the
 * same shape the social routes use.
 *
 * Wire up in backend/server/index.ts:
 *
 *   import { setupRoleRoomAgentInboxReplyRoutes } from "./role-room-agent-inbox-reply-routes";
 *
 *   setupRoleRoomAgentInboxReplyRoutes({
 *     app, pool, requireAdminSession, isCompatAdminFeatureEnabled,
 *   });
 */

import type express from 'express';
import type { Pool } from 'pg';

import { draftInboxReply } from './role-room-agent-inbox-reply.js';
import {
  checkEndpointRateLimit,
  RateLimitExceededError,
} from './role-room-agent-ratelimit.js';

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomAgentInboxReplyRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
}

/** Translate a RateLimitExceededError into an HTTP 429 + Retry-After. */
function send429(
  res: express.Response,
  err: RateLimitExceededError,
): express.Response {
  res.setHeader('Retry-After', String(err.retryAfterSeconds));
  return res.status(429).json({
    success: false,
    error: 'rate_limited',
    retryAfterSeconds: err.retryAfterSeconds,
  });
}

export function setupRoleRoomAgentInboxReplyRoutes(
  deps: RoleRoomAgentInboxReplyRoutesDeps,
): void {
  const { app, pool, requireAdminSession, isCompatAdminFeatureEnabled } = deps;

  app.post(
    '/api/role-room/social/inbox/:eventId/draft-reply',
    async (req, res) => {
      const featureId = 'role-room-agent-producer';
      if (!isCompatAdminFeatureEnabled(featureId)) {
        return res
          .status(403)
          .json({ success: false, error: 'The Role Room Agent er ikke aktivert.' });
      }
      const session = requireAdminSession(req, res);
      if (!session) return;

      const eventId =
        typeof req.params.eventId === 'string' ? req.params.eventId.trim() : '';
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId mangler.' });
      }

      // Per-user rate limit — every draft hits the Claude API (cost). Kept in
      // its own bucket so a burst here can't exhaust the agent budget.
      try {
        checkEndpointRateLimit(session.userId, 'inbox_draft_reply', 20);
      } catch (rlErr) {
        if (rlErr instanceof RateLimitExceededError) return send429(res, rlErr);
        throw rlErr;
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const brandVoice =
        typeof body.brandVoice === 'string' ? body.brandVoice : null;
      const instructions =
        typeof body.instructions === 'string' ? body.instructions : null;

      try {
        const result = await draftInboxReply(pool, {
          userId: session.userId,
          eventId,
          brandVoice,
          instructions,
        });
        if (!result.ok) {
          // not_owned / no_body / missing_* → 404 so we never leak existence;
          // model/lookup failures → 502.
          const notFoundCodes = new Set([
            'not_owned',
            'no_body',
            'missing_event',
            'missing_user',
          ]);
          if (notFoundCodes.has(result.error)) {
            return res
              .status(404)
              .json({ success: false, error: 'Fant ikke hendelsen.' });
          }
          return res.status(502).json({
            success: false,
            error: 'Kunne ikke generere svarforslag. Prøv igjen om litt.',
          });
        }
        return res.json({ success: true, draft: result.draft, model: result.model });
      } catch (error) {
        console.error('[inbox-draft-reply] failed', error);
        return res
          .status(500)
          .json({ success: false, error: 'Kunne ikke generere svarforslag.' });
      }
    },
  );
}

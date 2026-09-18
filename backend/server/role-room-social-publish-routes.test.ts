import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  loadFeedPlan: vi.fn(),
  saveFeedPlan: vi.fn(),
  markFailed: vi.fn(),
  markPublished: vi.fn(),
  canAccess: vi.fn(),
  dispatchPublish: vi.fn(),
  claimIdempotency: vi.fn(),
  enqueue: vi.fn(),
  linkedinStatus: vi.fn(),
  companies: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('./role-room-feed-plan.js', () => ({
  isSupportedPlatform: (value: unknown) => ['instagram', 'tiktok', 'linkedin'].includes(String(value)),
  loadFeedPlan: mocks.loadFeedPlan,
  saveFeedPlan: mocks.saveFeedPlan,
  markFeedPlanPostFailed: mocks.markFailed,
  markFeedPlanPostPublished: mocks.markPublished,
}));
vi.mock('./social-publisher-linkedin.js', () => ({
  getLinkedInConnectionStatusForUser: mocks.linkedinStatus,
  listManagedCompaniesForUser: mocks.companies,
}));
vi.mock('./social-publisher-youtube.js', () => ({ listYouTubeChannels: vi.fn() }));
vi.mock('./social-publisher-youtube-channel-plan.js', () => ({ generateYouTubeChannelPlan: vi.fn() }));
vi.mock('./social-publisher-tiktok.js', () => ({ getTikTokConnectionSummary: vi.fn() }));
vi.mock('./web-origin-allowlist.js', () => ({ safeReturnPath: vi.fn() }));
vi.mock('./role-room-producer-notifications.js', () => ({ notifyProducerOfClientPlatformConnection: vi.fn() }));
vi.mock('./role-room-client-portal.js', () => ({ resolveClientPortalSession: vi.fn() }));
vi.mock('./client-portal-connected-platforms.js', () => ({ getProjectProducerUserId: vi.fn() }));
vi.mock('./role-room-projects-routes.js', () => ({ canAccessRoleRoomProject: mocks.canAccess }));
vi.mock('./role-room-tiktok-oauth.js', () => ({
  startTikTokOauth: vi.fn(), completeTikTokOauthCallback: vi.fn(),
  disconnectTikTok: vi.fn(), getTikTokConfig: vi.fn(),
}));
vi.mock('./social-access-request.js', () => ({
  generateSocialAccessRequest: vi.fn(), isSupportedAccessRequestPlatform: vi.fn(),
}));
vi.mock('./social-publisher.js', () => ({
  dispatchPublish: mocks.dispatchPublish,
  dispatchFetchInsights: vi.fn(),
}));
vi.mock('./role-room-agent-feedback-insights.js', () => ({ buildAgentFeedbackInsights: vi.fn() }));
vi.mock('./role-room-instagram-publish.js', () => ({ getPublishQueueStats: vi.fn() }));
vi.mock('./role-room-agent-ratelimit.js', () => ({
  checkEndpointRateLimit: mocks.checkRateLimit,
  RateLimitExceededError: class RateLimitExceededError extends Error {},
}));
vi.mock('./role-room-social-idempotency.js', () => ({ claimIdempotencyKey: mocks.claimIdempotency }));
vi.mock('./role-room-linkedin-publish-queue.js', () => {
  class LinkedInPublishQueueConflictError extends Error {
    readonly code = 'linkedin_feed_post_already_scheduled';
  }
  return {
    enqueueLinkedInPublishJob: mocks.enqueue,
    getLinkedInPublishQueueStats: vi.fn(),
    LinkedInPublishQueueConflictError,
  };
});

import { setupRoleRoomSocialRoutes } from './role-room-social-routes.js';

const session = {
  userId: 'user-1',
  email: 'producer@example.test',
  name: 'Producer',
  role: 'admin',
  loginAt: new Date().toISOString(),
};

function appWithAuth(
  requireAdminSession = vi.fn(() => session),
  poolQuery = vi.fn(async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 })),
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { adminSession?: unknown }).adminSession = session;
    next();
  });
  setupRoleRoomSocialRoutes({
    app,
    pool: { query: poolQuery } as never,
    requireAdminSession,
    isCompatAdminFeatureEnabled: () => true,
  });
  return { app, requireAdminSession, poolQuery };
}

function publishBody(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'linkedin',
    idempotencyKey: 'role-room-linkedin:project-1:post-1:test',
    post: {
      connectionId: 'connection-1',
      projectId: 'project-1',
      feedPlanPostId: 'post-1',
      mediaKind: 'text',
      caption: 'Hello LinkedIn',
      ...overrides,
    },
  };
}

describe('Role Room LinkedIn publish routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccess.mockResolvedValue(true);
    mocks.claimIdempotency.mockResolvedValue({ fresh: true });
    mocks.loadFeedPlan.mockResolvedValue({
      brandSnapshot: null,
      posts: [{ id: 'post-1', approvalState: 'approved' }],
    });
    mocks.markFailed.mockResolvedValue({ touched: true });
    mocks.dispatchPublish.mockResolvedValue({ ok: true, status: 'published' });
  });

  it('invokes requireAdminSession and does not trust an injected req.adminSession', async () => {
    const requireAdminSession = vi.fn((_req, res) => {
      res.status(401).json({ error: 'unauthorized' });
      return null;
    });
    const { app } = appWithAuth(requireAdminSession);
    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(401);
    expect(requireAdminSession).toHaveBeenCalledOnce();
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it('fails closed when only one feed-plan reference is supplied', async () => {
    const { app } = appWithAuth();
    const response = await request(app)
      .post('/api/role-room/social/publish')
      .send(publishBody({ feedPlanPostId: undefined }));

    expect(response.status).toBe(400);
    expect(response.body.gate).toBe('feed_plan_reference_incomplete');
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it('requires an idempotency key for every LinkedIn publish', async () => {
    const body = publishBody() as Record<string, unknown>;
    delete body.idempotencyKey;
    const { app } = appWithAuth();

    const response = await request(app).post('/api/role-room/social/publish').send(body);

    expect(response.status).toBe(400);
    expect(response.body.gate).toBe('idempotency_key_required');
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('blocks immediate publishing of an already scheduled post', async () => {
    mocks.loadFeedPlan.mockResolvedValue({
      brandSnapshot: null,
      posts: [{
        id: 'post-1',
        approvalState: 'scheduled',
        scheduledFor: '2035-01-02T12:00:00.000Z',
      }],
    });
    const { app } = appWithAuth();
    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(409);
    expect(response.body.gate).toBe('approval_required');
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it('enqueues a future LinkedIn post and never dispatches it immediately', async () => {
    const scheduledFor = '2035-01-02T12:00:00.000Z';
    mocks.enqueue.mockResolvedValue({
      deduped: false,
      job: { id: 'job-1', scheduledFor: new Date(scheduledFor) },
    });
    const { app } = appWithAuth();
    const response = await request(app)
      .post('/api/role-room/social/publish')
      .send(publishBody({ scheduledFor }));

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('scheduled');
    expect(response.body.jobId).toBe('job-1');
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      projectId: 'project-1',
      feedPlanPostId: 'post-1',
      scheduledFor: new Date(scheduledFor),
    }));
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it('rejects a past scheduledFor instead of falling through to immediate publish', async () => {
    const { app } = appWithAuth();
    const response = await request(app)
      .post('/api/role-room/social/publish')
      .send(publishBody({ scheduledFor: '2020-01-01T00:00:00.000Z' }));

    expect(response.status).toBe(400);
    expect(response.body.gate).toBe('scheduled_time_not_future');
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it('returns a conflict instead of claiming a duplicate immediate publish succeeded', async () => {
    mocks.claimIdempotency.mockResolvedValue({ fresh: false });
    const { app } = appWithAuth();
    const response = await request(app)
      .post('/api/role-room/social/publish')
      .send({ ...publishBody(), idempotencyKey: 'same-request' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('idempotency_key_already_claimed');
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it('fails closed when the immediate idempotency store is unavailable', async () => {
    mocks.claimIdempotency.mockRejectedValue(new Error('database unavailable'));
    const { app } = appWithAuth();

    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(503);
    expect(response.body.gate).toBe('idempotency_unavailable');
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it('releases a safe pre-side-effect failure and never exposes raw provider data', async () => {
    mocks.dispatchPublish.mockResolvedValue({
      ok: false,
      status: 'failed',
      reason: 'validation_failed',
      error: 'Ugyldig innhold.',
      raw: { providerSecret: 'must-not-leak' },
    });
    const { app, poolQuery } = appWithAuth();

    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(422);
    expect(response.body.raw).toBeUndefined();
    expect(response.text).not.toContain('must-not-leak');
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM role_room_social_idempotency'),
      ['social_publish', 'user-1', 'role-room-linkedin:project-1:post-1:test'],
    );
  });

  it.each([
    {
      label: 'rate limit',
      result: {
        ok: false,
        status: 'rate_limited',
        reason: 'rate_limited',
        error: 'LinkedIn rate-limit ble nådd under publisering. Prøv igjen senere.',
      },
    },
    {
      label: 'image upload provider error',
      result: {
        ok: false,
        status: 'failed',
        reason: 'linkedin_api_error',
        error: 'bildeopplasting 2 feilet: provider unavailable',
      },
    },
    {
      label: 'organization ACL provider error',
      result: {
        ok: false,
        status: 'failed',
        reason: 'linkedin_api_error',
        error: 'siderollekontroll feilet: provider unavailable',
      },
    },
  ])('releases idempotency after a definite pre-post failure: $label', async ({ result }) => {
    mocks.dispatchPublish.mockResolvedValue(result);
    const { app, poolQuery } = appWithAuth();

    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(422);
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM role_room_social_idempotency'),
      ['social_publish', 'user-1', 'role-room-linkedin:project-1:post-1:test'],
    );
    expect(mocks.markFailed).not.toHaveBeenCalled();
  });

  it('locks an ambiguous LinkedIn response as uncertain without releasing idempotency', async () => {
    mocks.dispatchPublish.mockResolvedValue({
      ok: false,
      status: 'failed',
      reason: 'network_error',
      error: 'fetch failed',
      raw: { providerSecret: 'must-not-leak' },
    });
    const { app, poolQuery } = appWithAuth();

    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      success: false,
      status: 'uncertain',
      reason: 'publish_outcome_uncertain',
    });
    expect(response.text).not.toContain('must-not-leak');
    expect(mocks.markFailed).toHaveBeenCalledWith(
      expect.anything(),
      'project-1',
      'post-1',
      expect.stringContaining('Kontroller LinkedIn'),
    );
    expect(
      poolQuery.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM role_room_social_idempotency')),
    ).toBe(false);
  });

  it('locks an ambiguous LinkedIn Posts API failure without releasing idempotency', async () => {
    mocks.dispatchPublish.mockResolvedValue({
      ok: false,
      status: 'failed',
      reason: 'linkedin_api_error',
      error: 'publisering feilet: upstream unavailable',
    });
    const { app, poolQuery } = appWithAuth();

    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(202);
    expect(response.body.reason).toBe('publish_outcome_uncertain');
    expect(
      poolQuery.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM role_room_social_idempotency')),
    ).toBe(false);
  });

  it('locks a thrown LinkedIn dispatch as uncertain without releasing idempotency', async () => {
    mocks.dispatchPublish.mockRejectedValue(new Error('socket closed'));
    const { app, poolQuery } = appWithAuth();

    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(202);
    expect(response.body.reason).toBe('publish_outcome_uncertain');
    expect(mocks.markFailed).toHaveBeenCalledWith(
      expect.anything(),
      'project-1',
      'post-1',
      expect.stringContaining('Kontroller LinkedIn'),
    );
    expect(
      poolQuery.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM role_room_social_idempotency')),
    ).toBe(false);
  });

  it('rejects a LinkedIn connection belonging to another project or user', async () => {
    const poolQuery = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const { app } = appWithAuth(vi.fn(() => session), poolQuery);

    const response = await request(app).post('/api/role-room/social/publish').send(publishBody());

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('connection_not_found');
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
    expect(poolQuery.mock.calls[0]?.[1]).toEqual([
      'connection-1',
      'user-1',
      'project-1',
      JSON.stringify(['w_member_social']),
    ]);
  });

  it('passes projectId to the project-aware profile and company helpers', async () => {
    mocks.linkedinStatus
      .mockResolvedValueOnce({
        connectionId: 'personal-connection', connected: true,
        scopes: ['w_member_social'], expiresAt: '2035-01-01T00:00:00.000Z',
        publishReady: true, organizationPublishReady: false,
        reconnectRequired: false, connectionScope: 'global',
        memberId: 'member-1', name: 'Producer', email: null, profilePictureUrl: null,
      })
      .mockResolvedValueOnce({
        connectionId: 'organization-connection', connected: true,
        scopes: ['r_organization_admin', 'w_organization_social'],
        expiresAt: '2035-01-01T00:00:00.000Z',
        publishReady: false, organizationPublishReady: true,
        reconnectRequired: false, connectionScope: 'project',
        memberId: 'member-2', name: 'Client', email: null, profilePictureUrl: null,
      });
    mocks.companies.mockResolvedValue({
      companies: [], scopeMissing: true, reconnectRequired: true, connectionScope: 'project',
    });
    const { app } = appWithAuth();

    const profile = await request(app).get('/api/role-room/linkedin/profile?projectId=project-1');
    const companies = await request(app).get('/api/role-room/linkedin/companies?projectId=project-1');

    expect(profile.status).toBe(200);
    expect(profile.body.connectionId).toBe('personal-connection');
    expect(profile.body.personalConnectionId).toBe('personal-connection');
    expect(profile.body.organizationConnectionId).toBe('organization-connection');
    expect(profile.body.publishReady).toBe(true);
    expect(profile.body.organizationPublishReady).toBe(true);
    expect(mocks.linkedinStatus).toHaveBeenNthCalledWith(1, expect.anything(), 'user-1', {
      author: 'personal',
    });
    expect(mocks.linkedinStatus).toHaveBeenNthCalledWith(2, expect.anything(), 'user-1', {
      projectId: 'project-1', author: 'company',
    });
    expect(companies.status).toBe(200);
    expect(mocks.companies).toHaveBeenCalledWith(expect.anything(), 'user-1', 'project-1');
  });
});

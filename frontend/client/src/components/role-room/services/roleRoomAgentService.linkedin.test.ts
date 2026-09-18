import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canUseLocalDevAdminSession: vi.fn(),
  getAuthHeadersSync: vi.fn(),
  getSessionSync: vi.fn(),
}));

vi.mock('../../../hooks/devAdminSessionGuard', () => ({
  canUseLocalDevAdminSession: mocks.canUseLocalDevAdminSession,
  DEV_ADMIN_SESSION_TOKEN: 'dev-admin-local-session',
}));

vi.mock('./authSessionService', () => ({
  authSessionService: {
    getAuthHeadersSync: mocks.getAuthHeadersSync,
    getSessionSync: mocks.getSessionSync,
  },
}));

import roleRoomAgentService from './roleRoomAgentService';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Role Room LinkedIn service contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthHeadersSync.mockReturnValue({ Authorization: 'Bearer session' });
    mocks.getSessionSync.mockReturnValue({});
    mocks.canUseLocalDevAdminSession.mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('loads the project-aware profile and derives readiness from scopes and expiry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      connected: true,
      id: 'connection-1',
      memberId: 'member-1',
      scopes: ['openid', 'w_member_social', 'r_organization_admin', 'w_organization_social'],
      expiresAt: '2099-01-01T00:00:00.000Z',
      publishReady: true,
      organizationPublishReady: true,
    }));

    const profile = await roleRoomAgentService.fetchLinkedInProfile('project / 1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/role-room/linkedin/profile?projectId=project+%2F+1',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(profile).toMatchObject({
      connectionId: 'connection-1',
      publishReady: true,
      organizationPublishReady: true,
      expiryDate: '2099-01-01T00:00:00.000Z',
    });
  });

  it('never reports publish-ready when the scope is missing or the token is expired', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      connected: true,
      connectionId: 'connection-2',
      scopes: ['openid'],
      expiresAt: '2020-01-01T00:00:00.000Z',
      publishReady: true,
      organizationPublishReady: true,
    }));

    await expect(roleRoomAgentService.fetchLinkedInProfile('project-2')).resolves.toMatchObject({
      publishReady: false,
      organizationPublishReady: false,
      reconnectRequired: true,
    });
  });

  it('starts OAuth with POST and preserves project and browser return context', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization?state=state-1',
      stateId: 'state-1',
    }));

    await roleRoomAgentService.startLinkedInOauth({
      projectId: 'project-3',
      returnPath: '/role-room?tab=feed',
      browserOrigin: 'https://creatorhub.example',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/role-room/linkedin/oauth/start',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          projectId: 'project-3',
          returnPath: '/role-room?tab=feed',
          browserOrigin: 'https://creatorhub.example',
        }),
      }),
    );
  });

  it('passes projectId when listing companies and preserves the backend error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: false,
      error: 'LinkedIn svarte ikke.',
    }, 502));

    await expect(roleRoomAgentService.listLinkedInCompanies('project/company')).resolves.toEqual({
      companies: [],
      scopeMissing: false,
      error: 'LinkedIn svarte ikke.',
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/role-room/linkedin/companies?projectId=project%2Fcompany',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('sends the dispatcher contract and normalizes a numeric external id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      success: true,
      ok: true,
      status: 'scheduled',
      externalPostId: 12345,
      permalink: 'https://www.linkedin.com/feed/update/urn:li:share:12345',
      jobId: 'job-1',
    }));

    const result = await roleRoomAgentService.publishLinkedIn({
      connectionId: 'connection-3',
      projectId: 'project-3',
      feedPlanPostId: 'post-3',
      mediaKind: 'carousel',
      caption: 'Caption',
      imageUrls: ['data:image/png;base64,one', 'data:image/png;base64,two'],
      linkedInOrganizationUrn: 'urn:li:organization:42',
      scheduledFor: '2099-02-03T10:00:00.000Z',
      idempotencyKey: 'role-room-linkedin:project-3:post-3:abcdef',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/role-room/social/publish',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          platform: 'linkedin',
          idempotencyKey: 'role-room-linkedin:project-3:post-3:abcdef',
          post: {
            connectionId: 'connection-3',
            projectId: 'project-3',
            feedPlanPostId: 'post-3',
            mediaKind: 'carousel',
            caption: 'Caption',
            imageUrl: undefined,
            imageUrls: ['data:image/png;base64,one', 'data:image/png;base64,two'],
            videoUrl: undefined,
            extras: { linkedInOrganizationUrn: 'urn:li:organization:42' },
            scheduledFor: '2099-02-03T10:00:00.000Z',
          },
        }),
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      status: 'scheduled',
      externalPostId: '12345',
      jobId: 'job-1',
    });
  });
});

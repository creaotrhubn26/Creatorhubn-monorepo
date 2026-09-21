import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./capture-assets-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./capture-assets-service.js')>();
  return { ...actual, fetchAsset: vi.fn() };
});
vi.mock('./capture-upload-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./capture-upload-service.js')>();
  return { ...actual, signAssetReadUrl: vi.fn() };
});
vi.mock('./capture-projects-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./capture-projects-service.js')>();
  return { ...actual, fetchProjectDetail: vi.fn() };
});

import { fetchAsset } from './capture-assets-service.js';
import { createCaptureRouter } from './capture-routes.js';
import { signAssetReadUrl } from './capture-upload-service.js';
import { fetchProjectDetail } from './capture-projects-service.js';

const mockedFetchAsset = vi.mocked(fetchAsset);
const mockedSignAssetReadUrl = vi.mocked(signAssetReadUrl);
const assetId = '10000000-0000-4000-8000-000000000001';

function makeAppState() {
  const app = express();
  app.use(express.json());
  const sessions = new Map([
    ['owner-token', {
      userId: 'owner-1',
      email: 'owner@example.test',
      name: 'Owner',
      role: 'user',
      loginAt: new Date().toISOString(),
    }],
  ]);
  const pool = {
    query: vi.fn(),
    connect: vi.fn(),
  };
  app.use('/api/capture', createCaptureRouter(pool as never, sessions));
  return { app, pool };
}

function makeApp() { return makeAppState().app; }

describe('capture asset private read URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const response = await request(makeApp())
      .get(`/api/capture/assets/${assetId}/read-url?kind=full`);

    expect(response.status).toBe(401);
    expect(mockedFetchAsset).not.toHaveBeenCalled();
  });

  it('owner-scopes the lookup and returns a no-store five-minute URL', async () => {
    mockedFetchAsset.mockResolvedValue({
      id: assetId,
      previewKey: 'creatorhub/photo/preview.jpg',
      fullKey: 'creatorhub/photo/full.jpg',
      rawKey: 'creatorhub/photo/original.cr3',
    } as never);
    mockedSignAssetReadUrl.mockResolvedValue('https://s3.example/signed-full');

    const response = await request(makeApp())
      .get(`/api/capture/assets/${assetId}/read-url?kind=full`)
      .set('Authorization', 'Bearer owner-token');

    expect(response.status).toBe(200);
    expect(mockedFetchAsset).toHaveBeenCalledWith(expect.anything(), 'owner-1', assetId);
    expect(mockedSignAssetReadUrl).toHaveBeenCalledWith('creatorhub/photo/full.jpg');
    expect(response.body).toEqual({
      url: 'https://s3.example/signed-full',
      kind: 'full',
      expiresInSeconds: 300,
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });

  it('does not sign a URL when the owner-scoped asset lookup fails', async () => {
    mockedFetchAsset.mockResolvedValue(null);

    const response = await request(makeApp())
      .get(`/api/capture/assets/${assetId}/read-url?kind=raw`)
      .set('Authorization', 'Bearer owner-token');

    expect(response.status).toBe(404);
    expect(mockedSignAssetReadUrl).not.toHaveBeenCalled();
  });
});

describe('capture memory-card transfer ledger', () => {
  const projectId = 'project-1';
  const transferId = '20000000-0000-4000-8000-000000000002';
  const body = {
    cardIdentifier: 'volume-123',
    cardName: 'EOS_DIGITAL',
    plannedCardLabel: 'A',
    capacityBytes: 64_000_000_000,
    availableBytes: 32_000_000_000,
    photoCount: 40,
    videoCount: 3,
    unsupportedCount: 1,
    assetCount: 43,
    duplicateCount: 0,
    failedCount: 0,
    totalBytes: 12_000_000,
    copiedBytes: 12_000_000,
    manifestSha256: 'a'.repeat(64),
    storagePolicy: 'local_and_cloud',
    status: 'local_verified',
    locallyVerifiedAt: '2026-09-21T00:00:00.000Z',
    cloudVerifiedAt: null,
    sourceDevice: 'Daniel’s iPad',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('owner-scopes the project before writing a validated card report', async () => {
    vi.mocked(fetchProjectDetail).mockResolvedValue({ id: projectId } as never);
    const state = makeAppState();
    state.pool.query.mockResolvedValue({ rows: [], rowCount: 1 } as never);

    const response = await request(state.app)
      .put(`/api/capture/projects/${projectId}/card-transfers/${transferId}`)
      .set('Authorization', 'Bearer owner-token')
      .send(body);

    expect(response.status).toBe(200);
    expect(fetchProjectDetail).toHaveBeenCalledWith(expect.anything(), 'owner-1', projectId);
    expect(state.pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO capture_card_transfers'),
      expect.arrayContaining([
        transferId, 'owner-1', projectId, 'volume-123', 'EOS_DIGITAL', 'a'.repeat(64),
      ]),
    );
  });

  it('does not write when the authenticated user does not own the project', async () => {
    vi.mocked(fetchProjectDetail).mockResolvedValue(null);
    const state = makeAppState();

    const response = await request(state.app)
      .put(`/api/capture/projects/${projectId}/card-transfers/${transferId}`)
      .set('Authorization', 'Bearer owner-token')
      .send(body);

    expect(response.status).toBe(404);
    expect(state.pool.query).not.toHaveBeenCalled();
  });

  it('does not acknowledge an owner/project conflict as a successful transfer', async () => {
    vi.mocked(fetchProjectDetail).mockResolvedValue({ id: projectId } as never);
    const state = makeAppState();
    state.pool.query.mockResolvedValue({ rows: [], rowCount: 0 } as never);

    const response = await request(state.app)
      .put(`/api/capture/projects/${projectId}/card-transfers/${transferId}`)
      .set('Authorization', 'Bearer owner-token')
      .send(body);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'transfer_id_conflict' });
  });

  it('rejects impossible byte counters before touching the database', async () => {
    vi.mocked(fetchProjectDetail).mockResolvedValue({ id: projectId } as never);
    const state = makeAppState();

    const response = await request(state.app)
      .put(`/api/capture/projects/${projectId}/card-transfers/${transferId}`)
      .set('Authorization', 'Bearer owner-token')
      .send({ ...body, copiedBytes: -1 });

    expect(response.status).toBe(400);
    expect(fetchProjectDetail).not.toHaveBeenCalled();
    expect(state.pool.query).not.toHaveBeenCalled();
  });

  it('rejects a malformed manifest checksum before touching the database', async () => {
    const state = makeAppState();

    const response = await request(state.app)
      .put(`/api/capture/projects/${projectId}/card-transfers/${transferId}`)
      .set('Authorization', 'Bearer owner-token')
      .send({ ...body, manifestSha256: 'not-a-sha256' });

    expect(response.status).toBe(400);
    expect(fetchProjectDetail).not.toHaveBeenCalled();
    expect(state.pool.query).not.toHaveBeenCalled();
  });
});

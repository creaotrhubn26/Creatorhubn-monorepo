// The Role Room sin private S3-bøtte eksponert gjennom den samme arkiv-
// browseren som B2. To ting må holde: den peker på en annen bøtte enn B2, og
// den er lesetilgang — appflytene som skrev produksjonsmedia eier
// livssyklusen til objektene, ikke admin-browseren.
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { registerB2CompanyArchiveRoutes } from './b2-company-archive-routes.js';

const PREFIX = '/api/role-room/admin/s3-archive';

function createApp(options: { readOnly?: boolean; configured?: boolean } = {}) {
  const { readOnly = true, configured = true } = options;
  const send = vi.fn(async () => ({ Contents: [], IsTruncated: false }));
  const app = express();
  registerB2CompanyArchiveRoutes({
    app,
    requireAdminSession: () => true,
    routePrefix: PREFIX,
    readOnly,
    resolveConfig: () => (configured
      ? { bucketName: 'the-role-room-prod-123456789012-eu-north-1', client: { send } as never }
      : null),
  });
  return { app, send };
}

describe('role room s3 archive routes', () => {
  it('lists from the Role Room bucket, not the B2 one', async () => {
    const { app, send } = createApp();

    const response = await request(app).get(`${PREFIX}/files`);

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalled();
    const command = send.mock.calls[0][0] as { input: { Bucket: string } };
    expect(command.input.Bucket).toBe('the-role-room-prod-123456789012-eu-north-1');
  });

  it('never registers upload or delete when read-only', async () => {
    const { app } = createApp();

    const upload = await request(app).post(`${PREFIX}/upload-url`).send({ key: 'x' });
    const remove = await request(app).delete(`${PREFIX}/files/whatever.jpg`);

    expect(upload.status).toBe(404);
    expect(remove.status).toBe(404);
  });

  it('still registers them for a writable mount', () => {
    // Stub-app i stedet for express: delete-ruta bruker `:key(*)`, som er
    // gyldig i express 4 (det backend pinner) men ikke i express 5 (det som
    // hoistes til rot-node_modules). Her teller vi registreringer, så testen
    // ikke avhenger av hvilken versjon som havner i oppslaget.
    const registered: string[] = [];
    const stubApp = {
      get: (path: string) => registered.push(`get ${path}`),
      post: (path: string) => registered.push(`post ${path}`),
      delete: (path: string) => registered.push(`delete ${path}`),
    } as never;

    registerB2CompanyArchiveRoutes({
      app: stubApp,
      requireAdminSession: () => true,
      routePrefix: PREFIX,
      resolveConfig: () => ({ bucketName: 'b', client: {} as never }),
    });

    expect(registered).toContain(`post ${PREFIX}/upload-url`);
    expect(registered).toContain(`delete ${PREFIX}/files/:key(*)`);
  });

  it('reports not configured instead of failing when the bucket is absent', async () => {
    const { app } = createApp({ configured: false });

    const response = await request(app).get(`${PREFIX}/health`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ connected: false, configured: false });
  });
});

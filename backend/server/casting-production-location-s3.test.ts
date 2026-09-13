import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('./casting-production-continuity-s3.js', () => ({
  checksumFile: vi.fn().mockResolvedValue({ hex: 'a'.repeat(64), base64: 'checksum-base64' }),
  organizationForUser: vi.fn().mockResolvedValue('org-1'),
  readRoleRoomContinuityS3Config: vi.fn().mockReturnValue({
    bucket: 'the-role-room-prod-745600963362-eu-north-1',
    region: 'eu-north-1',
  }),
  ROLE_ROOM_AWS_ACCOUNT_ID: '745600963362',
  roleRoomS3Client: vi.fn().mockReturnValue({ send }),
}));

import { uploadLocationScoutMediaToS3 } from './casting-production-location-s3.js';

const input = {
  userId: 'user-1',
  projectId: 'troll',
  locationId: 'forest',
  clientUploadId: '11111111-1111-4111-8111-111111111111',
  kind: 'audio' as const,
  captureMetadata: { source: 'recorder' as const, sceneIds: ['12A'] },
  displayName: 'room.wav',
  filePath: '/dev/null',
  sizeBytes: 120,
  contentType: 'audio/wav',
};

describe('location scout S3 persistence', () => {
  beforeEach(() => send.mockReset().mockResolvedValue({}));

  it('returns the existing tenant-scoped row for an idempotent retry without uploading again', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: '22222222-2222-4222-8222-222222222222', project_id: 'troll', location_id: 'forest', uploaded_by: 'user-1',
      client_upload_id: input.clientUploadId, media_kind: 'audio', capture_metadata: input.captureMetadata,
      display_name: 'room.wav', content_type: 'audio/wav', size_bytes: '120', checksum_sha256: 'a'.repeat(64),
      created_at: '2026-09-13T12:00:00.000Z',
    }], rowCount: 1 });

    const result = await uploadLocationScoutMediaToS3({ query } as unknown as Pool, input);

    expect(result).toEqual(expect.objectContaining({ ok: true, deduplicated: true }));
    expect(send).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('project_id = $1 AND location_id = $2'), [
      'troll', 'forest', input.clientUploadId,
    ]);
  });

  it('stores a new private object with checksum, encryption and retry metadata', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ created_at: '2026-09-13T12:00:00.000Z' }], rowCount: 1 });

    const result = await uploadLocationScoutMediaToS3({ query } as unknown as Pool, input);

    expect(result).toEqual(expect.objectContaining({ ok: true, media: expect.objectContaining({
      clientUploadId: input.clientUploadId, kind: 'audio', checksumSha256: 'a'.repeat(64),
    }) }));
    const command = send.mock.calls[0][0];
    expect(command.input).toEqual(expect.objectContaining({
      Bucket: 'the-role-room-prod-745600963362-eu-north-1',
      ContentType: 'audio/wav',
      ChecksumSHA256: 'checksum-base64',
      ServerSideEncryption: 'AES256',
      ExpectedBucketOwner: '745600963362',
      Metadata: expect.objectContaining({ 'media-kind': 'audio', 'client-upload-id': input.clientUploadId }),
    }));
    expect(query.mock.calls[1][0]).toContain('client_upload_id, media_kind, capture_metadata');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── S3 + signer mocks ─────────────────────────────────────────────────────
//
// Both @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner are mocked
// so we never touch the network. vi.mock is hoisted to the top of the
// file, so the mock classes and captures have to live inside the
// factory closures — referencing top-level const bindings here would
// hit the TDZ. We expose the captures via module re-imports after the
// module-under-test loads.

vi.mock('@aws-sdk/client-s3', () => {
  const sentCommands: unknown[] = [];
  const sendMock = vi.fn(async (cmd: unknown) => {
    sentCommands.push(cmd);
    return {};
  });
  class MockPutObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class MockGetObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class MockDeleteObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class MockS3Client {
    constructor(public config: Record<string, unknown>) {}
    send = sendMock;
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    GetObjectCommand: MockGetObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
    // Expose test doubles via extra exports so the test file can poke
    // at the captures without sharing top-level state.
    __mocks: { sentCommands, sendMock },
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => {
  const getSignedUrl = vi.fn(async () => 'https://signed.example/ok');
  return { getSignedUrl, __mocks: { getSignedUrl } };
});

import * as s3Module from '@aws-sdk/client-s3';
import * as presignerModule from '@aws-sdk/s3-request-presigner';

const { sentCommands, sendMock } = (s3Module as unknown as { __mocks: { sentCommands: unknown[]; sendMock: ReturnType<typeof vi.fn> } }).__mocks;
const { getSignedUrl: getSignedUrlMock } = (presignerModule as unknown as { __mocks: { getSignedUrl: ReturnType<typeof vi.fn> } }).__mocks;
const { PutObjectCommand: MockPutObjectCommand, GetObjectCommand: MockGetObjectCommand, DeleteObjectCommand: MockDeleteObjectCommand } = s3Module;

import {
  deleteInstagramHostedImage,
  isInstagramImageUploadConfigured,
  signInstagramHostedImageUrl,
  uploadImageForInstagram,
} from './role-room-instagram-image-upload';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  sentCommands.length = 0;
  sendMock.mockClear();
  getSignedUrlMock.mockClear();
  // Clear every R2-ish env var so the fallback chain is deterministic.
  for (const key of Object.keys(process.env)) {
    if (/R2|CLOUDFLARE|CAPTURE_R2/.test(key)) delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function configureR2() {
  process.env.CAPTURE_R2_ENDPOINT = 'https://acc.r2.cloudflarestorage.com';
  process.env.CAPTURE_R2_BUCKET = 'role-room-bucket';
  process.env.CAPTURE_R2_ACCESS_KEY_ID = 'key';
  process.env.CAPTURE_R2_SECRET_ACCESS_KEY = 'secret';
}

describe('isInstagramImageUploadConfigured', () => {
  it('returns false when any required env var is missing', () => {
    expect(isInstagramImageUploadConfigured()).toBe(false);
  });

  it('returns true when the CAPTURE_R2_* family is set', () => {
    configureR2();
    expect(isInstagramImageUploadConfigured()).toBe(true);
  });

  it('falls back through CLOUDFLARE_R2_* and R2_* variants', () => {
    process.env.R2_ENDPOINT = 'https://x';
    process.env.R2_BUCKET = 'b';
    process.env.R2_ACCESS_KEY_ID = 'k';
    process.env.R2_SECRET_ACCESS_KEY = 's';
    expect(isInstagramImageUploadConfigured()).toBe(true);
  });

  it('prefers the INSTAGRAM_R2_BUCKET override over CAPTURE_R2_BUCKET', () => {
    configureR2();
    process.env.INSTAGRAM_R2_BUCKET = 'dedicated-ig-bucket';
    // A quick upload to confirm the dedicated bucket is used.
    return uploadImageForInstagram({
      userId: 'u1',
      dataUrl: 'data:image/jpeg;base64,AAAA',
    }).then((result) => {
      expect(result?.bucket).toBe('dedicated-ig-bucket');
    });
  });
});

describe('uploadImageForInstagram', () => {
  it('returns null when R2 is not configured', async () => {
    const result = await uploadImageForInstagram({
      userId: 'u1',
      dataUrl: 'data:image/jpeg;base64,AAAA',
    });
    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns null for a malformed data URL (not base64-prefixed)', async () => {
    configureR2();
    const result = await uploadImageForInstagram({
      userId: 'u1',
      dataUrl: 'https://not-a-data-url.example/foo.jpg',
    });
    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('puts the object under the configured prefix + userId and returns a pre-signed URL', async () => {
    configureR2();
    const tinyJpegB64 = 'AQID'; // 3 bytes; content doesn't matter, just need valid base64.
    const result = await uploadImageForInstagram({
      userId: 'user-1',
      dataUrl: `data:image/jpeg;base64,${tinyJpegB64}`,
    });
    expect(result).not.toBeNull();
    expect(result!.bucket).toBe('role-room-bucket');
    expect(result!.key).toMatch(/^role-room\/instagram-publish\/user-1\/\d+-[0-9a-f]{16}\.jpg$/);
    expect(result!.contentType).toBe('image/jpeg');
    expect(result!.bytes).toBe(3);
    expect(result!.publicUrl).toBe('https://signed.example/ok');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const put = sentCommands[0] as MockPutObjectCommand;
    expect(put).toBeInstanceOf(MockPutObjectCommand);
    expect(put.input.Bucket).toBe('role-room-bucket');
    expect(put.input.ContentType).toBe('image/jpeg');
    // Cache header: short + private so Meta can't be served a stale copy.
    expect(put.input.CacheControl).toBe('private, max-age=60');
    // Pre-signer was called with a GetObjectCommand against the same key.
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const [, getCmd, opts] = getSignedUrlMock.mock.calls[0] as [unknown, MockGetObjectCommand, { expiresIn: number }];
    expect(getCmd).toBeInstanceOf(MockGetObjectCommand);
    expect(getCmd.input.Bucket).toBe('role-room-bucket');
    expect(getCmd.input.Key).toBe(result!.key);
    // 1h TTL — the publish pipeline re-signs later if needed.
    expect(opts.expiresIn).toBe(60 * 60);
  });

  it('picks the right extension for png/webp/jpg', async () => {
    configureR2();
    const a = await uploadImageForInstagram({ userId: 'u', dataUrl: 'data:image/png;base64,AAAA' });
    const b = await uploadImageForInstagram({ userId: 'u', dataUrl: 'data:image/webp;base64,AAAA' });
    const c = await uploadImageForInstagram({ userId: 'u', dataUrl: 'data:image/jpeg;base64,AAAA' });
    expect(a?.key).toMatch(/\.png$/);
    expect(b?.key).toMatch(/\.webp$/);
    expect(c?.key).toMatch(/\.jpg$/);
  });

  it('respects INSTAGRAM_R2_PREFIX when set', async () => {
    configureR2();
    process.env.INSTAGRAM_R2_PREFIX = 'custom-prefix/';
    const result = await uploadImageForInstagram({
      userId: 'u1',
      dataUrl: 'data:image/jpeg;base64,AAAA',
    });
    expect(result!.key.startsWith('custom-prefix/u1/')).toBe(true);
  });
});

describe('signInstagramHostedImageUrl', () => {
  it('returns null when R2 is unconfigured', async () => {
    expect(await signInstagramHostedImageUrl('b', 'k')).toBeNull();
  });

  it('prefers the bucket passed in (accommodating in-flight bucket migrations)', async () => {
    configureR2();
    await signInstagramHostedImageUrl('different-bucket', 'role-room/instagram-publish/u1/x.jpg');
    const [, getCmd] = getSignedUrlMock.mock.calls[0] as [unknown, MockGetObjectCommand];
    expect(getCmd.input.Bucket).toBe('different-bucket');
  });

  it('falls back to the configured bucket when the per-row bucket is empty', async () => {
    configureR2();
    await signInstagramHostedImageUrl('', 'role-room/instagram-publish/u1/x.jpg');
    const [, getCmd] = getSignedUrlMock.mock.calls[0] as [unknown, MockGetObjectCommand];
    expect(getCmd.input.Bucket).toBe('role-room-bucket');
  });

  it('returns null if the signer throws', async () => {
    configureR2();
    getSignedUrlMock.mockRejectedValueOnce(new Error('presign offline'));
    expect(await signInstagramHostedImageUrl('role-room-bucket', 'k')).toBeNull();
  });
});

describe('deleteInstagramHostedImage', () => {
  it('is a no-op when R2 is unconfigured (never throws)', async () => {
    await expect(deleteInstagramHostedImage('b', 'k')).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends a DeleteObjectCommand against the requested bucket/key', async () => {
    configureR2();
    await deleteInstagramHostedImage('role-room-bucket', 'some/key.jpg');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const del = sentCommands[0] as MockDeleteObjectCommand;
    expect(del).toBeInstanceOf(MockDeleteObjectCommand);
    expect(del.input.Bucket).toBe('role-room-bucket');
    expect(del.input.Key).toBe('some/key.jpg');
  });

  it('swallows errors (best-effort cleanup)', async () => {
    configureR2();
    sendMock.mockRejectedValueOnce(new Error('network'));
    await expect(deleteInstagramHostedImage('b', 'k')).resolves.toBeUndefined();
  });
});

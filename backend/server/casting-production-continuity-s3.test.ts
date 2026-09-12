import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';

const aws = vi.hoisted(() => ({
  commands: [] as Array<{ name: string; input: Record<string, unknown> }>,
  clientConfigs: [] as Array<Record<string, unknown>>,
  tokenFileOptions: [] as Array<Record<string, unknown>>,
  oidcCredentialProvider: vi.fn(async () => ({
    accessKeyId: 'temporary-role-key',
    secretAccessKey: 'temporary-role-secret',
  })),
  getSignedUrl: vi.fn(async () => 'https://signed.s3.example/reference'),
}));

vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    S3Client: class {
      constructor(config: Record<string, unknown>) {
        aws.clientConfigs.push(config);
      }

      async send(command: Command) {
        aws.commands.push({ name: command.constructor.name, input: command.input });
        return {};
      }
    },
    PutObjectCommand: class PutObjectCommand extends Command {},
    GetObjectCommand: class GetObjectCommand extends Command {},
    DeleteObjectCommand: class DeleteObjectCommand extends Command {},
  };
});

vi.mock('@aws-sdk/credential-providers', () => ({
  fromTokenFile: vi.fn((options: Record<string, unknown>) => {
    aws.tokenFileOptions.push(options);
    return aws.oidcCredentialProvider;
  }),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: aws.getSignedUrl,
}));

import {
  getContinuityMediaS3DownloadUrl,
  readRoleRoomContinuityS3Config,
  resetRoleRoomContinuityS3ClientForTests,
  uploadContinuityMediaToS3,
} from './casting-production-continuity-s3.js';

const bucket = 'the-role-room-prod-745600963362-eu-north-1';
const roleArn = 'arn:aws:iam::745600963362:role/TheRoleRoomStorageRuntimeProd';
const tempDirectories: string[] = [];

function configureS3(): void {
  vi.stubEnv('AWS_ROLE_ARN', roleArn);
  vi.stubEnv('AWS_WEB_IDENTITY_TOKEN_FILE', '/render/oidc/aws-token');
  vi.stubEnv('AWS_ROLE_ROOM_BUCKET_NAME', bucket);
  vi.stubEnv('AWS_ROLE_ROOM_REGION', 'eu-north-1');
}

async function mediaFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'role-room-s3-test-'));
  tempDirectories.push(directory);
  const filePath = join(directory, 'reference.jpg');
  await writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  return filePath;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  aws.commands.length = 0;
  aws.clientConfigs.length = 0;
  aws.tokenFileOptions.length = 0;
  resetRoleRoomContinuityS3ClientForTests();
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('The Role Room continuity AWS S3 storage', () => {
  it('requires the exact Render role or dedicated Role Room keys and production bucket', () => {
    expect(readRoleRoomContinuityS3Config({
      AWS_ACCESS_KEY_ID: 'generic-key',
      AWS_SECRET_ACCESS_KEY: 'generic-secret',
      CREATORHUB_S3_BUCKET: 'creatorhubn-prod-745600963362-eu-north-1',
      CREATORHUB_S3_REGION: 'eu-north-1',
    })).toBeNull();

    expect(() => readRoleRoomContinuityS3Config({
      AWS_ROLE_ROOM_ACCESS_KEY_ID: 'key',
      AWS_ROLE_ROOM_SECRET_ACCESS_KEY: 'secret',
      AWS_ROLE_ROOM_BUCKET_NAME: 'wrong-product-bucket',
      AWS_ROLE_ROOM_REGION: 'eu-north-1',
    })).toThrow('AWS_ROLE_ROOM_BUCKET_NAME');

    expect(readRoleRoomContinuityS3Config({
      AWS_ROLE_ARN: roleArn,
      AWS_WEB_IDENTITY_TOKEN_FILE: '/render/oidc/aws-token',
      AWS_ROLE_ROOM_BUCKET_NAME: bucket,
      AWS_ROLE_ROOM_REGION: 'eu-north-1',
    })).toEqual({
      authentication: 'render_oidc',
      roleArn,
      webIdentityTokenFile: '/render/oidc/aws-token',
      bucket,
      region: 'eu-north-1',
    });

    expect(() => readRoleRoomContinuityS3Config({
      AWS_ROLE_ARN: 'arn:aws:iam::745600963362:role/AnotherRole',
      AWS_WEB_IDENTITY_TOKEN_FILE: '/render/oidc/aws-token',
      AWS_ROLE_ROOM_BUCKET_NAME: bucket,
      AWS_ROLE_ROOM_REGION: 'eu-north-1',
    })).toThrow('AWS_ROLE_ARN');

    expect(readRoleRoomContinuityS3Config({
      AWS_ROLE_ROOM_ACCESS_KEY_ID: 'local-role-room-key',
      AWS_ROLE_ROOM_SECRET_ACCESS_KEY: 'local-role-room-secret',
      AWS_ROLE_ROOM_SESSION_TOKEN: 'short-lived-session',
      AWS_ROLE_ROOM_BUCKET_NAME: bucket,
      AWS_ROLE_ROOM_REGION: 'eu-north-1',
    })).toEqual({
      authentication: 'dedicated_access_key',
      accessKeyId: 'local-role-room-key',
      secretAccessKey: 'local-role-room-secret',
      sessionToken: 'short-lived-session',
      bucket,
      region: 'eu-north-1',
    });
  });

  it('uploads an encrypted private object and registers project ownership in PostgreSQL', async () => {
    configureS3();
    const filePath = await mediaFixture();
    const query = vi.fn(async (sqlValue: unknown, values?: unknown[]) => {
      const sql = String(sqlValue);
      if (sql.includes('FROM organization_members')) {
        return { rows: [{ organization_id: 'org-1' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO casting_production_continuity_media')) {
        expect(values?.[1]).toBe('project-1');
        expect(values?.[2]).toBe('day-1');
        expect(values?.[3]).toBe('scene-1');
        expect(values?.[5]).toBe(bucket);
        expect(values?.[11]).toMatch(/^[0-9a-f]{64}$/);
        return { rows: [{ id: values?.[0], created_at: new Date('2026-09-12T08:00:00Z') }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await uploadContinuityMediaToS3({ query } as unknown as Pool, {
      userId: 'script-supervisor-1',
      projectId: 'project-1',
      productionDayId: 'day-1',
      sceneId: 'scene-1',
      displayName: 'Lykt før take.jpg',
      filePath,
      sizeBytes: 4,
      contentType: 'image/jpeg',
      kind: 'photo',
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      media: expect.objectContaining({
        projectId: 'project-1',
        productionDayId: 'day-1',
        sceneId: 'scene-1',
        contentType: 'image/jpeg',
      }),
    }));
    expect(aws.commands).toHaveLength(1);
    expect(aws.tokenFileOptions).toEqual([{
      roleArn,
      webIdentityTokenFile: '/render/oidc/aws-token',
      roleSessionName: 'the-role-room-backend',
      clientConfig: { region: 'eu-north-1' },
    }]);
    expect(aws.clientConfigs[0]).toEqual({
      region: 'eu-north-1',
      credentials: aws.oidcCredentialProvider,
    });
    expect(aws.commands[0]).toEqual(expect.objectContaining({
      name: 'PutObjectCommand',
      input: expect.objectContaining({
        Bucket: bucket,
        CacheControl: 'private, no-store',
        ServerSideEncryption: 'AES256',
        ExpectedBucketOwner: '745600963362',
      }),
    }));
    expect(String(aws.commands[0].input.Key)).toMatch(
      /^organizations\/org-1\/projects\/project-1\/production\/continuity\/production-days\/day-1\/scenes\/scene-1\/uploads\/script-supervisor-1\/[0-9a-f-]{36}-Lykt-f-r-take\.jpg$/,
    );
  });

  it('presigns only a database row bound to the requested project and day', async () => {
    configureS3();
    const query = vi.fn(async (sqlValue: unknown, values?: unknown[]) => {
      const sql = String(sqlValue);
      expect(sql).toContain('FROM casting_production_continuity_media');
      expect(values).toEqual([
        'f4aa5e8a-256a-4540-b76c-36e1c8e75432', 'project-1', 'day-1',
      ]);
      return {
        rows: [{
          bucket_name: bucket,
          object_key: 'organizations/org-1/projects/project-1/reference.jpg',
          display_name: 'reference.jpg',
          content_type: 'image/jpeg',
          size_bytes: '4',
        }],
        rowCount: 1,
      };
    });

    await expect(getContinuityMediaS3DownloadUrl({ query } as unknown as Pool, {
      fileId: 'f4aa5e8a-256a-4540-b76c-36e1c8e75432',
      projectId: 'project-1',
      productionDayId: 'day-1',
      expiresInSeconds: 300,
    })).resolves.toEqual({
      ok: true,
      url: 'https://signed.s3.example/reference',
      displayName: 'reference.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 4,
    });
    expect(aws.getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({ Bucket: bucket, ExpectedBucketOwner: '745600963362' }),
      }),
      { expiresIn: 300 },
    );
  });

  it('keeps the S3 ownership contract in the Drizzle migration', async () => {
    const sql = await readFile(
      new URL('../migrations/0594_role_room_production_continuity.sql', import.meta.url),
      'utf8',
    );
    const schema = await readFile(
      new URL('../migrations/role-room-schema.ts', import.meta.url),
      'utf8',
    );

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS casting_production_continuity_media');
    expect(sql).toContain("storage_provider = 'aws_s3'");
    expect(sql).toContain("bucket_name = 'the-role-room-prod-745600963362-eu-north-1'");
    expect(sql).toContain('REFERENCES casting_production_days(id) ON DELETE CASCADE');
    expect(schema).toContain("export const castingProductionContinuityMedia = pgTable('casting_production_continuity_media'");
  });
});

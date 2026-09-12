import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CONTINUITY_MEDIA_MAX_IMAGE_BYTES,
  inspectContinuityMediaFile,
  ProductionContinuityMediaValidationError,
} from './casting-production-continuity-media.js';

const tempDirs: string[] = [];

async function fixture(bytes: number[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'continuity-media-test-'));
  tempDirs.push(directory);
  const path = join(directory, 'fixture.upload');
  await writeFile(path, Buffer.from([...bytes, ...new Array(Math.max(0, 32 - bytes.length)).fill(0)]));
  return path;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('continuity media inspection', () => {
  it('detects an actual JPEG instead of trusting the extension', async () => {
    const path = await fixture([0xff, 0xd8, 0xff, 0xe0]);
    await expect(inspectContinuityMediaFile(path, 'image/jpeg', 32)).resolves.toEqual({
      kind: 'photo',
      contentType: 'image/jpeg',
    });
  });

  it('rejects a MIME declaration that does not match the file signature', async () => {
    const path = await fixture([0xff, 0xd8, 0xff, 0xe0]);
    await expect(inspectContinuityMediaFile(path, 'video/mp4', 32))
      .rejects.toBeInstanceOf(ProductionContinuityMediaValidationError);
  });

  it('enforces the smaller image limit after detecting the content', async () => {
    const path = await fixture([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(inspectContinuityMediaFile(path, 'image/png', CONTINUITY_MEDIA_MAX_IMAGE_BYTES + 1))
      .rejects.toThrow('25 MB');
  });
});

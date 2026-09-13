import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  inspectLocationScoutMediaFile,
  LOCATION_SCOUT_MEDIA_MAX_AUDIO_BYTES,
  LocationScoutMediaValidationError,
} from './casting-production-location-media.js';

const tempDirs: string[] = [];

async function fixture(bytes: number[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'location-scout-media-test-'));
  tempDirs.push(directory);
  const path = join(directory, 'fixture.upload');
  await writeFile(path, Buffer.from([...bytes, ...new Array(Math.max(0, 32 - bytes.length)).fill(0)]));
  return path;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('location scout media inspection', () => {
  it('accepts a real WAV field recording', async () => {
    const path = await fixture([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0,
      0x57, 0x41, 0x56, 0x45,
    ]);
    await expect(inspectLocationScoutMediaFile(path, 'audio/wav', 32)).resolves.toEqual({
      kind: 'audio',
      contentType: 'audio/wav',
    });
  });

  it('rejects disguised media instead of trusting MIME metadata', async () => {
    const path = await fixture([0xff, 0xd8, 0xff, 0xe0]);
    await expect(inspectLocationScoutMediaFile(path, 'audio/mpeg', 32))
      .rejects.toBeInstanceOf(LocationScoutMediaValidationError);
  });

  it('enforces the dedicated audio size limit', async () => {
    const path = await fixture([0x49, 0x44, 0x33]);
    await expect(inspectLocationScoutMediaFile(path, 'audio/mpeg', LOCATION_SCOUT_MEDIA_MAX_AUDIO_BYTES + 1))
      .rejects.toThrow('50 MB');
  });
});

import { describe, expect, it, vi } from 'vitest';

// Passthrough-only tests: these run in environments without ffmpeg, so
// we can't actually exercise the happy path end-to-end. The transcode
// happy-path is covered by the integration flow in
// role-room-instagram-publish.test.ts.

import { normalizeReelDataUrl } from './role-room-video-normalize';

describe('normalizeReelDataUrl', () => {
  it('returns source_not_video for an image data URL', async () => {
    const result = await normalizeReelDataUrl('data:image/jpeg;base64,AAAA');
    expect(result.normalized).toBe(false);
    expect(result.skipReason).toBe('source_not_video');
    expect(result.dataUrl).toBe('data:image/jpeg;base64,AAAA');
  });

  it('returns source_not_video for a malformed data URL', async () => {
    const result = await normalizeReelDataUrl('not-a-data-url');
    expect(result.normalized).toBe(false);
    expect(result.skipReason).toBe('source_not_video');
  });

  it('passes the video through when ffmpeg is missing from PATH', async () => {
    // Sabotage PATH so `ffmpeg` isn't resolvable. The helper's
    // availability probe then returns false → passthrough.
    const originalPath = process.env.PATH;
    process.env.PATH = '/nonexistent-dir';
    try {
      const result = await normalizeReelDataUrl('data:video/mp4;base64,AAAAA');
      expect(result.normalized).toBe(false);
      // Either ffmpeg_missing (the common case) or transcode_failed if
      // a stub ffmpeg happens to exist on PATH but can't process the
      // tiny fake input. Both are valid passthrough states.
      expect(['ffmpeg_missing', 'transcode_failed']).toContain(result.skipReason);
      expect(result.dataUrl).toBe('data:video/mp4;base64,AAAAA');
      expect(result.sourceBytes).toBeGreaterThan(0);
    } finally {
      process.env.PATH = originalPath;
    }
  });
});

import { describe, expect, it } from 'vitest';

import {
  detectDesktopPlatform,
  detectDesktopPlatformSync,
  isRecommendedDesktopDownload,
} from './desktopPlatform';

describe('desktop platform detection', () => {
  it('detects Windows and recommends the regular EXE installer', () => {
    const platform = detectDesktopPlatformSync({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' });
    expect(platform.os).toBe('Windows');
    expect(isRecommendedDesktopDownload({ os: 'Windows', arch: 'x64', format: 'EXE' }, platform)).toBe(true);
    expect(isRecommendedDesktopDownload({ os: 'Windows', arch: 'x64', format: 'MSI' }, platform)).toBe(false);
  });

  it('uses Client Hints architecture for an Apple Silicon recommendation', async () => {
    const platform = await detectDesktopPlatform({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      platform: 'MacIntel',
      userAgentData: {
        platform: 'macOS',
        getHighEntropyValues: async () => ({ architecture: 'arm', bitness: '64' }),
      },
    });
    expect(platform).toMatchObject({ os: 'macOS', architecture: 'arm64', architectureConfidence: 'detected' });
    expect(isRecommendedDesktopDownload({ os: 'macOS', arch: 'Apple Silicon', format: 'DMG' }, platform)).toBe(true);
  });

  it('does not mislabel mobile or Linux devices as macOS', () => {
    expect(detectDesktopPlatformSync({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' }).os).toBe('Android');
    expect(detectDesktopPlatformSync({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }).os).toBe('Linux');
    expect(detectDesktopPlatformSync({ userAgent: 'Mozilla/5.0 (iPad)', platform: 'MacIntel', maxTouchPoints: 5 }).os).toBe('iOS');
  });
});

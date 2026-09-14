export type DesktopOS = 'Windows' | 'macOS' | 'Linux' | 'iOS' | 'Android' | 'Unknown';
export type DesktopArchitecture = 'arm64' | 'x64' | 'unknown';

export interface DesktopPlatform {
  os: DesktopOS;
  architecture: DesktopArchitecture;
  architectureConfidence: 'detected' | 'unknown';
}

interface UserAgentDataLike {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
}

export interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: UserAgentDataLike;
}

function detectOS(nav: NavigatorLike): DesktopOS {
  const clientPlatform = nav.userAgentData?.platform || '';
  const platform = nav.platform || '';
  const ua = nav.userAgent || '';
  const combined = `${clientPlatform} ${platform} ${ua}`.toLowerCase();

  if (/android/.test(combined)) return 'Android';
  if (/iphone|ipad|ipod/.test(combined)
    || (/mac/.test(platform.toLowerCase()) && Number(nav.maxTouchPoints || 0) > 1)) return 'iOS';
  if (/windows|win32|win64/.test(combined)) return 'Windows';
  if (/macintosh|mac os|macintel|macarm/.test(combined)) return 'macOS';
  if (/linux|x11|cros/.test(combined)) return 'Linux';
  return 'Unknown';
}

function normalizeArchitecture(value: unknown): DesktopArchitecture {
  const architecture = String(value || '').toLowerCase();
  if (/arm|aarch64/.test(architecture)) return 'arm64';
  if (/x86|x64|amd64/.test(architecture)) return 'x64';
  return 'unknown';
}

export function detectDesktopPlatformSync(
  nav: NavigatorLike | undefined = typeof navigator === 'undefined' ? undefined : navigator as NavigatorLike,
): DesktopPlatform {
  if (!nav) return { os: 'Unknown', architecture: 'unknown', architectureConfidence: 'unknown' };
  const os = detectOS(nav);
  // Mac-nettlesere kan rapportere «Intel» også på Apple Silicon. Bare eksplisitt
  // ARM/x64 utenfor den generiske MacIntel-UA-en regnes derfor som sikkert funn.
  const raw = `${nav.userAgentData?.platform || ''} ${nav.platform || ''}`;
  const architecture = /macintel/i.test(raw) ? 'unknown' : normalizeArchitecture(raw);
  return {
    os,
    architecture,
    architectureConfidence: architecture === 'unknown' ? 'unknown' : 'detected',
  };
}

export async function detectDesktopPlatform(
  nav: NavigatorLike | undefined = typeof navigator === 'undefined' ? undefined : navigator as NavigatorLike,
): Promise<DesktopPlatform> {
  const base = detectDesktopPlatformSync(nav);
  if (!nav?.userAgentData?.getHighEntropyValues) return base;
  try {
    const hints = await nav.userAgentData.getHighEntropyValues(['architecture', 'bitness']);
    const architecture = normalizeArchitecture(hints.architecture);
    if (architecture === 'unknown') return base;
    return { ...base, architecture, architectureConfidence: 'detected' };
  } catch {
    return base;
  }
}

export function isRecommendedDesktopDownload(
  download: { os?: string; arch?: string; format?: string },
  platform: DesktopPlatform,
): boolean {
  if (download.os !== platform.os) return false;
  if (platform.os === 'Windows') return download.arch === 'x64' && download.format === 'EXE';
  if (platform.os !== 'macOS' || download.format !== 'DMG') return false;
  if (platform.architecture === 'arm64') return download.arch === 'Apple Silicon';
  if (platform.architecture === 'x64') return download.arch === 'Intel';
  // Safari skjuler ofte CPU-typen. Apple Silicon er standardvalget, mens Intel
  // forblir synlig rett under og forklares eksplisitt i dialogen.
  return download.arch === 'Apple Silicon';
}

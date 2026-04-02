const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|mov)$/i;

function replaceVideoExtension(
  videoUrl: string | undefined,
  replacement: string,
): string | undefined {
  if (!videoUrl || !VIDEO_EXTENSION_PATTERN.test(videoUrl)) {
    return undefined;
  }
  return videoUrl.replace(VIDEO_EXTENSION_PATTERN, replacement);
}

export function getRoleRoomVideoPosterUrl(
  videoUrl?: string,
  fallbackUrl?: string,
): string | undefined {
  return fallbackUrl
    || replaceVideoExtension(videoUrl, '_thumb.webp')
    || replaceVideoExtension(videoUrl, '.webp');
}

export function getRoleRoomVideoStillUrl(
  videoUrl?: string,
  fallbackUrl?: string,
): string | undefined {
  return fallbackUrl
    || replaceVideoExtension(videoUrl, '_thumb.webp')
    || replaceVideoExtension(videoUrl, '.webp');
}

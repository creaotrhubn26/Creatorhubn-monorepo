const configuredUrl = String(import.meta.env.VITE_EASEVERSE_APP_URL || 'https://easeverse.netlify.app').trim();

export const EASEVERSE_APP_URL = configuredUrl.replace(/\/+$/, '');

export function easeVerseBoothUrl(externalTrackId: string): string {
  return `${EASEVERSE_APP_URL}/booth/${encodeURIComponent(externalTrackId)}`;
}

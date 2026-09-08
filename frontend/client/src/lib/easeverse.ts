const configuredUrl = String(import.meta.env.VITE_EASEVERSE_APP_URL || 'https://easeverse.netlify.app').trim();

export const EASEVERSE_APP_URL = configuredUrl.replace(/\/+$/, '');

export function easeVerseBoothUrl(externalTrackId: string): string {
  return `${EASEVERSE_APP_URL}/booth/${encodeURIComponent(externalTrackId)}`;
}

export function easeVerseWorkspaceUrl(context: {
  creatorhubProjectId: string;
  audioReviewProjectId?: string | null;
  externalTrackId?: string | null;
  projectName?: string | null;
  returnTo?: string | null;
}): string {
  const url = new URL("/integrations/creatorhub", `${EASEVERSE_APP_URL}/`);
  url.searchParams.set("creatorhubProjectId", context.creatorhubProjectId);
  if (context.audioReviewProjectId) {
    url.searchParams.set("audioReviewProjectId", context.audioReviewProjectId);
  }
  if (context.externalTrackId) {
    url.searchParams.set("externalTrackId", context.externalTrackId);
  }
  if (context.projectName) {
    url.searchParams.set("projectName", context.projectName);
  }
  if (context.returnTo) {
    url.searchParams.set("returnTo", context.returnTo);
  }
  return url.toString();
}

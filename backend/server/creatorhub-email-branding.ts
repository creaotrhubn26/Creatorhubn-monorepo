export const CREATORHUB_LANDING_WORDMARK_URL =
  "https://creatorhubn.com/creatorhub-wordmark-light.png";

const LEGACY_CREATORHUB_EMAIL_LOGO_URLS = new Set([
  "/creatorhub-logo-amber.svg",
  "https://creatorhubn.com/creatorhub-logo-amber.svg",
]);

/**
 * Keep deliberate custom branding intact while migrating the old built-in
 * square mark to the same wordmark used by the public CreatorHub landing page.
 */
export function normalizeCreatorHubEmailLogoUrl(
  value: string | null | undefined,
): string {
  const configured = typeof value === "string" ? value.trim() : "";
  if (!configured || LEGACY_CREATORHUB_EMAIL_LOGO_URLS.has(configured)) {
    return CREATORHUB_LANDING_WORDMARK_URL;
  }
  return configured;
}

export function creatorHubEmailLogoDimensions(url: string): {
  width: number;
  height: number;
  style: string;
} {
  const assetPath = url.split(/[?#]/, 1)[0];
  if (assetPath.endsWith("/creatorhub-wordmark-light.png")) {
    return {
      width: 176,
      height: 52,
      style:
        "display:block;width:176px;max-width:100%;height:auto;border:0;object-fit:contain",
    };
  }
  return {
    width: 42,
    height: 42,
    style: "display:block;width:42px;height:42px;border:0;object-fit:contain",
  };
}

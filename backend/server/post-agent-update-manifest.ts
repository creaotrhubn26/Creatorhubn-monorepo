/**
 * post-agent-update-manifest.ts — robust updater-manifest for Post Agent.
 *
 * Bakgrunn: appens updater pekte på `releases/latest/download/post-agent-*.json`.
 * `releases/latest` er repoets GLOBALE nyeste release — men repoet publiserer
 * flere produkter (Pro Tools, Control Center, One Desk …). Publiserer et annet
 * produkt en release ETTER post-agent, peker `latest` feil → 404 → updater-sjekk
 * kaster (stille) → ingen «ny versjon»-dialog. Dette endepunktet tjener ALLTID
 * den nyeste POST-AGENT-manifesten (via POST_AGENT_LATEST_VERSION som release-
 * workflowen bumper), og returnerer direkte 200 (ingen GitHub-redirect eksponert).
 */

const REPO = 'creaotrhubn26/Creatorhubn-monorepo';
const KEY_RE = /^darwin-(aarch64|x86_64)$/;

/** Bygg GitHub-manifest-URL for en target-key. Tag-basert hvis versjon er kjent
 *  (robust — spesifikk post-agent-release), ellers fallback til /latest/. */
export function updateManifestUrl(key: string, latestVersion?: string | null): string | null {
  if (!KEY_RE.test(key)) return null;
  const v = (latestVersion ?? '').replace(/^v/i, '').trim();
  if (/^\d+\.\d+\.\d+$/.test(v)) {
    return `https://github.com/${REPO}/releases/download/post-agent-v${v}/post-agent-${key}.json`;
  }
  return `https://github.com/${REPO}/releases/latest/download/post-agent-${key}.json`;
}

/** Hent + valider manifesten. `fetcher` injiseres for testbarhet. */
export async function fetchUpdateManifest(
  key: string,
  latestVersion: string | null | undefined,
  fetcher: (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }> = fetch,
): Promise<{ ok: true; body: string } | { ok: false; status: number; error: string }> {
  const url = updateManifestUrl(key, latestVersion);
  if (!url) return { ok: false, status: 400, error: 'ugyldig_target' };
  try {
    const r = await fetcher(url);
    if (!r.ok) return { ok: false, status: 502, error: `manifest_utilgjengelig_${r.status}` };
    const body = await r.text();
    // Sanity: skal være JSON med en "version"-nøkkel.
    if (!body.includes('"version"')) return { ok: false, status: 502, error: 'ugyldig_manifest' };
    return { ok: true, body };
  } catch {
    return { ok: false, status: 502, error: 'hent_feilet' };
  }
}

/**
 * post-agent-update-manifest.ts — robust updater-manifest for Post Agent.
 *
 * Bakgrunn: appens updater pekte på `releases/latest/download/post-agent-*.json`.
 * `releases/latest` er repoets GLOBALE nyeste release — men repoet publiserer flere
 * produkter. Publiserer et annet produkt en release ETTER post-agent → peker feil.
 *
 * Robust løsning: spør GitHub RELEASES-API-et om nyeste `post-agent-v*`-tag (semver-
 * sortert, upåvirket av andre produkter) og server den taggens manifest. Faller
 * tilbake til `releases/latest/` hvis API-et er utilgjengelig. (Bruker IKKE
 * POST_AGENT_LATEST_VERSION — den viste seg stale på Render.)
 */

const REPO = 'creaotrhubn26/Creatorhubn-monorepo';
const KEY_RE = /^darwin-(aarch64|x86_64)$/;
const TAG_RE = /^post-agent-v(\d+)\.(\d+)\.(\d+)$/;

export interface GhRelease { tag_name?: string; draft?: boolean; prerelease?: boolean }

/** Nyeste post-agent-tag (semver-sortert) fra en GitHub releases-liste. null hvis ingen. */
export function latestPostAgentTag(releases: unknown): string | null {
  const arr = Array.isArray(releases) ? releases as GhRelease[] : [];
  const cand = arr
    .filter((r) => r && !r.draft && !r.prerelease && typeof r.tag_name === 'string' && TAG_RE.test(r.tag_name))
    .map((r) => { const m = TAG_RE.exec(r.tag_name as string)!; return { tag: r.tag_name as string, v: [+m[1], +m[2], +m[3]] }; })
    .sort((a, b) => b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.v[2] - a.v[2]);
  return cand[0]?.tag ?? null;
}

export function manifestUrlForTag(tag: string, key: string): string {
  return `https://github.com/${REPO}/releases/download/${tag}/post-agent-${key}.json`;
}
export function latestFallbackUrl(key: string): string {
  return `https://github.com/${REPO}/releases/latest/download/post-agent-${key}.json`;
}

type Fetchish = (url: string, opts?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/** Hent nyeste post-agent-manifest for en target-key. `fetcher` injiseres for testbarhet. */
export async function fetchUpdateManifest(
  key: string,
  fetcher: Fetchish = fetch as unknown as Fetchish,
): Promise<{ ok: true; body: string } | { ok: false; status: number; error: string }> {
  if (!KEY_RE.test(key)) return { ok: false, status: 400, error: 'ugyldig_target' };
  // 1) GitHub API → nyeste post-agent-tag (robust; ignorerer andre produkters releaser).
  let tag: string | null = null;
  try {
    const r = await fetcher(`https://api.github.com/repos/${REPO}/releases?per_page=30`,
      { headers: { 'User-Agent': 'post-agent-updater', Accept: 'application/vnd.github+json' } });
    if (r.ok) tag = latestPostAgentTag(JSON.parse(await r.text()));
  } catch { /* API nede → fallback under */ }
  const url = tag ? manifestUrlForTag(tag, key) : latestFallbackUrl(key);
  // 2) Hent selve manifesten (tag-spesifikk, ellers /latest/-fallback).
  try {
    const r = await fetcher(url);
    if (!r.ok) return { ok: false, status: 502, error: `manifest_utilgjengelig_${r.status}` };
    const body = await r.text();
    if (!body.includes('"version"')) return { ok: false, status: 502, error: 'ugyldig_manifest' };
    return { ok: true, body };
  } catch {
    return { ok: false, status: 502, error: 'hent_feilet' };
  }
}

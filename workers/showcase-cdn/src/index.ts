/**
 * showcase-cdn — Cloudflare Worker som proxyer signed B2-URLer.
 *
 * URL-mønster: creatorhubn.com/api/showcase/cdn/<gallery-token>/<item-id>
 *
 * Flyt per request:
 *   1. Parse token + item-id fra URL
 *   2. Spør backend /api/showcase/items/<item-id>/sign-url?token=<token>
 *      → { url: 'https://f003.backblazeb2.com/file/...?Authorization=...' }
 *   3. Fetch signed B2-URL (gratis via Bandwidth Alliance siden vi er
 *      på Cloudflare-edge)
 *   4. Stream tilbake med Cache-Control: 30 dager
 *
 * Cloudflare CDN cacher responsen via URL-hash. Etterfølgende request
 * for samme item går aldri til backend eller B2 — ren CDN-cache-hit.
 *
 * Hvis backend returnerer 404 (item slettet eller token utløpt),
 * propageres det. Gallery-eier (fotograf) får da en clear feilmelding.
 */

export interface Env {
  BACKEND_BASE: string;
  CACHE_TTL_SECONDS: string;
}

const TOKEN_REGEX = /^gly_[A-Za-z0-9_-]{8,64}$/;
// Item-id er en standard UUID (postgres uuid-kolonne).
const ITEM_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    // Mønster: /api/showcase/cdn/<token>/<itemId>
    const match = url.pathname.match(
      /^\/api\/showcase\/cdn\/([^/]+)\/([^/?]+)\/?$/,
    );
    if (!match) {
      return new Response('Not found', { status: 404 });
    }
    const token = match[1];
    const itemId = match[2];

    // Defensiv input-validering — Workeren kan bli truffet av rare
    // crawlers. Avvis åpenbart ugyldige tokens før vi hopper til backend.
    if (!TOKEN_REGEX.test(token) || !ITEM_REGEX.test(itemId)) {
      return new Response('Invalid token or item', { status: 400 });
    }

    // 1. Spør backend for signed B2-URL
    let signedUrl: string;
    try {
      const signResp = await fetch(
        `${env.BACKEND_BASE}/api/showcase/items/${encodeURIComponent(
          itemId,
        )}/sign-url?token=${encodeURIComponent(token)}`,
        {
          headers: {
            'User-Agent': 'showcase-cdn-worker/1.0',
          },
          // cf cache disabled for backend call — token validation må
          // alltid skje friskt
          cf: { cacheTtl: 0, cacheEverything: false },
        },
      );
      if (!signResp.ok) {
        const body = await signResp.text().catch(() => '');
        return new Response(
          `Sign-URL feilet (${signResp.status}): ${body.slice(0, 200)}`,
          { status: signResp.status === 404 ? 404 : 502 },
        );
      }
      const json = (await signResp.json()) as { url?: string };
      if (!json.url) {
        return new Response('Backend returnerte ingen URL', { status: 502 });
      }
      signedUrl = json.url;
    } catch (err) {
      return new Response(`Backend ikke tilgjengelig: ${err}`, { status: 502 });
    }

    // 2. Fetch fra B2 via Bandwidth Alliance (gratis)
    let b2Resp: Response;
    try {
      b2Resp = await fetch(signedUrl, {
        // Streaming — vi videresender body med Cache-headere
        cf: {
          cacheTtl: parseInt(env.CACHE_TTL_SECONDS, 10) || 2592000,
          cacheEverything: true,
        },
      });
    } catch (err) {
      return new Response(`B2 ikke tilgjengelig: ${err}`, { status: 502 });
    }

    if (!b2Resp.ok) {
      return new Response(`B2 (${b2Resp.status})`, { status: b2Resp.status });
    }

    // 3. Bygg respons med cache-headere så Cloudflare CDN cacher i 30 dager
    const headers = new Headers();
    const passThrough = [
      'content-type',
      'content-length',
      'last-modified',
      'etag',
    ];
    for (const h of passThrough) {
      const v = b2Resp.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set(
      'cache-control',
      `public, max-age=${env.CACHE_TTL_SECONDS || 2592000}, immutable`,
    );
    // CORS for visning fra frontend-galleri (creatorhubn.com)
    headers.set('access-control-allow-origin', '*');
    // Slett B2-auth-headere så de ikke leaker
    headers.delete('x-bz-content-sha1');
    headers.delete('x-bz-file-id');
    headers.delete('x-bz-file-name');

    return new Response(b2Resp.body, {
      status: 200,
      headers,
    });
  },
};

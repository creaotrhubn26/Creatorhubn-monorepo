/**
 * Vercel Edge Middleware — host-aware SEO rewrites.
 *
 * Vercel's static-filesystem lookup happens BEFORE `rewrites` in
 * vercel.json, so requests for paths like `/` and `/robots.txt` that
 * have concrete files in `client/dist/` short-circuit our rewrites.
 * This middleware runs even earlier, so we can serve Role Room-
 * specific SEO artifacts for theroleroom.com without moving the
 * underlying files.
 *
 * Matched paths are deliberately narrow: we only override for the
 * `/` landing, and rely on vercel.json rewrites for everything else
 * (which works fine because those paths don't collide with files).
 */

export const config = {
  matcher: ['/'],
};

export default function middleware(request: Request): Response | undefined {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || '').toLowerCase();

  const isRoleRoom = /^(?:www\.)?theroleroom\.com$/.test(host);
  if (!isRoleRoom) return undefined;

  if (url.pathname === '/') {
    const rewriteUrl = new URL('/theroleroom.html', url);
    // Vercel's internal rewrite header — the request continues on to
    // filesystem lookup of the rewritten path, so the client still
    // sees "/" in its address bar but we serve theroleroom.html.
    return new Response(null, {
      headers: { 'x-middleware-rewrite': rewriteUrl.toString() },
    });
  }
  return undefined;
}

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

import { rewrite, next } from '@vercel/edge';

export const config = {
  matcher: ['/'],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || '').toLowerCase();

  const isRoleRoom = /^(?:www\.)?theroleroom\.com$/.test(host);
  if (!isRoleRoom) return next();

  if (url.pathname === '/') {
    return rewrite(new URL('/theroleroom.html', url));
  }
  return next();
}

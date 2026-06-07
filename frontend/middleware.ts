/**
 * Vercel Edge Middleware — host-aware SEO rewrites.
 *
 * Vercel's static-filesystem lookup happens BEFORE `rewrites` i
 * vercel.json, så requests for paths som `/` med konkret fil i
 * `client/dist/` kortslutter rewriten. Middleware kjører tidligere,
 * så vi kan styre routing for SEO-artefakter på theroleroom.com.
 *
 * 2026-06-07: Root på theroleroom.com lever nå i React SPA
 * (TheRoleRoomLanding via LandingResponsive.tsx host-detect mot
 * produkt-dok). Den gamle /theroleroom.html-rewriten er fjernet —
 * den statiske filen kan fortsatt nås direkte hvis nødvendig, men
 * default på theroleroom.com/ er React SPA.
 */

import { next } from '@vercel/edge';

export const config = {
  matcher: ['/'],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || '').toLowerCase();
  console.log(`[mw] host=${host} path=${url.pathname} → pass through to SPA`);
  return next();
}

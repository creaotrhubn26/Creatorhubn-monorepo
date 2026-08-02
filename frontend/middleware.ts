/**
 * Vercel Edge Middleware — host-aware SEO.
 *
 * Vercel's static-filesystem lookup happens BEFORE `rewrites` i
 * vercel.json, så requests for paths som `/` med konkret fil i
 * `client/dist/` kortslutter rewriten. Middleware kjører tidligere,
 * så vi kan styre routing + per-host meta for theroleroom.com.
 *
 * 2026-06-07: Root på theroleroom.com lever i React SPA
 * (TheRoleRoomLanding via LandingResponsive.tsx host-detect).
 *
 * 2026-08-02: Per-host SEO-meta for theroleroom.com. Den statiske
 * index.html har CreatorHub-standard-tittel; SPA-en overstyrer den KUN
 * i nettleseren (client-side useEffect), så crawlere, delings-scrapere
 * og AI-agenter (rå HTTP-fetch) så «CreatorHub Norge» i stedet for
 * «The Role Room». Vi skriver om <title> + og/twitter-meta i den
 * server-leverte HTML-en for theroleroom.com, så identiteten er
 * konsistent uansett om JS kjøres. Speiler theroleroom-landing.tsx.
 */

import { next } from '@vercel/edge';

export const config = {
  matcher: ['/'],
};

const RR_TITLE = 'The Role Room — Operativsystemet for film- og innholdsproduksjon';
const RR_SITE_NAME = 'The Role Room';
const RR_DESC =
  'Operativsystemet som tar en norsk produksjon fra idé via casting og gjennomføring til den er distribuert og sett av publikum. Fire live vertikaler: Produksjons-OS, Innholdsprodusent, Dansestudio og Talent Registry.';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || '').toLowerCase();
  // Kun theroleroom.com (+ www) — IKKE leadgrid.theroleroom.com (egen merkevare).
  const isRoleRoom = host === 'theroleroom.com' || host === 'www.theroleroom.com';
  if (!isRoleRoom) return next();

  try {
    // Hent den statiske SPA-HTML-en (path `/index.html` matcher IKKE middleware
    // → ingen løkke) og skriv om identitets-metaen til The Role Room.
    const res = await fetch(new URL('/index.html', url.origin), {
      headers: { 'x-mw-rewrite': '1' },
    });
    if (!res.ok) return next();
    let html = await res.text();
    const t = esc(RR_TITLE);
    const d = esc(RR_DESC);
    html = html
      .replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`)
      .replace(/(<meta\s+property="og:site_name"\s+content=")[^"]*(")/i, `$1${esc(RR_SITE_NAME)}$2`)
      .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${t}$2`)
      .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i, `$1${t}$2`)
      .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/i, `$1${d}$2`)
      .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i, `$1${d}$2`)
      .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/i, `$1${d}$2`);
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch {
    return next();
  }
}

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
 *
 * 2026-07-17: Bot-gren lagt til (GEO). AI-crawlere kjører ikke JS og
 * fikk CreatorHub-skallet på både theroleroom.com/ og leadgrid.no/
 * pga. filesystem-precedence — «/»-rewritene i vercel.json treffer
 * aldri. KUN bot-user-agents rewrites her:
 *   - leadgrid.no/       → /geo/leadgrid/landing.html (prerendret, 3388 ord)
 *   - theroleroom.com/   → /theroleroom-root.html (TRR-skall m/ JSON-LD)
 * Mennesker passerer urørt til SPA-en (juni-beslutningen står).
 */

import { next, rewrite } from '@vercel/edge';

export const config = {
  matcher: ['/'],
};

const BOT_UA =
  /GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot/;

const LEADGRID_HOST = /(^|\.)leadgrid\.no$|^leadgrid\.theroleroom\.com$/;
const ROLEROOM_HOST = /(^|\.)theroleroom\.com$/;

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || '').toLowerCase();
  const ua = request.headers.get('user-agent') || '';

  if (BOT_UA.test(ua)) {
    if (LEADGRID_HOST.test(host)) {
      console.log(`[mw] bot på leadgrid-rot (${ua.slice(0, 40)}) → geo/leadgrid/landing.html`);
      return rewrite(new URL('/geo/leadgrid/landing.html', request.url));
    }
    if (ROLEROOM_HOST.test(host)) {
      console.log(`[mw] bot på theroleroom-rot (${ua.slice(0, 40)}) → theroleroom-root.html`);
      return rewrite(new URL('/theroleroom-root.html', request.url));
    }
  }

  console.log(`[mw] host=${host} path=${url.pathname} → pass through to SPA`);
  return next();
}

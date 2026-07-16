/**
 * geo-prerender-entry.tsx
 *
 * SSR-entry for GEO-prerendering av pillar-sidene på theroleroom.com.
 *
 * Bakgrunn (2026-07-16): AI-crawlere (GPTBot, ClaudeBot, PerplexityBot)
 * kjører ikke JavaScript. Rå-HTML-en de fikk for f.eks.
 * /norsk-casting-prosess var CreatorHub-SPA-skallet med
 * canonical → creatorhubn.com og null artikkelinnhold — pillar-sidene
 * var i praksis usynlige for motorene vi måler i geo-probe-engines og
 * ai-citation-trackeren.
 *
 * Denne entryen bygges med `vite build --ssr` og kjøres av
 * scripts/run-geo-prerender.mjs, som skriver én statisk HTML-fil per
 * publisert side til dist/geo/<key>.html. vercel.json ruter
 * theroleroom.com/<path> dit KUN for crawler-user-agents (dynamic
 * rendering) — mennesker beholder SPA-en, som også kan vise live
 * CMS-overrides fra Admin Room (useCmsBlocks kjører ikke i SSR, så
 * de statiske filene er alltid baseline-innholdet fra komponentene).
 *
 * Innholdet er identisk med det SPA-en rendrer (samme komponenter,
 * samme JSON-LD) — dette er prerendering, ikke cloaking.
 */

import { renderToString } from 'react-dom/server';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import { MarketingPageRouter } from '../components/admin/content-marketing/MarketingPageRouter';
import {
  MARKETING_PAGES,
  type MarketingPageConfig,
} from '../components/admin/content-marketing/marketingPagesConfig';

export interface PrerenderedPage {
  key: string;
  path: string;
  html: string;
}

const OG_IMAGE = 'https://theroleroom.com/role-room-assets/landing_backdrop_with_logo.webp';
const FAVICON = '/TheRoleRoom_App_Logo.png';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Newsletter-blokkene rendres som vanlige <form>-elementer uten React.
 * Denne inline-snutten gir dem samme oppførsel som NewsletterSignupBlock:
 * POST til /api/newsletter/role-room og takk-melding ved suksess.
 */
const NEWSLETTER_SCRIPT = `
(function () {
  document.querySelectorAll('form').forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    if (!input) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = (input.value || '').trim().toLowerCase();
      if (!email || email.indexOf('@') === -1) return;
      fetch('/api/newsletter/role-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source: 'geo-static' }),
      }).then(function (res) {
        if (res.ok) {
          form.innerHTML = '<p style="color:#34d399;margin:0;">Takk! Sjekk innboksen din for bekreftelse.</p>';
        }
      }).catch(function () {});
    });
  });
})();
`;

function buildDocument(page: MarketingPageConfig, appHtml: string, css: string): string {
  const url = `https://theroleroom.com${page.path}`;
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/png" href="${FAVICON}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="The Role Room" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta property="og:locale" content="nb_NO" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<style>
html,body{margin:0;padding:0;background:#0a0a0f;}
a{color:#60a5fa;}
</style>
<style data-emotion-ssr>${css}</style>
</head>
<body>
${appHtml}
<script>${NEWSLETTER_SCRIPT}</script>
</body>
</html>
`;
}

/** Rendrer alle publiserte pillar-sider. Kalles fra run-geo-prerender.mjs. */
export function renderPublishedPages(): PrerenderedPage[] {
  return MARKETING_PAGES.filter((page) => page.published).map((page) => {
    const cache = createCache({ key: 'geo' });
    const { extractCriticalToChunks } = createEmotionServer(cache);
    const appHtml = renderToString(
      <CacheProvider value={cache}>
        <MarketingPageRouter pageKey={page.key} />
      </CacheProvider>,
    );
    const chunks = extractCriticalToChunks(appHtml);
    const css = chunks.styles.map((style) => style.css).join('\n');
    return { key: page.key, path: page.path, html: buildDocument(page, appHtml, css) };
  });
}

export { MARKETING_PAGES };

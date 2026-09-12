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
 * publisert side til dist/geo/<key>.html. Netlify Edge Function ruter
 * theroleroom.com/<path> dit KUN for crawler-user-agents (dynamic
 * rendering) — mennesker beholder SPA-en, som også kan vise live
 * CMS-overrides fra Admin Room (useCmsBlocks kjører ikke i SSR, så
 * de statiske filene er alltid baseline-innholdet fra komponentene).
 *
 * Innholdet er identisk med det SPA-en rendrer (samme komponenter,
 * samme JSON-LD) — dette er prerendering, ikke cloaking.
 */

import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import { Router } from 'wouter';
import { MarketingPageRouter } from '../components/admin/content-marketing/MarketingPageRouter';
import {
  MARKETING_PAGES,
  type MarketingPageConfig,
} from '../components/admin/content-marketing/marketingPagesConfig';
import LeadgridLanding from '../pages/leadgrid-landing';
import LeadgridPricingPage from '../pages/leadgrid-pricing';
import LeadgridPersonvern from '../pages/leadgrid-personvern';
import LeadgridSkaffeLeadsGuidePage from '../pages/leadgrid-skaffe-leads-guide';
import LeadgridFeltsalgSalgsteamPage from '../pages/leadgrid-feltsalg-salgsteam';
import LeadgridAkademiPage from '../pages/leadgrid-akademi';
import LeadgridAkademiSamarbeidPage from '../pages/leadgrid-akademi-samarbeid-salg-marked';
import LeadgridAkademiVelgeCrmPage from '../pages/leadgrid-akademi-velge-crm-feltsalg';
import { AKADEMI_ARTICLES } from '../components/leadgrid/akademiConfig';

export interface PrerenderedPage {
  key: string;
  path: string;
  html: string;
}

const OG_IMAGE = 'https://theroleroom.com/role-room-assets/landing_backdrop_with_logo.webp';
const FAVICON = '/TheRoleRoom_App_Logo.png';

/** Merke-parametre for HTML-dokumentmalen (TRR vs Leadgrid). */
interface SiteMeta {
  origin: string;
  siteName: string;
  ogImage: string;
  favicon: string;
}

const TRR_SITE: SiteMeta = {
  origin: 'https://theroleroom.com',
  siteName: 'The Role Room',
  ogImage: OG_IMAGE,
  favicon: FAVICON,
};

const LEADGRID_SITE: SiteMeta = {
  origin: 'https://leadgrid.no',
  siteName: 'Leadgrid',
  ogImage: 'https://leadgrid.no/leadgrid/backdrop2.png',
  favicon: '/leadgrid/logo.png',
};

/** Komponent per akademi-artikkel (nøkler fra akademiConfig). */
const AKADEMI_COMPONENTS: Record<string, () => ReactElement> = {
  'samarbeid-salg-marked': () => <LeadgridAkademiSamarbeidPage />,
  'velge-crm-feltsalg': () => <LeadgridAkademiVelgeCrmPage />,
};

/**
 * Offentlige Leadgrid-sider på leadgrid.no (rene stier per host-aliasingen
 * i casting-main.tsx). Titler/beskrivelser speiler det SPA-en setter i
 * runtime-JS (leadgrid-landing.tsx m.fl.).
 */
const LEADGRID_PAGES: Array<{
  key: string;
  path: string;
  title: string;
  description: string;
  element: () => ReactElement;
}> = [
  {
    key: 'landing',
    path: '/',
    title: 'Leadgrid — Gjør kartet om til kunder',
    description:
      'Kartbasert CRM for lokale muligheter. Leadgrid hjelper team med å finne, organisere, følge opp og vinne lokale leads — alt i ett visuelt system.',
    element: () => <LeadgridLanding />,
  },
  {
    key: 'priser',
    path: '/priser',
    title: 'Leadgrid Priser — Solo Free, Solo Pro 799, Agency 2999 NOK/mnd',
    description:
      'Priser for Leadgrid: Solo Free (kom i gang gratis), Solo Pro 799 NOK/mnd for enkeltbrukere og små team, Agency 2999 NOK/mnd for salgsteam og byråer. Norske datakilder og feltsalg-apper inkludert.',
    element: () => <LeadgridPricingPage />,
  },
  {
    key: 'skaffe-leads-guide',
    path: '/skaffe-leads-guide',
    title: 'Slik skaffer du flere kunder som håndverker eller liten bedrift — uten dyre annonser | Leadgrid',
    description:
      'Guide for håndverkere og små bedrifter: finn relevante bedrifter i ditt område via Brønnøysundregistrene og markedsskann, få dem som pins på kartet og bygg en pipeline du eier — i stedet for å kjøpe delte lead-lister.',
    element: () => <LeadgridSkaffeLeadsGuidePage />,
  },
  {
    key: 'feltsalg-for-salgsteam',
    path: '/feltsalg-for-salgsteam',
    title: 'Feltsalg for salgsteam: territorier, ruter og salgsledelse på kart | Leadgrid',
    description:
      'Feltsalg-CRM for utegående salgsstyrker: territorie-fordeling per selger, ruteplanlegging med reise-ETA, kundebesøk registrert fra iPad/iPhone/Apple Watch, og prognoser med won/lost-analyse.',
    element: () => <LeadgridFeltsalgSalgsteamPage />,
  },
  {
    key: 'personvern',
    path: '/personvern',
    title: 'Personvern — Leadgrid',
    description:
      'Personvernerklæring for Leadgrid: hvilke data vi behandler, behandlingsgrunnlag, datalagring i EU/EØS og dine rettigheter etter GDPR.',
    element: () => <LeadgridPersonvern />,
  },
  // ── Leadgrid Akademi (titler/beskrivelser fra akademiConfig — én kilde) ──
  {
    key: 'akademi',
    path: '/akademi',
    title: 'Leadgrid Akademi — lær håndverket bak B2B-salg og leadgenerering',
    description:
      'Redaksjonelt læringstilbud om B2B-salg, leadgenerering og feltsalg for norske bedrifter. Faktabaserte artikler med navngitte kilder — fritt tilgjengelig.',
    element: () => <LeadgridAkademiPage />,
  },
  ...AKADEMI_ARTICLES.filter((a) => a.published && a.source === 'akademi').map((a) => {
    const element = AKADEMI_COMPONENTS[a.key];
    if (!element) {
      // Ny artikkel i akademiConfig uten komponent-mapping her → feil builden
      // (fanges av run-geo-prerender.mjs) i stedet for å prerendre feil side.
      throw new Error(`geo-prerender: mangler komponent-mapping for akademi-artikkel '${a.key}'`);
    }
    return { key: `akademi-${a.key}`, path: a.path, title: a.title, description: a.description, element };
  }),
];

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

function buildDocument(
  page: { path: string; title: string; description: string },
  appHtml: string,
  css: string,
  site: SiteMeta = TRR_SITE,
): string {
  const url = `${site.origin}${page.path === '/' ? '/' : page.path}`;
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
<link rel="icon" type="image/png" href="${site.favicon}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${escapeHtml(site.siteName)}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${site.ogImage}" />
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

/**
 * Rendrer de offentlige Leadgrid-sidene for leadgrid.no.
 * Router ssrPath gjør at wouter-<Link> i pricing-sida fungerer uten window.
 */
export function renderLeadgridPages(): PrerenderedPage[] {
  return LEADGRID_PAGES.map((page) => {
    const cache = createCache({ key: 'geo' });
    const { extractCriticalToChunks } = createEmotionServer(cache);
    const appHtml = renderToString(
      <CacheProvider value={cache}>
        <Router ssrPath={page.path}>{page.element()}</Router>
      </CacheProvider>,
    );
    const chunks = extractCriticalToChunks(appHtml);
    const css = chunks.styles.map((style) => style.css).join('\n');
    return { key: page.key, path: page.path, html: buildDocument(page, appHtml, css, LEADGRID_SITE) };
  });
}

export { MARKETING_PAGES };

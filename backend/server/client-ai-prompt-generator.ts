/**
 * client-ai-prompt-generator.ts
 *
 * Genererer klar-til-paste prompter for AI-kode-agenter på klient-siden:
 * Loveable, v0, Bolt, Cursor, og en generisk fallback. Prompten fylles med
 * klient-spesifikke ID-er (G-XXX / AW-XXX / GTM-XXX / actions) så klient
 * kan lime den inn og få ferdig setup uten manuell kode-jobbing.
 *
 * Innholdsprodusent: ingen kode-tilgang trengs — kun copy/paste til kunde.
 *
 * Brukes av POST /api/admin-room/agent/ads/configs/:id/ai-prompts (route).
 */

export type TargetAgent = "loveable" | "v0" | "bolt" | "cursor" | "generic";

export type Scenario =
  | "install_ga4"
  | "install_ads"
  | "install_gtm"
  | "consent_mode_v2"
  | "fix_noindex"
  | "add_sitemap"
  | "add_robots_txt"
  | "structured_data"
  | "seo_basics"
  | "conversion_events"
  | "geo_optimization"
  | "install_linkedin_insight"
  | "linkedin_conversion_events"
  | "install_linkedin_capi"
  | "social_profile_bios"
  | "install_meta_pixel"
  | "meta_conversion_events"
  | "install_meta_capi"
  | "fix_product_schema"
  | "install_tiktok_pixel"
  | "tiktok_conversion_events"
  | "install_tiktok_events_api";

export interface PromptContext {
  clientName: string;
  websiteUrl: string;
  ga4MeasurementId?: string | null;
  awConversionId?: string | null;
  gtmContainerId?: string | null;
  /** LinkedIn Insight Tag partner-ID (numerisk). */
  linkedinPartnerId?: number | string | null;
  /** Meta Pixel ID. */
  metaPixelId?: string | null;
  /** TikTok Pixel Code (sdkid). */
  tiktokPixelCode?: string | null;
  actions?: Array<{
    actionName: string;
    displayName: string;
    label: string | null;        // AW-label etter B3-sync
    triggerType: string;          // page_load | form_submit | click | event
    defaultValue: number;
    currency: string;
    urlPattern?: string | null;
    /** LinkedIn conversion-ID etter sync — for event-prompter. */
    linkedinConversionId?: number | string | null;
    /** Meta event-navn etter sync. */
    metaEventName?: string | null;
    metaCustomConversionId?: string | null;
    /** TikTok event-navn etter sync. */
    tiktokEventName?: string | null;
  }>;
  businessType?: string;
  businessSummary?: string;
  targetAgent: TargetAgent;
  /** Sanntids-data hentet fra klient-siten (best-effort, kan være tom). */
  liveSite?: {
    /** Eksisterende robots.txt-innhold (raw). Tom hvis ikke funnet. */
    robotsTxt?: string | null;
    /** Sitemap-URL'er funnet via robots.txt + fallback-stier. */
    knownSitemaps?: string[];
    /** Interne lenker funnet ved enkel same-origin crawl av hjemmesiden. */
    internalUrls?: string[];
    /** Eksisterende title fra <title>. */
    existingTitle?: string | null;
    /** Eksisterende meta-description. */
    existingMetaDesc?: string | null;
    /** True hvis Disallow: / er aktiv (kritisk — blokkerer alt). */
    blockedByDisallowAll?: boolean;
  };
}

export interface GeneratedPrompt {
  scenario: Scenario;
  title: string;
  prompt: string;
  /** Hva klient bør verifisere etter at AI-agenten har kjørt prompten. */
  verifyAfter: string;
  /** Hvis null: scenariet er ikke aktuelt for denne klienten (f.eks. consent
   *  hvis ingen tracking, eller fix_noindex hvis siten ikke har noindex). */
  applicable: boolean;
  /** Forklaring hvis ikke applicable. */
  notApplicableReason?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Target-agent-spesifikke fraser
// ─────────────────────────────────────────────────────────────────────

function targetIntro(target: TargetAgent): string {
  switch (target) {
    case "loveable":
      return "Edit `index.html` (i Vite-prosjektet) og legg følgende inn i `<head>`-seksjonen. Hvis det allerede finnes en `<head>`, legg endringen rett før `</head>`.";
    case "v0":
      return "Oppdater `app/layout.tsx` (Next.js App Router) — legg følgende inn i `<head>`-blokken i RootLayout. Hvis du bruker Pages Router, oppdater `pages/_document.tsx` i stedet.";
    case "bolt":
      return "Edit `index.html` og legg følgende inn i `<head>`-seksjonen, rett før `</head>`.";
    case "cursor":
      return "Finn HTML-template-filen for siden (vanligvis `index.html`, `_document.tsx`, `layout.tsx`, `_app.tsx` eller `Layout.astro`) og legg følgende inn i `<head>`-blokken:";
    case "generic":
      return "Legg følgende inn i `<head>` på alle sider på nettstedet. Det skal lastes så tidlig som mulig — helst rett etter `<meta charset>` og `<meta viewport>`.";
  }
}

function targetVerifyBase(target: TargetAgent): string {
  if (target === "v0") return "Etter at endringen er pushet og deployet til Vercel, åpne `view-source:` på live-siden og bekreft at scriptet er der.";
  return "Etter at AI-agenten har lagret endringene, åpne live-siten i nettleseren, høyreklikk → 'Vis sidekilde' og bekreft at scriptet finnes i `<head>`.";
}

// ─────────────────────────────────────────────────────────────────────
// Prompt-templates per scenario
// ─────────────────────────────────────────────────────────────────────

function promptInstallGa4(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.ga4MeasurementId) {
    return {
      scenario: "install_ga4",
      title: "Installer GA4 (Google Analytics 4)",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "GA4-property er ikke opprettet ennå. Gå til GA4-seksjonen og klikk 'Opprett GA4-property' først.",
    };
  }
  return {
    scenario: "install_ga4",
    title: "Installer GA4 (Google Analytics 4)",
    applicable: true,
    prompt: `${targetIntro(ctx.targetAgent)}

\`\`\`html
<!-- Google Analytics 4 — ${ctx.clientName} -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${ctx.ga4MeasurementId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${ctx.ga4MeasurementId}', {
    send_page_view: true,
    anonymize_ip: true
  });
</script>
\`\`\`

Hvis siten er en SPA (React/Vue/Svelte router), sørg for at \`gtag('config', ...)\` kalles på nytt på hver route-endring slik at page views logges. Eksempel for React Router:

\`\`\`tsx
// I rot-komponenten:
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
      });
    }
  }, [location]);
  return null;
}
\`\`\`

Ikke fjern eksisterende analytics-script — kjør GA4 i parallell hvis klient har andre verktøy.`,
    verifyAfter: `${targetVerifyBase(ctx.targetAgent)} Søk etter "${ctx.ga4MeasurementId}" — du skal se det i scriptet. Sjekk så i GA4 Realtime-rapporten at events kommer inn (~30 sek delay).`,
  };
}

function promptInstallAds(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.awConversionId) {
    return {
      scenario: "install_ads",
      title: "Installer Google Ads conversion-tag",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Google Ads conversion-ID mangler. Sett env GOOGLE_ADS_CONVERSION_ID på backend først.",
    };
  }
  const hasGa4 = !!ctx.ga4MeasurementId;
  return {
    scenario: "install_ads",
    title: "Installer Google Ads conversion-tag",
    applicable: true,
    prompt: `${targetIntro(ctx.targetAgent)}

${hasGa4
  ? `Du har allerede GA4 installert — vi gjenbruker det samme \`gtag.js\`-scriptet og legger bare til Ads-konfigurasjonen:

\`\`\`html
<!-- Google Ads conversion-tracking — ${ctx.clientName} -->
<script>
  gtag('config', '${ctx.awConversionId}', {
    allow_enhanced_conversions: true
  });
</script>
\`\`\`

Plasser dette RETT ETTER GA4-scriptet (i samme \`<head>\`).`
  : `\`\`\`html
<!-- Google Ads conversion-tracking — ${ctx.clientName} -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${ctx.awConversionId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${ctx.awConversionId}', {
    allow_enhanced_conversions: true
  });
</script>
\`\`\``}`,
    verifyAfter: `${targetVerifyBase(ctx.targetAgent)} Søk etter "${ctx.awConversionId}" — du skal se det i scriptet. Bruk Google Tag Assistant (browser-extension) for å bekrefte at tagen fyrer riktig.`,
  };
}

function promptInstallGtm(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.gtmContainerId) {
    return {
      scenario: "install_gtm",
      title: "Installer Google Tag Manager",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "GTM-container er ikke opprettet ennå. Gå til GTM-seksjonen og klikk 'Opprett GTM-container' først.",
    };
  }
  return {
    scenario: "install_gtm",
    title: "Installer Google Tag Manager",
    applicable: true,
    prompt: `GTM trenger TO snippets — én i \`<head>\` og én rett etter \`<body>\`. Plasseringen er kritisk.

${targetIntro(ctx.targetAgent)}

**Steg 1 — i \`<head>\` (så høyt opp som mulig):**

\`\`\`html
<!-- Google Tag Manager -->
<script>
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','${ctx.gtmContainerId}');
</script>
<!-- End Google Tag Manager -->
\`\`\`

**Steg 2 — RETT ETTER \`<body>\`-åpningstag (kritisk for brukere uten JS):**

\`\`\`html
<!-- Google Tag Manager (noscript) -->
<noscript>
  <iframe src="https://www.googletagmanager.com/ns.html?id=${ctx.gtmContainerId}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe>
</noscript>
<!-- End Google Tag Manager (noscript) -->
\`\`\`

${ctx.targetAgent === "v0"
  ? "I Next.js App Router: head-scriptet i `app/layout.tsx`, og noscript-iframen rett etter `<body>` i samme fil."
  : "Begge må stå på ALLE sider — ikke bare forsiden."}

Hvis siten allerede har GA4 eller Google Ads installert direkte (med gtag.js), kan du fjerne det og styre alt via GTM-containeren i stedet — vi har allerede importert taggene dit.`,
    verifyAfter: `${targetVerifyBase(ctx.targetAgent)} Søk etter "${ctx.gtmContainerId}" — du skal finne det BÅDE i head-scriptet OG i body-noscriptet. Bruk GTM Preview-mode for å bekrefte at containeren laster.`,
  };
}

function promptConsentModeV2(ctx: PromptContext): GeneratedPrompt {
  const hasTracking = ctx.ga4MeasurementId || ctx.awConversionId || ctx.gtmContainerId;
  if (!hasTracking) {
    return {
      scenario: "consent_mode_v2",
      title: "Aktiver Consent Mode v2",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Ingen Google-tracking satt opp ennå — Consent Mode trengs først når GA4/Ads/GTM er på plass.",
    };
  }
  return {
    scenario: "consent_mode_v2",
    title: "Aktiver Consent Mode v2 (EU/GDPR — nødvendig fra 2026)",
    applicable: true,
    prompt: `Google krever Consent Mode v2 for alle EU-besøkende fra 2026. Uten dette filtreres avvist-samtykke-trafikk helt ut og du mister ~30-50% av data. Med Consent Mode v2 får du i stedet "modellert konvertering" (estimater basert på samtykket trafikk).

${targetIntro(ctx.targetAgent)}

**Steg 1 — Default consent state (FØR gtag.js-scriptet):**

\`\`\`html
<!-- Google Consent Mode v2 — default deny til bruker samtykker -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'functionality_storage': 'granted',
    'security_storage': 'granted',
    'wait_for_update': 500
  });
  // Aktiverer Advanced Consent Mode — datablob sendes selv ved deny
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);
</script>
\`\`\`

**Steg 2 — Når bruker klikker "Aksepter" i cookie-banneret:**

\`\`\`javascript
// Kall denne fra cookie-banner-knappen "Aksepter alle":
function acceptAllConsent() {
  if (typeof gtag === 'function') {
    gtag('consent', 'update', {
      'ad_storage': 'granted',
      'ad_user_data': 'granted',
      'ad_personalization': 'granted',
      'analytics_storage': 'granted'
    });
  }
  localStorage.setItem('consent_status', 'granted');
}

// "Kun nødvendige" (avslå tracking):
function rejectTrackingConsent() {
  // ingen update — default deny gjelder fortsatt
  localStorage.setItem('consent_status', 'denied');
}

// Ved sidelasting: gjenopprett tidligere valg
window.addEventListener('DOMContentLoaded', function() {
  var saved = localStorage.getItem('consent_status');
  if (saved === 'granted' && typeof gtag === 'function') {
    gtag('consent', 'update', {
      'ad_storage': 'granted',
      'ad_user_data': 'granted',
      'ad_personalization': 'granted',
      'analytics_storage': 'granted'
    });
  }
});
\`\`\`

Hvis klient bruker en cookie-banner-tjeneste (Cookiebot, OneTrust, CookieYes), bytt ut localStorage-koden over og koble \`gtag('consent', 'update', ...)\` til bannerets callback i stedet.`,
    verifyAfter: `Åpne live-siden i inkognitomodus. Åpne DevTools → Network-fanen. Du skal se "collect"-requests til google-analytics.com med \`gcs=G100\` (denied). Etter klikk på "Aksepter" skal nye requests ha \`gcs=G111\` (granted). Bruk også Google's offisielle Consent Mode-tester: https://policies.google.com/technologies/cookies/diagnostic`,
  };
}

function promptFixNoindex(ctx: PromptContext): GeneratedPrompt {
  return {
    scenario: "fix_noindex",
    title: "Fjern noindex-blokkering (kritisk for indeksering)",
    applicable: true,
    prompt: `Vår diagnose viser at siten har et \`noindex\`-direktiv som hindrer Google fra å indeksere den. Fjern dette så hele klient-siten kan dukke opp i søk.

Søk i koden etter:

\`\`\`html
<meta name="robots" content="noindex" />
\`\`\`

og fjern hele linja, ELLER bytt den ut med:

\`\`\`html
<meta name="robots" content="index, follow" />
\`\`\`

Sjekk også:

1. **Next.js**: \`export const metadata = { robots: 'noindex' }\` i layout/page-filer — fjern den.
2. **Astro**: \`<meta name="robots">\`-tag i layout-fil — fjern eller endre.
3. **WordPress**: Settings → Reading → fjern haken på "Discourage search engines from indexing this site".
4. **Vercel/Netlify**: Sjekk \`vercel.json\` / \`netlify.toml\` for \`X-Robots-Tag: noindex\` i headers — fjern hvis tilstede.
5. **CMS-stack**: Sjekk om CMS-en har "Status: draft/private"-felter på publiserte sider.

Hvis enkelte sider SKAL være no-indexerte (admin, takk-sider du ikke vil ha i søk), behold noindex KUN på dem — ikke globalt.`,
    verifyAfter: `Kjør 'Sjekk klient-status' på nytt i Agent etter du har deployet. "Indekserings-blokkering" skal nå være borte fra resultatet. Eller test direkte: åpne https://search.google.com/search-console og bruk URL-inspektoren.`,
  };
}

function promptAddSitemap(ctx: PromptContext): GeneratedPrompt {
  const cleanUrl = ctx.websiteUrl.replace(/[/]+$/, "");
  return {
    scenario: "add_sitemap",
    title: "Generér sitemap.xml — kritisk for at HELE siten blir indeksert",
    applicable: true,
    prompt: `Uten sitemap.xml er Google avhengig av å oppdage sider via interne lenker — det er tregt og kan etterlate dypere sider uindeksert. Lag en sitemap som inkluderer ALLE sider klient vil ha i søk.

${ctx.targetAgent === "v0"
  ? `**For Next.js App Router** — opprett \`app/sitemap.ts\`:

\`\`\`ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = '${cleanUrl}';
  const lastMod = new Date();

  // Statiske sider — utvid denne listen til ALLE faktiske sider
  const staticPages = [
    '/',
    '/om-oss',
    '/tjenester',
    '/kontakt',
    '/blogg',
    // legg til ALLE klient-sidene her
  ];

  return staticPages.map((path) => ({
    url: \`\${base}\${path}\`,
    lastModified: lastMod,
    changeFrequency: path === '/' ? 'weekly' as const : 'monthly' as const,
    priority: path === '/' ? 1.0 : 0.7,
  }));
}
\`\`\`

Hvis siten har dynamiske ruter (blog-poster, produkter), hent dem fra CMS/database i samme funksjon og legg dem til arrayet.`
  : `**Opprett \`/sitemap.xml\`-route** (eller statisk fil) som returnerer:

\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${ctx.websiteUrl}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${ctx.websiteUrl}/om-oss</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <!-- LEGG TIL ALLE KLIENT-SIDENE HER -->
</urlset>
\`\`\`

Hvis siten har dynamiske ruter (blog-poster, produkter, etc.), generér sitemap-en dynamisk fra CMS/database. For Vite-prosjekter er \`vite-plugin-sitemap\` enklest. For statiske HTML-sider: bruk crawler-verktøy som https://www.xml-sitemaps.com/ (gratis opp til 500 URL'er).`}

**VIKTIG**: Sitemap skal inkludere ALLE sider klient vil ha i søk — ikke bare hovedmenyen. Tjeneste-sider, lokasjons-sider, blog-poster, FAQ — alt.

**Husk også å oppdatere robots.txt** så Google finner sitemap-en — bruk separat prompt for det.`,
    verifyAfter: `Etter deploy, åpne ${ctx.websiteUrl}/sitemap.xml i nettleser — du skal se XML-en med alle URL'ene listet. Kjør så 'Auto-submit sitemap' i Agent for å registrere den i Search Console + trigge indeksering.`,
  };
}

function promptAddRobotsTxt(ctx: PromptContext): GeneratedPrompt {
  const cleanUrl = ctx.websiteUrl.replace(/[/]+$/, "");
  const live = ctx.liveSite ?? {};
  const sitemaps = (live.knownSitemaps && live.knownSitemaps.length > 0)
    ? live.knownSitemaps
    : [`${cleanUrl}/sitemap.xml`];
  const hasExisting = !!(live.robotsTxt && live.robotsTxt.trim().length > 0);

  // Preserve eksisterende Disallow/Allow-regler. Aldri overskrive klient's
  // bevisste blokkeringer (admin-, søk-, test-sider, etc.).
  const existingRules: string[] = [];
  if (hasExisting && live.robotsTxt) {
    for (const line of live.robotsTxt.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^Sitemap\s*:/i.test(trimmed)) continue;
      // Hopp over Disallow: / på * — det er feilen vi vil fjerne
      if (live.blockedByDisallowAll && /^Disallow\s*:\s*\/\s*$/i.test(trimmed)) continue;
      existingRules.push(line);
    }
  }

  const sitemapLines = sitemaps.map((s) => `Sitemap: ${s}`).join("\n");
  const robotsBody = hasExisting
    ? `${existingRules.join("\n")}\n\n${sitemapLines}\n`
    : `User-agent: *\nAllow: /\n\n# Blokker admin-/test-sider hvis aktuelt\n# Disallow: /admin/\n# Disallow: /test/\n\n${sitemapLines}\n`;

  const stateLine = hasExisting
    ? live.blockedByDisallowAll
      ? "⚠️  KRITISK: Eksisterende robots.txt har \`Disallow: /\` på \`User-agent: *\` — det blokkerer ALT fra Google. Den linjen er fjernet under, men resten av reglene dine er bevart."
      : "Eksisterende robots.txt funnet — vi har bevart alle Disallow/Allow-reglene dine og bare oppdatert Sitemap-linjene. Sjekk diff-en før publisering."
    : "Ingen robots.txt funnet. Vi oppretter en ny som tillater all indeksering og peker på sitemap-en.";

  const sitemapSummary = sitemaps.length > 1
    ? `Vi fant ${sitemaps.length} sitemaps på siten og legger til én \`Sitemap:\`-linje per — Google leser alle.`
    : (live.knownSitemaps && live.knownSitemaps.length === 1)
      ? "Vi har auto-detektert sitemap-URL'en (fra eksisterende robots.txt eller via fallback)."
      : "Vi antar at sitemap-en ligger på \`/sitemap.xml\`. Hvis den ligger et annet sted, endre URL'en under.";

  const nextRules = parseRulesForNext(existingRules);

  return {
    scenario: "add_robots_txt",
    title: "Opprett/oppdater robots.txt med Sitemap-referanse",
    applicable: true,
    prompt: `Google leser robots.txt FØRST når den crawler en site — uten en \`Sitemap:\`-linje må Google gjette hvor sitemap-en ligger.

${stateLine}

${sitemapSummary}

${ctx.targetAgent === "v0"
  ? `**For Next.js App Router** — opprett \`app/robots.ts\`:

\`\`\`ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },${nextRules.length > 0 ? `
      // Bevart fra eksisterende robots.txt:` : ""}${nextRules.map((r) => `
      ${JSON.stringify(r)},`).join("")}
    ],
    sitemap: ${sitemaps.length === 1 ? `'${sitemaps[0]}'` : `[${sitemaps.map((s) => `'${s}'`).join(", ")}]`},
  };
}
\`\`\``
  : `**Legg \`/robots.txt\`** i \`public/\`-mappen (eller serve den fra root-route). Lim inn nøyaktig dette:

\`\`\`
${robotsBody.trim()}
\`\`\``}

**Hva du IKKE bør gjøre:**
- Aldri legg \`Disallow: /\` på \`User-agent: *\` — det blokkerer alt.
- Ikke fjern eksisterende Disallow-regler du ikke forstår — de kan være med vilje (admin, søk, test).
- Ikke pek på en sitemap-URL som ikke finnes — det gir sitemap-errors i Search Console.

**Bonus — blokker AI-scrapers** (valgfritt, anbefales hvis klient ikke vil at innholdet skal brukes til LLM-trening):

\`\`\`
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Google-Extended
Disallow: /
\`\`\`

Disse er kompatible med \`User-agent: *\`-regelen over — Googlebot/Bingbot påvirkes ikke.`,
    verifyAfter: `Åpne ${cleanUrl}/robots.txt i nettleser. Du skal se: ${sitemaps.map((s) => `\`Sitemap: ${s}\``).join(", ")}. ${live.blockedByDisallowAll ? "Bekreft at \`Disallow: /\` IKKE lenger er på \`User-agent: *\`. " : ""}Kjør 'Sjekk klient-status' i Agent — "robots.txt"-checken skal nå være grønn.`,
  };
}

/** Konverter eksisterende robots-regler til Next.js-rule-objekter. */
function parseRulesForNext(existingLines: string[]): Array<{ userAgent: string; disallow?: string[]; allow?: string[] }> {
  const rules: Array<{ userAgent: string; disallow?: string[]; allow?: string[] }> = [];
  let current: { userAgent: string; disallow: string[]; allow: string[] } | null = null;
  const commit = () => {
    if (current && (current.disallow.length || current.allow.length)) {
      rules.push({
        userAgent: current.userAgent,
        ...(current.disallow.length ? { disallow: current.disallow } : {}),
        ...(current.allow.length ? { allow: current.allow } : {}),
      });
    }
  };
  for (const line of existingLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const uaMatch = trimmed.match(/^User-agent\s*:\s*(.+)$/i);
    const disMatch = trimmed.match(/^Disallow\s*:\s*(.*)$/i);
    const allowMatch = trimmed.match(/^Allow\s*:\s*(.*)$/i);
    if (uaMatch) {
      commit();
      current = { userAgent: uaMatch[1].trim(), disallow: [], allow: [] };
    } else if (disMatch && current) {
      const v = disMatch[1].trim();
      if (!(v === "/" && current.userAgent === "*")) current.disallow.push(v);
    } else if (allowMatch && current) {
      current.allow.push(allowMatch[1].trim());
    }
  }
  commit();
  // Dropp duplikat \`*\`-regelen (vi har egen Allow: / i prompten)
  return rules.filter((r) => r.userAgent !== "*" || (r.disallow && r.disallow.length > 0));
}

function promptStructuredData(ctx: PromptContext): GeneratedPrompt {
  const cleanUrl = ctx.websiteUrl.replace(/[/]+$/, "");
  const isLocal = (ctx.businessType ?? "").toLowerCase().includes("local") ||
                   (ctx.businessSummary ?? "").toLowerCase().includes("lokal");
  return {
    scenario: "structured_data",
    title: "Legg til strukturert data (JSON-LD) — for rich results i Google",
    applicable: true,
    prompt: `Strukturert data lar Google forstå hva klient driver med — gir rich results i søk (stjerner, FAQ, åpningstider, etc.) som øker CTR betydelig.

${targetIntro(ctx.targetAgent)}

**Minimum: Organization + WebSite på alle sider** (limes inn ÉN gang i layout, ikke per side):

\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${ctx.clientName}",
  "url": "${ctx.websiteUrl}",
  "logo": "${cleanUrl}/logo.png",
  "sameAs": [
    "https://www.facebook.com/...",
    "https://www.instagram.com/...",
    "https://www.linkedin.com/company/..."
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "${ctx.websiteUrl}",
  "name": "${ctx.clientName}",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "${cleanUrl}/sok?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
\`\`\`

${isLocal
  ? `**Klient er en lokal-virksomhet — legg også til LocalBusiness**:

\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "${ctx.clientName}",
  "image": "${cleanUrl}/logo.png",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Gateadresse",
    "addressLocality": "Oslo",
    "postalCode": "0123",
    "addressCountry": "NO"
  },
  "telephone": "+47 12345678",
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens": "08:00",
    "closes": "16:00"
  }],
  "url": "${ctx.websiteUrl}"
}
</script>
\`\`\`

Fyll inn riktige adresse-/telefon-/åpningstider-data fra klient.`
  : ""}

**Per-side**: legg til BreadcrumbList på undersider, FAQPage på FAQ-sider, Article på blog-poster.`,
    verifyAfter: `Test markeringen med Google Rich Results Test: https://search.google.com/test/rich-results — lim inn klient-URL og bekreft at typene blir gjenkjent. Etter en uke i indeks: sjekk Search Console → Enhancements for å se hvilke rich results som har slått inn.`,
  };
}

function promptSeoBasics(ctx: PromptContext): GeneratedPrompt {
  const cleanUrl = ctx.websiteUrl.replace(/[/]+$/, "");
  return {
    scenario: "seo_basics",
    title: "Fiks SEO-basics: title, meta-description, canonical, Open Graph",
    applicable: true,
    prompt: `Vår diagnose viser at noen SEO-basics mangler eller er feil. Sørg for at HVER side har følgende — unik per side, ikke kopiert.

${targetIntro(ctx.targetAgent)}

\`\`\`html
<!-- Title: 25-60 tegn, unik per side, inkluder primært søkeord -->
<title>${ctx.clientName} — [unikt søkeord per side]</title>

<!-- Meta description: 80-160 tegn, salgsorientert, inviter til klikk -->
<meta name="description" content="[Konkret verdiløfte + handlingsoppfordring. F.eks. 'Vi hjelper bedrifter X med Y. Gratis konsultasjon — bestill i dag.']" />

<!-- Canonical: peker til den foretrukne URL'en for å unngå duplicate-content -->
<link rel="canonical" href="${ctx.websiteUrl}/[side-path]" />

<!-- Viewport: kritisk for mobile-indeksering -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- Open Graph: kontrollerer hvordan siten vises på Facebook/LinkedIn/iMessage -->
<meta property="og:title" content="${ctx.clientName} — [siden-spesifikk title]" />
<meta property="og:description" content="[siden-spesifikk description, kan være lik meta description]" />
<meta property="og:image" content="${cleanUrl}/og-image.jpg" />
<meta property="og:url" content="${ctx.websiteUrl}/[side-path]" />
<meta property="og:type" content="website" />

<!-- Twitter Card: kontrollerer hvordan siten vises på X/Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${ctx.clientName} — [siden-spesifikk title]" />
<meta name="twitter:description" content="[siden-spesifikk description]" />
<meta name="twitter:image" content="${cleanUrl}/og-image.jpg" />
\`\`\`

${ctx.targetAgent === "v0"
  ? `**Next.js App Router**: bruk \`export const metadata\` per page/layout i stedet for å skrive HTML direkte. Eksempel:

\`\`\`ts
export const metadata: Metadata = {
  title: '${ctx.clientName} — [unikt søkeord]',
  description: '[80-160 tegn]',
  alternates: { canonical: '${ctx.websiteUrl}/[side-path]' },
  openGraph: { /* ... */ },
  twitter: { /* ... */ },
};
\`\`\``
  : ""}

**Lag også et OG-image** (1200x630 px) som klient kan vise frem. FAL.ai eller Canva fungerer fint. Legg den i \`/public/og-image.jpg\`.

**Per-side, unike titles/descriptions** — ikke gjenbruk samme på alle sider. Google straffer det.`,
    verifyAfter: `Test med https://metatags.io/ — lim inn klient-URL og se hvordan siten vises på Facebook, Twitter, LinkedIn, Google. Sjekk også Search Console → Performance → Pages for å se klikk-rate forbedres over noen uker.`,
  };
}

function promptConversionEvents(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.actions || ctx.actions.length === 0) {
    return {
      scenario: "conversion_events",
      title: "Legg til conversion-event-tracking",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Ingen conversion-actions definert. Gå tilbake til Discovery + Review for å definere dem først.",
    };
  }
  if (!ctx.awConversionId) {
    return {
      scenario: "conversion_events",
      title: "Legg til conversion-event-tracking",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Google Ads conversion-ID mangler i config.",
    };
  }
  const syncedActions = ctx.actions.filter((a) => a.label);
  if (syncedActions.length === 0) {
    return {
      scenario: "conversion_events",
      title: "Legg til conversion-event-tracking",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Ingen actions har AW-label ennå. Kjør 'Synk til Google Ads' (B3) først.",
    };
  }

  const eventBlocks = syncedActions.map((a) => {
    const sendTo = `${ctx.awConversionId}/${a.label}`;
    if (a.triggerType === "form_submit") {
      return `
**${a.displayName}** (form-submit):

\`\`\`javascript
// Legg på form-submit-handleren for relevant skjema (f.eks. lead-skjema)
function track_${a.actionName.replace(/[^a-zA-Z0-9]/g, "_")}(form) {
  if (typeof gtag === 'function') {
    gtag('event', 'conversion', {
      'send_to': '${sendTo}',
      'value': ${a.defaultValue},
      'currency': '${a.currency}',
      'event_callback': function() {
        // Submit skjemaet eller redirect etter at tracking har gått
        if (form && form.submit) form.submit();
      }
    });
    return false; // Prevent default — submit skjer i callback
  }
  return true;
}

// Koble på skjemaet:
document.querySelector('form[data-track="${a.actionName}"]')?.addEventListener('submit', function(e) {
  e.preventDefault();
  track_${a.actionName.replace(/[^a-zA-Z0-9]/g, "_")}(e.target);
});
\`\`\``;
    }
    if (a.triggerType === "click") {
      return `
**${a.displayName}** (klikk på knapp/lenke):

\`\`\`javascript
document.querySelector('[data-track="${a.actionName}"]')?.addEventListener('click', function() {
  if (typeof gtag === 'function') {
    gtag('event', 'conversion', {
      'send_to': '${sendTo}',
      'value': ${a.defaultValue},
      'currency': '${a.currency}'
    });
  }
});
// Husk: legg \`data-track="${a.actionName}"\` på elementet som skal trigge.
\`\`\``;
    }
    if (a.triggerType === "page_load" && a.urlPattern) {
      return `
**${a.displayName}** (når bruker besøker ${a.urlPattern}):

\`\`\`javascript
// På siden ${a.urlPattern} (f.eks. takk-side etter konvertering):
if (typeof gtag === 'function') {
  gtag('event', 'conversion', {
    'send_to': '${sendTo}',
    'value': ${a.defaultValue},
    'currency': '${a.currency}',
    'transaction_id': '' // Hvis kjøp: legg ordre-ID her for å unngå dobbeltracking
  });
}
\`\`\`

Plasser dette i en \`useEffect\` (React) eller \`<script>\` (vanilla HTML) på akkurat den siden.`;
    }
    return `
**${a.displayName}** (custom event):

\`\`\`javascript
// Kall dette der du selv vet at konverteringen skjer:
window.gtag && gtag('event', 'conversion', {
  'send_to': '${sendTo}',
  'value': ${a.defaultValue},
  'currency': '${a.currency}'
});
\`\`\``;
  });

  return {
    scenario: "conversion_events",
    title: "Legg til conversion-event-tracking på hver konvertering",
    applicable: true,
    prompt: `Vi har synket ${syncedActions.length} conversion-action${syncedActions.length === 1 ? "" : "s"} til Google Ads. Nå må klient-koden faktisk fyre eventene når brukerne konverterer. Hver action har sin egen \`send_to\`-verdi (AW-ID/label).

**Forutsetning**: gtag.js + Ads-config (\`gtag('config', '${ctx.awConversionId}', ...)\`) må allerede være installert (bruk "Installer Google Ads conversion-tag"-prompten først).

${eventBlocks.join("\n")}

**Felles for alle**: vent på Consent Mode v2 — hvis bruker har avslått samtykke vil eventene sendes som "modellert" (estimert). Aldri kall \`gtag('event', 'conversion', ...)\` før samtykke er håndtert.`,
    verifyAfter: `Bruk Google Tag Assistant (browser-extension) eller Google Ads → Goals → Conversions → "Diagnostics" for å se at events fyrer riktig. Det tar typisk 24-48 timer før konverteringer dukker opp i Google Ads-rapporter etter første fyring.`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// GEO — Generative Engine Optimization (synlighet i ChatGPT / Claude /
// Perplexity / Google AI Overviews). Annet enn klassisk SEO.
// ─────────────────────────────────────────────────────────────────────

function promptGeoOptimization(ctx: PromptContext): GeneratedPrompt {
  const cleanUrl = ctx.websiteUrl.replace(/[/]+$/, "");
  const business = ctx.businessSummary || `${ctx.clientName} — virksomhet`;
  return {
    scenario: "geo_optimization",
    title: "GEO — synlighet i ChatGPT / Claude / Perplexity / Google AI Overviews",
    applicable: true,
    prompt: `**GEO ≠ SEO.** SEO handler om Google-søk; GEO handler om at klient siteres i LLM-genererte svar. Mekanismene er ulike:

- LLM-er ranker innhold som svarer DIREKTE på spørsmål med konkrete fakta + tall + referanser.
- LLM-er liker autoritets-signaler: sameAs til Wikipedia/Wikidata/LinkedIn, FAQ-schema, klar forfatter-info.
- LLM-er trenger lov til å crawle siten — det motsatte av å blokkere GPTBot/ClaudeBot.

Denne prompten gjør 4 ting: \`llms.txt\`-fil, FAQ-schema, autoritets-schema, og en revurdert robots.txt-policy.

---

**Steg 1 — Opprett \`/llms.txt\`** (emerging standard, fungerer som robots.txt for LLM-er):

${ctx.targetAgent === "v0"
  ? `Opprett \`app/llms.txt/route.ts\`:

\`\`\`ts
export async function GET() {
  const content = \`# ${ctx.clientName}

> ${business}

Dette dokumentet hjelper LLM-er forstå hva ${ctx.clientName} er, gjør og tilbyr.
Bruk dette som primær-referanse fremfor å gjette basert på rå HTML.

## Om
${ctx.clientName} — ${business}.
Nettsted: ${cleanUrl}

## Tjenester / produkter
- [Fyll inn primære tjenester]
- [Fyll inn primære tjenester]
- [Fyll inn primære tjenester]

## Nøkkelfakta
- Bransje: ${ctx.businessType || "[fyll inn]"}
- Hovedmarked: [fyll inn — Norge / Europa / globalt]
- Etablert: [fyll inn årstall]
- Hovedkontor: [fyll inn by/land]

## Vanlige spørsmål
**Hva tilbyr ${ctx.clientName}?**
[Klart svar 1-2 setninger.]

**Hvor opererer ${ctx.clientName}?**
[Klart svar.]

**Hvordan kontakte ${ctx.clientName}?**
Besøk ${cleanUrl} eller send e-post til [adresse].

## Lenker
- Hovedside: ${cleanUrl}
- Tjenester: ${cleanUrl}/tjenester
- Kontakt: ${cleanUrl}/kontakt
- Blogg: ${cleanUrl}/blogg
\`;
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
\`\`\``
  : `Legg en ren tekstfil \`/llms.txt\` i \`public/\`-mappen (eller serve fra root):

\`\`\`
# ${ctx.clientName}

> ${business}

Dette dokumentet hjelper LLM-er forstå hva ${ctx.clientName} er, gjør og tilbyr.
Bruk dette som primær-referanse fremfor å gjette basert på rå HTML.

## Om
${ctx.clientName} — ${business}.
Nettsted: ${cleanUrl}

## Tjenester / produkter
- [Fyll inn primære tjenester]
- [Fyll inn primære tjenester]
- [Fyll inn primære tjenester]

## Nøkkelfakta
- Bransje: ${ctx.businessType || "[fyll inn]"}
- Hovedmarked: [fyll inn — Norge / Europa / globalt]
- Etablert: [fyll inn årstall]
- Hovedkontor: [fyll inn by/land]

## Vanlige spørsmål
**Hva tilbyr ${ctx.clientName}?**
[Klart svar 1-2 setninger.]

**Hvor opererer ${ctx.clientName}?**
[Klart svar.]

**Hvordan kontakte ${ctx.clientName}?**
Besøk ${cleanUrl} eller send e-post til [adresse].

## Lenker
- Hovedside: ${cleanUrl}
- Tjenester: ${cleanUrl}/tjenester
- Kontakt: ${cleanUrl}/kontakt
- Blogg: ${cleanUrl}/blogg
\`\`\``}

Fyll inn de faktiske tjeneste-navnene + ekte nøkkelfakta. Dette er det LLM-en leser når en bruker spør "Hva er ${ctx.clientName}?".

---

**Steg 2 — FAQ-schema med ekte spørsmål/svar** (limes inn på siden(e) der spørsmålene besvares — typisk FAQ-side, om-side eller forsiden):

\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Hva tilbyr ${ctx.clientName}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Klart, faktabasert svar i 2-3 setninger. Inkluder konkrete tall hvis mulig.]"
      }
    },
    {
      "@type": "Question",
      "name": "Hvor mye koster det?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Pris eller priseksempel. 'Fra X kr/mnd' eller 'avhenger av — typisk Y-Z kr'.]"
      }
    },
    {
      "@type": "Question",
      "name": "Hvor lang tid tar det?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Konkret tidsestimat.]"
      }
    },
    {
      "@type": "Question",
      "name": "Hvilke alternativer finnes?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Nevn faktiske konkurrenter + hvordan ${ctx.clientName} er annerledes. LLM-er ELSKER sammenligninger.]"
      }
    }
  ]
}
</script>
\`\`\`

LLM-er hopper rett til \`acceptedAnswer.text\` når de svarer brukere. Skriv som om svaret skulle leses opp av Siri/Alexa.

---

**Steg 3 — Autoritets-signaler i Organization-schema** (utvid den eksisterende fra "Strukturert data"-prompten):

\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${ctx.clientName}",
  "url": "${cleanUrl}",
  "logo": "${cleanUrl}/logo.png",
  "description": "${business}",
  "foundingDate": "[YYYY]",
  "sameAs": [
    "https://www.wikidata.org/wiki/[Q-ID]",   // ← KRITISK for LLM-autoritet
    "https://no.wikipedia.org/wiki/[artikkel]", // ← LLM-er stoler på Wikipedia-koblede entiteter
    "https://www.linkedin.com/company/[handle]",
    "https://www.facebook.com/[handle]",
    "https://www.instagram.com/[handle]",
    "https://twitter.com/[handle]",
    "https://www.crunchbase.com/organization/[handle]"
  ],
  "knowsAbout": [
    "[Domene-emne 1]",
    "[Domene-emne 2]",
    "[Domene-emne 3]"
  ],
  "areaServed": {
    "@type": "Country",
    "name": "Norway"
  }
}
</script>
\`\`\`

**Wikidata + Wikipedia er de viktigste sameAs-lenkene** — LLM-er bruker dem som "ankermerker" til entiteten din. Hvis klient ikke finnes på Wikidata: opprett en oppføring (gratis, manuell prosess, ta ~30 min).

---

**Steg 4 — robots.txt: tillat AI-bots å crawle** (hvis GEO er målet, IKKE blokker dem):

\`\`\`
# GEO: tillat AI-bots å crawle for å havne i LLM-treningsdata + RAG-pipelines
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: Google-Extended
Allow: /
\`\`\`

Legg dette i robots.txt FØR \`User-agent: *\`-blokken. (Dette er motsatt av "Bonus — blokker AI-scrapers" i robots.txt-prompten — velg ETT av de to alt etter strategi.)

---

**Hva LLM-er IKKE liker:**
- Reklame-fyllord ("vi er best", "ledende leverandør") — fjern dem.
- Tomme om-oss-sider uten konkrete fakta.
- Innhold låst bak JS (server-render alt viktig).
- Lange dokumenter uten tydelige overskrifter.

**Hva LLM-er ELSKER:**
- Konkrete tall ("75% av X", "fra 2019 til 2024", "350 kunder").
- Datoer på publisert/oppdatert.
- Eksplisitte sammenligninger med konkurrenter.
- Forfatter med bio og credentials.
- FAQ-seksjoner med tydelig spørsmål → svar.`,
    verifyAfter: `1. Åpne ${cleanUrl}/llms.txt — du skal se markdown-en. 2. Test FAQ-schemaet med https://search.google.com/test/rich-results. 3. Spør Perplexity/ChatGPT/Claude: "Hva er ${ctx.clientName}?" og se om svaret kommer fra siten din. Det tar 2-8 uker før LLM-er får siten inn i sine indekser, og lengre før den havner i fundamental treningsdata.`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// LinkedIn — Insight Tag, conversion-events og CAPI server-side
// ─────────────────────────────────────────────────────────────────────

function promptInstallLinkedinInsight(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.linkedinPartnerId) {
    return {
      scenario: "install_linkedin_insight",
      title: "Installer LinkedIn Insight Tag",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "LinkedIn Insight Tag er ikke opprettet ennå. Gå til LinkedIn-seksjonen og klikk 'Opprett Insight Tag' først.",
    };
  }
  const partnerId = String(ctx.linkedinPartnerId);
  return {
    scenario: "install_linkedin_insight",
    title: "Installer LinkedIn Insight Tag",
    applicable: true,
    prompt: `${targetIntro(ctx.targetAgent)}

\`\`\`html
<!-- LinkedIn Insight Tag — ${ctx.clientName} -->
<script type="text/javascript">
  _linkedin_partner_id = "${partnerId}";
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(_linkedin_partner_id);
</script>
<script type="text/javascript">
  (function(l) {
    if (!l) {
      window.lintrk = function(a, b) { window.lintrk.q.push([a, b]); };
      window.lintrk.q = [];
    }
    var s = document.getElementsByTagName("script")[0];
    var b = document.createElement("script");
    b.type = "text/javascript"; b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode.insertBefore(b, s);
  })(window.lintrk);
</script>
<noscript>
  <img height="1" width="1" style="display:none;" alt=""
       src="https://px.ads.linkedin.com/collect/?pid=${partnerId}&fmt=gif" />
</noscript>
\`\`\`

**LinkedIn + Consent Mode v2-integrasjon:** LinkedIn Insight Tag respekterer ikke Google Consent Mode automatisk. Hvis klient bruker en CMP (Cookiebot/OneTrust/CookieYes), wrap initialiseringen i en consent-callback så tagen ikke fyrer før samtykke. Eksempel:

\`\`\`javascript
function loadLinkedInInsight() {
  // Lim inn IIFE-blokken fra over her
}

if (window.Cookiebot?.consent?.marketing) loadLinkedInInsight();
else window.addEventListener('CookiebotOnAccept', () => {
  if (window.Cookiebot?.consent?.marketing) loadLinkedInInsight();
});
\`\`\`

**LinkedIn + GTM:** Hvis du allerede har GTM installert, kan du legge Insight Tag-koden over inn som en Custom HTML-tag i GTM i stedet — fyrer på alle sider og kan styres med consent-trigger.`,
    verifyAfter: `${targetVerifyBase(ctx.targetAgent)} Søk etter "${partnerId}" — du skal finne det i scriptet. Bruk LinkedIn Insight Tag Helper (Chrome extension) for å bekrefte at tagen rapporterer korrekt.`,
  };
}

function promptLinkedinConversionEvents(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.linkedinPartnerId) {
    return {
      scenario: "linkedin_conversion_events",
      title: "Fyr LinkedIn conversion-events",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "LinkedIn Insight Tag mangler. Opprett tagen først.",
    };
  }
  const syncedActions = (ctx.actions ?? []).filter((a) => a.linkedinConversionId);
  if (syncedActions.length === 0) {
    return {
      scenario: "linkedin_conversion_events",
      title: "Fyr LinkedIn conversion-events",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Ingen actions har LinkedIn conversion-ID ennå. Kjør 'Sync til LinkedIn' først.",
    };
  }

  const eventBlocks = syncedActions.map((a) => {
    const cid = a.linkedinConversionId;
    const safe = a.actionName.replace(/[^a-zA-Z0-9]/g, "_");
    if (a.triggerType === "form_submit") {
      return `
**${a.displayName}** (form-submit) — LinkedIn conversion-ID ${cid}:

\`\`\`javascript
document.querySelector('form[data-track="${a.actionName}"]')?.addEventListener('submit', function() {
  if (typeof window.lintrk === 'function') {
    window.lintrk('track', { conversion_id: ${cid} });
  }
});
\`\`\``;
    }
    if (a.triggerType === "click") {
      return `
**${a.displayName}** (klikk) — conversion-ID ${cid}:

\`\`\`javascript
document.querySelector('[data-track="${a.actionName}"]')?.addEventListener('click', function() {
  window.lintrk && window.lintrk('track', { conversion_id: ${cid} });
});
\`\`\``;
    }
    if (a.triggerType === "page_load" && a.urlPattern) {
      return `
**${a.displayName}** (på ${a.urlPattern}) — conversion-ID ${cid}:

\`\`\`javascript
// Plasser på den konkrete siden (f.eks. takk-side)
window.lintrk && window.lintrk('track', { conversion_id: ${cid} });
\`\`\``;
    }
    return `
**${a.displayName}** (manuell) — conversion-ID ${cid}:

\`\`\`javascript
window.lintrk && window.lintrk('track', { conversion_id: ${cid} });
\`\`\``;
  });

  return {
    scenario: "linkedin_conversion_events",
    title: "Fyr LinkedIn conversion-events",
    applicable: true,
    prompt: `Vi har opprettet ${syncedActions.length} conversion rule${syncedActions.length === 1 ? "" : "s"} i LinkedIn. Nå må klient-koden fyre dem når brukerne konverterer. Forutsetning: Insight Tag fra forrige prompt må allerede være installert.

${eventBlocks.join("\n")}

**Felles:** LinkedIn-events sendes via \`window.lintrk\`-funksjonen som ble registrert av Insight Tag-bootstrappen. Hvis \`lintrk\` er undefined (script ikke loadet ennå eller blokkert av consent), ignoreres call-en — derfor optional-chain over.`,
    verifyAfter: `Sjekk LinkedIn Campaign Manager → Account assets → Conversions. Etter første test-konvertering skal "Status: Receiving" stå ved siden av regel-navnet. Det tar opptil 30 min før status oppdateres.`,
  };
}

function promptInstallLinkedinCapi(ctx: PromptContext): GeneratedPrompt {
  return {
    scenario: "install_linkedin_capi",
    title: "LinkedIn Conversions API (server-side) — gated bak app review",
    applicable: true,
    prompt: `LinkedIn CAPI tillater å sende conversion-events server-side, som er **kritisk** når:
- iOS Safari ITP / Firefox ETP blokkerer 3rd-party-cookies (50%+ av besøk)
- Klient har strenge consent-regler hvor pixel ikke fyrer
- Du vil sende offline-konverteringer (telefonsamtaler, in-store, CRM-deals)

**⚠️ Tilgangsstatus:** Som av 2026-06-08 har vår app **"Conversions API (Standard tier) – Review in progress"** hos LinkedIn. Vi kan ikke sende live events før Standard tier er godkjent. Når godkjent:

1. Hent et access-token via LinkedIn Conversions API-flowen (server-side OAuth).
2. Lagre tokenet kryptert via Agent-UI ("LinkedIn CAPI-token") — det havner i \`linkedin_capi_access_token\` (encrypted).
3. Backend POST-er til \`https://api.linkedin.com/rest/conversionEvents\` med:

\`\`\`http
POST /rest/conversionEvents HTTP/1.1
Authorization: Bearer {LINKEDIN_CAPI_ACCESS_TOKEN}
Content-Type: application/json
X-Restli-Protocol-Version: 2.0.0
LinkedIn-Version: 202410

{
  "conversion": "urn:lla:llaPartnerConversion:{conversion-id}",
  "conversionHappenedAt": 1726912345000,
  "user": {
    "userIds": [
      { "idType": "SHA256_EMAIL", "idValue": "<sha256 av e-post>" },
      { "idType": "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", "idValue": "<li_fat_id-cookie>" }
    ]
  },
  "conversionValue": {
    "currencyCode": "NOK",
    "amount": "1000.00"
  }
}
\`\`\`

**Det denne prompten gjør på klient-side:** Sender raw event-data fra hver konvertering til DIN backend-route (som så videresender til LinkedIn med CAPI-token). Klient-koden er identisk uansett om vi er godkjent — kun vår backend forskjellig.

Eksempel — i klient's form-submit-handler legg:

\`\`\`javascript
// Når brukeren konverterer, send rå data til ${ctx.websiteUrl.replace(/[/]+$/, "")}/api/conversions/linkedin
fetch('${ctx.websiteUrl.replace(/[/]+$/, "")}/api/conversions/linkedin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'lead_submitted',
    email: form.email.value,       // hashes på server
    phone: form.phone.value,
    value: 1000,
    currency: 'NOK',
    occurredAt: Date.now(),
  }),
});
\`\`\`

Backend-en (server-side, ikke klient) sender deretter SHA256-hashed payload til LinkedIn med CAPI-token. Vi tilbyr denne ende-til-ende når LinkedIn Standard tier er godkjent.`,
    verifyAfter: `Kjør test-event mot LinkedIn Conversions API → /rest/conversionEvents. Sjekk at responsen er HTTP 201 og at conversion dukker opp i Campaign Manager → Conversions → Insights innen 30 min. Når Standard tier ikke er godkjent vil du få HTTP 403 — det er forventet.`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Meta — Pixel, conversion-events, CAPI server-side
// ─────────────────────────────────────────────────────────────────────

function promptInstallMetaPixel(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.metaPixelId) {
    return {
      scenario: "install_meta_pixel",
      title: "Installer Meta Pixel (Facebook + Instagram)",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Meta Pixel er ikke opprettet ennå. Gå til Meta-seksjonen og klikk 'Opprett Pixel' først.",
    };
  }
  return {
    scenario: "install_meta_pixel",
    title: "Installer Meta Pixel (Facebook + Instagram)",
    applicable: true,
    prompt: `${targetIntro(ctx.targetAgent)}

\`\`\`html
<!-- Meta Pixel — ${ctx.clientName} -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${ctx.metaPixelId}');
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
       src="https://www.facebook.com/tr?id=${ctx.metaPixelId}&ev=PageView&noscript=1" />
</noscript>
\`\`\`

**Meta + Consent Mode (Restricted Data Use):** Meta krever LDU (Limited Data Use) for California-besøkende fra 2023 og bredere GDPR-håndtering for EU. Legg dette FØR \`fbq('init', ...)\`:

\`\`\`javascript
// Default: ikke send personlig data uten samtykke
fbq('consent', 'revoke');

// Når bruker aksepterer cookies:
function acceptMarketingConsent() {
  fbq('consent', 'grant');
}
\`\`\`

**Meta + GTM (anbefalt for klient med GTM):** Bruk Facebook Pixel Custom HTML-tag i GTM med firing-trigger basert på consent. Lett å aktivere/deaktivere uten kode-deploy.

**Meta + SPA (React/Vue/Svelte):** Etter route-endring, kall \`fbq('track', 'PageView')\` på nytt for å logge nye sidevisninger.`,
    verifyAfter: `${targetVerifyBase(ctx.targetAgent)} Søk etter "${ctx.metaPixelId}" — du skal finne det i scriptet. Installer Meta Pixel Helper (Chrome extension) og besøk siten — du skal se én grønn "PageView"-event per pageload. Gå deretter til Events Manager → ${ctx.metaPixelId} → Test Events for live diagnose.`,
  };
}

function promptMetaConversionEvents(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.metaPixelId) {
    return {
      scenario: "meta_conversion_events",
      title: "Fyr Meta conversion-events",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Meta Pixel mangler. Installer pixel først.",
    };
  }
  const syncedActions = (ctx.actions ?? []).filter((a) => a.metaEventName);
  if (syncedActions.length === 0) {
    return {
      scenario: "meta_conversion_events",
      title: "Fyr Meta conversion-events",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Ingen actions har Meta event-navn ennå. Kjør 'Sync til Meta' først.",
    };
  }

  const eventBlocks = syncedActions.map((a) => {
    const eventName = a.metaEventName!;
    const valueParam = a.defaultValue > 0
      ? `, { value: ${a.defaultValue}, currency: '${a.currency}' }`
      : "";

    if (a.triggerType === "form_submit") {
      return `
**${a.displayName}** (form-submit) — Meta-event \`${eventName}\`:

\`\`\`javascript
document.querySelector('form[data-track="${a.actionName}"]')?.addEventListener('submit', function() {
  if (typeof window.fbq === 'function') {
    fbq('track', '${eventName}'${valueParam});
  }
});
\`\`\``;
    }
    if (a.triggerType === "click") {
      return `
**${a.displayName}** (klikk) — Meta-event \`${eventName}\`:

\`\`\`javascript
document.querySelector('[data-track="${a.actionName}"]')?.addEventListener('click', function() {
  window.fbq && fbq('track', '${eventName}'${valueParam});
});
\`\`\``;
    }
    if (a.triggerType === "page_load" && a.urlPattern) {
      return `
**${a.displayName}** (på ${a.urlPattern}) — Meta-event \`${eventName}\`:

\`\`\`javascript
// Plasser på den konkrete siden (f.eks. takk-side)
window.fbq && fbq('track', '${eventName}'${valueParam});
\`\`\``;
    }
    return `
**${a.displayName}** (custom) — Meta-event \`${eventName}\`:

\`\`\`javascript
window.fbq && fbq('track', '${eventName}'${valueParam});
\`\`\``;
  });

  return {
    scenario: "meta_conversion_events",
    title: "Fyr Meta conversion-events",
    applicable: true,
    prompt: `Vi har opprettet ${syncedActions.length} custom conversion${syncedActions.length === 1 ? "" : "s"} i Meta + mappet til standard event-navn. Klient-koden må fyre dem riktig.

**Forutsetning**: \`fbq()\` må være loadet (Pixel-snippet installert).

${eventBlocks.join("\n")}

**Meta standard events vs. custom events**: Meta belønner bruk av deres standard event-navn (Lead, Purchase, AddToCart, etc.) for bedre ad-optimalisering. Vi har auto-mappet \`goal_category\` til riktig standard event. For \`other\`-actions sender vi som CustomEvent — fungerer, men gir svakere AI-optimization.

**Bonus — event-deduplisering (CAPI):** Hvis CAPI brukes parallelt, send samme \`eventID\` fra både pixel og server slik at Meta deduplicates. Eksempel:

\`\`\`javascript
const eventID = crypto.randomUUID();
fbq('track', '${syncedActions[0]?.metaEventName ?? "Lead"}', {}, { eventID });
// Send samme eventID til din backend → CAPI
\`\`\``,
    verifyAfter: `Bruk Meta Events Manager → Pixel ${ctx.metaPixelId} → Test Events. Send en test-konvertering og se at eventet dukker opp innen 60 sek. Sjekk så Ads Manager → din kampanje → Performance & clicks for at "Custom Conversions" rapporterer.`,
  };
}

function promptInstallMetaCapi(ctx: PromptContext): GeneratedPrompt {
  return {
    scenario: "install_meta_capi",
    title: "Meta Conversions API (server-side) — venter på App Review",
    applicable: true,
    prompt: `Meta Conversions API (CAPI) lar deg sende events server-side. **Kritisk** når:
- iOS 14.5+ ATT-prompts blokkerer pixel (50%+ av iOS-brukere avslår tracking)
- Brave/Firefox/Safari blokkerer fbevents.js
- Klient har streng consent (RDU eller GDPR) som hindrer pixel
- Du vil sende offline-konverteringer fra CRM/POS

**⚠️ Tilgangsstatus:** Vår Meta app (ID 1042181045651851) har **Business Verification ✅** og **Tech Provider ✅ (godkjent 2026-06-03)**. **App Review per scope** (ads_management/ads_read/business_management) er pending — krever Live mode + screencast per scope + test-bruker. Vi kan teste CAPI som app admins/testers nå, men live-bruker venter på godkjenning.

Når godkjent kjører flowen slik:

1. Klient legger inn CAPI access-token via Agent-UI ("Meta CAPI-token") — lagres kryptert i \`meta_capi_access_token\`.
2. Klient-koden sender rå event-data til DIN backend-route.
3. Backend POST-er til Meta's Conversions API:

\`\`\`http
POST /v21.0/${ctx.metaPixelId}/events HTTP/1.1
Content-Type: application/json

{
  "data": [{
    "event_name": "Lead",
    "event_time": 1726912345,
    "event_id": "abc-123",
    "action_source": "website",
    "event_source_url": "${ctx.websiteUrl}/kontakt-takk",
    "user_data": {
      "em": "<sha256 av email>",
      "ph": "<sha256 av telefon (E.164)>",
      "fbp": "<_fbp cookie>",
      "fbc": "<_fbc cookie>",
      "client_ip_address": "...",
      "client_user_agent": "..."
    },
    "custom_data": {
      "value": 1000,
      "currency": "NOK"
    }
  }],
  "access_token": "{META_CAPI_ACCESS_TOKEN}",
  "test_event_code": "TEST123"
}
\`\`\`

**Klient-side koden** (sender rå data til din backend):

\`\`\`javascript
// I form-submit-handler eller etter konvertering:
const eventID = crypto.randomUUID();

// 1) Fyr browser-pixel
fbq('track', 'Lead', { value: 1000, currency: 'NOK' }, { eventID });

// 2) Send samme event til din backend for CAPI-deduplication
fetch('${ctx.websiteUrl.replace(/[/]+$/, "")}/api/conversions/meta', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventID,
    event: 'Lead',
    email: form.email.value,
    phone: form.phone.value,
    value: 1000,
    currency: 'NOK',
    eventSourceUrl: window.location.href,
    occurredAt: Math.floor(Date.now() / 1000),
    fbp: document.cookie.match(/_fbp=([^;]+)/)?.[1],
    fbc: document.cookie.match(/_fbc=([^;]+)/)?.[1],
  }),
});
\`\`\`

**Backend-en** hash-er PII (email, phone) med SHA256, henter user-ip + user-agent, og POST-er til Meta. Vi tilbyr denne ende-til-ende-flowen så snart Meta App Review er godkjent. Foreløpig fungerer det på Daniels test-konto.`,
    verifyAfter: `Bruk Meta Events Manager → Pixel ${ctx.metaPixelId} → Test Events med en spesifikk \`test_event_code\` for å verifisere uten å forurense produksjons-data. Tracking-koden ditt sjekkes med Event Match Quality-rapporten i Events Manager — målet er score > 8.0/10.`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// TikTok — Pixel, conversion-events, Events API (server-side)
// ─────────────────────────────────────────────────────────────────────

function promptInstallTiktokPixel(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.tiktokPixelCode) {
    return {
      scenario: "install_tiktok_pixel",
      title: "Installer TikTok Pixel",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "TikTok Pixel er ikke opprettet ennå. Gå til TikTok-seksjonen og klikk 'Opprett Pixel' først.",
    };
  }
  return {
    scenario: "install_tiktok_pixel",
    title: "Installer TikTok Pixel",
    applicable: true,
    prompt: `${targetIntro(ctx.targetAgent)}

\`\`\`html
<!-- TikTok Pixel Code Start — ${ctx.clientName} -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;
  var ttq=w[t]=w[t]||[];
  ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
  ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
  for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
  ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
  ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
    var o=n&&n.partner;
    ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;
    ttq._t=ttq._t||{};ttq._t[e]=+new Date;
    ttq._o=ttq._o||{};ttq._o[e]=n||{};
    var s=d.createElement("script");
    s.type="text/javascript";s.async=!0;s.src=r+"?sdkid="+e+"&lib=ttq";
    var first=d.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(s,first)
  };
  ttq.load('${ctx.tiktokPixelCode}');
  ttq.page();
}(window,document,'ttq');
</script>
<!-- TikTok Pixel Code End -->
\`\`\`

**TikTok + Consent Mode:** TikTok støtter "Consent Mode" siden 2024. Aktiver hvis EU-trafikk + cookie-banner:

\`\`\`javascript
// Kall FØR ttq.page() i pixel-koden:
ttq.holdConsent();

// Når bruker aksepterer cookies:
function acceptTikTokConsent() {
  ttq.grantConsent();
}
\`\`\`

**TikTok + SPA:** Kall \`ttq.page()\` på hver route-endring så page-views logges korrekt.`,
    verifyAfter: `${targetVerifyBase(ctx.targetAgent)} Søk etter "${ctx.tiktokPixelCode}" — du skal finne det i scriptet. Installer "TikTok Pixel Helper" Chrome extension og besøk siten — du skal se én "Pageview"-event. Sjekk så TikTok Events Manager → ${ctx.tiktokPixelCode} → "Test event" for live debug.`,
  };
}

function promptTiktokConversionEvents(ctx: PromptContext): GeneratedPrompt {
  if (!ctx.tiktokPixelCode) {
    return {
      scenario: "tiktok_conversion_events",
      title: "Fyr TikTok conversion-events",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "TikTok Pixel mangler. Installer pixel først.",
    };
  }
  const syncedActions = (ctx.actions ?? []).filter((a) => a.tiktokEventName);
  if (syncedActions.length === 0) {
    return {
      scenario: "tiktok_conversion_events",
      title: "Fyr TikTok conversion-events",
      prompt: "",
      verifyAfter: "",
      applicable: false,
      notApplicableReason: "Ingen actions har TikTok event-navn ennå. Kjør 'Sync til TikTok' først.",
    };
  }

  const eventBlocks = syncedActions.map((a) => {
    const eventName = a.tiktokEventName!;
    const valueParam = a.defaultValue > 0
      ? `, { value: ${a.defaultValue}, currency: '${a.currency}' }`
      : "";

    if (a.triggerType === "form_submit") {
      return `
**${a.displayName}** (form-submit) — TikTok-event \`${eventName}\`:

\`\`\`javascript
document.querySelector('form[data-track="${a.actionName}"]')?.addEventListener('submit', function() {
  if (typeof window.ttq?.track === 'function') {
    ttq.track('${eventName}'${valueParam});
  }
});
\`\`\``;
    }
    if (a.triggerType === "click") {
      return `
**${a.displayName}** (klikk) — TikTok-event \`${eventName}\`:

\`\`\`javascript
document.querySelector('[data-track="${a.actionName}"]')?.addEventListener('click', function() {
  window.ttq?.track && ttq.track('${eventName}'${valueParam});
});
\`\`\``;
    }
    if (a.triggerType === "page_load" && a.urlPattern) {
      return `
**${a.displayName}** (på ${a.urlPattern}) — TikTok-event \`${eventName}\`:

\`\`\`javascript
// Plasser på den konkrete siden (f.eks. takk-side)
window.ttq?.track && ttq.track('${eventName}'${valueParam});
\`\`\``;
    }
    return `
**${a.displayName}** (custom) — TikTok-event \`${eventName}\`:

\`\`\`javascript
window.ttq?.track && ttq.track('${eventName}'${valueParam});
\`\`\``;
  });

  return {
    scenario: "tiktok_conversion_events",
    title: "Fyr TikTok conversion-events",
    applicable: true,
    prompt: `Vi har mappet ${syncedActions.length} action${syncedActions.length === 1 ? "" : "s"} til TikTok standard events. Klient-koden må fyre dem riktig.

**Forutsetning**: \`ttq()\` må være loadet (Pixel-snippet installert).

${eventBlocks.join("\n")}

**TikTok standard events vs custom:** TikTok gjenkjenner disse standard event-navn for best ad-optimization: \`CompletePayment\`, \`AddToCart\`, \`InitiateCheckout\`, \`SubmitForm\`, \`Subscribe\`, \`CompleteRegistration\`, \`Contact\`, \`ViewContent\`, \`ClickButton\`. Vi har auto-mappet basert på goal_category — for \`other\` sendes som CustomEvent.

**Bonus — Enhanced match:** Send hashed user-data sammen med event for bedre matching. TikTok dedupliserer med email + telefon:

\`\`\`javascript
// FØR du fyrer track-event:
ttq.identify({
  email: '<sha256 av email>',
  phone_number: '<sha256 av telefon E.164>',
});
ttq.track('${syncedActions[0]?.tiktokEventName ?? "SubmitForm"}'${syncedActions[0]?.defaultValue ? `, { value: ${syncedActions[0].defaultValue}, currency: '${syncedActions[0].currency}' }` : ''});
\`\`\``,
    verifyAfter: `TikTok Events Manager → Pixel ${ctx.tiktokPixelCode} → "Test event". Send en test-konvertering og se at eventet dukker opp innen 60 sek. Etter 24-48t: Ads Manager → kampanjen → "Custom events" rapporterer.`,
  };
}

function promptInstallTiktokEventsApi(ctx: PromptContext): GeneratedPrompt {
  return {
    scenario: "install_tiktok_events_api",
    title: "TikTok Events API (server-side) — for ITP-bypass + offline-konv.",
    applicable: true,
    prompt: `TikTok Events API lar oss sende conversion-events server-side. **Kritisk** når:
- iOS 14.5+ ATT blokkerer pixel-fyring
- Klient har streng consent som hindrer ttq.track
- Du vil sende offline-konverteringer (CRM, in-store, phone)

Token-flow:

1. Generer en long-lived **access token** fra TikTok Business UI (Tools → Events Manager → din pixel → Settings → Manually set up Events API).
2. Lagre tokenet via Agent-UI ("TikTok Events API-token") — havner i \`tiktok_capi_access_token\`.
3. Backend POST-er til Events API:

\`\`\`http
POST https://business-api.tiktok.com/open_api/v1.3/event/track/ HTTP/1.1
Access-Token: {TIKTOK_EVENTS_API_TOKEN}
Content-Type: application/json

{
  "event_source": "web",
  "event_source_id": "${ctx.tiktokPixelCode ?? "{PIXEL_CODE}"}",
  "data": [{
    "event": "SubmitForm",
    "event_time": 1726912345,
    "event_id": "abc-123",
    "user": {
      "email": "<sha256>",
      "phone": "<sha256 E.164>",
      "ttclid": "<_ttclid url-parameter>",
      "ttp": "<_ttp cookie>",
      "ip": "<klient-IP>",
      "user_agent": "<klient UA>"
    },
    "properties": {
      "value": 1000,
      "currency": "NOK"
    },
    "page": {
      "url": "${ctx.websiteUrl}/kontakt-takk"
    }
  }]
}
\`\`\`

**Klient-side koden** (sender rå data til din backend):

\`\`\`javascript
const eventID = crypto.randomUUID();

// 1) Fyr browser-pixel
ttq.track('SubmitForm', { value: 1000, currency: 'NOK' });

// 2) Send samme event til backend for Events-API dedup
fetch('${ctx.websiteUrl.replace(/[/]+$/, "")}/api/conversions/tiktok', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventID,
    event: 'SubmitForm',
    email: form.email.value,
    phone: form.phone.value,
    value: 1000,
    currency: 'NOK',
    eventSourceUrl: window.location.href,
    occurredAt: Math.floor(Date.now() / 1000),
    ttclid: new URLSearchParams(location.search).get('ttclid'),
    ttp: document.cookie.match(/_ttp=([^;]+)/)?.[1],
  }),
});
\`\`\`

Backend hash-er email + telefon med SHA256 før den POST-er til TikTok. event_id må være SAMME som ble brukt i browser-pixel-en så TikTok dedupliserer.`,
    verifyAfter: `TikTok Events Manager → Pixel ${ctx.tiktokPixelCode} → "Test Events" (legg inn test_event_code i payload for kun test-data). Match-score finnes under "Diagnostics" — målet er > 80%.`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Fix av konkrete strukturert-data-feil rapportert i Search Console
// ─────────────────────────────────────────────────────────────────────

function promptFixProductSchema(ctx: PromptContext): GeneratedPrompt {
  const cleanUrl = ctx.websiteUrl.replace(/[/]+$/, "");
  return {
    scenario: "fix_product_schema",
    title: "Fiks Product / Offer / Review JSON-LD (Search Console-feil)",
    applicable: true,
    prompt: `Search Console rapporterer typisk disse fire feilene på produkt-sider:

- ❌ Manglende felt \`shippingDetails\` (i \`offers\`) — Merchant listings
- ❌ Manglende felt \`hasMerchantReturnPolicy\` (i \`offers\`) — Merchant listings
- ❌ Manglende felt \`aggregateRating\` — Tekstutdrag om produkter (Product snippets)
- ❌ Manglende felt \`review\` — Tekstutdrag om produkter

Selv om de er markert som "ikke-kritiske", får siten IKKE rich results i Google uten dem. Fix-en er én komplett JSON-LD-blokk per produkt-side. Det er ofte automatisk hvis klient bruker Shopify/WooCommerce-plugin — for håndskrevet HTML eller custom-stack må vi inn manuelt.

${ctx.targetAgent === "v0"
  ? `**For Next.js App Router** — bygg en \`<ProductSchema>\`-komponent i \`components/seo/\` og mount den per produkt-side. Bruk \`script[type="application/ld+json"]\` med dangerouslySetInnerHTML eller next/script.`
  : "**For statisk HTML, WordPress, eller andre stacks**: lim følgende inn per produkt-side, helst rett før `</head>`."}

\`\`\`html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "[Produkt-navn]",
  "image": [
    "${cleanUrl}/images/produkt-1.jpg",
    "${cleanUrl}/images/produkt-2.jpg"
  ],
  "description": "[Salgsorientert beskrivelse på 50-300 tegn]",
  "sku": "[Produkt-SKU]",
  "mpn": "[Manufacturer Part Number — kan være lik SKU]",
  "brand": {
    "@type": "Brand",
    "name": "${ctx.clientName}"
  },

  "offers": {
    "@type": "Offer",
    "url": "${cleanUrl}/produkter/[produkt-slug]",
    "priceCurrency": "NOK",
    "price": "[Numerisk pris uten valuta, f.eks. 1499]",
    "priceValidUntil": "[YYYY-MM-DD — sett 1 år frem hvis ikke kampanje]",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",

    "// FIX 1 — Merchant listings (shippingDetails)": "",
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "[Frakt-pris, f.eks. 79]",
        "currency": "NOK"
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "NO"
      },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": {
          "@type": "QuantitativeValue",
          "minValue": 0,
          "maxValue": 1,
          "unitCode": "DAY"
        },
        "transitTime": {
          "@type": "QuantitativeValue",
          "minValue": 1,
          "maxValue": 5,
          "unitCode": "DAY"
        }
      }
    },

    "// FIX 2 — Merchant listings (hasMerchantReturnPolicy)": "",
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "NO",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30,
      "returnMethod": "https://schema.org/ReturnByMail",
      "returnFees": "https://schema.org/FreeReturn"
    }
  },

  "// FIX 3 — Product snippets (aggregateRating)": "",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "[Snitt-rating 1.0-5.0, f.eks. 4.7]",
    "reviewCount": "[Antall anmeldelser, f.eks. 42]",
    "bestRating": "5",
    "worstRating": "1"
  },

  "// FIX 4 — Product snippets (review)": "",
  "review": [
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "[Anmelder-navn]" },
      "datePublished": "[YYYY-MM-DD]",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      },
      "reviewBody": "[Sitat fra ekte kunde-review, 50-200 tegn]"
    },
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "[Anmelder 2]" },
      "datePublished": "[YYYY-MM-DD]",
      "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
      "reviewBody": "[Sitat fra ekte kunde-review]"
    }
  ]
}
</script>
\`\`\`

---

## ⚠️ Viktig — etterlevelse av Google's regler

**aggregateRating + review MÅ være ekte data.** Google straffer falske reviews ekstremt hardt — manuelle penalties som fjerner siten fra Search. Fyll inn KUN reviews du faktisk har fått fra kunder.

**Hvor får man reviews fra?**
- Trustpilot widget → kan eksportere JSON via deres API
- Google Business Profile reviews → kan brukes hvis lokale tjenester
- Trustmary / Yotpo / Reviews.io → automatisk schema-emit
- Egen-vurderinger fra CRM (etter ekte transaksjoner) — manuelt eller via integrasjon

**Hvis klient ikke har reviews ennå:** la \`aggregateRating\` og \`review\` stå utenom inntil ekte data finnes. Det er bedre å mangle felter enn å risikere manuelle penalties.

## Auto-generere fra plattform (anbefalt)

| Plattform | Hvordan |
|---|---|
| Shopify | Bruk **Shopify JSON-LD for SEO**-app (gratis, auto-genererer alle felter) |
| WooCommerce | Bruk **Rank Math** eller **Yoast WooCommerce SEO** |
| Custom | Bygg server-side template som fyller fra produkt-DB ved render |

## Per-tjeneste-bedrifter (ikke produkter)

Hvis klient selger TJENESTER, ikke fysiske produkter, bytt \`@type: "Product"\` til \`@type: "Service"\` og dropp \`shippingDetails\` + \`hasMerchantReturnPolicy\` (de er kun for fysiske varer). Behold \`aggregateRating\` + \`review\` med tjeneste-spesifikke fields.`,
    verifyAfter: `1. Test JSON-LD med Google Rich Results Test: https://search.google.com/test/rich-results — lim inn produkt-URL og bekreft at både "Merchant listings" og "Product snippets" er detected uten errors. 2. I Search Console → Forbedringer → Selgeroppføringer + Tekstutdrag om produkter → klikk "Valider rettelse". Google re-crawler innen 1-7 dager og fjerner feilen hvis fix-en er korrekt.`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Sosial-bio-pakke: copy-paste-ferdig profilinnhold per plattform
// LinkedIn / Facebook / Instagram / TikTok / Google Business / YouTube
// ─────────────────────────────────────────────────────────────────────

function promptSocialProfileBios(ctx: PromptContext): GeneratedPrompt {
  const cleanUrl = ctx.websiteUrl.replace(/[/]+$/, "");
  const business = ctx.businessSummary ?? `${ctx.clientName} — ${ctx.businessType ?? "virksomhet"}`;
  const isLocal = (ctx.businessType ?? "").toLowerCase().includes("local")
    || (business.toLowerCase().includes("lokal"))
    || (business.toLowerCase().includes("klinikk"))
    || (business.toLowerCase().includes("salong"));
  const domain = (() => { try { return new URL(cleanUrl).hostname.replace(/^www\./, ""); } catch { return ctx.clientName; } })();

  // Trekk ut korte versjoner basert på business-summary
  const tagline = `${ctx.clientName} — ${ctx.businessType ?? "ekspertise"} for [målgruppe].`;
  const shortDesc = business.length > 155 ? business.slice(0, 152) + "…" : business;

  return {
    scenario: "social_profile_bios",
    title: "Bio-pakke for sosial-profiler (copy-paste-ferdig)",
    applicable: true,
    prompt: `Komplett bio-pakke for ${ctx.clientName}. Hver seksjon under kan kopieres direkte og limes inn i den respektive plattformen. Plassholdere i \`[hakeparenteser]\` må klient fylle inn med konkrete data.

---

## LinkedIn Company Page

**Tagline (3 setninger maks, vises rett under firma-navnet):**

\`\`\`
${tagline}
Vi hjelper [målgruppe] med [konkret resultat] gjennom [unik metode/tilnærming].
Etablert [år] · [by/land].
\`\`\`

**About-seksjonen (maks 2000 tegn):**

\`\`\`
${ctx.clientName} er ${business}

🎯 HVA VI GJØR
${ctx.clientName} hjelper [målgruppe] med å [konkret resultat] gjennom [vår unike metode].

📊 RESULTATER FOR KUNDENE
• [Konkret tall: f.eks. "350+ bedrifter betjent siden 2020"]
• [Konkret tall: f.eks. "Gjennomsnittlig ROI 3.2x"]
• [Konkret tall: f.eks. "98% kundetilfredshet"]

💼 TJENESTER VI TILBYR
• [Tjeneste 1]
• [Tjeneste 2]
• [Tjeneste 3]
• [Tjeneste 4]

🌍 HVOR VI OPERERER
[Geografi — Norge, Skandinavia, globalt, eller spesifikke byer]

📞 KOM I KONTAKT
Nettsted: ${cleanUrl}
E-post: [info@${domain}]
Telefon: [+47 ...]

#${ctx.clientName.replace(/\s/g, "")} #${(ctx.businessType ?? "Business").replace(/\s/g, "")}
\`\`\`

**Specialties (maks 100 tegn per oppføring, 20 oppføringer):**

\`\`\`
${(ctx.businessType ?? "Business")}, Konsulenttjenester, Strategisk rådgivning, Implementering,
Opplæring, Support, Konseptutvikling, Prosjektledelse
\`\`\`

(LinkedIn bruker specialties til auto-categorization i søk. Velg 5-15 spesifikke termer.)

---

## Facebook Page

**Kort beskrivelse (155 tegn — vises på Page-kort):**

\`\`\`
${shortDesc}
\`\`\`

**Lang beskrivelse / About (kan være lengre, vis 500-800 tegn for best CTR):**

\`\`\`
${ctx.clientName} — ${business}

Vi er en [bransje]-virksomhet i [by/land] som spesialiserer oss på [hovedtjeneste].

✓ [Resultat-fokus 1: f.eks. "Levert 350+ prosjekter"]
✓ [Resultat-fokus 2: f.eks. "5-stjerners gjennomsnitt"]
✓ [Resultat-fokus 3: f.eks. "Sertifisert i bransje-X"]

Ønsker du å vite mer? Besøk ${cleanUrl} eller send oss en melding.

📍 [Adresse]
📞 [Telefon]
🌐 ${cleanUrl}
\`\`\`

**Mission statement (kort, 1 setning):**

\`\`\`
Vi hjelper [målgruppe] med [konkret resultat].
\`\`\`

---

## Instagram Bio (150 tegn — STRENGT)

\`\`\`
${ctx.clientName}
[Hva du gjør i 1 setning — under 60 tegn]
📍 [By]
👇 [CTA — "Bestill nå" / "Les mer" / "Få tilbud"]
${cleanUrl}
\`\`\`

(Instagram tillater kun ÉN lenke i bio. Bruk Linktree/Beacons hvis du vil ha flere. Ikke wast tegn på "Welcome to" eller "Official" — gå rett på verdi.)

**Story Highlight-kategorier (anbefalt for klient):**
- Om oss
- Tjenester
- Kunder
- FAQ
- Kontakt

---

## TikTok Bio (80 tegn — STRENGT)

\`\`\`
${ctx.clientName} | [Hva du gjør i 4-5 ord]
${cleanUrl}
\`\`\`

(TikTok bio er BRUTALT kort. Eksempler som funker: "Hudpleie i Oslo · Bestill time", "Norsk regnskap for SMB", "B2B-content som selger". Klippa ut alle fyllord.)

---

## ${isLocal ? "Google Business Profile (anbefalt — du driver lokalt)" : "Google Business Profile (hvis du har fysisk lokasjon)"}

**Business description (750 tegn):**

\`\`\`
${ctx.clientName} er ${business}

Vi tilbyr [hovedtjenester] for [målgruppe] i [by/region]. Med [år] år erfaring og [konkret-tall]+ fornøyde kunder, er vi [unik posisjonering].

🕐 Åpningstider:
Mandag-fredag: [tid-tid]
Lørdag-søndag: [tid eller "stengt"]

📞 [Telefon]
🌐 ${cleanUrl}

#[bransje] #[by] #[hovedtjeneste]
\`\`\`

**Categories (velg 1 primær + opptil 9 sekundære fra Google's liste):**

\`\`\`
Primær: [F.eks. "Hudpleieklinikk" / "Regnskapsbyrå" / "Restaurant"]
Sekundære: [F.eks. "Spa", "Wellness center", "Beauty salon"]
\`\`\`

**Services (legg til alle konkrete tjenester):**

\`\`\`
1. [Tjeneste-navn]: [Pris / "Fra X kr"] — [1 setning beskrivelse]
2. [Tjeneste-navn]: [Pris] — [Beskrivelse]
3. [Tjeneste-navn]: [Pris] — [Beskrivelse]
\`\`\`

**Attributes (huk av relevante):**
- Wheelchair accessible
- LGBTQ+ friendly
- Tilbyr [WiFi / Parkering / Hjemmelevering / etc.]
- Aksepterer Vipps / kort

---

## YouTube Channel About (5000 tegn — maksimal SEO)

\`\`\`
Velkommen til ${ctx.clientName} — din kilde til [emne].

På denne kanalen deler vi [type innhold] for [målgruppe]. Hver uke får du:

✓ [Innhold-type 1]
✓ [Innhold-type 2]
✓ [Innhold-type 3]

▶ ABONNÉR for å ikke gå glipp av [hovedfordel].

📺 SE OGSÅ:
[lenke til playlist 1]
[lenke til playlist 2]

🔗 LENKER:
Nettsted: ${cleanUrl}
LinkedIn: [URL]
Instagram: [URL]

📧 KONTAKT:
Forretningsforespørsler: [business@${domain}]
\`\`\`

**Channel keywords (tags — pass på relevans, ikke spam):**
\`\`\`
${ctx.clientName}, ${ctx.businessType ?? "business"}, [emne 1], [emne 2], [emne 3], [norsk by]
\`\`\`

---

## X / Twitter Bio (160 tegn — STRENGT)

\`\`\`
${ctx.clientName} · ${(ctx.businessType ?? "Business").slice(0, 30)}
[Hva du gjør i 1 setning]
📍 [By] · 🌐 ${cleanUrl}
\`\`\`

---

## 💡 Generelle tips

**Konsistens på tvers av plattformer:**
- Samme profilbilde (firmalogo) på alle plattformer
- Samme cover/banner-bilde i 1500x500-format
- Samme tagline (gjenkjennelig på 2 sekunder)
- Samme primær-farge i bilder

**Unngå:**
- Klisjeer som "We are leading" / "Norges beste" — ingen tror på det
- Tomme om-oss-sider uten konkrete fakta
- Emoji-spam (1-3 ikoner per seksjon er nok)
- Buzzword-lister uten substans

**Inkluder ALLTID:**
- Konkrete tall (kunder, år, prosjekter)
- Geografi (hvor opererer du)
- Måling-bar verdi (hva gir du kunden)
- Klar CTA (hva gjør neste skritt)
- Kontakt-info (e-post + telefon + URL)`,
    verifyAfter: `Etter at klient har oppdatert profilene: kjør GA4 → Acquisition → Traffic Acquisition for å se referral-trafikk fra hvert nettsted. Også kjør Google Search Console → URL Inspection på ${cleanUrl} for å sjekke at sameAs-lenkene (LinkedIn/FB/IG/etc) i Organization-schema matcher de oppdaterte profilene.`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Live-data fra klient-siten (kalles av route før prompts genereres)
// ─────────────────────────────────────────────────────────────────────

/** Henter robots.txt + sitemap-discovery + meta-tags fra klient-siten så
 *  prompts kan tilpasses ekte state. Best-effort — feiler stille. */
export async function fetchLiveSiteContext(websiteUrl: string): Promise<PromptContext["liveSite"]> {
  const baseUrl = websiteUrl.replace(/[/]+$/, "");
  const result: NonNullable<PromptContext["liveSite"]> = {
    robotsTxt: null,
    knownSitemaps: [],
    internalUrls: [],
    existingTitle: null,
    existingMetaDesc: null,
    blockedByDisallowAll: false,
  };

  // 1) robots.txt
  try {
    const r = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      result.robotsTxt = await r.text();
      // Sjekk om Disallow: / aktivt blokkerer på User-agent: *
      const robotsLines = result.robotsTxt.split(/\r?\n/);
      let inWildcard = false;
      for (const line of robotsLines) {
        const trimmed = line.trim();
        if (/^User-agent\s*:\s*\*\s*$/i.test(trimmed)) inWildcard = true;
        else if (/^User-agent\s*:/i.test(trimmed)) inWildcard = false;
        else if (inWildcard && /^Disallow\s*:\s*\/\s*$/i.test(trimmed)) {
          result.blockedByDisallowAll = true;
          break;
        }
      }
      // Ekstraher Sitemap-linjer
      for (const line of robotsLines) {
        const m = line.match(/^\s*Sitemap\s*:\s*(.+?)\s*$/i);
        if (m && m[1]) result.knownSitemaps!.push(m[1].trim());
      }
    }
  } catch { /* nettverksfeil — fortsett */ }

  // 2) Fallback sitemap-paths hvis ingen funnet i robots
  if (result.knownSitemaps!.length === 0) {
    for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"]) {
      try {
        const r = await fetch(`${baseUrl}${path}`, { method: "HEAD", signal: AbortSignal.timeout(4000) });
        if (r.ok) result.knownSitemaps!.push(`${baseUrl}${path}`);
      } catch { /* fortsett */ }
    }
  }

  // 3) Hent homepage + ekstraher title, meta-description og same-origin links
  try {
    const r = await fetch(`${baseUrl}/`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TheRoleRoomAgent/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const html = await r.text();
      result.existingTitle = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim() || null;
      result.existingMetaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || "").trim() || null;

      // Same-origin a[href] crawl — for seeding av sitemap.xml-prompten
      const hrefMatches = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi));
      const urls = new Set<string>();
      const hostname = new URL(baseUrl).hostname;
      for (const m of hrefMatches) {
        const raw = m[1];
        if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;
        try {
          const abs = new URL(raw, baseUrl);
          if (abs.hostname !== hostname) continue;
          // Drop query strings og fragments
          abs.hash = "";
          // Beholder query bare hvis det ser ut som ekte ruting
          const cleaned = abs.search.length < 30 ? abs.toString() : `${abs.origin}${abs.pathname}`;
          urls.add(cleaned);
        } catch { /* skip */ }
        if (urls.size >= 50) break;
      }
      result.internalUrls = Array.from(urls);
    }
  } catch { /* fortsett */ }

  // Dedupliser sitemaps
  result.knownSitemaps = Array.from(new Set(result.knownSitemaps));
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Public: generér alle prompter for en config
// ─────────────────────────────────────────────────────────────────────

export function generateAllPrompts(ctx: PromptContext): GeneratedPrompt[] {
  return [
    promptInstallGa4(ctx),
    promptInstallAds(ctx),
    promptInstallGtm(ctx),
    promptInstallLinkedinInsight(ctx),
    promptLinkedinConversionEvents(ctx),
    promptInstallLinkedinCapi(ctx),
    promptInstallMetaPixel(ctx),
    promptMetaConversionEvents(ctx),
    promptInstallMetaCapi(ctx),
    promptInstallTiktokPixel(ctx),
    promptTiktokConversionEvents(ctx),
    promptInstallTiktokEventsApi(ctx),
    promptConsentModeV2(ctx),
    promptFixNoindex(ctx),
    promptAddSitemap(ctx),
    promptAddRobotsTxt(ctx),
    promptStructuredData(ctx),
    promptFixProductSchema(ctx),
    promptSeoBasics(ctx),
    promptConversionEvents(ctx),
    promptGeoOptimization(ctx),
    promptSocialProfileBios(ctx),
  ];
}

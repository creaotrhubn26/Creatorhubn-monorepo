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
  | "conversion_events";

export interface PromptContext {
  clientName: string;
  websiteUrl: string;
  ga4MeasurementId?: string | null;
  awConversionId?: string | null;
  gtmContainerId?: string | null;
  actions?: Array<{
    actionName: string;
    displayName: string;
    label: string | null;        // AW-label etter B3-sync
    triggerType: string;          // page_load | form_submit | click | event
    defaultValue: number;
    currency: string;
    urlPattern?: string | null;
  }>;
  businessType?: string;
  businessSummary?: string;
  targetAgent: TargetAgent;
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
  return {
    scenario: "add_robots_txt",
    title: "Opprett/oppdater robots.txt med Sitemap-referanse",
    applicable: true,
    prompt: `Google leser robots.txt FØRST når den crawler en site. Uten en \`Sitemap:\`-linje der må Google gjette på hvor sitemap-en ligger — vi vil bare være eksplisitte.

${ctx.targetAgent === "v0"
  ? `**For Next.js App Router** — opprett \`app/robots.ts\`:

\`\`\`ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: '${cleanUrl}/sitemap.xml',
  };
}
\`\`\``
  : `**Legg \`/robots.txt\`** i public-mappen (eller serve den fra root-route):

\`\`\`
User-agent: *
Allow: /

# Blokker admin-/test-sider hvis aktuelt
# Disallow: /admin/
# Disallow: /test/

Sitemap: ${cleanUrl}/sitemap.xml
\`\`\``}

Hvis klient har flere sitemaps (f.eks. én per språk eller én per content-type), legg til en \`Sitemap:\`-linje per.

**Aldri** legg \`Disallow: /\` med mindre du virkelig vil blokkere hele siten — det er den vanligste indekserings-feilen.`,
    verifyAfter: `Åpne ${cleanUrl}/robots.txt i nettleser. Du skal se \`User-agent: *\`, \`Allow: /\`, og \`Sitemap:\`-linja med riktig URL. Kjør 'Sjekk klient-status' i Agent — "robots.txt"-checken skal nå være grønn.`,
  };
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
// Public: generér alle prompter for en config
// ─────────────────────────────────────────────────────────────────────

export function generateAllPrompts(ctx: PromptContext): GeneratedPrompt[] {
  return [
    promptInstallGa4(ctx),
    promptInstallAds(ctx),
    promptInstallGtm(ctx),
    promptConsentModeV2(ctx),
    promptFixNoindex(ctx),
    promptAddSitemap(ctx),
    promptAddRobotsTxt(ctx),
    promptStructuredData(ctx),
    promptSeoBasics(ctx),
    promptConversionEvents(ctx),
  ];
}

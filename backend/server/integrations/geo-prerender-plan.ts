/**
 * geo-prerender-plan.ts — F5 «generate_geo_prerender_plan» (doc 14, del 2)
 *
 * Gitt F1-auditens observasjoner av et klient-domene: bygg en konkret,
 * deterministisk GEO-plan — hvilke sider som bør bot-serveres statisk,
 * robots-linjer som eksplisitt slipper inn AI-boter, serving-oppskrift
 * per plattform, og JSON-LD-mal. Fasiten er vårt eget oppsett (doc 14
 * §1.6), inkludert fella som kostet oss en dag: «/» kan ikke rewrites i
 * vercel.json (filesystem-precedence) — rotsiden krever edge-middleware.
 *
 * For kunder hostet PÅ vår plattform er planen en konfigurasjonsjobb
 * (ny SITE i geo-prerender-entry.tsx), ikke en kundejobb — planen sier
 * det eksplisitt.
 */

export const AI_CRAWLER_UAS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "bingbot"] as const;

export type HostingPlatform = "vercel" | "netlify" | "nginx" | "hosted_by_us" | "unknown";

export interface GeoPlanInput {
  domain: string;
  /** Strukturelt subset av F1-auditens capabilities. */
  capabilities: ReadonlyArray<{ key: string; status: string; details?: string }>;
  /** Sider fra sitemapen (locs) — prioriteringsgrunnlaget. */
  sitemapPages: readonly string[];
  platform: HostingPlatform;
}

export interface GeoPrerenderPlan {
  domain: string;
  platform: HostingPlatform;
  /** Én ærlig setning om nå-situasjonen, fra auditens observasjoner. */
  situation: string;
  /** Prioriterte tiltak i rekkefølge. */
  actions: string[];
  /** Sider som bør prerendres først (fra sitemap; rot alltid med). */
  pagesToPrerender: string[];
  /** Linjer som kan limes rett inn i robots.txt. */
  robotsLines: string[];
  /** Serving-oppskrift for valgt plattform (tekst, limbar). */
  servingRecipe: string;
  /** Article JSON-LD-mal med domenet flettet inn. */
  jsonLdTemplate: string;
  notes: string[];
}

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

/** Prioriter innholdssider: kortere stier og innholds-ord først, filtrer støy. */
export function prioritizePages(domain: string, locs: readonly string[], cap = 15): string[] {
  const noise = /\/(personvern|privacy|cookies|vilkar|terms|login|admin|takk|404)\b/i;
  const contentBoost = /\/(blogg|blog|artikler|articles|akademi|guide|tjenester|services|priser|pricing|om|about|kontakt)\b/i;
  const scored = [...new Set(locs)]
    .filter((u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "") === domain && !noise.test(u);
      } catch {
        return false;
      }
    })
    .map((u) => {
      const path = new URL(u).pathname;
      const depth = path.split("/").filter(Boolean).length;
      return { u, score: (contentBoost.test(path) ? 10 : 0) - depth };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.u);
  const root = `https://${domain}/`;
  return [root, ...scored.filter((u) => u !== root && u !== `https://${domain}`)].slice(0, cap);
}

export function buildRobotsLines(domain: string): string[] {
  return [
    ...AI_CRAWLER_UAS.flatMap((ua) => [`User-agent: ${ua}`, "Allow: /", ""]),
    `Sitemap: https://${domain}/sitemap.xml`,
  ];
}

const VERCEL_RECIPE = (domain: string) => `# Vercel — to deler (lærdom fra eget oppsett):
# 1) UA-betingede rewrites i vercel.json for ALLE stier UNNTATT "/":
{
  "source": "/(?<path>.+)",
  "has": [{ "type": "header", "key": "user-agent",
            "value": ".*(GPTBot|ClaudeBot|PerplexityBot|Google-Extended|bingbot).*" }],
  "destination": "/geo/:path.html"
}
# 2) FELLA: "/" KAN IKKE rewrites i vercel.json — filesystem-precedence
#    serverer index.html FØR rewrites. Rotsiden krever edge-middleware:
#    middleware.ts med matcher ['/'] som returnerer den prerendrede
#    HTML-en for bot-UA-er og slipper mennesker urørt gjennom.
# Prerendret HTML legges i public/geo/<side>.html i builden.`;

const NGINX_RECIPE = () => `# nginx — map på User-Agent, server statisk fil når den finnes:
map $http_user_agent $is_ai_bot {
  default 0;
  ~*(GPTBot|ClaudeBot|PerplexityBot|Google-Extended|bingbot) 1;
}
server {
  location / {
    if ($is_ai_bot) { rewrite ^(.*)$ /geo$1/index.html last; }
    try_files $uri $uri/ /index.html;
  }
  location /geo/ { internal; root /var/www/site; }
}
# Prerendret HTML genereres i build-steget og deployes til /var/www/site/geo/.`;

const NETLIFY_RECIPE = () => `# Netlify — begrensning (viktig å vite FØR man velger denne veien):
# _redirects/_headers kan IKKE matche på User-Agent. Alternativene er:
#   a) Edge Functions (Deno): les User-Agent, returner /geo/<side>.html
#   b) Prerendering-betaen (bot-deteksjon styrt av Netlify, mindre kontroll)
# Anbefaling: Edge Function per doc 14 — samme logikk som Vercel-middlewaren.`;

const HOSTED_RECIPE = () => `# Hostet hos oss: dette er en KONFIGURASJONSJOBB, ikke kundejobb.
# Ny SITE-konfig i frontend/client/src/prerender/geo-prerender-entry.tsx
# (samme mønster som TRR_SITE/LEADGRID_SITE) + host-mapping i
# frontend/middleware.ts og vercel.json. Komponent-mappen kaster på
# umappet nøkkel — manglende sider stopper bygget, med vilje.`;

const UNKNOWN_RECIPE = () => `# Plattform ikke gjenkjent fra svar-headere. Prinsippet er likt overalt:
# 1) Prerender innholdssidene til statisk HTML (fullt innhold + JSON-LD)
# 2) Rut forespørsler med AI-bot-User-Agent til de statiske filene
# 3) Mennesker skal aldri påvirkes — bot-grenen er additiv
# Se Vercel-/nginx-oppskriftene som referanse; spør hvilken stack kunden har.`;

export function buildGeoPrerenderPlan(input: GeoPlanInput): GeoPrerenderPlan {
  const domain = normalizeDomain(input.domain);
  const cap = (key: string) => input.capabilities.find((c) => c.key === key);
  const bot = cap("bot_serving");
  const robots = cap("robots_ai");
  const sitemap = cap("sitemap");

  const situation =
    bot?.status === "implemented"
      ? "AI-boter får allerede rikere innhold enn SPA-skallet — planen under er vedlikehold/utvidelse, ikke førstegangsoppsett."
      : bot?.status === "missing"
        ? `AI-boter ser i praksis ingenting på ${domain} (${bot.details ?? "tynt/likt innhold"}) — innholdet er usynlig for ChatGPT/Claude/Perplexity til serving er på plass.`
        : `Bot-serving på ${domain} er ikke entydig målt — kjør auditen på nytt etter tiltakene under.`;

  const actions: string[] = [];
  if (robots?.status === "missing") {
    actions.push("Fjern robots-blokkeringen av AI-boter (linjene under) — alt annet er bortkastet så lenge botene nektes adgang.");
  }
  if (sitemap?.status !== "implemented") {
    actions.push("Få sitemap på plass og deklarer den i robots.txt — prioriteringslisten under er ellers gjetting.");
  }
  if (bot?.status !== "implemented") {
    actions.push("Prerender sidene i prioritert rekkefølge under til statisk HTML med fullt innhold og Article/FAQPage JSON-LD.");
    actions.push("Sett opp bot-UA-serving etter oppskriften for plattformen.");
  }
  actions.push("Verifiser med site-auditen (bot-diffen skal vise «prerendret/rikere») og meld inn sidene via IndexNow.");

  return {
    domain,
    platform: input.platform,
    situation,
    actions,
    pagesToPrerender: prioritizePages(domain, input.sitemapPages),
    robotsLines: buildRobotsLines(domain),
    servingRecipe:
      input.platform === "vercel" ? VERCEL_RECIPE(domain)
      : input.platform === "nginx" ? NGINX_RECIPE()
      : input.platform === "netlify" ? NETLIFY_RECIPE()
      : input.platform === "hosted_by_us" ? HOSTED_RECIPE()
      : UNKNOWN_RECIPE(),
    jsonLdTemplate: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "<sidetittel>",
        description: "<1-2 setninger som oppsummerer siden>",
        author: { "@type": "Organization", name: "<bedriftsnavn>", url: `https://${domain}` },
        publisher: { "@type": "Organization", name: "<bedriftsnavn>" },
        mainEntityOfPage: `https://${domain}/<sti>`,
        inLanguage: "nb-NO",
      },
      null,
      2,
    ),
    notes: [
      "Mennesker skal aldri treffe bot-grenen — serving er additiv, aldri cloaking av annet innhold enn det brukerne får (samme tekst, statisk form).",
      "Bing-boten dekker ChatGPT-søkeindeksen; Google-Extended styrer Gemini-trening, ikke Google-søk.",
    ],
  };
}

/** Plattform-deteksjon fra svar-headere (best effort, ærlig unknown). */
export function detectPlatform(headers: Record<string, string>): HostingPlatform {
  const h = (name: string) => headers[name]?.toLowerCase() ?? "";
  if (h("x-vercel-id") || h("server").includes("vercel")) return "vercel";
  if (h("x-nf-request-id") || h("server").includes("netlify")) return "netlify";
  if (h("server").includes("nginx")) return "nginx";
  return "unknown";
}

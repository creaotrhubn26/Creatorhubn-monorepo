/**
 * generate-netlify-host-routes.mjs
 *
 * Netlify Edge Functions kan ikke condition'e redirects på Host-header
 * eller User-Agent (i motsetning til Vercels `has: [{type:'host'|'header'}]`
 * — dét brukte vercel.json for host+bot-rutet SEO-innhold (geo-prerenderte
 * sider + robots.txt/sitemap.xml/llms.txt per merke). Vercel→Netlify-
 * migrasjonen (2026-08-05) portet ALDRI disse reglene — vercel.json er død
 * kode siden DNS peker på Netlify, så all denne rutingen har vært helt
 * borte i ~2 uker (leadgrid.no viste CreatorHub-branding til alle bots).
 *
 * Genererer HELE edge-funksjonen netlify/edge-functions/host-routes.ts som
 * ÉN selvstendig fil (rute-logikk + rute-tabell fra vercel.json inlinet i
 * samme fil) — ikke to filer med en sideimport. Netlify sin Deno-edge-
 * bundler feilet ("Build script returned non-zero exit code: 2") på et
 * to-fils-oppsett (host-routes.ts importerte ./_generated-host-routes.ts);
 * én selvstendig generert fil er det entydig dokumenterte, trygge mønsteret.
 *
 * Kjøres i frontend-build-kjeden (postbuild) — se frontend/package.json.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const vercelJsonPath = resolve(repoRoot, 'frontend/vercel.json');
const outPath = resolve(repoRoot, 'netlify/edge-functions/host-routes.ts');

const vercelConfig = JSON.parse(await readFile(vercelJsonPath, 'utf8'));
const rewrites = vercelConfig.rewrites ?? [];

// Kun regler som (a) er host-betinget OG (b) peker på en av de tre SEO-
// filtypene vi faktisk vil host-rute: geo-prerenderte sider + robots/
// sitemap/llms.txt. Andre host-betingede Vercel-regler (gamle SPA-path-
// rewrites til f.eks. theroleroom.html) er allerede erstattet av client-
// side React Router + host-deteksjon — porter dem IKKE, det ville
// reintrodusere før-SPA-atferd som memory eksplisitt dokumenterer som fikset.
function isWanted(destination) {
  return (
    destination.startsWith('/geo/')
    || /-(robots\.txt|sitemap\.xml|llms\.txt)$/.test(destination)
  );
}

const routes = [];
for (const r of rewrites) {
  const has = r.has ?? [];
  const hostCond = has.find((h) => h.type === 'host');
  if (!hostCond) continue;
  if (!isWanted(r.destination)) continue;
  const uaCond = has.find((h) => h.type === 'header' && h.key === 'user-agent');
  routes.push({
    source: r.source,
    hostPattern: hostCond.value,
    uaPattern: uaCond ? uaCond.value : null,
    destination: r.destination,
  });
}

// Ubetingede fallback-regler (creatorhubn.com = default/siste-i-Vercel-
// rekkefølgen for robots/sitemap/llms — ingen `has` i det hele tatt).
for (const r of rewrites) {
  if (r.has) continue;
  if (!['/robots.txt', '/sitemap.xml', '/llms.txt'].includes(r.source)) continue;
  routes.push({ source: r.source, hostPattern: null, uaPattern: null, destination: r.destination });
}

if (routes.length === 0) {
  console.error('generate-netlify-host-routes: 0 regler funnet — det er alltid feil, avbryter.');
  process.exit(1);
}

await mkdir(dirname(outPath), { recursive: true });

const routesLiteral = JSON.stringify(routes, null, 2)
  .split('\n')
  .join('\n  '); // innrykk til å passe inn i funksjonskroppen under

const fileContent = `// host-routes.ts
//
// AUTO-GENERERT av frontend/scripts/generate-netlify-host-routes.mjs —
// ikke rediger for hånd, endre generator-scriptet i stedet. Regenereres
// ved hver frontend-build (npm run build:netlify-host-routes).
//
// Netlify Edge Function — gjenoppretter host+bot-UA-betinget SEO-ruting
// (geo-prerenderte sider + robots.txt/sitemap.xml/llms.txt per merke) som
// levde i frontend/vercel.json's \`has: [{type:'host'|'header'}]\`-regler
// FØR Vercel→Netlify-migrasjonen (2026-08-05). Netlify [[redirects]] har
// ingen native Host/User-Agent-betingelser (kun Country/Language/Role),
// derfor Edge Function — vercel.json er fortsatt KILDEN til reglene.
//
// Uten dette: leadgrid.no/theroleroom.com viser CreatorHub-branding og
// tom SPA-shell til ALLE bots (Googlebot, GPTBot, social-unfurl osv.) —
// bekreftet live 2026-08-20, ~2 uker etter migrasjonen.
//
// Bevisst ÉN selvstendig fil (logikk + rute-tabell inlinet) — et to-fils-
// oppsett (denne + en sideimportert _generated-host-routes.ts) feilet
// Netlify sin Deno-edge-bundler ("Build script returned non-zero exit
// code: 2") ved første forsøk 2026-08-20.

import type { Config, Context } from "@netlify/edge-functions";

interface HostRoute {
  source: string;
  hostPattern: string | null;
  uaPattern: string | null;
  destination: string;
}

const ROUTES: HostRoute[] = ${routesLiteral};

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const host = normalizeHost(url.hostname);
  const ua = request.headers.get("user-agent") ?? "";

  for (const route of ROUTES) {
    if (route.source !== url.pathname) continue;
    if (route.hostPattern && !new RegExp(\`^\${route.hostPattern}$\`, "i").test(host)) continue;
    if (route.uaPattern && !new RegExp(route.uaPattern, "i").test(ua)) continue;

    if (route.destination.startsWith("http")) {
      // Ekstern proxy (theroleroom sitemap.xml → Render-backend).
      const upstream = await fetch(route.destination);
      return new Response(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
      });
    }
    // Å returnere en URL rewriter internt til den (samme deploy, klienten
    // ser fortsatt original-URL-en) — IKKE en HTTP-redirect.
    return new URL(route.destination, url);
  }

  return context.next(); // ingen treff — vanlig SPA-respons uendret
};

export const config: Config = {
  path: "/*",
  excludedPath: ["/geo/*", "/*.js", "/*.css", "/*.png", "/*.webp", "/*.svg", "/*.woff2"],
};
`;

await writeFile(outPath, fileContent, 'utf8');
console.log(`generate-netlify-host-routes: ${routes.length} host/bot-ruter skrevet til ${outPath}`);

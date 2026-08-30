/**
 * generate-netlify-host-routes.mjs
 *
 * Netlify [[redirects]] kan ikke betinge regler på Host-header eller
 * User-Agent. De host-/bot-rutede SEO-sidene (geo-prerenderte sider +
 * robots.txt/sitemap.xml/llms.txt per merke) må derfor kjøres som en Edge
 * Function. Den Netlify-eide rutekilden er netlify/host-routes.json.
 *
 * Genererer HELE edge-funksjonen netlify/edge-functions/host-routes.ts som
 * ÉN selvstendig fil (rute-logikk + rute-tabell fra host-routes.json inlinet i
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
const hostRoutesPath = resolve(repoRoot, 'netlify/host-routes.json');
const outPath = resolve(repoRoot, 'netlify/edge-functions/host-routes.ts');

const hostRoutesConfig = JSON.parse(await readFile(hostRoutesPath, 'utf8'));
const routes = hostRoutesConfig.routes;

if (hostRoutesConfig.version !== 1 || !Array.isArray(routes) || routes.length === 0) {
  console.error('generate-netlify-host-routes: ugyldig eller tom rutekilde, avbryter.');
  process.exit(1);
}

for (const [index, route] of routes.entries()) {
  const valid =
    typeof route.source === 'string'
    && route.source.startsWith('/')
    && (route.hostPattern === null || typeof route.hostPattern === 'string')
    && (route.uaPattern === null || typeof route.uaPattern === 'string')
    && typeof route.destination === 'string'
    && (route.destination.startsWith('/') || route.destination.startsWith('https://'));
  if (!valid) {
    console.error(`generate-netlify-host-routes: ugyldig regel på indeks ${index}, avbryter.`);
    process.exit(1);
  }
  try {
    if (route.hostPattern) new RegExp(`^${route.hostPattern}$`, 'i');
    if (route.uaPattern) new RegExp(route.uaPattern, 'i');
  } catch {
    console.error(`generate-netlify-host-routes: ugyldig regex på indeks ${index}, avbryter.`);
    process.exit(1);
  }
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
// Netlify Edge Function — host+bot-UA-betinget SEO-ruting for
// geo-prerenderte sider + robots.txt/sitemap.xml/llms.txt per merke.
// Netlify [[redirects]] har ingen native Host/User-Agent-betingelser (kun
// Country/Language/Role), derfor Edge Function. Rutekilden er
// netlify/host-routes.json.
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

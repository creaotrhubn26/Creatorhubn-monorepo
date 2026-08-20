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
 * Denne genererer en JSON-tabell fra vercel.json (fortsatt kilden til
 * sannhet for HVILKE sider som skal bot-rutes) som
 * netlify/edge-functions/host-routes.ts leser ved request-tid — host+UA-
 * betinget ruting kjøres der i stedet, siden Netlify mangler native støtte.
 *
 * Kjøres i frontend-build-kjeden (postbuild) — se frontend/package.json.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const vercelJsonPath = resolve(repoRoot, 'frontend/vercel.json');
const outPath = resolve(repoRoot, 'netlify/edge-functions/_generated-host-routes.ts');

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
const header =
  '// AUTO-GENERERT av frontend/scripts/generate-netlify-host-routes.mjs — ikke rediger for hånd.\n' +
  '// Kilde: frontend/vercel.json. Regenereres ved hver frontend-build.\n\n' +
  'export interface HostRoute {\n' +
  '  source: string;\n' +
  '  hostPattern: string | null;\n' +
  '  uaPattern: string | null;\n' +
  '  destination: string;\n' +
  '}\n\n';
const body = `export const HOST_ROUTES: HostRoute[] = ${JSON.stringify(routes, null, 2)};\n`;
await writeFile(outPath, header + body, 'utf8');
console.log(`generate-netlify-host-routes: ${routes.length} host/bot-ruter skrevet til ${outPath}`);

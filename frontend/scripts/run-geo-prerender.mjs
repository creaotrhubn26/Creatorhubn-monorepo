/**
 * run-geo-prerender.mjs
 *
 * Kjøres etter `vite build` + `vite build --ssr` i frontend-builden:
 *
 *   1. Importerer den SSR-bygde geo-prerender-entryen (dist-geo/).
 *   2. Skriver én statisk HTML-fil per publisert pillar-side til
 *      client/dist/geo/<key>.html (full artikkeltekst + JSON-LD i rå-HTML,
 *      lesbart for AI-crawlere som ikke kjører JavaScript).
 *   3. Validerer at vercel.json har en theroleroom.com-rewrite
 *      /<path> → /geo/<key>.html for hver publisert side — feiler builden
 *      ved mismatch, så config og routing ikke kan skli fra hverandre.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..');
// 2026-08-20: Rollup velger .js/.mjs for SSR-bundlen avhengig av package.json
// "type"-oppløsning — hardkodet .js feilet lokalt (Rollup skrev .mjs) med
// ERR_MODULE_NOT_FOUND. Sjekk begge i stedet for å anta én av dem.
const ssrBundleJs = resolve(frontendRoot, 'client/dist-geo/geo-prerender-entry.js');
const ssrBundleMjs = resolve(frontendRoot, 'client/dist-geo/geo-prerender-entry.mjs');
const ssrBundle = existsSync(ssrBundleJs) ? ssrBundleJs : ssrBundleMjs;
const outDir = resolve(frontendRoot, 'client/dist/geo');
const vercelJsonPath = resolve(frontendRoot, 'vercel.json');

const { renderPublishedPages, renderLeadgridPages } = await import(ssrBundle);

const pages = renderPublishedPages();
const leadgridPages = renderLeadgridPages();
if (pages.length === 0 || leadgridPages.length === 0) {
  console.error('geo-prerender: 0 sider i en av gruppene — det er alltid feil, avbryter.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
await mkdir(resolve(outDir, 'leadgrid'), { recursive: true });

async function writePage(page, relTarget) {
  const target = resolve(outDir, relTarget);
  await writeFile(target, page.html, 'utf8');
  const words = page.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (words < 200) {
    console.error(`geo-prerender: ${relTarget} har bare ${words} ord — ser ut som tomt skall, avbryter.`);
    process.exit(1);
  }
  console.log(`geo-prerender: ${page.path} → geo/${relTarget} (${words} ord)`);
}

for (const page of pages) await writePage(page, `${page.key}.html`);
for (const page of leadgridPages) await writePage(page, `leadgrid/${page.key}.html`);

// ── Valider vercel.json-rewrites ──────────────────────────────────
const vercelConfig = JSON.parse(await readFile(vercelJsonPath, 'utf8'));
const rewrites = vercelConfig.rewrites ?? [];
const missing = [];
for (const page of pages) {
  const expected = `/geo/${page.key}.html`;
  const found = rewrites.some(
    (rw) =>
      rw.source === page.path &&
      rw.destination === expected &&
      (rw.has ?? []).some((h) => h.type === 'host' && /theroleroom/.test(h.value)) &&
      (rw.has ?? []).some((h) => h.type === 'header' && h.key === 'user-agent'),
  );
  if (!found) missing.push(`${page.path} → ${expected} (bot-rewrite)`);
}
for (const page of leadgridPages) {
  const expected = `/geo/leadgrid/${page.key}.html`;
  const found = rewrites.some(
    (rw) =>
      rw.source === page.path &&
      rw.destination === expected &&
      (rw.has ?? []).some((h) => h.type === 'host' && /leadgrid/.test(h.value)) &&
      (rw.has ?? []).some((h) => h.type === 'header' && h.key === 'user-agent'),
  );
  if (!found) missing.push(`leadgrid.no${page.path} → ${expected} (bot-rewrite)`);
}

if (missing.length > 0) {
  console.error('geo-prerender: vercel.json mangler host-rewrites for publiserte sider:');
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`geo-prerender: OK — ${pages.length} TRR-sider + ${leadgridPages.length} Leadgrid-sider prerendret og rutet.`);

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

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..');
const ssrBundle = resolve(frontendRoot, 'client/dist-geo/geo-prerender-entry.js');
const outDir = resolve(frontendRoot, 'client/dist/geo');
const vercelJsonPath = resolve(frontendRoot, 'vercel.json');

const { renderPublishedPages } = await import(ssrBundle);

const pages = renderPublishedPages();
if (pages.length === 0) {
  console.error('geo-prerender: 0 publiserte sider — det er alltid feil, avbryter.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const page of pages) {
  const target = resolve(outDir, `${page.key}.html`);
  await writeFile(target, page.html, 'utf8');
  const words = page.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (words < 200) {
    console.error(`geo-prerender: ${page.key} har bare ${words} ord — ser ut som tomt skall, avbryter.`);
    process.exit(1);
  }
  console.log(`geo-prerender: ${page.path} → geo/${page.key}.html (${words} ord)`);
}

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
if (missing.length > 0) {
  console.error('geo-prerender: vercel.json mangler host-rewrites for publiserte sider:');
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`geo-prerender: OK — ${pages.length} sider prerendret og rutet.`);

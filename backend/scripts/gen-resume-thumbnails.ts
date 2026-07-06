// gen-resume-thumbnails.ts — genererer galleri-thumbnails for CV-maler.
//
// Navigerer en headless browser til den skjulte /_thumb/resume/:id-ruten (som rendrer den
// EKTE React-mal-komponenten med eksempel-data) og skjermdumper CV-elementet → PNG. Bruker
// den GJENBRUKBARE render-adapteren (server/render-engine.ts) — ingen duplisering.
//
// Krever at frontend kjører (dev eller preview). Kjør:
//   FRONTEND_URL=http://localhost:5173 npx tsx backend/scripts/gen-resume-thumbnails.ts modern-ats professional-two-column
//
// Skriver til frontend/client/public/templates/<id>-preview.png — nøyaktig stiene
// RESUME_TEMPLATE_SEED_DATA.previewImage alt peker på (men som i dag mangler filer).
//
// TRYGT: bildet er KUN en galleri-illustrasjon. Den ekte CV-en + PDF-eksport forblir
// DOM/tekst (ATS-trygg) og røres ikke.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderUrlToImage, closeRenderEngine } from '../server/render-engine';

const BASE = process.env.FRONTEND_URL || 'http://localhost:5173';
const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('Bruk: npx tsx backend/scripts/gen-resume-thumbnails.ts <id> [id ...]  (t.d. modern-ats)');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../frontend/client/public/templates');
fs.mkdirSync(outDir, { recursive: true });

let ok = 0;
for (const id of ids) {
  const url = `${BASE}/_thumb/resume/${encodeURIComponent(id)}`;
  try {
    const png = await renderUrlToImage(url, {
      width: 820, height: 1160, deviceScaleFactor: 2,
      waitForSelector: '[data-thumb-ready]',
      clipToSelector: '[data-resume-thumb]',
      waitForMs: 600,
      waitUntil: 'networkidle0',
    });
    const out = path.join(outDir, `${id}-preview.png`);
    fs.writeFileSync(out, png);
    console.log('✓', id, '→', path.relative(process.cwd(), out), `(${(png.length / 1024).toFixed(0)} KB)`);
    ok++;
  } catch (e) {
    console.error('✗', id, (e as Error).message);
  }
}
await closeRenderEngine();
console.log(`\nFerdig: ${ok}/${ids.length} thumbnails.`);

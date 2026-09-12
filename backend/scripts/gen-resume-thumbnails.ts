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

// --schemes=a,b,c → generer også fargeskjema-varianter (<id>-<scheme>-preview.png)
// i tillegg til default (<id>-preview.png). Uten flagget: kun default.
const rawArgs = process.argv.slice(2);
const schemesArg = rawArgs.find((a) => a.startsWith('--schemes='));
const schemes = schemesArg ? schemesArg.slice('--schemes='.length).split(',').map((s) => s.trim()).filter(Boolean) : [];
// Størrelses-overstyring for lette skjema-varianter (galleri-swatch-swap trenger ikke
// full A4 @2x). Default = høyoppløst (som eksisterende default-previews).
const numArg = (name: string, def: number): number => {
  const a = rawArgs.find((x) => x.startsWith(`--${name}=`));
  const n = a ? parseFloat(a.slice(name.length + 3)) : NaN;
  return Number.isFinite(n) ? n : def;
};
const WIDTH = numArg('w', 820);
const HEIGHT = numArg('h', 1160);
const DPR = numArg('dpr', 2);
const NO_DEFAULT = rawArgs.includes('--no-default'); // hopp over default-varianten (kun skjema-varianter)
const fmtArg = rawArgs.find((a) => a.startsWith('--format='));
const FORMAT: 'png' | 'jpeg' = fmtArg && fmtArg.slice('--format='.length) === 'jpeg' ? 'jpeg' : 'png';
const QUALITY = numArg('quality', 82);
const EXT = FORMAT === 'jpeg' ? 'jpg' : 'png';
const ids = rawArgs.filter((a) => !a.startsWith('--'));
if (ids.length === 0) {
  console.error('Bruk: npx tsx backend/scripts/gen-resume-thumbnails.ts <id> [id ...] [--schemes=creator-orange,ocean-blue]');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../frontend/client/public/templates');
fs.mkdirSync(outDir, { recursive: true });

// (id, scheme|null) → filnavn. scheme=null = default-varianten.
const jobs: Array<{ id: string; scheme: string | null }> = [];
for (const id of ids) {
  if (!NO_DEFAULT) jobs.push({ id, scheme: null });
  for (const s of schemes) jobs.push({ id, scheme: s });
}

let ok = 0;
for (const { id, scheme } of jobs) {
  const q = scheme ? `?scheme=${encodeURIComponent(scheme)}` : '';
  const url = `${BASE}/_thumb/resume/${encodeURIComponent(id)}${q}`;
  // Default beholder alltid .png (seed peker dit); skjema-varianter følger --format.
  const fileName = scheme ? `${id}-${scheme}-preview.${EXT}` : `${id}-preview.png`;
  try {
    const png = await renderUrlToImage(url, {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: DPR,
      format: scheme ? FORMAT : 'png',
      quality: FORMAT === 'jpeg' ? QUALITY : undefined,
      waitForSelector: '[data-thumb-ready]',
      clipToSelector: '[data-resume-thumb]',
      waitForMs: 600,
      waitUntil: 'networkidle0',
    });
    const out = path.join(outDir, fileName);
    fs.writeFileSync(out, png);
    console.log('✓', scheme ? `${id} [${scheme}]` : id, '→', path.relative(process.cwd(), out), `(${(png.length / 1024).toFixed(0)} KB)`);
    ok++;
  } catch (e) {
    console.error('✗', scheme ? `${id} [${scheme}]` : id, (e as Error).message);
  }
}
await closeRenderEngine();
console.log(`\nFerdig: ${ok}/${jobs.length} thumbnails.`);

import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf38_rr-dance-vokabular.html', 'utf8');

const CFG = {
  tittel: 'Bevegelses-leksikon',
  undertittel: 'Felles språk for koreografi, øvingslogg og repetisjoner i salen.',
  sesong: 'Høst 2026 — Samtidsdans',
  b1: { navn: 'Pirouette en dehors', kategori: 'Dreining' },
  b2: { navn: 'Grand jeté', kategori: 'Sprang' },
  b3: { navn: 'Plié & relevé', kategori: 'Grunnstilling' },
  b4: { navn: 'Spiralfall til gulv', kategori: 'Gulvarbeid' },
  b5: { navn: 'Kontraksjon & release', kategori: 'Bevegelses-kvalitet' },
  b6: { navn: 'Bryst-isolasjon', kategori: 'Urban' },
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-dance-vokabular_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf38_rr-dance-vokabular_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');

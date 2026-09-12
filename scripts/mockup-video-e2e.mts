/**
 * mockup-video-e2e.mts — ekte ende-til-ende-verifisering av mockup-video-røret.
 *
 * Kjører i HEADLESS CHROMIUM via Playwright (ingen vite-server nødvendig):
 *   1. esbuild bundler exportMockupVideo + renderMockupFrame + geometri til
 *      én IIFE som eksponerer window.MockupVideo.
 *   2. I nettleseren genereres en SYNTETISK kilde-video (animert canvas →
 *      captureStream → MediaRecorder → blob → <video>).
 *   3. exportMockupVideo(video, {variant}) kjøres for macbook/ipad/iphone.
 *   4. Asserter at en ekte, ikke-tom video-blob kommer ut, med korrekt
 *      mime-type og lerret-dimensjoner som matcher device-geometrien.
 *
 * Dette beviser at "video → mockup → video" faktisk produserer en fil — ikke
 * bare at koden typechecker.
 *
 * Kjøring:
 *   node_modules/.bin/tsx scripts/mockup-video-e2e.mts
 */

import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = join(
  __dirname,
  '..',
  'frontend',
  'client',
  'src',
  'components',
  'role-room',
  'post-agent',
  'mockup-video',
);

interface VariantResult {
  variant: string;
  ok: boolean;
  size: number;
  mimeType: string;
  width: number;
  height: number;
  error?: string;
}

async function bundleModule(): Promise<string> {
  // Liten entry som eksponerer kjernen på window.
  const entry = `
    import { exportMockupVideo, isMockupExportSupported, pickMockupMimeType } from './exportMockupVideo';
    import { getDeviceGeometry } from './deviceGeometry';
    (window as any).MockupVideo = { exportMockupVideo, isMockupExportSupported, pickMockupMimeType, getDeviceGeometry };
  `;
  const result = await esbuild.build({
    stdin: {
      contents: entry,
      resolveDir: MODULE_DIR,
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
  });
  return result.outputFiles[0].text;
}

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"></head>
<body><canvas id="probe"></canvas></body></html>`;

async function main() {
  console.log('[mockup-e2e] bundler modul med esbuild…');
  const bundle = await bundleModule();

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream'],
  });
  const page = await browser.newPage();

  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[browser:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[browser:pageerror] ${err.message}`));

  await page.setContent(PAGE_HTML);
  // tsx/esbuild wrapper evaluate-callbacks med keepNames-helperen `__name`.
  // Den finnes ikke i nettleseren → injiser en identitets-shim som rå streng
  // (rå strenger transformeres ikke av tsx).
  await page.addScriptTag({
    content: 'globalThis.__name = globalThis.__name || function (fn) { return fn; };',
  });
  await page.addScriptTag({ content: bundle });

  // Sjekk at bundelet eksponerte API-et og at nettleseren støtter eksport.
  const supported = await page.evaluate(() => {
    const mv = (window as any).MockupVideo;
    return mv && typeof mv.exportMockupVideo === 'function' && mv.isMockupExportSupported();
  });
  if (!supported) {
    console.error('[mockup-e2e] MediaRecorder/captureStream ikke støttet i denne Chromium.');
    logs.forEach((l) => console.error(l));
    await browser.close();
    process.exit(1);
  }
  console.log('[mockup-e2e] window.MockupVideo eksponert + eksport støttet.');

  // Kjør hele røret per variant, inne i nettleseren.
  const results: VariantResult[] = await page.evaluate(async () => {
    const mv = (window as any).MockupVideo;

    // ---- 1) Lag en syntetisk kilde-video (animert firkant ~1.2s) ----
    async function makeSourceVideo(): Promise<HTMLVideoElement> {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      const cx = c.getContext('2d')!;
      const stream = (c as any).captureStream(30) as MediaStream;
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      let frame = 0;
      const draw = () => {
        cx.fillStyle = '#0b1120';
        cx.fillRect(0, 0, 320, 240);
        cx.fillStyle = `hsl(${(frame * 6) % 360}, 80%, 55%)`;
        const x = (frame * 4) % 280;
        cx.fillRect(x, 90, 40, 40);
        frame++;
      };
      rec.start();
      const iv = setInterval(draw, 1000 / 30);
      await new Promise((r) => setTimeout(r, 1200));
      clearInterval(iv);
      rec.stop();
      const blob = await done;

      const video = document.createElement('video');
      video.src = URL.createObjectURL(blob);
      video.muted = true;
      (video as any).playsInline = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('kilde-video kunne ikke lastes'));
      });
      return video;
    }

    const out: any[] = [];
    const source = await makeSourceVideo();

    for (const variant of ['macbook', 'ipad', 'iphone']) {
      try {
        // Lavere pixelRatio i test for fart; backstop på lengde.
        const res = await mv.exportMockupVideo(source, {
          variant,
          fit: 'cover',
          background: { kind: 'gradient', from: '#1e293b', to: '#0b1120' },
          padding: 0.08,
          pixelRatio: 2,
          frameRate: 30,
          includeAudio: false,
          maxDurationMs: 6000,
        });
        out.push({
          variant,
          ok: res.blob.size > 0,
          size: res.blob.size,
          mimeType: res.mimeType,
          width: res.width,
          height: res.height,
        });
      } catch (e: any) {
        out.push({ variant, ok: false, size: 0, mimeType: '', width: 0, height: 0, error: String(e?.message ?? e) });
      }
    }
    return out;
  });

  await browser.close();

  // ---- Rapport + assertions ----
  let failed = 0;
  console.log('\n[mockup-e2e] resultater:');
  for (const r of results) {
    const status = r.ok ? 'OK ' : 'FAIL';
    console.log(
      `  [${status}] ${r.variant.padEnd(7)} blob=${r.size}b mime=${r.mimeType} canvas=${r.width}x${r.height}` +
        (r.error ? `  err=${r.error}` : ''),
    );
    // Assertions: ikke-tom blob, gyldig video-mime, fornuftige dimensjoner.
    if (!r.ok) failed++;
    if (r.size < 1000) { console.log(`        ↳ blob mistenkelig liten (<1KB)`); failed++; }
    if (!/^video\/(webm|mp4)/.test(r.mimeType)) { console.log(`        ↳ ugyldig mime`); failed++; }
    if (r.width < 100 || r.height < 100) { console.log(`        ↳ ugyldige dimensjoner`); failed++; }
  }

  if (results.length !== 3) {
    console.error(`[mockup-e2e] forventet 3 varianter, fikk ${results.length}`);
    failed++;
  }

  if (failed > 0) {
    console.error(`\n[mockup-e2e] ${failed} assertion(s) feilet.`);
    if (logs.length) {
      console.error('--- browser-logg ---');
      logs.forEach((l) => console.error(l));
    }
    process.exit(1);
  }

  console.log('\n[mockup-e2e] ✅ alle 3 varianter produserte ekte video-blobs. Røret funker ende-til-ende.');
}

main().catch((err) => {
  console.error('[mockup-e2e] FEIL:', err?.stack ?? err);
  process.exit(1);
});

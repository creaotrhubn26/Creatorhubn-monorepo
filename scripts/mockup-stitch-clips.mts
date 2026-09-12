/**
 * mockup-stitch-clips.mts — ekte test med Daniels to klipp.
 *
 * Syr to screen-recordings sammen i rekkefølge, pakket inn i iPhone-mockupen,
 * og skriver én mp4. Bruker den verifiserte rendereren (renderMockupFrame +
 * deviceGeometry) i ekte headless Chromium.
 *
 * Steg:
 *   1. ffmpeg: HEVC → H.264 (Chromium dekoder ikke HEVC pålitelig), nedskalert.
 *   2. Chromium: én canvas + MediaRecorder. Spill klipp 1 → renderMockupFrame
 *      per frame; ved 'ended' bytt kilde til klipp 2; ved klipp 2 'ended' stopp.
 *   3. ffmpeg: webm → mp4 (QuickTime-vennlig).
 *
 * Kjøring:
 *   node_modules/.bin/tsx scripts/mockup-stitch-clips.mts <klipp1.mp4> <klipp2.mp4> [--out fil.mp4]
 */

import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MODULE_DIR = join(ROOT, 'frontend', 'client', 'src', 'components', 'role-room', 'post-agent', 'mockup-video');

async function bundle(): Promise<string> {
  const entry = `
    import { renderMockupFrame } from './renderMockupFrame';
    import { getDeviceGeometry } from './deviceGeometry';
    (window as any).MV = { renderMockupFrame, getDeviceGeometry };
  `;
  const r = await esbuild.build({
    stdin: { contents: entry, resolveDir: MODULE_DIR, loader: 'ts' },
    bundle: true, format: 'iife', platform: 'browser', target: 'es2020', write: false,
  });
  return r.outputFiles[0].text;
}

/** HEVC → H.264 mp4, nedskalert til 720px høyde for fart/minne. */
async function transcodeForBrowser(input: string, output: string): Promise<void> {
  await exec('ffmpeg', [
    '-y', '-i', input,
    '-vf', 'scale=-2:720',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-an', // dropp lyd for testen
    '-movflags', '+faststart',
    output,
  ]);
}

async function main() {
  const [clip1, clip2, ...rest] = process.argv.slice(2);
  if (!clip1 || !clip2) {
    throw new Error('Bruk: tsx scripts/mockup-stitch-clips.mts <klipp1> <klipp2> [--out fil.mp4]');
  }
  const outFlagIdx = rest.indexOf('--out');
  const outName = outFlagIdx >= 0 ? rest[outFlagIdx + 1] : 'mockup-stitched.mp4';

  const workDir = join(ROOT, 'out-videos');
  await mkdir(workDir, { recursive: true });
  const h1 = join(workDir, '_clip1_h264.mp4');
  const h2 = join(workDir, '_clip2_h264.mp4');
  const webmOut = join(workDir, '_mockup_raw.webm');
  const finalOut = outFlagIdx >= 0 && outName.includes('/') ? outName : join(workDir, outName);

  console.log('[stitch] transkoder klipp til H.264…');
  await Promise.all([transcodeForBrowser(clip1, h1), transcodeForBrowser(clip2, h2)]);

  // Last inn som base64 → data-URL i nettleseren.
  const [b1, b2] = await Promise.all([readFile(h1), readFile(h2)]);
  const dataUrl1 = `data:video/mp4;base64,${b1.toString('base64')}`;
  const dataUrl2 = `data:video/mp4;base64,${b2.toString('base64')}`;
  console.log(`[stitch] klipp 1 ${(b1.length/1e6).toFixed(1)}MB, klipp 2 ${(b2.length/1e6).toFixed(1)}MB`);

  const code = await bundle();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[browser:${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[browser:pageerror] ${e.message}`));

  // Bakgrunns-presets (CLI: --bg <key>).
  const BG_PRESETS: Record<string, any> = {
    midnight: { kind: 'gradient', from: '#1e293b', to: '#0b1120', direction: 'vertical' },
    brand: { kind: 'gradient', from: '#312e81', to: '#0b1120', direction: 'diagonal' },
    sunset: { kind: 'gradient', from: '#7c2d12', to: '#1e1b4b', direction: 'diagonal' },
    ocean: { kind: 'gradient', from: '#0e7490', to: '#0b1120', direction: 'vertical' },
    plum: { kind: 'gradient', from: '#a030c0', to: '#0a0518', direction: 'diagonal' },
    light: { kind: 'gradient', from: '#f1f5f9', to: '#cbd5e1', direction: 'vertical' },
    black: { kind: 'solid', from: '#000000' },
    none: { kind: 'none' },
  };
  const bgIdx = rest.indexOf('--bg');
  const bgKey = bgIdx >= 0 ? rest[bgIdx + 1] : 'brand';
  const bg = BG_PRESETS[bgKey] ?? BG_PRESETS.brand;
  const insetIdx = rest.indexOf('--inset-top');
  const insetTop = insetIdx >= 0 ? Number(rest[insetIdx + 1]) : 0.045;
  console.log(`[stitch] bakgrunn=${bgKey}, statuslinje-crop=${(insetTop * 100).toFixed(1)}%`);

  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: 'globalThis.__name = globalThis.__name || function (f){return f;};' });
  await page.addInitScript(`window.__BG = ${JSON.stringify(bg)}; window.__INSET_TOP = ${insetTop};`);
  await page.evaluate(`window.__BG = ${JSON.stringify(bg)}; window.__INSET_TOP = ${insetTop};`);
  await page.addScriptTag({ content: code });

  console.log('[stitch] tegner + tar opp i Chromium…');
  // Vi venter på en download fra nettleseren i stedet for å serialisere
  // bytes gjennom Node (det sprenger heapen for store videoer).
  const downloadPromise = page.waitForEvent('download', { timeout: 300_000 });
  const result = await page.evaluate(async ([url1, url2]) => {
    const MV = (window as any).MV;
    const variant = 'iphone';
    const pixelRatio = 5;

    const geom = MV.getDeviceGeometry(variant, pixelRatio);
    const pad = 0.08;
    const width = Math.round(geom.width / (1 - pad * 2));
    const height = Math.round(geom.height / (1 - pad * 2));

    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const renderOpts = {
      variant, fit: 'cover',
      background: (window as any).__BG,
      padding: pad,
      // Crop vekk iOS-statuslinjen (tid / 5G / batteri) øverst.
      sourceInset: { top: (window as any).__INSET_TOP ?? 0.045 },
    };

    function loadVideo(src: string): Promise<HTMLVideoElement> {
      return new Promise((resolve, reject) => {
        const v = document.createElement('video');
        v.src = src; v.muted = true; (v as any).playsInline = true;
        v.onloadeddata = () => resolve(v);
        v.onerror = () => reject(new Error('kunne ikke laste video'));
      });
    }

    const [v1, v2] = await Promise.all([loadVideo(url1), loadVideo(url2)]);

    const stream = (canvas as any).captureStream(30) as MediaStream;
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    const recDone = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })); });

    let current = v1;
    let raf = 0;
    const draw = () => {
      MV.renderMockupFrame(ctx, current, width, height, renderOpts);
      raf = requestAnimationFrame(draw);
    };

    const playClip = (v: HTMLVideoElement) => new Promise<void>((resolve) => {
      current = v;
      v.currentTime = 0;
      v.onended = () => resolve();
      v.play();
    });

    rec.start(250);
    raf = requestAnimationFrame(draw);
    await playClip(v1);   // klipp 1 først
    await playClip(v2);   // så klipp 2
    cancelAnimationFrame(raf);
    MV.renderMockupFrame(ctx, v2, width, height, renderOpts); // sluttbilde
    rec.stop();

    const blob = await recDone;
    // Last ned blobben direkte fra nettleseren → disk (ingen Node-serialisering).
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mockup_raw.webm';
    document.body.appendChild(a);
    a.click();
    return { size: blob.size, width, height, dur1: v1.duration, dur2: v2.duration };
  }, [dataUrl1, dataUrl2]);

  const download = await downloadPromise;
  await download.saveAs(webmOut);
  await browser.close();

  if (!result || result.size === 0) {
    console.error('[stitch] FEIL: tom blob');
    logs.forEach((l) => console.error(l));
    process.exit(1);
  }

  console.log(`[stitch] rå webm: ${(result.size/1e6).toFixed(1)}MB (${result.width}x${result.height}, klipp ${result.dur1.toFixed(1)}s + ${result.dur2.toFixed(1)}s)`);

  // ---- Lyd: konkatener RÅ lyd fra begge klipp (i rekkefølge) ----
  // Selve lyd-poleringen gjøres etterpå av Post Agents EKTE pipeline
  // (apply_audio_polish.py): highpass → de-esser → voice-boost → LUFS-norm.
  const audioMix = join(workDir, '_audio.m4a');
  console.log('[stitch] konkatener rå lyd fra begge klipp…');
  await exec('ffmpeg', [
    '-y',
    '-i', clip1,
    '-i', clip2,
    '-filter_complex',
      `[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];` +
      `[1:a]aresample=48000,aformat=channel_layouts=stereo[a1];` +
      `[a0][a1]concat=n=2:v=0:a=1[a]`,
    '-map', '[a]',
    '-c:a', 'aac', '-b:a', '192k',
    audioMix,
  ]);

  // ---- Visuell polish: fade inn/ut på video for myk start/slutt ----
  const totalDur = result.dur1 + result.dur2;
  const fadeDur = 0.5;
  const fadeOutStart = Math.max(0, totalDur - fadeDur);
  const preMux = join(workDir, '_premux.mp4');
  console.log('[stitch] legger på video fade inn/ut + muxer rå lyd…');
  await exec('ffmpeg', [
    '-y',
    '-i', webmOut,       // video (mockup)
    '-i', audioMix,      // lyd (rå, konkatenert)
    '-vf', `fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDur}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '192k',
    '-map', '0:v:0', '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    preMux,
  ]);

  // ---- Lyd-polish via Post Agents ekte apply_audio_polish.py ----
  const polish = !rest.includes('--no-polish');
  if (polish) {
    console.log('[stitch] kjører Post Agents apply_audio_polish.py (highpass→de-ess→voice-boost→LUFS)…');
    const polishScript = join(
      ROOT, 'apps', 'resolve-script-manager', 'python', 'scripts', 'audio', 'apply_audio_polish.py',
    );
    // Speech-tunge instillinger (samme nøkler som perChapter forventer).
    const polishParams = {
      inputPath: preMux,
      outputPath: finalOut,
      overallLufsTarget: -14.0,
      perChapter: {
        main: {
          duckingDb: -6.0,
          deEssLevel: 'soft',
          highPassHz: 80,
          voiceBoostDb: 2.0,
          musicVolume: 0.7,
          ambientVolume: 0.65,
        },
      },
    };
    try {
      const { stdout } = await exec('python3', [polishScript, `--params=${JSON.stringify(polishParams)}`]);
      const resultLine = stdout.split('\n').find((l) => l.includes('"filterChain"'));
      if (resultLine) {
        try { console.log(`[stitch]   filter: ${JSON.parse(resultLine).filterChain ?? JSON.parse(resultLine).data?.filterChain}`); } catch {}
      }
    } catch (e: any) {
      console.warn('[stitch] apply_audio_polish.py feilet — faller tilbake til upolert lyd.');
      console.warn('         ', (e?.stderr ?? e?.message ?? e).toString().slice(-400));
      await exec('ffmpeg', ['-y', '-i', preMux, '-c', 'copy', '-movflags', '+faststart', finalOut]);
    }
  } else {
    await exec('ffmpeg', ['-y', '-i', preMux, '-c', 'copy', '-movflags', '+faststart', finalOut]);
  }

  // Rydd mellomfiler.
  await Promise.all([
    rm(preMux, { force: true }),
    rm(h1, { force: true }), rm(h2, { force: true }),
    rm(webmOut, { force: true }), rm(audioMix, { force: true }),
  ]);

  console.log(`\n[stitch] ✅ ferdig → ${finalOut}`);
}

main().catch((err) => { console.error('[stitch] FEIL:', err?.stack ?? err); process.exit(1); });

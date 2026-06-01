/**
 * mockup-polish-pro.mts — transparent, polert mockup-video med ren lyd.
 *
 * Bygger videre på mockup-stitch-clips, men:
 *   - TRANSPARENT bakgrunn (alfa) → ProRes 4444 .mov (dropp inn i Resolve/Premiere).
 *     Chromiums VP8-MediaRecorder bevarer alfa (verifisert), som vi transkoder
 *     til ProRes 4444 med alfa-kanal.
 *   - Lyd-NOISE-GATE: når personen ikke snakker er det stille (ingen romstøy/hiss).
 *     Vi BEHOLDER all video — bare lyden gates, fordi det skjer noe visuelt selv
 *     når det er stille.
 *   - TWO-PASS loudnorm: treffer -14 LUFS presist (single-pass bommer).
 *   - Post Agents apply_audio_polish.py: highpass → de-ess → voice-boost → LUFS.
 *
 * Kjøring:
 *   node_modules/.bin/tsx scripts/mockup-polish-pro.mts <klipp1> <klipp2> [--out fil.mov]
 *       [--gate-threshold 0.02] [--no-polish] [--shadow]
 */

import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, rm } from 'node:fs/promises';
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
    '-an', '-movflags', '+faststart', output,
  ]);
}

async function main() {
  const [clip1, clip2, ...rest] = process.argv.slice(2);
  if (!clip1 || !clip2) {
    throw new Error('Bruk: tsx scripts/mockup-polish-pro.mts <klipp1> <klipp2> [--out fil.mov]');
  }
  // ── Konfig via flagg (speiler MockupConfig fra UI-et). Hver funksjon på/av. ──
  const flag = (name: string) => rest.includes(name);
  const val = (name: string, def: string) => {
    const i = rest.indexOf(name);
    return i >= 0 && rest[i + 1] != null ? rest[i + 1] : def;
  };
  const outName = val('--out', 'mockup-polished.mov');
  const outIdx = rest.indexOf('--out');

  // Lyd-toggles
  const useGate = !flag('--no-gate');
  const gateThreshold = Number(val('--gate-threshold', '0.02')); // ~ -34 dB
  const polish = !flag('--no-polish');
  const useLoudness = !flag('--no-loudness');
  const loudnessTarget = Number(val('--loudness', '-14'));
  // Visuelle toggles
  const wantShadow = flag('--shadow');
  const statusCrop = Number(val('--status-crop', '0.045'));
  const fadeDur = Number(val('--fade', '0.5'));
  console.log(`[pro] config: gate=${useGate} polish=${polish} loudness=${useLoudness}(${loudnessTarget}) ` +
    `shadow=${wantShadow} statusCrop=${statusCrop} fade=${fadeDur}`);

  const workDir = join(ROOT, 'out-videos');
  await mkdir(workDir, { recursive: true });
  const h1 = join(workDir, '_pp_clip1.mp4');
  const h2 = join(workDir, '_pp_clip2.mp4');
  const webmOut = join(workDir, '_pp_alpha.webm');     // transparent video
  const audioMix = join(workDir, '_pp_audio.m4a');     // gated + normalisert lyd
  const finalOut = outIdx >= 0 && outName.includes('/') ? outName : join(workDir, outName);

  console.log('[pro] transkoder klipp til H.264…');
  await Promise.all([transcodeForBrowser(clip1, h1), transcodeForBrowser(clip2, h2)]);

  const [b1, b2] = await Promise.all([readFile(h1), readFile(h2)]);
  const dataUrl1 = `data:video/mp4;base64,${b1.toString('base64')}`;
  const dataUrl2 = `data:video/mp4;base64,${b2.toString('base64')}`;

  // ---- Render TRANSPARENT video i Chromium (VP8 bevarer alfa) ----
  const code = await bundle();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[browser:${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[browser:pageerror] ${e.message}`));

  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: 'globalThis.__name = globalThis.__name || function (f){return f;};' });
  await page.evaluate(`window.__SHADOW = ${wantShadow}; window.__STATUS_CROP = ${statusCrop};`);
  await page.addScriptTag({ content: code });

  console.log(`[pro] tegner transparent + tar opp (alfa, skygge: ${wantShadow ? 'på' : 'av'})…`);
  const downloadPromise = page.waitForEvent('download', { timeout: 300_000 });
  const result = await page.evaluate(async ([url1, url2]) => {
    const MV = (window as any).MV;
    const variant = 'iphone';
    const pixelRatio = 5;
    const geom = MV.getDeviceGeometry(variant, pixelRatio);
    // Ingen bakgrunn → ingen padding; lerret = enhetens bounding box.
    const width = Math.round(geom.width);
    const height = Math.round(geom.height);

    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    // alpha:true er default, men vær eksplisitt.
    const ctx = canvas.getContext('2d', { alpha: true })!;

    const renderOpts = {
      variant, fit: 'cover',
      background: { kind: 'none' },              // TRANSPARENT
      padding: 0,
      sourceInset: ((window as any).__STATUS_CROP ?? 0) > 0
        ? { top: (window as any).__STATUS_CROP } : undefined, // crop iOS-statuslinje
      shadow: (window as any).__SHADOW === true, // skygge gir kun mening med bakgrunn
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

    // VP8 bevarer alfa (vp9 gjør det ikke pålitelig i MediaRecorder).
    const stream = (canvas as any).captureStream(30) as MediaStream;
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 12_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    const recDone = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })); });

    let current = v1, raf = 0;
    const draw = () => {
      // clearRect i rendereren gir transparent bakgrunn mellom enhets-pikslene.
      MV.renderMockupFrame(ctx, current, width, height, renderOpts);
      raf = requestAnimationFrame(draw);
    };
    const playClip = (v: HTMLVideoElement) => new Promise<void>((resolve) => {
      current = v; v.currentTime = 0; v.onended = () => resolve(); v.play();
    });

    rec.start(250);
    raf = requestAnimationFrame(draw);
    await playClip(v1);
    await playClip(v2);
    cancelAnimationFrame(raf);
    MV.renderMockupFrame(ctx, v2, width, height, renderOpts);
    rec.stop();

    const blob = await recDone;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pp_alpha.webm';
    document.body.appendChild(a); a.click();
    return { size: blob.size, width, height, dur1: v1.duration, dur2: v2.duration };
  }, [dataUrl1, dataUrl2]);

  const download = await downloadPromise;
  await download.saveAs(webmOut);
  await browser.close();

  if (!result || result.size === 0) {
    console.error('[pro] FEIL: tom blob'); logs.forEach((l) => console.error(l)); process.exit(1);
  }
  console.log(`[pro] transparent webm: ${(result.size/1e6).toFixed(1)}MB (${result.width}x${result.height})`);

  // ---- Lyd: konkatener → (NOISE GATE) → (TWO-PASS loudnorm) ----
  console.log(`[pro] bygger lyd: konkatener${useGate ? ` + noise gate (terskel ${gateThreshold})` : ''}…`);
  const gatedRaw = join(workDir, '_pp_gated.m4a');
  const gateChain = useGate
    // Noise gate: stillhet når under terskel. range=0 → full demping i pauser.
    ? `;[c]agate=threshold=${gateThreshold}:ratio=9:attack=10:release=250:range=0[out]`
    : '';
  await exec('ffmpeg', [
    '-y', '-i', clip1, '-i', clip2,
    '-filter_complex',
      `[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];` +
      `[1:a]aresample=48000,aformat=channel_layouts=stereo[a1];` +
      `[a0][a1]concat=n=2:v=0:a=1${useGate ? '[c]' : '[out]'}` + gateChain,
    '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', gatedRaw,
  ]);

  // ---- Valgfri bakgrunnsmusikk med DUCKING (sidechain) ----
  // --music <fil>: bland inn sang/musikk som dempes automatisk når noen snakker.
  //   duckingDb styrer hvor mye musikken dempes under tale.
  const musicFile = rest.includes('--music') ? val('--music', '') : '';
  const duckDb = Number(val('--duck', '-12')); // hvor mye musikken dempes (dB)
  const musicVol = Number(val('--music-volume', '0.5'));
  if (musicFile) {
    console.log(`[pro] blander inn musikk med ducking (${duckDb}dB under tale): ${musicFile}`);
    const ducked = join(workDir, '_pp_ducked.m4a');
    // sidechaincompress: tale (sc) styrer hvor mye musikk slippes gjennom.
    // threshold lav + ratio høy → musikken dukker tydelig når tale er til stede.
    await exec('ffmpeg', [
      '-y',
      '-i', gatedRaw,                                   // [0] tale (gated)
      '-stream_loop', '-1', '-i', musicFile,            // [1] musikk (loopes)
      '-filter_complex',
        `[0:a]asplit=2[sc][voice];` +
        `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${musicVol}[mus];` +
        // ratio utledes av ønsket dempe-dybde: dypere ducking → høyere ratio.
        `[mus][sc]sidechaincompress=threshold=0.03:ratio=${Math.max(2, Math.min(20, Math.abs(duckDb))).toFixed(0)}:attack=20:release=400:makeup=1[ducked];` +
        `[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`,
      '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', ducked,
    ]);
    await rm(gatedRaw, { force: true });
    await exec('ffmpeg', ['-y', '-i', ducked, '-c', 'copy', gatedRaw]);
    await rm(ducked, { force: true });
  }

  if (useLoudness) {
    // Two-pass loudnorm: pass 1 måler, pass 2 anvender → presist mål.
    console.log(`[pro] two-pass loudnorm (mål ${loudnessTarget} LUFS)…`);
    const measureOut = await exec('ffmpeg', [
      '-hide_banner', '-i', gatedRaw,
      '-af', `loudnorm=I=${loudnessTarget}:LRA=11:TP=-1.5:print_format=json`,
      '-f', 'null', '-',
    ]).then((r) => r.stderr).catch((e) => e.stderr ?? '');
    const jsonMatch = measureOut.match(/\{[\s\S]*?\}/);
    let normFilter = `loudnorm=I=${loudnessTarget}:LRA=11:TP=-1.5`;
    if (jsonMatch) {
      try {
        const m = JSON.parse(jsonMatch[0]);
        normFilter =
          `loudnorm=I=${loudnessTarget}:LRA=11:TP=-1.5:measured_I=${m.input_i}:measured_LRA=${m.input_lra}` +
          `:measured_TP=${m.input_tp}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
        console.log(`[pro]   målt: I=${m.input_i} LUFS, TP=${m.input_tp} dB`);
      } catch { /* fall tilbake til single-pass */ }
    }
    await exec('ffmpeg', ['-y', '-i', gatedRaw, '-af', normFilter, '-c:a', 'aac', '-b:a', '192k', audioMix]);
  } else {
    await exec('ffmpeg', ['-y', '-i', gatedRaw, '-c:a', 'aac', '-b:a', '192k', audioMix]);
  }

  // ---- Komponer: transparent (alfa) ELLER over en bakgrunn ----
  // --bg-color <hex> legger en flat farge bak; --bg-image <fil> legger et bilde
  // bak (skalert til å dekke). Uten dem: bevar alfa → ProRes 4444.
  const bgColor = rest.includes('--bg-color') ? val('--bg-color', '') : '';
  const bgImage = rest.includes('--bg-image') ? val('--bg-image', '') : '';
  const compositeBg = !!(bgColor || bgImage);

  const totalDur = result.dur1 + result.dur2;
  const fadeOutStart = Math.max(0, totalDur - fadeDur).toFixed(2);
  const fadeFilter = fadeDur > 0
    ? `,fade=t=in:st=0:d=${fadeDur}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeDur}:alpha=1`
    : '';

  if (compositeBg) {
    // Flat over bakgrunn → vanlig opaque MP4 (mindre fil, deler-vennlig).
    console.log(`[pro] komponer over bakgrunn (${bgImage ? `bilde: ${bgImage}` : `farge: ${bgColor}`}) → MP4…`);
    const inputs = bgImage
      ? ['-loop', '1', '-i', bgImage, '-c:v', 'libvpx', '-i', webmOut]
      : ['-f', 'lavfi', '-i', `color=c=${bgColor}:s=${result.width}x${result.height}:d=${totalDur}`, '-c:v', 'libvpx', '-i', webmOut];
    await exec('ffmpeg', [
      '-y', ...inputs, '-i', audioMix,
      '-filter_complex',
        `[0:v]scale=${result.width}:${result.height}:force_original_aspect_ratio=increase,crop=${result.width}:${result.height}[bg];` +
        `[bg][1:v]overlay=(W-w)/2:(H-h)/2:format=auto${fadeFilter ? ',' + fadeFilter.slice(1) : ''}[v]`,
      '-map', '[v]', '-map', '2:a:0',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
      finalOut,
    ]);
  } else {
    // Bevar alfa → ProRes 4444 .mov.
    console.log('[pro] transkoder til ProRes 4444 (alfa) + fade + lyd…');
    await exec('ffmpeg', [
      '-y',
      '-c:v', 'libvpx', '-i', webmOut, // vp8/alfa-dekoder
      '-i', audioMix,
      '-filter_complex', `[0:v]null${fadeFilter}[v]`,
      '-map', '[v]', '-map', '1:a:0',
      '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
      '-c:a', 'pcm_s16le',
      '-shortest', finalOut,
    ]);
  }

  // ---- Valgfri Post Agent-polish (highpass/de-ess/voice-boost/LUFS) på lyden ----
  // Kjøres på en mp4-kopi (apply_audio_polish forventer video+lyd-container),
  // og lyden mappes tilbake. For ProRes-leveransen er gate+two-pass nok; polish
  // er ekstra "studio"-finish hvis ønsket.
  if (polish) {
    console.log('[pro] Post Agent apply_audio_polish (ekstra studio-finish på lyd)…');
    const polishScript = join(ROOT, 'apps', 'resolve-script-manager', 'python', 'scripts', 'audio', 'apply_audio_polish.py');
    // Lag en midlertidig mp4 (h264 + lyd) for polish, hent polert lyd ut, mux inn i .mov.
    const tmpForPolish = join(workDir, '_pp_forpolish.mp4');
    const tmpPolished = join(workDir, '_pp_polished.mp4');
    await exec('ffmpeg', ['-y', '-c:v', 'libvpx', '-i', webmOut, '-i', audioMix,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', tmpForPolish]);
    try {
      const params = { inputPath: tmpForPolish, outputPath: tmpPolished, overallLufsTarget: -14.0,
        perChapter: { main: { duckingDb: -6.0, deEssLevel: 'soft', highPassHz: 80, voiceBoostDb: 2.0, musicVolume: 0.7, ambientVolume: 0.65 } } };
      await exec('python3', [polishScript, `--params=${JSON.stringify(params)}`]);
      // Erstatt lyden i .mov med den polerte lyden.
      const polishedMov = finalOut.replace(/\.mov$/, '.polished.mov');
      await exec('ffmpeg', ['-y', '-i', finalOut, '-i', tmpPolished,
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'pcm_s16le', '-shortest', polishedMov]);
      await rm(finalOut, { force: true });
      await exec('ffmpeg', ['-y', '-i', polishedMov, '-c', 'copy', finalOut]);
      await rm(polishedMov, { force: true });
      console.log('[pro]   polish anvendt.');
    } catch (e: any) {
      console.warn('[pro] polish feilet — beholder gate+two-pass-lyd.', (e?.stderr ?? e?.message ?? '').toString().slice(-300));
    }
    await Promise.all([rm(tmpForPolish, { force: true }), rm(tmpPolished, { force: true })]);
  }

  await Promise.all([
    rm(h1, { force: true }), rm(h2, { force: true }), rm(webmOut, { force: true }),
    rm(audioMix, { force: true }), rm(gatedRaw, { force: true }),
  ]);

  console.log(`\n[pro] ✅ ferdig → ${finalOut}  (ProRes 4444 alfa, ${totalDur.toFixed(0)}s)`);
}

main().catch((err) => { console.error('[pro] FEIL:', err?.stack ?? err); process.exit(1); });

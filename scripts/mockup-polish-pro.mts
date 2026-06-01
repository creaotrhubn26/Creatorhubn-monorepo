/**
 * mockup-polish-pro.mts — transparent/polert mockup-video med ren lyd,
 * auto-zoom og bakgrunnsmusikk. Config-fil-drevet så Tauri/Post Agent kan
 * sende én MockupConfig + klipp + output.
 *
 * To kjøremåter:
 *   A) Config-fil (det Tauri-broen bruker):
 *        tsx scripts/mockup-polish-pro.mts --config <fil.json>
 *      hvor fil.json = { clips: string[], output: string, config: MockupConfig,
 *                        music?: string }
 *   B) Direkte CLI (rask testing):
 *        tsx scripts/mockup-polish-pro.mts <klipp1> <klipp2> [--out f] [--bg-color hex]
 *          [--music fil] [--duck -12] [--auto-zoom] [--no-gate] [--no-loudness] ...
 *
 * Fremdrift skrives som newline-delimited JSON til stdout
 * ({type:'progress'|'log'|'result'|'error'}) slik at Rust-broen (spawn_python-
 * mønster) kan streame det videre til UI-et.
 *
 * Bevegelsesanalysen for auto-zoom skjer i Chromium (frame-diff); selve matten
 * (glatting/keyframes) ligger i frontend .../mockup-video/autoZoom.ts.
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

// ── Strukturert fremdrift til stdout (Rust-broen parser dette) ──
let stepN = 0;
function emit(type: string, payload: Record<string, unknown>) {
  process.stdout.write(JSON.stringify({ type, ts: Date.now(), ...payload }) + '\n');
}
function progress(label: string, pct?: number) { emit('progress', { step: ++stepN, label, percent: pct ?? null }); }
function logLine(message: string) { emit('log', { message }); }

// ── Config-typer (speiler frontend mockupConfig.ts) ──
interface MockupConfig {
  visual: { device: string; fit: string; background: string; shadow: boolean; statusBarCrop: number; fadeSeconds: number; autoZoom?: boolean };
  audio: { enabled: boolean; noiseGate: boolean; noiseGateThreshold: number; polish: boolean; loudnessNormalize: boolean; loudnessTarget: number };
  music: { enabled: boolean; source: string | null; volume: number; ducking: boolean; duckDb: number };
  export: { format: 'mp4' | 'prores4444'; pixelRatio: number; frameRate: number };
}
interface JobSpec { clips: string[]; output: string; config: MockupConfig; music?: string }

const BG_PRESETS: Record<string, { from?: string; to?: string; solid?: boolean; transparent?: boolean }> = {
  transparent: { transparent: true },
  midnight: { from: '#1e293b', to: '#0b1120' },
  brand: { from: '#312e81', to: '#0b1120' },
  sunset: { from: '#7c2d12', to: '#1e1b4b' },
  ocean: { from: '#0e7490', to: '#0b1120' },
  plum: { from: '#a030c0', to: '#0a0518' },
  light: { from: '#f1f5f9', to: '#cbd5e1' },
  black: { from: '#000000', solid: true },
};

function defaultConfig(): MockupConfig {
  return {
    visual: { device: 'iphone', fit: 'cover', background: 'transparent', shadow: false, statusBarCrop: 0.045, fadeSeconds: 0.5, autoZoom: false },
    audio: { enabled: true, noiseGate: true, noiseGateThreshold: 0.02, polish: true, loudnessNormalize: true, loudnessTarget: -14 },
    music: { enabled: false, source: null, volume: 0.5, ducking: true, duckDb: -12 },
    export: { format: 'prores4444', pixelRatio: 5, frameRate: 30 },
  };
}

const ffmpegBin = process.env.RESOLVE_SCRIPT_MANAGER_FFMPEG || 'ffmpeg';
async function ffmpeg(args: string[]) { return exec(ffmpegBin, args); }

async function bundle(): Promise<string> {
  const entry = `
    import { renderMockupFrame } from './renderMockupFrame';
    import { getDeviceGeometry } from './deviceGeometry';
    import { buildZoomTrack, zoomAt, zoomToCrop } from './autoZoom';
    (window as any).MV = { renderMockupFrame, getDeviceGeometry, buildZoomTrack, zoomAt, zoomToCrop };
  `;
  const r = await esbuild.build({
    stdin: { contents: entry, resolveDir: MODULE_DIR, loader: 'ts' },
    bundle: true, format: 'iife', platform: 'browser', target: 'es2020', write: false,
  });
  return r.outputFiles[0].text;
}

async function transcodeForBrowser(input: string, output: string): Promise<void> {
  await ffmpeg(['-y', '-i', input, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', output]);
}

/** Les jobb fra --config-fil ELLER bygg fra CLI-flagg. */
async function resolveJob(argv: string[]): Promise<JobSpec> {
  const cfgIdx = argv.indexOf('--config');
  if (cfgIdx >= 0 && argv[cfgIdx + 1]) {
    const raw = await readFile(argv[cfgIdx + 1], 'utf8');
    const job = JSON.parse(raw) as JobSpec;
    if (!job.clips?.length) throw new Error('config.clips er tom');
    if (!job.output) throw new Error('config.output mangler');
    job.config = { ...defaultConfig(), ...job.config };
    return job;
  }
  // CLI-modus: positional klipp + flagg.
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && argv[i - 1] !== '--auto-zoom' && argv[i - 1] !== '--shadow'));
  const clips = argv.filter((a) => !a.startsWith('--') && /\.(mp4|mov|m4v|webm)$/i.test(a));
  const flag = (n: string) => argv.includes(n);
  const val = (n: string, d: string) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  if (clips.length < 1) throw new Error('Trenger minst ett klipp, eller bruk --config <fil.json>');

  const cfg = defaultConfig();
  cfg.visual.shadow = flag('--shadow');
  cfg.visual.statusBarCrop = Number(val('--status-crop', '0.045'));
  cfg.visual.fadeSeconds = Number(val('--fade', '0.5'));
  cfg.visual.autoZoom = flag('--auto-zoom');
  cfg.visual.background = rest_bg(argv);
  cfg.audio.noiseGate = !flag('--no-gate');
  cfg.audio.noiseGateThreshold = Number(val('--gate-threshold', '0.02'));
  cfg.audio.polish = !flag('--no-polish');
  cfg.audio.loudnessNormalize = !flag('--no-loudness');
  cfg.audio.loudnessTarget = Number(val('--loudness', '-14'));
  const music = flag('--music') ? val('--music', '') : undefined;
  if (music) { cfg.music.enabled = true; cfg.music.volume = Number(val('--music-volume', '0.5')); cfg.music.duckDb = Number(val('--duck', '-12')); cfg.music.ducking = !flag('--no-duck'); }
  // bg-color/-image overstyrer preset → komposittert MP4.
  cfg.export.format = (val('--bg-color', '') || val('--bg-image', '')) ? 'mp4' : (cfg.visual.background === 'transparent' ? 'prores4444' : 'mp4');
  const out = val('--out', cfg.export.format === 'prores4444' ? 'mockup-polished.mov' : 'mockup-polished.mp4');
  const job: JobSpec = { clips, output: out, config: cfg, music };
  (job as any)._bgColor = val('--bg-color', '');
  (job as any)._bgImage = val('--bg-image', '');
  return job;
}
function rest_bg(argv: string[]): string {
  const i = argv.indexOf('--bg'); return i >= 0 && argv[i + 1] ? argv[i + 1] : 'transparent';
}

async function main() {
  const argv = process.argv.slice(2);
  const job = await resolveJob(argv);
  const cfg = job.config;
  const v = cfg.visual;
  progress(`config: device=${v.device} bg=${v.background} autoZoom=${v.autoZoom} ` +
    `gate=${cfg.audio.noiseGate} loudness=${cfg.audio.loudnessNormalize} music=${cfg.music.enabled} format=${cfg.export.format}`);

  const workDir = join(ROOT, 'out-videos');
  await mkdir(workDir, { recursive: true });
  const webmOut = join(workDir, '_pp_alpha.webm');
  const audioMix = join(workDir, '_pp_audio.m4a');
  const gatedRaw = join(workDir, '_pp_gated.m4a');
  const finalOut = job.output.includes('/') ? job.output : join(workDir, job.output);

  // Transparent-render hvis preset=transparent ELLER vi skal komponere bakgrunn selv.
  const preset = BG_PRESETS[v.background] ?? BG_PRESETS.transparent;
  const bgColor = (job as any)._bgColor || '';
  const bgImage = (job as any)._bgImage || '';
  const compositeBg = !!(bgColor || bgImage);
  const renderTransparent = preset.transparent || compositeBg;

  // ── 1) Transkod klipp for nettleseren ──
  progress('transkoder klipp til H.264…', 5);
  const tmpClips = job.clips.map((_, i) => join(workDir, `_pp_clip${i}.mp4`));
  await Promise.all(job.clips.map((c, i) => transcodeForBrowser(c, tmpClips[i])));
  const dataUrls = await Promise.all(tmpClips.map(async (p) => `data:video/mp4;base64,${(await readFile(p)).toString('base64')}`));

  // ── 2) Render i Chromium (transparent eller med bakgrunn), evt. auto-zoom ──
  progress('tegner + tar opp i Chromium…', 15);
  const code = await bundle();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[browser:${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[browser:pageerror] ${e.message}`));
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: 'globalThis.__name = globalThis.__name || function (f){return f;};' });

  // Render-opts: transparent her; bakgrunn legges på i ffmpeg-steget for presets,
  // eller direkte hvis ikke-transparent preset uten egen composite.
  const bgForRender = renderTransparent
    ? { kind: 'none' }
    : preset.solid
      ? { kind: 'solid', from: preset.from }
      : { kind: 'gradient', from: preset.from, to: preset.to };
  const padForRender = renderTransparent ? 0 : 0.08;

  await page.evaluate(`window.__JOB = ${JSON.stringify({
    variant: v.device, fit: v.fit, pixelRatio: cfg.export.pixelRatio, frameRate: cfg.export.frameRate,
    background: bgForRender, padding: padForRender, shadow: v.shadow && !renderTransparent,
    statusCrop: v.statusBarCrop, autoZoom: !!v.autoZoom,
  })};`);
  await page.addScriptTag({ content: code });

  const downloadPromise = page.waitForEvent('download', { timeout: 600_000 });
  const result = await page.evaluate(async (urls) => {
    const MV = (window as any).MV;
    const J = (window as any).__JOB;
    const geom = MV.getDeviceGeometry(J.variant, J.pixelRatio);
    const hasBg = J.background.kind !== 'none';
    const pad = J.padding;
    const width = Math.round(geom.width / (1 - pad * 2));
    const height = Math.round(geom.height / (1 - pad * 2));

    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true })!;

    function loadVideo(src: string): Promise<HTMLVideoElement> {
      return new Promise((resolve, reject) => {
        const vid = document.createElement('video');
        vid.src = src; vid.muted = true; (vid as any).playsInline = true;
        vid.onloadeddata = () => resolve(vid);
        vid.onerror = () => reject(new Error('kunne ikke laste video'));
      });
    }
    const vids: HTMLVideoElement[] = [];
    for (const u of urls) vids.push(await loadVideo(u));

    // ── Auto-zoom: forhåndsanalyser bevegelse per klipp (frame-diff) ──
    const zoomTracks: any[] = [];
    if (J.autoZoom) {
      const dw = 64, dh = 128; // nedskalert analyse-oppløsning
      const ac = document.createElement('canvas'); ac.width = dw; ac.height = dh;
      const actx = ac.getContext('2d', { willReadFrequently: true })!;
      for (const vid of vids) {
        const samples: any[] = [];
        const dur = vid.duration || 0;
        const step = 1 / 8; // 8 prøver/sek
        let prev: Uint8ClampedArray | null = null;
        for (let t = 0; t < dur; t += step) {
          vid.currentTime = t;
          await new Promise((r) => { vid.onseeked = () => r(null); });
          actx.drawImage(vid, 0, 0, dw, dh);
          const cur = actx.getImageData(0, 0, dw, dh).data;
          if (prev) {
            let sum = 0, wx = 0, wy = 0, wsum = 0;
            for (let i = 0, p = 0; i < cur.length; i += 4, p++) {
              const d = Math.abs(cur[i] - prev[i]) + Math.abs(cur[i + 1] - prev[i + 1]) + Math.abs(cur[i + 2] - prev[i + 2]);
              if (d > 30) { // terskel mot kompresjons-støy
                sum += d;
                const x = (p % dw) / dw, y = Math.floor(p / dw) / dh;
                wx += x * d; wy += y * d; wsum += d;
              }
            }
            samples.push({ t, energy: sum, cx: wsum ? wx / wsum : 0.5, cy: wsum ? wy / wsum : 0.5 });
          }
          prev = cur.slice();
        }
        zoomTracks.push(MV.buildZoomTrack(samples, { maxScale: 1.35, smoothing: 0.12 }));
      }
    }

    const stream = (canvas as any).captureStream(J.frameRate) as MediaStream;
    // VP8 bevarer alfa; for ikke-transparent kan vi også bruke vp8 (enkelt).
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 12_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    const recDone = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })); });

    let current = vids[0], curIdx = 0, raf = 0;
    const draw = () => {
      const opts: any = {
        variant: J.variant, fit: J.fit, background: J.background, padding: J.padding,
        shadow: J.shadow, sourceInset: J.statusCrop > 0 ? { top: J.statusCrop } : undefined,
      };
      if (J.autoZoom && zoomTracks[curIdx]) {
        const z = MV.zoomAt(zoomTracks[curIdx], current.currentTime);
        opts.zoom = z; // renderMockupFrame leser zoom hvis satt
      }
      MV.renderMockupFrame(ctx, current, width, height, opts);
      raf = requestAnimationFrame(draw);
    };
    const playClip = (vid: HTMLVideoElement, idx: number) => new Promise<void>((resolve) => {
      current = vid; curIdx = idx; vid.currentTime = 0; vid.onended = () => resolve(); vid.play();
    });

    rec.start(250);
    raf = requestAnimationFrame(draw);
    let totalDur = 0;
    for (let i = 0; i < vids.length; i++) { await playClip(vids[i], i); totalDur += vids[i].duration; }
    cancelAnimationFrame(raf);
    rec.stop();

    const blob = await recDone;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pp_alpha.webm';
    document.body.appendChild(a); a.click();
    return { size: blob.size, width, height, totalDur };
  }, dataUrls);

  const download = await downloadPromise;
  await download.saveAs(webmOut);
  await browser.close();
  if (!result || result.size === 0) { emit('error', { message: 'tom blob' }); logs.forEach((l) => process.stderr.write(l + '\n')); process.exit(1); }
  logLine(`render: ${(result.size / 1e6).toFixed(1)}MB ${result.width}x${result.height} ${result.totalDur.toFixed(1)}s`);

  // ── 3) Lyd: konkatener → (gate) → (musikk+ducking) → (two-pass loudness) ──
  if (cfg.audio.enabled) {
    progress('bygger lydspor…', 55);
    const n = job.clips.length;
    const inputs = job.clips.flatMap((c) => ['-i', c]);
    const norm = job.clips.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]`).join(';');
    const concatIn = job.clips.map((_, i) => `[a${i}]`).join('');
    const gateChain = cfg.audio.noiseGate
      ? `;[c]agate=threshold=${cfg.audio.noiseGateThreshold}:ratio=9:attack=10:release=250:range=0[out]`
      : '';
    await ffmpeg(['-y', ...inputs, '-filter_complex',
      `${norm};${concatIn}concat=n=${n}:v=0:a=1${cfg.audio.noiseGate ? '[c]' : '[out]'}${gateChain}`,
      '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', gatedRaw]);

    // Musikk + ducking
    const musicFile = cfg.music.enabled ? (job.music || cfg.music.source || '') : '';
    if (musicFile) {
      progress(`blander musikk (ducking ${cfg.music.ducking ? 'på' : 'av'})…`, 65);
      const ducked = join(workDir, '_pp_ducked.m4a');
      const ratio = Math.max(2, Math.min(20, Math.abs(cfg.music.duckDb))).toFixed(0);
      const musChain = cfg.music.ducking
        ? `[0:a]asplit=2[sc][voice];[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${cfg.music.volume}[mus];` +
          `[mus][sc]sidechaincompress=threshold=0.03:ratio=${ratio}:attack=20:release=400:makeup=1[ducked];` +
          `[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`
        : `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${cfg.music.volume}[mus];` +
          `[0:a][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`;
      await ffmpeg(['-y', '-i', gatedRaw, '-stream_loop', '-1', '-i', musicFile,
        '-filter_complex', musChain, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', ducked]);
      await rm(gatedRaw, { force: true });
      await ffmpeg(['-y', '-i', ducked, '-c', 'copy', gatedRaw]);
      await rm(ducked, { force: true });
    }

    if (cfg.audio.loudnessNormalize) {
      progress(`two-pass loudnorm (${cfg.audio.loudnessTarget} LUFS)…`, 72);
      const measure = await ffmpeg(['-hide_banner', '-i', gatedRaw, '-af',
        `loudnorm=I=${cfg.audio.loudnessTarget}:LRA=11:TP=-1.5:print_format=json`, '-f', 'null', '-'])
        .then((r) => r.stderr).catch((e: any) => e.stderr ?? '');
      const jm = measure.match(/\{[\s\S]*?\}/);
      let nf = `loudnorm=I=${cfg.audio.loudnessTarget}:LRA=11:TP=-1.5`;
      if (jm) { try { const m = JSON.parse(jm[0]);
        nf = `loudnorm=I=${cfg.audio.loudnessTarget}:LRA=11:TP=-1.5:measured_I=${m.input_i}:measured_LRA=${m.input_lra}:measured_TP=${m.input_tp}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
        logLine(`målt: I=${m.input_i} LUFS TP=${m.input_tp} dB`);
      } catch {} }
      await ffmpeg(['-y', '-i', gatedRaw, '-af', nf, '-c:a', 'aac', '-b:a', '192k', audioMix]);
    } else {
      await ffmpeg(['-y', '-i', gatedRaw, '-c:a', 'aac', '-b:a', '192k', audioMix]);
    }
  }

  // ── 4) Komposisjon: alfa (ProRes) eller over bakgrunn (MP4) + fade ──
  const fadeDur = v.fadeSeconds;
  const fadeOutStart = Math.max(0, result.totalDur - fadeDur).toFixed(2);
  const alphaFade = fadeDur > 0 ? `,fade=t=in:st=0:d=${fadeDur}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeDur}:alpha=1` : '';
  const plainFade = fadeDur > 0 ? `,fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${fadeOutStart}:d=${fadeDur}` : '';
  const audioArgs = cfg.audio.enabled ? ['-i', audioMix] : [];
  // I de ikke-composite grenene er lyd alltid input [1] (webm=[0], audio=[1]).
  // Composite-grenen har sin egen map ([2]) siden bakgrunn=[0], webm=[1].
  const audioMap = cfg.audio.enabled ? ['-map', '1:a:0'] : [];

  if (compositeBg) {
    progress('komponer over bakgrunn → MP4…', 85);
    const bgInput = bgImage
      ? ['-loop', '1', '-i', bgImage]
      : ['-f', 'lavfi', '-i', `color=c=${bgColor}:s=${result.width}x${result.height}:d=${result.totalDur}`];
    const aArgs = cfg.audio.enabled ? ['-i', audioMix] : [];
    await ffmpeg(['-y', ...bgInput, '-c:v', 'libvpx', '-i', webmOut, ...aArgs,
      '-filter_complex',
        `[0:v]scale=${result.width}:${result.height}:force_original_aspect_ratio=increase,crop=${result.width}:${result.height}[bg];` +
        `[bg][1:v]overlay=(W-w)/2:(H-h)/2:format=auto${plainFade ? ',' + plainFade.slice(1) : ''}[v]`,
      '-map', '[v]', ...(cfg.audio.enabled ? ['-map', '2:a:0'] : []),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', finalOut]);
  } else if (cfg.export.format === 'prores4444') {
    progress('ProRes 4444 (alfa) + fade…', 85);
    await ffmpeg(['-y', '-c:v', 'libvpx', '-i', webmOut, ...audioArgs,
      '-filter_complex', `[0:v]null${alphaFade}[v]`, '-map', '[v]', ...audioMap,
      '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
      '-c:a', 'pcm_s16le', '-shortest', finalOut]);
  } else {
    // Ikke-transparent preset rendret med bakgrunn allerede → bare fade + lyd → MP4.
    progress('MP4 + fade…', 85);
    await ffmpeg(['-y', '-c:v', 'libvpx', '-i', webmOut, ...audioArgs,
      '-filter_complex', `[0:v]null${plainFade}[v]`, '-map', '[v]', ...audioMap,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', finalOut]);
  }

  // ── 5) Valgfri Post Agent apply_audio_polish (studio-finish) ──
  if (cfg.audio.enabled && cfg.audio.polish) {
    progress('Post Agent apply_audio_polish…', 93);
    const polishScript = join(ROOT, 'apps', 'resolve-script-manager', 'python', 'scripts', 'audio', 'apply_audio_polish.py');
    const isMov = finalOut.endsWith('.mov');
    const tmpForPolish = join(workDir, '_pp_forpolish.mp4');
    const tmpPolished = join(workDir, '_pp_polished.mp4');
    try {
      // apply_audio_polish vil ha video+lyd → lag en h264-kopi, polish, hent lyd ut.
      await ffmpeg(['-y', '-i', finalOut, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', tmpForPolish]);
      const params = { inputPath: tmpForPolish, outputPath: tmpPolished, overallLufsTarget: cfg.audio.loudnessTarget,
        perChapter: { main: { duckingDb: -6.0, deEssLevel: 'soft', highPassHz: 80, voiceBoostDb: 2.0, musicVolume: 0.7, ambientVolume: 0.65 } } };
      await exec('python3', [polishScript, `--params=${JSON.stringify(params)}`]);
      // Bytt lyden i sluttfila med den polerte (bevar video-codec/alfa).
      const merged = finalOut.replace(/\.(mov|mp4)$/, '.__polished$&');
      await ffmpeg(['-y', '-i', finalOut, '-i', tmpPolished, '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', isMov ? 'pcm_s16le' : 'aac', '-shortest', merged]);
      await rm(finalOut, { force: true });
      await ffmpeg(['-y', '-i', merged, '-c', 'copy', finalOut]);
      await rm(merged, { force: true });
      logLine('polish anvendt');
    } catch (e: any) {
      logLine('polish hoppet over: ' + (e?.stderr ?? e?.message ?? '').toString().slice(-200));
    }
    await Promise.all([rm(tmpForPolish, { force: true }), rm(tmpPolished, { force: true })]);
  }

  // Rydd mellomfiler.
  await Promise.all([
    ...tmpClips.map((p) => rm(p, { force: true })),
    rm(webmOut, { force: true }), rm(audioMix, { force: true }), rm(gatedRaw, { force: true }),
  ]);

  progress('ferdig', 100);
  emit('result', { outputPath: finalOut, durationSec: Math.round(result.totalDur), format: cfg.export.format });
  process.stderr.write(`\n[pro] ✅ ferdig → ${finalOut}\n`);
}

main().catch((err) => { emit('error', { message: (err?.stack ?? err)?.toString() }); process.exit(1); });

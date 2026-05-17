/**
 * generate-synthetic-sfx.ts
 *
 * Genererer procedurale placeholder-SFX-samples som starter-bibliotek
 * for CLAP-pipelinen. Disse er IKKE ment som ekte SFX — de er
 * stand-ins for å verifisere at ende-til-ende-flyten virker:
 *
 *   1. Skriver én WAV-fil per kategori til data/synthetic-samples/
 *   2. Skriver et auto-generert manifest data/sfx-manifest.json
 *
 * Etter kjøring, kjør:
 *   npm run sfx:build
 * for å embedde dem og bygge sfx-library.json.
 *
 * I produksjon erstatter du både samples-mappa og manifestet med
 * ekte CC0-/Pixabay-samples — strukturen er den samme.
 *
 * Synthese: enkel PCM-mat. Alt blir 1 sekund mono 48kHz.
 */

import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 48000;
const DURATION_SEC = 1.0;
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);

// ============================================================================
// Synthese-primitiver
// ============================================================================

function sine(freq: number, durSec: number, amp = 1): Float32Array {
  const n = Math.floor(SAMPLE_RATE * durSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return out;
}

function noise(durSec: number, amp = 1): Float32Array {
  const n = Math.floor(SAMPLE_RATE * durSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = amp * (Math.random() * 2 - 1);
  }
  return out;
}

function silence(durSec: number): Float32Array {
  return new Float32Array(Math.floor(SAMPLE_RATE * durSec));
}

/** Enkel one-pole low-pass. cutoffHz i Hz. */
function lowpass(input: Float32Array, cutoffHz: number): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(input.length);
  let last = 0;
  for (let i = 0; i < input.length; i += 1) {
    last = last + alpha * (input[i] - last);
    out[i] = last;
  }
  return out;
}

function highpass(input: Float32Array, cutoffHz: number): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SAMPLE_RATE;
  const alpha = rc / (rc + dt);
  const out = new Float32Array(input.length);
  let lastOut = 0;
  let lastIn = 0;
  for (let i = 0; i < input.length; i += 1) {
    lastOut = alpha * (lastOut + input[i] - lastIn);
    lastIn = input[i];
    out[i] = lastOut;
  }
  return out;
}

/** Eksponentiell ADSR (kun decay for transient-effekter). */
function decay(input: Float32Array, halfLifeSec: number): Float32Array {
  const halfLifeSamples = halfLifeSec * SAMPLE_RATE;
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const factor = Math.pow(0.5, i / halfLifeSamples);
    out[i] = input[i] * factor;
  }
  return out;
}

/** Mix flere arrays (samme lengde). */
function mix(...arrays: Float32Array[]): Float32Array {
  if (arrays.length === 0) return new Float32Array(0);
  const n = Math.max(...arrays.map((a) => a.length));
  const out = new Float32Array(n);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i += 1) {
      out[i] += arr[i];
    }
  }
  return out;
}

/** Padd til en bestemt lengde med stillhet (eller trunker). */
function fitToLength(input: Float32Array, targetLength: number): Float32Array {
  if (input.length === targetLength) return input;
  const out = new Float32Array(targetLength);
  out.set(input.subarray(0, Math.min(input.length, targetLength)));
  return out;
}

/** Normaliser så toppen er på targetPeak (default 0.85 for å unngå klipping). */
function normalize(input: Float32Array, targetPeak = 0.85): Float32Array {
  let peak = 0;
  for (let i = 0; i < input.length; i += 1) {
    if (Math.abs(input[i]) > peak) peak = Math.abs(input[i]);
  }
  if (peak === 0) return input;
  const gain = targetPeak / peak;
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    out[i] = input[i] * gain;
  }
  return out;
}

// ============================================================================
// WAV-encoding (PCM 16-bit mono)
// ============================================================================

function encodeWav(samples: Float32Array): Buffer {
  const numFrames = samples.length;
  const buffer = Buffer.alloc(44 + numFrames * 2);
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numFrames * 2, 4);
  buffer.write('WAVE', 8);
  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM
  buffer.writeUInt16LE(1, 20); // PCM-format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits/sample
  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numFrames * 2, 40);
  // Samples
  for (let i = 0; i < numFrames; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const intVal = Math.floor(clamped * 32767);
    buffer.writeInt16LE(intVal, 44 + i * 2);
  }
  return buffer;
}

// ============================================================================
// Per-kategori "recipes"
// ============================================================================

interface Recipe {
  categoryId: string;
  title: string;
  build: () => Float32Array;
}

const RECIPES: Recipe[] = [
  // Event-lag — transienter
  { categoryId: 'door-slam', title: 'Synthetic door slam', build: () => {
    const lowImpact = decay(noise(0.4, 1.0), 0.05);
    return normalize(fitToLength(lowpass(lowImpact, 200), NUM_SAMPLES));
  }},
  { categoryId: 'door-open', title: 'Synthetic door open', build: () => {
    const creak = decay(noise(0.6, 0.5), 0.2);
    return normalize(fitToLength(highpass(lowpass(creak, 1500), 300), NUM_SAMPLES));
  }},
  { categoryId: 'door-close', title: 'Synthetic door close', build: () => {
    const thud = decay(noise(0.3, 0.8), 0.1);
    return normalize(fitToLength(lowpass(thud, 400), NUM_SAMPLES));
  }},
  { categoryId: 'knock', title: 'Synthetic knock', build: () => {
    const knock1 = decay(noise(0.06, 1.0), 0.02);
    const knock2 = decay(noise(0.06, 1.0), 0.02);
    const out = new Float32Array(NUM_SAMPLES);
    out.set(knock1.subarray(0, knock1.length), 0);
    out.set(knock2.subarray(0, knock2.length), Math.floor(SAMPLE_RATE * 0.2));
    return normalize(lowpass(out, 800));
  }},
  { categoryId: 'footsteps-walking', title: 'Synthetic footsteps', build: () => {
    const out = new Float32Array(NUM_SAMPLES);
    for (let step = 0; step < 4; step += 1) {
      const click = decay(noise(0.06, 0.6), 0.02);
      const offset = Math.floor(SAMPLE_RATE * 0.25 * step);
      for (let i = 0; i < click.length && offset + i < NUM_SAMPLES; i += 1) {
        out[offset + i] += click[i];
      }
    }
    return normalize(lowpass(out, 1200));
  }},
  { categoryId: 'footsteps-running', title: 'Synthetic running footsteps', build: () => {
    const out = new Float32Array(NUM_SAMPLES);
    for (let step = 0; step < 8; step += 1) {
      const click = decay(noise(0.04, 0.7), 0.015);
      const offset = Math.floor(SAMPLE_RATE * 0.12 * step);
      for (let i = 0; i < click.length && offset + i < NUM_SAMPLES; i += 1) {
        out[offset + i] += click[i];
      }
    }
    return normalize(lowpass(out, 1500));
  }},
  { categoryId: 'gunshot', title: 'Synthetic gunshot', build: () => {
    const burst = decay(noise(0.5, 1.0), 0.04);
    return normalize(fitToLength(burst, NUM_SAMPLES));
  }},
  { categoryId: 'explosion', title: 'Synthetic explosion', build: () => {
    const low = decay(lowpass(noise(0.8, 1.0), 150), 0.25);
    const burst = decay(noise(0.3, 0.8), 0.06);
    return normalize(fitToLength(mix(low, burst), NUM_SAMPLES));
  }},
  { categoryId: 'punch', title: 'Synthetic punch impact', build: () => {
    const impact = decay(noise(0.2, 1.0), 0.03);
    return normalize(fitToLength(lowpass(impact, 600), NUM_SAMPLES));
  }},
  { categoryId: 'glass-break', title: 'Synthetic glass break', build: () => {
    const shatter = decay(noise(0.6, 1.0), 0.15);
    return normalize(fitToLength(highpass(shatter, 2000), NUM_SAMPLES));
  }},
  { categoryId: 'water-splash', title: 'Synthetic splash', build: () => {
    const splash = decay(noise(0.4, 0.9), 0.1);
    return normalize(fitToLength(highpass(lowpass(splash, 3000), 200), NUM_SAMPLES));
  }},
  { categoryId: 'phone-ring', title: 'Synthetic phone ring', build: () => {
    const tone1 = sine(440, 0.4, 0.5);
    const tone2 = sine(480, 0.4, 0.5);
    const ring = mix(tone1, tone2);
    const fullRing = new Float32Array(NUM_SAMPLES);
    fullRing.set(ring, 0);
    return normalize(fullRing);
  }},
  { categoryId: 'beep', title: 'Synthetic beep', build: () => {
    const tone = sine(1000, 0.2, 0.5);
    return normalize(fitToLength(tone, NUM_SAMPLES));
  }},
  { categoryId: 'click', title: 'Synthetic click', build: () => {
    return normalize(fitToLength(decay(noise(0.03, 1.0), 0.005), NUM_SAMPLES));
  }},
  { categoryId: 'siren', title: 'Synthetic siren', build: () => {
    const out = new Float32Array(NUM_SAMPLES);
    for (let i = 0; i < NUM_SAMPLES; i += 1) {
      const t = i / SAMPLE_RATE;
      const freq = 600 + 200 * Math.sin(2 * Math.PI * 1.5 * t);
      out[i] = 0.6 * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
    }
    return normalize(out);
  }},
  // Ambient-lag — kontinuerlig støy med filtre
  { categoryId: 'rain', title: 'Synthetic rain', build: () => {
    const rain = highpass(noise(DURATION_SEC, 0.6), 1500);
    return normalize(rain);
  }},
  { categoryId: 'wind', title: 'Synthetic wind', build: () => {
    const w = lowpass(noise(DURATION_SEC, 0.7), 600);
    // Modulasjon for å lage gust
    const out = new Float32Array(w.length);
    for (let i = 0; i < w.length; i += 1) {
      const mod = 0.5 + 0.5 * Math.sin((2 * Math.PI * 0.5 * i) / SAMPLE_RATE);
      out[i] = w[i] * mod;
    }
    return normalize(out);
  }},
  { categoryId: 'thunder', title: 'Synthetic thunder', build: () => {
    const rumble = decay(lowpass(noise(DURATION_SEC, 1.0), 100), 0.4);
    return normalize(rumble);
  }},
  { categoryId: 'traffic', title: 'Synthetic traffic ambient', build: () => {
    return normalize(lowpass(noise(DURATION_SEC, 0.5), 500));
  }},
  { categoryId: 'crowd-murmur', title: 'Synthetic crowd murmur', build: () => {
    return normalize(highpass(lowpass(noise(DURATION_SEC, 0.5), 1500), 300));
  }},
  { categoryId: 'water-running', title: 'Synthetic running water', build: () => {
    return normalize(highpass(noise(DURATION_SEC, 0.6), 2000));
  }},
  { categoryId: 'ambient-indoor', title: 'Synthetic indoor ambient', build: () => {
    return normalize(lowpass(noise(DURATION_SEC, 0.2), 400));
  }},
  { categoryId: 'ambient-outdoor', title: 'Synthetic outdoor ambient', build: () => {
    return normalize(lowpass(noise(DURATION_SEC, 0.3), 800));
  }},
  // Music-lag — enkle harmoniske strukturer
  { categoryId: 'music-tense', title: 'Synthetic tense music', build: () => {
    const low = sine(55, DURATION_SEC, 0.4);
    const dissonance = sine(58, DURATION_SEC, 0.3);
    return normalize(mix(low, dissonance));
  }},
  { categoryId: 'music-soft', title: 'Synthetic soft music', build: () => {
    const c = sine(261.63, DURATION_SEC, 0.3);
    const e = sine(329.63, DURATION_SEC, 0.3);
    const g = sine(392.0, DURATION_SEC, 0.3);
    return normalize(mix(c, e, g));
  }},
  { categoryId: 'music-action', title: 'Synthetic action music', build: () => {
    const out = new Float32Array(NUM_SAMPLES);
    for (let beat = 0; beat < 4; beat += 1) {
      const kick = decay(lowpass(noise(0.2, 1.0), 80), 0.05);
      const offset = Math.floor(SAMPLE_RATE * 0.25 * beat);
      for (let i = 0; i < kick.length && offset + i < NUM_SAMPLES; i += 1) {
        out[offset + i] += kick[i];
      }
    }
    return normalize(out);
  }},
];

// ============================================================================
// Main
// ============================================================================

function main() {
  const root = process.cwd();
  const samplesDir = path.join(root, 'data', 'synthetic-samples');
  const manifestPath = path.join(root, 'data', 'sfx-manifest.json');
  fs.mkdirSync(samplesDir, { recursive: true });

  console.log(`[generate-synthetic-sfx] genererer ${RECIPES.length} samples til ${samplesDir}`);

  const manifest = {
    $schema: 'Auto-generert manifest for synthetic starter-samples.',
    comment: 'Disse er PROCEDURALE placeholders for å verifisere CLAP-pipelinen. Bytt ut med ekte CC0/Pixabay-samples i produksjon. Se data/SFX_LIBRARY.md.',
    samples: [] as Array<Record<string, unknown>>,
  };

  for (const recipe of RECIPES) {
    const filename = `${recipe.categoryId}.wav`;
    const filePath = path.join(samplesDir, filename);
    const samples = recipe.build();
    const wavBuffer = encodeWav(samples);
    fs.writeFileSync(filePath, wavBuffer);
    manifest.samples.push({
      id: `synthetic-${recipe.categoryId}`,
      title: recipe.title,
      // url er runtime-URL'en frontend bruker for å spille av.
      url: `/api/sfx/static/${filename}`,
      // sourcePath leses kun av build-sfx-library.ts under embedding;
      // det er hvor selve audio-fila finnes på disk. Skippes ved
      // runtime-validering.
      sourcePath: path.join('data', 'synthetic-samples', filename),
      categoryId: recipe.categoryId,
      license: 'CC0',
      attribution: 'Procedurally generated (synthetic placeholder)',
      durationSec: DURATION_SEC,
      tags: ['synthetic', 'placeholder'],
    });
    console.log(`  ✓ ${recipe.categoryId} (${(wavBuffer.length / 1024).toFixed(1)} KB)`);
  }

  // Atomisk manifest-skriving
  const tmpManifest = `${manifestPath}.tmp`;
  fs.writeFileSync(tmpManifest, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmpManifest, manifestPath);

  console.log(`\n[generate-synthetic-sfx] ferdig: ${RECIPES.length} synthetic samples`);
  console.log(`[generate-synthetic-sfx] manifest skrevet til ${manifestPath}`);
  console.log('\nNeste steg:');
  console.log('  1. npm run sfx:build           # embedder samples via CLAP');
  console.log('  2. Restart backend             # eller POST /api/sfx/library/reload');
  console.log('  3. Test i animatic-spilleren   # ✨-knappen skal nå returnere treff');
  console.log('\nMERK: Disse er placeholder-lyder. Erstatt med ekte CC0/Pixabay-samples for produksjon.');
}

main();

/**
 * mockupBeat.ts — finn tempoet i et lydspor, så zoom-punchen treffer beaten.
 *
 * Beat-punchen i mockupRaster har alltid virket, men den pulser på et BPM-tall
 * som brukeren måtte skrive inn selv. Det krever at du VET tempoet i sporet du
 * nettopp lastet opp — og skriver du 120 på et spor som går i 128, driver
 * punchen ut av synk etter få sekunder. Her regnes tempoet ut av lyden i stedet.
 *
 * Metoden er den enkle standarden: energikonvolutt → onset-styrke → autokorrelasjon.
 * Ingen nye avhengigheter, alt kjører i nettleseren.
 *
 * Analysen (`bpmFromSamples`) er ren og testbar i Node; bare dekodingen trenger
 * Web Audio.
 */

/** Tempoområdet vi leter i. Under 70 og over 180 er sjelden riktig for reels. */
const MIN_BPM = 70;
const MAX_BPM = 180;
/** Ett steg i konvolutten. 10 ms gir ~1 BPM oppløsning i området over. */
const HOP_S = 0.01;

/**
 * Tempo fra rå mono-samples, eller null når lyden ikke har en tydelig puls
 * (tale, romtone, stillhet) — da er et gjettet tall verre enn ingen endring.
 */
export function bpmFromSamples(samples: Float32Array, sampleRate: number): number | null {
  const hop = Math.max(1, Math.round(sampleRate * HOP_S));
  const steg = Math.floor(samples.length / hop);
  if (steg < 128) return null; // under ~1,3 sekund: for kort til å telle beats

  // Energi per steg, og onset-styrke = økningen fra forrige steg. Bare økningen:
  // et slag kjennes på at energien HOPPER, ikke på at den er høy.
  const onset = new Float32Array(steg);
  let forrige = 0;
  for (let i = 0; i < steg; i++) {
    let sum = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) sum += samples[j] * samples[j];
    const e = Math.sqrt(sum / hop);
    onset[i] = Math.max(0, e - forrige);
    forrige = e;
  }

  // Trekk fra snittet, ellers korrelerer alt med alt.
  const snitt = onset.reduce((a, b) => a + b, 0) / steg;
  for (let i = 0; i < steg; i++) onset[i] -= snitt;
  const energi = onset.reduce((a, b) => a + b * b, 0);
  if (energi <= 1e-9) return null; // flat konvolutt = ingen puls å finne

  const lagMin = Math.round(60 / MAX_BPM / HOP_S);
  const lagMax = Math.min(steg - 1, Math.round(60 / MIN_BPM / HOP_S));
  let besteLag = 0, besteScore = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < steg; i++) sum += onset[i] * onset[i + lag];
    const score = sum / (steg - lag); // normaliser: lange lag har færre ledd
    if (score > besteScore) { besteScore = score; besteLag = lag; }
  }
  if (besteLag === 0 || besteScore <= 0) return null;

  return Math.round(60 / (besteLag * HOP_S));
}

/**
 * Dekod et lydspor (data-URL eller blob-URL) og finn tempoet. Returnerer null
 * hvis lyden ikke kan dekodes eller ikke har en tydelig puls — kalleren skal da
 * la BPM-feltet stå som det er.
 */
export async function detectBpm(src: string): Promise<number | null> {
  if (typeof AudioContext === 'undefined') return null;
  const ctx = new AudioContext();
  try {
    const buf = await (await fetch(src)).arrayBuffer();
    const lyd = await ctx.decodeAudioData(buf);
    // Første 30 sekunder holder; resten koster bare tid.
    const n = Math.min(lyd.length, lyd.sampleRate * 30);
    const mono = new Float32Array(n);
    for (let k = 0; k < lyd.numberOfChannels; k++) {
      const kanal = lyd.getChannelData(k);
      for (let i = 0; i < n; i++) mono[i] += kanal[i] / lyd.numberOfChannels;
    }
    return bpmFromSamples(mono, lyd.sampleRate);
  } catch (e) {
    console.error('[mockup-studio] bpm-analyse', e);
    return null;
  } finally {
    void ctx.close();
  }
}

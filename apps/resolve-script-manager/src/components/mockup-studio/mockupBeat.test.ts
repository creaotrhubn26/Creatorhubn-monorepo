/**
 * Tempo-analysen. Fasiten er laget her i testen: et klikkespor med kjent BPM,
 * så «riktig svar» ikke er noe analysen selv har bestemt.
 */

import { describe, expect, it } from 'vitest';

import { bpmFromSamples } from './mockupBeat';

const SR = 8000;

/** Klikkespor: en kort transient hvert slag, stillhet mellom. */
function klikkespor(bpm: number, sekunder = 12, støy = 0): Float32Array {
  const n = SR * sekunder;
  const ut = new Float32Array(n);
  const stegPerSlag = (60 / bpm) * SR;
  for (let slag = 0; slag * stegPerSlag < n; slag++) {
    const start = Math.round(slag * stegPerSlag);
    for (let i = 0; i < SR * 0.02 && start + i < n; i++) {
      ut[start + i] = Math.sin((i / SR) * 900 * 2 * Math.PI) * Math.exp(-i / (SR * 0.006));
    }
  }
  if (støy > 0) for (let i = 0; i < n; i++) ut[i] += (Math.sin(i * 12.9898) * 43758.5453 % 1) * støy;
  return ut;
}

describe('bpmFromSamples', () => {
  it.each([90, 100, 120, 128, 140])('finner %i BPM i et klikkespor', (bpm) => {
    // ±1 BPM: 10 ms steg gir ikke finere oppløsning, og punchen tåler det.
    expect(bpmFromSamples(klikkespor(bpm), SR)).toBeGreaterThanOrEqual(bpm - 1);
    expect(bpmFromSamples(klikkespor(bpm), SR)).toBeLessThanOrEqual(bpm + 1);
  });

  it('tåler støy over klikkene', () => {
    expect(bpmFromSamples(klikkespor(120, 12, 0.05), SR)).toBeGreaterThanOrEqual(119);
    expect(bpmFromSamples(klikkespor(120, 12, 0.05), SR)).toBeLessThanOrEqual(121);
  });

  it('gir null på stillhet i stedet for et gjettet tall', () => {
    expect(bpmFromSamples(new Float32Array(SR * 5), SR)).toBeNull();
  });

  it('gir null på lyd som er for kort til å telle slag', () => {
    expect(bpmFromSamples(klikkespor(120, 0.5), SR)).toBeNull();
  });
});

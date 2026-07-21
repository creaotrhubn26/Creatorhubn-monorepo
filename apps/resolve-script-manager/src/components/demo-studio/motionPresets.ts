/**
 * motionPresets.ts — lagre en Motion-STIL (arketype + format + layout + tempo +
 * tema) som gjenbrukbar hus-stil. Data kommer alltid fra scenen; preset-en er
 * bare stilen. localStorage-basert. Rene funksjoner (localStorage-gated → testbar).
 */
import type { MotionLayoutOpts, StingFormat } from './motionSting.js';
import type { Archetype } from './motionReveal.js';

export interface MotionPreset {
  name: string;
  arch: Archetype;
  format: StingFormat;
  place: MotionLayoutOpts;
  tempo: 'fast' | 'normal' | 'slow';
}

const KEY = 'trrpa.motion.presets';

function store(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function loadPresets(): MotionPreset[] {
  try {
    const raw = store()?.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.name === 'string') : [];
  } catch { return []; }
}

function persist(list: MotionPreset[]): void {
  try { store()?.setItem(KEY, JSON.stringify(list)); } catch { /* trygt no-op */ }
}

/** Lagre (overskriver ved samme navn) → returnerer oppdatert liste. */
export function savePreset(p: MotionPreset): MotionPreset[] {
  const list = loadPresets().filter((x) => x.name !== p.name);
  list.push(p);
  persist(list);
  return list;
}

export function deletePreset(name: string): MotionPreset[] {
  const list = loadPresets().filter((x) => x.name !== name);
  persist(list);
  return list;
}

/**
 * sfxDetector — scanner frame-tekst (description, caption, dialog)
 * og foreslår SFX-events basert på keyword-matching mot
 * SFX_CATEGORIES. Helt pure, ingen lyd lastes her.
 *
 * Output-formatet er en SfxEvent[] som sfxScheduler senere kan
 * bruke til å spille av på riktig tid. Hver event har:
 *   - frameId: hvilket frame eventen tilhører
 *   - categoryId: kategori-nøkkel fra SFX_CATEGORIES
 *   - intensity: hevet/senket basert på modifier-ord
 *   - offsetSec: hvor i frame-tid eventen starter (default 0 = ved frame-start)
 *   - matchedKeyword: ordet som trigget — nyttig for forklarende UI
 *
 * Vi unngår duplikater per frame: samme kategori detekteres bare én
 * gang per frame, selv om keyword forekommer flere ganger.
 */

import {
  SFX_CATEGORIES,
  INTENSITY_BOOSTERS,
  INTENSITY_DAMPENERS,
  type SfxCategory,
  type SfxIntensity,
  type SfxLayer,
} from './sfxCategories';

export interface SfxEvent {
  /** Stabil id for senere referanse — kombineres av frameId+categoryId. */
  id: string;
  frameId: string;
  categoryId: string;
  category: SfxCategory;
  intensity: SfxIntensity;
  /** Sekunder inn i frame der eventen starter. */
  offsetSec: number;
  /** Ord som trigget matchingen. */
  matchedKeyword: string;
  layer: SfxLayer;
}

export interface DetectableFrame {
  id: string;
  description?: string;
  caption?: string;
  shotType?: string;
}

function normalize(text: string | undefined): string {
  if (!text) return '';
  return text.toLowerCase();
}

/**
 * Forsøk å finne et eksplisitt tidspunkt i teksten for et matchet keyword.
 * Eksempler vi forstår:
 *   "etter 1 sekund" / "etter 1.5 sekund" / "etter 2 sek"
 *   "after 1 second" / "after 2.5 seconds"
 *   "ved 0.5s" / "at 1.5s"
 *
 * Heuristikk: ser etter mønsteret innenfor 40 tegn etter keyword-treff.
 * Hvis funnet, returnerer offset i sekunder, ellers 0.
 */
function detectOffsetForKeyword(text: string, keywordPos: number, keywordLen: number): number {
  // Vindu på 50 tegn før + 60 etter keyword. Dekker mønstre som
  // "etter 1 sek X" (cue før keyword) og "X etter 1 sek" (cue etter).
  const start = Math.max(0, keywordPos - 50);
  const end = keywordPos + keywordLen + 60;
  const window = text.slice(start, end);
  const patterns = [
    /etter\s+(\d+(?:[.,]\d+)?)\s*(?:sek|sekund|sekunder|s\b)/i,
    /after\s+(\d+(?:[.,]\d+)?)\s*(?:sec|second|seconds|s\b)/i,
    /ved\s+(\d+(?:[.,]\d+)?)\s*s\b/i,
    /at\s+(\d+(?:[.,]\d+)?)\s*s\b/i,
  ];
  for (const pattern of patterns) {
    const match = window.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (Number.isFinite(num) && num >= 0 && num <= 30) return num;
    }
  }
  return 0;
}

function adjustIntensity(base: SfxIntensity, text: string): SfxIntensity {
  const hasBoost = INTENSITY_BOOSTERS.some((b) => text.includes(b));
  const hasDamp = INTENSITY_DAMPENERS.some((d) => text.includes(d));
  if (hasBoost && !hasDamp) {
    if (base === 'low') return 'medium';
    if (base === 'medium') return 'high';
    return 'high';
  }
  if (hasDamp && !hasBoost) {
    if (base === 'high') return 'medium';
    if (base === 'medium') return 'low';
    return 'low';
  }
  return base;
}

/**
 * Detekter SFX-events for ett enkelt frame.
 */
export function detectFrameSfx(frame: DetectableFrame): SfxEvent[] {
  const haystack = [
    normalize(frame.description),
    normalize(frame.caption),
    normalize(frame.shotType),
  ].join(' ');
  if (!haystack.trim()) return [];

  const events: SfxEvent[] = [];
  const seen = new Set<string>();

  for (const category of SFX_CATEGORIES) {
    for (const keyword of category.keywords) {
      const k = keyword.toLowerCase();
      const pos = haystack.indexOf(k);
      if (pos >= 0) {
        if (seen.has(category.id)) break;
        seen.add(category.id);
        events.push({
          id: `${frame.id}:${category.id}`,
          frameId: frame.id,
          categoryId: category.id,
          category,
          intensity: adjustIntensity(category.defaultIntensity, haystack),
          // Auto-detekter "etter X sek" etter keyword-treff. Bruker kan
          // overstyre senere via offset-slider.
          offsetSec: detectOffsetForKeyword(haystack, pos, k.length),
          matchedKeyword: keyword,
          layer: category.layer,
        });
        break;
      }
    }
  }

  return events;
}

/**
 * Detekter SFX for en hel frame-sekvens. Returnerer flat liste.
 */
export function detectSequenceSfx(frames: DetectableFrame[]): SfxEvent[] {
  const all: SfxEvent[] = [];
  for (const frame of frames) {
    all.push(...detectFrameSfx(frame));
  }
  return all;
}

/**
 * Grupper events per frame-id — nyttig for UI som rendrer per-frame.
 */
export function groupEventsByFrame(events: SfxEvent[]): Map<string, SfxEvent[]> {
  const map = new Map<string, SfxEvent[]>();
  for (const event of events) {
    const list = map.get(event.frameId);
    if (list) list.push(event);
    else map.set(event.frameId, [event]);
  }
  return map;
}

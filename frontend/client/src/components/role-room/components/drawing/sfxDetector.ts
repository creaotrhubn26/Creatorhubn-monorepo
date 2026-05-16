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
      if (haystack.includes(k)) {
        if (seen.has(category.id)) break;
        seen.add(category.id);
        events.push({
          id: `${frame.id}:${category.id}`,
          frameId: frame.id,
          categoryId: category.id,
          category,
          intensity: adjustIntensity(category.defaultIntensity, haystack),
          offsetSec: 0,
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

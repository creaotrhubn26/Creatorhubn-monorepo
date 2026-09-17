import { describe, expect, it } from 'vitest';
import { UI_STRINGS } from '../src/i18n/ui';
import { UI_LANGUAGES, makeTranslate } from '../src/i18n';
import { ATTRACTIONS } from '../src/data/attractions';

describe('UI strings', () => {
  const keys = Object.keys(UI_STRINGS.nb).sort();
  for (const l of UI_LANGUAGES) {
    it(`${l.code} has every key and the same placeholders as nb`, () => {
      const table = UI_STRINGS[l.code];
      expect(Object.keys(table).sort()).toEqual(keys);
      for (const k of keys) {
        const ph = (s: string) => (s.match(/\{[a-z]+\}/gi) ?? []).sort();
        expect(ph(table[k as keyof typeof table]), `${l.code}.${k}`).toEqual(ph(UI_STRINGS.nb[k as keyof typeof table]));
      }
    });
  }
  it('substitutes placeholders', () => {
    const t = makeTranslate('nb');
    expect(t('segmentOf', { index: 2, total: 4 })).toBe('Del 2 av 4');
  });
});

describe('guide content', () => {
  for (const a of ATTRACTIONS) {
    it(`${a.id} has an English script and every segment has narration + audio description`, () => {
      expect(a.scripts.en.segments.length).toBeGreaterThan(0);
      for (const [lang, script] of Object.entries(a.scripts)) {
        expect(script.intro.length, `${a.id}.${lang}.intro`).toBeGreaterThan(20);
        expect(script.sceneDescription.length, `${a.id}.${lang}.scene`).toBeGreaterThan(40);
        expect(script.segments.length, `${a.id}.${lang} segment count`).toBe(a.scripts.en.segments.length);
        for (const s of script.segments) {
          expect(s.narration.length, `${a.id}.${lang}.${s.id}.narration`).toBeGreaterThan(40);
          expect(s.audioDescription.length, `${a.id}.${lang}.${s.id}.audioDescription`).toBeGreaterThan(40);
        }
      }
    });
  }
});

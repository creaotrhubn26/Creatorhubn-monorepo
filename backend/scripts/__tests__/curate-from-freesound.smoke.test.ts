import { describe, expect, it } from 'vitest';
import { isCc0License } from '../curate-from-freesound.js';

/**
 * KRITISK: disse testene beskytter mot at non-CC0 samples ved et uhell
 * inkluderes i biblioteket. Hvis du endrer isCc0License, må alle disse
 * fortsatt passere før commit.
 */
describe('Sprint A.7 — CC0-license strict verification', () => {
  describe('aksepterer kun ren CC0', () => {
    it('http CC0 1.0 URL', () => {
      expect(isCc0License('http://creativecommons.org/publicdomain/zero/1.0/')).toBe(true);
    });

    it('https CC0 1.0 URL', () => {
      expect(isCc0License('https://creativecommons.org/publicdomain/zero/1.0/')).toBe(true);
    });

    it('uten trailing slash', () => {
      expect(isCc0License('https://creativecommons.org/publicdomain/zero/1.0')).toBe(true);
    });

    it('CASE-insensitiv', () => {
      expect(isCc0License('HTTPS://CREATIVECOMMONS.ORG/PUBLICDOMAIN/ZERO/1.0/')).toBe(true);
    });
  });

  describe('AVVISER non-CC0', () => {
    it('CC-BY (krever attribusjon)', () => {
      expect(isCc0License('http://creativecommons.org/licenses/by/3.0/')).toBe(false);
      expect(isCc0License('https://creativecommons.org/licenses/by/4.0/')).toBe(false);
    });

    it('CC-BY-NC (ikke-kommersielt)', () => {
      expect(isCc0License('http://creativecommons.org/licenses/by-nc/3.0/')).toBe(false);
      expect(isCc0License('https://creativecommons.org/licenses/by-nc/4.0/')).toBe(false);
    });

    it('CC-BY-SA (share-alike)', () => {
      expect(isCc0License('http://creativecommons.org/licenses/by-sa/3.0/')).toBe(false);
    });

    it('Sampling+ (gammel, ikke trygg)', () => {
      expect(isCc0License('http://creativecommons.org/licenses/sampling+/1.0/')).toBe(false);
    });

    it('proprietære/ukjente URLer', () => {
      expect(isCc0License('https://example.com/license/proprietary')).toBe(false);
      expect(isCc0License('https://zapsplat.com/license/standard')).toBe(false);
    });
  });

  describe('AVVISER edge cases / forfalskning', () => {
    it('null/undefined/tom', () => {
      expect(isCc0License(null as any)).toBe(false);
      expect(isCc0License(undefined)).toBe(false);
      expect(isCc0License('')).toBe(false);
    });

    it('ikke-string', () => {
      expect(isCc0License(123 as any)).toBe(false);
      expect(isCc0License({} as any)).toBe(false);
    });

    it('vilkårlig tekst som inneholder "CC0"', () => {
      expect(isCc0License('I claim CC0 but actually no')).toBe(false);
      expect(isCc0License('CC0')).toBe(false);
    });

    it('domain look-alike (security)', () => {
      expect(isCc0License('https://creativecommons.evil.com/publicdomain/zero/1.0/')).toBe(false);
      expect(isCc0License('https://fakecommons.org/publicdomain/zero/1.0/')).toBe(false);
    });

    it('vilkårlig domain med riktig path AVVISES', () => {
      // Streng hostname-sjekk: kun creativecommons.org tillates.
      expect(isCc0License('http://anything.com/publicdomain/zero/1.0/')).toBe(false);
      expect(isCc0License('http://anything.com/publicdomain/zero/1.0/foo')).toBe(false);
    });

    it('subdomener under creativecommons.org AVVISES', () => {
      // Hostname må være EXAKT — ingen subdomener.
      expect(isCc0License('https://wiki.creativecommons.org/publicdomain/zero/1.0/')).toBe(false);
    });

    it('ekstra path-segmenter AVVISES', () => {
      expect(isCc0License('https://creativecommons.org/publicdomain/zero/1.0/foo')).toBe(false);
    });

    it('malformed URL AVVISES', () => {
      expect(isCc0License('not a url')).toBe(false);
      expect(isCc0License('//creativecommons.org/publicdomain/zero/1.0')).toBe(false);
    });
  });
});

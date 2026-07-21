import { describe, expect, it } from 'vitest';
import {
  MAGIC_TTL_MS,
  createMagicToken,
  isAllowedEmail,
  parseAllowlist,
  verifyMagicToken,
} from '../src/api/magic-link.js';
import { verifyToken } from '../src/api/auth.js';

const SECRET = 'test-secret-xyz';

describe('Magisk innlogging — token', () => {
  it('round-trip: gyldig token gir e-posten tilbake (normalisert)', () => {
    const t = createMagicToken('Daniel@Creatorhubn.com', SECRET, 1000);
    expect(verifyMagicToken(t, SECRET, 1000)).toBe('daniel@creatorhubn.com');
  });

  it('utløpt token (etter 15 min) avvises', () => {
    const t = createMagicToken('d@x.no', SECRET, 1000);
    expect(verifyMagicToken(t, SECRET, 1000 + MAGIC_TTL_MS + 1)).toBeNull();
  });

  it('manipulert/feil-signert token avvises', () => {
    const t = createMagicToken('d@x.no', SECRET, 1000);
    expect(verifyMagicToken(t + 'x', SECRET, 1000)).toBeNull();
    expect(verifyMagicToken(t, 'annet-secret', 1000)).toBeNull();
  });

  it('en magisk token kan IKKE brukes som sesjonstoken (eget prefiks)', () => {
    const t = createMagicToken('d@x.no', SECRET, Date.now());
    expect(verifyToken(t, SECRET)).toBeNull();
  });
});

describe('Tillatelsesliste', () => {
  it('parser komma-separert', () => {
    expect(parseAllowlist('daniel@creatorhubn.com, @creatorhubn.com')).toEqual([
      'daniel@creatorhubn.com',
      '@creatorhubn.com',
    ]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });

  it('matcher eksakt e-post og @domene', () => {
    const allow = ['daniel@creatorhubn.com', '@partner.no'];
    expect(isAllowedEmail('daniel@creatorhubn.com', allow)).toBe(true);
    expect(isAllowedEmail('ANN@partner.no', allow)).toBe(true);
    expect(isAllowedEmail('fremmed@annet.no', allow)).toBe(false);
    expect(isAllowedEmail('daniel@creatorhubn.com', [])).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { dedupeFilenames, formatDate, renderFilename } from '../naming-tokens';
import type { FilenameContext } from '../types';

const baseContext: FilenameContext = {
  originalName: 'IMG_0042.CR3',
  sequence: 7,
  projectName: 'Holy Crust · Easter',
  clientName: 'Holy Crust',
  camera: 'Canon R6 Mark II',
  customText: 'final',
  shotAt: new Date('2026-04-20T14:05:03').getTime(),
};

describe('renderFilename', () => {
  it('substitutes the common token set', () => {
    const out = renderFilename(
      '{project_name}_{date:YYYYMMDD}_{sequence:04}',
      baseContext,
      { extension: 'jpg' },
    );
    expect(out).toBe('Holy Crust · Easter_20260420_0007.jpg');
  });

  it('keeps the original name without its extension', () => {
    const out = renderFilename('{original_name}_edit', baseContext, { extension: 'jpg' });
    expect(out).toBe('IMG_0042_edit.jpg');
  });

  it('renders unknown tokens as empty, never the raw literal', () => {
    const out = renderFilename(
      '{mystery}-{sequence}',
      { ...baseContext, sequence: 3 },
      { extension: 'jpg' },
    );
    expect(out).toBe('-3.jpg');
  });

  it('strips filesystem-unsafe characters from substituted values', () => {
    const out = renderFilename(
      '{client}-{sequence:02}',
      { ...baseContext, clientName: 'C:/bad\\name?' },
      { extension: 'jpg' },
    );
    expect(out).toBe('C__bad_name_-07.jpg');
  });

  it('normalises the extension — lowercase, dot-prefixed, stripped of punctuation', () => {
    expect(renderFilename('{sequence}', baseContext, { extension: '.JPG' })).toBe('7.jpg');
    expect(renderFilename('{sequence}', baseContext, { extension: 'jpeg' })).toBe('7.jpeg');
    expect(renderFilename('{sequence}', baseContext, { extension: '' })).toBe('7');
  });

  it('falls back to "image" if the rendered base is empty after sanitising', () => {
    const out = renderFilename('{mystery}', baseContext, { extension: 'jpg' });
    expect(out).toBe('image.jpg');
  });

  it('trims trailing dots and spaces from the base (Windows-invalid)', () => {
    const out = renderFilename('name . . ', baseContext, { extension: 'jpg' });
    expect(out).toBe('name.jpg');
  });

  it('truncates very long rendered filenames to stay under the fs limit', () => {
    const long = 'x'.repeat(400);
    const out = renderFilename(long, baseContext, { extension: 'jpg' });
    expect(out.length).toBeLessThanOrEqual(180);
    expect(out.endsWith('.jpg')).toBe(true);
  });

  it('accepts a pinned "now" via options for deterministic tests', () => {
    const fixed = new Date('2024-12-31T23:59:58');
    const out = renderFilename(
      '{date:YYYY}-{time:HHmmss}',
      { ...baseContext, shotAt: undefined },
      { extension: 'jpg', now: fixed },
    );
    expect(out).toBe('2024-235958.jpg');
  });
});

describe('formatDate', () => {
  const d = new Date('2026-04-20T08:05:03');

  it.each([
    ['YYYY-MM-DD', '2026-04-20'],
    ['YY-MM-DD', '26-04-20'],
    ['YYYYMMDD', '20260420'],
    ['HH:mm:ss', '08:05:03'],
  ])('formats %s → %s', (pattern, expected) => {
    expect(formatDate(d, pattern)).toBe(expected);
  });

  it('leaves unknown format tokens untouched', () => {
    expect(formatDate(d, 'YYYY-Q')).toBe('2026-Q');
  });
});

describe('dedupeFilenames', () => {
  it('appends " (n)" to duplicates', () => {
    expect(dedupeFilenames(['a.jpg', 'a.jpg', 'a.jpg'])).toEqual(['a.jpg', 'a (1).jpg', 'a (2).jpg']);
  });

  it('is case-insensitive (matches Windows/macOS defaults)', () => {
    expect(dedupeFilenames(['A.jpg', 'a.JPG'])).toEqual(['A.jpg', 'a (1).JPG']);
  });

  it('handles extensionless names', () => {
    expect(dedupeFilenames(['a', 'a'])).toEqual(['a', 'a (1)']);
  });

  it('skips existing " (n)" collisions rather than overwriting', () => {
    expect(dedupeFilenames(['a.jpg', 'a (1).jpg', 'a.jpg'])).toEqual(['a.jpg', 'a (1).jpg', 'a (2).jpg']);
  });
});

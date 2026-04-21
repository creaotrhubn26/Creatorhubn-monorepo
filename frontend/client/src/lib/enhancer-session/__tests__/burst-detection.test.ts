import { describe, expect, it } from 'vitest';
import { detectBursts, parseFilenameSequence } from '../burst-detection';

function input(id: string, fileName: string, lastModified: number) {
  return { id, fileName, lastModified };
}

function burstIdMap(rows: Array<{ imageId: string; burstId: string | null }>) {
  const map = new Map<string, string | null>();
  for (const r of rows) map.set(r.imageId, r.burstId);
  return map;
}

const MS_SECOND = 1000;

describe('parseFilenameSequence', () => {
  it('extracts stem + sequence from zero-padded names', () => {
    expect(parseFilenameSequence('IMG_0042.CR3')).toEqual({ stem: 'IMG_', seq: 42 });
    expect(parseFilenameSequence('IMG_9999.jpg')).toEqual({ stem: 'IMG_', seq: 9999 });
  });

  it('strips directory prefixes', () => {
    expect(parseFilenameSequence('shoot/raw/IMG_0001.CR3')).toEqual({ stem: 'IMG_', seq: 1 });
    expect(parseFilenameSequence('C:\\shoot\\IMG_0001.CR3')).toEqual({ stem: 'IMG_', seq: 1 });
  });

  it('returns null for non-numeric names', () => {
    expect(parseFilenameSequence('hero.jpg')).toBeNull();
    expect(parseFilenameSequence('')).toBeNull();
  });

  it('handles unusual sequence formats', () => {
    expect(parseFilenameSequence('DSC_42.NEF')).toEqual({ stem: 'DSC_', seq: 42 });
    expect(parseFilenameSequence('DJI_0123.JPG')).toEqual({ stem: 'DJI_', seq: 123 });
    expect(parseFilenameSequence('_DSC1234.ARW')).toEqual({ stem: '_DSC', seq: 1234 });
  });
});

describe('detectBursts', () => {
  it('groups a simple 3-frame burst', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts([
      input('a', 'IMG_0001.CR3', t0),
      input('b', 'IMG_0002.CR3', t0 + 400),
      input('c', 'IMG_0003.CR3', t0 + 800),
    ]);
    const map = burstIdMap(result);
    expect(map.get('a')).toBeTruthy();
    expect(map.get('a')).toBe(map.get('b'));
    expect(map.get('b')).toBe(map.get('c'));
  });

  it('does not group non-adjacent sequence numbers', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts([
      input('a', 'IMG_0001.CR3', t0),
      input('b', 'IMG_0042.CR3', t0 + 500),
    ]);
    const map = burstIdMap(result);
    expect(map.get('a')).toBeNull();
    expect(map.get('b')).toBeNull();
  });

  it('does not group frames separated by more than maxGapSeconds', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts([
      input('a', 'IMG_0001.CR3', t0),
      input('b', 'IMG_0002.CR3', t0 + 10 * MS_SECOND),
    ]);
    const map = burstIdMap(result);
    expect(map.get('a')).toBeNull();
    expect(map.get('b')).toBeNull();
  });

  it('honours a custom maxGapSeconds option', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts(
      [
        input('a', 'IMG_0001.CR3', t0),
        input('b', 'IMG_0002.CR3', t0 + 6 * MS_SECOND),
      ],
      { maxGapSeconds: 10 },
    );
    const map = burstIdMap(result);
    expect(map.get('a')).toBe(map.get('b'));
  });

  it('splits bursts from different stems even when adjacent in time', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts([
      input('a', 'IMG_0001.CR3', t0),
      input('b', 'DSC_0001.NEF', t0 + 400),
      input('c', 'DSC_0002.NEF', t0 + 600),
    ]);
    const map = burstIdMap(result);
    expect(map.get('a')).toBeNull();
    expect(map.get('b')).toBe(map.get('c'));
    expect(map.get('b')).toBeTruthy();
  });

  it('identifies multiple distinct bursts in one upload', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts([
      input('a', 'IMG_0010.CR3', t0),
      input('b', 'IMG_0011.CR3', t0 + 300),
      input('c', 'IMG_0012.CR3', t0 + 600),
      input('d', 'IMG_0050.CR3', t0 + 60_000),
      input('e', 'IMG_0051.CR3', t0 + 60_400),
      input('f', 'IMG_0052.CR3', t0 + 60_800),
    ]);
    const map = burstIdMap(result);
    expect(map.get('a')).toBeTruthy();
    expect(map.get('a')).toBe(map.get('b'));
    expect(map.get('b')).toBe(map.get('c'));
    expect(map.get('d')).toBeTruthy();
    expect(map.get('a')).not.toBe(map.get('d'));
    expect(map.get('d')).toBe(map.get('e'));
    expect(map.get('e')).toBe(map.get('f'));
  });

  it('single images get null burstId', () => {
    const result = detectBursts([input('a', 'IMG_0042.CR3', 1_700_000_000_000)]);
    expect(result[0].burstId).toBeNull();
  });

  it('handles empty input', () => {
    expect(detectBursts([])).toEqual([]);
  });

  it('handles inputs arriving out of time order', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts([
      input('c', 'IMG_0003.CR3', t0 + 600),
      input('a', 'IMG_0001.CR3', t0),
      input('b', 'IMG_0002.CR3', t0 + 300),
    ]);
    const map = burstIdMap(result);
    expect(map.get('a')).toBe(map.get('b'));
    expect(map.get('b')).toBe(map.get('c'));
  });

  it('falls back to time-only when filenames lack a sequence', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts([
      input('a', 'random_frame_one.jpg', t0),
      input('b', 'random_frame_two.jpg', t0 + 500),
    ]);
    const map = burstIdMap(result);
    expect(map.get('a')).toBe(map.get('b'));
    expect(map.get('a')).toBeTruthy();
  });

  it('does not extend a burst over a missing sequence gap of 3+', () => {
    const t0 = 1_700_000_000_000;
    const result = detectBursts([
      input('a', 'IMG_0001.CR3', t0),
      input('b', 'IMG_0005.CR3', t0 + 400),
      input('c', 'IMG_0006.CR3', t0 + 800),
    ]);
    const map = burstIdMap(result);
    expect(map.get('a')).toBeNull();
    expect(map.get('b')).toBe(map.get('c'));
  });
});

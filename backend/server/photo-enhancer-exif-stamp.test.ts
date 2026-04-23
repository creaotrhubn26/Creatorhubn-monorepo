import { describe, expect, it } from 'vitest';
import { buildExifArgs, stampExif } from './photo-enhancer-exif-stamp.js';

describe('buildExifArgs', () => {
  it('always prefixes the -overwrite_original + -fast flags', () => {
    const args = buildExifArgs({ copyright: '© Daniel' }, '/tmp/x.jpg');
    expect(args[0]).toBe('-overwrite_original');
    expect(args[1]).toBe('-fast');
    expect(args[args.length - 1]).toBe('/tmp/x.jpg');
  });

  it('writes Copyright into three surfaces (EXIF, XMP, IPTC)', () => {
    const args = buildExifArgs({ copyright: '© Holy Crust 2026' }, '/tmp/x.jpg');
    expect(args).toContain('-Copyright=© Holy Crust 2026');
    expect(args).toContain('-XMP:Rights=© Holy Crust 2026');
    expect(args).toContain('-IPTC:CopyrightNotice=© Holy Crust 2026');
  });

  it('trims whitespace around Copyright so stray tabs do not poison metadata', () => {
    const args = buildExifArgs({ copyright: '  © photographer   ' }, '/tmp/x.jpg');
    expect(args).toContain('-Copyright=© photographer');
    expect(args).not.toContain('-Copyright=  © photographer   ');
  });

  it('emits one -Keywords per entry', () => {
    const args = buildExifArgs(
      { keywords: ['bakeri', 'croissant', 'oslo'] },
      '/tmp/x.jpg',
    );
    const kwArgs = args.filter((a) => a.startsWith('-Keywords='));
    expect(kwArgs).toEqual(['-Keywords=bakeri', '-Keywords=croissant', '-Keywords=oslo']);
  });

  it('drops empty/whitespace-only keywords', () => {
    const args = buildExifArgs(
      { keywords: ['valid', '   ', '', 'also-valid'] },
      '/tmp/x.jpg',
    );
    const kwArgs = args.filter((a) => a.startsWith('-Keywords='));
    expect(kwArgs).toEqual(['-Keywords=valid', '-Keywords=also-valid']);
  });

  it('emits Creator to both EXIF Creator and XMP:Creator', () => {
    const args = buildExifArgs({ creator: 'Daniel Beckmann' }, '/tmp/x.jpg');
    expect(args).toContain('-Creator=Daniel Beckmann');
    expect(args).toContain('-XMP:Creator=Daniel Beckmann');
  });

  it('omits tags that are not set', () => {
    const args = buildExifArgs({ copyright: 'only copyright' }, '/tmp/x.jpg');
    expect(args.some((a) => a.startsWith('-Artist='))).toBe(false);
    expect(args.some((a) => a.startsWith('-Creator='))).toBe(false);
    expect(args.some((a) => a.startsWith('-Keywords='))).toBe(false);
  });

  it('omits empty-string values (pre-trim zero-length)', () => {
    const args = buildExifArgs(
      { copyright: '', artist: '   ', creator: undefined },
      '/tmp/x.jpg',
    );
    expect(args.length).toBe(3); // -overwrite_original, -fast, inputPath
  });
});

describe('stampExif — no-op paths', () => {
  it('returns the same buffer unchanged when no fields are set', async () => {
    const input = Buffer.from([0xff, 0xd8, 0xff]);
    const result = await stampExif(input, {}, '.jpg');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bytes).toBe(input);
  });

  it('returns bytes unchanged for unsupported formats (e.g. .raw)', async () => {
    const input = Buffer.from([0, 1, 2, 3]);
    const result = await stampExif(input, { copyright: '© me' }, '.raw');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bytes).toBe(input);
  });

  it('accepts extensions with or without leading dot', async () => {
    const input = Buffer.from([0xff, 0xd8]);
    // Without leading dot — should still skip (treated as unknown), not crash.
    const result = await stampExif(input, {}, 'jpg');
    expect(result.ok).toBe(true);
  });
});

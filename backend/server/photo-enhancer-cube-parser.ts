/**
 * Minimal Adobe .cube parser for upload validation.
 *
 * Backend-side sanity pass before we accept a user-uploaded LUT into the
 * library. The full trilinear apply happens on the Python runner, but
 * we still need to:
 *   1. Confirm the file is text (not a random binary masquerading as .cube)
 *   2. Extract LUT_3D_SIZE so the dropdown can show the table size
 *   3. Extract optional DOMAIN_MIN / DOMAIN_MAX for the metadata row
 *   4. Count data rows against the expected ``size ** 3`` to catch
 *      truncation
 *
 * We deliberately do NOT evaluate trilinear interpolation in TypeScript —
 * the runner is authoritative, and duplicating interp math in two
 * languages creates drift risk. ``computeSwatchPreview`` returns a
 * coarse swatch by reading a single LUT entry close to mid-grey.
 */

export interface ParsedCubeMeta {
  size: number;
  kind: '1D' | '3D';
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  entryCount: number;
  title: string;
  /** First few entries at coarse positions — used to render a swatch. */
  samples: {
    black: [number, number, number];
    midGrey: [number, number, number];
    white: [number, number, number];
  };
}

export class CubeParseError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CubeParseError';
  }
}

const MAX_SIZE_1D = 4096;
const MAX_SIZE_3D = 65;

export function parseCubeMetadata(source: string): ParsedCubeMeta {
  if (!source || typeof source !== 'string') {
    throw new CubeParseError('Tom fil.', 'empty');
  }
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let kind: '1D' | '3D' | null = null;
  let size: number | null = null;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  let title = '';
  const entries: Array<[number, number, number]> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const upper = line.toUpperCase();
    if (upper.startsWith('TITLE')) {
      const rest = line.slice(5).trim();
      title = rest.startsWith('"') && rest.endsWith('"') ? rest.slice(1, -1) : rest;
      continue;
    }
    if (upper.startsWith('LUT_1D_SIZE')) {
      if (kind !== null) throw new CubeParseError('LUT-typen er deklarert to ganger.', 'duplicate_kind');
      kind = '1D';
      size = parsePositiveInt(line, 'LUT_1D_SIZE');
      if (size > MAX_SIZE_1D) throw new CubeParseError(`LUT_1D_SIZE ${size} over tillatt ${MAX_SIZE_1D}.`, 'size_too_big');
      continue;
    }
    if (upper.startsWith('LUT_3D_SIZE')) {
      if (kind !== null) throw new CubeParseError('LUT-typen er deklarert to ganger.', 'duplicate_kind');
      kind = '3D';
      size = parsePositiveInt(line, 'LUT_3D_SIZE');
      if (size > MAX_SIZE_3D) throw new CubeParseError(`LUT_3D_SIZE ${size} over tillatt ${MAX_SIZE_3D}.`, 'size_too_big');
      continue;
    }
    if (upper.startsWith('DOMAIN_MIN')) {
      domainMin = parseTriplet(line, 'DOMAIN_MIN');
      continue;
    }
    if (upper.startsWith('DOMAIN_MAX')) {
      domainMax = parseTriplet(line, 'DOMAIN_MAX');
      continue;
    }
    entries.push(parseTriplet(line, 'entry', false));
  }

  if (kind === null || size === null) {
    throw new CubeParseError('Filen mangler LUT_1D_SIZE eller LUT_3D_SIZE.', 'missing_size');
  }
  if (domainMin[0] >= domainMax[0] || domainMin[1] >= domainMax[1] || domainMin[2] >= domainMax[2]) {
    throw new CubeParseError('DOMAIN_MIN må være mindre enn DOMAIN_MAX.', 'bad_domain');
  }

  const expected = kind === '1D' ? size : size * size * size;
  if (entries.length !== expected) {
    throw new CubeParseError(
      `Antall oppføringer (${entries.length}) stemmer ikke med ${kind === '3D' ? 'size³' : 'size'} = ${expected}.`,
      'entry_count',
    );
  }

  const samples = kind === '3D'
    ? sampleThreeEntries(entries, size)
    : {
        black: entries[0],
        midGrey: entries[Math.floor((size - 1) / 2)],
        white: entries[size - 1],
      };

  return {
    size,
    kind,
    domainMin,
    domainMax,
    entryCount: entries.length,
    title,
    samples,
  };
}

function parsePositiveInt(line: string, label: string): number {
  const parts = line.split(/\s+/);
  if (parts.length < 2) throw new CubeParseError(`${label} mangler argument.`, 'bad_size_arg');
  const parsed = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CubeParseError(`${label} må være positivt heltall (fikk ${parts[1]}).`, 'bad_size_arg');
  }
  return parsed;
}

function parseTriplet(line: string, label: string, hasKeyword = true): [number, number, number] {
  let parts = line.split(/\s+/).filter(Boolean);
  if (hasKeyword) parts = parts.slice(1);
  if (parts.length !== 3) {
    throw new CubeParseError(`${label} krever tre tall (fikk «${line}»).`, 'bad_triplet');
  }
  const values = parts.map((p) => Number(p));
  for (const v of values) {
    if (!Number.isFinite(v)) throw new CubeParseError(`${label} har ugyldig tall.`, 'non_numeric');
  }
  return [values[0], values[1], values[2]];
}

function sampleThreeEntries(
  entries: Array<[number, number, number]>,
  size: number,
): ParsedCubeMeta['samples'] {
  const get = (r: number, g: number, b: number) => entries[r + size * (g + size * b)];
  const midIndex = Math.floor((size - 1) / 2);
  return {
    black: get(0, 0, 0),
    midGrey: get(midIndex, midIndex, midIndex),
    white: get(size - 1, size - 1, size - 1),
  };
}

/** Compute a UI swatch (0-255 RGB) from a parsed LUT's samples. */
export function computeSwatchPreview(meta: ParsedCubeMeta): { r: number; g: number; b: number } {
  const [mr, mg, mb] = meta.samples.midGrey;
  return {
    r: clampByte(mr * 255),
    g: clampByte(mg * 255),
    b: clampByte(mb * 255),
  };
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 128;
  return Math.max(0, Math.min(255, Math.round(value)));
}

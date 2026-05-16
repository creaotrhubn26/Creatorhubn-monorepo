/**
 * styleConsistency — palett-analyse for å oppdage style-drift på tvers
 * av storyboard-frames.
 *
 * Storyboard-artister trenger ofte å holde stilen konsistent — fargevalg
 * sklir gjerne over en lang dag eller mellom seanser. Denne modulen
 * trekker dominerende farger fra hvert frame's strokes og flagger frames
 * som bryter mot sekvensens etablerte palett.
 *
 * Strategi:
 *   1. Per frame: bygg vektet histogram av stroke-farger, der vekten
 *      tilsvarer omtrentlig dekkflate (stroke-lengde * width).
 *   2. Kvantiser til 16x16x16 = 4096 RGB-buckets så små variasjoner
 *      smelter sammen.
 *   3. Topp-N (default 5) buckets = "frame-palett".
 *   4. Sekvens-palett = vektet snitt av alle frame-paletter.
 *   5. Style drift per frame = gjennomsnittlig minimum-distanse fra
 *      frame's topp-farger til sekvens-paletten.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorBin {
  /** Hex-representasjon for UI-rendering (#rrggbb). */
  color: string;
  /** Vekt: hvor mye av rammen denne fargen dekker (relativ). */
  weight: number;
}

export interface FramePalette {
  frameId: string;
  /** 0..5 dominerende farger, sortert etter weight (høyest først). */
  colors: ColorBin[];
  /** Sum av alle stroke-vekter — proxy for frame "fullness". */
  totalWeight: number;
}

export interface StyleDriftReport {
  /** Sekvensens "etablerte" palett (vektet snitt av alle frames). */
  sequencePalette: ColorBin[];
  /** Per-frame drift-score (0 = perfekt konsistent, høyere = mer brudd). */
  driftByFrame: Array<{ frameId: string; drift: number; severity: 'ok' | 'warning' | 'high' }>;
  /** Frames med drift over warning-terskel. */
  outliers: Array<{ frameId: string; drift: number }>;
  /** Hvilken palett drift ble målt mot — 'sequence' (leave-one-out) eller 'target' (eksternt). */
  driftSource: 'sequence' | 'target';
}

export interface AnalyzeStyleDriftOptions {
  /** Hvis satt: bruk denne paletten som referanse i stedet for leave-one-out
   *  sekvens-palett. Typisk fra mood-board → måler drift fra intendert stil. */
  targetPalette?: ColorBin[];
}

interface StrokeLike {
  id?: string;
  color?: string;
  width?: number;
  points?: Array<{ x: number; y: number }>;
}

interface FrameWithStrokes {
  id: string;
  strokes?: StrokeLike[];
  /** Alternativ kilde — drawing-data kan inneholde strokes per lag. */
  drawingData?: {
    strokes?: StrokeLike[];
    document?: {
      sheets?: Array<{
        layers?: Array<{ strokes?: StrokeLike[] }>;
      }>;
    };
  };
}

const BUCKET_SHIFT = 4; // 16 buckets per kanal (256 >> 4)

// ============================================================================
// Hex parsing / formatting
// ============================================================================

export function parseHex(hex: string): RGB | null {
  if (!hex || typeof hex !== 'string') return null;
  let value = hex.trim();
  if (value.startsWith('#')) value = value.slice(1);
  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('');
  }
  if (value.length !== 6) return null;
  const m = /^([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(value);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function rgbToHex(rgb: RGB): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function bucketKey(rgb: RGB): string {
  const r = rgb.r >> BUCKET_SHIFT;
  const g = rgb.g >> BUCKET_SHIFT;
  const b = rgb.b >> BUCKET_SHIFT;
  return `${r}:${g}:${b}`;
}

function bucketCenter(key: string): RGB {
  const [r, g, b] = key.split(':').map(Number);
  const half = 1 << (BUCKET_SHIFT - 1);
  return {
    r: (r << BUCKET_SHIFT) + half,
    g: (g << BUCKET_SHIFT) + half,
    b: (b << BUCKET_SHIFT) + half,
  };
}

// ============================================================================
// Frame analysis
// ============================================================================

function collectStrokes(frame: FrameWithStrokes): StrokeLike[] {
  const result: StrokeLike[] = [];
  if (Array.isArray(frame.strokes)) result.push(...frame.strokes);
  if (Array.isArray(frame.drawingData?.strokes)) {
    result.push(...(frame.drawingData!.strokes as StrokeLike[]));
  }
  const sheets = frame.drawingData?.document?.sheets;
  if (Array.isArray(sheets)) {
    for (const sheet of sheets) {
      const layers = sheet.layers ?? [];
      for (const layer of layers) {
        if (Array.isArray(layer.strokes)) result.push(...layer.strokes);
      }
    }
  }
  return result;
}

function strokeWeight(stroke: StrokeLike): number {
  // Omtrentlig dekkflate: lengde * bredde. Vi tar pseudo-lengde fra
  // antall punkter * gjennomsnittsavstand mellom punkter; for ytelse
  // approksimerer vi bare med punkt-antall * width.
  const points = stroke.points ?? [];
  if (points.length < 2) return 0;
  let length = 0;
  // Subsample-trick: lange strokes summerer hvert 4. segment for ytelse.
  const step = Math.max(1, Math.floor(points.length / 50));
  for (let i = step; i < points.length; i += step) {
    const a = points[i - step];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  // Skaler opp hvis vi subsamplet.
  if (step > 1) length *= step;
  return length * Math.max(1, stroke.width ?? 2);
}

/**
 * Analyser ett frame og returner topp-N dominerende farger.
 */
export function analyzeFramePalette(frame: FrameWithStrokes, topN = 5): FramePalette {
  const buckets = new Map<string, number>();
  let totalWeight = 0;
  for (const stroke of collectStrokes(frame)) {
    const rgb = parseHex(stroke.color ?? '');
    if (!rgb) continue;
    const weight = strokeWeight(stroke);
    if (weight <= 0) continue;
    const key = bucketKey(rgb);
    buckets.set(key, (buckets.get(key) ?? 0) + weight);
    totalWeight += weight;
  }
  const colors: ColorBin[] = Array.from(buckets.entries())
    .map(([key, weight]) => ({
      color: rgbToHex(bucketCenter(key)),
      weight,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
  return {
    frameId: frame.id,
    colors,
    totalWeight,
  };
}

// ============================================================================
// Sequence-level drift
// ============================================================================

function colorDistance(a: RGB, b: RGB): number {
  // Enkel Euclidean i RGB — Lab-konvertering er overkill her.
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Beregner sekvens-palett (vektet snitt av frame-paletter).
 */
function computeSequencePalette(paletteList: FramePalette[], topN = 6): ColorBin[] {
  const allBuckets = new Map<string, number>();
  for (const palette of paletteList) {
    for (const bin of palette.colors) {
      const rgb = parseHex(bin.color);
      if (!rgb) continue;
      const key = bucketKey(rgb);
      allBuckets.set(key, (allBuckets.get(key) ?? 0) + bin.weight);
    }
  }
  return Array.from(allBuckets.entries())
    .map(([key, weight]) => ({ color: rgbToHex(bucketCenter(key)), weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}

/**
 * Frame drift = gjennomsnittlig min-avstand fra frame's topp-3 farger til
 * sekvens-paletten. Normalisert til 0..1 (max RGB-distanse er ca 441).
 */
function computeFrameDrift(palette: FramePalette, sequence: ColorBin[]): number {
  if (palette.colors.length === 0 || sequence.length === 0) return 0;
  const sequenceRgb = sequence
    .map((bin) => parseHex(bin.color))
    .filter((rgb): rgb is RGB => Boolean(rgb));
  if (sequenceRgb.length === 0) return 0;

  const topFrameColors = palette.colors.slice(0, 3);
  let sumMin = 0;
  let count = 0;
  for (const bin of topFrameColors) {
    const rgb = parseHex(bin.color);
    if (!rgb) continue;
    let minDist = Infinity;
    for (const seqRgb of sequenceRgb) {
      const d = colorDistance(rgb, seqRgb);
      if (d < minDist) minDist = d;
    }
    sumMin += minDist;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.min(1, (sumMin / count) / 441);
}

const WARNING_THRESHOLD = 0.18;
const HIGH_THRESHOLD = 0.32;

/**
 * Hovedfunksjon: analyser alle frames, finn etablert palett, flagg outliers.
 *
 * To moduser:
 *   - Default (ingen options): leave-one-out drift fra sekvens-palett.
 *     Hver frame sammenlignes mot sekvens-palett UTEN sin egen bidrag —
 *     ellers ville outliers "validere seg selv".
 *   - Med `targetPalette`: drift måles mot ekstern target (typisk fra
 *     mood-board). Da kan ALLE frames flagges, inkludert hele sekvensen
 *     hvis den har drevet bort fra intensjonen.
 */
export function analyzeStyleDrift(
  frames: FrameWithStrokes[],
  options: AnalyzeStyleDriftOptions = {},
): StyleDriftReport {
  const { targetPalette } = options;
  const palettes = frames.map((frame) => analyzeFramePalette(frame));
  const framesWithStrokes = palettes.filter((p) => p.colors.length > 0);

  // Display-palett (alle frames) — beholdes uavhengig av modus så UI kan vise begge.
  const sequencePalette = framesWithStrokes.length > 0
    ? computeSequencePalette(framesWithStrokes)
    : [];

  const hasTarget = Array.isArray(targetPalette) && targetPalette.length > 0;

  if (!hasTarget && framesWithStrokes.length < 2) {
    // Uten target og <2 frames: ikke nok grunnlag for drift.
    return {
      sequencePalette,
      driftByFrame: palettes.map((p) => ({ frameId: p.frameId, drift: 0, severity: 'ok' as const })),
      outliers: [],
      driftSource: 'sequence',
    };
  }

  const driftByFrame = palettes.map((palette) => {
    if (palette.colors.length === 0) {
      return { frameId: palette.frameId, drift: 0, severity: 'ok' as const };
    }
    let referencePalette: ColorBin[];
    if (hasTarget) {
      referencePalette = targetPalette!;
    } else {
      // Leave-one-out: rebuild sekvens-palett uten denne framen.
      const others = framesWithStrokes.filter((p) => p.frameId !== palette.frameId);
      if (others.length === 0) {
        return { frameId: palette.frameId, drift: 0, severity: 'ok' as const };
      }
      referencePalette = computeSequencePalette(others);
    }
    const drift = computeFrameDrift(palette, referencePalette);
    let severity: 'ok' | 'warning' | 'high' = 'ok';
    if (drift >= HIGH_THRESHOLD) severity = 'high';
    else if (drift >= WARNING_THRESHOLD) severity = 'warning';
    return { frameId: palette.frameId, drift, severity };
  });
  const outliers = driftByFrame
    .filter((entry) => entry.severity !== 'ok')
    .map(({ frameId, drift }) => ({ frameId, drift }));

  return {
    sequencePalette,
    driftByFrame,
    outliers,
    driftSource: hasTarget ? 'target' : 'sequence',
  };
}

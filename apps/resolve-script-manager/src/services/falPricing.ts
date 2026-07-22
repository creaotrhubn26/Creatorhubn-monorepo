/**
 * falPricing — sentral kostnads-katalog for fal.ai-operasjoner + estimering.
 *
 * Formål: gjøre det SYNLIG i UI/UX hvor mye en generering koster, både som
 * forhåndsestimat (før du trykker "Generer") og som løpende forbruk i økten.
 *
 * Alle priser er ESTIMAT i USD basert på fal.ai-modellenes per-enhet-pris og
 * kan drifte — behandle dem som veiledende, ikke fakturering. Kilden til
 * sannhet for faktisk forbruk er fal-dashbordet. Vi runder alltid pessimistisk
 * (litt for høyt) så bruker aldri blir overrasket av en høyere regning.
 */

/** Omtrentlig USD→NOK. Justér ett sted om kursen driver mye. */
export const USD_TO_NOK = 10.7;

export type FalOp =
  | "t2i" // nano-banana text-to-image
  | "edit" // nano-banana/edit (continuity)
  | "flux" // flux 1.1 pro text-to-image (AI-bilde-dialog)
  | "i2v" // seedance image-to-video (per sekund)
  | "tts" // elevenlabs multilingual v2 (per 1k tegn)
  | "audio" // stable-audio (per generering)
  | "upscale"; // clarity-upscaler (per bilde)

interface OpPrice {
  label: string;
  /** Pris per enhet i USD (estimat). */
  usd: number;
  /** Hva "en enhet" er — vises i UI så estimatet er etterprøvbart. */
  unit: string;
  model: string;
}

/**
 * Estimerte enhetspriser (USD). Oppdatér her hvis fal endrer prising.
 * Tallene er bevisst litt konservative (avrundet opp).
 */
export const FAL_PRICES: Record<FalOp, OpPrice> = {
  t2i: { label: "Bilde (T2I)", usd: 0.039, unit: "per bilde", model: "nano-banana" },
  edit: { label: "Continuity-edit", usd: 0.039, unit: "per bilde", model: "nano-banana/edit" },
  flux: { label: "Bilde (Flux 1.1 Pro)", usd: 0.04, unit: "per bilde", model: "flux-1.1-pro" },
  i2v: { label: "Video (i2v)", usd: 0.12, unit: "per sekund", model: "seedance/v1/pro" },
  tts: { label: "Voice-over", usd: 0.1, unit: "per 1000 tegn", model: "elevenlabs/multilingual-v2" },
  audio: { label: "Musikk/lyd", usd: 0.02, unit: "per generering", model: "stable-audio" },
  upscale: { label: "Upscale", usd: 0.01, unit: "per bilde", model: "clarity-upscaler" },
};

export interface CostLine {
  op: FalOp;
  label: string;
  qty: number;
  unit: string;
  usd: number;
}

export interface CostEstimate {
  usd: number;
  nok: number;
  lines: CostLine[];
  /** true når estimatet er beheftet med usikkerhet (alltid true — det er estimat). */
  isEstimate: true;
}

/** Kostnad for `qty` enheter av én operasjon. */
export function opCost(op: FalOp, qty = 1): number {
  return FAL_PRICES[op].usd * qty;
}

/** Bygg et fullt estimat fra en liste (op, qty)-par. */
export function estimate(items: Array<{ op: FalOp; qty: number }>): CostEstimate {
  const lines: CostLine[] = items
    .filter((it) => it.qty > 0)
    .map((it) => {
      const p = FAL_PRICES[it.op];
      return { op: it.op, label: p.label, qty: it.qty, unit: p.unit, usd: p.usd * it.qty };
    });
  const usd = lines.reduce((s, l) => s + l.usd, 0);
  return { usd, nok: usd * USD_TO_NOK, lines, isEstimate: true };
}

/** Formater USD kompakt: <$0.01 unngår "$0.00". */
export function fmtUsd(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(usd < 1 ? 2 : 2)}`;
}

/** Formater NOK kompakt. */
export function fmtNok(nok: number): string {
  if (nok <= 0) return "0 kr";
  if (nok < 0.1) return "<0,1 kr";
  return `${nok.toFixed(nok < 10 ? 1 : 0).replace(".", ",")} kr`;
}

/** Kort "≈ $0,23 (2,5 kr)"-streng for badges. */
export function fmtBoth(usd: number): string {
  return `≈ ${fmtUsd(usd)} (${fmtNok(usd * USD_TO_NOK)})`;
}

// ── Ad Film-estimering ────────────────────────────────────────────────
// Går gjennom en AdFilmSpec-lignende struktur og estimerer full film-kostnad
// (stills + evt. continuity-edits + QC-regenerering + i2v + VO + musikk).

interface FilmShotLike {
  id: string;
  dur?: number;
  ui_key?: boolean;
}
interface FilmSpecLike {
  shots: FilmShotLike[];
  vo_lines?: Array<{ en?: string; no?: string }>;
  character?: { ref_still?: string };
  music?: string | null;
}

export interface FilmCostOptions {
  /** Gjennomsnittlig antall QC-forsøk per still (1 = ingen regenerering, 3 = maks). */
  qcTriesAvg?: number;
  /** Ta med Seedance-animasjon av hvert klipp (dyrt). */
  animate?: boolean;
  /** Ta med musikk-generering. */
  generateMusic?: boolean;
}

/**
 * Estimer kostnaden for en hel ad-film. ui_key-shots animeres også (den ekte
 * UI-en keyes inn etterpå — men platen må fortsatt genereres + evt. animeres).
 */
export function estimateFilm(spec: FilmSpecLike, opts: FilmCostOptions = {}): CostEstimate {
  const { qcTriesAvg = 1, animate = false, generateMusic = false } = opts;
  const nShots = spec.shots.length;
  const hasRef = Boolean(spec.character?.ref_still);

  const items: Array<{ op: FalOp; qty: number }> = [];
  // 1 kanonisk referanse (t2i) hvis continuity brukes
  if (hasRef) items.push({ op: "t2i", qty: 1 });
  // per-shot still: edit hvis continuity, ellers t2i — ganget med snitt QC-forsøk
  const stillOp: FalOp = hasRef ? "edit" : "t2i";
  items.push({ op: stillOp, qty: Math.ceil(nShots * qcTriesAvg) });

  if (animate) {
    const totalSec = spec.shots.reduce((s, sh) => s + (sh.dur ?? 4), 0);
    items.push({ op: "i2v", qty: Math.ceil(totalSec) });
  }
  // VO: per-linje TTS, estimer tegn fra VO-tekst
  const chars = (spec.vo_lines ?? []).reduce(
    (s, l) => s + (l.en?.length ?? 0) + (l.no?.length ?? 0),
    0,
  );
  if (chars > 0) items.push({ op: "tts", qty: Math.max(1, Math.round(chars / 1000)) });
  if (generateMusic && spec.music) items.push({ op: "audio", qty: 1 });

  return estimate(items);
}

/**
 * Choreography Builder — datamodell.
 *
 * Beskriver en koreografi som en sekvens av tids-segmenter, der hver
 * segment har metadata på flere "lag" (musikk-cue, formasjon, kamera,
 * lys, kostyme, notater). Dette er hovedfunksjonen i dans-vertikalen.
 *
 * Designprinsipp: tider er lagret som sekunder fra start (`startSec`,
 * `endSec`) — IKKE som ISO-strenger. Dette gjør timeline-aritmetikk
 * triviell (overlap-sjekk, varighet, prosent av total). Render-laget
 * kan formattere mm:ss ved behov.
 *
 * Backend-mapping (når DB-skjema bygges senere): hver `Choreography`
 * blir én rad i `dance_choreography`-tabellen, og `segments` blir én
 * rad pr i `dance_choreography_segment` med foreign-key tilbake.
 */

import type { BrandingTextTokenKey } from '../config/branding';

// ─── Segment-typer (de 9 fra brukerens spec) ─────────────────────────────

export type SegmentKind =
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'break'
  | 'outro'
  | 'freestyle'
  | 'lift'
  | 'formation_change';

export interface SegmentKindMeta {
  kind: SegmentKind;
  labelToken: BrandingTextTokenKey;
  /** Akkrediteringsfarge for timeline-blokken — gjør det visuelt
   *  raskt å lese koreografi-strukturen (refrenger samme farge etc). */
  color: string;
}

/** Sentral konfigurasjon — én sannhet for både farger og labels.
 *  Brukes både i timeline-blokker og i type-velger-menyen. */
export const SEGMENT_KINDS: readonly SegmentKindMeta[] = [
  { kind: 'intro',             labelToken: 'choreographySegmentIntro',            color: '#6366f1' }, // indigo
  { kind: 'verse',             labelToken: 'choreographySegmentVerse',            color: '#3b82f6' }, // blue
  { kind: 'chorus',            labelToken: 'choreographySegmentChorus',           color: '#ec4899' }, // pink
  { kind: 'bridge',            labelToken: 'choreographySegmentBridge',           color: '#a78bfa' }, // light purple
  { kind: 'break',             labelToken: 'choreographySegmentBreak',            color: '#f59e0b' }, // amber
  { kind: 'outro',             labelToken: 'choreographySegmentOutro',            color: '#8b5cf6' }, // purple
  { kind: 'freestyle',         labelToken: 'choreographySegmentFreestyle',        color: '#10b981' }, // emerald
  { kind: 'lift',              labelToken: 'choreographySegmentLift',             color: '#f43f5e' }, // rose
  { kind: 'formation_change',  labelToken: 'choreographySegmentFormationChange',  color: '#06b6d4' }, // cyan
] as const;

// ─── Energi-nivåer ───────────────────────────────────────────────────────

export type EnergyLevel = 'low' | 'controlled' | 'medium' | 'high' | 'sharp' | 'explosive';

export interface EnergyLevelMeta {
  level: EnergyLevel;
  labelToken: BrandingTextTokenKey;
  /** 1-6, brukes til å rendre en compact bar-meter. */
  intensity: number;
  color: string;
}

export const ENERGY_LEVELS: readonly EnergyLevelMeta[] = [
  { level: 'low',         labelToken: 'choreographyEnergyLow',         intensity: 1, color: '#94a3b8' },
  { level: 'controlled',  labelToken: 'choreographyEnergyControlled',  intensity: 2, color: '#60a5fa' },
  { level: 'medium',      labelToken: 'choreographyEnergyMedium',      intensity: 3, color: '#34d399' },
  { level: 'high',        labelToken: 'choreographyEnergyHigh',        intensity: 4, color: '#fbbf24' },
  { level: 'sharp',       labelToken: 'choreographyEnergySharp',       intensity: 5, color: '#f97316' },
  { level: 'explosive',   labelToken: 'choreographyEnergyExplosive',   intensity: 6, color: '#ef4444' },
] as const;

// ─── Godkjenningsstatus ──────────────────────────────────────────────────

export type ApprovalStatus = 'draft' | 'review' | 'approved' | 'locked';

export interface ApprovalStatusMeta {
  status: ApprovalStatus;
  labelToken: BrandingTextTokenKey;
  color: string;
}

export const APPROVAL_STATUSES: readonly ApprovalStatusMeta[] = [
  { status: 'draft',     labelToken: 'choreographyApprovalDraft',     color: '#9ca3af' },
  { status: 'review',    labelToken: 'choreographyApprovalReview',    color: '#fbbf24' },
  { status: 'approved',  labelToken: 'choreographyApprovalApproved',  color: '#34d399' },
  { status: 'locked',    labelToken: 'choreographyApprovalLocked',    color: '#ef4444' },
] as const;

// ─── Timeline-lag (de 7 fra brukerens spec) ──────────────────────────────

export type TimelineLayerKind =
  | 'music'
  | 'choreography'
  | 'formation'
  | 'camera'
  | 'lighting'
  | 'costumes'
  | 'notes';

export interface TimelineLayerMeta {
  kind: TimelineLayerKind;
  labelToken: BrandingTextTokenKey;
  /** Hvilket felt på Segment leverer verdien for dette laget? */
  segmentField: keyof Segment | 'kind';
  color: string;
  /** Music-laget rendres som waveform-stripe; de andre som tekst-blokker. */
  variant: 'waveform' | 'block' | 'text' | 'meter';
}

export const TIMELINE_LAYERS: readonly TimelineLayerMeta[] = [
  { kind: 'music',        labelToken: 'choreographyLayerMusic',         segmentField: 'musicCue',     color: '#8b5cf6', variant: 'waveform' },
  { kind: 'choreography', labelToken: 'choreographyLayerChoreography',  segmentField: 'kind',         color: '#a78bfa', variant: 'block'    },
  { kind: 'formation',    labelToken: 'choreographyLayerFormation',     segmentField: 'formation',    color: '#06b6d4', variant: 'text'     },
  { kind: 'camera',       labelToken: 'choreographyLayerCamera',        segmentField: 'camera',       color: '#3b82f6', variant: 'text'     },
  { kind: 'lighting',     labelToken: 'choreographyLayerLighting',      segmentField: 'lighting',     color: '#f59e0b', variant: 'text'     },
  { kind: 'costumes',     labelToken: 'choreographyLayerCostumes',      segmentField: 'costume',      color: '#ec4899', variant: 'text'     },
  { kind: 'notes',        labelToken: 'choreographyLayerNotes',         segmentField: 'movementNotes', color: '#9ca3af', variant: 'text'    },
] as const;

// ─── Hoved-typene ────────────────────────────────────────────────────────

export interface Segment {
  /** Stabil id — UUID når persistert, midlertidig 'tmp-…' når lokalt opprettet. */
  id: string;
  kind: SegmentKind;
  /** Visningsetikett — overrides type-default. F.eks. 'Refreng 1' i stedet for bare 'Refreng'. */
  label?: string;
  /** Sekunder fra koreografi-start. */
  startSec: number;
  /** Sekunder fra koreografi-start. Må være > startSec. */
  endSec: number;

  // ─── Per-lag metadata ───────────────────────────────
  /** Musikk-cue (f.eks. "0:34 — Drop"). */
  musicCue?: string;
  /** Formasjon — kortbeskrivelse eller referanse til formasjons-bibliotek. */
  formation?: string;
  /** Kamera / video-direksjon — wide / close / track / static. */
  camera?: string;
  /** Lys-direksjon — low / warm / hot / sharp / pulse. */
  lighting?: string;
  /** Kostyme / props i bruk for dette segmentet. */
  costume?: string;
  /** Bevegelses-notater (fri tekst). */
  movementNotes?: string;
  /** Energi-nivå. */
  energy: EnergyLevel;
  /** Dansere involvert — initialer eller ID-referanser. */
  dancers: string[];
  /** Video-referanse-URL eller frame-id fra referansearkivet. */
  videoRefUrl?: string;
  /** Godkjenningsstatus. */
  approval: ApprovalStatus;
  /** 8-count nedbrytning — bygges i CountGrid-komponenten. Persisteres som
   *  JSONB på DB-segmentet (count_grid, migration 0064). */
  countGrid?: CountGrid;
}

export interface CountEntry {
  count: number;
  movement?: string;
  position?: string;
  formation?: string;
  direction?: string;
  energy?: EnergyLevel;
  note?: string;
  videoRefUrl?: string;
}

export interface CountGrid {
  includeLeadup: boolean;
  entries: CountEntry[];
}

export interface Choreography {
  id: string;
  /** Stykke-/koreografi-tittel. */
  title: string;
  /** Koreograf-navn (kan være flere — kommaseparert for nå). */
  choreographer?: string;
  /** Total varighet i sekunder. Avledes normalt av siste segment.endSec. */
  totalDurationSec: number;
  /** Musikkstykkets BPM. */
  bpm?: number;
  /** Toneart (f.eks. "G dur" eller "F#m"). */
  musicalKey?: string;
  /** Musikk-tittel + komponist. */
  musicTitle?: string;
  /** Signert R2-URL for opplastet musikk. Forfaller (7-dagers TTL); be om
   *  ny signert URL via `getChoreography` når den er nær utløp. */
  musicUrl?: string | null;
  /** R2-objekt-nøkkel — stabil referanse vi kan re-signere senere. */
  musicStorageKey?: string | null;
  /** Sortert sekvens av segmenter, ikke-overlappende, dekker [0, totalDurationSec]. */
  segments: Segment[];
  /** CreatorHub-prosjekt denne koreografien tilhører. `null` = fri (synlig
   *  i alle scoper). Lagt til i PR #5 for prosjekt-scoping. */
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getSegmentMeta(kind: SegmentKind): SegmentKindMeta {
  return SEGMENT_KINDS.find((s) => s.kind === kind) ?? SEGMENT_KINDS[0];
}

export function getEnergyMeta(level: EnergyLevel): EnergyLevelMeta {
  return ENERGY_LEVELS.find((e) => e.level === level) ?? ENERGY_LEVELS[2];
}

export function getApprovalMeta(status: ApprovalStatus): ApprovalStatusMeta {
  return APPROVAL_STATUSES.find((a) => a.status === status) ?? APPROVAL_STATUSES[0];
}

export const segmentDuration = (s: Segment): number => Math.max(0, s.endSec - s.startSec);

/**
 * Gir en demo-koreografi som rendrer ferdig i ChoreographyBuilder uten
 * backend. Innholdet er skrevet for å vise hele bredden av features —
 * alle 7 lag har data, segmentene varierer i type/energi/godkjenning.
 */
export function buildDemoChoreography(): Choreography {
  return {
    id: 'demo-choreo-1',
    title: 'Stykke 3 · Arbeiderklassens siste vals',
    choreographer: 'Ingrid Nordahl',
    musicTitle: 'Sigur Rós — Untitled #3 (instrumental)',
    bpm: 84,
    musicalKey: 'F#m',
    totalDurationSec: 70,
    segments: [
      {
        id: 'seg-1', kind: 'intro', startSec: 0, endSec: 12,
        musicCue: 'Strings sveiper inn',
        formation: 'Formation A — V-form, koreograf foran',
        camera: 'Wide, lav vinkel',
        lighting: 'Low key — kun blue-key',
        costume: 'Ensemble: grå overdel',
        movementNotes: 'Ensemblen brer seg ut fra mørket. Pust som rytmesignal.',
        energy: 'low',
        dancers: ['IN', 'MA', 'SO', 'JK', 'LH'],
        approval: 'approved',
        videoRefUrl: 'https://vimeo.com/example/1',
      },
      {
        id: 'seg-2', kind: 'verse', startSec: 12, endSec: 34,
        musicCue: 'Hovedmelodi — kontrabass kommer inn',
        formation: 'Formation A → bryter til diagonal',
        camera: 'Push-in mot Ingrid',
        lighting: 'Low key + warm sidelight stage left',
        costume: 'Ingen endring',
        movementNotes: 'Synkron 8-count. Ingrid bryter på count 24.',
        energy: 'controlled',
        dancers: ['IN', 'MA', 'SO', 'JK', 'LH'],
        approval: 'approved',
      },
      {
        id: 'seg-3', kind: 'chorus', startSec: 34, endSec: 58,
        musicCue: 'Drop — full instrumentering',
        formation: 'Full ensemble — V-form ekspanderer',
        camera: 'Wide → tracking shot venstre',
        lighting: 'Hot — full stage wash',
        costume: 'Ensemble tar av overdel (kostyme-skifte)',
        movementNotes: 'Full energi. 8-count repetert med variasjon. Synkron landing på beat 4.',
        energy: 'high',
        dancers: ['IN', 'MA', 'SO', 'JK', 'LH'],
        approval: 'review',
      },
      {
        id: 'seg-4', kind: 'lift', startSec: 58, endSec: 64,
        musicCue: 'Bridge — perkusjon kutter ut',
        formation: 'Pas de deux foran (resten i mørket)',
        camera: 'Close-up — Ingrid + Martin',
        lighting: 'Single spotlight stage center',
        costume: 'Ingen endring',
        movementNotes: 'Lift sekvens A — 6 sek. Martin støtter Ingrid i tornado-løft.',
        energy: 'sharp',
        dancers: ['IN', 'MA'],
        approval: 'draft',
      },
      {
        id: 'seg-5', kind: 'outro', startSec: 64, endSec: 70,
        musicCue: 'Strings fader ut',
        formation: 'Ensemblen kollapser sentralt',
        camera: 'Pull-back til wide',
        lighting: 'Fade til blackout',
        costume: 'Ingen endring',
        movementNotes: 'Slow-motion fall. Siste pust. Stille i 2 sek før blackout.',
        energy: 'low',
        dancers: ['IN', 'MA', 'SO', 'JK', 'LH'],
        approval: 'draft',
      },
    ],
  };
}

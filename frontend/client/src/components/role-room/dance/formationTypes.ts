/**
 * Formation View — datamodell.
 *
 * En Formation er en navngitt øyeblikksbilde av dansernes plassering på
 * scenen. Koreografien har en liste av Formations som kan animeres
 * mellom. Hver Segment kan referere til én aktiv Formation (via en
 * formationId-felt som legges til Segment senere).
 */

export interface Dancer {
  id: string;
  /** Visningsnavn (fullt). */
  name: string;
  /** Initialer (2-3 tegn) — fallback når photo ikke tilgjengelig. */
  initials: string;
  /** Profil-foto-URL. Vises som puck-bakgrunn hvis satt. */
  photoUrl?: string;
  /** Hovedrolle/posisjon i ensemblet. */
  role?: string;
  /** Farge på puck-rammen — hjelper å skille i tette formasjoner. */
  color?: string;
}

export interface DancerPosition {
  /** Referanse til Dancer.id */
  dancerId: string;
  /** Posisjon på scenen — 0..1 normalisert (0=stage left, 1=stage right) */
  x: number;
  /** Posisjon — 0..1 (0=back/mirror, 1=front/audience) */
  y: number;
  /** Vinkel danseren peker — grader, 0=mot publikum (front), 90=stage right */
  facing?: number;
  /** Markert som leder for denne formasjonen (visuell highlight) */
  isLead?: boolean;
}

/**
 * Bezier-kurve mellom denne formasjonen og neste, eksplisitt tegnet for én
 * danser. Når satt: overstyrer den auto-interpolerte rette linjen i path-
 * visualisering. Hvis ikke satt: bruk lineær interpolasjon mellom
 * (start.x, start.y) og neste-formasjons posisjon.
 *
 * Punkter er normaliserte stage-koordinater (0..1, x = horisontal,
 * y = downstage→upstage). Inkluderer start- og slutt-anker automatisk,
 * så `controlPoints` er bare de TO bezier-kontrollene mellom dem.
 */
export interface DancerTransitionPath {
  dancerId: string;
  controlPoints: ReadonlyArray<{ x: number; y: number }>;
}

export interface Formation {
  id: string;
  /** Beskrivende navn — "Formation A", "V-form ensemble", "Pas de deux center" */
  name: string;
  /** Posisjoner pr danser. Dansere som ikke er i listen er ikke på scenen. */
  positions: DancerPosition[];
  /** Valgfri tekst-beskrivelse. */
  notes?: string;
  /** Når formasjonen ble lagret. */
  createdAt?: string;
  /** DanceFlow-paritet: når på koreografi-timeline formasjonen er aktiv. */
  startSec?: number | null;
  endSec?: number | null;
  /** ID til formasjonen denne kommer FRA i sekvensen. */
  transitionFromId?: string | null;
  /** Kort tekst om overgang fra forrige formasjon. */
  transitionNote?: string | null;
  /** Frie tagger ("Opening", "V-Shape", "Group"). */
  tags?: string[];
  /** F5-13B: eksplisitte bezier-baner FRA denne formasjonen TIL neste, én per danser. */
  transitionPaths?: ReadonlyArray<DancerTransitionPath>;
  /**
   * Workflow-audit G14: lås mot uhellsendringer. Pucks kan ikke flyttes
   * og delete-handler refuserer. Migrasjon 214 persisterer feltet.
   */
  locked?: boolean;
  /**
   * Migrasjon 215 (audit A2): optimistic concurrency-version. Bumpes ved
   * hver UPDATE på server. Klient sender expectedVersion i save så
   * concurrent edits oppdager konflikt (409) i stedet for stillegått siste-
   * skriver-vinner.
   */
  version?: number;
  /**
   * Migrasjon 216 (audit G26): gruppe-label for å samle formasjoner i
   * 'Intro / Vers 1 / Refreng / Bridge / Outro'. NULL/undefined = ingen
   * seksjon.
   */
  sectionName?: string | null;
}

// ─── Demo-data — passer til Stykke 3 fra ChoreographyBuilder ────────────

export const DEMO_DANCERS: readonly Dancer[] = [
  { id: 'd-ingrid',   name: 'Ingrid Nordahl', initials: 'IN', role: 'Solo · protagonist', color: '#3b82f6' },
  { id: 'd-martin',   name: 'Martin Aas',     initials: 'MA', role: 'Pas de deux',         color: '#f59e0b' },
  { id: 'd-sofie',    name: 'Sofie Olsen',    initials: 'SO', role: 'Ensemble',            color: '#10b981' },
  { id: 'd-jonas',    name: 'Jonas K.',       initials: 'JK', role: 'Ensemble',            color: '#8b5cf6' },
  { id: 'd-lea',      name: 'Lea Hansen',     initials: 'LH', role: 'Ensemble',            color: '#ec4899' },
] as const;

export const DEMO_FORMATIONS: readonly Formation[] = [
  {
    id: 'f-a',
    name: 'Formasjon A — V-form ensemble',
    notes: 'Åpningsformasjon. Ingrid foran, ensemblet bak i V.',
    positions: [
      { dancerId: 'd-ingrid', x: 0.50, y: 0.65, facing: 0,  isLead: true },
      { dancerId: 'd-martin', x: 0.35, y: 0.45, facing: 0 },
      { dancerId: 'd-sofie',  x: 0.65, y: 0.45, facing: 0 },
      { dancerId: 'd-jonas',  x: 0.20, y: 0.30, facing: 0 },
      { dancerId: 'd-lea',    x: 0.80, y: 0.30, facing: 0 },
    ],
  },
  {
    id: 'f-b',
    name: 'Formasjon B — pas de deux center',
    notes: 'Refrenget — Ingrid + Martin foran, andre i mørket bak.',
    positions: [
      { dancerId: 'd-ingrid', x: 0.45, y: 0.55, facing: 30,  isLead: true  },
      { dancerId: 'd-martin', x: 0.55, y: 0.55, facing: -30, isLead: true  },
      { dancerId: 'd-sofie',  x: 0.20, y: 0.20, facing: 0 },
      { dancerId: 'd-jonas',  x: 0.50, y: 0.15, facing: 0 },
      { dancerId: 'd-lea',    x: 0.80, y: 0.20, facing: 0 },
    ],
  },
  {
    id: 'f-c',
    name: 'Formasjon C — kollaps sentralt',
    notes: 'Outro — alle samles i sentrum, lavt nivå.',
    positions: [
      { dancerId: 'd-ingrid', x: 0.48, y: 0.50, facing: 0, isLead: true },
      { dancerId: 'd-martin', x: 0.52, y: 0.50, facing: 0 },
      { dancerId: 'd-sofie',  x: 0.46, y: 0.55, facing: 0 },
      { dancerId: 'd-jonas',  x: 0.54, y: 0.55, facing: 0 },
      { dancerId: 'd-lea',    x: 0.50, y: 0.60, facing: 0 },
    ],
  },
] as const;

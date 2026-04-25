/**
 * Rehearsal Planner — datamodell.
 *
 * En Rehearsal er en planlagt prøve med fokus-områder som binder
 * direkte mot ChoreographyBuilder (segment-tider) og FormationView
 * (formasjons-overganger). Etter prøven logges hva som ble godkjent,
 * hva som må repeteres, og hvem som trenger oppfølging.
 *
 * Designprinsipp: en rehearsal er ALLTID knyttet til én choreography.
 * Fokus-områdene refererer til choreography.segments + formations
 * via id, så hvis et segment slettes, viser fokus-området "ukjent
 * segment" — ingen FK-cascade siden vi ikke vil miste prøvelogg-data.
 */

export type RehearsalStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface RehearsalFocusArea {
  id: string;
  /** Beskrivende tittel — "Refrenget", "Formasjons-overgang A→B", "Solo-inngang". */
  title: string;
  /** Valgfri ref til Segment.id (fra choreography). */
  segmentId?: string;
  /** Valgfri tids-rom i sekunder (kan være snevrere enn segmentet). */
  startSec?: number;
  endSec?: number;
  /** Valgfri ref til Formation.id (en eller to — fra/til ved overgang). */
  formationFromId?: string;
  formationToId?: string;
  /** Hva er målet med å øve på dette? */
  goal?: string;
  /** Estimert tid å bruke (minutter). */
  estimatedMinutes?: number;
}

export type RehearsalOutcome = 'approved' | 'needs_repeat' | 'pending';

export interface RehearsalSegmentReview {
  segmentId: string;
  outcome: RehearsalOutcome;
  note?: string;
}

export interface RehearsalDancerFollowUp {
  dancerId: string;
  /** Hva trenger danseren å jobbe med? */
  followUp: string;
  /** Frist før neste prøve (ISO date). */
  dueBy?: string;
}

export interface Rehearsal {
  id: string;
  /** Kobling til Choreography.id i ChoreographyBuilder. */
  choreographyId: string;
  /** "Prøve 3", "Generalprøve", "Solo-pas Ingrid". */
  title: string;
  /** Når prøven er planlagt — ISO datetime. */
  scheduledAt: string;
  /** Estimert total varighet (min). */
  estimatedMinutes: number;
  /** Rom/lokasjon — fri tekst eller ref til lokasjons-bibliotek. */
  location?: string;
  /** Hvem er innkalt — danser-id-er. Tom liste = alle. */
  invitedDancerIds: string[];
  /** Status — planlagt → i gang → ferdig. */
  status: RehearsalStatus;

  // ─── Plan-felt (settes før prøven) ───
  focusAreas: RehearsalFocusArea[];
  videoReviewPlanned?: boolean;
  preNotes?: string;

  // ─── Etter-prøven-felt (settes underveis/etter) ───
  segmentReviews: RehearsalSegmentReview[];
  dancerFollowUps: RehearsalDancerFollowUp[];
  postNotes?: string;
  /** Lenke til opptak-URL fra prøven. */
  recordingUrl?: string;
  /** Hvis koreografien fikk en oppdatering pga prøven, lagre versjonsnoter. */
  choreographyChangelog?: string;

  createdAt?: string;
  updatedAt?: string;
}

// ─── Demo ───────────────────────────────────────────────────────────────

export function buildDemoRehearsal(choreographyId: string): Rehearsal {
  return {
    id: 'reh-demo-1',
    choreographyId,
    title: 'Prøve 3 · Refrenget + formasjons-overganger',
    scheduledAt: '2026-04-26T18:00:00+02:00',
    estimatedMinutes: 135,
    location: 'Studio B · Bårdar',
    invitedDancerIds: ['d-ingrid', 'd-martin', 'd-sofie', 'd-jonas', 'd-lea'],
    status: 'planned',
    focusAreas: [
      {
        id: 'fa-1',
        title: 'Refrenget — full energi',
        segmentId: 'seg-3',
        startSec: 34,
        endSec: 58,
        goal: 'Synkronisere landing på beat 4 i hver 8-count',
        estimatedMinutes: 35,
      },
      {
        id: 'fa-2',
        title: 'Formation B → C overgang',
        formationFromId: 'f-b',
        formationToId: 'f-c',
        goal: 'Glatt overgang uten stopp — ripple-bevegelse fra stage left',
        estimatedMinutes: 25,
      },
      {
        id: 'fa-3',
        title: 'Lift-sekvens (Ingrid + Martin)',
        segmentId: 'seg-4',
        startSec: 58,
        endSec: 64,
        goal: 'Tornado-løft — klar landing, ingen vakling',
        estimatedMinutes: 40,
      },
    ],
    videoReviewPlanned: true,
    preNotes:
      'Sjekk om Ingrid har varmet opp tilstrekkelig for løftet. Test rød kjole-skiftet før refrenget.',
    segmentReviews: [],
    dancerFollowUps: [],
  };
}

/**
 * Story Graph-fixture: et helt spillprosjekt som strukturert innhold (Fase 7a-2).
 *
 * Brukes tre steder: backend seed-skript (`backend/scripts/seed-what-follows-us.ts`),
 * backend fixture-test (zod-validering) og Playwright-mockene (`narrativeMocks.ts`,
 * `seed: 'what-follows-us'`). Fila er ren TS uten DOM/Node-avhengigheter.
 *
 * Innholdsregler (AGENTS.md fra studioet): kildehendelse (`W`/`K`), brukertillegg
 * (`U`), iscenesettelsesforslag (`A`), bevart engelsk (`E`) og ny oversettelse (`T`)
 * holdes fra hverandre via `sourceRefs`/`sourceType`; ingen replikk strykes stille;
 * gater er bare «passed» med reelt bevis; forfatterfasit ligger i `profile.authorTruth`
 * og skal aldri vises i spillerflater.
 */

export type FixtureSourceTag = 'W' | 'K' | 'U' | 'A' | 'E' | 'T';
export interface FixtureSourceRef { tag: FixtureSourceTag; ref: string; field?: string; note?: string }

export interface FixtureSource {
  code: string;
  label: string;
  kind: 'docx' | 'pdf' | 'md' | 'txt' | 'other';
  sha256?: string | null;
  pathHint?: string;
  notes?: string;
}

export interface FixtureEpisode {
  code: string;            // E01
  title: string;
  summary?: string;
  playersLearn?: string;   // «hva spillerne lærer»
  sourceNote?: string;     // «kilde/tilpasning»
  status?: 'draft' | 'locked';
}

export interface FixtureMemoryTrack { code: string; title: string; image?: string; knownAfter?: string }
export interface FixtureCharacterProfile {
  drive?: string;
  changeAction?: string;      // «handling som viser endring»
  establishNow?: string;
  firstPersonalScene?: string;
  revealLater?: string;
  sourceStatus?: string;
  authorTruth?: string;       // intern — aldri i spillerflater
  observable?: string;        // hva spillerne kan observere
  ages?: Partial<Record<'1797' | '1802' | '1817', string>>;
  voiceCast?: { child?: string; adult?: string };
  memoryTrack?: FixtureMemoryTrack[];
  powers?: { mental?: string[]; active?: { name: string; tier: 0 | 1 | 2 | 3 } };
  notes?: string;
}
export interface FixtureLocationProfile {
  eras?: Array<'pre' | '1797' | '1802' | '1817'>;
  continuity?: string;
  geometryStatus?: string;
  props?: string[];
  notes?: string;
}
export interface FixtureGenericProfile { summary?: string; rules?: string[]; notes?: string; [key: string]: unknown }

export interface FixtureComponent {
  customId: string;           // stabil nøkkel for idempotent seed (f.eks. char_elise, loc_swing)
  name: string;
  kind: 'character' | 'location' | 'item' | 'faction' | 'other';
  folderPath?: string;
  profile: FixtureCharacterProfile | FixtureLocationProfile | FixtureGenericProfile;
  attributes?: Array<{ name: string; type: 'string' | 'rich_text' | 'bool' | 'int' | 'float'; value: unknown }>;
}

export interface FixtureLine {
  cueId: string;              // W01.01, U04.01, G03A.1
  speaker: string | null;     // components[].customId eller null (STEMMEN, PÅSKRIFT …)
  speakerLabel: string;       // «NORA, 12», «MINNET AV NORA»
  perspective?: string;
  textEn: string;
  textNb?: string;
  sourceType: 'E' | 'T' | 'E+T' | 'U' | 'A';
  recordingStatus?: 'none' | 'needs_take' | 'recorded' | 'approved';
  note?: string;
}

export interface FixtureGate {
  key: 'script_coverage' | 'greybox' | 'characters_animation' | 'playthrough' | 'picture' | 'audio';
  status: 'not_started' | 'in_progress' | 'passed' | 'failed';
  evidence?: string;          // påkrevd når status = passed
  evidenceRefs?: string[];
}

export interface FixtureScene {
  code: string;               // P01, G03A, H01, K03 (kort kode, unik i prosjektet)
  workingId?: string;         // dokumentets ID (P01, G03A …)
  episode?: string;           // episodes[].code
  title: string;
  subtitle?: string;
  era: 'pre' | '1797' | '1802' | '1817' | 'other';
  status?: 'idea' | 'in_progress' | 'in_review' | 'changes_requested' | 'approved' | 'implemented';
  location?: string;
  challenge?: string;
  gameplayMechanic?: string;
  environment?: string;
  beforeState?: string;
  action?: string;
  control?: string;
  afterState?: string;
  audio?: string;
  changeNote?: string;
  bridge?: string;
  timeNote?: string;
  knowledge?: { actualPast?: string; recollection?: string; ownerPerspective?: string; othersObserve?: string; audienceKnows?: string; saidAloud?: string };
  sourceRefs: FixtureSourceRef[];
  components?: string[];      // components[].customId (karakterer/lokasjoner i scenen)
  lines?: FixtureLine[];
  gates?: FixtureGate[];
  tasks?: Array<{ title: string; status?: 'todo' | 'doing' | 'done' }>;
}

export interface FixtureOpenQuestion {
  code: string;               // Q07, C03, D01 (D = låst beslutning/tidslinje → status done + decision)
  kind: 'question' | 'check';
  question: string;
  context?: string;
  status?: 'open' | 'done' | 'dropped';
  decision?: string;
  sourceRefs?: FixtureSourceRef[];
}

export interface FixtureMilestone {
  title: string;
  lane: 'story' | 'greybox' | 'characters' | 'playtest' | 'picture_audio' | 'engineering' | 'other';
  status?: 'planned' | 'in_progress' | 'done' | 'blocked';
  description?: string;
  acceptance?: string;
  evidence?: string;
  startAt?: string | null;
  dueAt?: string | null;
  scenes?: string[];          // scenes[].code
}

export interface FixturePlatformRequirement { code: string; text: string; status: 'unverified' | 'verified' | 'failed'; evidence?: string; source?: string }
export interface FixturePlatformTarget {
  name: string;
  platform: 'ipad' | 'iphone' | 'mac' | 'pc' | 'console' | 'web' | 'other';
  isPrimary?: boolean;
  engine?: string;
  osMin?: string;
  deviceMin?: string;
  inputModel?: string;
  budgets?: Record<string, unknown>;
  requirements?: FixturePlatformRequirement[];
  visualDirection?: Record<string, unknown>;
  notes?: string;
}

export interface StoryGraphFixture {
  meta: { slug: string; title: string; version: string; extractedAt: string; documents: string[]; notes?: string };
  sources: FixtureSource[];
  episodes: FixtureEpisode[];
  components: FixtureComponent[];
  scenes: FixtureScene[];
  openQuestions: FixtureOpenQuestion[];
  milestones: FixtureMilestone[];
  platformTargets: FixturePlatformTarget[];
}

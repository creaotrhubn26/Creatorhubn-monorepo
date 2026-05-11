/**
 * StoryLogic types — alle interface/type-definisjoner brukt på tvers av
 * StoryLogicPanel-orkestrator og fase-komponenter (ConceptPhase,
 * LoglinePhase, ThemePhase, ValidationDisplay, PhaseHeader).
 *
 * Ekstraktert fra StoryLogicPanel.tsx for å gjenvinne type-sikkerhet
 * (orkestrator-fila har @ts-nocheck pga størrelse 3782 linjer) og for å
 * kunne unit-teste validators isolert via Vitest.
 */

export type StoryPhaseKey = 'concept' | 'logline' | 'theme';

export type StartMode = 'idea' | 'character' | 'theme';

export interface ConceptData {
  corePremise: string;
  genre: string;
  subGenre: string;
  tone: string[];
  targetAudience: string;
  audienceAge: string;
  whyNow: string;
  uniqueAngle: string;
  marketComparables: string;
}

export interface LoglineData {
  protagonist: string;
  protagonistTrait: string;
  goal: string;
  antagonisticForce: string;
  stakes: string;
  fullLogline: string;
  loglineScore: number;
}

export interface ThemeData {
  centralTheme: string;
  themeStatement: string;
  protagonistFlaw: string;
  flawOrigin: string;
  whatMustChange: string;
  transformationArc: string;
  emotionalJourney: string[];
  moralArgument: string;
}

export interface PhaseLocks {
  concept: boolean;
  logline: boolean;
  theme: boolean;
}

export interface StoryVersion {
  id: string;
  label: string;
  timestamp: string;
  /** JSON-stringified state snapshot */
  snapshot: string;
}

export type PhaseStatus = 'incomplete' | 'weak' | 'ready';

export interface StoryLogicState {
  concept: ConceptData;
  logline: LoglineData;
  theme: ThemeData;
  currentPhase: number;
  phaseStatus: {
    concept: PhaseStatus;
    logline: PhaseStatus;
    theme: PhaseStatus;
  };
  lastSaved: string | null;
  locks: PhaseLocks;
  versions: StoryVersion[];
}

export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  data: Partial<StoryLogicState>;
}

export interface ValidationWarning {
  message: string;
  fieldId: string;
  impact: string;
  pointsLost: number;
}

export interface CoachingTip {
  example: string;
  template: string;
  avoid: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  warnings: ValidationWarning[];
  suggestions: string[];
  affirmations: string[];
  coaching: CoachingTip[];
  contradictions: string[];
  nextBestAction: string | null;
}

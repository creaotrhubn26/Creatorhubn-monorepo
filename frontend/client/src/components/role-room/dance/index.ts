/**
 * Dans-vertikalen — public exports.
 *
 * Komponenter under denne mappa er opt-in og brukes kun når
 * `professionMode` er 'dance_studio' eller 'dance_freelance'. Eksisterende
 * film/foto-flyt importerer ingenting herfra.
 */

export { DanceDashboard, type DanceDashboardProps } from './DanceDashboard';
export { ChoreographyBuilder, type ChoreographyBuilderProps } from './ChoreographyBuilder';
export { FormationView, type FormationViewProps } from './FormationView';
export {
  DEMO_DANCERS,
  DEMO_FORMATIONS,
  type Dancer,
  type DancerPosition,
  type Formation,
} from './formationTypes';
export { CountGrid, type CountGridProps, type CountEntry, type CountGridState } from './CountGrid';
export { RehearsalPlanner, type RehearsalPlannerProps } from './RehearsalPlanner';
export {
  buildDemoRehearsal,
  type Rehearsal,
  type RehearsalFocusArea,
  type RehearsalSegmentReview,
  type RehearsalDancerFollowUp,
  type RehearsalStatus,
  type RehearsalOutcome,
} from './rehearsalTypes';
export * as choreographyService from './choreographyService';
export {
  buildDemoChoreography,
  formatTime as formatChoreographyTime,
  getApprovalMeta,
  getEnergyMeta,
  getSegmentMeta,
  segmentDuration,
  SEGMENT_KINDS,
  ENERGY_LEVELS,
  APPROVAL_STATUSES,
  TIMELINE_LAYERS,
  type ApprovalStatus,
  type Choreography,
  type EnergyLevel,
  type Segment,
  type SegmentKind,
  type TimelineLayerKind,
} from './choreographyTypes';

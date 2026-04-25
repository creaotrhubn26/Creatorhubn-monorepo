/**
 * Dans-vertikalen — public exports.
 *
 * Komponenter under denne mappa er opt-in og brukes kun når
 * `professionMode` er 'dance_studio' eller 'dance_freelance'. Eksisterende
 * film/foto-flyt importerer ingenting herfra.
 */

export { DanceDashboard, type DanceDashboardProps } from './DanceDashboard';
export { DanceWorkspace, type DanceWorkspaceProps } from './DanceWorkspace';
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

// ─── PR #5: prosjekt-scoping + booking/crew-gjenbruk ─────────────────────
export {
  toDancerProfile,
  getInitials,
  crewMemberToDancer,
  type DancerProfile,
  type DancerProfileExtras,
  type DancerAvailabilityWindow,
  type DanceStyle,
  type InjuryStatus,
} from './dancerProfile';
export {
  DanceProjectCalendar,
  type DanceProjectCalendarProps,
} from './DanceProjectCalendar';
export {
  DancerAvailabilityPanel,
  type DancerAvailabilityPanelProps,
} from './DancerAvailabilityPanel';

// ─── PR #6: Dancer Profiles (lagt til 2026-04-25) ─────────────────────────
export {
  DancerProfileCard,
  type DancerProfileCardProps,
} from './DancerProfileCard';
export {
  DancerProfileEditor,
  type DancerProfileEditorProps,
} from './DancerProfileEditor';
export {
  DancerProfileGrid,
  type DancerProfileGridProps,
} from './DancerProfileGrid';
export {
  listDancerProfiles,
  getDancerProfile,
  upsertDancerProfile,
  deleteDancerProfile,
  type DancerProfile as DancerProfileRecord,
  type DancerProfileExtras as DancerProfileExtrasFields,
  type DancerAvailabilityWindow as DancerProfileAvailabilityWindow,
  type DancerBodyMeasurements,
  type SkillLevel,
  type SkillCategory,
} from './dancerProfileService';
export { DEMO_DANCER_PROFILES } from './dancerProfileDemo';

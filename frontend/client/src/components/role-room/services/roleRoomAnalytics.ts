/**
 * roleRoomAnalytics.ts
 *
 * Typed GA4-event-helpers for The Role Room.
 *
 * Hvert event har en dedikert funksjon med strikt parameter-skjema,
 * slik at event-navn og payload-keys er kanoniske ett sted. Alle
 * events bruker prefiks `role_room_` for å gjøre GA4-filtering
 * trivielt (begins-with).
 *
 * Verifiseres av: frontend/e2e/role-room-ga4-events.spec.ts
 */

import { trackEvent } from '@/utils/ga4-client-tracking';

// ── Param-typer ──────────────────────────────────────────────────

interface ProjectCreatedParams {
  project_id: string;
  source: 'wizard' | 'manual' | 'template';
  role_count?: number;
}

interface RoleCreatedParams {
  project_id: string;
  role_id: string;
  category?: string;
}

interface CandidateAddedParams {
  project_id: string;
  role_id: string;
  source?: 'manual' | 'pool' | 'invite';
}

interface AuditionCreatedParams {
  project_id: string;
  audition_id: string;
  candidate_count?: number;
  has_location?: boolean;
}

interface ScheduleConfirmedParams {
  project_id: string;
  schedule_id: string;
  role_id?: string;
}

interface TabChangedParams {
  project_id?: string;
  tab_id: string;
  from_tab?: string;
}

interface AuditionViewToggledParams {
  project_id: string;
  mode: 'synthetic' | 'entity';
}

interface LocationAddedParams {
  project_id: string;
  location_id: string;
  source?: 'manual' | 'search';
}

interface LocationAnalyzedParams {
  project_id: string;
  location_id?: string;
  analysis_type?: string;
}

interface EquipmentAddedParams {
  project_id: string;
  equipment_id: string;
  category?: string;
}

interface CrewAssignedParams {
  project_id: string;
  crew_id: string;
  role?: string;
}

interface StoryboardFrameCreatedParams {
  project_id: string;
  frame_id: string;
  scene_id?: string;
}

// ── Helpers ──────────────────────────────────────────────────────

export const roleRoomAnalytics = {
  // P0 — Core conversion funnel
  projectCreated: (p: ProjectCreatedParams) =>
    trackEvent('role_room_project_created', p as Record<string, unknown>),

  roleCreated: (p: RoleCreatedParams) =>
    trackEvent('role_room_role_created', p as Record<string, unknown>),

  candidateAdded: (p: CandidateAddedParams) =>
    trackEvent('role_room_candidate_added', p as Record<string, unknown>),

  auditionCreated: (p: AuditionCreatedParams) =>
    trackEvent('role_room_audition_created', p as Record<string, unknown>),

  scheduleConfirmed: (p: ScheduleConfirmedParams) =>
    trackEvent('role_room_schedule_confirmed', p as Record<string, unknown>),

  // P1 — Engagement & feature usage
  tabChanged: (p: TabChangedParams) =>
    trackEvent('role_room_tab_changed', p as Record<string, unknown>),

  auditionViewToggled: (p: AuditionViewToggledParams) =>
    trackEvent('role_room_audition_view_toggled', p as Record<string, unknown>),

  locationAdded: (p: LocationAddedParams) =>
    trackEvent('role_room_location_added', p as Record<string, unknown>),

  locationAnalyzed: (p: LocationAnalyzedParams) =>
    trackEvent('role_room_location_analyzed', p as Record<string, unknown>),

  equipmentAdded: (p: EquipmentAddedParams) =>
    trackEvent('role_room_equipment_added', p as Record<string, unknown>),

  crewAssigned: (p: CrewAssignedParams) =>
    trackEvent('role_room_crew_assigned', p as Record<string, unknown>),

  storyboardFrameCreated: (p: StoryboardFrameCreatedParams) =>
    trackEvent('role_room_storyboard_frame_created', p as Record<string, unknown>),
};

export type RoleRoomAnalytics = typeof roleRoomAnalytics;

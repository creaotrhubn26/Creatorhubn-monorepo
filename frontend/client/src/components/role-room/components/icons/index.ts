/**
 * Role Room PNG Icon Registry
 *
 * Barrel export mapping tab names → pre-bound icon components.
 * Each component accepts the same { sx, style, ... } API as CastingIcons.
 */

import { createRoleRoomIcon } from './RoleRoomIcon';

// PNG imports (Vite resolves these to hashed URLs at build time)
import dashboardPng from './Keep/roleroom_dashboard.png';
import castingDirectorPng from './Keep/roleroom_casting_director.png';
import kandidaterPng from './Keep/roleroom_kandidater.png';
import cameraPng from './Keep/roleroom_camera.png';
import crewPng from './Keep/roleroom_crew.png';
import locationPng from './Keep/roleroom_location.png';
import equipPng from './Keep/roleroom_equip.png';
import calenderPng from './Keep/roleroom_calender.png';
import scenesPng from './Keep/roleroom_scenes.png';
import storylogicPng from './Keep/roleroom_storylogic.png';
import comPng from './Keep/roleroom_com.png';

// ── Tab icons (same API as CastingIcons SVG components) ─────────────────────

/** Tab 0 — Dashboard / Oversikt */
export const DashboardTabIcon = createRoleRoomIcon(dashboardPng, 'Dashboard');

/** Tab 1 — Roller (Roles) */
export const RolesTabIcon = createRoleRoomIcon(castingDirectorPng, 'Roller');

/** Tab 2 — Kandidater (Candidates) */
export const CandidatesTabIcon = createRoleRoomIcon(kandidaterPng, 'Kandidater');

/** Tab 3 — Auditions */
export const AuditionsTabIcon = createRoleRoomIcon(cameraPng, 'Auditions');

/** Tab 4 — Team / Crew */
export const TeamTabIcon = createRoleRoomIcon(crewPng, 'Team');

/** Tab 5 — Lokasjoner (Locations) */
export const LocationsTabIcon = createRoleRoomIcon(locationPng, 'Lokasjoner');

/** Tab 6 — Rekvisitter / Utstyr (Equipment) */
export const EquipmentTabIcon = createRoleRoomIcon(equipPng, 'Utstyr');

/** Tab 7 — Produksjonsplan (Calendar) */
export const CalendarTabIcon = createRoleRoomIcon(calenderPng, 'Kalender');

/** Tab 8 — Shot Lists */
export const ShotListTabIcon = createRoleRoomIcon(scenesPng, 'Shot Lists');

/** Tab 9 — Story Arc Studio */
export const StoryArcTabIcon = createRoleRoomIcon(storylogicPng, 'Story Arc');

/** Tab 10 — Deling (Sharing) */
export const SharingTabIcon = createRoleRoomIcon(comPng, 'Deling');

/** Tab 11 — Live Set Mode (on-set operational tool) */
export const LiveSetTabIcon = createRoleRoomIcon(cameraPng, 'Live Set');

// ── PNG source re-exports (for RoleRoomEmptyState) ──────────────────────────

export {
  dashboardPng,
  castingDirectorPng,
  kandidaterPng,
  cameraPng,
  crewPng,
  locationPng,
  equipPng,
  calenderPng,
  scenesPng,
  storylogicPng,
  comPng,
};

// Re-export components
export { RoleRoomIcon, createRoleRoomIcon } from './RoleRoomIcon';
export type { RoleRoomIconProps } from './RoleRoomIcon';
export { RoleRoomEmptyState } from './RoleRoomEmptyState';
export type { RoleRoomEmptyStateProps } from './RoleRoomEmptyState';

/**
 * Canonical registry for Role Room production workspace lenses.
 *
 * A lens is a role-tailored composition over the shared project graph. The
 * registry owns the facts that used to be spread across nested conditionals in
 * `CastingPlannerPanel.tsx`: which project roles select a lens by default, how
 * the lens maps to the production role catalogue, and which URL parameters the
 * lens drives.
 *
 * The registry is presentation and navigation only. Access is still decided by
 * the caller and must always be enforced on the server as well.
 */

import type { ProductionWorkspaceKind } from '../../config/productionRoleCatalog';
import type { RoleRoomWorkspaceLens } from './productionWorkspaceLens';

/** Lenses that map to a dedicated role workspace. `full` is the fallback. */
export type RoleWorkspaceLens = Exclude<RoleRoomWorkspaceLens, 'full'>;

/**
 * How a lens fills the `surface` URL parameter.
 *
 * - `own`: the lens tracks its own surface state.
 * - `none`: the lens has no surface concept and clears the parameter.
 * - `planner`: the lens falls back to the shared planner surface.
 */
export type LensSurfaceSource = 'own' | 'none' | 'planner';

export interface WorkspaceLensEntry {
  readonly lens: RoleWorkspaceLens;
  /**
   * Bridge to `PRODUCTION_ROLES[].workspace` in the role catalogue. Absent for
   * a lens that is a platform surface rather than a production role.
   */
  readonly workspaceKind?: ProductionWorkspaceKind;
  /**
   * Normalised project roles that make this lens the default for a member.
   * Persisted aliases are included so historic rows keep resolving.
   */
  readonly projectRoles: readonly string[];
  readonly surfaceSource: LensSurfaceSource;
  /** Only the director lens deep-links a scene today. */
  readonly usesSceneParam: boolean;
}

/**
 * Resolution order. The first entry that is both allowed and selected wins,
 * which preserves the precedence the panel applied before the registry.
 */
export const WORKSPACE_LENS_REGISTRY = [
  {
    lens: 'producer',
    workspaceKind: 'producer',
    projectRoles: ['executive_producer', 'producer', 'line_producer'],
    surfaceSource: 'none',
    usesSceneParam: false,
  },
  {
    lens: 'director',
    workspaceKind: 'director',
    projectRoles: ['director'],
    surfaceSource: 'own',
    usesSceneParam: true,
  },
  {
    lens: 'casting',
    workspaceKind: 'casting',
    projectRoles: ['casting_director', 'local_casting_director', 'extras_casting_director'],
    surfaceSource: 'own',
    usesSceneParam: false,
  },
  {
    lens: 'cinematography',
    workspaceKind: 'cinematography',
    projectRoles: ['cinematographer', 'director_of_photography', 'dop', 'dp'],
    surfaceSource: 'own',
    usesSceneParam: false,
  },
  {
    lens: 'assistant-direction',
    workspaceKind: 'assistant_direction',
    projectRoles: [
      'first_ad',
      'first_assistant_director',
      '1st_ad',
      'second_ad',
      'second_assistant_director',
      '2nd_ad',
      'second_second_assistant_director',
      '2nd_2nd_ad',
      'set_production_assistant',
      'set_pa',
    ],
    surfaceSource: 'own',
    usesSceneParam: false,
  },
  {
    lens: 'production-management',
    workspaceKind: 'production_management',
    projectRoles: ['production_manager', 'production_accountant'],
    surfaceSource: 'none',
    usesSceneParam: false,
  },
  {
    lens: 'production-coordination',
    workspaceKind: 'production_coordination',
    projectRoles: [
      'production_coordinator',
      'production_secretary',
      'office_production_assistant',
      'office_pa',
      'production_assistant',
    ],
    surfaceSource: 'none',
    usesSceneParam: false,
  },
  {
    lens: 'location-management',
    workspaceKind: 'location_management',
    projectRoles: ['location_manager', 'location_scout', 'location_security'],
    surfaceSource: 'none',
    usesSceneParam: false,
  },
  {
    // `planner` keeps the behaviour the panel had before the registry: the
    // continuity lens never set its own surface and fell through to the shared
    // planner surface. Give continuity an own surface only together with a
    // deliberate URL-contract change.
    lens: 'continuity',
    workspaceKind: 'continuity',
    projectRoles: ['script_supervisor'],
    surfaceSource: 'planner',
    usesSceneParam: false,
  },
  {
    lens: 'art-department',
    workspaceKind: 'art_department',
    projectRoles: [
      'production_designer',
      'set_designer',
      'concept_illustrator',
      'storyboard_artist',
      'costume_designer',
      'wardrobe_supervisor',
      'set_decorator',
      'on_set_dresser',
      'greensperson',
      'property_master',
      'assistant_property_master',
      'key_hair_stylist',
      'key_makeup_artist',
      'construction_coordinator',
    ],
    surfaceSource: 'own',
    usesSceneParam: false,
  },
  {
    lens: 'production-sound',
    workspaceKind: 'production_sound',
    projectRoles: ['production_sound_mixer', 'sound_mixer', 'audio_mixer', 'sound_engineer', 'boom_operator'],
    surfaceSource: 'own',
    usesSceneParam: false,
  },
  {
    // The Admin Room as a lens. No project role selects it — `projectRoles` is
    // empty on purpose — so it opens only on an explicit choice, and only for a
    // caller the panel considers super admin. It is also the one lens that does
    // not need an open project.
    lens: 'admin',
    projectRoles: [],
    surfaceSource: 'none',
    usesSceneParam: false,
  },
] as const satisfies readonly WorkspaceLensEntry[];

/**
 * Assistant direction renders two different workspaces, so the panel still
 * needs the first/second split that the combined lens entry flattens.
 */
export const FIRST_ASSISTANT_DIRECTOR_PROJECT_ROLES: readonly string[] = [
  'first_ad',
  'first_assistant_director',
  '1st_ad',
];

export const SECOND_ASSISTANT_DIRECTOR_PROJECT_ROLES: readonly string[] = [
  'second_ad',
  'second_assistant_director',
  '2nd_ad',
  'second_second_assistant_director',
  '2nd_2nd_ad',
  'set_production_assistant',
  'set_pa',
];

export function getWorkspaceLensEntry(lens: RoleWorkspaceLens): WorkspaceLensEntry {
  const entry = WORKSPACE_LENS_REGISTRY.find((candidate) => candidate.lens === lens);
  if (!entry) {
    throw new Error(`Unknown Role Room workspace lens: ${lens}`);
  }
  return entry;
}

/** Project roles that select `lens` by default, without any permission check. */
export function matchesLensProjectRole(lens: RoleWorkspaceLens, projectRole: unknown): boolean {
  if (typeof projectRole !== 'string') return false;
  const normalised = projectRole.trim().toLowerCase();
  if (!normalised) return false;
  return getWorkspaceLensEntry(lens).projectRoles.includes(normalised);
}

export interface WorkspaceLensResolution {
  /** Explicit lens the member picked, or `null` for "use my assigned role". */
  readonly preference: RoleRoomWorkspaceLens | null;
  /** The member holds the project role this lens belongs to. */
  readonly isAssigned: (lens: RoleWorkspaceLens) => boolean;
  /** The member is permitted to open this lens at all. */
  readonly isAllowed: (lens: RoleWorkspaceLens) => boolean;
}

/**
 * Pick the lens to render. An explicit preference wins over the assigned role,
 * but never over permission: a lens the member may not open is skipped, and the
 * full workspace is the fallback.
 */
export function resolveWorkspaceLens(input: WorkspaceLensResolution): RoleRoomWorkspaceLens {
  const { preference, isAssigned, isAllowed } = input;
  for (const entry of WORKSPACE_LENS_REGISTRY) {
    if (!isAllowed(entry.lens)) continue;
    if (preference === entry.lens || (preference === null && isAssigned(entry.lens))) {
      return entry.lens;
    }
  }
  return 'full';
}

/**
 * True while the caller has asked for a lens whose permission has not been
 * decided yet. Only the admin lens has an asynchronous gate: it waits for the
 * server to confirm the session. Until then neither answer is known, and both
 * available answers are wrong — rendering the full workspace shows the wrong
 * surface, and dropping the `lens` parameter destroys the deep link before the
 * gate ever replies.
 */
export function isLensDecisionPending(
  preference: RoleRoomWorkspaceLens | null,
  superAdminGateReady: boolean,
): boolean {
  return preference === 'admin' && !superAdminGateReady;
}

export interface LensUrlStateInput {
  readonly lens: RoleRoomWorkspaceLens;
  readonly preference: RoleRoomWorkspaceLens | null;
  /** The member holds any production role that owns a lens. */
  readonly hasAssignedLensRole: boolean;
  /** Current surface per lens, for lenses that track their own. */
  readonly surfaces: Partial<Record<RoleWorkspaceLens, string>>;
  /** Shared planner surface, already reduced to '' when it is the default. */
  readonly plannerSurface: string;
  /** Current scene per lens, for lenses that deep-link a scene. */
  readonly scenes: Partial<Record<RoleWorkspaceLens, string>>;
}

export interface LensUrlState {
  readonly lens: string;
  readonly surface: string;
  readonly scene: string;
}

/**
 * Derive the `lens`, `surface` and `scene` query parameters. An empty string
 * means the parameter is removed, which keeps the URL clean for members who
 * never left the full workspace.
 */
export function resolveLensUrlState(input: LensUrlStateInput): LensUrlState {
  const { lens, preference, hasAssignedLensRole, surfaces, plannerSurface, scenes } = input;

  if (lens === 'full') {
    return {
      lens: preference === 'full' && hasAssignedLensRole ? 'full' : '',
      surface: plannerSurface,
      scene: '',
    };
  }

  const entry = getWorkspaceLensEntry(lens);
  const surface = entry.surfaceSource === 'own'
    ? surfaces[lens] ?? ''
    : entry.surfaceSource === 'planner'
      ? plannerSurface
      : '';

  return {
    lens,
    surface,
    scene: entry.usesSceneParam ? scenes[lens] ?? '' : '',
  };
}

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
    lens: 'director',
    workspaceKind: 'director',
    projectRoles: ['director'],
    surfaceSource: 'own',
    usesSceneParam: true,
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
    ],
    surfaceSource: 'own',
    usesSceneParam: false,
  },
  {
    lens: 'production-management',
    workspaceKind: 'production_management',
    projectRoles: ['production_manager'],
    surfaceSource: 'none',
    usesSceneParam: false,
  },
  {
    lens: 'production-coordination',
    workspaceKind: 'production_coordination',
    projectRoles: ['production_coordinator'],
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

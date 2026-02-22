/**
 * domain/types.ts
 *
 * Canonical domain model for the Role Room Stripboard Engine.
 *
 * Architecture principle: every object in this file is a PURE DATA TYPE.
 * No React, no MUI, no side-effects. The UI is a thin rendering layer
 * on top of these objects. If the domain is clean, the UI will be clean.
 *
 * Object graph (read left-to-right = "has a / belongs to"):
 *
 *   Project
 *     └─ Scene[]           (projectId FK)
 *          ├─ Breakdown     (1:1, sceneId FK)
 *          ├─ Strip?        (sceneId FK — null when unscheduled / in pool)
 *          │    └─ ShootDay (shootDayId FK)
 *          ├─ CastMember[]  (many-to-many via Scene.castIds)
 *          └─ Location      (locationId FK)
 *
 *   ShootDay[]
 *     └─ Strip[]           (ordered by sortOrder)
 *
 *   CastMember
 *     └─ DOODEntry[]       (generated, one per assigned ShootDay)
 *
 * ══════════════════════════════════════════════════════════════════════
 */

// ─── Primitive aliases ────────────────────────────────────────────────────────

/** ISO 8601 date string, e.g. "2026-03-10". */
export type ISODate = string;

/** ISO 8601 datetime string. */
export type ISODatetime = string;

/** HH:mm time string, e.g. "06:30". */
export type HHmm = string;

/** Hex colour string, e.g. "#fff9c4". */
export type HexColor = string;

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type IntExtType    = 'INT' | 'EXT' | 'INT/EXT';
export type TimeOfDay     = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
export type ProductionUnit = 'A' | 'B' | 'C' | 'D';

export type SceneStatus =
  | 'not-scheduled'   // in pool, never placed
  | 'scheduled'       // on a ShootDay
  | 'shot'            // completed
  | 'omitted'         // cut from schedule (not deleted)
  | 'postponed';      // was on a day, now removed back to pool

export type ShootDayStatus =
  | 'planned'
  | 'in-progress'
  | 'wrapped'
  | 'postponed'
  | 'cancelled';

/** Standard film breakdown element categories. */
export type BreakdownCategory =
  | 'cast'
  | 'extras'
  | 'stunts'
  | 'vehicles'
  | 'props'
  | 'special_effects'
  | 'vfx'
  | 'wardrobe'
  | 'makeup'
  | 'greenery'
  | 'music'
  | 'animal'
  | 'notes';

/** DOOD availability codes — standard industry notation. */
export type DOODCode =
  | 'W'   // Work
  | 'T'   // Travel to location
  | 'TF'  // Travel from location
  | 'H'   // Hold (paid idle)
  | 'O'   // Off (unpaid)
  | 'F'   // Finish (last day of contract)
  | 'SWF' // Start / Work / Finish (single-day role)
  | 'SW'  // Start / Work
  | 'WF'; // Work / Finish

// ─── Project ──────────────────────────────────────────────────────────────────

/**
 * Top-level aggregate root.
 * All other entities FK back to `projectId`.
 */
export interface Project {
  id: string;
  title: string;
  productionCompany?: string;
  director?: string;
  producer?: string;
  /** Two-letter country code, e.g. "NO". */
  country?: string;
  /** Primary shoot language. */
  language?: string;
  /** ISO date of first shoot day. */
  shootStartDate?: ISODate;
  /** ISO date of last shoot day (wrap). */
  shootEndDate?: ISODate;
  createdAt: ISODatetime;
  updatedAt: ISODatetime;
}

// ─── Location ─────────────────────────────────────────────────────────────────

/**
 * A distinct physical or stage location used across scenes.
 * Scenes point to `locationId`; normalised to avoid string duplication.
 */
export interface Location {
  id: string;
  projectId: string;
  /** Human-readable name, e.g. "DOVRE – TUNNEL". */
  name: string;
  /** Full address or GPS coords for logistics. */
  address?: string;
  /** GPS [lat, lng]. */
  coordinates?: [number, number];
  /** INT or EXT — a location can host both types but most lean one way. */
  defaultIntExt?: IntExtType;
  /** Travel time in minutes from base camp. */
  travelTimeMinutes?: number;
  /** Any location-level notes (permits, restrictions, etc.). */
  notes?: string;
  createdAt: ISODatetime;
}

// ─── CastMember ──────────────────────────────────────────────────────────────

/**
 * A person playing a role in the production.
 * Distinguished from crew (handled separately).
 */
export interface CastMember {
  id: string;
  projectId: string;
  /** Character name as it appears in the script. */
  characterName: string;
  /** Performer's real name. */
  actorName?: string;
  /** 1-based cast number (industry standard). */
  castNumber?: number;
  /** Contract type affecting DOOD codes. */
  contractType?: 'daily' | 'weekly' | 'buyout' | 'stunt';
  /** Days guaranteed by contract. */
  guaranteedDays?: number;
  /** ISO date when actor is first available. */
  availableFrom?: ISODate;
  /** ISO date when actor is last available. */
  availableUntil?: ISODate;
  /** Known unavailable dates (e.g. other commitments). */
  blackoutDates?: ISODate[];
  /** Home city for travel calculation. */
  homeLocation?: string;
  notes?: string;
  createdAt: ISODatetime;
  updatedAt: ISODatetime;
}

// ─── Breakdown ────────────────────────────────────────────────────────────────

/**
 * A Scene's production breakdown — detailed element list.
 * 1:1 with Scene; created when the AD first breaks down the script.
 *
 * `elements` is a dictionary of category → free-text list.
 * This mirrors standard US/Norwegian breakdown sheets.
 */
export interface BreakdownElement {
  id: string;
  category: BreakdownCategory;
  description: string;
  /** Quantity required on set. */
  quantity?: number;
  notes?: string;
}

export interface Breakdown {
  id: string;
  sceneId: string;
  projectId: string;
  elements: BreakdownElement[];
  /** AD sign-off flag. */
  isLocked: boolean;
  /** Which AD locked this breakdown. */
  lockedBy?: string;
  lockedAt?: ISODatetime;
  createdAt: ISODatetime;
  updatedAt: ISODatetime;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

/**
 * The canonical Scene entity – the unit of work in the Stripboard Engine.
 *
 * A Scene starts in the pool (`status: 'not-scheduled'`) and gets promoted
 * to a Strip when assigned to a ShootDay.
 *
 * Relations:
 *   scene.locationId  → Location.id
 *   scene.castIds[]   → CastMember.id[]
 *   scene.breakdownId → Breakdown.id  (null until AD breaks it down)
 */
export interface Scene {
  id: string;
  projectId: string;

  /** Formatted scene number, e.g. "12A". */
  sceneNumber: string;

  /** Scriptwriter's slug line, e.g. "INT. TUNNEL – NIGHT". */
  slugLine: string;

  /** Short synopsis for the strip card. */
  synopsis?: string;

  // ── Scheduling metadata ───────────────────────────────────────────────
  /** Script page count in decimal eighths (2.5 = 2 and 4/8). */
  pageCount: number;

  /** FK → Location.id */
  locationId: string;

  intExtType: IntExtType;
  timeOfDay: TimeOfDay;

  /** FK → CastMember.id[] */
  castIds: string[];

  /** FK → Breakdown.id — null until first breakdown is created. */
  breakdownId?: string;

  /** Freeform special requirement tags. */
  specialRequirements: string[];

  /** Minutes estimated by AD to shoot this scene. */
  estimatedMinutes: number;

  // ── Strip state ───────────────────────────────────────────────────────
  status: SceneStatus;

  /** FK → Strip.id — null when scene is in pool. */
  stripId?: string;

  // ── Visual ────────────────────────────────────────────────────────────
  /** Hex colour derived from intExtType + timeOfDay. */
  color: HexColor;

  notes?: string;
  createdAt: ISODatetime;
  updatedAt: ISODatetime;
}

// ─── Strip ────────────────────────────────────────────────────────────────────

/**
 * A Strip is the junction entity between Scene and ShootDay.
 *
 * When a Scene is dragged onto a ShootDay, a Strip is created.
 * When removed, the Strip is deleted and the Scene returns to the pool.
 *
 * This is the entity the scheduler drags and drops.
 *
 * Relations:
 *   strip.sceneId      → Scene.id
 *   strip.shootDayId   → ShootDay.id
 */
export interface Strip {
  id: string;
  projectId: string;
  sceneId: string;
  shootDayId: string;

  /** 0-based integer; controls render order on the day's strip board. */
  sortOrder: number;

  /**
   * Per-day override of Scene.estimatedMinutes.
   * Useful when re-shoots or complex setups change the original estimate.
   */
  overrideEstimatedMinutes?: number;

  /** Short AD note specific to this shooting day context. */
  notes?: string;

  createdAt: ISODatetime;
  updatedAt: ISODatetime;
}

// ─── ShootDay ─────────────────────────────────────────────────────────────────

/**
 * A ShootDay is a container for an ordered list of Strips.
 *
 * `date` is intentionally optional — the AD can plan days without
 * committing to dates until the shoot calendar is locked.
 *
 * Relations:
 *   shootDay.stripIds[] → Strip.id[] (ordered)
 *   shootDay.primaryLocationId → Location.id (derived or overridden)
 */
export interface ShootDay {
  id: string;
  projectId: string;

  /** 1-indexed display number within its unit, auto-recalculated. */
  dayNumber: number;

  unit: ProductionUnit;

  /** ISO date — undefined = TBD. */
  date?: ISODate;

  /** First call time, HH:mm. */
  callTime?: HHmm;

  /** Estimated wrap time, HH:mm. */
  estimatedWrapTime?: HHmm;

  /** Actual wrap (filled in by AD at end of day). */
  actualWrapTime?: HHmm;

  status: ShootDayStatus;

  /** Ordered Strip IDs for this day. */
  stripIds: string[];

  /**
   * Override the primary location for the day.
   * Normally derived from the first strip's scene location.
   */
  primaryLocationId?: string;

  notes?: string;

  createdAt: ISODatetime;
  updatedAt: ISODatetime;
}

// ─── DOOD (Day Out Of Days) ───────────────────────────────────────────────────

/**
 * A single cell in the DOOD matrix.
 * Generated by the DOOD Engine from the current Strip assignments —
 * never stored directly; always derived.
 *
 * Matrix coordinates: castMemberId × shootDayId
 */
export interface DOODEntry {
  castMemberId: string;
  shootDayId: string;
  /** The day's display date (ISO) for column header. */
  date?: ISODate;
  /** 1-indexed day number within unit, for column header. */
  dayNumber: number;
  code: DOODCode;
  /** Which scenes call this actor on this day. */
  sceneIds: string[];
}

/**
 * Full DOOD matrix for one project.
 * `rows`   – one per cast member, ordered by castNumber.
 * `columns` – one per shoot day, ordered by date/dayNumber.
 */
export interface DOODMatrix {
  projectId: string;
  /** Ordered column descriptors. */
  columns: Array<{
    shootDayId: string;
    dayNumber: number;
    unit: ProductionUnit;
    date?: ISODate;
  }>;
  /** One row per cast member. */
  rows: Array<{
    castMember: Pick<CastMember, 'id' | 'characterName' | 'actorName' | 'castNumber'>;
    /** map shootDayId → entry; missing key = 'O' (off). */
    entries: Record<string, DOODEntry>;
    /** Total work days. */
    totalWorkDays: number;
    /** Total hold days. */
    totalHoldDays: number;
  }>;
  generatedAt: ISODatetime;
}

// ─── Conflict Detection ───────────────────────────────────────────────────────

/** Severity level for a detected conflict. */
export type ConflictSeverity = 'error' | 'warning' | 'info';

/** Categories of detectable conflicts. */
export type ConflictType =
  | 'page_overload'          // day exceeds max shootable pages
  | 'time_overload'          // day exceeds max shoot minutes
  | 'actor_conflict'         // actor needed on two units simultaneously
  | 'actor_unavailable'      // actor on blackout date or outside contract
  | 'actor_turnaround'       // < 12h between wrap and call
  | 'location_mismatch'      // multiple distant locations on same day
  | 'night_day_violation'    // mixing DAY and NIGHT scenes consecutively
  | 'stunt_isolation'        // stunt scene not isolated (safety requires separation)
  | 'vfx_sequence_break'     // VFX-dependent scenes out of shoot order
  | 'child_actor_hours';     // child actor would exceed legal daily hours

/**
 * A single detected conflict.
 * The engine emits an array of these after every Strip move.
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  description: string;
  /** Affected ShootDay ids. */
  affectedDayIds: string[];
  /** Affected Scene ids. */
  affectedSceneIds: string[];
  /** Affected CastMember ids (if actor-related). */
  affectedCastIds?: string[];
  /** Suggested fix description (optional). */
  suggestion?: string;
}

// ─── Production Stats ─────────────────────────────────────────────────────────

/**
 * All production statistics are DERIVED from the scene/strip/day graph.
 * Nothing in here is stored — it is always recalculated.
 */
export interface ProductionStats {
  // ── Schedule progress ─────────────────────────────────────────────────
  totalScenes: number;
  scenesShot: number;
  scenesScheduled: number;
  scenesNotScheduled: number;
  scenesPostponed: number;
  scenesOmitted: number;

  // ── Page accounting ───────────────────────────────────────────────────
  totalPages: number;
  pagesShot: number;
  pagesScheduled: number;
  pagesUnscheduled: number;
  /** Script page percentage complete. */
  percentPagesShot: number;

  // ── Shoot days ────────────────────────────────────────────────────────
  totalShootDays: number;
  daysWrapped: number;
  daysRemaining: number;
  /** By unit. */
  daysByUnit: Record<ProductionUnit, number>;

  // ── Time estimates ────────────────────────────────────────────────────
  totalEstimatedMinutes: number;
  averageMinutesPerPage: number;
  /** Days with overloaded schedule (> 600 min). */
  overloadedDays: number;

  // ── Cast ──────────────────────────────────────────────────────────────
  totalCastMembers: number;
  averageWorkDaysPerActor: number;

  // ── Locations ─────────────────────────────────────────────────────────
  totalLocations: number;
  uniqueLocationsScheduled: number;

  // ── Breakdown ─────────────────────────────────────────────────────────
  scenesWithBreakdown: number;
  scenesWithSpecialRequirements: number;

  // ── Conflict summary ──────────────────────────────────────────────────
  activeConflicts: number;
  conflictsByType: Partial<Record<ConflictType, number>>;

  computedAt: ISODatetime;
}

// ─── Quick Filter query ───────────────────────────────────────────────────────

/**
 * A composable, serialisable filter query for the Stripboard.
 * All fields are optional — omitted fields match everything.
 * Can be stored in URL query params or in component state.
 */
export interface StripboardQuery {
  /** Free-text search: matches sceneNumber, slugLine, synopsis, location name. */
  search?: string;
  intExtType?: IntExtType | 'all';
  timeOfDay?: TimeOfDay | 'all';
  unit?: ProductionUnit | 'all';
  status?: SceneStatus | 'all';
  /** Filter to specific location ID(s). */
  locationIds?: string[];
  /** Filter to scenes requiring any of these cast members. */
  castIds?: string[];
  /** Filter to scenes with any of these special requirement tags. */
  specialRequirements?: string[];
  /** Show only scenes with active conflicts. */
  hasConflicts?: boolean;
  /** Show only scenes with breakdown element `stunt`. */
  stuntsOnly?: boolean;
  /** Show only scenes with breakdown element `vfx`. */
  vfxOnly?: boolean;
  /** Sort field. */
  sortBy?: 'sceneNumber' | 'pageCount' | 'location' | 'castSize' | 'estimatedMinutes' | 'status';
  sortDir?: 'asc' | 'desc';
}

// ─── Snapshot / undo ─────────────────────────────────────────────────────────

/**
 * An immutable snapshot of the entire scheduling state.
 * Used for optimistic updates, undo/redo, and WS conflict resolution.
 */
export interface ScheduleSnapshot {
  id: string;
  projectId: string;
  /** All strips at this point in time, keyed by id. */
  strips: Record<string, Strip>;
  /** All shoot days at this point in time, keyed by id. */
  shootDays: Record<string, ShootDay>;
  /** Human-readable description of the change that produced this snapshot. */
  description: string;
  /** User who made the change. */
  userId?: string;
  createdAt: ISODatetime;
}

// ─── Re-exports convenience ───────────────────────────────────────────────────

export type { };

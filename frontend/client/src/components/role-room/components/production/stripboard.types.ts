/**
 * stripboard.types.ts
 * All shared TypeScript interfaces and type aliases for the Stripboard feature.
 */

import type { ReactElement } from 'react';
import type { StripboardStrip, ShootingDay } from '../../services/productionWorkflowService';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StripboardPanelProps {
  projectId: string;
  projectTitle?: string;
  onSceneSelect?: (sceneId: string) => void;
  onGenerateCallSheet?: (dayId: string) => void;
}

// ─── View / Group modes ───────────────────────────────────────────────────────

/** Main display modes for the board. */
export type ViewMode = 'board' | 'compact' | 'timeline' | 'location' | 'cast';

/** Secondary sort / grouping key. */
export type GroupBy = 'day' | 'location' | 'cast' | 'status' | 'intExt';

// ─── Responsive ───────────────────────────────────────────────────────────────

export type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

export interface ScreenTierInfo {
  tier: ScreenTier;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  is4K: boolean;
}

export interface ResponsiveValues {
  headerPadding: number;
  contentPadding: number;
  fontSize: {
    title: string;
    subtitle: string;
    body: string;
    caption: string;
    stats: string;
  };
  chipHeight: number;
  iconSize: number;
  spacing: number;
  cardPadding: { x: number; y: number };
  maxCastVisible: number;
  statsColumns: number;
  showLegendLabels: boolean;
  showCallSheetButton: boolean;
  compactMode: boolean;
}

// ─── Data shapes ──────────────────────────────────────────────────────────────

/** Strips grouped under one shooting day. */
export interface StripsByDay {
  dayId: string | null;
  dayNumber: number | null;
  date: string | null;
  location: string | null;
  strips: StripboardStrip[];
  totalPages: number;
  totalTime: number;
  /**
   * The full ShootingDay record from the production service, available when
   * the day has been scheduled. Carries call/wrap times, weather, status,
   * crew & cast call sheets, and the daily production report.
   */
  shootingDay?: ShootingDay;
}

/** All strips for a given location (bird's-eye view). */
export interface LocationGroup {
  location: string;
  strips: StripboardStrip[];
  totalPages: number;
  totalTime: number;
  uniqueCast: string[];
  dayNumbers: number[];
}

/** Result of the optimization analysis. */
export interface OptimizationSuggestion {
  id: string;
  type: 'location' | 'cast' | 'transport' | 'time';
  title: string;
  description: string;
  potentialSaving: string;
  affectedScenes: string[];
  priority: 'high' | 'medium' | 'low';
}

/** Aggregate statistics displayed in the stats bar. */
export interface StripboardStats {
  total: number;
  shot: number;
  scheduled: number;
  notScheduled: number;
  totalPages: number;
  pagesShot: number;
  totalTime: number;
  uniqueLocationsCount: number;
  uniqueCastCount: number;
  optimizationCount: number;
}

/** Options that control what is included in the print/export output. */
export interface PrintOptions {
  header: boolean;
  stats: boolean;
  legend: boolean;
  unassignedScenes: boolean;
  scheduledDays: boolean;
  castInfo: boolean;
  notes: boolean;
  pageNumbers: boolean;
}

// ─── Strip-color config shape (kept here so dialogs can import it) ────────────

export interface StripColorConfig {
  bg: string;
  label: string;
  icon: ReactElement;
  textColor: string;
}

// ─── Scene Pool ───────────────────────────────────────────────────────────────

/** Whether a scene takes place during the day or at night, etc. */
export type TimeOfDay = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';

/** Whether the scene is inside, outside, or both. */
export type IntExtType = 'INT' | 'EXT' | 'INT/EXT';

/**
 * A single entry in the unscheduled scene pool.
 * Every scene starts here before it is placed on a ShootDay.
 * Maps 1-to-1 to a screenplay scene; enriched with scheduling
 * metadata that the AD needs before assigning it to a day.
 */
export interface ScenePoolItem {
  /** Unique scene identifier (matches screenplay scene). */
  id: string;
  /** Formatted scene number shown on the strip (e.g. "12A"). */
  sceneNumber: string;
  /** Optional one-line scene heading / slug. */
  title?: string;
  /** Brief synopsis shown in the pool card. */
  synopsis?: string;

  // ── Scheduling metadata ──────────────────────────────────────────────────
  /** Script page count in eighths (e.g. 2.5 = 2 4/8 pages). */
  pageCount: number;
  /** Location slug matching the production location list. */
  location: string;
  /** INT / EXT / INT-EXT designation. */
  intExtType: IntExtType;
  /** Time of day as scripted. */
  timeOfDay: TimeOfDay;
  /** Character IDs / names required on set. */
  cast: string[];
  /**
   * Free-text special requirements that affect scheduling complexity,
   * e.g. "VFX_RAIN", "STUNT", "CHILD_ACTOR", "NIGHT_SHOOT".
   */
  specialRequirements: string[];
  /** Estimated shoot time in minutes, set by the AD. */
  estimatedMinutes: number;

  // ── Visual / status ──────────────────────────────────────────────────────
  /** Hex colour derived from intExtType + timeOfDay (INT/EXT + DAY/NIGHT). */
  color: string;
  /** Freeform AD notes. */
  notes?: string;
  /** ISO timestamp this item was added to the pool. */
  addedAt: string;
}

/** Summary totals for the entire scene pool. */
export interface ScenePoolStats {
  totalScenes: number;
  totalPages: number;
  totalMinutes: number;
  byIntExt: Record<IntExtType, number>;
  byTimeOfDay: Record<TimeOfDay, number>;
  uniqueLocations: number;
  uniqueCastMembers: number;
  hasSpecialRequirements: number;
}

// ─── ShootDay Engine ─────────────────────────────────────────────────────────

/** Film production units (A-unit is main, B-unit second, etc.). */
export type ProductionUnit = 'A' | 'B' | 'C' | 'D';

/**
 * A single scene strip placed onto a ShootDay with ordering information.
 * Separating this from ScenePoolItem lets us override per-day estimates
 * without mutating the canonical pool data.
 */
export interface ShootDayStrip {
  /** Unique ID for THIS assignment (not the scene ID). */
  stripId: string;
  /** Foreign key into ScenePool. */
  scenePoolItemId: string;
  /** 0-based integer; lower = earlier in the day. */
  sortOrder: number;
  /** Override the pool estimate for this specific day context. */
  overrideEstimatedMinutes?: number;
  /** Per-strip AD note (e.g. "shoot early – golden hour"). */
  notes?: string;
}

/**
 * Core ShootDay entity used by the ShootDay Engine.
 * A ShootDay is a container that holds an ordered list of scene strips.
 * `date` is optional so days can be planned without calendar commitment.
 */
export interface ShootDay {
  id: string;
  projectId: string;
  /** 1-indexed; used for display ("Day 1", "Day 2", …). */
  dayNumber: number;
  /** ISO date string — undefined means "TBD". */
  date?: string;
  /** Which camera unit shoots this day. */
  unit: ProductionUnit;
  /** Ordered list of scenes planned for this day. */
  strips: ShootDayStrip[];
  /** First call time for talent / crew, HH:mm. */
  callTime?: string;
  /** Primary location for the day (derived from strips or overridden). */
  location?: string;
  /** AD / director notes for the day. */
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Derived totals for one ShootDay — computed by the engine, never stored. */
export interface ShootDayDerived {
  dayId: string;
  totalPages: number;
  totalMinutes: number;
  castRequired: string[];
  locations: string[];
  isOverCapacity: boolean; // > 10h shooting time
  hasSpecialRequirements: boolean;
  unitLabel: string;
}

/** Whole-project summary from the ShootDay Engine. */
export interface ShootDayEngineSummary {
  totalDays: number;
  byUnit: Record<ProductionUnit, number>;
  scheduledScenes: number;
  unscheduledScenes: number;
  totalScheduledPages: number;
  totalScheduledMinutes: number;
}

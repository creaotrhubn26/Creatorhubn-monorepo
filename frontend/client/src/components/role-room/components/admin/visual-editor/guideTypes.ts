/**
 * guideTypes.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Shared types for the Role Room Guide editor system.
 *
 * Admin-editable overrides are persisted to localStorage under the key
 * `roleroom:guide-configs` and are consumed by each guide dialog via
 * the useGuideConfig() hook.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Identifiers ───────────────────────────────────────────────────────────

export type GuideId = 'shot-list' | 'stripboard' | 'screenplay' | 'live-set-mode' | 'crew-management' | 'audition';

// ── Per-step override ─────────────────────────────────────────────────────

export interface GuideStepOverride {
  /** Must match the `id` field of the STEPS array in the guide component. */
  stepId: string;
  /** Hide this step from the guide entirely when false. Default: true. */
  enabled: boolean;
  /**
   * Admin-written callout shown at the very bottom of the step content —
   * appears above the screenshot placeholder with an admin-note accent bar.
   * Supports plain text (no JSX required).
   */
  adminNote?: string;
  /**
   * Admin-provided accent colour for the adminNote callout.
   * Defaults to '#f59e0b' (amber).
   */
  adminNoteColor?: string;
  /**
   * Absolute URL or data-URI for a real screenshot / GIF.
   * When provided it replaces the <ScreenshotPlaceholder /> box.
   */
  screenshotUrl?: string;
  /**
   * URL to a video (mp4/webm) shown in-guide once assets are ready.
   * Takes precedence over screenshotUrl when both are set.
   */
  videoUrl?: string;
  /**
   * Short badge label shown in the left nav alongside the step label,
   * e.g. "New", "Updated", "Beta".
   */
  badge?: string;
  /**
   * Override the step label shown in the navigator (not in the content header).
   * When absent the original label from the component is used.
   */
  labelOverride?: string;
  /**
   * Sort order within the guide. Steps with lower sortOrder appear first.
   * Ties are resolved by the original step array order.
   */
  sortOrder?: number;
}

// ── Per-guide config ──────────────────────────────────────────────────────

export interface GuideConfig {
  id: GuideId;
  /**
   * Whether the guide button (? icon) is shown to end-users at all.
   * Defaults to true.
   */
  enabled: boolean;
  /**
   * Admin-written text shown in a banner at the very top of the guide dialog
   * (below the header, above step content). Empty string = no banner.
   */
  introBanner?: string;
  introBannerColor?: string;
  /**
   * Override the accent colour used for nav indicators and buttons in the dialog.
   * Must be a valid CSS colour string.
   */
  accentColorOverride?: string;
  /** ISO timestamp of the last admin save. */
  lastModified: string;
  /** Step-level overrides keyed by stepId. */
  steps: GuideStepOverride[];
}

// ── Registry ──────────────────────────────────────────────────────────────

export interface GuideRegistry {
  configs: Record<GuideId, GuideConfig>;
  /** ISO timestamp of last registry-level save. */
  savedAt: string;
}

// ── Metadata ──────────────────────────────────────────────────────────────
// Static metadata about each guide (unchanged — source of truth for the UI).

export interface GuideMeta {
  id: GuideId;
  title: string;
  description: string;
  accentColor: string;
  steps: GuideStepMeta[];
}

export interface GuideStepMeta {
  id: string;
  label: string;
  sectionCount: number;
}

export const GUIDE_META: GuideMeta[] = [
  {
    id: 'shot-list',
    title: 'Shot List Panel',
    description: '9-step walkthrough of the Shot List system: creating, assigning, batch editing, realtime collaboration, and export.',
    accentColor: '#e91e63',
    steps: [
      { id: 'overview',     label: 'Overview',                sectionCount: 2 },
      { id: 'viewing',      label: 'Viewing the Grid',        sectionCount: 2 },
      { id: 'creating',     label: 'Creating a Shot List',    sectionCount: 1 },
      { id: 'assigning',    label: 'Assigning Crew',          sectionCount: 2 },
      { id: 'editing',      label: 'Editing & Deleting',      sectionCount: 2 },
      { id: 'multiselect',  label: 'Multi-Select & Batch',    sectionCount: 2 },
      { id: 'reorder',      label: 'Reordering Cards',        sectionCount: 1 },
      { id: 'export',       label: 'Exporting',               sectionCount: 1 },
      { id: 'realtime',     label: 'Realtime Collaboration',  sectionCount: 1 },
    ],
  },
  {
    id: 'stripboard',
    title: 'Stripboard Panel',
    description: '10-step walkthrough of the Stripboard: strips, day groups, location view, drag & drop, assign, schedule optimisation, filters, export, and compact mode.',
    accentColor: '#7C3AED',
    steps: [
      { id: 'overview',      label: 'Overview',           sectionCount: 2 },
      { id: 'strips',        label: 'Reading Strips',     sectionCount: 2 },
      { id: 'day-groups',    label: 'Day Groups',         sectionCount: 2 },
      { id: 'location-view', label: 'Location View',      sectionCount: 2 },
      { id: 'drag-drop',     label: 'Drag & Drop',        sectionCount: 1 },
      { id: 'assign',        label: 'Assign to Day',      sectionCount: 2 },
      { id: 'optimization',  label: 'Schedule Optimisation', sectionCount: 2 },
      { id: 'filters',       label: 'Filters & Sort',     sectionCount: 2 },
      { id: 'export',        label: 'Export & Print',     sectionCount: 3 },
      { id: 'compact-view',  label: 'Compact & Mobile',   sectionCount: 2 },
    ],
  },
  {
    id: 'screenplay',
    title: 'Screenplay Editor',
    description: '10-step walkthrough of the Screenplay Editor: Fountain elements, keyboard shortcuts, scene navigator, Beat Board (beat types, act balance, story threads, character arc filter, dramaturgical analysis, room mode), table read, locking, export, and storyboard link.',
    accentColor: '#3b82f6',
    steps: [
      { id: 'overview',          label: 'Overview',             sectionCount: 2 },
      { id: 'fountain-elements', label: 'Fountain Elements',    sectionCount: 2 },
      { id: 'keyboard',          label: 'Keyboard Shortcuts',   sectionCount: 3 },
      { id: 'navigator',         label: 'Scene Navigator',      sectionCount: 2 },
      { id: 'beat-board',        label: 'Beat Board',           sectionCount: 7 },
      { id: 'table-read',        label: 'Table Read',           sectionCount: 1 },
      { id: 'analysis',          label: 'Script Analysis',      sectionCount: 2 },
      { id: 'lock-roles',        label: 'Locking & Roles',      sectionCount: 2 },
      { id: 'export',            label: 'Export & Fullscreen',  sectionCount: 2 },
      { id: 'storyboard',        label: 'Storyboard Link',      sectionCount: 1 },
    ],
  },
  {
    id: 'live-set-mode',
    title: 'Live Set Mode',
    description: '12-step walkthrough of Live Set Mode: ROLL/CUT workflow, multi-camera metadata, takes log, quick notes, activity feed, exports, role permissions, offline outbox, and Studio realtime presence.',
    accentColor: '#F97316',
    steps: [
      { id: 'overview',          label: 'Overview',             sectionCount: 2 },
      { id: 'roll-cut',          label: 'ROLL & CUT',           sectionCount: 3 },
      { id: 'multi-camera',      label: 'Camera Metadata',      sectionCount: 2 },
      { id: 'takes-log',         label: 'Takes Log',            sectionCount: 2 },
      { id: 'notes',             label: 'Quick Notes',          sectionCount: 2 },
      { id: 'activity-feed',     label: 'Activity Feed',        sectionCount: 1 },
      { id: 'scene-plan',        label: 'Scene Plan',           sectionCount: 1 },
      { id: 'export',            label: 'Exports',              sectionCount: 2 },
      { id: 'permissions',       label: 'Roles & Permissions',  sectionCount: 2 },
      { id: 'offline-outbox',    label: 'Offline Outbox',       sectionCount: 2 },
      { id: 'presence-realtime', label: 'Presence & Realtime',  sectionCount: 3 },
      { id: 'settings',          label: 'Settings',             sectionCount: 1 },
    ],
  },
  {
    id: 'crew-management',
    title: 'Crew Management',
    description: '9-step walkthrough of the Crew Management panel: adding & inviting crew, department sidebar, crew cards (grid/table), search & filters, bulk actions, Days Out Of Days (DOOD), callsheet generator, and cost calculator.',
    accentColor: '#00d4ff',
    steps: [
      { id: 'overview',      label: 'Overview',             sectionCount: 2 },
      { id: 'adding-crew',   label: 'Adding & Inviting',    sectionCount: 2 },
      { id: 'dept-sidebar',  label: 'Department Sidebar',   sectionCount: 1 },
      { id: 'crew-cards',    label: 'Crew Cards & Views',   sectionCount: 2 },
      { id: 'search-filters',label: 'Search & Filters',     sectionCount: 2 },
      { id: 'bulk-actions',  label: 'Bulk Actions',         sectionCount: 2 },
      { id: 'dood',          label: 'Days Out Of Days',     sectionCount: 2 },
      { id: 'callsheet',     label: 'Callsheet Generator',  sectionCount: 1 },
      { id: 'cost-export',   label: 'Cost & Export',        sectionCount: 2 },
    ],
  },
  {
    id: 'audition',
    title: 'Audition Planner',
    description: '10-step walkthrough of the Audition Planner: creating slots, three view modes, six-status workflow, filtering & search, favourites, details drawer, bulk actions, audition pool (cross-project templates), and CSV export with keyboard shortcuts.',
    accentColor: '#ffb800',
    steps: [
      { id: 'overview',         label: 'Overview',           sectionCount: 2 },
      { id: 'creating-slots',   label: 'Creating Slots',     sectionCount: 2 },
      { id: 'view-modes',       label: 'View Modes',         sectionCount: 1 },
      { id: 'status-tracking',  label: 'Status Tracking',    sectionCount: 2 },
      { id: 'filters',          label: 'Filtering',          sectionCount: 3 },
      { id: 'favourites',       label: 'Favourites',         sectionCount: 1 },
      { id: 'details-drawer',   label: 'Details Drawer',     sectionCount: 1 },
      { id: 'bulk-actions',     label: 'Bulk Actions',       sectionCount: 2 },
      { id: 'audition-pool',    label: 'Audition Pool',      sectionCount: 2 },
      { id: 'export-shortcuts', label: 'Export & Shortcuts', sectionCount: 2 },
    ],
  },
];

// ── Defaults ──────────────────────────────────────────────────────────────────

function buildDefaultConfig(meta: GuideMeta): GuideConfig {
  return {
    id: meta.id,
    enabled: true,
    lastModified: new Date().toISOString(),
    steps: meta.steps.map((s, i) => ({
      stepId: s.id,
      enabled: true,
      sortOrder: i,
    })),
  };
}

export function buildDefaultRegistry(): GuideRegistry {
  const configs = {} as Record<GuideId, GuideConfig>;
  for (const meta of GUIDE_META) {
    configs[meta.id] = buildDefaultConfig(meta);
  }
  return { configs, savedAt: new Date().toISOString() };
}

/**
 * Z-Index Token System for The Role Room
 * 
 * Centralized z-index values to prevent stacking conflicts.
 * All z-index values should be imported from here rather than hardcoded.
 * 
 * Layer hierarchy (lowest to highest):
 *   base        → default content
 *   sticky      → sticky headers, navigation
 *   fab         → floating action buttons (SpeedDial)
 *   themeToggle → theme toggle button
 *   selectMenu  → dropdown menus in modals
 *   overlay     → tutorial overlay
 *   backdrop    → dialog backdrops
 *   dialog      → dialog modals
 *   dialogSelect→ select menus rendered inside dialogs
 *   toast       → toast notifications (always on top)
 */
export const Z_INDEX = {
  /** Default content layer */
  base: 1,
  /** Sticky headers and navigation bars */
  sticky: 100,
  /** Floating action button (SpeedDial) */
  fab: 1200,
  /** Theme toggle button */
  themeToggle: 1300,
  /** Select menus inside panels */
  selectMenu: 1400,
  /** Tutorial overlay background */
  tutorialBackdrop: 10000,
  /** Tutorial overlay content */
  tutorialContent: 10001,
  /** Tutorial overlay controls */
  tutorialControls: 10002,
  /** Dialog backdrop */
  backdrop: 99998,
  /** Dialog modal */
  dialog: 100000,
  /** Select menus rendered inside dialogs (portalled to body) */
  dialogSelect: 100010,
  /** Toast notifications - always on top */
  toast: 200000,
} as const;

export type ZIndexToken = keyof typeof Z_INDEX;

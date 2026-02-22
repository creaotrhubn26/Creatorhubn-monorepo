/**
 * Production Components Index
 * Exports all production workflow components
 */

// Components
export { default as LiveSetMode } from './LiveSetMode';
export { default as StripboardPanel } from './StripboardPanel';
export { default as ShootingDayPlanner } from './ShootingDayPlanner';
export { default as CrewCalendarPanel, CrewCalendarPanel as CrewCalendar } from './CrewCalendarPanel';

// Types from CrewCalendarPanel
export type {
  Department,
  EventType,
  CrewCalendarEvent,
  CrewMemberBasic,
  CalendarFilter,
  CrewCalendarPanelProps,
} from './CrewCalendarPanel';

// Re-export service and types
export {
  productionWorkflowService,
  TROLL_CAST,
  TROLL_CREW,
  TROLL_SHOOTING_DAYS,
  TROLL_STRIPBOARD,
  TROLL_LIVE_SET_STATUS,
} from '../../services/productionWorkflowService';

export type {
  ShootingDay,
  WeatherInfo,
  MealBreak,
  DailyReport,
  Delay,
  StripboardStrip,
  CallSheet,
  CrewCallItem,
  CastCallItem,
  CallSheetScene,
  CallSheetLocation,
  ContactInfo,
  Take,
  LiveSetStatus,
  CrewMember,
  CastMember,
} from '../../services/productionWorkflowService';

// PDF Generator
export {
  generateCallSheetHTML,
  downloadCallSheetPDF,
  previewCallSheet,
  DEFAULT_CALL_SHEET_OPTIONS,
} from '../../services/callSheetPDFGenerator';

export type {
  CallSheetPDFOptions,
  PDFSection,
} from '../../services/callSheetPDFGenerator';

// ── Shot List UI modules ──────────────────────────────────────────────────────
export { ShotListPanel }       from './ShotListPanel';
export { ShotListCard }        from './ShotListCard';
export { ShotListGrid }        from './ShotListGrid';
export { ShotListTopBar }      from './ShotListTopBar';
export { ShotListFilterBar }   from './ShotListFilterBar';
export { ShotListSidebar }     from './ShotListSidebar';
export { ShotListGuide }       from './ShotListGuide';
export type { ShotListGuideProps } from './ShotListGuide';
export { StripboardGuide }     from './StripboardGuide';
export {
  CreateEditShotListDialog,
  ExportDialog,
  DeleteConfirmDialog,
  BatchAssignDialog,
} from './ShotListDialogs';

// Shot List filter helpers
export {
  applyFilters,
  getSceneOptions,
  DEFAULT_FILTERS,
} from './shotListFilters';
export type {
  ShotListFilters,
  ShotListSortField,
  StatusFilter,
  ViewMode,
  SceneOption,
} from './shotListFilters';

// Shot List data hook
export { useShotListData }     from './useShotListData';
export type { ShotListSummary, ProjectShotStats } from './useShotListData';

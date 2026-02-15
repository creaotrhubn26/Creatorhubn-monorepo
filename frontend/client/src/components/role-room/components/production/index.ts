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

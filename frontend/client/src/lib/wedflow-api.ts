/**
 * Wedflow API Client — BACKWARD COMPATIBILITY SHIM
 *
 * @deprecated This file re-exports everything from evendi-api.ts.
 * All new code should import directly from '@/lib/evendi-api'.
 *
 * Kept so that existing imports from '@/lib/wedflow-api' continue to work
 * without breaking. All types, functions, and query keys are re-exported
 * with their legacy names.
 */
export {
  // Constants
  EVENDI_PROXY_PREFIX,
  WEDFLOW_PROXY_PREFIX,
  // Types
  type EventType,
  type EventCategory,
  type EventTypeFeatures,
  type EventTypeConfig,
  type EvendiBooking,
  type EvendiBooking as WedflowBooking,
  type EvendiUser,
  type EvendiUser as WedflowUser,
  type EvendiAnalyticsSummary,
  type EvendiAnalyticsSummary as WedflowAnalyticsSummary,
  type EvendiCreateBookingPayload,
  type EvendiCreateBookingPayload as WedflowCreateBookingPayload,
  type EvendiUpdateBookingPayload,
  type EvendiUpdateBookingPayload as WedflowUpdateBookingPayload,
  type EvendiLoginResponse,
  type EvendiLoginResponse as WedflowLoginResponse,
  // Core API
  evendiApi,
  evendiApi as wedflowApi,
  // High-level helpers
  getEvendiUsers,
  getEvendiUsers as getWedflowUsers,
  getEvendiBookings,
  getEvendiBookings as getWedflowBookings,
  getEvendiBooking,
  getEvendiBooking as getWedflowBooking,
  createEvendiBooking,
  createEvendiBooking as createWedflowBooking,
  updateEvendiBooking,
  updateEvendiBooking as updateWedflowBooking,
  deleteEvendiBooking,
  deleteEvendiBooking as deleteWedflowBooking,
  getEvendiAnalyticsSummary,
  getEvendiAnalyticsSummary as getWedflowAnalyticsSummary,
  // Auth
  loginCouple,
  loginUser,
  logoutUser,
  getCurrentUser,
  // Event-type helpers
  getEvendiCoupleEventType,
  isEventFeatureEnabled,
  getEventTypeLabel,
  getEventCategory,
  // Query keys
  evendiQueryKeys,
  wedflowQueryKeys,
} from './evendi-api';

/**
 * Evendi API Client
 * Provides typed access to the Evendi event-ecosystem API for bookings, users,
 * analytics, and event-type management.
 *
 * Evendi API client for CreatorHub — all Evendi interactions go through here for
 * backward compatibility.
 *
 * Proxy chain: frontend → /api/evendi/* → backend → Evendi API
 *
 * Environment variables (set in backend/.env):
 *   CREATORHUB_API_KEY  – API key for Evendi authentication
 *   EVENDI_API_URL      – Base URL of the Evendi service
 */

import { apiRequest } from './queryClient';

// ─── Constants ────────────────────────────────────────────────────────────────
export const EVENDI_PROXY_PREFIX = '/api/evendi';

// ─── Event Types (mirrors Evendi shared/event-types.ts) ──────────────────────

export type EventCategory = 'personal' | 'corporate';

export type CorporateSubCategory =
  | 'celebration'
  | 'conference'
  | 'team_event'
  | 'milestone';

export type EventType =
  // Personal / B2C
  | 'wedding'
  | 'confirmation'
  | 'birthday'
  | 'anniversary'
  | 'engagement'
  | 'baby_shower'
  // Corporate / B2B
  | 'conference'
  | 'seminar'
  | 'kickoff'
  | 'summer_party'
  | 'christmas_party'
  | 'team_building'
  | 'product_launch'
  | 'trade_fair'
  | 'corporate_anniversary'
  | 'awards_night'
  | 'employee_day'
  | 'onboarding_day'
  | 'corporate_event';

export interface EventTypeFeatures {
  traditions: boolean;
  dressTracking: boolean;
  weddingPartyRoles: boolean;
  speeches: boolean;
  photoplan: boolean;
  seating: boolean;
  coupleProfile: boolean;
  importantPeople: boolean;
  sharePartner: boolean;
}

export interface EventTypeConfig {
  type: EventType;
  category: EventCategory;
  corporateSubCategory?: CorporateSubCategory;
  labelNo: string;
  labelEn: string;
  iconName: string;
  features: EventTypeFeatures;
  defaultRoleLabels?: { roleA: string; roleB: string };
  vendorHintNo?: string;
  vendorHintEn?: string;
  shareMessageNo?: string;
  shareMessageEn?: string;
}

// ─── Booking Types ────────────────────────────────────────────────────────────

export interface EvendiBooking {
  id: string;
  creatorUserId: string;
  title: string;
  clientName: string;
  eventDate: string;
  eventType?: EventType;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  /** Evendi couple profile link */
  coupleProfileId?: string;
  /** Venue / location name */
  venueName?: string;
  /** Venue coordinates */
  venueLatitude?: number;
  venueLongitude?: number;
  /** Cultural type from traditions bridge */
  culturalType?: string;
  /** Number of guests expected */
  guestCount?: number;
  /** Contact phone */
  contactPhone?: string;
  /** Contact email */
  contactEmail?: string;
  /** Vendor services booked */
  servicesBooked?: string[];
  /** Payment status */
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  /** Amount already paid */
  amountPaid?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface EvendiUser {
  id: string;
  email: string;
  /** Display name (Evendi uses displayName, not name) */
  displayName: string;
  /** @deprecated Kept for backward compat — maps to displayName */
  name?: string;
  role: string;
  profession?: string;
  createdAt?: string;
}

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface EvendiAnalyticsSummary {
  /** Top-level convenience fields (computed by bridge) */
  totalBookings: number;
  totalRevenue: number;
  activeClients: number;
  completedProjects: number;
  upcomingEvents: number;
  revenueByMonth: { month: string; amount: number }[];
  bookingsByStatus: { status: string; count: number }[];
  /** Native Evendi analytics shape (bookings/users/invitations breakdown) */
  bookings?: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    completed: number;
  };
  users?: {
    total: number;
    active: number;
    new: number;
  };
  invitations?: {
    sent: number;
    accepted: number;
    declined: number;
  };
  /** Event type distribution */
  eventTypeBreakdown?: { eventType: EventType; count: number }[];
}

// ─── Payload Types ────────────────────────────────────────────────────────────

export interface EvendiCreateBookingPayload {
  creatorUserId: string;
  title: string;
  clientName: string;
  eventDate: string;
  eventType?: EventType;
  totalAmount: number;
  status?: EvendiBooking['status'];
  notes?: string;
  venueName?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  guestCount?: number;
  contactPhone?: string;
  contactEmail?: string;
}

export interface EvendiUpdateBookingPayload {
  title?: string;
  clientName?: string;
  eventDate?: string;
  eventType?: EventType;
  totalAmount?: number;
  status?: EvendiBooking['status'];
  notes?: string;
  venueName?: string;
  guestCount?: number;
  contactPhone?: string;
  contactEmail?: string;
}


// ─── Core API Wrapper ─────────────────────────────────────────────────────────

/**
 * Low-level Evendi API call routed through the backend proxy.
 * The backend appends the CREATORHUB_API_KEY header automatically.
 */
export async function evendiApi<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return apiRequest(`${EVENDI_PROXY_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    headers: options.headers as Record<string, string>,
    body: options.body as string | undefined,
  }) as Promise<T>;
}

// ─── High-Level Helpers ───────────────────────────────────────────────────────

/** Fetch all Evendi users */
export async function getEvendiUsers(): Promise<EvendiUser[]> {
  return evendiApi<EvendiUser[]>('/users');
}

/** Fetch all bookings (optionally filtered by status) */
export async function getEvendiBookings(
  status?: EvendiBooking['status'],
): Promise<EvendiBooking[]> {
  const query = status ? `?status=${status}` : '';
  return evendiApi<EvendiBooking[]>(`/bookings${query}`);
}

/** Fetch a single booking by ID */
export async function getEvendiBooking(id: string): Promise<EvendiBooking> {
  return evendiApi<EvendiBooking>(`/bookings/${id}`);
}

/** Create a new booking */
export async function createEvendiBooking(
  payload: EvendiCreateBookingPayload,
): Promise<EvendiBooking> {
  return evendiApi<EvendiBooking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Update an existing booking */
export async function updateEvendiBooking(
  id: string,
  payload: EvendiUpdateBookingPayload,
): Promise<EvendiBooking> {
  return evendiApi<EvendiBooking>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Delete a booking */
export async function deleteEvendiBooking(id: string): Promise<void> {
  return evendiApi<void>(`/bookings/${id}`, { method: 'DELETE' });
}

/** Fetch analytics summary (normalises both Evendi and legacy shapes) */
export async function getEvendiAnalyticsSummary(): Promise<EvendiAnalyticsSummary> {
  const raw = await evendiApi<Record<string, unknown>>('/analytics/summary');

  // If the response already has top-level convenience fields, return as-is
  if ('totalBookings' in raw) {
    return raw as unknown as EvendiAnalyticsSummary;
  }

  // Normalise Evendi's native { bookings, users, invitations } shape
  const bookings = (raw.bookings || {}) as Record<string, number>;
  const users = (raw.users || {}) as Record<string, number>;

  return {
    totalBookings: bookings.total ?? 0,
    totalRevenue: (raw.totalRevenue as number) ?? 0,
    activeClients: users.active ?? 0,
    completedProjects: bookings.completed ?? 0,
    upcomingEvents: bookings.pending ?? 0,
    revenueByMonth: (raw.revenueByMonth as EvendiAnalyticsSummary['revenueByMonth']) ?? [],
    bookingsByStatus: Object.entries(bookings)
      .filter(([key]) => key !== 'total')
      .map(([status, count]) => ({ status, count })),
    bookings: raw.bookings as EvendiAnalyticsSummary['bookings'],
    users: raw.users as EvendiAnalyticsSummary['users'],
    invitations: raw.invitations as EvendiAnalyticsSummary['invitations'],
    eventTypeBreakdown: raw.eventTypeBreakdown as EvendiAnalyticsSummary['eventTypeBreakdown'],
  };
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export interface EvendiLoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    /** displayName is the canonical field; name kept for compat */
    displayName: string;
    name?: string;
    role: 'couple' | 'vendor' | 'admin' | 'user';
    coupleProfileId?: string;
    vendorId?: string;
    businessName?: string;
    partnerEmail?: string;
    /** Event date (was weddingDate) */
    eventDate?: string;
    /** @deprecated Use eventDate */
    weddingDate?: string;
    /** Event type from Evendi taxonomy */
    eventType?: EventType;
  };
}


/** Login as couple via /api/couples/login */
export async function loginCouple(
  email: string,
  password: string,
): Promise<EvendiLoginResponse> {
  return apiRequest('/api/couples/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }) as Promise<EvendiLoginResponse>;
}

/** Login via /api/auth/login (any role) */
export async function loginUser(
  email: string,
  password: string,
): Promise<EvendiLoginResponse> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }) as Promise<EvendiLoginResponse>;
}

/** Logout and invalidate session */
export async function logoutUser(token: string): Promise<void> {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }) as Promise<void>;
}

/** Get current user from session token */
export async function getCurrentUser(
  token: string,
): Promise<{ user: EvendiLoginResponse['user'] | null; authenticated: boolean }> {
  return apiRequest('/api/auth/user', {
    headers: { Authorization: `Bearer ${token}` },
  }) as Promise<{ user: EvendiLoginResponse['user'] | null; authenticated: boolean }>;
}

// ─── Event-Type Helpers ───────────────────────────────────────────────────────

/**
 * Resolve the couple's event type via the traditions bridge.
 * Falls back to 'wedding' for backward compatibility.
 */
export async function getEvendiCoupleEventType(coupleId: string): Promise<EventType> {
  try {
    const data = await evendiApi<{ eventType?: EventType; culturalType?: string }>(
      `/traditions-bridge?coupleId=${coupleId}`,
    );
    return data.eventType ?? 'wedding';
  } catch {
    return 'wedding';
  }
}

/**
 * Check whether a feature is enabled for a given event type.
 * Mirrors Evendi's isFeatureEnabled() on the client side.
 */
export function isEventFeatureEnabled(
  eventType: EventType,
  feature: keyof EventTypeFeatures,
): boolean {
  const WEDDING_FEATURES: EventTypeFeatures = {
    traditions: true,
    dressTracking: true,
    weddingPartyRoles: true,
    speeches: true,
    photoplan: true,
    seating: true,
    coupleProfile: true,
    importantPeople: true,
    sharePartner: true,
  };

  const CORPORATE_FEATURES: EventTypeFeatures = {
    traditions: false,
    dressTracking: false,
    weddingPartyRoles: false,
    speeches: true,
    photoplan: true,
    seating: true,
    coupleProfile: false,
    importantPeople: true,
    sharePartner: false,
  };

  const PERSONAL_FEATURES: EventTypeFeatures = {
    traditions: false,
    dressTracking: false,
    weddingPartyRoles: false,
    speeches: true,
    photoplan: true,
    seating: true,
    coupleProfile: false,
    importantPeople: true,
    sharePartner: true,
  };

  const CORPORATE_TYPES: EventType[] = [
    'conference', 'seminar', 'kickoff', 'summer_party', 'christmas_party',
    'team_building', 'product_launch', 'trade_fair', 'corporate_anniversary',
    'awards_night', 'employee_day', 'onboarding_day', 'corporate_event',
  ];

  if (eventType === 'wedding') return WEDDING_FEATURES[feature];
  if (CORPORATE_TYPES.includes(eventType)) return CORPORATE_FEATURES[feature];
  return PERSONAL_FEATURES[feature];
}

/**
 * Get event type label in Norwegian.
 */
export function getEventTypeLabel(eventType: EventType): string {
  const labels: Record<EventType, string> = {
    wedding: 'Bryllup',
    confirmation: 'Konfirmasjon',
    birthday: 'Bursdag',
    anniversary: 'Jubileum',
    engagement: 'Forlovelse',
    baby_shower: 'Babyfest',
    conference: 'Konferanse',
    seminar: 'Seminar',
    kickoff: 'Kickoff',
    summer_party: 'Sommerfest',
    christmas_party: 'Julebord',
    team_building: 'Teambuilding',
    product_launch: 'Produktlansering',
    trade_fair: 'Messe',
    corporate_anniversary: 'Firmajubileum',
    awards_night: 'Prisutdeling',
    employee_day: 'Ansattdag',
    onboarding_day: 'Onboardingdag',
    corporate_event: 'Firmaarrangement',
  };
  return labels[eventType] ?? eventType;
}

/**
 * Get the event category.
 */
export function getEventCategory(eventType: EventType): EventCategory {
  const corporate: EventType[] = [
    'conference', 'seminar', 'kickoff', 'summer_party', 'christmas_party',
    'team_building', 'product_launch', 'trade_fair', 'corporate_anniversary',
    'awards_night', 'employee_day', 'onboarding_day', 'corporate_event',
  ];
  return corporate.includes(eventType) ? 'corporate' : 'personal';
}

// ─── React Query Keys ─────────────────────────────────────────────────────────
export const evendiQueryKeys = {
  all: ['evendi'] as const,
  users: () => [...evendiQueryKeys.all, 'users'] as const,
  bookings: (status?: string) =>
    status
      ? ([...evendiQueryKeys.all, 'bookings', status] as const)
      : ([...evendiQueryKeys.all, 'bookings'] as const),
  booking: (id: string) => [...evendiQueryKeys.all, 'booking', id] as const,
  analytics: () => [...evendiQueryKeys.all, 'analytics'] as const,
  auth: () => [...evendiQueryKeys.all, 'auth'] as const,
  eventType: (coupleId: string) => [...evendiQueryKeys.all, 'eventType', coupleId] as const,
};

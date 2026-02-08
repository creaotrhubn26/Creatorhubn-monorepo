/**
 * Wedflow API Client
 * Provides typed access to the Wedflow external API for bookings, users, and analytics.
 * Wired into EnhancedMasterIntegrationProvider via WEDFLOW_SERVICE config.
 *
 * Environment variables (set in backend/.env):
 *   CREATORHUB_API_KEY  – API key for Wedflow authentication
 *   WEDFLOW_API_URL     – Base URL of the Wedflow service
 */

import { apiRequest } from './queryClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const WEDFLOW_PROXY_PREFIX = '/api/wedflow';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface WedflowBooking {
  id: string;
  creatorUserId: string;
  title: string;
  clientName: string;
  eventDate: string;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WedflowUser {
  id: string;
  email: string;
  name: string;
  role: string;
  profession?: string;
  createdAt?: string;
}

export interface WedflowAnalyticsSummary {
  totalBookings: number;
  totalRevenue: number;
  activeClients: number;
  completedProjects: number;
  upcomingEvents: number;
  revenueByMonth: { month: string; amount: number }[];
  bookingsByStatus: { status: string; count: number }[];
}

export interface WedflowCreateBookingPayload {
  creatorUserId: string;
  title: string;
  clientName: string;
  eventDate: string;
  totalAmount: number;
  status?: WedflowBooking['status'];
  notes?: string;
}

export interface WedflowUpdateBookingPayload {
  title?: string;
  clientName?: string;
  eventDate?: string;
  totalAmount?: number;
  status?: WedflowBooking['status'];
  notes?: string;
}

// ─── Core API Wrapper ─────────────────────────────────────────────────────────

/**
 * Low-level Wedflow API call routed through the backend proxy.
 * The backend appends the CREATORHUB_API_KEY header automatically.
 */
export async function wedflowApi<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return apiRequest(`${WEDFLOW_PROXY_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    headers: options.headers as Record<string, string>,
    body: options.body as string | undefined,
  }) as Promise<T>;
}

// ─── High-Level Helpers ───────────────────────────────────────────────────────

/** Fetch all Wedflow users */
export async function getWedflowUsers(): Promise<WedflowUser[]> {
  return wedflowApi<WedflowUser[]>('/users');
}

/** Fetch all bookings (optionally filtered by status) */
export async function getWedflowBookings(
  status?: WedflowBooking['status'],
): Promise<WedflowBooking[]> {
  const query = status ? `?status=${status}` : '';
  return wedflowApi<WedflowBooking[]>(`/bookings${query}`);
}

/** Fetch a single booking by ID */
export async function getWedflowBooking(id: string): Promise<WedflowBooking> {
  return wedflowApi<WedflowBooking>(`/bookings/${id}`);
}

/** Create a new booking */
export async function createWedflowBooking(
  payload: WedflowCreateBookingPayload,
): Promise<WedflowBooking> {
  return wedflowApi<WedflowBooking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Update an existing booking */
export async function updateWedflowBooking(
  id: string,
  payload: WedflowUpdateBookingPayload,
): Promise<WedflowBooking> {
  return wedflowApi<WedflowBooking>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Delete a booking */
export async function deleteWedflowBooking(id: string): Promise<void> {
  return wedflowApi<void>(`/bookings/${id}`, { method: 'DELETE' });
}

/** Fetch analytics summary */
export async function getWedflowAnalyticsSummary(): Promise<WedflowAnalyticsSummary> {
  return wedflowApi<WedflowAnalyticsSummary>('/analytics/summary');
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export interface WedflowLoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'couple' | 'vendor' | 'admin' | 'user';
    coupleProfileId?: string;
    displayName?: string;
    vendorId?: string;
    businessName?: string;
    partnerEmail?: string;
    weddingDate?: string;
  };
}

/** Login as couple via /api/couples/login */
export async function loginCouple(
  email: string,
  password: string,
): Promise<WedflowLoginResponse> {
  return apiRequest('/api/couples/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }) as Promise<WedflowLoginResponse>;
}

/** Login via /api/auth/login (any role) */
export async function loginUser(
  email: string,
  password: string,
): Promise<WedflowLoginResponse> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }) as Promise<WedflowLoginResponse>;
}

/** Logout and invalidate session */
export async function logoutUser(token: string): Promise<void> {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }) as Promise<void>;
}

/** Get current user from session token */
export async function getCurrentUser(token: string): Promise<{ user: WedflowLoginResponse['user'] | null; authenticated: boolean }> {
  return apiRequest('/api/auth/user', {
    headers: { Authorization: `Bearer ${token}` },
  }) as Promise<{ user: WedflowLoginResponse['user'] | null; authenticated: boolean }>;
}

// ─── React Query Keys ─────────────────────────────────────────────────────────
export const wedflowQueryKeys = {
  all: ['wedflow'] as const,
  users: () => [...wedflowQueryKeys.all, 'users'] as const,
  bookings: (status?: string) =>
    status
      ? ([...wedflowQueryKeys.all, 'bookings', status] as const)
      : ([...wedflowQueryKeys.all, 'bookings'] as const),
  booking: (id: string) => [...wedflowQueryKeys.all, 'booking', id] as const,
  analytics: () => [...wedflowQueryKeys.all, 'analytics'] as const,
  auth: () => [...wedflowQueryKeys.all, 'auth'] as const,
};

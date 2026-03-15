/**
 * Role Room Shared Types
 * Used across frontend services, hooks, and components
 */

// ── User Roles (RBAC) ───────────────────────────────────────

export type UserRoleType =
  | 'director'
  | 'producer'
  | 'casting_director'
  | 'production_manager'
  | 'camera_team'
  | 'content_producer'
  | 'client_reviewer'
  | 'agency'
  | 'writer'
  | 'script_editor'
  | 'reader';

export interface UserRolePermissions {
  canViewAll: boolean;
  canEditCasting: boolean;
  canEditProduction: boolean;
  canManageCrew: boolean;
  canManageLocations: boolean;
  canEditShots: boolean;
  canEditShotLists?: boolean;
  canApprove: boolean;
  canEditScript: boolean;
  canLockScript: boolean;
  canRunTableRead: boolean;
  canComment?: boolean;
  canRequestChanges?: boolean;
  canViewEconomy?: boolean;
}

export interface UserRole {
  id: string;
  projectId: string;
  userId: string;
  email?: string;
  role: UserRoleType;
  permissions: UserRolePermissions;
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Casting Project ──────────────────────────────────────────

export interface CastingProject {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_by?: string;
  genre?: string;
  project_type?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  currency?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  creatorhub_project_id?: string;
  created_at: string;
  updated_at: string;
  // Nested sub-entities (populated by GET /projects/:id)
  roles?: CastingRole[];
  candidates?: Candidate[];
  crew?: CrewMember[];
  schedules?: Schedule[];
  locations?: Location[];
  props?: Prop[];
  shotLists?: ShotList[];
  userRoles?: UserRole[];
}

// ── Casting Role (character) ─────────────────────────────────

export interface CastingRole {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  age_range?: string;
  gender?: string;
  ethnicity?: string;
  role_type?: string;
  scene_ids?: string[];
  requirements?: Record<string, unknown>;
  status?: string;
  assigned_candidate_id?: string;
  candidate_ids?: string[];
  created_at: string;
  updated_at: string;
}

// ── Candidate ────────────────────────────────────────────────

export interface Candidate {
  id: string;
  project_id: string;
  name: string;
  email?: string;
  phone?: string;
  agency?: string;
  photos?: string[];
  videos?: string[];
  notes?: string;
  status?: string;
  assigned_roles?: string[];
  rating?: number;
  metadata?: Record<string, unknown>;
  emergency_contact?: Record<string, unknown>;
  consent_status?: string;
  created_at: string;
  updated_at: string;
}

// ── Crew Member ──────────────────────────────────────────────

export interface CrewMember {
  id: string;
  project_id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  department?: string;
  rate?: number;
  availability?: Record<string, unknown>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Schedule ─────────────────────────────────────────────────

export interface Schedule {
  id: string;
  project_id: string;
  candidate_id?: string;
  role_id?: string;
  scene_id?: string;
  location_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  type?: string;
  status?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Audition Schedule (denormalized list row from new API) ───

/** Status enum – exhaustive, matches server enum */
export type AuditionStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled';

/** A single row returned by GET /projects/:id/schedules (new API) */
export interface AuditionScheduleRow {
  id: string;
  project_id: string;
  candidate_id: string;
  role_id: string;
  scene_id?: string;
  location_id?: string;
  date?: string;       // YYYY-MM-DD; null = unscheduled pool
  time?: string;       // start_time aliased to `time`
  end_time?: string;
  type?: string;
  status: AuditionStatus;
  notes?: string;
  location?: string;   // free-text column
  created_at: string;
  updated_at: string;
  /** Denormalized – resolved by server JOIN */
  candidate_name: string;
  /** Denormalized – resolved by server JOIN */
  role_name: string;
  /** True when the requesting userId has starred this row */
  favorite: boolean;
}

/** Counts returned alongside every list response */
export interface ScheduleCounts {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  /** Rows where date IS NULL (unscheduled pool) */
  pool: number;
  /** scheduled rows where date = today */
  today: number;
  /** rows starred by the requesting user */
  favorites: number;
}

/** Shape of GET /projects/:id/schedules response */
export interface AuditionListResponse {
  items: AuditionScheduleRow[];
  totalCount: number;
  counts: ScheduleCounts;
}

/** Query params accepted by the list endpoint */
export interface AuditionListFilters {
  status?: AuditionStatus | 'pool' | 'all';
  roleId?: string;
  candidateId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: 'date' | 'candidate' | 'role' | 'status';
  dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  userId?: string;
}

/** Write payload for create / full-update */
export interface AuditionScheduleWrite {
  id?: string;
  candidateId: string;
  roleId: string;
  sceneId?: string;
  locationId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  type?: string;
  notes?: string;
  location?: string;
  status?: AuditionStatus;
}

// ── Location ─────────────────────────────────────────────────

export interface Location {
  id: string;
  project_id: string;
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  type?: string;
  contact_info?: Record<string, unknown>;
  access_notes?: string;
  photos?: string[];
  created_at: string;
  updated_at: string;
}

// ── Prop ─────────────────────────────────────────────────────

export interface Prop {
  id: string;
  project_id: string;
  name: string;
  category?: string;
  description?: string;
  images?: string[];
  availability?: string;
  quantity?: number;
  created_at: string;
  updated_at: string;
}

// ── Shot List ────────────────────────────────────────────────

export interface ShotList {
  id: string;
  project_id: string;
  scene_id?: string;
  shots?: unknown[];
  camera_settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Sync ─────────────────────────────────────────────────────

export interface ProjectSyncResult {
  success: boolean;
  castingProjectId: string;
  creatorhubProjectId: string;
  isNew: boolean;
  message: string;
}

export interface ProjectSyncEntry {
  id: string;
  creatorhub_project_id: string;
  casting_project_id: string;
  sync_direction: 'creatorhub_to_roleroom' | 'roleroom_to_creatorhub';
  sync_status: string;
  sync_data: Record<string, unknown>;
  error_message?: string;
  synced_at?: string;
  created_at: string;
}

// ── API Key ──────────────────────────────────────────────────

export interface ApiKeyCreateResponse {
  apiKey: string;
  name: string;
  userId: string;
  scopes: string[];
  expiresAt: string | null;
  message: string;
}

// ── Health ───────────────────────────────────────────────────

export interface RoleRoomHealthResponse {
  status: 'ok' | 'error';
  service: string;
  serverTime: string;
  castingTablesCount: number;
  corsOrigins: string[];
  apiKeyEnforced: boolean;
}

// ── Marketplace ──────────────────────────────────────────────

export interface MarketplaceInstallation {
  id: string;
  user_id: string;
  app_id: string;
  installed_at: string;
  is_active: boolean;
  settings: Record<string, unknown>;
}

// ── Onboarding Registration ──────────────────────────────────

export interface OnboardingRoleResult {
  success: boolean;
  userId: string;
  roleRoomRole: UserRoleType;
  profession: string;
  message: string;
}

import authSessionService from './authSessionService';
import type {
  RoleRoomGoogleAgreementSignature,
  RoleRoomGoogleAgreementSignatureStatus,
  RoleRoomGoogleCalendarSyncInput,
  RoleRoomGoogleArtifactRef,
  RoleRoomGoogleConnection,
  RoleRoomGoogleDriveSyncInput,
  RoleRoomGoogleLoginResult,
  RoleRoomGoogleMeetSessionInput,
  RoleRoomGoogleOauthStartInput,
  RoleRoomGooglePersonContact,
  RoleRoomGoogleProjectBinding,
  RoleRoomGoogleProjectBindingUpdateInput,
  RoleRoomLinkedInConnection,
  RoleRoomLinkedInLinkResult,
  RoleRoomLinkedInOauthStartInput,
} from '../models/casting';

const API_BASE = '/api/role-room';

export class CastingApiError extends Error {
  status: number;
  endpoint: string;
  details?: unknown;

  constructor(message: string, status: number, endpoint: string, details?: unknown) {
    super(message);
    this.name = 'CastingApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.details = details;
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers = authSessionService.getAuthHeadersSync();
  const session = authSessionService.getSessionSync();
  const adminUser = session.adminUser;

  if (typeof session.currentUserId === 'string' && session.currentUserId.trim().length > 0) {
    headers['x-role-room-user-id'] = session.currentUserId.trim();
  }
  if (typeof adminUser?.email === 'string' && adminUser.email.trim().length > 0) {
    headers['x-role-room-email'] = adminUser.email.trim();
  }
  if (typeof adminUser?.role === 'string' && adminUser.role.trim().length > 0) {
    headers['x-role-room-role'] = adminUser.role.trim();
  }
  if (typeof adminUser?.loginAs === 'string' && adminUser.loginAs.trim().length > 0) {
    headers['x-role-room-login-as'] = adminUser.loginAs.trim();
  }
  if (typeof adminUser?.requestedRole === 'string' && adminUser.requestedRole.trim().length > 0) {
    headers['x-role-room-requested-role'] = adminUser.requestedRole.trim();
  }

  return headers;
}

function buildRequestHeaders(options: RequestInit = {}): Headers {
  const headers = new Headers(options.headers ?? undefined);
  Object.entries(getAuthHeaders()).forEach(([key, value]) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

function resolveApiEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint) || endpoint.startsWith('/api/')) {
    return endpoint;
  }
  return `${API_BASE}${endpoint}`;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(resolveApiEndpoint(endpoint), {
    ...options,
    headers: buildRequestHeaders(options),
  });
  
  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    let parsedBody: any = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = null;
      }
    }

    const detail =
      parsedBody?.detail ||
      parsedBody?.message ||
      parsedBody?.error ||
      rawBody ||
      `Request failed (${response.status})`;

    throw new CastingApiError(String(detail), response.status, endpoint, parsedBody ?? rawBody);
  }
  
  return response.json();
}

async function apiBlobRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<Blob> {
  const response = await fetch(resolveApiEndpoint(endpoint), {
    ...options,
    headers: buildRequestHeaders(options),
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    throw new CastingApiError(rawBody || `Request failed (${response.status})`, response.status, endpoint, rawBody);
  }

  return response.blob();
}

const googleBindingBootstrapRequests = new Map<string, Promise<RoleRoomGoogleBindingResponse>>();

const hasText = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const hasReadyGoogleProjectBinding = (binding?: RoleRoomGoogleProjectBinding | null): boolean => (
  hasText(binding?.driveRootFolderId) && hasText(binding?.calendarId)
);

export interface CastingProject {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  project_data: Record<string, unknown>;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CastingCandidate {
  id: string;
  project_id: string;
  name: string;
  role_id?: string;
  candidate_data: Record<string, unknown>;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CastingRole {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  role_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CastingCrew {
  id: string;
  project_id: string;
  name: string;
  role?: string;
  department?: string;
  crew_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CastingLocation {
  id: string;
  project_id: string;
  name: string;
  address?: string;
  location_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CastingProp {
  id: string;
  project_id: string;
  name: string;
  category?: string;
  prop_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CastingSchedule {
  id: string;
  project_id: string;
  title: string;
  start_time?: string;
  end_time?: string;
  schedule_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface RoleRoomGoogleStatusResponse {
  configured: boolean;
  missing: string[];
  state: 'disconnected' | 'connected' | 'expired' | 'error';
  connection: RoleRoomGoogleConnection | null;
  projectBinding?: RoleRoomGoogleProjectBinding | null;
  artifacts?: RoleRoomGoogleArtifactRef[];
}

export interface RoleRoomGoogleBindingResponse {
  binding: RoleRoomGoogleProjectBinding | null;
  artifacts: RoleRoomGoogleArtifactRef[];
}

export interface RoleRoomTalentPortalMediaItem {
  id: string;
  kind?: 'video' | 'photo';
  title: string;
  url: string;
  thumbnailUrl?: string | null;
  notes?: string | null;
  source?: string | null;
  submittedAt?: string | null;
  requiresAuth?: boolean;
  mimeType?: string | null;
  sizeBytes?: number | null;
  downloadName?: string | null;
  durationSeconds?: number | null;
}

export interface RoleRoomTalentPortalCandidateProfile {
  bio?: string | null;
  city?: string | null;
  baseLocation?: string | null;
  website?: string | null;
  instagram?: string | null;
  portfolioUrl?: string | null;
  showreelUrl?: string | null;
  languages: string[];
}

export interface RoleRoomCommercialBillingMember {
  name: string;
  email: string;
  roleId?: string | null;
  roleLabel?: string | null;
  isLeader: boolean;
  activationApproved: boolean;
  activationPendingApproval: boolean;
  activationEmailSent: boolean;
  inviteRequestId?: string | null;
  registeredUserId?: string | null;
}

export interface RoleRoomCommercialBillingAccount {
  persona?: string | null;
  personaLabel?: string | null;
  planId?: string | null;
  planName?: string | null;
  companyName?: string | null;
  organizationNumber?: string | null;
  teamSize?: number | null;
  seatPriceExVat?: number | null;
  monthlyTotalExVat?: number | null;
  taxMode?: string | null;
  paymentCompleted: boolean;
  paymentStatus: 'pending_payment' | 'active' | 'payment_failed';
  paymentStatusLabel: string;
  paymentMessage: string;
  paymentPendingSince?: string | null;
  paymentFailedAt?: string | null;
  paymentFailureMessage?: string | null;
  paymentTimestamp?: string | null;
  transactionId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionStatus?: string | null;
  latestInvoiceId?: string | null;
  latestInvoiceStatus?: string | null;
  nextPaymentAttemptAt?: string | null;
  canManageBilling: boolean;
  managementLockedReason?: string | null;
  canRetryPayment: boolean;
  currentUser: {
    email: string;
    name: string;
    roleId?: string | null;
    roleLabel?: string | null;
    isLeader: boolean;
    activationApproved: boolean;
    activationPendingApproval: boolean;
    activationEmailSent: boolean;
  };
  teamLead: {
    name?: string | null;
    email?: string | null;
  };
  members: RoleRoomCommercialBillingMember[];
}

export interface RoleRoomCommercialBillingPortalResponse {
  success: boolean;
  url: string;
}

export interface RoleRoomCommercialRetryPaymentResponse {
  success: boolean;
  alreadyPaid?: boolean;
  paymentCompleted: boolean;
  invoiceId?: string | null;
  invoiceStatus?: string | null;
  subscriptionStatus?: string | null;
  transactionId?: string | null;
  stripeSubscriptionId?: string | null;
}

export interface RoleRoomTalentPortalCandidate {
  id: string;
  projectId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  agency?: string | null;
  notes?: string | null;
  status: string;
  rating?: number | null;
  assignedRoleIds: string[];
  consentStatus?: string | null;
  emergencyContact: Record<string, unknown>;
  photos: RoleRoomTalentPortalMediaItem[];
  videos: RoleRoomTalentPortalMediaItem[];
  profile: RoleRoomTalentPortalCandidateProfile;
  metadata: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RoleRoomTalentPortalRole {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  ageRange?: string | null;
  gender?: string | null;
  roleType?: string | null;
  status: string;
  assignedCandidateId?: string | null;
  candidateIds: string[];
  requirements: Record<string, unknown>;
}

export interface RoleRoomTalentPortalSchedule {
  id: string;
  projectId: string;
  candidateId?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  type: string;
  status: string;
  notes?: string | null;
  location?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RoleRoomTalentPortalInvite {
  id: string;
  email?: string | null;
  status: string;
  expiresAt?: string | null;
  lastSentAt?: string | null;
  lastViewedAt?: string | null;
  acceptedAt?: string | null;
  metadata: Record<string, unknown>;
  inviteUrl?: string | null;
  previewUrl?: string | null;
}

export interface RoleRoomTalentPortalActivity {
  id: string;
  projectId: string;
  candidateId: string;
  entryType: string;
  title: string;
  body?: string | null;
  visibility: string;
  metadata: Record<string, unknown>;
  createdByRole?: string | null;
  createdAt?: string | null;
}

export interface RoleRoomTalentPortalAssignment {
  project: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    type?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  candidate: RoleRoomTalentPortalCandidate;
  roles: RoleRoomTalentPortalRole[];
  schedules: RoleRoomTalentPortalSchedule[];
  invite?: RoleRoomTalentPortalInvite | null;
  activity: RoleRoomTalentPortalActivity[];
  stats: {
    roleCount: number;
    scheduleCount: number;
    selfTapeCount: number;
    photoCount: number;
    activityCount: number;
  };
}

export interface RoleRoomTalentPortalResponse {
  assignments: RoleRoomTalentPortalAssignment[];
  summary: {
    projectCount: number;
    auditionCount: number;
    selfTapeCount: number;
  };
}

export interface RoleRoomLinkedInStatusResponse {
  configured: boolean;
  missing: string[];
  state: 'disconnected' | 'connected' | 'expired' | 'error';
  connection: RoleRoomLinkedInConnection | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const normalizeCrewMember = (crew: CastingCrew): CastingCrew => {
  const source = asRecord(crew) ?? {};
  const nested = asRecord(source.crew_data) ?? asRecord(source.crewData);
  const role = readFirstNonEmptyString(
    source.role,
    source.crewRole,
    source.crew_role,
    source.position,
    source.title,
    source.jobTitle,
    source.job_title,
    nested?.role,
    nested?.crewRole,
    nested?.position,
    nested?.title,
    source.department,
  ) || 'Crew-medlem';

  if (crew.role === role) {
    return crew;
  }

  return {
    ...crew,
    role,
  };
};

export const favoritesApi = {
  get: async (projectId: string, favoriteType: string): Promise<string[]> => {
    try {
      const result = await apiRequest<{ favorites: string[] }>(`/favorites/${projectId}/${favoriteType}`);
      return result.favorites;
    } catch {
      return [];
    }
  },
  
  set: async (projectId: string, favoriteType: string, itemIds: string[]): Promise<boolean> => {
    try {
      await apiRequest(`/favorites/${projectId}/${favoriteType}`, {
        method: 'POST',
        body: JSON.stringify({ itemIds }),
      });
      return true;
    } catch {
      return false;
    }
  },
  
  add: async (projectId: string, favoriteType: string, itemId: string): Promise<boolean> => {
    try {
      await apiRequest(`/favorites/${projectId}/${favoriteType}/add`, {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      });
      return true;
    } catch {
      return false;
    }
  },
  
  remove: async (projectId: string, favoriteType: string, itemId: string): Promise<boolean> => {
    try {
      await apiRequest(`/favorites/${projectId}/${favoriteType}/remove`, {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      });
      return true;
    } catch {
      return false;
    }
  },
};

export const projectsApi = {
  getAll: async (userId?: string): Promise<CastingProject[]> => {
    const params = userId ? `?user_id=${userId}` : '';
    const result = await apiRequest<{ projects: CastingProject[] }>(`/projects${params}`);
    return result.projects;
  },
  
  get: async (projectId: string): Promise<CastingProject> => {
    const result = await apiRequest<{ project: CastingProject }>(`/projects/${projectId}`);
    return result.project;
  },
  
  save: async (project: Partial<CastingProject>, userId?: string): Promise<CastingProject> => {
    const result = await apiRequest<{ project: CastingProject }>('/projects', {
      method: 'POST',
      body: JSON.stringify({ ...project, userId }),
    });
    return result.project;
  },
  
  delete: async (projectId: string): Promise<boolean> => {
    await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
    return true;
  },
};

export const candidatesApi = {
  getAll: async (projectId: string): Promise<CastingCandidate[]> => {
    const result = await apiRequest<{ candidates?: CastingCandidate[] } | CastingCandidate[]>(`/projects/${projectId}/candidates`);
    if (Array.isArray(result)) return result;
    return Array.isArray(result.candidates) ? result.candidates : [];
  },

  createForProject: async (
    projectId: string,
    payload: { name: string; email?: string; phone?: string; agency?: string; notes?: string }
  ): Promise<CastingCandidate> => {
    const result = await apiRequest<{ candidate?: CastingCandidate; id?: string; name?: string }>(
      `/projects/${projectId}/candidates`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    if (result.candidate) return result.candidate;
    return {
      id: result.id || `candidate-${Date.now()}`,
      project_id: projectId,
      name: result.name || payload.name,
      candidate_data: {},
    };
  },
  
  save: async (candidate: Partial<CastingCandidate>): Promise<CastingCandidate> => {
    const result = await apiRequest<{ candidate: CastingCandidate }>('/candidates', {
      method: 'POST',
      body: JSON.stringify(candidate),
    });
    return result.candidate;
  },
  
  delete: async (candidateId: string): Promise<boolean> => {
    await apiRequest(`/candidates/${candidateId}`, { method: 'DELETE' });
    return true;
  },
};

export const rolesApi = {
  getAll: async (projectId: string): Promise<CastingRole[]> => {
    const result = await apiRequest<{ roles: CastingRole[] }>(`/projects/${projectId}/roles`);
    return result.roles;
  },
  
  save: async (role: Partial<CastingRole>): Promise<CastingRole> => {
    const result = await apiRequest<{ role: CastingRole }>('/roles', {
      method: 'POST',
      body: JSON.stringify(role),
    });
    return result.role;
  },
  
  delete: async (roleId: string): Promise<boolean> => {
    await apiRequest(`/roles/${roleId}`, { method: 'DELETE' });
    return true;
  },
};

export const crewApi = {
  getAll: async (projectId: string): Promise<CastingCrew[]> => {
    const result = await apiRequest<{ crew?: CastingCrew[] } | CastingCrew[]>(`/projects/${projectId}/crew`);
    if (Array.isArray(result)) {
      return result.map(normalizeCrewMember);
    }
    return Array.isArray(result.crew) ? result.crew.map(normalizeCrewMember) : [];
  },
  
  save: async (crew: Partial<CastingCrew>): Promise<CastingCrew> => {
    const result = await apiRequest<{ crew: CastingCrew }>('/crew', {
      method: 'POST',
      body: JSON.stringify(crew),
    });
    return normalizeCrewMember(result.crew);
  },

  createForProject: async (
    projectId: string,
    payload: { name: string; role?: string; email?: string; phone?: string; department?: string; rate?: string }
  ): Promise<CastingCrew> => {
    const result = await apiRequest<{ crew?: CastingCrew; id?: string; name?: string }>(
      `/projects/${projectId}/crew`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    if (result.crew) return normalizeCrewMember(result.crew);
    return normalizeCrewMember({
      id: result.id || `crew-${Date.now()}`,
      project_id: projectId,
      name: result.name || payload.name,
      role: payload.role,
      department: payload.department,
      crew_data: {},
    });
  },
  
  delete: async (crewId: string): Promise<boolean> => {
    await apiRequest(`/crew/${crewId}`, { method: 'DELETE' });
    return true;
  },
};

export const locationsApi = {
  getAll: async (projectId: string): Promise<CastingLocation[]> => {
    const result = await apiRequest<{ locations?: CastingLocation[] } | CastingLocation[]>(`/projects/${projectId}/locations`);
    if (Array.isArray(result)) return result;
    return Array.isArray(result.locations) ? result.locations : [];
  },
  
  save: async (location: Partial<CastingLocation>): Promise<CastingLocation> => {
    const result = await apiRequest<{ location: CastingLocation }>('/locations', {
      method: 'POST',
      body: JSON.stringify(location),
    });
    return result.location;
  },
  
  delete: async (locationId: string): Promise<boolean> => {
    await apiRequest(`/locations/${locationId}`, { method: 'DELETE' });
    return true;
  },
};

export const propsApi = {
  getAll: async (projectId: string): Promise<CastingProp[]> => {
    const result = await apiRequest<{ props: CastingProp[] }>(`/projects/${projectId}/props`);
    return result.props;
  },
  
  save: async (prop: Partial<CastingProp>): Promise<CastingProp> => {
    const result = await apiRequest<{ prop: CastingProp }>('/props', {
      method: 'POST',
      body: JSON.stringify(prop),
    });
    return result.prop;
  },
  
  delete: async (propId: string): Promise<boolean> => {
    await apiRequest(`/props/${propId}`, { method: 'DELETE' });
    return true;
  },
};

export const schedulesApi = {
  getAll: async (projectId: string): Promise<CastingSchedule[]> => {
    const result = await apiRequest<{ schedules: CastingSchedule[] }>(`/projects/${projectId}/schedules`);
    return result.schedules;
  },
  
  save: async (schedule: Partial<CastingSchedule>): Promise<CastingSchedule> => {
    const result = await apiRequest<{ schedule: CastingSchedule }>('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
    return result.schedule;
  },
  
  delete: async (scheduleId: string): Promise<boolean> => {
    await apiRequest(`/schedules/${scheduleId}`, { method: 'DELETE' });
    return true;
  },
};

export const talentPortalApi = {
  getOverview: async (options?: {
    projectId?: string;
    candidateId?: string;
    inviteToken?: string;
  }): Promise<RoleRoomTalentPortalResponse> => {
    const params = new URLSearchParams();
    if (options?.projectId) {
      params.set('projectId', options.projectId);
    }
    if (options?.candidateId) {
      params.set('candidateId', options.candidateId);
    }
    if (options?.inviteToken) {
      params.set('inviteToken', options.inviteToken);
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<RoleRoomTalentPortalResponse>(`/talent/portal${suffix}`);
  },

  updateProfile: async (payload: {
    projectId: string;
    candidateId: string;
    phone?: string;
    agency?: string;
    bio?: string;
    city?: string;
    baseLocation?: string;
    website?: string;
    instagram?: string;
    portfolioUrl?: string;
    showreelUrl?: string;
    languages?: string[];
    emergencyContact?: {
      name?: string;
      phone?: string;
      relationship?: string;
    };
  }): Promise<RoleRoomTalentPortalCandidate | null> => {
    const result = await apiRequest<{ success: boolean; candidate: RoleRoomTalentPortalCandidate | null }>(
      '/talent/portal/profile',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    return result.candidate;
  },

  submitSelfTape: async (payload: {
    projectId: string;
    candidateId: string;
    title: string;
    videoUrl: string;
    thumbnailUrl?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    video: RoleRoomTalentPortalMediaItem;
    candidate: RoleRoomTalentPortalCandidate | null;
  }> => (
    apiRequest('/talent/portal/self-tapes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  ),

  submitTestimonial: async (payload: {
    quote: string;
    roleId?: string;
    author?: string;
    title?: string;
  }): Promise<{
    success: boolean;
    submission: {
      id: string;
      roleId: string;
      quote: string;
      author: string;
      title: string;
      status: string;
    };
    }> => (
    apiRequest('/testimonials/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  ),

  sendMessage: async (payload: {
    projectId: string;
    candidateId: string;
    body: string;
  }): Promise<{
    success: boolean;
    activity: Omit<RoleRoomTalentPortalActivity, 'id' | 'metadata'> & { createdAt: string };
  }> => (
    apiRequest('/talent/portal/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  ),

  uploadSelfTapeFile: async (payload: {
    projectId: string;
    candidateId: string;
    title: string;
    notes?: string;
    file: File;
  }): Promise<{
    success: boolean;
    upload: {
      id: string;
      url: string;
      title: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      requiresAuth: boolean;
      submittedAt: string;
    };
    video: RoleRoomTalentPortalMediaItem;
    candidate: RoleRoomTalentPortalCandidate | null;
  }> => {
    const formData = new FormData();
    formData.set('projectId', payload.projectId);
    formData.set('candidateId', payload.candidateId);
    formData.set('title', payload.title);
    if (payload.notes) {
      formData.set('notes', payload.notes);
    }
    formData.set('file', payload.file);

    return apiRequest('/talent/portal/self-tapes/upload', {
      method: 'POST',
      body: formData,
    });
  },

  fetchProtectedMediaBlob: async (url: string): Promise<Blob> => apiBlobRequest(url),
};

export type WorkflowStatus = 'pending' | 'auditioned' | 'selected' | 'offer_sent' | 'confirmed' | 'declined' | 'contracted' | 'production';

export interface CastingOffer {
  id: string;
  project_id: string;
  candidate_id: string;
  role_id?: string;
  offer_date?: string;
  response_deadline?: string;
  status: 'pending' | 'accepted' | 'declined';
  compensation?: string;
  terms?: string;
  notes?: string;
  response_date?: string;
  candidate_name?: string;
  role_name?: string;
}

export interface CastingContract {
  id: string;
  project_id: string;
  candidate_id: string;
  offer_id?: string;
  role_id?: string;
  contract_type?: string;
  start_date?: string;
  end_date?: string;
  compensation?: string;
  terms?: string;
  signed_date?: string;
  status: 'draft' | 'pending' | 'signed';
  document_url?: string;
  candidate_name?: string;
  role_name?: string;
}

export type ProjectAgreementType =
  | 'client_nda'
  | 'startup_collaboration'
  | 'smb_content_production'
  | 'internal_training_production'
  | 'agency_retainer'
  | 'campaign_production'
  | 'change_order'
  | 'client_approval'
  | 'extra_nda'
  | 'extra_terms';
export type ProjectAgreementCounterpartyType = 'client' | 'extra';
export type ProjectAgreementStatus = 'draft' | 'sent' | 'signed';

export interface ProjectAgreementSection {
  id: string;
  heading: string;
  body: string;
}

export interface ProjectAgreement {
  id: string;
  project_id: string;
  agreement_type: ProjectAgreementType | string;
  counterparty_type: ProjectAgreementCounterpartyType | string;
  counterparty_id?: string;
  title: string;
  purpose?: string;
  disclosing_party_name?: string;
  disclosing_party_company_name?: string;
  disclosing_party_organization_number?: string;
  counterparty_name: string;
  counterparty_email?: string;
  counterparty_company_name?: string;
  counterparty_organization_number?: string;
  sections?: ProjectAgreementSection[];
  start_date?: string;
  end_date?: string;
  signed_date?: string;
  status: ProjectAgreementStatus;
  google_signature?: RoleRoomGoogleAgreementSignature | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarEvent {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  event_type: 'audition' | 'selection' | 'fitting' | 'rehearsal' | 'shooting' | 'general';
  start_time: string;
  end_time?: string;
  location_id?: string;
  all_day?: boolean;
  candidate_ids?: string[];
  crew_ids?: string[];
  equipment_ids?: string[];
  shot_list_ids?: string[];
  notes?: string;
  status?: string;
}

export const workflowApi = {
  updateStatus: async (candidateId: string, workflowStatus: WorkflowStatus): Promise<boolean> => {
    await apiRequest(`/candidates/${candidateId}/workflow-status`, {
      method: 'PUT',
      body: JSON.stringify({ workflowStatus }),
    });
    return true;
  },
  
  updateAuditionResult: async (candidateId: string, data: { rating?: number; notes?: string; auditionDate?: string }): Promise<boolean> => {
    await apiRequest(`/candidates/${candidateId}/audition-result`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return true;
  },
  
  updateShotAssignments: async (candidateId: string, shotAssignments: string[]): Promise<boolean> => {
    await apiRequest(`/candidates/${candidateId}/shot-assignments`, {
      method: 'PUT',
      body: JSON.stringify({ shotAssignments }),
    });
    return true;
  },
};

export const offersApi = {
  getAll: async (projectId: string): Promise<CastingOffer[]> => {
    const result = await apiRequest<{ offers: CastingOffer[] }>(`/projects/${projectId}/offers`);
    return result.offers;
  },
  
  create: async (offer: {
    projectId: string;
    candidateId: string;
    roleId?: string;
    responseDeadline?: string;
    compensation?: string;
    terms?: string;
    notes?: string;
  }): Promise<string> => {
    const result = await apiRequest<{ offerId: string }>('/offers', {
      method: 'POST',
      body: JSON.stringify(offer),
    });
    return result.offerId;
  },
  
  respond: async (offerId: string, status: 'accepted' | 'declined'): Promise<boolean> => {
    await apiRequest(`/offers/${offerId}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return true;
  },
};

export const contractsApi = {
  getAll: async (projectId: string): Promise<CastingContract[]> => {
    const result = await apiRequest<{ contracts: CastingContract[] }>(`/projects/${projectId}/contracts`);
    return result.contracts;
  },
  
  create: async (contract: {
    projectId: string;
    candidateId: string;
    offerId?: string;
    roleId?: string;
    contractType?: string;
    startDate?: string;
    endDate?: string;
    compensation?: string;
    terms?: string;
  }): Promise<string> => {
    const result = await apiRequest<{ contractId: string }>('/contracts', {
      method: 'POST',
      body: JSON.stringify(contract),
    });
    return result.contractId;
  },
  
  sign: async (contractId: string): Promise<boolean> => {
    await apiRequest(`/contracts/${contractId}/sign`, {
      method: 'PUT',
    });
    return true;
  },
};

export const projectAgreementsApi = {
  getAll: async (projectId: string): Promise<ProjectAgreement[]> => {
    const result = await apiRequest<{ agreements?: ProjectAgreement[] } | ProjectAgreement[]>(
      `/projects/${projectId}/project-agreements`,
    );
    if (Array.isArray(result)) return result;
    return Array.isArray(result.agreements) ? result.agreements : [];
  },

  create: async (agreement: {
    projectId: string;
    agreementType: ProjectAgreementType | string;
    counterpartyType: ProjectAgreementCounterpartyType | string;
    counterpartyId?: string;
    title: string;
    purpose?: string;
    disclosingPartyName?: string;
    disclosingPartyCompanyName?: string;
    disclosingPartyOrganizationNumber?: string;
    counterpartyName: string;
    counterpartyEmail?: string;
    counterpartyCompanyName?: string;
    counterpartyOrganizationNumber?: string;
    sections?: ProjectAgreementSection[];
    startDate?: string;
    endDate?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> => {
    const result = await apiRequest<{ agreementId: string }>('/project-agreements', {
      method: 'POST',
      body: JSON.stringify(agreement),
    });
    return result.agreementId;
  },

  updateStatus: async (agreementId: string, status: ProjectAgreementStatus): Promise<boolean> => {
    await apiRequest(`/project-agreements/${agreementId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return true;
  },

  getGoogleSignatures: async (projectId: string): Promise<RoleRoomGoogleAgreementSignature[]> => {
    const result = await apiRequest<{ signatures?: RoleRoomGoogleAgreementSignature[] }>(
      `/projects/${projectId}/google/agreements/signatures`,
    );
    return Array.isArray(result.signatures) ? result.signatures : [];
  },

  prepareGoogleSignature: async (
    projectId: string,
    agreementId: string,
  ): Promise<{
    agreement: ProjectAgreement;
    signature: RoleRoomGoogleAgreementSignature;
    artifacts: RoleRoomGoogleArtifactRef[];
    binding: RoleRoomGoogleProjectBinding | null;
  }> => (
    apiRequest(`/projects/${projectId}/google/agreements/${agreementId}/prepare`, {
      method: 'POST',
    })
  ),

  sendGoogleSignatureRequest: async (
    projectId: string,
    agreementId: string,
  ): Promise<{
    agreement: ProjectAgreement;
    signature: RoleRoomGoogleAgreementSignature;
    artifacts: RoleRoomGoogleArtifactRef[];
    binding: RoleRoomGoogleProjectBinding | null;
  }> => (
    apiRequest(`/projects/${projectId}/google/agreements/${agreementId}/send`, {
      method: 'POST',
    })
  ),

  syncGoogleSignature: async (
    projectId: string,
    agreementId: string,
  ): Promise<{
    agreement: ProjectAgreement;
    signature: RoleRoomGoogleAgreementSignature;
    artifacts: RoleRoomGoogleArtifactRef[];
    binding: RoleRoomGoogleProjectBinding | null;
  }> => (
    apiRequest(`/projects/${projectId}/google/agreements/${agreementId}/sync`, {
      method: 'POST',
    })
  ),

  updateGoogleSignatureStatus: async (
    projectId: string,
    agreementId: string,
    status: RoleRoomGoogleAgreementSignatureStatus,
    payload?: {
      reason?: string;
      signedDriveFileId?: string;
      webViewUrl?: string;
      requestUrl?: string;
    },
  ): Promise<{
    agreement: ProjectAgreement;
    signature: RoleRoomGoogleAgreementSignature;
    artifacts: RoleRoomGoogleArtifactRef[];
    binding: RoleRoomGoogleProjectBinding | null;
  }> => (
    apiRequest(`/projects/${projectId}/google/agreements/${agreementId}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status,
        ...payload,
      }),
    })
  ),
};

export const calendarEventsApi = {
  getAll: async (projectId: string): Promise<CalendarEvent[]> => {
    const result = await apiRequest<{ events: CalendarEvent[] }>(`/projects/${projectId}/calendar-events`);
    return result.events;
  },
  
  create: async (event: {
    projectId: string;
    title: string;
    description?: string;
    eventType?: string;
    startTime: string;
    endTime?: string;
    locationId?: string;
    allDay?: boolean;
    candidateIds?: string[];
    crewIds?: string[];
    shotListIds?: string[];
    notes?: string;
  }): Promise<string> => {
    const result = await apiRequest<{ eventId: string }>('/calendar-events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
    return result.eventId;
  },
  
  update: async (eventId: string, event: Partial<CalendarEvent>): Promise<boolean> => {
    await apiRequest(`/calendar-events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(event),
    });
    return true;
  },
  
  delete: async (eventId: string): Promise<boolean> => {
    await apiRequest(`/calendar-events/${eventId}`, { method: 'DELETE' });
    return true;
  },
};

export interface CrewAvailability {
  id: string;
  crew_id: string;
  project_id?: string;
  start_date: string;
  end_date: string;
  status: 'available' | 'unavailable' | 'tentative';
  is_recurring?: boolean;
  recurrence_pattern?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CrewNotification {
  id: string;
  crew_id: string;
  project_id?: string;
  event_id?: string;
  notification_type: string;
  channel: 'in_app' | 'email' | 'push';
  title: string;
  message?: string;
  payload?: Record<string, unknown>;
  status: 'pending' | 'sent' | 'read';
  read_at?: string;
  sent_at?: string;
  created_at?: string;
}

export interface CrewConflict {
  type: 'event' | 'unavailable';
  id: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

export const crewAvailabilityApi = {
  getAll: async (crewId: string, startDate?: string, endDate?: string): Promise<CrewAvailability[]> => {
    let url = `/crew/${crewId}/availability`;
    if (startDate && endDate) {
      url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    const result = await apiRequest<{ availability: CrewAvailability[] }>(url);
    return result.availability;
  },
  
  create: async (crewId: string, availability: {
    start_date: string;
    end_date: string;
    status?: string;
    is_recurring?: boolean;
    recurrence_pattern?: string;
    notes?: string;
    project_id?: string;
  }): Promise<CrewAvailability> => {
    const result = await apiRequest<{ availability: CrewAvailability }>(`/crew/${crewId}/availability`, {
      method: 'POST',
      body: JSON.stringify(availability),
    });
    return result.availability;
  },
  
  delete: async (crewId: string, availabilityId: string): Promise<boolean> => {
    await apiRequest(`/crew/${crewId}/availability/${availabilityId}`, { method: 'DELETE' });
    return true;
  },
};

export const crewNotificationsApi = {
  getAll: async (crewId: string, status?: string): Promise<CrewNotification[]> => {
    let url = `/crew/${crewId}/notifications`;
    if (status) url += `?status=${status}`;
    const result = await apiRequest<{ notifications: CrewNotification[] }>(url);
    return result.notifications;
  },
  
  create: async (crewId: string, notification: {
    project_id?: string;
    event_id?: string;
    notification_type?: string;
    channel?: string;
    title: string;
    message?: string;
    payload?: Record<string, unknown>;
  }): Promise<CrewNotification> => {
    const result = await apiRequest<{ notification: CrewNotification }>(`/crew/${crewId}/notifications`, {
      method: 'POST',
      body: JSON.stringify(notification),
    });
    return result.notification;
  },
  
  markAsRead: async (notificationId: string): Promise<CrewNotification> => {
    const result = await apiRequest<{ notification: CrewNotification }>(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
    return result.notification;
  },
};

export const crewConflictsApi = {
  check: async (crewId: string, startDate: string, endDate: string): Promise<{ conflicts: CrewConflict[]; hasConflicts: boolean }> => {
    const result = await apiRequest<{ conflicts: CrewConflict[]; has_conflicts: boolean }>(
      `/crew/${crewId}/conflicts?start_date=${startDate}&end_date=${endDate}`
    );
    return { conflicts: result.conflicts, hasConflicts: result.has_conflicts };
  },
};

// Equipment/Assets API (Utstyr)
export interface Equipment {
  id: string;
  project_id: string | null;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  quantity: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'needs_repair';
  primary_location_id?: string;
  location_name?: string;
  notes?: string;
  notes_author_name?: string;
  notes_author_id?: string;
  notes_updated_at?: string;
  notesAuthorName?: string;
  notesAuthorId?: string;
  notesUpdatedAt?: string;
  image_url?: string;
  status: 'available' | 'in_use' | 'maintenance' | 'retired';
  is_global?: boolean;
  assignees?: Array<{ crew_id: string; role: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface EquipmentBooking {
  id: string;
  equipment_id: string;
  event_id?: string;
  project_id: string;
  booked_by?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  quantity: number;
  purpose?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  created_at?: string;
}

export interface EquipmentAvailability {
  id: string;
  equipment_id: string;
  start_date: string;
  end_date: string;
  status: 'unavailable' | 'service' | 'reserved';
  reason?: string;
  notes?: string;
  created_at?: string;
}

export interface EquipmentConflict {
  type: 'booking' | 'unavailable' | 'service';
  id: string;
  start_date: string;
  end_date: string;
  purpose?: string;
  reason?: string;
  status?: string;
}

export type MemoryCardBackupStatus = 'not_backed_up' | 'backing_up' | 'verified';
export type MemoryCardLifecycleStage =
  | 'in_use'
  | 'sealed'
  | 'backup_started'
  | 'backup_completed'
  | 'verified'
  | 'archived';

export interface MemoryCardBackupTargets {
  backup1: boolean;
  backup2: boolean;
  offsite: boolean;
}

export interface MemoryCardLogEvent {
  ts: string;
  event: string;
  by?: string;
}

export interface MemoryCardControlEntry {
  id: string;
  cardLabel: string;
  cameraId: string;
  cameraLabel: string;
  assignedCrewId?: string;
  assignedCrewName?: string;
  assignedCrewRole?: string;
  cardTypeId?: string;
  cardTypeName?: string;
  capacity?: string;
  shotListId?: string;
  sceneLabel?: string;
  productionTag?: string;
  note?: string;
  imageDataUrl?: string;
  backups: MemoryCardBackupTargets;
  checksumVerified: boolean;
  status: MemoryCardBackupStatus;
  lifecycleStage: MemoryCardLifecycleStage;
  createdAt: string;
  updatedAt: string;
  history: MemoryCardLogEvent[];
}

export interface MemoryCardControlState {
  shootDayLabel: string;
  entries: MemoryCardControlEntry[];
  updatedAt: string;
}

export interface MemoryCardControlReport {
  shootDayLabel: string;
  updatedAt: string;
  summary: {
    total: number;
    notBackedUp: number;
    backingUp: number;
    verified: number;
    checksumVerified: number;
    fullyCompliant: number;
    compliancePercent: number;
    copyCoveragePercent: number;
    dualMediaCoveragePercent: number;
    offsiteCoveragePercent: number;
  };
  counts: {
    status: Record<'not_backed_up' | 'backing_up' | 'verified', number>;
    lifecycle: Array<{ key: string; value: number }>;
    crew: Array<{ crewName: string; count: number }>;
  };
  alerts: {
    riskLevel: 'low' | 'medium' | 'high';
    risks: string[];
    pendingOverSixHours: Array<{
      id: string;
      cardLabel: string;
      hours: number;
      updatedAt: string;
    }>;
  };
  rule321: {
    description: string;
    original: number;
    backup1: number;
    backup2: number;
    offsite: number;
  };
}

export interface MemoryCardQrLabelPayload {
  schema: string;
  projectId: string;
  entryId: string | null;
  cardLabel: string;
  cameraLabel: string | null;
  capacity: string | null;
  storageType: string | null;
  shootDayLabel: string | null;
  generatedAt: string;
}

export interface MemoryCardQrLabelResponse {
  ok: boolean;
  payload: MemoryCardQrLabelPayload;
  payloadString: string;
  qrDataUrl: string;
  suggestedFileName: string;
}

// ── Check-in / Check-out ─────────────────────────────────
export interface EquipmentCheckout {
  id: string;
  equipment_id: string;
  checked_out_to: string;      // crew member id
  checked_out_by?: string;
  checked_out_at: string;      // ISO timestamp
  checked_in_at?: string;
  quantity: number;
  purpose?: string;
  condition_on_return?: Equipment['condition'];
  notes?: string;
}

export const equipmentCheckoutApi = {
  /** Returns all active (not checked-in) checkouts for a project */
  getActive: async (projectId: string): Promise<EquipmentCheckout[]> => {
    try {
      const result = await apiRequest<{ checkouts: EquipmentCheckout[] }>(
        `/projects/${projectId}/equipment-checkouts?active=true`
      );
      return result.checkouts;
    } catch {
      return [];
    }
  },

  /** Returns all checkouts for a project, optionally filtered by equipmentId */
  getAll: async (projectId: string, equipmentId?: string): Promise<EquipmentCheckout[]> => {
    try {
      const params = new URLSearchParams();
      if (equipmentId) params.set('equipmentId', equipmentId);
      const result = await apiRequest<{ checkouts: EquipmentCheckout[] }>(
        `/projects/${projectId}/equipment-checkouts?${params.toString()}`
      );
      return Array.isArray(result.checkouts) ? result.checkouts : [];
    } catch {
      return [];
    }
  },

  checkOut: async (
    equipmentId: string,
    payload: Pick<EquipmentCheckout, 'checked_out_to' | 'quantity' | 'purpose'>
  ): Promise<EquipmentCheckout> => {
    const result = await apiRequest<{ checkout: EquipmentCheckout }>(
      `/equipment/${equipmentId}/checkout`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
    return result.checkout;
  },

  checkIn: async (
    checkoutId: string,
    payload: Pick<EquipmentCheckout, 'condition_on_return' | 'notes'>
  ): Promise<EquipmentCheckout> => {
    const result = await apiRequest<{ checkout: EquipmentCheckout }>(
      `/equipment/checkouts/${checkoutId}/checkin`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
    return result.checkout;
  },
};

export const equipmentApi = {
  getAll: async (projectId: string): Promise<Equipment[]> => {
    const result = await apiRequest<{ equipment: Equipment[] }>(`/projects/${projectId}/equipment`);
    return result.equipment;
  },
  
  create: async (equipment: Partial<Equipment>): Promise<Equipment> => {
    const result = await apiRequest<{ equipment: Equipment }>('/equipment', {
      method: 'POST',
      body: JSON.stringify(equipment),
    });
    return result.equipment;
  },
  
  update: async (id: string, equipment: Partial<Equipment>): Promise<Equipment> => {
    const result = await apiRequest<{ equipment: Equipment }>(`/equipment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(equipment),
    });
    return result.equipment;
  },
  
  delete: async (id: string): Promise<boolean> => {
    await apiRequest(`/equipment/${id}`, { method: 'DELETE' });
    return true;
  },
  
  assign: async (equipmentId: string, crewId: string, role = 'responsible', notes?: string): Promise<unknown> => {
    const result = await apiRequest(`/equipment/${equipmentId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ crew_id: crewId, role, notes }),
    });
    return result;
  },
  
  unassign: async (equipmentId: string, crewId: string): Promise<boolean> => {
    await apiRequest(`/equipment/${equipmentId}/assign/${crewId}`, { method: 'DELETE' });
    return true;
  },
  
  getByLocation: async (locationId: string): Promise<Equipment[]> => {
    const result = await apiRequest<{ equipment: Equipment[] }>(`/locations/${locationId}/equipment`);
    return result.equipment;
  },
  
  getByCrew: async (crewId: string): Promise<Equipment[]> => {
    const result = await apiRequest<{ equipment: Equipment[] }>(`/crew/${crewId}/equipment`);
    return result.equipment;
  },
};

export const equipmentBookingsApi = {
  getAll: async (equipmentId: string): Promise<EquipmentBooking[]> => {
    const result = await apiRequest<{ bookings: EquipmentBooking[] }>(`/equipment/${equipmentId}/bookings`);
    return result.bookings;
  },

  getByEvent: async (eventId: string): Promise<EquipmentBooking[]> => {
    const result = await apiRequest<{ bookings: EquipmentBooking[] }>(`/events/${eventId}/equipment-bookings`);
    return result.bookings;
  },
  
  create: async (equipmentId: string, booking: Partial<EquipmentBooking>): Promise<EquipmentBooking> => {
    const result = await apiRequest<{ booking: EquipmentBooking }>(`/equipment/${equipmentId}/bookings`, {
      method: 'POST',
      body: JSON.stringify(booking),
    });
    return result.booking;
  },

  update: async (bookingId: string, booking: Partial<EquipmentBooking>): Promise<EquipmentBooking> => {
    const result = await apiRequest<{ booking: EquipmentBooking }>(`/equipment/bookings/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify(booking),
    });
    return result.booking;
  },
  
  delete: async (bookingId: string): Promise<boolean> => {
    await apiRequest(`/equipment/bookings/${bookingId}`, { method: 'DELETE' });
    return true;
  },
};

export const equipmentAvailabilityApi = {
  getAll: async (equipmentId: string): Promise<EquipmentAvailability[]> => {
    const result = await apiRequest<{ availability: EquipmentAvailability[] }>(`/equipment/${equipmentId}/availability`);
    return result.availability;
  },
  
  create: async (equipmentId: string, availability: Partial<EquipmentAvailability>): Promise<EquipmentAvailability> => {
    const result = await apiRequest<{ availability: EquipmentAvailability }>(`/equipment/${equipmentId}/availability`, {
      method: 'POST',
      body: JSON.stringify(availability),
    });
    return result.availability;
  },
  
  delete: async (availabilityId: string): Promise<boolean> => {
    await apiRequest(`/equipment/availability/${availabilityId}`, { method: 'DELETE' });
    return true;
  },
};

export const equipmentConflictsApi = {
  check: async (equipmentId: string, startDate: string, endDate: string): Promise<{ conflicts: EquipmentConflict[]; hasConflicts: boolean }> => {
    const result = await apiRequest<{ conflicts: EquipmentConflict[]; has_conflicts: boolean }>(
      `/equipment/${equipmentId}/conflicts?start_date=${startDate}&end_date=${endDate}`
    );
    return { conflicts: result.conflicts, hasConflicts: result.has_conflicts };
  },
};

const createDefaultMemoryCardControlState = (): MemoryCardControlState => ({
  shootDayLabel: '',
  entries: [],
  updatedAt: new Date().toISOString(),
});

const normalizeMemoryCardControlState = (input: unknown): MemoryCardControlState => {
  if (!input || typeof input !== 'object') return createDefaultMemoryCardControlState();
  const value = input as Partial<MemoryCardControlState>;
  return {
    shootDayLabel: typeof value.shootDayLabel === 'string' ? value.shootDayLabel : '',
    entries: Array.isArray(value.entries) ? value.entries : [],
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
};

export const memoryCardControlApi = {
  get: async (projectId: string): Promise<MemoryCardControlState> => {
    const result = await apiRequest<{ state?: MemoryCardControlState } | MemoryCardControlState>(
      `/projects/${projectId}/memory-card-control`
    );
    if (result && typeof result === 'object' && 'state' in result) {
      return normalizeMemoryCardControlState(result.state);
    }
    return normalizeMemoryCardControlState(result);
  },

  save: async (projectId: string, state: MemoryCardControlState): Promise<MemoryCardControlState> => {
    const result = await apiRequest<{ state?: MemoryCardControlState } | MemoryCardControlState>(
      `/projects/${projectId}/memory-card-control`,
      {
        method: 'PUT',
        body: JSON.stringify({ state }),
      }
    );
    if (result && typeof result === 'object' && 'state' in result) {
      return normalizeMemoryCardControlState(result.state);
    }
    return normalizeMemoryCardControlState(result);
  },

  getReport: async (projectId: string): Promise<MemoryCardControlReport | null> => {
    try {
      const result = await apiRequest<{ ok?: boolean; report?: MemoryCardControlReport }>(
        `/projects/${projectId}/memory-card-control/report`
      );
      return result?.report ?? null;
    } catch {
      return null;
    }
  },

  generateQrLabel: async (
    projectId: string,
    payload: {
      entryId?: string;
      cardLabel?: string;
      cameraLabel?: string;
      capacity?: string;
      storageType?: string;
      shootDayLabel?: string;
    }
  ): Promise<MemoryCardQrLabelResponse> => {
    return apiRequest<MemoryCardQrLabelResponse>(
      `/projects/${projectId}/memory-card-control/qr-label`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },
};

export interface EquipmentTemplateItem {
  id: string;
  template_id: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  quantity: number;
  is_required: boolean;
  external_url?: string;
  estimated_price?: number;
  notes?: string;
  sort_order: number;
  created_at?: string;
}

export interface EquipmentTemplate {
  id: string;
  project_id: string | null;
  name: string;
  description?: string;
  category?: string;
  use_case?: string;
  is_default: boolean;
  is_global?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  items?: EquipmentTemplateItem[];
  item_count?: number;
}

export interface VendorLink {
  id: string;
  category: string;
  subcategory?: string;
  vendor_name: string;
  product_name: string;
  product_url: string;
  affiliate_url?: string;
  price?: number;
  image_url?: string;
  description?: string;
  is_recommended: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export const equipmentTemplatesApi = {
  getAll: async (projectId: string): Promise<EquipmentTemplate[]> => {
    const result = await apiRequest<{ templates: EquipmentTemplate[] }>(`/projects/${projectId}/equipment-templates`);
    return result.templates;
  },
  
  get: async (templateId: string): Promise<EquipmentTemplate> => {
    const result = await apiRequest<{ template: EquipmentTemplate }>(`/equipment-templates/${templateId}`);
    return result.template;
  },
  
  create: async (projectId: string, template: Partial<EquipmentTemplate>): Promise<EquipmentTemplate> => {
    const result = await apiRequest<{ template: EquipmentTemplate }>(`/projects/${projectId}/equipment-templates`, {
      method: 'POST',
      body: JSON.stringify(template),
    });
    return result.template;
  },
  
  update: async (templateId: string, template: Partial<EquipmentTemplate>): Promise<EquipmentTemplate> => {
    const result = await apiRequest<{ template: EquipmentTemplate }>(`/equipment-templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
    return result.template;
  },
  
  delete: async (templateId: string): Promise<boolean> => {
    await apiRequest(`/equipment-templates/${templateId}`, { method: 'DELETE' });
    return true;
  },
  
  apply: async (templateId: string, projectId: string): Promise<{ equipment: Equipment[]; count: number }> => {
    const result = await apiRequest<{ equipment: Equipment[]; count: number }>(`/equipment-templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    });
    return result;
  },
};

export const vendorLinksApi = {
  getAll: async (category?: string): Promise<VendorLink[]> => {
    const url = category ? `/vendor-links?category=${encodeURIComponent(category)}` : '/vendor-links';
    const result = await apiRequest<{ links: VendorLink[] }>(url);
    return result.links;
  },
  
  getCategories: async (): Promise<{ category: string; count: number }[]> => {
    const result = await apiRequest<{ categories: { category: string; count: number }[] }>('/vendor-links/categories');
    return result.categories;
  },
  
  create: async (link: Partial<VendorLink>): Promise<VendorLink> => {
    const result = await apiRequest<{ link: VendorLink }>('/vendor-links', {
      method: 'POST',
      body: JSON.stringify(link),
    });
    return result.link;
  },
  
  delete: async (linkId: string): Promise<boolean> => {
    await apiRequest(`/vendor-links/${linkId}`, { method: 'DELETE' });
    return true;
  },
};

// Production Days API
export interface ProductionDay {
  id: string;
  project_id: string;
  date: string;
  call_time: string;
  wrap_time: string;
  location_id?: string;
  location_name?: string;
  scenes?: string[];
  crew?: string[];
  props?: string[];
  notes?: string;
  status?: 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  weather_forecast?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export const productionDaysApi = {
  getAll: async (projectId: string): Promise<ProductionDay[]> => {
    const result = await apiRequest<{ productionDays: ProductionDay[] }>(`/projects/${projectId}/production-days`);
    return result.productionDays;
  },
  
  save: async (productionDay: Partial<ProductionDay>): Promise<ProductionDay> => {
    const result = await apiRequest<{ productionDay: ProductionDay }>('/production-days', {
      method: 'POST',
      body: JSON.stringify(productionDay),
    });
    return result.productionDay;
  },
  
  delete: async (dayId: string): Promise<boolean> => {
    await apiRequest(`/production-days/${dayId}`, { method: 'DELETE' });
    return true;
  },
};

// User Roles API (Sharing/Permissions)
export interface UserRole {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at?: string;
  updated_at?: string;
}

export const userRolesApi = {
  getAll: async (projectId: string): Promise<UserRole[]> => {
    const result = await apiRequest<{ userRoles: UserRole[] }>(`/projects/${projectId}/user-roles`);
    return result.userRoles;
  },
  
  set: async (projectId: string, userId: string, role: string): Promise<UserRole> => {
    const result = await apiRequest<{ userRole: UserRole }>('/user-roles', {
      method: 'POST',
      body: JSON.stringify({ projectId, userId, role }),
    });
    return result.userRole;
  },
  
  remove: async (projectId: string, userId: string): Promise<boolean> => {
    await apiRequest(`/user-roles/${projectId}/${userId}`, { method: 'DELETE' });
    return true;
  },
};

// Shot Production Details API
export interface ShotCamera {
  id: string;
  shot_id: string;
  scene_id?: string;
  camera_type?: string;
  lens?: string;
  focal_length?: number;
  aperture?: string;
  iso?: number;
  shutter_speed?: string;
  frame_rate?: number;
  resolution?: string;
  aspect_ratio?: string;
  camera_movement?: string;
  gimbal_settings?: Record<string, unknown>;
  focus_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShotLighting {
  id: string;
  shot_id: string;
  scene_id?: string;
  lighting_setup_name?: string;
  key_light?: Record<string, unknown>;
  fill_light?: Record<string, unknown>;
  back_light?: Record<string, unknown>;
  practical_lights?: Record<string, unknown>[];
  light_diagram_url?: string;
  color_temperature?: number;
  lighting_style?: string;
  special_effects?: Record<string, unknown>[];
  power_requirements?: string;
  setup_time?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShotAudio {
  id: string;
  shot_id: string;
  scene_id?: string;
  audio_type?: string;
  microphone_setup?: Record<string, unknown>[];
  boom_operator_needed?: boolean;
  wireless_mics_count?: number;
  sound_blankets_needed?: boolean;
  ambient_sound_notes?: string;
  dialogue_notes?: string;
  music_cue?: string;
  sound_effects_needed?: Record<string, unknown>[];
  adr_required?: boolean;
  audio_format?: string;
  channels?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShotNote {
  id: string;
  shot_id: string;
  scene_id?: string;
  note_type?: 'general' | 'director' | 'cinematographer' | 'script' | 'continuity';
  content: string;
  author?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  tags?: string[];
  attachments?: string[];
  resolved?: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_at?: string;
  updated_at?: string;
}

export const shotDetailsApi = {
  // Camera
  getCamera: async (shotId: string): Promise<ShotCamera | null> => {
    const result = await apiRequest<{ camera: ShotCamera | null }>(`/shots/${shotId}/camera`);
    return result.camera;
  },
  
  saveCamera: async (shotId: string, camera: Partial<ShotCamera>): Promise<ShotCamera> => {
    const result = await apiRequest<{ camera: ShotCamera }>(`/shots/${shotId}/camera`, {
      method: 'POST',
      body: JSON.stringify(camera),
    });
    return result.camera;
  },
  
  // Lighting
  getLighting: async (shotId: string): Promise<ShotLighting | null> => {
    const result = await apiRequest<{ lighting: ShotLighting | null }>(`/shots/${shotId}/lighting`);
    return result.lighting;
  },
  
  saveLighting: async (shotId: string, lighting: Partial<ShotLighting>): Promise<ShotLighting> => {
    const result = await apiRequest<{ lighting: ShotLighting }>(`/shots/${shotId}/lighting`, {
      method: 'POST',
      body: JSON.stringify(lighting),
    });
    return result.lighting;
  },
  
  // Audio
  getAudio: async (shotId: string): Promise<ShotAudio | null> => {
    const result = await apiRequest<{ audio: ShotAudio | null }>(`/shots/${shotId}/audio`);
    return result.audio;
  },
  
  saveAudio: async (shotId: string, audio: Partial<ShotAudio>): Promise<ShotAudio> => {
    const result = await apiRequest<{ audio: ShotAudio }>(`/shots/${shotId}/audio`, {
      method: 'POST',
      body: JSON.stringify(audio),
    });
    return result.audio;
  },
  
  // Notes
  getNotes: async (shotId: string): Promise<ShotNote[]> => {
    const result = await apiRequest<{ notes: ShotNote[] }>(`/shots/${shotId}/notes`);
    return result.notes;
  },
  
  createNote: async (shotId: string, note: Partial<ShotNote>): Promise<ShotNote> => {
    const result = await apiRequest<{ note: ShotNote }>(`/shots/${shotId}/notes`, {
      method: 'POST',
      body: JSON.stringify(note),
    });
    return result.note;
  },
  
  resolveNote: async (noteId: string, resolvedBy?: string): Promise<ShotNote> => {
    const result = await apiRequest<{ note: ShotNote }>(`/shot-notes/${noteId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ resolvedBy }),
    });
    return result.note;
  },
  
  deleteNote: async (noteId: string): Promise<boolean> => {
    await apiRequest(`/shot-notes/${noteId}`, { method: 'DELETE' });
    return true;
  },
};

export const googleWorkspaceApi = {
  getStatus: async (projectId?: string): Promise<RoleRoomGoogleStatusResponse> => {
    const params = new URLSearchParams();
    if (projectId) {
      params.set('projectId', projectId);
    }
    const query = params.toString();
    return apiRequest<RoleRoomGoogleStatusResponse>(`/google/status${query ? `?${query}` : ''}`);
  },

  startOauth: async (
    payload: RoleRoomGoogleOauthStartInput,
  ): Promise<{ success: boolean; mode: 'login' | 'link'; authorizationUrl: string; stateId: string }> => (
    apiRequest('/google/oauth/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  ),

  getOauthSessionResult: async (transferId: string): Promise<RoleRoomGoogleLoginResult> => (
    apiRequest<RoleRoomGoogleLoginResult>(`/google/oauth/session-result/${encodeURIComponent(transferId)}`)
  ),

  completeLink: async (transferId: string): Promise<RoleRoomGoogleStatusResponse> => (
    apiRequest<RoleRoomGoogleStatusResponse>('/google/link', {
      method: 'POST',
      body: JSON.stringify({ transferId }),
    })
  ),

  unlink: async (): Promise<RoleRoomGoogleStatusResponse> => (
    apiRequest<RoleRoomGoogleStatusResponse>('/google/link', {
      method: 'DELETE',
    })
  ),

  getProjectBinding: async (projectId: string): Promise<RoleRoomGoogleBindingResponse> => (
    apiRequest<RoleRoomGoogleBindingResponse>(`/projects/${projectId}/google/binding`)
  ),

  saveProjectBinding: async (
    projectId: string,
    payload: RoleRoomGoogleProjectBindingUpdateInput,
  ): Promise<RoleRoomGoogleBindingResponse> => (
    apiRequest<RoleRoomGoogleBindingResponse>(`/projects/${projectId}/google/binding`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  ),

  ensureProjectBindingReady: async (
    projectId: string,
    binding?: RoleRoomGoogleProjectBinding | null,
  ): Promise<RoleRoomGoogleBindingResponse | null> => {
    if (hasReadyGoogleProjectBinding(binding)) {
      return null;
    }

    const existingRequest = googleBindingBootstrapRequests.get(projectId);
    if (existingRequest) {
      return existingRequest;
    }

    const request = apiRequest<RoleRoomGoogleBindingResponse>(`/projects/${projectId}/google/binding`, {
      method: 'POST',
      body: JSON.stringify({
        contactsContext: binding?.contactsContext ?? {},
        meetCreationEnabled: binding?.meetCreationEnabled ?? true,
        auditSignatureStorageEnabled: binding?.auditSignatureStorageEnabled ?? true,
        createDriveLayout: !hasText(binding?.driveRootFolderId),
        createCalendar: !hasText(binding?.calendarId),
      } satisfies RoleRoomGoogleProjectBindingUpdateInput),
    }).finally(() => {
      googleBindingBootstrapRequests.delete(projectId);
    });

    googleBindingBootstrapRequests.set(projectId, request);
    return request;
  },

  syncDrive: async (
    projectId: string,
    payload: RoleRoomGoogleDriveSyncInput,
  ): Promise<RoleRoomGoogleBindingResponse & { syncedArtifacts: RoleRoomGoogleArtifactRef[] }> => (
    apiRequest<RoleRoomGoogleBindingResponse & { syncedArtifacts: RoleRoomGoogleArtifactRef[] }>(
      `/projects/${projectId}/google/drive/sync`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  ),

  syncCalendar: async (
    projectId: string,
    payload: RoleRoomGoogleCalendarSyncInput,
  ): Promise<RoleRoomGoogleBindingResponse & { syncedEvents: RoleRoomGoogleArtifactRef[] }> => (
    apiRequest<RoleRoomGoogleBindingResponse & { syncedEvents: RoleRoomGoogleArtifactRef[] }>(
      `/projects/${projectId}/google/calendar/sync`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  ),

  createMeetSession: async (
    projectId: string,
    payload: RoleRoomGoogleMeetSessionInput,
  ): Promise<RoleRoomGoogleBindingResponse & { event: Record<string, unknown> }> => (
    apiRequest<RoleRoomGoogleBindingResponse & { event: Record<string, unknown> }>(
      `/projects/${projectId}/google/meet/session`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  ),

  searchPeople: async (
    projectId: string,
    query: string,
  ): Promise<{
    contacts: RoleRoomGooglePersonContact[];
    contactsContext: Record<string, unknown>;
  }> => {
    const params = new URLSearchParams({ q: query });
    return apiRequest(`/projects/${projectId}/google/people/search?${params.toString()}`);
  },
};

export const linkedInWorkspaceApi = {
  getStatus: async (): Promise<RoleRoomLinkedInStatusResponse> => (
    apiRequest<RoleRoomLinkedInStatusResponse>('/linkedin/status')
  ),

  startOauth: async (
    payload: RoleRoomLinkedInOauthStartInput,
  ): Promise<{ success: boolean; mode: 'link'; authorizationUrl: string; stateId: string }> => (
    apiRequest('/linkedin/oauth/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  ),

  getOauthSessionResult: async (transferId: string): Promise<RoleRoomLinkedInLinkResult> => (
    apiRequest<RoleRoomLinkedInLinkResult>(`/linkedin/oauth/session-result/${encodeURIComponent(transferId)}`)
  ),

  completeLink: async (transferId: string): Promise<RoleRoomLinkedInStatusResponse> => (
    apiRequest<RoleRoomLinkedInStatusResponse>('/linkedin/link', {
      method: 'POST',
      body: JSON.stringify({ transferId }),
    })
  ),

  unlink: async (): Promise<RoleRoomLinkedInStatusResponse> => (
    apiRequest<RoleRoomLinkedInStatusResponse>('/linkedin/link', {
      method: 'DELETE',
    })
  ),
};

export const roleRoomBillingApi = {
  getAccount: async (): Promise<RoleRoomCommercialBillingAccount> => {
    const result = await apiRequest<{ success: boolean; account: RoleRoomCommercialBillingAccount }>(
      '/billing/account',
    );
    return result.account;
  },

  openBillingPortal: async (payload?: {
    browserOrigin?: string;
    returnPath?: string;
  }): Promise<RoleRoomCommercialBillingPortalResponse> => (
    apiRequest<RoleRoomCommercialBillingPortalResponse>('/billing/manage', {
      method: 'POST',
      body: JSON.stringify({
        browserOrigin: payload?.browserOrigin,
        returnPath: payload?.returnPath,
      }),
    })
  ),

  retryPayment: async (): Promise<RoleRoomCommercialRetryPaymentResponse> => (
    apiRequest<RoleRoomCommercialRetryPaymentResponse>('/billing/retry-payment', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  ),
};

export const castingApi = {
  favorites: favoritesApi,
  projects: projectsApi,
  candidates: candidatesApi,
  roles: rolesApi,
  crew: crewApi,
  locations: locationsApi,
  props: propsApi,
  schedules: schedulesApi,
  talentPortal: talentPortalApi,
  workflow: workflowApi,
  offers: offersApi,
  contracts: contractsApi,
  calendarEvents: calendarEventsApi,
  crewAvailability: crewAvailabilityApi,
  crewNotifications: crewNotificationsApi,
  crewConflicts: crewConflictsApi,
  equipment: equipmentApi,
  equipmentBookings: equipmentBookingsApi,
  equipmentAvailability: equipmentAvailabilityApi,
  equipmentConflicts: equipmentConflictsApi,
  equipmentCheckouts: equipmentCheckoutApi,
  equipmentTemplates: equipmentTemplatesApi,
  vendorLinks: vendorLinksApi,
  productionDays: productionDaysApi,
  userRoles: userRolesApi,
  shotDetails: shotDetailsApi,
  googleWorkspace: googleWorkspaceApi,
  linkedInWorkspace: linkedInWorkspaceApi,
  roleRoomBilling: roleRoomBillingApi,
};

export default castingApi;

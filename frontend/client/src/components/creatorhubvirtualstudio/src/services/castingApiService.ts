const API_BASE = '/api/casting';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  
  return response.json();
}

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
    const result = await apiRequest<{ candidates: CastingCandidate[] }>(`/projects/${projectId}/candidates`);
    return result.candidates;
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
    const result = await apiRequest<{ crew: CastingCrew[] }>(`/projects/${projectId}/crew`);
    return result.crew;
  },
  
  save: async (crew: Partial<CastingCrew>): Promise<CastingCrew> => {
    const result = await apiRequest<{ crew: CastingCrew }>('/crew', {
      method: 'POST',
      body: JSON.stringify(crew),
    });
    return result.crew;
  },
  
  delete: async (crewId: string): Promise<boolean> => {
    await apiRequest(`/crew/${crewId}`, { method: 'DELETE' });
    return true;
  },
};

export const locationsApi = {
  getAll: async (projectId: string): Promise<CastingLocation[]> => {
    const result = await apiRequest<{ locations: CastingLocation[] }>(`/projects/${projectId}/locations`);
    return result.locations;
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

export interface CalendarEvent {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  event_type: 'audition' | 'fitting' | 'rehearsal' | 'shooting' | 'general';
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

export const castingApi = {
  favorites: favoritesApi,
  projects: projectsApi,
  candidates: candidatesApi,
  roles: rolesApi,
  crew: crewApi,
  locations: locationsApi,
  props: propsApi,
  schedules: schedulesApi,
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
  equipmentTemplates: equipmentTemplatesApi,
  vendorLinks: vendorLinksApi,
  productionDays: productionDaysApi,
  userRoles: userRolesApi,
  shotDetails: shotDetailsApi,
};

export default castingApi;

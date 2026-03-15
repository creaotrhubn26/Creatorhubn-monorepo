const API_BASE = '/api/role-room';

function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('creatorhub_auth_token');
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // Ignore environments without localStorage.
  }
  return {};
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let parsed: unknown = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }
    const detail = typeof parsed === 'object' && parsed && 'error' in parsed
      ? String((parsed as { error?: unknown }).error ?? `Request failed (${response.status})`)
      : raw || `Request failed (${response.status})`;
    throw new Error(detail);
  }

  return response.json();
}

export type ProducerPhase = 'preproduction' | 'production' | 'postproduction';
export type ProducerReviewDecision = 'approved' | 'rejected' | 'changes_requested';

export interface ProducerTimelineItem {
  id: string;
  project_id: string;
  phase: ProducerPhase;
  title: string;
  description?: string | null;
  owner_user_id?: string | null;
  due_at?: string | null;
  status: string;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  sort_order: number;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProducerEconomyItem {
  id: string;
  project_id: string;
  phase: ProducerPhase;
  category: string;
  item_name: string;
  description?: string | null;
  estimate: string | number;
  approved: string | number;
  actual: string | number;
  currency: string;
  status: string;
  client_visible: boolean;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  sort_order: number;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProducerReviewComment {
  id: string;
  review_id: string;
  project_id: string;
  author_user_id?: string | null;
  author_role?: string | null;
  comment_text: string;
  timestamp_seconds?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProducerClientReview {
  id: string;
  project_id: string;
  review_type: string;
  title: string;
  description?: string | null;
  target_entity_type?: string | null;
  target_entity_id?: string | null;
  requested_by_user_id?: string | null;
  requested_at: string;
  due_at?: string | null;
  status: string;
  decision_by_user_id?: string | null;
  decision_at?: string | null;
  decision_reason?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  comments: ProducerReviewComment[];
}

export interface CreateProducerTimelineItemInput {
  phase: ProducerPhase;
  title: string;
  description?: string;
  ownerUserId?: string;
  dueAt?: string;
  status?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export type UpdateProducerTimelineItemInput = Partial<CreateProducerTimelineItemInput>;

export interface CreateProducerEconomyItemInput {
  phase: ProducerPhase;
  category: string;
  itemName: string;
  description?: string;
  estimate?: number;
  approved?: number;
  actual?: number;
  currency?: string;
  status?: string;
  clientVisible?: boolean;
  linkedEntityType?: string;
  linkedEntityId?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export type UpdateProducerEconomyItemInput = Partial<CreateProducerEconomyItemInput>;

export interface CreateProducerReviewInput {
  reviewType: string;
  title: string;
  description?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  dueAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AddProducerReviewCommentInput {
  commentText: string;
  timestampSeconds?: number;
}

export interface SetProducerReviewDecisionInput {
  decision: ProducerReviewDecision;
  reason?: string;
  timestampSeconds?: number;
}

export const producerWorkflowService = {
  async getTimeline(projectId: string): Promise<ProducerTimelineItem[]> {
    const result = await apiRequest<{ items: ProducerTimelineItem[] }>(`/projects/${projectId}/producer/timeline`);
    return Array.isArray(result.items) ? result.items : [];
  },

  async createTimelineItem(projectId: string, payload: CreateProducerTimelineItemInput): Promise<ProducerTimelineItem> {
    const result = await apiRequest<{ item: ProducerTimelineItem }>(`/projects/${projectId}/producer/timeline`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result.item;
  },

  async updateTimelineItem(
    projectId: string,
    itemId: string,
    payload: UpdateProducerTimelineItemInput,
  ): Promise<ProducerTimelineItem> {
    const result = await apiRequest<{ item: ProducerTimelineItem }>(
      `/projects/${projectId}/producer/timeline/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    return result.item;
  },

  async deleteTimelineItem(projectId: string, itemId: string): Promise<void> {
    await apiRequest<{ success: true; itemId: string }>(
      `/projects/${projectId}/producer/timeline/${itemId}`,
      { method: 'DELETE' },
    );
  },

  async getEconomyItems(projectId: string): Promise<ProducerEconomyItem[]> {
    const result = await apiRequest<{ items: ProducerEconomyItem[] }>(`/projects/${projectId}/producer/economy/items`);
    return Array.isArray(result.items) ? result.items : [];
  },

  async createEconomyItem(projectId: string, payload: CreateProducerEconomyItemInput): Promise<ProducerEconomyItem> {
    const result = await apiRequest<{ item: ProducerEconomyItem }>(`/projects/${projectId}/producer/economy/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result.item;
  },

  async updateEconomyItem(
    projectId: string,
    itemId: string,
    payload: UpdateProducerEconomyItemInput
  ): Promise<ProducerEconomyItem> {
    const result = await apiRequest<{ item: ProducerEconomyItem }>(
      `/projects/${projectId}/producer/economy/items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    return result.item;
  },

  async deleteEconomyItem(projectId: string, itemId: string): Promise<void> {
    await apiRequest<{ success: true; itemId: string }>(
      `/projects/${projectId}/producer/economy/items/${itemId}`,
      { method: 'DELETE' },
    );
  },

  async getReviews(projectId: string): Promise<ProducerClientReview[]> {
    const result = await apiRequest<{ items: ProducerClientReview[] }>(`/projects/${projectId}/producer/reviews`);
    return Array.isArray(result.items) ? result.items : [];
  },

  async createReview(projectId: string, payload: CreateProducerReviewInput): Promise<ProducerClientReview> {
    const result = await apiRequest<{ review: ProducerClientReview }>(`/projects/${projectId}/producer/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result.review;
  },

  async addReviewComment(
    projectId: string,
    reviewId: string,
    payload: AddProducerReviewCommentInput
  ): Promise<ProducerReviewComment> {
    const result = await apiRequest<{ comment: ProducerReviewComment }>(
      `/projects/${projectId}/producer/reviews/${reviewId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    return result.comment;
  },

  async setReviewDecision(
    projectId: string,
    reviewId: string,
    payload: SetProducerReviewDecisionInput
  ): Promise<ProducerClientReview> {
    const result = await apiRequest<{ review: ProducerClientReview }>(
      `/projects/${projectId}/producer/reviews/${reviewId}/decision`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    return result.review;
  },
};

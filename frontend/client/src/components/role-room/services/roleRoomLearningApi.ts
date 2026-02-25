/**
 * Role Room Learning Engine — Frontend API Client
 *
 * Makes The Role Room forstå brukeren og teamet.
 * Five engines: Interaction Log · User Insights · Team Dynamics · Project Patterns · Preference Learner
 */

const API = '/api/role-room';

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('creatorhub_auth_token');
    if (token) return { Authorization: `Bearer ${token}` };
  } catch { /* SSR */ }
  return {};
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ───

export interface UserInsights {
  userId: string;
  creativeDna: {
    preferredGenres: string[];
    visualSignatures: string[];
    narrativeTendencies: string[];
    genreComfort: Record<string, number>;
  };
  workPatterns: {
    avgSessionHours: number;
    peakHours: number[];
    preferredDay: string;
    sprintTendency: number;
    planningToExecutionRatio: number;
    totalSessions: number;
  };
  decisionPatterns: {
    revisionFrequency: 'low' | 'medium' | 'high';
    delegationTendency: number;
    areasOfFocus: string[];
    approvalSpeed: 'fast' | 'moderate' | 'deliberate';
  };
  communicationStyle: {
    responseTimeAvgMin: number;
    detailLevel: 'concise' | 'moderate' | 'detailed';
    notificationResponsiveness: Record<string, number>;
  };
  skillTrajectory: {
    projectComplexityTrend: 'increasing' | 'stable' | 'decreasing';
    teamSizeTrend: 'growing' | 'stable' | 'shrinking';
    newCapabilities: string[];
    growthRate: number;
  };
  engagementMetrics: {
    totalProjects: number;
    totalSessions: number;
    avgProjectDurationDays: number;
    featuresUsed: Record<string, number>;
    lastActive: string;
    memberSinceDays: number;
  };
  confidenceScore: number;
  totalEventsAnalyzed: number;
  computedAt: string;
}

export interface TeamMember {
  id: number;
  userId: string | null;
  crewMemberName: string | null;
  crewRole: string;
  crewDepartment: string | null;
  collaborationCount: number;
  projectIds: string[];
  totalDaysTogether: number;
  synergyScore: number;
  reliabilityScore: number;
  rehireRate: number | null;
  preferredPairing: string[];
  strengths: string[];
  notesSummary: string | null;
}

export interface TeamReport {
  members: TeamMember[];
  topPairings: Array<{ names: string[]; projects: number; synergy: number }>;
  departmentCoverage: Record<string, number>;
  reliabilityAvg: number;
  insights: string[];
}

export interface ProjectPattern {
  id: number;
  patternType: string;
  patternKey: string;
  patternData: Record<string, unknown>;
  description: string;
  confidence: number;
  evidenceCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface LearnedPreference {
  id: number;
  preferenceKey: string;
  preferenceValue: string;
  preferenceType: 'auto' | 'confirmed';
  category: string;
  confidence: number;
  evidenceCount: number;
}

export interface LearningSnapshot {
  userInsights: UserInsights | null;
  teamReport: TeamReport;
  patterns: ProjectPattern[];
  preferences: LearnedPreference[];
  greeting: string;
  nudges: string[];
}

// ─── Interaction Logging API ───

export const interactionApi = {
  log(event: {
    eventType: string;
    projectId?: string;
    entityType?: string;
    entityId?: string;
    context?: Record<string, unknown>;
    sessionId?: string;
    durationMs?: number;
  }): Promise<{ ok: boolean }> {
    return req('/learning/log', { method: 'POST', body: JSON.stringify(event) });
  },

  logBatch(events: Array<{
    eventType: string;
    projectId?: string;
    entityType?: string;
    entityId?: string;
    context?: Record<string, unknown>;
  }>): Promise<{ ok: boolean; count: number }> {
    return req('/learning/log-batch', { method: 'POST', body: JSON.stringify({ events }) });
  },

  getActivity(userId: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    return req(`/learning/activity/${userId}?limit=${limit}`);
  },
};

// ─── User Insights API ───

export const insightsApi = {
  get(userId: string): Promise<UserInsights | null> {
    return req(`/learning/insights/${userId}`);
  },

  compute(userId: string): Promise<UserInsights> {
    return req(`/learning/insights/${userId}/compute`, { method: 'POST' });
  },
};

// ─── Team Dynamics API ───

export const teamApi = {
  get(userId: string): Promise<TeamMember[]> {
    return req(`/learning/team/${userId}`);
  },

  compute(userId: string): Promise<TeamReport> {
    return req(`/learning/team/${userId}/compute`, { method: 'POST' });
  },
};

// ─── Project Patterns API ───

export const patternsApi = {
  get(userId: string): Promise<ProjectPattern[]> {
    return req(`/learning/patterns/${userId}`);
  },

  discover(userId: string): Promise<ProjectPattern[]> {
    return req(`/learning/patterns/${userId}/discover`, { method: 'POST' });
  },
};

// ─── Learned Preferences API ───

export const preferencesApi = {
  get(userId: string): Promise<LearnedPreference[]> {
    return req(`/learning/preferences/${userId}`);
  },

  learn(userId: string): Promise<LearnedPreference[]> {
    return req(`/learning/preferences/${userId}/learn`, { method: 'POST' });
  },

  confirm(userId: string, key: string, value?: string): Promise<{ ok: boolean }> {
    return req(`/learning/preferences/${userId}/${key}/confirm`, {
      method: 'PUT',
      body: JSON.stringify(value ? { value } : {}),
    });
  },
};

// ─── Full Snapshot API (everything The Role Room knows) ───

export const snapshotApi = {
  get(userId: string): Promise<LearningSnapshot> {
    return req(`/learning/snapshot/${userId}`);
  },

  recompute(userId: string): Promise<LearningSnapshot> {
    return req(`/learning/recompute/${userId}`, { method: 'POST' });
  },
};

// ─── Smart Crew Suggestions API ───

export interface CrewSuggestion {
  name: string;
  role: string;
  department: string | null;
  score: number;
  reasons: string[];
  collaborationCount: number;
  reliabilityScore: number;
  synergyWithOthers: Array<{ name: string; synergy: number }>;
}

export interface DreamTeam {
  members: CrewSuggestion[];
  overallChemistry: number;
  missingRoles: string[];
  insights: string[];
}

export const crewSuggestApi = {
  suggest(userId: string, role?: string, limit = 10): Promise<CrewSuggestion[]> {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (limit !== 10) params.set('limit', String(limit));
    const qs = params.toString();
    return req(`/learning/suggest-crew/${userId}${qs ? `?${qs}` : ''}`);
  },

  dreamTeam(userId: string, roles?: string[]): Promise<DreamTeam> {
    return req(`/learning/dream-team/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ roles: roles || [] }),
    });
  },
};

// ─── Team Chemistry Prediction API ───

export interface ChemistryPrediction {
  overallScore: number;
  pairScores: Array<{ a: string; b: string; score: number; history: number }>;
  risks: string[];
  strengths: string[];
  unknownMembers: string[];
  suggestion: string;
}

export const chemistryApi = {
  predict(userId: string, crewNames: string[]): Promise<ChemistryPrediction> {
    return req(`/learning/chemistry/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ crewNames }),
    });
  },
};

// ─── Intelligent Project Setup API ───

export interface ProjectSetupSuggestion {
  suggestedGenre: string | null;
  suggestedProjectType: string | null;
  suggestedBudget: number | null;
  suggestedCurrency: string | null;
  suggestedCallTime: string | null;
  suggestedCrewRoles: string[];
  suggestedCrewNames: Array<{ name: string; role: string; reason: string }>;
  confidence: number;
  basedOn: number;
}

export const projectSetupApi = {
  suggest(userId: string): Promise<ProjectSetupSuggestion> {
    return req(`/learning/project-setup/${userId}`);
  },
};

// ─── Learning Timeline API ───

export interface TimelineEvent {
  date: string;
  type: 'project_created' | 'crew_added' | 'milestone' | 'pattern_discovered' | 'preference_learned' | 'insight';
  title: string;
  description: string;
  data?: Record<string, unknown>;
}

export interface LearningTimeline {
  events: TimelineEvent[];
  milestones: TimelineEvent[];
  growthSummary: string;
}

export const timelineApi = {
  get(userId: string): Promise<LearningTimeline> {
    return req(`/learning/timeline/${userId}`);
  },
};

// ─── Contextual Nudges API ───

export const nudgesApi = {
  get(userId: string, context: string): Promise<string[]> {
    return req(`/learning/nudges/${userId}/${context}`);
  },
};

// ─── Combined Export ───

export const learningApi = {
  interaction: interactionApi,
  insights: insightsApi,
  team: teamApi,
  patterns: patternsApi,
  preferences: preferencesApi,
  snapshot: snapshotApi,
  crewSuggest: crewSuggestApi,
  chemistry: chemistryApi,
  projectSetup: projectSetupApi,
  timeline: timelineApi,
  nudges: nudgesApi,
};

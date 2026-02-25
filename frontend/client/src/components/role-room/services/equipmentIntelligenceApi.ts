/**
 * Equipment Intelligence API Client
 *
 * Frontend client for the 7 intelligence engines:
 *   Predictive Failure · Compatibility · Weight Sim · Scene Continuity
 *   Equipment Memory · Style Memory · Explanation Layer
 */

const V2 = '/api/equipment/v2';

// ─── shared fetch helper ───

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${V2}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types (mirrors backend) ───

export interface Explanation {
  summary: string;
  factors: string[];
  confidence: number;
}

export interface PredictiveRisk {
  equipmentId: string;
  name: string;
  brand: string;
  model: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskPercent: number;
  risks: Array<{
    type: 'overheating' | 'battery_failure' | 'shutter_wear' | 'general_wear' | 'maintenance_overdue';
    probability: number;
    description: string;
    recommendation: string;
  }>;
  explanation: Explanation;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
  }>;
  details: Record<string, unknown>;
  explanation: Explanation;
}

export interface LoadSimulation {
  totalWeightG: number;
  maxPayloadG: number | null;
  utilizationPercent: number | null;
  safetyMargin: 'safe' | 'near_limit' | 'over_limit' | 'unknown';
  items: Array<{ brand: string; model: string; weightG: number; isPayloadCarrier: boolean }>;
  warnings: string[];
  explanation: Explanation;
}

export interface SceneContinuityEntry {
  id: string;
  projectId: string;
  sceneNumber: number | null;
  sceneLabel: string;
  sceneType: string;
  gearSetup: Record<string, { id?: string; brand: string; model: string }>;
  lightingSetup: Record<string, unknown> | null;
  audioSetup: Record<string, unknown> | null;
  shootDate: string;
  notes: string | null;
}

export interface ContinuityBreak {
  sceneLabel: string;
  entries: Array<{ date: string; camera: string; lens: string }>;
  issue: string;
}

export interface EquipmentPreference {
  category: string;
  topChoices: Array<{ brand: string; model: string; usageCount: number; percentage: number }>;
  sceneTypes: string[];
}

export interface StylePattern {
  pattern: string;
  confidence: number;
  evidenceCount: number;
  explanation: string;
}

export interface StyleProfile {
  totalProjects: number;
  totalScenesLogged: number;
  scenePreferences: Record<string, Record<string, string>>;
  styleSignals: Record<string, string>;
  discoveredPatterns: StylePattern[];
  computedAt: string;
}

export interface MemoryRecommendation {
  category: string;
  brand: string;
  model: string;
  usageCount: number;
  reason: string;
}

export interface GearSpec {
  id: number;
  brand: string;
  model: string;
  category: string;
  lens_mount: string | null;
  battery_type: string | null;
  voltage: number | null;
  wattage: number | null;
  weight_g: number | null;
  max_payload_g: number | null;
  inputs: string[] | null;
  outputs: string[] | null;
  media_slots: string[] | null;
  mounting_standard: string | null;
  thread_size: string | null;
}

// ═══════════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════════

export const intelligenceApi = {

  // ── Predictive Failure ──

  getPredictions: (userId: string, opts?: { tempC?: number; hours?: number }) => {
    const q = new URLSearchParams();
    if (opts?.tempC !== undefined) q.set('temp', String(opts.tempC));
    if (opts?.hours !== undefined) q.set('hours', String(opts.hours));
    const qs = q.toString();
    return req<{ ok: boolean; predictions: PredictiveRisk[] }>(
      `/intelligence/predictions/${userId}${qs ? '?' + qs : ''}`
    );
  },

  getPrediction: (userId: string, equipmentId: string, opts?: { tempC?: number; hours?: number }) => {
    const q = new URLSearchParams();
    if (opts?.tempC !== undefined) q.set('temp', String(opts.tempC));
    if (opts?.hours !== undefined) q.set('hours', String(opts.hours));
    const qs = q.toString();
    return req<{ ok: boolean; prediction: PredictiveRisk }>(
      `/intelligence/predictions/${userId}/${equipmentId}${qs ? '?' + qs : ''}`
    );
  },

  // ── Health Metrics ──

  getHealth: (equipmentId: string) =>
    req<{ ok: boolean; metrics: Record<string, unknown> | null }>(
      `/intelligence/health/${equipmentId}`
    ),

  updateHealth: (equipmentId: string, userId: string, data: Record<string, unknown>) =>
    req<{ ok: boolean }>(`/intelligence/health/${equipmentId}`, {
      method: 'PUT',
      body: JSON.stringify({ userId, ...data }),
    }),

  // ── Compatibility ──

  checkLens: (camera: { brand: string; model: string }, lens: { brand: string; model: string }) =>
    req<{ ok: boolean } & CompatibilityResult>('/intelligence/compatibility/lens', {
      method: 'POST',
      body: JSON.stringify({ camera, lens }),
    }),

  checkBattery: (equipmentIds: string[], plannedHours: number) =>
    req<{ ok: boolean; sufficient: boolean; totalWattHours: number; totalConsumption: number; estimatedRuntime: number; explanation: Explanation }>(
      '/intelligence/compatibility/battery',
      { method: 'POST', body: JSON.stringify({ equipmentIds, plannedHours }) }
    ),

  checkIO: (
    recorder: { brand: string; model: string },
    sources: Array<{ brand: string; model: string; connectionType: string }>
  ) =>
    req<{ ok: boolean } & CompatibilityResult>('/intelligence/compatibility/io', {
      method: 'POST',
      body: JSON.stringify({ recorder, sources }),
    }),

  // ── Weight & Load ──

  simulateWeight: (equipment: Array<{ brand: string; model: string }>, carrierId?: string) =>
    req<{ ok: boolean } & LoadSimulation>('/intelligence/rig-weight', {
      method: 'POST',
      body: JSON.stringify({ equipment, carrierId }),
    }),

  // ── Scene Continuity ──

  getSceneGear: (projectId: string) =>
    req<{ ok: boolean; scenes: SceneContinuityEntry[] }>(
      `/intelligence/scene-gear/${projectId}`
    ),

  getContinuityBreaks: (projectId: string) =>
    req<{ ok: boolean; breaks: ContinuityBreak[]; hasIssues: boolean }>(
      `/intelligence/scene-gear/${projectId}/breaks`
    ),

  logSceneGear: (data: {
    projectId: string;
    userId: string;
    sceneNumber?: number;
    sceneLabel: string;
    sceneType: string;
    gearSetup: Record<string, { id?: string; brand: string; model: string }>;
    lightingSetup?: Record<string, unknown>;
    audioSetup?: Record<string, unknown>;
    notes?: string;
    shootDate?: string;
  }) =>
    req<{ ok: boolean; id: string }>('/intelligence/scene-gear', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Equipment Memory ──

  logUsage: (data: {
    userId: string;
    equipmentId: string;
    projectId?: string;
    sceneType?: string;
    sceneLabel?: string;
    category: string;
    brand: string;
    model: string;
    lensMm?: number;
    durationHours?: number;
    ambientTempC?: number;
    notes?: string;
  }) =>
    req<{ ok: boolean }>('/intelligence/usage', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPreferences: (userId: string) =>
    req<{ ok: boolean; preferences: EquipmentPreference[] }>(
      `/intelligence/preferences/${userId}`
    ),

  getRecommendations: (userId: string, sceneType: string) =>
    req<{ ok: boolean; recommendations: MemoryRecommendation[]; explanation: Explanation }>(
      `/intelligence/recommendations/${userId}/${sceneType}`
    ),

  // ── Style Memory ──

  getStyleProfile: (userId: string) =>
    req<{ ok: boolean; profile: StyleProfile | null; message?: string }>(
      `/intelligence/style/${userId}`
    ),

  computeStyleProfile: (userId: string) =>
    req<{ ok: boolean; profile: StyleProfile }>(
      `/intelligence/style/${userId}/compute`,
      { method: 'POST' }
    ),

  // ── Explanation Layer ──

  explainRecommendation: (data: {
    userId: string;
    sceneType: string;
    equipment: { brand: string; model: string; category: string };
    context?: { actorCount?: number; mood?: string; previousSceneLens?: string };
  }) =>
    req<{ ok: boolean; explanation: Explanation }>('/intelligence/explain', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Specs Catalog ──

  getSpecs: (filters?: { category?: string; brand?: string }) => {
    const q = new URLSearchParams();
    if (filters?.category) q.set('category', filters.category);
    if (filters?.brand) q.set('brand', filters.brand);
    const qs = q.toString();
    return req<{ ok: boolean; specs: GearSpec[]; count: number }>(
      `/intelligence/specs${qs ? '?' + qs : ''}`
    );
  },

  upsertSpec: (data: Partial<GearSpec> & { brand: string; model: string; category: string }) =>
    req<{ ok: boolean }>('/intelligence/specs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

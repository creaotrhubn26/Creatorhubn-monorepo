/**
 * Client-side cache of the runner's LUT metadata. Types kept explicit so
 * the component layer imports a single source of truth.
 */
import { apiRequest } from '../queryClient';

export interface LutSwatch {
  r: number;
  g: number;
  b: number;
}

export interface LutRegistryEntry {
  id: string;
  displayName: string;
  description: string;
  swatch: LutSwatch;
  size: number;
  /** Optional category tag for the dropdown filter strip. */
  category?: 'portrait' | 'landscape' | 'food' | 'cinematic' | 'bw' | 'other';
  /** True when the entry was uploaded by the current user (not a built-in). */
  userUploaded?: boolean;
}

export interface LutTablePayload {
  id: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /** Row-major float32 table, size**3 * 3 entries. */
  table: Float32Array;
}

interface ListLutsResponse {
  success?: boolean;
  luts?: LutRegistryEntry[];
  source?: 'runner' | 'fallback';
}

interface TableResponse {
  success?: boolean;
  size?: number;
  domainMin?: number[];
  domainMax?: number[];
  table?: number[];
}

const tableCache = new Map<string, LutTablePayload>();

export async function fetchLutRegistry(ownerUserId?: string): Promise<LutRegistryEntry[]> {
  const url = ownerUserId
    ? `/api/photo-enhancer/luts?owner=${encodeURIComponent(ownerUserId)}`
    : '/api/photo-enhancer/luts';
  const raw = (await apiRequest(url)) as ListLutsResponse;
  if (!raw?.success || !Array.isArray(raw.luts)) return [];
  return raw.luts.map((entry) => ({
    id: String(entry.id),
    displayName: String(entry.displayName ?? entry.id),
    description: String(entry.description ?? ''),
    swatch: normalizeSwatch(entry.swatch),
    size: Number(entry.size ?? 17),
    category: entry.category,
    userUploaded: Boolean(entry.userUploaded),
  }));
}

export async function fetchLutTable(lutId: string): Promise<LutTablePayload | null> {
  if (!lutId) return null;
  const cached = tableCache.get(lutId);
  if (cached) return cached;
  try {
    const raw = (await apiRequest(`/api/photo-enhancer/luts/${encodeURIComponent(lutId)}/table`)) as TableResponse;
    if (!raw?.success || !Array.isArray(raw.table) || !raw.size) return null;
    const size = Number(raw.size);
    const domainMin = normalizeTriplet(raw.domainMin, 0);
    const domainMax = normalizeTriplet(raw.domainMax, 1);
    const flat = new Float32Array(raw.table);
    if (flat.length !== size * size * size * 3) return null;
    const payload: LutTablePayload = {
      id: lutId,
      size,
      domainMin,
      domainMax,
      table: flat,
    };
    tableCache.set(lutId, payload);
    return payload;
  } catch {
    return null;
  }
}

export function clearLutTableCache(): void {
  tableCache.clear();
}

function normalizeSwatch(value: unknown): LutSwatch {
  if (!value || typeof value !== 'object') return { r: 128, g: 128, b: 128 };
  const o = value as Record<string, unknown>;
  return {
    r: clampInt(o.r, 0, 255, 128),
    g: clampInt(o.g, 0, 255, 128),
    b: clampInt(o.b, 0, 255, 128),
  };
}

function normalizeTriplet(value: unknown, fallback: number): [number, number, number] {
  if (Array.isArray(value) && value.length === 3) {
    const [a, b, c] = value;
    return [Number(a) || fallback, Number(b) || fallback, Number(c) || fallback];
  }
  return [fallback, fallback, fallback];
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

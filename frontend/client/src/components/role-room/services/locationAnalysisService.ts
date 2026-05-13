/**
 * locationAnalysisService.ts — frontend client for /api/role-room/locations/analysis.
 * Henter Kartverket-geocode + filming-permit-info per kommune.
 */

const BASE = '/api/role-room/locations/analysis';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('role_room_auth_token')
    || sessionStorage.getItem('role_room_auth_token')
    || localStorage.getItem('authToken')
    || '';
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface GeocodedAddress {
  adressetekst: string;
  kommunenavn: string;
  kommunenummer: string;
  postnummer?: string;
  poststed?: string;
  fylkesnavn?: string;
  representasjonspunkt?: { lat: number; lon: number };
}

export interface KommunePermitInfo {
  kommune: string;
  kommunenummer: string;
  filmingPermitUrl?: string;
  generalContactUrl?: string;
  generalContactPhone?: string;
  generalContactEmail?: string;
  filmContactName?: string;
  filmContactEmail?: string;
  filmContactPhone?: string;
  filmingFee?: string;
  noiseLimits?: string;
  notes?: string;
}

export interface LocationAnalysis {
  query: string;
  geocoded: GeocodedAddress | null;
  permitInfo: KommunePermitInfo | null;
  recommendations: string[];
  source: 'kartverket' | 'fallback';
  warnings: string[];
}

export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  const res = await fetch(`${BASE}/geocode`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ address }),
  });
  const w = await readJson<{ success: boolean; data: GeocodedAddress | null }>(res);
  return w.data;
}

// In-memory cache: address → LocationAnalysis (TTL 5 min). Hindrer at samme
// adresse re-analyseres ved hver dialog-åpning. Cache er trygt å rydde via
// `clearLocationAnalysisCache()` (eks. ved logout eller eksplisitt refresh).
const ANALYSIS_CACHE = new Map<string, { result: LocationAnalysis; cachedAt: number }>();
const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYSIS_DEFAULT_TIMEOUT_MS = 15_000;

export function clearLocationAnalysisCache(): void {
  ANALYSIS_CACHE.clear();
}

export interface AnalyzeLocationOptions {
  /** AbortSignal fra forelder-komponenten — gjør at vi kan kansellere
   *  forrige in-flight kall når brukeren skifter adresse raskt. */
  signal?: AbortSignal;
  /** Default timeout 15s. Hindrer at brukeren venter evig hvis backend henger. */
  timeoutMs?: number;
  /** Sett `true` for å bypasse cache og hente fersk respons. */
  bypassCache?: boolean;
}

export async function analyzeLocation(
  address: string,
  options: AnalyzeLocationOptions = {},
): Promise<LocationAnalysis> {
  const { signal, timeoutMs = ANALYSIS_DEFAULT_TIMEOUT_MS, bypassCache = false } = options;
  const cacheKey = address.trim().toLowerCase();

  if (!bypassCache) {
    const cached = ANALYSIS_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < ANALYSIS_CACHE_TTL_MS) {
      return cached.result;
    }
  }

  // Kombiner forelder-signal + intern timeout via AbortController-chain
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combinedSignal = signal
    ? mergeAbortSignals([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const res = await fetch(`${BASE}/analyze`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ address }),
      signal: combinedSignal,
    });
    const w = await readJson<{ success: boolean; data: LocationAnalysis }>(res);
    ANALYSIS_CACHE.set(cacheKey, { result: w.data, cachedAt: Date.now() });
    return w.data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Kombinerer flere AbortSignals — abort på any-of utløser combined signal. */
function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      return controller.signal;
    }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export async function getKommunePermitInfo(
  kommunenummer: string,
): Promise<KommunePermitInfo | null> {
  const res = await fetch(`${BASE}/kommune/${encodeURIComponent(kommunenummer)}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  const w = await readJson<{ success: boolean; data: KommunePermitInfo }>(res);
  return w.data;
}

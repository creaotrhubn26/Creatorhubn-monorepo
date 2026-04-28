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

export async function analyzeLocation(address: string): Promise<LocationAnalysis> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ address }),
  });
  const w = await readJson<{ success: boolean; data: LocationAnalysis }>(res);
  return w.data;
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

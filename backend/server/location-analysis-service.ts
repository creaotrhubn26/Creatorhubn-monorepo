/**
 * location-analysis-service.ts
 *
 * Geocoder norske adresser via Kartverket og kombinerer resultatet med
 * filming-permit-info fra norway-kommune-permit-info.ts.
 *
 * Kartverket adresse-API (gratis, ingen nøkkel):
 *   https://ws.geonorge.no/adresser/v1/sok?sok={address}&treffPerSide=1
 */

import { lookupKommunePermit, buildGenericKommuneInfo, type KommunePermitInfo } from './data/norway-kommune-permit-info.js';

export interface GeocodedAddress {
  adressetekst: string;
  kommunenavn: string;
  kommunenummer: string;
  postnummer?: string;
  poststed?: string;
  fylkesnavn?: string;
  representasjonspunkt?: { lat: number; lon: number };
}

export interface LocationAnalysis {
  query: string;
  geocoded: GeocodedAddress | null;
  permitInfo: KommunePermitInfo | null;
  recommendations: string[];
  source: 'kartverket' | 'fallback';
  warnings: string[];
}

// In-memory cache med 1h TTL — Kartverket er offentlig men vi bør være snille
const geocodeCache = new Map<string, { result: GeocodedAddress | null; cachedAt: number }>();
const GEOCODE_TTL_MS = 60 * 60 * 1000;

export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  // Cache check
  const cached = geocodeCache.get(trimmed);
  if (cached && Date.now() - cached.cachedAt < GEOCODE_TTL_MS) {
    return cached.result;
  }

  const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(trimmed)}&treffPerSide=1`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      geocodeCache.set(trimmed, { result: null, cachedAt: Date.now() });
      return null;
    }
    const body = await res.json() as {
      adresser?: Array<{
        adressetekst?: string;
        kommunenavn?: string;
        kommunenummer?: string;
        postnummer?: string;
        poststed?: string;
        fylkesnavn?: string;
        representasjonspunkt?: { lat?: number; lon?: number };
      }>;
    };
    const first = body.adresser?.[0];
    if (!first || !first.kommunenavn || !first.kommunenummer) {
      geocodeCache.set(trimmed, { result: null, cachedAt: Date.now() });
      return null;
    }
    const result: GeocodedAddress = {
      adressetekst: first.adressetekst ?? trimmed,
      kommunenavn: first.kommunenavn,
      kommunenummer: first.kommunenummer,
      postnummer: first.postnummer,
      poststed: first.poststed,
      fylkesnavn: first.fylkesnavn,
      representasjonspunkt: first.representasjonspunkt
        && typeof first.representasjonspunkt.lat === 'number'
        && typeof first.representasjonspunkt.lon === 'number'
        ? { lat: first.representasjonspunkt.lat, lon: first.representasjonspunkt.lon }
        : undefined,
    };
    geocodeCache.set(trimmed, { result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    console.warn('[location-analysis] Kartverket geocode failed:', err);
    geocodeCache.set(trimmed, { result: null, cachedAt: Date.now() });
    return null;
  }
}

/**
 * Full analyse: geocode + permit-lookup + anbefalinger.
 */
export async function analyzeLocation(address: string): Promise<LocationAnalysis> {
  const warnings: string[] = [];
  const geocoded = await geocodeAddress(address);

  let permitInfo: KommunePermitInfo | null = null;
  let source: 'kartverket' | 'fallback' = 'kartverket';

  if (geocoded) {
    // Match først på kommunenummer (eksakt)
    permitInfo = lookupKommunePermit(geocoded.kommunenummer)
      ?? lookupKommunePermit(geocoded.kommunenavn);
    if (!permitInfo) {
      // Bygg generisk fallback
      permitInfo = buildGenericKommuneInfo(geocoded.kommunenavn, geocoded.kommunenummer);
      warnings.push(`${geocoded.kommunenavn} er ikke i CreatorHubs film-kommisjon-database. Generisk fallback brukt — verifiser kontakt-info manuelt.`);
    }
  } else {
    // Geocode feilet — prøv regex-fallback for kommunenavn
    source = 'fallback';
    const m = address.match(/([A-Za-zÆØÅæøå\-\s]+?)\s+kommune/i);
    if (m && m[1]) {
      permitInfo = lookupKommunePermit(m[1].trim());
    }
    warnings.push('Kunne ikke geocode adressen via Kartverket. Sjekk at adressen er fullstendig (gateadresse + nummer + postnummer + sted).');
  }

  // Bygg anbefalinger
  const recommendations: string[] = [];
  if (permitInfo) {
    if (permitInfo.filmingPermitUrl) {
      recommendations.push(`Les ${permitInfo.kommune}s offisielle filming-info: ${permitInfo.filmingPermitUrl}`);
    } else if (permitInfo.generalContactUrl) {
      recommendations.push(`${permitInfo.kommune} har ikke dedikert filming-side — kontakt servicetorget: ${permitInfo.generalContactUrl}`);
    }
    if (permitInfo.filmContactName && permitInfo.filmContactEmail) {
      recommendations.push(`Kontakt ${permitInfo.filmContactName}: ${permitInfo.filmContactEmail}`);
    } else if (permitInfo.generalContactPhone) {
      recommendations.push(`Generelt kontaktnummer: ${permitInfo.generalContactPhone}`);
    }
    if (permitInfo.noiseLimits) {
      recommendations.push(`Støygrenser: ${permitInfo.noiseLimits}`);
    }
    if (permitInfo.filmingFee) {
      recommendations.push(`Gebyr-info: ${permitInfo.filmingFee}`);
    }
  } else {
    recommendations.push('Ingen kommune-treff. Sjekk adresse-stavemåte eller kontakt aktuell kommune direkte via norge.no.');
  }

  return {
    query: address,
    geocoded,
    permitInfo,
    recommendations,
    source,
    warnings,
  };
}

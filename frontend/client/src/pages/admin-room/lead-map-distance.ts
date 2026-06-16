/**
 * lead-map-distance.ts
 *
 * Haversine-distanse + formatering for "X km til lead"-visning.
 */

const R_EARTH_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

/** "240 m" / "1,2 km" / "12 km" */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1).replace('.', ',')} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Estimat: kjøretid i bil ved 50 km/t snitt-bymiljø.
 * Grovt, men gir Daniel/selger en navigasjons-anslag uten å hete
 * Google Distance Matrix API.
 */
export function estimateDriveMinutes(km: number): number {
  const avgKmh = km < 5 ? 30 : km < 20 ? 45 : 65;
  return Math.round((km / avgKmh) * 60);
}

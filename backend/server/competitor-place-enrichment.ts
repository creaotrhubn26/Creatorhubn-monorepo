/**
 * competitor-place-enrichment.ts
 *
 * Berikkelse av Market Scan-konkurrenter med Google Places-data
 * (lat/lng/rating/phone/adress/place_id) slik at de kan plottes som
 * pins på Lead Map ved siden av leads.
 *
 * Bruker den eksisterende `searchPlaces`-helperen fra lead-map-service
 * (Places API v1 Text Search) — vi gjør ett oppslag per konkurrent
 * med "name region"-query og tar første treff.
 *
 * Designvalg:
 *   - Idempotent: hopper over konkurrenter som allerede har lat/lng.
 *     Trygt å kjøre flere ganger.
 *   - Best-effort: hvis ingen treff eller Places-API mangler nøkkel,
 *     logger vi men kaster ikke (Market Scan skal ikke feile pga geo).
 *   - Bruker scanens region som hint. Hvis tom: globalt søk.
 *
 * Trigges fra:
 *   - runMarketScan() etter completion (auto-berikkelse)
 *   - POST /api/admin-room/lead-map/scans/:id/enrich-places (manuell)
 */

import type { Pool } from "pg";
import { searchPlaces } from "./lead-map-service.js";

interface EnrichResult {
  enriched: number;
  skipped: number;
  failed: number;
}

export async function enrichCompetitorsWithPlaces(
  pool: Pool,
  args: {
    scanId: string;
    ownerUserId: string;
    region?: string | null;
  },
): Promise<EnrichResult> {
  // 1. Hent konkurrenter som mangler geo
  const rows = await pool.query<{ id: string; name: string }>(
    `SELECT id::text, name
       FROM market_scan_competitors
      WHERE market_scan_id = $1
        AND (latitude IS NULL OR longitude IS NULL)`,
    [args.scanId],
  );

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const comp of rows.rows) {
    const query = args.region ? `${comp.name} ${args.region}` : comp.name;
    try {
      const result = await searchPlaces(pool, {
        query,
        ownerUserId: args.ownerUserId,
      } as Parameters<typeof searchPlaces>[1]);

      if (!result.ok) {
        // API key mangler eller fellesfeil → marker alle som "ikke berikket"
        skipped += rows.rows.length - enriched - failed;
        break;
      }
      const top = result.results[0];
      if (!top || top.latitude === 0 || top.longitude === 0) {
        skipped += 1;
        continue;
      }
      await pool.query(
        `UPDATE market_scan_competitors
            SET latitude = $2::numeric,
                longitude = $3::numeric,
                google_place_id = $4,
                google_address = $5,
                google_phone = $6,
                google_rating = $7::numeric,
                google_lookup_at = NOW()
          WHERE id = $1`,
        [
          comp.id,
          top.latitude,
          top.longitude,
          top.placeId,
          top.address,
          top.phone,
          top.rating,
        ],
      );
      enriched += 1;
    } catch (err) {
      console.warn(
        `[competitor-place-enrichment] failed for ${comp.name}:`,
        (err as Error).message,
      );
      failed += 1;
    }
  }

  return { enriched, skipped, failed };
}

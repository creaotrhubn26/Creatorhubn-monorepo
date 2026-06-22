/**
 * leadgrid-territory-service.ts
 *
 * Kjernen i LeadGrid territorie-håndheving ("hold deg i din grid").
 *
 * En grid (lead_territories-rad) defineres som en KOMBINASJON av:
 *   - geometry: GeoJSON Polygon/MultiPolygon (tegnet på kart), og/eller
 *   - municipalities: kommunenummer, og/eller
 *   - postal_codes: postnummer.
 * En lead/posisjon er "innenfor" et territorium hvis den matcher polygon
 * ELLER en administrativ enhet.
 *
 * Point-in-polygon gjøres i app-kode (ray casting) siden DB ikke har
 * PostGIS. Alle rene geo-funksjoner er eksportert for enhetstesting.
 *
 * Håndhevingen er MYK: ingenting blokkeres. `recordBreach` logger et
 * lead_territory_events-rad, varsler teamleder/salgssjef via
 * notification_events, og emitter `territory.breach`-webhook. Alt er
 * fire-and-forget — feil her skal aldri velte hovedflyten.
 */

import type { Pool } from "pg";
import { emitWebhook } from "./webhook-emitter.js";

// ─────────────────────────────────────────────────────────────────────
// Typer
// ─────────────────────────────────────────────────────────────────────

export interface TerritoryRow {
  id: string;
  organizationId: string;
  name: string;
  assignedUserId: string | null;
  salesTeamId: string | null;
  geometry: unknown | null; // GeoJSON (Feature | Geometry)
  municipalities: string[];
  postalCodes: string[];
  priority: number;
  active: boolean;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
}

export interface LeadGeo {
  latitude: number | null;
  longitude: number | null;
  postalCode: string | null;
  municipalityCode: string | null;
}

export type BreachKind =
  | "lead_access_out_of_grid"
  | "gps_out_of_grid"
  | "visit_out_of_grid";

// ─────────────────────────────────────────────────────────────────────
// Rene geo-funksjoner (testbare uten DB)
// ─────────────────────────────────────────────────────────────────────

type Ring = number[][]; // [[lng, lat], ...]

/**
 * Pakk ut en GeoJSON-verdi til en liste av polygoner, der hvert polygon
 * er en liste av ringer ([ytre, ...hull]). Støtter Feature,
 * FeatureCollection, GeometryCollection, Polygon og MultiPolygon.
 */
export function extractPolygons(geojson: unknown): Ring[][] {
  if (!geojson || typeof geojson !== "object") return [];
  const g = geojson as Record<string, unknown>;

  switch (g.type) {
    case "FeatureCollection": {
      const feats = Array.isArray(g.features) ? g.features : [];
      return feats.flatMap((f) => extractPolygons(f));
    }
    case "Feature":
      return extractPolygons(g.geometry);
    case "GeometryCollection": {
      const geoms = Array.isArray(g.geometries) ? g.geometries : [];
      return geoms.flatMap((geom) => extractPolygons(geom));
    }
    case "Polygon":
      return Array.isArray(g.coordinates) ? [g.coordinates as Ring[]] : [];
    case "MultiPolygon":
      return Array.isArray(g.coordinates) ? (g.coordinates as Ring[][]) : [];
    default:
      return [];
  }
}

/**
 * Ray-casting: er punktet (lat,lng) innenfor ringen? GeoJSON-koordinater
 * er [lng, lat]. Punkter på kanten regnes som innenfor (best effort).
 */
export function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Innenfor et polygon = innenfor ytre ring OG ikke i et hull. */
export function pointInPolygon(lat: number, lng: number, polygon: Ring[]): boolean {
  if (polygon.length === 0) return false;
  const [outer, ...holes] = polygon;
  if (!pointInRing(lat, lng, outer)) return false;
  return !holes.some((hole) => pointInRing(lat, lng, hole));
}

/** Innenfor en GeoJSON-geometri (Polygon eller MultiPolygon). */
export function pointInGeometry(lat: number, lng: number, geojson: unknown): boolean {
  return extractPolygons(geojson).some((poly) => pointInPolygon(lat, lng, poly));
}

/** Haversine-avstand i kilometer. */
export function haversineKm(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Er territoriet aktivt på gitt tidspunkt (active + effective-vindu)? */
export function isTerritoryActive(t: TerritoryRow, now: Date = new Date()): boolean {
  if (!t.active) return false;
  if (t.effectiveFrom && now < t.effectiveFrom) return false;
  if (t.effectiveTo && now > t.effectiveTo) return false;
  return true;
}

/** Matcher lead-ens admin-enhet (postnummer eller kommune) territoriet? */
export function matchesAdminUnits(lead: LeadGeo, t: TerritoryRow): boolean {
  if (lead.postalCode && t.postalCodes.includes(lead.postalCode)) return true;
  if (lead.municipalityCode && t.municipalities.includes(lead.municipalityCode)) {
    return true;
  }
  return false;
}

/** Matcher lead-ens posisjon territoriets polygon? */
export function matchesPolygon(lead: LeadGeo, t: TerritoryRow): boolean {
  if (lead.latitude == null || lead.longitude == null || t.geometry == null) {
    return false;
  }
  return pointInGeometry(lead.latitude, lead.longitude, t.geometry);
}

/**
 * Kombinasjon: en lead er i territoriet hvis polygon ELLER admin-enhet matcher.
 */
export function leadMatchesTerritory(lead: LeadGeo, t: TerritoryRow): boolean {
  return matchesPolygon(lead, t) || matchesAdminUnits(lead, t);
}

/** Er punktet (lat,lng) innenfor territoriet (kun polygon-delen)? */
export function pointMatchesTerritory(lat: number, lng: number, t: TerritoryRow): boolean {
  if (t.geometry == null) return false;
  return pointInGeometry(lat, lng, t.geometry);
}

/**
 * Velg det "beste" territoriet blant flere treff: høyest priority vinner,
 * deretter mest spesifikk (polygon foran ren admin-liste).
 */
export function pickBestTerritory(matches: TerritoryRow[]): TerritoryRow | null {
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aHasPoly = a.geometry != null ? 1 : 0;
    const bHasPoly = b.geometry != null ? 1 : 0;
    return bHasPoly - aHasPoly;
  })[0];
}

/**
 * Overlapp-deteksjon for admin-UI: returnerer par av territorier som
 * deler minst én kommune eller ett postnummer. (Polygon-overlapp krever
 * tyngre geometri og rapporteres ikke her.)
 */
export function detectAdminOverlaps(
  territories: TerritoryRow[],
): Array<{ a: string; b: string; shared: string[] }> {
  const out: Array<{ a: string; b: string; shared: string[] }> = [];
  for (let i = 0; i < territories.length; i++) {
    for (let j = i + 1; j < territories.length; j++) {
      const A = territories[i];
      const B = territories[j];
      const setB = new Set([...B.municipalities, ...B.postalCodes]);
      const shared = [...A.municipalities, ...A.postalCodes].filter((u) => setB.has(u));
      if (shared.length > 0) out.push({ a: A.id, b: B.id, shared });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// DB-funksjoner
// ─────────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): TerritoryRow {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    name: String(r.name),
    assignedUserId: r.assigned_user_id ? String(r.assigned_user_id) : null,
    salesTeamId: r.sales_team_id ? String(r.sales_team_id) : null,
    geometry: r.geometry ?? null,
    municipalities: Array.isArray(r.municipalities) ? (r.municipalities as string[]) : [],
    postalCodes: Array.isArray(r.postal_codes) ? (r.postal_codes as string[]) : [],
    priority: Number(r.priority ?? 100),
    active: r.active !== false,
    effectiveFrom: r.effective_from ? new Date(r.effective_from as string) : null,
    effectiveTo: r.effective_to ? new Date(r.effective_to as string) : null,
  };
}

const SELECT_COLS = `
  id::text, organization_id::text, name, assigned_user_id,
  sales_team_id::text, geometry, municipalities, postal_codes,
  priority, active, effective_from, effective_to`;

/** Alle aktive territorier i en org. */
export async function loadOrgTerritories(
  pool: Pool, organizationId: string,
): Promise<TerritoryRow[]> {
  const r = await pool.query(
    `SELECT ${SELECT_COLS} FROM lead_territories
      WHERE organization_id = $1::uuid AND active = TRUE`,
    [organizationId],
  );
  return r.rows.map(mapRow).filter((t) => isTerritoryActive(t));
}

/**
 * Territorier som tilhører en bruker: enten direkte (assigned_user_id)
 * eller via teamet brukeren er medlem av (organization_members.sales_team_id).
 */
export async function loadUserTerritories(
  pool: Pool, organizationId: string, userId: string,
): Promise<TerritoryRow[]> {
  const r = await pool.query(
    `SELECT ${SELECT_COLS} FROM lead_territories t
      WHERE t.organization_id = $1::uuid AND t.active = TRUE
        AND (
          t.assigned_user_id = $2
          OR t.sales_team_id IN (
            SELECT sales_team_id FROM organization_members
             WHERE organization_id = $1::uuid AND user_id = $2
               AND sales_team_id IS NOT NULL
          )
        )`,
    [organizationId, userId],
  );
  return r.rows.map(mapRow).filter((t) => isTerritoryActive(t));
}

/** Territorier i org-en som matcher en lead (for cache/auto-assign). */
export function resolveLeadTerritories(
  lead: LeadGeo, orgTerritories: TerritoryRow[],
): TerritoryRow[] {
  return orgTerritories.filter((t) => leadMatchesTerritory(lead, t));
}

/**
 * Er lead-en innenfor minst én av brukerens grids? Returnerer også
 * konflikt-info (hvilket annet territorium lead-en faktisk tilhører).
 */
export async function evaluateLeadAccess(
  pool: Pool, organizationId: string, userId: string, lead: LeadGeo,
): Promise<{ inGrid: boolean; matchedTerritoryId: string | null; conflictingUserId: string | null }> {
  const [own, org] = await Promise.all([
    loadUserTerritories(pool, organizationId, userId),
    loadOrgTerritories(pool, organizationId),
  ]);
  const inGrid = own.some((t) => leadMatchesTerritory(lead, t));
  const best = pickBestTerritory(resolveLeadTerritories(lead, org));
  return {
    inGrid,
    matchedTerritoryId: best?.id ?? null,
    conflictingUserId: inGrid ? null : best?.assignedUserId ?? null,
  };
}

/** Er punktet (lat,lng) innenfor minst én av brukerens grids (polygon)? */
export async function isPointInUserGrid(
  pool: Pool, organizationId: string, userId: string, lat: number, lng: number,
): Promise<boolean> {
  const own = await loadUserTerritories(pool, organizationId, userId);
  // Bruker som ikke har noen grid blir aldri flagget (ingen grense satt).
  if (own.length === 0) return true;
  return own.some((t) => pointMatchesTerritory(lat, lng, t));
}

/** Har brukeren et grid i det hele tatt? (Ingen grid ⇒ ingen håndheving.) */
export async function userHasTerritory(
  pool: Pool, organizationId: string, userId: string,
): Promise<boolean> {
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM lead_territories
      WHERE organization_id = $1::uuid AND active = TRUE
        AND (assigned_user_id = $2 OR sales_team_id IN (
          SELECT sales_team_id FROM organization_members
           WHERE organization_id = $1::uuid AND user_id = $2 AND sales_team_id IS NOT NULL))`,
    [organizationId, userId],
  );
  return Number(r.rows[0]?.n ?? 0) > 0;
}

/** Finnes det allerede et ferskt brudd av samme type? (Throttling, særlig GPS.) */
export async function hasRecentBreach(
  pool: Pool, userId: string, kind: BreachKind, withinMinutes: number,
): Promise<boolean> {
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM lead_territory_events
      WHERE user_id = $1 AND event_kind = $2
        AND created_at > NOW() - ($3 || ' minutes')::interval`,
    [userId, kind, String(withinMinutes)],
  );
  return Number(r.rows[0]?.n ?? 0) > 0;
}

/**
 * Logg et mykt territorie-brudd: skriv lead_territory_events, varsle
 * teamleder/salgssjef via notification_events, og emit webhook. Aldri
 * kastende — kall gjerne som `void recordBreach(...)`.
 */
export async function recordBreach(
  pool: Pool,
  params: {
    organizationId: string;
    userId: string;
    kind: BreachKind;
    leadId?: string | null;
    territoryId?: string | null;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO lead_territory_events
         (organization_id, user_id, territory_id, lead_id, event_kind, detail)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)`,
      [
        params.organizationId,
        params.userId,
        params.territoryId ?? null,
        params.leadId ?? null,
        params.kind,
        JSON.stringify(params.detail ?? {}),
      ],
    );

    // Hvem fikk varsel? Teamleder for selgerens team + alle salgssjef i org.
    const managers = await pool.query<{ user_id: string }>(
      `SELECT DISTINCT om.user_id
         FROM organization_members om
        WHERE om.organization_id = $1::uuid
          AND om.role IN ('salgssjef', 'admin')
        UNION
        SELECT st.team_lead_user_id AS user_id
          FROM organization_members me
          JOIN sales_teams st ON st.id = me.sales_team_id
         WHERE me.organization_id = $1::uuid AND me.user_id = $2
           AND st.team_lead_user_id IS NOT NULL`,
      [params.organizationId, params.userId],
    );

    const sellerName = await sellerLabel(pool, params.userId);
    const { title, body } = breachMessage(params.kind, sellerName);
    for (const m of managers.rows) {
      if (!m.user_id || m.user_id === params.userId) continue;
      await pool.query(
        `INSERT INTO notification_events
           (recipient_user_id, organization_id, event_type, title, body,
            lead_id, triggered_by_user_id, meta)
         VALUES ($1, $2::uuid, 'territory_breach', $3, $4, $5, $6, $7::jsonb)`,
        [
          m.user_id, params.organizationId, title, body,
          params.leadId ?? null, params.userId,
          JSON.stringify({ kind: params.kind, ...(params.detail ?? {}) }),
        ],
      );
    }

    void emitWebhook(
      pool,
      "territory.breach",
      {
        organization_id: params.organizationId,
        user_id: params.userId,
        kind: params.kind,
        lead_id: params.leadId ?? null,
        territory_id: params.territoryId ?? null,
        detail: params.detail ?? {},
        at: new Date().toISOString(),
      },
      params.organizationId,
    );
  } catch (err) {
    console.warn("[territory] recordBreach failed:", err);
  }
}

async function sellerLabel(pool: Pool, userId: string): Promise<string> {
  try {
    const r = await pool.query<{ label: string }>(
      `SELECT COALESCE(NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), ''),
                       username, email, id) AS label
         FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.label ?? userId;
  } catch {
    return userId;
  }
}

function breachMessage(kind: BreachKind, seller: string): { title: string; body: string } {
  switch (kind) {
    case "gps_out_of_grid":
      return {
        title: "Selger utenfor sonen",
        body: `${seller} er fysisk utenfor sitt tildelte område.`,
      };
    case "visit_out_of_grid":
      return {
        title: "Besøk utenfor sonen",
        body: `${seller} logget et besøk utenfor sitt tildelte område.`,
      };
    case "lead_access_out_of_grid":
    default:
      return {
        title: "Lead utenfor sonen",
        body: `${seller} jobbet med en lead utenfor sitt tildelte område.`,
      };
  }
}

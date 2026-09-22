/**
 * Leads uten plassering.
 *
 * Kartlaget filtrerer bort alt som ligger på 0,0 — en lead uten koordinater
 * finnes i Leads, men dukker aldri opp på kartet, og ingenting sier fra.
 * Discovery geokoder maks 120 adresser per kjøring og bommer på noen; godkjenner
 * du seksti kandidater, kan flere bli usynlige.
 *
 * Her telles de, og adressen slås opp på nytt mot Kartverkets adresse-API.
 */
import type { Pool } from "pg";

import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

const GEONORGE_ADDRESS_ENDPOINT = "https://ws.geonorge.no/adresser/v1/sok";
/** Ett trykk skal ikke kunne starte tusen eksterne oppslag. */
export const MAX_PLACEMENT_ATTEMPTS = 50;

export interface UnplacedLead {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
}

export interface LeadPlacementStatus {
  unplaced_count: number;
  /** Av dem: hvor mange har en adresse vi kan slå opp. */
  resolvable_count: number;
  sample: UnplacedLead[];
}

export interface LeadPlacementResult {
  attempted: number;
  placed: number;
  /** Adressen ga ingen treff hos Kartverket. */
  unresolved: number;
  remaining: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Kartverket trenger noe å søke på. Gateadresse alene er for tvetydig på
 * landsbasis — «Storgata 1» finnes i hundre kommuner — så vi krever postnummer
 * eller poststed i tillegg. Uten det er et oppslag verre enn ingen: det
 * plasserer bedriften et tilfeldig sted.
 */
export function placementQueryFor(lead: UnplacedLead): URLSearchParams | null {
  const adresse = lead.address?.trim();
  if (!adresse) return null;
  const postnummer = lead.postal_code?.trim();
  const poststed = lead.city?.trim();
  if (!postnummer && !poststed) return null;
  const params = new URLSearchParams();
  params.set("adressetekst", adresse);
  if (postnummer && /^\d{4}$/.test(postnummer)) {
    params.set("postnummer", postnummer);
  } else if (poststed) {
    params.set("poststed", poststed);
  }
  params.set("treffPerSide", "5");
  params.set("sokemodus", "AND");
  return params;
}

interface GeonorgeHit {
  representasjonspunkt?: { lat?: unknown; lon?: unknown };
  postnummer?: unknown;
}

/**
 * Første treff med gyldig punkt vinner, men et treff i feil postnummer
 * forkastes: Kartverkets fritekstsøk kan falle tilbake til nabokommunen.
 */
export function pickPlacement(
  hits: GeonorgeHit[],
  lead: UnplacedLead,
): GeoPoint | null {
  const forventetPostnummer = lead.postal_code?.trim();
  for (const hit of hits) {
    const lat = Number(hit.representasjonspunkt?.lat);
    const lon = Number(hit.representasjonspunkt?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat === 0 && lon === 0) continue;
    if (
      forventetPostnummer &&
      /^\d{4}$/.test(forventetPostnummer) &&
      typeof hit.postnummer === "string" &&
      hit.postnummer.trim() &&
      hit.postnummer.trim() !== forventetPostnummer
    ) {
      continue;
    }
    return { latitude: lat, longitude: lon };
  }
  return null;
}

const UNPLACED_PREDICATE = `(latitude IS NULL OR longitude IS NULL
   OR (latitude = 0 AND longitude = 0))`;

export async function leadPlacementStatus(
  pool: Pool,
  input: { project: LeadgridAccessibleProject },
): Promise<LeadPlacementStatus> {
  const rows = await pool.query<UnplacedLead>(
    `SELECT id::text, name, address, postal_code, city
       FROM crm_customers
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND archived_at IS NULL
        AND ${UNPLACED_PREDICATE}
      ORDER BY updated_at DESC
      LIMIT 200`,
    [input.project.organizationId, input.project.id],
  );
  const resolvable = rows.rows.filter((lead) => placementQueryFor(lead) !== null);
  return {
    unplaced_count: rows.rowCount ?? 0,
    resolvable_count: resolvable.length,
    sample: rows.rows.slice(0, 5),
  };
}

export async function placeUnplacedLeads(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    limit?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<LeadPlacementResult> {
  const grense = Math.min(
    MAX_PLACEMENT_ATTEMPTS,
    Math.max(1, Math.trunc(input.limit ?? MAX_PLACEMENT_ATTEMPTS)),
  );
  const hentFra = input.fetchImpl ?? fetch;
  const status = await leadPlacementStatus(pool, { project: input.project });
  const kandidater = await pool.query<UnplacedLead>(
    `SELECT id::text, name, address, postal_code, city
       FROM crm_customers
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND archived_at IS NULL
        AND ${UNPLACED_PREDICATE}
        AND coalesce(address, '') <> ''
      ORDER BY updated_at DESC
      LIMIT $3`,
    [input.project.organizationId, input.project.id, grense],
  );

  let placed = 0;
  let unresolved = 0;
  let attempted = 0;
  for (const lead of kandidater.rows) {
    const params = placementQueryFor(lead);
    if (!params) continue;
    attempted += 1;
    const punkt = await slåOppAdresse(hentFra, params, lead);
    if (!punkt) {
      unresolved += 1;
      continue;
    }
    await pool.query(
      `UPDATE crm_customers
          SET latitude = $1, longitude = $2, updated_at = NOW()
        WHERE id = $3::uuid
          AND organization_id = $4::uuid
          AND project_id = $5`,
      [
        punkt.latitude,
        punkt.longitude,
        lead.id,
        input.project.organizationId,
        input.project.id,
      ],
    );
    placed += 1;
  }

  return {
    attempted,
    placed,
    unresolved,
    remaining: Math.max(0, status.unplaced_count - placed),
  };
}

async function slåOppAdresse(
  hentFra: typeof fetch,
  params: URLSearchParams,
  lead: UnplacedLead,
): Promise<GeoPoint | null> {
  try {
    const svar = await hentFra(`${GEONORGE_ADDRESS_ENDPOINT}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!svar.ok) return null;
    const data = (await svar.json()) as { adresser?: GeonorgeHit[] };
    return pickPlacement(data.adresser ?? [], lead);
  } catch {
    // Ett oppslag som feiler skal ikke stoppe resten av lista.
    return null;
  }
}

/**
 * Leads uten plassering.
 *
 * Kartlaget filtrerer bort alt som ligger på 0,0 — en lead uten koordinater
 * finnes i Leads, men dukker aldri opp på kartet, og ingenting sier fra.
 * Discovery geokoder maks 120 adresser per kjøring og bommer på noen; godkjenner
 * du seksti kandidater, kan flere bli usynlige.
 *
 * Presisjonen kommer i tre trinn, i denne rekkefølgen:
 *
 *   1. Kommunenummer fra Enhetsregisteret. Har leaden organisasjonsnummer,
 *      henter vi forretningsadressen derfra. Da søker vi i ÉN kommune, og
 *      «Storgata 1» i Oslo kan ikke lenger treffe Storgata 1 i Bergen.
 *   2. Entydig adressetreff. Ett punkt igjen etter filtrering: plasser.
 *   3. Flere kandidater: ikke gjett. En pin i feil kommune ser like riktig ut
 *      som en riktig pin, og selgeren oppdager det først når hen står der.
 *      Leaden meldes som tvetydig, og brukeren peker.
 *
 * Svaret lagres (leadgrid_lead_placement_decisions), slik at samme lead ikke
 * spørres om igjen og samme adresse i samme organisasjon plasseres automatisk
 * neste gang.
 */
import type { Pool } from "pg";

import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

const GEONORGE_ADDRESS_ENDPOINT = "https://ws.geonorge.no/adresser/v1/sok";
const BRREG_ENHET_ENDPOINT = "https://data.brreg.no/enhetsregisteret/api/enheter";
/** Ett trykk skal ikke kunne starte tusen eksterne oppslag. */
export const MAX_PLACEMENT_ATTEMPTS = 50;

export interface UnplacedLead {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  organization_number?: string | null;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PlacementOption extends GeoPoint {
  /** Full adresse slik Kartverket skriver den — det brukeren skal kjenne igjen. */
  label: string;
  municipality: string | null;
  postal_code: string | null;
}

export type PlacementOutcome =
  | { kind: "placed"; point: GeoPoint; label: string | null }
  | { kind: "ambiguous"; options: PlacementOption[] }
  | { kind: "unresolved" };

export interface AmbiguousLead {
  lead_id: string;
  name: string;
  address: string | null;
  options: PlacementOption[];
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
  /** Adressen ga flere kandidater — brukeren må peke. */
  ambiguous: AmbiguousLead[];
  /** Adressen ga ingen treff hos Kartverket. */
  unresolved: number;
  remaining: number;
  /** Plassert uten oppslag fordi noen har bekreftet samme adresse før. */
  reused: number;
}

interface GeonorgeHit {
  representasjonspunkt?: { lat?: unknown; lon?: unknown };
  postnummer?: unknown;
  poststed?: unknown;
  adressetekst?: unknown;
  kommunenavn?: unknown;
  kommunenummer?: unknown;
}

/**
 * Nøkkelen vi husker svaret under. To leads på samme adresse i samme
 * organisasjon skal ikke spørres to ganger.
 */
export function placementKeyFor(lead: UnplacedLead): string | null {
  const adresse = lead.address?.trim().toLocaleLowerCase("nb-NO");
  if (!adresse) return null;
  const sted =
    lead.postal_code?.trim() || lead.city?.trim().toLocaleLowerCase("nb-NO");
  if (!sted) return null;
  return `${adresse}|${sted}`.replace(/\s+/g, " ");
}

/**
 * Kartverket trenger noe å avgrense på. Gateadresse alene er for tvetydig på
 * landsbasis, så vi krever kommunenummer, postnummer eller poststed. Uten det
 * gjør vi ingenting: et oppslag som plasserer bedriften et tilfeldig sted er
 * verre enn ingen pin.
 */
export function placementQueryFor(
  lead: UnplacedLead,
  municipalityNumber?: string | null,
): URLSearchParams | null {
  const adresse = lead.address?.trim();
  if (!adresse) return null;
  const kommune = municipalityNumber?.trim();
  const postnummer = lead.postal_code?.trim();
  const poststed = lead.city?.trim();
  if (
    !(kommune && /^\d{4}$/.test(kommune)) &&
    !postnummer &&
    !poststed
  ) {
    return null;
  }
  const params = new URLSearchParams();
  params.set("adressetekst", adresse);
  if (kommune && /^\d{4}$/.test(kommune)) {
    params.set("kommunenummer", kommune);
  }
  if (postnummer && /^\d{4}$/.test(postnummer)) {
    params.set("postnummer", postnummer);
  } else if (poststed && !(kommune && /^\d{4}$/.test(kommune))) {
    params.set("poststed", poststed);
  }
  params.set("treffPerSide", "10");
  params.set("sokemodus", "AND");
  return params;
}

function pointOf(hit: GeonorgeHit): GeoPoint | null {
  const lat = Number(hit.representasjonspunkt?.lat);
  const lon = Number(hit.representasjonspunkt?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Nøyaktig punktet kartet filtrerer bort. Et «treff» der er ingen plassering.
  if (lat === 0 && lon === 0) return null;
  return { latitude: lat, longitude: lon };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Avgjør om treffene peker på ett sted, flere steder, eller ingen.
 *
 * To treff i samme gate med ulikt husnummer er ikke «samme sted»: de er ulike
 * adresser og må avklares. To treff på nøyaktig samme punkt er det samme
 * stedet, og teller som entydig.
 */
export function classifyPlacement(
  hits: GeonorgeHit[],
  lead: UnplacedLead,
): PlacementOutcome {
  const forventetPostnummer = lead.postal_code?.trim();
  const brukbare: PlacementOption[] = [];
  for (const hit of hits) {
    const punkt = pointOf(hit);
    if (!punkt) continue;
    const postnummer = text(hit.postnummer);
    if (
      forventetPostnummer &&
      /^\d{4}$/.test(forventetPostnummer) &&
      postnummer &&
      postnummer !== forventetPostnummer
    ) {
      // Kartverkets fritekstsøk kan falle tilbake til nabokommunen.
      continue;
    }
    brukbare.push({
      ...punkt,
      label:
        [text(hit.adressetekst), postnummer, text(hit.poststed)]
          .filter(Boolean)
          .join(" ") || (lead.address ?? lead.name),
      municipality: text(hit.kommunenavn),
      postal_code: postnummer,
    });
  }
  if (brukbare.length === 0) return { kind: "unresolved" };
  const unike = new Map<string, PlacementOption>();
  for (const option of brukbare) {
    const nøkkel = `${option.latitude.toFixed(5)},${option.longitude.toFixed(5)}`;
    if (!unike.has(nøkkel)) unike.set(nøkkel, option);
  }
  const alternativer = [...unike.values()];
  if (alternativer.length === 1) {
    const [eneste] = alternativer;
    return {
      kind: "placed",
      point: { latitude: eneste.latitude, longitude: eneste.longitude },
      label: eneste.label,
    };
  }
  return { kind: "ambiguous", options: alternativer.slice(0, 5) };
}

const UNPLACED_PREDICATE = `(latitude IS NULL OR longitude IS NULL
   OR (latitude = 0 AND longitude = 0))`;

export async function leadPlacementStatus(
  pool: Pool,
  input: { project: LeadgridAccessibleProject },
): Promise<LeadPlacementStatus> {
  const rows = await pool.query<UnplacedLead>(
    `SELECT id::text, name, address, postal_code, city,
            enrichment_org_nr AS organization_number
       FROM crm_customers
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND archived_at IS NULL
        AND ${UNPLACED_PREDICATE}
      ORDER BY updated_at DESC
      LIMIT 200`,
    [input.project.organizationId, input.project.id],
  );
  const resolvable = rows.rows.filter(
    (lead) => placementQueryFor(lead, null) !== null,
  );
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
    `SELECT id::text, name, address, postal_code, city,
            enrichment_org_nr AS organization_number
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
  let reused = 0;
  let unresolved = 0;
  let attempted = 0;
  const ambiguous: AmbiguousLead[] = [];

  for (const lead of kandidater.rows) {
    const nøkkel = placementKeyFor(lead);
    if (nøkkel) {
      // Det noen har bekreftet før, spør vi ikke om igjen.
      const husket = await pool.query<{ latitude: number; longitude: number }>(
        `SELECT latitude, longitude
           FROM leadgrid_lead_placement_decisions
          WHERE organization_id = $1::uuid AND query_key = $2
          ORDER BY created_at DESC
          LIMIT 1`,
        [input.project.organizationId, nøkkel],
      );
      const rad = husket.rows[0];
      if (rad) {
        await writePlacement(pool, {
          project: input.project,
          lead,
          point: { latitude: rad.latitude, longitude: rad.longitude },
          label: null,
          source: "user_verified",
          queryKey: nøkkel,
          municipalityNumber: null,
          decidedBy: null,
        });
        placed += 1;
        reused += 1;
        continue;
      }
    }

    const kommunenummer = await municipalityFromBrreg(hentFra, lead);
    const params = placementQueryFor(lead, kommunenummer);
    if (!params) continue;
    attempted += 1;
    const utfall = await lookupAddress(hentFra, params, lead);
    if (utfall.kind === "unresolved") {
      unresolved += 1;
      continue;
    }
    if (utfall.kind === "ambiguous") {
      ambiguous.push({
        lead_id: lead.id,
        name: lead.name,
        address: lead.address,
        options: utfall.options,
      });
      continue;
    }
    await writePlacement(pool, {
      project: input.project,
      lead,
      point: utfall.point,
      label: utfall.label,
      source: kommunenummer ? "brreg_municipality" : "unique_match",
      queryKey: nøkkel,
      municipalityNumber: kommunenummer,
      decidedBy: null,
    });
    placed += 1;
  }

  return {
    attempted,
    placed,
    reused,
    ambiguous,
    unresolved,
    remaining: Math.max(0, status.unplaced_count - placed),
  };
}

/**
 * Plasser én nettopp godkjent lead.
 *
 * Discovery geokoder maks 120 adresser per kjøring. Blir en kandidat godkjent
 * uten koordinater, er leaden usynlig på kartet fra sekundet den oppstår — og
 * brikka i Kart fanger den først når noen trykker. Her gjøres oppslaget med én
 * gang, med samme presisjon som resten: kommunenummer fra Enhetsregisteret
 * først, og ingen plassering i det hele tatt hvis adressen er tvetydig.
 *
 * Kalles uten å ventes på. Feiler den, er leaden akkurat like usynlig som før,
 * og brikka står igjen som sikkerhetsnett.
 */
export async function placeLeadAfterApproval(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    leadId: string;
    fetchImpl?: typeof fetch;
  },
): Promise<"placed" | "ambiguous" | "unresolved" | "skipped"> {
  const hentFra = input.fetchImpl ?? fetch;
  const rad = await pool.query<UnplacedLead>(
    `SELECT id::text, name, address, postal_code, city,
            enrichment_org_nr AS organization_number
       FROM crm_customers
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3
        AND archived_at IS NULL
        AND ${UNPLACED_PREDICATE}`,
    [input.leadId, input.project.organizationId, input.project.id],
  );
  const lead = rad.rows[0];
  // Har leaden allerede koordinater, treffer ikke spørringen. Det er svaret.
  if (!lead) return "skipped";

  const nøkkel = placementKeyFor(lead);
  if (nøkkel) {
    const husket = await pool.query<{ latitude: number; longitude: number }>(
      `SELECT latitude, longitude
         FROM leadgrid_lead_placement_decisions
        WHERE organization_id = $1::uuid AND query_key = $2
        ORDER BY created_at DESC
        LIMIT 1`,
      [input.project.organizationId, nøkkel],
    );
    const bekreftet = husket.rows[0];
    if (bekreftet) {
      await writePlacement(pool, {
        project: input.project,
        lead,
        point: {
          latitude: bekreftet.latitude,
          longitude: bekreftet.longitude,
        },
        label: null,
        source: "user_verified",
        queryKey: nøkkel,
        municipalityNumber: null,
        decidedBy: null,
      });
      return "placed";
    }
  }

  const kommunenummer = await municipalityFromBrreg(hentFra, lead);
  const params = placementQueryFor(lead, kommunenummer);
  if (!params) return "skipped";
  const utfall = await lookupAddress(hentFra, params, lead);
  if (utfall.kind !== "placed") return utfall.kind;
  await writePlacement(pool, {
    project: input.project,
    lead,
    point: utfall.point,
    label: utfall.label,
    source: kommunenummer ? "brreg_municipality" : "unique_match",
    queryKey: nøkkel,
    municipalityNumber: kommunenummer,
    decidedBy: null,
  });
  return "placed";
}

/**
 * Brukeren pekte. Da er dette fasit — både for leaden og for neste lead på
 * samme adresse.
 */
export async function verifyLeadPlacement(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    leadId: string;
    point: GeoPoint;
    label: string | null;
    userId: string;
  },
): Promise<{ placed: boolean }> {
  const lead = await pool.query<UnplacedLead>(
    `SELECT id::text, name, address, postal_code, city,
            enrichment_org_nr AS organization_number
       FROM crm_customers
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3
        AND archived_at IS NULL`,
    [input.leadId, input.project.organizationId, input.project.id],
  );
  const rad = lead.rows[0];
  if (!rad) return { placed: false };
  await writePlacement(pool, {
    project: input.project,
    lead: rad,
    point: input.point,
    label: input.label,
    source: "user_verified",
    queryKey: placementKeyFor(rad),
    municipalityNumber: null,
    decidedBy: input.userId,
  });
  return { placed: true };
}

async function writePlacement(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    lead: UnplacedLead;
    point: GeoPoint;
    label: string | null;
    source: "brreg_municipality" | "unique_match" | "user_verified";
    queryKey: string | null;
    municipalityNumber: string | null;
    decidedBy: string | null;
  },
): Promise<void> {
  await pool.query(
    `UPDATE crm_customers
        SET latitude = $1, longitude = $2, updated_at = NOW()
      WHERE id = $3::uuid
        AND organization_id = $4::uuid
        AND project_id = $5`,
    [
      input.point.latitude,
      input.point.longitude,
      input.lead.id,
      input.project.organizationId,
      input.project.id,
    ],
  );
  if (!input.queryKey) return;
  await pool.query(
    `INSERT INTO leadgrid_lead_placement_decisions
       (organization_id, project_id, lead_id, query_key, municipality_number,
        latitude, longitude, label, source, decided_by)
     VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10::uuid)
     ON CONFLICT (lead_id) DO UPDATE
        SET latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            label = EXCLUDED.label,
            source = EXCLUDED.source,
            decided_by = EXCLUDED.decided_by,
            created_at = NOW()`,
    [
      input.project.organizationId,
      input.project.id,
      input.lead.id,
      input.queryKey,
      input.municipalityNumber,
      input.point.latitude,
      input.point.longitude,
      input.label,
      input.source,
      input.decidedBy,
    ],
  );
}

/**
 * Organisasjonsnummeret er det presise anker: Enhetsregisteret vet hvilken
 * kommune bedriften er registrert i, og da kan adressesøket ikke lenger treffe
 * en likelydende gate i en annen kommune.
 */
async function municipalityFromBrreg(
  hentFra: typeof fetch,
  lead: UnplacedLead,
): Promise<string | null> {
  const orgnr = lead.organization_number?.replace(/\D/g, "");
  if (!orgnr || orgnr.length !== 9) return null;
  try {
    const svar = await hentFra(`${BRREG_ENHET_ENDPOINT}/${orgnr}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!svar.ok) return null;
    const data = (await svar.json()) as {
      forretningsadresse?: { kommunenummer?: unknown };
      beliggenhetsadresse?: { kommunenummer?: unknown };
    };
    const kommune =
      text(data.forretningsadresse?.kommunenummer) ??
      text(data.beliggenhetsadresse?.kommunenummer);
    return kommune && /^\d{4}$/.test(kommune) ? kommune : null;
  } catch {
    return null;
  }
}

async function lookupAddress(
  hentFra: typeof fetch,
  params: URLSearchParams,
  lead: UnplacedLead,
): Promise<PlacementOutcome> {
  try {
    const svar = await hentFra(`${GEONORGE_ADDRESS_ENDPOINT}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!svar.ok) return { kind: "unresolved" };
    const data = (await svar.json()) as { adresser?: GeonorgeHit[] };
    return classifyPlacement(data.adresser ?? [], lead);
  } catch {
    // Ett oppslag som feiler skal ikke stoppe resten av lista.
    return { kind: "unresolved" };
  }
}

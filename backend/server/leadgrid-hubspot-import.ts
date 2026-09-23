/**
 * HubSpot-import: tenningen motoren manglet.
 *
 * `hubspot-client.ts` kan snakke med HubSpot, og `hubspot-migration-plan.ts`
 * kan oversette en HubSpot-konto til Leadgrid-rader. Begge er testet, og
 * klienten er verifisert mot en ekte konto (docs/evidence/
 * 2026-09-hubspot-migration-import.yaml). Det som manglet var veien mellom
 * dem, og veien inn i databasen.
 *
 * Her er de to stegene:
 *   hentHubSpotData()   — ett fullt uttak, i riktig rekkefølge
 *   skrivMigrering()    — planen inn i basen, i én transaksjon
 *
 * Service Key-en lagres aldri. Den følger forespørselen, brukes, og
 * forsvinner med prosessminnet — en migrering skjer én gang, og en nøkkel vi
 * ikke har kan ikke lekke.
 */
import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  createHubSpotClient,
  HUBSPOT_API_BASE,
  HUBSPOT_API_VERSION,
  type HubSpotClient,
} from "./hubspot-client.js";
import type {
  HubSpotAssociation,
  HubSpotObject,
} from "./hubspot-migration-fixtures.js";
import {
  planHubSpotMigration,
  type MigrationInput,
  type MigrationPlan,
} from "./hubspot-migration-plan.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

/** Egenskapene vi ber HubSpot om. Alt annet ville økt uttaket uten nytte. */
const COMPANY_PROPERTIES = [
  "name", "domain", "phone", "city", "zip", "country", "website",
  "numberofemployees", "lifecyclestage", "hubspot_owner_id",
];
const CONTACT_PROPERTIES = [
  "firstname", "lastname", "email", "phone", "jobtitle", "company",
  "lifecyclestage", "hubspot_owner_id", "city", "zip", "country",
];
const DEAL_PROPERTIES = [
  "dealname", "amount", "dealstage", "pipeline", "closedate",
  "hubspot_owner_id", "hs_deal_stage_probability",
];
const PRODUCT_PROPERTIES = [
  "name", "description", "price", "hs_sku", "recurringbillingfrequency",
];
const LINE_ITEM_PROPERTIES = [
  "name", "quantity", "price", "hs_discount_percentage", "discount",
  "recurringbillingfrequency", "hs_recurring_billing_start_date", "hs_product_id",
];

/** Objekttypene migreringen leser, med scopet HubSpot krever for hver. */
export const HUBSPOT_TILGANGER = [
  { type: "companies", navn: "bedrifter", scope: "crm.objects.companies.read", kritisk: true },
  { type: "contacts", navn: "kontakter", scope: "crm.objects.contacts.read", kritisk: true },
  { type: "deals", navn: "avtaler", scope: "crm.objects.deals.read", kritisk: true },
  { type: "products", navn: "produkter", scope: "crm.objects.products.read", kritisk: false },
  { type: "line_items", navn: "ordrelinjer", scope: "crm.objects.line_items.read", kritisk: false },
] as const;

export interface TilgangsSjekk {
  ok: boolean;
  /** Scopes som mangler og som stopper migreringen. */
  manglerKritisk: Array<{ navn: string; scope: string }>;
  /** Scopes som mangler, men som bare gjør at noe utelates. */
  manglerValgfritt: Array<{ navn: string; scope: string }>;
  ugyldigNøkkel: boolean;
}

/**
 * Spør etter én rad av hver type før vi starter uttaket.
 *
 * Uten dette oppdager kunden først etter flere minutter at nøkkelen manglet
 * ett scope — og får «403 Forbidden», ikke «legg til crm.objects.deals.read».
 * Fem raske kall er billig sammenlignet med det.
 */
export async function sjekkHubSpotTilgang(
  accessToken: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<TilgangsSjekk> {
  const hentFra = options.fetchImpl ?? fetch;
  const manglerKritisk: Array<{ navn: string; scope: string }> = [];
  const manglerValgfritt: Array<{ navn: string; scope: string }> = [];
  let ugyldigNøkkel = false;

  for (const tilgang of HUBSPOT_TILGANGER) {
    try {
      const svar = await hentFra(
        `${HUBSPOT_API_BASE}/crm/objects/${HUBSPOT_API_VERSION}/${tilgang.type}?limit=1`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (svar.status === 401) {
        ugyldigNøkkel = true;
        break;
      }
      if (svar.status === 403) {
        (tilgang.kritisk ? manglerKritisk : manglerValgfritt).push({
          navn: tilgang.navn,
          scope: tilgang.scope,
        });
      }
    } catch {
      // Nettverksfeil her er ikke et scope-problem; uttaket får prøve selv.
    }
  }

  return {
    ok: !ugyldigNøkkel && manglerKritisk.length === 0,
    manglerKritisk,
    manglerValgfritt,
    ugyldigNøkkel,
  };
}

export interface HubSpotFetchResult {
  input: MigrationInput;
  /** Hva uttaket kostet, så kunden ser at vi ikke hamret på kontoen deres. */
  stats: ReturnType<HubSpotClient["stats"]>;
}

/**
 * Henter alt vi trenger i ett uttak.
 *
 * Produkter og ordrelinjer krever egne scopes. Mangler de, svarer HubSpot 403
 * — og da er riktig oppførsel å importere resten, ikke å stoppe: en kunde uten
 * produktkatalog skal ikke blokkeres av en katalog de ikke har. Evidensfilen
 * noterer dessuten at scope-endringer ikke propagerer umiddelbart, så et 403
 * rett etter at kunden har fikset tilgangen er forventet.
 */
export async function hentHubSpotData(
  accessToken: string,
  options: {
    burstLimit?: number;
    fetchImpl?: typeof fetch;
    /** Kalles når en datatype er ferdig hentet, så kunden ser framdrift. */
    onFramdrift?: (ferdig: string, antall: number) => void;
  } = {},
): Promise<HubSpotFetchResult> {
  const client = createHubSpotClient({
    accessToken,
    burstLimit: options.burstLimit,
    fetchImpl: options.fetchImpl,
  });

  const meld = options.onFramdrift ?? (() => {});
  const spor = async <T>(navn: string, løfte: Promise<T[]>): Promise<T[]> => {
    const ut = await løfte;
    meld(navn, ut.length);
    return ut;
  };
  const [companies, contacts, deals, owners, pipelines] = await Promise.all([
    spor("bedrifter", client.listAll("companies", COMPANY_PROPERTIES)),
    spor("kontakter", client.listAll("contacts", CONTACT_PROPERTIES)),
    spor("avtaler", client.listAll("deals", DEAL_PROPERTIES)),
    spor("eiere", client.listOwners()),
    spor("pipelines", client.listPipelines("deals")),
  ]);

  const [contactToCompanyRaw, companyToDealsRaw] = await Promise.all([
    client.listAssociations("contacts", "companies", contacts.map((c) => c.id)),
    client.listAssociations("companies", "deals", companies.map((c) => c.id)),
  ]);
  const contactToCompany = somAssosiasjoner(contactToCompanyRaw);

  const { products, lineItems, dealToLineItems } = await hentKatalog(client, deals);
  meld("produkter", products.length);
  meld("koblinger", Object.keys(contactToCompany).length);

  return {
    input: {
      companies,
      contacts,
      deals,
      owners,
      pipelines,
      contactToCompany,
      companyToDeals: Object.fromEntries(
        Object.entries(companyToDealsRaw).map(([id, treff]) => [
          id,
          treff.map((t) => String(t.toObjectId)),
        ]),
      ),
      products,
      lineItems,
      dealToLineItems,
      // Aktiviteter migreres ikke ennå; planleggeren bruker lista til å se
      // hvilke kontakter som har historikk, og tom liste er et ærlig svar.
      engagements: [],
    },
    stats: client.stats(),
  };
}

/**
 * Klienten returnerer `category: string`; planleggeren krever unionen
 * HUBSPOT_DEFINED | USER_DEFINED. HubSpot sender bare disse to, men typen er
 * bred, så vi smalner den her i stedet for å løsne kravet i planleggeren.
 */
function somAssosiasjoner(
  rå: Record<
    string,
    Array<{
      toObjectId: string;
      associationTypes: Array<{ category: string; typeId: number; label: string | null }>;
    }>
  >,
): Record<string, HubSpotAssociation[]> {
  return Object.fromEntries(
    Object.entries(rå).map(([id, treff]) => [
      id,
      treff.map((t) => ({
        toObjectId: t.toObjectId,
        associationTypes: t.associationTypes.map((a) => ({
          category:
            a.category === "USER_DEFINED"
              ? ("USER_DEFINED" as const)
              : ("HUBSPOT_DEFINED" as const),
          typeId: a.typeId,
          label: a.label,
        })),
      })),
    ]),
  );
}

async function hentKatalog(
  client: HubSpotClient,
  deals: HubSpotObject[],
): Promise<{
  products: HubSpotObject[];
  lineItems: HubSpotObject[];
  dealToLineItems: Record<string, string[]>;
}> {
  try {
    const [products, lineItems, kobling] = await Promise.all([
      client.listAll("products", PRODUCT_PROPERTIES),
      client.listAll("line_items", LINE_ITEM_PROPERTIES),
      client.listAssociations("deals", "line_items", deals.map((d) => d.id)),
    ]);
    return {
      products,
      lineItems,
      dealToLineItems: Object.fromEntries(
        Object.entries(kobling).map(([id, treff]) => [
          id,
          treff.map((t) => String(t.toObjectId)),
        ]),
      ),
    };
  } catch (error) {
    // Manglende scope skal ikke stoppe resten av migreringen.
    console.warn("[hubspot] katalog hoppet over:", (error as Error).message);
    return { products: [], lineItems: [], dealToLineItems: {} };
  }
}

export interface ImportResult {
  customers: number;
  deals: number;
  contacts: number;
  products: number;
  lineItems: number;
  /** Rader som alt fantes fra en tidligere kjøring og ble oppdatert. */
  updated: number;
}

/**
 * Skriver planen. Alt eller ingenting: en halv migrering er verre enn ingen,
 * fordi kunden da ikke vet hva som mangler.
 *
 * Idempotent på HubSpot-id-ene. Kjøres importen to ganger, oppdateres radene
 * i stedet for å dupliseres — og en avbrutt import kan trygt gjentas.
 */
export async function skrivMigrering(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    plan: MigrationPlan;
    userId: string;
  },
): Promise<ImportResult> {
  const klient = await pool.connect();
  try {
    await klient.query("BEGIN");
    const resultat = await skrivInnenforTransaksjon(klient, input);
    await klient.query("COMMIT");
    return resultat;
  } catch (error) {
    await klient.query("ROLLBACK");
    throw error;
  } finally {
    klient.release();
  }
}

async function skrivInnenforTransaksjon(
  klient: PoolClient,
  input: {
    project: LeadgridAccessibleProject;
    plan: MigrationPlan;
    userId: string;
  },
): Promise<ImportResult> {
  const { project, plan, userId } = input;
  const orgId = project.organizationId;
  let oppdatert = 0;

  // HubSpot-id -> vår id, så avtaler og kontakter finner bedriften sin.
  const kundeId = new Map<string, string>();
  for (const kunde of plan.customers) {
    const finnes = await klient.query<{ id: string }>(
      `SELECT id::text FROM crm_customers
        WHERE organization_id = $1::uuid AND project_id = $2
          AND import_raw_data->>'hubspot_id' = $3
        LIMIT 1`,
      [orgId, project.id, kunde.hubspotId],
    );
    const rå = JSON.stringify({ ...kunde.raw, hubspot_id: kunde.hubspotId });
    if (finnes.rows[0]) {
      await klient.query(
        `UPDATE crm_customers
            SET name = $1, company = $1, email = $2, phone = $3, city = $4,
                postal_code = $5, website_url = $6, lead_status = $7,
                lifecycle_stage = $8, import_raw_data = $9::jsonb,
                updated_at = NOW()
          WHERE id = $10::uuid`,
        [
          kunde.name, kunde.email, kunde.phone, kunde.city, kunde.postalCode,
          kunde.websiteUrl, kunde.pipelineStage, kunde.lifecycleStage, rå,
          finnes.rows[0].id,
        ],
      );
      kundeId.set(kunde.hubspotId, finnes.rows[0].id);
      oppdatert += 1;
      continue;
    }
    const ny = await klient.query<{ id: string }>(
      `INSERT INTO crm_customers (
         id, name, company, email, phone, city, postal_code, website_url,
         status, source, owner_user_id, organization_id, project_id,
         lead_status, lifecycle_stage, lead_source, draft_status,
         import_source, import_raw_data, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $1, $2, $3, $4, $5, $6,
         'lead', 'hubspot_import', $7, $8::uuid, $9,
         $10, $11, 'hubspot_import', 'lead', 'hubspot_import',
         $12::jsonb, NOW(), NOW()
       ) RETURNING id::text`,
      [
        kunde.name, kunde.email, kunde.phone, kunde.city, kunde.postalCode,
        kunde.websiteUrl, kunde.ownerUserId ?? userId, orgId, project.id,
        kunde.pipelineStage, kunde.lifecycleStage, rå,
      ],
    );
    kundeId.set(kunde.hubspotId, ny.rows[0].id);
  }

  const avtaleId = new Map<string, string>();
  for (const avtale of plan.deals) {
    const kunde = kundeId.get(avtale.customerHubspotId);
    if (!kunde) continue;
    const id = await klient.query<{ id: string }>(
      `INSERT INTO leadgrid_deals (
         id, organization_id, project_id, customer_id, title, pipeline_stage,
         deal_amount, deal_probability, expected_close_date, owner_user_id,
         is_primary, source, hubspot_deal_id, created_by_user_id,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1::uuid, $2, $3::uuid, $4, $5,
         $6, $7, $8::date, $9, $10, 'hubspot_import', $11, $12,
         NOW(), NOW()
       )
       ON CONFLICT (organization_id, hubspot_deal_id)
         WHERE hubspot_deal_id IS NOT NULL
       DO UPDATE SET title = EXCLUDED.title,
                     pipeline_stage = EXCLUDED.pipeline_stage,
                     deal_amount = EXCLUDED.deal_amount,
                     updated_at = NOW()
       RETURNING id::text`,
      [
        orgId, project.id, kunde, avtale.title, avtale.pipelineStage,
        avtale.dealAmount, avtale.dealProbability, avtale.expectedCloseDate,
        avtale.ownerUserId ?? userId, avtale.isPrimary, avtale.hubspotId, userId,
      ],
    );
    avtaleId.set(avtale.hubspotId, id.rows[0].id);
  }

  for (const kontakt of plan.contacts) {
    const kunde = kundeId.get(kontakt.customerHubspotId);
    if (!kunde) continue;
    await klient.query(
      `INSERT INTO leadgrid_customer_contacts (
         id, organization_id, project_id, customer_id, name, role,
         email, phone, source, hubspot_contact_id, created_at, updated_at
       ) VALUES ($1, $2::uuid, $3, $4::uuid, $5, $6, $7, $8,
                 'hubspot_import', $9, NOW(), NOW())
       ON CONFLICT (organization_id, hubspot_contact_id)
         WHERE hubspot_contact_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
                     phone = EXCLUDED.phone, updated_at = NOW()`,
      [
        randomUUID(), orgId, project.id, kunde, kontakt.name, kontakt.role,
        kontakt.email, kontakt.phone, kontakt.hubspotId,
      ],
    );
  }

  const produktId = new Map<string, string>();
  for (const produkt of plan.products) {
    const id = await klient.query<{ id: string }>(
      `INSERT INTO leadgrid_products (
         id, organization_id, project_id, sku, name, description,
         unit_price, billing_frequency, active, hubspot_product_id,
         created_by_user_id, created_at, updated_at
       ) VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, TRUE,
                 $8, $9, NOW(), NOW())
       ON CONFLICT (organization_id, hubspot_product_id)
         WHERE hubspot_product_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name, unit_price = EXCLUDED.unit_price,
                     updated_at = NOW()
       RETURNING id::text`,
      [
        orgId, project.id, produkt.sku, produkt.name, produkt.description,
        produkt.unitPrice, produkt.billingFrequency, produkt.hubspotId, userId,
      ],
    );
    produktId.set(produkt.hubspotId, id.rows[0].id);
  }

  let linjer = 0;
  for (const linje of plan.lineItems) {
    const avtale = avtaleId.get(linje.dealHubspotId);
    if (!avtale) continue;
    await klient.query(
      `INSERT INTO leadgrid_deal_line_items (
         id, organization_id, project_id, deal_id, product_id, name,
         quantity, unit_price, discount_percent, discount_amount,
         billing_frequency, recurring_start_date, hubspot_line_item_id,
         created_at, updated_at
       ) VALUES (gen_random_uuid(), $1::uuid, $2, $3::uuid, $4, $5,
                 $6, $7, $8, $9, $10, $11::date, $12, NOW(), NOW())
       ON CONFLICT (organization_id, hubspot_line_item_id)
         WHERE hubspot_line_item_id IS NOT NULL
       DO UPDATE SET quantity = EXCLUDED.quantity,
                     unit_price = EXCLUDED.unit_price,
                     discount_percent = EXCLUDED.discount_percent,
                     discount_amount = EXCLUDED.discount_amount,
                     updated_at = NOW()`,
      [
        orgId, project.id, avtale,
        linje.productHubspotId ? produktId.get(linje.productHubspotId) ?? null : null,
        linje.name, linje.quantity, linje.unitPrice, linje.discountPercent,
        linje.discountAmount, linje.billingFrequency, linje.recurringStartDate,
        linje.hubspotId,
      ],
    );
    linjer += 1;
  }

  return {
    customers: plan.customers.length,
    deals: avtaleId.size,
    contacts: plan.contacts.length,
    products: produktId.size,
    lineItems: linjer,
    updated: oppdatert,
  };
}

export { planHubSpotMigration };
export type { MigrationPlan };

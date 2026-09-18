/**
 * hubspot-migration-fixtures.ts — HubSpot-svar som speiler de tilfellene der
 * migreringen kan feile, ikke happy path.
 *
 * Formen følger HubSpots CRM-objekt-API (datostemplet sti, i dag
 * /crm/objects/2026-03/{objectType}): hvert objekt har id, properties,
 * createdAt/updatedAt/archived, og lister pagineres med paging.next.after.
 * Associations leses via v4 og kan bære flere labels per kobling.
 * Kilder og gap-analyse: docs/evidence/2026-09-hubspot-migration-import.yaml
 *
 * Fiksturen er bevisst «stygg»: en kontakt uten selskap, en kontakt hos to
 * selskaper, et selskap med flere åpne deals, en ukjent pipeline-stage, en
 * ukjent eier og en e-postaktivitet. Det er disse som avgjør om en migrering
 * feiler høylytt eller taper data stille.
 */

export interface HubSpotObject {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotPage<T> {
  results: T[];
  paging?: { next?: { after: string; link?: string } };
}

export interface HubSpotAssociationType {
  category: "HUBSPOT_DEFINED" | "USER_DEFINED";
  typeId: number;
  label: string | null;
}

export interface HubSpotAssociation {
  /** Objektet koblingen peker på (f.eks. en company-id sett fra en contact). */
  toObjectId: string;
  /** HubSpot tillater flere labels på samme kobling samtidig. */
  associationTypes: HubSpotAssociationType[];
}

export interface HubSpotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  archived: boolean;
}

/** Egendefinert pipeline med egne stager. Navnene er kundens, ikke HubSpots. */
export interface HubSpotPipeline {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string; displayOrder: number; metadata: { isClosed: string; probability: string } }>;
}

const ISO = "2026-04-02T09:15:00.000Z";

/* ── Selskaper ──────────────────────────────────────────────────────────── */

export const COMPANY_NORDVIK: HubSpotObject = {
  id: "7001",
  properties: {
    name: "Nordvik Anlegg AS",
    domain: "nordvikanlegg.no",
    phone: "+47 55 12 34 56",
    address: "Kanalveien 12",
    city: "Bergen",
    zip: "5068",
    country: "Norge",
    numberofemployees: "48",
    hubspot_owner_id: "550001",
    // Beregnet av HubSpot. Skal ikke migreres: avledet av logikk vi ikke har.
    hs_predictivecontactscore_v2: "72",
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

export const COMPANY_FJELLTEK: HubSpotObject = {
  id: "7002",
  properties: {
    name: "Fjelltek Industri AS",
    domain: "fjelltek.no",
    phone: null,
    address: null,
    city: "Trondheim",
    zip: null,
    country: "Norge",
    numberofemployees: null,
    hubspot_owner_id: "550999", // eier som IKKE finnes i owners-listen
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

/* ── Kontakter ──────────────────────────────────────────────────────────── */

/** Normaltilfellet: én kontakt, ett selskap, full kontaktinfo. */
export const CONTACT_INGRID: HubSpotObject = {
  id: "3001",
  properties: {
    email: "ingrid.solberg@nordvikanlegg.no",
    firstname: "Ingrid",
    lastname: "Solberg",
    phone: "+47 900 11 222",
    jobtitle: "Innkjøpssjef",
    lifecyclestage: "opportunity",
    hubspot_owner_id: "550001",
    bransjefokus: "Anlegg", // egendefinert property (enumeration)
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

/** Ingen company-association. leadgrid_customer_contacts.customer_id er NOT NULL. */
export const CONTACT_FRILANS: HubSpotObject = {
  id: "3002",
  properties: {
    email: "kari@frilanskonsult.no",
    firstname: "Kari",
    lastname: "Bråten",
    phone: "+47 977 88 100",
    jobtitle: "Selvstendig rådgiver",
    lifecyclestage: "lead",
    hubspot_owner_id: "550001",
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

/** Tilhører to selskaper samtidig, med ulike labels på hver kobling. */
export const CONTACT_DOBBEL: HubSpotObject = {
  id: "3003",
  properties: {
    email: "per.hagen@fjelltek.no",
    firstname: "Per",
    lastname: "Hagen",
    phone: "+47 918 30 040",
    jobtitle: "Styreleder",
    lifecyclestage: "customer",
    hubspot_owner_id: "550002",
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

/** Verken e-post eller telefon. Dedup på e-post kan ikke brukes. */
export const CONTACT_UTEN_KONTAKTINFO: HubSpotObject = {
  id: "3004",
  properties: {
    email: null,
    firstname: "Ukjent",
    lastname: "Kontakt",
    phone: null,
    jobtitle: null,
    lifecyclestage: "subscriber",
    hubspot_owner_id: null,
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

/** Samme e-post som CONTACT_INGRID, men annen HubSpot-id. Dedup-kollisjon. */
export const CONTACT_DUPLIKAT_EPOST: HubSpotObject = {
  id: "3005",
  properties: {
    email: "ingrid.solberg@nordvikanlegg.no",
    firstname: "Ingrid",
    lastname: "Solberg-Hansen",
    phone: "+47 900 11 999",
    jobtitle: "Innkjøpsdirektør",
    lifecyclestage: "opportunity",
    hubspot_owner_id: "550001",
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

/* ── Deals ──────────────────────────────────────────────────────────────── */

/** Tre åpne deals på samme selskap. Vår modell har plass til én per kunde-rad. */
export const DEAL_RAMMEAVTALE: HubSpotObject = {
  id: "9001",
  properties: {
    dealname: "Rammeavtale 2027",
    amount: "850000",
    dealstage: "kontrakt_til_signering", // kundens egen stage
    pipeline: "salg_norge",
    closedate: "2027-01-31T00:00:00.000Z",
    hs_deal_stage_probability: "0.8",
    hubspot_owner_id: "550001",
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

export const DEAL_SERVICE: HubSpotObject = {
  id: "9002",
  properties: {
    dealname: "Serviceavtale maskinpark",
    amount: "240000",
    dealstage: "behovsavklaring",
    pipeline: "salg_norge",
    closedate: "2026-12-15T00:00:00.000Z",
    hs_deal_stage_probability: "0.3",
    hubspot_owner_id: "550002",
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

export const DEAL_UTVIDELSE: HubSpotObject = {
  id: "9003",
  properties: {
    dealname: "Utvidelse Vestland",
    amount: null, // beløp mangler
    dealstage: "kvalifisert",
    pipeline: "salg_norge",
    closedate: null,
    hs_deal_stage_probability: "0.5",
    hubspot_owner_id: "550001",
  },
  createdAt: ISO,
  updatedAt: ISO,
  archived: false,
};

/* ── Eiere, pipeline og assosiasjoner ───────────────────────────────────── */

export const OWNERS: HubSpotOwner[] = [
  { id: "550001", email: "daniel@creatorhubn.com", firstName: "Daniel", lastName: "Q", archived: false },
  { id: "550002", email: "selger.som.sluttet@nordvikanlegg.no", firstName: "Tidligere", lastName: "Selger", archived: true },
];

/** Kundens egen pipeline. Ingen av stagenavnene finnes i vår CHECK-constraint. */
export const PIPELINE_SALG_NORGE: HubSpotPipeline = {
  id: "salg_norge",
  label: "Salg Norge",
  stages: [
    { id: "behovsavklaring", label: "Behovsavklaring", displayOrder: 0, metadata: { isClosed: "false", probability: "0.3" } },
    { id: "kvalifisert", label: "Kvalifisert", displayOrder: 1, metadata: { isClosed: "false", probability: "0.5" } },
    { id: "kontrakt_til_signering", label: "Kontrakt til signering", displayOrder: 2, metadata: { isClosed: "false", probability: "0.8" } },
    { id: "vunnet", label: "Vunnet", displayOrder: 3, metadata: { isClosed: "true", probability: "1.0" } },
  ],
};

export const CONTACT_TO_COMPANY: Record<string, HubSpotAssociation[]> = {
  "3001": [{ toObjectId: "7001", associationTypes: [{ category: "HUBSPOT_DEFINED", typeId: 1, label: "Primary" }] }],
  "3002": [], // ingen kobling
  "3003": [
    { toObjectId: "7002", associationTypes: [
      { category: "HUBSPOT_DEFINED", typeId: 1, label: "Primary" },
      { category: "USER_DEFINED", typeId: 30, label: "Decision maker" },
    ] },
    { toObjectId: "7001", associationTypes: [
      { category: "USER_DEFINED", typeId: 28, label: "Billing contact" },
    ] },
  ],
  "3004": [{ toObjectId: "7001", associationTypes: [{ category: "HUBSPOT_DEFINED", typeId: 1, label: "Primary" }] }],
  "3005": [{ toObjectId: "7001", associationTypes: [{ category: "HUBSPOT_DEFINED", typeId: 1, label: "Primary" }] }],
};

export const COMPANY_TO_DEALS: Record<string, string[]> = {
  "7001": ["9001", "9002", "9003"],
  "7002": [],
};

/* ── Aktiviteter ────────────────────────────────────────────────────────── */

/** HubSpot-engasjementer. crm_lead_activities.activity_type har ingen e-post/samtale. */
export const ENGAGEMENTS = [
  { id: "e1", type: "EMAIL", timestamp: ISO, ownerId: "550001", contactId: "3001", subject: "Tilbud rammeavtale" },
  { id: "e2", type: "CALL", timestamp: ISO, ownerId: "550001", contactId: "3001", durationMs: 480000 },
  { id: "e3", type: "MEETING", timestamp: ISO, ownerId: "550002", contactId: "3003", subject: "Oppstartsmøte" },
  { id: "e4", type: "NOTE", timestamp: ISO, ownerId: "550001", contactId: "3001", body: "Vil ha revidert pris innen fredag." },
  { id: "e5", type: "TASK", timestamp: ISO, ownerId: "550001", contactId: "3002", subject: "Ring tilbake" },
] as const;

/* ── Sider (paginering) ─────────────────────────────────────────────────── */

export const CONTACTS_PAGE_1: HubSpotPage<HubSpotObject> = {
  results: [CONTACT_INGRID, CONTACT_FRILANS, CONTACT_DOBBEL],
  paging: { next: { after: "3003" } },
};

export const CONTACTS_PAGE_2: HubSpotPage<HubSpotObject> = {
  results: [CONTACT_UTEN_KONTAKTINFO, CONTACT_DUPLIKAT_EPOST],
  // ingen paging.next = siste side
};

export const ALL_CONTACTS: HubSpotObject[] = [
  ...CONTACTS_PAGE_1.results,
  ...CONTACTS_PAGE_2.results,
];

export const ALL_COMPANIES: HubSpotObject[] = [COMPANY_NORDVIK, COMPANY_FJELLTEK];

export const ALL_DEALS: HubSpotObject[] = [DEAL_RAMMEAVTALE, DEAL_SERVICE, DEAL_UTVIDELSE];

/**
 * hubspot-migration-plan.ts — hva skjer med hver HubSpot-record hos oss?
 *
 * Ren funksjon, ingen database og ingen nettverk. Den tar et uttrekk fra
 * HubSpot og produserer en plan: hvilke rader som blir opprettet, hvilke som
 * slås sammen, og hva som ikke har en lovlig plass i dagens modell.
 *
 * Bærende regel: ingenting kastes stille. Alt som ikke passer får en
 * eksplisitt issue med kode, slik at en migrering kan vise kunden nøyaktig
 * hva som ikke ble med FØR den kjøres. Gap-analysen med kildehenvisninger
 * ligger i docs/evidence/2026-09-hubspot-migration-import.yaml.
 */

import type {
  HubSpotAssociation,
  HubSpotObject,
  HubSpotOwner,
  HubSpotPipeline,
} from "./hubspot-migration-fixtures.js";

/** Stagene crm_customers.pipeline_stage tillater (migrasjon 313:41). */
export const LEADGRID_STAGES = [
  "new",
  "first_contact",
  "qualified",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type LeadgridStage = (typeof LEADGRID_STAGES)[number];

/** Livssyklus-verdiene crm_customers.lifecycle_stage tillater (migrasjon 0631). */
export const LEADGRID_LIFECYCLE_STAGES = [
  "subscriber",
  "lead",
  "marketing_qualified",
  "sales_qualified",
  "opportunity",
  "customer",
  "evangelist",
  "other",
] as const;
export type LifecycleStage = (typeof LEADGRID_LIFECYCLE_STAGES)[number];

/**
 * HubSpots lifecyclestage -> vår. Verdisettet er bevisst det samme, så
 * dette er stort sett bare navneformatering. HubSpot Enterprise lar kunder
 * definere EGNE livssyklusstadier, og de kan ikke oversettes; de lander på
 * "other" og rapporteres, i stedet for å bli stille borte.
 */
const HUBSPOT_LIFECYCLE: Record<string, LifecycleStage> = {
  subscriber: "subscriber",
  lead: "lead",
  marketingqualifiedlead: "marketing_qualified",
  salesqualifiedlead: "sales_qualified",
  opportunity: "opportunity",
  customer: "customer",
  evangelist: "evangelist",
  other: "other",
};

export function mapLifecycleStage(
  raw: string | null | undefined,
): { stage: LifecycleStage; matched: boolean } {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return { stage: "lead", matched: true };
  const mapped = HUBSPOT_LIFECYCLE[key];
  return mapped ? { stage: mapped, matched: true } : { stage: "other", matched: false };
}

/** Aktivitetstypene crm_lead_activities tillater (migrasjon 271). */
export const LEADGRID_ACTIVITY_TYPES = [
  "status_changed",
  "visit_logged",
  "note_added",
  "pitch_generated",
  "meeting_scheduled",
  "proposal_sent",
  "follow_up_set",
  "lead_created",
  "lead_imported",
  "assigned",
] as const;

export type IssueCode =
  | "contact_without_company"
  | "extra_company_links_dropped"
  | "unknown_pipeline_stage"
  | "unknown_owner"
  | "archived_owner"
  | "activity_type_unsupported"
  | "duplicate_email"
  | "no_dedupe_key"
  | "calculated_property_skipped"
  | "missing_deal_amount"
  | "custom_lifecycle_stage"
  | "unsupported_billing_frequency";

export interface MigrationIssue {
  code: IssueCode;
  /** HubSpot-id-en issuen gjelder. */
  hubspotId: string;
  /** Én setning, ment for kunden — ikke en stacktrace. */
  message: string;
  /** true = data ville gått tapt uten at noen merket det. */
  silentLoss: boolean;
}

export interface PlannedCustomer {
  hubspotId: string;
  source: "company" | "contact_without_company";
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  websiteUrl: string | null;
  employeeCountEstimate: number | null;
  pipelineStage: LeadgridStage;
  lifecycleStage: LifecycleStage;
  ownerUserId: string | null;
  dealAmount: number | null;
  expectedCloseDate: string | null;
  dealProbability: number | null;
  /** Hele HubSpot-objektet, for crm_customers.import_raw_data. */
  raw: Record<string, unknown>;
}

/**
 * Ett salg. Før mig 0650 lagret Leadgrid én avtale per kunde, så alt annet
 * enn den største ble forkastet — en bedrift med en løpende avtale OG en
 * kampanje under forhandling mistet den ene. Nå blir alle med.
 */
export interface PlannedDeal {
  hubspotId: string;
  customerHubspotId: string;
  title: string;
  pipelineStage: LeadgridStage;
  dealAmount: number | null;
  dealProbability: number | null;
  expectedCloseDate: string | null;
  ownerUserId: string | null;
  /** Salget crm_customers sine flate deal-felt speiler (mig 0650). */
  isPrimary: boolean;
  raw: Record<string, unknown>;
}

export interface PlannedContact {
  hubspotId: string;
  customerHubspotId: string;
  name: string;
  role: string | null;
  /** Kolonnene kom i mig 0650; før det hadde kontakten bare navn og rolle. */
  email: string | null;
  phone: string | null;
  /** Eieren er resolvet for å fange ukjent/deaktivert eier, men lagres ikke:
   *  leadgrid_customer_contacts har ingen eier-kolonne. */
  ownerWithoutColumn: string | null;
}

/** Faktureringsfrekvensene leadgrid_products/-line_items tillater (mig 0648). */
export const LEADGRID_BILLING_FREQUENCIES = [
  "one_time", "weekly", "biweekly", "monthly", "quarterly",
  "per_six_months", "annually", "per_two_years", "per_three_years",
] as const;
export type BillingFrequency = (typeof LEADGRID_BILLING_FREQUENCIES)[number];

/** HubSpots recurringbillingfrequency -> vår. Tom verdi = engangssalg. */
export function mapBillingFrequency(
  raw: string | null | undefined,
): { frequency: BillingFrequency; matched: boolean } {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return { frequency: "one_time", matched: true };
  const known = new Set<string>(LEADGRID_BILLING_FREQUENCIES);
  if (known.has(key)) return { frequency: key as BillingFrequency, matched: true };
  // HubSpot har per_four_years og per_five_years; vi stopper på tre år.
  return { frequency: "annually", matched: false };
}

export interface PlannedProduct {
  hubspotId: string;
  sku: string | null;
  name: string;
  description: string | null;
  unitPrice: number;
  billingFrequency: BillingFrequency;
}

export interface PlannedLineItem {
  hubspotId: string;
  /** HubSpot-id-en til avtalen linjen hører til (mig 0650). */
  dealHubspotId: string;
  /** Bedriften avtalen ligger på. Brukes til scoping ved import. */
  customerHubspotId: string;
  productHubspotId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  billingFrequency: BillingFrequency;
  recurringStartDate: string | null;
  /** Samme formel som net_total i databasen, så planen viser rett sum. */
  netTotal: number;
}

export interface MigrationPlan {
  customers: PlannedCustomer[];
  deals: PlannedDeal[];
  contacts: PlannedContact[];
  products: PlannedProduct[];
  lineItems: PlannedLineItem[];
  mergedIntoExisting: Array<{ hubspotId: string; mergesWith: string; on: "email" }>;
  issues: MigrationIssue[];
  counts: {
    customers: number;
    deals: number;
    contacts: number;
    merged: number;
    products: number;
    lineItems: number;
    issues: number;
    silentLossPrevented: number;
  };
}

export interface MigrationInput {
  companies: HubSpotObject[];
  contacts: HubSpotObject[];
  deals: HubSpotObject[];
  owners: HubSpotOwner[];
  pipelines: HubSpotPipeline[];
  contactToCompany: Record<string, HubSpotAssociation[]>;
  companyToDeals: Record<string, string[]>;
  /** Katalogprodukter fra HubSpot. Tom liste = kunden bruker ikke katalog. */
  products?: HubSpotObject[];
  lineItems?: HubSpotObject[];
  dealToLineItems?: Record<string, string[]>;
  engagements: ReadonlyArray<{ id: string; type: string; contactId: string }>;
}

export interface MigrationOptions {
  /** Leadgrid-bruker som overtar leads uten gyldig HubSpot-eier. */
  fallbackOwnerUserId: string;
  /** HubSpot owner-id -> Leadgrid users.id. Uten treff brukes fallback. */
  ownerMap?: Record<string, string>;
}

/** HubSpot-properties som er beregnet av HubSpot og ikke skal migreres. */
const CALCULATED_PREFIXES = ["hs_predictive", "hs_analytics", "hs_time_in", "hs_latest_", "hs_sales_email_"];

function isCalculated(key: string): boolean {
  return CALCULATED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function toNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Oversetter en HubSpot-stage til vår faste CHECK-liste.
 * HubSpot-stagen er kundens egen, så vi kan ikke matche på navn. Vi bruker
 * stagens egen sannsynlighet og isClosed-flagg, som HubSpot oppgir per stage.
 */
export function mapPipelineStage(
  dealstage: string | null,
  pipelines: HubSpotPipeline[],
): { stage: LeadgridStage; matched: boolean; probability: number | null } {
  if (!dealstage) return { stage: "new", matched: false, probability: null };

  for (const pipeline of pipelines) {
    const stage = pipeline.stages.find((s) => s.id === dealstage);
    if (!stage) continue;
    const probability = toNumber(stage.metadata.probability);
    if (stage.metadata.isClosed === "true") {
      return { stage: probability === 0 ? "lost" : "won", matched: true, probability };
    }
    if (probability == null) return { stage: "qualified", matched: true, probability };
    if (probability >= 0.75) return { stage: "negotiation", matched: true, probability };
    if (probability >= 0.55) return { stage: "proposal", matched: true, probability };
    if (probability >= 0.4) return { stage: "meeting", matched: true, probability };
    if (probability >= 0.2) return { stage: "qualified", matched: true, probability };
    return { stage: "first_contact", matched: true, probability };
  }
  return { stage: "new", matched: false, probability: null };
}

function contactDisplayName(properties: Record<string, string | null>): string {
  const name = [properties.firstname, properties.lastname].filter(Boolean).join(" ").trim();
  return name || properties.email || "Ukjent kontakt";
}

/** Bygger migreringsplanen. Rekkefølgen er selskaper, så kontakter, så deals. */
export function planHubSpotMigration(input: MigrationInput, options: MigrationOptions): MigrationPlan {
  const issues: MigrationIssue[] = [];
  const customers: PlannedCustomer[] = [];
  const deals: PlannedDeal[] = [];
  const products: PlannedProduct[] = [];
  const lineItems: PlannedLineItem[] = [];
  const contacts: PlannedContact[] = [];
  const mergedIntoExisting: MigrationPlan["mergedIntoExisting"] = [];

  const ownerMap = options.ownerMap ?? {};
  const ownersById = new Map(input.owners.map((o) => [o.id, o]));
  const dealsById = new Map(input.deals.map((d) => [d.id, d]));

  const resolveOwner = (hubspotOwnerId: string | null, hubspotId: string): string | null => {
    if (!hubspotOwnerId) return options.fallbackOwnerUserId;
    const owner = ownersById.get(hubspotOwnerId);
    if (!owner) {
      issues.push({
        code: "unknown_owner",
        hubspotId,
        message: `Eieren i HubSpot (${hubspotOwnerId}) finnes ikke i Leadgrid. Leadet settes på reserve-eieren.`,
        silentLoss: false,
      });
      return options.fallbackOwnerUserId;
    }
    if (owner.archived) {
      issues.push({
        code: "archived_owner",
        hubspotId,
        message: `Eieren ${owner.email} er deaktivert i HubSpot. Leadet settes på reserve-eieren.`,
        silentLoss: false,
      });
      return options.fallbackOwnerUserId;
    }
    return ownerMap[hubspotOwnerId] ?? options.fallbackOwnerUserId;
  };

  const resolveLifecycle = (raw: string | null | undefined, hubspotId: string): LifecycleStage => {
    const { stage, matched } = mapLifecycleStage(raw);
    if (!matched) {
      issues.push({
        code: "custom_lifecycle_stage",
        hubspotId,
        message: `Livssyklusstadiet «${raw}» er egendefinert i HubSpot og finnes ikke i Leadgrid. Settes til «other» så det kan ryddes etterpå.`,
        silentLoss: false,
      });
    }
    return stage;
  };

  const noteCalculated = (obj: HubSpotObject) => {
    const skipped = Object.keys(obj.properties).filter(isCalculated);
    if (skipped.length > 0) {
      issues.push({
        code: "calculated_property_skipped",
        hubspotId: obj.id,
        message: `${skipped.length} beregnet felt fra HubSpot tas ikke med (${skipped.join(", ")}). De er utledet av HubSpot-logikk.`,
        silentLoss: false,
      });
    }
  };

  // ── Katalogen ────────────────────────────────────────────────────────────
  for (const product of input.products ?? []) {
    const billing = mapBillingFrequency(product.properties.recurringbillingfrequency);
    if (!billing.matched) {
      issues.push({
        code: "unsupported_billing_frequency",
        hubspotId: product.id,
        message: `Faktureringsfrekvensen «${product.properties.recurringbillingfrequency}» finnes ikke i Leadgrid. Settes til årlig.`,
        silentLoss: false,
      });
    }
    products.push({
      hubspotId: product.id,
      sku: product.properties.hs_sku ?? null,
      name: product.properties.name ?? `HubSpot-produkt ${product.id}`,
      description: product.properties.description ?? null,
      unitPrice: toNumber(product.properties.price) ?? 0,
      billingFrequency: billing.frequency,
    });
  }

  const lineItemsById = new Map((input.lineItems ?? []).map((l) => [l.id, l]));

  /** Samme formel som net_total i migrasjon 0647, avrundet likt. */
  const netTotalOf = (quantity: number, unitPrice: number, pct: number, amount: number) =>
    Math.round(Math.max(quantity * unitPrice * (1 - pct / 100) - amount, 0) * 100) / 100;

  const addLineItems = (dealId: string, customerHubspotId: string) => {
    for (const lineId of input.dealToLineItems?.[dealId] ?? []) {
      const line = lineItemsById.get(lineId);
      if (!line) continue;
      const billing = mapBillingFrequency(line.properties.recurringbillingfrequency);
      if (!billing.matched) {
        issues.push({
          code: "unsupported_billing_frequency",
          hubspotId: line.id,
          message: `Faktureringsfrekvensen «${line.properties.recurringbillingfrequency}» finnes ikke i Leadgrid. Settes til årlig.`,
          silentLoss: false,
        });
      }
      const quantity = toNumber(line.properties.quantity) ?? 1;
      const unitPrice = toNumber(line.properties.price) ?? 0;
      const discountPercent = toNumber(line.properties.hs_discount_percentage) ?? 0;
      const discountAmount = toNumber(line.properties.discount) ?? 0;
      lineItems.push({
        hubspotId: line.id,
        dealHubspotId: dealId,
        customerHubspotId,
        productHubspotId: line.properties.hs_product_id ?? null,
        name: line.properties.name ?? `Linje ${line.id}`,
        quantity,
        unitPrice,
        discountPercent,
        discountAmount,
        billingFrequency: billing.frequency,
        recurringStartDate: line.properties.hs_recurring_billing_start_date ?? null,
        netTotal: netTotalOf(quantity, unitPrice, discountPercent, discountAmount),
      });
    }
  };

  // ── Selskaper blir kunder ────────────────────────────────────────────────
  for (const company of input.companies) {
    noteCalculated(company);
    const dealIds = input.companyToDeals[company.id] ?? [];
    const companyDeals = dealIds.map((id) => dealsById.get(id)).filter((d): d is HubSpotObject => Boolean(d));

    // Alle avtalene blir med (mig 0650). Den største blir primærsalget,
    // fordi det er den crm_customers sine flate deal-felt speiler — og det
    // er de feltene pipeline, forecast og scoring fortsatt leser.
    const sorted = [...companyDeals].sort(
      (a, b) => (toNumber(b.properties.amount) ?? 0) - (toNumber(a.properties.amount) ?? 0),
    );
    const primaryDeal = sorted[0] ?? null;

    for (const deal of sorted) {
      addLineItems(deal.id, company.id);
      const dealMapped = mapPipelineStage(deal.properties.dealstage ?? null, input.pipelines);
      if (!dealMapped.matched) {
        issues.push({
          code: "unknown_pipeline_stage",
          hubspotId: deal.id,
          message: `Stagen «${deal.properties.dealstage}» finnes ikke i pipelinen vi hentet. Avtalen settes på «new».`,
          silentLoss: false,
        });
      }
      if (toNumber(deal.properties.amount) == null) {
        issues.push({
          code: "missing_deal_amount",
          hubspotId: deal.id,
          message: `Avtalen «${deal.properties.dealname ?? deal.id}» mangler beløp i HubSpot.`,
          silentLoss: false,
        });
      }
      deals.push({
        hubspotId: deal.id,
        customerHubspotId: company.id,
        title: deal.properties.dealname ?? `HubSpot-avtale ${deal.id}`,
        pipelineStage: dealMapped.stage,
        dealAmount: toNumber(deal.properties.amount),
        dealProbability:
          dealMapped.probability == null ? null : Math.round(dealMapped.probability * 100),
        expectedCloseDate: deal.properties.closedate ?? null,
        ownerUserId: resolveOwner(deal.properties.hubspot_owner_id ?? null, deal.id),
        isPrimary: deal.id === primaryDeal?.id,
        raw: { object: "deal", ...deal },
      });
    }

    const mapped = mapPipelineStage(primaryDeal?.properties.dealstage ?? null, input.pipelines);

    customers.push({
      hubspotId: company.id,
      source: "company",
      name: company.properties.name ?? `HubSpot-selskap ${company.id}`,
      email: null,
      phone: company.properties.phone ?? null,
      company: company.properties.name ?? null,
      city: company.properties.city ?? null,
      postalCode: company.properties.zip ?? null,
      country: company.properties.country ?? null,
      websiteUrl: company.properties.domain ?? null,
      employeeCountEstimate: toNumber(company.properties.numberofemployees),
      pipelineStage: mapped.stage,
      lifecycleStage: resolveLifecycle(company.properties.lifecyclestage, company.id),
      ownerUserId: resolveOwner(company.properties.hubspot_owner_id ?? null, company.id),
      dealAmount: primaryDeal ? toNumber(primaryDeal.properties.amount) : null,
      expectedCloseDate: primaryDeal?.properties.closedate ?? null,
      dealProbability: mapped.probability == null ? null : Math.round(mapped.probability * 100),
      raw: { object: "company", ...company },
    });
  }

  // ── Kontakter ────────────────────────────────────────────────────────────
  const seenEmails = new Map<string, string>();

  for (const contact of input.contacts) {
    noteCalculated(contact);
    const email = contact.properties.email?.trim().toLowerCase() || null;
    const phone = contact.properties.phone ?? null;

    if (!email && !phone) {
      issues.push({
        code: "no_dedupe_key",
        hubspotId: contact.id,
        message: `«${contactDisplayName(contact.properties)}» har verken e-post eller telefon. Dedup må skje på navn, som er usikkert.`,
        silentLoss: false,
      });
    }

    if (email) {
      const existing = seenEmails.get(email);
      if (existing) {
        mergedIntoExisting.push({ hubspotId: contact.id, mergesWith: existing, on: "email" });
        issues.push({
          code: "duplicate_email",
          hubspotId: contact.id,
          message: `Samme e-post som HubSpot-kontakt ${existing}. Radene slås sammen i stedet for å bli to leads.`,
          silentLoss: false,
        });
        continue;
      }
      seenEmails.set(email, contact.id);
    }

    const links = input.contactToCompany[contact.id] ?? [];

    if (links.length === 0) {
      // Kastes ikke: kontakten blir sin egen kunde-rad slik at e-post og
      // telefon beholdes. leadgrid_customer_contacts krever et selskap.
      issues.push({
        code: "contact_without_company",
        hubspotId: contact.id,
        message: `«${contactDisplayName(contact.properties)}» har ingen bedrift i HubSpot. Blir opprettet som eget lead, ikke som kontaktperson.`,
        silentLoss: false,
      });
      customers.push({
        hubspotId: contact.id,
        source: "contact_without_company",
        name: contactDisplayName(contact.properties),
        email,
        phone,
        company: null,
        city: null,
        postalCode: null,
        country: null,
        websiteUrl: null,
        employeeCountEstimate: null,
        pipelineStage: "new",
        lifecycleStage: resolveLifecycle(contact.properties.lifecyclestage, contact.id),
        ownerUserId: resolveOwner(contact.properties.hubspot_owner_id ?? null, contact.id),
        dealAmount: null,
        expectedCloseDate: null,
        dealProbability: null,
        raw: { object: "contact", ...contact },
      });
      continue;
    }

    const primary = links.find((l) => l.associationTypes.some((t) => t.label === "Primary")) ?? links[0];
    const labels = primary.associationTypes.map((t) => t.label).filter((l): l is string => Boolean(l));

    if (links.length > 1) {
      const extras = links.filter((l) => l !== primary).map((l) => l.toObjectId);
      issues.push({
        code: "extra_company_links_dropped",
        hubspotId: contact.id,
        message: `Knyttet til ${links.length} bedrifter i HubSpot. Leadgrid lagrer én, så koblingen til ${extras.join(", ")} blir ikke med.`,
        silentLoss: true,
      });
    }

    if (email || phone) {
      issues.push({
        code: "contact_without_company",
        hubspotId: contact.id,
        message: `Kontaktpersoner i Leadgrid har ingen kolonne for e-post eller telefon, så ${
          [email && "e-post", phone && "telefon"].filter(Boolean).join(" og ")
        } for «${contactDisplayName(contact.properties)}» har ingen plass i dag.`,
        silentLoss: true,
      });
    }

    // Resolves selv om verdien ikke lagres: en deaktivert eller ukjent eier på
    // kontakten skal rapporteres, ikke passere i stillhet.
    const contactOwner = resolveOwner(contact.properties.hubspot_owner_id ?? null, contact.id);

    contacts.push({
      hubspotId: contact.id,
      customerHubspotId: primary.toObjectId,
      ownerWithoutColumn: contactOwner,
      name: contactDisplayName(contact.properties),
      role: contact.properties.jobtitle ?? labels.find((l) => l !== "Primary") ?? null,
      email,
      phone,
    });
  }

  // ── Aktiviteter ──────────────────────────────────────────────────────────
  const supported: Record<string, string> = { MEETING: "meeting_scheduled", NOTE: "note_added", TASK: "follow_up_set" };
  for (const engagement of input.engagements) {
    if (!supported[engagement.type]) {
      issues.push({
        code: "activity_type_unsupported",
        hubspotId: engagement.id,
        message: `Aktiviteten «${engagement.type}» har ingen tilsvarende type i Leadgrid, så historikken blir ikke med.`,
        silentLoss: true,
      });
    }
  }

  return {
    customers,
    deals,
    contacts,
    products,
    lineItems,
    mergedIntoExisting,
    issues,
    counts: {
      customers: customers.length,
      deals: deals.length,
      contacts: contacts.length,
      merged: mergedIntoExisting.length,
      products: products.length,
      lineItems: lineItems.length,
      issues: issues.length,
      silentLossPrevented: issues.filter((i) => i.silentLoss).length,
    },
  };
}

/**
 * editingMarketplaceStrings.ts
 *
 * Tospråklig (no/en) strengtabell for redigerings-marketplace. Fotograf-siden
 * kjører 'no'; utenlandske vendors ser 'en' på vendor-flatene. Backend
 * returnerer stabile nøkler (compliance badges/missing/pilarer) som
 * lokaliseres her.
 */

export type Locale = "no" | "en";

/** Velg locale fra brukerens profil (utenlandsk vendor -> engelsk). */
export function localeForVendor(opts: {
  isForeign?: boolean | null;
  country?: string | null;
}): Locale {
  if (opts.isForeign) return "en";
  if (opts.country && opts.country.toUpperCase() !== "NO") return "en";
  return "no";
}

type Dict = Record<string, { no: string; en: string }>;

const STRINGS: Dict = {
  // Hero
  hero_title: { no: "Har du mye å gjøre om dagen?", en: "A lot on your plate right now?" },
  hero_body: {
    no: "Vi ser på kalenderen din at du har mye å gjøre. Hyr et team som kan gjøre det enklere for deg.",
    en: "Your calendar looks busy. Hire a team to take the load off.",
  },
  hero_secure_note: {
    no: "Disse selskapene er en del av Creatorhub, og alle viktige avtaler er signert for sikker håndtering.",
    en: "These companies are part of Creatorhub, and all key agreements are signed for secure handling.",
  },
  see_available: { no: "Se tilgjengelige bedrifter", en: "See available companies" },
  create_request: { no: "Opprett forespørsel", en: "Create request" },

  // Vendor list
  available_companies: { no: "Tilgjengelige bedrifter – Foto og video", en: "Available companies – Photo & video" },
  filter: { no: "Filter", en: "Filter" },
  see_profile: { no: "Se profil", en: "See profile" },
  send_request: { no: "Send forespørsel", en: "Send request" },
  show_more: { no: "Vis flere bedrifter", en: "Show more companies" },
  available_now: { no: "Tilgjengelig nå", en: "Available now" },
  turnaround_days: { no: "dagers leveringstid", en: "day turnaround" },
  no_vendors: {
    no: "Ingen godkjente redigeringsbedrifter er tilgjengelige ennå.",
    en: "No approved editing companies are available yet.",
  },

  // How it works
  how_it_works: { no: "Slik fungerer det", en: "How it works" },
  step1_title: { no: "Velg vendor", en: "Choose a vendor" },
  step1_body: { no: "Finn den rette bedriften for oppdraget ditt.", en: "Find the right company for your job." },
  step2_title: { no: "Overfør filer via B2 Backblaze", en: "Transfer files via B2 Backblaze" },
  step2_body: { no: "Sikker og enkel filoverføring i Creatorhub.", en: "Secure, simple file transfer inside Creatorhub." },
  step3_title: { no: "Vendor redigerer innholdet", en: "Vendor edits the content" },
  step3_body: { no: "Profesjonelt team jobber med innholdet.", en: "A professional team works on the content." },
  step4_title: { no: "Resultatet vises i Showcase", en: "Result appears in Showcase" },
  step4_body: { no: "Ferdig redigert innhold lastes opp.", en: "Finished, edited content is uploaded." },
  step5_title: { no: "Du godkjenner", en: "You approve" },
  step5_body: { no: "Se gjennom og godkjenn resultatet.", en: "Review and approve the result." },
  step6_title: { no: "Lever til kunde", en: "Deliver to client" },
  step6_body: { no: "Lever direkte til kunden fra Showcase.", en: "Deliver directly to the client from Showcase." },

  // Showcase ready
  showcase_ready: { no: "Showcase – klar for godkjenning", en: "Showcase – ready for approval" },
  see_all: { no: "Se alle", en: "See all" },
  approve_and_deliver: { no: "Godkjenn og lever", en: "Approve and deliver" },

  // Security & integration strip
  sec_handling: { no: "Sikker filhåndtering", en: "Secure file handling" },
  sec_handling_sub: { no: "Ende-til-ende-kryptering og tilgangskontroll.", en: "End-to-end encryption and access control." },
  sec_b2: { no: "Overføring via B2 Backblaze", en: "Transfer via B2 Backblaze" },
  sec_b2_sub: { no: "Rask og pålitelig skyoverføring.", en: "Fast, reliable cloud transfer." },
  sec_agreements: { no: "Signerte avtaler", en: "Signed agreements" },
  sec_agreements_sub: { no: "Alle avtaler er signert og lagret sikkert.", en: "All agreements signed and stored securely." },
  sec_delivery: { no: "Trygg leveranse", en: "Safe delivery" },
  sec_delivery_sub: { no: "Sikker prosess fra start til levering.", en: "Secure process from start to delivery." },

  // Compliance badges (backend keys)
  "badge.quality_verified": { no: "Creatorhub Quality Verified", en: "Creatorhub Quality Verified" },
  "badge.secure_storage_b2": { no: "Sikker lagring: B2-godkjent", en: "Secure storage: B2-approved" },
  "badge.dpa_signed": { no: "Databehandleravtale signert", en: "Data processing agreement signed" },
  "badge.showcase_flow": { no: "Showcase-godkjent flyt", en: "Showcase-approved flow" },
  "badge.international_extra_gdpr": {
    no: "Internasjonal vendor – ekstra GDPR-kontroll aktivert",
    en: "International vendor – extra GDPR controls active",
  },
  "badge.international_eea": { no: "Internasjonal vendor (EØS)", en: "International vendor (EEA)" },

  // Compliance pillars
  "pillar.quality": { no: "Kvalitet", en: "Quality" },
  "pillar.storage": { no: "Lagring", en: "Storage" },
  "pillar.gdpr": { no: "GDPR", en: "GDPR" },
  "pillar.delivery": { no: "Leveranse", en: "Delivery" },
  "pillar.subcontractors": { no: "Underleverandører", en: "Subcontractors" },
  "pillar.deletion": { no: "Sletting", en: "Deletion" },

  // Compliance status / acceptance
  vendor_compliance_status: { no: "Vendor Compliance-status", en: "Vendor Compliance status" },
  status_approved: { no: "Godkjent", en: "Approved" },
  status_pending: { no: "Venter", en: "Pending" },
  status_b2_compatible: { no: "B2 Backblaze-kompatibel", en: "B2 Backblaze-compatible" },
  status_dpa_signed: { no: "Databehandleravtale signert", en: "Data processing agreement signed" },
  status_showcase_flow: { no: "Showcase-godkjent flyt", en: "Showcase-approved flow" },
  status_subcontractors_no: { no: "Ikke tillatt uten godkjenning", en: "Not allowed without approval" },
  status_deletion_auto: { no: "Automatisk etter leveranse", en: "Automatic after delivery" },
  compliance_profile_note: {
    no: "Denne vendoren følger Creatorhub sine krav til kvalitet, lagring, GDPR og leveranse.",
    en: "This vendor follows Creatorhub's requirements for quality, storage, GDPR and delivery.",
  },
};

export function t(key: string, locale: Locale = "no"): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[locale] ?? entry.no;
}

/** Lokaliser en backend-badge-nøkkel ("quality_verified" -> tekst). */
export function badgeLabel(key: string, locale: Locale = "no"): string {
  return t(`badge.${key}`, locale);
}

export function pillarLabel(key: string, locale: Locale = "no"): string {
  return t(`pillar.${key}`, locale);
}

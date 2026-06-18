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

  // ── Vendor workspace ──
  ws_title: { no: "Redigeringsoppdrag", en: "Editing jobs" },
  ws_tab_jobs: { no: "Oppdrag", en: "Jobs" },
  ws_tab_compliance: { no: "Compliance", en: "Compliance" },
  ws_tab_catalog: { no: "Priskatalog", en: "Price catalog" },
  ws_tab_communication: { no: "Kommunikasjon", en: "Communication" },
  ws_no_jobs: { no: "Ingen oppdrag ennå.", en: "No jobs yet." },
  ws_incoming: { no: "Innkommende oppdrag", en: "Incoming jobs" },
  ws_brief: { no: "Brief", en: "Brief" },
  ws_amount: { no: "Beløp", en: "Amount" },
  ws_files: { no: "Filer", en: "Files" },
  ws_accept: { no: "Aksepter", en: "Accept" },
  ws_decline: { no: "Avslå", en: "Decline" },
  ws_upload_files: { no: "Last opp filer", en: "Upload files" },
  ws_uploading: { no: "Laster opp…", en: "Uploading…" },
  ws_mark_delivered: { no: "Marker som levert", en: "Mark as delivered" },
  ws_transferring: { no: "Overfører til fotograf…", en: "Transferring to photographer…" },
  ws_upload_hint: {
    no: "Filer lastes opp sikkert til Creatorhub og overføres til fotografens B2 ved levering.",
    en: "Files upload securely to Creatorhub and transfer to the photographer's B2 on delivery.",
  },

  // Job statuses
  "jobstatus.draft": { no: "Utkast", en: "Draft" },
  "jobstatus.requested": { no: "Forespurt", en: "Requested" },
  "jobstatus.accepted": { no: "Akseptert", en: "Accepted" },
  "jobstatus.in_progress": { no: "Under arbeid", en: "In progress" },
  "jobstatus.delivered": { no: "Levert", en: "Delivered" },
  "jobstatus.approved": { no: "Godkjent", en: "Approved" },
  "jobstatus.declined": { no: "Avslått", en: "Declined" },
  "jobstatus.cancelled": { no: "Avbrutt", en: "Cancelled" },
  "jobstatus.delivered_to_client": { no: "Levert til kunde", en: "Delivered to client" },

  // Compliance acceptance
  comp_title: { no: "Creatorhub Vendor Standard", en: "Creatorhub Vendor Standard" },
  comp_intro: {
    no: "For å tilby redigeringstjenester gjennom Creatorhub må du godkjenne og følge kravene til kvalitet, lagring, GDPR og leveranse.",
    en: "To offer editing services through Creatorhub you must accept and follow the requirements for quality, storage, GDPR and delivery.",
  },
  comp_non_eea_notice: {
    no: "Bedriften din er utenfor EØS. Ekstra GDPR-kontroll kreves: Standard Contractual Clauses (SCC) og Transfer Impact Assessment (TIA).",
    en: "Your company is outside the EEA. Extra GDPR controls are required: Standard Contractual Clauses (SCC) and a Transfer Impact Assessment (TIA).",
  },
  comp_accept_all: { no: "Aksepter og fortsett", en: "Accept and continue" },
  comp_must_accept: { no: "Du må huke av alle kravene for å fortsette.", en: "You must check all requirements to continue." },
  comp_cleared: { no: "Du oppfyller alle Creatorhub sine krav.", en: "You meet all of Creatorhub's requirements." },
  comp_missing_title: { no: "Mangler:", en: "Missing:" },

  // Requirement labels + descriptions
  "req.standard": { no: "Jeg godtar Creatorhub Vendor Standard", en: "I accept the Creatorhub Vendor Standard" },
  "req.quality": {
    no: "Kvalitet: leverer etter Creatorhubs kvalitetsstandard, maks revisjoner pr oppdrag, fotograf godkjenner før kunde.",
    en: "Quality: deliver to Creatorhub's quality standard, max revisions per job, photographer approves before the client.",
  },
  "req.storage": {
    no: "Lagring: kun B2-godkjent overføring, tilgang kun til oppdragets filer, ingen Drive/Dropbox/WeTransfer, sletting etter levering.",
    en: "Storage: only B2-approved transfer, access limited to the job's files, no Drive/Dropbox/WeTransfer, deletion after delivery.",
  },
  "req.gdpr": {
    no: "GDPR: konfidensiell behandling, kun til redigering, logging av tilgang, avviksrutine.",
    en: "GDPR: confidential handling, editing purpose only, access logging, breach procedure.",
  },
  "req.delivery": {
    no: "Leveranse: alt går tilbake til Creatorhub Showcase — jeg leverer aldri direkte til sluttkunden.",
    en: "Delivery: everything goes back to Creatorhub Showcase — I never deliver directly to the end client.",
  },
  "req.payment": {
    no: "Betaling: utbetaling skjer via Creatorhub (Stripe Connect, eller PayPal for utenlandske vendors) og frigis FØRST når fotografen har godkjent leveransen. Creatorhub tar et plattformgebyr av oppdraget. Vendor-gebyr kan være redusert/utsatt under prototype-testing.",
    en: "Payment: payout is made through Creatorhub (Stripe Connect, or PayPal for international vendors) and is released ONLY after the photographer approves the delivery. Creatorhub takes a platform fee on the job. The vendor fee may be reduced/deferred during prototype testing.",
  },
  "req.dpa": { no: "Jeg signerer databehandleravtale (DPA).", en: "I sign the Data Processing Agreement (DPA)." },
  "req.nda": { no: "Jeg signerer konfidensialitetsavtale (NDA).", en: "I sign the confidentiality agreement (NDA)." },
  "req.scc": { no: "Jeg signerer Standard Contractual Clauses (SCC).", en: "I sign the Standard Contractual Clauses (SCC)." },
  "req.tia": { no: "Jeg bekrefter fullført Transfer Impact Assessment (TIA).", en: "I confirm a completed Transfer Impact Assessment (TIA)." },
  "req.no_subcontractors": {
    no: "Ingen underleverandører uten skriftlig godkjenning.",
    en: "No subcontractors without written approval.",
  },
  "req.no_portfolio_use": {
    no: "Innholdet brukes ikke i egen portefølje, markedsføring, opplæring eller AI-trening uten skriftlig samtykke.",
    en: "Content is not used in my own portfolio, marketing, training or AI training without written consent.",
  },

  // Communication tab
  comm_placeholder: {
    no: "Kommunikasjon med fotograf åpnes når et oppdrag er akseptert.",
    en: "Communication with the photographer opens once a job is accepted.",
  },

  // ── Request dialog (fotograf bestiller) ──
  rq_title: { no: "Send forespørsel", en: "Send request" },
  rq_services: { no: "Velg tjenester", en: "Select services" },
  rq_brief: { no: "Brief / instruksjoner", en: "Brief / instructions" },
  rq_project: { no: "Prosjekt (valgfritt)", en: "Project (optional)" },
  rq_max_revisions: { no: "Maks revisjoner", en: "Max revisions" },
  rq_total: { no: "Sum", en: "Total" },
  rq_payment_method: { no: "Betalingsmåte", en: "Payment method" },
  rq_pay_stripe: { no: "Stripe (kort)", en: "Stripe (card)" },
  rq_pay_invoice: { no: "Faktura", en: "Invoice" },
  rq_cost_model: { no: "Kalkyle", en: "Calculation" },
  rq_fixed_fee: { no: "Fast honorar (kostnad av-toppen)", en: "Fixed fee (cost off-the-top)" },
  rq_revenue_share: { no: "Prosentandel av inntekt", en: "Revenue share (%)" },
  rq_share_pct: { no: "Andel %", en: "Share %" },
  rq_send: { no: "Send forespørsel", en: "Send request" },
  rq_sending: { no: "Sender…", en: "Sending…" },
  rq_escrow_note: {
    no: "Betaling holdes sikkert og frigis til vendor først når du har godkjent leveransen.",
    en: "Payment is held securely and released to the vendor only after you approve the delivery.",
  },
  rq_select_at_least_one: { no: "Velg minst én tjeneste.", en: "Select at least one service." },
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

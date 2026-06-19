/**
 * editing-compliance.ts
 *
 * Creatorhub Vendor Standard — compliance-logikk for eksterne redigeringsvendors.
 * Fire pilarer (Kvalitet, Lagring, GDPR, Leveranse) + ekstra kontroll for
 * vendors utenfor EØS (SCC + Transfer Impact Assessment).
 *
 * Ren logikk (ingen DB/IO) — kalles fra editing-jobs-routes og vendor-onboarding.
 */

export const COMPLIANCE_VERSION = "2026-06-18";

// EØS = EU-27 + Island, Liechtenstein, Norge (ISO 3166-1 alpha-2)
const EEA_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "IS", "LI", "NO",
]);

export function isEeaCountry(country: string | null | undefined): boolean {
  if (!country) return true; // default NO/ukjent behandles som EØS til annet er valgt
  return EEA_COUNTRIES.has(country.trim().toUpperCase());
}

/** Profil-felt vi trenger for å vurdere compliance (subset av vendor_onboarding_profiles). */
export interface ComplianceProfile {
  is_foreign?: boolean | null;
  country?: string | null;
  is_eea?: boolean | null;
  compliance_accepted?: boolean | null;
  compliance_quality_status?: string | null;
  compliance_storage_status?: string | null;
  compliance_gdpr_status?: string | null;
  compliance_delivery_status?: string | null;
  dpa_signed?: boolean | null;
  nda_signed?: boolean | null;
  scc_signed?: boolean | null;
  tia_completed?: boolean | null;
  subcontractors_allowed?: boolean | null;
  portfolio_use_allowed?: boolean | null;
  dpa_document_key?: string | null; // ekte DPA-artefakt — dpa_signed-badge gates på denne
  // Partnerprogram-felt (samme kilde for BÅDE /me og discovery — ingen proxy-divergens)
  portfolio_submitted?: boolean | null;
  payment_connected?: boolean | null;
  rating?: number | null;
  review_count?: number | null;
  turnaround_days?: number | null;
}

/** Partnernivå — auto-derivert fra compliance + omdømme. */
export type VendorTier = "registered" | "verified" | "certified" | "premium";

export interface ComplianceSummary {
  isForeign: boolean;
  isEea: boolean;
  isInternational: boolean; // utenlandsk
  requiresExtraGdpr: boolean; // utenfor EØS
  cleared: boolean; // alle obligatoriske krav oppfylt -> kan vises/akseptere oppdrag
  tier: VendorTier; // partnernivå (auto)
  verificationPercent: number; // 0-100, andel oppfylte krav (samme på /me og portal)
  satisfiedCount: number;
  requiredCount: number;
  // Pilar-statuser. Etiketter lokaliseres på frontend fra pilar-nøkkelen
  // (no for fotograf-siden, en for utenlandske vendors).
  pillars: {
    quality: { status: string };
    storage: { status: string };
    gdpr: { status: string };
    delivery: { status: string };
    subcontractors: { status: string };
    deletion: { status: string };
  };
  badges: string[]; // stabile nøkler — frontend lokaliserer
  missing: string[]; // stabile nøkler for manglende krav — frontend lokaliserer
}

function ok(v: unknown): boolean {
  return v === true || v === "approved";
}

/** Er ett enkelt krav (fra requiredAcceptances) oppfylt for profilen? */
function acceptanceSatisfied(key: string, p: ComplianceProfile): boolean {
  switch (key) {
    case "standard": return !!p.compliance_accepted;
    case "quality": return ok(p.compliance_quality_status);
    case "storage": return ok(p.compliance_storage_status);
    case "gdpr": return ok(p.compliance_gdpr_status);
    case "delivery": return ok(p.compliance_delivery_status);
    case "payment": return !!p.payment_connected;
    case "dpa": return !!p.dpa_signed;
    case "nda": return !!p.nda_signed;
    case "no_subcontractors": return !!p.compliance_accepted; // del av standarden
    case "no_portfolio_use": return !!p.compliance_accepted; // del av standarden
    case "scc": return !!p.scc_signed;
    case "tia": return !!p.tia_completed;
    default: return false;
  }
}

/** Auto-derivert partnernivå. cleared kreves for Verified+; omdømme løfter videre. */
function deriveTier(x: {
  cleared: boolean;
  portfolioApproved: boolean;
  rating: number;
  reviews: number;
  turnaround: number;
}): VendorTier {
  if (!x.cleared) return "registered";
  let tier: VendorTier = "verified";
  if (x.portfolioApproved && x.rating >= 4.3 && x.reviews >= 3) tier = "certified";
  if (x.portfolioApproved && x.rating >= 4.7 && x.reviews >= 10 && x.turnaround <= 3) tier = "premium";
  return tier;
}

/**
 * Bygg compliance-status-sammendrag for visning + gating.
 * `cleared` styrer om vendoren får vises i discovery og akseptere oppdrag.
 */
export function buildComplianceSummary(p: ComplianceProfile): ComplianceSummary {
  const isForeign = !!p.is_foreign;
  const isEea = p.is_eea ?? isEeaCountry(p.country);
  const requiresExtraGdpr = !isEea;

  const quality = ok(p.compliance_quality_status);
  const storage = ok(p.compliance_storage_status);
  const gdpr = ok(p.compliance_gdpr_status) && !!p.dpa_signed && !!p.nda_signed;
  const delivery = ok(p.compliance_delivery_status);
  const extraGdprOk = !requiresExtraGdpr || (!!p.scc_signed && !!p.tia_completed);

  const cleared =
    !!p.compliance_accepted && quality && storage && gdpr && delivery && extraGdprOk;

  // Verifiserings-% + tier — SAMME beregning på /me og discovery (én sannhetskilde).
  const required = requiredAcceptances(isForeign, isEea);
  const satisfiedCount = required.filter((k) => acceptanceSatisfied(k, p)).length;
  const verificationPercent = required.length
    ? Math.round((satisfiedCount / required.length) * 100)
    : 0;
  const tier = deriveTier({
    cleared,
    portfolioApproved: !!p.portfolio_submitted,
    rating: p.rating != null ? Number(p.rating) : 0,
    reviews: p.review_count != null ? Number(p.review_count) : 0,
    turnaround: p.turnaround_days != null ? Number(p.turnaround_days) : 99,
  });

  const missing: string[] = [];
  if (!p.compliance_accepted) missing.push("accept_standard");
  if (!quality) missing.push("quality");
  if (!storage) missing.push("storage");
  if (!ok(p.compliance_gdpr_status)) missing.push("gdpr_pillar");
  if (!p.dpa_signed) missing.push("dpa");
  if (!p.nda_signed) missing.push("nda");
  if (!delivery) missing.push("delivery");
  if (requiresExtraGdpr && !p.scc_signed) missing.push("scc");
  if (requiresExtraGdpr && !p.tia_completed) missing.push("tia");

  const badges: string[] = [];
  if (quality) badges.push("quality_verified");
  if (storage) badges.push("secure_storage_b2");
  // DPA-badge KUN ved ekte artefakt (ingen compliance-fiksjon for selv-attestert boolean).
  if (gdpr && !!p.dpa_document_key) badges.push("dpa_signed");
  if (delivery) badges.push("showcase_flow");
  if (isForeign) {
    badges.push(requiresExtraGdpr ? "international_extra_gdpr" : "international_eea");
  }

  return {
    isForeign,
    isEea,
    isInternational: isForeign,
    requiresExtraGdpr,
    cleared,
    tier,
    verificationPercent,
    satisfiedCount,
    requiredCount: required.length,
    pillars: {
      quality: { status: quality ? "approved" : "pending" },
      storage: { status: storage ? "approved" : "pending" },
      gdpr: { status: gdpr ? "approved" : "pending" },
      delivery: { status: delivery ? "approved" : "pending" },
      subcontractors: { status: p.subcontractors_allowed ? "allowed" : "not_allowed" },
      deletion: { status: "automatic" },
    },
    badges,
    missing,
  };
}

/** Krav-listen en vendor må akseptere (utvides for tredjeland). */
export function requiredAcceptances(isForeign: boolean, isEea: boolean): string[] {
  const base = [
    "standard",
    "quality",
    "storage",
    "gdpr",
    "delivery",
    "payment",
    "dpa",
    "nda",
    "no_subcontractors",
    "no_portfolio_use",
  ];
  if (isForeign && !isEea) {
    base.push("scc", "tia");
  }
  return base;
}

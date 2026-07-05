// =============================================================================
// Bygger felt-feedback-edits fra et bootstrap-resultat + produsentens
// eventuelle korreksjon av forretningsmodell — for POST til
// /api/role-room/agent/field-feedback (Lag 0 i lærings-loopen).
//
// Ren, testbar: ingen React/DOM, ingen nettverk. Dialogen henter
// produsentens businessModel-valg og kaller denne før capture-POST.
//
// GDPR: vi sender kun de fem IKKE-personlige klassifiseringsfeltene (backend
// har en tilsvarende allowlist). Ingen selskapsnavn/adresse/kontakt.
// =============================================================================

export type FieldFeedbackAction = "accepted" | "edited" | "cleared";

export interface RoleRoomAgentFieldFeedbackEdit {
  fieldPath: string;
  action: FieldFeedbackAction;
  aiValue: string | null;
  finalValue: string | null;
  naceCode: string | null;
  businessModel: string | null;
  geoScope: string | null;
  sourceChain: string[] | null;
  confidence: number | null;
}

/** Minimal strukturell form av bootstrap-resultatet vi trenger her. */
export interface FeedbackSourceResult {
  companyProfile?: {
    industry?: string | null;
    subIndustry?: string | null;
    businessModel?: string | null;
    contentCategory?: string | null;
    productionApproach?: string | null;
  } | null;
  fieldMetadata?: Record<
    string,
    { confidence?: number; rationale?: string; sourceChain?: string[] } | undefined
  > | null;
  brregCompany?: { industryCode?: { code?: string | null } | null } | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Bygg edits for de fem klassifiseringsfeltene. Alle merkes 'accepted' unntatt
 * businessModel, som merkes 'edited' hvis produsenten valgte en annen modell
 * enn AI-en foreslo. `chosenBusinessModel` er produsentens valg (eller null =
 * uendret). NACE-koden hentes fra brregCompany.industryCode.code.
 */
export function buildClassificationFeedbackEdits(
  result: FeedbackSourceResult,
  chosenBusinessModel?: string | null,
): RoleRoomAgentFieldFeedbackEdit[] {
  const cp = result.companyProfile ?? {};
  const meta = result.fieldMetadata ?? {};
  const naceCode = text(result.brregCompany?.industryCode?.code);
  const metaFor = (path: string) => meta[path] ?? {};

  const edits: RoleRoomAgentFieldFeedbackEdit[] = [];
  const pushAccepted = (path: string, value: string | null): void => {
    edits.push({
      fieldPath: path,
      action: "accepted",
      aiValue: value,
      finalValue: value,
      naceCode,
      businessModel: text(cp.businessModel),
      geoScope: null,
      sourceChain: metaFor(path).sourceChain ?? null,
      confidence: typeof metaFor(path).confidence === "number" ? metaFor(path).confidence ?? null : null,
    });
  };

  pushAccepted("companyProfile.industry", text(cp.industry));
  pushAccepted("companyProfile.subIndustry", text(cp.subIndustry));
  pushAccepted("companyProfile.contentCategory", text(cp.contentCategory));
  pushAccepted("companyProfile.productionApproach", text(cp.productionApproach));

  // businessModel — den korrigerbare. 'edited' kun når produsenten faktisk
  // valgte noe annet enn AI-en foreslo.
  const aiModel = text(cp.businessModel);
  const chosen = text(chosenBusinessModel);
  const finalModel = chosen ?? aiModel;
  const wasEdited = Boolean(finalModel && aiModel && finalModel !== aiModel);
  const bmMeta = metaFor("companyProfile.businessModel");
  edits.push({
    fieldPath: "companyProfile.businessModel",
    action: wasEdited ? "edited" : "accepted",
    aiValue: aiModel,
    finalValue: finalModel,
    naceCode,
    businessModel: finalModel,
    geoScope: null,
    sourceChain: bmMeta.sourceChain ?? null,
    confidence: typeof bmMeta.confidence === "number" ? bmMeta.confidence ?? null : null,
  });

  return edits;
}

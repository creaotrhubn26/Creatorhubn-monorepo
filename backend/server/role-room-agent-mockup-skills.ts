import crypto from "node:crypto";

export const ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS = [
  {
    id: "resolve_mockup_brand",
    version: "1.0.0",
    dependsOn: [],
    instruction:
      "Lås mockupen til dokumenterte brand-signaler: kundenavn, logoressurs, palett, tone og visuell stil. Manglende brand-data skal markeres som limited; ikke presenter fallback-farger som verifiserte merkevarefarger.",
  },
  {
    id: "develop_campaign_system",
    version: "1.0.0",
    dependsOn: ["resolve_mockup_brand"],
    instruction:
      "Gjør researchen om til et sammenhengende kampanjesystem med mål, publikum, kreativ vinkel, bevisstrategi og en gjenkjennelig visuell idé. Systemet skal kunne gi flere tydelig forskjellige poster uten å endre dokumenterte fakta.",
  },
  {
    id: "select_post_concept",
    version: "1.0.0",
    dependsOn: ["resolve_mockup_brand", "develop_campaign_system"],
    instruction:
      "Velg ett konkret postkonsept fra researchens hovedbudskap, tilbud, målgruppe og CTA. Konseptet skal være sporbar til research og må ikke finne på produktpåstander.",
  },
  {
    id: "guard_claim_evidence",
    version: "1.0.0",
    dependsOn: ["select_post_concept"],
    instruction:
      "Knytt budskap, tilbud og proof points til konkrete felter fra researchresultatet. Uverifiserte produkt-, effekt- eller helsepåstander skal ikke gjøres sterkere i mockupen; ved manglende belegg skal utfallet markeres som limited.",
  },
  {
    id: "compose_visual_hierarchy",
    version: "1.0.0",
    dependsOn: ["resolve_mockup_brand", "select_post_concept"],
    instruction:
      "Lag et lesbart visuelt hierarki med dokumenterte brand-farger, tydelig tittel, støttebudskap og CTA. Velg tekstfarge etter faktisk kontrast mot bakgrunnen.",
  },
  {
    id: "expand_mockup_format",
    version: "1.0.0",
    dependsOn: ["select_post_concept", "compose_visual_hierarchy"],
    instruction:
      "Tilpass konseptet til valgt format. Et bilde har én flate, en karusell har 2–10 ordnede og unike slides, og en reel har et vertikalt 9:16-dokument med handlingsdrevet hook.",
  },
  {
    id: "compose_single_image_post",
    version: "1.0.0",
    dependsOn: [
      "develop_campaign_system",
      "compose_visual_hierarchy",
      "guard_claim_evidence",
    ],
    instruction:
      "For et enkeltbilde: velg én tydelig scene og én visuell hovedidé, som foto koblet til produktbevis, produktkort eller dokumentert proof point. Flaten skal ha ett blikkfang, lite tekst og en klar CTA – ikke bare være et generisk fargekort.",
  },
  {
    id: "compose_carousel_narrative",
    version: "1.0.0",
    dependsOn: [
      "develop_campaign_system",
      "compose_visual_hierarchy",
      "guard_claim_evidence",
    ],
    instruction:
      "For en karusell: bygg en ordnet historie med hook, kontekst eller problem, mekanisme, dokumentert bevis og CTA. Hver slide skal ha en egen rolle og komposisjon, samtidig som serien beholder samme logo, palett og typografiske rytme.",
  },
  {
    id: "compose_reel_storyboard",
    version: "1.0.0",
    dependsOn: [
      "develop_campaign_system",
      "compose_visual_hierarchy",
      "guard_claim_evidence",
    ],
    instruction:
      "For en reel: lag ett vertikalt storyboard med en umiddelbar hook, en konkret handling eller produktdemonstrasjon og et avsluttende neste steg. Bruk bare scener og påstander som kan spores til research eller tilgjengelige prosjektressurser.",
  },
  {
    id: "place_brand_assets",
    version: "1.0.0",
    dependsOn: ["resolve_mockup_brand", "compose_visual_hierarchy"],
    instruction:
      "Plasser kun en validert og materialisert logo i mockupen. Bevar logoens proporsjoner, bruk eksplisitt plassering og hold sikker avstand til tittel og CTA.",
  },
  {
    id: "audit_mockup_dataflow",
    version: "2.0.0",
    dependsOn: [
      "resolve_mockup_brand",
      "select_post_concept",
      "compose_visual_hierarchy",
      "expand_mockup_format",
      "place_brand_assets",
    ],
    instruction:
      "Før mockupen lagres: kontroller at alle relevante oppstrøms skills kjørte én gang, at riktig formatspesialist ble brukt, at slide-rekkefølge og roller er gyldige, at påstander er kildemerket, og at palett, kontrast og logo samsvarer med det redigerbare dokumentet.",
  },
] as const;

export type RoleRoomMockupSkillId =
  (typeof ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS)[number]["id"];
export type RoleRoomMockupSkillStatus = "ready" | "limited" | "failed";
export type RoleRoomMockupMediaType = "image" | "carousel" | "reel";

export interface RoleRoomMockupSkillCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface RoleRoomMockupSkillRun {
  id: RoleRoomMockupSkillId;
  version: string;
  status: RoleRoomMockupSkillStatus;
  executionKey: string;
  evidence: string[];
  limitations: string[];
  decisions: Record<string, unknown>;
  checks?: RoleRoomMockupSkillCheck[];
}

export interface RoleRoomBrandBasedMockupInput {
  companyName: string;
  title: string;
  caption: string;
  callToAction: string;
  concept: string;
  mediaType: RoleRoomMockupMediaType;
  slideCount?: number;
  primaryColor?: string | null;
  accentColor?: string | null;
  preferredTextColor?: string | null;
  logoDataUrl?: string | null;
  logoPlacement?: string | null;
  toneOfVoice?: string | null;
  visualStyle?: string | null;
  industry?: string | null;
  campaignObjective?: string | null;
  campaignAngle?: string | null;
  audience?: string[];
  offerings?: string[];
  painPoints?: string[];
  proofPoints?: string[];
  sourceEvidence?: string[];
  researchId?: string | null;
}

export type RoleRoomMockupSlideRole =
  "hook" | "context" | "mechanism" | "proof" | "cta";

export type RoleRoomMockupSlideLayout =
  | "photo-product-bridge"
  | "statement"
  | "problem-frame"
  | "process-card"
  | "proof-card"
  | "cta-lockup"
  | "vertical-story";

export interface RoleRoomMockupSlidePlan {
  ordinal: number;
  role: RoleRoomMockupSlideRole;
  layout: RoleRoomMockupSlideLayout;
  eyebrow: string;
  title: string;
  caption: string;
  callToAction: string;
  evidenceRef: string | null;
}

export interface RoleRoomMockupCampaignPlan {
  name: string;
  objective: string;
  angle: string;
  audience: string;
  proofStrategy: "research-evidence" | "research-copy-only";
  scene: "clinical" | "workplace";
  visualSystem:
    | "editorial-product-bridge"
    | "narrative-proof-series"
    | "vertical-product-story";
}

export interface RoleRoomBrandBasedMockupPlan {
  inputFingerprint: string;
  qualityStatus: RoleRoomMockupSkillStatus;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  accentTextColor: string;
  logoDataUrl: string | null;
  logoPlacement:
    "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  width: number;
  height: number;
  toneOfVoice: string | null;
  visualStyle: string | null;
  campaign: RoleRoomMockupCampaignPlan;
  slides: RoleRoomMockupSlidePlan[];
  skillRuns: RoleRoomMockupSkillRun[];
}

const VALID_PLACEMENTS = new Set([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center",
]);

function normalizedHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(candidate) ? candidate : null;
}

function clean(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function unique(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function claimEvidence(values: readonly string[]): string[] {
  return unique(values).filter(
    (value) => !/(?:^|\.)companyName$/i.test(value),
  );
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stable(entry)]),
  );
}

export function buildRoleRoomMockupFingerprint(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stable(input)))
    .digest("hex");
}

function definition(id: RoleRoomMockupSkillId) {
  const found = ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS.find(
    (item) => item.id === id,
  );
  if (!found) throw new Error(`unknown_role_room_mockup_skill:${id}`);
  return found;
}

function run(
  fingerprint: string,
  id: RoleRoomMockupSkillId,
  status: RoleRoomMockupSkillStatus,
  evidence: string[],
  limitations: string[],
  decisions: Record<string, unknown>,
  checks?: RoleRoomMockupSkillCheck[],
): RoleRoomMockupSkillRun {
  const skill = definition(id);
  return {
    id,
    version: skill.version,
    status,
    executionKey: `${fingerprint}:${id}:${skill.version}`,
    evidence: unique(evidence),
    limitations: unique(limitations),
    decisions,
    ...(checks ? { checks } : {}),
  };
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const values = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  return (
    0.2126 * channel(values[0]) +
    0.7152 * channel(values[1]) +
    0.0722 * channel(values[2])
  );
}

function contrast(left: string, right: string): number {
  const high = Math.max(luminance(left), luminance(right));
  const low = Math.min(luminance(left), luminance(right));
  return (high + 0.05) / (low + 0.05);
}

function chooseTextColor(background: string, preferred: string | null): string {
  if (preferred && contrast(background, preferred) >= 4.5) return preferred;
  return contrast(background, "#FFFFFF") >= contrast(background, "#071018")
    ? "#FFFFFF"
    : "#071018";
}

function buildCampaign(
  input: RoleRoomBrandBasedMockupInput,
): RoleRoomMockupCampaignPlan {
  const proofPoints = unique(input.proofPoints ?? []);
  const evidence = claimEvidence(input.sourceEvidence ?? []);
  return {
    name: `${clean(input.companyName, "Merket")} · ${clean(input.concept, "kampanje")}`,
    objective: clean(
      input.campaignObjective,
      "Skape forståelse og lede målgruppen til et tydelig neste steg.",
    ),
    angle: clean(
      input.campaignAngle,
      clean(input.title, clean(input.companyName, "Dokumentert kampanjeidé")),
    ),
    audience: unique(input.audience ?? [])[0] || "Dokumentert målgruppe",
    proofStrategy:
      proofPoints.length > 0 && evidence.length > 0
        ? "research-evidence"
        : "research-copy-only",
    scene: /helse|medisin|klinikk|lege|health|medical/i.test(
      clean(input.industry),
    )
      ? "clinical"
      : "workplace",
    visualSystem:
      input.mediaType === "carousel"
        ? "narrative-proof-series"
        : input.mediaType === "reel"
          ? "vertical-product-story"
          : "editorial-product-bridge",
  };
}

function carouselRoles(count: number): RoleRoomMockupSlideRole[] {
  if (count === 2) return ["hook", "cta"];
  if (count === 3) return ["hook", "proof", "cta"];
  if (count === 4) return ["hook", "context", "proof", "cta"];
  return [
    "hook",
    "context",
    "mechanism",
    ...Array.from<RoleRoomMockupSlideRole>({ length: count - 4 }).fill("proof"),
    "cta",
  ];
}

function layoutForRole(
  mediaType: RoleRoomMockupMediaType,
  role: RoleRoomMockupSlideRole,
): RoleRoomMockupSlideLayout {
  if (mediaType === "reel") return "vertical-story";
  if (mediaType === "image") return "photo-product-bridge";
  return {
    hook: "statement",
    context: "problem-frame",
    mechanism: "process-card",
    proof: "proof-card",
    cta: "cta-lockup",
  }[role] as RoleRoomMockupSlideLayout;
}

function buildSlides(
  input: RoleRoomBrandBasedMockupInput,
  count: number,
  campaign: RoleRoomMockupCampaignPlan,
): RoleRoomMockupSlidePlan[] {
  const companyName = clean(input.companyName, "kunden");
  const proofPoints = unique(input.proofPoints ?? []);
  const offerings = unique(input.offerings ?? []);
  const painPoints = unique(input.painPoints ?? []);
  const evidence = claimEvidence(input.sourceEvidence ?? []);
  const roles =
    input.mediaType === "carousel"
      ? carouselRoles(count)
      : (["hook"] as RoleRoomMockupSlideRole[]);
  let proofIndex = 0;
  let offeringIndex = 0;
  const plans: RoleRoomMockupSlidePlan[] = roles.map((role, index) => {
    const ordinal = index + 1;
    const base = {
      ordinal,
      role,
      layout: layoutForRole(input.mediaType, role),
      callToAction:
        role === "cta"
          ? clean(input.callToAction, "Les mer")
          : input.mediaType === "carousel"
            ? "Sveip videre"
            : clean(input.callToAction, "Les mer"),
      evidenceRef:
        evidence[Math.min(index, Math.max(0, evidence.length - 1))] || null,
    };
    if (role === "hook") {
      return {
        ...base,
        eyebrow: input.mediaType === "reel" ? "KORTFORMAT" : "KAMPANJEIDÉ",
        title: clean(input.title, campaign.angle),
        caption: clean(input.caption, campaign.objective),
      };
    }
    if (role === "context") {
      return {
        ...base,
        eyebrow: painPoints.length ? "UTFORDRING" : "KONTEKST",
        title: painPoints[0] || campaign.objective,
        caption: clean(input.caption, campaign.angle),
      };
    }
    if (role === "mechanism") {
      const offering = offerings[offeringIndex++] || proofPoints[proofIndex++];
      return {
        ...base,
        eyebrow: "SLIK FUNGERER DET",
        title: offering || `Slik jobber ${companyName}`,
        caption: offering
          ? `En dokumentert del av tilbudet fra ${companyName}.`
          : clean(input.caption, campaign.objective),
      };
    }
    if (role === "proof") {
      const proof =
        proofPoints[proofIndex++] ||
        offerings[offeringIndex++] ||
        campaign.angle;
      return {
        ...base,
        eyebrow: "DOKUMENTERT POENG",
        title: proof,
        caption: `Hentet fra researchgrunnlaget for ${companyName}.`,
      };
    }
    return {
      ...base,
      eyebrow: "NESTE STEG",
      title: clean(input.callToAction, "Ta neste steg"),
      caption: campaign.angle,
    };
  });
  const seenTitles = new Set<string>();
  return plans.map((slide) => {
    const key = slide.title.trim().toLocaleLowerCase("nb");
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      return slide;
    }
    const title = `${slide.title} · del ${slide.ordinal}`;
    seenTitles.add(title.toLocaleLowerCase("nb"));
    return { ...slide, title };
  });
}

export function buildBrandBasedMockupPlan(
  input: RoleRoomBrandBasedMockupInput,
): RoleRoomBrandBasedMockupPlan {
  const fingerprint = buildRoleRoomMockupFingerprint({
    input,
    skillVersions: ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS.map(
      ({ id, version }) => `${id}@${version}`,
    ),
  });
  const primaryVerified = normalizedHex(input.primaryColor);
  const accentVerified = normalizedHex(input.accentColor);
  const primaryColor = primaryVerified ?? "#172033";
  const accentColor = accentVerified ?? "#55D6BE";
  const preferredText = normalizedHex(input.preferredTextColor);
  const textColor = chooseTextColor(primaryColor, preferredText);
  const accentTextColor =
    contrast(primaryColor, accentColor) >= 4.5 ? accentColor : textColor;
  const hasLogo = Boolean(input.logoDataUrl?.startsWith("data:image/"));
  const logoPlacement = VALID_PLACEMENTS.has(clean(input.logoPlacement))
    ? (clean(
        input.logoPlacement,
      ) as RoleRoomBrandBasedMockupPlan["logoPlacement"])
    : "top-left";
  const slideCount =
    input.mediaType === "carousel"
      ? Math.max(2, Math.min(10, Math.floor(input.slideCount ?? 5)))
      : 1;
  const campaign = buildCampaign(input);
  const slides = buildSlides(input, slideCount, campaign);
  const runs: RoleRoomMockupSkillRun[] = [];

  const brandLimitations = [
    ...(!primaryVerified || !accentVerified
      ? ["brand_palette_not_fully_verified"]
      : []),
    ...(!hasLogo ? ["brand_logo_not_materialized"] : []),
  ];
  runs.push(
    run(
      fingerprint,
      "resolve_mockup_brand",
      brandLimitations.length ? "limited" : "ready",
      [
        ...(primaryVerified && accentVerified ? ["brand_palette"] : []),
        ...(hasLogo ? ["sanitized_inline_logo"] : []),
        ...(input.toneOfVoice ? ["tone_of_voice"] : []),
        ...(input.visualStyle ? ["visual_style"] : []),
      ],
      brandLimitations,
      {
        primaryColor,
        accentColor,
        toneOfVoice: input.toneOfVoice ?? null,
        visualStyle: input.visualStyle ?? null,
      },
    ),
  );
  const campaignLimitations =
    input.campaignObjective || input.campaignAngle || input.audience?.length
      ? []
      : ["campaign_context_incomplete"];
  runs.push(
    run(
      fingerprint,
      "develop_campaign_system",
      campaignLimitations.length ? "limited" : "ready",
      [
        ...(input.campaignObjective ? ["campaign_objective"] : []),
        ...(input.campaignAngle ? ["campaign_angle"] : []),
        ...(input.audience?.length ? ["target_audience"] : []),
        ...(input.proofPoints?.length ? ["proof_points"] : []),
      ],
      campaignLimitations,
      { ...campaign },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "select_post_concept",
      input.title && input.caption ? "ready" : "limited",
      [
        "feed_post_title",
        "feed_post_caption",
        ...(input.researchId ? ["research_result"] : []),
      ],
      input.title && input.caption ? [] : ["post_copy_incomplete"],
      {
        concept: input.concept,
        title: slides[0].title,
        callToAction: slides[0].callToAction,
      },
    ),
  );
  const sourceEvidence = claimEvidence(input.sourceEvidence ?? []);
  const claimLimitations = sourceEvidence.length
    ? []
    : ["claim_sources_not_explicit"];
  runs.push(
    run(
      fingerprint,
      "guard_claim_evidence",
      claimLimitations.length ? "limited" : "ready",
      sourceEvidence,
      claimLimitations,
      {
        proofStrategy: campaign.proofStrategy,
        sourceEvidence,
        claimsKeptAtResearchStrength: true,
      },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "compose_visual_hierarchy",
      contrast(primaryColor, textColor) >= 4.5 ? "ready" : "failed",
      ["wcag_contrast", "brand_palette"],
      contrast(primaryColor, textColor) >= 4.5
        ? []
        : ["insufficient_text_contrast"],
      {
        primaryColor,
        accentColor,
        textColor,
        accentTextColor,
        contrastRatio: Number(contrast(primaryColor, textColor).toFixed(2)),
        accentContrastRatio: Number(
          contrast(primaryColor, accentTextColor).toFixed(2),
        ),
      },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "expand_mockup_format",
      "ready",
      ["selected_media_type", "ordered_slide_plan"],
      [],
      {
        mediaType: input.mediaType,
        slideCount,
        dimensions: input.mediaType === "reel" ? "1080x1920" : "1080x1350",
      },
    ),
  );
  const formatSkillId: RoleRoomMockupSkillId =
    input.mediaType === "carousel"
      ? "compose_carousel_narrative"
      : input.mediaType === "reel"
        ? "compose_reel_storyboard"
        : "compose_single_image_post";
  runs.push(
    run(
      fingerprint,
      formatSkillId,
      "ready",
      ["campaign_system", "ordered_slide_plan", ...sourceEvidence],
      [],
      {
        mediaType: input.mediaType,
        visualSystem: campaign.visualSystem,
        slides: slides.map(({ ordinal, role, layout, evidenceRef }) => ({
          ordinal,
          role,
          layout,
          evidenceRef,
        })),
      },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "place_brand_assets",
      hasLogo ? "ready" : "limited",
      hasLogo ? ["sanitized_inline_logo"] : [],
      hasLogo ? [] : ["mockup_created_without_verified_logo"],
      { logoPlacement, logoIncluded: hasLogo },
    ),
  );

  const checks: RoleRoomMockupSkillCheck[] = [
    {
      id: "upstream_skills_once",
      passed:
        runs.length === 8 &&
        new Set(runs.map((item) => item.id)).size === runs.length,
      detail:
        "Åtte relevante oppstrøms mockup-skills skal kjøre nøyaktig én gang.",
    },
    {
      id: "format_specialist_applied",
      passed:
        runs.filter((item) =>
          [
            "compose_single_image_post",
            "compose_carousel_narrative",
            "compose_reel_storyboard",
          ].includes(item.id),
        ).length === 1 && runs.some((item) => item.id === formatSkillId),
      detail: "Nøyaktig én formatspesialist skal samsvare med postformatet.",
    },
    {
      id: "valid_format_count",
      passed:
        input.mediaType === "carousel"
          ? slides.length >= 2 && slides.length <= 10
          : slides.length === 1,
      detail: "Slide-antall skal samsvare med postformatet.",
    },
    {
      id: "ordered_unique_slides",
      passed:
        slides.every((slide, index) => slide.ordinal === index + 1) &&
        new Set(slides.map((slide) => slide.ordinal)).size === slides.length &&
        new Set(
          slides.map((slide) => slide.title.trim().toLocaleLowerCase("nb")),
        ).size === slides.length &&
        (input.mediaType !== "carousel" ||
          (slides[0]?.role === "hook" && slides.at(-1)?.role === "cta")),
      detail:
        "Slides skal ha stabil rekkefølge, unike titler, og karusellen skal åpne med hook og avslutte med CTA.",
    },
    {
      id: "claims_trace_to_research",
      passed:
        sourceEvidence.length > 0 ||
        runs.find((item) => item.id === "guard_claim_evidence")?.status ===
          "limited",
      detail:
        "Påstander skal ha eksplisitte researchkilder eller markeres som begrenset.",
    },
    {
      id: "readable_contrast",
      passed: contrast(primaryColor, textColor) >= 4.5,
      detail: "Tekst og bakgrunn skal ha minst 4.5:1 kontrast.",
    },
    {
      id: "logo_claim_matches_document",
      passed: !hasLogo || Boolean(input.logoDataUrl),
      detail: "Logo kan bare markeres inkludert når dokumentet har logo-bytes.",
    },
  ];
  const auditStatus: RoleRoomMockupSkillStatus = checks.every(
    (check) => check.passed,
  )
    ? runs.some((item) => item.status === "limited")
      ? "limited"
      : "ready"
    : "failed";
  runs.push(
    run(
      fingerprint,
      "audit_mockup_dataflow",
      auditStatus,
      ["mockup_skill_ledger", "render_plan"],
      checks.filter((check) => !check.passed).map((check) => check.detail),
      {
        upstreamExecutionKeys: runs.map((item) => item.executionKey),
        formatSkillId,
        campaignName: campaign.name,
      },
      checks,
    ),
  );

  return {
    inputFingerprint: fingerprint,
    qualityStatus: auditStatus,
    primaryColor,
    accentColor,
    textColor,
    accentTextColor,
    logoDataUrl: hasLogo ? input.logoDataUrl! : null,
    logoPlacement,
    width: 1080,
    height: input.mediaType === "reel" ? 1920 : 1350,
    toneOfVoice: clean(input.toneOfVoice) || null,
    visualStyle: clean(input.visualStyle) || null,
    campaign,
    slides,
    skillRuns: runs,
  };
}

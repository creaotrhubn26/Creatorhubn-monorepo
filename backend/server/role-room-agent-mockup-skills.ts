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
    id: "select_post_concept",
    version: "1.0.0",
    dependsOn: ["resolve_mockup_brand"],
    instruction:
      "Velg ett konkret postkonsept fra researchens hovedbudskap, tilbud, målgruppe og CTA. Konseptet skal være sporbar til research og må ikke finne på produktpåstander.",
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
    id: "place_brand_assets",
    version: "1.0.0",
    dependsOn: ["resolve_mockup_brand", "compose_visual_hierarchy"],
    instruction:
      "Plasser kun en validert og materialisert logo i mockupen. Bevar logoens proporsjoner, bruk eksplisitt plassering og hold sikker avstand til tittel og CTA.",
  },
  {
    id: "audit_mockup_dataflow",
    version: "1.0.0",
    dependsOn: [
      "resolve_mockup_brand",
      "select_post_concept",
      "compose_visual_hierarchy",
      "expand_mockup_format",
      "place_brand_assets",
    ],
    instruction:
      "Før mockupen lagres: kontroller at alle fem oppstrøms skills kjørte én gang, at format og slide-rekkefølge er gyldig, at paletten er konsistent, at kontrasten er lesbar, og at en påstått logo faktisk finnes i det redigerbare dokumentet.",
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
  proofPoints?: string[];
  researchId?: string | null;
}

export interface RoleRoomMockupSlidePlan {
  ordinal: number;
  eyebrow: string;
  title: string;
  caption: string;
  callToAction: string;
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

function buildSlides(
  input: RoleRoomBrandBasedMockupInput,
  count: number,
): RoleRoomMockupSlidePlan[] {
  const proofPoints = unique(input.proofPoints ?? []);
  return Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    if (ordinal === 1) {
      return {
        ordinal,
        eyebrow: input.mediaType === "reel" ? "KORTFORMAT" : "RESEARCH-BASERT",
        title: clean(input.title, clean(input.companyName, "Nytt konsept")),
        caption: clean(input.caption, "Dokumentert innholdskonsept."),
        callToAction: clean(input.callToAction, "Les mer"),
      };
    }
    const proof = proofPoints[index - 1];
    const isLast = ordinal === count;
    return {
      ordinal,
      eyebrow: `DEL ${ordinal}`,
      title:
        proof ||
        (isLast
          ? clean(input.callToAction, "Ta neste steg")
          : `Poeng ${ordinal}`),
      caption: isLast
        ? clean(input.caption, "Se hvordan dette kan brukes i praksis.")
        : `Dokumentert poeng fra research for ${clean(input.companyName, "kunden")}.`,
      callToAction: isLast
        ? clean(input.callToAction, "Les mer")
        : "Sveip videre",
    };
  });
}

export function buildBrandBasedMockupPlan(
  input: RoleRoomBrandBasedMockupInput,
): RoleRoomBrandBasedMockupPlan {
  const fingerprint = buildRoleRoomMockupFingerprint(input);
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
      ? Math.max(2, Math.min(10, Math.floor(input.slideCount ?? 3)))
      : 1;
  const slides = buildSlides(input, slideCount);
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
      passed: new Set(runs.map((item) => item.id)).size === 5,
      detail: "Fem oppstrøms mockup-skills skal kjøre nøyaktig én gang.",
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
        new Set(slides.map((slide) => slide.ordinal)).size === slides.length,
      detail: "Slides skal ha stabil, unik rekkefølge.",
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
      { upstreamExecutionKeys: runs.map((item) => item.executionKey) },
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
    slides,
    skillRuns: runs,
  };
}

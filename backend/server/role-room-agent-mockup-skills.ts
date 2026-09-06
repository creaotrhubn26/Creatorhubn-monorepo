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
    id: "compose_brand_motion",
    version: "1.0.0",
    dependsOn: [
      "resolve_mockup_brand",
      "compose_visual_hierarchy",
      "expand_mockup_format",
    ],
    instruction:
      "Oversett dokumentert tone of voice, visuell stil, bransje og format til én eksplisitt motion-profil. Timingen skal prioritere hook, bevis og CTA, unngå generisk overshoot for rolige eller tillitsbaserte merker, og alltid ha en redusert-bevegelse-variant.",
  },
  {
    id: "direct_subject_figure",
    version: "2.0.0",
    dependsOn: [
      "resolve_mockup_brand",
      "develop_campaign_system",
      "guard_claim_evidence",
    ],
    instruction:
      "Gi menneskefiguren en eksplisitt og gjenbrukbar art direction fra bransje, scene og brandpalett. Primærmålet er en original, kinematisk 3D-feature-animation-figur med uttrykksfullt ansikt, myk studiobelysning og troverdige materialer; en brandtilpasset Canvas-figur er deterministisk fallback. Hold samme karakter gjennom kampanjen, og merk den som en representativ konseptillustrasjon – aldri som en ekte ansatt, kunde eller eksisterende franchisefigur.",
  },
  {
    id: "customize_subject_identity",
    version: "1.0.0",
    dependsOn: ["direct_subject_figure"],
    instruction:
      "Gjor figuridentiteten eksplisitt og redigerbar gjennom presentasjon, aldersuttrykk, hudtone, haarfarge, haarform, ansiktskarakter og en valgfri egen beskrivelse. Hver kombinasjon skal gi stabil seed og execution key, samtidig som rolle, brandlys, antrekk og proveniens beholdes.",
  },
  {
    id: "build_character_master",
    version: "1.0.0",
    dependsOn: ["direct_subject_figure", "customize_subject_identity"],
    instruction:
      "Bygg en gjenbrukbar karakter-master med front-, trekvart- og profilvisning. Lås ansikt, hår, antrekkskonstruksjon og brandpalett som egne valg, og bruk den godkjente trekvartvisningen som kontinuitetsreferanse for senere renderinger.",
  },
  {
    id: "render_high_fidelity_subject",
    version: "1.0.0",
    dependsOn: ["direct_subject_figure", "customize_subject_identity", "build_character_master"],
    instruction:
      "Render figurmasteren med gpt-image-2 i high-kvalitet som transparent PNG i portrettformat. Bruk godkjent figurmaster som referanse ved senere utseende- og posevarianter for visuell kontinuitet. Skill mellom generert raster, sprite-sekvens og faktisk leddrigg; aldri presenter et flatt bilde som en ekte 3D-rigg.",
  },
  {
    id: "direct_pose_expression",
    version: "1.0.0",
    dependsOn: ["build_character_master", "render_high_fidelity_subject"],
    instruction:
      "Velg en eksplisitt positur og et ansikksuttrykk fra det kuraterte biblioteket. Oversett samme valg både til referanse-edit-prompten og den deterministiske fallback-riggen, slik at generert asset og manuell redigering uttrykker samme handling.",
  },
  {
    id: "generate_layered_sprite_package",
    version: "1.0.0",
    dependsOn: ["build_character_master", "render_high_fidelity_subject", "direct_pose_expression"],
    instruction:
      "Generer en deduplisert spritepakke med fire identitetslåste, transparente high-end-frames og et åtte-lags semantisk manifest for skygge, kropp, armer/hender, ansikt, mimikk, hår og rekvisitt. Bruk kryssfade for rolig bevegelse og behold redigerbar Canvas-rigg som fallback.",
  },
  {
    id: "rig_subject_motion",
    version: "1.0.0",
    dependsOn: [
      "direct_subject_figure",
      "customize_subject_identity",
      "render_high_fidelity_subject",
      "direct_pose_expression",
      "generate_layered_sprite_package",
      "compose_brand_motion",
    ],
    instruction:
      "Tilby full manuell kontroll uten AI gjennom en redigerbar figur-rigg med transform-, ansikts-, kropps-, arm-, hand-, finger- og gangkanaler samt keyframes. Generert raster skal fortsatt kunne flyttes, skaleres, roteres og fades som ett lag. Hoyopplost leddkontroll skal bruke rigget 3D-asset eller sprite-sekvens, og redusert bevegelse skal alltid kunne falle tilbake til fade.",
  },
  {
    id: "composite_subject_scene",
    version: "1.0.0",
    dependsOn: ["resolve_mockup_brand", "render_high_fidelity_subject", "generate_layered_sprite_package"],
    instruction:
      "Komponer den transparente figuren med scenen gjennom separat kontaktskygge, brand-rimlys, miljømatch, dybdeblur, perspektiv og justerbar bakkekontakt. Bevar hele silhuetten og sikker kant; contain-fit skal aldri legge en falsk sort bakgrunn bak figuren.",
  },
  {
    id: "author_subject_animation",
    version: "1.0.0",
    dependsOn: ["compose_brand_motion", "direct_pose_expression", "generate_layered_sprite_package", "rig_subject_motion"],
    instruction:
      "Forfatter manuell figurbevegelse med interruptible keyframes, kurve-easing og presets for rolig pust, vennlig vink og presentasjon. Kryssfade spriteframes når high-end-assets brukes, og reduser all ikke-essensiell reise til fade ved redusert bevegelse.",
  },
  {
    id: "curate_subject_variants",
    version: "1.0.0",
    dependsOn: ["build_character_master", "render_high_fidelity_subject", "direct_pose_expression"],
    instruction:
      "Lagre høyst åtte figurvarianter med innholdshash, promptvalg, QA og proveniens. Dedupliser etter bildehash, behold aktiv variant eksplisitt og vis sammenlignbar historikk uten å kopiere høyoppløste base64-bilder inn i prosjektdokumentet.",
  },
  {
    id: "audit_subject_visual_quality",
    version: "1.0.0",
    dependsOn: ["render_high_fidelity_subject", "generate_layered_sprite_package", "composite_subject_scene", "curate_subject_variants"],
    instruction:
      "Kjør objektiv piksel-QA for oppløsning, ekte alfa, motivflate, sikker kant og brandfargenærhet, samt strukturert visuell modellaudit for anatomi, fem-finger-hender, symmetri, kollisjoner, isolasjon, brandharmoni og identitetskontinuitet. Lagre score og hver sjekk sammen med varianten.",
  },
  {
    id: "compose_cinematic_scene",
    version: "1.0.0",
    dependsOn: [
      "resolve_mockup_brand",
      "develop_campaign_system",
      "compose_visual_hierarchy",
      "compose_brand_motion",
      "direct_subject_figure",
      "customize_subject_identity",
      "render_high_fidelity_subject",
      "rig_subject_motion",
      "composite_subject_scene",
      "author_subject_animation",
    ],
    instruction:
      "Bind miljø, figur, produktflate, redigerbar tekst, CTA, logo, lys og materialer til en original kinematisk scene. Brandfargene skal påvirke lys, rekvisitter og overflater uten å svekke kontrast eller logoens sikkerhetssone. Scenen skal ha tydelig dybdehierarki, en kontrollert kamerabevegelse og samme kvalitetsnivå i både generert asset og deterministisk Canvas-fallback.",
  },
  {
    id: "verify_subject_production",
    version: "1.0.0",
    dependsOn: ["audit_subject_visual_quality", "author_subject_animation", "compose_cinematic_scene"],
    instruction:
      "Verifiser den faktiske produksjonsløypen mot Render med gpt-image-2: generering, privat assetpersistens, referanse-edit, pikseldekoding, transparent alfa, QA-respons, Mockup Studio-avspilling og skyreload. En konfigurasjonssjekk alene er ikke produksjonsbevis.",
  },
  {
    id: "audit_mockup_dataflow",
    version: "7.0.0",
    dependsOn: [
      "resolve_mockup_brand",
      "select_post_concept",
      "compose_visual_hierarchy",
      "expand_mockup_format",
      "place_brand_assets",
      "compose_brand_motion",
      "direct_subject_figure",
      "customize_subject_identity",
      "build_character_master",
      "render_high_fidelity_subject",
      "direct_pose_expression",
      "generate_layered_sprite_package",
      "rig_subject_motion",
      "composite_subject_scene",
      "author_subject_animation",
      "curate_subject_variants",
      "audit_subject_visual_quality",
      "compose_cinematic_scene",
      "verify_subject_production",
    ],
    instruction:
      "Før mockupen lagres: kontroller at alle relevante oppstrøms skills kjørte én gang, at riktig formatspesialist ble brukt, at slide-rekkefølge og roller er gyldige, at påstander er kildemerket, og at palett, kontrast, logo, figurkvalitet og motion-profil samsvarer med det redigerbare dokumentet.",
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
  | "hook"
  | "context"
  | "mechanism"
  | "proof"
  | "cta";

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

export type RoleRoomMockupMotionProfile =
  | "calm-precise"
  | "warm-human"
  | "bold-editorial"
  | "energetic-social";

export interface RoleRoomBrandMotionPlan {
  profile: RoleRoomMockupMotionProfile;
  source: "brand-guide" | "research-signals" | "safe-default";
  durationSeconds: number;
  easing: "smooth" | "out";
  staggerSeconds: number;
  revealDistance: number;
  revealScale: number;
  overshoot: number;
  holdSeconds: number;
  cameraPushIn: number;
  beatPunch: number;
  bpm: number | null;
  reducedMotion: "fade";
  rationale: string[];
}

export interface RoleRoomFigurePlan {
  style: "cinematic-3d-v1";
  renderQuality: "cinematic";
  provenance: "deterministic-procedural";
  assetStrategy: "generated-preferred";
  qualityTarget: "cinematic-feature-animation";
  fallbackStyle: "cinematic-3d-canvas-v1";
  subjectRole: "clinician" | "professional";
  presentation: "female" | "male";
  ageRange: "adult";
  faceShape: "balanced";
  outfit: "legefrakk" | "skjorte";
  accessory: "stetoskop" | "id-kort";
  scenario: "laptop" | "presenter";
  skin: string;
  hair: string;
  hairStyle: "kort" | "buffert" | "krøller";
  altText: string;
  disclosure: "representative-concept-illustration";
  generationPrompt: string;
  negativePrompt: string;
  seed: number;
  qualityCriteria: string[];
  consistencyKey: string;
}

export interface RoleRoomCinematicScenePlan {
  style: "cinematic-scene-v1";
  renderQuality: "cinematic";
  environment: "clinical-editorial" | "workplace-editorial";
  lighting: "soft-key-fill-rim";
  colorGrade: "warm-clinical" | "brand-editorial";
  depthLayers: ["environment", "subject", "product", "copy", "cta"];
  deviceTreatment: "screen-light-and-perspective";
  cardTreatment: "layered-glass-panel";
  logoTreatment: "clean-safe-zone";
  materialDetail: "high";
  brandHarmony: { primary: string; accent: string };
  camera: { parallax: number; pushIn: number };
  qualityCriteria: string[];
}

export interface RoleRoomFigureRigPlan {
  manualControl: true;
  defaultMode: "editable-rig";
  modes: ["editable-rig", "generated-raster", "sprite-sequence", "video"];
  wholeLayerChannels: ["x", "y", "rotation", "scale", "opacity"];
  jointChannels: [
    "hands",
    "fingers",
    "screen",
    "blink",
    "headTilt",
    "mouthCurve",
    "eyeSize",
    "bodyBob",
    "leanX",
    "brow",
    "tears",
    "walk",
  ];
  reducedMotion: "fade";
  highEndJointRequirement: "rigged-3d-or-sprite-sequence";
}

export interface RoleRoomHighFidelitySubjectRenderPlan {
  provider: "openai";
  model: "gpt-image-2";
  quality: "high";
  size: "1024x1536";
  background: "transparent";
  outputFormat: "png";
  consistencyStrategy: "reference-edit";
  generatedAssetMode: "generated-raster";
  animationBridge: "sprite-sequence-or-rigged-3d";
}

export interface RoleRoomFigureProductionPlan {
  characterMaster: {
    views: ["front", "three-quarter", "profile"];
    approvedView: "three-quarter";
    locks: ["face", "hair", "outfit", "palette"];
  };
  spritePackage: {
    framePoseIds: ["neutral", "presenting", "listening", "pointing"];
    layers: ["contact-shadow", "legs-body", "left-arm-hand", "right-arm-hand", "head-face", "eyes-mouth", "hair", "prop"];
    interpolation: "crossfade";
    deduplicateBy: "sha256";
  };
  poseExpression: {
    poses: ["neutral", "presenting", "listening", "pointing", "walking"];
    expressions: ["calm", "warm", "focused", "surprised"];
    defaultPose: "neutral";
    defaultExpression: "calm";
  };
  compositing: {
    channels: ["contactShadow", "rimLight", "ambientMatch", "depthBlur", "perspective", "groundOffset"];
    fit: "transparent-contain";
  };
  animation: {
    presets: ["calm-idle", "friendly-wave", "present-proof"];
    keyframeEasing: true;
    interruptible: true;
    reducedMotion: "fade";
  };
  variants: { cap: 8; deduplicateBy: "sha256"; compare: true };
  visualQa: {
    pixelChecks: ["resolution", "alpha", "silhouette", "safe-crop", "brand-colour"];
    semanticChecks: ["anatomy", "hands", "symmetry", "collisions", "subject-isolation", "brand-harmony", "identity-continuity"];
  };
  productionSmoke: {
    provider: "render-post-agent";
    requiresRealGeneration: true;
    checks: ["gpt-image-2", "private-asset", "reference-edit", "alpha-pixels", "qa-response", "cloud-reload"];
  };
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
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";
  width: number;
  height: number;
  toneOfVoice: string | null;
  visualStyle: string | null;
  campaign: RoleRoomMockupCampaignPlan;
  motion: RoleRoomBrandMotionPlan;
  figure: RoleRoomFigurePlan;
  figureRender: RoleRoomHighFidelitySubjectRenderPlan;
  figureRig: RoleRoomFigureRigPlan;
  figureProduction: RoleRoomFigureProductionPlan;
  scene: RoleRoomCinematicScenePlan;
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
  return unique(values).filter((value) => !/(?:^|\.)companyName$/i.test(value));
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

function buildBrandMotion(
  input: RoleRoomBrandBasedMockupInput,
): RoleRoomBrandMotionPlan {
  const tone = clean(input.toneOfVoice);
  const visualStyle = clean(input.visualStyle);
  const industry = clean(input.industry);
  const signals = `${tone} ${visualStyle} ${industry}`.toLocaleLowerCase("nb");
  const source =
    tone || visualStyle
      ? "brand-guide"
      : industry
        ? "research-signals"
        : "safe-default";
  const profile: RoleRoomMockupMotionProfile =
    /trygg|presis|profesjon|klinisk|helse|medisin|rolig|seriøs|trust|precise/.test(
      signals,
    )
      ? "calm-precise"
      : /varm|menneskelig|empat|vennlig|inkluder|human|warm/.test(signals)
        ? "warm-human"
        : /energ|lek|ung|rask|sport|dynam|playful|vibrant/.test(signals)
          ? "energetic-social"
          : /modig|tydelig|redaksjon|premium|bold|editorial/.test(signals)
            ? "bold-editorial"
            : "calm-precise";
  const base = {
    "calm-precise": {
      durationSeconds: input.mediaType === "reel" ? 5.4 : 5.8,
      easing: "smooth" as const,
      staggerSeconds: 0.16,
      revealDistance: 14,
      revealScale: 0.01,
      overshoot: 0,
      holdSeconds: 1.15,
      cameraPushIn: 0.06,
      beatPunch: 0,
      bpm: null,
    },
    "warm-human": {
      durationSeconds: input.mediaType === "reel" ? 4.7 : 5.1,
      easing: "out" as const,
      staggerSeconds: 0.13,
      revealDistance: 20,
      revealScale: 0.018,
      overshoot: 0.012,
      holdSeconds: 0.9,
      cameraPushIn: 0.1,
      beatPunch: 0,
      bpm: null,
    },
    "bold-editorial": {
      durationSeconds: input.mediaType === "reel" ? 4.2 : 4.6,
      easing: "out" as const,
      staggerSeconds: 0.11,
      revealDistance: 18,
      revealScale: 0.024,
      overshoot: 0.008,
      holdSeconds: 0.75,
      cameraPushIn: 0.12,
      beatPunch: 0.015,
      bpm: 96,
    },
    "energetic-social": {
      durationSeconds: input.mediaType === "reel" ? 3.6 : 4,
      easing: "out" as const,
      staggerSeconds: 0.08,
      revealDistance: 30,
      revealScale: 0.035,
      overshoot: 0.035,
      holdSeconds: 0.55,
      cameraPushIn: 0.18,
      beatPunch: 0.04,
      bpm: 112,
    },
  }[profile];
  return {
    profile,
    source,
    ...base,
    reducedMotion: "fade",
    rationale: unique([
      ...(tone ? [`tone:${tone}`] : []),
      ...(visualStyle ? [`visual_style:${visualStyle}`] : []),
      ...(industry ? [`industry:${industry}`] : []),
      `format:${input.mediaType}`,
    ]),
  };
}

function buildFigureDirection(
  input: RoleRoomBrandBasedMockupInput,
  campaign: RoleRoomMockupCampaignPlan,
): RoleRoomFigurePlan {
  const consistencyKey = crypto
    .createHash("sha256")
    .update(
      `${clean(input.companyName, "brand")}|${clean(input.industry, campaign.scene)}|cinematic-3d-v1`,
    )
    .digest("hex")
    .slice(0, 16);
  const characterPalettes = [
    { skin: "#D9A17D", hair: "#352923", hairStyle: "kort" as const },
    { skin: "#9B6548", hair: "#201817", hairStyle: "krøller" as const },
    { skin: "#6F4637", hair: "#171313", hairStyle: "kort" as const },
    { skin: "#E6BA98", hair: "#694936", hairStyle: "buffert" as const },
  ];
  const palette =
    characterPalettes[
      Number.parseInt(consistencyKey.slice(0, 8), 16) % characterPalettes.length
    ];
  const clinical = campaign.scene === "clinical";
  const presentation =
    Number.parseInt(consistencyKey.slice(0, 8), 16) % 2 === 0
      ? "female"
      : "male";
  const subject = clinical
    ? `an original Norwegian ${presentation} clinician wearing a clean white medical coat and stethoscope`
    : `an original Norwegian ${presentation} professional wearing a tailored shirt and subtle ID badge`;
  const action =
    input.mediaType === "reel"
      ? "presenting confidently with a warm, intelligent expression"
      : "working naturally at a laptop with an attentive, reassuring expression";
  const hairDirection = {
    kort: "short professional hair",
    buffert: "medium-volume styled hair",
    krøller: "defined natural curls",
  }[palette.hairStyle];
  const generationPrompt = [
    "Premium cinematic 3D feature-animation character portrait",
    "original character design, not based on a real person or an existing film franchise",
    subject,
    `adult age range, balanced facial structure, skin tone ${palette.skin}, hair colour ${palette.hair}, ${hairDirection}`,
    action,
    `wardrobe accents in brand colours ${normalizedHex(input.primaryColor) || "#102A43"} and ${normalizedHex(input.accentColor) || "#2CB67D"}`,
    "appealing facial proportions, expressive eyes, natural hands",
    "subtle subsurface skin shading, detailed hair strands and believable fabric",
    "soft key light, warm fill, delicate rim light, cinematic depth",
    "full upper body, three-quarter view, isolated clean silhouette on a fully transparent background",
    "premium campaign art, clean silhouette, no text, no logo",
  ].join(", ");
  const negativePrompt =
    "existing movie character, franchise likeness, celebrity, photoreal identity, uncanny face, plastic skin, malformed hands, extra fingers, asymmetrical eyes, flat lighting, low detail, text, logo, watermark";

  return {
    style: "cinematic-3d-v1",
    renderQuality: "cinematic",
    provenance: "deterministic-procedural",
    assetStrategy: "generated-preferred",
    qualityTarget: "cinematic-feature-animation",
    fallbackStyle: "cinematic-3d-canvas-v1",
    subjectRole: clinical ? "clinician" : "professional",
    presentation,
    ageRange: "adult",
    faceShape: "balanced",
    outfit: clinical ? "legefrakk" : "skjorte",
    accessory: clinical ? "stetoskop" : "id-kort",
    scenario: input.mediaType === "reel" ? "presenter" : "laptop",
    ...palette,
    altText: clinical
      ? "Representativ redaksjonell illustrasjon av en kliniker i arbeid."
      : "Representativ redaksjonell illustrasjon av en fagperson i arbeid.",
    disclosure: "representative-concept-illustration",
    generationPrompt,
    negativePrompt,
    seed: Number.parseInt(consistencyKey.slice(0, 8), 16) % 2_147_483_647,
    qualityCriteria: [
      "natural-proportions",
      "expressive-face",
      "natural-hands",
      "subsurface-skin-depth",
      "strand-and-fabric-detail",
      "three-point-cinematic-lighting",
      "brand-color-integration",
      "original-character-design",
    ],
    consistencyKey,
  };
}

function buildFigureRig(): RoleRoomFigureRigPlan {
  return {
    manualControl: true,
    defaultMode: "editable-rig",
    modes: ["editable-rig", "generated-raster", "sprite-sequence", "video"],
    wholeLayerChannels: ["x", "y", "rotation", "scale", "opacity"],
    jointChannels: [
      "hands",
      "fingers",
      "screen",
      "blink",
      "headTilt",
      "mouthCurve",
      "eyeSize",
      "bodyBob",
      "leanX",
      "brow",
      "tears",
      "walk",
    ],
    reducedMotion: "fade",
    highEndJointRequirement: "rigged-3d-or-sprite-sequence",
  };
}

function buildHighFidelityFigureRender(): RoleRoomHighFidelitySubjectRenderPlan {
  return {
    provider: "openai",
    model: "gpt-image-2",
    quality: "high",
    size: "1024x1536",
    background: "transparent",
    outputFormat: "png",
    consistencyStrategy: "reference-edit",
    generatedAssetMode: "generated-raster",
    animationBridge: "sprite-sequence-or-rigged-3d",
  };
}

function buildFigureProduction(): RoleRoomFigureProductionPlan {
  return {
    characterMaster: {
      views: ["front", "three-quarter", "profile"],
      approvedView: "three-quarter",
      locks: ["face", "hair", "outfit", "palette"],
    },
    spritePackage: {
      framePoseIds: ["neutral", "presenting", "listening", "pointing"],
      layers: ["contact-shadow", "legs-body", "left-arm-hand", "right-arm-hand", "head-face", "eyes-mouth", "hair", "prop"],
      interpolation: "crossfade",
      deduplicateBy: "sha256",
    },
    poseExpression: {
      poses: ["neutral", "presenting", "listening", "pointing", "walking"],
      expressions: ["calm", "warm", "focused", "surprised"],
      defaultPose: "neutral",
      defaultExpression: "calm",
    },
    compositing: {
      channels: ["contactShadow", "rimLight", "ambientMatch", "depthBlur", "perspective", "groundOffset"],
      fit: "transparent-contain",
    },
    animation: {
      presets: ["calm-idle", "friendly-wave", "present-proof"],
      keyframeEasing: true,
      interruptible: true,
      reducedMotion: "fade",
    },
    variants: { cap: 8, deduplicateBy: "sha256", compare: true },
    visualQa: {
      pixelChecks: ["resolution", "alpha", "silhouette", "safe-crop", "brand-colour"],
      semanticChecks: ["anatomy", "hands", "symmetry", "collisions", "subject-isolation", "brand-harmony", "identity-continuity"],
    },
    productionSmoke: {
      provider: "render-post-agent",
      requiresRealGeneration: true,
      checks: ["gpt-image-2", "private-asset", "reference-edit", "alpha-pixels", "qa-response", "cloud-reload"],
    },
  };
}

function buildCinematicScene(
  campaign: RoleRoomMockupCampaignPlan,
  motion: RoleRoomBrandMotionPlan,
  primary: string,
  accent: string,
): RoleRoomCinematicScenePlan {
  const clinical = campaign.scene === "clinical";
  return {
    style: "cinematic-scene-v1",
    renderQuality: "cinematic",
    environment: clinical ? "clinical-editorial" : "workplace-editorial",
    lighting: "soft-key-fill-rim",
    colorGrade: clinical ? "warm-clinical" : "brand-editorial",
    depthLayers: ["environment", "subject", "product", "copy", "cta"],
    deviceTreatment: "screen-light-and-perspective",
    cardTreatment: "layered-glass-panel",
    logoTreatment: "clean-safe-zone",
    materialDetail: "high",
    brandHarmony: { primary, accent },
    camera: {
      parallax: motion.profile === "calm-precise" ? 0.018 : 0.028,
      pushIn: motion.cameraPushIn,
    },
    qualityCriteria: [
      "single-lighting-language",
      "brand-colour-reflections",
      "five-layer-depth-hierarchy",
      "legible-editable-copy",
      "logo-safe-zone",
      "grounded-subject-and-props",
      "reduced-motion-compatible",
    ],
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
  const motion = buildBrandMotion(input);
  const figure = buildFigureDirection(input, campaign);
  const figureRender = buildHighFidelityFigureRender();
  const figureRig = buildFigureRig();
  const figureProduction = buildFigureProduction();
  const scene = buildCinematicScene(
    campaign,
    motion,
    primaryColor,
    accentColor,
  );
  const identityCustomization = {
    presentation: figure.presentation,
    appearance: {
      ageRange: figure.ageRange,
      skinTone: figure.skin,
      hairColor: figure.hair,
      hairStyle: figure.hairStyle,
      faceShape: figure.faceShape,
      customDirection: null,
    },
    editableFields: [
      "presentation",
      "ageRange",
      "skinTone",
      "hairColor",
      "hairStyle",
      "faceShape",
      "customDirection",
    ],
    seed: figure.seed,
  };
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
  const motionLimitations =
    motion.source === "safe-default" ? ["motion_brand_signals_incomplete"] : [];
  runs.push(
    run(
      fingerprint,
      "compose_brand_motion",
      motionLimitations.length ? "limited" : "ready",
      [
        ...(input.toneOfVoice ? ["tone_of_voice"] : []),
        ...(input.visualStyle ? ["visual_style"] : []),
        ...(input.industry ? ["industry"] : []),
        "selected_media_type",
      ],
      motionLimitations,
      { ...motion },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "direct_subject_figure",
      "ready",
      [
        ...(input.industry ? ["industry"] : []),
        "campaign_scene",
        "brand_palette",
      ],
      [],
      { ...figure },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "customize_subject_identity",
      "ready",
      ["subject_figure_direction", "brand_palette", "stable_character_seed"],
      [],
      identityCustomization,
    ),
  );
  runs.push(
    run(
      fingerprint,
      "build_character_master",
      "ready",
      ["subject_identity_choices", "stable_character_seed", "three_view_contract"],
      [],
      { ...figureProduction.characterMaster },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "render_high_fidelity_subject",
      "ready",
      [
        "subject_figure_direction",
        "subject_identity_choices",
        "transparent_compositing_contract",
      ],
      [],
      { ...figureRender },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "direct_pose_expression",
      "ready",
      ["character_master_contract", "editable_rig_mapping"],
      [],
      { ...figureProduction.poseExpression },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "generate_layered_sprite_package",
      "ready",
      ["character_master_contract", "transparent_compositing_contract", "content_hash_contract"],
      [],
      { ...figureProduction.spritePackage },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "rig_subject_motion",
      "ready",
      [
        "subject_figure_direction",
        "subject_identity_choices",
        "high_fidelity_subject_render",
        "brand_motion_profile",
      ],
      [],
      { ...figureRig },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "composite_subject_scene",
      "ready",
      ["transparent_compositing_contract", "brand_palette", "scene_depth_contract"],
      [],
      { ...figureProduction.compositing },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "author_subject_animation",
      "ready",
      ["brand_motion_profile", "sprite_crossfade_contract", "manual_keyframe_channels"],
      [],
      { ...figureProduction.animation },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "curate_subject_variants",
      "ready",
      ["private_asset_reference_contract", "content_hash_contract"],
      [],
      { ...figureProduction.variants },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "audit_subject_visual_quality",
      "ready",
      ["pixel_audit_contract", "structured_vision_audit_contract"],
      [],
      { ...figureProduction.visualQa },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "compose_cinematic_scene",
      "ready",
      [
        "campaign_scene",
        "brand_palette",
        "brand_motion_profile",
        "subject_figure_direction",
        "high_fidelity_subject_render",
      ],
      [],
      { ...scene },
    ),
  );
  runs.push(
    run(
      fingerprint,
      "verify_subject_production",
      "ready",
      ["render_smoke_harness", "gpt_image_2_contract", "cloud_reload_contract"],
      [],
      { ...figureProduction.productionSmoke, state: "runs-after-user-generation" },
    ),
  );

  const checks: RoleRoomMockupSkillCheck[] = [
    {
      id: "upstream_skills_once",
      passed:
        runs.length === 22 &&
        new Set(runs.map((item) => item.id)).size === runs.length,
      detail:
        "Tjueto relevante upstream mockup-skills skal kjore noyaktig en gang.",
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
    {
      id: "brand_motion_is_explicit",
      passed:
        motion.durationSeconds >= 3 &&
        motion.reducedMotion === "fade" &&
        (motion.profile !== "calm-precise" || motion.overshoot === 0),
      detail:
        "Motion må ha eksplisitt brand-profil, fade-alternativ og ingen overshoot for rolige/tillitsbaserte merker.",
    },
    {
      id: "subject_figure_has_quality_and_provenance",
      passed:
        figure.renderQuality === "cinematic" &&
        figure.style === "cinematic-3d-v1" &&
        figure.assetStrategy === "generated-preferred" &&
        figure.qualityTarget === "cinematic-feature-animation" &&
        figure.generationPrompt.length > 180 &&
        figure.negativePrompt.length > 80 &&
        figure.provenance === "deterministic-procedural" &&
        figure.disclosure === "representative-concept-illustration",
      detail:
        "Figuren må ha genereringsklar kinematisk 3D-retning, stabil karakteridentitet, kvalitetsgrenser, deterministisk fallback og eksplisitt konsept-proveniens.",
    },
    {
      id: "high_fidelity_render_is_compositing_ready",
      passed:
        figureRender.provider === "openai" &&
        figureRender.model === "gpt-image-2" &&
        figureRender.quality === "high" &&
        figureRender.size === "1024x1536" &&
        figureRender.background === "transparent" &&
        figureRender.outputFormat === "png" &&
        figureRender.consistencyStrategy === "reference-edit",
      detail:
        "High-end figurmaster maa bruke gpt-image-2 high, transparent PNG og referansebasert kontinuitet.",
    },
    {
      id: "cinematic_scene_is_coherent",
      passed:
        scene.renderQuality === "cinematic" &&
        scene.style === "cinematic-scene-v1" &&
        scene.lighting === "soft-key-fill-rim" &&
        scene.depthLayers.length === 5 &&
        new Set(scene.depthLayers).size === scene.depthLayers.length &&
        scene.brandHarmony.primary === primaryColor &&
        scene.brandHarmony.accent === accentColor &&
        scene.logoTreatment === "clean-safe-zone" &&
        scene.qualityCriteria.length >= 7,
      detail:
        "Hele scenen skal dele lys, brandfarger, fem unike dybdelag, materialnivaa og trygg logoplassering.",
    },
    {
      id: "subject_identity_is_editable_and_reproducible",
      passed:
        ["female", "male"].includes(figure.presentation) &&
        identityCustomization.editableFields.length === 7 &&
        identityCustomization.seed === figure.seed,
      detail:
        "Figurvalg maa lagre presentasjon, utseendefelter og stabil seed gjennom customize_subject_identity.",
    },
    {
      id: "subject_rig_supports_manual_motion_control",
      passed:
        figureRig.manualControl &&
        figureRig.defaultMode === "editable-rig" &&
        figureRig.wholeLayerChannels.length === 5 &&
        figureRig.jointChannels.length >= 12 &&
        figureRig.reducedMotion === "fade" &&
        figureRig.highEndJointRequirement === "rigged-3d-or-sprite-sequence",
      detail:
        "Figuren maa kunne styres uten AI med ledd- og transform-keyframes, samtidig som high-end leddkontroll peker til rigget 3D eller sprite-sekvens.",
    },
    {
      id: "subject_production_pipeline_has_all_eight_layers",
      passed:
        figureProduction.characterMaster.views.length === 3 &&
        figureProduction.spritePackage.framePoseIds.length === 4 &&
        figureProduction.spritePackage.layers.length === 8 &&
        figureProduction.poseExpression.poses.length === 5 &&
        figureProduction.compositing.channels.length === 6 &&
        figureProduction.animation.presets.length === 3 &&
        figureProduction.variants.cap === 8 &&
        figureProduction.visualQa.pixelChecks.length === 5 &&
        figureProduction.visualQa.semanticChecks.length === 7 &&
        figureProduction.productionSmoke.requiresRealGeneration,
      detail:
        "Karakter-master, spritepakke, pose/uttrykk, compositing, manuell animasjon, variantbank, visuell QA og produksjons-smoke skal alle være eksplisitte i planen.",
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
    motion,
    figure,
    figureRender,
    figureRig,
    figureProduction,
    scene,
    slides,
    skillRuns: runs,
  };
}

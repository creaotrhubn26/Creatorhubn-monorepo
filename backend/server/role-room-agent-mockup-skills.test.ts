import { describe, expect, it } from "vitest";
import {
  ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS,
  buildBrandBasedMockupPlan,
  buildRoleRoomMockupFingerprint,
} from "./role-room-agent-mockup-skills.js";

const logo = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z"/></svg>',
).toString("base64")}`;

describe("Role Room brand-based mockup skills", () => {
  it("defines the foundation and format-specific skills with valid dependencies", () => {
    const ids = ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS.map((skill) => skill.id);
    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
    for (const skill of ROLE_ROOM_MOCKUP_SKILL_DEFINITIONS) {
      expect(skill.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(skill.dependsOn.every((id) => ids.includes(id))).toBe(true);
      expect(skill.instruction.length).toBeGreaterThan(60);
    }
  });

  it("uses a stable fingerprint for semantically identical input", () => {
    expect(buildRoleRoomMockupFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      buildRoleRoomMockupFingerprint({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("creates a ready clinical image plan whose active skill runs affect the render", () => {
    const plan = buildBrandBasedMockupPlan({
      companyName: "MedSide",
      title: "Journalnotat på kortere tid",
      caption: "En dokumentert arbeidsflyt for norske klinikere.",
      callToAction: "Prøv gratis",
      concept: "product_highlight",
      mediaType: "image",
      primaryColor: "#102A43",
      accentColor: "#2CB67D",
      preferredTextColor: "#ffffff",
      logoDataUrl: logo,
      logoPlacement: "top-right",
      toneOfVoice: "Trygg og presis",
      visualStyle: "Ren klinisk teknologi",
      industry: "Helseteknologi og programvare",
      campaignObjective: "Forklare produktverdien før demo.",
      campaignAngle: "Mer tid til pasienten",
      audience: ["Norske leger"],
      offerings: ["AI-assistert journalnotat"],
      proofPoints: ["GDPR-sikker arbeidsflyt"],
      sourceEvidence: [
        "companyProfile.offerings",
        "planningDraft.contentLogic.proofPoints",
      ],
      researchId: "00000000-0000-4000-8000-000000000010",
    });

    expect(plan.qualityStatus).toBe("ready");
    expect(plan.skillRuns).toHaveLength(23);
    expect(new Set(plan.skillRuns.map((skill) => skill.id)).size).toBe(23);
    expect(
      plan.skillRuns.every((skill) =>
        skill.executionKey.startsWith(plan.inputFingerprint),
      ),
    ).toBe(true);
    expect(plan.primaryColor).toBe("#102A43");
    expect(plan.accentColor).toBe("#2CB67D");
    expect(plan.logoPlacement).toBe("top-right");
    expect(plan.logoDataUrl).toBe(logo);
    expect(plan.motion).toEqual(
      expect.objectContaining({
        profile: "calm-precise",
        source: "brand-guide",
        easing: "smooth",
        overshoot: 0,
        reducedMotion: "fade",
      }),
    );
    expect(plan.figure).toEqual(
      expect.objectContaining({
        style: "cinematic-3d-v1",
        renderQuality: "cinematic",
        provenance: "deterministic-procedural",
        assetStrategy: "generated-preferred",
        qualityTarget: "cinematic-feature-animation",
        fallbackStyle: "cinematic-3d-canvas-v1",
        subjectRole: "clinician",
        presentation: expect.stringMatching(/female|male/),
        ageRange: "adult",
        faceShape: "balanced",
        outfit: "legefrakk",
        accessory: "stetoskop",
        disclosure: "representative-concept-illustration",
      }),
    );
    expect(plan.figure.generationPrompt).toContain("original character design");
    expect(plan.figure.generationPrompt).toContain("#102A43");
    expect(plan.figure.generationPrompt).toContain("#2CB67D");
    expect(plan.figure.negativePrompt).toContain("franchise likeness");
    expect(plan.figure.seed).toBeGreaterThan(0);
    expect(plan.figureRig).toEqual(
      expect.objectContaining({
        manualControl: true,
        defaultMode: "editable-rig",
        reducedMotion: "fade",
        highEndJointRequirement: "rigged-3d-or-sprite-sequence",
      }),
    );
    expect(plan.figureRender).toEqual({
      provider: "openai",
      model: "gpt-image-2",
      quality: "high",
      size: "1024x1536",
      background: "transparent",
      outputFormat: "png",
      consistencyStrategy: "reference-edit",
      generatedAssetMode: "generated-raster",
      animationBridge: "sprite-sequence-or-rigged-3d",
    });
    expect(plan.figureRig.wholeLayerChannels).toEqual([
      "x",
      "y",
      "rotation",
      "scale",
      "opacity",
    ]);
    expect(plan.figureRig.jointChannels).toEqual(
      expect.arrayContaining([
        "hands",
        "fingers",
        "blink",
        "headTilt",
        "mouthCurve",
        "bodyBob",
        "walk",
      ]),
    );
    expect(plan.figureProduction).toEqual(expect.objectContaining({
      characterMaster: expect.objectContaining({
        views: ["front", "three-quarter", "profile"],
        locks: ["face", "hair", "outfit", "palette"],
      }),
      spritePackage: expect.objectContaining({
        framePoseIds: ["neutral", "presenting", "listening", "pointing"],
        interpolation: "crossfade",
        deduplicateBy: "sha256",
      }),
      poseExpression: expect.objectContaining({ defaultPose: "neutral", defaultExpression: "calm" }),
      compositing: expect.objectContaining({ fit: "transparent-contain" }),
      animation: expect.objectContaining({ interruptible: true, reducedMotion: "fade" }),
      variants: { cap: 8, deduplicateBy: "sha256", compare: true },
      productionSmoke: expect.objectContaining({ requiresRealGeneration: true }),
    }));
    expect(plan.figureProduction.spritePackage.layers).toHaveLength(8);
    expect(plan.figureProduction.visualQa.semanticChecks).toHaveLength(7);
    expect(plan.campaign).toEqual(
      expect.objectContaining({
        scene: "clinical",
        visualSystem: "editorial-product-bridge",
      }),
    );
    expect(plan.scene).toEqual(
      expect.objectContaining({
        style: "cinematic-scene-v1",
        renderQuality: "cinematic",
        environment: "clinical-editorial",
        lighting: "soft-key-fill-rim",
        colorGrade: "warm-clinical",
        deviceTreatment: "screen-light-and-perspective",
        cardTreatment: "layered-glass-panel",
        logoTreatment: "clean-safe-zone",
        brandHarmony: { primary: "#102A43", accent: "#2CB67D" },
      }),
    );
    expect(plan.scene.depthLayers).toEqual([
      "environment",
      "subject",
      "product",
      "copy",
      "cta",
    ]);
    expect(plan.skillRuns.map((skill) => skill.id)).toEqual(
      expect.arrayContaining([
        "develop_campaign_system",
        "guard_claim_evidence",
        "compose_single_image_post",
        "compose_brand_motion",
        "direct_subject_figure",
        "customize_subject_identity",
        "render_high_fidelity_subject",
        "build_character_master",
        "direct_pose_expression",
        "generate_layered_sprite_package",
        "rig_subject_motion",
        "composite_subject_scene",
        "author_subject_animation",
        "curate_subject_variants",
        "audit_subject_visual_quality",
        "compose_cinematic_scene",
        "verify_subject_production",
      ]),
    );
    expect(plan.slides).toEqual([
      expect.objectContaining({
        ordinal: 1,
        role: "hook",
        layout: "photo-product-bridge",
        title: "Journalnotat på kortere tid",
        callToAction: "Prøv gratis",
      }),
    ]);
  });

  it("builds a unique ordered carousel and reports unverified brand inputs", () => {
    const plan = buildBrandBasedMockupPlan({
      companyName: "Eksempel",
      title: "Tre dokumenterte fordeler",
      caption: "Researchgrunnlag",
      callToAction: "Les mer",
      concept: "educational",
      mediaType: "carousel",
      slideCount: 14,
      proofPoints: ["Fordel A", "Fordel A", "Fordel B"],
      sourceEvidence: ["companyProfile.companyName"],
    });

    expect(plan.qualityStatus).toBe("limited");
    expect(plan.slides).toHaveLength(10);
    expect(plan.slides.map((slide) => slide.ordinal)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(
      new Set(plan.slides.map((slide) => slide.title.toLocaleLowerCase("nb")))
        .size,
    ).toBe(plan.slides.length);
    expect(plan.slides[0]).toEqual(
      expect.objectContaining({ role: "hook", layout: "statement" }),
    );
    expect(plan.slides.at(-1)).toEqual(
      expect.objectContaining({ role: "cta", layout: "cta-lockup" }),
    );
    expect(
      plan.skillRuns.some((skill) => skill.id === "compose_carousel_narrative"),
    ).toBe(true);
    expect(plan.slides.every((slide) => slide.evidenceRef === null)).toBe(true);
    expect(
      plan.skillRuns.find((skill) => skill.id === "guard_claim_evidence")
        ?.limitations,
    ).toContain("claim_sources_not_explicit");
    expect(
      plan.skillRuns.find((skill) => skill.id === "resolve_mockup_brand")
        ?.limitations,
    ).toEqual(
      expect.arrayContaining([
        "brand_palette_not_fully_verified",
        "brand_logo_not_materialized",
      ]),
    );
    expect(
      plan.skillRuns
        .find((skill) => skill.id === "audit_mockup_dataflow")
        ?.checks?.every((check) => check.passed),
    ).toBe(true);
    expect(plan.motion.source).toBe("safe-default");
    expect(
      plan.skillRuns.find((skill) => skill.id === "compose_brand_motion")
        ?.limitations,
    ).toContain("motion_brand_signals_incomplete");
  });

  it("gives energetic brands more tempo without changing the safe reduced-motion path", () => {
    const plan = buildBrandBasedMockupPlan({
      companyName: "Tempo",
      title: "Klar for neste økt",
      caption: "Et energisk kampanjekonsept.",
      callToAction: "Bli med",
      concept: "product_highlight",
      mediaType: "reel",
      toneOfVoice: "Energisk, leken og ung",
      visualStyle: "Dynamisk og vibrant",
      industry: "Sport",
      sourceEvidence: ["planningDraft.brandGuide"],
    });

    expect(plan.motion).toEqual(
      expect.objectContaining({
        profile: "energetic-social",
        source: "brand-guide",
        easing: "out",
        bpm: 112,
        reducedMotion: "fade",
      }),
    );
    expect(plan.motion.revealDistance).toBeGreaterThan(14);
    expect(plan.motion.overshoot).toBeGreaterThan(0);
  });

  it("keeps one high-quality character identity across campaign posts", () => {
    const shared = {
      companyName: "MedSide",
      caption: "Dokumentert research.",
      callToAction: "Les mer",
      concept: "product_highlight",
      mediaType: "image" as const,
      industry: "Helseteknologi og programvare",
      sourceEvidence: ["companyProfile.offerings"],
    };
    const first = buildBrandBasedMockupPlan({ ...shared, title: "Før timen" });
    const second = buildBrandBasedMockupPlan({
      ...shared,
      title: "Etter timen",
    });

    expect(first.figure.consistencyKey).toBe(second.figure.consistencyKey);
    expect(first.figure.qualityCriteria).toEqual(
      expect.arrayContaining([
        "natural-proportions",
        "expressive-face",
        "natural-hands",
        "subsurface-skin-depth",
        "strand-and-fabric-detail",
        "three-point-cinematic-lighting",
        "brand-color-integration",
        "original-character-design",
      ]),
    );
    expect(first.figure.seed).toBe(second.figure.seed);
  });
});

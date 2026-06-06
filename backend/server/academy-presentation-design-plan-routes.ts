/**
 * Academy → presentation/design-plan.
 *
 * AI-route som genererer en komplett design-plan for en presentasjons-
 * deck: anbefalt template, visual theme, display mode, split layout
 * variant + ferdige slide-planer per slide. Heuristisk grammar-engine
 * v2 kjøres alltid; LLM (HuggingFace / OpenAI) via `TryLlmDesignPlan`
 * forsterker resultatet når token er tilgjengelig.
 *
 * Ekstrahert fra `index.ts`. Hele `academyPresentation*`-engine-clusteret
 * (79 symbols, ~10k linjer) bor fortsatt i index.ts; vi dep-injecter de
 * 16 symbolene route-bodyen faktisk leser, med eksakt impl-signatur.
 */
import type { Application, Request, Response } from "express";

import { ACADEMY_PRESENTATION_THEME_TOKENS } from "../../frontend/shared/academy-presentation-design-system.js";
import { readBoolean, readString } from "./_shared.js";
import type {
  AcademyPresentationBrandContext,
  AcademyPresentationDesignSlideInput,
  AcademyPresentationDesignSlidePlan,
  AcademyPresentationDisplayMode,
  AcademyPresentationScope,
  AcademyPresentationSplitLayoutVariant,
  AcademyPresentationTemplateId,
  AcademyPresentationTemplateMemoryItem,
  AcademyPresentationTemplateMemoryMatch,
  AcademyPresentationTemplateMemoryMeta,
  AcademyPresentationVisualThemeId,
  AcademyPresentationVisualType,
} from "./index.js";

type AcademySession = {
  user: { id: string };
};

type AcademySessionRequirement = "authenticated" | "instructor";

interface SlidePlanBuilderParams {
  slide: AcademyPresentationDesignSlideInput;
  index: number;
  totalSlides: number;
  useNorwegian: boolean;
  visualType: AcademyPresentationVisualType;
  confidence: number;
  reasons: string[];
  intentTags: string[];
}

interface TemplateMemoryQueryParams {
  deckName: string;
  projectTemplateId: string;
  slides: AcademyPresentationDesignSlideInput[];
}

interface ResolveTemplateMemoryParams {
  query: string;
  items: AcademyPresentationTemplateMemoryItem[];
}

interface ResolveTemplateMemoryResult {
  matches: AcademyPresentationTemplateMemoryMatch[];
  meta: AcademyPresentationTemplateMemoryMeta;
}

interface LlmDesignPlanParams {
  scope: AcademyPresentationScope;
  courseId: string;
  lessonId: string;
  deckName: string;
  projectTemplateId: string;
  useNorwegian: boolean;
  slides: AcademyPresentationDesignSlideInput[];
  recommendedTemplateId: AcademyPresentationTemplateId;
  recommendedVisualThemeId: AcademyPresentationVisualThemeId;
  recommendedDisplayMode: AcademyPresentationDisplayMode;
  recommendedSplitLayoutVariant: AcademyPresentationSplitLayoutVariant;
  heuristicSlides: AcademyPresentationDesignSlidePlan[];
  templateMemory: AcademyPresentationTemplateMemoryItem[];
  brandContext: AcademyPresentationBrandContext | null;
  repairFocus: string[];
}

interface LlmDesignPlanResult {
  recommendedTemplateId: AcademyPresentationTemplateId;
  recommendedVisualThemeId: AcademyPresentationVisualThemeId;
  recommendedDisplayMode: AcademyPresentationDisplayMode;
  recommendedSplitLayoutVariant: AcademyPresentationSplitLayoutVariant;
  slides: AcademyPresentationDesignSlidePlan[];
  model: string;
  provider: "huggingface" | "openai";
  templateMatches: AcademyPresentationTemplateMemoryMatch[];
  retrievalMeta: AcademyPresentationTemplateMemoryMeta;
}

export interface AcademyPresentationDesignPlanRoutesDeps {
  app: Application;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
  academyPresentationIsRecord: (
    value: unknown,
  ) => value is Record<string, unknown>;
  academyPresentationNormalizeTemplateId: (
    value: unknown,
  ) => AcademyPresentationTemplateId | null;
  academyPresentationNormalizeThemeId: (
    value: unknown,
  ) => AcademyPresentationVisualThemeId | null;
  academyPresentationNormalizeTemplateMemoryItem: (
    value: unknown,
    index: number,
  ) => AcademyPresentationTemplateMemoryItem | null;
  academyPresentationNormalizeBrandContext: (
    value: unknown,
  ) => AcademyPresentationBrandContext | null;
  academyPresentationNormalizeSlideInput: (
    value: unknown,
    index: number,
  ) => AcademyPresentationDesignSlideInput | null;
  academyPresentationInferTemplateFromSlides: (
    slides: AcademyPresentationDesignSlideInput[],
  ) => AcademyPresentationTemplateId;
  academyPresentationInferThemeFromTemplate: (
    templateId: AcademyPresentationTemplateId,
  ) => AcademyPresentationVisualThemeId;
  academyPresentationBuildBodyLines: (
    slide: AcademyPresentationDesignSlideInput,
    useNorwegian: boolean,
  ) => string[];
  academyPresentationInferVisualType: (
    text: string,
    index: number,
    totalSlides: number,
  ) => { type: AcademyPresentationVisualType; score: number; reason: string };
  academyPresentationBuildSlidePlan: (
    params: SlidePlanBuilderParams,
  ) => AcademyPresentationDesignSlidePlan;
  academyPresentationBuildTemplateMemoryQuery: (
    params: TemplateMemoryQueryParams,
  ) => string;
  academyPresentationResolveTemplateMemoryMatches: (
    params: ResolveTemplateMemoryParams,
  ) => Promise<ResolveTemplateMemoryResult>;
  academyPresentationTryLlmDesignPlan: (
    params: LlmDesignPlanParams,
  ) => Promise<LlmDesignPlanResult | null>;
  /** ACADEMY_PRESENTATION_PROJECT_TO_TEMPLATE — Record<string, TemplateId> */
  ACADEMY_PRESENTATION_PROJECT_TO_TEMPLATE: Record<
    string,
    AcademyPresentationTemplateId
  >;
  /** ACADEMY_PRESENTATION_PROJECT_TO_THEME — Record<string, VisualThemeId> */
  ACADEMY_PRESENTATION_PROJECT_TO_THEME: Record<
    string,
    AcademyPresentationVisualThemeId
  >;
  /** Per-template defaults for display-mode + split-layout-variant. */
  ACADEMY_PRESENTATION_TEMPLATE_PRESETS: Record<
    AcademyPresentationTemplateId,
    {
      defaultMode: AcademyPresentationDisplayMode;
      splitLayoutVariant: AcademyPresentationSplitLayoutVariant;
    }
  >;
  /** Per-theme override for split-layout-variant. */
  ACADEMY_PRESENTATION_THEME_TO_SPLIT_VARIANT: Record<
    AcademyPresentationVisualThemeId,
    AcademyPresentationSplitLayoutVariant
  >;
}

export function setupAcademyPresentationDesignPlanRoutes(
  deps: AcademyPresentationDesignPlanRoutesDeps,
): void {
  const {
    app,
    requireAcademySession,
    academyPresentationIsRecord,
    academyPresentationNormalizeTemplateId,
    academyPresentationNormalizeThemeId,
    academyPresentationNormalizeTemplateMemoryItem,
    academyPresentationNormalizeBrandContext,
    academyPresentationNormalizeSlideInput,
    academyPresentationInferTemplateFromSlides,
    academyPresentationInferThemeFromTemplate,
    academyPresentationBuildBodyLines,
    academyPresentationInferVisualType,
    academyPresentationBuildSlidePlan,
    academyPresentationBuildTemplateMemoryQuery,
    academyPresentationResolveTemplateMemoryMatches,
    academyPresentationTryLlmDesignPlan,
    ACADEMY_PRESENTATION_PROJECT_TO_TEMPLATE,
    ACADEMY_PRESENTATION_PROJECT_TO_THEME,
    ACADEMY_PRESENTATION_TEMPLATE_PRESETS,
    ACADEMY_PRESENTATION_THEME_TO_SPLIT_VARIANT,
  } = deps;

  app.post("/api/academy/presentation/design-plan", async (req, res) => {
    try {
      if (!(await requireAcademySession(req, res, "instructor"))) {
        return;
      }
      const body = academyPresentationIsRecord(req.body) ? req.body : {};
      const scope: AcademyPresentationScope =
        readString(body.scope) === "skill" ? "skill" : "course";
      const courseId = String(readString(body.courseId) || "");
      const lessonId = String(readString(body.lessonId) || "");
      const projectTemplateId = String(
        readString(body.projectTemplateId) || "",
      ).toLowerCase();
      const useNorwegian = readBoolean(body.useNorwegian) === true;
      const deckName = String(readString(body.deckName) || "").trim();
      const requestedTemplate = academyPresentationNormalizeTemplateId(
        body.deckTemplate,
      );
      const requestedTheme = academyPresentationNormalizeThemeId(
        body.deckVisualThemeId,
      );
      const templateMemory = Array.isArray(body.templateMemory)
        ? body.templateMemory
            .map((entry, index) =>
              academyPresentationNormalizeTemplateMemoryItem(entry, index),
            )
            .filter((entry): entry is AcademyPresentationTemplateMemoryItem =>
              Boolean(entry),
            )
            .slice(0, 80)
        : [];
      const brandContext = academyPresentationNormalizeBrandContext(
        body.brandContext,
      );
      const repairFocus = Array.isArray(body.repairFocus)
        ? body.repairFocus
            .map((entry) =>
              String(readString(entry) || "")
                .trim()
                .slice(0, 220),
            )
            .filter(Boolean)
            .slice(0, 12)
        : [];

      const slides = Array.isArray(body.slides)
        ? body.slides
            .map((entry, index) =>
              academyPresentationNormalizeSlideInput(entry, index),
            )
            .filter((entry): entry is AcademyPresentationDesignSlideInput =>
              Boolean(entry),
            )
        : [];

      if (slides.length === 0) {
        return res.status(400).json({
          success: false,
          error: "slides is required",
        });
      }

      const projectTemplate =
        ACADEMY_PRESENTATION_PROJECT_TO_TEMPLATE[projectTemplateId];
      const inferredTemplate = academyPresentationInferTemplateFromSlides(slides);
      const recommendedTemplateId =
        projectTemplate || requestedTemplate || inferredTemplate || "walkthrough";
      const recommendedVisualThemeId =
        ACADEMY_PRESENTATION_PROJECT_TO_THEME[projectTemplateId] ||
        requestedTheme ||
        academyPresentationInferThemeFromTemplate(recommendedTemplateId);
      const templatePreset =
        ACADEMY_PRESENTATION_TEMPLATE_PRESETS[recommendedTemplateId];

      const visualCounts: Record<AcademyPresentationVisualType, number> = {
        title: 0,
        agenda: 0,
        problem: 0,
        solution: 0,
        feature: 0,
        process: 0,
        kpi: 0,
        timeline: 0,
        roadmap: 0,
        architecture: 0,
        scenario: 0,
        "knowledge-check": 0,
        comparison: 0,
        demo: 0,
        quote: 0,
        cta: 0,
        summary: 0,
      };
      const layoutCounts: Record<AcademyPresentationDisplayMode, number> = {
        "picture-in-picture": 0,
        "side-panel": 0,
        "split-screen": 0,
        "full-frame": 0,
      };

      const slidePlans: AcademyPresentationDesignSlidePlan[] = slides.map(
        (slide, index) => {
          const bodyLines = academyPresentationBuildBodyLines(
            slide,
            useNorwegian,
          );
          const classification = academyPresentationInferVisualType(
            `${slide.title} ${bodyLines.join(" ")} ${slide.speakerNotes}`,
            index,
            slides.length,
          );
          const visualType = classification.type;
          visualCounts[visualType] += 1;
          const intentTags = [
            visualType,
            recommendedTemplateId,
            recommendedVisualThemeId,
          ];
          const reasons = [
            classification.reason,
            `slide ${index + 1}/${slides.length}`,
            `duration ${Math.round(slide.duration)}s`,
          ];
          const slidePlan = academyPresentationBuildSlidePlan({
            slide,
            index,
            totalSlides: slides.length,
            useNorwegian,
            visualType,
            confidence: classification.score,
            reasons,
            intentTags,
          });
          layoutCounts[slidePlan.recommendedLayout] += 1;
          slidePlan.intentTags = [
            ...slidePlan.intentTags,
            slidePlan.recommendedLayout,
          ];
          return slidePlan;
        },
      );

      let heuristicRecommendedDisplayMode: AcademyPresentationDisplayMode =
        templatePreset.defaultMode;
      let bestLayoutScore = -1;
      (Object.keys(layoutCounts) as AcademyPresentationDisplayMode[]).forEach(
        (layout) => {
          const score = layoutCounts[layout];
          if (score > bestLayoutScore) {
            bestLayoutScore = score;
            heuristicRecommendedDisplayMode = layout;
          }
        },
      );

      let finalTemplateId = recommendedTemplateId;
      let finalVisualThemeId = recommendedVisualThemeId;
      let finalDisplayMode = heuristicRecommendedDisplayMode;
      let finalSplitLayoutVariant =
        ACADEMY_PRESENTATION_THEME_TO_SPLIT_VARIANT[recommendedVisualThemeId] ||
        templatePreset.splitLayoutVariant;
      let finalSlides = slidePlans;
      let generatedBy = "academy-design-plan-grammar-engine-v2";
      let generatedModel = "";
      let generatedProvider: "huggingface" | "openai" | "rule-engine" =
        "rule-engine";
      const localTemplateMemoryContext =
        await academyPresentationResolveTemplateMemoryMatches({
          query: academyPresentationBuildTemplateMemoryQuery({
            deckName,
            projectTemplateId,
            slides,
          }),
          items: templateMemory,
        });
      let templateMatches: AcademyPresentationTemplateMemoryMatch[] =
        localTemplateMemoryContext.matches;
      let retrievalMeta: AcademyPresentationTemplateMemoryMeta =
        localTemplateMemoryContext.meta;

      const llmPlan = await academyPresentationTryLlmDesignPlan({
        scope,
        courseId,
        lessonId,
        deckName,
        projectTemplateId,
        useNorwegian,
        slides,
        recommendedTemplateId: finalTemplateId,
        recommendedVisualThemeId: finalVisualThemeId,
        recommendedDisplayMode: finalDisplayMode,
        recommendedSplitLayoutVariant: finalSplitLayoutVariant,
        heuristicSlides: slidePlans,
        templateMemory,
        brandContext,
        repairFocus,
      });
      if (llmPlan) {
        finalTemplateId = llmPlan.recommendedTemplateId;
        finalVisualThemeId = llmPlan.recommendedVisualThemeId;
        finalDisplayMode = llmPlan.recommendedDisplayMode;
        finalSplitLayoutVariant = llmPlan.recommendedSplitLayoutVariant;
        finalSlides = llmPlan.slides;
        generatedBy = "academy-design-plan-orchestrator-v2";
        generatedModel = llmPlan.model;
        generatedProvider = llmPlan.provider;
        templateMatches = llmPlan.templateMatches;
        retrievalMeta = llmPlan.retrievalMeta;
      }

      const grammarCounts = finalSlides.reduce(
        (acc, slidePlan) => {
          acc[slidePlan.grammarId] = (acc[slidePlan.grammarId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const repairActionsCount = finalSlides.reduce(
        (acc, slidePlan) => acc + slidePlan.repairActions.length,
        0,
      );

      const responsePayload = {
        success: true,
        data: {
          scope,
          courseId,
          lessonId: scope === "skill" ? lessonId : "",
          deckName,
          recommendedTemplateId: finalTemplateId,
          recommendedVisualThemeId: finalVisualThemeId,
          recommendedDisplayMode: finalDisplayMode,
          recommendedSplitLayoutVariant: finalSplitLayoutVariant,
          summary: {
            generatedBy,
            provider: generatedProvider,
            model: generatedModel || undefined,
            slideCount: slides.length,
            visualCounts,
            grammarCounts,
            repairActionsCount,
            templateMemoryMatches: templateMatches,
            retrievalMeta,
            brandContextName: brandContext?.name || undefined,
            pipeline: [
              "brief-to-narrative",
              "template-memory-retrieval",
              "narrative-to-slide-plan",
              "grammar-budget-repair",
              "theme-token-apply",
            ],
          },
          brandTokens: ACADEMY_PRESENTATION_THEME_TOKENS[finalVisualThemeId],
          slides: finalSlides,
          generatedAt: new Date().toISOString(),
        },
      };

      return res.status(200).json(responsePayload);
    } catch (error) {
      console.error("Error generating academy presentation design plan:", error);
      return res.status(500).json({
        success: false,
        error: "Could not generate presentation design plan",
      });
    }
  });
}

/**
 * Academy → curriculum/foundation-assistant.
 *
 * AI-route som genererer "Foundation" – det første nivået av en kurs-
 * arkitektur (purpose, audience, outcomes, taxonomy m.m.) basert på
 * spørsmåls-svar-flyten i Academy. Bruker Qwen via HuggingFace når
 * token er konfigurert, faller tilbake til deterministisk regel-engine
 * ellers.
 *
 * Ekstrahert fra `index.ts`. Selve normaliserings-/AI-helperne bor
 * fortsatt i index.ts og injecteres som deps fordi de er tett
 * koblet til en større `academyCurriculum*`-cluster.
 */
import type { Application, Request, Response } from "express";

import { readBoolean, readString } from "./_shared.js";
import type {
  AcademyCurriculumFoundationAnswer,
  AcademyCurriculumFoundationArchitecture,
  AcademyCurriculumFoundationAssistantResult,
  AcademyCurriculumFoundationTemplateMemoryItem,
  AcademyCurriculumIndustryProfileId,
} from "./index.js";

type AcademySession = {
  user: { id: string };
};

type AcademySessionRequirement = "authenticated" | "instructor";

interface CurriculumFoundationFallbackParams {
  courseTitle: string;
  useNorwegian: boolean;
  answers: AcademyCurriculumFoundationAnswer[];
  currentArchitecture: AcademyCurriculumFoundationArchitecture;
  manualIndustryProfile?: AcademyCurriculumIndustryProfileId;
  templateMemory: AcademyCurriculumFoundationTemplateMemoryItem[];
}

interface CurriculumFoundationQwenParams {
  courseTitle: string;
  currentArchitecture: AcademyCurriculumFoundationArchitecture;
  useNorwegian: boolean;
  answers: AcademyCurriculumFoundationAnswer[];
  fallback: AcademyCurriculumFoundationAssistantResult;
  templateMemory: AcademyCurriculumFoundationTemplateMemoryItem[];
}

interface CurriculumShouldResetParams {
  answers: AcademyCurriculumFoundationAnswer[];
  courseTitle: string;
  currentArchitecture: AcademyCurriculumFoundationArchitecture;
}

export interface AcademyCurriculumRoutesDeps {
  app: Application;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
  academyPresentationIsRecord: (
    value: unknown,
  ) => value is Record<string, unknown>;
  academyCurriculumTrimText: (value: unknown, max?: number) => string;
  academyCurriculumNormalizeAnswers: (
    value: unknown,
  ) => AcademyCurriculumFoundationAnswer[];
  academyCurriculumNormalizeIndustryProfileId: (
    value: unknown,
  ) => AcademyCurriculumIndustryProfileId | null;
  academyCurriculumInferIndustryProfile: (
    value: string,
  ) => AcademyCurriculumIndustryProfileId;
  academyCurriculumNormalizeTemplateMemory: (
    value: unknown,
  ) => AcademyCurriculumFoundationTemplateMemoryItem[];
  academyCurriculumNormalizeArchitecture: (
    value: unknown,
    fallback?: Partial<AcademyCurriculumFoundationArchitecture>,
  ) => AcademyCurriculumFoundationArchitecture;
  academyCurriculumShouldResetCurrentArchitecture: (
    params: CurriculumShouldResetParams,
  ) => boolean;
  academyCurriculumBuildFoundationFallback: (
    params: CurriculumFoundationFallbackParams,
  ) => Promise<AcademyCurriculumFoundationAssistantResult>;
  academyCurriculumTryQwenFoundationAssistant: (
    params: CurriculumFoundationQwenParams,
  ) => Promise<AcademyCurriculumFoundationAssistantResult | null>;
}

export function setupAcademyCurriculumRoutes(
  deps: AcademyCurriculumRoutesDeps,
): void {
  const {
    app,
    requireAcademySession,
    academyPresentationIsRecord,
    academyCurriculumTrimText,
    academyCurriculumNormalizeAnswers,
    academyCurriculumNormalizeIndustryProfileId,
    academyCurriculumInferIndustryProfile,
    academyCurriculumNormalizeTemplateMemory,
    academyCurriculumNormalizeArchitecture,
    academyCurriculumShouldResetCurrentArchitecture,
    academyCurriculumBuildFoundationFallback,
    academyCurriculumTryQwenFoundationAssistant,
  } = deps;

  app.post("/api/academy/curriculum/foundation-assistant", async (req, res) => {
    try {
      if (!(await requireAcademySession(req, res, "instructor"))) {
        return;
      }
      const body = academyPresentationIsRecord(req.body) ? req.body : {};
      const useNorwegian = readBoolean(body.useNorwegian) === true;
      const courseTitle = academyCurriculumTrimText(body.courseTitle, 220);
      const provider = String(
        readString(body.provider) ||
          readString(process.env.ACADEMY_CURRICULUM_FOUNDATION_PROVIDER) ||
          "auto",
      )
        .trim()
        .toLowerCase();
      const answers = academyCurriculumNormalizeAnswers(body.answers);
      const manualIndustryProfile = ((): AcademyCurriculumIndustryProfileId | undefined => {
        const normalized = academyCurriculumTrimText(
          body.manualIndustryProfile,
          64,
        );
        if (!normalized) return undefined;
        const explicit =
          academyCurriculumNormalizeIndustryProfileId(normalized);
        if (explicit) return explicit;
        const inferred = academyCurriculumInferIndustryProfile(normalized);
        return inferred === "generic" ? undefined : inferred;
      })();
      const templateMemory = academyCurriculumNormalizeTemplateMemory(
        body.templateMemory,
      );
      const currentArchitecture = academyCurriculumNormalizeArchitecture(
        body.currentArchitecture,
      );
      const currentArchitectureForGeneration =
        academyCurriculumShouldResetCurrentArchitecture({
          answers,
          courseTitle,
          currentArchitecture,
        })
          ? academyCurriculumNormalizeArchitecture({})
          : currentArchitecture;

      const fallback = await academyCurriculumBuildFoundationFallback({
        courseTitle,
        useNorwegian,
        answers,
        currentArchitecture: currentArchitectureForGeneration,
        manualIndustryProfile,
        templateMemory,
      });

      const shouldTryQwen =
        provider === "qwen" ||
        provider === "huggingface" ||
        provider === "hf" ||
        ((provider === "auto" || provider === "") &&
          answers.length >= 2 &&
          fallback.domainResolution.confidence >= 0.58 &&
          !fallback.domainResolution.needsConfirmation);
      const llmResult = shouldTryQwen
        ? await academyCurriculumTryQwenFoundationAssistant({
            courseTitle,
            currentArchitecture: currentArchitectureForGeneration,
            useNorwegian,
            answers,
            fallback,
            templateMemory,
          })
        : null;

      const result = llmResult || fallback;

      return res.status(200).json({
        success: true,
        data: {
          completed: result.completed,
          totalQuestions: result.totalQuestions,
          answeredCount: result.answeredCount,
          answers: result.answers,
          nextQuestion: result.nextQuestion,
          recommendation: result.recommendation,
          progress: result.progress,
          sectionRationales: result.sectionRationales,
          meta: {
            provider: result.provider,
            model: result.model || undefined,
            industryProfile: result.industryProfile,
            domainResolution: result.domainResolution,
            generationStage: result.generationStage,
            templateMatch: result.templateMatch,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error(
        "Error generating academy curriculum foundation suggestion:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: "Could not generate curriculum foundation suggestion",
      });
    }
  });
}

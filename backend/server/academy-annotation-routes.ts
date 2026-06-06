/**
 * Academy → annotation/recommendations.
 *
 * AI-routen som genererer annotation-forslag (hotspot/callout/note/quiz)
 * for video-lessons. Bruker Qwen via HuggingFace når token er konfigurert,
 * faller tilbake til heuristisk generator ellers.
 *
 * Ekstrahert fra `index.ts`. Selve generator-funksjonene (Qwen-kall +
 * heuristisk fallback) bor fortsatt i index.ts og injecteres som deps.
 */
import type { Application, Request, Response } from "express";

import { readBoolean, readNumber, readString } from "./_shared.js";
import type { AcademyAnnotationRecommendationItem } from "./index.js";

type AcademySession = {
  user: { id: string };
};

type AcademySessionRequirement = "authenticated" | "instructor";

interface AcademyAnnotationFallbackParams {
  intent: string;
  useNorwegian: boolean;
  videoDuration: number;
}

interface AcademyAnnotationQwenParams {
  intent: string;
  useNorwegian: boolean;
  videoDuration: number;
  maxItems: number;
  summary: string;
  courseTitle: string;
  lessonTitle: string;
  scope: string;
}

export interface AcademyAnnotationRoutesDeps {
  app: Application;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
  academyPresentationIsRecord: (value: unknown) => value is Record<string, unknown>;
  academyPresentationClamp: (value: number, min: number, max: number) => number;
  academyAnnotationFallbackRecommendations: (
    params: AcademyAnnotationFallbackParams,
  ) => AcademyAnnotationRecommendationItem[];
  academyAnnotationTryQwenRecommendations: (
    params: AcademyAnnotationQwenParams,
  ) => Promise<{
    recommendations: AcademyAnnotationRecommendationItem[];
    model: string;
  } | null>;
}

export function setupAcademyAnnotationRoutes(
  deps: AcademyAnnotationRoutesDeps,
): void {
  const {
    app,
    requireAcademySession,
    academyPresentationIsRecord,
    academyPresentationClamp,
    academyAnnotationFallbackRecommendations,
    academyAnnotationTryQwenRecommendations,
  } = deps;

  app.post("/api/academy/annotation/recommendations", async (req, res) => {
    try {
      if (!(await requireAcademySession(req, res, "instructor"))) {
        return;
      }
      const body = academyPresentationIsRecord(req.body) ? req.body : {};
      const intent = String(readString(body.intent) || "interactive-lesson")
        .trim()
        .toLowerCase();
      const scope = String(readString(body.scope) || "course")
        .trim()
        .toLowerCase();
      const useNorwegian = readBoolean(body.useNorwegian) === true;
      const courseTitle = String(readString(body.courseTitle) || "")
        .trim()
        .slice(0, 220);
      const lessonTitle = String(readString(body.lessonTitle) || "")
        .trim()
        .slice(0, 220);
      const summary = String(readString(body.summary) || "")
        .trim()
        .slice(0, 7000);
      const videoDuration = academyPresentationClamp(
        Number(readNumber(body.videoDuration) || 300),
        20,
        7200,
      );
      const maxItems = academyPresentationClamp(
        Number(readNumber(body.maxItems) || 6),
        1,
        10,
      );
      const provider = String(
        readString(body.provider) ||
          readString(process.env.ACADEMY_ANNOTATION_RECOMMENDATION_PROVIDER) ||
          "qwen",
      )
        .trim()
        .toLowerCase();

      const shouldTryQwen =
        provider === "qwen" || provider === "huggingface" || provider === "hf";
      const llmResult = shouldTryQwen
        ? await academyAnnotationTryQwenRecommendations({
            intent,
            scope,
            useNorwegian,
            videoDuration,
            maxItems,
            courseTitle,
            lessonTitle,
            summary,
          })
        : null;

      const fallback = academyAnnotationFallbackRecommendations({
        intent,
        useNorwegian,
        videoDuration,
      }).slice(0, maxItems);

      const recommendations = llmResult?.recommendations?.length
        ? llmResult.recommendations
        : fallback;

      return res.status(200).json({
        success: true,
        data: {
          intent,
          scope,
          recommendations,
          meta: {
            provider: llmResult ? "qwen" : "heuristic",
            model: llmResult?.model || undefined,
            generatedAt: new Date().toISOString(),
            videoDuration,
            maxItems,
          },
        },
      });
    } catch (error) {
      console.error(
        "Error generating academy annotation recommendations:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: "Could not generate annotation recommendations",
      });
    }
  });
}

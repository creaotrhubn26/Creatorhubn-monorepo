/**
 * Academy → presentation/critique.
 *
 * AI-route som vurderer en presentasjon (deck) langs flere akser
 * (narrative, pedagogy, design, visuals, brand) og returnerer en samlet
 * critique. Heuristisk baseline kjøres alltid; Qwen-VL via HuggingFace
 * brukes til å forsterke critique når token er tilgjengelig.
 *
 * Ekstrahert fra `index.ts`. Heuristikk + LLM-call bor fortsatt i
 * index.ts og injecteres som deps.
 */
import type { Application, Request, Response } from "express";

import { readBoolean, readString } from "./_shared.js";
import type {
  AcademyPresentationBrandContext,
  AcademyPresentationCritiqueResult,
  AcademyPresentationCritiqueSlideInput,
  AcademyPresentationScope,
} from "./index.js";

type AcademySession = {
  user: { id: string };
};

type AcademySessionRequirement = "authenticated" | "instructor";

interface CritiqueHeuristicParams {
  slides: AcademyPresentationCritiqueSlideInput[];
  useNorwegian: boolean;
  brandContext: AcademyPresentationBrandContext | null;
}

interface CritiqueHuggingFaceParams {
  slides: AcademyPresentationCritiqueSlideInput[];
  deckName: string;
  scope: AcademyPresentationScope;
  projectTemplateId: string;
  useNorwegian: boolean;
  brandContext: AcademyPresentationBrandContext | null;
  heuristic: AcademyPresentationCritiqueResult;
}

export interface AcademyPresentationCritiqueRoutesDeps {
  app: Application;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
  academyPresentationIsRecord: (
    value: unknown,
  ) => value is Record<string, unknown>;
  academyPresentationNormalizeBrandContext: (
    value: unknown,
  ) => AcademyPresentationBrandContext | null;
  academyPresentationNormalizeCritiqueSlideInput: (
    value: unknown,
    index: number,
  ) => AcademyPresentationCritiqueSlideInput | null;
  academyPresentationBuildHeuristicCritique: (
    params: CritiqueHeuristicParams,
  ) => AcademyPresentationCritiqueResult;
  academyPresentationTryHuggingFaceCritique: (
    params: CritiqueHuggingFaceParams,
  ) => Promise<AcademyPresentationCritiqueResult | null>;
}

export function setupAcademyPresentationCritiqueRoutes(
  deps: AcademyPresentationCritiqueRoutesDeps,
): void {
  const {
    app,
    requireAcademySession,
    academyPresentationIsRecord,
    academyPresentationNormalizeBrandContext,
    academyPresentationNormalizeCritiqueSlideInput,
    academyPresentationBuildHeuristicCritique,
    academyPresentationTryHuggingFaceCritique,
  } = deps;

  app.post("/api/academy/presentation/critique", async (req, res) => {
    try {
      if (!(await requireAcademySession(req, res, "instructor"))) {
        return;
      }
      const body = academyPresentationIsRecord(req.body) ? req.body : {};
      const scope: AcademyPresentationScope =
        readString(body.scope) === "skill" ? "skill" : "course";
      const projectTemplateId = String(
        readString(body.projectTemplateId) || "",
      ).toLowerCase();
      const useNorwegian = readBoolean(body.useNorwegian) === true;
      const deckName =
        String(readString(body.deckName) || "").trim() || "Presentation";
      const brandContext = academyPresentationNormalizeBrandContext(
        body.brandContext,
      );
      const slides = Array.isArray(body.slides)
        ? body.slides
            .map((entry, index) =>
              academyPresentationNormalizeCritiqueSlideInput(entry, index),
            )
            .filter((entry): entry is AcademyPresentationCritiqueSlideInput =>
              Boolean(entry),
            )
            .slice(0, 16)
        : [];

      if (slides.length === 0) {
        return res.status(400).json({
          success: false,
          error: "slides is required",
        });
      }

      const heuristic = academyPresentationBuildHeuristicCritique({
        slides,
        useNorwegian,
        brandContext,
      });
      const critique =
        (await academyPresentationTryHuggingFaceCritique({
          slides,
          deckName,
          scope,
          projectTemplateId,
          useNorwegian,
          brandContext,
          heuristic,
        })) || heuristic;

      return res.status(200).json({
        success: true,
        data: {
          scope,
          deckName,
          provider: critique.provider,
          model: critique.model,
          overall: critique.overall,
          narrative: critique.narrative,
          pedagogy: critique.pedagogy,
          design: critique.design,
          visuals: critique.visuals,
          brand: critique.brand,
          findings: critique.findings,
          generatedAt: new Date().toISOString(),
          pipeline:
            critique.provider === "huggingface"
              ? [
                  "heuristic-baseline",
                  "qwen-vl-critique",
                  "text-fallback-if-needed",
                ]
              : ["heuristic-baseline"],
        },
      });
    } catch (error) {
      console.error("Error generating academy presentation critique:", error);
      return res.status(500).json({
        success: false,
        error: "Could not critique presentation deck",
      });
    }
  });
}

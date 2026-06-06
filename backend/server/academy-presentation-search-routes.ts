/**
 * Academy → presentation/semantic-search.
 *
 * AI-route som rangerer en liste presentasjons-elementer mot et tekst-
 * søk. Lexical baseline kjøres alltid; HuggingFace embedding +
 * reranker forsterker rangeringen når token er konfigurert.
 *
 * Ekstrahert fra `index.ts`. Selve normaliserings-/scoring-/LLM-call-
 * funksjonene bor fortsatt i index.ts og injecteres som deps.
 */
import type { Application, Request, Response } from "express";

import { readNumber, readString } from "./_shared.js";
import type { AcademyPresentationSemanticSearchItem } from "./index.js";

type AcademySession = {
  user: { id: string };
};

type AcademySessionRequirement = "authenticated" | "instructor";

interface HfEmbeddingsParams {
  token: string;
  model: string;
  inputs: string[];
}

interface HfRerankerParams {
  token: string;
  model: string;
  query: string;
  documents: string[];
}

export interface AcademyPresentationSearchRoutesDeps {
  app: Application;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
  academyPresentationIsRecord: (
    value: unknown,
  ) => value is Record<string, unknown>;
  academyPresentationClamp: (value: number, min: number, max: number) => number;
  academyPresentationNormalizeSemanticSearchItem: (
    value: unknown,
    index: number,
  ) => AcademyPresentationSemanticSearchItem | null;
  academyPresentationNormalizeTokenSet: (query: string) => string[];
  academyPresentationScoreLexicalMatch: (
    item: AcademyPresentationSemanticSearchItem,
    query: string,
    queryTokens: string[],
  ) => number;
  academyPresentationCosineSimilarity: (a: number[], b: number[]) => number;
  academyPresentationNormalizeScoreSeries: (values: number[]) => number[];
  academyPresentationRequestHfEmbeddings: (
    params: HfEmbeddingsParams,
  ) => Promise<number[][] | null>;
  academyPresentationRequestHfRerankerScores: (
    params: HfRerankerParams,
  ) => Promise<number[] | null>;
}

export function setupAcademyPresentationSearchRoutes(
  deps: AcademyPresentationSearchRoutesDeps,
): void {
  const {
    app,
    requireAcademySession,
    academyPresentationIsRecord,
    academyPresentationClamp,
    academyPresentationNormalizeSemanticSearchItem,
    academyPresentationNormalizeTokenSet,
    academyPresentationScoreLexicalMatch,
    academyPresentationCosineSimilarity,
    academyPresentationNormalizeScoreSeries,
    academyPresentationRequestHfEmbeddings,
    academyPresentationRequestHfRerankerScores,
  } = deps;

  app.post("/api/academy/presentation/semantic-search", async (req, res) => {
    try {
      if (!(await requireAcademySession(req, res, "instructor"))) {
        return;
      }
      const body = academyPresentationIsRecord(req.body) ? req.body : {};
      const query = String(readString(body.query) || "")
        .trim()
        .slice(0, 220);
      if (query.length < 2) {
        return res
          .status(400)
          .json({
            success: false,
            error: "query must have at least 2 characters",
          });
      }

      const requestedLimit = academyPresentationClamp(
        Number(readNumber(body.limit) || 12),
        1,
        60,
      );
      const items = Array.isArray(body.items)
        ? body.items
            .map((entry, index) =>
              academyPresentationNormalizeSemanticSearchItem(entry, index),
            )
            .filter((entry): entry is AcademyPresentationSemanticSearchItem =>
              Boolean(entry),
            )
            .slice(0, 180)
        : [];
      if (items.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            query,
            ranking: [],
            meta: { provider: "lexical", totalItems: 0 },
          },
        });
      }

      const queryTokens = academyPresentationNormalizeTokenSet(query);
      const lexicalScores = items.map((item) =>
        academyPresentationScoreLexicalMatch(item, query, queryTokens),
      );
      let semanticScores = items.map(() => 0);
      let rerankerScores: number[] | null = null;
      let usedEmbeddingModel = "";
      let usedRerankerModel = "";

      const huggingFaceToken =
        readString(process.env.HUGGINGFACE_TOKEN) ||
        readString(process.env.HF_TOKEN);
      const embeddingModel =
        readString(process.env.ACADEMY_PRESENTATION_SEARCH_EMBEDDING_MODEL) ||
        readString(process.env.ACADEMY_PRESENTATION_HF_EMBEDDING_MODEL) ||
        "Qwen/Qwen3-Embedding-8B";
      const rerankerModel =
        readString(process.env.ACADEMY_PRESENTATION_SEARCH_RERANKER_MODEL) ||
        readString(process.env.ACADEMY_PRESENTATION_HF_RERANKER_MODEL) ||
        "Qwen/Qwen3-Reranker-8B";

      if (huggingFaceToken) {
        const documents = items.map((item) => item.searchText.slice(0, 2600));
        const embeddings = await academyPresentationRequestHfEmbeddings({
          token: huggingFaceToken,
          model: embeddingModel,
          inputs: [query, ...documents],
        });
        if (embeddings && embeddings.length === documents.length + 1) {
          const queryVector = embeddings[0];
          semanticScores = embeddings
            .slice(1)
            .map((vector) =>
              Number(
                (
                  (academyPresentationCosineSimilarity(queryVector, vector) + 1) /
                  2
                ).toFixed(4),
              ),
            );
          usedEmbeddingModel = embeddingModel;
        }

        const candidateIndexes = items
          .map((item, index) => ({
            id: item.id,
            index,
            seedScore: lexicalScores[index] * 0.34 + semanticScores[index] * 0.66,
          }))
          .sort((a, b) => b.seedScore - a.seedScore)
          .slice(0, Math.min(24, items.length))
          .map((entry) => entry.index);
        if (candidateIndexes.length > 0) {
          const rerankerDocuments = candidateIndexes.map((index) =>
            items[index].searchText.slice(0, 1900),
          );
          const rawRerankerScores =
            await academyPresentationRequestHfRerankerScores({
              token: huggingFaceToken,
              model: rerankerModel,
              query,
              documents: rerankerDocuments,
            });
          if (
            rawRerankerScores &&
            rawRerankerScores.length === candidateIndexes.length
          ) {
            const normalizedRerankerScores =
              academyPresentationNormalizeScoreSeries(rawRerankerScores);
            rerankerScores = items.map(() => 0);
            candidateIndexes.forEach((index, offset) => {
              if (!rerankerScores) return;
              rerankerScores[index] = Number(
                normalizedRerankerScores[offset].toFixed(4),
              );
            });
            usedRerankerModel = rerankerModel;
          }
        }
      }

      const ranking = items
        .map((item, index) => {
          const lexicalScore = lexicalScores[index];
          const semanticScore = semanticScores[index];
          const rerankScore = rerankerScores ? rerankerScores[index] : null;
          const score = rerankerScores
            ? lexicalScore * 0.22 +
              semanticScore * 0.38 +
              (rerankScore || 0) * 0.4
            : lexicalScore * 0.35 + semanticScore * 0.65;
          return {
            id: item.id,
            score: Number(score.toFixed(4)),
            lexicalScore: Number(lexicalScore.toFixed(4)),
            semanticScore: Number(semanticScore.toFixed(4)),
            rerankScore:
              rerankScore === null ? null : Number(rerankScore.toFixed(4)),
          };
        })
        .sort((a, b) => b.score - a.score);

      const filteredRanking = ranking.filter(
        (entry) =>
          entry.score >= 0.15 ||
          entry.lexicalScore >= 0.13 ||
          entry.semanticScore >= 0.2,
      );
      const topRanking =
        filteredRanking.length > 0
          ? filteredRanking.slice(0, requestedLimit)
          : ranking.slice(0, requestedLimit);

      return res.status(200).json({
        success: true,
        data: {
          query,
          ranking: topRanking,
          meta: {
            provider:
              usedEmbeddingModel || usedRerankerModel ? "huggingface" : "lexical",
            embeddingModel: usedEmbeddingModel || undefined,
            rerankerModel: usedRerankerModel || undefined,
            totalItems: items.length,
          },
        },
      });
    } catch (error) {
      console.error("Error running academy semantic search:", error);
      return res.status(500).json({
        success: false,
        error: "Could not run semantic search",
      });
    }
  });
}

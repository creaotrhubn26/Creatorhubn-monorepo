/**
 * ai-suggestion-routes.ts
 *
 * HTTP-laget for AI Suggestion System. Eksponerer fire endepunkter som
 * frontend-klienten (aiSuggestionsClient.ts) konsumerer.
 *
 *   GET   /api/role-room/projects/:projectId/ai-suggestions
 *   POST  /api/role-room/projects/:projectId/ai-suggestions/generate
 *   POST  /api/role-room/ai-suggestions/:id/accept
 *   POST  /api/role-room/ai-suggestions/:id/reject
 *
 * Arkitekturreferanse:
 *   frontend/client/src/components/role-room/ai-suggestion-architecture.md §4
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { createAISuggestionService } from "./ai-suggestion-service.js";
 *   import { setupAISuggestionRoutes } from "./ai-suggestion-routes.js";
 *   import { breakdownAgent, breakdownPropApplier, breakdownRiskFlagApplier }
 *     from "./ai-breakdown-agent.js";
 *
 *   const aiSuggestionService = createAISuggestionService({ pool });
 *   aiSuggestionService.registerAgent(breakdownAgent);
 *   aiSuggestionService.registerApplier(breakdownPropApplier);
 *   aiSuggestionService.registerApplier(breakdownRiskFlagApplier);
 *
 *   setupAISuggestionRoutes({ app, aiSuggestionService });
 *
 * Auth: matcher eksisterende role-room-konvensjon — leser
 * `x-role-room-user-id`-header. Manglende header → 401.
 *
 * Validering: input parses defensivt; ugyldig payload → 400 med tydelig
 * melding. Tjenestelaget kan kaste `Error` med deskriptive meldinger —
 * disse mappes til 4xx der det gir mening (not-found, illegal-state).
 */

import type express from "express";
import type { Request } from "express";

import type {
  AIAgentInput,
  AISuggestionFilter,
  AISuggestionService,
  AISuggestionSourceType,
  AISuggestionStatus,
} from "./ai-suggestion-service.js";

export interface AISuggestionRoutesDeps {
  app: express.Application;
  aiSuggestionService: AISuggestionService;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers (self-contained — duplikerer bevisst readOptionalHeaderValue
// fra role-room-routes for å holde denne modulen uavhengig)
// ─────────────────────────────────────────────────────────────────────

function readHeader(req: Request, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readUserId(req: Request): string | undefined {
  return readHeader(req, "x-role-room-user-id") ?? readHeader(req, "x-user-id");
}

const VALID_SOURCE_TYPES: AISuggestionSourceType[] = [
  "scene",
  "role",
  "manuscript",
  "project",
];

const VALID_STATUSES: AISuggestionStatus[] = [
  "pending",
  "accepted",
  "rejected",
  "superseded",
  "applied",
];

function parseSourceType(
  value: unknown,
): AISuggestionSourceType | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_SOURCE_TYPES.includes(value as AISuggestionSourceType)
    ? (value as AISuggestionSourceType)
    : undefined;
}

function parseFilter(req: Request): AISuggestionFilter {
  const filter: AISuggestionFilter = {};

  const sourceType = parseSourceType(req.query.sourceType);
  if (sourceType) filter.sourceType = sourceType;

  if (typeof req.query.sourceId === "string" && req.query.sourceId.trim()) {
    filter.sourceId = req.query.sourceId.trim();
  }
  if (typeof req.query.agentName === "string" && req.query.agentName.trim()) {
    filter.agentName = req.query.agentName.trim();
  }
  if (
    typeof req.query.suggestionType === "string" &&
    req.query.suggestionType.trim()
  ) {
    filter.suggestionType = req.query.suggestionType.trim();
  }

  if (typeof req.query.status === "string") {
    const raw = req.query.status.trim();
    if (raw.includes(",")) {
      const list = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is AISuggestionStatus =>
          VALID_STATUSES.includes(s as AISuggestionStatus),
        );
      if (list.length > 0) filter.status = list;
    } else if (VALID_STATUSES.includes(raw as AISuggestionStatus)) {
      filter.status = raw as AISuggestionStatus;
    }
  }

  if (typeof req.query.minConfidence === "string") {
    const num = Number.parseFloat(req.query.minConfidence);
    if (Number.isFinite(num) && num >= 0 && num <= 1) {
      filter.minConfidence = num;
    }
  }

  return filter;
}

/** Mapper Error-meldinger fra service-laget til HTTP-status. */
function statusFromError(err: unknown): number {
  if (!(err instanceof Error)) return 500;
  const msg = err.message;
  if (msg.startsWith("Suggestion not found")) return 404;
  if (msg.startsWith("Unknown agent")) return 400;
  if (msg.startsWith("Cannot accept suggestion in status")) return 409;
  if (msg.startsWith("Cannot reject suggestion in status")) return 409;
  if (msg.startsWith("Cannot apply suggestion in status")) return 409;
  if (msg.startsWith("No applier registered")) return 500;
  return 500;
}

// ─────────────────────────────────────────────────────────────────────
// Route setup
// ─────────────────────────────────────────────────────────────────────

export function setupAISuggestionRoutes(deps: AISuggestionRoutesDeps): void {
  const { app, aiSuggestionService } = deps;

  // ── List pending suggestions for a project ─────────────────────────
  app.get(
    "/api/role-room/projects/:projectId/ai-suggestions",
    async (req, res) => {
      try {
        const projectId = req.params.projectId?.trim();
        if (!projectId) {
          res.status(400).json({ error: "projectId is required" });
          return;
        }
        const filter = parseFilter(req);
        const suggestions = await aiSuggestionService.listPending(
          projectId,
          filter,
        );
        res.json(suggestions);
      } catch (error) {
        console.error("Error listing AI suggestions:", error);
        res.status(500).json({ error: "Could not list AI suggestions" });
      }
    },
  );

  // ── Generate suggestions via a named agent ─────────────────────────
  app.post(
    "/api/role-room/projects/:projectId/ai-suggestions/generate",
    async (req, res) => {
      try {
        const userId = readUserId(req);
        if (!userId) {
          res.status(401).json({ error: "Missing x-role-room-user-id header" });
          return;
        }

        const projectId = req.params.projectId?.trim();
        if (!projectId) {
          res.status(400).json({ error: "projectId is required" });
          return;
        }

        const body = req.body && typeof req.body === "object" ? req.body : {};

        const agentName =
          typeof body.agentName === "string" ? body.agentName.trim() : "";
        if (!agentName) {
          res.status(400).json({ error: "agentName is required" });
          return;
        }

        const sourceType = parseSourceType(body.sourceType);
        if (!sourceType) {
          res.status(400).json({
            error: `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}`,
          });
          return;
        }

        const sourceId =
          typeof body.sourceId === "string" ? body.sourceId.trim() : "";
        if (!sourceId) {
          res.status(400).json({ error: "sourceId is required" });
          return;
        }

        const input: AIAgentInput = {
          projectId,
          userId,
          sourceType,
          sourceId,
          payload: body.payload,
        };

        const suggestions = await aiSuggestionService.generate(agentName, input);
        res.status(201).json(suggestions);
      } catch (error) {
        console.error("Error generating AI suggestions:", error);
        const status = statusFromError(error);
        const message =
          error instanceof Error ? error.message : "Could not generate";
        res.status(status).json({ error: message });
      }
    },
  );

  // ── Accept a suggestion (triggers applier in same transaction) ─────
  app.post("/api/role-room/ai-suggestions/:id/accept", async (req, res) => {
    try {
      const userId = readUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Missing x-role-room-user-id header" });
        return;
      }

      const id = req.params.id?.trim();
      if (!id) {
        res.status(400).json({ error: "suggestion id is required" });
        return;
      }

      const body = req.body && typeof req.body === "object" ? req.body : {};
      const note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim()
          : undefined;

      const suggestion = await aiSuggestionService.accept(id, userId, note);
      res.json(suggestion);
    } catch (error) {
      console.error("Error accepting AI suggestion:", error);
      const status = statusFromError(error);
      const message =
        error instanceof Error ? error.message : "Could not accept";
      res.status(status).json({ error: message });
    }
  });

  // ── Reject a suggestion ────────────────────────────────────────────
  app.post("/api/role-room/ai-suggestions/:id/reject", async (req, res) => {
    try {
      const userId = readUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Missing x-role-room-user-id header" });
        return;
      }

      const id = req.params.id?.trim();
      if (!id) {
        res.status(400).json({ error: "suggestion id is required" });
        return;
      }

      const body = req.body && typeof req.body === "object" ? req.body : {};
      const note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim()
          : undefined;

      const suggestion = await aiSuggestionService.reject(id, userId, note);
      res.json(suggestion);
    } catch (error) {
      console.error("Error rejecting AI suggestion:", error);
      const status = statusFromError(error);
      const message =
        error instanceof Error ? error.message : "Could not reject";
      res.status(status).json({ error: message });
    }
  });
}

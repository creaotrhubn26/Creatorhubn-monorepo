/**
 * stageone-assistant-routes.ts
 *
 * AI-assistenten i StageOne Virtual Studio (iPad): naturlig språk → scene-patch.
 *
 *   POST /api/stageone/assistant   { scene, instruction } →
 *     { summary, updatedNodes?, removedNodeIds?, environment?, shots? }
 *
 * Patchen er KOMPAKT (kun endrede noder) — klienten applikerer den som én
 * undo-bar mutasjon. Node-JSON-formen er Swift-Codable-formen appen selv
 * lagrer (enum-params som {"light":{"_0":{…}}}), så Claude speiler input.
 * Auth: requireUserSession (samme bearer-tokens som resten av StageOne).
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { callClaudeForJson, ClaudeJsonParseError } from "./claude-json-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

export interface StageOneAssistantRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionData | null;
}

interface AssistantPatch {
  summary?: unknown;
  updatedNodes?: unknown;
  removedNodeIds?: unknown;
  environment?: unknown;
  shots?: unknown;
}

const MAX_SCENE_BYTES = 512 * 1024;

const SYSTEM_PROMPT = `Du er scene-assistenten i StageOne — en virtual-studio-app for iPad der brukeren rigger et 3D-studio (lys, kameraer, talent, props) og produserer flerkamera-video.

Du får gjeldende scene som JSON og en instruks fra brukeren (norsk eller engelsk). Svar med KUN ett JSON-objekt (ingen prosa, ingen markdown-fence) på denne formen:

{
  "summary": "<én kort setning på norsk om hva du gjorde>",
  "updatedNodes": [ <kun noder du endrer ELLER legger til, i NØYAKTIG samme JSON-form som scenens "nodes"-elementer> ],
  "removedNodeIds": [ "<id>" ],
  "environment": "<preset-id>",
  "shots": [ <full erstatning av shots-listen, samme form som scenens "shots"> ]
}

Regler:
- Utelat felter du ikke endrer ("updatedNodes"/"removedNodeIds"/"environment"/"shots" er alle valgfrie). "summary" er alltid med.
- Behold eksisterende node-id-er uendret. Nye noder får ny kebab-case-id (f.eks. "prop-sidebord").
- "params"-feltet bruker enum-innpakning: {"light":{"_0":{...}}}, {"camera":{"_0":{...}}}, {"talent":{"_0":{...}}}, {"prop":{"_0":{...}}} — kopiér formen fra scenen du fikk.
- Posisjoner er meter i høyrehendt rom (x høyre, y opp, z mot kamera); scenesenteret er rundt origo, gulvet er y=0. Lys: intensity 0–100, temperatureK 2000–10000, beamDeg 10–120, type "spot"|"area". Kamera: focalMm 12–135. Prop-shape: "box"|"plane"|"cylinder"|"capsule"|"stage".
- Vær konservativ: endre bare det instruksen ber om. Er instruksen umulig/uklar, returner kun "summary" som forklarer hvorfor.`;

export function registerStageOneAssistantRoutes(deps: StageOneAssistantRoutesDeps): void {
  const { app, requireUserSession } = deps;

  app.post("/api/stageone/assistant", async (req: Request, res: Response) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const { scene, instruction } = (req.body ?? {}) as { scene?: unknown; instruction?: unknown };
    if (typeof instruction !== "string" || !instruction.trim()) {
      return res.status(400).json({ error: "instruction_mangler" });
    }
    if (typeof scene !== "object" || scene === null) {
      return res.status(400).json({ error: "scene_mangler" });
    }
    const sceneJson = JSON.stringify(scene);
    if (sceneJson.length > MAX_SCENE_BYTES) {
      return res.status(413).json({ error: "scene_for_stor" });
    }

    try {
      const result = await callClaudeForJson<AssistantPatch>({
        cachedSystem: SYSTEM_PROMPT,
        userMessage: `SCENE:\n${sceneJson}\n\nINSTRUKS:\n${instruction.trim()}`,
        maxTokens: 4096,
        model: "claude-sonnet-5",
      });
      const patch = result.data;
      // Grunnvalidering — dyp validering skjer i appen (Codable-dekoding).
      const updatedNodes = Array.isArray(patch.updatedNodes) ? patch.updatedNodes : undefined;
      const removedNodeIds = Array.isArray(patch.removedNodeIds)
        ? patch.removedNodeIds.filter((x): x is string => typeof x === "string")
        : undefined;
      res.json({
        summary: typeof patch.summary === "string" ? patch.summary : "Endring utført.",
        updatedNodes,
        removedNodeIds,
        environment: typeof patch.environment === "string" ? patch.environment : undefined,
        shots: Array.isArray(patch.shots) ? patch.shots : undefined,
      });
    } catch (err) {
      if (err instanceof ClaudeJsonParseError) {
        console.error("[stageone] assistant JSON-parse feilet:", err.raw.slice(0, 300));
        return res.status(502).json({ error: "assistant_ugyldig_svar" });
      }
      console.error("[stageone] assistant feilet:", err);
      res.status(500).json({ error: "assistant_failed" });
    }
  });
}

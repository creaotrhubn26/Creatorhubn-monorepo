/**
 * Spillstudio (Story Graph) — server-side av-bryter (Fase 8a).
 *
 * `ROLE_ROOM_GAME_STUDIO_ENABLED` er opt-out (samme stil som `COVERAGE_WORKER_ENABLED`):
 * uten variabelen er vertikalen på. Settes den til `false`/`0`/`off`/`no` i Render,
 * svarer alle `/api/role-room/narrative*` og `/api/game/*` med 503 `game_studio_disabled`
 * uten at resten av backend berøres. Frontend viser et helsidebanner ved denne koden.
 */
import { Router, type Request, type Response } from 'express';

export const GAME_STUDIO_ENABLED_ENV = 'ROLE_ROOM_GAME_STUDIO_ENABLED';
export const GAME_STUDIO_DISABLED_ERROR = 'game_studio_disabled';

const OFF_VALUES = new Set(['false', '0', 'off', 'no']);

export function isGameStudioEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env[GAME_STUDIO_ENABLED_ENV] ?? '').trim().toLowerCase();
  return !OFF_VALUES.has(raw);
}

/** Router som svarer 503 på alt — monteres i stedet for spillstudio-routerne når bryteren er av. */
export function createGameStudioDisabledRouter(): Router {
  const router = Router();
  router.use((_req: Request, res: Response) => {
    res.status(503).set('Retry-After', '300').json({
      success: false,
      error: GAME_STUDIO_DISABLED_ERROR,
      message: 'Spillstudio (Story Graph) er midlertidig slått av.',
    });
  });
  return router;
}

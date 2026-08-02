/**
 * module-features-routes.ts
 *
 * Leser resolved modul-feature-state for innlogget bruker sin org, slik at
 * frontend kan gate modul-avhengige UI-biter (første bruker: Market
 * Intelligence-seksjonen som skjuler Leadgrid-paneler når Leadgrid er
 * deaktivert for org-en — CTO-audit P1, Migration Plan steg 3).
 *
 * Mount: GET /api/module-features/:moduleKey/:featureKey
 *        → { moduleKey, featureKey, state, enabled }
 *
 * Semantikk (matcher module-entitlement-resolver + 0370-mønsteret):
 *   - Ingen override-rad → modulens code-default gjelder. Defaults under er
 *     bevisst 'included' for eksisterende moduler så utrulling av endepunktet
 *     ikke endrer noe før en admin eksplisitt setter en override.
 *   - Oppslags-/DB-feil → fail-open til default (aldri lås ute betalende
 *     kunder pga. en DB-hikke — samme policy som leadgrid-entitlement-guard).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";
import {
  resolveModuleFeatureState,
  type EntitlementState,
} from "./module-entitlement-resolver.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

/**
 * Code-defaults per (moduleKey, featureKey). Moduler som er live i dag
 * defaulter 'included' (bakoverkompatibelt); ukjente nøkler defaulter
 * 'locked' så nye moduler er opt-in.
 */
const MODULE_FEATURE_DEFAULTS: Record<string, EntitlementState> = {
  "leadgrid:core": "included",
  "market_intelligence:core": "included",
};

function defaultStateFor(moduleKey: string, featureKey: string): EntitlementState {
  return MODULE_FEATURE_DEFAULTS[`${moduleKey}:${featureKey}`] ?? "locked";
}

const KEY_PATTERN = /^[a-z0-9_-]{1,60}$/;

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7).trim());
    if (s) return s;
  }
  return null;
}

export function registerModuleFeaturesRoutes({ app, pool, activeSessions }: Deps): void {
  app.get(
    "/api/module-features/:moduleKey/:featureKey",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "ikke_innlogget" });
      }

      const { moduleKey, featureKey } = req.params;
      if (!KEY_PATTERN.test(moduleKey) || !KEY_PATTERN.test(featureKey)) {
        return res.status(400).json({ error: "ugyldig_nokkel" });
      }

      const defaultState = defaultStateFor(moduleKey, featureKey);
      try {
        const organizationId = await resolveOrgIdForUser(pool, session.userId);
        const state = await resolveModuleFeatureState(pool, {
          organizationId,
          moduleKey,
          featureKey,
          defaultState,
        });
        return res.json({
          moduleKey,
          featureKey,
          state,
          enabled: state === "included" || state === "trial",
        });
      } catch (err) {
        // Fail-open til code-default — samme policy som entitlement-guarden.
        console.error("[module-features] resolve failed (fail-open):", err);
        return res.json({
          moduleKey,
          featureKey,
          state: defaultState,
          enabled: defaultState === "included" || defaultState === "trial",
        });
      }
    },
  );
}

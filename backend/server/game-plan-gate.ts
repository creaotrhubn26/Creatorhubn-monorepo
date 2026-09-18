/**
 * Plan-gating for Story Graph (spillstudio).
 *
 * Planen som gjelder for et prosjekt er PROSJEKTEIERENS plan (created_by på
 * casting_projects) — medlemmer arver eierens tier, slik seter fungerer.
 * Uten abonnement = `solo`. Manglende feature → 402 { error: 'plan_required',
 * feature, planSlug } så UI kan vise oppgraderingsbanner.
 *
 * Fail-safe: DB-feil gir solo-fallback (restriktivt, men konsistent), aldri 500.
 */

import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  planHasFeature, planLimit, resolveEffectivePlan,
  type EffectivePlan, type GameFeature, type GamePlan, SOLO_FALLBACK_PLAN,
} from './game-billing-service.js';

export interface ProjectPlan {
  ownerUserId: string | null;
  plan: GamePlan;
  active: boolean;
}

export type ResolveProjectPlan = (pool: Pool, projectId: string) => Promise<ProjectPlan>;

export async function resolveGamePlanForProject(pool: Pool, projectId: string): Promise<ProjectPlan> {
  let ownerUserId: string | null = null;
  try {
    const { rows } = await pool.query(`SELECT created_by FROM casting_projects WHERE id = $1 LIMIT 1`, [projectId]);
    ownerUserId = rows[0]?.created_by == null ? null : String(rows[0].created_by);
  } catch { ownerUserId = null; }
  if (!ownerUserId) return { ownerUserId: null, plan: SOLO_FALLBACK_PLAN, active: false };
  const eff: EffectivePlan = await resolveEffectivePlan(pool, ownerUserId);
  return { ownerUserId, plan: eff.plan, active: eff.active };
}

export class PlanRequiredError extends Error {
  constructor(public readonly feature: GameFeature, public readonly planSlug: string) {
    super(`Funksjonen «${feature}» krever en høyere plan enn ${planSlug}.`);
    this.name = 'PlanRequiredError';
  }
}

export class PlanLimitError extends Error {
  constructor(public readonly limit: string, public readonly max: number, public readonly planSlug: string) {
    super(`Grensen ${limit}=${max} for planen ${planSlug} er nådd.`);
    this.name = 'PlanLimitError';
  }
}

export function sendPlanRequired(res: Response, err: PlanRequiredError | PlanLimitError): void {
  if (err instanceof PlanLimitError) {
    res.status(402).json({ error: 'plan_limit', limit: err.limit, max: err.max, planSlug: err.planSlug, message: err.message });
    return;
  }
  res.status(402).json({ error: 'plan_required', feature: err.feature, planSlug: err.planSlug, message: err.message });
}

/** Kaster PlanRequiredError hvis prosjektets plan mangler feature. */
export async function assertGameFeature(
  pool: Pool, projectId: string, feature: GameFeature, resolve: ResolveProjectPlan = resolveGamePlanForProject,
): Promise<ProjectPlan> {
  const pp = await resolve(pool, projectId);
  if (!planHasFeature(pp.plan, feature)) throw new PlanRequiredError(feature, pp.plan.slug);
  return pp;
}

/** Kaster PlanLimitError hvis `current` allerede er ≥ planens grense. */
export async function assertGameLimit(
  pool: Pool, projectId: string, limit: string, current: number, resolve: ResolveProjectPlan = resolveGamePlanForProject,
): Promise<ProjectPlan> {
  const pp = await resolve(pool, projectId);
  const max = planLimit(pp.plan, limit);
  if (max != null && current >= max) throw new PlanLimitError(limit, max, pp.plan.slug);
  return pp;
}

/**
 * Express-middleware: krever at `req.projectId` er satt (kjør etter prosjekt-
 * guard). 402 ved manglende feature.
 */
export function requireGameFeature(pool: Pool, feature: GameFeature, resolve: ResolveProjectPlan = resolveGamePlanForProject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const projectId = (req as Request & { projectId?: string }).projectId ?? (typeof req.params.projectId === 'string' ? req.params.projectId : '');
    if (!projectId) { res.status(400).json({ error: 'invalid_project_id' }); return; }
    try {
      await assertGameFeature(pool, projectId, feature, resolve);
      next();
    } catch (err) {
      if (err instanceof PlanRequiredError) { sendPlanRequired(res, err); return; }
      next(err);
    }
  };
}

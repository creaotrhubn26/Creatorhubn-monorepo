import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import { idempotencyMiddleware } from "./_shared-idempotency.js";
import { resolveOrgNrForCard } from "./lead-brreg-service.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";
import {
  createLeadFromDraft,
  findLeadDuplicates,
  leadDraftInputSchema,
  LeadDraftNormalizationError,
  LeadDuplicateConflictError,
  LeadIdempotencyConflictError,
  LeadScopeValidationError,
  normalizeLeadDraft,
  type LeadDuplicateCandidate,
  type NormalizedLeadDraft,
} from "./leadgrid-lead-creation-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

type CardBrregLink = Awaited<ReturnType<typeof resolveOrgNrForCard>>;

function serializedDuplicate(candidate: LeadDuplicateCandidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    company: candidate.company,
    email: candidate.email,
    phone: candidate.phone,
    website_url: candidate.websiteUrl,
    address: candidate.address,
    city: candidate.city,
    match_reasons: candidate.matchReasons,
  };
}

function authorizedOrganizationId(res: Response): string | null {
  const value = res.locals.leadMapOrganizationId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function parseDraft(req: Request, res: Response): Promise<NormalizedLeadDraft | null> {
  const parsed = leadDraftInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: "validation_failed",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return null;
  }
  try {
    return normalizeLeadDraft(parsed.data);
  } catch (error) {
    if (error instanceof LeadDraftNormalizationError) {
      res.status(400).json({
        error: "validation_failed",
        issues: [{ path: error.field, message: error.reason }],
      });
      return null;
    }
    throw error;
  }
}

function sendCreationError(error: unknown, res: Response): boolean {
  if (error instanceof LeadDuplicateConflictError) {
    res.status(409).json({
      error: "duplicate_conflict",
      candidates: error.candidates.map(serializedDuplicate),
    });
    return true;
  }
  if (error instanceof LeadIdempotencyConflictError) {
    res.status(409).json({ error: "idempotency_payload_conflict" });
    return true;
  }
  if (error instanceof LeadScopeValidationError) {
    const status = error.code === "organization_mismatch" ? 403 : 400;
    res.status(status).json({ error: error.code });
    return true;
  }
  return false;
}

async function linkBusinessCardToBrreg(
  draft: NormalizedLeadDraft,
): Promise<{ draft: NormalizedLeadDraft; brreg: CardBrregLink | null }> {
  if (draft.leadSource !== "business_card_scan" || draft.organizationNumber) {
    return { draft, brreg: null };
  }
  const brreg = await resolveOrgNrForCard({
    company: draft.company,
    rawText: draft.rawText,
  }).catch(() => ({ status: "no_match" as const }));
  if (brreg.status !== "linked") return { draft, brreg };
  return {
    draft: { ...draft, organizationNumber: brreg.orgNr },
    brreg,
  };
}

export function registerLeadgridLeadCreationRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const requireCreate = requireLeadMapPermission("leads.create", {
    pool,
    activeSessions,
  });
  const idempotentCreate = idempotencyMiddleware({
    pool,
    scope: "leadgrid-lead-create",
    shouldCacheResponse: (status) => status >= 200 && status < 300,
    failClosedOnUnavailable: true,
  });

  app.post(
    "/api/admin-room/lead-map/leads/duplicate-check",
    requireCreate,
    async (req: Request, res: Response) => {
      const organizationId = authorizedOrganizationId(res);
      if (!organizationId) {
        return res.status(400).json({ error: "organization_required" });
      }
      const draft = await parseDraft(req, res);
      if (!draft) return;
      if (draft.organizationId && draft.organizationId !== organizationId) {
        return res.status(403).json({ error: "organization_mismatch" });
      }
      try {
        const candidates = await findLeadDuplicates(pool, organizationId, draft);
        return res.json({ candidates: candidates.map(serializedDuplicate) });
      } catch (error) {
        console.warn("[lead-create] duplicate-check failed:", error);
        return res.status(500).json({ error: "duplicate_check_failed", detail: "internal_error" });
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/leads",
    requireCreate,
    idempotentCreate,
    async (req: Request, res: Response) => {
      const session = await resolveLeadMapSession(req, pool, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const organizationId = authorizedOrganizationId(res);
      if (!organizationId) {
        return res.status(400).json({ error: "organization_required" });
      }
      const parsedDraft = await parseDraft(req, res);
      if (!parsedDraft) return;

      try {
        const linked = await linkBusinessCardToBrreg(parsedDraft);
        const result = await createLeadFromDraft(pool, {
          organizationId,
          userId: session.userId,
          draft: linked.draft,
          idempotencyDraft: parsedDraft,
        });

        return res.status(result.created ? 201 : 200).json({
          ok: true,
          id: result.id,
          created: result.created,
          replayed: result.replayed,
          duplicates_checked: result.duplicatesChecked,
          brreg: linked.brreg?.status === "no_match" ? null : linked.brreg,
        });
      } catch (error) {
        if (sendCreationError(error, res)) return;
        console.warn("[lead-create] create failed:", error);
        return res.status(500).json({ error: "create_failed", detail: "internal_error" });
      }
    },
  );
}

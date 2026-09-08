import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { z, ZodError } from "zod";

import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  getLeadgridSession,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import {
  buildProjectOnboardingPlan,
  commitProjectOnboarding,
  normalizeProjectOnboardingWebsite,
  storeProjectOnboardingPreview,
  type ProjectOnboardingProfilePlan,
} from "./leadgrid-domain-onboarding-service.js";
import { discoveryBriefSchema } from "./leadgrid-discovery-contract.js";
import {
  checkEndpointRateLimit,
  RateLimitExceededError,
} from "./role-room-agent-ratelimit.js";
import {
  analyzeWebsite,
  type AnalyzeOptions,
  type BrandProfile,
} from "./role-room-website-analyzer.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
  analyzeWebsiteFn?: (
    rawUrl: string,
    options?: AnalyzeOptions,
  ) => Promise<BrandProfile>;
}

const previewSchema = z
  .object({
    organization_id: z.string().uuid(),
    website_url: z.string().trim().min(1).max(2_048),
  })
  .strict();

const editableProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    is_default: z.boolean().default(false),
    status: z.literal("active").default("active"),
    brief: discoveryBriefSchema,
    approval_mode: z.literal("manual").default("manual"),
    places_details_enabled: z.boolean().default(false),
    auto_discover_enabled: z.literal(false).default(false),
    schedule_cron: z.string().trim().min(1).max(120).default("0 6 * * *"),
    schedule_timezone: z.string().trim().min(1).max(80).default("Europe/Oslo"),
  })
  .strict();

const commitSchema = z
  .object({
    organization_id: z.string().uuid(),
    preview_id: z.string().uuid(),
    profiles: z.array(editableProfileSchema).min(1).max(10).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const profiles = value.profiles ?? [];
    if (profiles.filter((profile) => profile.is_default).length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profiles"],
        message: "Bare én Discovery-profil kan være standardprofil.",
      });
    }
    const names = profiles.map((profile) =>
      profile.name.toLocaleLowerCase("nb-NO"),
    );
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profiles"],
        message: "Discovery-profilene må ha unike navn.",
      });
    }
  });

interface RequestScope {
  userId: string;
  organizationId: string;
  isSuperAdmin: boolean;
}

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  field?: string,
): void {
  res.status(status).json({
    error: { code, message, retryable: status >= 500 || status === 429, field },
  });
}

async function requestScope(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, LeadgridSession>,
  organizationId: string,
): Promise<RequestScope | null> {
  const session = getLeadgridSession(req, activeSessions);
  if (!session?.userId) {
    sendError(res, 401, "authentication_required", "Innlogging kreves.");
    return null;
  }
  const [access, platformRole] = await Promise.all([
    resolveEffectivePermissions(pool, organizationId, session.userId),
    pool.query<{ role: string | null }>(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [session.userId],
    ),
  ]);
  if (!access.role) {
    sendError(
      res,
      403,
      "organization_access_denied",
      "Du er ikke medlem av den valgte organisasjonen.",
      "organization_id",
    );
    return null;
  }
  const isSuperAdmin = platformRole.rows[0]?.role === "super_admin";
  if (
    !isSuperAdmin &&
    (!access.permissions.has("projects.create") ||
      !access.permissions.has("lead_research.run"))
  ) {
    sendError(
      res,
      403,
      "project_onboarding_forbidden",
      "Du trenger tilgang til både prosjektopprettelse og Discovery.",
    );
    return null;
  }
  return {
    userId: session.userId,
    organizationId,
    isSuperAdmin,
  };
}

function mappedServiceError(error: unknown): {
  status: number;
  code: string;
  message: string;
  field?: string;
} | null {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "invalid_website_url":
      return {
        status: 400,
        code,
        message: "Skriv inn et gyldig offentlig nettsted, for eksempel dentum.no.",
        field: "website_url",
      };
    case "project_onboarding_preview_not_found":
      return {
        status: 404,
        code,
        message: "Forhåndsvisningen finnes ikke eller tilhører en annen bruker.",
      };
    case "project_onboarding_preview_expired":
      return {
        status: 410,
        code,
        message: "Forhåndsvisningen er utløpt. Analyser nettstedet på nytt.",
      };
    case "project_onboarding_profiles_invalid":
      return {
        status: 400,
        code,
        message: "Discovery-profilene er ugyldige.",
        field: "profiles",
      };
    default:
      return null;
  }
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    sendError(
      res,
      400,
      "invalid_project_onboarding_request",
      issue?.message ?? "Ugyldig forespørsel.",
      issue?.path.join("."),
    );
    return;
  }
  if (error instanceof RateLimitExceededError) {
    res.setHeader("Retry-After", String(error.retryAfterSeconds));
    sendError(
      res,
      429,
      "project_onboarding_rate_limited",
      "Vent litt før du analyserer et nytt nettsted.",
    );
    return;
  }
  const mapped = mappedServiceError(error);
  if (mapped) {
    sendError(res, mapped.status, mapped.code, mapped.message, mapped.field);
    return;
  }
  console.error("[leadgrid-domain-onboarding] request failed", error);
  sendError(
    res,
    500,
    "project_onboarding_failed",
    "Prosjektoppsettet kunne ikke fullføres. Prøv igjen.",
  );
}

export function registerLeadgridDomainOnboardingRoutes({
  app,
  pool,
  activeSessions,
  analyzeWebsiteFn = analyzeWebsite,
}: Deps): void {
  app.post(
    "/api/leadgrid/project-onboarding/preview",
    async (req: Request, res: Response) => {
      try {
        const body = previewSchema.parse(req.body ?? {});
        const scope = await requestScope(
          req,
          res,
          pool,
          activeSessions,
          body.organization_id,
        );
        if (!scope) return;
        checkEndpointRateLimit(
          scope.userId,
          "leadgrid_project_onboarding_preview",
          5,
        );
        let normalized: ReturnType<typeof normalizeProjectOnboardingWebsite>;
        try {
          normalized = normalizeProjectOnboardingWebsite(body.website_url);
        } catch {
          throw new Error("invalid_website_url");
        }
        let brandProfile: BrandProfile;
        try {
          brandProfile = await analyzeWebsiteFn(normalized.websiteUrl);
        } catch (error) {
          console.warn(
            "[leadgrid-domain-onboarding] website analysis failed",
            error instanceof Error ? error.message : "unknown",
          );
          sendError(
            res,
            422,
            "website_analysis_failed",
            "Nettstedet kunne ikke analyseres. Kontroller domenet og prøv igjen.",
            "website_url",
          );
          return;
        }
        const plan = buildProjectOnboardingPlan(
          normalized.websiteUrl,
          normalized.websiteDomain,
          brandProfile,
        );
        const preview = await storeProjectOnboardingPreview(pool, {
          organizationId: scope.organizationId,
          userId: scope.userId,
          plan,
        });
        res.status(201).json({
          preview: {
            id: preview.id,
            ...plan,
            expires_at: preview.expires_at,
            can_manage_multiple_profiles: scope.isSuperAdmin,
          },
        });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  app.post(
    "/api/leadgrid/project-onboarding/commit",
    async (req: Request, res: Response) => {
      try {
        const body = commitSchema.parse(req.body ?? {});
        const scope = await requestScope(
          req,
          res,
          pool,
          activeSessions,
          body.organization_id,
        );
        if (!scope) return;
        if (body.profiles && !scope.isSuperAdmin) {
          sendError(
            res,
            403,
            "multiple_profiles_super_admin_only",
            "Bare Super Admin kan endre eller opprette flere profiler i denne veiviseren.",
            "profiles",
          );
          return;
        }
        const result = await commitProjectOnboarding(pool, {
          previewId: body.preview_id,
          organizationId: scope.organizationId,
          userId: scope.userId,
          editedProfiles: body.profiles as ProjectOnboardingProfilePlan[] | undefined,
        });
        res.status(result.replayed || result.reused_project ? 200 : 201).json(result);
      } catch (error) {
        handleError(res, error);
      }
    },
  );
}

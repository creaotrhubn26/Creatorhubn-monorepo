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
  type ProjectOnboardingAccessSetup,
  type ProjectOnboardingInvitationDispatch,
  type ProjectOnboardingProfilePlan,
  type ProjectOnboardingResult,
} from "./leadgrid-domain-onboarding-service.js";
import { discoveryBriefSchema } from "./leadgrid-discovery-contract.js";
import { buildLeadgridProjectInviteEmail } from "./lead-map-team-routes.js";
import { leadgridPublicOrigin } from "./leadgrid-public-origin.js";
import {
  checkEndpointRateLimit,
  RateLimitExceededError,
} from "./role-room-agent-ratelimit.js";
import {
  analyzeWebsite,
  type AnalyzeOptions,
  type BrandProfile,
} from "./role-room-website-analyzer.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
  analyzeWebsiteFn?: (
    rawUrl: string,
    options?: AnalyzeOptions,
  ) => Promise<BrandProfile>;
  sendTransactionalEmailFn?: typeof sendTransactionalEmail;
}

const previewSchema = z
  .object({
    organization_id: z.string().uuid(),
    website_url: z.string().trim().min(1).max(2_048),
  })
  .strict();

const accessOptionsSchema = z.object({
  source_organization_id: z.string().uuid(),
  target_organization_id: z.string().uuid().optional(),
}).strict();

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

const organizationSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("current") }).strict(),
  z.object({
    mode: z.literal("existing"),
    organization_id: z.string().uuid(),
  }).strict(),
  z.object({
    mode: z.literal("create"),
    name: z.string().trim().min(1).max(200),
  }).strict(),
]);

const teamSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }).strict(),
  z.object({
    mode: z.literal("existing"),
    id: z.string().trim().min(1).max(120),
  }).strict(),
  z.object({
    mode: z.literal("create"),
    name: z.string().trim().min(1).max(120),
    color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).strict(),
]);

const accessSetupSchema = z.object({
  organization: organizationSelectionSchema,
  administrator_email: z.string().trim().toLowerCase().email().max(200),
  team: teamSelectionSchema,
  invitations: z.array(z.object({
    email: z.string().trim().toLowerCase().email().max(200),
    project_role: z.enum(["owner", "member", "viewer"]),
    team_role: z.enum(["leader", "member", "none"]),
  }).strict()).max(50).default([]),
}).strict();

const commitSchema = z
  .object({
    organization_id: z.string().uuid(),
    preview_id: z.string().uuid(),
    profiles: z.array(editableProfileSchema).min(1).max(10).optional(),
    access_setup: accessSetupSchema.optional(),
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
    if (value.access_setup) {
      const emails = [
        value.access_setup.administrator_email,
        ...value.access_setup.invitations.map((invitation) => invitation.email),
      ];
      if (new Set(emails).size !== emails.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["access_setup", "invitations"],
          message: "Samme e-postadresse kan bare legges til én gang.",
        });
      }
      if (
        value.access_setup.team.mode === "none"
        && value.access_setup.invitations.some((invitation) => invitation.team_role !== "none")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["access_setup", "invitations"],
          message: "Teamrolle krever at et salgsteam er valgt.",
        });
      }
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
    case "project_onboarding_organization_not_found":
      return {
        status: 404,
        code,
        message: "Den valgte kundeorganisasjonen finnes ikke.",
        field: "access_setup.organization",
      };
    case "project_onboarding_team_not_found":
      return {
        status: 404,
        code,
        message: "Det valgte salgsteamet finnes ikke i kundeorganisasjonen.",
        field: "access_setup.team",
      };
    case "project_onboarding_discovery_access_failed":
      return {
        status: 500,
        code,
        message: "Prosjektet ble ikke åpnet fordi Discovery-tilgangen ikke kunne bekreftes.",
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

export async function dispatchProjectOnboardingInvitations(args: {
  pool: Pick<Pool, "query">;
  userId: string;
  result: ProjectOnboardingResult;
  dispatches: ProjectOnboardingInvitationDispatch[];
  sendEmail: typeof sendTransactionalEmail;
}): Promise<void> {
  for (const dispatch of args.dispatches) {
    let emailStatus = "failed";
    let messageId: string | null = null;
    try {
      const acceptUrl = `${leadgridPublicOrigin()}/lead-map/accept?token=${encodeURIComponent(dispatch.token)}`;
      const email = buildLeadgridProjectInviteEmail({
        projectName: dispatch.projectName,
        inviterName: "Leadgrid Super Admin",
        role: dispatch.projectRole,
        acceptUrl,
      });
      const sent = await args.sendEmail({
        to: dispatch.email,
        ...email,
        fromLabel: "Leadgrid",
        kind: "leadgrid_customer_onboarding_invite",
        projectId: dispatch.projectId,
        sentByUserId: args.userId,
        pool: args.pool as Pool,
      });
      emailStatus = sent.sent ? "sent" : (sent.reason ?? "failed");
      messageId = sent.messageId ?? null;
    } catch (error) {
      console.warn(
        "[leadgrid-domain-onboarding] invitation email failed",
        error instanceof Error ? error.message : "unknown",
      );
    }
    await args.pool.query(
      `UPDATE leadgrid_project_invitations
          SET email_status = $2,
              email_provider_message_id = $3
        WHERE id = $1::uuid
          AND organization_id = $4::uuid
          AND project_id = $5`,
      [
        dispatch.id,
        emailStatus,
        messageId,
        dispatch.organizationId,
        dispatch.projectId,
      ],
    );
    if (args.result.access?.administrator.email === dispatch.email) {
      args.result.access.administrator.email_status = emailStatus;
    }
    const invitation = args.result.access?.invitations.find((item) => item.id === dispatch.id);
    if (invitation) invitation.email_status = emailStatus;
  }
}

export function registerLeadgridDomainOnboardingRoutes({
  app,
  pool,
  activeSessions,
  analyzeWebsiteFn = analyzeWebsite,
  sendTransactionalEmailFn = sendTransactionalEmail,
}: Deps): void {
  app.get(
    "/api/leadgrid/project-onboarding/access-options",
    async (req: Request, res: Response) => {
      try {
        const query = accessOptionsSchema.parse(req.query ?? {});
        const scope = await requestScope(
          req,
          res,
          pool,
          activeSessions,
          query.source_organization_id,
        );
        if (!scope) return;
        if (!scope.isSuperAdmin) {
          sendError(
            res,
            403,
            "access_options_super_admin_only",
            "Bare Super Admin kan velge kundeorganisasjon og salgsteam her.",
          );
          return;
        }
        const organizations = await pool.query<{ id: string; name: string }>(
          `SELECT id::text, name
             FROM organizations
            ORDER BY LOWER(name), created_at, id`,
        );
        let teams: Array<{ id: string; name: string; color_hex: string }> = [];
        if (query.target_organization_id) {
          const targetExists = organizations.rows.some(
            (organization) => organization.id === query.target_organization_id,
          );
          if (!targetExists) {
            sendError(
              res,
              404,
              "project_onboarding_organization_not_found",
              "Den valgte kundeorganisasjonen finnes ikke.",
              "target_organization_id",
            );
            return;
          }
          const teamResult = await pool.query<{
            id: string;
            name: string;
            color_hex: string;
          }>(
            `SELECT id, name, color_hex
               FROM leadgrid_sales_teams
              WHERE organization_id = $1
              ORDER BY LOWER(name), created_at, id`,
            [query.target_organization_id],
          );
          teams = teamResult.rows;
        }
        res.json({ organizations: organizations.rows, teams });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

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
        if (body.access_setup && !scope.isSuperAdmin) {
          sendError(
            res,
            403,
            "access_setup_super_admin_only",
            "Bare Super Admin kan opprette kundeorganisasjon, team og prosjektinvitasjoner her.",
            "access_setup",
          );
          return;
        }
        const serviceResult = await commitProjectOnboarding(pool, {
          previewId: body.preview_id,
          organizationId: scope.organizationId,
          userId: scope.userId,
          editedProfiles: body.profiles as ProjectOnboardingProfilePlan[] | undefined,
          accessSetup: body.access_setup as ProjectOnboardingAccessSetup | undefined,
        });
        const { invitation_dispatches: dispatches, ...result } = serviceResult;
        await dispatchProjectOnboardingInvitations({
          pool,
          userId: scope.userId,
          result,
          dispatches,
          sendEmail: sendTransactionalEmailFn,
        });
        res.status(result.replayed || result.reused_project ? 200 : 201).json(result);
      } catch (error) {
        handleError(res, error);
      }
    },
  );
}

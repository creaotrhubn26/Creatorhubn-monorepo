/**
 * Academy → access-summary + admin revenue-overview.
 *
 * Begge routene er admin/instructor-orientert lese-API:
 *   - GET /api/academy/access-summary      — finn current users tilgang
 *     ved å scanne admin-snapshotten og resolve "approved by" til en label.
 *   - GET /api/academy/admin/revenue/overview — KPI-snapshot for academy-
 *     revenue (admin-only).
 *
 * Ekstrahert fra `index.ts` (#239-sekvens). Admin-helpers (toAdminString,
 * normalizeAdminRoleId, etc.) injecteres som deps fordi de fortsatt bor
 * i index.ts.
 */
import type { Application, Request, Response } from "express";

type AcademySession = {
  user: {
    id: string;
    email?: string | null;
  };
};

type AcademySessionRequirement = "authenticated" | "instructor";

type AdminSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
};

type AdminRoleCatalogEntry = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
};

type AcademyRevenueSnapshot = {
  totalStudents: number;
  totalEnrollments: number;
  totalInstructors: number;
  activeCourses: number;
  totalRevenue: number;
  totalPlatformRevenue: number;
  totalInstructorRevenue: number;
  pendingPayouts: number;
  pendingPayoutAmount: number;
  rows: Array<{ createdAt: Date | null; amount: number }>;
};

export interface AcademyAdminRoutesDeps {
  app: Application;
  requireAcademySession: (
    req: Request,
    res: Response,
    requirement?: AcademySessionRequirement,
  ) => Promise<AcademySession | null>;
  requireAdminSession: (req: Request, res: Response) => AdminSession | null;
  listAdminUsersSnapshot: () => Promise<Record<string, unknown>[]>;
  toAdminString: (value: unknown) => string | null;
  findAdminAccountUser: (
    identifier: string,
    emailHint?: string | null,
  ) => Promise<Record<string, unknown> | null>;
  normalizeAdminRoleId: (value: unknown) => string;
  inferAdminRoleFromProfession: (profession: unknown) => string;
  buildAdminRoleEntry: (roleId: string) => AdminRoleCatalogEntry;
  formatAdminUserIdentity: (
    record: Record<string, unknown> | null | undefined,
  ) => string | null;
  getAdminAcademyRevenueSnapshot: () => Promise<AcademyRevenueSnapshot>;
}

export function setupAcademyAdminRoutes(deps: AcademyAdminRoutesDeps): void {
  const {
    app,
    requireAcademySession,
    requireAdminSession,
    listAdminUsersSnapshot,
    toAdminString,
    findAdminAccountUser,
    normalizeAdminRoleId,
    inferAdminRoleFromProfession,
    buildAdminRoleEntry,
    formatAdminUserIdentity,
    getAdminAcademyRevenueSnapshot,
  } = deps;

  app.get("/api/academy/access-summary", async (req, res) => {
    try {
      const academySession = await requireAcademySession(
        req,
        res,
        "authenticated",
      );
      if (!academySession) {
        return;
      }
      const resolvedUserId = academySession.user.id;
      const normalizedUserId =
        resolvedUserId && resolvedUserId !== "guest"
          ? resolvedUserId.trim().toLowerCase()
          : null;
      const normalizedEmail =
        academySession.user.email?.trim().toLowerCase() || null;

      const users = await listAdminUsersSnapshot();
      const matchedUser =
        users.find((entry) => {
          const identifiers = [
            toAdminString(entry.id),
            toAdminString(entry.accountUserId),
            toAdminString(entry.inviteRequestId),
          ]
            .map((value) => value?.trim().toLowerCase() || null)
            .filter(Boolean);
          const email = toAdminString(entry.email)?.trim().toLowerCase() || null;

          if (normalizedUserId && identifiers.includes(normalizedUserId)) {
            return true;
          }

          return Boolean(normalizedEmail && email === normalizedEmail);
        }) || null;

      if (!matchedUser) {
        return res.status(200).json({
          success: true,
          data: {
            userId: normalizedUserId,
            email: normalizedEmail,
            access: null,
          },
        });
      }

      const approvedByUserId = toAdminString(matchedUser.approvedByUserId);
      const approvedByAccount = approvedByUserId
        ? await findAdminAccountUser(approvedByUserId, approvedByUserId)
        : null;
      const approvedByRoleId = approvedByAccount
        ? normalizeAdminRoleId(
            approvedByAccount.role ||
              inferAdminRoleFromProfession(approvedByAccount.profession),
          )
        : null;
      const approvedByRoleLabel = approvedByRoleId
        ? buildAdminRoleEntry(approvedByRoleId).name
        : null;

      return res.status(200).json({
        success: true,
        data: {
          userId:
            toAdminString(matchedUser.accountUserId) ||
            toAdminString(matchedUser.id) ||
            normalizedUserId,
          email: toAdminString(matchedUser.email) || normalizedEmail,
          access: {
            status: toAdminString(matchedUser.status),
            approvedAt:
              matchedUser.approvedAt instanceof Date
                ? matchedUser.approvedAt.toISOString()
                : toAdminString(matchedUser.approvedAt),
            approvedBy:
              toAdminString(matchedUser.approvedBy) ||
              formatAdminUserIdentity(approvedByAccount),
            approvedByUserId,
            approvedByRoleLabel,
            role: toAdminString(matchedUser.role),
            roleLabel: toAdminString(matchedUser.roleLabel),
            profession: toAdminString(matchedUser.profession),
            onboardingStatus: toAdminString(matchedUser.onboardingStatus),
            inviteRequestId: toAdminString(matchedUser.inviteRequestId),
            accountUserId: toAdminString(matchedUser.accountUserId),
            isActive: Boolean(matchedUser.isActive),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching academy access summary:", error);
      return res
        .status(500)
        .json({
          success: false,
          error: "Could not read academy access summary",
        });
    }
  });

  app.get("/api/academy/admin/revenue/overview", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const snapshot = await getAdminAcademyRevenueSnapshot();
      res.json(snapshot);
    } catch (error) {
      console.error("Academy revenue overview error:", error);
      res
        .status(500)
        .json({ error: "Could not fetch academy revenue overview" });
    }
  });
}

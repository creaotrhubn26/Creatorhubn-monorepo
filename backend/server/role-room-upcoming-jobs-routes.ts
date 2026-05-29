/**
 * Upcoming jobs — generelt endepunkt som lister kommende feed-plan-posts
 * for alle prosjekter brukeren har tilgang til. Brukes av Post Agent's
 * "Today's jobs"-sidebar.
 *
 * Project-type-agnostisk: fungerer for bryllup, corporate, music-video,
 * content-producer-leveranser osv. Returnerer alt fra alle prosjekter
 * brukeren er medlem av eller eier.
 *
 * Auth: RR_BEARER_TOKEN via samme activeSessions-pattern som
 * post-agent-router. Filterer responsen til kun prosjekter brukeren
 * har tilgang til via casting_user_roles eller casting_projects.created_by.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

interface UpcomingJob {
  // Post-felter
  postId: string;
  platform: "instagram" | "tiktok" | "linkedin" | string;
  scheduledFor: string | null;
  title: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
  mediaType: string | null;
  imageStyle: string | null;
  approvalState: string | null;
  customImageUrl: string | null;
  // Project-context
  projectId: string;
  projectName: string;
  projectKind: string | null;
  // Brand-snapshot fra feed-plan
  brandSnapshot: {
    companyName?: string | null;
    accentColor?: string | null;
    backgroundColor?: string | null;
    textColor?: string | null;
    logoUrl?: string | null;
    toneOfVoice?: string | null;
    industry?: string | null;
  } | null;
  // Deadline-info
  daysUntilDeadline: number | null;
  hoursUntilDeadline: number | null;
}

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

export function registerRoleRoomUpcomingJobsRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  // GET /api/role-room/feed-plan/upcoming-jobs?days=7&maxPerProject=10
  app.get(
    "/api/role-room/feed-plan/upcoming-jobs",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }

      const days = Math.min(60, Math.max(1, parseInt(String(req.query.days ?? "7"), 10) || 7));
      const maxPerProject = Math.min(
        50, Math.max(1, parseInt(String(req.query.maxPerProject ?? "10"), 10) || 10),
      );
      const includeOverdue = String(req.query.includeOverdue ?? "true") !== "false";

      try {
        // 1. Finn alle prosjekt-IDer brukeren har tilgang til (eier +
        //    medlem). Project-type-agnostisk — alle kinds inkluderes.
        const { rows: projectRows } = await pool.query(
          `SELECT id, name, project_type, settings, metadata
             FROM casting_projects
            WHERE created_by = $1
               OR id IN (
                 SELECT DISTINCT project_id FROM casting_user_roles
                  WHERE user_id = $1 AND deactivated_at IS NULL
               )`,
          [viewerId],
        );

        if (projectRows.length === 0) {
          res.json({ jobs: [], projects: 0, scannedDays: days });
          return;
        }

        const projectMap = new Map<string, { name: string; kind: string | null }>();
        for (const p of projectRows as Array<{ id: string; name: string; project_type: string | null }>) {
          projectMap.set(p.id, { name: p.name, kind: p.project_type });
        }
        const projectIds = Array.from(projectMap.keys());

        // 2. Hent feed-plans for disse prosjektene
        // role_room_feed_plans har project_id som FK
        const { rows: planRows } = await pool.query(
          `SELECT project_id, platform, posts, brand_snapshot
             FROM role_room_feed_plans
            WHERE project_id = ANY($1::text[])`,
          [projectIds],
        );

        // 3. Flatten posts + filter på scheduled-window
        const now = Date.now();
        const windowEnd = now + days * 24 * 60 * 60 * 1000;
        const overdueStart = now - 30 * 24 * 60 * 60 * 1000; // back 30 days

        const jobs: UpcomingJob[] = [];

        for (const plan of planRows as Array<{
          project_id: string;
          platform: string;
          posts: unknown[];
          brand_snapshot: unknown;
        }>) {
          const proj = projectMap.get(plan.project_id);
          if (!proj) continue;
          const brandSnap = plan.brand_snapshot as Record<string, unknown> | null;

          const projectJobs: UpcomingJob[] = [];
          for (const rawPost of (Array.isArray(plan.posts) ? plan.posts : [])) {
            const post = rawPost as Record<string, unknown>;
            const scheduledRaw = post.scheduledFor;
            const scheduled = typeof scheduledRaw === "string"
              ? new Date(scheduledRaw).getTime() : null;

            // Filtrer på window
            if (scheduled == null) {
              // Posts uten dato hopper vi over (kun for "draft"-tilstand)
              continue;
            }
            if (scheduled > windowEnd) continue;
            if (!includeOverdue && scheduled < now) continue;
            if (scheduled < overdueStart) continue;

            // Skip published / cancelled
            const approval = String(post.approvalState ?? "draft");
            if (approval === "published") continue;

            const msUntil = scheduled - now;
            const daysUntil = msUntil / (1000 * 60 * 60 * 24);
            const hoursUntil = msUntil / (1000 * 60 * 60);

            projectJobs.push({
              postId: String(post.id ?? ""),
              platform: plan.platform,
              scheduledFor: typeof scheduledRaw === "string" ? scheduledRaw : null,
              title: String(post.title ?? "Untitled"),
              caption: String(post.caption ?? ""),
              callToAction: String(post.callToAction ?? ""),
              hashtags: Array.isArray(post.hashtags)
                ? (post.hashtags as unknown[]).map(String) : [],
              mediaType: post.mediaType ? String(post.mediaType) : null,
              imageStyle: post.imageStyle ? String(post.imageStyle) : null,
              approvalState: approval,
              customImageUrl: post.customImageUrl ? String(post.customImageUrl) : null,
              projectId: plan.project_id,
              projectName: proj.name,
              projectKind: proj.kind,
              brandSnapshot: brandSnap ? {
                companyName: brandSnap.companyName as string | undefined ?? null,
                accentColor: brandSnap.accentColor as string | undefined ?? null,
                backgroundColor: brandSnap.backgroundColor as string | undefined ?? null,
                textColor: brandSnap.textColor as string | undefined ?? null,
                logoUrl: brandSnap.logoUrl as string | undefined ?? null,
                toneOfVoice: brandSnap.toneOfVoice as string | undefined ?? null,
                industry: brandSnap.industry as string | undefined ?? null,
              } : null,
              daysUntilDeadline: Math.round(daysUntil * 10) / 10,
              hoursUntilDeadline: Math.round(hoursUntil),
            });
          }

          // Begrens per prosjekt så ett aktivt prosjekt ikke spammer
          projectJobs.sort((a, b) =>
            (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""),
          );
          jobs.push(...projectJobs.slice(0, maxPerProject));
        }

        // Sort overall by scheduledFor (overdue first, deretter snart)
        jobs.sort((a, b) => {
          // Overdue (negative daysUntil) først, så stigende på dato
          if ((a.daysUntilDeadline ?? 0) < 0 && (b.daysUntilDeadline ?? 0) >= 0) return -1;
          if ((b.daysUntilDeadline ?? 0) < 0 && (a.daysUntilDeadline ?? 0) >= 0) return 1;
          return (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? "");
        });

        res.json({
          jobs,
          projects: projectIds.length,
          scannedDays: days,
          totalJobs: jobs.length,
          overdueCount: jobs.filter(j => (j.daysUntilDeadline ?? 0) < 0).length,
        });
      } catch (err) {
        console.error("[upcoming-jobs] GET failed:", err);
        res.status(500).json({ error: "intern_feil", detail: (err as Error).message });
      }
    },
  );
}

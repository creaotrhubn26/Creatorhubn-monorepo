import { Router } from 'express';
import type { Request, Response } from 'express';

const ZERO_CLIENT_ACTIVITY_SUMMARY = {
  urgentDeadlines: 0,
  unreadComments: 0,
  recentDownloads: 0,
  pendingSubmissions: 0,
  pendingTimelineChanges: 0,
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createDashboardCompatRouter(): Router {
  const router = Router();

  router.get('/api/admin/permissions', (req: Request, res: Response) => {
    res.json({
      fullAccess: false,
      email: toOptionalString(req.query.email),
      permissions: [],
    });
  });

  router.get('/api/onboarding/profile/:userId', (req: Request, res: Response) => {
    res.json({
      userId: req.params.userId,
      businessName: null,
      brandingColor: null,
      tagline: null,
      profilePhoto: null,
      customLogo: null,
    });
  });

  router.get('/api/dashboard/:profession/:userId', (req: Request, res: Response) => {
    res.json({
      profession: req.params.profession,
      userId: req.params.userId,
      activeProjects: 0,
      newClients: 0,
      monthlyRevenue: 0,
      avgRating: null,
    });
  });

  router.get('/api/smart-meeting-notes/stats/:profession/:userId', (req: Request, res: Response) => {
    res.json({
      profession: req.params.profession,
      userId: req.params.userId,
      totalNotes: 0,
      thisMonth: 0,
      pendingFollowUps: 0,
      recentCount: 0,
    });
  });

  router.get('/api/smart-meeting-notes/recent/:userId', (_req: Request, res: Response) => {
    res.json([]);
  });

  router.get('/api/emails/unread-count/:userId', (req: Request, res: Response) => {
    res.json({
      userId: req.params.userId,
      count: 0,
    });
  });

  router.get('/api/notifications/recent/:userId', (req: Request, res: Response) => {
    res.json({
      userId: req.params.userId,
      limit: toPositiveInt(req.query.limit, 10),
      notifications: [],
    });
  });

  router.get('/api/client-activity/summary', (req: Request, res: Response) => {
    res.json({
      userId: toOptionalString(req.query.userId),
      ...ZERO_CLIENT_ACTIVITY_SUMMARY,
    });
  });

  router.get('/api/dashboard/upcoming-projects', (_req: Request, res: Response) => {
    res.json([]);
  });

  return router;
}

import express from "express";

export interface PlatformRoutesDeps {
  app: express.Application;
  ensureCompatPlatformSubscriptionPlanOverridesLoaded: () => Promise<void>;
  buildCompatPlatformSubscriptionPlans: () => any[];
}

export function setupPlatformRoutes(deps: PlatformRoutesDeps): void {
  const {
    app,
    ensureCompatPlatformSubscriptionPlanOverridesLoaded,
    buildCompatPlatformSubscriptionPlans,
  } = deps;

  app.get("/api/platform/subscription-plans", async (_req, res) => {
    await ensureCompatPlatformSubscriptionPlanOverridesLoaded();
    res.json({
      plans: buildCompatPlatformSubscriptionPlans(),
    });
  });

  app.get("/api/platform/stats", (_req, res) => {
    res.json({
      totalUsers: 1250,
      activeProjects: 340,
      completedProjects: 890,
      totalRevenue: 0,
    });
  });

  app.get("/api/platform/features", async (_req, res) => {
    // PlatformPricingService-frontend cacher resultatet og har egen
    // fallback til hardcoded features hvis listen er tom. Returnerer
    // strukturen frontend forventer ({features: []}).
    res.json({ features: [] });
  });
}

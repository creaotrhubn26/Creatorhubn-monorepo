/**
 * showcase-pricing-routes.ts
 *
 * Setup-funksjon for /api/showcase/pricing endpoints — løser opp showcase-
 * prising per profession (photographer/videographer/music_producer) med
 * eventuelle bruker-overrides fra siste prosjekter.
 *
 * 2 endpoints:
 *   - GET /pricing                  (profession via query, default photographer)
 *   - GET /pricing/:profession      (profession via path-param)
 *
 * Begge endpoints returnerer samme shape: { pricing, projectPricing }.
 *
 * Auth: åpen — userId fra query/header, ingen session-validering.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcasePricingRoutes } from "./showcase-pricing-routes";
 *
 *   setupShowcasePricingRoutes({ app, resolveShowcasePricing });
 *
 * Mode-noter: profession er ikke en Role Room-mode, men en Showcase-
 * profession-distinksjon (foto/video/musikk). Ingen mode-branching.
 */

import type express from "express";

import { readString } from "./_shared";

interface ShowcasePricingShape {
  contractedBase: number;
  perImage: number;
  [key: string]: unknown;
}

export interface ShowcasePricingRoutesDeps {
  app: express.Application;
  resolveShowcasePricing: (
    profession: string,
    userId?: string | null,
  ) => Promise<ShowcasePricingShape>;
}

export function setupShowcasePricingRoutes(
  deps: ShowcasePricingRoutesDeps,
): void {
  const { app, resolveShowcasePricing } = deps;

  // GET /api/showcase/pricing — Resolve showcase pricing for a profession
  app.get("/api/showcase/pricing", async (req, res) => {
    try {
      const profession = readString(req.query.profession) || "photographer";
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const pricing = await resolveShowcasePricing(profession, userId);
      res.json({
        pricing,
        projectPricing: {
          contracted_images: pricing.contractedBase,
          per_image: pricing.perImage,
        },
      });
    } catch (error) {
      console.error("Error resolving showcase pricing:", error);
      res.status(500).json({ error: "Kunne ikke hente showcase-prising" });
    }
  });

  app.get("/api/showcase/pricing/:profession", async (req, res) => {
    try {
      const pricing = await resolveShowcasePricing(
        req.params.profession,
        readString(req.query.userId) || readString(req.headers["x-user-id"]),
      );
      res.json({
        pricing,
        projectPricing: {
          contracted_images: pricing.contractedBase,
          per_image: pricing.perImage,
        },
      });
    } catch (error) {
      console.error("Error resolving showcase pricing:", error);
      res.status(500).json({ error: "Kunne ikke hente showcase-prising" });
    }
  });
}

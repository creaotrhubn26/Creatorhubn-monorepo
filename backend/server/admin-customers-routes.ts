/**
 * admin-customers-routes.ts
 *
 * Oversikt-fanen → kunder & prosjekter (kritisk fra audit). Stub-endpoints
 * som returnerer 200 med tomme aggregater nå slik at AdminDashboard kan
 * rendre. Senere kobles dette mot brukere + casting_projects-tabellene.
 *
 * Inneholder også profession-types-templates som hører hjemme i kunde-
 * profil-domenet (admin-misc-routes.ts er låst for parallelle agenter).
 *
 * Endpoints:
 *   GET  /api/admin/customer-projects-overview         — aggregert KPI
 *   GET  /api/admin/customers-detailed                 — liste
 *   GET  /api/admin/projects-detailed                  — liste
 *   GET  /api/admin/profession-types/templates         — 5 default-templates
 *   POST /api/admin/profession-types/templates/:id/activate
 *
 * Alle krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminCustomersRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const PROFESSION_TEMPLATES = [
  {
    id: "fotograf",
    label: "Fotograf",
    defaultRoles: ["Fotograf", "Andre-fotograf", "Editor"],
    defaultRates: { hourly: 950, fullDay: 7500, halfDay: 4500 },
  },
  {
    id: "videograf",
    label: "Videograf",
    defaultRoles: ["Videograf", "Gaffer", "Lyd", "Editor"],
    defaultRates: { hourly: 1100, fullDay: 8500, halfDay: 5000 },
  },
  {
    id: "eventplanlegger",
    label: "Eventplanlegger",
    defaultRoles: ["Eventansvarlig", "Koordinator", "Assistent"],
    defaultRates: { hourly: 850, fullDay: 6800, halfDay: 4000 },
  },
  {
    id: "danseinstruktor",
    label: "Danseinstruktør",
    defaultRoles: ["Hovedinstruktør", "Assistentinstruktør", "Koreograf"],
    defaultRates: { hourly: 700, fullDay: 5500, halfDay: 3200 },
  },
  {
    id: "musiker",
    label: "Musiker",
    defaultRoles: ["Hovedmusiker", "Bandmedlem", "Lydtekniker"],
    defaultRates: { hourly: 900, fullDay: 7000, halfDay: 4200 },
  },
];

export function setupAdminCustomersRoutes(
  deps: AdminCustomersRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  app.get("/api/admin/customer-projects-overview", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: aggreger fra users + casting_projects (status, type, antall).
      res.json({
        totalCustomers: 0,
        totalProjects: 0,
        projectsByStatus: {},
      });
    } catch (err) {
      console.error("[admin-customers] overview failed:", err);
      res.status(500).json({ error: "customer_projects_overview_failed" });
    }
  });

  app.get("/api/admin/customers-detailed", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: join users + subscriptions + projects-count.
      res.json({ customers: [], total: 0 });
    } catch (err) {
      console.error("[admin-customers] customers-detailed failed:", err);
      res.status(500).json({ error: "customers_detailed_failed" });
    }
  });

  app.get("/api/admin/projects-detailed", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: list casting_projects + owner.
      res.json({ projects: [], total: 0 });
    } catch (err) {
      console.error("[admin-customers] projects-detailed failed:", err);
      res.status(500).json({ error: "projects_detailed_failed" });
    }
  });

  app.get("/api/admin/profession-types/templates", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      res.json(PROFESSION_TEMPLATES);
    } catch (err) {
      console.error("[admin-customers] profession-templates failed:", err);
      res.status(500).json({ error: "profession_templates_failed" });
    }
  });

  app.post(
    "/api/admin/profession-types/templates/:templateId/activate",
    async (req, res) => {
      try {
        if (!requireAdminSession(req, res)) return;
        const templateId = String(req.params.templateId || "");
        const template = PROFESSION_TEMPLATES.find((t) => t.id === templateId);
        if (!template) {
          return res.status(404).json({ error: "template_not_found" });
        }
        // TODO: persist activation i admin_settings / profession_types.
        res.json({ success: true, activated: template });
      } catch (err) {
        console.error("[admin-customers] activate-template failed:", err);
        res.status(500).json({ error: "activate_template_failed" });
      }
    },
  );
}

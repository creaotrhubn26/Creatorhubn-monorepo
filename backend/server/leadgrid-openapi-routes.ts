// leadgrid-openapi-routes.ts
//
// Eksponer OpenAPI 3.1-spec + Swagger UI for Leadgrid Public API v1.

import type { Express, Request, Response } from "express";
import { openApiSpec } from "./leadgrid-openapi-spec.js";

export function registerLeadgridOpenApiRoutes(app: Express): void {
  // Maskinellbar spec
  app.get("/api/v1/openapi.json", (req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  // Swagger UI via CDN (ingen npm-dep)
  app.get("/api/v1/docs", (req: Request, res: Response) => {
    res.type("html").send(`<!DOCTYPE html>
<html>
<head>
  <title>Leadgrid API v1 — Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: "/api/v1/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
      });
    };
  </script>
</body>
</html>`);
  });
}

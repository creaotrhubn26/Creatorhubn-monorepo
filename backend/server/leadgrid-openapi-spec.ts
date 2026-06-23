/**
 * OpenAPI 3.1 spec for Leadgrid Public API v1.
 * Hostet på GET /api/v1/openapi.json + Swagger UI på /api/v1/docs.
 *
 * Versjonering: bumpe major (v1 → v2) hvis vi gjør breaking-changes.
 * Backwards-compatible utvidelser holdes innenfor v1.
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Leadgrid Public API",
    version: "1.0.0",
    description:
      "Stabilt schema for 3.-parts-integrasjoner mot Leadgrid (Salesforce, HubSpot, custom connectors). Auth: `Authorization: Bearer lgk_live_...`.",
    contact: { email: "support@creatorhubn.no" },
  },
  servers: [
    {
      url: "https://creatorhub-backend-rtbl.onrender.com",
      description: "Production",
    },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key (lgk_live_… eller lgk_test_…)",
      },
    },
    schemas: {
      Lead: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          company: { type: "string", nullable: true },
          email: { type: "string", format: "email", nullable: true },
          phone: { type: "string", nullable: true },
          pipeline_stage: {
            type: "string",
            enum: [
              "new",
              "first_contact",
              "qualified",
              "meeting",
              "proposal",
              "negotiation",
              "won",
              "lost",
            ],
          },
          lead_status: { type: "string" },
          lead_temperature: {
            type: "string",
            enum: ["cold", "warm", "hot", "ready"],
            nullable: true,
          },
          lead_score: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            nullable: true,
          },
          expected_value: { type: "number", nullable: true },
          conversion_probability: {
            type: "number",
            minimum: 0,
            maximum: 1,
            nullable: true,
          },
          next_best_action: { type: "string", nullable: true },
          next_follow_up_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          latitude: { type: "number", nullable: true },
          longitude: { type: "number", nullable: true },
          city: { type: "string", nullable: true },
          country: { type: "string", nullable: true },
          lead_source: { type: "string", nullable: true },
          lead_category: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Recommendation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          lead_id: { type: "string", format: "uuid" },
          action_type: { type: "string" },
          channel: { type: "string", nullable: true },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "urgent"],
          },
          reason: { type: "string" },
          status: {
            type: "string",
            enum: ["pending", "accepted", "executed", "dismissed", "expired"],
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            nullable: true,
          },
          created_at: { type: "string", format: "date-time" },
          expires_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string", nullable: true },
          detail: { type: "string", nullable: true },
        },
      },
    },
  },
  paths: {
    "/api/v1/health": {
      get: {
        summary: "Verifiser API-key + se scopes",
        responses: {
          "200": {
            description: "API-key gyldig",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    organization_id: { type: "string", format: "uuid" },
                    scopes: { type: "array", items: { type: "string" } },
                    rate_limit_rpm: { type: "integer" },
                    version: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Manglende eller ugyldig API-key" },
        },
      },
    },
    "/api/v1/leads": {
      get: {
        summary: "List leads for org",
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", minimum: 0, default: 0 },
          },
        ],
        responses: {
          "200": {
            description: "Leads-listen",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Lead" },
                    },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
          "403": { description: "Mangler scope leads.read" },
          "429": { description: "Rate-limit overskredet" },
        },
      },
      post: {
        summary: "Opprett ny lead",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  company: { type: "string" },
                  email: { type: "string", format: "email" },
                  phone: { type: "string" },
                  address: { type: "string" },
                  city: { type: "string" },
                  postal_code: { type: "string" },
                  country: { type: "string" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  lead_source: { type: "string" },
                  lead_category: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Lead opprettet" },
          "400": { description: "Valideringsfeil" },
          "403": { description: "Mangler scope leads.write" },
        },
      },
    },
    "/api/v1/leads/{id}": {
      get: {
        summary: "Hent én lead",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Lead-detalj",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Lead" },
                  },
                },
              },
            },
          },
          "404": { description: "Lead ikke funnet" },
        },
      },
    },
    "/api/v1/recommendations": {
      get: {
        summary: "List Next Best Action-anbefalinger",
        parameters: [
          {
            name: "priority",
            in: "query",
            schema: {
              type: "string",
              enum: ["low", "normal", "high", "urgent"],
            },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
        ],
        responses: {
          "200": {
            description: "Anbefalinger",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Recommendation" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

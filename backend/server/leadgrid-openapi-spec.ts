/**
 * OpenAPI 3.1 spec for Leadgrid Public API v1.
 * Hostet på GET /api/v1/openapi.json + Swagger UI på /api/v1/docs.
 *
 * Versjonering: bumpe major (v1 → v2) hvis vi gjør breaking-changes.
 * Backwards-compatible utvidelser holdes innenfor v1.
 */

const OUTCOME_SAFE_REFERENCE_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._:-]*$";

const outcomeSafeReferenceSchema = {
  type: "string",
  minLength: 1,
  maxLength: 255,
  pattern: OUTCOME_SAFE_REFERENCE_PATTERN,
} as const;

const outcomeSafeLabelSchema = {
  type: "string",
  minLength: 1,
  maxLength: 80,
  pattern: OUTCOME_SAFE_REFERENCE_PATTERN,
} as const;

const outcomeMetadataSchema = {
  type: "object",
  additionalProperties: false,
  dependentRequired: {
    value_minor: ["currency"],
    currency: ["value_minor"],
  },
  properties: {
    channel: outcomeSafeLabelSchema,
    campaign_ref: outcomeSafeReferenceSchema,
    territory_code: outcomeSafeLabelSchema,
    quantity: { type: "integer", minimum: 1, maximum: 100000 },
    value_minor: {
      type: "integer",
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
  },
} as const;

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Leadgrid Public API",
    version: "1.2.0",
    description:
      "Stabilt schema for 3.-parts-integrasjoner mot Leadgrid (Salesforce, HubSpot, custom connectors). Auth: `Authorization: Bearer lgk_live_...`. Nye nøkler er bundet til ett Leadgrid-prosjekt; eksplisitte admin-nøkler med organisasjonstilgang må angi project_id på hvert datakall.",
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
          project_id: { type: "string", nullable: true },
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
      OutcomeEvent: {
        type: "object",
        required: [
          "id",
          "organization_id",
          "project_id",
          "lead_id",
          "event_type",
          "external_event_id",
          "occurred_at",
          "metadata",
          "schema_version",
          "created_at",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          organization_id: { type: "string", format: "uuid" },
          project_id: { type: "string" },
          lead_id: { type: "string", format: "uuid" },
          discovery_candidate_id: {
            type: "string",
            format: "uuid",
            nullable: true,
            description:
              "Server-derived first Discovery import candidate, when one exists.",
          },
          discovery_run_id: {
            type: "string",
            format: "uuid",
            nullable: true,
            description:
              "Server-derived Discovery run that first imported the lead.",
          },
          discovery_profile_id: {
            type: "string",
            format: "uuid",
            nullable: true,
            description:
              "Server-derived Discovery profile; null for non-Discovery or ad-hoc imports.",
          },
          discovery_attributed_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            description:
              "Timestamp of the authoritative first Discovery import.",
          },
          event_type: {
            type: "string",
            enum: [
              "pilot_invited",
              "meeting_completed",
              "profile_published",
              "inquiry_received",
              "booking_confirmed",
              "attendance_confirmed",
            ],
          },
          external_event_id: outcomeSafeReferenceSchema,
          occurred_at: {
            type: "string",
            format: "date-time",
            description:
              "Actual event time with an explicit timezone offset; values more than five minutes in the future are rejected.",
          },
          metadata: outcomeMetadataSchema,
          schema_version: { type: "integer", enum: [1] },
          created_at: { type: "string", format: "date-time" },
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
                    project_id: { type: "string", nullable: true },
                    access_scope: {
                      type: "string",
                      enum: ["project", "organization"],
                    },
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
        summary: "List leads for API-keyens prosjekt",
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
          {
            name: "project_id",
            in: "query",
            description:
              "Valgfritt for prosjektbundne nøkler og må da samsvare med bindingen. Påkrevd for eksplisitte organisasjonsnøkler.",
            schema: { type: "string", maxLength: 255 },
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
                  project_id: {
                    type: "string",
                    maxLength: 255,
                    description:
                      "Valgfritt for prosjektbundne nøkler og må da samsvare med bindingen. Påkrevd for eksplisitte organisasjonsnøkler.",
                  },
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
          {
            name: "project_id",
            in: "query",
            description:
              "Valgfritt for prosjektbundne nøkler og må da samsvare med bindingen. Påkrevd for eksplisitte organisasjonsnøkler.",
            schema: { type: "string", maxLength: 255 },
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
    "/api/v1/projects/{projectId}/leads/{leadId}/outcome-events": {
      post: {
        summary: "Registrer et append-only prosjektresultat",
        description:
          "Knytter et aggregert kommersielt resultat til én lead i API-nøkkelens tillatte aktive prosjekt. Endepunktet avviser fritekst og pasient-/kontaktdata. Identiske retries returnerer eksisterende hendelse.",
        parameters: [
          {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string", maxLength: 255 },
          },
          {
            name: "leadId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            description:
              "Stabil retry-nøkkel. Dersom den utelates brukes external_event_id.",
            schema: outcomeSafeReferenceSchema,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["event_type", "external_event_id", "occurred_at"],
                properties: {
                  event_type: {
                    type: "string",
                    enum: [
                      "pilot_invited",
                      "meeting_completed",
                      "profile_published",
                      "inquiry_received",
                      "booking_confirmed",
                      "attendance_confirmed",
                    ],
                  },
                  external_event_id: outcomeSafeReferenceSchema,
                  occurred_at: {
                    type: "string",
                    format: "date-time",
                    description:
                      "Actual event time with an explicit timezone offset; values more than five minutes in the future are rejected.",
                  },
                  metadata: outcomeMetadataSchema,
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Idempotent replay; eksisterende hendelse returneres.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/OutcomeEvent" },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
          "201": {
            description: "Ny hendelse registrert.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/OutcomeEvent" },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Ugyldig path, payload eller idempotensnøkkel.",
          },
          "401": { description: "Manglende eller ugyldig API-key." },
          "403": { description: "Mangler scope outcomes.write." },
          "404": { description: "Aktivt prosjekt/lead-scope finnes ikke." },
          "409": {
            description: "Retry-identifikator gjenbrukt med annet innhold.",
          },
          "429": { description: "Rate-limit overskredet." },
        },
      },
    },
    "/api/v1/recommendations": {
      get: {
        summary: "List Next Best Action-anbefalinger for API-keyens prosjekt",
        parameters: [
          {
            name: "project_id",
            in: "query",
            description:
              "Valgfritt for prosjektbundne nøkler og må da samsvare med bindingen. Påkrevd for eksplisitte organisasjonsnøkler.",
            schema: { type: "string", maxLength: 255 },
          },
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

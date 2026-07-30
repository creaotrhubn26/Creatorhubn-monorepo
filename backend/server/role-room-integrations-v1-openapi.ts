/**
 * role-room-integrations-v1-openapi.ts
 *
 * OpenAPI 3.1-spesifikasjon for Role Room Integration v1 (Del A punkt 150).
 *
 * Bakgrunn: API-et var i drift uten maskinlesbar dokumentasjon. Eneste vei
 * til å finne ut hvordan det oppførte seg var å prøve mot produksjon — det
 * var derfor smoke-testene kjørte i prod. Spesifikasjonen her dokumenterer
 * kontraktene som faktisk gjelder, med vekt på det integratorer snubler i:
 * konvolutt-formen, idempotens på skriv, paginering og feilkoder.
 *
 * Serveres som JSON på GET /api/integrations/v1/role-room/openapi.json.
 *
 * Holdes for hånd, ikke generert. Ved endring i rutene skal denne oppdateres
 * i samme commit — testen i role-room-integrations-v1-openapi.test.ts holder
 * sti-listen i spec-en opp mot ruteren og feiler når de gilder fra hverandre.
 */

const BASE_PATH = "/api/integrations/v1/role-room";

/** Feil-konvolutten alle 4xx/5xx-svar bruker. */
const ERROR_RESPONSE = {
  description: "Feil. Kroppen er alltid en error-konvolutt.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
    },
  },
};

const errorResponses = (...codes: Array<[string, string]>) =>
  Object.fromEntries(codes.map(([code, description]) => [code, { ...ERROR_RESPONSE, description }]));

/** Standard feilsvar på alle autentiserte endepunkter. */
const AUTH_ERRORS = errorResponses(
  ["401", "Mangler eller ugyldig API-nøkkel."],
  ["403", "Nøkkelen mangler nødvendig scope, eller har ikke tilgang til prosjektet."],
  ["429", "Rate limit overskredet. Se retry-after-headeren."],
);

const PAGINATION_PARAMS = [
  {
    name: "limit",
    in: "query",
    description: "Maks antall rader (1–100, default 50).",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
  },
  {
    name: "offset",
    in: "query",
    description: "Hopp over så mange rader (default 0).",
    schema: { type: "integer", minimum: 0, default: 0 },
  },
];

const PROJECT_ID_PARAM = {
  name: "projectId",
  in: "path",
  required: true,
  description: "Role Room-prosjektets id.",
  schema: { type: "string" },
};

const IDEMPOTENCY_HEADER = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  description:
    "Påkrevd på alle skriveoperasjoner. Samme nøkkel med samme kropp gir det opprinnelige " +
    "svaret om igjen (med x-idempotency-replayed: true). Samme nøkkel med ulik kropp gir 409.",
  schema: { type: "string", maxLength: 255 },
};

/** Leseendepunkt scopet til ett prosjekt — samme form for alle underressurser. */
const projectSubresource = (name: string, summary: string) => ({
  get: {
    tags: ["Prosjekter"],
    summary,
    operationId: `list${name[0].toUpperCase()}${name.slice(1)}`,
    security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
    parameters: [PROJECT_ID_PARAM, ...PAGINATION_PARAMS],
    responses: {
      200: {
        description: "Liste med rader i data-konvolutten.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ListEnvelope" },
          },
        },
      },
      ...AUTH_ERRORS,
      404: { ...ERROR_RESPONSE, description: "Prosjektet finnes ikke." },
    },
  },
});

export const ROLE_ROOM_V1_OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "The Role Room — Integration v1",
    version: "1.0.0",
    description: [
      "REST-API for integrasjoner mot The Role Room (casting og produksjon).",
      "",
      "## Autentisering",
      "Send API-nøkkelen som `Authorization: Bearer rri_…` eller `x-api-key: rri_…`.",
      "Nøkler har scopes: `projects.read` og/eller `projects.write`.",
      "",
      "## Konvolutter",
      "Alle svar er innpakket. Suksess: `{ data, meta: { requestId, … } }`.",
      "Feil: `{ error: { code, message, requestId, details? } }`.",
      "`requestId` går igjen i `x-request-id`-headeren og bør logges — den er",
      "det raskeste sporet ved support.",
      "",
      "## Idempotens",
      "Alle skriveoperasjoner krever `Idempotency-Key`. Gjentatt kall med samme",
      "nøkkel og kropp returnerer det opprinnelige svaret framfor å utføre",
      "operasjonen på nytt. Dette er den anbefalte måten å håndtere retry på:",
      "et nettverksbrudd midt i en POST kan trygt prøves om igjen.",
      "",
      "## Paginering",
      "Lese-endepunkter tar `limit` (maks 100) og `offset`. Prosjektlisten tar",
      "i tillegg `updatedAfter` (ISO-tidspunkt) for effektiv inkrementell synk —",
      "hent bare det som er endret siden forrige kjøring.",
      "",
      "## Rate limits",
      "Svar bærer `x-rate-limit-limit` og `x-rate-limit-remaining`. Ved 429",
      "settes `retry-after` (sekunder). Respekter den framfor å prøve straks.",
      "",
      "## Sandbox",
      "Se `docs/role-room/integration-v1-guide.md` for hvordan du setter opp en",
      "test-konto med egne nøkler mot et testprosjekt, slik at du slipper å",
      "verifisere mot produksjonsdata.",
    ].join("\n"),
    contact: { name: "The Role Room", email: "support@theroleroom.com" },
  },

  servers: [
    { url: `https://www.theroleroom.com${BASE_PATH}`, description: "Produksjon" },
  ],

  tags: [
    { name: "System", description: "Helsesjekk og metadata." },
    { name: "Prosjekter", description: "Prosjekter og underressurser." },
    { name: "Klient", description: "Klient-brief og delt materiell." },
    { name: "Mapping", description: "Kobling mellom eksterne id-er og Role Room-id-er." },
    { name: "Admin", description: "Konto-, nøkkel- og webhook-forvaltning." },
  ],

  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Helsesjekk. Krever ikke autentisering.",
        operationId: "health",
        security: [],
        responses: {
          200: {
            description: "Tjenesten svarer.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { type: "object", properties: { status: { type: "string" } } } },
                },
              },
            },
          },
        },
      },
    },

    "/projects": {
      get: {
        tags: ["Prosjekter"],
        summary: "List prosjekter nøkkelen har tilgang til.",
        operationId: "listProjects",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          ...PAGINATION_PARAMS,
          {
            name: "status",
            in: "query",
            description: "Filtrer på prosjektstatus.",
            schema: { type: "string", maxLength: 50 },
          },
          {
            name: "updatedAfter",
            in: "query",
            description:
              "ISO-tidspunkt. Returnerer bare prosjekter endret etter dette — bruk for inkrementell synk.",
            schema: { type: "string", format: "date-time" },
          },
        ],
        responses: {
          200: {
            description: "Prosjektliste.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ListEnvelope" } },
            },
          },
          ...AUTH_ERRORS,
        },
      },
      post: {
        tags: ["Prosjekter"],
        summary: "Opprett prosjekt.",
        operationId: "createProject",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [IDEMPOTENCY_HEADER],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ProjectInput" } },
          },
        },
        responses: {
          201: {
            description: "Opprettet.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ProjectEnvelope" } },
            },
          },
          ...AUTH_ERRORS,
          ...errorResponses(
            ["400", "Ugyldig kropp, eller Idempotency-Key mangler."],
            ["409", "Idempotency-nøkkelen er brukt med en annen kropp, eller er under behandling."],
          ),
        },
      },
    },

    "/projects/{projectId}": {
      get: {
        tags: ["Prosjekter"],
        summary: "Hent ett prosjekt.",
        operationId: "getProject",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [PROJECT_ID_PARAM],
        responses: {
          200: {
            description: "Prosjektet.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ProjectEnvelope" } },
            },
          },
          ...AUTH_ERRORS,
          404: { ...ERROR_RESPONSE, description: "Prosjektet finnes ikke." },
        },
      },
      patch: {
        tags: ["Prosjekter"],
        summary: "Oppdater prosjekt (delvis).",
        operationId: "updateProject",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [PROJECT_ID_PARAM, IDEMPOTENCY_HEADER],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ProjectInput" } },
          },
        },
        responses: {
          200: {
            description: "Oppdatert.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ProjectEnvelope" } },
            },
          },
          ...AUTH_ERRORS,
          ...errorResponses(
            ["400", "Ugyldig kropp, eller Idempotency-Key mangler."],
            ["404", "Prosjektet finnes ikke."],
            ["409", "Idempotency-konflikt."],
          ),
        },
      },
    },

    "/projects/{projectId}/roles": projectSubresource("roles", "List roller på prosjektet."),
    "/projects/{projectId}/candidates": projectSubresource("candidates", "List kandidater på prosjektet."),
    "/projects/{projectId}/crew": projectSubresource("crew", "List crew/team på prosjektet."),
    "/projects/{projectId}/schedules": projectSubresource("schedules", "List planlagte dager på prosjektet."),

    "/projects/{projectId}/client-intake": {
      get: {
        tags: ["Klient"],
        summary: "Hent klient-brief.",
        operationId: "getClientIntake",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [PROJECT_ID_PARAM],
        responses: {
          200: {
            description: "Briefen, eller null hvis den ikke er fylt ut.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          ...AUTH_ERRORS,
        },
      },
      put: {
        tags: ["Klient"],
        summary: "Erstatt klient-brief.",
        operationId: "putClientIntake",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [PROJECT_ID_PARAM, IDEMPOTENCY_HEADER],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          200: { description: "Lagret.", content: { "application/json": { schema: { type: "object" } } } },
          ...AUTH_ERRORS,
          ...errorResponses(["400", "Ugyldig kropp, eller Idempotency-Key mangler."], ["409", "Idempotency-konflikt."]),
        },
      },
    },

    "/projects/{projectId}/client-materials": {
      get: {
        tags: ["Klient"],
        summary: "List referansemateriell klienten har delt.",
        operationId: "listClientMaterials",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [PROJECT_ID_PARAM, ...PAGINATION_PARAMS],
        responses: {
          200: {
            description: "Materiell-liste.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ListEnvelope" } } },
          },
          ...AUTH_ERRORS,
        },
      },
      post: {
        tags: ["Klient"],
        summary: "Legg til referansemateriell.",
        operationId: "createClientMaterial",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [PROJECT_ID_PARAM, IDEMPOTENCY_HEADER],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          201: { description: "Opprettet.", content: { "application/json": { schema: { type: "object" } } } },
          ...AUTH_ERRORS,
          ...errorResponses(["400", "Ugyldig kropp, eller Idempotency-Key mangler."], ["409", "Idempotency-konflikt."]),
        },
      },
    },

    "/projects/{projectId}/mappings": {
      get: {
        tags: ["Mapping"],
        summary: "Hent id-koblinger mellom eksternt system og Role Room.",
        operationId: "getMappings",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [PROJECT_ID_PARAM],
        responses: {
          200: { description: "Koblingene.", content: { "application/json": { schema: { type: "object" } } } },
          ...AUTH_ERRORS,
        },
      },
      put: {
        tags: ["Mapping"],
        summary: "Sett id-kobling (upsert).",
        operationId: "putMapping",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [PROJECT_ID_PARAM, IDEMPOTENCY_HEADER],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: {
          200: { description: "Lagret.", content: { "application/json": { schema: { type: "object" } } } },
          ...AUTH_ERRORS,
          ...errorResponses(["400", "Ugyldig kropp, eller Idempotency-Key mangler."], ["409", "Idempotency-konflikt."]),
        },
      },
    },

    // ── Admin ──────────────────────────────────────────────────────────────
    "/admin/accounts": {
      get: {
        tags: ["Admin"], summary: "List integrasjonskontoer.", operationId: "listAccounts",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        responses: { 200: { description: "Kontoer.", content: { "application/json": { schema: { type: "object" } } } }, ...AUTH_ERRORS },
      },
      post: {
        tags: ["Admin"], summary: "Opprett integrasjonskonto.", operationId: "createAccount",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [IDEMPOTENCY_HEADER],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 201: { description: "Opprettet.", content: { "application/json": { schema: { type: "object" } } } }, ...AUTH_ERRORS },
      },
    },
    "/admin/accounts/{accountId}/api-keys": {
      get: {
        tags: ["Admin"], summary: "List nøkler på en konto (aldri selve nøkkelen).", operationId: "listApiKeys",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [{ name: "accountId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Nøkkel-metadata.", content: { "application/json": { schema: { type: "object" } } } }, ...AUTH_ERRORS },
      },
      post: {
        tags: ["Admin"],
        summary: "Opprett API-nøkkel. Klartekst-nøkkelen vises KUN i dette svaret.",
        operationId: "createApiKey",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: "accountId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          IDEMPOTENCY_HEADER,
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 201: { description: "Opprettet.", content: { "application/json": { schema: { type: "object" } } } }, ...AUTH_ERRORS },
      },
    },
    "/admin/accounts/{accountId}/webhooks": {
      get: {
        tags: ["Admin"], summary: "List webhooks på en konto.", operationId: "listWebhooks",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [{ name: "accountId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Webhooks.", content: { "application/json": { schema: { type: "object" } } } }, ...AUTH_ERRORS },
      },
      post: {
        tags: ["Admin"],
        summary: "Registrer webhook. Events: project.created, project.updated, mapping.upserted.",
        operationId: "createWebhook",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: "accountId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          IDEMPOTENCY_HEADER,
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookInput" } } } },
        responses: { 201: { description: "Registrert.", content: { "application/json": { schema: { type: "object" } } } }, ...AUTH_ERRORS },
      },
    },
    "/admin/accounts/{accountId}/webhooks/{webhookId}": {
      patch: {
        tags: ["Admin"], summary: "Oppdater webhook (f.eks. deaktiver).", operationId: "updateWebhook",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          { name: "accountId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "webhookId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          IDEMPOTENCY_HEADER,
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Oppdatert.", content: { "application/json": { schema: { type: "object" } } } }, ...AUTH_ERRORS },
      },
    },
    "/admin/webhooks/dispatch": {
      post: {
        tags: ["Admin"],
        summary: "Tøm webhook-utboksen manuelt (normalt drevet av bakgrunnsjobb).",
        operationId: "dispatchWebhooks",
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  accountId: { type: "string", format: "uuid" },
                  limit: { type: "integer", minimum: 1, maximum: 100 },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Resultat.", content: { "application/json": { schema: { type: "object" } } } }, ...AUTH_ERRORS },
      },
    },
  },

  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Integrasjonsnøkkel med rri_-prefiks.",
      },
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Samme nøkkel som `Authorization: Bearer rri_…`.",
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: {
                type: "string",
                description: "Maskinlesbar feilkode, f.eks. missing_idempotency_key.",
              },
              message: { type: "string", description: "Menneskelesbar forklaring." },
              requestId: { type: "string", description: "Går igjen i x-request-id. Oppgi ved support." },
              details: { description: "Valgfrie detaljer, f.eks. valideringsfeil per felt." },
            },
          },
        },
      },
      ListEnvelope: {
        type: "object",
        required: ["data", "meta"],
        properties: {
          data: { type: "array", items: { type: "object" } },
          meta: {
            type: "object",
            properties: {
              requestId: { type: "string" },
              limit: { type: "integer" },
              offset: { type: "integer" },
              hasMore: { type: "boolean", description: "Om det finnes flere rader etter denne siden." },
            },
          },
        },
      },
      ProjectEnvelope: {
        type: "object",
        required: ["data", "meta"],
        properties: {
          data: { $ref: "#/components/schemas/Project" },
          meta: { type: "object", properties: { requestId: { type: "string" } } },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          status: { type: "string" },
          projectType: { type: "string", nullable: true },
          startDate: { type: "string", format: "date", nullable: true },
          endDate: { type: "string", format: "date", nullable: true },
          currency: { type: "string" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProjectInput: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string" },
          projectType: { type: "string" },
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
        },
      },
      WebhookInput: {
        type: "object",
        required: ["url", "events"],
        properties: {
          url: { type: "string", format: "uri" },
          events: {
            type: "array",
            items: { type: "string", enum: ["project.created", "project.updated", "mapping.upserted"] },
          },
          secret: { type: "string", description: "Brukes til signering av utgående kall." },
        },
      },
    },
  },
} as const;

/** Stiene spec-en dokumenterer — brukes av testen som holder den mot ruteren. */
export function documentedPaths(): string[] {
  return Object.keys(ROLE_ROOM_V1_OPENAPI.paths).sort();
}

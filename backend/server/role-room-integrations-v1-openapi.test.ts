import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { ROLE_ROOM_V1_OPENAPI, documentedPaths } from "./role-room-integrations-v1-openapi.js";

/**
 * En håndholdt spesifikasjon er bare verdt noe så lenge den stemmer. Testene
 * her holder spec-en opp mot selve ruteren, slik at et nytt endepunkt uten
 * dokumentasjon (eller en dokumentert sti som er fjernet) feiler i CI framfor
 * å oppdages av en integrator i produksjon.
 */

const ROUTES_SRC = readFileSync(
  join(__dirname, "role-room-integrations-v1-routes.ts"),
  "utf8",
);

/** Plukker ut stiene ruteren faktisk registrerer. */
function routerPaths(): string[] {
  const found = new Set<string>();
  const re = /router\.(get|post|patch|put|delete)\(\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ROUTES_SRC)) !== null) {
    // OpenAPI bruker {param}, Express bruker :param.
    found.add(m[2].replace(/:([A-Za-z0-9_]+)/g, "{$1}"));
  }
  // openapi.json dokumenterer seg ikke selv.
  found.delete("/openapi.json");
  return [...found].sort();
}

describe("OpenAPI-spesifikasjonen holder tritt med ruteren", () => {
  it("dokumenterer hver sti ruteren registrerer", () => {
    const undocumented = routerPaths().filter((p) => !documentedPaths().includes(p));
    expect(undocumented, `Udokumenterte stier: ${undocumented.join(", ")}`).toEqual([]);
  });

  it("dokumenterer ingen stier som ikke finnes i ruteren", () => {
    const routes = routerPaths();
    const stale = documentedPaths().filter((p) => !routes.includes(p));
    expect(stale, `Stier i spec-en som ruteren ikke har: ${stale.join(", ")}`).toEqual([]);
  });
});

describe("spesifikasjonens form", () => {
  it("er OpenAPI 3.1 med tittel og versjon", () => {
    expect(ROLE_ROOM_V1_OPENAPI.openapi).toBe("3.1.0");
    expect(ROLE_ROOM_V1_OPENAPI.info.title).toContain("Role Room");
    expect(ROLE_ROOM_V1_OPENAPI.info.version).toBeTruthy();
  });

  it("beskriver begge autentiseringsmåtene ruteren godtar", () => {
    const schemes = ROLE_ROOM_V1_OPENAPI.components.securitySchemes;
    expect(schemes.ApiKeyAuth.name).toBe("x-api-key");
    expect(schemes.BearerAuth.scheme).toBe("bearer");
  });

  it("krever Idempotency-Key på alle skriveoperasjoner", () => {
    const writeVerbs = ["post", "patch", "put", "delete"];
    const missing: string[] = [];

    for (const [path, item] of Object.entries(ROLE_ROOM_V1_OPENAPI.paths)) {
      for (const verb of writeVerbs) {
        const op = (item as Record<string, unknown>)[verb] as
          | { parameters?: Array<{ name: string }> }
          | undefined;
        if (!op) continue;
        // Dispatch-endepunktet er en intern trigger uten sideeffekt-risiko
        // ved gjentakelse — utboksen er allerede idempotent per event.
        if (path === "/admin/webhooks/dispatch") continue;
        const hasKey = (op.parameters ?? []).some((p) => p.name === "Idempotency-Key");
        if (!hasKey) missing.push(`${verb.toUpperCase()} ${path}`);
      }
    }

    expect(missing, `Skriv uten Idempotency-Key: ${missing.join(", ")}`).toEqual([]);
  });

  it("gir hvert autentisert endepunkt 401- og 403-svar", () => {
    const missing: string[] = [];
    for (const [path, item] of Object.entries(ROLE_ROOM_V1_OPENAPI.paths)) {
      for (const [verb, op] of Object.entries(item as Record<string, unknown>)) {
        const operation = op as { security?: unknown[]; responses?: Record<string, unknown> };
        // /health er bevisst åpen (security: []).
        if (Array.isArray(operation.security) && operation.security.length === 0) continue;
        if (!operation.responses?.["401"]) missing.push(`${verb.toUpperCase()} ${path} (401)`);
        if (!operation.responses?.["403"]) missing.push(`${verb.toUpperCase()} ${path} (403)`);
      }
    }
    expect(missing, `Mangler auth-svar: ${missing.join(", ")}`).toEqual([]);
  });

  it("dokumenterer webhook-eventene som faktisk sendes", () => {
    const events = ROLE_ROOM_V1_OPENAPI.components.schemas.WebhookInput.properties.events.items.enum;
    // Holdes i synk med eventType-strengene i ruteren.
    for (const evt of ["project.created", "project.updated", "mapping.upserted"]) {
      expect(ROUTES_SRC).toContain(`'${evt}'`);
      expect(events).toContain(evt);
    }
  });

  it("er serialiserbar som JSON (serveres direkte)", () => {
    expect(() => JSON.parse(JSON.stringify(ROLE_ROOM_V1_OPENAPI))).not.toThrow();
  });
});

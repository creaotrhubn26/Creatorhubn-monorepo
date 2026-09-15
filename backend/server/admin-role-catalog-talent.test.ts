/**
 * Kontrakt-test for talent-rollen i ADMIN_ROLE_CATALOG.
 *
 * normalizeAdminRoleId() returnerer "user" for enhver rolle-id som ikke står i
 * katalogen. Står ikke "talent" der, blir en talent-sesjon stille vasket til
 * "user", og Talents-appen blir utilgjengelig som hjem. Nøyaktig samme
 * feilklasse som super_admin hadde (PR #2332).
 *
 * Katalogen og normaliseringen bor i index.ts, som starter serveren ved
 * import. Testen leser derfor kilden, slik migrasjons-kontrakttestene gjør.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(path.join(here, "index.ts"), "utf8");

describe("talent i rollekatalogen", () => {
  it("har en talent-oppføring i ADMIN_ROLE_CATALOG", () => {
    const catalogStart = indexSource.indexOf("const ADMIN_ROLE_CATALOG: AdminRoleCatalogEntry[] = [");
    expect(catalogStart).toBeGreaterThan(-1);
    const catalogEnd = indexSource.indexOf("const adminRoleCatalogById", catalogStart);
    const catalog = indexSource.slice(catalogStart, catalogEnd);

    expect(catalog).toContain('id: "talent"');
  });

  it("gir talent ingen adminrettigheter", () => {
    expect(indexSource).toContain('const ADMIN_SESSION_ROLES = new Set(["admin", "super_admin"]);');

    const entryStart = indexSource.indexOf('id: "talent"');
    const entry = indexSource.slice(entryStart, entryStart + 400);
    expect(entry).toContain('permissions: ["dashboard:read"]');
    expect(entry).not.toContain("users:write");
    expect(entry).not.toContain("roles:write");
    expect(entry).not.toContain("impersonate");
  });
});

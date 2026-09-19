/**
 * Mappelista i project-folder-structure.ts er en bevisst duplisering av
 * kategorien 'default' i frontend/shared/folder-configuration.ts. Backend har
 * ingen byggvei til frontend/shared, så listene kan ikke deles i kode.
 *
 * Denne testen leser frontend-fila fra disk og feiler hvis de skiller lag.
 * Uten den ville noen lagt til en mappe ett sted, og brukere ville fått
 * forskjellig struktur i Drive og i vår egen lagring — uten at noe sa fra.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_FOLDERS,
  projectStoragePrefix,
  createProjectFolderStructure,
} from "./project-folder-structure";

const here = path.dirname(fileURLToPath(import.meta.url));
const FOLDER_CONFIG = path.resolve(here, "../../frontend/shared/folder-configuration.ts");

/** Plukker ut id + name for alle oppføringer med category: 'default'. */
function readDefaultFoldersFromSharedConfig(): Array<{ id: string; name: string }> {
  const source = readFileSync(FOLDER_CONFIG, "utf8");
  const entries = [
    ...source.matchAll(
      /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',[\s\S]*?category:\s*'([^']+)',\s*\}/g,
    ),
  ];
  return entries
    .filter((m) => m[3] === "default")
    .map((m) => ({ id: m[1], name: m[2] }));
}

describe("prosjekt-mappestruktur", () => {
  it("speiler standardmappene i frontend/shared/folder-configuration.ts", () => {
    const shared = readDefaultFoldersFromSharedConfig();

    // Sanity: regexen må faktisk finne noe. Endres formatet på konfigfila,
    // skal testen feile her i stedet for å stille godkjenne en tom liste.
    expect(shared.length).toBeGreaterThan(0);

    expect(DEFAULT_PROJECT_FOLDERS).toEqual(shared);
  });

  it("nummererer mappene så object storage sorterer dem riktig", () => {
    const ids = DEFAULT_PROJECT_FOLDERS.map((f) => f.id);
    expect(ids).toEqual([...ids].sort());
    for (const id of ids) {
      expect(id).toMatch(/^\d{2}_/);
    }
  });

  it("holder prosjekter adskilt per bruker i nøkkelrommet", () => {
    const a = projectStoragePrefix("bruker-a", "prosjekt-1");
    const b = projectStoragePrefix("bruker-b", "prosjekt-1");
    expect(a).not.toEqual(b);
    expect(a).toBe("projects/bruker-a/prosjekt-1");
  });

  it("hopper over i stedet for å kaste når lagring ikke er konfigurert", async () => {
    // Uten lagringsoppsett i testmiljøet skal dette være en no-op, ikke en
    // feil: prosjektet er allerede opprettet når vi kommer hit.
    const result = await createProjectFolderStructure("bruker", "prosjekt");
    expect(result.skipped).toBe(true);
    expect(result.created).toEqual([]);
  });

  it("hopper over når userId eller projectId mangler", async () => {
    await expect(createProjectFolderStructure("", "prosjekt")).resolves.toMatchObject({
      skipped: true,
    });
    await expect(createProjectFolderStructure("bruker", "")).resolves.toMatchObject({
      skipped: true,
    });
  });
});

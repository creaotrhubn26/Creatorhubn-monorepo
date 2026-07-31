/**
 * Integrasjonstest for asset-versjonering mot en ekte Postgres.
 *
 * Hoppes over med mindre RR_TEST_DATABASE_URL peker på en database det er
 * greit å opprette og droppe tabeller i. Garantiene her — unik nøkkel per
 * versjon, riktig avløsning, samtidighet — ligger i unik-indeksen og en
 * transaksjon. En test med mocket pool ville ikke rørt noen av dem.
 *
 *   createdb versiontest
 *   RR_TEST_DATABASE_URL=postgres://…/versiontest npx vitest run \
 *     server/capture-asset-version-service.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import {
  currentVersion,
  discardVersion,
  listVersions,
  markVersionReleased,
  promoteVersion,
  reserveVersion,
  supersededVersions,
  versionForKey,
  versionSegment,
} from "./capture-asset-version-service.js";

const DB_URL = process.env.RR_TEST_DATABASE_URL;

const PREREQ_SQL = `
DROP TABLE IF EXISTS capture_asset_versions, capture_assets CASCADE;

CREATE TABLE capture_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preview_key VARCHAR(1024),
  full_key VARCHAR(1024),
  raw_key VARCHAR(1024),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const ASSET = "11111111-1111-1111-1111-111111111111";
const key = (kind: string, n: number) =>
  `capture-b2/u1/s1/${ASSET}/${kind}/${versionSegment(n)}A001.mov`;

const d = DB_URL ? describe : describe.skip;

d("asset-versjonering", () => {
  let pool: Pool;

  const reserve = (kind: "preview" | "full" | "raw" = "full") =>
    reserveVersion(pool, {
      assetId: ASSET,
      kind,
      bucket: "the-role-room-prod",
      backend: "b2",
      contentType: "video/quicktime",
      uploadedBy: "dit",
      buildKey: (n) => key(kind, n),
    });

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL });
    await pool.query(PREREQ_SQL);
    await pool.query(
      readFileSync(
        join(process.cwd(), "migrations", "0467_capture_asset_versions.sql"),
        "utf8",
      ),
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE capture_asset_versions, capture_assets CASCADE");
    await pool.query("INSERT INTO capture_assets (id) VALUES ($1)", [ASSET]);
  });

  describe("reservasjon", () => {
    it("teller oppover per asset og kind", async () => {
      expect((await reserve("full")).versionNumber).toBe(1);
      expect((await reserve("full")).versionNumber).toBe(2);
      // En ny preview gjør ikke originalen til versjon 2.
      expect((await reserve("preview")).versionNumber).toBe(1);
    });

    it("gir hver versjon sin egen objektnøkkel", async () => {
      // Kjernen i hele endringen: uten versjonsleddet traff nummer to
      // samme nøkkel og overskrev fila i bøtta.
      const v1 = await reserve();
      const v2 = await reserve();
      expect(v1.objectKey).not.toBe(v2.objectKey);
      expect(v2.objectKey).toContain("/v2/");
    });

    it("starter i 'uploading', ikke som gjeldende", async () => {
      const v = await reserve();
      expect(v.status).toBe("uploading");
      expect(await currentVersion(pool, ASSET, "full")).toBeNull();
    });

    it("lar ikke to samtidige reservasjoner få samme nummer", async () => {
      // Unik-indeksen er det som hindrer at begge skriver samme nøkkel.
      const results = await Promise.all([
        reserve(), reserve(), reserve(), reserve(), reserve(),
      ]);
      const numbers = results.map((r) => r.versionNumber).sort((a, b) => a - b);
      expect(numbers).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(results.map((r) => r.objectKey)).size).toBe(5);
    });
  });

  describe("promotering", () => {
    it("gjør versjonen gjeldende og setter nøkkelen på asset-raden", async () => {
      const v = await reserve();
      const promoted = await promoteVersion(pool, { versionId: v.id, sizeBytes: 1234 });

      expect(promoted?.status).toBe("ready");
      expect(promoted?.sizeBytes).toBe(1234);
      const asset = await pool.query("SELECT full_key FROM capture_assets WHERE id = $1", [ASSET]);
      expect(asset.rows[0].full_key).toBe(v.objectKey);
    });

    it("avløser den forrige uten å slette den", async () => {
      // Den gamle fila blir liggende og koster fortsatt penger. Den er
      // avløst, ikke borte.
      const v1 = await reserve();
      await promoteVersion(pool, { versionId: v1.id, sizeBytes: 100 });
      const v2 = await reserve();
      await promoteVersion(pool, { versionId: v2.id, sizeBytes: 200 });

      const all = await listVersions(pool, ASSET, "full");
      const first = all.find((v) => v.versionNumber === 1)!;
      expect(first.supersededAt).not.toBeNull();
      expect(first.status).toBe("ready");
      expect((await currentVersion(pool, ASSET, "full"))?.versionNumber).toBe(2);
    });

    it("flytter asset-nøkkelen til den nye versjonen", async () => {
      const v1 = await reserve();
      await promoteVersion(pool, { versionId: v1.id, sizeBytes: 100 });
      const v2 = await reserve();
      await promoteVersion(pool, { versionId: v2.id, sizeBytes: 200 });

      const asset = await pool.query("SELECT full_key FROM capture_assets WHERE id = $1", [ASSET]);
      expect(asset.rows[0].full_key).toBe(v2.objectKey);
    });

    it("rører ikke andre kinds når én promoteres", async () => {
      const full = await reserve("full");
      const preview = await reserve("preview");
      await promoteVersion(pool, { versionId: full.id, sizeBytes: 100 });
      await promoteVersion(pool, { versionId: preview.id, sizeBytes: 10 });

      const asset = await pool.query(
        "SELECT full_key, preview_key, raw_key FROM capture_assets WHERE id = $1",
        [ASSET],
      );
      expect(asset.rows[0].full_key).toBe(full.objectKey);
      expect(asset.rows[0].preview_key).toBe(preview.objectKey);
      expect(asset.rows[0].raw_key).toBeNull();
    });

    it("avløser ikke en parallell opplasting som ennå ikke er ferdig", async () => {
      // En 'uploading'-rad har aldri vært gjeldende. Å sette
      // superseded_at på den ville løyet om historikken.
      const v1 = await reserve();
      const v2 = await reserve();
      await promoteVersion(pool, { versionId: v1.id, sizeBytes: 100 });

      const still = (await listVersions(pool, ASSET, "full")).find((v) => v.id === v2.id)!;
      expect(still.status).toBe("uploading");
      expect(still.supersededAt).toBeNull();
    });

    it("lar en eldre versjon promoteres på nytt og bli gjeldende igjen", async () => {
      // Rullback til forrige versjon etter at noen angret.
      const v1 = await reserve();
      await promoteVersion(pool, { versionId: v1.id, sizeBytes: 100 });
      const v2 = await reserve();
      await promoteVersion(pool, { versionId: v2.id, sizeBytes: 200 });

      await promoteVersion(pool, { versionId: v1.id, sizeBytes: 100 });
      expect((await currentVersion(pool, ASSET, "full"))?.versionNumber).toBe(1);
      const asset = await pool.query("SELECT full_key FROM capture_assets WHERE id = $1", [ASSET]);
      expect(asset.rows[0].full_key).toBe(v1.objectKey);
    });

    it("nekter når nøkkelen ikke er den som ble reservert", async () => {
      // En klient som laster opp til én nøkkel og ber oss promotere en
      // annen versjon ville ellers fått bytene ett sted og asset-raden
      // pekende et annet.
      const v = await reserve();
      const result = await promoteVersion(pool, {
        versionId: v.id,
        sizeBytes: 100,
        expectedObjectKey: "capture-b2/u1/s1/annet/full/v1/A001.mov",
      });
      expect(result).toBeNull();
      const asset = await pool.query("SELECT full_key FROM capture_assets WHERE id = $1", [ASSET]);
      expect(asset.rows[0].full_key).toBeNull();
    });

    it("godtar når nøkkelen stemmer", async () => {
      const v = await reserve();
      const result = await promoteVersion(pool, {
        versionId: v.id,
        sizeBytes: 100,
        expectedObjectKey: v.objectKey,
      });
      expect(result?.status).toBe("ready");
    });

    it("gir null for en versjon som ikke finnes", async () => {
      expect(
        await promoteVersion(pool, {
          versionId: "99999999-9999-9999-9999-999999999999",
          sizeBytes: 1,
        }),
      ).toBeNull();
    });

    it("promoterer ikke en frigjort versjon — fila er borte", async () => {
      const v = await reserve();
      await promoteVersion(pool, { versionId: v.id, sizeBytes: 100 });
      await markVersionReleased(pool, v.id);
      expect(await promoteVersion(pool, { versionId: v.id, sizeBytes: 100 })).toBeNull();
    });
  });

  describe("avbrudd", () => {
    it("frigir nummeret så neste opplasting kan bruke det", async () => {
      const v1 = await reserve();
      expect(await discardVersion(pool, v1.id)).toBe(true);
      // Uten dette ville hver avbrutte opplasting brent et nummer, og
      // historikken fått hull som ser ut som slettede filer.
      expect((await reserve()).versionNumber).toBe(1);
    });

    it("sletter ikke en ferdig versjon — den kan være godkjent", async () => {
      const v = await reserve();
      await promoteVersion(pool, { versionId: v.id, sizeBytes: 100 });
      expect(await discardVersion(pool, v.id)).toBe(false);
      expect(await listVersions(pool, ASSET, "full")).toHaveLength(1);
    });
  });

  describe("frigjøring", () => {
    it("finner avløste versjoner som er trygge å slette", async () => {
      const v1 = await reserve();
      await promoteVersion(pool, { versionId: v1.id, sizeBytes: 100 });
      const v2 = await reserve();
      await promoteVersion(pool, { versionId: v2.id, sizeBytes: 200 });

      const stale = await supersededVersions(pool, { olderThanDays: 0 });
      expect(stale.map((v) => v.versionNumber)).toEqual([1]);
    });

    it("tar aldri med den gjeldende versjonen", async () => {
      // Å frigjøre den ville etterlatt asset-raden pekende på et objekt
      // som ikke finnes, og hver signert URL ville gitt 404.
      const v = await reserve();
      await promoteVersion(pool, { versionId: v.id, sizeBytes: 100 });
      expect(await supersededVersions(pool, { olderThanDays: 0 })).toEqual([]);
    });

    it("venter til avløsningen er gammel nok", async () => {
      const v1 = await reserve();
      await promoteVersion(pool, { versionId: v1.id, sizeBytes: 100 });
      const v2 = await reserve();
      await promoteVersion(pool, { versionId: v2.id, sizeBytes: 200 });
      expect(await supersededVersions(pool, { olderThanDays: 30 })).toEqual([]);
    });

    it("tar ikke med en versjon som allerede er frigjort", async () => {
      const v1 = await reserve();
      await promoteVersion(pool, { versionId: v1.id, sizeBytes: 100 });
      const v2 = await reserve();
      await promoteVersion(pool, { versionId: v2.id, sizeBytes: 200 });
      await markVersionReleased(pool, v1.id);
      expect(await supersededVersions(pool, { olderThanDays: 0 })).toEqual([]);
    });
  });

  describe("oppslag", () => {
    it("finner versjonen fra en bar objektnøkkel", async () => {
      const v = await reserve();
      expect((await versionForKey(pool, v.objectKey))?.id).toBe(v.id);
    });

    it("gir null for en nøkkel vi ikke sporer", async () => {
      // Nøkler fra før versjonering fantes treffer ingen rad.
      expect(await versionForKey(pool, "capture/u1/s1/a1/full/gammel.mov")).toBeNull();
    });

    it("rydder versjonene når assetet slettes", async () => {
      await reserve();
      await pool.query("DELETE FROM capture_assets WHERE id = $1", [ASSET]);
      const r = await pool.query("SELECT count(*)::int AS n FROM capture_asset_versions");
      expect(r.rows[0].n).toBe(0);
    });
  });
});

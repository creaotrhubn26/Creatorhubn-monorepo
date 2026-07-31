/**
 * Integrasjonstest for produksjonseid lagring mot en ekte Postgres.
 *
 * Hoppes over med mindre RR_TEST_DATABASE_URL peker på en database det er
 * greit å opprette og droppe tabeller i. Logikken her ligger i all
 * hovedsak i SQL-funksjonen, så en test med mocket pool ville bare
 * bekreftet at strengen ble sendt — ikke at tallene stemmer.
 *
 *   createdb prodstoragetest
 *   RR_TEST_DATABASE_URL=postgres://…/prodstoragetest npx vitest run \
 *     server/production-storage-service.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import {
  accountProductionBytes,
  canProductionStore,
  getProductionStorage,
  listProductionsForAccount,
  reassignBillingUser,
  recordProductionUsage,
  recordStorageForProduction,
  resolveBillingUser,
  setProductionCap,
} from "./production-storage-service.js";

const DB_URL = process.env.RR_TEST_DATABASE_URL;

const PREREQ_SQL = `
DROP TABLE IF EXISTS role_room_production_storage_events,
  role_room_production_storage, user_storage_consumption,
  storage_consumption_events, casting_projects CASCADE;

CREATE TABLE casting_projects (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by VARCHAR(255)
);

-- Kontoledgeren som kvotesjekken leser fra.
CREATE TABLE user_storage_consumption (
  user_id TEXT PRIMARY KEY,
  total_bytes BIGINT NOT NULL DEFAULT 0
);
`;

const MB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;

const d = DB_URL ? describe : describe.skip;

d("produksjonseid lagring", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL });
    await pool.query(PREREQ_SQL);
    await pool.query(
      readFileSync(
        join(process.cwd(), "migrations", "0465_production_storage_ledger.sql"),
        "utf8",
      ),
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE role_room_production_storage_events,
                role_room_production_storage,
                user_storage_consumption,
                casting_projects CASCADE`,
    );
    await pool.query(
      `INSERT INTO casting_projects (id, name, created_by) VALUES
         ('nordlys', 'Nordlys', 'produsent'),
         ('vinterspor', 'Vinterspor', 'produsent'),
         ('foreldrelos', 'Foreldreløs', NULL)`,
    );
  });

  describe("hvem betaler", () => {
    it("faller tilbake til den som opprettet produksjonen", async () => {
      expect(await resolveBillingUser(pool, "nordlys")).toBe("produsent");
    });

    it("gir null når produksjonen ikke har en oppretter", async () => {
      expect(await resolveBillingUser(pool, "foreldrelos")).toBeNull();
    });

    it("gir null for en produksjon som ikke finnes", async () => {
      expect(await resolveBillingUser(pool, "finnes-ikke")).toBeNull();
    });

    it("lar en flyttet faktura vinne over oppretteren", async () => {
      // Produksjonsselskapet overtar fakturaen fra enkeltpersonen som
      // opprettet prosjektet. Faller vi tilbake til created_by etter det,
      // ville flyttingen blitt stille reversert ved neste opplasting.
      await recordProductionUsage(pool, {
        projectId: "nordlys",
        actorUserId: "dit",
        deltaBytes: 10 * MB,
        backend: "b2",
        reason: "capture_upload",
      });
      await reassignBillingUser(pool, "nordlys", "produksjonsselskapet");
      expect(await resolveBillingUser(pool, "nordlys")).toBe("produksjonsselskapet");

      await recordProductionUsage(pool, {
        projectId: "nordlys",
        actorUserId: "dit",
        deltaBytes: 10 * MB,
        backend: "b2",
        reason: "capture_upload",
      });
      expect(await resolveBillingUser(pool, "nordlys")).toBe("produksjonsselskapet");
    });
  });

  describe("bokføring", () => {
    it("samler hele crewets opplastinger på produksjonen", async () => {
      // Kjernen i modellen: dailies tilhører produksjonen, ikke han som
      // tilfeldigvis trykket opplast.
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 500 * MB, backend: "b2", reason: "capture_upload",
      });
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "fotograf",
        deltaBytes: 300 * MB, backend: "b2", reason: "capture_upload",
      });

      const row = await getProductionStorage(pool, "nordlys");
      expect(row?.usedBytes).toBe(800 * MB);
      expect(row?.fileCount).toBe(2);
      expect(row?.billingUserId).toBe("produsent");
    });

    it("holder backend-fordelingen i sum med totalen", async () => {
      // Kostnaden er ulik per backend, så fordelingen må stemme — ellers
      // kan marginen ikke regnes.
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 100 * MB, backend: "b2", reason: "capture_upload",
      });
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 50 * MB, backend: "cloudflare_stream", reason: "selftape",
      });
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 25 * MB, backend: "r2", reason: "legacy",
      });

      const row = (await getProductionStorage(pool, "nordlys"))!;
      expect(row.b2Bytes + row.r2Bytes + row.streamBytes + row.filesystemBytes)
        .toBe(row.usedBytes);
    });

    it("trekker fra riktig kolonne ved sletting", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 500 * MB, backend: "b2", reason: "capture_upload",
      });
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: null,
        deltaBytes: -500 * MB, backend: "b2", reason: "retention_delete",
      });

      const row = (await getProductionStorage(pool, "nordlys"))!;
      expect(row.usedBytes).toBe(0);
      expect(row.b2Bytes).toBe(0);
      expect(row.fileCount).toBe(0);
    });

    it("går aldri under null selv om slettingen overstiger totalen", async () => {
      // Et negativt lagringstall ville blitt en negativ faktura.
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 10 * MB, backend: "b2", reason: "capture_upload",
      });
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: null,
        deltaBytes: -999 * MB, backend: "b2", reason: "reconcile",
      });

      const row = (await getProductionStorage(pool, "nordlys"))!;
      expect(row.usedBytes).toBe(0);
      expect(row.fileCount).toBe(0);
    });

    it("lar ikke en opplasting endre hvem som betaler", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 10 * MB, backend: "b2", reason: "capture_upload",
      });
      await pool.query(
        `SELECT apply_production_storage_delta(
           'nordlys', 'angriper', 'dit', 1000, 'b2', 'capture_upload')`,
      );
      const row = (await getProductionStorage(pool, "nordlys"))!;
      expect(row.billingUserId).toBe("produsent");
    });

    it("husker hvem i crewet som utløste hver endring", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "fotograf",
        deltaBytes: 10 * MB, backend: "b2", reason: "capture_upload",
      });
      const events = await pool.query(
        `SELECT actor_user_id, reason FROM role_room_production_storage_events
          WHERE project_id = 'nordlys'`,
      );
      expect(events.rows[0].actor_user_id).toBe("fotograf");
      expect(events.rows[0].reason).toBe("capture_upload");
    });

    it("gir null når produksjonen ikke har en fakturerbar konto", async () => {
      expect(
        await recordProductionUsage(pool, {
          projectId: "foreldrelos", actorUserId: "dit",
          deltaBytes: 10 * MB, backend: "b2", reason: "capture_upload",
        }),
      ).toBeNull();
    });

    it("rydder ledgeren når produksjonen slettes", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 10 * MB, backend: "b2", reason: "capture_upload",
      });
      await pool.query(`DELETE FROM casting_projects WHERE id = 'nordlys'`);
      expect(await getProductionStorage(pool, "nordlys")).toBeNull();
    });
  });

  describe("kontoens pott", () => {
    it("summerer over alle produksjonene kontoen betaler for", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 600 * MB, backend: "b2", reason: "capture_upload",
      });
      await recordProductionUsage(pool, {
        projectId: "vinterspor", actorUserId: "dit",
        deltaBytes: 400 * MB, backend: "b2", reason: "capture_upload",
      });
      expect(await accountProductionBytes(pool, "produsent")).toBe(1000 * MB);
    });

    it("teller ikke produksjoner en annen konto betaler for", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 600 * MB, backend: "b2", reason: "capture_upload",
      });
      await recordProductionUsage(pool, {
        projectId: "vinterspor", actorUserId: "dit",
        deltaBytes: 400 * MB, backend: "b2", reason: "capture_upload",
      });
      await reassignBillingUser(pool, "vinterspor", "annen-konto");

      expect(await accountProductionBytes(pool, "produsent")).toBe(600 * MB);
      expect(await accountProductionBytes(pool, "annen-konto")).toBe(400 * MB);
    });

    it("lister produksjonene med størst forbruk først", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 100 * MB, backend: "b2", reason: "capture_upload",
      });
      await recordProductionUsage(pool, {
        projectId: "vinterspor", actorUserId: "dit",
        deltaBytes: 900 * MB, backend: "b2", reason: "capture_upload",
      });
      const list = await listProductionsForAccount(pool, "produsent");
      expect(list.map((p) => p.projectId)).toEqual(["vinterspor", "nordlys"]);
      expect(list[0].projectName).toBe("Vinterspor");
    });
  });

  describe("kvote", () => {
    const setPlanUsage = (userId: string, bytes: number) =>
      pool.query(
        `INSERT INTO user_storage_consumption (user_id, total_bytes)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET total_bytes = EXCLUDED.total_bytes`,
        [userId, bytes],
      );

    it("stopper på produksjonens eget tak", async () => {
      // Taket finnes for å hindre at én produksjon med 40 TB dailies
      // spiser hele kontoens pott fra de andre.
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 900 * MB, backend: "b2", reason: "capture_upload",
      });
      await setProductionCap(pool, "nordlys", 1000 * MB);

      const decision = await canProductionStore(pool, "nordlys", 200 * MB);
      expect(decision.ok).toBe(false);
      expect(decision.reason).toBe("production_cap_reached");
    });

    it("slipper gjennom det som får plass under taket", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 500 * MB, backend: "b2", reason: "capture_upload",
      });
      await setProductionCap(pool, "nordlys", 1000 * MB);
      expect((await canProductionStore(pool, "nordlys", 200 * MB)).ok).toBe(true);
    });

    it("slipper gjennom når produksjonen ikke har eget tak", async () => {
      await setPlanUsage("produsent", 0);
      const decision = await canProductionStore(pool, "nordlys", 50 * GIB);
      expect(decision.productionCapBytes).toBeNull();
    });

    it("slipper gjennom uten fakturerbar konto framfor å stoppe en innspilling", async () => {
      // Bokføringen skjer uansett, så bytene er ikke tapt — men en
      // manglende kobling skal ikke stanse en opptaksdag.
      const decision = await canProductionStore(pool, "foreldrelos", 10 * GIB);
      expect(decision.ok).toBe(true);
      expect(decision.account).toBeNull();
    });

    it("rapporterer produksjonens forbruk selv når svaret er ja", async () => {
      await recordProductionUsage(pool, {
        projectId: "nordlys", actorUserId: "dit",
        deltaBytes: 250 * MB, backend: "b2", reason: "capture_upload",
      });
      await setPlanUsage("produsent", 0);
      const decision = await canProductionStore(pool, "nordlys", MB);
      expect(decision.productionUsedBytes).toBe(250 * MB);
      expect(decision.billingUserId).toBe("produsent");
    });
  });

  describe("dobbeltbokføring mot kontoen", () => {
    it("skriver både til produksjonen og til kontoen som betaler", async () => {
      // De svarer på hvert sitt spørsmål og teller ikke det samme to
      // ganger: produksjonen vet hva som ligger der, kontoen vet hvor mye
      // av potten som er brukt.
      const seen: Array<{ userId: string; bytes: number }> = [];
      const result = await recordStorageForProduction(
        pool,
        {
          projectId: "nordlys", actorUserId: "dit",
          deltaBytes: 300 * MB, backend: "b2", reason: "capture_upload",
        },
        async (billingUserId, bytes) => {
          seen.push({ userId: billingUserId, bytes });
        },
      );

      expect(result.billingUserId).toBe("produsent");
      expect(result.productionUsedBytes).toBe(300 * MB);
      // Kontoen som belastes er den som BETALER, ikke den som lastet opp.
      expect(seen).toEqual([{ userId: "produsent", bytes: 300 * MB }]);
    });

    it("rører ingen av ledgerne uten en fakturerbar konto", async () => {
      let called = false;
      const result = await recordStorageForProduction(
        pool,
        {
          projectId: "foreldrelos", actorUserId: "dit",
          deltaBytes: 300 * MB, backend: "b2", reason: "capture_upload",
        },
        async () => {
          called = true;
        },
      );
      expect(result.billingUserId).toBeNull();
      expect(called).toBe(false);
      expect(await getProductionStorage(pool, "foreldrelos")).toBeNull();
    });
  });
});

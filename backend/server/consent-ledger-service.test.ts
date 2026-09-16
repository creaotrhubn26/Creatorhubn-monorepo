/**
 * Samtykke-logg med hash-kjede.
 *
 * Testene er skrevet rundt det som faktisk skal holde i en tvist: at en
 * endret rad oppdages, at hashen dekker alle feltene som betyr noe, og at
 * kjeden ikke kan grene.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import type { Pool } from "pg";
import { describe, expect, it } from "vitest";

import {
  GENESIS_HASH,
  canonicalRow,
  computeRowHash,
  recordConsent,
  verifyChain,
  type ConsentRowCore,
} from "./consent-ledger-service.js";

const baseRow: ConsentRowCore = {
  seq: 1,
  user_id: "user-1",
  subject_type: "agency_share",
  subject_ref: "byra-1",
  document_hash: "a".repeat(64),
  action: "granted",
  auth_method: "bankid",
  auth_event_id: "event-1",
  created_at: "2026-09-16T10:00:00.000Z",
};

describe("hashing", () => {
  it("endrer hashen når et hvilket som helst felt endres", () => {
    const original = computeRowHash(GENESIS_HASH, baseRow);

    const fields: Array<Partial<ConsentRowCore>> = [
      { user_id: "user-2" },
      { subject_type: "guardian" },
      { subject_ref: "byra-2" },
      { document_hash: "b".repeat(64) },
      { action: "withdrawn" },
      { auth_method: "session" },
      { auth_event_id: "event-2" },
      { created_at: "2026-09-16T10:00:01.000Z" },
      { seq: 2 },
    ];

    for (const patch of fields) {
      const changed = computeRowHash(GENESIS_HASH, { ...baseRow, ...patch });
      expect(changed, `felt uten effekt på hashen: ${Object.keys(patch)[0]}`).not.toBe(original);
    }
  });

  it("endrer hashen når forgjengeren endres", () => {
    expect(computeRowHash(GENESIS_HASH, baseRow)).not.toBe(computeRowHash("f".repeat(64), baseRow));
  });

  it("skiller felter med en separator som ikke kan stå i verdiene", () => {
    // Uten separator ville («ab», «c») og («a», «bc») hashet likt.
    const a = canonicalRow({ ...baseRow, subject_type: "ab", subject_ref: "c" });
    const b = canonicalRow({ ...baseRow, subject_type: "a", subject_ref: "bc" });
    expect(a).not.toBe(b);
  });
});

/**
 * Tidspunktet er den delen av raden som ikke kommer fra oss ved lesing: pg
 * gir en Date tilbake, og Postgres lagrer mikrosekunder. Begge deler kan
 * gjøre at en urørt kjede meldes brutt. Disse to testene dekker hver sin.
 */
describe("tidspunkt", () => {
  it("hasher likt om created_at kommer tilbake som Date eller streng", () => {
    const somString = computeRowHash(GENESIS_HASH, baseRow);
    const somDate = computeRowHash(GENESIS_HASH, {
      ...baseRow,
      created_at: new Date(baseRow.created_at) as unknown as string,
    });
    expect(somDate).toBe(somString);
  });

  it("holder kolonnen på millisekundpresisjon i migrasjonen", () => {
    const sql = readFileSync(
      path.join(__dirname, "..", "migrations", "0615_consent_ledger.sql"),
      "utf8",
    );
    // Uten (3) lagrer Postgres mikrosekunder. En rad skrevet med DEFAULT
    // now() ville da hatt et tidspunkt ISO-strengen ikke kan gjenskape, og
    // verifyChain ville meldt hash_mismatch på en kjede ingen hadde rørt.
    expect(sql).toMatch(/created_at TIMESTAMPTZ\(3\) NOT NULL/);
  });
});

/** Minimal database som holder radene i minnet, med samme kjede-semantikk. */
function fakeLedgerPool(rows: Array<Record<string, unknown>>): Pool {
  const run = async (sql: string, params: unknown[] = []) => {
    if (sql.includes("SELECT row_hash FROM consent_ledger")) {
      const last = rows[rows.length - 1];
      return { rows: last ? [{ row_hash: last.row_hash }] : [], rowCount: last ? 1 : 0 };
    }
    if (sql.includes("nextval")) {
      return { rows: [{ seq: String(rows.length + 1) }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO consent_ledger")) {
      rows.push({
        seq: params[0],
        user_id: params[1],
        subject_type: params[2],
        subject_ref: params[3],
        document_hash: params[5],
        action: params[6],
        auth_method: params[7],
        auth_event_id: params[8],
        created_at: params[9],
        prev_hash: params[10],
        row_hash: params[11],
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("FROM consent_ledger")) {
      return { rows: [...rows], rowCount: rows.length };
    }
    return { rows: [], rowCount: 0 };
  };

  return {
    connect: async () => ({ query: run, release: () => undefined }),
    query: run,
  } as unknown as Pool;
}

describe("kjeden", () => {
  it("lenker hver rad til den forrige", async () => {
    const rows: Array<Record<string, unknown>> = [];
    const pool = fakeLedgerPool(rows);

    const first = await recordConsent(pool, {
      userId: "user-1",
      subjectType: "terms",
      documentHash: "a".repeat(64),
      action: "granted",
      authMethod: "bankid",
      authEventId: "event-1",
    });
    const second = await recordConsent(pool, {
      userId: "user-1",
      subjectType: "agency_share",
      subjectRef: "byra-1",
      documentHash: "b".repeat(64),
      action: "granted",
      authMethod: "bankid",
    });

    expect(rows[0].prev_hash).toBe(GENESIS_HASH);
    expect(rows[1].prev_hash).toBe(first.rowHash);
    expect(second.seq).toBe(2);

    const verification = await verifyChain(pool);
    expect(verification).toMatchObject({ ok: true, checked: 2, brokenAtSeq: null });
  });

  it("oppdager at en gammel rad er endret i ettertid", async () => {
    const rows: Array<Record<string, unknown>> = [];
    const pool = fakeLedgerPool(rows);

    for (const subject of ["terms", "agency_share", "guardian"]) {
      await recordConsent(pool, {
        userId: "user-1",
        subjectType: subject,
        documentHash: "c".repeat(64),
        action: "granted",
        authMethod: "bankid",
      });
    }

    // Noen redigerer rad 2 direkte i databasen: samtykket «gjelder nå et
    // annet dokument».
    rows[1].document_hash = "d".repeat(64);

    const verification = await verifyChain(pool);
    expect(verification.ok).toBe(false);
    expect(verification.brokenAtSeq).toBe(2);
    expect(verification.reason).toBe("hash_mismatch");
  });

  it("oppdager at en rad er fjernet", async () => {
    const rows: Array<Record<string, unknown>> = [];
    const pool = fakeLedgerPool(rows);

    for (const subject of ["terms", "agency_share", "guardian"]) {
      await recordConsent(pool, {
        userId: "user-1",
        subjectType: subject,
        documentHash: "c".repeat(64),
        action: "granted",
        authMethod: "bankid",
      });
    }

    rows.splice(1, 1);

    const verification = await verifyChain(pool);
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe("prev_mismatch");
  });

  it("låser tabellen slik at to samtidige samtykker ikke grener kjeden", async () => {
    const statements: string[] = [];
    const pool = {
      connect: async () => ({
        query: async (sql: string) => {
          statements.push(sql);
          if (sql.includes("SELECT row_hash")) return { rows: [], rowCount: 0 };
          if (sql.includes("nextval")) return { rows: [{ seq: "1" }], rowCount: 1 };
          return { rows: [], rowCount: 0 };
        },
        release: () => undefined,
      }),
    } as unknown as Pool;

    await recordConsent(pool, {
      userId: "user-1",
      subjectType: "terms",
      documentHash: "a".repeat(64),
      action: "granted",
      authMethod: "session",
    });

    expect(statements.some((s) => s.includes("LOCK TABLE consent_ledger IN EXCLUSIVE MODE"))).toBe(true);
    expect(statements[0]).toBe("BEGIN");
    expect(statements.at(-1)).toBe("COMMIT");
  });
});

/**
 * Norsk eID — identitetsverifisering.
 *
 * Testene speiler de fem reglene fra bankid-oidc-norsk-eid-ferdigheten, som
 * er destillert fra produksjonsfeil. Den viktigste er at fødselsnummeret
 * aldri lagres: hashen er kontonøkkelen, og den er pepret.
 */

import type { Pool } from "pg";
import { beforeEach, describe, expect, it } from "vitest";

import {
  birthYearFromSsn,
  consumeAuthState,
  createAuthState,
  hashSsn,
  readEidConfig,
  writeIdentity,
} from "./role-room-eid-service.js";

const PEPPER = "x".repeat(40);

interface Recorded {
  sql: string;
  params: unknown[];
}

function fakePool(
  handler: (sql: string, params: unknown[]) => { rows: unknown[]; rowCount: number },
  recorded: Recorded[],
): Pool {
  return {
    query: async (sql: string, params?: unknown[]) => {
      recorded.push({ sql, params: params ?? [] });
      return handler(sql, params ?? []);
    },
  } as unknown as Pool;
}

describe("hashing av fødselsnummer", () => {
  it("gir samme hash for samme nummer, uansett formatering", () => {
    expect(hashSsn("01019012345", PEPPER)).toBe(hashSsn("010190 12345", PEPPER));
    expect(hashSsn("01019012345", PEPPER)).toBe(hashSsn("010190-12345", PEPPER));
  });

  it("gir ulik hash med ulik pepper", () => {
    expect(hashSsn("01019012345", PEPPER)).not.toBe(hashSsn("01019012345", "y".repeat(40)));
  });

  it("inneholder ikke fødselsnummeret", () => {
    const hash = hashSsn("01019012345", PEPPER);
    expect(hash).not.toContain("01019012345");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("fødselsår fra fødselsnummer", () => {
  it("leser 1900-tallet fra lave individsifre", () => {
    expect(birthYearFromSsn("01019012345")).toBe(1990);
  });

  it("leser 2000-tallet fra høye individsifre og lavt årstall", () => {
    expect(birthYearFromSsn("01011099912")).toBe(2010);
  });

  it("returnerer null for ugyldig lengde", () => {
    expect(birthYearFromSsn("123")).toBeNull();
  });
});

describe("konfigurasjon", () => {
  beforeEach(() => {
    delete process.env.EID_ISSUER;
    delete process.env.EID_CLIENT_ID;
    delete process.env.EID_CLIENT_SECRET;
    delete process.env.EID_REDIRECT_URI;
    delete process.env.EID_SSN_PEPPER;
  });

  it("er null når ingenting er satt — ikke en feil", () => {
    expect(readEidConfig()).toBeNull();
  });

  it("avviser en for kort pepper", () => {
    process.env.EID_ISSUER = "https://test.idura.id";
    process.env.EID_CLIENT_ID = "klient";
    process.env.EID_CLIENT_SECRET = "hemmelig";
    process.env.EID_REDIRECT_URI = "https://theroleroom.com/api/role-room/eid/callback";
    process.env.EID_SSN_PEPPER = "kort";

    expect(readEidConfig()).toBeNull();
  });

  it("godtar full konfigurasjon", () => {
    process.env.EID_ISSUER = "https://test.idura.id";
    process.env.EID_CLIENT_ID = "klient";
    process.env.EID_CLIENT_SECRET = "hemmelig";
    process.env.EID_REDIRECT_URI = "https://theroleroom.com/api/role-room/eid/callback";
    process.env.EID_SSN_PEPPER = PEPPER;

    expect(readEidConfig()).toMatchObject({ clientId: "klient" });
  });
});

describe("state", () => {
  it("lagrer PKCE-verifier serverside og logger at forsøket startet", async () => {
    const recorded: Recorded[] = [];
    const pool = fakePool(() => ({ rows: [], rowCount: 0 }), recorded);

    const started = await createAuthState(pool, {
      userId: "user-1",
      provider: "bankid",
      intent: "verify",
    });

    expect(started.codeVerifier.length).toBeGreaterThan(40);
    const insert = recorded.find((r) => r.sql.includes("INSERT INTO eid_auth_states"));
    expect(insert?.params).toContain(started.codeVerifier);
    expect(recorded.some((r) => r.sql.includes("INSERT INTO eid_auth_events"))).toBe(true);
  });

  it("er engangsbruk — spørringen krever ubrukt og ikke utløpt", async () => {
    const recorded: Recorded[] = [];
    const pool = fakePool(() => ({ rows: [], rowCount: 0 }), recorded);

    await consumeAuthState(pool, "abc");

    const update = recorded[0];
    expect(update.sql).toContain("used_at IS NULL");
    expect(update.sql).toContain("expires_at > now()");
  });
});

describe("skriving av identitet", () => {
  it("avviser når fødselsnummeret alt tilhører en EKSISTERENDE konto", async () => {
    const recorded: Recorded[] = [];
    const pool = fakePool((sql) => {
      if (sql.includes("JOIN users u")) return { rows: [{ user_id: "annen" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }, recorded);

    const result = await writeIdentity(pool, {
      userId: "user-1",
      provider: "bankid",
      ssnHash: "hash",
      ssnHashKind: "ssn",
      providerSub: "sub",
      verifiedName: "Kari",
      birthYear: 1990,
    });

    expect(result).toEqual({ ok: false, reason: "ssn_taken" });
    // Duplikatsjekken går mot users, ikke bare identitetstabellen:
    // identitetsrader kan overleve en slettet bruker.
    expect(recorded[0].sql).toContain("JOIN users u");
  });

  it("nekter å overskrive en fnr-hash med en fødselsdato-hash", async () => {
    const recorded: Recorded[] = [];
    const pool = fakePool((sql) => {
      if (sql.includes("JOIN users u")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT ssn_hash_kind")) return { rows: [{ ssn_hash_kind: "ssn" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }, recorded);

    const result = await writeIdentity(pool, {
      userId: "user-1",
      provider: "bankid",
      ssnHash: "svakere",
      ssnHashKind: "birthdate",
      providerSub: null,
      verifiedName: null,
      birthYear: null,
    });

    expect(result).toEqual({ ok: false, reason: "weaker_hash" });
    expect(recorded.some((r) => r.sql.includes("INSERT INTO eid_identities"))).toBe(false);
  });

  it("skriver med user_id i payloaden og treffer riktig unik indeks", async () => {
    const recorded: Recorded[] = [];
    const pool = fakePool(() => ({ rows: [], rowCount: 0 }), recorded);

    const result = await writeIdentity(pool, {
      userId: "user-1",
      provider: "bankid",
      ssnHash: "hash",
      ssnHashKind: "ssn",
      providerSub: "sub-1",
      verifiedName: "Kari Nordmann",
      birthYear: 1990,
    });

    expect(result).toEqual({ ok: true });
    const insert = recorded.find((r) => r.sql.includes("INSERT INTO eid_identities"));
    // Fallgruve 1: user_id manglet i payloaden og INSERT feilet på NOT NULL.
    expect(insert?.params[0]).toBe("user-1");
    // Fallgruve 2: ON CONFLICT må matche den unike indeksen (user_id, provider).
    expect(insert?.sql).toContain("ON CONFLICT (user_id, provider)");
  });

  it("lagrer aldri fødselsnummeret — kun hashen", async () => {
    const recorded: Recorded[] = [];
    const pool = fakePool(() => ({ rows: [], rowCount: 0 }), recorded);
    const ssn = "01019012345";

    await writeIdentity(pool, {
      userId: "user-1",
      provider: "bankid",
      ssnHash: hashSsn(ssn, PEPPER),
      ssnHashKind: "ssn",
      providerSub: "sub-1",
      verifiedName: "Kari",
      birthYear: birthYearFromSsn(ssn),
    });

    expect(JSON.stringify(recorded)).not.toContain(ssn);
  });
});

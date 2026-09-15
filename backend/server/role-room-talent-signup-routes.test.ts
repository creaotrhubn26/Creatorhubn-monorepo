import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupRoleRoomTalentSignupRoutes } from "./role-room-talent-signup-routes.js";

const sendVerificationCode = vi.fn();
const verifyCode = vi.fn();
const persistAuthSession = vi.fn(async () => undefined);

vi.mock("./email-verification-service.js", () => ({
  sendVerificationCode: (...args: unknown[]) => sendVerificationCode(...args),
  verifyCode: (...args: unknown[]) => verifyCode(...args),
}));

vi.mock("./auth-session-store.js", () => ({
  persistAuthSession: (...args: unknown[]) => persistAuthSession(...args),
}));

const USER_ID = "8f1b0c62-8f3e-4b44-9a3d-2a1f6b5c4d33";

interface PoolState {
  emailTaken: boolean;
  queries: string[];
}

function fakePool(state: PoolState): Pool {
  return {
    query: async (sql: string) => {
      state.queries.push(sql);
      if (sql.includes("SELECT 1 FROM users")) {
        return { rows: state.emailTaken ? [{ "?column?": 1 }] : [], rowCount: state.emailTaken ? 1 : 0 };
      }
      if (sql.includes("INSERT INTO users")) {
        return {
          rows: [{ id: USER_ID, email: "ny@skuespiller.test", first_name: "Ny", last_name: "Skuespiller", role: "talent" }],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO talents")) {
        return { rows: [{ id: "talent-1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
}

function buildApp(state: PoolState) {
  const app = express();
  app.use(express.json());
  const activeSessions = new Map<string, any>();

  setupRoleRoomTalentSignupRoutes({
    app,
    pool: fakePool(state),
    activeSessions,
    // Turnstile er ikke konfigurert i test: tom secret ⇒ hoppes over.
    normalizeMailConfigValue: (value: unknown) => (typeof value === "string" ? value.trim() : ""),
    getDefaultRoleRoomPublicOrigin: () => "https://theroleroom.com",
  });

  return { app, activeSessions };
}

describe("talent-selvregistrering", () => {
  let state: PoolState;

  beforeEach(() => {
    state = { emailTaken: false, queries: [] };
    sendVerificationCode.mockReset();
    verifyCode.mockReset();
    persistAuthSession.mockReset();
    sendVerificationCode.mockResolvedValue({ ok: true, expiresAt: new Date().toISOString() });
    verifyCode.mockResolvedValue({ ok: true });
  });

  it("avviser ugyldig e-post ved kodeforespørsel", async () => {
    const { app } = buildApp(state);
    const res = await request(app)
      .post("/api/role-room/talents/signup/request-code")
      .send({ email: "ikke-en-epost" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_email");
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });

  it("svarer likt for kjent og ukjent e-post, men sender ikke kode til en eksisterende konto", async () => {
    const unknown = buildApp(state);
    const unknownRes = await request(unknown.app)
      .post("/api/role-room/talents/signup/request-code")
      .send({ email: "ny@skuespiller.test" });

    const takenState: PoolState = { emailTaken: true, queries: [] };
    const known = buildApp(takenState);
    const knownRes = await request(known.app)
      .post("/api/role-room/talents/signup/request-code")
      .send({ email: "finnes@skuespiller.test" });

    expect(unknownRes.status).toBe(200);
    expect(knownRes.status).toBe(200);
    expect(Object.keys(knownRes.body)).toEqual(Object.keys(unknownRes.body));
    expect(sendVerificationCode).toHaveBeenCalledTimes(1);
  });

  it("avviser signup uten gyldig kode", async () => {
    verifyCode.mockResolvedValue({ ok: false });
    const { app } = buildApp(state);
    const res = await request(app).post("/api/role-room/talents/signup").send({
      email: "ny@skuespiller.test",
      code: "000000",
      password: "sterktnok123",
      displayName: "Ny Skuespiller",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_code");
    expect(state.queries.some((q) => q.includes("INSERT INTO users"))).toBe(false);
  });

  it("avviser for kort passord", async () => {
    const { app } = buildApp(state);
    const res = await request(app).post("/api/role-room/talents/signup").send({
      email: "ny@skuespiller.test",
      code: "123456",
      password: "kort",
      displayName: "Ny Skuespiller",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("weak_password");
  });

  it("overtar ALDRI en eksisterende konto — 409 og ingen skriving", async () => {
    state.emailTaken = true;
    const { app } = buildApp(state);
    const res = await request(app).post("/api/role-room/talents/signup").send({
      email: "finnes@skuespiller.test",
      code: "123456",
      password: "sterktnok123",
      displayName: "Noen Andre",
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("account_exists");
    expect(state.queries.some((q) => q.includes("INSERT INTO users"))).toBe(false);
    expect(state.queries.some((q) => q.includes("UPDATE users"))).toBe(false);
  });

  it("oppretter talent-konto med draft-profil og mintet sesjon", async () => {
    const { app, activeSessions } = buildApp(state);
    const res = await request(app).post("/api/role-room/talents/signup").send({
      email: "ny@skuespiller.test",
      code: "123456",
      password: "sterktnok123",
      displayName: "Ny Skuespiller",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("talent");
    expect(res.body.sessionToken).toBeTruthy();
    expect(res.body.talentId).toBe("talent-1");

    const userInsert = state.queries.find((q) => q.includes("INSERT INTO users"));
    expect(userInsert).toContain("'talent'");
    expect(userInsert).toContain("ON CONFLICT (email) DO NOTHING");

    const talentInsert = state.queries.find((q) => q.includes("INSERT INTO talents"));
    expect(talentInsert).toContain("'draft'");

    const session = activeSessions.get(res.body.sessionToken);
    expect(session?.role).toBe("talent");
    expect(session?.isAdmin).toBe(false);
    expect(persistAuthSession).toHaveBeenCalledTimes(1);
  });
});

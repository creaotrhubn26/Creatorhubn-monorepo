/**
 * «Bruk dette opptaket som showreel.»
 *
 * Ingen av de tolv profilene i registeret har showreel, og casting gjøres på
 * bevegelse og stemme. Et opptak som alt ligger i self-tape-studioet er
 * korteste vei dit — men bare hvis det faktisk kan spilles av.
 *
 * Testene holder på tre ting: at et gjettet take-id fra et annet talent ikke
 * treffer, at et opptak uten spillbar kilde ikke kan bli showreel, og at
 * kilden som velges er den som faktisk finnes på raden.
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { setupTalentSelftapesRoutes } from "./talent-selftapes-routes";

vi.mock("./talent-selftape-notifications.js", () => ({ notifySelftapeActivity: async () => {} }));
vi.mock("./ai-rate-limiter.js", () => ({ aiRateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

const TAKE = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const TALENT = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

interface Tilstand {
  spørringer: { sql: string; params: unknown[] }[];
  /** Raden ruten finner for take-en, eller null når den ikke er ditt take. */
  take: Record<string, unknown> | null;
}

function byggApp(t: Tilstand, innlogget = true) {
  const app = express();
  app.use(express.json());

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      t.spørringer.push({ sql, params: params ?? [] });
      if (sql.includes("FROM talents WHERE owner_user_id")) {
        return { rows: [{ id: TALENT }], rowCount: 1 };
      }
      if (sql.includes("FROM talent_selftape_takes t")) {
        return { rows: t.take ? [t.take] : [], rowCount: t.take ? 1 : 0 };
      }
      if (sql.includes("UPDATE talents")) {
        return {
          rows: [{ showreel_url: params?.[0], showreel_updated_at: "2026-09-21T10:00:00Z" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  setupTalentSelftapesRoutes({
    app,
    pool,
    getActiveSession: () => (innlogget ? { userId: "bruker-1" } : null),
  } as never);
  return app;
}

const tilstand = (over: Partial<Tilstand> = {}): Tilstand => ({
  spørringer: [],
  take: { id: TAKE, video_url: "https://eksempel.test/take.mp4", stream_uid: null, external_url: null, status: "ready" },
  ...over,
});

const kall = (t: Tilstand, innlogget = true) =>
  request(byggApp(t, innlogget)).post(`/api/role-room/talents/selftapes/takes/${TAKE}/bruk-som-showreel`);

beforeEach(() => vi.clearAllMocks());

describe("bruk take som showreel", () => {
  it("krever innlogging", async () => {
    expect((await kall(tilstand(), false)).status).toBe(401);
  });

  it("setter showreel til opptakets video", async () => {
    const t = tilstand();
    const res = await kall(t);
    expect(res.status).toBe(200);
    expect(res.body.showreel.showreel_url).toBe("https://eksempel.test/take.mp4");
  });

  it("slår opp take-en med talent_id i WHERE — det ER eierskapssjekken", async () => {
    const t = tilstand();
    await kall(t);
    const oppslag = t.spørringer.find((q) => q.sql.includes("FROM talent_selftape_takes t"));
    expect(oppslag?.sql).toContain("p.talent_id = $2::uuid");
  });

  it("svarer 404 for et take som ikke er ditt", async () => {
    // Et gjettet id fra et annet talent skal ikke kunne bekreftes.
    const t = tilstand({ take: null });
    const res = await kall(t);
    expect(res.status).toBe(404);
    expect(t.spørringer.some((q) => q.sql.includes("UPDATE talents"))).toBe(false);
  });

  it("avviser et opptak uten spillbar video, i stedet for å sette en død lenke", async () => {
    const t = tilstand({ take: { id: TAKE, video_url: null, stream_uid: null, external_url: null, status: "processing" } });
    const res = await kall(t);
    // En showreel-lenke som ikke virker er verre enn ingen: ingen oppdager den.
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ingen spillbar video/i);
    expect(t.spørringer.some((q) => q.sql.includes("UPDATE talents"))).toBe(false);
  });

  it("bygger stream-adressen når opptaket bare har stream_uid", async () => {
    const t = tilstand({ take: { id: TAKE, video_url: null, stream_uid: "uid123", external_url: null, status: "ready" } });
    const res = await kall(t);
    expect(res.body.showreel.showreel_url).toContain("uid123");
  });

  it("bruker ekstern adresse når opptaket kom utenfra", async () => {
    const t = tilstand({ take: { id: TAKE, video_url: null, stream_uid: null, external_url: "https://vimeo.test/1", status: "ready" } });
    const res = await kall(t);
    expect(res.body.showreel.showreel_url).toBe("https://vimeo.test/1");
  });
});

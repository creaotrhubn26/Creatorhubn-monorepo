/**
 * Besøksloggen på serveren (GDPR): parsing, retention-port og rutene under
 * /api/guide/device/* mot en mocket pool (samme mønster som
 * reiseguide-routes.test.ts).
 */
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import {
  DEVICE_HEADER,
  VISIT_PURGE,
  VISIT_SYNC_MAX,
  VISIT_UPSERT,
  createIntervalGate,
  parseVisitSync,
  readDeviceId,
  registerReiseguideVisitRoutes,
  retentionDaysFrom,
  visitView,
  type VisitRow,
} from "./reiseguide-visits.js";

type Handler = { match: RegExp; rows: unknown[] | ((params: unknown[]) => unknown[]) };

function makePool(handlers: Handler[]) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) {
      if (h.match.test(sql)) {
        const rows = typeof h.rows === "function" ? h.rows(params) : h.rows;
        return { rows, rowCount: rows.length };
      }
    }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pick<Pool, "query"> & { query: typeof query };
}

function makeApp(pool: Pick<Pool, "query">, now?: () => number) {
  const app = express();
  registerReiseguideVisitRoutes(app, { pool, retentionDays: 90, now });
  return app;
}

const DEVICE = "0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b";
const NOW = Date.parse("2026-09-18T12:00:00Z");

const visitRow: VisitRow = {
  id: "visit-0001-aaaa",
  device_id: DEVICE,
  poi_id: "poi_akershus",
  poi_slug: "akershus-festning",
  started_at: new Date("2026-09-18T10:00:00Z"),
  completed_at: "2026-09-18T10:20:00.000Z",
  stars: 4,
  quiz_correct: 2,
  quiz_total: 3,
  updated_at: new Date("2026-09-18T10:21:00Z"),
};

describe("besøkslogg: ren logikk", () => {
  it("readDeviceId godtar bare header-verdier på enhets-ID-formen", () => {
    expect(readDeviceId(` ${DEVICE} `)).toBe(DEVICE);
    expect(readDeviceId([DEVICE, "annen"])).toBe(DEVICE);
    expect(readDeviceId("kort")).toBeNull();
    expect(readDeviceId("har mellomrom og er lang nok")).toBeNull();
    expect(readDeviceId(undefined)).toBeNull();
  });

  it("parseVisitSync validerer felt, tider og par av quiz-verdier", () => {
    const ok = parseVisitSync(
      {
        visits: [
          {
            id: "visit-0001-aaaa",
            poiId: "poi_akershus",
            startedAt: "2026-09-18T10:00:00Z",
            completedAt: "2026-09-18T10:20:00Z",
            stars: "5",
            quizCorrect: 2,
            quizTotal: 3,
          },
          { id: "visit-0002-bbbb", poiId: "poi_opera", startedAt: "2026-09-18T11:00:00Z" },
        ],
      },
      NOW,
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.value[0]).toMatchObject({ stars: 5, quizCorrect: 2, quizTotal: 3 });
    expect(ok.value[0].completedAt?.toISOString()).toBe("2026-09-18T10:20:00.000Z");
    expect(ok.value[1]).toMatchObject({ completedAt: null, stars: null, quizCorrect: null, quizTotal: null });

    const bad = (body: unknown) => {
      const r = parseVisitSync(body, NOW);
      return r.ok ? "ok" : r.error;
    };
    const base = { id: "visit-0001-aaaa", poiId: "poi_akershus", startedAt: "2026-09-18T10:00:00Z" };
    expect(bad(null)).toBe("invalid_body");
    expect(bad({ visits: "nei" })).toBe("invalid_body");
    expect(bad({ visits: [{ ...base, id: "x" }] })).toBe("invalid_visit");
    expect(bad({ visits: [base, base] })).toBe("invalid_visit");
    expect(bad({ visits: [{ ...base, poiId: "" }] })).toBe("invalid_visit");
    expect(bad({ visits: [{ ...base, startedAt: "i går" }] })).toBe("invalid_visit");
    expect(bad({ visits: [{ ...base, startedAt: "2026-09-21T10:00:00Z" }] })).toBe("invalid_visit");
    expect(bad({ visits: [{ ...base, completedAt: "2026-09-18T09:00:00Z" }] })).toBe("invalid_visit");
    expect(bad({ visits: [{ ...base, stars: 6 }] })).toBe("invalid_visit");
    expect(bad({ visits: [{ ...base, quizCorrect: 2 }] })).toBe("invalid_visit");
    expect(bad({ visits: [{ ...base, quizCorrect: 4, quizTotal: 3 }] })).toBe("invalid_visit");
    expect(bad({ visits: Array.from({ length: VISIT_SYNC_MAX + 1 }, (_, i) => ({ ...base, id: `visit-${String(i).padStart(9, "0")}` })) })).toBe(
      "too_many_visits",
    );
    expect(bad({ visits: [] })).toBe("ok");
  });

  it("visitView gir samme feltnavn som appens VisitEntry, ISO-tider og tall", () => {
    expect(visitView(visitRow)).toEqual({
      id: "visit-0001-aaaa",
      poiId: "poi_akershus",
      poiSlug: "akershus-festning",
      startedAt: "2026-09-18T10:00:00.000Z",
      completedAt: "2026-09-18T10:20:00.000Z",
      stars: 4,
      quizCorrect: 2,
      quizTotal: 3,
      updatedAt: "2026-09-18T10:21:00.000Z",
    });
    expect(visitView({ ...visitRow, completed_at: null, stars: null, quiz_correct: null, quiz_total: null, poi_slug: null })).toMatchObject({
      poiSlug: null,
      completedAt: null,
      stars: null,
      quizCorrect: null,
    });
  });

  it("retentionDaysFrom faller til 365 for tomt eller ugyldig", () => {
    expect(retentionDaysFrom(undefined)).toBe(365);
    expect(retentionDaysFrom("")).toBe(365);
    expect(retentionDaysFrom("0")).toBe(365);
    expect(retentionDaysFrom("4000")).toBe(365);
    expect(retentionDaysFrom("1.5")).toBe(365);
    expect(retentionDaysFrom(" 90 ")).toBe(90);
  });

  it("createIntervalGate slipper gjennom første gang og så én gang per intervall", () => {
    let t = 0;
    const gate = createIntervalGate(1000, () => t);
    expect(gate()).toBe(true);
    expect(gate()).toBe(false);
    t = 999;
    expect(gate()).toBe(false);
    t = 1000;
    expect(gate()).toBe(true);
    expect(gate()).toBe(false);
  });
});

describe("/api/guide/device/*", () => {
  it("krever X-SenseAid-Device og svarer alltid med no-store", async () => {
    const app = makeApp(makePool([]));
    const res = await request(app).get("/api/guide/device/visits");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_device_id");
    expect(res.headers["cache-control"]).toBe("private, no-store");

    const bad = await request(app).get("/api/guide/device/visits").set(DEVICE_HEADER, "kort");
    expect(bad.status).toBe(400);
  });

  it("PUT visits gjør upsert i én spørring, melder hoppede steder og kjører purge én gang i timen", async () => {
    let clock = NOW;
    const upsertParams: unknown[][] = [];
    const pool = makePool([
      {
        match: /INSERT INTO guide_poi_visits/,
        rows: (params) => {
          upsertParams.push(params);
          return (params[1] as string[]).filter((id) => id !== "visit-ukjent-sted").map((id) => ({ id }));
        },
      },
      { match: /FROM guide_poi_visits v/, rows: [visitRow] },
    ]);
    const app = makeApp(pool, () => clock);
    const body = {
      visits: [
        { id: "visit-0001-aaaa", poiId: "poi_akershus", startedAt: "2026-09-18T10:00:00Z", completedAt: "2026-09-18T10:20:00Z", stars: 4, quizCorrect: 2, quizTotal: 3 },
        { id: "visit-ukjent-sted", poiId: "poi_finnes_ikke", startedAt: "2026-09-18T11:00:00Z" },
      ],
    };
    const res = await request(app).put("/api/guide/device/visits").set(DEVICE_HEADER, DEVICE).send(body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deviceId: DEVICE, saved: 1, skipped: ["visit-ukjent-sted"], retentionDays: 90 });
    expect(res.body.visits).toEqual([visitView(visitRow)]);
    expect(res.headers["cache-control"]).toBe("private, no-store");

    expect(upsertParams).toHaveLength(1);
    const [deviceId, ids, poiIds, startedAts, completedAts, stars, quizCorrect, quizTotal] = upsertParams[0];
    expect(deviceId).toBe(DEVICE);
    expect(ids).toEqual(["visit-0001-aaaa", "visit-ukjent-sted"]);
    expect(poiIds).toEqual(["poi_akershus", "poi_finnes_ikke"]);
    expect((startedAts as Date[]).map((d) => d.toISOString())).toEqual(["2026-09-18T10:00:00.000Z", "2026-09-18T11:00:00.000Z"]);
    expect((completedAts as (Date | null)[])[1]).toBeNull();
    expect(stars).toEqual([4, null]);
    expect(quizCorrect).toEqual([2, null]);
    expect(quizTotal).toEqual([3, null]);
    expect(pool.query.mock.calls[0][0]).toBe(VISIT_UPSERT);

    const purgeCalls = () => pool.query.mock.calls.filter((c) => c[0] === VISIT_PURGE);
    expect(purgeCalls()).toHaveLength(1);
    expect(purgeCalls()[0][1]).toEqual([90]);

    await request(app).put("/api/guide/device/visits").set(DEVICE_HEADER, DEVICE).send({ visits: [] });
    expect(purgeCalls()).toHaveLength(1);
    clock += 60 * 60 * 1000;
    await request(app).put("/api/guide/device/visits").set(DEVICE_HEADER, DEVICE).send({ visits: [] });
    expect(purgeCalls()).toHaveLength(2);
    expect(pool.query.mock.calls.filter((c) => c[0] === VISIT_UPSERT)).toHaveLength(1);
  });

  it("PUT visits avviser ugyldig kropp med 400 uten å røre databasen", async () => {
    const pool = makePool([]);
    const res = await request(app(pool)).put("/api/guide/device/visits").set(DEVICE_HEADER, DEVICE).send({ visits: [{ id: "x" }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_visit");
    expect(pool.query).not.toHaveBeenCalled();

    function app(p: Pick<Pool, "query">) {
      return makeApp(p);
    }
  });

  it("GET data gir innsyn: formål, oppbevaring, besøk og vurderinger", async () => {
    const pool = makePool([
      { match: /FROM guide_poi_visits v/, rows: [visitRow] },
      {
        match: /FROM guide_poi_ratings/,
        rows: [{ poi_id: "poi_akershus", stars: "4", lang: "nb", comment: null, updated_at: "2026-09-18T10:21:00Z" }],
      },
    ]);
    const res = await request(makeApp(pool, () => NOW)).get("/api/guide/device/data").set(DEVICE_HEADER, DEVICE);
    expect(res.status).toBe(200);
    expect(res.body.deviceId).toBe(DEVICE);
    expect(res.body.retentionDays).toBe(90);
    expect(res.body.exportedAt).toBe("2026-09-18T12:00:00.000Z");
    expect(res.body.purpose.nb).toContain("Lagre loggen på serveren");
    expect(res.body.purpose.en).toContain("Keep my log on the server");
    expect(res.body.visits).toEqual([visitView(visitRow)]);
    expect(res.body.ratings).toEqual([
      { poiId: "poi_akershus", stars: 4, lang: "nb", comment: null, updatedAt: "2026-09-18T10:21:00.000Z" },
    ]);
    for (const call of pool.query.mock.calls) expect(call[1]).toEqual([DEVICE]);
  });

  it("DELETE sletter ett besøk, hele loggen eller alt (også vurderinger), alltid avgrenset til enheten", async () => {
    const deletes: [string, unknown[]][] = [];
    const pool = makePool([
      {
        match: /DELETE FROM guide_poi_(visits|ratings) WHERE device_id/,
        rows: (params) => {
          return params.length === 2 ? [{}] : [{}, {}];
        },
      },
    ]);
    pool.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (/DELETE FROM guide_poi_(visits|ratings) WHERE device_id/.test(sql)) {
        deletes.push([sql, params]);
        const rows = params.length === 2 ? [{}] : [{}, {}];
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    });
    const app = makeApp(pool);

    const one = await request(app).delete("/api/guide/device/visits/visit-0001-aaaa").set(DEVICE_HEADER, DEVICE);
    expect(one.status).toBe(200);
    expect(one.body).toEqual({ deviceId: DEVICE, deleted: { visits: 1 } });
    expect(deletes.at(-1)?.[1]).toEqual([DEVICE, "visit-0001-aaaa"]);

    const badId = await request(app).delete("/api/guide/device/visits/x").set(DEVICE_HEADER, DEVICE);
    expect(badId.status).toBe(400);

    const all = await request(app).delete("/api/guide/device/visits").set(DEVICE_HEADER, DEVICE);
    expect(all.body).toEqual({ deviceId: DEVICE, deleted: { visits: 2 } });

    const everything = await request(app).delete("/api/guide/device/data").set(DEVICE_HEADER, DEVICE);
    expect(everything.status).toBe(200);
    expect(everything.body).toEqual({ deviceId: DEVICE, deleted: { visits: 2, ratings: 2 } });
    expect(deletes.map(([sql]) => /guide_poi_ratings/.test(sql))).toEqual([false, false, false, true]);
    for (const [sql, params] of deletes) {
      expect(sql).toMatch(/WHERE device_id = \$1/);
      expect(params[0]).toBe(DEVICE);
    }
  });

  it("stopper løkker med 429 etter 60 kall per IP i minuttet", async () => {
    const app = makeApp(makePool([]));
    let last = 0;
    for (let i = 0; i < 61; i += 1) {
      last = (await request(app).get("/api/guide/device/visits").set(DEVICE_HEADER, DEVICE)).status;
    }
    expect(last).toBe(429);
  });

  it("svarer 500 uten å lekke feilen når databasen feiler", async () => {
    const pool = makePool([]);
    pool.query.mockRejectedValueOnce(new Error("connection refused, passord=hemmelig"));
    const res = await request(makeApp(pool)).get("/api/guide/device/visits").set(DEVICE_HEADER, DEVICE);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("hemmelig");
  });
});

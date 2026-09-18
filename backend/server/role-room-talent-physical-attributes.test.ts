/**
 * Fysiske trekk + etnisitet.
 *
 * Det viktigste her er etnisitet: den er en særlig kategori etter GDPR
 * art. 9 og skal ALDRI følge det generelle demographics-scopet. Et byrå med
 * full demografi-tilgang skal se høyde, hårfarge og mål — men ikke etnisk
 * opprinnelse, med mindre talenten har gitt et eget, eksplisitt ja.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { setupRoleRoomTalentsRoutes } from "./role-room-talents-routes.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function buildApp(captured: { sql: string; params: unknown[] }[]) {
  const app = express();
  app.use(express.json());
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      captured.push({ sql, params: params ?? [] });
      if (sql.includes("SELECT * FROM talents")) {
        return { rows: [{ id: "talent-1", owner_user_id: "user-1" }], rowCount: 1 };
      }
      return { rows: [{ id: "talent-1" }], rowCount: 1 };
    },
  } as unknown as Pool;

  setupRoleRoomTalentsRoutes({
    app,
    pool,
    getActiveSession: () => ({ userId: "user-1", email: "talent@test" }),
  });
  return app;
}

function jsonParam(captured: { sql: string; params: unknown[] }[], marker: string): Record<string, unknown> {
  const update = captured.find((q) => q.sql.includes("UPDATE talents"));
  const raw = update?.params.find(
    (p) => typeof p === "string" && p.startsWith("{") && p.includes(marker),
  );
  return raw ? JSON.parse(raw as string) : {};
}

describe("fysiske trekk", () => {
  it("forkaster mål utenfor menneskelig intervall", async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await request(buildApp(captured))
      .put("/api/role-room/talents/me")
      .send({ physical_attributes: { chest_cm: 98, waist_cm: 9999, hip_cm: 4 } });

    const saved = jsonParam(captured, "chest_cm");
    expect(saved.chest_cm).toBe(98);
    expect(saved.waist_cm).toBeUndefined();
    expect(saved.hip_cm).toBeUndefined();
  });

  it("godtar kun jeans-mål fra byråenes liste", async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await request(buildApp(captured))
      .put("/api/role-room/talents/me")
      .send({ physical_attributes: { jeans_width: 32, jeans_length: 37 } });

    const saved = jsonParam(captured, "jeans_width");
    expect(saved.jeans_width).toBe(32);
    expect(saved.jeans_length).toBeUndefined(); // 37 finnes ikke i listen
  });

  it("krever ISO-dato for måledato", async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await request(buildApp(captured))
      .put("/api/role-room/talents/me")
      .send({ physical_attributes: { measured_at: "i fjor", figure: "sporty" } });

    const saved = jsonParam(captured, "figure");
    expect(saved.figure).toBe("sporty");
    expect(saved.measured_at).toBeUndefined();
  });

  it("avviser hårfarge utenfor vokabularet", async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await request(buildApp(captured))
      .put("/api/role-room/talents/me")
      .send({ hair_color: "neongrønn", eye_color: "blue" });

    const update = captured.find((q) => q.sql.includes("UPDATE talents"));
    expect(update?.params).toContain(null); // ugyldig hårfarge nullstilles
    expect(update?.params).toContain("blue");
  });

  it("tar kun http(s) for de påkrevde bildene", async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await request(buildApp(captured))
      .put("/api/role-room/talents/me")
      .send({
        casting_photos: {
          face_front: "https://cdn.test/face.jpg",
          face_profile: "javascript:alert(1)",
          ukjent_type: "https://cdn.test/annet.jpg",
        },
      });

    const saved = jsonParam(captured, "face_front");
    expect(saved.face_front).toBe("https://cdn.test/face.jpg");
    expect(saved.face_profile).toBeUndefined();
    expect(saved.ukjent_type).toBeUndefined();
  });
});

describe("samtykke til etnisk opprinnelse (GDPR art. 9)", () => {
  it("krever boolsk verdi", async () => {
    const res = await request(buildApp([]))
      .post("/api/role-room/talents/me/ethnicity-consent")
      .send({ granted: "kanskje" });

    expect(res.status).toBe(400);
  });

  it("sletter verdien når samtykket trekkes", async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await request(buildApp(captured))
      .post("/api/role-room/talents/me/ethnicity-consent")
      .send({ granted: false });

    const update = captured.find((q) => q.sql.includes("ethnicity_consent ="));
    expect(update?.sql).toContain("ethnicity = CASE WHEN $2 THEN ethnicity ELSE NULL END");
    expect(update?.params[1]).toBe(false);
  });

  it("maskerer etnisitet bort uten eget samtykke — i begge filene", () => {
    for (const file of ["role-room-agency-search-routes.ts", "role-room-agencies-routes.ts"]) {
      const source = readFileSync(path.join(here, file), "utf8");
      const demoBlock = source.slice(
        source.indexOf('if (has("demographics"))'),
        source.indexOf('if (has("demographics"))') + 1200,
      );
      expect(demoBlock).toContain("row.ethnicity_consent === true ? row.ethnicity : null");
      // Et byrå skal kunne se at feltet finnes, men ikke innholdet.
      expect(demoBlock).toContain("ethnicity_shared");
    }
  });
});

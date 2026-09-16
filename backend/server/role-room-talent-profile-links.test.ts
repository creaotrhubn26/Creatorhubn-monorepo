/**
 * Lenkefeltene casting-byråer spør om.
 *
 * To ting holdes fast her:
 *   1. profile_links slipper bare kjente nøkler og http(s) gjennom — ellers
 *      kunne en javascript:-URL havne i en byrå-visning.
 *   2. Byrå-lenkene (agency_website, agency_profile) er IKKE offentlige. De
 *      følger contact_info sammen med agency_name, mens nettside, IMDb,
 *      Wikipedia og sosiale medier følger identiteten under basic_profile.
 *      Maskeringen er speilet i to filer, og de må ikke skli fra hverandre.
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

describe("profile_links", () => {
  it("forkaster ukjente nøkler og ikke-http-lenker", async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await request(buildApp(captured))
      .put("/api/role-room/talents/me")
      .send({
        profile_links: {
          website: "https://eksempel.no",
          imdb: "https://imdb.com/name/nm123",
          facebook: "javascript:alert(1)",
          hemmelig_felt: "https://skal-ikke-lagres.no",
        },
      });

    const update = captured.find((q) => q.sql.includes("UPDATE talents"));
    const payload = JSON.parse(
      (update?.params.find(
        (p) => typeof p === "string" && p.startsWith("{") && p.includes("website"),
      ) as string) ?? "{}",
    );

    expect(payload.website).toBe("https://eksempel.no");
    expect(payload.imdb).toBe("https://imdb.com/name/nm123");
    expect(payload.facebook).toBeUndefined();
    expect(payload.hemmelig_felt).toBeUndefined();
  });

  it("lar talenten lagre showreel 2, about-video og dramaskole", async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    await request(buildApp(captured))
      .put("/api/role-room/talents/me")
      .send({
        showreel_url_2: "https://vimeo.com/2",
        about_video_url: "https://vimeo.com/3",
        drama_school: "Teaterhøgskolen",
      });

    const update = captured.find((q) => q.sql.includes("UPDATE talents"));
    expect(update?.sql).toContain("showreel_url_2");
    expect(update?.sql).toContain("about_video_url");
    expect(update?.sql).toContain("drama_school");
  });
});

describe("maskering av lenker", () => {
  const searchSource = readFileSync(path.join(here, "role-room-agency-search-routes.ts"), "utf8");
  const agenciesSource = readFileSync(path.join(here, "role-room-agencies-routes.ts"), "utf8");

  it("holder byrå-lenkene bak contact_info i begge filene", () => {
    const searchContact = searchSource.slice(searchSource.indexOf('if (has("contact_info"))'));
    expect(searchContact).toContain("agency_links");

    const agenciesContact = agenciesSource.slice(agenciesSource.indexOf('if (has("contact_info"))'));
    expect(agenciesContact).toContain("agency_links");
  });

  const readKeyList = (source: string, name: string): string[] => {
    const match = source.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
    if (!match) throw new Error(`${name} ikke funnet`);
    return match[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  };

  it("legger aldri byrå-lenker i det offentlige settet", () => {
    for (const source of [searchSource, agenciesSource]) {
      const publicKeys = readKeyList(source, "PUBLIC_LINK_KEYS");
      expect(publicKeys).not.toContain("agency_website");
      expect(publicKeys).not.toContain("agency_profile");
    }
  });

  it("holder de to maskerings-filene i synk", () => {
    expect(readKeyList(searchSource, "PUBLIC_LINK_KEYS")).toEqual(
      readKeyList(agenciesSource, "PUBLIC_LINK_KEYS"),
    );
    expect(readKeyList(searchSource, "AGENCY_LINK_KEYS")).toEqual(
      readKeyList(agenciesSource, "AGENCY_LINK_KEYS"),
    );
  });

  it("eksponerer showreel 2 og about-video kun under media_portfolio", () => {
    for (const source of [searchSource, agenciesSource]) {
      const mediaBlock = source.slice(
        source.indexOf('if (has("media_portfolio"))'),
        source.indexOf('if (has("media_portfolio"))') + 400,
      );
      expect(mediaBlock).toContain("showreel_url_2");
      expect(mediaBlock).toContain("about_video_url");
    }
  });
});

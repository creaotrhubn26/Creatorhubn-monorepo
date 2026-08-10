import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { normalizeCharacterName, resolveSceneCast } from "./role-room-scene-cast-service.js";

describe("normalizeCharacterName", () => {
  it("fjerner regi-anvisninger i parentes", () => {
    // Manus skriver «KARI (V.O.)» og «KARI (CONT'D)» for samme karakter.
    expect(normalizeCharacterName("KARI (V.O.)")).toBe("KARI");
    expect(normalizeCharacterName("KARI (CONT'D)")).toBe("KARI");
    expect(normalizeCharacterName("KARI (O.S.)")).toBe("KARI");
  });

  it("gjør casing irrelevant — manus er versaler, casting er ikke", () => {
    expect(normalizeCharacterName("Kari")).toBe(normalizeCharacterName("KARI"));
  });

  it("normaliserer mellomrom", () => {
    expect(normalizeCharacterName("  KARI   NORDMANN ")).toBe("KARI NORDMANN");
  });

  it("beholder navn med flere ord", () => {
    expect(normalizeCharacterName("GAMMEL MANN")).toBe("GAMMEL MANN");
  });

  it("takler tom og udefinert verdi", () => {
    expect(normalizeCharacterName("")).toBe("");
    expect(normalizeCharacterName(undefined as unknown as string)).toBe("");
  });
});

function stubPool(scenes: unknown[], roles: unknown[]) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM casting_scenes")) return { rows: scenes, rowCount: scenes.length };
    if (sql.includes("FROM casting_roles")) return { rows: roles, rowCount: roles.length };
    return { rows: [], rowCount: 0 };
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("resolveSceneCast", () => {
  const roles = [
    { id: "rk", name: "Kari", assigned_candidate_id: "c1", candidate_name: "Ingrid" },
    { id: "ro", name: "Ola", assigned_candidate_id: null, candidate_name: null },
  ];

  it("kobler karakter til rolle og kandidat", async () => {
    const { pool } = stubPool(
      [{ id: "s1", scene_number: 1, title: "INT. KJØKKEN", characters: ["KARI"] }],
      roles,
    );
    const out = await resolveSceneCast(pool, "p1");
    expect(out.scenes[0].cast[0]).toMatchObject({
      character: "KARI", roleId: "rk", candidateName: "Ingrid", unmatched: false,
    });
  });

  it("kobler også når manus har regi-anvisning", async () => {
    const { pool } = stubPool(
      [{ id: "s1", scene_number: 1, title: null, characters: ["KARI (V.O.)"] }],
      roles,
    );
    expect((await resolveSceneCast(pool, "p1")).scenes[0].cast[0].roleId).toBe("rk");
  });

  it("flagger karakterer uten rolle framfor å skjule dem", async () => {
    // En uklar kobling skal vises som uklar, ikke gjemmes bak et pent tall.
    const { pool } = stubPool(
      [{ id: "s1", scene_number: 1, title: null, characters: ["UKJENT"] }],
      roles,
    );
    const out = await resolveSceneCast(pool, "p1");
    expect(out.scenes[0].cast[0].unmatched).toBe(true);
    expect(out.scenes[0].unmatchedCount).toBe(1);
    expect(out.totalUnmatched).toBe(1);
  });

  it("skiller rolle uten tildelt kandidat fra ukoblet karakter", async () => {
    // Ola har rolle, men ingen er castet ennå — det er ikke det samme som at
    // karakteren ikke finnes.
    const { pool } = stubPool(
      [{ id: "s1", scene_number: 1, title: null, characters: ["OLA"] }],
      roles,
    );
    const entry = (await resolveSceneCast(pool, "p1")).scenes[0].cast[0];
    expect(entry.unmatched).toBe(false);
    expect(entry.roleId).toBe("ro");
    expect(entry.candidateId).toBeNull();
  });

  it("takler scene uten karakterer", async () => {
    const { pool } = stubPool([{ id: "s1", scene_number: 1, title: null, characters: [] }], roles);
    const out = await resolveSceneCast(pool, "p1");
    expect(out.scenes[0].cast).toEqual([]);
    expect(out.totalUnmatched).toBe(0);
  });

  it("takler at characters ikke er en array", async () => {
    const { pool } = stubPool([{ id: "s1", scene_number: 1, title: null, characters: null }], roles);
    expect((await resolveSceneCast(pool, "p1")).scenes[0].cast).toEqual([]);
  });

  it("henter roller én gang, ikke per scene", async () => {
    // N+1 ville gjort dette upraktisk på et manus med hundre scener.
    const scenes = Array.from({ length: 50 }, (_, i) => ({
      id: `s${i}`, scene_number: i, title: null, characters: ["KARI"],
    }));
    const { pool, query } = stubPool(scenes, roles);
    await resolveSceneCast(pool, "p1");
    expect(query.mock.calls.filter((c) => String(c[0]).includes("FROM casting_roles"))).toHaveLength(1);
  });

  it("kan filtrere på ett manuskript", async () => {
    const { pool, query } = stubPool([], roles);
    await resolveSceneCast(pool, "p1", { manuscriptId: "m1" });
    const sceneQuery = query.mock.calls.find((c) => String(c[0]).includes("FROM casting_scenes"))!;
    expect(String(sceneQuery[0])).toContain("manuscript_id");
    expect(sceneQuery[1]).toContain("m1");
  });
});

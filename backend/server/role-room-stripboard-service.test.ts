import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  formatEighths,
  getShootProgress,
  getStripboard,
  resolveCast,
  type StripboardScene,
} from "./role-room-stripboard-service.js";

describe("formatEighths", () => {
  it("skriver sider slik bransjen gjør", () => {
    // 19 åttedeler = 2 og 3/8 side.
    expect(formatEighths(19)).toBe("2 3/8");
  });

  it("utelater brøken på hele sider", () => {
    expect(formatEighths(16)).toBe("2");
  });

  it("utelater heltallet under én side", () => {
    expect(formatEighths(3)).toBe("3/8");
  });

  it("skriver null som 0, ikke tom", () => {
    expect(formatEighths(0)).toBe("0");
  });

  it("skiller «ikke målt» fra «null sider»", () => {
    expect(formatEighths(null)).toBe("–");
    expect(formatEighths(undefined)).toBe("–");
  });

  it("takler ugyldige verdier", () => {
    expect(formatEighths(NaN)).toBe("–");
    expect(formatEighths(-5)).toBe("0");
  });
});

function stubPool(handlers: Array<{ match: RegExp; rows: unknown[] }>) {
  const query = vi.fn(async (sql: string) => {
    for (const h of handlers) {
      if (h.match.test(sql)) return { rows: h.rows, rowCount: h.rows.length };
    }
    return { rows: [], rowCount: 0 };
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("getStripboard", () => {
  const entries = [
    {
      entry_id: "e1", scene_id: "s1", production_day_id: "d1", sort_order: 1, setup_minutes: 45,
      scene_number: 1, title: "INT. KJØKKEN - DAG", int_ext: "INT", time_of_day: "DAG",
      setting: "KJØKKEN", characters: ["KARI", "OLA"], page_eighths: 12, shoot_status: "shot",
      day_date: "2026-08-17", day_status: "planned",
    },
    {
      entry_id: "e2", scene_id: "s2", production_day_id: "d1", sort_order: 2, setup_minutes: 30,
      scene_number: 2, title: "INT. STUE - DAG", int_ext: "INT", time_of_day: "DAG",
      setting: "STUE", characters: ["KARI"], page_eighths: 7, shoot_status: "not_shot",
      day_date: "2026-08-17", day_status: "planned",
    },
    {
      entry_id: "e3", scene_id: "s3", production_day_id: null, sort_order: 0, setup_minutes: 0,
      scene_number: 3, title: "EXT. GATA - NATT", int_ext: "EXT", time_of_day: "NATT",
      setting: "GATA", characters: [], page_eighths: 4, shoot_status: "not_shot",
      day_date: null, day_status: null,
    },
  ];

  it("grupperer scener per dag og summerer sider", async () => {
    const { pool } = stubPool([{ match: /FROM casting_scenes s/, rows: entries }]);
    const board = await getStripboard(pool, "p1");
    expect(board.days).toHaveLength(1);
    expect(board.days[0].totalEighths).toBe(19);
    expect(board.days[0].totalPagesLabel).toBe("2 3/8");
  });

  it("teller unike karakterer, ikke oppføringer", async () => {
    // KARI er i begge scener, men skal på settet én gang.
    const { pool } = stubPool([{ match: /FROM casting_scenes s/, rows: entries }]);
    expect((await getStripboard(pool, "p1")).days[0].castCount).toBe(2);
  });

  it("teller unike locations — hver ekstra er en flytting", async () => {
    const { pool } = stubPool([{ match: /FROM casting_scenes s/, rows: entries }]);
    expect((await getStripboard(pool, "p1")).days[0].locationCount).toBe(2);
  });

  it("summerer riggetid for dagen", async () => {
    const { pool } = stubPool([{ match: /FROM casting_scenes s/, rows: entries }]);
    expect((await getStripboard(pool, "p1")).days[0].totalSetupMinutes).toBe(75);
  });

  it("holder uplanlagte scener i egen bunke framfor å skjule dem", async () => {
    const { pool } = stubPool([{ match: /FROM casting_scenes s/, rows: entries }]);
    const board = await getStripboard(pool, "p1");
    expect(board.unscheduled).toHaveLength(1);
    expect(board.unscheduled[0].sceneNumber).toBe(3);
    expect(board.scheduledScenes).toBe(2);
    expect(board.totalScenes).toBe(3);
  });

  it("takler tomt stripboard", async () => {
    const { pool } = stubPool([]);
    const board = await getStripboard(pool, "p1");
    expect(board.days).toEqual([]);
    expect(board.unscheduled).toEqual([]);
  });
});

describe("getShootProgress", () => {
  const totals = (over: Record<string, unknown> = {}) => ({
    match: /FROM casting_scenes\s*\n\s*WHERE project_id/,
    rows: [{ n: 10, shot: 4, partial: 1, omitted: 2, eighths: 64, eighths_shot: 24, ...over }],
  });

  it("måler fremdrift i sider, ikke i antall scener", async () => {
    const { pool } = stubPool([totals(), { match: /FROM role_room_stripboard_entries/, rows: [] }]);
    const p = await getShootProgress(pool, "p1");
    expect(p.eighthsShot).toBe(24);
    expect(p.pagesShotLabel).toBe("3");
    expect(p.completionRatio).toBe(0.375);
  });

  it("trekker strøkne scener fra det som gjenstår", async () => {
    // 10 totalt, 4 skutt, 2 strøket → 4 igjen, ikke 6.
    const { pool } = stubPool([totals(), { match: /FROM role_room_stripboard_entries/, rows: [] }]);
    expect((await getShootProgress(pool, "p1")).scenesRemaining).toBe(4);
  });

  it("skiller «ikke målt» fra «null prosent ferdig»", async () => {
    const { pool } = stubPool([
      totals({ eighths: 0, eighths_shot: 0 }),
      { match: /FROM role_room_stripboard_entries/, rows: [] },
    ]);
    expect((await getShootProgress(pool, "p1")).completionRatio).toBeNull();
  });

  it("lister dager med gjenstående arbeid", async () => {
    const { pool } = stubPool([
      totals(),
      { match: /FROM role_room_stripboard_entries/, rows: [{ day_date: "2026-08-17", n: 2 }] },
    ]);
    const p = await getShootProgress(pool, "p1");
    expect(p.daysWithOutstandingWork).toEqual([{ date: "2026-08-17", remainingScenes: 2 }]);
  });

  it("lar ikke gjenstående sider bli negativt", async () => {
    const { pool } = stubPool([
      totals({ eighths: 10, eighths_shot: 20 }),
      { match: /FROM role_room_stripboard_entries/, rows: [] },
    ]);
    expect((await getShootProgress(pool, "p1")).eighthsRemaining).toBe(0);
  });
});

describe("resolveCast", () => {
  const scene = (id: string, characters: string[]): StripboardScene => ({
    entryId: null, sceneId: id, sceneNumber: 1, title: null, intExt: null,
    timeOfDay: null, setting: null, characters, pageEighths: 8,
    shootStatus: "not_shot", sortOrder: 0, setupMinutes: 0,
  });

  const roles = [
    { role_id: "r1", role_name: "KARI", assigned_candidate_id: "c1", candidate_name: "Ingrid Berdal" },
    { role_id: "r2", role_name: "OLA", assigned_candidate_id: null, candidate_name: null },
  ];

  it("kobler karakter til tildelt kandidat", async () => {
    const { pool } = stubPool([{ match: /FROM casting_roles/, rows: roles }]);
    const cast = await resolveCast(pool, "p1", [scene("s1", ["KARI"])]);
    expect(cast).toEqual([
      { id: "c1", name: "Ingrid Berdal", character: "KARI", scenes: ["s1"] },
    ]);
  });

  it("regner «KARI (V.O.)» som samme karakter, og viser rollenavnet", async () => {
    // (V.O.) er en regianvisning, ikke en del av navnet.
    const { pool } = stubPool([{ match: /FROM casting_roles/, rows: roles }]);
    const cast = await resolveCast(pool, "p1", [
      scene("s1", ["KARI (V.O.)"]),
      scene("s2", ["KARI"]),
    ]);
    expect(cast).toHaveLength(1);
    expect(cast[0].character).toBe("KARI");
    expect(cast[0].scenes).toEqual(["s1", "s2"]);
  });

  it("faller tilbake på rollen når ingen kandidat er tildelt", async () => {
    const { pool } = stubPool([{ match: /FROM casting_roles/, rows: roles }]);
    const cast = await resolveCast(pool, "p1", [scene("s1", ["OLA"])]);
    expect(cast[0]).toMatchObject({ id: "r2", name: "OLA", character: "OLA" });
  });

  it("mister ikke karakterer som ikke finnes som rolle", async () => {
    // Som regel en skrivefeil i manus eller en rolle som mangler. Å utelate
    // dem ville skjult begge deler.
    const { pool } = stubPool([{ match: /FROM casting_roles/, rows: roles }]);
    const cast = await resolveCast(pool, "p1", [scene("s1", ["UKJENT FIGUR"])]);
    expect(cast).toHaveLength(1);
    expect(cast[0].character).toBe("UKJENT FIGUR");
  });

  it("spør ikke om roller når ingen scener har karakterer", async () => {
    const { pool, query } = stubPool([{ match: /FROM casting_roles/, rows: roles }]);
    expect(await resolveCast(pool, "p1", [scene("s1", [])])).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});

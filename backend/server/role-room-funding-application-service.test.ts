import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  CONFIRMED_FINANCING_THRESHOLD,
  getApplicationReadiness,
  getFinancingSummary,
  setRequirementStatus,
} from "./role-room-funding-application-service.js";

const source = (name: string, type: string, amount: number, confirmed: boolean) => ({
  source_name: name, source_type: type, amount, confirmed,
});

function financingPool(sources: unknown[]) {
  return { query: vi.fn(async () => ({ rows: sources, rowCount: sources.length })) } as unknown as Pool;
}

describe("getFinancingSummary", () => {
  it("regner bekreftet andel", async () => {
    const s = await getFinancingSummary(
      financingPool([source("A", "public", 800, true), source("B", "private", 200, false)]),
      "p1",
    );
    expect(s.total).toBe(1000);
    expect(s.confirmed).toBe(800);
    expect(s.confirmedRatio).toBe(0.8);
    expect(s.meetsThreshold).toBe(true);
  });

  it("teller egenkapital som private midler", async () => {
    // NFI ber om skillet offentlig/privat, ikke selskapets egne mot andres.
    // Uten dette ville egenkapital gitt falsk blokker på nesten alle.
    const s = await getFinancingSummary(
      financingPool([source("Egenkapital", "own", 300, true), source("Fond", "public", 700, true)]),
      "p1",
    );
    expect(s.private).toBe(300);
    expect(s.public).toBe(700);
    expect(s.public + s.private).toBe(s.total);
  });

  it("oppgir manglende beløp i kroner, ikke bare prosent", async () => {
    // Det er beløpet som må skaffes.
    const s = await getFinancingSummary(
      financingPool([source("A", "public", 500, true), source("B", "private", 500, false)]),
      "p1",
    );
    expect(s.meetsThreshold).toBe(false);
    expect(s.shortfallToThreshold).toBe(300); // 80 % av 1000 = 800, har 500
  });

  it("er akkurat på terskelen ved 80 %", async () => {
    const s = await getFinancingSummary(
      financingPool([source("A", "public", 80, true), source("B", "private", 20, false)]),
      "p1",
    );
    expect(s.confirmedRatio).toBe(CONFIRMED_FINANCING_THRESHOLD);
    expect(s.meetsThreshold).toBe(true);
    expect(s.shortfallToThreshold).toBe(0);
  });

  it("takler tom finansieringsplan uten å dividere på null", async () => {
    const s = await getFinancingSummary(financingPool([]), "p1");
    expect(s.confirmedRatio).toBeNull();
    expect(s.meetsThreshold).toBe(false);
  });
});

// ── Klarhetsvurdering ───────────────────────────────────────────────────────

function readinessPool(opts: {
  requirements: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  sources?: unknown[];
  budget?: { n: number; total: number };
  unmapped?: Array<{ category: string }>;
  timeline?: { n: number; with_dates: number };
  shoot?: { days: number; scheduled: number };
  verified?: boolean;
  deadlineAt?: string | null;
}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM role_room_funding_applications a")) {
      return {
        rows: [{
          id: "app1", project_id: "p1", label: "Søknad",
          deadline_at: opts.deadlineAt === undefined ? null : opts.deadlineAt,
          status: "draft", scheme_id: "s1", scheme_key: "nfi",
          scheme_name: "NFI", verified: opts.verified ?? true,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM role_room_funding_requirements")) {
      return { rows: opts.requirements, rowCount: opts.requirements.length };
    }
    if (sql.includes("FROM role_room_funding_application_items")) {
      const rows = opts.items ?? [];
      return { rows, rowCount: rows.length };
    }
    if (sql.includes("FROM role_room_financing_sources")) {
      const rows = opts.sources ?? [];
      return { rows, rowCount: rows.length };
    }
    // NOT EXISTS-spørringen leser også role_room_budget_items, så den må
    // sjekkes først — ellers svarer budsjett-grenen på begge.
    if (sql.includes("NOT EXISTS")) {
      const rows = opts.unmapped ?? [];
      return { rows, rowCount: rows.length };
    }
    if (sql.includes("FROM role_room_budget_items")) {
      return { rows: [{ n: opts.budget?.n ?? 0, total: opts.budget?.total ?? 0 }], rowCount: 1 };
    }
    if (sql.includes("FROM role_room_phase_timeline_items")) {
      return { rows: [{ n: opts.timeline?.n ?? 0, with_dates: opts.timeline?.with_dates ?? 0 }], rowCount: 1 };
    }
    if (sql.includes("casting_production_days")) {
      return { rows: [{ days: opts.shoot?.days ?? 0, scheduled: opts.shoot?.scheduled ?? 0 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool;
}

const req = (key: string, label: string, autoCheck: string | null, mandatory = true) => ({
  requirement_key: key, label, description: null, auto_check: autoCheck, mandatory, sort_order: 0,
});

describe("getApplicationReadiness", () => {
  it("avgjør krav automatisk fra data vi allerede har", async () => {
    const pool = readinessPool({
      requirements: [req("kalkyle", "Kalkyle", "budget_present")],
      budget: { n: 4, total: 1700000 },
    });
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.requirements[0].state).toBe("met");
    expect(r.requirements[0].automatic).toBe(true);
    expect(r.ready).toBe(true);
  });

  it("forklarer hvorfor et krav ikke er oppfylt", async () => {
    const pool = readinessPool({
      requirements: [req("kalkyle", "Kalkyle", "budget_present")],
      budget: { n: 4, total: 0 },
    });
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.requirements[0].state).toBe("unmet");
    expect(r.requirements[0].detail).toMatch(/ingen beløp/i);
  });

  it("blokkerer på ukartlagte budsjettposter", async () => {
    // De ville forsvunnet stille ut av eksporten.
    const pool = readinessPool({
      requirements: [req("kalkyle_kartlagt", "Kartlagt", "budget_fully_mapped")],
      unmapped: [{ category: "Drone" }],
    });
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.requirements[0].state).toBe("unmet");
    expect(r.requirements[0].detail).toMatch(/Drone/);
  });

  it("blokkerer under 80 % bekreftet finansiering", async () => {
    const pool = readinessPool({
      requirements: [req("finansiering_80", "80 %", "financing_80_percent")],
      sources: [source("A", "public", 500, true), source("B", "private", 500, false)],
    });
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.requirements[0].state).toBe("unmet");
    expect(r.requirements[0].detail).toMatch(/50 % bekreftet/);
    expect(r.ready).toBe(false);
  });

  it("regner en plan uten datoer som ingen framdriftsplan", async () => {
    const pool = readinessPool({
      requirements: [req("framdriftsplan", "Framdrift", "timeline_present")],
      timeline: { n: 18, with_dates: 0 },
    });
    expect((await getApplicationReadiness(pool, "app1")).requirements[0].detail).toMatch(/ingen har frist/);
  });

  it("regner opptaksdager uten scener som ingen opptaksplan", async () => {
    const pool = readinessPool({
      requirements: [req("opptaksplan", "Opptak", "shoot_plan_present")],
      shoot: { days: 5, scheduled: 0 },
    });
    expect((await getApplicationReadiness(pool, "app1")).requirements[0].detail).toMatch(/ingen scener/);
  });

  it("holder manuelle krav åpne til de bekreftes", async () => {
    const pool = readinessPool({ requirements: [req("rettigheter", "Rettigheter", null)] });
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.requirements[0].state).toBe("manual_pending");
    expect(r.requirements[0].automatic).toBe(false);
  });

  it("godtar manuelle krav som er bekreftet", async () => {
    const pool = readinessPool({
      requirements: [req("rettigheter", "Rettigheter", null)],
      items: [{ requirement_key: "rettigheter", status: "ready", document_url: "https://x", note: null }],
    });
    expect((await getApplicationReadiness(pool, "app1")).ready).toBe(true);
  });

  it("lar «ikke aktuelt» ta kravet ut av regnestykket", async () => {
    const pool = readinessPool({
      requirements: [req("tidligere", "Tidligere resultater", null)],
      items: [{ requirement_key: "tidligere", status: "not_applicable", document_url: null, note: "Gjelder ikke" }],
    });
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.requirements[0].state).toBe("not_applicable");
    expect(r.mandatoryTotal).toBe(0);
    expect(r.ready).toBe(true);
  });

  it("teller ikke valgfrie krav som blokkere", async () => {
    const pool = readinessPool({
      requirements: [req("kalkyle", "Kalkyle", "budget_present"), req("valgfritt", "Valgfritt", null, false)],
      budget: { n: 1, total: 100 },
    });
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.ready).toBe(true);
    expect(r.mandatoryTotal).toBe(1);
  });

  it("lar ikke en feilende sjekk se ut som et oppfylt krav", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM role_room_funding_applications a")) {
          return {
            rows: [{ id: "app1", project_id: "p1", label: "S", deadline_at: null, status: "draft",
                     scheme_id: "s1", scheme_key: "nfi", scheme_name: "NFI", verified: true }],
            rowCount: 1,
          };
        }
        if (sql.includes("FROM role_room_funding_requirements")) {
          return { rows: [req("kalkyle", "Kalkyle", "budget_present")], rowCount: 1 };
        }
        if (sql.includes("FROM role_room_budget_items")) throw new Error("tabellen mangler");
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.requirements[0].state).toBe("unmet");
    expect(r.requirements[0].detail).toMatch(/Kunne ikke kontrolleres/);
  });

  it("advarer når fristen nærmer seg og noe gjenstår", async () => {
    const inTenDays = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const pool = readinessPool({
      requirements: [req("kalkyle", "Kalkyle", "budget_present")],
      budget: { n: 0, total: 0 },
      deadlineAt: inTenDays,
    });
    const r = await getApplicationReadiness(pool, "app1");
    expect(r.warnings.join(" ")).toMatch(/dager til frist/);
  });

  it("sier fra når fristen allerede er ute", async () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const pool = readinessPool({ requirements: [], deadlineAt: past });
    expect((await getApplicationReadiness(pool, "app1")).warnings.join(" ")).toMatch(/gikk ut/);
  });

  it("kaster på ukjent søknad", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as Pool;
    await expect(getApplicationReadiness(pool, "nope")).rejects.toThrow(/Ukjent søknad/);
  });
});

describe("setRequirementStatus", () => {
  it("nekter å krysse av et automatisk krav", async () => {
    // Avkryssingen ville skjult at dataene faktisk mangler.
    const pool = {
      query: vi.fn(async () => ({ rows: [{ auto_check: "financing_80_percent" }], rowCount: 1 })),
    } as unknown as Pool;
    await expect(
      setRequirementStatus(pool, {
        applicationId: "app1", requirementKey: "finansiering_80", status: "ready", userId: "u1",
      }),
    ).rejects.toThrow(/avgjøres automatisk/);
  });

  it("tillater å markere et automatisk krav som ikke aktuelt", async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [{ auto_check: "financing_80_percent" }], rowCount: 1 })),
    } as unknown as Pool;
    await expect(
      setRequirementStatus(pool, {
        applicationId: "app1", requirementKey: "finansiering_80", status: "not_applicable", userId: "u1",
      }),
    ).resolves.toBeUndefined();
  });

  it("kaster på ukjent krav", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as Pool;
    await expect(
      setRequirementStatus(pool, {
        applicationId: "app1", requirementKey: "tull", status: "ready", userId: "u1",
      }),
    ).rejects.toThrow(/Ukjent krav/);
  });
});

import { describe, it, expect } from "vitest";
import {
  PARTNER_ROLE_LABELS,
  WINDOW_OPENS_DAYS_BEFORE,
  deadlineMoment,
  opensMoment,
  resolveWindowStatus,
  summarisePartners,
} from "./role-room-funding-window.js";

const win = (label: string, deadline: string, opens: string | null = null) => ({
  label, deadlineDate: deadline, opensDate: opens,
});

describe("deadlineMoment", () => {
  it("setter fristen til kl. 12.00 norsk tid", () => {
    // Vintertid: 12:00 norsk = 11:00 UTC.
    expect(deadlineMoment("2027-02-10").toISOString()).toBe("2027-02-10T11:00:00.000Z");
  });

  it("takler sommertid via oppgitt offset", () => {
    // Sommertid: 12:00 norsk = 10:00 UTC.
    expect(deadlineMoment("2027-05-12", 2).toISOString()).toBe("2027-05-12T10:00:00.000Z");
  });
});

describe("opensMoment", () => {
  it("åpner fire uker før fristen når ingenting annet er oppgitt", () => {
    const opens = opensMoment(win("R1", "2027-02-10"));
    const deadline = deadlineMoment("2027-02-10");
    const days = Math.round((deadline.getTime() - opens.getTime()) / 86_400_000);
    expect(days).toBe(WINDOW_OPENS_DAYS_BEFORE);
  });

  it("lar en eksplisitt åpningsdato vinne", () => {
    // Enkeltrunder kan avvike — en utledet dato ingen kan overstyre er en felle.
    expect(opensMoment(win("R1", "2027-02-10", "2027-01-20")).toISOString().slice(0, 10))
      .toBe("2027-01-20");
  });
});

describe("resolveWindowStatus", () => {
  const windows = [
    win("Runde 1", "2027-02-10", "2027-01-13"),
    win("Runde 2", "2027-05-12", "2027-04-14"),
  ];

  it("sier fra at løpende ordninger ikke har frist å rekke", () => {
    const s = resolveWindowStatus("rolling", [], new Date("2027-03-01T09:00:00Z"));
    expect(s.state).toBe("rolling");
    expect(s.canSubmitNow).toBe(true);
    expect(s.message).toMatch(/Løpende/);
  });

  it("melder at runden ennå ikke er åpen", () => {
    const s = resolveWindowStatus("deadline", windows, new Date("2027-01-01T09:00:00Z"));
    expect(s.state).toBe("upcoming");
    expect(s.label).toBe("Runde 1");
    // Kan ikke sendes ennå, selv om søknaden er ferdig.
    expect(s.canSubmitNow).toBe(false);
    expect(s.daysUntil).toBe(12);
  });

  it("melder åpen runde med dager igjen", () => {
    const s = resolveWindowStatus("deadline", windows, new Date("2027-02-01T09:00:00Z"));
    expect(s.state).toBe("open");
    expect(s.canSubmitNow).toBe(true);
    expect(s.message).toMatch(/til frist kl. 12.00/);
  });

  it("sier «i dag» på selve fristdagen før kl. 12", () => {
    const s = resolveWindowStatus("deadline", windows, new Date("2027-02-10T08:00:00Z"));
    expect(s.state).toBe("open");
    expect(s.message).toMatch(/går ut i dag/);
  });

  it("går videre til neste runde når fristen er passert", () => {
    // Rett etter kl. 12.00 norsk tid på fristdagen.
    const s = resolveWindowStatus("deadline", windows, new Date("2027-02-10T11:30:00Z"));
    expect(s.label).toBe("Runde 2");
  });

  it("skiller «ingen flere runder» fra «ingen runder registrert»", () => {
    const passed = resolveWindowStatus("deadline", windows, new Date("2028-01-01T09:00:00Z"));
    expect(passed.state).toBe("closed");
    expect(passed.message).toMatch(/passert/);

    const none = resolveWindowStatus("deadline", [], new Date("2027-01-01T09:00:00Z"));
    expect(none.message).toMatch(/Ingen søknadsrunder er registrert/);
    expect(none.canSubmitNow).toBe(false);
  });

  it("bøyer «dag» riktig i entall", () => {
    const s = resolveWindowStatus("deadline", [win("R", "2027-02-10", "2027-01-13")],
      new Date("2027-01-12T09:00:00Z"));
    expect(s.message).toMatch(/om 1 dag \(/);
  });

  it("velger nærmeste kommende runde uansett rekkefølge i lista", () => {
    const reversed = [win("Runde 2", "2027-05-12"), win("Runde 1", "2027-02-10")];
    const s = resolveWindowStatus("deadline", reversed, new Date("2027-01-20T09:00:00Z"));
    expect(s.label).toBe("Runde 1");
  });
});

describe("summarisePartners", () => {
  const src = (name: string, role: string | null, amount: number, confirmed: boolean) => ({
    name, partnerRole: role, amount, confirmed,
  });

  it("grupperer kilder på partnerrolle", () => {
    const { coverage } = summarisePartners([
      src("Vestnorsk filmsenter", "regional_fund", 400000, true),
      src("SF Studios", "distributor", 200000, false),
    ]);
    expect(coverage.map((c) => c.role)).toEqual(["regional_fund", "distributor"]);
    expect(coverage.find((c) => c.role === "regional_fund")?.confirmed).toBe(true);
    expect(coverage.find((c) => c.role === "distributor")?.confirmed).toBe(false);
  });

  it("gjør «det mangler penger» om til «du mangler distributør»", () => {
    const { missingSuggested } = summarisePartners([
      src("Vestnorsk filmsenter", "regional_fund", 400000, true),
    ]);
    expect(missingSuggested).toContain(PARTNER_ROLE_LABELS.distributor);
    expect(missingSuggested).toContain(PARTNER_ROLE_LABELS.co_producer);
    expect(missingSuggested).not.toContain(PARTNER_ROLE_LABELS.regional_fund);
  });

  it("summerer flere kilder i samme rolle", () => {
    const { coverage } = summarisePartners([
      src("Fond A", "regional_fund", 300000, true),
      src("Fond B", "regional_fund", 200000, false),
    ]);
    const rf = coverage.find((c) => c.role === "regional_fund")!;
    expect(rf.amount).toBe(500000);
    expect(rf.names).toEqual(["Fond A", "Fond B"]);
    // Én bekreftet holder for at rollen regnes som dekket.
    expect(rf.confirmed).toBe(true);
  });

  it("plasserer kilder uten rolle under «Annet» framfor å miste dem", () => {
    const { coverage } = summarisePartners([src("Ukjent bidrag", null, 50000, true)]);
    expect(coverage.map((c) => c.role)).toEqual(["other"]);
  });

  it("foreslår alle fire når ingenting er på plass", () => {
    expect(summarisePartners([]).missingSuggested).toHaveLength(4);
  });
});

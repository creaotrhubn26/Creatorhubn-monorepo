import { describe, expect, it, vi } from "vitest";

const brreg = vi.hoisted(() => ({ lookupCompanyForNewLead: vi.fn() }));
vi.mock("./lead-brreg-service.js", () => brreg);
vi.mock("./leadgrid-trial.js", () => ({ setTrialHardLimit: vi.fn() }));

const { ManualRegistrationError, normalizeOrgNumber, registerCompanyManually } =
  await import("./leadgrid-manual-registration.js");

const NERAS = {
  name: "NERAS DIREKTE AS",
  orgNr: "986330682",
  orgForm: "AS",
  registeredAt: "2003-12-02",
  naceCode: "82.200",
  naceDescription: "Telefonsalg",
  employees: 65,
  address: "Ole Steens gate 10",
  postalCode: "3015",
  city: "DRAMMEN",
  municipality: "DRAMMEN",
  website: "www.nerasdirekte.no",
  isBankrupt: false,
};

function pool(opts: { orgFinnes?: boolean; brukerFinnes?: boolean } = {}) {
  const spor: string[] = [];
  const query = vi.fn(async (sql: string) => {
    const t = String(sql).trim();
    spor.push(t.split(/\s+/).slice(0, 3).join(" "));
    if (t.startsWith("SELECT id::text, name FROM organizations")) {
      return { rows: opts.orgFinnes ? [{ id: "org-gammel", name: "Gammel" }] : [], rowCount: 0 };
    }
    if (t.startsWith("SELECT id::text FROM users")) {
      return { rows: opts.brukerFinnes ? [{ id: "bruker-gammel" }] : [], rowCount: 0 };
    }
    if (t.includes("trial_hard_expires_at FROM organizations")) {
      return { rows: [{ trial_hard_expires_at: new Date("2026-10-24T00:00:00Z") }], rowCount: 1 };
    }
    return { rows: [{ id: "ny-id" }], rowCount: 1 };
  });
  const klient = { query, release: vi.fn() };
  return { pool: { connect: async () => klient, query } as never, query, spor };
}

describe("normalizeOrgNumber", () => {
  it("tåler mellomrom og punktum", () => {
    expect(normalizeOrgNumber("986 330 682")).toBe("986330682");
    expect(normalizeOrgNumber("986.330.682")).toBe("986330682");
  });
  it("avviser alt som ikke er ni siffer", () => {
    expect(normalizeOrgNumber("98633068")).toBeNull();
    expect(normalizeOrgNumber("")).toBeNull();
  });
});

describe("registerCompanyManually", () => {
  it("lager organisasjon, admin, medlemskap og prosjekt fra ni siffer", async () => {
    brreg.lookupCompanyForNewLead.mockResolvedValue({ found: true, company: NERAS });
    const { pool: p, spor } = pool();
    const ut = await registerCompanyManually(p, {
      organizationNumber: "986 330 682",
      adminEmail: "Jon@nerasdirekte.no",
      createdByUserId: "u1",
    });
    expect(ut.organization.name).toBe("NERAS DIREKTE AS");
    expect(ut.organization.nace_code).toBe("82.200");
    expect(ut.admin.email).toBe("jon@nerasdirekte.no");
    expect(ut.project.name).toBe("NERAS DIREKTE AS");
    expect(ut.trial.starts_on_first_discovery).toBe(true);
    expect(spor).toContain("INSERT INTO organization_members");
    expect(spor).toContain("INSERT INTO leadgrid_projects");
    expect(spor).toContain("COMMIT");
  });

  it("gjenbruker organisasjonen når org.nr alt finnes", async () => {
    // Samme bedrift skal ikke få to organisasjoner. Nøkkelen er org.nr,
    // ikke navnet — navn skrives ulikt hver gang.
    brreg.lookupCompanyForNewLead.mockResolvedValue({ found: true, company: NERAS });
    const { pool: p } = pool({ orgFinnes: true });
    const ut = await registerCompanyManually(p, {
      organizationNumber: "986330682",
      adminEmail: "ny@nerasdirekte.no",
      createdByUserId: "u1",
    });
    expect(ut.organization.reused).toBe(true);
    expect(ut.organization.id).toBe("org-gammel");
  });

  it("gjenbruker brukeren i stedet for å lage dublett", async () => {
    brreg.lookupCompanyForNewLead.mockResolvedValue({ found: true, company: NERAS });
    const { pool: p } = pool({ brukerFinnes: true });
    const ut = await registerCompanyManually(p, {
      organizationNumber: "986330682",
      adminEmail: "jon@nerasdirekte.no",
      createdByUserId: "u1",
    });
    expect(ut.admin.reused).toBe(true);
  });

  it("stopper på konkursbo", async () => {
    // Nesten alltid en tastefeil.
    brreg.lookupCompanyForNewLead.mockResolvedValue({
      found: true,
      company: { ...NERAS, isBankrupt: true },
    });
    const { pool: p } = pool();
    await expect(
      registerCompanyManually(p, {
        organizationNumber: "986330682",
        adminEmail: "a@b.no",
        createdByUserId: "u1",
      }),
    ).rejects.toThrow(ManualRegistrationError);
  });

  it("stopper når nummeret ikke finnes i registeret", async () => {
    brreg.lookupCompanyForNewLead.mockResolvedValue({ found: false });
    const { pool: p } = pool();
    await expect(
      registerCompanyManually(p, {
        organizationNumber: "999999999",
        adminEmail: "a@b.no",
        createdByUserId: "u1",
      }),
    ).rejects.toThrow(/Fant ingen bedrift/);
  });

  it("slår opp BRREG før den rører databasen", async () => {
    brreg.lookupCompanyForNewLead.mockResolvedValue({ found: false });
    const { pool: p, query } = pool();
    await expect(
      registerCompanyManually(p, {
        organizationNumber: "999999999",
        adminEmail: "a@b.no",
        createdByUserId: "u1",
      }),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it("ruller tilbake hvis noe feiler underveis", async () => {
    brreg.lookupCompanyForNewLead.mockResolvedValue({ found: true, company: NERAS });
    const klient = {
      query: vi.fn(async (sql: string) => {
        if (String(sql).includes("organization_members")) throw new Error("brudd");
        if (String(sql).includes("SELECT id::text")) return { rows: [], rowCount: 0 };
        return { rows: [{ id: "x" }], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    await expect(
      registerCompanyManually({ connect: async () => klient } as never, {
        organizationNumber: "986330682",
        adminEmail: "a@b.no",
        createdByUserId: "u1",
      }),
    ).rejects.toThrow("brudd");
    const kall = klient.query.mock.calls.map(([s]) => String(s));
    expect(kall).toContain("ROLLBACK");
    expect(kall).not.toContain("COMMIT");
  });

  it("avviser ugyldig e-post før alt annet", async () => {
    const { pool: p } = pool();
    await expect(
      registerCompanyManually(p, {
        organizationNumber: "986330682",
        adminEmail: "ikke-en-epost",
        createdByUserId: "u1",
      }),
    ).rejects.toThrow(/Ugyldig e-post/);
  });
});

import { describe, it, expect } from "vitest";
import {
  STREAM_HEAVY_FRACTION,
  egressRows,
  formatBytes,
  formatNok,
  formatPercent,
  keyRoleRows,
  productionRows,
  rolloutView,
  type RolloutResponse,
} from "./storageStatusAdapter";

const GIB = 1024 * 1024 * 1024;

const rollout = (over: Partial<RolloutResponse> = {}): RolloutResponse => ({
  configured: true,
  complete: false,
  keyRolesTotal: 10,
  keyRolesScoped: 10,
  keyRolesSharingFallback: [],
  bucketClassesTotal: 6,
  bucketClassesScoped: 6,
  bucketClassesSharingFallback: [],
  ...over,
});

describe("rolloutView", () => {
  it("melder ok når alt er skilt ut", () => {
    const v = rolloutView(rollout({ complete: true }));
    expect(v.severity).toBe("ok");
    expect(v.outstanding).toEqual([]);
  });

  it("behandler halvferdig som en advarsel, ikke en nøytral tilstand", () => {
    // En halvferdig utrulling ser ut som at alt virker. Det er nettopp
    // derfor ingen oppdager den.
    const v = rolloutView(
      rollout({ keyRolesScoped: 4, keyRolesSharingFallback: ["archive", "admin"] }),
    );
    expect(v.severity).toBe("partial");
    expect(v.outstanding[0]).toContain("archive");
  });

  it("skiller ukonfigurert fra ufullstendig", () => {
    // «Ikke satt opp» og «halvveis satt opp» krever helt ulike svar.
    const v = rolloutView(rollout({ configured: false }));
    expect(v.severity).toBe("not_configured");
    expect(v.headline).toContain("ikke konfigurert");
  });

  it("lister både nøkler og bøtter når begge henger etter", () => {
    const v = rolloutView(
      rollout({
        keyRolesSharingFallback: ["admin"],
        bucketClassesSharingFallback: ["proxies", "working"],
      }),
    );
    expect(v.outstanding).toHaveLength(2);
    expect(v.outstanding[1]).toContain("proxies");
  });

  it("nevner ikke nøkler når bare bøttene mangler", () => {
    const v = rolloutView(rollout({ bucketClassesSharingFallback: ["archive"] }));
    expect(v.outstanding).toHaveLength(1);
    expect(v.outstanding[0]).toContain("bøtta");
  });
});

describe("formatBytes", () => {
  it("bruker TB for de store tallene", () => {
    expect(formatBytes(2.5 * 1024 * GIB)).toBe("2.5 TB");
  });

  it("dropper desimalen når tallet er stort nok", () => {
    expect(formatBytes(50 * GIB)).toBe("50 GB");
  });

  it("beholder desimalen under 10 GB", () => {
    expect(formatBytes(2.4 * GIB)).toBe("2.4 GB");
  });

  it("viser små tall som MB i stedet for 0.0 GB", () => {
    expect(formatBytes(300 * 1024 * 1024)).toBe("300 MB");
  });

  it("viser aldri en reell størrelse som 0", () => {
    // 0 ville sett ut som ingen data. Under en MB er «1 MB» nærmere sant.
    expect(formatBytes(1024)).toBe("1 MB");
  });

  it("takler null og tull", () => {
    expect(formatBytes(0)).toBe("0 GB");
    expect(formatBytes(-5)).toBe("0 GB");
    expect(formatBytes(NaN)).toBe("0 GB");
  });
});

describe("formatNok", () => {
  it("runder av til hele kroner", () => {
    expect(formatNok(1234.56)).toContain("1");
    expect(formatNok(1234.56)).toContain("kr");
  });

  it("viser aldri en reell kostnad som 0 kr", () => {
    // «0 kr» ville sett ut som gratis.
    expect(formatNok(0.4)).toBe("<1 kr");
  });

  it("viser 0 for faktisk null", () => {
    expect(formatNok(0)).toBe("0 kr");
  });

  it("takler NaN uten å vise NaN", () => {
    expect(formatNok(NaN)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("skiller udefinert fra null prosent", () => {
    // «0 %» ville sett ut som et svar. «—» sier at spørsmålet ikke gir
    // mening ennå.
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0)).toBe("0 %");
  });

  it("runder til hele prosent", () => {
    expect(formatPercent(0.804)).toBe("80 %");
  });
});

describe("productionRows", () => {
  const prod = (over: Partial<Parameters<typeof productionRows>[0][0]> = {}) => ({
    projectId: "prj-1",
    projectName: "Nordlys",
    usedBytes: 100 * GIB,
    monthlyCostNok: 6,
    shareOfTotal: 0.5,
    fileCount: 12,
    streamBytes: 0,
    ...over,
  });

  it("merker produksjoner der Stream dominerer", () => {
    // Stream prises per minutt, ikke per GB. En slik produksjon er dyr på
    // en måte størrelsen ikke røper.
    const [row] = productionRows([
      prod({ usedBytes: 100 * GIB, streamBytes: 80 * GIB }),
    ]);
    expect(row.streamHeavy).toBe(true);
  });

  it("merker ikke en produksjon uten Stream", () => {
    const [row] = productionRows([prod()]);
    expect(row.streamHeavy).toBe(false);
  });

  it("bruker terskelen som er dokumentert", () => {
    const justUnder = productionRows([
      prod({ usedBytes: 100 * GIB, streamBytes: (STREAM_HEAVY_FRACTION - 0.01) * 100 * GIB }),
    ]);
    expect(justUnder[0].streamHeavy).toBe(false);
  });

  it("gir en tom produksjon en identifiserbar rad", () => {
    // Et slettet prosjekt har fortsatt bytes i regnskapet. En tom rad
    // ville vært umulig å følge opp.
    const [row] = productionRows([prod({ projectName: null })]);
    expect(row.name).toContain("prj-1");
  });

  it("deler ikke på null", () => {
    const [row] = productionRows([prod({ usedBytes: 0, streamBytes: 0 })]);
    expect(row.streamHeavy).toBe(false);
  });
});

describe("egressRows", () => {
  const row = (over: Partial<Parameters<typeof egressRows>[0][0]> = {}) => ({
    userId: "u1",
    email: "produsent@example.com",
    storedBytes: 10 * GIB,
    egressBytes: 5 * GIB,
    freeAllowanceBytes: 30 * GIB,
    overageBytes: 0,
    usedFraction: 0.166,
    egressCostNok: 0,
    approachingLimit: false,
    ...over,
  });

  it("skiller over grensen fra nær grensen", () => {
    const [ok] = egressRows([row()]);
    const [warn] = egressRows([row({ approachingLimit: true, usedFraction: 0.85 })]);
    const [over] = egressRows([row({ overageBytes: 5 * GIB, approachingLimit: true })]);
    expect(ok.severity).toBe("ok");
    expect(warn.severity).toBe("warn");
    expect(over.severity).toBe("over");
  });

  it("viser uendelig kvote som ∞, ikke som et tall", () => {
    // R2 har fri egress. Et tall ville sett ut som en grense man kan nå.
    const [r] = egressRows([row({ freeAllowanceBytes: Infinity })]);
    expect(r.allowance).toBe("∞");
  });

  it("faller tilbake til bruker-id når e-post mangler", () => {
    const [r] = egressRows([row({ email: null })]);
    expect(r.who).toBe("u1");
  });

  it("viser strek i stedet for 0 når det ikke er overforbruk", () => {
    expect(egressRows([row()])[0].overage).toBe("—");
  });
});

describe("keyRoleRows", () => {
  const role = (over: Partial<Parameters<typeof keyRoleRows>[0][0]> = {}) => ({
    role: "capture-read",
    purpose: "Signerer nedlastings-URL-er.",
    requiredCapabilities: ["listFiles", "readFiles", "shareFiles"],
    envVars: {
      id: "B2_KEY_CAPTURE_READ_ID",
      secret: "B2_KEY_CAPTURE_READ_SECRET",
    },
    configured: true,
    usingSharedFallback: false,
    keyIdSuffix: "1234",
    ...over,
  });

  it("skiller egen nøkkel fra delt fra manglende", () => {
    expect(keyRoleRows([role()])[0].status).toBe("scoped");
    expect(keyRoleRows([role({ usingSharedFallback: true })])[0].status).toBe("shared");
    expect(keyRoleRows([role({ configured: false })])[0].status).toBe("missing");
  });

  it("sier hva som må settes når noe mangler", () => {
    const [r] = keyRoleRows([role({ usingSharedFallback: true })]);
    expect(r.action).toContain("B2_KEY_CAPTURE_READ_ID");
  });

  it("gir ingen handling når rollen er i orden", () => {
    expect(keyRoleRows([role()])[0].action).toBeNull();
  });

  it("viser aldri hele nøkkel-id-en", () => {
    // Et skjermbilde havner fort i en chat.
    const [r] = keyRoleRows([role({ keyIdSuffix: "1234" })]);
    expect(r.keyHint).toBe("…1234");
  });

  it("viser strek når ingen nøkkel er løst opp", () => {
    expect(keyRoleRows([role({ configured: false, keyIdSuffix: null })])[0].keyHint)
      .toBe("—");
  });
});

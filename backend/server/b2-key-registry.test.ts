import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  B2KeyMissingError,
  B2_ROLE_SPECS,
  describeKeyRoles,
  logKeyRoleStatus,
  resolveB2Key,
  type B2KeyRole,
} from "./b2-key-registry.js";

const ROLES = Object.keys(B2_ROLE_SPECS) as B2KeyRole[];

const ENV_KEYS = [
  "B2_REQUIRE_SCOPED_KEYS",
  "B2_ROLE_ROOM_APPLICATION_KEY_ID",
  "B2_ROLE_ROOM_APPLICATION_KEY",
  "B2_APPLICATION_KEY_ID",
  "B2_APPLICATION_KEY",
  ...ROLES.flatMap((r) => [
    `B2_KEY_${B2_ROLE_SPECS[r].envSuffix}_ID`,
    `B2_KEY_${B2_ROLE_SPECS[r].envSuffix}_SECRET`,
  ]),
];

let saved: Record<string, string | undefined> = {};

const setShared = () => {
  process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "felles-id-9999";
  process.env.B2_ROLE_ROOM_APPLICATION_KEY = "felles-hemmelighet";
};

const setScoped = (role: B2KeyRole, id: string, secret = "hemmelig") => {
  process.env[`B2_KEY_${B2_ROLE_SPECS[role].envSuffix}_ID`] = id;
  process.env[`B2_KEY_${B2_ROLE_SPECS[role].envSuffix}_SECRET`] = secret;
};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe("rollespesifikasjonene", () => {
  it("gir ikke opplastingsnøkkelen slettetilgang", () => {
    // En opplastingsnøkkel som kan slette er en opplastingsnøkkel som kan
    // slette en hel innspilling.
    expect(B2_ROLE_SPECS["capture-write"].requiredCapabilities).not.toContain(
      "deleteFiles",
    );
  });

  it("gir ikke lesenøkkelen skrive- eller slettetilgang", () => {
    const caps = B2_ROLE_SPECS["capture-read"].requiredCapabilities;
    expect(caps).not.toContain("writeFiles");
    expect(caps).not.toContain("deleteFiles");
  });

  it("lar bare sletterollen slette blant capture-rollene", () => {
    const deleters = (["capture-read", "capture-write", "capture-delete"] as B2KeyRole[])
      .filter((r) => B2_ROLE_SPECS[r].requiredCapabilities.includes("deleteFiles"));
    expect(deleters).toEqual(["capture-delete"]);
  });

  it("gir hver lese-rolle shareFiles, ellers kan den ikke signere URL-er", () => {
    for (const role of ["capture-read", "uploads-read"] as B2KeyRole[]) {
      expect(B2_ROLE_SPECS[role].requiredCapabilities).toContain("shareFiles");
    }
  });

  it("gir hver rolle et unikt env-ledd", () => {
    const suffixes = ROLES.map((r) => B2_ROLE_SPECS[r].envSuffix);
    expect(new Set(suffixes).size).toBe(suffixes.length);
  });
});

describe("resolveB2Key", () => {
  it("bruker rollens egen nøkkel når den finnes", () => {
    setShared();
    setScoped("capture-read", "lese-id-1111");
    const k = resolveB2Key("capture-read");
    expect(k?.keyId).toBe("lese-id-1111");
    expect(k?.usingSharedFallback).toBe(false);
  });

  it("faller tilbake til fellesnøkkelen og sier fra om det", () => {
    setShared();
    const k = resolveB2Key("capture-delete");
    expect(k?.keyId).toBe("felles-id-9999");
    expect(k?.usingSharedFallback).toBe(true);
  });

  it("holder rollene fra hverandre", () => {
    setShared();
    setScoped("capture-read", "lese-id");
    setScoped("capture-write", "skrive-id");
    expect(resolveB2Key("capture-read")?.keyId).toBe("lese-id");
    expect(resolveB2Key("capture-write")?.keyId).toBe("skrive-id");
    // Sletting har ingen egen ennå — den skal ikke arve en av de andre.
    expect(resolveB2Key("capture-delete")?.keyId).toBe("felles-id-9999");
  });

  it("gir null når B2 ikke er konfigurert i det hele tatt", () => {
    // Ikke en feil — B2 er bare ikke satt opp, og kalleren faller tilbake
    // på R2 eller filesystem.
    expect(resolveB2Key("capture-read")).toBeNull();
  });

  it("bruker fellesnøkkelen når bare halve rollenøkkelen er satt", () => {
    // Halv konfig ser ut som en avgrenset nøkkel og oppfører seg som
    // fellesnøkkelen. Den skal ikke stille bli tolket som avgrenset.
    setShared();
    process.env.B2_KEY_CAPTURE_READ_ID = "bare-id";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const k = resolveB2Key("capture-read");
    expect(k?.usingSharedFallback).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("velger ikke bøtte — det gjør b2-bucket-registry", () => {
    // To steder som velger bøtte ville før eller siden vært uenige.
    setShared();
    setScoped("archive", "arkiv-id");
    expect(resolveB2Key("archive")).not.toHaveProperty("bucket");
  });
});

describe("B2_REQUIRE_SCOPED_KEYS", () => {
  it("gjør fallback til en feil i stedet for en stille nedgradering", () => {
    setShared();
    process.env.B2_REQUIRE_SCOPED_KEYS = "true";
    expect(() => resolveB2Key("capture-delete")).toThrow(B2KeyMissingError);
  });

  it("navngir env-variablene som mangler", () => {
    // Feilmeldingen skal kunne handles på uten å slå opp i koden.
    setShared();
    process.env.B2_REQUIRE_SCOPED_KEYS = "true";
    try {
      resolveB2Key("capture-delete");
      expect.unreachable("skulle kastet");
    } catch (err) {
      expect(String(err)).toContain("B2_KEY_CAPTURE_DELETE_ID");
    }
  });

  it("slipper gjennom rollene som HAR egen nøkkel", () => {
    setShared();
    setScoped("capture-read", "lese-id");
    process.env.B2_REQUIRE_SCOPED_KEYS = "true";
    expect(resolveB2Key("capture-read")?.keyId).toBe("lese-id");
  });

  it("krasjer ikke diagnosen — den skal vise tilstanden, ikke feile på den", () => {
    setShared();
    process.env.B2_REQUIRE_SCOPED_KEYS = "true";
    const rows = describeKeyRoles();
    expect(rows.find((r) => r.role === "capture-delete")?.configured).toBe(false);
  });
});

describe("describeKeyRoles", () => {
  it("viser hvilke roller som fortsatt deler fellesnøkkelen", () => {
    setShared();
    setScoped("capture-read", "lese-id");
    const rows = describeKeyRoles();
    expect(rows.find((r) => r.role === "capture-read")?.usingSharedFallback).toBe(false);
    expect(rows.find((r) => r.role === "archive")?.usingSharedFallback).toBe(true);
  });

  it("lekker aldri hemmeligheten eller hele nøkkel-id-en", () => {
    // Diagnosen er ment å kunne stå i en logg, og en nøkkel-id i en logg
    // er halve lekkasjen.
    setShared();
    setScoped("capture-read", "lese-id-1111", "svaert-hemmelig");
    const dump = JSON.stringify(describeKeyRoles());
    expect(dump).not.toContain("svaert-hemmelig");
    expect(dump).not.toContain("lese-id-1111");
    expect(dump).toContain("1111");
  });

  it("oppgir env-variablene som må settes for hver rolle", () => {
    const row = describeKeyRoles().find((r) => r.role === "capture-delete")!;
    expect(row.envVars.id).toBe("B2_KEY_CAPTURE_DELETE_ID");
    expect(row.envVars.secret).toBe("B2_KEY_CAPTURE_DELETE_SECRET");
  });

  it("dekker alle rollene", () => {
    expect(describeKeyRoles().map((r) => r.role).sort()).toEqual([...ROLES].sort());
  });
});

describe("logKeyRoleStatus", () => {
  it("advarer når roller fortsatt deler fellesnøkkelen", () => {
    // Uten dette er en halvferdig utrulling usynlig: alt virker, og ingen
    // oppdager at seks av sju tjenester har full slettetilgang.
    setShared();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logKeyRoleStatus();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("deler fortsatt"));
  });

  it("advarer ikke når alle roller har egen nøkkel", () => {
    for (const role of ROLES) setScoped(role, `${role}-id`);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logKeyRoleStatus();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("egen nøkkel"));
  });

  it("sier fra når B2 ikke er konfigurert, uten å advare", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logKeyRoleStatus();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ikke konfigurert"));
  });
});

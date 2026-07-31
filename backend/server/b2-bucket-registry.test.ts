import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STORAGE_CLASSES,
  bucketForClass,
  bucketForKey,
  classForKeySegment,
  describeBuckets,
  keyMarkerFor,
  logBucketStatus,
  sharedBucket,
  type StorageClass,
} from "./b2-bucket-registry.js";

const CLASSES = Object.keys(STORAGE_CLASSES) as StorageClass[];

const ENV_KEYS = [
  "B2_ROLE_ROOM_BUCKET_NAME",
  "B2_BUCKET_NAME",
  ...CLASSES.map((c) => `B2_BUCKET_${STORAGE_CLASSES[c].envSuffix}`),
];

let saved: Record<string, string | undefined> = {};

const setShared = () => {
  process.env.B2_ROLE_ROOM_BUCKET_NAME = "the-role-room-prod";
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

describe("klassespesifikasjonene", () => {
  it("gir hver klasse et unikt nøkkelledd", () => {
    const markers = CLASSES.map((c) => STORAGE_CLASSES[c].keyMarker);
    expect(new Set(markers).size).toBe(markers.length);
  });

  it("lar ingen klasses ledd være et prefiks av et annet", () => {
    // Ellers ville _archive/ og _archived/ truffet hverandre, og filer
    // havnet i feil bøtte avhengig av rekkefølgen vi sjekker i.
    for (const a of CLASSES) {
      for (const b of CLASSES) {
        if (a === b) continue;
        expect(STORAGE_CLASSES[a].keyMarker.startsWith(STORAGE_CLASSES[b].keyMarker))
          .toBe(false);
      }
    }
  });

  it("starter hvert ledd med understrek", () => {
    // Understreken er det som skiller klasseleddet fra en bruker-id.
    // Uten den kunne en bruker med id-en «originals» fått filene sine
    // rutet til feil bøtte.
    for (const c of CLASSES) {
      expect(STORAGE_CLASSES[c].keyMarker).toMatch(/^_/);
      expect(STORAGE_CLASSES[c].keyMarker).toMatch(/\/$/);
    }
  });

  it("merker masterne og leveransene som uforanderlige", () => {
    expect(STORAGE_CLASSES.originals.immutable).toBe(true);
    expect(STORAGE_CLASSES.deliverables.immutable).toBe(true);
    // Proxyer kan gjenskapes, så de skal kunne ryddes fritt.
    expect(STORAGE_CLASSES.proxies.immutable).toBe(false);
  });
});

describe("bucketForClass", () => {
  it("bruker klassens egen bøtte når den er satt", () => {
    setShared();
    process.env.B2_BUCKET_ORIGINALS = "trr-prod-originals";
    const r = bucketForClass("originals");
    expect(r?.bucket).toBe("trr-prod-originals");
    expect(r?.usingSharedFallback).toBe(false);
  });

  it("faller tilbake til fellesbøtta og sier fra om det", () => {
    setShared();
    const r = bucketForClass("proxies");
    expect(r?.bucket).toBe("the-role-room-prod");
    expect(r?.usingSharedFallback).toBe(true);
  });

  it("gir null når B2 ikke er konfigurert", () => {
    expect(bucketForClass("originals")).toBeNull();
  });

  it("holder klassene fra hverandre", () => {
    setShared();
    process.env.B2_BUCKET_ORIGINALS = "trr-prod-originals";
    process.env.B2_BUCKET_PROXIES = "trr-prod-proxies";
    expect(bucketForClass("originals")?.bucket).toBe("trr-prod-originals");
    expect(bucketForClass("proxies")?.bucket).toBe("trr-prod-proxies");
    // Working har ingen egen ennå — den skal ikke arve en av de andre.
    expect(bucketForClass("working")?.bucket).toBe("the-role-room-prod");
  });
});

describe("classForKeySegment", () => {
  it("kjenner igjen klasseleddet", () => {
    expect(classForKeySegment("_originals/u1/s1/a1/full/v1/A001.mov")).toBe("originals");
    expect(classForKeySegment("_proxies/u1/s1/a1/preview/v1/x.jpg")).toBe("proxies");
  });

  it("gir null for nøkler skrevet før splitten", () => {
    // Ikke en feil — bare en nøkkel som hører hjemme i fellesbøtta.
    expect(classForKeySegment("u1/s1/a1/full/v1/A001.mov")).toBeNull();
  });

  it("forveksler ikke en bruker-id med et klassenavn", () => {
    // Dette er hele grunnen til understreken. En bruker som heter
    // «originals» skal ikke få filene sine rutet til master-bøtta.
    expect(classForKeySegment("originals/s1/a1/full/v1/A001.mov")).toBeNull();
  });
});

describe("bucketForKey", () => {
  it("sender en klassemerket nøkkel til klassens bøtte", () => {
    setShared();
    process.env.B2_BUCKET_ORIGINALS = "trr-prod-originals";
    expect(bucketForKey("_originals/u1/s1/a1/full/v1/A001.mov")?.bucket)
      .toBe("trr-prod-originals");
  });

  it("sender en umerket nøkkel til fellesbøtta", () => {
    // Det er dette som gjør splitten trygg uten å kopiere noe: gamle
    // filer blir liggende, og leses fra der de faktisk er.
    setShared();
    process.env.B2_BUCKET_ORIGINALS = "trr-prod-originals";
    const r = bucketForKey("u1/s1/a1/full/A001.mov");
    expect(r?.bucket).toBe("the-role-room-prod");
    expect(r?.storageClass).toBeNull();
  });

  it("gir fellesbøtta når klassen ikke har fått sin egen ennå", () => {
    setShared();
    expect(bucketForKey("_working/dance-video/x.mp4")?.bucket)
      .toBe("the-role-room-prod");
  });

  it("gir null når B2 ikke er konfigurert", () => {
    expect(bucketForKey("_originals/u1/x.mov")).toBeNull();
  });
});

describe("nøkkelen skrives og leses i samme bøtte", () => {
  it("finner igjen hver klasse fra leddet den skrives under", () => {
    setShared();
    for (const cls of CLASSES) {
      process.env[`B2_BUCKET_${STORAGE_CLASSES[cls].envSuffix}`] = `bucket-${cls}`;
    }
    for (const cls of CLASSES) {
      const key = `${keyMarkerFor(cls)}u1/fil.bin`;
      expect(bucketForKey(key)?.bucket).toBe(bucketForClass(cls)?.bucket);
      expect(bucketForKey(key)?.storageClass).toBe(cls);
    }
  });
});

describe("sharedBucket", () => {
  it("følger fallback-kjeden", () => {
    process.env.B2_BUCKET_NAME = "plattform";
    expect(sharedBucket()).toBe("plattform");
    process.env.B2_ROLE_ROOM_BUCKET_NAME = "role-room";
    expect(sharedBucket()).toBe("role-room");
  });
});

describe("describeBuckets", () => {
  it("viser hvilke klasser som fortsatt deler fellesbøtta", () => {
    setShared();
    process.env.B2_BUCKET_ORIGINALS = "trr-prod-originals";
    const rows = describeBuckets();
    expect(rows.find((r) => r.storageClass === "originals")?.usingSharedFallback)
      .toBe(false);
    expect(rows.find((r) => r.storageClass === "proxies")?.usingSharedFallback)
      .toBe(true);
  });

  it("oppgir env-variabelen og et forslag til bøttenavn", () => {
    const row = describeBuckets().find((r) => r.storageClass === "deliverables")!;
    expect(row.envVar).toBe("B2_BUCKET_DELIVERABLES");
    expect(row.suggestedBucket).toBe("trr-prod-deliverables");
  });

  it("dekker alle klassene", () => {
    expect(describeBuckets().map((r) => r.storageClass).sort())
      .toEqual([...CLASSES].sort());
  });
});

describe("logBucketStatus", () => {
  it("advarer når klasser fortsatt deler fellesbøtta", () => {
    setShared();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logBucketStatus();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("deler"));
  });

  it("advarer ikke når alle klasser har egen bøtte", () => {
    for (const cls of CLASSES) {
      process.env[`B2_BUCKET_${STORAGE_CLASSES[cls].envSuffix}`] = `bucket-${cls}`;
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logBucketStatus();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("egen bøtte"));
  });

  it("sier fra når B2 ikke er konfigurert, uten å advare", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logBucketStatus();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ikke konfigurert"));
  });
});

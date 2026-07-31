import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getObjectStoreClientFor,
  getStorageStatus,
  isObjectStoreBackend,
  objectStoreWriteOrder,
} from "./upload-storage-router.js";

// Alle env-navnene routeren kan lese, så hver test starter fra tomt bord.
const ENV_KEYS = [
  "UPLOAD_STORAGE_PRIMARY",
  "GENERIC_UPLOADS_B2_BUCKET",
  "GENERIC_UPLOADS_B2_APPLICATION_KEY_ID",
  "GENERIC_UPLOADS_B2_APPLICATION_KEY",
  "GENERIC_UPLOADS_B2_ENDPOINT",
  "GENERIC_UPLOADS_B2_REGION",
  "GENERIC_UPLOADS_B2_PREFIX",
  "B2_ROLE_ROOM_BUCKET_NAME",
  "B2_ROLE_ROOM_APPLICATION_KEY_ID",
  "B2_ROLE_ROOM_APPLICATION_KEY",
  "B2_BUCKET_NAME",
  "B2_APPLICATION_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_ENDPOINT",
  "B2_REGION",
  "GENERIC_UPLOADS_R2_BUCKET",
  "GENERIC_UPLOADS_R2_ACCESS_KEY_ID",
  "GENERIC_UPLOADS_R2_SECRET_ACCESS_KEY",
  "GENERIC_UPLOADS_R2_ENDPOINT",
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
] as const;

let saved: Record<string, string | undefined> = {};

const setB2 = () => {
  process.env.B2_ROLE_ROOM_BUCKET_NAME = "the-role-room-prod";
  process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "b2-key-id";
  process.env.B2_ROLE_ROOM_APPLICATION_KEY = "b2-secret";
};

const setR2 = () => {
  process.env.GENERIC_UPLOADS_R2_BUCKET = "creatorhub-uploads";
  process.env.GENERIC_UPLOADS_R2_ACCESS_KEY_ID = "r2-key-id";
  process.env.GENERIC_UPLOADS_R2_SECRET_ACCESS_KEY = "r2-secret";
  process.env.GENERIC_UPLOADS_R2_ENDPOINT = "https://acct.r2.cloudflarestorage.com";
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
});

describe("isObjectStoreBackend", () => {
  it("skiller objektlager fra Stream og filesystem", () => {
    expect(isObjectStoreBackend("b2")).toBe(true);
    expect(isObjectStoreBackend("r2")).toBe(true);
    expect(isObjectStoreBackend("cloudflare_stream")).toBe(false);
    expect(isObjectStoreBackend("filesystem")).toBe(false);
    expect(isObjectStoreBackend(undefined)).toBe(false);
    expect(isObjectStoreBackend(null)).toBe(false);
  });
});

describe("objectStoreWriteOrder", () => {
  it("skriver til B2 først når begge er konfigurert", () => {
    setB2();
    setR2();
    expect(objectStoreWriteOrder().map((c) => c.backend)).toEqual(["b2", "r2"]);
  });

  it("faller til R2 når B2 mangler creds", () => {
    setR2();
    expect(objectStoreWriteOrder().map((c) => c.backend)).toEqual(["r2"]);
  });

  it("bruker B2 alene når R2 ikke er satt opp", () => {
    setB2();
    expect(objectStoreWriteOrder().map((c) => c.backend)).toEqual(["b2"]);
  });

  it("gir tom liste uten konfig — kalleren må da bruke filesystem", () => {
    expect(objectStoreWriteOrder()).toEqual([]);
  });

  it("lar UPLOAD_STORAGE_PRIMARY=r2 snu rekkefølgen uten kodeendring", () => {
    setB2();
    setR2();
    process.env.UPLOAD_STORAGE_PRIMARY = "r2";
    expect(objectStoreWriteOrder().map((c) => c.backend)).toEqual(["r2", "b2"]);
  });

  it("ignorerer en ukjent UPLOAD_STORAGE_PRIMARY og beholder B2 som primær", () => {
    setB2();
    setR2();
    process.env.UPLOAD_STORAGE_PRIMARY = "glacier";
    expect(objectStoreWriteOrder().map((c) => c.backend)).toEqual(["b2", "r2"]);
  });

  it("krever full cred-trio — halv konfig teller ikke som oppe", () => {
    // Ellers ville hver upload gå i en put som feiler med 403.
    process.env.B2_ROLE_ROOM_BUCKET_NAME = "the-role-room-prod";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "b2-key-id";
    expect(objectStoreWriteOrder()).toEqual([]);
  });
});

describe("B2-konfig", () => {
  it("utleder endpoint fra region når B2_ENDPOINT ikke er satt", () => {
    setB2();
    const [cfg] = objectStoreWriteOrder();
    // eu-central-003 er der the-role-room-prod faktisk ligger; feil default
    // her gir stille skrivefeil (samme fallgruve som b2-archive-helper).
    expect(cfg.endpoint).toBe("https://s3.eu-central-003.backblazeb2.com");
    expect(cfg.region).toBe("eu-central-003");
  });

  it("følger B2_REGION når den er satt", () => {
    setB2();
    process.env.B2_REGION = "us-west-004";
    const [cfg] = objectStoreWriteOrder();
    expect(cfg.endpoint).toBe("https://s3.us-west-004.backblazeb2.com");
  });

  it("bruker path-style for B2 og virtual-host for R2", () => {
    setB2();
    setR2();
    const [b2, r2] = objectStoreWriteOrder();
    expect(b2.forcePathStyle).toBe(true);
    expect(r2.forcePathStyle).toBe(false);
  });

  it("faller ned til plattformens B2-nøkler når GENERIC_UPLOADS_B2_* mangler", () => {
    process.env.B2_BUCKET_NAME = "creatorhub-platform";
    process.env.B2_APPLICATION_KEY_ID = "plattform-id";
    process.env.B2_APPLICATION_KEY = "plattform-secret";
    const [cfg] = objectStoreWriteOrder();
    expect(cfg.backend).toBe("b2");
    expect(cfg.bucket).toBe("creatorhub-platform");
  });
});

describe("getObjectStoreClientFor", () => {
  it("leser fra backend'en fila faktisk ligger på, ikke dagens primær", () => {
    // Det er hele poenget: filer skrevet til R2 før flyttingen må fortsatt
    // hentes fra R2 selv om nye uploads går til B2.
    setB2();
    setR2();
    expect(getObjectStoreClientFor("r2")?.bucket).toBe("creatorhub-uploads");
    expect(getObjectStoreClientFor("b2")?.bucket).toBe("the-role-room-prod");
  });

  it("gir null for backends som ikke er objektlager", () => {
    setB2();
    expect(getObjectStoreClientFor("cloudflare_stream")).toBeNull();
    expect(getObjectStoreClientFor("filesystem")).toBeNull();
    expect(getObjectStoreClientFor(undefined)).toBeNull();
  });

  it("gir null når backend'en er kjent men ikke konfigurert", () => {
    setB2();
    expect(getObjectStoreClientFor("r2")).toBeNull();
  });
});

describe("getStorageStatus", () => {
  it("rapporterer hvilket objektlager som faktisk er primært", () => {
    setB2();
    setR2();
    const status = getStorageStatus();
    expect(status.primaryObjectStore).toBe("b2");
    expect(status.b2).toEqual({ enabled: true, bucket: "the-role-room-prod" });
    expect(status.r2).toEqual({ enabled: true, bucket: "creatorhub-uploads" });
  });

  it("rapporterer null som primær når ingen objektlager er koblet til", () => {
    const status = getStorageStatus();
    expect(status.primaryObjectStore).toBeNull();
    expect(status.b2.enabled).toBe(false);
    expect(status.r2.enabled).toBe(false);
  });
});

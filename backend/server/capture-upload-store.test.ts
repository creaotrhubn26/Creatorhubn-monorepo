import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildCaptureB2Config,
  buildCaptureR2Config,
  captureStoreForKey,
  captureWriteStore,
} from "./capture-upload-service.js";

const ENV_KEYS = [
  "CAPTURE_STORAGE_PRIMARY",
  "CAPTURE_B2_BUCKET",
  "CAPTURE_B2_APPLICATION_KEY_ID",
  "CAPTURE_B2_APPLICATION_KEY",
  "CAPTURE_B2_ENDPOINT",
  "CAPTURE_B2_REGION",
  "CAPTURE_B2_PREFIX",
  "B2_ROLE_ROOM_BUCKET_NAME",
  "B2_ROLE_ROOM_APPLICATION_KEY_ID",
  "B2_ROLE_ROOM_APPLICATION_KEY",
  "B2_BUCKET_NAME",
  "B2_APPLICATION_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_ENDPOINT",
  "B2_REGION",
  "CAPTURE_R2_BUCKET",
  "CAPTURE_R2_ACCESS_KEY_ID",
  "CAPTURE_R2_SECRET_ACCESS_KEY",
  "CAPTURE_R2_ENDPOINT",
  "CAPTURE_R2_PREFIX",
  "CLOUDFLARE_R2_UPLOAD_BUCKET",
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
  process.env.CAPTURE_B2_BUCKET = "the-role-room-prod";
  process.env.CAPTURE_B2_APPLICATION_KEY_ID = "b2-key-id";
  process.env.CAPTURE_B2_APPLICATION_KEY = "b2-secret";
};

const setR2 = () => {
  process.env.CAPTURE_R2_BUCKET = "creatorhub-capture";
  process.env.CAPTURE_R2_ACCESS_KEY_ID = "r2-key-id";
  process.env.CAPTURE_R2_SECRET_ACCESS_KEY = "r2-secret";
  process.env.CAPTURE_R2_ENDPOINT = "https://acct.r2.cloudflarestorage.com";
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

describe("captureWriteStore", () => {
  it("skriver til B2 når B2 er konfigurert", () => {
    setB2();
    setR2();
    expect(captureWriteStore().backend).toBe("b2");
  });

  it("blir stående på R2 når B2 ikke er satt opp", () => {
    setR2();
    expect(captureWriteStore().backend).toBe("r2");
  });

  it("lar CAPTURE_STORAGE_PRIMARY=r2 slå av B2 uten kodeendring", () => {
    setB2();
    setR2();
    process.env.CAPTURE_STORAGE_PRIMARY = "r2";
    expect(captureWriteStore().backend).toBe("r2");
  });

  it("krever hele cred-trioen før B2 regnes som oppe", () => {
    setR2();
    process.env.CAPTURE_B2_BUCKET = "the-role-room-prod";
    process.env.CAPTURE_B2_APPLICATION_KEY_ID = "b2-key-id";
    expect(captureWriteStore().backend).toBe("r2");
  });
});

describe("captureStoreForKey", () => {
  it("sender gamle capture/-nøkler til R2 selv når B2 er primær", () => {
    // Dette er hele poenget med atskilte nøkkelrom: en fil lastet opp før
    // flyttingen må fortsatt kunne hentes, uten at noe er kopiert.
    setB2();
    setR2();
    const cfg = captureStoreForKey("capture/user-1/sess-1/asset-1/full/DSC.jpg");
    expect(cfg.backend).toBe("r2");
    expect(cfg.bucket).toBe("creatorhub-capture");
  });

  it("sender nye capture-b2/-nøkler til B2", () => {
    setB2();
    setR2();
    const cfg = captureStoreForKey(
      "capture-b2/user-1/sess-1/asset-1/full/DSC.jpg",
    );
    expect(cfg.backend).toBe("b2");
    expect(cfg.bucket).toBe("the-role-room-prod");
  });

  it("ruter til R2 når B2 er slått av, selv for en B2-prefikset nøkkel", () => {
    // Uten creds finnes det ingen B2-klient å hente fra — da er R2 det
    // eneste ærlige svaret, og kalleren får null i stedet for en URL som
    // peker et sted vi ikke kan lese.
    setR2();
    const cfg = captureStoreForKey("capture-b2/user-1/sess-1/a/full/DSC.jpg");
    expect(cfg.backend).toBe("r2");
  });

  it("nye nøkler skrives i det lageret de senere leses fra", () => {
    setB2();
    setR2();
    const write = captureWriteStore();
    const key = `${write.prefix}user-1/sess-1/asset-1/full/DSC.jpg`;
    expect(captureStoreForKey(key).backend).toBe(write.backend);
  });

  it("holder prefiksene atskilt så ingen nøkkel treffer begge lagre", () => {
    setB2();
    setR2();
    const b2 = buildCaptureB2Config();
    const r2 = buildCaptureR2Config();
    expect(b2.prefix).not.toBe(r2.prefix);
    expect(b2.prefix.startsWith(r2.prefix)).toBe(false);
    expect(r2.prefix.startsWith(b2.prefix)).toBe(false);
  });
});

describe("B2-konfig for capture", () => {
  it("utleder endpoint fra regionen bøtta faktisk ligger i", () => {
    setB2();
    expect(buildCaptureB2Config().endpoint).toBe(
      "https://s3.eu-central-003.backblazeb2.com",
    );
  });

  it("bruker path-style mot B2 og virtual-host mot R2", () => {
    setB2();
    setR2();
    expect(buildCaptureB2Config().forcePathStyle).toBe(true);
    expect(buildCaptureR2Config().forcePathStyle).toBe(false);
  });

  it("faller ned på plattformens B2-nøkler når CAPTURE_B2_* mangler", () => {
    process.env.B2_ROLE_ROOM_BUCKET_NAME = "the-role-room-prod";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "id";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY = "secret";
    expect(buildCaptureB2Config().enabled).toBe(true);
    expect(captureWriteStore().backend).toBe("b2");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  B2_DEFAULT_REGION,
  b2ClientFor,
  b2Endpoint,
  b2Region,
  b2StoreFor,
} from "./b2-client-factory.js";

const ENV_KEYS = [
  "B2_REGION",
  "B2_ENDPOINT",
  "B2_ROLE_ROOM_APPLICATION_KEY_ID",
  "B2_ROLE_ROOM_APPLICATION_KEY",
  "B2_APPLICATION_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_KEY_ADMIN_ID",
  "B2_KEY_ADMIN_SECRET",
  "B2_KEY_ARCHIVE_ID",
  "B2_KEY_ARCHIVE_SECRET",
];

let saved: Record<string, string | undefined> = {};

const setShared = () => {
  process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "felles-id";
  process.env.B2_ROLE_ROOM_APPLICATION_KEY = "felles-hemmelighet";
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

describe("region og endepunkt", () => {
  it("defaulter til regionen bøtta faktisk ligger i", () => {
    // Feil region gir ikke en exception — den gir stille skrivefeil.
    expect(b2Region()).toBe(B2_DEFAULT_REGION);
    expect(b2Endpoint()).toBe(`https://s3.${B2_DEFAULT_REGION}.backblazeb2.com`);
  });

  it("utleder endepunktet fra regionen", () => {
    process.env.B2_REGION = "us-west-001";
    expect(b2Endpoint()).toBe("https://s3.us-west-001.backblazeb2.com");
  });

  it("lar et eksplisitt endepunkt vinne over regionen", () => {
    process.env.B2_REGION = "us-west-001";
    process.env.B2_ENDPOINT = "https://custom.example.com";
    expect(b2Endpoint()).toBe("https://custom.example.com");
  });

  it("behandler tom streng som ikke satt", () => {
    process.env.B2_REGION = "   ";
    expect(b2Region()).toBe(B2_DEFAULT_REGION);
  });
});

describe("b2ClientFor", () => {
  it("gir null når B2 ikke er konfigurert", () => {
    expect(b2ClientFor("admin")).toBeNull();
  });

  it("gir en klient når fellesnøkkelen finnes", () => {
    setShared();
    expect(b2ClientFor("admin")).not.toBeNull();
  });

  it("gjenbruker klienten for samme rolle", () => {
    setShared();
    expect(b2ClientFor("admin")).toBe(b2ClientFor("admin"));
  });

  it("lar ikke to roller med ulik nøkkel dele klient", () => {
    // Uten nøkkel-id i cachen ville den første rollen som koblet opp
    // bestemt legitimasjonen for alle de andre.
    setShared();
    process.env.B2_KEY_ADMIN_ID = "admin-id";
    process.env.B2_KEY_ADMIN_SECRET = "admin-hemmelighet";
    process.env.B2_KEY_ARCHIVE_ID = "arkiv-id";
    process.env.B2_KEY_ARCHIVE_SECRET = "arkiv-hemmelighet";
    expect(b2ClientFor("admin")).not.toBe(b2ClientFor("archive"));
  });

  it("bruker region-overstyringen når modulen har en annen default", () => {
    // Academy-materiellet ligger i us-west-001. Flyttet vi det stille til
    // fellesregionen, ville skrivingen gått mot en bøtte som ikke er der.
    setShared();
    const a = b2ClientFor("admin", "us-west-001");
    const b = b2ClientFor("admin");
    expect(a).not.toBe(b);
  });
});

describe("b2StoreFor", () => {
  it("tar første ikke-tomme bøtte i kjeden", () => {
    setShared();
    expect(b2StoreFor("admin", undefined, "  ", "bøtte-to")?.bucket).toBe("bøtte-to");
  });

  it("gir null når ingen bøtte er satt", () => {
    setShared();
    expect(b2StoreFor("admin", undefined, "")).toBeNull();
  });

  it("gir null når B2 ikke er konfigurert, selv med bøttenavn", () => {
    expect(b2StoreFor("admin", "en-bøtte")).toBeNull();
  });
});

describe("ingen modul bygger sin egen B2-klient", () => {
  it("holder S3Client-oppsettet samlet ett sted", () => {
    // Femten moduler hadde hver sin kopi av nøyaktig samme oppsett. Det
    // var slik master-nøkkelen ble sittende overalt: en endring måtte
    // gjøres femten ganger, og den som glemte én fikk ikke vite det.
    //
    // Testen fanger nye kopier. Er en ny virkelig nødvendig, står
    // unntaket her — og da er det et bevisst valg, ikke en forglemmelse.
    // Fra testfilas egen plassering, ikke process.cwd(): suiten kjøres
    // både fra repo-roten og fra backend/, og cwd ville gitt to ulike svar.
    const dir = dirname(fileURLToPath(import.meta.url));
    const allowed = new Set([
      // Fabrikken selv.
      "b2-client-factory.ts",
      // Brukerens EGEN B2-konto (BYO). Legitimasjonen er deres, hentet
      // kryptert fra databasen — den kan ikke komme fra vårt register.
      "role-room-byo-storage-service.ts",
      "user-b2-credentials-routes.ts",
      "user-b2-mirror-worker.ts",
      "user-b2-sync-worker.ts",
      // Kopierer ferdig redigerte filer til FOTOGRAFENS egen B2-bøtte.
      // Destinasjonsklienten bygges av deres creds, ikke våre.
      "editing-jobs-service.ts",
      // R2-stakkene. Egen leverandør, egen legitimasjon. Filene nevner B2
      // fordi de også har en B2-sti — den går gjennom fabrikken.
      "capture-upload-service.ts",
      "upload-storage-router.ts",
      "photo-enhancer-routes.ts",
    ]);

    const offenders: string[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      if (allowed.has(file)) continue;
      const src = readFileSync(join(dir, file), "utf8");
      if (!/new S3Client\(/.test(src)) continue;
      // En S3Client mot B2 kjennes igjen på backblaze-endepunktet eller
      // på at fila leser B2-legitimasjon.
      if (/backblazeb2\.com/.test(src) || /B2_[A-Z_]*APPLICATION_KEY/.test(src)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});

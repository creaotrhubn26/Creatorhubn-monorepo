// Vakt mot å falle tilbake til B2.
//
// role-room-user-storage-service og pitch-deck-asset-service hadde hver sin
// hardkodede B2-klient og skrev derfor til den gamle bøtta lenge etter at
// resten av Role Room gikk over til den private S3-bøtta. Nå går begge via
// getRoleRoomObjectStorage. Testen holder den koblingen: med bare B2-env satt
// og provider på aws_s3 skal lagringen regnes som ukonfigurert, ikke stille
// finne veien til Backblaze.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getConfiguredRoleRoomStorageProvider,
  getRoleRoomObjectStorage,
  resetRoleRoomStorageClientsForTests,
  resolveRoleRoomObjectKey,
} from "./role-room-object-storage.js";

const KEYS = [
  "ROLE_ROOM_STORAGE_PROVIDER",
  "AWS_ROLE_ROOM_ACCESS_KEY_ID",
  "AWS_ROLE_ROOM_SECRET_ACCESS_KEY",
  "AWS_ROLE_ROOM_BUCKET_NAME",
  "AWS_ROLE_ROOM_REGION",
  "AWS_ROLE_ARN",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
  "B2_ROLE_ROOM_APPLICATION_KEY_ID",
  "B2_ROLE_ROOM_APPLICATION_KEY",
  "B2_ROLE_ROOM_BUCKET_NAME",
  "B2_REGION",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  resetRoleRoomStorageClientsForTests();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetRoleRoomStorageClientsForTests();
});

describe("Role Room storage provider", () => {
  it("defaults to AWS S3 when nothing is configured", () => {
    expect(getConfiguredRoleRoomStorageProvider()).toBe("aws_s3");
  });

  it("does not fall back to B2 when only B2 credentials exist", () => {
    process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "b2-key-id";
    process.env.B2_ROLE_ROOM_APPLICATION_KEY = "b2-key";
    process.env.B2_ROLE_ROOM_BUCKET_NAME = "the-role-room-prod";

    expect(getRoleRoomObjectStorage()).toBeNull();
  });

  it("resolves the Role Room bucket once AWS is configured", () => {
    process.env.AWS_ROLE_ROOM_ACCESS_KEY_ID = "aws-key-id";
    process.env.AWS_ROLE_ROOM_SECRET_ACCESS_KEY = "aws-secret";
    process.env.AWS_ROLE_ROOM_BUCKET_NAME = "the-role-room-prod-123456789012-eu-north-1";
    process.env.AWS_ROLE_ROOM_REGION = "eu-north-1";

    const storage = getRoleRoomObjectStorage();

    expect(storage).toMatchObject({
      provider: "aws_s3",
      bucket: "the-role-room-prod-123456789012-eu-north-1",
      region: "eu-north-1",
    });
  });

  it("canonicalises a legacy B2 user key into the S3 hierarchy", () => {
    const legacy = "users/user-1/2f1d0a44-1f1e-4a2b-8c3d-9e0f1a2b3c4d-scout.jpg";

    expect(resolveRoleRoomObjectKey(legacy))
      .toBe("users/user-1/files/2f1d0a44-1f1e-4a2b-8c3d-9e0f1a2b3c4d/original.jpg");
  });

  it("leaves the key untouched while the provider is still B2", () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "backblaze_b2";
    const legacy = "users/user-1/2f1d0a44-1f1e-4a2b-8c3d-9e0f1a2b3c4d-scout.jpg";

    expect(resolveRoleRoomObjectKey(legacy)).toBe(legacy);
  });
});

describe("S3 is the default, B2 must be asked for", () => {
  const set = (value: string | undefined) => {
    if (value === undefined) delete process.env.ROLE_ROOM_STORAGE_PROVIDER;
    else process.env.ROLE_ROOM_STORAGE_PROVIDER = value;
    return getConfiguredRoleRoomStorageProvider();
  };

  it("picks S3 when the variable is unset, empty or whitespace", () => {
    expect(set(undefined)).toBe("aws_s3");
    expect(set("")).toBe("aws_s3");
    expect(set("   ")).toBe("aws_s3");
  });

  it("picks S3 for every spelling of it", () => {
    for (const value of ["aws_s3", "AWS_S3", " s3 ", "aws", "S3"]) {
      expect(set(value)).toBe("aws_s3");
    }
  });

  it("falls back to S3 on a typo instead of reaching for the retired bucket", () => {
    for (const value of ["awss3", "aws-s3", "amazon", "sss3", "'aws_s3'", "true"]) {
      expect(set(value)).toBe("aws_s3");
    }
  });

  it("still uses B2 when it is named explicitly", () => {
    for (const value of ["backblaze_b2", "BACKBLAZE", " b2 "]) {
      expect(set(value)).toBe("backblaze_b2");
    }
  });
});

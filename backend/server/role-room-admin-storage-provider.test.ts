/**
 * Admin-lagringen skal følge samme bryter som resten av Role Room.
 *
 * ROLE_ROOM_STORAGE_PROVIDER sto på aws_s3 i produksjon, men to tjenester
 * bygget sin egen Backblaze-klient og brydde seg ikke om den: redigerings-
 * jobbenes staging-bøtte, og kilden BYO-migreringen kopierer fra. Filene
 * havnet altså ett sted og ble lett etter et annet.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getRoleRoomObjectStorage,
  resetRoleRoomStorageClientsForTests,
} from "./role-room-object-storage.js";

const opprinnelig = { ...process.env };

beforeEach(() => {
  resetRoleRoomStorageClientsForTests();
  for (const n of [
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
  ]) delete process.env[n];
});

afterEach(() => {
  process.env = { ...opprinnelig };
  resetRoleRoomStorageClientsForTests();
});

function settS3() {
  process.env.AWS_ROLE_ROOM_ACCESS_KEY_ID = "AKIA-test";
  process.env.AWS_ROLE_ROOM_SECRET_ACCESS_KEY = "hemmelig";
  process.env.AWS_ROLE_ROOM_BUCKET_NAME = "role-room-s3";
  process.env.AWS_ROLE_ROOM_REGION = "eu-north-1";
}

function settB2() {
  process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID = "b2-id";
  process.env.B2_ROLE_ROOM_APPLICATION_KEY = "b2-key";
  process.env.B2_ROLE_ROOM_BUCKET_NAME = "role-room-b2";
}

describe("admin-lagringens leverandørvalg", () => {
  it("velger S3 når ingenting er bedt om — også når B2 er konfigurert", () => {
    settS3();
    settB2();
    const s = getRoleRoomObjectStorage();
    expect(s?.provider).toBe("aws_s3");
    expect(s?.bucket).toBe("role-room-s3");
  });

  it("velger S3 når provideren eksplisitt er aws_s3", () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "aws_s3";
    settS3();
    settB2();
    expect(getRoleRoomObjectStorage()?.bucket).toBe("role-room-s3");
  });

  it("velger B2 bare når noen ber om det ved navn", () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "backblaze_b2";
    settS3();
    settB2();
    const s = getRoleRoomObjectStorage();
    expect(s?.provider).toBe("backblaze_b2");
    expect(s?.bucket).toBe("role-room-b2");
  });

  it("en skrivefeil i bryteren gir S3, ikke den pensjonerte bøtta", () => {
    process.env.ROLE_ROOM_STORAGE_PROVIDER = "aws-s3 ";
    settS3();
    settB2();
    expect(getRoleRoomObjectStorage()?.provider).toBe("aws_s3");
  });

  it("gir null når S3 mangler bøtte — ingen stille fallback til B2", () => {
    // Det viktige: mangler S3-oppsettet, skal vi ikke plutselig skrive til
    // B2 uten at noen har bedt om det.
    settB2();
    expect(getRoleRoomObjectStorage()).toBeNull();
  });
});

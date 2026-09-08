import { readFileSync } from "node:fs";
import express, { type Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  parseProfileUpdate,
  ProfileValidationError,
  registerLeadMapMeProfileRoutes,
} from "./lead-map-me-profile-routes.js";

const userId = "11111111-1111-4111-8111-111111111111";
const token = "profile-test-token";

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: userId,
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.no",
    phone: "+47 900 00 000",
    profession: "Salgskonsulent",
    profile_image_url: null,
    ...overrides,
  };
}

function buildApp(options: {
  authenticated?: boolean;
  uploadImage?: (buffer: Buffer, mimeType: string, key: string) => Promise<string>;
  deleteImage?: (key: string) => Promise<void>;
} = {}) {
  const app = express();
  app.use(express.json());
  const query = vi.fn();
  const pool = { query } as unknown as Pool;
  const sessions = new Map<string, { userId: string; email?: string }>();
  if (options.authenticated !== false) {
    sessions.set(token, { userId, email: "ada@example.no" });
  }
  registerLeadMapMeProfileRoutes({
    app: app as Express,
    pool,
    activeSessions: sessions,
    uploadImage: options.uploadImage,
    deleteImage: options.deleteImage,
  });
  return { app, query };
}

describe("Leadgrid profile validation", () => {
  it("normalizes editable fields and maps phone to the canonical column", () => {
    expect(parseProfileUpdate({
      first_name: "  Ada ",
      last_name: "",
      phone: " +47 900 00 000 ",
      profession: " Selger ",
    })).toEqual([
      { column: "first_name", value: "Ada" },
      { column: "last_name", value: null },
      { column: "phone_number", value: "+47 900 00 000" },
      { column: "profession", value: "Selger" },
    ]);
  });

  it.each([
    [{ email: "ny@example.no" }, "email"],
    [{ profile_image_url: "https://example.no/a.jpg" }, "profile_image_url"],
    [{ phone: "ring meg" }, "phone"],
    [{ first_name: "x".repeat(81) }, "first_name"],
    [{ unexpected: "value" }, "unexpected"],
  ])("rejects unsafe or invalid updates", (payload, field) => {
    expect(() => parseProfileUpdate(payload)).toThrow(ProfileValidationError);
    try {
      parseProfileUpdate(payload);
    } catch (error) {
      expect((error as ProfileValidationError).fields).toHaveProperty(field);
    }
  });
});

describe("Leadgrid profile routes", () => {
  it("requires an authenticated session", async () => {
    const { app, query } = buildApp({ authenticated: false });
    await request(app).get("/api/admin-room/lead-map/me/profile").expect(401);
    await request(app)
      .patch("/api/admin-room/lead-map/me/profile")
      .send({ first_name: "Ada" })
      .expect(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("reads phone_number through the stable response contract", async () => {
    const { app, query } = buildApp();
    query.mockResolvedValueOnce({ rows: [profileRow()] });

    const response = await request(app)
      .get("/api/admin-room/lead-map/me/profile")
      .set("Authorization", "Bearer " + token)
      .expect(200);

    expect(response.body.profile).toMatchObject({
      user_id: userId,
      phone: "+47 900 00 000",
      profile_completed_count: 3,
      profile_complete: false,
    });
    expect(String(query.mock.calls[0]?.[0])).toContain("phone_number AS phone");
    expect(query.mock.calls[0]?.[1]).toEqual([userId]);
  });

  it("returns field-specific validation without touching the database", async () => {
    const { app, query } = buildApp();
    const response = await request(app)
      .patch("/api/admin-room/lead-map/me/profile")
      .set("Authorization", "Bearer " + token)
      .send({ email: "new@example.no", phone: "ikke telefon" })
      .expect(422);

    expect(response.body).toEqual({
      error: "validation_error",
      fields: {
        email: "E-post må endres gjennom en verifisert kontoflyt.",
        phone: "Skriv et gyldig telefonnummer.",
      },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("updates only the authenticated user and returns the refreshed profile", async () => {
    const { app, query } = buildApp();
    query.mockResolvedValueOnce({
      rows: [profileRow({ first_name: "Grace", phone: "+47 988 77 666" })],
    });

    const response = await request(app)
      .patch("/api/admin-room/lead-map/me/profile")
      .set("Authorization", "Bearer " + token)
      .send({ first_name: " Grace ", phone: "+47 988 77 666" })
      .expect(200);

    expect(response.body.profile.first_name).toBe("Grace");
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("first_name = $1");
    expect(sql).toContain("phone_number = $2");
    expect(sql).toContain("WHERE id = $3");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "Grace",
      "+47 988 77 666",
      userId,
    ]);
  });

  it("uploads a signature-verified image, persists it, and removes the previous object", async () => {
    const uploadImage = vi.fn(async () => "https://cdn.example.no/avatar.jpg");
    const deleteImage = vi.fn(async () => undefined);
    const previousKey = "leadgrid/profile-images/" + userId + "/aaaaaaaaaaaaaaaa.jpg";
    const { app, query } = buildApp({ uploadImage, deleteImage });
    query
      .mockResolvedValueOnce({
        rows: [{ profile_image_url: "https://cdn.example.no/" + previousKey }],
      })
      .mockResolvedValueOnce({
        rows: [profileRow({ profile_image_url: "https://cdn.example.no/avatar.jpg" })],
      });

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const response = await request(app)
      .post("/api/admin-room/lead-map/me/profile/image")
      .set("Authorization", "Bearer " + token)
      .attach("image", jpeg, { filename: "avatar.jpg", contentType: "image/jpeg" })
      .expect(200);

    expect(response.body.profile.profile_image_url).toBe(
      "https://cdn.example.no/avatar.jpg",
    );
    expect(uploadImage).toHaveBeenCalledOnce();
    expect(uploadImage.mock.calls[0]?.[1]).toBe("image/jpeg");
    expect(uploadImage.mock.calls[0]?.[2]).toMatch(
      new RegExp("^leadgrid/profile-images/" + userId + "/[a-f0-9]{16}\\.jpg$"),
    );
    expect(String(query.mock.calls[1]?.[0])).toContain(
      "SET profile_image_url = $1",
    );
    expect(deleteImage).toHaveBeenCalledWith(previousKey);
  });

  it("removes only the authenticated user's owned R2 object", async () => {
    const deleteImage = vi.fn(async () => undefined);
    const ownedKey = "leadgrid/profile-images/" + userId + "/bbbbbbbbbbbbbbbb.webp";
    const { app, query } = buildApp({ deleteImage });
    query
      .mockResolvedValueOnce({
        rows: [{ profile_image_url: "https://cdn.example.no/" + ownedKey }],
      })
      .mockResolvedValueOnce({
        rows: [profileRow({ profile_image_url: null })],
      });

    await request(app)
      .delete("/api/admin-room/lead-map/me/profile/image")
      .set("Authorization", "Bearer " + token)
      .expect(200);

    expect(deleteImage).toHaveBeenCalledOnce();
    expect(deleteImage).toHaveBeenCalledWith(ownedKey);
    expect(String(query.mock.calls[1]?.[0])).toContain("profile_image_url = NULL");
    expect(query.mock.calls[1]?.[1]).toEqual([userId]);
  });

  it("does not delete a foreign or legacy image URL", async () => {
    const deleteImage = vi.fn(async () => undefined);
    const { app, query } = buildApp({ deleteImage });
    query
      .mockResolvedValueOnce({
        rows: [{ profile_image_url: "https://elsewhere.example/avatars/other.jpg" }],
      })
      .mockResolvedValueOnce({
        rows: [profileRow({ profile_image_url: null })],
      });

    await request(app)
      .delete("/api/admin-room/lead-map/me/profile/image")
      .set("Authorization", "Bearer " + token)
      .expect(200);

    expect(deleteImage).not.toHaveBeenCalled();
  });

  it("rejects spoofed image bytes before storage", async () => {
    const uploadImage = vi.fn(async () => "https://cdn.example.no/avatar.jpg");
    const { app, query } = buildApp({ uploadImage });

    await request(app)
      .post("/api/admin-room/lead-map/me/profile/image")
      .set("Authorization", "Bearer " + token)
      .attach("image", Buffer.from("not-an-image"), {
        filename: "avatar.jpg",
        contentType: "image/jpeg",
      })
      .expect(415, { error: "unsupported_image_type" });

    expect(uploadImage).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

describe("migration 0559", () => {
  it("backfills legacy phone safely without requiring the legacy column", () => {
    const sql = readFileSync(
      new URL("../migrations/0559_leadgrid_profile_phone_canonical.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS phone_number");
    expect(sql).toContain("information_schema.columns");
    expect(sql).toContain("column_name = 'phone'");
    expect(sql).toContain("SET phone_number");
  });
});

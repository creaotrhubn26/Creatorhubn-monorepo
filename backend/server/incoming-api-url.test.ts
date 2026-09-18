import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { normalizeIncomingApiUrl } from "./incoming-api-url.js";
import {
  LEADGRID_SELF_ONBOARD_BODY_LIMIT_BYTES,
  requireLeadgridSelfOnboardJsonEnvelope,
} from "./org-self-onboard-routes.js";

describe("normalizeIncomingApiUrl", () => {
  it("canonicalizes alternate API route spellings before route matching", () => {
    expect(
      normalizeIncomingApiUrl("/api//leadgrid/self-onboard/"),
    ).toBe("/api/leadgrid/self-onboard");
    expect(normalizeIncomingApiUrl("api///leadgrid/self-onboard,,")).toBe(
      "/api/leadgrid/self-onboard",
    );
  });

  it("preserves non-API URLs and canonicalizes API query parameters", () => {
    expect(normalizeIncomingApiUrl("/health//ready/ ")).toBe(
      "/health//ready/ ",
    );
    expect(
      normalizeIncomingApiUrl("/api//items/?%20page%2C%2C=%202%2C%2C"),
    ).toBe("/api/items?page=2");
  });

  it("routes double-slash self-onboarding through the strict parser gate", async () => {
    const app = express();
    const routeReached = vi.fn();
    app.use((req, _res, next) => {
      req.url = normalizeIncomingApiUrl(req.url);
      next();
    });
    app.post(
      "/api/leadgrid/self-onboard",
      requireLeadgridSelfOnboardJsonEnvelope,
      express.json({
        limit: LEADGRID_SELF_ONBOARD_BODY_LIMIT_BYTES,
        strict: true,
        type: ["application/json", "application/*+json"],
      }),
      (_req, res) => {
        routeReached();
        res.status(204).end();
      },
    );
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    await request(app)
      .post("/api//leadgrid/self-onboard")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("email=owner%40example.test")
      .expect(415, { error: "content_type_must_be_json" });
    expect(routeReached).not.toHaveBeenCalled();

    await request(app)
      .post("/api//leadgrid/self-onboard")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ value: "x".repeat(17 * 1024) }))
      .expect(413);
    expect(routeReached).not.toHaveBeenCalled();
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openApiSpec } from "./leadgrid-openapi-spec.js";

const developerPage = readFileSync(
  new URL(
    "../../frontend/client/src/pages/leadgrid-developers.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid outcome OpenAPI contract", () => {
  it("documents the append-only project/lead outcome endpoint", () => {
    const path =
      openApiSpec.paths[
        "/api/v1/projects/{projectId}/leads/{leadId}/outcome-events"
      ];
    expect(path?.post).toBeDefined();
    expect(
      path?.post.requestBody.content["application/json"].schema.required,
    ).toEqual(
      expect.arrayContaining([
        "event_type",
        "external_event_id",
        "occurred_at",
      ]),
    );
    expect(path?.post.responses["409"]).toBeDefined();
    const responseSchema = openApiSpec.components.schemas.OutcomeEvent;
    expect(responseSchema.properties.discovery_profile_id).toMatchObject({
      format: "uuid",
      nullable: true,
    });
    expect(responseSchema.required).not.toContain("discovery_profile_id");
    expect(
      path?.post.requestBody.content["application/json"].schema.properties
        .discovery_profile_id,
    ).toBeUndefined();
  });

  it("matches runtime identifier, timestamp and money validation", () => {
    const post =
      openApiSpec.paths[
        "/api/v1/projects/{projectId}/leads/{leadId}/outcome-events"
      ].post;
    const request =
      post.requestBody.content["application/json"].schema.properties;
    const response = openApiSpec.components.schemas.OutcomeEvent.properties;
    const safePattern = "^[A-Za-z0-9][A-Za-z0-9._:-]*$";

    expect(request.external_event_id).toMatchObject({
      minLength: 1,
      maxLength: 255,
      pattern: safePattern,
    });
    expect(response.external_event_id).toMatchObject({
      minLength: 1,
      maxLength: 255,
      pattern: safePattern,
    });
    expect(
      post.parameters.find((parameter) => parameter.name === "Idempotency-Key")
        ?.schema,
    ).toMatchObject({
      minLength: 1,
      maxLength: 255,
      pattern: safePattern,
    });
    expect(request.occurred_at.description).toContain(
      "five minutes in the future",
    );
    expect(request.metadata.dependentRequired).toEqual({
      value_minor: ["currency"],
      currency: ["value_minor"],
    });
    for (const field of ["channel", "territory_code"] as const) {
      expect(request.metadata.properties[field]).toMatchObject({
        minLength: 1,
        maxLength: 80,
        pattern: safePattern,
      });
    }
    expect(request.metadata.properties.campaign_ref).toMatchObject({
      minLength: 1,
      maxLength: 255,
      pattern: safePattern,
    });
  });

  it("documents project-bound data access", () => {
    expect(openApiSpec.info.version).toBe("1.2.0");
    const leadList = openApiSpec.paths["/api/v1/leads"].get;
    const leadDetail = openApiSpec.paths["/api/v1/leads/{id}"].get;
    const recommendations = openApiSpec.paths["/api/v1/recommendations"].get;
    expect(leadList.parameters.some((item) => item.name === "project_id")).toBe(
      true,
    );
    expect(
      leadDetail.parameters.some((item) => item.name === "project_id"),
    ).toBe(true);
    expect(
      recommendations.parameters.some((item) => item.name === "project_id"),
    ).toBe(true);
  });

  it("keeps Dentum event truth and first-touch attribution explicit", () => {
    expect(developerPage).toContain("kildesystem-bekreftede");
    expect(developerPage).toContain("verifiserer ikke uavhengig");
    for (const eventType of [
      "pilot_invited",
      "meeting_completed",
      "profile_published",
      "inquiry_received",
      "booking_confirmed",
      "attendance_confirmed",
    ]) {
      expect(developerPage).toContain(eventType);
    }
    expect(developerPage).toContain("faktisk skjedde");
    expect(developerPage).toContain("mer enn fem minutter frem i tid");
    expect(developerPage).toContain(
      "uforanderlig first-touch-attribusjon på serveren",
    );
    expect(developerPage).toContain(
      "første godkjente kandidaten som faktisk importerte leadet",
    );
  });
});

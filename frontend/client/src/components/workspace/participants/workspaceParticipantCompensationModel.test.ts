import { describe, expect, it } from "vitest";
import {
  buildWorkspaceParticipantCompensationRequest,
  calculateWorkspaceParticipantHourlyEstimate,
  EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
  newWorkspaceParticipantCompensationIdempotencyKey,
} from "./workspaceParticipantCompensationModel";

const KEY = "00000000-0000-4000-8000-000000000111";

describe("workspace participant compensation model", () => {
  it("builds strict NOK hourly terms with OCC and Norwegian decimals", () => {
    const result = buildWorkspaceParticipantCompensationRequest({
      draft: {
        ...EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
        hourlyRate: " 499,50 ",
        estimatedHours: "10,25",
        note: "  Kveldssats  ",
      },
      idempotencyKey: KEY,
      expectedCurrentVersion: 3,
    });

    expect(result).toEqual({
      ok: true,
      request: {
        compensationType: "hourly",
        hourlyRate: 499.5,
        estimatedHours: 10.25,
        currency: "NOK",
        note: "Kveldssats",
        idempotencyKey: KEY,
        expectedCurrentVersion: 3,
      },
    });
    expect(calculateWorkspaceParticipantHourlyEstimate("499,50", "10,25")).toBe(
      5119.88,
    );
  });

  it("keeps fixed and unpaid requests free of fields from other variants", () => {
    expect(
      buildWorkspaceParticipantCompensationRequest({
        draft: {
          ...EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
          compensationType: "fixed",
          fixedAmount: "12500",
        },
        idempotencyKey: KEY,
        expectedCurrentVersion: null,
      }),
    ).toEqual({
      ok: true,
      request: {
        compensationType: "fixed",
        fixedAmount: 12500,
        currency: "NOK",
        note: null,
        idempotencyKey: KEY,
        expectedCurrentVersion: null,
      },
    });

    expect(
      buildWorkspaceParticipantCompensationRequest({
        draft: {
          ...EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
          compensationType: "unpaid",
          hourlyRate: "900",
          estimatedHours: "8",
        },
        idempotencyKey: KEY,
        expectedCurrentVersion: 1,
      }),
    ).toEqual({
      ok: true,
      request: {
        compensationType: "unpaid",
        note: null,
        idempotencyKey: KEY,
        expectedCurrentVersion: 1,
      },
    });
  });

  it("rejects values the strict API would reject and requires a secure UUID", () => {
    expect(
      buildWorkspaceParticipantCompensationRequest({
        draft: {
          ...EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
          hourlyRate: "500.123",
          estimatedHours: "8",
        },
        idempotencyKey: KEY,
        expectedCurrentVersion: null,
      }),
    ).toEqual({ ok: false, code: "invalid_hourly_rate" });
    expect(() =>
      newWorkspaceParticipantCompensationIdempotencyKey(() => "not-a-uuid"),
    ).toThrow("secure_uuid_unavailable");
    expect(newWorkspaceParticipantCompensationIdempotencyKey(() => KEY)).toBe(
      KEY,
    );
  });

  it("NFC-normalizes participant-visible notes and rejects HTML tags", () => {
    const normalized = buildWorkspaceParticipantCompensationRequest({
      draft: {
        ...EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
        compensationType: "unpaid",
        note: "  Cafe\u0301 etter opptak  ",
      },
      idempotencyKey: KEY,
      expectedCurrentVersion: null,
    });

    expect(normalized).toMatchObject({
      ok: true,
      request: { note: "Café etter opptak" },
    });

    expect(
      buildWorkspaceParticipantCompensationRequest({
        draft: {
          ...EMPTY_WORKSPACE_PARTICIPANT_COMPENSATION_DRAFT,
          compensationType: "unpaid",
          note: "Synlig <strong>tekst</strong>",
        },
        idempotencyKey: KEY,
        expectedCurrentVersion: null,
      }),
    ).toEqual({ ok: false, code: "note_contains_html" });
  });
});

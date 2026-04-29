import { describe, expect, it } from "vitest";
import { shouldSendAuditionReminder } from "./casting-reminder-runner.js";

const TZ_OFFSET_OSLO_DST = "+02:00";

function osloDateAt(dateIso: string, time: string): Date {
  return new Date(`${dateIso}T${time}:00${TZ_OFFSET_OSLO_DST}`);
}

describe("shouldSendAuditionReminder", () => {
  it("returns 1h when audition is exactly one hour away", () => {
    const now = osloDateAt("2026-04-29", "14:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "scheduled",
      type: "audition",
      remindersSent: {},
      now,
    });
    expect(result?.threshold).toBe("1h");
  });

  it("returns 24h when audition is exactly 24 hours away", () => {
    const now = osloDateAt("2026-04-29", "15:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-30",
      startTime: "15:00",
      status: "scheduled",
      type: "audition",
      remindersSent: {},
      now,
    });
    expect(result?.threshold).toBe("24h");
  });

  it("returns null when 1h reminder already sent", () => {
    const now = osloDateAt("2026-04-29", "14:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "scheduled",
      type: "audition",
      remindersSent: { "1h": "2026-04-29T13:55:00Z" },
      now,
    });
    expect(result).toBeNull();
  });

  it("still sends 1h after 24h was sent", () => {
    const now = osloDateAt("2026-04-29", "14:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "scheduled",
      type: "audition",
      remindersSent: { "24h": "2026-04-28T15:00:00Z" },
      now,
    });
    expect(result?.threshold).toBe("1h");
  });

  it("returns null when audition is too far away", () => {
    const now = osloDateAt("2026-04-25", "12:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "scheduled",
      type: "audition",
      remindersSent: {},
      now,
    });
    expect(result).toBeNull();
  });

  it("returns null when audition is in the past", () => {
    const now = osloDateAt("2026-04-29", "16:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "scheduled",
      type: "audition",
      remindersSent: {},
      now,
    });
    expect(result).toBeNull();
  });

  it("returns null when status is canceled", () => {
    const now = osloDateAt("2026-04-29", "14:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "canceled",
      type: "audition",
      remindersSent: {},
      now,
    });
    expect(result).toBeNull();
  });

  it("returns null when status is completed", () => {
    const now = osloDateAt("2026-04-29", "14:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "completed",
      type: "audition",
      remindersSent: {},
      now,
    });
    expect(result).toBeNull();
  });

  it("returns null when type is not audition (e.g. callback)", () => {
    const now = osloDateAt("2026-04-29", "14:00");
    const result = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "scheduled",
      type: "callback",
      remindersSent: {},
      now,
    });
    expect(result).toBeNull();
  });

  it("returns null when date or startTime is missing", () => {
    const now = osloDateAt("2026-04-29", "14:00");
    expect(
      shouldSendAuditionReminder({
        date: null,
        startTime: "15:00",
        status: "scheduled",
        type: "audition",
        remindersSent: {},
        now,
      }),
    ).toBeNull();
    expect(
      shouldSendAuditionReminder({
        date: "2026-04-29",
        startTime: null,
        status: "scheduled",
        type: "audition",
        remindersSent: {},
        now,
      }),
    ).toBeNull();
  });

  it("accepts wider window via windowMinutes override", () => {
    const now = osloDateAt("2026-04-29", "13:30");
    const inDefaultWindow = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "scheduled",
      type: "audition",
      remindersSent: {},
      now,
    });
    const inExpandedWindow = shouldSendAuditionReminder({
      date: "2026-04-29",
      startTime: "15:00",
      status: "scheduled",
      type: "audition",
      remindersSent: {},
      now,
      windowMinutes: 45,
    });
    expect(inDefaultWindow).toBeNull();
    expect(inExpandedWindow?.threshold).toBe("1h");
  });
});

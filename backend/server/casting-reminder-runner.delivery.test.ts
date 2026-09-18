import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const senderMocks = vi.hoisted(() => ({
  buildAuditionReminderEmail: vi.fn(() => ({
    subject: "Audition reminder",
    html: "<p>Reminder</p>",
    text: "Reminder",
  })),
  buildAuditionReminderSmsBody: vi.fn(() => "Reminder"),
  isEmailConfigured: vi.fn(() => true),
  isSmsBrandConfigured: vi.fn(() => false),
  normalizePhoneE164: vi.fn((value: unknown) =>
    typeof value === "string" && value.trim() ? "+4797959294" : null,
  ),
  parseReminderPrefs: vi.fn(() => ({
    sms24h: false,
    sms1h: false,
    email24h: true,
    email1h: true,
    whatsapp24h: false,
    whatsapp1h: false,
  })),
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
}));

const whatsappMocks = vi.hoisted(() => ({
  readEnvFallbackConfig: vi.fn(() => null),
  sendWhatsAppAuditionReminder: vi.fn(),
}));

const whatsappConfigMocks = vi.hoisted(() => ({
  getWhatsAppOrgConfig: vi.fn(() => null),
}));

const billingMocks = vi.hoisted(() => ({
  recordSmsUsage: vi.fn(async () => undefined),
  recordWhatsAppUsage: vi.fn(async () => undefined),
}));

vi.mock("./casting-reminder-sender.js", () => senderMocks);
vi.mock("./casting-whatsapp-sender.js", () => whatsappMocks);
vi.mock("./role-room-whatsapp-config-service.js", () => whatsappConfigMocks);
vi.mock("./casting-sms-billing.js", () => ({
  recordSmsUsage: billingMocks.recordSmsUsage,
}));
vi.mock("./casting-whatsapp-billing.js", () => ({
  recordWhatsAppUsage: billingMocks.recordWhatsAppUsage,
}));

import { runAuditionReminderSweep } from "./casting-reminder-runner.js";

interface FakeDeliveryState {
  claimId: string | null;
  claimExpiresAt: number | null;
  deliveryStartedAt: number | null;
  deliveryUncertainAt: number | null;
  deliveredAt: number | null;
  messageId: string | null;
  providerMessageId: string | null;
  lastError: string | null;
  attemptCount: number;
}

interface FakeDbOptions {
  failDeliveryReceiptOnce?: boolean;
}

const NOW = new Date("2026-04-29T12:00:00.000Z");

function scheduleRow() {
  return {
    id: "schedule-1",
    project_id: "project-1",
    candidate_id: "candidate-1",
    date: "2026-04-29",
    start_time: "15:00",
    status: "scheduled",
    type: "audition",
    notes: null,
    location: "Studio 1",
    // Holdes med vilje tom selv etter compatibility-update. Testene beviser
    // at den nye DB-tabellen, ikke prosessminne/JSON-markøren, stopper replay.
    reminders_sent: {},
    candidate_name: "Daniel",
    candidate_email: "daniel@example.test",
    candidate_phone: "+4797959294",
    candidate_reminder_prefs: {},
    project_name: "Leadgrid-film",
  };
}

function deliveryKey(threshold: string, channel: string): string {
  return `schedule-1:${threshold}:${channel}`;
}

function buildFakePool(options: FakeDbOptions = {}) {
  const states = new Map<string, FakeDeliveryState>();
  let receiptShouldFail = options.failDeliveryReceiptOnce === true;

  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue);

    if (sql.includes("FROM casting_schedules cs")) {
      return { rows: [scheduleRow()], rowCount: 1 };
    }

    if (sql.includes("FROM casting_projects cp")) {
      return {
        rows: [{ email: "owner@example.test" }],
        rowCount: 1,
      };
    }

    if (
      sql.includes("INSERT INTO casting_reminder_delivery_claims AS delivery")
    ) {
      const [scheduleId, threshold, channel, claimId, messageId, leaseSeconds] =
        params.map((value) => value ?? null);
      const key = `${scheduleId}:${threshold}:${channel}`;
      const existing = states.get(key);
      const now = Date.now();
      const claimable =
        !existing ||
        (!existing.deliveredAt &&
          !existing.deliveryStartedAt &&
          (!existing.claimId ||
            !existing.claimExpiresAt ||
            existing.claimExpiresAt <= now));
      if (!claimable) return { rows: [], rowCount: 0 };

      const next: FakeDeliveryState = existing ?? {
        claimId: null,
        claimExpiresAt: null,
        deliveryStartedAt: null,
        deliveryUncertainAt: null,
        deliveredAt: null,
        messageId: null,
        providerMessageId: null,
        lastError: null,
        attemptCount: 0,
      };
      next.claimId = String(claimId);
      next.claimExpiresAt = now + Number(leaseSeconds) * 1_000;
      next.deliveryUncertainAt = null;
      next.lastError = null;
      next.messageId = next.messageId ?? (messageId ? String(messageId) : null);
      next.attemptCount += 1;
      states.set(key, next);
      return {
        rows: [{ claim_id: next.claimId, message_id: next.messageId }],
        rowCount: 1,
      };
    }

    if (sql.includes("SET delivery_started_at = now()")) {
      const [scheduleId, threshold, channel, claimId] = params;
      const state = states.get(`${scheduleId}:${threshold}:${channel}`);
      const canStart =
        state?.claimId === claimId &&
        Boolean(state.claimExpiresAt && state.claimExpiresAt > Date.now()) &&
        !state.deliveryStartedAt &&
        !state.deliveredAt;
      if (!state || !canStart) return { rows: [], rowCount: 0 };
      state.deliveryStartedAt = Date.now();
      state.deliveryUncertainAt = null;
      state.lastError = null;
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("SET delivered_at = now()")) {
      if (receiptShouldFail) {
        receiptShouldFail = false;
        throw new Error("database receipt unavailable");
      }
      const [scheduleId, threshold, channel, claimId, providerMessageId] =
        params;
      const state = states.get(`${scheduleId}:${threshold}:${channel}`);
      if (
        !state ||
        state.claimId !== claimId ||
        !state.deliveryStartedAt ||
        state.deliveredAt
      ) {
        return { rows: [], rowCount: 0 };
      }
      state.deliveredAt = Date.now();
      state.providerMessageId = providerMessageId
        ? String(providerMessageId)
        : state.providerMessageId;
      state.claimId = null;
      state.claimExpiresAt = null;
      state.deliveryUncertainAt = null;
      state.lastError = null;
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("SET delivery_uncertain_at = COALESCE")) {
      const [scheduleId, threshold, channel, claimId, error] = params;
      const state = states.get(`${scheduleId}:${threshold}:${channel}`);
      if (
        !state ||
        state.claimId !== claimId ||
        !state.deliveryStartedAt ||
        state.deliveredAt
      ) {
        return { rows: [], rowCount: 0 };
      }
      state.deliveryUncertainAt ??= Date.now();
      state.claimId = null;
      state.claimExpiresAt = null;
      state.lastError = String(error);
      return { rows: [], rowCount: 1 };
    }

    if (
      sql.includes("SET claim_id = NULL") &&
      sql.includes("delivery_started_at = NULL")
    ) {
      const [scheduleId, threshold, channel, claimId, error] = params;
      const state = states.get(`${scheduleId}:${threshold}:${channel}`);
      if (
        !state ||
        state.claimId !== claimId ||
        !state.deliveryStartedAt ||
        state.deliveryUncertainAt ||
        state.deliveredAt
      ) {
        return { rows: [], rowCount: 0 };
      }
      state.claimId = null;
      state.claimExpiresAt = null;
      state.deliveryStartedAt = null;
      state.deliveryUncertainAt = null;
      state.lastError = String(error);
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("INSERT INTO notification_delivery_log")) {
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("UPDATE casting_schedules")) {
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in fake reminder DB: ${sql.slice(0, 120)}`);
  });

  return {
    pool: { query } as unknown as Pool,
    query,
    states,
  };
}

describe("audition reminder distributed delivery claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    senderMocks.isEmailConfigured.mockReturnValue(true);
    senderMocks.isSmsBrandConfigured.mockReturnValue(false);
    senderMocks.normalizePhoneE164.mockImplementation((value: unknown) =>
      typeof value === "string" && value.trim() ? "+4797959294" : null,
    );
    senderMocks.parseReminderPrefs.mockReturnValue({
      sms24h: false,
      sms1h: false,
      email24h: true,
      email1h: true,
      whatsapp24h: false,
      whatsapp1h: false,
    });
    senderMocks.sendEmail.mockResolvedValue({
      success: true,
      provider: "gmail",
      messageId: "provider-email-1",
    });
    senderMocks.sendSms.mockResolvedValue({
      success: true,
      provider: "twilio",
      messageSid: "SM-1",
    });
    whatsappMocks.readEnvFallbackConfig.mockReturnValue(null);
    whatsappMocks.sendWhatsAppAuditionReminder.mockResolvedValue({
      success: true,
      provider: "meta-cloud",
      messageId: "WA-1",
    });
    whatsappConfigMocks.getWhatsAppOrgConfig.mockResolvedValue(null);
  });

  it("sends a successful channel only once even when the legacy marker stays empty", async () => {
    const { pool, query, states } = buildFakePool();

    const first = await runAuditionReminderSweep("manual", { pool, now: NOW });
    const second = await runAuditionReminderSweep("manual", { pool, now: NOW });

    expect(first).toMatchObject({ emailSent: 1, failures: 0 });
    expect(second).toMatchObject({ emailSent: 0, failures: 0, skipped: 1 });
    expect(senderMocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(states.get(deliveryKey("1h", "email"))).toMatchObject({
      deliveredAt: expect.any(Number),
      deliveryStartedAt: expect.any(Number),
      attemptCount: 1,
    });

    const claimSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes(
          "INSERT INTO casting_reminder_delivery_claims AS delivery",
        ),
      )?.[0],
    );
    expect(claimSql).toContain("ON CONFLICT (schedule_id, threshold, channel)");
    expect(claimSql).toContain("delivery.delivery_started_at IS NULL");
    expect(claimSql).toContain("delivery.claim_expires_at <= now()");
    expect(claimSql).toContain("NOT has_legacy_marker OR has_delivery_state");

    const emailInput = senderMocks.sendEmail.mock.calls[0]?.[0];
    expect(emailInput.smtpTimeoutMs).toBe(120_000);
    const claimCallIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes(
        "INSERT INTO casting_reminder_delivery_claims AS delivery",
      ),
    );
    const startCallIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("SET delivery_started_at = now()"),
    );
    expect(query.mock.invocationCallOrder[claimCallIndex]).toBeLessThan(
      query.mock.invocationCallOrder[startCallIndex]!,
    );
    expect(query.mock.invocationCallOrder[startCallIndex]).toBeLessThan(
      senderMocks.sendEmail.mock.invocationCallOrder[0]!,
    );
    expect(emailInput.smtpTimeoutMs).toBeLessThan(
      Number(query.mock.calls[claimCallIndex]?.[1]?.[5]) * 1_000,
    );
    expect(emailInput.messageId).toMatch(
      /^<audition-reminder-[a-f0-9]{64}@creatorhubn\.com>$/,
    );
  });

  it("releases a proven pre-delivery SMTP failure and retries with the same Message-ID", async () => {
    senderMocks.sendEmail
      .mockResolvedValueOnce({
        success: false,
        provider: "gmail",
        error: "authentication rejected",
        failureCertainty: "definite_pre_delivery",
      })
      .mockResolvedValueOnce({
        success: true,
        provider: "gmail",
        messageId: "provider-email-2",
      });
    const { pool, states } = buildFakePool();

    const first = await runAuditionReminderSweep("manual", { pool, now: NOW });
    expect(first).toMatchObject({ emailSent: 0, failures: 1, skipped: 1 });
    expect(states.get(deliveryKey("1h", "email"))).toMatchObject({
      claimId: null,
      deliveryStartedAt: null,
      deliveryUncertainAt: null,
      deliveredAt: null,
    });

    const second = await runAuditionReminderSweep("manual", { pool, now: NOW });
    expect(second).toMatchObject({ emailSent: 1, failures: 0 });
    expect(senderMocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(senderMocks.sendEmail.mock.calls[0]?.[0].messageId).toBe(
      senderMocks.sendEmail.mock.calls[1]?.[0].messageId,
    );
  });

  it("quarantines uncertain SMTP outcome and never retries automatically", async () => {
    senderMocks.sendEmail.mockResolvedValue({
      success: false,
      provider: "gmail",
      error: "timeout after DATA",
      failureCertainty: "uncertain",
    });
    const { pool, states } = buildFakePool();

    const first = await runAuditionReminderSweep("manual", { pool, now: NOW });
    const state = states.get(deliveryKey("1h", "email"));
    expect(first).toMatchObject({ emailSent: 0, failures: 1, skipped: 1 });
    expect(state).toMatchObject({
      claimId: null,
      deliveryStartedAt: expect.any(Number),
      deliveryUncertainAt: expect.any(Number),
      deliveredAt: null,
      lastError: expect.stringContaining("provider_outcome_uncertain"),
    });

    state!.claimExpiresAt = Date.now() - 60_000;
    await runAuditionReminderSweep("manual", { pool, now: NOW });
    expect(senderMocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps the at-most-once guard when provider succeeded but receipt persistence failed", async () => {
    const { pool, states } = buildFakePool({ failDeliveryReceiptOnce: true });

    const first = await runAuditionReminderSweep("manual", { pool, now: NOW });
    expect(first).toMatchObject({ emailSent: 0, failures: 1 });
    expect(states.get(deliveryKey("1h", "email"))).toMatchObject({
      deliveryStartedAt: expect.any(Number),
      deliveryUncertainAt: expect.any(Number),
      deliveredAt: null,
    });

    await runAuditionReminderSweep("manual", { pool, now: NOW });
    expect(senderMocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("reclaims only an expired pre-delivery lease", async () => {
    const { pool, states } = buildFakePool();
    states.set(deliveryKey("1h", "email"), {
      claimId: "00000000-0000-4000-8000-000000000001",
      claimExpiresAt: Date.now() + 60_000,
      deliveryStartedAt: null,
      deliveryUncertainAt: null,
      deliveredAt: null,
      messageId: null,
      providerMessageId: null,
      lastError: null,
      attemptCount: 1,
    });

    await runAuditionReminderSweep("manual", { pool, now: NOW });
    expect(senderMocks.sendEmail).not.toHaveBeenCalled();

    states.get(deliveryKey("1h", "email"))!.claimExpiresAt = Date.now() - 1;
    await runAuditionReminderSweep("manual", { pool, now: NOW });
    expect(senderMocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(states.get(deliveryKey("1h", "email"))).toMatchObject({
      deliveredAt: expect.any(Number),
      attemptCount: 2,
    });
  });

  it("quarantines SMS and WhatsApp failures after provider start", async () => {
    senderMocks.isSmsBrandConfigured.mockReturnValue(true);
    senderMocks.parseReminderPrefs.mockReturnValue({
      sms24h: true,
      sms1h: true,
      email24h: false,
      email1h: false,
      whatsapp24h: true,
      whatsapp1h: true,
    });
    senderMocks.sendSms.mockResolvedValue({
      success: false,
      provider: "twilio",
      error: "connection reset",
    });
    whatsappConfigMocks.getWhatsAppOrgConfig.mockResolvedValue({
      accessToken: "token",
      phoneNumberId: "phone-id",
      displayName: "The Role Room",
      templateLanguage: "nb_NO",
      template24hName: "audition_24h",
      template1hName: "audition_1h",
    });
    whatsappMocks.sendWhatsAppAuditionReminder.mockResolvedValue({
      success: false,
      provider: "meta-cloud",
      error: "connection reset",
    });
    const { pool, states } = buildFakePool();

    const first = await runAuditionReminderSweep("manual", { pool, now: NOW });
    await runAuditionReminderSweep("manual", { pool, now: NOW });

    expect(first).toMatchObject({ failures: 2, skipped: 1 });
    expect(senderMocks.sendSms).toHaveBeenCalledTimes(1);
    expect(whatsappMocks.sendWhatsAppAuditionReminder).toHaveBeenCalledTimes(1);
    expect(states.get(deliveryKey("1h", "sms"))).toMatchObject({
      deliveryStartedAt: expect.any(Number),
      deliveryUncertainAt: expect.any(Number),
    });
    expect(states.get(deliveryKey("1h", "whatsapp"))).toMatchObject({
      deliveryStartedAt: expect.any(Number),
      deliveryUncertainAt: expect.any(Number),
    });
  });

  it("ships a forward-only migration with conservative legacy backfill", () => {
    const sql = readFileSync(
      new URL(
        "../migrations/0463_casting_reminder_delivery_claims.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain("PRIMARY KEY (schedule_id, threshold, channel)");
    expect(sql).toContain("delivery_started_at IS NULL");
    expect(sql).toContain(
      "ON CONFLICT (schedule_id, threshold, channel) DO NOTHING",
    );
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });
});

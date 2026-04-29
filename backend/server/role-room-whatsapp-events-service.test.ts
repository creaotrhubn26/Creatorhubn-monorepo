import { describe, expect, it } from "vitest";
import {
  flattenWebhookEvents,
  type MetaWebhookPayload,
} from "./role-room-whatsapp-events-service.js";

describe("flattenWebhookEvents", () => {
  it("returns empty array for missing entry", () => {
    expect(flattenWebhookEvents({})).toEqual([]);
    expect(flattenWebhookEvents({ object: "whatsapp_business_account" })).toEqual([]);
  });

  it("flattens messages.statuses into one row per status", () => {
    const payload: MetaWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_123",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PHONE_456" },
                statuses: [
                  {
                    id: "wamid.A",
                    status: "delivered",
                    conversation: { id: "conv-1" },
                  },
                  {
                    id: "wamid.B",
                    status: "read",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(2);
    expect(rows[0].eventField).toBe("messages");
    expect(rows[0].eventSubtype).toBe("delivered");
    expect(rows[0].messageId).toBe("wamid.A");
    expect(rows[0].phoneNumberId).toBe("PHONE_456");
    expect(rows[0].wabaId).toBe("WABA_123");
    expect(rows[1].eventSubtype).toBe("read");
    expect(rows[1].messageId).toBe("wamid.B");
  });

  it("flattens incoming messages with subtype=inbound", () => {
    const payload: MetaWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_x",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "P_1" },
                messages: [
                  { id: "wamid.in1", from: "47XXXXXXXX", type: "text" },
                ],
              },
            },
          ],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventSubtype).toBe("inbound");
    expect(rows[0].messageId).toBe("wamid.in1");
  });

  it("captures template-status with template_name + event subtype", () => {
    const payload: MetaWebhookPayload = {
      entry: [
        {
          id: "WABA_y",
          changes: [
            {
              field: "message_template_status_update",
              value: {
                event: "APPROVED",
                message_template_id: "12345",
                message_template_name: "audition_reminder_24h_no",
                message_template_language: "nb_NO",
              },
            },
          ],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventField).toBe("message_template_status_update");
    expect(rows[0].eventSubtype).toBe("APPROVED");
    expect(rows[0].templateName).toBe("audition_reminder_24h_no");
    expect(rows[0].wabaId).toBe("WABA_y");
  });

  it("captures phone_number_quality_update with phone_number_id from value.id", () => {
    const payload: MetaWebhookPayload = {
      entry: [
        {
          id: "WABA_z",
          changes: [
            {
              field: "phone_number_quality_update",
              value: {
                event: "FLAGGED",
                id: "PHONE_999",
                current_limit: "TIER_1K",
              },
            },
          ],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventSubtype).toBe("FLAGGED");
    expect(rows[0].phoneNumberId).toBe("PHONE_999");
  });

  it("handles generic fields (account_alerts) with extracted subtype", () => {
    const payload: MetaWebhookPayload = {
      entry: [
        {
          id: "WABA_a",
          changes: [
            {
              field: "account_alerts",
              value: {
                alert_severity: "CRITICAL",
                alert_type: "ABUSE",
                alert_description: "Spam-rate too high",
              },
            },
          ],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventField).toBe("account_alerts");
    expect(rows[0].eventSubtype).toBe("CRITICAL");
  });

  it("handles message_template_quality_update with quality score", () => {
    const payload: MetaWebhookPayload = {
      entry: [
        {
          id: "WABA_q",
          changes: [
            {
              field: "message_template_quality_update",
              value: {
                message_template_id: "12345",
                message_template_name: "audition_reminder_1h_no",
                new_quality_score: "GREEN",
                previous_quality_score: "YELLOW",
              },
            },
          ],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventField).toBe("message_template_quality_update");
    expect(rows[0].eventSubtype).toBe("GREEN");
    expect(rows[0].templateName).toBe("audition_reminder_1h_no");
  });

  it("handles template_category_update with new_category", () => {
    const payload: MetaWebhookPayload = {
      entry: [
        {
          id: "WABA_c",
          changes: [
            {
              field: "template_category_update",
              value: {
                message_template_name: "audition_reminder_24h_no",
                previous_category: "MARKETING",
                new_category: "UTILITY",
              },
            },
          ],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventSubtype).toBe("UTILITY");
    expect(rows[0].templateName).toBe("audition_reminder_24h_no");
  });

  it("handles multiple entries with multiple changes — totals match", () => {
    const payload: MetaWebhookPayload = {
      entry: [
        {
          id: "WABA_a",
          changes: [
            { field: "messages", value: { statuses: [{ id: "wamid.x", status: "sent" }] } },
            { field: "phone_number_quality_update", value: { event: "OK", id: "P1" } },
          ],
        },
        {
          id: "WABA_b",
          changes: [
            {
              field: "message_template_status_update",
              value: { event: "REJECTED", message_template_name: "tmpl-x" },
            },
          ],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.eventField).sort()).toEqual([
      "message_template_status_update",
      "messages",
      "phone_number_quality_update",
    ]);
  });

  it("falls back to single row when messages.value has no statuses/messages/errors", () => {
    const payload: MetaWebhookPayload = {
      entry: [
        {
          id: "W",
          changes: [{ field: "messages", value: { contacts: [{ wa_id: "47XX" }] } }],
        },
      ],
    };
    const rows = flattenWebhookEvents(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventField).toBe("messages");
    expect(rows[0].eventSubtype).toBeNull();
  });
});

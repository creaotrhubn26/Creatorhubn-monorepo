/**
 * leadgrid-workflow-extensions.test.ts
 *
 * Tester for mig-0350-utvidelsene:
 *   - 6 nye triggers (email.opened, email.link_clicked, meeting.booked,
 *     meeting.no_show, proposal.opened, contract.signed)
 *   - 9 nye actions (schedule_call, book_meeting, update_lead_fields,
 *     post_to_webhook, trigger_zapier, send_internal_notification,
 *     remove_tag, archive_lead, revive_lead)
 *   - Helpers: resolveWhen, renderTemplate, buildWebhookPayload
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateTrigger,
  validateAction,
  UPDATE_LEAD_FIELDS_WHITELIST,
} from "./leadgrid-workflow-types.js";
import {
  triggerMatches,
  resolveWhen,
  renderTemplate,
  buildWebhookPayload,
  _resetWebhookRateLimit,
  type WorkflowEvent,
} from "./leadgrid-workflow-engine.js";
import type {
  WorkflowAction,
  WorkflowTrigger,
} from "./leadgrid-workflow-types.js";

function ev(
  type: WorkflowTrigger["type"],
  data: Record<string, unknown> = {},
): WorkflowEvent {
  return {
    pool: undefined as unknown as WorkflowEvent["pool"],
    organizationId: "00000000-0000-0000-0000-000000000000",
    type,
    leadId: null,
    actorUserId: null,
    data,
  };
}

const fakeLead = {
  id: "lead-1",
  business_name: "Test AS",
  lead_score: 75,
  lead_temperature: "hot",
  pipeline_stage: "qualified",
  industry_id: "restaurant",
  city: "Oslo",
  deal_amount: "150000.00",
  deal_probability: 50,
  owner_user_id: "user-1",
  email: "x@y.com",
  phone: null,
};

beforeEach(() => {
  _resetWebhookRateLimit();
});

// ─── Triggers (validateTrigger + triggerMatches) ──────────────────────
describe("validateTrigger — mig 0350 triggers", () => {
  it("accepts email.opened uten felt", () => {
    expect(validateTrigger({ type: "email.opened" }).ok).toBe(true);
  });
  it("accepts email.opened med email_id", () => {
    expect(
      validateTrigger({ type: "email.opened", email_id: "welcome-v2" }).ok,
    ).toBe(true);
  });
  it("rejects email.opened med email_id som ikke er string", () => {
    expect(validateTrigger({ type: "email.opened", email_id: 123 }).ok).toBe(
      false,
    );
  });
  it("accepts email.link_clicked med pattern", () => {
    expect(
      validateTrigger({
        type: "email.link_clicked",
        link_url_pattern: "pricing",
      }).ok,
    ).toBe(true);
  });
  it("accepts meeting.booked med meeting_type", () => {
    expect(
      validateTrigger({ type: "meeting.booked", meeting_type: "demo" }).ok,
    ).toBe(true);
  });
  it("rejects meeting.booked med ugyldig meeting_type", () => {
    const r = validateTrigger({
      type: "meeting.booked",
      meeting_type: "lunch",
    });
    expect(r.ok).toBe(false);
  });
  it("accepts meeting.no_show", () => {
    expect(validateTrigger({ type: "meeting.no_show" }).ok).toBe(true);
  });
  it("accepts proposal.opened med proposal_id", () => {
    expect(
      validateTrigger({ type: "proposal.opened", proposal_id: "P-001" }).ok,
    ).toBe(true);
  });
  it("accepts contract.signed med provider", () => {
    expect(
      validateTrigger({ type: "contract.signed", provider: "docusign" }).ok,
    ).toBe(true);
  });
});

describe("triggerMatches — mig 0350 triggers", () => {
  it("email.opened uten email_id matcher alle åpninger", () => {
    expect(
      triggerMatches({ type: "email.opened" }, ev("email.opened", {})),
    ).toBe(true);
  });
  it("email.opened med email_id filtrerer", () => {
    const t: WorkflowTrigger = { type: "email.opened", email_id: "welcome" };
    expect(
      triggerMatches(t, ev("email.opened", { email_id: "welcome" })),
    ).toBe(true);
    expect(
      triggerMatches(t, ev("email.opened", { email_id: "different" })),
    ).toBe(false);
  });
  it("email.link_clicked matcher case-insensitive substring", () => {
    const t: WorkflowTrigger = {
      type: "email.link_clicked",
      link_url_pattern: "Pricing",
    };
    expect(
      triggerMatches(
        t,
        ev("email.link_clicked", { link_url: "https://x.com/pricing/pro" }),
      ),
    ).toBe(true);
    expect(
      triggerMatches(
        t,
        ev("email.link_clicked", { link_url: "https://x.com/about" }),
      ),
    ).toBe(false);
  });
  it("meeting.booked med meeting_type filtrerer", () => {
    const t: WorkflowTrigger = {
      type: "meeting.booked",
      meeting_type: "demo",
    };
    expect(
      triggerMatches(t, ev("meeting.booked", { meeting_type: "demo" })),
    ).toBe(true);
    expect(
      triggerMatches(t, ev("meeting.booked", { meeting_type: "discovery" })),
    ).toBe(false);
  });
  it("meeting.no_show matcher alle", () => {
    expect(
      triggerMatches({ type: "meeting.no_show" }, ev("meeting.no_show")),
    ).toBe(true);
  });
  it("proposal.opened med proposal_id filtrerer", () => {
    const t: WorkflowTrigger = {
      type: "proposal.opened",
      proposal_id: "P-001",
    };
    expect(
      triggerMatches(t, ev("proposal.opened", { proposal_id: "P-001" })),
    ).toBe(true);
    expect(
      triggerMatches(t, ev("proposal.opened", { proposal_id: "P-999" })),
    ).toBe(false);
  });
  it("contract.signed med provider filtrerer", () => {
    const t: WorkflowTrigger = {
      type: "contract.signed",
      provider: "docusign",
    };
    expect(
      triggerMatches(t, ev("contract.signed", { provider: "docusign" })),
    ).toBe(true);
    expect(
      triggerMatches(t, ev("contract.signed", { provider: "posten" })),
    ).toBe(false);
  });
});

// ─── Actions (validateAction) ─────────────────────────────────────────
describe("validateAction — mig 0350 actions", () => {
  it("schedule_call krever gyldig 'when'", () => {
    expect(
      validateAction({ type: "schedule_call", when: "in_2_days" }).ok,
    ).toBe(true);
    expect(
      validateAction({ type: "schedule_call", when: "2026-07-01T09:00:00Z" }).ok,
    ).toBe(true);
    expect(validateAction({ type: "schedule_call", when: "tomorrow" }).ok).toBe(
      false,
    );
    expect(validateAction({ type: "schedule_call", when: "" }).ok).toBe(false);
  });

  it("book_meeting krever gyldig when + valgfri meeting_type/duration", () => {
    expect(
      validateAction({ type: "book_meeting", when: "in_3_hours" }).ok,
    ).toBe(true);
    expect(
      validateAction({
        type: "book_meeting",
        when: "in_1_days",
        meeting_type: "demo",
        duration_minutes: 45,
      }).ok,
    ).toBe(true);
    expect(
      validateAction({
        type: "book_meeting",
        when: "in_1_days",
        duration_minutes: 9999,
      }).ok,
    ).toBe(false);
  });

  it("update_lead_fields krever fields-objekt med ≥1 nøkkel", () => {
    expect(
      validateAction({
        type: "update_lead_fields",
        fields: { phone: "+47 999" },
      }).ok,
    ).toBe(true);
    expect(
      validateAction({ type: "update_lead_fields", fields: {} }).ok,
    ).toBe(false);
    expect(validateAction({ type: "update_lead_fields" }).ok).toBe(false);
  });

  it("UPDATE_LEAD_FIELDS_WHITELIST inneholder kjernen + ikke farlige felt", () => {
    expect(UPDATE_LEAD_FIELDS_WHITELIST.has("phone")).toBe(true);
    expect(UPDATE_LEAD_FIELDS_WHITELIST.has("notes")).toBe(true);
    expect(UPDATE_LEAD_FIELDS_WHITELIST.has("deal_amount")).toBe(true);
    expect(UPDATE_LEAD_FIELDS_WHITELIST.has("archived_at")).toBe(false);
    expect(UPDATE_LEAD_FIELDS_WHITELIST.has("organization_id")).toBe(false);
    expect(UPDATE_LEAD_FIELDS_WHITELIST.has("id")).toBe(false);
    expect(UPDATE_LEAD_FIELDS_WHITELIST.has("owner_user_id")).toBe(false);
  });

  it("post_to_webhook krever destination_id", () => {
    expect(
      validateAction({ type: "post_to_webhook", destination_id: "uuid" }).ok,
    ).toBe(true);
    expect(validateAction({ type: "post_to_webhook" }).ok).toBe(false);
  });

  it("trigger_zapier krever destination_id, payload må være objekt", () => {
    expect(
      validateAction({ type: "trigger_zapier", destination_id: "uuid" }).ok,
    ).toBe(true);
    expect(
      validateAction({
        type: "trigger_zapier",
        destination_id: "uuid",
        payload: { foo: "bar" },
      }).ok,
    ).toBe(true);
    expect(
      validateAction({
        type: "trigger_zapier",
        destination_id: "uuid",
        payload: "string-not-allowed",
      }).ok,
    ).toBe(false);
  });

  it("send_internal_notification recipient: streng eller user_id-obj", () => {
    expect(
      validateAction({
        type: "send_internal_notification",
        recipient: "owner",
        title: "Hei",
      }).ok,
    ).toBe(true);
    expect(
      validateAction({
        type: "send_internal_notification",
        recipient: { user_id: "u-1" },
        title: "Hei",
      }).ok,
    ).toBe(true);
    expect(
      validateAction({
        type: "send_internal_notification",
        recipient: "carrier_pigeon",
        title: "Hei",
      }).ok,
    ).toBe(false);
    expect(
      validateAction({
        type: "send_internal_notification",
        recipient: "owner",
        title: "",
      }).ok,
    ).toBe(false);
  });

  it("remove_tag krever tag", () => {
    expect(validateAction({ type: "remove_tag", tag: "hot" }).ok).toBe(true);
    expect(validateAction({ type: "remove_tag" }).ok).toBe(false);
  });

  it("archive_lead — reason valgfri", () => {
    expect(validateAction({ type: "archive_lead" }).ok).toBe(true);
    expect(
      validateAction({ type: "archive_lead", reason: "kald" }).ok,
    ).toBe(true);
    expect(
      validateAction({ type: "archive_lead", reason: 123 }).ok,
    ).toBe(false);
  });

  it("revive_lead uten ekstra felt", () => {
    expect(validateAction({ type: "revive_lead" }).ok).toBe(true);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────
describe("resolveWhen", () => {
  it("parser ISO datetime", () => {
    const d = resolveWhen("2026-07-01T09:00:00Z");
    expect(d).toBeInstanceOf(Date);
    expect(d?.getUTCFullYear()).toBe(2026);
  });

  it("parser 'in_X_minutes'", () => {
    const before = Date.now();
    const d = resolveWhen("in_5_minutes");
    expect(d).toBeInstanceOf(Date);
    const diff = (d as Date).getTime() - before;
    // ~5min ± 1 sek
    expect(diff).toBeGreaterThanOrEqual(5 * 60_000 - 1000);
    expect(diff).toBeLessThanOrEqual(5 * 60_000 + 1000);
  });

  it("parser 'in_2_hours'", () => {
    const before = Date.now();
    const d = resolveWhen("in_2_hours");
    const diff = (d as Date).getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(2 * 3600_000 - 1000);
    expect(diff).toBeLessThanOrEqual(2 * 3600_000 + 1000);
  });

  it("parser 'in_3_days'", () => {
    const before = Date.now();
    const d = resolveWhen("in_3_days");
    const diff = (d as Date).getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(3 * 86400_000 - 1000);
    expect(diff).toBeLessThanOrEqual(3 * 86400_000 + 1000);
  });

  it("returnerer null for ugyldig", () => {
    expect(resolveWhen("tomorrow")).toBeNull();
    expect(resolveWhen("in_0_days")).toBeNull();
    expect(resolveWhen("in_X_days")).toBeNull();
  });
});

describe("renderTemplate", () => {
  it("substituterer {{lead.name}}", () => {
    expect(
      renderTemplate("Hei {{lead.name}}", ev("lead.created"), fakeLead),
    ).toBe("Hei Test AS");
  });

  it("substituterer {{lead.score}}, {{lead.city}}", () => {
    expect(
      renderTemplate(
        "{{lead.name}} (score {{lead.score}}, {{lead.city}})",
        ev("lead.created"),
        fakeLead,
      ),
    ).toBe("Test AS (score 75, Oslo)");
  });

  it("substituterer {{event.<key>}} fra event.data", () => {
    expect(
      renderTemplate(
        "Email: {{event.email_id}}",
        ev("email.opened", { email_id: "welcome" }),
        fakeLead,
      ),
    ).toBe("Email: welcome");
  });

  it("ukjent placeholder blir tom streng", () => {
    expect(
      renderTemplate("{{garbage.xxx}}", ev("lead.created"), fakeLead),
    ).toBe("");
  });

  it("null/undefined lead-felt blir tom streng", () => {
    expect(
      renderTemplate(
        "phone={{lead.phone}}",
        ev("lead.created"),
        fakeLead,
      ),
    ).toBe("phone=");
  });
});

describe("buildWebhookPayload", () => {
  it("default-shape inneholder workflow_id + event + lead", () => {
    const action: WorkflowAction = {
      type: "post_to_webhook",
      destination_id: "uuid",
    };
    const p = buildWebhookPayload(
      action,
      ev("lead.created", { foo: "bar" }),
      fakeLead,
      "wf-1",
    );
    expect(p.workflow_id).toBe("wf-1");
    expect((p.event as { type: string }).type).toBe("lead.created");
    expect((p.lead as { name: string }).name).toBe("Test AS");
  });

  it("post_to_webhook payload_template substituerer + parses som JSON", () => {
    const action: WorkflowAction = {
      type: "post_to_webhook",
      destination_id: "uuid",
      payload_template: '{"company": "{{lead.name}}", "score": "{{lead.score}}"}',
    };
    const p = buildWebhookPayload(action, ev("lead.created"), fakeLead, "wf-1");
    expect(p.company).toBe("Test AS");
    expect(p.score).toBe("75");
    // Base-felt skal fortsatt være med (merged)
    expect(p.workflow_id).toBe("wf-1");
  });

  it("ugyldig JSON i payload_template faller tilbake til default-shape", () => {
    const action: WorkflowAction = {
      type: "post_to_webhook",
      destination_id: "uuid",
      payload_template: "not-json",
    };
    const p = buildWebhookPayload(action, ev("lead.created"), fakeLead, "wf-1");
    expect(p.workflow_id).toBe("wf-1");
    // Ingen "company"-felt fra et brutt template
    expect(p.company).toBeUndefined();
  });

  it("trigger_zapier payload merges på default-shape", () => {
    const action: WorkflowAction = {
      type: "trigger_zapier",
      destination_id: "uuid",
      payload: { source: "leadgrid", priority: "high" },
    };
    const p = buildWebhookPayload(action, ev("lead.created"), fakeLead, "wf-1");
    expect(p.source).toBe("leadgrid");
    expect(p.priority).toBe("high");
    expect(p.workflow_id).toBe("wf-1");
  });
});

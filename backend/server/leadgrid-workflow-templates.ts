/**
 * leadgrid-workflow-templates.ts
 *
 * 10 forhåndsbygde workflow-templates som brukeren kan ta i bruk.
 * Templates returneres på GET /api/leadgrid/workflows/templates og kan
 * skapes til en faktisk workflow via POST /api/leadgrid/workflows
 * med template_key satt.
 */

import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowTrigger,
} from "./leadgrid-workflow-types.js";

export interface WorkflowTemplate {
  key: string;
  name: string;
  description: string;
  category: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "welcome_new_lead",
    name: "Velkommen-email til nye leads",
    description:
      "Send velkomst-email automatisk når en ny lead opprettes.",
    category: "Onboarding",
    trigger: { type: "lead.created" },
    conditions: [],
    actions: [{ type: "send_email", template_id: "welcome_lead" }],
  },
  {
    key: "escalate_hot_leads",
    name: "Eskaler hot leads til manager",
    description:
      "Når lead-temperature blir 'hot', varsle managers via Slack.",
    category: "Sales Velocity",
    trigger: { type: "lead.temperature_changed", to: "hot" },
    conditions: [],
    actions: [
      {
        type: "notify_channel",
        channel: "slack",
        message_template:
          "🔥 Hot lead: {{lead.name}} (score {{lead.score}}). Følg opp innen 24 t.",
      },
    ],
  },
  {
    key: "auto_followup_7_days",
    name: "Auto-follow-up etter 7 dager",
    description:
      "Send oppfølgings-email 7 dager etter lead opprettet hvis ikke noe har skjedd.",
    category: "Nurture",
    trigger: { type: "lead.created" },
    conditions: [],
    actions: [
      { type: "wait", duration_minutes: 60 * 24 * 7 },
      { type: "send_email", template_id: "followup_7d" },
    ],
  },
  {
    key: "meeting_confirmation_sms",
    name: "Meeting-bekreftelse SMS",
    description:
      "Send SMS når en lead bookes til møte (pipeline = meeting).",
    category: "Meetings",
    trigger: { type: "pipeline.stage_changed", to: "meeting" },
    conditions: [],
    actions: [{ type: "send_sms", template_id: "meeting_confirmation" }],
  },
  {
    key: "closing_celebration",
    name: "Closing-celebration",
    description:
      "Når en deal vinnes, varsle teamet til feiring.",
    category: "Wins",
    trigger: { type: "pipeline.stage_changed", to: "won" },
    conditions: [],
    actions: [
      {
        type: "notify_channel",
        channel: "slack",
        message_template:
          "🎉 Vunnet: {{lead.name}} — NOK {{deal.amount}}. Bra jobba!",
      },
    ],
  },
  {
    key: "lost_lead_recovery_30d",
    name: "Lost-lead recovery 30 dager",
    description:
      "30 dager etter tapt deal: send 'kan vi prøve igjen'-email.",
    category: "Re-engagement",
    trigger: { type: "pipeline.stage_changed", to: "lost" },
    conditions: [],
    actions: [
      { type: "wait", duration_minutes: 60 * 24 * 30 },
      { type: "send_email", template_id: "reengagement_30d" },
    ],
  },
  {
    key: "high_value_deal_alert",
    name: "High-value-deal alert",
    description:
      "Når probability ≥ 80 % og deal_amount > 100k, varsle manager.",
    category: "Sales Velocity",
    trigger: { type: "deal.probability_changed", min: 80 },
    conditions: [{ type: "deal.amount", op: ">", value: 100000 }],
    actions: [
      {
        type: "notify_channel",
        channel: "slack",
        message_template:
          "💎 High-value deal nær closing: {{lead.name}} ({{deal.probability}}% × NOK {{deal.amount}})",
      },
    ],
  },
  {
    key: "ai_pitch_auto_generate",
    name: "AI pitch auto-generate",
    description: "Generer AI pitch og lagre som lead-notat ved ny lead.",
    category: "AI Automation",
    trigger: { type: "lead.created" },
    conditions: [],
    actions: [{ type: "ai_pitch_generate", save_to_notes: true }],
  },
  {
    key: "tag_hospitality_restaurant",
    name: "Tag restaurants som 'hospitality'",
    description:
      "Auto-tag nye leads i bransjen 'restaurant' med tag 'hospitality'.",
    category: "Categorization",
    trigger: { type: "lead.created" },
    conditions: [{ type: "lead.industry_id", value: "restaurant" }],
    actions: [{ type: "add_tag", tag: "hospitality" }],
  },
  {
    key: "assign_by_industry_match",
    name: "Assign by industry",
    description:
      "Tildel nye leads til selger spesialisert på bransjen (manuell user_id til template).",
    category: "Routing",
    trigger: { type: "lead.created" },
    conditions: [],
    actions: [
      // user_id må fylles inn av brukeren ved template-instantiering
      { type: "assign_to_user", user_id: "REPLACE_WITH_USER_ID" },
    ],
  },

  // ─── Mig 0350 — 5 nye templates som bruker nye triggers/actions ─────
  {
    key: "email_engagement_escalation",
    name: "Email-engagement eskalering",
    description:
      "Når lead åpner en e-post, varsle owner i in-app feed slik at de kan følge opp mens engasjementet er ferskt.",
    category: "Engagement",
    trigger: { type: "email.opened" },
    conditions: [],
    actions: [
      {
        type: "send_internal_notification",
        recipient: "owner",
        title: "{{lead.name}} åpnet din e-post",
        body: "Trykk å følge opp mens leadet er aktivt (score {{lead.score}}).",
      },
    ],
  },
  {
    key: "click_to_call_pricing",
    name: "Click-til-call (pricing-side)",
    description:
      "Når lead klikker en lenke som inneholder 'pricing', planlegg automatisk en telefonsamtale 1 dag fram i tid.",
    category: "Sales Velocity",
    trigger: {
      type: "email.link_clicked",
      link_url_pattern: "pricing",
    },
    conditions: [],
    actions: [
      {
        type: "schedule_call",
        when: "in_1_days",
        notes: "Lead klikket pricing-lenke — sannsynlig kjøps-signal",
      },
      {
        type: "send_internal_notification",
        recipient: "owner",
        title: "Pricing-klikk fra {{lead.name}}",
        body: "Telefonsamtale planlagt i morgen.",
      },
    ],
  },
  {
    key: "no_show_recovery",
    name: "No-show recovery",
    description:
      "Når et møte markeres no_show: send rebook-email + planlegg oppfølgings-call 3 dager fram.",
    category: "Re-engagement",
    trigger: { type: "meeting.no_show" },
    conditions: [],
    actions: [
      { type: "send_email", template_id: "rebook_after_noshow" },
      {
        type: "schedule_call",
        when: "in_3_days",
        notes: "No-show recovery — bekreft før vi booker nytt møte",
      },
      {
        type: "send_internal_notification",
        recipient: "owner",
        title: "{{lead.name}} no-show — rebook-flow startet",
      },
    ],
  },
  {
    key: "auto_archive_cold_leads",
    name: "Auto-archive cold leads",
    description:
      "Kjøres manuelt eller via cron — arkiverer cold leads. Workflow er manuelt-trigget for fleksibilitet; cron-jobben velger leads.",
    category: "Hygiene",
    trigger: { type: "manual" },
    conditions: [{ type: "lead.temperature", value: "cold" }],
    actions: [
      {
        type: "archive_lead",
        reason: "Auto-archive (cold + inaktiv 90 dager)",
      },
    ],
  },
  {
    key: "contract_signed_celebration",
    name: "Contract-signed celebration",
    description:
      "Når en kontrakt signeres: varsle teamet, sett pipeline til 'won', og oppdater deal-felter for ren forecast.",
    category: "Wins",
    trigger: { type: "contract.signed" },
    conditions: [],
    actions: [
      {
        type: "notify_channel",
        channel: "slack",
        message_template:
          "🎉 Kontrakt signert: {{lead.name}} — NOK {{lead.deal_amount}}. Sett opp onboarding!",
      },
      { type: "change_pipeline_stage", stage: "won" },
      {
        type: "update_lead_fields",
        fields: { lead_status: "customer", lead_temperature: "ready" },
      },
      {
        type: "send_internal_notification",
        recipient: "manager",
        title: "Ny kunde signert: {{lead.name}}",
        body: "Belop: {{lead.deal_amount}}. Onboarding kan starte.",
      },
    ],
  },
];

export function findTemplate(key: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.key === key);
}

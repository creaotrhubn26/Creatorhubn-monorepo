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
];

export function findTemplate(key: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.key === key);
}

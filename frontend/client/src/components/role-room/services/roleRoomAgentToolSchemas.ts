/**
 * Frontend Zod schemas for the Role Room Agent's tool inputs.
 *
 * Mirror of the JSON Schema in backend/server/role-room-agent-definition.ts.
 * Backend trusts the Anthropic-side validation, but the agent occasionally
 * returns inputs that drift from the enum (hallucinated review_type,
 * out-of-range numbers). Validating before we hit our own write endpoints
 * keeps that drift from landing in the DB.
 *
 * Returns a discriminated `ToolValidationResult` so callers can branch on
 * `.ok` instead of try/catching ZodError.
 */

import { z } from 'zod';

const reviewTypeEnum = z.enum([
  'storyboard',
  'script',
  'casting',
  'rough_cut',
  'final_cut',
  'call_sheet',
  'budget',
]);

const phaseEnum = z.enum(['preproduction', 'production', 'postproduction']);
const entryTypeEnum = z.enum(['meeting', 'milestone', 'task', 'delivery']);
const briefFieldEnum = z.enum([
  'projectGoal',
  'targetAudience',
  'keyMessage',
  'deliverables',
  'timingConstraints',
  'referenceLinks',
  'brandNotes',
]);
const severityEnum = z.enum(['blocking', 'important', 'nice_to_have']);
const riskEnum = z.enum(['low', 'medium', 'high']);

export const draftReviewRequestSchema = z.object({
  review_type: reviewTypeEnum,
  title: z.string().min(1, 'title kan ikke være tom'),
  description: z.string().optional(),
  target_entity_type: z.string().optional(),
  target_entity_id: z.string().optional(),
  suggested_due_days_from_now: z.number().min(0).max(60).optional(),
});

export const proposeTimelineItemSchema = z.object({
  phase: phaseEnum,
  entry_type: entryTypeEnum,
  title: z.string().min(1, 'title kan ikke være tom'),
  description: z.string().optional(),
  suggested_due_days_from_now: z.number().min(0).max(365).optional(),
  rationale: z.string().min(1, 'rationale kan ikke være tom'),
});

export const summarizeBriefGapsSchema = z.object({
  notes: z.string().optional(),
  missing_fields: z
    .array(
      z.object({
        field: briefFieldEnum,
        severity: severityEnum,
        rationale: z.string(),
      }),
    )
    .min(1, 'minst ett felt må listes'),
});

export const flagScopeImpactSchema = z.object({
  change_summary: z.string().min(1),
  impacted_deliverables: z.array(z.string()).optional(),
  impacted_reviews: z.array(z.string()).optional(),
  risk: riskEnum,
});

export const suggestNextDecisionSchema = z.object({
  decision_title: z.string().min(1),
  why_now: z.string().min(1),
  blockers: z.array(z.string()).optional(),
  recommended_owner_role: z.string().optional(),
});

const communityChannelTypeEnum = z.enum([
  'product_hunt',
  'reddit',
  'indie_hackers',
  'beta_list',
  'hacker_news',
  'discord',
  'twitter',
  'linkedin',
  'blog',
  'other',
]);

/**
 * Agent-tool: generer utkast til en community-post per kanal-type.
 * Agenten kaller dette med kanal + topic + målgruppe, og forventer
 * en `{title, body}`-mal som den kan fylle ut dynamisk og foreslå
 * til admin. Backend-endpointet (`/api/admin/community/post-template`)
 * returnerer base-malen som agent-en bruker.
 */
export const generateCommunityPostSchema = z.object({
  channel_type: communityChannelTypeEnum,
  topic: z.string().min(1).max(200),
  audience: z.string().optional(),
  tone: z.enum(['professional', 'casual', 'enthusiastic', 'understated']).optional(),
});

export type DraftReviewRequestInput = z.infer<typeof draftReviewRequestSchema>;
export type ProposeTimelineItemInput = z.infer<typeof proposeTimelineItemSchema>;
export type SummarizeBriefGapsInput = z.infer<typeof summarizeBriefGapsSchema>;
export type FlagScopeImpactInput = z.infer<typeof flagScopeImpactSchema>;
export type SuggestNextDecisionInput = z.infer<typeof suggestNextDecisionSchema>;
export type GenerateCommunityPostInput = z.infer<typeof generateCommunityPostSchema>;

const TOOL_SCHEMAS = {
  draft_review_request: draftReviewRequestSchema,
  propose_timeline_item: proposeTimelineItemSchema,
  summarize_brief_gaps: summarizeBriefGapsSchema,
  flag_scope_impact: flagScopeImpactSchema,
  suggest_next_decision: suggestNextDecisionSchema,
  generate_community_post: generateCommunityPostSchema,
} as const;

export type RoleRoomAgentToolName = keyof typeof TOOL_SCHEMAS;

export type ToolValidationResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

/**
 * Validates a tool input against its schema. Unknown tool names pass
 * through untouched — the caller has already chosen to ignore them
 * (e.g. read-only tools that are never re-executed locally).
 */
export function validateAgentToolInput(
  toolName: string,
  input: unknown,
): ToolValidationResult {
  const schema = TOOL_SCHEMAS[toolName as RoleRoomAgentToolName];
  if (!schema) return { ok: true, data: input };
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}

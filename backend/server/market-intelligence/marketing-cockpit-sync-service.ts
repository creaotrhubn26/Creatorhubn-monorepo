/**
 * marketing-cockpit-sync-service.ts
 *
 * Broen mellom Market Intelligence og eksisterende Marketing Cockpit.
 *
 * Når brukeren klikker en CTA på en Opportunity ("Lag kampanje" / "Content
 * pack"), kjører vi:
 *
 *   1. Opprett en marketing_workflows-rad som binder opportunity ↔ aksjon
 *   2. Generer relevante drafts (vi GJENBRUKER marketing_post_drafts,
 *      eksisterende fra Marketing Cockpit — ingen ny tabell)
 *   3. Linke draft-IDene tilbake til workflow-en for sporbarhet
 *   4. Logg state-transitions i marketing_workflow_transitions
 *
 * Approval-flow: vi bruker eksisterende role-room-material-approval.
 * Drafts opprettes i status 'draft' (ikke published, ikke godkjent).
 */

import type { Pool } from "pg";
import { generateContentPack, type ContentPackItem } from "./content-pack-generator-service.js";
import { getBrandKit, toBaseline } from "../brand-kit-service.js";
import type { OpportunityRecommendation } from "./types.js";

export type WorkflowStatus =
  | "brand_scan_pending" | "brand_scan_completed"
  | "market_scan_ready" | "market_scan_running" | "market_scan_completed"
  | "opportunities_ready"
  | "campaign_draft_created" | "content_pack_created"
  | "approval_pending" | "approved" | "scheduled" | "published"
  | "analytics_collecting" | "analytics_completed"
  | "recommendations_updated";

export type WorkflowInitiatingAction =
  | "create_campaign" | "create_content_pack" | "create_funnel_map" | "send_to_agent";

export interface MarketingWorkflow {
  id: string;
  workspaceOwnerUserId: string;
  organizationId: string;
  projectId: string;
  brandKitId?: string | null;
  marketScanId?: string | null;
  opportunityId?: string | null;
  campaignDraftId?: number | null;
  contentPackDraftIds: number[];
  approvalTaskId?: string | null;
  publishingItemIds: number[];
  analyticsResultIds: number[];
  agentThreadId?: string | null;
  currentStatus: WorkflowStatus;
  nextRecommendedAction?: string | null;
  initiatingAction: WorkflowInitiatingAction;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowRow {
  id: string;
  workspace_owner_user_id: string;
  organization_id: string;
  // Every row returned by this service is project-scoped. Migration 0519
  // backfills legacy rows before these routes are deployed.
  project_id: string;
  brand_kit_id: string | null;
  market_scan_id: string | null;
  opportunity_id: string | null;
  campaign_draft_id: number | null;
  content_pack_draft_ids: number[];
  approval_task_id: string | null;
  publishing_item_ids: number[];
  analytics_result_ids: number[];
  agent_thread_id: string | null;
  current_status: WorkflowStatus;
  next_recommended_action: string | null;
  initiating_action: WorkflowInitiatingAction;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToWorkflow(r: WorkflowRow): MarketingWorkflow {
  return {
    id: r.id,
    workspaceOwnerUserId: r.workspace_owner_user_id,
    organizationId: r.organization_id,
    projectId: r.project_id,
    brandKitId: r.brand_kit_id,
    marketScanId: r.market_scan_id,
    opportunityId: r.opportunity_id,
    campaignDraftId: r.campaign_draft_id,
    contentPackDraftIds: r.content_pack_draft_ids ?? [],
    approvalTaskId: r.approval_task_id,
    publishingItemIds: r.publishing_item_ids ?? [],
    analyticsResultIds: r.analytics_result_ids ?? [],
    agentThreadId: r.agent_thread_id,
    currentStatus: r.current_status,
    nextRecommendedAction: r.next_recommended_action,
    initiatingAction: r.initiating_action,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Workflow CRUD
// ─────────────────────────────────────────────────────────────────────

interface CreateWorkflowInput {
  workspaceOwnerUserId: string;
  organizationId: string;
  projectId: string;
  brandKitId?: string | null;
  marketScanId: string;
  opportunityId: string;
  initiatingAction: WorkflowInitiatingAction;
}

async function createWorkflow(pool: Pool, input: CreateWorkflowInput): Promise<MarketingWorkflow> {
  const r = await pool.query<WorkflowRow>(
    `INSERT INTO marketing_workflows (
       workspace_owner_user_id, organization_id, project_id, brand_kit_id,
       market_scan_id, opportunity_id, initiating_action,
       current_status, next_recommended_action
     ) VALUES (
       $1, $2::uuid, $3, $4, $5::uuid, $6::uuid, $7,
       'opportunities_ready',
       'Sett opp utkast og legg i godkjenningskø'
     )
     RETURNING id::text, workspace_owner_user_id, organization_id::text, project_id,
       brand_kit_id::text, market_scan_id::text, opportunity_id::text,
       campaign_draft_id, content_pack_draft_ids, approval_task_id,
       publishing_item_ids, analytics_result_ids, agent_thread_id,
       current_status, next_recommended_action, initiating_action, notes,
       created_at::text, updated_at::text`,
    [
      input.workspaceOwnerUserId,
      input.organizationId,
      input.projectId,
      input.brandKitId ?? null,
      input.marketScanId,
      input.opportunityId,
      input.initiatingAction,
    ],
  );
  return rowToWorkflow(r.rows[0]);
}

async function transitionWorkflow(
  pool: Pool,
  args: {
    workflowId: string;
    toStatus: WorkflowStatus;
    triggeredByUserId?: string;
    note?: string;
    nextRecommendedAction?: string;
  },
): Promise<void> {
  // Hent gammel status for transition-log
  const prev = await pool.query<{ current_status: WorkflowStatus }>(
    `SELECT current_status FROM marketing_workflows WHERE id=$1::uuid`,
    [args.workflowId],
  );
  const fromStatus = prev.rows[0]?.current_status ?? null;

  await pool.query(
    `UPDATE marketing_workflows
        SET current_status = $2,
            next_recommended_action = COALESCE($3, next_recommended_action),
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [args.workflowId, args.toStatus, args.nextRecommendedAction ?? null],
  );

  await pool.query(
    `INSERT INTO marketing_workflow_transitions (
       workflow_id, from_status, to_status, triggered_by_user_id, note
     ) VALUES ($1::uuid, $2, $3, $4, $5)`,
    [args.workflowId, fromStatus, args.toStatus, args.triggeredByUserId ?? null, args.note ?? null],
  );
}

// ─────────────────────────────────────────────────────────────────────
// Opportunity lookup helper
// ─────────────────────────────────────────────────────────────────────

async function fetchOpportunity(
  pool: Pool,
  args: {
    opportunityId: string;
    marketScanId: string;
    organizationId: string;
    projectId: string;
  },
): Promise<OpportunityRecommendation | null> {
  const r = await pool.query(
    `SELECT opportunity.id::text, opportunity.market_scan_id::text,
            opportunity.title, opportunity.simple_summary,
            opportunity.why_it_matters, opportunity.evidence_summary,
            opportunity.recommended_action, opportunity.impact,
            opportunity.difficulty, opportunity.confidence,
            opportunity.can_create_campaign,
            opportunity.can_create_content_pack,
            opportunity.can_create_funnel_map,
            opportunity.source_competitor_ids,
            opportunity.source_technique_ids
       FROM market_scan_opportunities opportunity
       JOIN market_scans scan ON scan.id = opportunity.market_scan_id
      WHERE opportunity.id = $1::uuid
        AND opportunity.market_scan_id = $2::uuid
        AND scan.organization_id = $3::uuid
        AND scan.project_id = $4
      LIMIT 1`,
    [args.opportunityId, args.marketScanId, args.organizationId, args.projectId],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    marketScanId: row.market_scan_id,
    title: row.title,
    simpleSummary: row.simple_summary,
    whyItMatters: row.why_it_matters,
    evidenceSummary: row.evidence_summary,
    recommendedAction: row.recommended_action,
    impact: row.impact,
    difficulty: row.difficulty,
    confidence: row.confidence,
    canCreateCampaign: row.can_create_campaign,
    canCreateContentPack: row.can_create_content_pack,
    canCreateFunnelMap: row.can_create_funnel_map,
    sourceCompetitorIds: row.source_competitor_ids ?? [],
    sourceTechniqueIds: row.source_technique_ids ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export interface CreateCampaignArgs {
  workspaceOwnerUserId: string;
  organizationId: string;
  projectId: string;
  marketScanId: string;
  brandKey: string; // Autoritativ `leadgrid:<projectId>`-nøkkel for kundeprosjektet.
  opportunityId: string;
}

/** Opprett et marketing_post_drafts som en "kampanje-utkast" knyttet til
 *  opportunity. Returnerer workflow-en. */
export async function createCampaignFromOpportunity(
  pool: Pool,
  args: CreateCampaignArgs,
): Promise<{ workflow: MarketingWorkflow; draftId: number }> {
  const opp = await fetchOpportunity(pool, args);
  if (!opp) throw new Error("opportunity_not_found");

  const brand = args.projectId ? await getBrandKit(pool, args.projectId) : null;
  const baseline = brand ? toBaseline(brand) : null;

  // 1. Workflow
  const wf = await createWorkflow(pool, {
    workspaceOwnerUserId: args.workspaceOwnerUserId,
    organizationId: args.organizationId,
    projectId: args.projectId,
    brandKitId: brand?.id ?? null,
    marketScanId: opp.marketScanId,
    opportunityId: opp.id,
    initiatingAction: "create_campaign",
  });

  // 2. Lag en LinkedIn-draft som kampanjens utkast (most-likely-channel for B2B-marketing)
  const caption = `${opp.title}\n\n${opp.simpleSummary}\n\n${opp.recommendedAction}`;
  const hashtags = baseline?.industry
    ? [baseline.industry.replace(/\s+/g, "")].slice(0, 1)
    : [];

  const draftR = await pool.query<{ id: number }>(
    `INSERT INTO marketing_post_drafts (
       brand_key, organization_id, leadgrid_project_id, created_by_user_id,
       platform, status, caption, hashtags, image_brief,
       cta_text, generated_with_model, cost_nok
     ) VALUES ($1, $2::uuid, $3, $4, 'linkedin', 'draft', $5, $6::jsonb, $7, $8, 'claude-opus-4-7', 0)
     RETURNING id`,
    [
      args.brandKey,
      args.organizationId,
      args.projectId,
      args.workspaceOwnerUserId,
      caption.slice(0, 3000),
      JSON.stringify(hashtags),
      `Visuelt forslag: ${opp.whyItMatters.slice(0, 200)}`,
      baseline?.primaryCTA ?? "Les mer",
    ],
  );
  const draftId = draftR.rows[0].id;

  // 3. Link draft til workflow + transition
  await pool.query(
    `UPDATE marketing_workflows SET campaign_draft_id=$2 WHERE id=$1::uuid`,
    [wf.id, draftId],
  );
  await transitionWorkflow(pool, {
    workflowId: wf.id,
    toStatus: "campaign_draft_created",
    triggeredByUserId: args.workspaceOwnerUserId,
    note: `Kampanje-utkast opprettet (draft #${draftId})`,
    nextRecommendedAction: "Send til godkjenning via Marketing Cockpit",
  });

  const refreshed = await getWorkflow(pool, wf.id, args);
  return { workflow: refreshed!, draftId };
}

export interface CreateContentPackArgs {
  workspaceOwnerUserId: string;
  organizationId: string;
  projectId: string;
  marketScanId: string;
  brandKey: string;
  opportunityId: string;
}

export async function createContentPackFromOpportunity(
  pool: Pool,
  args: CreateContentPackArgs,
): Promise<{ workflow: MarketingWorkflow; draftIds: number[]; items: ContentPackItem[] }> {
  const opp = await fetchOpportunity(pool, args);
  if (!opp) throw new Error("opportunity_not_found");

  const brand = args.projectId ? await getBrandKit(pool, args.projectId) : null;
  const baseline = brand ? toBaseline(brand) : null;

  // 1. Workflow
  const wf = await createWorkflow(pool, {
    workspaceOwnerUserId: args.workspaceOwnerUserId,
    organizationId: args.organizationId,
    projectId: args.projectId,
    brandKitId: brand?.id ?? null,
    marketScanId: opp.marketScanId,
    opportunityId: opp.id,
    initiatingAction: "create_content_pack",
  });

  // 2. Claude genererer content pack
  const pack = await generateContentPack(opp, baseline);

  // 3. Lagre hver item som marketing_post_drafts (gjenbruk eksisterende!)
  const draftIds: number[] = [];
  for (const item of pack.items) {
    const platformMapped =
      ["facebook", "instagram", "linkedin", "tiktok"].includes(item.platform)
        ? item.platform
        : "linkedin"; // fallback for email/web
    const r = await pool.query<{ id: number }>(
      `INSERT INTO marketing_post_drafts (
         brand_key, organization_id, leadgrid_project_id, created_by_user_id,
         platform, status, caption, hashtags, image_brief,
         cta_text, generated_with_model, cost_nok
       ) VALUES ($1, $2::uuid, $3, $4, $5, 'draft', $6, $7::jsonb, $8, $9, 'claude-opus-4-7', 0)
       RETURNING id`,
      [
        args.brandKey,
        args.organizationId,
        args.projectId,
        args.workspaceOwnerUserId,
        platformMapped,
        `[${item.title}]\n\n${item.body}`.slice(0, 3000),
        JSON.stringify(item.hashtags ?? []),
        item.imageBrief ?? null,
        item.ctaText ?? null,
      ],
    );
    draftIds.push(r.rows[0].id);
  }

  // 4. Link til workflow + transition
  await pool.query(
    `UPDATE marketing_workflows SET content_pack_draft_ids=$2 WHERE id=$1::uuid`,
    [wf.id, draftIds],
  );
  await transitionWorkflow(pool, {
    workflowId: wf.id,
    toStatus: "content_pack_created",
    triggeredByUserId: args.workspaceOwnerUserId,
    note: `Content pack: ${draftIds.length} drafts (${pack.summary})`,
    nextRecommendedAction: "Velg ut + tilpass drafts før godkjenning",
  });

  const refreshed = await getWorkflow(pool, wf.id, args);
  return { workflow: refreshed!, draftIds, items: pack.items };
}

export async function createFunnelMapFromOpportunity(
  pool: Pool,
  args: {
    workspaceOwnerUserId: string;
    organizationId: string;
    projectId: string;
    marketScanId: string;
    opportunityId: string;
  },
): Promise<MarketingWorkflow> {
  const opp = await fetchOpportunity(pool, args);
  if (!opp) throw new Error("opportunity_not_found");

  const wf = await createWorkflow(pool, {
    workspaceOwnerUserId: args.workspaceOwnerUserId,
    organizationId: args.organizationId,
    projectId: args.projectId,
    brandKitId: null,
    marketScanId: opp.marketScanId,
    opportunityId: opp.id,
    initiatingAction: "create_funnel_map",
  });
  await transitionWorkflow(pool, {
    workflowId: wf.id,
    toStatus: "campaign_draft_created",
    triggeredByUserId: args.workspaceOwnerUserId,
    note: "Funnel map markert som under utvikling — implementerer i Fase 4b",
    nextRecommendedAction: "Bygg ut funnel-design i kommende fase",
  });
  return (await getWorkflow(pool, wf.id, args))!;
}

export async function sendOpportunityToAgent(
  pool: Pool,
  args: {
    workspaceOwnerUserId: string;
    organizationId: string;
    projectId: string;
    marketScanId: string;
    opportunityId: string;
    agentThreadId?: string;
  },
): Promise<MarketingWorkflow> {
  const opp = await fetchOpportunity(pool, args);
  if (!opp) throw new Error("opportunity_not_found");

  const wf = await createWorkflow(pool, {
    workspaceOwnerUserId: args.workspaceOwnerUserId,
    organizationId: args.organizationId,
    projectId: args.projectId,
    brandKitId: null,
    marketScanId: opp.marketScanId,
    opportunityId: opp.id,
    initiatingAction: "send_to_agent",
  });
  if (args.agentThreadId) {
    await pool.query(
      `UPDATE marketing_workflows SET agent_thread_id=$2 WHERE id=$1::uuid`,
      [wf.id, args.agentThreadId],
    );
  }
  await transitionWorkflow(pool, {
    workflowId: wf.id,
    toStatus: "opportunities_ready",
    triggeredByUserId: args.workspaceOwnerUserId,
    note: "Opportunity tilgjengelig i Role Room Agent-kontekst",
    nextRecommendedAction: "Spør Agent om campaign-utkast",
  });
  return (await getWorkflow(pool, wf.id, args))!;
}

// ─────────────────────────────────────────────────────────────────────
// Read helpers
// ─────────────────────────────────────────────────────────────────────

export async function getWorkflow(
  pool: Pool,
  workflowId: string,
  scope: {
    workspaceOwnerUserId: string;
    organizationId: string;
    projectId: string;
  },
): Promise<MarketingWorkflow | null> {
  const r = await pool.query<WorkflowRow>(
    `SELECT id::text, workspace_owner_user_id, organization_id::text, project_id,
            brand_kit_id::text, market_scan_id::text, opportunity_id::text,
            campaign_draft_id, content_pack_draft_ids, approval_task_id,
            publishing_item_ids, analytics_result_ids, agent_thread_id,
            current_status, next_recommended_action, initiating_action, notes,
            created_at::text, updated_at::text
      FROM marketing_workflows
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3`,
    [workflowId, scope.organizationId, scope.projectId],
  );
  if (r.rows.length === 0) return null;
  return rowToWorkflow(r.rows[0]);
}

export async function listWorkflowsForOpportunity(
  pool: Pool,
  args: {
    opportunityId: string;
    workspaceOwnerUserId: string;
    organizationId: string;
    projectId: string;
  },
): Promise<MarketingWorkflow[]> {
  const r = await pool.query<WorkflowRow>(
    `SELECT id::text, workspace_owner_user_id, organization_id::text, project_id,
            brand_kit_id::text, market_scan_id::text, opportunity_id::text,
            campaign_draft_id, content_pack_draft_ids, approval_task_id,
            publishing_item_ids, analytics_result_ids, agent_thread_id,
            current_status, next_recommended_action, initiating_action, notes,
            created_at::text, updated_at::text
       FROM marketing_workflows
      WHERE opportunity_id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3
      ORDER BY created_at DESC`,
    [args.opportunityId, args.organizationId, args.projectId],
  );
  return r.rows.map(rowToWorkflow);
}

export async function listWorkflowsForUser(
  pool: Pool,
  args: {
    workspaceOwnerUserId: string;
    organizationId: string;
    projectId: string;
    limit?: number;
  },
): Promise<MarketingWorkflow[]> {
  const r = await pool.query<WorkflowRow>(
    `SELECT id::text, workspace_owner_user_id, organization_id::text, project_id,
            brand_kit_id::text, market_scan_id::text, opportunity_id::text,
            campaign_draft_id, content_pack_draft_ids, approval_task_id,
            publishing_item_ids, analytics_result_ids, agent_thread_id,
            current_status, next_recommended_action, initiating_action, notes,
            created_at::text, updated_at::text
      FROM marketing_workflows
      WHERE organization_id = $1::uuid
        AND project_id = $2
      ORDER BY updated_at DESC
      LIMIT $3`,
    [args.organizationId, args.projectId, args.limit ?? 100],
  );
  return r.rows.map(rowToWorkflow);
}

/**
 * leadgrid-momentum-service.ts
 *
 * Momentum Engine — bryter ned sales-mål til daglige aktiviteter og
 * måler en composite "momentum-score" 0-100 basert på faktisk aktivitet.
 *
 * Vekting:
 *   activity 40% + velocity 30% + decay-prevention 20% - overdue 10%
 *
 * Avhengigheter (alle eksisterer):
 *   - crm_lead_activities (alle interaksjoner per kunde)
 *   - crm_customers (pipeline_stage, lead_temperature, organization_id)
 *   - lead_recommendations (NBA m/ expires_at + snoozed_until)
 *   - leadgrid_project_sales_goals + leadgrid_project_momentum_snapshots (mig 0538)
 */

import type { Pool } from "pg";

export interface SalesGoal {
  organizationId: string;
  projectId: string;
  yearMonth: string;
  revenueTarget: number | null;
  dealsTarget: number | null;
  meetingsTarget: number | null;
  proposalsTarget: number | null;
  dailyContactsTarget: number;
  dailyFollowupsTarget: number;
  dailyMeetingsTarget: number;
  dailyPipelineMovesTarget: number;
  monthlyLeadsNeeded: number | null;
  notes: string | null;
}

export interface MomentumScore {
  organizationId: string;
  projectId: string;
  date: string;
  score: number;                          // 0-100 composite
  breakdown: {
    activityScore: number;                // 0-100, weight 40%
    velocityScore: number;                // 0-100, weight 30%
    decayScore: number;                   // 0-100, weight 20%
    overduePenalty: number;               // 0-10, weight -10%
  };
  todayActivity: {
    contacts: number;
    contactsTarget: number;
    followups: number;
    followupsTarget: number;
    meetings: number;
    meetingsTarget: number;
    pipelineMoves: number;
    pipelineMovesTarget: number;
    // Granulære tellere (undersett av contacts) — brukes av iPad
    // «Aktivitet i dag»-kortet som viser Telefoner/E-poster/Besøk separat.
    calls: number;
    emails: number;
    visits: number;
  };
  overdueNbas: number;
  trend: "rising" | "stable" | "falling"; // sammenlignet m/ gårsdagens score
  nextBestActions: Array<{
    type: string;
    label: string;
    urgency: "low" | "normal" | "high";
    count?: number;
  }>;
  reasoning: string;
}

const DEFAULT_GOAL: Omit<SalesGoal, "organizationId" | "projectId" | "yearMonth"> = {
  revenueTarget: null,
  dealsTarget: 3,
  meetingsTarget: 10,
  proposalsTarget: 5,
  dailyContactsTarget: 3,
  dailyFollowupsTarget: 5,
  dailyMeetingsTarget: 1,
  dailyPipelineMovesTarget: 2,
  monthlyLeadsNeeded: null,
  notes: null,
};

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Hent eller opprett mål for ett prosjekt for nåværende måned.
 * Hvis ingen finnes: opprett m/ defaults + auto-utregnet leads-needed.
 */
export async function getOrCreateGoal(
  pool: Pool,
  organizationId: string,
  projectId: string,
  yearMonth = currentYearMonth(),
): Promise<SalesGoal> {
  const ym = normalizedYearMonth(yearMonth);
  const r = await pool.query(
    `SELECT *
       FROM leadgrid_project_sales_goals
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND year_month = $3
      LIMIT 1`,
    [organizationId, projectId, ym],
  );
  if (r.rowCount && r.rows[0]) {
    return mapGoalRow(r.rows[0]);
  }

  // Opprett m/ defaults + auto-leads-needed basert på prosjektets win-rate.
  const winRateR = await pool.query<{ win_rate: string | null }>(
    `SELECT
       COUNT(*) FILTER (WHERE pipeline_stage = 'won')::float8 /
         NULLIF(COUNT(*)::float8, 0) AS win_rate
       FROM crm_customers
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND archived_at IS NULL
        AND created_at > NOW() - INTERVAL '180 days'`,
    [organizationId, projectId],
  );
  const winRate = Number(winRateR.rows[0]?.win_rate) || 0.05;  // default 5%
  const dealsTarget = DEFAULT_GOAL.dealsTarget!;
  const monthlyLeadsNeeded = Math.max(20, Math.ceil(dealsTarget / winRate));

  const ins = await pool.query(
    `INSERT INTO leadgrid_project_sales_goals
       (organization_id, project_id, year_month, revenue_target, deals_target,
        meetings_target, proposals_target,
        daily_contacts_target, daily_followups_target,
        daily_meetings_target, daily_pipeline_moves_target,
        monthly_leads_needed)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (organization_id, project_id, year_month) DO NOTHING
     RETURNING *`,
    [
      organizationId, projectId, ym,
      DEFAULT_GOAL.revenueTarget, DEFAULT_GOAL.dealsTarget,
      DEFAULT_GOAL.meetingsTarget, DEFAULT_GOAL.proposalsTarget,
      DEFAULT_GOAL.dailyContactsTarget, DEFAULT_GOAL.dailyFollowupsTarget,
      DEFAULT_GOAL.dailyMeetingsTarget, DEFAULT_GOAL.dailyPipelineMovesTarget,
      monthlyLeadsNeeded,
    ],
  );
  if (ins.rows[0]) return mapGoalRow(ins.rows[0]);

  // A concurrent request may have inserted the same project/month first.
  const raced = await pool.query(
    `SELECT *
       FROM leadgrid_project_sales_goals
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND year_month = $3
      LIMIT 1`,
    [organizationId, projectId, ym],
  );
  if (!raced.rows[0]) throw new Error("momentum_goal_upsert_failed");
  return mapGoalRow(raced.rows[0]);
}

export type SalesGoalPatch = Partial<
  Omit<SalesGoal, "organizationId" | "projectId">
> & { notes?: string | null };

export async function setGoal(
  pool: Pool,
  organizationId: string,
  projectId: string,
  userId: string,
  patch: SalesGoalPatch,
): Promise<SalesGoal> {
  const ym = normalizedYearMonth(patch.yearMonth ?? currentYearMonth());
  const existing = await getOrCreateGoal(pool, organizationId, projectId, ym);
  const merged: SalesGoal = {
    organizationId,
    projectId,
    yearMonth: ym,
    revenueTarget: patch.revenueTarget === undefined
      ? existing.revenueTarget
      : patch.revenueTarget,
    dealsTarget: patch.dealsTarget === undefined
      ? existing.dealsTarget
      : patch.dealsTarget,
    meetingsTarget: patch.meetingsTarget === undefined
      ? existing.meetingsTarget
      : patch.meetingsTarget,
    proposalsTarget: patch.proposalsTarget === undefined
      ? existing.proposalsTarget
      : patch.proposalsTarget,
    dailyContactsTarget: patch.dailyContactsTarget
      ?? existing.dailyContactsTarget,
    dailyFollowupsTarget: patch.dailyFollowupsTarget
      ?? existing.dailyFollowupsTarget,
    dailyMeetingsTarget: patch.dailyMeetingsTarget
      ?? existing.dailyMeetingsTarget,
    dailyPipelineMovesTarget: patch.dailyPipelineMovesTarget
      ?? existing.dailyPipelineMovesTarget,
    monthlyLeadsNeeded: patch.monthlyLeadsNeeded === undefined
      ? existing.monthlyLeadsNeeded
      : patch.monthlyLeadsNeeded,
    notes: patch.notes === undefined ? existing.notes : patch.notes,
  };

  const updated = await pool.query(
    `UPDATE leadgrid_project_sales_goals
        SET revenue_target = $1, deals_target = $2,
            meetings_target = $3, proposals_target = $4,
            daily_contacts_target = $5, daily_followups_target = $6,
            daily_meetings_target = $7, daily_pipeline_moves_target = $8,
            monthly_leads_needed = $9,
            notes = $10,
            set_by_user_id = $11,
            updated_at = NOW()
      WHERE organization_id = $12::uuid
        AND project_id = $13
        AND year_month = $14
      RETURNING *`,
    [
      merged.revenueTarget, merged.dealsTarget,
      merged.meetingsTarget, merged.proposalsTarget,
      merged.dailyContactsTarget, merged.dailyFollowupsTarget,
      merged.dailyMeetingsTarget, merged.dailyPipelineMovesTarget,
      merged.monthlyLeadsNeeded,
      merged.notes,
      userId,
      organizationId, projectId, ym,
    ],
  );
  if (!updated.rows[0]) throw new Error("momentum_goal_update_failed");
  return mapGoalRow(updated.rows[0]);
}

function normalizedYearMonth(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    throw new Error("invalid_year_month");
  }
  return normalized;
}

/**
 * Compute momentum-score for ett prosjekt for i dag.
 * Vekting:
 *   activity 40% + velocity 30% + decay-prevention 20% - overdue 10%
 */
export async function computeTodayMomentum(
  pool: Pool,
  organizationId: string,
  projectId: string,
): Promise<MomentumScore> {
  const goal = await getOrCreateGoal(pool, organizationId, projectId);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Activity-count i dag
  const activityR = await pool.query<{
    contacts: string; followups: string; meetings: string; pipeline_moves: string;
    calls: string; emails: string; visits: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE activity.activity_type IN ('visit_logged','email_sent','call_made','sms_sent'))::text AS contacts,
       COUNT(*) FILTER (WHERE activity.activity_type IN ('note_added','status_changed'))::text AS followups,
       COUNT(*) FILTER (WHERE activity.activity_type IN ('meeting_scheduled','meeting_recap'))::text AS meetings,
       COUNT(*) FILTER (WHERE activity.activity_type = 'status_changed' AND activity.new_value IN ('qualified','meeting','proposal','negotiation','won'))::text AS pipeline_moves,
       COUNT(*) FILTER (WHERE activity.activity_type = 'call_made')::text AS calls,
       COUNT(*) FILTER (WHERE activity.activity_type = 'email_sent')::text AS emails,
       COUNT(*) FILTER (WHERE activity.activity_type = 'visit_logged')::text AS visits
       FROM crm_lead_activities activity
       JOIN crm_customers customer
         ON customer.id = activity.customer_id
      WHERE customer.organization_id = $1::uuid
        AND customer.project_id = $2
        AND customer.archived_at IS NULL
        AND activity.created_at::date = CURRENT_DATE`,
    [organizationId, projectId],
  );
  const a = activityR.rows[0];
  const contacts = Number(a.contacts);
  const followups = Number(a.followups);
  const meetings = Number(a.meetings);
  const pipelineMoves = Number(a.pipeline_moves);
  const calls = Number(a.calls);
  const emails = Number(a.emails);
  const visits = Number(a.visits);

  // Activity-score: progress mot daglig target, klippes til 0-100
  const activityCompletion =
    (Math.min(1, contacts / Math.max(1, goal.dailyContactsTarget)) * 0.30) +
    (Math.min(1, followups / Math.max(1, goal.dailyFollowupsTarget)) * 0.30) +
    (Math.min(1, meetings / Math.max(1, goal.dailyMeetingsTarget)) * 0.25) +
    (Math.min(1, pipelineMoves / Math.max(1, goal.dailyPipelineMovesTarget)) * 0.15);
  const activityScore = activityCompletion * 100;

  // 2. Velocity-score: andel av aktive deals som beveget seg de siste 7d
  const velocityR = await pool.query<{ moved: string; total: string }>(
    `SELECT
       (
         SELECT COUNT(DISTINCT activity.customer_id)
           FROM crm_lead_activities activity
           JOIN crm_customers customer
             ON customer.id = activity.customer_id
          WHERE customer.organization_id = $1::uuid
            AND customer.project_id = $2
            AND customer.archived_at IS NULL
            AND activity.activity_type = 'status_changed'
            AND activity.created_at > NOW() - INTERVAL '7 days'
       )::text AS moved,
       (SELECT COUNT(*) FROM crm_customers
         WHERE organization_id = $1::uuid
           AND project_id = $2
           AND archived_at IS NULL
           AND pipeline_stage IN ('first_contact','qualified','meeting','proposal','negotiation'))::text AS total
      `,
    [organizationId, projectId],
  );
  const moved = Number(velocityR.rows[0].moved);
  const totalActive = Math.max(1, Number(velocityR.rows[0].total));
  const velocityScore = Math.min(100, (moved / totalActive) * 100);

  // 3. Decay-prevention: andel hot/ready-leads som er kontaktet siste 7d
  const decayR = await pool.query<{ contacted_hot: string; total_hot: string }>(
    `SELECT
       (SELECT COUNT(*) FROM crm_customers
         WHERE organization_id = $1::uuid
           AND project_id = $2
           AND archived_at IS NULL
           AND lead_temperature IN ('hot','ready')
           AND last_contacted_at > NOW() - INTERVAL '7 days')::text AS contacted_hot,
       (SELECT COUNT(*) FROM crm_customers
         WHERE organization_id = $1::uuid
           AND project_id = $2
           AND archived_at IS NULL
           AND lead_temperature IN ('hot','ready'))::text AS total_hot`,
    [organizationId, projectId],
  );
  const contactedHot = Number(decayR.rows[0].contacted_hot);
  const totalHot = Math.max(1, Number(decayR.rows[0].total_hot));
  const decayScore = (contactedHot / totalHot) * 100;

  // 4. Overdue penalty: antall NBA-pending med expires_at < NOW()
  const overdueR = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM lead_recommendations recommendation
       JOIN crm_customers customer
         ON customer.id = recommendation.lead_id
      WHERE recommendation.organization_id = $1::uuid
        AND recommendation.project_id = $2
        AND customer.organization_id = $1::uuid
        AND customer.project_id = $2
        AND customer.project_id = recommendation.project_id
        AND customer.archived_at IS NULL
        AND recommendation.status = 'pending'
        AND recommendation.expires_at IS NOT NULL
        AND recommendation.expires_at < NOW()
        AND (recommendation.snoozed_until IS NULL OR recommendation.snoozed_until < NOW())`,
    [organizationId, projectId],
  );
  const overdueNbas = Number(overdueR.rows[0].count);
  const overduePenalty = Math.min(10, overdueNbas * 2);  // cap på 10 poeng straff

  // Composite
  const score = Math.max(0, Math.min(100,
    (activityScore * 0.40) +
    (velocityScore * 0.30) +
    (decayScore * 0.20) -
    overduePenalty,
  ));

  // 5. Trend vs i går
  const yesterday = await pool.query<{ momentum_score: string }>(
    `SELECT momentum_score::text
       FROM leadgrid_project_momentum_snapshots
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND snapshot_date = CURRENT_DATE - INTERVAL '1 day'
      LIMIT 1`,
    [organizationId, projectId],
  );
  const yesterdayScore = yesterday.rowCount ? Number(yesterday.rows[0].momentum_score) : score;
  const diff = score - yesterdayScore;
  const trend: "rising" | "stable" | "falling" =
    diff > 5 ? "rising" : diff < -5 ? "falling" : "stable";

  // 6. Next Best Actions for å lukke gap
  const nextBestActions: Array<{ type: string; label: string; urgency: "low" | "normal" | "high"; count?: number }> = [];
  if (contacts < goal.dailyContactsTarget) {
    nextBestActions.push({
      type: "contact_more",
      label: `Kontakt ${goal.dailyContactsTarget - contacts} nye leads`,
      urgency: "high",
      count: goal.dailyContactsTarget - contacts,
    });
  }
  if (followups < goal.dailyFollowupsTarget) {
    nextBestActions.push({
      type: "do_followups",
      label: `Følg opp ${goal.dailyFollowupsTarget - followups} varme leads`,
      urgency: contacts < goal.dailyContactsTarget ? "normal" : "high",
      count: goal.dailyFollowupsTarget - followups,
    });
  }
  if (decayScore < 50) {
    nextBestActions.push({
      type: "prevent_decay",
      label: `${totalHot - contactedHot} hot/ready leads har ikke vært kontaktet på 7d`,
      urgency: "high",
      count: totalHot - contactedHot,
    });
  }
  if (overdueNbas > 0) {
    nextBestActions.push({
      type: "clear_overdue",
      label: `Rydd ${overdueNbas} overdue NBA-anbefalinger`,
      urgency: "high",
      count: overdueNbas,
    });
  }
  if (meetings < goal.dailyMeetingsTarget) {
    nextBestActions.push({
      type: "book_meeting",
      label: `Book minst ${goal.dailyMeetingsTarget - meetings} møte`,
      urgency: "normal",
      count: goal.dailyMeetingsTarget - meetings,
    });
  }

  // 7. Reasoning
  let reasoning: string;
  if (score >= 80) {
    reasoning = `Momentum er sterkt (${Math.round(score)}%). Du er på riktig vei mot ${goal.dealsTarget ?? "?"} salg denne måneden.`;
  } else if (score >= 50) {
    reasoning = `Momentum er OK (${Math.round(score)}%) men kan bli bedre. ${nextBestActions[0]?.label ?? "Fortsett."}`;
  } else {
    reasoning = `Momentum faller (${Math.round(score)}%). ${nextBestActions[0]?.label ?? "Kontakt flere leads nå."}`;
  }

  // Snapshot for trend-historikk (UPSERT)
  await pool.query(
    `INSERT INTO leadgrid_project_momentum_snapshots
       (organization_id, project_id, snapshot_date, momentum_score,
        activity_score, velocity_score, decay_score, overdue_penalty,
        contacts_today, followups_today, meetings_today, pipeline_moves_today, overdue_nbas)
     VALUES ($1::uuid, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (organization_id, project_id, snapshot_date) DO UPDATE SET
       momentum_score = EXCLUDED.momentum_score,
       activity_score = EXCLUDED.activity_score,
       velocity_score = EXCLUDED.velocity_score,
       decay_score = EXCLUDED.decay_score,
       overdue_penalty = EXCLUDED.overdue_penalty,
       contacts_today = EXCLUDED.contacts_today,
       followups_today = EXCLUDED.followups_today,
       meetings_today = EXCLUDED.meetings_today,
       pipeline_moves_today = EXCLUDED.pipeline_moves_today,
       overdue_nbas = EXCLUDED.overdue_nbas,
       computed_at = NOW()`,
    [
      organizationId, projectId, score, activityScore, velocityScore, decayScore, overduePenalty,
      contacts, followups, meetings, pipelineMoves, overdueNbas,
    ],
  );

  return {
    organizationId,
    projectId,
    date: today,
    score,
    breakdown: {
      activityScore,
      velocityScore,
      decayScore,
      overduePenalty,
    },
    todayActivity: {
      contacts, contactsTarget: goal.dailyContactsTarget,
      followups, followupsTarget: goal.dailyFollowupsTarget,
      meetings, meetingsTarget: goal.dailyMeetingsTarget,
      pipelineMoves, pipelineMovesTarget: goal.dailyPipelineMovesTarget,
      calls, emails, visits,
    },
    overdueNbas,
    trend,
    nextBestActions: nextBestActions.slice(0, 4),  // top 4
    reasoning,
  };
}

function mapGoalRow(row: Record<string, unknown>): SalesGoal {
  return {
    organizationId: String(row.organization_id),
    projectId: String(row.project_id),
    yearMonth: String(row.year_month),
    revenueTarget: row.revenue_target !== null ? Number(row.revenue_target) : null,
    dealsTarget: row.deals_target !== null ? Number(row.deals_target) : null,
    meetingsTarget: row.meetings_target !== null ? Number(row.meetings_target) : null,
    proposalsTarget: row.proposals_target !== null ? Number(row.proposals_target) : null,
    dailyContactsTarget: Number(row.daily_contacts_target),
    dailyFollowupsTarget: Number(row.daily_followups_target),
    dailyMeetingsTarget: Number(row.daily_meetings_target),
    dailyPipelineMovesTarget: Number(row.daily_pipeline_moves_target),
    monthlyLeadsNeeded: row.monthly_leads_needed !== null
      ? Number(row.monthly_leads_needed)
      : null,
    notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
  };
}

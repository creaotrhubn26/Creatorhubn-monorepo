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
 *   - leadgrid_org_sales_goals + leadgrid_momentum_snapshots (mig 327)
 */

import type { Pool } from "pg";

export interface SalesGoal {
  organizationId: string;
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
}

export interface MomentumScore {
  organizationId: string;
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

const DEFAULT_GOAL: Omit<SalesGoal, "organizationId" | "yearMonth"> = {
  revenueTarget: null,
  dealsTarget: 3,
  meetingsTarget: 10,
  proposalsTarget: 5,
  dailyContactsTarget: 3,
  dailyFollowupsTarget: 5,
  dailyMeetingsTarget: 1,
  dailyPipelineMovesTarget: 2,
  monthlyLeadsNeeded: null,
};

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Hent eller opprett goal for org for nåværende måned.
 * Hvis ingen finnes: opprett m/ defaults + auto-utregnet leads-needed.
 */
export async function getOrCreateGoal(pool: Pool, organizationId: string): Promise<SalesGoal> {
  const ym = currentYearMonth();
  const r = await pool.query(
    `SELECT * FROM leadgrid_org_sales_goals
      WHERE organization_id = $1::uuid AND year_month = $2 LIMIT 1`,
    [organizationId, ym],
  );
  if (r.rowCount && r.rows[0]) {
    return mapGoalRow(r.rows[0]);
  }
  // Opprett m/ defaults + auto-leads-needed basert på historisk win-rate
  const winRateR = await pool.query<{ win_rate: string | null }>(
    `SELECT
       COUNT(*) FILTER (WHERE pipeline_stage = 'won')::float8 /
         NULLIF(COUNT(*)::float8, 0) AS win_rate
       FROM crm_customers
      WHERE organization_id = $1::uuid AND archived_at IS NULL
        AND created_at > NOW() - INTERVAL '180 days'`,
    [organizationId],
  );
  const winRate = Number(winRateR.rows[0]?.win_rate) || 0.05;  // default 5%
  const dealsTarget = DEFAULT_GOAL.dealsTarget!;
  const monthlyLeadsNeeded = Math.max(20, Math.ceil(dealsTarget / winRate));

  const ins = await pool.query(
    `INSERT INTO leadgrid_org_sales_goals
       (organization_id, year_month, revenue_target, deals_target,
        meetings_target, proposals_target,
        daily_contacts_target, daily_followups_target,
        daily_meetings_target, daily_pipeline_moves_target,
        monthly_leads_needed)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      organizationId, ym,
      DEFAULT_GOAL.revenueTarget, DEFAULT_GOAL.dealsTarget,
      DEFAULT_GOAL.meetingsTarget, DEFAULT_GOAL.proposalsTarget,
      DEFAULT_GOAL.dailyContactsTarget, DEFAULT_GOAL.dailyFollowupsTarget,
      DEFAULT_GOAL.dailyMeetingsTarget, DEFAULT_GOAL.dailyPipelineMovesTarget,
      monthlyLeadsNeeded,
    ],
  );
  return mapGoalRow(ins.rows[0]);
}

export async function setGoal(
  pool: Pool,
  organizationId: string,
  userId: string,
  patch: Partial<SalesGoal> & { notes?: string },
): Promise<SalesGoal> {
  const ym = patch.yearMonth ?? currentYearMonth();
  const existing = await getOrCreateGoal(pool, organizationId);
  const merged = { ...existing, ...patch, yearMonth: ym };

  await pool.query(
    `UPDATE leadgrid_org_sales_goals
        SET revenue_target = $1, deals_target = $2,
            meetings_target = $3, proposals_target = $4,
            daily_contacts_target = $5, daily_followups_target = $6,
            daily_meetings_target = $7, daily_pipeline_moves_target = $8,
            monthly_leads_needed = $9,
            notes = $10,
            set_by_user_id = $11,
            updated_at = NOW()
      WHERE organization_id = $12::uuid AND year_month = $13`,
    [
      merged.revenueTarget, merged.dealsTarget,
      merged.meetingsTarget, merged.proposalsTarget,
      merged.dailyContactsTarget, merged.dailyFollowupsTarget,
      merged.dailyMeetingsTarget, merged.dailyPipelineMovesTarget,
      merged.monthlyLeadsNeeded,
      patch.notes ?? null,
      userId,
      organizationId, ym,
    ],
  );
  return merged;
}

/**
 * Compute momentum-score for org for i dag.
 * Vekting:
 *   activity 40% + velocity 30% + decay-prevention 20% - overdue 10%
 */
export async function computeTodayMomentum(
  pool: Pool,
  organizationId: string,
): Promise<MomentumScore> {
  const goal = await getOrCreateGoal(pool, organizationId);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Activity-count i dag
  const activityR = await pool.query<{
    contacts: string; followups: string; meetings: string; pipeline_moves: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE activity_type IN ('visit_logged','email_sent','call_made','sms_sent'))::text AS contacts,
       COUNT(*) FILTER (WHERE activity_type IN ('note_added','status_changed') AND created_at::date = CURRENT_DATE)::text AS followups,
       COUNT(*) FILTER (WHERE activity_type IN ('meeting_scheduled','meeting_recap'))::text AS meetings,
       COUNT(*) FILTER (WHERE activity_type = 'status_changed' AND new_value IN ('qualified','meeting','proposal','negotiation','won'))::text AS pipeline_moves
       FROM crm_lead_activities
       WHERE customer_id IN (SELECT id FROM crm_customers WHERE organization_id = $1::uuid)
         AND created_at::date = CURRENT_DATE`,
    [organizationId],
  );
  const a = activityR.rows[0];
  const contacts = Number(a.contacts);
  const followups = Number(a.followups);
  const meetings = Number(a.meetings);
  const pipelineMoves = Number(a.pipeline_moves);

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
       COUNT(DISTINCT customer_id) FILTER (WHERE activity_type = 'status_changed'
         AND created_at > NOW() - INTERVAL '7 days')::text AS moved,
       (SELECT COUNT(*) FROM crm_customers
         WHERE organization_id = $1::uuid AND archived_at IS NULL
           AND pipeline_stage IN ('first_contact','qualified','meeting','proposal','negotiation'))::text AS total
       FROM crm_lead_activities
       WHERE customer_id IN (SELECT id FROM crm_customers WHERE organization_id = $1::uuid)`,
    [organizationId],
  );
  const moved = Number(velocityR.rows[0].moved);
  const totalActive = Math.max(1, Number(velocityR.rows[0].total));
  const velocityScore = Math.min(100, (moved / totalActive) * 100);

  // 3. Decay-prevention: andel hot/ready-leads som er kontaktet siste 7d
  const decayR = await pool.query<{ contacted_hot: string; total_hot: string }>(
    `SELECT
       (SELECT COUNT(*) FROM crm_customers
         WHERE organization_id = $1::uuid AND archived_at IS NULL
           AND lead_temperature IN ('hot','ready')
           AND last_contacted_at > NOW() - INTERVAL '7 days')::text AS contacted_hot,
       (SELECT COUNT(*) FROM crm_customers
         WHERE organization_id = $1::uuid AND archived_at IS NULL
           AND lead_temperature IN ('hot','ready'))::text AS total_hot`,
    [organizationId],
  );
  const contactedHot = Number(decayR.rows[0].contacted_hot);
  const totalHot = Math.max(1, Number(decayR.rows[0].total_hot));
  const decayScore = (contactedHot / totalHot) * 100;

  // 4. Overdue penalty: antall NBA-pending med expires_at < NOW()
  const overdueR = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM lead_recommendations
       WHERE organization_id = $1::uuid AND status = 'pending'
         AND expires_at IS NOT NULL AND expires_at < NOW()
         AND (snoozed_until IS NULL OR snoozed_until < NOW())`,
    [organizationId],
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
    `SELECT momentum_score::text FROM leadgrid_momentum_snapshots
      WHERE organization_id = $1::uuid AND snapshot_date = CURRENT_DATE - INTERVAL '1 day' LIMIT 1`,
    [organizationId],
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
  void pool.query(
    `INSERT INTO leadgrid_momentum_snapshots
       (organization_id, snapshot_date, momentum_score,
        activity_score, velocity_score, decay_score, overdue_penalty,
        contacts_today, followups_today, meetings_today, pipeline_moves_today, overdue_nbas)
     VALUES ($1::uuid, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (organization_id, snapshot_date) DO UPDATE SET
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
      organizationId, score, activityScore, velocityScore, decayScore, overduePenalty,
      contacts, followups, meetings, pipelineMoves, overdueNbas,
    ],
  ).catch((err) => console.warn("[momentum] snapshot upsert feilet:", err));

  return {
    organizationId,
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
    yearMonth: String(row.year_month),
    revenueTarget: row.revenue_target !== null ? Number(row.revenue_target) : null,
    dealsTarget: row.deals_target as number | null,
    meetingsTarget: row.meetings_target as number | null,
    proposalsTarget: row.proposals_target as number | null,
    dailyContactsTarget: row.daily_contacts_target as number,
    dailyFollowupsTarget: row.daily_followups_target as number,
    dailyMeetingsTarget: row.daily_meetings_target as number,
    dailyPipelineMovesTarget: row.daily_pipeline_moves_target as number,
    monthlyLeadsNeeded: row.monthly_leads_needed as number | null,
  };
}

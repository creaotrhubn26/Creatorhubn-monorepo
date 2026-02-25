/**
 * Role Room Learning Engine
 *
 * Makes The Role Room understand users and teams over time.
 * "Always learning" — every interaction feeds the intelligence.
 *
 * Eight engines:
 *   1. Interaction Logger     — records every meaningful action
 *   2. User Insight Engine    — computes creative DNA, work patterns, decision style
 *   3. Team Dynamics Engine   — discovers crew chemistry, reliability, pairing synergy
 *   4. Project Pattern Engine — detects recurring production habits
 *   5. Preference Learner     — auto-detects specific preferences from behavior
 *   6. Smart Crew Suggestions — recommend crew based on learned team dynamics
 *   7. Team Chemistry Predict — predict how well a proposed crew will work together
 *   8. Project Setup Intel    — pre-fill new project from learned patterns
 */

import { Pool } from 'pg';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface InteractionEvent {
  userId: string;
  projectId?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  context?: Record<string, unknown>;
  sessionId?: string;
  durationMs?: number;
}

export interface UserInsights {
  userId: string;
  creativeDna: {
    preferredGenres: string[];
    visualSignatures: string[];
    narrativeTendencies: string[];
    genreComfort: Record<string, number>;
  };
  workPatterns: {
    avgSessionHours: number;
    peakHours: number[];
    preferredDay: string;
    sprintTendency: number;
    planningToExecutionRatio: number;
    totalSessions: number;
  };
  decisionPatterns: {
    revisionFrequency: 'low' | 'medium' | 'high';
    delegationTendency: number;
    areasOfFocus: string[];
    approvalSpeed: 'fast' | 'moderate' | 'deliberate';
  };
  communicationStyle: {
    responseTimeAvgMin: number;
    detailLevel: 'concise' | 'moderate' | 'detailed';
    notificationResponsiveness: Record<string, number>;
  };
  skillTrajectory: {
    projectComplexityTrend: 'increasing' | 'stable' | 'decreasing';
    teamSizeTrend: 'growing' | 'stable' | 'shrinking';
    newCapabilities: string[];
    growthRate: number;
  };
  engagementMetrics: {
    totalProjects: number;
    totalSessions: number;
    avgProjectDurationDays: number;
    featuresUsed: Record<string, number>;
    lastActive: string;
    memberSinceDays: number;
  };
  confidenceScore: number;
  totalEventsAnalyzed: number;
  computedAt: string;
}

export interface TeamMember {
  id: number;
  userId: string | null;
  crewMemberName: string | null;
  crewRole: string;
  crewDepartment: string | null;
  collaborationCount: number;
  projectIds: string[];
  totalDaysTogether: number;
  synergyScore: number;
  reliabilityScore: number;
  rehireRate: number | null;
  preferredPairing: string[];
  strengths: string[];
  notesSummary: string | null;
}

export interface ProjectPattern {
  id: number;
  patternType: string;
  patternKey: string;
  patternData: Record<string, unknown>;
  description: string;
  confidence: number;
  evidenceCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface LearnedPreference {
  id: number;
  preferenceKey: string;
  preferenceValue: string;
  preferenceType: 'auto' | 'confirmed';
  category: string;
  confidence: number;
  evidenceCount: number;
}

export interface TeamReport {
  members: TeamMember[];
  topPairings: Array<{ names: string[]; projects: number; synergy: number }>;
  departmentCoverage: Record<string, number>;
  reliabilityAvg: number;
  insights: string[];
}

export interface LearningSnapshot {
  userInsights: UserInsights | null;
  teamReport: TeamReport;
  patterns: ProjectPattern[];
  preferences: LearnedPreference[];
  greeting: string;
  nudges: string[];
}

// ── Smart Crew Suggestion types ──

export interface CrewSuggestion {
  name: string;
  role: string;
  department: string | null;
  score: number;
  reasons: string[];
  collaborationCount: number;
  reliabilityScore: number;
  synergyWithOthers: Array<{ name: string; synergy: number }>;
}

export interface DreamTeam {
  members: CrewSuggestion[];
  overallChemistry: number;
  missingRoles: string[];
  insights: string[];
}

// ── Team Chemistry prediction types ──

export interface ChemistryPrediction {
  overallScore: number;
  pairScores: Array<{ a: string; b: string; score: number; history: number }>;
  risks: string[];
  strengths: string[];
  unknownMembers: string[];
  suggestion: string;
}

// ── Intelligent Project Setup types ──

export interface ProjectSetupSuggestion {
  suggestedGenre: string | null;
  suggestedProjectType: string | null;
  suggestedBudget: number | null;
  suggestedCurrency: string | null;
  suggestedCallTime: string | null;
  suggestedCrewRoles: string[];
  suggestedCrewNames: Array<{ name: string; role: string; reason: string }>;
  confidence: number;
  basedOn: number;
}

// ── Learning Timeline types ──

export interface TimelineEvent {
  date: string;
  type: 'project_created' | 'crew_added' | 'milestone' | 'pattern_discovered' | 'preference_learned' | 'insight';
  title: string;
  description: string;
  data?: Record<string, unknown>;
}

export interface LearningTimeline {
  events: TimelineEvent[];
  milestones: TimelineEvent[];
  growthSummary: string;
}

// ─────────────────────────────────────────────────────────────
// Day names (Norwegian)
// ─────────────────────────────────────────────────────────────

const DAG = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];

// ── Helper labels ──

function patternTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    crew_preference: 'Crew-preferanse',
    team_composition: 'Teamsammensetning',
    budget_pattern: 'Budsjettmønster',
    genre_tendency: 'Sjangertendens',
    location_preference: 'Lokasjonspreferanse',
  };
  return labels[type] || type;
}

function prefKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    default_call_time: 'Standard oppmøtetid',
    preferred_currency: 'Foretrukket valuta',
    preferred_project_type: 'Prosjekttype',
    top_equipment_categories: 'Utstyrskategorier',
    core_departments: 'Kjerneavdelinger',
  };
  return labels[key] || key.replace(/_/g, ' ');
}

// ═══════════════════════════════════════════════════════════════
// Service Class
// ═══════════════════════════════════════════════════════════════

export class RoleRoomLearningService {
  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────
  // 1. INTERACTION LOGGER
  // ─────────────────────────────────────────────────────────────

  async logInteraction(event: InteractionEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO roleroom_interaction_log
         (user_id, project_id, event_type, entity_type, entity_id, context, session_id, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.userId,
        event.projectId || null,
        event.eventType,
        event.entityType || null,
        event.entityId || null,
        JSON.stringify(event.context || {}),
        event.sessionId || null,
        event.durationMs || null,
      ]
    );
  }

  async logBatch(events: InteractionEvent[]): Promise<void> {
    if (events.length === 0) return;
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const e of events) {
      placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7})`);
      values.push(e.userId, e.projectId || null, e.eventType, e.entityType || null, e.entityId || null, JSON.stringify(e.context || {}), e.sessionId || null, e.durationMs || null);
      idx += 8;
    }
    await this.pool.query(
      `INSERT INTO roleroom_interaction_log
         (user_id, project_id, event_type, entity_type, entity_id, context, session_id, duration_ms)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  }

  async getRecentActivity(userId: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    const res = await this.pool.query(
      `SELECT * FROM roleroom_interaction_log
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. USER INSIGHT ENGINE
  // ─────────────────────────────────────────────────────────────

  async computeUserInsights(userId: string): Promise<UserInsights> {
    // ── Gather raw data from multiple sources ──

    // Total interactions
    const totalRes = await this.pool.query(
      'SELECT COUNT(*) as total FROM roleroom_interaction_log WHERE user_id = $1',
      [userId]
    );
    const totalEvents = Number(totalRes.rows[0]?.total) || 0;

    // Projects
    const projRes = await this.pool.query(
      `SELECT COUNT(DISTINCT project_id) as project_count,
              MIN(created_at) as first_project,
              MAX(created_at) as last_project
       FROM roleroom_interaction_log WHERE user_id = $1 AND project_id IS NOT NULL`,
      [userId]
    );
    const projectCount = Number(projRes.rows[0]?.project_count) || 0;

    // Also check casting_projects directly
    const castingProjRes = await this.pool.query(
      `SELECT COUNT(*) as cnt,
              array_agg(DISTINCT genre) FILTER (WHERE genre IS NOT NULL) as genres,
              array_agg(DISTINCT project_type) FILTER (WHERE project_type IS NOT NULL) as types
       FROM casting_projects WHERE created_by = $1`,
      [userId]
    );
    const totalProjects = Math.max(projectCount, Number(castingProjRes.rows[0]?.cnt) || 0);
    const genres: string[] = castingProjRes.rows[0]?.genres || [];
    const projectTypes: string[] = castingProjRes.rows[0]?.types || [];

    // Session analysis (group interactions by hour)
    const hourRes = await this.pool.query(
      `SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as cnt
       FROM roleroom_interaction_log WHERE user_id = $1
       GROUP BY hour ORDER BY cnt DESC`,
      [userId]
    );
    const peakHours = hourRes.rows.slice(0, 4).map((r: Record<string, unknown>) => Number(r.hour));

    // Day of week analysis
    const dayRes = await this.pool.query(
      `SELECT EXTRACT(DOW FROM created_at) as dow, COUNT(*) as cnt
       FROM roleroom_interaction_log WHERE user_id = $1
       GROUP BY dow ORDER BY cnt DESC LIMIT 1`,
      [userId]
    );
    const preferredDow = dayRes.rows[0] ? Number(dayRes.rows[0].dow) : 1;

    // Session duration estimation (group by session_id or 30-min gaps)
    const sessionRes = await this.pool.query(
      `SELECT COUNT(DISTINCT session_id) as sessions,
              AVG(duration_ms) as avg_duration
       FROM roleroom_interaction_log
       WHERE user_id = $1 AND session_id IS NOT NULL`,
      [userId]
    );
    const totalSessions = Number(sessionRes.rows[0]?.sessions) || Math.max(1, Math.floor(totalEvents / 15));
    const avgSessionMs = Number(sessionRes.rows[0]?.avg_duration) || 0;
    const avgSessionHours = avgSessionMs > 0 ? avgSessionMs / 3600000 : Math.min(totalEvents * 2 / 60 / totalSessions, 8);

    // Feature usage breakdown
    const featureRes = await this.pool.query(
      `SELECT entity_type, COUNT(*) as cnt
       FROM roleroom_interaction_log WHERE user_id = $1 AND entity_type IS NOT NULL
       GROUP BY entity_type ORDER BY cnt DESC`,
      [userId]
    );
    const featuresUsed: Record<string, number> = {};
    for (const row of featureRes.rows) {
      featuresUsed[row.entity_type as string] = Number(row.cnt);
    }

    // Decision pattern: revision frequency (count updates vs creates)
    const decisionRes = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type LIKE '%.create') as creates,
         COUNT(*) FILTER (WHERE event_type LIKE '%.update' OR event_type LIKE '%.edit') as updates,
         COUNT(*) FILTER (WHERE event_type LIKE '%.delete') as deletes,
         COUNT(*) FILTER (WHERE event_type LIKE '%.assign' OR event_type LIKE '%.delegate') as delegates
       FROM roleroom_interaction_log WHERE user_id = $1`,
      [userId]
    );
    const creates = Number(decisionRes.rows[0]?.creates) || 0;
    const updates = Number(decisionRes.rows[0]?.updates) || 0;
    const delegates = Number(decisionRes.rows[0]?.delegates) || 0;
    const revisionRatio = creates > 0 ? updates / creates : 0;
    const revisionFrequency: 'low' | 'medium' | 'high' = revisionRatio < 0.5 ? 'low' : revisionRatio < 2 ? 'medium' : 'high';
    const delegationTendency = totalEvents > 0 ? Math.min(delegates / totalEvents, 1) : 0;

    // Top focus areas (most interacted entity types)
    const areasOfFocus = featureRes.rows.slice(0, 4).map((r: Record<string, unknown>) => r.entity_type as string);

    // Team size trend (crew counts across projects)
    const teamRes = await this.pool.query(
      `SELECT p.id, p.name, COUNT(c.id) as crew_count, p.created_at
       FROM casting_projects p
       LEFT JOIN casting_crew c ON c.project_id = p.id
       WHERE p.created_by = $1
       GROUP BY p.id, p.name, p.created_at
       ORDER BY p.created_at`,
      [userId]
    );
    let teamSizeTrend: 'growing' | 'stable' | 'shrinking' = 'stable';
    if (teamRes.rows.length >= 3) {
      const sizes = teamRes.rows.map((r: Record<string, unknown>) => Number(r.crew_count));
      const firstHalf = sizes.slice(0, Math.floor(sizes.length / 2));
      const secondHalf = sizes.slice(Math.floor(sizes.length / 2));
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (avgSecond > avgFirst * 1.2) teamSizeTrend = 'growing';
      else if (avgSecond < avgFirst * 0.8) teamSizeTrend = 'shrinking';
    }

    // Complexity trend (budget, crew size, # scenes)
    const complexRes = await this.pool.query(
      `SELECT p.id, p.budget, COUNT(DISTINCT s.id) as scene_count, p.created_at
       FROM casting_projects p
       LEFT JOIN casting_scenes s ON s.project_id = p.id
       WHERE p.created_by = $1
       GROUP BY p.id, p.budget, p.created_at
       ORDER BY p.created_at`,
      [userId]
    );
    let complexityTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (complexRes.rows.length >= 3) {
      const scores = complexRes.rows.map((r: Record<string, unknown>) => (Number(r.budget) || 0) / 10000 + Number(r.scene_count));
      const half = Math.floor(scores.length / 2);
      const avgEarly = scores.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const avgLate = scores.slice(half).reduce((a, b) => a + b, 0) / (scores.length - half);
      if (avgLate > avgEarly * 1.15) complexityTrend = 'increasing';
      else if (avgLate < avgEarly * 0.85) complexityTrend = 'decreasing';
    }

    // New capabilities (scene types, equipment categories used recently but not before)
    const capRes = await this.pool.query(
      `SELECT DISTINCT context->>'scene_type' as cap
       FROM roleroom_interaction_log
       WHERE user_id = $1 AND context->>'scene_type' IS NOT NULL
         AND created_at > now() - interval '90 days'
       EXCEPT
       SELECT DISTINCT context->>'scene_type'
       FROM roleroom_interaction_log
       WHERE user_id = $1 AND context->>'scene_type' IS NOT NULL
         AND created_at <= now() - interval '90 days'`,
      [userId]
    );
    const newCapabilities = capRes.rows.map((r: Record<string, unknown>) => r.cap as string).filter(Boolean);

    // Visual signatures from equipment usage
    const visualRes = await this.pool.query(
      `SELECT context->>'visual_style' as style, COUNT(*) as cnt
       FROM roleroom_interaction_log
       WHERE user_id = $1 AND context->>'visual_style' IS NOT NULL
       GROUP BY style ORDER BY cnt DESC LIMIT 5`,
      [userId]
    );
    const visualSignatures = visualRes.rows.map((r: Record<string, unknown>) => r.style as string);

    // Genre comfort (scoring based on project count per genre)
    const genreComfort: Record<string, number> = {};
    if (genres.length > 0) {
      const maxCount = totalProjects || 1;
      for (const g of genres) {
        const gRes = await this.pool.query(
          'SELECT COUNT(*) as cnt FROM casting_projects WHERE created_by = $1 AND genre = $2',
          [userId, g]
        );
        genreComfort[g] = Math.min(Number(gRes.rows[0]?.cnt || 0) / maxCount + 0.3, 1);
      }
    }

    // Member since
    const memberRes = await this.pool.query(
      `SELECT created_at FROM users WHERE id = $1`,
      [userId]
    );
    const memberSince = memberRes.rows[0]?.created_at || new Date();
    const memberSinceDays = Math.floor((Date.now() - new Date(memberSince).getTime()) / 86400000);

    // Last active
    const lastActiveRes = await this.pool.query(
      `SELECT MAX(created_at) as last FROM roleroom_interaction_log WHERE user_id = $1`,
      [userId]
    );

    // Avg project duration
    const durationRes = await this.pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(end_date, now()) - start_date)) / 86400) as avg_days
       FROM casting_projects
       WHERE created_by = $1 AND start_date IS NOT NULL`,
      [userId]
    );
    const avgProjectDays = Number(durationRes.rows[0]?.avg_days) || 0;

    // Planning vs execution ratio
    const planRes = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type LIKE 'schedule.%' OR event_type LIKE 'plan.%') as planning,
         COUNT(*) FILTER (WHERE event_type LIKE 'shoot.%' OR event_type LIKE 'production.%' OR event_type LIKE 'checkout.%') as execution
       FROM roleroom_interaction_log WHERE user_id = $1`,
      [userId]
    );
    const planning = Number(planRes.rows[0]?.planning) || 0;
    const execution = Number(planRes.rows[0]?.execution) || 0;
    const planRatio = (planning + execution) > 0 ? planning / (planning + execution) : 0.5;

    // Confidence based on data volume
    const confidence = Math.min(0.15 + totalEvents * 0.002 + totalProjects * 0.05, 0.95);

    const insights: UserInsights = {
      userId,
      creativeDna: {
        preferredGenres: genres,
        visualSignatures,
        narrativeTendencies: projectTypes,
        genreComfort,
      },
      workPatterns: {
        avgSessionHours: Math.round(avgSessionHours * 10) / 10,
        peakHours,
        preferredDay: DAG[preferredDow] || 'Mandag',
        sprintTendency: revisionRatio > 1.5 ? 0.8 : revisionRatio > 0.8 ? 0.5 : 0.3,
        planningToExecutionRatio: Math.round(planRatio * 100) / 100,
        totalSessions,
      },
      decisionPatterns: {
        revisionFrequency,
        delegationTendency: Math.round(delegationTendency * 100) / 100,
        areasOfFocus,
        approvalSpeed: revisionRatio < 0.3 ? 'fast' : revisionRatio < 1.5 ? 'moderate' : 'deliberate',
      },
      communicationStyle: {
        responseTimeAvgMin: 0, // would need notification response tracking
        detailLevel: totalEvents > 100 ? 'detailed' : totalEvents > 30 ? 'moderate' : 'concise',
        notificationResponsiveness: {},
      },
      skillTrajectory: {
        projectComplexityTrend: complexityTrend,
        teamSizeTrend,
        newCapabilities,
        growthRate: totalProjects > 0 ? Math.min(newCapabilities.length / totalProjects, 1) : 0,
      },
      engagementMetrics: {
        totalProjects,
        totalSessions,
        avgProjectDurationDays: Math.round(avgProjectDays),
        featuresUsed,
        lastActive: lastActiveRes.rows[0]?.last?.toISOString?.() || new Date().toISOString(),
        memberSinceDays,
      },
      confidenceScore: confidence,
      totalEventsAnalyzed: totalEvents,
      computedAt: new Date().toISOString(),
    };

    // Save to DB
    await this.pool.query(
      `INSERT INTO roleroom_user_insights
         (user_id, creative_dna, work_patterns, decision_patterns, communication_style,
          skill_trajectory, engagement_metrics, confidence_score, total_events_analyzed, computed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
       ON CONFLICT (user_id) DO UPDATE SET
         creative_dna = $2, work_patterns = $3, decision_patterns = $4,
         communication_style = $5, skill_trajectory = $6, engagement_metrics = $7,
         confidence_score = $8, total_events_analyzed = $9, computed_at = now(), updated_at = now()`,
      [
        userId,
        JSON.stringify(insights.creativeDna),
        JSON.stringify(insights.workPatterns),
        JSON.stringify(insights.decisionPatterns),
        JSON.stringify(insights.communicationStyle),
        JSON.stringify(insights.skillTrajectory),
        JSON.stringify(insights.engagementMetrics),
        confidence,
        totalEvents,
      ]
    );

    return insights;
  }

  async getUserInsights(userId: string): Promise<UserInsights | null> {
    const res = await this.pool.query(
      'SELECT * FROM roleroom_user_insights WHERE user_id = $1',
      [userId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      userId: r.user_id,
      creativeDna: r.creative_dna || {},
      workPatterns: r.work_patterns || {},
      decisionPatterns: r.decision_patterns || {},
      communicationStyle: r.communication_style || {},
      skillTrajectory: r.skill_trajectory || {},
      engagementMetrics: r.engagement_metrics || {},
      confidenceScore: r.confidence_score,
      totalEventsAnalyzed: r.total_events_analyzed,
      computedAt: r.computed_at?.toISOString?.() || r.computed_at,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. TEAM DYNAMICS ENGINE
  // ─────────────────────────────────────────────────────────────

  async computeTeamDynamics(userId: string): Promise<TeamReport> {
    // Gather all crew across all of a user's projects
    const crewRes = await this.pool.query(
      `SELECT c.name, c.role, c.department, c.project_id, p.name as project_name,
              c.notes, c.created_at
       FROM casting_crew c
       JOIN casting_projects p ON p.id = c.project_id
       WHERE p.created_by = $1
       ORDER BY c.name, c.created_at`,
      [userId]
    );

    if (crewRes.rows.length === 0) {
      return { members: [], topPairings: [], departmentCoverage: {}, reliabilityAvg: 0, insights: ['Ingen teammedlemmer registrert ennå.'] };
    }

    // Group by crew member name to build profiles
    const memberMap = new Map<string, {
      name: string;
      roles: Set<string>;
      depts: Set<string>;
      projects: Set<string>;
      projectNames: string[];
      notes: string[];
      firstSeen: Date;
      lastSeen: Date;
    }>();

    for (const row of crewRes.rows) {
      const name = row.name as string;
      const existing = memberMap.get(name);
      if (existing) {
        existing.roles.add(row.role);
        if (row.department) existing.depts.add(row.department);
        existing.projects.add(row.project_id);
        existing.projectNames.push(row.project_name);
        if (row.notes) existing.notes.push(row.notes);
        const d = new Date(row.created_at);
        if (d < existing.firstSeen) existing.firstSeen = d;
        if (d > existing.lastSeen) existing.lastSeen = d;
      } else {
        memberMap.set(name, {
          name,
          roles: new Set([row.role]),
          depts: new Set(row.department ? [row.department] : []),
          projects: new Set([row.project_id]),
          projectNames: [row.project_name],
          notes: row.notes ? [row.notes] : [],
          firstSeen: new Date(row.created_at),
          lastSeen: new Date(row.created_at),
        });
      }
    }

    // Build TeamMember entries and upsert to DB
    const members: TeamMember[] = [];
    const totalProjectCount = new Set(crewRes.rows.map((r: Record<string, unknown>) => r.project_id)).size;

    for (const [name, data] of memberMap) {
      const collabCount = data.projects.size;
      const rehireRate = totalProjectCount > 1 ? collabCount / totalProjectCount : null;
      const reliabilityScore = Math.min(0.5 + collabCount * 0.1, 1);
      const synergyScore = Math.min(0.4 + collabCount * 0.12, 1);
      const primaryRole = [...data.roles][0];
      const primaryDept = [...data.depts][0] || null;

      // Find frequently paired crew (same projects)
      const pairedNames: string[] = [];
      for (const [otherName, otherData] of memberMap) {
        if (otherName === name) continue;
        const sharedProjects = [...data.projects].filter((p) => otherData.projects.has(p));
        if (sharedProjects.length >= 2) pairedNames.push(otherName);
      }

      // Detect strengths from context
      const strengths: string[] = [];
      if (collabCount >= 3) strengths.push('pålitelig');
      if (data.roles.size >= 2) strengths.push('allsidig');
      if (rehireRate && rehireRate >= 0.5) strengths.push('foretrukket');

      const member: TeamMember = {
        id: 0,
        userId: null,
        crewMemberName: name,
        crewRole: primaryRole,
        crewDepartment: primaryDept,
        collaborationCount: collabCount,
        projectIds: [...data.projects],
        totalDaysTogether: collabCount * 5, // estimate
        synergyScore,
        reliabilityScore,
        rehireRate,
        preferredPairing: pairedNames.slice(0, 5),
        strengths,
        notesSummary: data.notes.length > 0 ? data.notes.slice(-3).join('; ') : null,
      };
      members.push(member);

      // Upsert to DB
      await this.pool.query(
        `INSERT INTO roleroom_team_dynamics
           (user_a_id, crew_member_name, crew_role, crew_department,
            collaboration_count, project_ids, total_days_together,
            synergy_score, reliability_score, rehire_rate, preferred_pairing,
            strengths, notes_summary, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
         ON CONFLICT (user_a_id, COALESCE(user_b_id, ''), COALESCE(crew_member_name, ''))
         DO UPDATE SET
           crew_role = $3, crew_department = $4,
           collaboration_count = $5, project_ids = $6, total_days_together = $7,
           synergy_score = $8, reliability_score = $9, rehire_rate = $10,
           preferred_pairing = $11, strengths = $12, notes_summary = $13, updated_at = now()`,
        [
          userId, name, primaryRole, primaryDept,
          collabCount, [...data.projects], collabCount * 5,
          synergyScore, reliabilityScore, rehireRate,
          pairedNames.slice(0, 5), strengths,
          member.notesSummary,
        ]
      );
    }

    // Top pairings: pairs that appear in multiple projects together
    const pairMap = new Map<string, { names: string[]; projects: Set<string> }>();
    const memberEntries = [...memberMap.entries()];
    for (let i = 0; i < memberEntries.length; i++) {
      for (let j = i + 1; j < memberEntries.length; j++) {
        const [nameA, dataA] = memberEntries[i];
        const [nameB, dataB] = memberEntries[j];
        const shared = [...dataA.projects].filter((p) => dataB.projects.has(p));
        if (shared.length >= 2) {
          const key = [nameA, nameB].sort().join('|');
          pairMap.set(key, { names: [nameA, nameB], projects: new Set(shared) });
        }
      }
    }

    const topPairings = [...pairMap.values()]
      .map((p) => ({
        names: p.names,
        projects: p.projects.size,
        synergy: Math.min(0.5 + p.projects.size * 0.15, 1),
      }))
      .sort((a, b) => b.projects - a.projects)
      .slice(0, 10);

    // Department coverage
    const departmentCoverage: Record<string, number> = {};
    for (const [, data] of memberMap) {
      for (const dept of data.depts) {
        departmentCoverage[dept] = (departmentCoverage[dept] || 0) + 1;
      }
    }

    const reliabilityAvg = members.length > 0
      ? Math.round(members.reduce((s, m) => s + m.reliabilityScore, 0) / members.length * 100) / 100
      : 0;

    // Generate insights
    const insights: string[] = [];
    const sortedByCollab = [...members].sort((a, b) => b.collaborationCount - a.collaborationCount);

    if (sortedByCollab.length > 0) {
      const top = sortedByCollab[0];
      insights.push(`Din mest trofaste samarbeidspartner er ${top.crewMemberName} (${top.crewRole}) — dere har jobbet sammen i ${top.collaborationCount} prosjekter.`);
    }

    if (topPairings.length > 0) {
      const best = topPairings[0];
      insights.push(`${best.names[0]} og ${best.names[1]} er din sterkeste teamkombo — de har jobbet sammen i ${best.projects} av dine prosjekter.`);
    }

    const onceOnly = members.filter((m) => m.collaborationCount === 1);
    if (onceOnly.length > 0 && members.length > 3) {
      insights.push(`${onceOnly.length} av ${members.length} teammedlemmer har bare vært med i ett prosjekt. Vurder å bygge en mer stabil kjerne-crew.`);
    }

    const multirole = members.filter((m) => m.strengths.includes('allsidig'));
    if (multirole.length > 0) {
      insights.push(`${multirole.map((m) => m.crewMemberName).join(', ')} har fylt flere roller — allsidige ressurser å holde nær.`);
    }

    return { members: members.sort((a, b) => b.collaborationCount - a.collaborationCount), topPairings, departmentCoverage, reliabilityAvg, insights };
  }

  async getTeamDynamics(userId: string): Promise<TeamMember[]> {
    const res = await this.pool.query(
      `SELECT * FROM roleroom_team_dynamics WHERE user_a_id = $1 ORDER BY collaboration_count DESC`,
      [userId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_b_id,
      crewMemberName: r.crew_member_name,
      crewRole: r.crew_role,
      crewDepartment: r.crew_department,
      collaborationCount: r.collaboration_count,
      projectIds: r.project_ids || [],
      totalDaysTogether: r.total_days_together,
      synergyScore: r.synergy_score,
      reliabilityScore: r.reliability_score,
      rehireRate: r.rehire_rate,
      preferredPairing: r.preferred_pairing || [],
      strengths: r.strengths || [],
      notesSummary: r.notes_summary,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // 4. PROJECT PATTERN ENGINE
  // ─────────────────────────────────────────────────────────────

  async discoverPatterns(userId: string): Promise<ProjectPattern[]> {
    const patterns: ProjectPattern[] = [];

    // ── Crew preference patterns ──
    const crewPrefRes = await this.pool.query(
      `SELECT c.name, c.role, COUNT(DISTINCT c.project_id) as times_hired
       FROM casting_crew c
       JOIN casting_projects p ON p.id = c.project_id
       WHERE p.created_by = $1
       GROUP BY c.name, c.role
       HAVING COUNT(DISTINCT c.project_id) >= 2
       ORDER BY times_hired DESC`,
      [userId]
    );
    for (const row of crewPrefRes.rows) {
      const p: ProjectPattern = {
        id: 0,
        patternType: 'crew_preference',
        patternKey: `${row.role}_${row.name}`,
        patternData: { name: row.name, role: row.role, timesHired: Number(row.times_hired) },
        description: `Du velger ${row.name} som ${row.role} gang etter gang (${row.times_hired} prosjekter). Dette er en bevisst preferanse.`,
        confidence: Math.min(0.4 + Number(row.times_hired) * 0.15, 0.95),
        evidenceCount: Number(row.times_hired),
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
      patterns.push(p);
    }

    // ── Team composition patterns ──
    const teamCompRes = await this.pool.query(
      `SELECT p.id, p.name as project_name, p.genre, COUNT(c.id) as crew_count,
              array_agg(DISTINCT c.role) as roles, array_agg(DISTINCT c.department) as departments
       FROM casting_projects p
       LEFT JOIN casting_crew c ON c.project_id = p.id
       WHERE p.created_by = $1
       GROUP BY p.id, p.name, p.genre
       ORDER BY p.created_at`,
      [userId]
    );
    if (teamCompRes.rows.length >= 2) {
      const sizes = teamCompRes.rows.map((r: Record<string, unknown>) => Number(r.crew_count));
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const allRoles = teamCompRes.rows.flatMap((r: Record<string, unknown>) => (r.roles as string[]) || []);
      const roleCounts: Record<string, number> = {};
      for (const role of allRoles) { if (role) roleCounts[role] = (roleCounts[role] || 0) + 1; }
      const alwaysPresent = Object.entries(roleCounts)
        .filter(([, cnt]) => cnt >= teamCompRes.rows.length * 0.8)
        .map(([role]) => role);

      if (alwaysPresent.length > 0) {
        patterns.push({
          id: 0,
          patternType: 'team_composition',
          patternKey: 'core_roles',
          patternData: { avgTeamSize: Math.round(avgSize * 10) / 10, coreRoles: alwaysPresent, totalProjects: teamCompRes.rows.length },
          description: `Din typiske crew-størrelse er ${Math.round(avgSize)} personer. Du har alltid med: ${alwaysPresent.join(', ')}.`,
          confidence: Math.min(0.5 + teamCompRes.rows.length * 0.08, 0.9),
          evidenceCount: teamCompRes.rows.length,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        });
      }
    }

    // ── Budget patterns ──
    const budgetRes = await this.pool.query(
      `SELECT budget, genre, project_type FROM casting_projects
       WHERE created_by = $1 AND budget IS NOT NULL AND budget > 0
       ORDER BY created_at`,
      [userId]
    );
    if (budgetRes.rows.length >= 2) {
      const budgets = budgetRes.rows.map((r: Record<string, unknown>) => Number(r.budget));
      const avgBudget = budgets.reduce((a, b) => a + b, 0) / budgets.length;
      const budgetTrend = budgets.length >= 3
        ? (budgets[budgets.length - 1] > budgets[0] * 1.2 ? 'voksende' : budgets[budgets.length - 1] < budgets[0] * 0.8 ? 'synkende' : 'stabil')
        : 'stabil';

      patterns.push({
        id: 0,
        patternType: 'budget_pattern',
        patternKey: 'budget_trend',
        patternData: { avgBudget: Math.round(avgBudget), trend: budgetTrend, projectCount: budgets.length },
        description: `Ditt gjennomsnittlige budsjett er ${Math.round(avgBudget).toLocaleString()} NOK. Trenden er ${budgetTrend}.`,
        confidence: Math.min(0.4 + budgets.length * 0.1, 0.85),
        evidenceCount: budgets.length,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });
    }

    // ── Genre tendency ──
    if (teamCompRes.rows.length >= 2) {
      const genreCounts: Record<string, number> = {};
      for (const row of teamCompRes.rows) {
        const g = (row.genre as string) || 'ukjent';
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
      const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];
      if (topGenre && topGenre[1] >= 2) {
        const pct = Math.round((topGenre[1] / teamCompRes.rows.length) * 100);
        patterns.push({
          id: 0,
          patternType: 'genre_tendency',
          patternKey: topGenre[0],
          patternData: { genre: topGenre[0], count: topGenre[1], percentage: pct, allGenres: genreCounts },
          description: `${pct}% av dine prosjekter er ${topGenre[0]}. ${topGenre[0] === 'ukjent' ? 'Sett genre på prosjektene dine for bedre innsikt.' : `Du har en sterk ${topGenre[0]}-identitet.`}`,
          confidence: Math.min(pct / 100 + 0.1, 0.9),
          evidenceCount: topGenre[1],
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        });
      }
    }

    // ── Location preferences ──
    const locRes = await this.pool.query(
      `SELECT l.type, COUNT(DISTINCT l.project_id) as project_count
       FROM casting_locations l
       JOIN casting_projects p ON p.id = l.project_id
       WHERE p.created_by = $1 AND l.type IS NOT NULL
       GROUP BY l.type
       HAVING COUNT(DISTINCT l.project_id) >= 2
       ORDER BY project_count DESC`,
      [userId]
    );
    for (const row of locRes.rows) {
      patterns.push({
        id: 0,
        patternType: 'location_preference',
        patternKey: row.type as string,
        patternData: { locationType: row.type, projectCount: Number(row.project_count) },
        description: `Du velger ofte ${row.type}-lokasjoner (brukt i ${row.project_count} prosjekter).`,
        confidence: Math.min(0.4 + Number(row.project_count) * 0.1, 0.85),
        evidenceCount: Number(row.project_count),
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });
    }

    // Save all patterns to DB
    for (const p of patterns) {
      await this.pool.query(
        `INSERT INTO roleroom_project_patterns
           (user_id, pattern_type, pattern_key, pattern_data, description, confidence, evidence_count, first_seen, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
         ON CONFLICT (user_id, pattern_type, pattern_key) DO UPDATE SET
           pattern_data = $4, description = $5, confidence = $6, evidence_count = $7, last_seen = now()`,
        [userId, p.patternType, p.patternKey, JSON.stringify(p.patternData), p.description, p.confidence, p.evidenceCount]
      );
    }

    return patterns;
  }

  async getPatterns(userId: string): Promise<ProjectPattern[]> {
    const res = await this.pool.query(
      `SELECT * FROM roleroom_project_patterns
       WHERE user_id = $1 AND is_active = true
       ORDER BY confidence DESC`,
      [userId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      patternType: r.pattern_type,
      patternKey: r.pattern_key,
      patternData: r.pattern_data,
      description: r.description,
      confidence: r.confidence,
      evidenceCount: r.evidence_count,
      firstSeen: r.first_seen?.toISOString?.() || r.first_seen,
      lastSeen: r.last_seen?.toISOString?.() || r.last_seen,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // 5. PREFERENCE LEARNER
  // ─────────────────────────────────────────────────────────────

  async learnPreferences(userId: string): Promise<LearnedPreference[]> {
    const prefs: Array<{
      key: string; value: string; category: string; confidence: number; evidence: number; context: Record<string, unknown>;
    }> = [];

    // ── Default call time — from production days ──
    const callRes = await this.pool.query(
      `SELECT call_time, COUNT(*) as cnt
       FROM casting_production_days pd
       JOIN casting_projects p ON pd.project_id = p.id
       WHERE p.created_by = $1 AND call_time IS NOT NULL
       GROUP BY call_time ORDER BY cnt DESC LIMIT 1`,
      [userId]
    );
    if (callRes.rows.length > 0) {
      const ct = callRes.rows[0];
      prefs.push({
        key: 'default_call_time', value: ct.call_time as string,
        category: 'scheduling', confidence: Math.min(0.5 + Number(ct.cnt) * 0.1, 0.9),
        evidence: Number(ct.cnt), context: { source: 'production_days', count: ct.cnt },
      });
    }

    // ── Preferred currency ──
    const currRes = await this.pool.query(
      `SELECT currency, COUNT(*) as cnt
       FROM casting_projects WHERE created_by = $1 AND currency IS NOT NULL
       GROUP BY currency ORDER BY cnt DESC LIMIT 1`,
      [userId]
    );
    if (currRes.rows.length > 0) {
      prefs.push({
        key: 'preferred_currency', value: currRes.rows[0].currency as string,
        category: 'production', confidence: 0.9, evidence: Number(currRes.rows[0].cnt),
        context: { source: 'projects' },
      });
    }

    // ── Preferred project type ──
    const typeRes = await this.pool.query(
      `SELECT project_type, COUNT(*) as cnt
       FROM casting_projects WHERE created_by = $1 AND project_type IS NOT NULL
       GROUP BY project_type ORDER BY cnt DESC LIMIT 1`,
      [userId]
    );
    if (typeRes.rows.length > 0) {
      prefs.push({
        key: 'preferred_project_type', value: typeRes.rows[0].project_type as string,
        category: 'production', confidence: Math.min(0.5 + Number(typeRes.rows[0].cnt) * 0.1, 0.9),
        evidence: Number(typeRes.rows[0].cnt),
        context: { source: 'projects' },
      });
    }

    // ── Preferred equipment categories ──
    const eqCatRes = await this.pool.query(
      `SELECT category, COUNT(*) as cnt
       FROM user_equipment WHERE user_id = $1 AND category IS NOT NULL
       GROUP BY category ORDER BY cnt DESC LIMIT 3`,
      [userId]
    );
    if (eqCatRes.rows.length > 0) {
      prefs.push({
        key: 'top_equipment_categories',
        value: eqCatRes.rows.map((r: Record<string, unknown>) => r.category).join(', '),
        category: 'equipment', confidence: 0.8,
        evidence: eqCatRes.rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.cnt), 0),
        context: { categories: eqCatRes.rows.map((r: Record<string, unknown>) => ({ cat: r.category, count: r.cnt })) },
      });
    }

    // ── Preferred crew structure ──
    const deptRes = await this.pool.query(
      `SELECT c.department, COUNT(DISTINCT c.project_id) as project_count
       FROM casting_crew c
       JOIN casting_projects p ON p.id = c.project_id
       WHERE p.created_by = $1 AND c.department IS NOT NULL
       GROUP BY c.department
       HAVING COUNT(DISTINCT c.project_id) >= 2
       ORDER BY project_count DESC`,
      [userId]
    );
    if (deptRes.rows.length > 0) {
      prefs.push({
        key: 'core_departments',
        value: deptRes.rows.map((r: Record<string, unknown>) => r.department).join(', '),
        category: 'team',
        confidence: Math.min(0.5 + deptRes.rows.length * 0.1, 0.9),
        evidence: deptRes.rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.project_count), 0),
        context: { departments: deptRes.rows.map((r: Record<string, unknown>) => ({ dept: r.department, projects: r.project_count })) },
      });
    }

    // Save to DB
    for (const p of prefs) {
      await this.pool.query(
        `INSERT INTO roleroom_learned_preferences
           (user_id, preference_key, preference_value, preference_type, category, confidence, evidence_count, source_context, updated_at)
         VALUES ($1, $2, $3, 'auto', $4, $5, $6, $7, now())
         ON CONFLICT (user_id, preference_key)
         DO UPDATE SET preference_value = $3, confidence = $5, evidence_count = $6, source_context = $7, updated_at = now()`,
        [userId, p.key, p.value, p.category, p.confidence, p.evidence, JSON.stringify(p.context)]
      );
    }

    return prefs.map((p, i) => ({
      id: i + 1,
      preferenceKey: p.key,
      preferenceValue: p.value,
      preferenceType: 'auto' as const,
      category: p.category,
      confidence: p.confidence,
      evidenceCount: p.evidence,
    }));
  }

  async getPreferences(userId: string): Promise<LearnedPreference[]> {
    const res = await this.pool.query(
      'SELECT * FROM roleroom_learned_preferences WHERE user_id = $1 ORDER BY confidence DESC',
      [userId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      preferenceKey: r.preference_key,
      preferenceValue: r.preference_value,
      preferenceType: r.preference_type,
      category: r.category,
      confidence: r.confidence,
      evidenceCount: r.evidence_count,
    }));
  }

  async confirmPreference(userId: string, preferenceKey: string, value?: string): Promise<void> {
    if (value) {
      await this.pool.query(
        `UPDATE roleroom_learned_preferences
         SET preference_type = 'confirmed', preference_value = $3, confidence = 1.0, updated_at = now()
         WHERE user_id = $1 AND preference_key = $2`,
        [userId, preferenceKey, value]
      );
    } else {
      await this.pool.query(
        `UPDATE roleroom_learned_preferences
         SET preference_type = 'confirmed', confidence = 1.0, updated_at = now()
         WHERE user_id = $1 AND preference_key = $2`,
        [userId, preferenceKey]
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FULL SNAPSHOT — everything The Role Room knows about a user
  // ─────────────────────────────────────────────────────────────

  async getFullSnapshot(userId: string): Promise<LearningSnapshot> {
    // Fetch cached data first; compute if missing
    let insights = await this.getUserInsights(userId);
    let teamMembers = await this.getTeamDynamics(userId);
    let patterns = await this.getPatterns(userId);
    let preferences = await this.getPreferences(userId);

    // If no data, compute it now
    if (!insights) insights = await this.computeUserInsights(userId);
    if (teamMembers.length === 0) {
      const report = await this.computeTeamDynamics(userId);
      teamMembers = report.members;
    }
    if (patterns.length === 0) patterns = await this.discoverPatterns(userId);
    if (preferences.length === 0) preferences = await this.learnPreferences(userId);

    // Build team report from cached members
    const topPairings: TeamReport['topPairings'] = [];
    for (let i = 0; i < teamMembers.length; i++) {
      for (const pairing of teamMembers[i].preferredPairing) {
        const partner = teamMembers.find((m) => m.crewMemberName === pairing);
        if (partner) {
          const shared = teamMembers[i].projectIds.filter((p) => partner.projectIds.includes(p));
          if (shared.length >= 2) {
            topPairings.push({
              names: [teamMembers[i].crewMemberName || '', pairing],
              projects: shared.length,
              synergy: Math.min(0.5 + shared.length * 0.15, 1),
            });
          }
        }
      }
    }

    const deptCoverage: Record<string, number> = {};
    for (const m of teamMembers) {
      if (m.crewDepartment) deptCoverage[m.crewDepartment] = (deptCoverage[m.crewDepartment] || 0) + 1;
    }

    const reliabilityAvg = teamMembers.length > 0
      ? Math.round(teamMembers.reduce((s, m) => s + m.reliabilityScore, 0) / teamMembers.length * 100) / 100
      : 0;

    // Generate personalized greeting
    const firstName = await this.getUserFirstName(userId);
    const hour = new Date().getHours();
    const timeGreeting = hour < 6 ? 'God natt' : hour < 12 ? 'God morgen' : hour < 17 ? 'God ettermiddag' : 'God kveld';
    const greeting = firstName
      ? `${timeGreeting}, ${firstName}! Her er hva jeg har lært om deg og teamet ditt.`
      : `${timeGreeting}! Her er hva jeg har lært om deg og teamet ditt.`;

    // Generate nudges
    const nudges = this.generateNudges(insights, teamMembers, patterns, preferences);

    return {
      userInsights: insights,
      teamReport: {
        members: teamMembers,
        topPairings: topPairings.slice(0, 5),
        departmentCoverage: deptCoverage,
        reliabilityAvg,
        insights: this.generateTeamInsights(teamMembers, topPairings),
      },
      patterns,
      preferences,
      greeting,
      nudges,
    };
  }

  private async getUserFirstName(userId: string): Promise<string | null> {
    try {
      const res = await this.pool.query('SELECT first_name FROM users WHERE id = $1', [userId]);
      return res.rows[0]?.first_name || null;
    } catch {
      return null;
    }
  }

  private generateTeamInsights(members: TeamMember[], pairings: TeamReport['topPairings']): string[] {
    const insights: string[] = [];
    if (members.length === 0) {
      insights.push('Legg til crew-medlemmer i prosjektene dine så jeg kan lære å kjenne teamet ditt.');
      return insights;
    }

    const top = members[0];
    if (top) insights.push(`${top.crewMemberName} (${top.crewRole}) er din mest brukte samarbeidspartner — ${top.collaborationCount} prosjekter sammen.`);

    if (pairings.length > 0) {
      insights.push(`Sterkeste teamkombo: ${pairings[0].names.join(' + ')} (${pairings[0].projects} felles prosjekter).`);
    }

    const oneTimers = members.filter((m) => m.collaborationCount === 1);
    if (oneTimers.length > members.length * 0.6) {
      insights.push(`${oneTimers.length} av ${members.length} crew-medlemmer har bare vært med én gang. Vurder å bygge en mer stabil kjerne.`);
    }

    return insights;
  }

  private generateNudges(
    insights: UserInsights | null,
    team: TeamMember[],
    patterns: ProjectPattern[],
    _preferences: LearnedPreference[]
  ): string[] {
    const nudges: string[] = [];

    if (insights) {
      if (insights.engagementMetrics.totalProjects === 0) {
        nudges.push('Opprett ditt første prosjekt så jeg kan begynne å lære om arbeidsstilen din!');
      } else if (insights.engagementMetrics.totalProjects < 3) {
        nudges.push(`Du har ${insights.engagementMetrics.totalProjects} prosjekt(er). Jo flere prosjekter, desto bedre blir mine anbefalinger.`);
      }

      if (insights.workPatterns.planningToExecutionRatio > 0.7) {
        nudges.push('Du bruker mye tid på planlegging — anbefaler å prøve å komme raskere til utførelse i neste prosjekt.');
      }

      if (insights.skillTrajectory.projectComplexityTrend === 'increasing') {
        nudges.push('Prosjektene dine blir mer komplekse — flott vekst! Vurder å utvide kjerne-teamet ditt.');
      }
    }

    if (team.length > 0) {
      const unreliable = team.filter((m) => m.reliabilityScore < 0.4);
      if (unreliable.length > 0) {
        nudges.push(`${unreliable.map((m) => m.crewMemberName).join(', ')} har lavere pålitelighetsscorer. Vurder backup-alternativer.`);
      }
    }

    if (patterns.length === 0) {
      nudges.push('Jeg har ikke nok data til å oppdage mønstre ennå. Fortsett å jobbe i The Role Room — jeg lærer hele tiden!');
    }

    return nudges;
  }

  // ─────────────────────────────────────────────────────────────
  // RECOMPUTE ALL — triggers full learning cycle
  // ─────────────────────────────────────────────────────────────

  async recomputeAll(userId: string): Promise<LearningSnapshot> {
    await this.computeUserInsights(userId);
    await this.computeTeamDynamics(userId);
    await this.discoverPatterns(userId);
    await this.learnPreferences(userId);
    return this.getFullSnapshot(userId);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. SMART CREW SUGGESTIONS
  // ─────────────────────────────────────────────────────────────

  async suggestCrew(userId: string, role?: string, limit = 10): Promise<CrewSuggestion[]> {
    // Get all team dynamics for this user
    const dynamicsRes = await this.pool.query(
      `SELECT * FROM roleroom_team_dynamics
       WHERE user_a_id = $1
       ORDER BY synergy_score DESC, collaboration_count DESC`,
      [userId]
    );

    if (dynamicsRes.rows.length === 0) {
      // Fall back to raw crew data
      const rawRes = await this.pool.query(
        `SELECT c.name, c.role, c.department, COUNT(DISTINCT c.project_id) as times
         FROM casting_crew c
         JOIN casting_projects p ON p.id = c.project_id
         WHERE p.created_by = $1
         ${role ? 'AND c.role = $2' : ''}
         GROUP BY c.name, c.role, c.department
         ORDER BY times DESC LIMIT $${role ? '3' : '2'}`,
        role ? [userId, role, limit] : [userId, limit]
      );
      return rawRes.rows.map((r) => ({
        name: r.name,
        role: r.role,
        department: r.department,
        score: Math.min(0.3 + Number(r.times) * 0.15, 0.9),
        reasons: [`Brukt i ${r.times} prosjekt(er)`],
        collaborationCount: Number(r.times),
        reliabilityScore: 0.5,
        synergyWithOthers: [],
      }));
    }

    // Build suggestion list from known dynamics
    let candidates = dynamicsRes.rows.filter((r) => {
      if (!role) return true;
      return r.crew_role === role;
    });

    if (candidates.length === 0 && role) {
      // Broaden search — any crew with this role across all users' projects
      candidates = dynamicsRes.rows;
    }

    const suggestions: CrewSuggestion[] = candidates.slice(0, limit).map((r) => {
      const reasons: string[] = [];
      if (r.collaboration_count >= 3) reasons.push(`Svært pålitelig — ${r.collaboration_count} prosjekter sammen`);
      else if (r.collaboration_count >= 2) reasons.push(`Godt kjent — ${r.collaboration_count} prosjekter sammen`);
      else reasons.push('Jobbet med deg tidligere');

      if (r.rehire_rate && r.rehire_rate >= 0.5) reasons.push(`Høy rehire-rate: ${Math.round(r.rehire_rate * 100)}%`);
      if (r.synergy_score >= 0.7) reasons.push('Høy synergiscore');
      if ((r.strengths as string[])?.includes('allsidig')) reasons.push('Allsidig — kan flere roller');
      if ((r.preferred_pairing as string[])?.length > 0) {
        reasons.push(`Jobber godt med ${(r.preferred_pairing as string[]).slice(0, 2).join(' og ')}`);
      }

      const score = (
        (r.synergy_score ?? 0) * 0.3 +
        (r.reliability_score ?? 0) * 0.3 +
        Math.min((r.collaboration_count ?? 0) * 0.08, 0.4)
      );

      return {
        name: r.crew_member_name,
        role: r.crew_role,
        department: r.crew_department,
        score: Math.min(score, 1),
        reasons,
        collaborationCount: r.collaboration_count,
        reliabilityScore: r.reliability_score,
        synergyWithOthers: [],
      };
    });

    return suggestions.sort((a, b) => b.score - a.score);
  }

  async buildDreamTeam(userId: string, requiredRoles?: string[]): Promise<DreamTeam> {
    // Get all available crew from dynamics
    const allCrew = await this.suggestCrew(userId, undefined, 100);

    // Determine needed roles
    let roles: string[];
    if (requiredRoles && requiredRoles.length > 0) {
      roles = requiredRoles;
    } else {
      // Discover from patterns
      const patternRes = await this.pool.query(
        `SELECT pattern_data FROM roleroom_project_patterns
         WHERE user_id = $1 AND pattern_type = 'team_composition' AND pattern_key = 'core_roles'`,
        [userId]
      );
      const coreRoles = patternRes.rows[0]?.pattern_data?.coreRoles as string[] | undefined;
      roles = coreRoles || [...new Set(allCrew.map((c) => c.role))].slice(0, 8);
    }

    // Pick best candidate for each role
    const picked = new Set<string>();
    const members: CrewSuggestion[] = [];
    const missingRoles: string[] = [];

    for (const role of roles) {
      const candidates = allCrew.filter((c) => c.role === role && !picked.has(c.name));
      if (candidates.length > 0) {
        const best = candidates[0];
        picked.add(best.name);
        members.push(best);
      } else {
        missingRoles.push(role);
      }
    }

    // Calculate overall chemistry
    const dynamicsRes = await this.pool.query(
      `SELECT * FROM roleroom_team_dynamics WHERE user_a_id = $1`,
      [userId]
    );
    const nameSet = new Set(members.map((m) => m.name));
    let pairCount = 0;
    let pairSynergySum = 0;

    for (const dyn of dynamicsRes.rows) {
      const pairings = (dyn.preferred_pairing as string[]) || [];
      for (const partner of pairings) {
        if (nameSet.has(dyn.crew_member_name) && nameSet.has(partner)) {
          pairCount++;
          pairSynergySum += dyn.synergy_score ?? 0.5;
        }
      }
    }

    const overallChemistry = members.length > 0
      ? (members.reduce((s, m) => s + m.score, 0) / members.length * 0.6) +
        (pairCount > 0 ? (pairSynergySum / pairCount) * 0.4 : 0.3)
      : 0;

    // Insights
    const insights: string[] = [];
    if (members.length > 0) {
      insights.push(`Drømmeteam med ${members.length} medlemmer basert på din historikk.`);
    }
    if (missingRoles.length > 0) {
      insights.push(`Mangler kjent crew for: ${missingRoles.join(', ')}. Du trenger å finne noen nye.`);
    }
    if (pairCount > 0) {
      insights.push(`${pairCount} kjente samarbeidspar i dette teamet — sterk kjemi.`);
    }

    return {
      members,
      overallChemistry: Math.round(Math.min(overallChemistry, 1) * 100) / 100,
      missingRoles,
      insights,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 7. TEAM CHEMISTRY PREDICTION
  // ─────────────────────────────────────────────────────────────

  async predictChemistry(userId: string, crewNames: string[]): Promise<ChemistryPrediction> {
    if (crewNames.length === 0) {
      return { overallScore: 0, pairScores: [], risks: [], strengths: [], unknownMembers: [], suggestion: 'Legg til crew-medlemmer for å analysere.' };
    }

    // Load team dynamics
    const dynamicsRes = await this.pool.query(
      `SELECT * FROM roleroom_team_dynamics WHERE user_a_id = $1`,
      [userId]
    );

    const known = new Map<string, typeof dynamicsRes.rows[0]>();
    for (const row of dynamicsRes.rows) {
      if (row.crew_member_name) known.set(row.crew_member_name, row);
    }

    const unknownMembers = crewNames.filter((n) => !known.has(n));
    const knownMembers = crewNames.filter((n) => known.has(n));

    // Calculate pair scores
    const pairScores: ChemistryPrediction['pairScores'] = [];
    for (let i = 0; i < crewNames.length; i++) {
      for (let j = i + 1; j < crewNames.length; j++) {
        const a = crewNames[i];
        const b = crewNames[j];
        const dynA = known.get(a);
        const dynB = known.get(b);

        let score = 0.5; // unknown baseline
        let history = 0;

        if (dynA && dynB) {
          // Both known — check shared projects
          const projA = new Set(dynA.project_ids || []);
          const projB = new Set(dynB.project_ids || []);
          const shared = [...projA].filter((p) => projB.has(p));
          history = shared.length;

          if (history > 0) {
            score = Math.min(0.5 + history * 0.15, 0.95);
            // Bonus if they're in each other's preferred pairings
            const pairingsA = (dynA.preferred_pairing as string[]) || [];
            const pairingsB = (dynB.preferred_pairing as string[]) || [];
            if (pairingsA.includes(b) || pairingsB.includes(a)) score = Math.min(score + 0.1, 1);
          } else {
            score = 0.45; // both known but never together
          }
        } else if (dynA || dynB) {
          score = 0.4; // one known, one unknown
        }

        pairScores.push({ a, b, score: Math.round(score * 100) / 100, history });
      }
    }

    // Overall score
    const avgPairScore = pairScores.length > 0
      ? pairScores.reduce((s, p) => s + p.score, 0) / pairScores.length
      : 0.5;
    const knownRatio = crewNames.length > 0 ? knownMembers.length / crewNames.length : 0;
    const overallScore = Math.round((avgPairScore * 0.7 + knownRatio * 0.3) * 100) / 100;

    // Risks & strengths
    const risks: string[] = [];
    const strengths: string[] = [];

    if (unknownMembers.length > 0) {
      risks.push(`${unknownMembers.length} ukjent(e) medlemmer — ingen historikk å basere seg på.`);
    }

    const lowPairs = pairScores.filter((p) => p.score < 0.4);
    if (lowPairs.length > 0) {
      risks.push(`${lowPairs.length} par har aldri jobbet sammen — usikker dynamikk.`);
    }

    const highPairs = pairScores.filter((p) => p.score >= 0.7);
    if (highPairs.length > 0) {
      strengths.push(`${highPairs.length} sterke samarbeidpar med dokumentert kjemi.`);
    }

    const veryReliable = knownMembers.filter((n) => {
      const d = known.get(n);
      return d && d.reliability_score >= 0.7;
    });
    if (veryReliable.length > 0) {
      strengths.push(`${veryReliable.join(', ')} er svært pålitelig(e).`);
    }

    // Suggestion
    let suggestion: string;
    if (overallScore >= 0.7) suggestion = 'Utmerket teamsammensetning! Dette teamet har sterk kjemi.';
    else if (overallScore >= 0.5) suggestion = 'Godt team, men noen ukjente dynamikker. Vurder å ha et oppstartsmøte.';
    else if (overallScore >= 0.3) suggestion = 'Middels kjemi — mange nye relasjoner. Bruk tid på teambuilding.';
    else suggestion = 'Mye ukjent — dette er et nytt team. Invester i kommunikasjon og forventningsavklaring.';

    return { overallScore, pairScores, risks, strengths, unknownMembers, suggestion };
  }

  // ─────────────────────────────────────────────────────────────
  // 8. INTELLIGENT PROJECT SETUP
  // ─────────────────────────────────────────────────────────────

  async suggestProjectSetup(userId: string): Promise<ProjectSetupSuggestion> {
    // Get learned preferences
    const prefs = await this.getPreferences(userId);
    const prefMap = new Map(prefs.map((p) => [p.preferenceKey, p.preferenceValue]));

    // Get patterns
    const patterns = await this.getPatterns(userId);
    const patternMap = new Map(patterns.map((p) => [`${p.patternType}:${p.patternKey}`, p]));

    // Compute from historical projects
    const projRes = await this.pool.query(
      `SELECT genre, project_type, budget, currency,
              COUNT(*) OVER () as total_projects
       FROM casting_projects WHERE created_by = $1
       ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );

    const totalProjects = Number(projRes.rows[0]?.total_projects) || 0;

    // Genre — most recent or most common
    const genreCounts: Record<string, number> = {};
    for (const r of projRes.rows) {
      if (r.genre) genreCounts[r.genre] = (genreCounts[r.genre] || 0) + 1;
    }
    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];
    const suggestedGenre = topGenre ? topGenre[0] : null;

    // Project type
    const suggestedProjectType = prefMap.get('preferred_project_type') || null;

    // Budget — average of recent projects
    const budgets = projRes.rows.map((r) => Number(r.budget)).filter((b) => b > 0);
    const suggestedBudget = budgets.length > 0
      ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length)
      : null;

    // Currency
    const suggestedCurrency = prefMap.get('preferred_currency') || null;

    // Call time
    const suggestedCallTime = prefMap.get('default_call_time') || null;

    // Core roles from team composition pattern
    const compPattern = patternMap.get('team_composition:core_roles');
    const suggestedCrewRoles = (compPattern?.patternData?.coreRoles as string[]) || [];

    // Suggest specific crew members
    const suggestedCrewNames: ProjectSetupSuggestion['suggestedCrewNames'] = [];
    for (const role of suggestedCrewRoles.slice(0, 6)) {
      const topCrew = await this.suggestCrew(userId, role, 1);
      if (topCrew.length > 0) {
        suggestedCrewNames.push({
          name: topCrew[0].name,
          role,
          reason: topCrew[0].reasons[0] || 'Basert på din historikk',
        });
      }
    }

    const confidence = Math.min(0.2 + totalProjects * 0.08 + prefs.length * 0.05, 0.95);

    return {
      suggestedGenre,
      suggestedProjectType,
      suggestedBudget,
      suggestedCurrency,
      suggestedCallTime,
      suggestedCrewRoles,
      suggestedCrewNames,
      confidence,
      basedOn: totalProjects,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // LEARNING TIMELINE
  // ─────────────────────────────────────────────────────────────

  async getTimeline(userId: string): Promise<LearningTimeline> {
    const events: TimelineEvent[] = [];

    // Projects created (real milestones)
    const projRes = await this.pool.query(
      `SELECT id, name, genre, project_type, created_at
       FROM casting_projects WHERE created_by = $1
       ORDER BY created_at`,
      [userId]
    );
    for (const r of projRes.rows) {
      events.push({
        date: r.created_at?.toISOString?.() || r.created_at,
        type: 'project_created',
        title: `Prosjekt opprettet: ${r.name}`,
        description: [r.genre, r.project_type].filter(Boolean).join(' · ') || 'Nytt prosjekt',
        data: { projectId: r.id },
      });
    }

    // First time each crew member was added
    const crewRes = await this.pool.query(
      `SELECT c.name, c.role, MIN(c.created_at) as first_added, COUNT(DISTINCT c.project_id) as projects
       FROM casting_crew c
       JOIN casting_projects p ON p.id = c.project_id
       WHERE p.created_by = $1
       GROUP BY c.name, c.role
       ORDER BY first_added`,
      [userId]
    );
    for (const r of crewRes.rows) {
      if (Number(r.projects) >= 2) {
        events.push({
          date: r.first_added?.toISOString?.() || r.first_added,
          type: 'crew_added',
          title: `${r.name} ble en gjenganger`,
          description: `${r.role} — brukt i ${r.projects} prosjekter`,
          data: { crewName: r.name, role: r.role },
        });
      }
    }

    // Patterns discovered
    const patRes = await this.pool.query(
      `SELECT pattern_type, pattern_key, description, first_seen
       FROM roleroom_project_patterns WHERE user_id = $1
       ORDER BY first_seen`,
      [userId]
    );
    for (const r of patRes.rows) {
      events.push({
        date: r.first_seen?.toISOString?.() || r.first_seen,
        type: 'pattern_discovered',
        title: `Mønster oppdaget: ${patternTypeLabel(r.pattern_type)}`,
        description: r.description,
      });
    }

    // Preferences learned
    const prefRes = await this.pool.query(
      `SELECT preference_key, preference_value, preference_type, created_at
       FROM roleroom_learned_preferences WHERE user_id = $1
       ORDER BY created_at`,
      [userId]
    );
    for (const r of prefRes.rows) {
      events.push({
        date: r.created_at?.toISOString?.() || r.created_at,
        type: 'preference_learned',
        title: `Preferanse lært: ${prefKeyLabel(r.preference_key)}`,
        description: `${r.preference_value} (${r.preference_type === 'confirmed' ? 'bekreftet' : 'auto-oppdaget'})`,
      });
    }

    // Sort all by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Milestones (key events)
    const milestones: TimelineEvent[] = [];
    if (projRes.rows.length > 0) {
      milestones.push({
        date: projRes.rows[0].created_at?.toISOString?.() || projRes.rows[0].created_at,
        type: 'milestone',
        title: 'Første prosjekt',
        description: `Du opprettet "${projRes.rows[0].name}" — starten på reisen din.`,
      });
    }
    if (projRes.rows.length >= 5) {
      milestones.push({
        date: projRes.rows[4].created_at?.toISOString?.() || projRes.rows[4].created_at,
        type: 'milestone',
        title: '5 prosjekter!',
        description: 'Du har nådd 5 prosjekter — du begynner å bygge en solid portefølje.',
      });
    }
    if (projRes.rows.length >= 10) {
      milestones.push({
        date: projRes.rows[9].created_at?.toISOString?.() || projRes.rows[9].created_at,
        type: 'milestone',
        title: '10 prosjekter!',
        description: 'Imponerende — 10 prosjekter fullført. Du er en erfaren produsent.',
      });
    }
    if (crewRes.rows.filter((r) => Number(r.projects) >= 3).length >= 3) {
      milestones.push({
        date: new Date().toISOString(),
        type: 'milestone',
        title: 'Stabil kjernecrew',
        description: 'Du har minst 3 crew-medlemmer du har jobbet med 3+ ganger. Flott!',
      });
    }

    // Growth summary
    let growthSummary: string;
    if (projRes.rows.length === 0) {
      growthSummary = 'Du har ikke startet ennå. Opprett ditt første prosjekt for å begynne reisen!';
    } else if (projRes.rows.length < 3) {
      growthSummary = `Du er i startfasen med ${projRes.rows.length} prosjekt(er). The Role Room lærer stadig mer om deg.`;
    } else if (projRes.rows.length < 10) {
      growthSummary = `Med ${projRes.rows.length} prosjekter begynner mønstrene dine å bli tydelige. Fortsett å jobbe!`;
    } else {
      growthSummary = `${projRes.rows.length} prosjekter — du er en erfaren produsent med tydelig stil og et pålitelig nettverk.`;
    }

    return { events, milestones, growthSummary };
  }

  // ─────────────────────────────────────────────────────────────
  // CONTEXTUAL NUDGE — returns context-specific tips for any panel
  // ─────────────────────────────────────────────────────────────

  async getContextualNudges(userId: string, context: string, entityData?: Record<string, unknown>): Promise<string[]> {
    const nudges: string[] = [];
    const prefs = await this.getPreferences(userId);
    const prefMap = new Map(prefs.map((p) => [p.preferenceKey, p]));

    switch (context) {
      case 'crew': {
        // When viewing/editing crew
        const teamDyn = await this.getTeamDynamics(userId);
        if (teamDyn.length > 0) {
          const top = teamDyn[0];
          nudges.push(`Din mest trofaste samarbeidspartner er ${top.crewMemberName} (${top.crewRole}).`);
        }
        const oneTimers = teamDyn.filter((m) => m.collaborationCount === 1);
        if (oneTimers.length > teamDyn.length * 0.6 && teamDyn.length > 3) {
          nudges.push(`${oneTimers.length} av ${teamDyn.length} crew-medlemmer har bare vært med én gang. Vurder en stabil kjerne.`);
        }
        break;
      }
      case 'equipment': {
        const eqPref = prefMap.get('top_equipment_categories');
        if (eqPref) {
          nudges.push(`Dine mest brukte utstyrskategorier: ${eqPref.preferenceValue}`);
        }
        break;
      }
      case 'schedule':
      case 'calendar': {
        const callPref = prefMap.get('default_call_time');
        if (callPref) {
          nudges.push(`Din vanlige oppmøtetid: ${callPref.preferenceValue}. Basert på ${callPref.evidenceCount} produksjonsdager.`);
        }
        const insights = await this.getUserInsights(userId);
        if (insights?.workPatterns.preferredDay) {
          nudges.push(`Du er mest produktiv på ${insights.workPatterns.preferredDay}.`);
        }
        break;
      }
      case 'locations': {
        const patterns = await this.getPatterns(userId);
        const locPatterns = patterns.filter((p) => p.patternType === 'location_preference');
        if (locPatterns.length > 0) {
          nudges.push(`Du velger oftest ${locPatterns[0].patternKey}-lokasjoner.`);
        }
        break;
      }
      case 'project_create':
      case 'project-creation':
      case 'project-setup': {
        const setup = await this.suggestProjectSetup(userId);
        if (setup.suggestedGenre) {
          nudges.push(`Basert på mønstrene dine: sjangeren din er ofte "${setup.suggestedGenre}".`);
        }
        if (setup.suggestedBudget) {
          nudges.push(`Ditt gjennomsnittlige budsjett: ${setup.suggestedBudget.toLocaleString()} ${setup.suggestedCurrency || 'NOK'}.`);
        }
        break;
      }
      case 'dashboard': {
        const insights = await this.getUserInsights(userId);
        if (insights) {
          if (insights.skillTrajectory.projectComplexityTrend === 'increasing') {
            nudges.push('Prosjektene dine vokser i kompleksitet — flott utvikling!');
          }
          if (insights.engagementMetrics.totalProjects > 0) {
            nudges.push(`Du har laget ${insights.engagementMetrics.totalProjects} prosjekt(er). Jo flere, desto bedre blir mine anbefalinger.`);
          }
        }
        break;
      }
      case 'casting': {
        const teamDyn = await this.getTeamDynamics(userId);
        const insightsCast = await this.getUserInsights(userId);
        if (insightsCast?.engagementMetrics.totalProjects) {
          nudges.push(`Du har gjennomført ${insightsCast.engagementMetrics.totalProjects} casting-prosjekt(er) totalt.`);
        }
        if (teamDyn.length > 5) {
          nudges.push(`Du har samarbeidet med ${teamDyn.length} crew-medlemmer. Bruk Crew-forslag for smarte anbefalinger.`);
        }
        break;
      }
      case 'roles': {
        const patternR = await this.getPatterns(userId);
        const rolePatterns = patternR.filter((p) => p.patternType === 'role_preference');
        if (rolePatterns.length > 0) {
          nudges.push(`Du oppretter oftest roller av typen "${rolePatterns[0].patternKey}".`);
        } else {
          nudges.push('Tips: Legg til detaljerte rollebeskrivelser for bedre kandidatmatch.');
        }
        break;
      }
      case 'contracts': {
        const contractPref = prefMap.get('default_contract_type');
        if (contractPref) {
          nudges.push(`Din vanligste kontrakttype: ${contractPref.preferenceValue}.`);
        }
        const insightsC = await this.getUserInsights(userId);
        if (insightsC?.engagementMetrics.totalProjects && insightsC.engagementMetrics.totalProjects > 2) {
          nudges.push('Tips: Bruk maler for kontrakter du gjenbruker ofte.');
        }
        break;
      }
      case 'auditions': {
        const audPref = prefMap.get('default_audition_duration');
        if (audPref) {
          nudges.push(`Din vanlige audition-varighet: ${audPref.preferenceValue} minutter.`);
        }
        const callPrefA = prefMap.get('default_call_time');
        if (callPrefA) {
          nudges.push(`Du setter vanligvis auditions til kl. ${callPrefA.preferenceValue}.`);
        }
        break;
      }
      case 'props': {
        const patternP = await this.getPatterns(userId);
        const propPatterns = patternP.filter((p) => p.patternType === 'prop_preference');
        if (propPatterns.length > 0) {
          nudges.push(`Dine mest brukte rekvisittkategorier: ${propPatterns.slice(0, 3).map((p) => p.patternKey).join(', ')}.`);
        } else {
          nudges.push('Tips: Kategoriser rekvisitter for enklere gjenbruk mellom prosjekter.');
        }
        break;
      }
      case 'workflow': {
        const insightsW = await this.getUserInsights(userId);
        if (insightsW?.workPatterns.preferredDay) {
          nudges.push(`Du er mest aktiv på ${insightsW.workPatterns.preferredDay}. Planlegg viktige oppgaver da.`);
        }
        if (insightsW?.engagementMetrics.totalSessions) {
          nudges.push(`Du har logget ${insightsW.engagementMetrics.totalSessions} økter totalt. Regelmessighet gir bedre anbefalinger.`);
        }
        break;
      }
      case 'script': {
        const patternS = await this.getPatterns(userId);
        const genrePatterns = patternS.filter((p) => p.patternType === 'genre_preference');
        if (genrePatterns.length > 0) {
          nudges.push(`Din foretrukne sjanger: "${genrePatterns[0].patternKey}".`);
        }
        const insightsS = await this.getUserInsights(userId);
        if (insightsS?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Manus-kompleksiteten din øker — du utvikler deg som forteller!');
        }
        break;
      }
      case 'split-sheets': {
        const teamDynS = await this.getTeamDynamics(userId);
        if (teamDynS.length > 0) {
          const topCollab = teamDynS.slice(0, 3).map((m) => m.crewMemberName).join(', ');
          nudges.push(`Dine hyppigste samarbeidspartnere: ${topCollab}. Vurder å lagre maler for dem.`);
        }
        nudges.push('Tips: Sørg for at alle bidragsytere har signert split sheet før distribusjon.');
        break;
      }
      case 'story-logic': {
        const patternsStory = await this.getPatterns(userId);
        const genrePat = patternsStory.filter((p) => p.patternType === 'genre_preference');
        if (genrePat.length > 0) {
          nudges.push(`Sist jobbet du med "${genrePat[0].patternKey}"-sjangeren. Bruk Story Logic til å validere premisset.`);
        }
        nudges.push('Tips: En sterk logline = én setning med protagonist, mål, hinder og innsats.');
        break;
      }
      case 'story-structure': {
        const insightsSS = await this.getUserInsights(userId);
        if (insightsSS?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Din fortelling vokser i kompleksitet. Bruk aktoversikten for å holde strukturen stram.');
        }
        nudges.push('Tips: Sjekk at midtpunktet virkelig snur historien — det driver andre halvdel.');
        break;
      }
      case 'grammar': {
        nudges.push('Tips: Etter grammatikk-sjekken, les dialogene høyt — øret fanger det øyet overser.');
        const prefGram = prefMap.get('language_style');
        if (prefGram) {
          nudges.push(`Din foretrukne skrivestil: ${prefGram.preferenceValue}.`);
        }
        break;
      }
      case 'story-arc': {
        const patternsArc = await this.getPatterns(userId);
        const genreArc = patternsArc.filter((p) => p.patternType === 'genre_preference');
        if (genreArc.length > 0) {
          nudges.push(`Sjangeren du jobber mest med: "${genreArc[0].patternKey}". Velg verktøy ut fra det.`);
        }
        nudges.push('Story Logic validerer premisset — Story Writer gir deg manusverktøy. Start med Logic.');
        break;
      }
      case 'manuscript': {
        const insightsM = await this.getUserInsights(userId);
        if (insightsM?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Manuskompleksiteten din øker — bruk Scene Navigator for bedre oversikt.');
        }
        const prefFormat = prefMap.get('screenplay_format');
        if (prefFormat) {
          nudges.push(`Ditt foretrukne format: ${prefFormat.preferenceValue}.`);
        } else {
          nudges.push('Tips: Bruk CTRL+Enter for å veksle mellom dialog og handling i editoren.');
        }
        break;
      }

      /* ─── Live Set Mode ─────────────────────────────── */
      case 'live-set': {
        nudges.push('Tips: Bruk hurtigtaster for raskere kontroll — R for Rolling, C for Cut, N for neste scene.');
        nudges.push('Tips: Aktiver mørk modus under nattopptak for å unngå lysforurensning på settet.');
        const prefLS = prefMap.get('live_set_layout');
        if (prefLS) {
          nudges.push(`Ditt foretrukne sett-oppsett: ${prefLS.preferenceValue}.`);
        } else {
          nudges.push('Visste du? Du kan tilpasse Live Set-layouten etter din rolle på settet.');
        }
        break;
      }

      /* ─── Audition Pool ─────────────────────────────── */
      case 'audition-pool': {
        const insAP = await this.getUserInsights(userId);
        if (insAP?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Du jobber med stadig mer komplekse produksjoner — bruk filtergrupper for raskere kandidatsøk.');
        }
        const prefAP = prefMap.get('audition_view');
        if (prefAP) {
          nudges.push(`Ditt foretrukne visning: ${prefAP.preferenceValue}.`);
        } else {
          nudges.push('Tips: Dra og slipp kandidater mellom audition-grupper for raskere sortering.');
        }
        break;
      }

      /* ─── Breakdown ─────────────────────────────────── */
      case 'breakdown': {
        const insBD = await this.getUserInsights(userId);
        if (insBD?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Prosjektkompleksiteten øker — bruk automatisk scene-breakdown for spart tid.');
        }
        nudges.push('Tips: Marker tekst i manuskriptet og høyreklikk for å opprette breakdown-elementer direkte.');
        break;
      }

      /* ─── Candidate Management ──────────────────────── */
      case 'candidates': {
        const insCM = await this.getUserInsights(userId);
        if (insCM?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Med flere kandidater lønner det seg å bruke rangeringssystemet — spar tid i beslutningsprosessen.');
        }
        const prefCM = prefMap.get('candidate_sort');
        if (prefCM) {
          nudges.push(`Din foretrukne sortering: ${prefCM.preferenceValue}.`);
        } else {
          nudges.push('Tips: Bruk notatfeltet til å logge førsteinntrykk under auditions — det hjelper i ettertid.');
        }
        break;
      }

      /* ─── Role Pool ─────────────────────────────────── */
      case 'role-pool': {
        const insRP = await this.getUserInsights(userId);
        if (insRP?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Komplekse produksjoner trenger tydelige rollebeskrivelser — bruk mal-funksjonen for konsistens.');
        }
        nudges.push('Tips: Legg til tagging på roller for raskere filtrering og matching mot kandidater.');
        break;
      }

      /* ─── Consent Management ────────────────────────── */
      case 'consent': {
        nudges.push('Tips: Sett opp automatiske påminnelser for samtykke-fornyelse før de utløper.');
        nudges.push('GDPR-påminnelse: Samtykke skal være spesifikt, informert og frivillig.');
        break;
      }

      /* ─── Production Control ────────────────────────── */
      case 'production': {
        const insPR = await this.getUserInsights(userId);
        if (insPR?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Produksjonene dine blir mer komplekse — vurder å bruke statusrapport-funksjonen for bedre oversikt.');
        }
        nudges.push('Tips: Bruk dashboardet for å se fremdrift på tvers av alle aktive produksjoner.');
        break;
      }

      /* ─── Production Tools ──────────────────────────── */
      case 'production-tools': {
        nudges.push('Tips: Tilpass verktøylinjen ved å dra de mest brukte verktøyene til forsiden.');
        const prefPT = prefMap.get('tool_layout');
        if (prefPT) {
          nudges.push(`Ditt foretrukne verktøyoppsett: ${prefPT.preferenceValue}.`);
        } else {
          nudges.push('Visste du? Du kan lagre egne verktøyoppsett for ulike produksjonstyper.');
        }
        break;
      }

      /* ─── Sharing ───────────────────────────────────── */
      case 'sharing': {
        nudges.push('Tips: Bruk passordbeskyttede lenker for ekstra sikkerhet ved deling av sensitivt materiale.');
        nudges.push('Tips: Sett utløpsdato på delingslenker for bedre kontroll over tilgang.');
        break;
      }

      /* ─── Shot Detail ───────────────────────────────── */
      case 'shot-detail': {
        const insSD = await this.getUserInsights(userId);
        if (insSD?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Med komplekse scener lønner det seg å spesifisere kameravinkel og linsevalg i detalj.');
        }
        nudges.push('Tips: Legg til referansebilder for å kommunisere visjonen tydelig til teamet.');
        break;
      }

      /* ─── Table Read ────────────────────────────────── */
      case 'table-read': {
        nudges.push('Tips: Tilordne roller til deltakere før bordslesningen for smidigere gjennomføring.');
        nudges.push('Tips: Bruk tidsmarkører under lesningen for å identifisere tempo-problemer i manuskriptet.');
        break;
      }

      /* ─── Shot List ─────────────────────────────────── */
      case 'shot-list': {
        const insSL = await this.getUserInsights(userId);
        if (insSL?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Flere skudd per scene? Bruk gruppering og fargekoder for bedre oversikt.');
        }
        nudges.push('Tips: Eksporter shot-listen som PDF for utdeling på settet.');
        break;
      }

      /* ─── Crew Calendar ─────────────────────────────── */
      case 'crew-calendar': {
        nudges.push('Tips: Bruk fargekoder per avdeling for rask visuell oversikt over teamets tilgjengelighet.');
        const prefCC = prefMap.get('calendar_view');
        if (prefCC) {
          nudges.push(`Ditt foretrukne kalendervisning: ${prefCC.preferenceValue}.`);
        } else {
          nudges.push('Tips: Bytt til ukesvisning for detaljert dagplanlegging av crew-ressurser.');
        }
        break;
      }

      /* ─── Scene Pool ────────────────────────────────── */
      case 'scene-pool': {
        const insSP = await this.getUserInsights(userId);
        if (insSP?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Flere scener å holde styr på? Bruk tagging og filtrering for raskere navigering.');
        }
        nudges.push('Tips: Dra scener mellom grupper for å omorganisere rekkefølgen raskt.');
        break;
      }

      /* ─── Stripboard ────────────────────────────────── */
      case 'stripboard': {
        nudges.push('Tips: Bruk fargekodene for å skille mellom dag/natt, INT/EXT og lokasjon på stripboardet.');
        nudges.push('Tips: Dra strips for å endre opptaksrekkefølge — endringer synkroniseres automatisk.');
        break;
      }

      /* ─── Production Notes ──────────────────────────── */
      case 'production-notes': {
        nudges.push('Tips: Bruk @-nevning for å varsle spesifikke teammedlemmer om viktige notater.');
        nudges.push('Tips: Kategoriser notater etter avdeling for enklere filtrering i ettertid.');
        break;
      }

      /* ─── Guide Editor ──────────────────────────────── */
      case 'guide-editor': {
        nudges.push('Tips: Bruk forhåndsvisning for å se hvordan guiden ser ut for sluttbrukeren.');
        nudges.push('Tips: Legg til interaktive steg med skjermbilder for mer engasjerende onboarding.');
        break;
      }

      /* ─── Storyboard ────────────────────────────────── */
      case 'storyboard': {
        const insSB = await this.getUserInsights(userId);
        if (insSB?.skillTrajectory.projectComplexityTrend === 'increasing') {
          nudges.push('Prosjektene dine blir mer komplekse — bruk referansebilder i storyboard-rammer for tydeligere kommunikasjon.');
        }
        nudges.push('Tips: Legg til kameravinkel og linseinformasjon på hver ramme for bedre forberedelse på settet.');
        nudges.push('Tips: Synkroniser storyboardet med manuskriptet for automatisk scene-kobling.');
        break;
      }

      /* ─── Storyboard Split View ─────────────────────── */
      case 'storyboard-split': {
        nudges.push('Tips: Bruk delt visning for å se manuskriptet og storyboardet side om side.');
        nudges.push('Tips: Klikk på en scene i navigatoren for å laste inn tilhørende storyboard-rammer automatisk.');
        break;
      }

      /* ─── Storyboard Templates ──────────────────────── */
      case 'storyboard-templates': {
        nudges.push('Tips: Lagre egne maler for gjentakende skuddtyper — spar tid i planleggingen.');
        nudges.push('Tips: Bruk favoritter-funksjonen for rask tilgang til dine mest brukte maler.');
        const prefST = prefMap.get('storyboard_aspect_ratio');
        if (prefST) {
          nudges.push(`Ditt foretrukne bildeformat: ${prefST.preferenceValue}.`);
        }
        break;
      }

      default:
        break;
    }

    return nudges;
  }
}

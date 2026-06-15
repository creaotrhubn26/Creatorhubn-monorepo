/**
 * lead-map-service.ts
 *
 * The Role Room Lead Map — operasjonell map-CRM på toppen av crm_customers.
 *
 * Strategi: gjenbruker eksisterende crm_customers (Universal CRM) ved å
 * filtrere på rader med lat/lng + lead_status. Hver lead på kartet er
 * en crm_customers-rad. Visits, activities og AI-pitch persisteres i
 * crm_visits / crm_lead_activities (migrasjon 271).
 */

import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL = "claude-opus-4-7";
let cachedAnthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (cachedAnthropic) return cachedAnthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedAnthropic = new Anthropic({ apiKey });
  return cachedAnthropic;
}


// ─────────────────────────────────────────────────────────────────────
// Tenant-scope helper
// ─────────────────────────────────────────────────────────────────────
//
// Wave LM-Agent multi-tenant: hver query filtreres på enten
// (owner_user_id, agent_config_id IS NULL) for Daniels personlige bruk
// ELLER (agent_config_id = $X) for klient-Agent-flow.

interface TenantScope {
  ownerUserId: string;
  agentConfigId?: string | null;
}

function buildTenantConditions(scope: TenantScope, params: unknown[]): string[] {
  if (scope.agentConfigId) {
    params.push(scope.agentConfigId);
    return [`agent_config_id = $${params.length}::uuid`];
  }
  params.push(scope.ownerUserId);
  return [`owner_user_id = $${params.length}`, `agent_config_id IS NULL`];
}

export type LeadStatus =
  | 'unvisited' | 'visited' | 'return' | 'not_present' | 'declined'
  | 'interested' | 'meeting_booked' | 'proposal_sent' | 'won' | 'lost'
  | 'do_not_contact';

export type VisitType = 'physical' | 'phone' | 'email' | 'online_meeting' | 'research';

export interface MapLead {
  id: string;
  name: string;
  company: string | null;
  category: string | null;
  status: LeadStatus;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  googleRating: number | null;
  googlePlaceId: string | null;
  aiOpportunityScore: number | null;
  estimatedValue: number | null;
  leadSource: string | null;
  assignedUserId: string | null;
  lastVisitAt: string | null;
  nextFollowUpAt: string | null;
  nextAction: string | null;
  tags: string[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisitRow {
  id: string;
  customerId: string;
  userId: string;
  visitType: VisitType;
  visitDatetime: string;
  previousStatus: string | null;
  newStatus: string | null;
  contactPerson: string | null;
  conversationSummary: string | null;
  objectionReason: string | null;
  notes: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
}

export interface ActivityRow {
  id: string;
  customerId: string;
  customerName: string | null;
  userId: string | null;
  userName: string | null;
  activityType: string;
  oldValue: string | null;
  newValue: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function rowToLead(row: any): MapLead {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    category: row.lead_category,
    status: (row.lead_status ?? 'unvisited') as LeadStatus,
    address: row.address,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: row.phone,
    email: row.email,
    websiteUrl: row.website_url,
    instagramUrl: row.instagram_url,
    linkedinUrl: row.linkedin_url,
    googleRating: row.google_rating ? Number(row.google_rating) : null,
    googlePlaceId: row.google_place_id,
    aiOpportunityScore: row.ai_opportunity_score,
    estimatedValue: row.estimated_value ? Number(row.estimated_value) : null,
    leadSource: row.lead_source,
    assignedUserId: row.owner_user_id,
    lastVisitAt: row.last_visit_at?.toISOString() ?? null,
    nextFollowUpAt: row.next_follow_up_at?.toISOString() ?? null,
    nextAction: row.next_action,
    tags: row.tags ?? null,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Hent leads innenfor map-bounds + valgfrie filtre. */
export async function listLeadsInBounds(
  pool: Pool, opts: {
    ownerUserId: string;
    agentConfigId?: string | null;
    bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    statusFilter?: LeadStatus[];
    categoryFilter?: string[];
    limit?: number;
  },
): Promise<MapLead[]> {
  const params: unknown[] = [];
  const tenantConds = buildTenantConditions(
    { ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId },
    params,
  );
  const conditions: string[] = [...tenantConds, 'latitude IS NOT NULL', 'longitude IS NOT NULL'];

  if (opts.bounds) {
    params.push(opts.bounds.minLat); conditions.push(`latitude >= $${params.length}::numeric`);
    params.push(opts.bounds.maxLat); conditions.push(`latitude <= $${params.length}::numeric`);
    params.push(opts.bounds.minLng); conditions.push(`longitude >= $${params.length}::numeric`);
    params.push(opts.bounds.maxLng); conditions.push(`longitude <= $${params.length}::numeric`);
  }
  if (opts.statusFilter && opts.statusFilter.length > 0) {
    params.push(opts.statusFilter); conditions.push(`lead_status = ANY($${params.length}::text[])`);
  }
  if (opts.categoryFilter && opts.categoryFilter.length > 0) {
    params.push(opts.categoryFilter); conditions.push(`lead_category = ANY($${params.length}::text[])`);
  }

  params.push(opts.limit ?? 500);
  const r = await pool.query(
    `SELECT id, name, company, lead_category, lead_status, address, postal_code,
            city, country, latitude, longitude, phone, email, website_url,
            instagram_url, linkedin_url, google_rating, google_place_id,
            ai_opportunity_score, estimated_value, lead_source, owner_user_id,
            last_visit_at, next_follow_up_at, next_action, tags, notes,
            created_at, updated_at
     FROM crm_customers
     WHERE ${conditions.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return r.rows.map(rowToLead);
}

export async function getLeadById(
  pool: Pool, scope: TenantScope, leadId: string,
): Promise<MapLead | null> {
  const params: unknown[] = [leadId];
  const tenantConds = buildTenantConditions(scope, params);
  const r = await pool.query(
    `SELECT id, name, company, lead_category, lead_status, address, postal_code,
            city, country, latitude, longitude, phone, email, website_url,
            instagram_url, linkedin_url, google_rating, google_place_id,
            ai_opportunity_score, estimated_value, lead_source, owner_user_id,
            last_visit_at, next_follow_up_at, next_action, tags, notes,
            created_at, updated_at
     FROM crm_customers
     WHERE id = $1::uuid AND ${tenantConds.join(' AND ')}`,
    params,
  );
  return r.rowCount && r.rowCount > 0 ? rowToLead(r.rows[0]) : null;
}

/**
 * Oppdater lead-status. Logger automatisk i crm_lead_activities.
 */
export async function updateLeadStatus(
  pool: Pool, opts: { ownerUserId: string; agentConfigId?: string | null; leadId: string; status: LeadStatus; notes?: string },
): Promise<{ ok: boolean; previous?: string }> {
  const scope: TenantScope = { ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId };
  const checkParams: unknown[] = [opts.leadId];
  const checkConds = buildTenantConditions(scope, checkParams);
  const current = await pool.query<{ lead_status: string }>(
    `SELECT lead_status FROM crm_customers
     WHERE id = $1::uuid AND ${checkConds.join(' AND ')}`,
    checkParams,
  );
  if (current.rowCount === 0) return { ok: false };

  const previous = current.rows[0].lead_status;

  const upParams: unknown[] = [opts.status, opts.leadId];
  const upConds = buildTenantConditions(scope, upParams);
  await pool.query(
    `UPDATE crm_customers
       SET lead_status = $1, updated_at = NOW()
     WHERE id = $2::uuid AND ${upConds.join(' AND ')}`,
    upParams,
  );

  await pool.query(
    `INSERT INTO crm_lead_activities (
       customer_id, user_id, activity_type, old_value, new_value, description
     ) VALUES ($1::uuid, $2, 'status_changed', $3, $4, $5)`,
    [
      opts.leadId, opts.ownerUserId, previous, opts.status,
      opts.notes ?? `Status: ${previous} → ${opts.status}`,
    ],
  );

  return { ok: true, previous };
}

export async function logVisit(
  pool: Pool, opts: {
    ownerUserId: string;
    agentConfigId?: string | null;
    leadId: string;
    visitType: VisitType;
    contactPerson?: string;
    conversationSummary?: string;
    objectionReason?: string;
    notes?: string;
    newStatus?: LeadStatus;
    nextAction?: string;
    nextFollowUpAt?: string;
    visitLatitude?: number;
    visitLongitude?: number;
  },
): Promise<{ ok: boolean; visitId?: string }> {
  // Verifiser eierskap (tenant-aware)
  const verifyParams: unknown[] = [opts.leadId];
  const verifyConds = buildTenantConditions(
    { ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId },
    verifyParams,
  );
  const c = await pool.query<{ lead_status: string }>(
    `SELECT lead_status FROM crm_customers
     WHERE id = $1::uuid AND ${verifyConds.join(' AND ')}`,
    verifyParams,
  );
  if (c.rowCount === 0) return { ok: false };
  const previousStatus = c.rows[0].lead_status;

  const v = await pool.query<{ id: string }>(
    `INSERT INTO crm_visits (
       customer_id, user_id, visit_type, previous_status, new_status,
       contact_person, conversation_summary, objection_reason, notes,
       next_action, next_follow_up_at, visit_latitude, visit_longitude
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
     )
     RETURNING id::text`,
    [
      opts.leadId, opts.ownerUserId, opts.visitType, previousStatus,
      opts.newStatus ?? null,
      opts.contactPerson ?? null, opts.conversationSummary ?? null,
      opts.objectionReason ?? null, opts.notes ?? null,
      opts.nextAction ?? null, opts.nextFollowUpAt ?? null,
      opts.visitLatitude ?? null, opts.visitLongitude ?? null,
    ],
  );

  // Oppdater crm_customers (tenant-aware)
  const upParams: unknown[] = [
    opts.nextAction ?? null,
    opts.nextFollowUpAt ?? null,
    opts.newStatus ?? null,
    opts.leadId,
  ];
  const upConds = buildTenantConditions(
    { ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId },
    upParams,
  );
  await pool.query(
    `UPDATE crm_customers
       SET last_visit_at = NOW(),
           next_action = COALESCE($1, next_action),
           next_follow_up_at = COALESCE($2::timestamptz, next_follow_up_at),
           lead_status = COALESCE($3, lead_status),
           updated_at = NOW()
     WHERE id = $4::uuid AND ${upConds.join(' AND ')}`,
    upParams,
  );

  // Audit
  await pool.query(
    `INSERT INTO crm_lead_activities (
       customer_id, user_id, activity_type, new_value, description, metadata
     ) VALUES ($1::uuid, $2, 'visit_logged', $3, $4, $5::jsonb)`,
    [
      opts.leadId, opts.ownerUserId, opts.visitType,
      `Visit ${opts.visitType}${opts.contactPerson ? ` med ${opts.contactPerson}` : ''}`,
      JSON.stringify({ newStatus: opts.newStatus, conversationSummary: opts.conversationSummary }),
    ],
  );

  return { ok: true, visitId: v.rows[0].id };
}

export async function listVisits(
  pool: Pool, scope: TenantScope, leadId: string, limit = 30,
): Promise<VisitRow[]> {
  const params: unknown[] = [leadId];
  const tenantConds = buildTenantConditions(scope, params).map((c) => c.replace(/(\w+_id|agent_config_id)/, 'c.$1'));
  params.push(limit);
  const r = await pool.query(
    `SELECT v.id::text, v.customer_id::text, v.user_id, v.visit_type,
            v.visit_datetime, v.previous_status, v.new_status,
            v.contact_person, v.conversation_summary, v.objection_reason,
            v.notes, v.next_action, v.next_follow_up_at
     FROM crm_visits v
     JOIN crm_customers c ON c.id = v.customer_id
     WHERE v.customer_id = $1::uuid AND ${tenantConds.join(' AND ')}
     ORDER BY v.visit_datetime DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    userId: row.user_id,
    visitType: row.visit_type as VisitType,
    visitDatetime: row.visit_datetime.toISOString(),
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    contactPerson: row.contact_person,
    conversationSummary: row.conversation_summary,
    objectionReason: row.objection_reason,
    notes: row.notes,
    nextAction: row.next_action,
    nextFollowUpAt: row.next_follow_up_at?.toISOString() ?? null,
  }));
}

export async function listRecentActivities(
  pool: Pool, scope: TenantScope, limit = 30,
): Promise<ActivityRow[]> {
  const params: unknown[] = [];
  const tenantConds = buildTenantConditions(scope, params).map((c) => c.replace(/(\w+_id|agent_config_id)/, 'c.$1'));
  params.push(limit);
  const r = await pool.query(
    `SELECT a.id::text, a.customer_id::text, c.name AS customer_name,
            a.user_id, u.first_name AS user_first, u.last_name AS user_last,
            a.activity_type, a.old_value, a.new_value, a.description,
            a.metadata, a.created_at
     FROM crm_lead_activities a
     JOIN crm_customers c ON c.id = a.customer_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE ${tenantConds.join(' AND ')}
     ORDER BY a.created_at DESC LIMIT $${params.length}`,
    params,
  );
  return r.rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    userId: row.user_id,
    userName: row.user_first && row.user_last ? `${row.user_first} ${row.user_last}` : row.user_first,
    activityType: row.activity_type,
    oldValue: row.old_value,
    newValue: row.new_value,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getLeadMapMetrics(
  pool: Pool, scope: TenantScope,
): Promise<{
  totalLeads: number;
  followUpsDue: number;
  meetingsBooked: number;
  conversionRate: number;
  statusCounts: Record<LeadStatus, number>;
  // Reelle tidsserier (siste 7 dager) + trend-% (siste 7d vs forrige 7d).
  // null = ingen historikk ennå → frontend skjuler sparkline/trend.
  trends: {
    totalLeads: number | null;
    followUpsDue: number | null;
    meetingsBooked: number | null;
    conversionRate: number | null;
  };
  sparklines: {
    totalLeads: number[] | null;
    followUpsDue: number[] | null;
    meetingsBooked: number[] | null;
    conversionRate: number[] | null;
  };
}> {
  const statsParams: unknown[] = [];
  const statsConds = buildTenantConditions(scope, statsParams);
  const stats = await pool.query<{ lead_status: LeadStatus; n: number }>(
    `SELECT lead_status, COUNT(*)::int AS n FROM crm_customers
     WHERE ${statsConds.join(' AND ')} GROUP BY lead_status`,
    statsParams,
  );
  const statusCounts: Record<string, number> = {};
  for (const r of stats.rows) statusCounts[r.lead_status] = r.n;

  const fParams: unknown[] = [];
  const fConds = buildTenantConditions(scope, fParams);
  const followups = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM crm_customers
     WHERE ${fConds.join(' AND ')}
       AND next_follow_up_at IS NOT NULL
       AND next_follow_up_at <= NOW() + INTERVAL '7 days'
       AND lead_status NOT IN ('won', 'lost', 'do_not_contact')`,
    fParams,
  );

  const meetings = (statusCounts.meeting_booked ?? 0);
  const won = statusCounts.won ?? 0;
  const lost = statusCounts.lost ?? 0;
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const closeable = won + lost;
  const conversionRate = closeable > 0 ? Math.round((won / closeable) * 100) : 0;

  // === Historikk-serier (siste 14 dager → split i 7+7) ===
  // Ekte data fra crm_customers + crm_lead_activities. Hvis ingen rader → null.
  const histParams: unknown[] = [];
  const histConds = buildTenantConditions(scope, histParams);

  // 1) New leads per dag (siste 14 dager) — basert på created_at
  const newLeadsHist = await pool.query<{ d: string; n: number }>(
    `WITH days AS (
       SELECT generate_series(
         (CURRENT_DATE - INTERVAL '13 days')::date,
         CURRENT_DATE,
         INTERVAL '1 day'
       )::date AS d
     )
     SELECT days.d::text AS d,
            COUNT(c.id)::int AS n
       FROM days
       LEFT JOIN crm_customers c
         ON DATE(c.created_at) = days.d
        AND ${histConds.join(' AND ')}
      GROUP BY days.d
      ORDER BY days.d`,
    histParams,
  );

  // 2) Meeting-booking-events per dag (siste 14 dager) — fra crm_lead_activities
  //    Bruker new_value på 'status_changed'-rader for å fange status='meeting_booked'.
  //    'meeting_scheduled' er en separat activity-type for kalender-events.
  const meetingsHist = await pool.query<{ d: string; n: number }>(
    `WITH days AS (
       SELECT generate_series(
         (CURRENT_DATE - INTERVAL '13 days')::date,
         CURRENT_DATE,
         INTERVAL '1 day'
       )::date AS d
     )
     SELECT days.d::text AS d,
            COUNT(a.id)::int AS n
       FROM days
       LEFT JOIN crm_lead_activities a
         ON DATE(a.created_at) = days.d
        AND (
          a.activity_type = 'meeting_scheduled'
          OR (a.activity_type = 'status_changed' AND a.new_value = 'meeting_booked')
        )
      GROUP BY days.d
      ORDER BY days.d`,
  );

  // 3) Wins per dag (siste 14 dager) — for conversion-trend
  const winsHist = await pool.query<{ d: string; n: number }>(
    `WITH days AS (
       SELECT generate_series(
         (CURRENT_DATE - INTERVAL '13 days')::date,
         CURRENT_DATE,
         INTERVAL '1 day'
       )::date AS d
     )
     SELECT days.d::text AS d,
            COUNT(a.id)::int AS n
       FROM days
       LEFT JOIN crm_lead_activities a
         ON DATE(a.created_at) = days.d
        AND a.activity_type = 'status_changed'
        AND a.new_value = 'won'
      GROUP BY days.d
      ORDER BY days.d`,
  );

  // 4) Follow-ups due per dag (siste 14 dager) — snapshot pr dag
  const followupsHist = await pool.query<{ d: string; n: number }>(
    `WITH days AS (
       SELECT generate_series(
         (CURRENT_DATE - INTERVAL '13 days')::date,
         CURRENT_DATE,
         INTERVAL '1 day'
       )::date AS d
     )
     SELECT days.d::text AS d,
            COUNT(c.id)::int AS n
       FROM days
       LEFT JOIN crm_customers c
         ON DATE(c.next_follow_up_at) = days.d
        AND ${histConds.join(' AND ')}
      GROUP BY days.d
      ORDER BY days.d`,
    histParams,
  );

  // Hjelpere — bygg 14-tall serie + trend + last-7-window for sparkline
  function toSeries(rows: { n: number }[]): number[] {
    return rows.map((r) => r.n);
  }
  function lastSeven(series: number[]): number[] | null {
    if (series.length < 7) return null;
    const seven = series.slice(-7);
    if (seven.every((n) => n === 0)) return null;
    return seven;
  }
  function trendPct(series: number[]): number | null {
    if (series.length < 14) return null;
    const prev = series.slice(0, 7).reduce((a, b) => a + b, 0);
    const last = series.slice(-7).reduce((a, b) => a + b, 0);
    if (prev === 0 && last === 0) return null;
    if (prev === 0) return 100; // alt nytt
    return Math.round(((last - prev) / prev) * 1000) / 10; // 1 desimal
  }

  const newLeadsSeries = toSeries(newLeadsHist.rows);
  const meetingsSeries = toSeries(meetingsHist.rows);
  const winsSeries = toSeries(winsHist.rows);
  const followupsSeries = toSeries(followupsHist.rows);

  // Conversion-rate per dag (rolling): wins / (wins+lost-actions per dag).
  // For enkelhet bruker vi cumulative wins-ratio som proxy — hvis ingen
  // historikk gir vi null.
  const totalAction = winsSeries.reduce((a, b) => a + b, 0);
  const convSparkline =
    totalAction > 0
      ? winsSeries.map((w) => (totalAction > 0 ? Math.round((w / totalAction) * 100) : 0))
      : null;

  return {
    totalLeads: total,
    followUpsDue: followups.rows[0]?.n ?? 0,
    meetingsBooked: meetings,
    conversionRate,
    statusCounts: statusCounts as Record<LeadStatus, number>,
    trends: {
      totalLeads: trendPct(newLeadsSeries),
      followUpsDue: trendPct(followupsSeries),
      meetingsBooked: trendPct(meetingsSeries),
      conversionRate: trendPct(winsSeries),
    },
    sparklines: {
      totalLeads: lastSeven(newLeadsSeries),
      followUpsDue: lastSeven(followupsSeries),
      meetingsBooked: lastSeven(meetingsSeries),
      conversionRate: convSparkline,
    },
  };
}

export async function setLeadGeo(
  pool: Pool, opts: {
    ownerUserId: string; agentConfigId?: string | null; leadId: string;
    latitude: number; longitude: number;
    address?: string; postalCode?: string; city?: string; country?: string;
  },
): Promise<{ ok: boolean }> {
  const r = await pool.query(
    `UPDATE crm_customers
       SET latitude = $1::numeric, longitude = $2::numeric,
           address = COALESCE($3, address),
           postal_code = COALESCE($4, postal_code),
           city = COALESCE($5, city),
           country = COALESCE($6, country),
           updated_at = NOW()
     WHERE id = $7::uuid AND ${(() => {
       const _p: unknown[] = []; return buildTenantConditions({ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId}, _p).join(' AND ').replace(/\$(\d+)/g, (_, n) => `$${7 + Number(n)}`);
     })()}`,
    [
      opts.latitude, opts.longitude,
      opts.address ?? null, opts.postalCode ?? null,
      opts.city ?? null, opts.country ?? null,
      opts.leadId, ...((): unknown[] => {
        const _p: unknown[] = [];
        buildTenantConditions({ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId}, _p);
        return _p;
      })(),
    ],
  );
  return { ok: (r.rowCount ?? 0) > 0 };
}

// ─────────────────────────────────────────────────────────────────────
// Claude AI pitch + Google Places integration
// ─────────────────────────────────────────────────────────────────────

export interface PitchSuggestion {
  opportunityScore: number;        // 0-100
  summary: string;
  suggestedPackage: string;
  pitchSubject: string;
  pitchBody: string;
}

/**
 * Generer pitch + opportunity-score for en lead via Claude.
 * Bruker lead-kontekst (kategori, notater, status, Google-rating, social).
 * Persisteres i activity-log + crm_customers.ai_opportunity_score.
 */
export async function generateLeadPitch(
  pool: Pool, opts: { ownerUserId: string; agentConfigId?: string | null; leadId: string; serviceFocus?: string },
): Promise<PitchSuggestion | null> {
  const lead = await getLeadById(pool, { ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId }, opts.leadId);
  if (!lead) return null;

  const client = getAnthropic();
  if (!client) return null;

  const context = `LEAD: ${lead.name}${lead.company ? ` (${lead.company})` : ''}
KATEGORI: ${lead.category ?? 'ukjent'}
STATUS: ${lead.status}
LOKASJON: ${lead.address ?? ''}${lead.city ? `, ${lead.city}` : ''}
GOOGLE-RATING: ${lead.googleRating ?? 'n/a'}
NOTES: ${lead.notes ?? 'ingen'}
WEBSITE: ${lead.websiteUrl ?? 'n/a'}
INSTAGRAM: ${lead.instagramUrl ?? 'n/a'}
SISTE BESØK: ${lead.lastVisitAt ?? 'aldri'}
${opts.serviceFocus ? `\nFOKUS-OMRÅDE: ${opts.serviceFocus}` : ''}`;

  const prompt = `Du er Customer Acquisition-strateg for The Role Room (norsk casting-/produksjonsplattform fra Creatorhub AS).
Skriv NORSK. Lag en konkret, ikke-generisk pitch til en lokal bedrift.

${context}

Mål: 1) score opportunity 0-100 basert på match med The Role Rooms tjenester (produksjon, casting, sosial-mediar-innhold, B2B-akkvisisjon),
2) foreslå konkret pakke,
3) skriv pitch-email (norsk, vennlig, ikke-pågående).

Returner KUN JSON (ingen markdown, ingen kommentarer):
{
  "opportunity_score": <0-100>,
  "summary": "<2 setninger som forklarer scoren>",
  "suggested_package": "<konkret pakke-beskrivelse, f.eks 'månedlig sosial-pakke: 4 reels + 8 stillsbilder + meta-ads'>",
  "pitch_subject": "<engasjerende email-emne>",
  "pitch_body": "<3-4 avsnitt email-tekst, norsk, ikke salesy>"
}`;

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL, max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      opportunity_score?: number; summary?: string;
      suggested_package?: string; pitch_subject?: string; pitch_body?: string;
    };
    if (!parsed.summary || !parsed.pitch_body) return null;

    const score = Math.min(100, Math.max(0, Math.round(parsed.opportunity_score ?? 50)));

    // Persister score + audit
    const upParams: unknown[] = [score, opts.leadId];
    const upConds = buildTenantConditions(
      { ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId },
      upParams,
    );
    await pool.query(
      `UPDATE crm_customers SET ai_opportunity_score = $1, updated_at = NOW()
       WHERE id = $2::uuid AND ${upConds.join(' AND ')}`,
      upParams,
    );
    await pool.query(
      `INSERT INTO crm_lead_activities (
         customer_id, user_id, activity_type, new_value, description, metadata
       ) VALUES ($1::uuid, $2, 'pitch_generated', $3, $4, $5::jsonb)`,
      [
        opts.leadId, opts.ownerUserId,
        String(score),
        `Pitch generert (score ${score})`,
        JSON.stringify({
          suggestedPackage: parsed.suggested_package,
          pitchSubject: parsed.pitch_subject,
        }),
      ],
    );

    return {
      opportunityScore: score,
      summary: parsed.summary.slice(0, 600),
      suggestedPackage: (parsed.suggested_package ?? '').slice(0, 400),
      pitchSubject: (parsed.pitch_subject ?? '').slice(0, 200),
      pitchBody: parsed.pitch_body.slice(0, 2000),
    };
  } catch (err) {
    console.warn('[lead-map] Claude pitch feilet', { err: (err as Error).message });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Google Places-integrasjon — søk + import
// ─────────────────────────────────────────────────────────────────────

interface PlacesSearchOpts {
  ownerUserId: string;
  agentConfigId?: string | null;
  query: string;                   // f.eks. "skuespiller-byrå Oslo"
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  type?: string;                   // Google Places type
}

interface PlaceResult {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  category: string | null;
  websiteUrl: string | null;
  phone: string | null;
  alreadyImported: boolean;
}

/** Søk Google Places. Returnerer kandidater + om de allerede er importert. */
export async function searchPlaces(
  pool: Pool, opts: PlacesSearchOpts,
): Promise<{ ok: true; results: PlaceResult[] } | { ok: false; reason: string }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { ok: false, reason: 'places_api_key_missing' };

  // Bruk Places API v1 Text Search (nyere endpoint, mer fleksibel enn legacy)
  const body: Record<string, unknown> = {
    textQuery: opts.query,
    languageCode: 'no',
    maxResultCount: 20,
  };
  if (opts.latitude && opts.longitude && opts.radiusMeters) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.latitude, longitude: opts.longitude },
        radius: opts.radiusMeters,
      },
    };
  }

  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types,places.websiteUri,places.internationalPhoneNumber',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text();
      return { ok: false, reason: `places_http_${r.status}: ${text.slice(0, 200)}` };
    }
    const data = await r.json() as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        types?: string[];
        websiteUri?: string;
        internationalPhoneNumber?: string;
      }>;
    };
    const places = data.places ?? [];
    const placeIds = places.map((p) => p.id);

    // Sjekk hvilke som allerede er importert
    let importedSet = new Set<string>();
    if (placeIds.length > 0) {
      const dupParams: unknown[] = [];
      const dupConds = buildTenantConditions(
        { ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId },
        dupParams,
      );
      dupParams.push(placeIds);
      const existing = await pool.query<{ google_place_id: string }>(
        `SELECT google_place_id FROM crm_customers
         WHERE ${dupConds.join(' AND ')} AND google_place_id = ANY($${dupParams.length}::text[])`,
        dupParams,
      );
      importedSet = new Set(existing.rows.map((row) => row.google_place_id));
    }

    const results: PlaceResult[] = places.map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? 'Unknown',
      address: p.formattedAddress ?? null,
      latitude: p.location?.latitude ?? 0,
      longitude: p.location?.longitude ?? 0,
      rating: p.rating ?? null,
      category: p.types?.[0]?.replace(/_/g, ' ') ?? null,
      websiteUrl: p.websiteUri ?? null,
      phone: p.internationalPhoneNumber ?? null,
      alreadyImported: importedSet.has(p.id),
    }));

    return { ok: true, results };
  } catch (err) {
    return { ok: false, reason: `places_error: ${(err as Error).message}` };
  }
}

/** Importer ett Places-resultat som ny crm_customers-rad. */
export async function importPlaceAsLead(
  pool: Pool, opts: {
    ownerUserId: string;
    agentConfigId?: string | null;
    place: PlaceResult;
    leadCategory?: string;
  },
): Promise<{ ok: true; leadId: string } | { ok: false; reason: string }> {
  // Sjekk om allerede importert (tenant-aware)
  const dupParams: unknown[] = [];
  const dupConds = buildTenantConditions(
    { ownerUserId: opts.ownerUserId, agentConfigId: opts.agentConfigId },
    dupParams,
  );
  dupParams.push(opts.place.placeId);
  const dup = await pool.query<{ id: string }>(
    `SELECT id FROM crm_customers
     WHERE ${dupConds.join(' AND ')} AND google_place_id = $${dupParams.length} LIMIT 1`,
    dupParams,
  );
  if (dup.rowCount && dup.rowCount > 0) {
    return { ok: false, reason: 'already_imported' };
  }

  const r = await pool.query<{ id: string }>(
    `INSERT INTO crm_customers (
       id, name, phone, email, company, status, source, owner_user_id, agent_config_id,
       latitude, longitude, address, google_place_id, google_rating,
       website_url, lead_category, lead_status, lead_source,
       created_at, updated_at
     ) VALUES (
       gen_random_uuid(), $1, $2, NULL, $3, 'lead', 'google_places', $4, $5::uuid,
       $6::numeric, $7::numeric, $8, $9, $10::numeric, $11, $12, 'unvisited',
       'google_places', NOW(), NOW()
     )
     RETURNING id::text`,
    [
      opts.place.name, opts.place.phone, opts.place.name,
      opts.ownerUserId, opts.agentConfigId ?? null,
      opts.place.latitude, opts.place.longitude, opts.place.address,
      opts.place.placeId, opts.place.rating,
      opts.place.websiteUrl,
      opts.leadCategory ?? opts.place.category,
    ],
  );
  const leadId = r.rows[0].id;

  // Audit
  await pool.query(
    `INSERT INTO crm_lead_activities (
       customer_id, user_id, activity_type, new_value, description
     ) VALUES ($1::uuid, $2, 'lead_imported', 'google_places', $3)`,
    [leadId, opts.ownerUserId, `Imported "${opts.place.name}" from Google Places`],
  );

  return { ok: true, leadId };
}

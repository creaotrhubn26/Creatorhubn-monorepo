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
    bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    statusFilter?: LeadStatus[];
    categoryFilter?: string[];
    limit?: number;
  },
): Promise<MapLead[]> {
  const conditions: string[] = ['owner_user_id = $1', 'latitude IS NOT NULL', 'longitude IS NOT NULL'];
  const params: unknown[] = [opts.ownerUserId];

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
  pool: Pool, ownerUserId: string, leadId: string,
): Promise<MapLead | null> {
  const r = await pool.query(
    `SELECT id, name, company, lead_category, lead_status, address, postal_code,
            city, country, latitude, longitude, phone, email, website_url,
            instagram_url, linkedin_url, google_rating, google_place_id,
            ai_opportunity_score, estimated_value, lead_source, owner_user_id,
            last_visit_at, next_follow_up_at, next_action, tags, notes,
            created_at, updated_at
     FROM crm_customers
     WHERE id = $1::uuid AND owner_user_id = $2`,
    [leadId, ownerUserId],
  );
  return r.rowCount && r.rowCount > 0 ? rowToLead(r.rows[0]) : null;
}

/**
 * Oppdater lead-status. Logger automatisk i crm_lead_activities.
 */
export async function updateLeadStatus(
  pool: Pool, opts: { ownerUserId: string; leadId: string; status: LeadStatus; notes?: string },
): Promise<{ ok: boolean; previous?: string }> {
  const current = await pool.query<{ lead_status: string }>(
    `SELECT lead_status FROM crm_customers
     WHERE id = $1::uuid AND owner_user_id = $2`,
    [opts.leadId, opts.ownerUserId],
  );
  if (current.rowCount === 0) return { ok: false };

  const previous = current.rows[0].lead_status;

  await pool.query(
    `UPDATE crm_customers
       SET lead_status = $1, updated_at = NOW()
     WHERE id = $2::uuid AND owner_user_id = $3`,
    [opts.status, opts.leadId, opts.ownerUserId],
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
  // Verifiser eierskap
  const c = await pool.query<{ lead_status: string }>(
    `SELECT lead_status FROM crm_customers
     WHERE id = $1::uuid AND owner_user_id = $2`,
    [opts.leadId, opts.ownerUserId],
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

  // Oppdater crm_customers med last_visit_at + next_action + next_follow_up_at
  await pool.query(
    `UPDATE crm_customers
       SET last_visit_at = NOW(),
           next_action = COALESCE($1, next_action),
           next_follow_up_at = COALESCE($2::timestamptz, next_follow_up_at),
           lead_status = COALESCE($3, lead_status),
           updated_at = NOW()
     WHERE id = $4::uuid AND owner_user_id = $5`,
    [
      opts.nextAction ?? null,
      opts.nextFollowUpAt ?? null,
      opts.newStatus ?? null,
      opts.leadId, opts.ownerUserId,
    ],
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
  pool: Pool, ownerUserId: string, leadId: string, limit = 30,
): Promise<VisitRow[]> {
  const r = await pool.query(
    `SELECT v.id::text, v.customer_id::text, v.user_id, v.visit_type,
            v.visit_datetime, v.previous_status, v.new_status,
            v.contact_person, v.conversation_summary, v.objection_reason,
            v.notes, v.next_action, v.next_follow_up_at
     FROM crm_visits v
     JOIN crm_customers c ON c.id = v.customer_id
     WHERE v.customer_id = $1::uuid AND c.owner_user_id = $2
     ORDER BY v.visit_datetime DESC LIMIT $3`,
    [leadId, ownerUserId, limit],
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
  pool: Pool, ownerUserId: string, limit = 30,
): Promise<ActivityRow[]> {
  const r = await pool.query(
    `SELECT a.id::text, a.customer_id::text, c.name AS customer_name,
            a.user_id, u.first_name AS user_first, u.last_name AS user_last,
            a.activity_type, a.old_value, a.new_value, a.description,
            a.metadata, a.created_at
     FROM crm_lead_activities a
     JOIN crm_customers c ON c.id = a.customer_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE c.owner_user_id = $1
     ORDER BY a.created_at DESC LIMIT $2`,
    [ownerUserId, limit],
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
  pool: Pool, ownerUserId: string,
): Promise<{
  totalLeads: number;
  followUpsDue: number;
  meetingsBooked: number;
  conversionRate: number;
  statusCounts: Record<LeadStatus, number>;
}> {
  const stats = await pool.query<{ lead_status: LeadStatus; n: number }>(
    `SELECT lead_status, COUNT(*)::int AS n FROM crm_customers
     WHERE owner_user_id = $1 GROUP BY lead_status`,
    [ownerUserId],
  );
  const statusCounts: Record<string, number> = {};
  for (const r of stats.rows) statusCounts[r.lead_status] = r.n;

  const followups = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM crm_customers
     WHERE owner_user_id = $1
       AND next_follow_up_at IS NOT NULL
       AND next_follow_up_at <= NOW() + INTERVAL '7 days'
       AND lead_status NOT IN ('won', 'lost', 'do_not_contact')`,
    [ownerUserId],
  );

  const meetings = (statusCounts.meeting_booked ?? 0);
  const won = statusCounts.won ?? 0;
  const lost = statusCounts.lost ?? 0;
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const closeable = won + lost;
  const conversionRate = closeable > 0 ? Math.round((won / closeable) * 100) : 0;

  return {
    totalLeads: total,
    followUpsDue: followups.rows[0]?.n ?? 0,
    meetingsBooked: meetings,
    conversionRate,
    statusCounts: statusCounts as Record<LeadStatus, number>,
  };
}

export async function setLeadGeo(
  pool: Pool, opts: {
    ownerUserId: string; leadId: string;
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
     WHERE id = $7::uuid AND owner_user_id = $8`,
    [
      opts.latitude, opts.longitude,
      opts.address ?? null, opts.postalCode ?? null,
      opts.city ?? null, opts.country ?? null,
      opts.leadId, opts.ownerUserId,
    ],
  );
  return { ok: (r.rowCount ?? 0) > 0 };
}

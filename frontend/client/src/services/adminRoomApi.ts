/**
 * adminRoomApi.ts
 *
 * Klient for det interne Admin Room-arbeidsrommet
 * (kun tilgjengelig for daniel@creatorhubn.com).
 */

const BASE = '/api/admin-room';

function getAuthToken(): string {
  return (
    localStorage.getItem('creatorhub_auth_token')
    || localStorage.getItem('authToken')
    || ''
  );
}

async function jsonFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error || body?.detail || '';
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return (await response.json()) as T;
}

// ─────────────────────────────────────────────────────────
// Funding apps (IN-støtteordninger)
// ─────────────────────────────────────────────────────────

export type FundingAppStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface FundingMilestone {
  title: string;
  date?: string;
  description?: string;
}

export interface FundingBudgetLine {
  category: string;
  amount: number;
  description?: string;
}

export interface FundingApp {
  id: string;
  user_id: string;
  scheme: string;
  scheme_label: string;
  project_name: string;
  applicant_company: string | null;
  status: FundingAppStatus;
  amount_requested: number | null;
  currency: string;
  description: string | null;
  milestones: FundingMilestone[];
  budget_breakdown: FundingBudgetLine[];
  contact_person: string | null;
  contact_email: string | null;
  submission_date: string | null;
  decision_date: string | null;
  deadline: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type FundingAppInput = Omit<
  Partial<FundingApp>,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> & {
  scheme?: string;
  schemeLabel?: string;
  projectName?: string;
  applicantCompany?: string | null;
  amountRequested?: number | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  submissionDate?: string | null;
  decisionDate?: string | null;
  deadline?: string | null;
  budgetBreakdown?: FundingBudgetLine[];
};

// IN-støtteordninger: typisk søknadsvindu og behandlingstid.
export const FUNDING_SCHEME_DEADLINES: Record<string, string> = {
  innovasjon_norge_1: 'Løpende søknadsfrist · behandlingstid 4-8 uker',
  innovasjon_norge_2: 'Løpende søknadsfrist · behandlingstid 6-10 uker',
  in_innovasjonskontrakter: 'Utlysningsbasert — typisk 2-4 utlysninger per år',
  eu_horizon_eic: 'Cut-off-datoer hver 2-3 mnd (mars · juni · oktober)',
};

export const fundingAppsApi = {
  list: async (): Promise<FundingApp[]> => {
    const data = await jsonFetch<{ items: FundingApp[] }>('/funding-apps');
    return data.items;
  },
  create: async (input: FundingAppInput): Promise<FundingApp> => {
    const data = await jsonFetch<{ item: FundingApp }>('/funding-apps', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  patch: async (id: string, input: FundingAppInput): Promise<FundingApp> => {
    const data = await jsonFetch<{ item: FundingApp }>(`/funding-apps/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  remove: async (id: string): Promise<void> => {
    await jsonFetch(`/funding-apps/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  generate: async (id: string): Promise<{ item: FundingApp; tokens: { input: number; output: number } }> => {
    return jsonFetch(`/funding-apps/${encodeURIComponent(id)}/generate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};

// ─────────────────────────────────────────────────────────
// Activity log
// ─────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export const activityLogApi = {
  list: async (options?: { limit?: number; entityType?: string; entityId?: string }): Promise<ActivityLogEntry[]> => {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.entityType) params.set('entityType', options.entityType);
    if (options?.entityId) params.set('entityId', options.entityId);
    const data = await jsonFetch<{ items: ActivityLogEntry[] }>(
      `/activity-log${params.toString() ? `?${params.toString()}` : ''}`,
    );
    return data.items;
  },
};

// ─────────────────────────────────────────────────────────
// Investor contacts
// ─────────────────────────────────────────────────────────

export type InvestorStatus =
  | 'lead'
  | 'contacted'
  | 'meeting_booked'
  | 'in_diligence'
  | 'term_sheet'
  | 'closed_won'
  | 'closed_lost';

export interface DueDiligenceItem {
  label: string;
  done: boolean;
}

export interface InvestorContact {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: InvestorStatus;
  ticket_size_min: number | null;
  ticket_size_max: number | null;
  currency: string;
  focus_areas: string[];
  intro_source: string | null;
  next_step: string | null;
  next_step_due: string | null;
  notes: string | null;
  last_contact_at: string | null;
  dd_checklist: DueDiligenceItem[];
  deck_url: string | null;
  deck_uploaded_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type InvestorContactInput = {
  companyName?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: InvestorStatus;
  ticketSizeMin?: number | null;
  ticketSizeMax?: number | null;
  currency?: string;
  focusAreas?: string[];
  introSource?: string | null;
  nextStep?: string | null;
  nextStepDue?: string | null;
  notes?: string | null;
  lastContactAt?: string | null;
  ddChecklist?: DueDiligenceItem[];
  deckUrl?: string | null;
  deckUploadedAt?: string | null;
};

// Standard due-diligence-sjekkliste — startpunkt for hver investor.
export const DEFAULT_DD_CHECKLIST: DueDiligenceItem[] = [
  { label: 'Pitch deck levert', done: false },
  { label: 'Aksjonærliste (cap table)', done: false },
  { label: 'Siste 2 års regnskap', done: false },
  { label: '12-mnd budsjett + cashflow', done: false },
  { label: 'Pipeline / traction-tall', done: false },
  { label: 'Ansattlister + lønnsbudsjett', done: false },
  { label: 'IP-/rettighetsstruktur', done: false },
  { label: 'Kundekontrakter (top 5)', done: false },
  { label: 'Term sheet utkast', done: false },
];

export const investorContactsApi = {
  list: async (): Promise<InvestorContact[]> => {
    const data = await jsonFetch<{ items: InvestorContact[] }>('/investor-contacts');
    return data.items;
  },
  create: async (input: InvestorContactInput): Promise<InvestorContact> => {
    const data = await jsonFetch<{ item: InvestorContact }>('/investor-contacts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  patch: async (id: string, input: InvestorContactInput): Promise<InvestorContact> => {
    const data = await jsonFetch<{ item: InvestorContact }>(`/investor-contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  remove: async (id: string): Promise<void> => {
    await jsonFetch(`/investor-contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

// ─────────────────────────────────────────────────────────
// Partner contacts
// ─────────────────────────────────────────────────────────

export type PartnerStatus = 'potential' | 'in_talks' | 'active' | 'paused' | 'ended';
export type PartnershipType = 'distribution' | 'tech' | 'content' | 'production' | 'other';

export type PartnerContractStatus = 'none' | 'draft' | 'in_review' | 'signed' | 'expired';

export interface PartnerContact {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  partnership_type: PartnershipType;
  status: PartnerStatus;
  proposal_summary: string | null;
  next_step: string | null;
  next_step_due: string | null;
  notes: string | null;
  contract_status: PartnerContractStatus | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type PartnerContactInput = {
  companyName?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  partnershipType?: PartnershipType;
  status?: PartnerStatus;
  proposalSummary?: string | null;
  nextStep?: string | null;
  nextStepDue?: string | null;
  notes?: string | null;
  contractStatus?: PartnerContractStatus | null;
};

export const PARTNER_CONTRACT_STATUS_LABELS: Record<PartnerContractStatus, string> = {
  none: 'Ingen kontrakt',
  draft: 'Utkast',
  in_review: 'Under review',
  signed: 'Signert',
  expired: 'Utløpt',
};

export const partnerContactsApi = {
  list: async (): Promise<PartnerContact[]> => {
    const data = await jsonFetch<{ items: PartnerContact[] }>('/partner-contacts');
    return data.items;
  },
  create: async (input: PartnerContactInput): Promise<PartnerContact> => {
    const data = await jsonFetch<{ item: PartnerContact }>('/partner-contacts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  patch: async (id: string, input: PartnerContactInput): Promise<PartnerContact> => {
    const data = await jsonFetch<{ item: PartnerContact }>(`/partner-contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  remove: async (id: string): Promise<void> => {
    await jsonFetch(`/partner-contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

// ─────────────────────────────────────────────────────────
// Display labels
// ─────────────────────────────────────────────────────────

export const FUNDING_SCHEME_PRESETS: Array<{
  scheme: string;
  label: string;
  defaultAmount: number;
  description: string;
}> = [
  {
    scheme: 'innovasjon_norge_1',
    label: 'IN — Markedsavklaring',
    defaultAmount: 100000,
    description: 'Markedsavklaring (1) — utforsk markedsbehov og første forretningsmodell.',
  },
  {
    scheme: 'innovasjon_norge_2',
    label: 'IN — Kommersialisering',
    defaultAmount: 700000,
    description: 'Kommersialisering (2) — pilotering, markedsintroduksjon og oppskalering.',
  },
  {
    scheme: 'in_innovasjonskontrakter',
    label: 'IN — Innovasjonskontrakter',
    defaultAmount: 4000000,
    description: 'Innovasjonskontrakter — felles utvikling med kunde.',
  },
  {
    scheme: 'eu_horizon_eic',
    label: 'EU — Horizon EIC Accelerator',
    defaultAmount: 25000000,
    description: 'EIC Accelerator — EU-tilskudd + venture-investering.',
  },
];

export const FUNDING_STATUS_LABELS: Record<FundingAppStatus, string> = {
  draft: 'Utkast',
  submitted: 'Sendt',
  under_review: 'Under vurdering',
  approved: 'Innvilget',
  rejected: 'Avslått',
};

export const INVESTOR_STATUS_LABELS: Record<InvestorStatus, string> = {
  lead: 'Lead',
  contacted: 'Kontaktet',
  meeting_booked: 'Møte bookket',
  in_diligence: 'Due diligence',
  term_sheet: 'Term sheet',
  closed_won: 'Vunnet',
  closed_lost: 'Tapt',
};

export const PARTNERSHIP_TYPE_LABELS: Record<PartnershipType, string> = {
  distribution: 'Distribusjon',
  tech: 'Teknologi',
  content: 'Innhold',
  production: 'Produksjon',
  other: 'Annet',
};

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  potential: 'Potensiell',
  in_talks: 'I dialog',
  active: 'Aktiv',
  paused: 'På pause',
  ended: 'Avsluttet',
};

// ─────────────────────────────────────────────────────────
// Business plan (Forretningsplan + strategi)
// ─────────────────────────────────────────────────────────

export interface BusinessPlan {
  id: string;
  user_id: string;
  // 1.0
  exec_summary: string | null;
  // 2.0
  intro_overview: string | null;
  intro_vision: string | null;
  intro_sustainability: string | null;
  intro_industry: string | null;
  intro_financials: string | null;
  // 3.0
  internal_value_network_primary: string | null;
  internal_value_network_support: string | null;
  internal_drivers_customer: string | null;
  internal_drivers_capacity: string | null;
  internal_drivers_learning: string | null;
  internal_resource_analysis: string | null;
  internal_operational: string | null;
  internal_dynamic: string | null;
  internal_vrio: string | null;
  internal_network_structure: string | null;
  internal_strengths_weaknesses: string | null;
  // 4.0
  external_pestel: string | null;
  external_pestel_conclusion: string | null;
  external_porter: string | null;
  external_porter_conclusion: string | null;
  external_competitors: string | null;
  external_competitor_summary: string | null;
  external_stakeholders: string | null;
  external_stakeholder_conclusion: string | null;
  // 5.0
  swot_strengths: string | null;
  swot_weaknesses: string | null;
  swot_opportunities: string | null;
  swot_threats: string | null;
  // 6.0
  strategic_wheel: string | null;
  current_strategy: string | null;
  // 7.0
  strategic_recommendation: string | null;
  safe_suitability: string | null;
  safe_acceptability: string | null;
  safe_feasibility: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type BusinessPlanInput = Partial<{
  execSummary: string;
  introOverview: string;
  introVision: string;
  introSustainability: string;
  introIndustry: string;
  introFinancials: string;
  internalValueNetworkPrimary: string;
  internalValueNetworkSupport: string;
  internalDriversCustomer: string;
  internalDriversCapacity: string;
  internalDriversLearning: string;
  internalResourceAnalysis: string;
  internalOperational: string;
  internalDynamic: string;
  internalVrio: string;
  internalNetworkStructure: string;
  internalStrengthsWeaknesses: string;
  externalPestel: string;
  externalPestelConclusion: string;
  externalPorter: string;
  externalPorterConclusion: string;
  externalCompetitors: string;
  externalCompetitorSummary: string;
  externalStakeholders: string;
  externalStakeholderConclusion: string;
  swotStrengths: string;
  swotWeaknesses: string;
  swotOpportunities: string;
  swotThreats: string;
  strategicWheel: string;
  currentStrategy: string;
  strategicRecommendation: string;
  safeSuitability: string;
  safeAcceptability: string;
  safeFeasibility: string;
}>;

export const businessPlanApi = {
  get: async (): Promise<BusinessPlan | null> => {
    const data = await jsonFetch<{ plan: BusinessPlan | null }>('/business-plan');
    return data.plan;
  },
  patch: async (input: BusinessPlanInput): Promise<BusinessPlan> => {
    const data = await jsonFetch<{ plan: BusinessPlan }>('/business-plan', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.plan;
  },
  generateField: async (body: {
    fieldKey: string;
    fieldLabel: string;
    existingContent?: string;
  }): Promise<{ text: string; tokens: { input: number; output: number } }> => {
    return jsonFetch('/business-plan/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

// ─────────────────────────────────────────────────────────
// Pitch decks (kobler Investor-pipeline til investor_room_decks)
// ─────────────────────────────────────────────────────────

export type DeckStatus = 'draft' | 'published' | 'archived';

export interface PitchDeck {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: DeckStatus;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PitchDeckSlide {
  id: string;
  deckId: string;
  position: number;
  section: string;
  layout: string;
  content: { heading?: string; body?: string; [k: string]: unknown };
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const decksApi = {
  list: async (): Promise<PitchDeck[]> => {
    const data = await jsonFetch<{ items: PitchDeck[] }>('/decks');
    return data.items;
  },
  create: async (body: { title: string; description?: string }): Promise<{ deck: PitchDeck; slides: PitchDeckSlide[] }> => {
    return jsonFetch('/decks', { method: 'POST', body: JSON.stringify(body) });
  },
  get: async (id: string): Promise<{ deck: PitchDeck; slides: PitchDeckSlide[] }> => {
    return jsonFetch(`/decks/${encodeURIComponent(id)}`);
  },
  patchMeta: async (id: string, body: { title?: string; description?: string; status?: DeckStatus }): Promise<PitchDeck> => {
    const data = await jsonFetch<{ deck: PitchDeck }>(`/decks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return data.deck;
  },
  patchSlide: async (deckId: string, slideId: string, body: { content?: Record<string, unknown>; notes?: string }): Promise<PitchDeckSlide> => {
    const data = await jsonFetch<{ slide: PitchDeckSlide }>(
      `/decks/${encodeURIComponent(deckId)}/slides/${encodeURIComponent(slideId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
    return data.slide;
  },
  remove: async (id: string): Promise<void> => {
    await jsonFetch(`/decks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  generateSlide: async (
    deckId: string,
    slideId: string,
    body: {
      brandName?: string;
      industry?: string;
      description?: string;
      monthlyRevenueNok?: number;
      growthPhase?: string;
      customNote?: string;
    } = {},
  ): Promise<{ slide: PitchDeckSlide; tokens: { input: number; output: number } }> => {
    return jsonFetch(`/decks/${encodeURIComponent(deckId)}/slides/${encodeURIComponent(slideId)}/generate`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

// ─────────────────────────────────────────────────────────
// Industry targets (Tier-1 CRM)
// ─────────────────────────────────────────────────────────

export type IndustryTier = 'T1' | 'T2' | 'T3';
export type IndustrySegment =
  | 'casting_director'
  | 'producer'
  | 'director'
  | 'actor'
  | 'press'
  | 'nfi'
  | 'nsf'
  | 'skuda'
  | 'agency'
  | 'other';
export type IndustryStatus = 'cold' | 'warm' | 'engaged' | 'advocate' | 'paused';
export type IndustryEngagementKind =
  | 'comment'
  | 'dm'
  | 'email'
  | 'meeting'
  | 'phone'
  | 'event'
  | 'mention'
  | 'post_share'
  | 'other';

export interface IndustryTarget {
  id: string;
  user_id: string;
  full_name: string;
  role_title: string | null;
  company: string | null;
  segment: IndustrySegment;
  tier: IndustryTier;
  status: IndustryStatus;
  linkedin_url: string | null;
  instagram_handle: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  last_engaged_at: string | null;
  last_engaged_kind: string | null;
  next_action: string | null;
  next_action_due: string | null;
  engagement_count: number;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type IndustryTargetInput = {
  fullName?: string;
  roleTitle?: string | null;
  company?: string | null;
  segment?: IndustrySegment;
  tier?: IndustryTier;
  status?: IndustryStatus;
  linkedinUrl?: string | null;
  instagramHandle?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  notes?: string | null;
  nextAction?: string | null;
  nextActionDue?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export interface IndustryTargetStats {
  totals: {
    total?: number;
    tier_t1?: number;
    tier_t2?: number;
    tier_t3?: number;
    engaged?: number;
    advocates?: number;
    active_last_30d?: number;
  };
  tier1CommentsLast30d: number;
}

export interface IndustryEngagement {
  id: string;
  target_id: string;
  user_id: string;
  kind: IndustryEngagementKind;
  direction: 'inbound' | 'outbound';
  channel: string | null;
  summary: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type IndustryEngagementInput = {
  kind: IndustryEngagementKind;
  direction?: 'inbound' | 'outbound';
  channel?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export const INDUSTRY_TIER_LABELS: Record<IndustryTier, string> = {
  T1: 'T1 — Daglig (CDs, A-produsenter, NSF/NFI-direkte)',
  T2: 'T2 — Ukentlig (line producers, agenter, presse-faste)',
  T3: 'T3 — Månedlig (extras-pipeline, bredere bransje)',
};

export const INDUSTRY_SEGMENT_LABELS: Record<IndustrySegment, string> = {
  casting_director: 'Casting director',
  producer: 'Produsent',
  director: 'Regissør',
  actor: 'Skuespiller',
  press: 'Presse / journalist',
  nfi: 'NFI',
  nsf: 'Norsk Skuespillerforbund',
  skuda: 'Skuda',
  agency: 'Skuespilleragentur',
  other: 'Annet',
};

export const INDUSTRY_STATUS_LABELS: Record<IndustryStatus, string> = {
  cold: 'Kald — ikke kontaktet',
  warm: 'Varm — har sett oss',
  engaged: 'Engasjert — kommenterer / DMer',
  advocate: 'Talsperson — anbefaler aktivt',
  paused: 'Pauset — ikke prioritert nå',
};

export const INDUSTRY_ENGAGEMENT_KIND_LABELS: Record<IndustryEngagementKind, string> = {
  comment: 'Kommentar på post',
  dm: 'DM / privat melding',
  email: 'E-post',
  meeting: 'Møte / kaffe',
  phone: 'Telefon',
  event: 'Eventmøte',
  mention: 'Nevnt oss i sin post',
  post_share: 'Delte vår post',
  other: 'Annet',
};

export const industryTargetsApi = {
  list: async (filter?: { tier?: IndustryTier; segment?: IndustrySegment; status?: IndustryStatus }): Promise<IndustryTarget[]> => {
    const params = new URLSearchParams();
    if (filter?.tier) params.set('tier', filter.tier);
    if (filter?.segment) params.set('segment', filter.segment);
    if (filter?.status) params.set('status', filter.status);
    const query = params.toString();
    const data = await jsonFetch<{ items: IndustryTarget[] }>(`/industry-targets${query ? `?${query}` : ''}`);
    return data.items;
  },
  stats: async (): Promise<IndustryTargetStats> => {
    return jsonFetch<IndustryTargetStats>('/industry-targets/stats');
  },
  create: async (input: IndustryTargetInput): Promise<IndustryTarget> => {
    const data = await jsonFetch<{ item: IndustryTarget }>('/industry-targets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  patch: async (id: string, input: IndustryTargetInput): Promise<IndustryTarget> => {
    const data = await jsonFetch<{ item: IndustryTarget }>(`/industry-targets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  remove: async (id: string): Promise<void> => {
    await jsonFetch(`/industry-targets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  logEngagement: async (
    id: string,
    input: IndustryEngagementInput,
  ): Promise<{ engagement: IndustryEngagement; target: IndustryTarget }> => {
    return jsonFetch(`/industry-targets/${encodeURIComponent(id)}/engagement`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

// ─────────────────────────────────────────────────────────
// Newsletter (Norwegian Casting Brief) — admin-stats
// ─────────────────────────────────────────────────────────

export interface NewsletterTotals {
  total: number;
  confirmed: number;
  pending: number;
  unsubscribed: number;
  new_last_7d: number;
  new_last_30d: number;
}

export interface NewsletterSignup {
  id: string;
  email: string;
  source: string;
  status: string;
  locale: string;
  consented_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

export const newsletterApi = {
  stats: async (): Promise<{ totals: NewsletterTotals; bySource: Array<{ source: string; count: number }> }> => {
    return jsonFetch('/newsletter/role-room/stats');
  },
  recentSignups: async (limit = 50): Promise<NewsletterSignup[]> => {
    const data = await jsonFetch<{ items: NewsletterSignup[] }>(
      `/newsletter/role-room/signups?limit=${encodeURIComponent(limit)}`,
    );
    return data.items;
  },
};

// ─────────────────────────────────────────────────────────
// Role Room Economy — Stripe subscribers + kostnads-margin
// ─────────────────────────────────────────────────────────

export interface RoleRoomSubscriber {
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  customerCreated: string | null;
  subscriptionId: string | null;
  status: string;
  planNickname: string | null;
  planAmountUsd: number;
  monthlyContributionUsd: number;
  currency: string | null;
  interval: string | null;
  trialEndsAt: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  currentPeriodEnd: string | null;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  profession: string | null;
  isRoleRoomProfession: boolean;
  userCreatedAt: string | null;
  aiCostUsd30d: number;
  hostingUsd30d: number;
  totalCostUsd30d: number;
  marginUsd30d: number;
  marginPct: number | null;
}

export interface RoleRoomEconomyAggregate {
  mrrUsd: number;
  arrUsd: number;
  mrrNok: number;
  arrNok: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  canceledLast30d: number;
  newLast30d: number;
  churnRatePct: number;
  aiCostUsd30d: number;
  hostingUsd30d: number;
  platformFixedCostsUsd30d: number;
  platformFixedCostsTotalMonthlyUsd: number;
  fixedCostsByCategoryUsd: Record<string, number>;
  fixedCostsByVendorUsd: Array<{ name: string; vendor: string | null; allocatedUsd: number }>;
  totalCostUsd30d: number;
  marginUsd30d: number;
  marginPct: number | null;
  meta: { nokPerUsd: number };
}

export interface RoleRoomTimeseriesPoint {
  monthLabel: string;
  mrrUsd: number;
  activeCount: number;
  newCount: number;
  churnCount: number;
  aiCostUsd: number;
}

export interface RoleRoomSubscriberDetail {
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    profession: string | null;
    company_name: string | null;
    created_at: string;
  };
  stripeCustomer: { id: string; email: string | null; name: string | null; created: number } | null;
  subscriptions: Array<{
    id: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    trialEnd: string | null;
    priceNickname: string | null;
    priceUsd: number;
    currency: string | null;
    interval: string | null;
    intervalCount: number | null;
  }>;
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    total: number;
    amountPaid: number;
    amountDue: number;
    currency: string;
    created: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
  upcomingInvoice: { total: number; amountDue: number; currency: string; periodEnd: string | null } | null;
  paymentMethods: Array<{ id: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; country: string | null }>;
  economy: {
    monthlyContributionUsd: number;
    lifetimeRevenueUsd: number;
    aiCostUsd30d: number;
    hostingUsd30d: number;
    totalCostUsd30d: number;
    marginUsd30d: number;
    marginPct: number | null;
    aiUsageByDay: Array<{ day: string; cost_usd: number; call_count: number }>;
    aiUsageByFeature: Array<{ feature: string; cost_usd: number; call_count: number }>;
    nokPerUsd: number;
  };
}

export type PlatformCostCategory =
  | 'ai' | 'hosting' | 'cdn' | 'storage' | 'database' | 'devtool' | 'monitoring' | 'email' | 'other';

export type PlatformCostAllocation = 'role_room_only' | 'total_platform' | 'per_active_user';

export type PlatformCostSource = 'manual' | 'render' | 'neon' | 'vercel' | 'stripe' | 'anthropic' | 'google';

export interface PlatformFixedCost {
  id: string;
  user_id: string;
  name: string;
  vendor: string | null;
  category: PlatformCostCategory;
  amount_usd_monthly: string;
  amount_native_monthly: string | null;
  native_currency: string | null;
  allocation_method: PlatformCostAllocation;
  role_room_share_pct: string;
  billing_interval: 'monthly' | 'yearly' | 'one_time';
  active: boolean;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  source: PlatformCostSource;
  external_id: string | null;
  last_synced_at: string | null;
  auto_managed: boolean;
  created_at: string;
  updated_at: string;
}

export type PlatformFixedCostInput = {
  name?: string;
  vendor?: string | null;
  category?: PlatformCostCategory;
  amountUsdMonthly?: number;
  amountNativeMonthly?: number | null;
  nativeCurrency?: string | null;
  allocationMethod?: PlatformCostAllocation;
  roleRoomSharePct?: number;
  billingInterval?: 'monthly' | 'yearly' | 'one_time';
  active?: boolean;
  startsOn?: string | null;
  endsOn?: string | null;
  notes?: string | null;
};

export const PLATFORM_COST_CATEGORY_LABELS: Record<PlatformCostCategory, string> = {
  ai: 'AI / LLM',
  hosting: 'Hosting',
  cdn: 'CDN / Edge',
  storage: 'Lagring / Blob',
  database: 'Database',
  devtool: 'Utviklerverktøy',
  monitoring: 'Monitoring',
  email: 'E-post',
  other: 'Annet',
};

export const PLATFORM_COST_ALLOCATION_LABELS: Record<PlatformCostAllocation, string> = {
  role_room_only: 'Kun Role Room (100% allokeres)',
  total_platform: 'Hele plattformen (split etter share-%)',
  per_active_user: 'Per aktiv bruker (multipliseres)',
};

export const roleRoomEconomyApi = {
  subscribers: async (): Promise<{ items: RoleRoomSubscriber[]; meta: { nokPerUsd: number; hostingAllocationUsdMonthly: number; totalCount: number; activeCount: number } }> => {
    return jsonFetch('/role-room/economy/subscribers');
  },
  subscriber: async (userId: string): Promise<RoleRoomSubscriberDetail> => {
    return jsonFetch(`/role-room/economy/subscribers/${encodeURIComponent(userId)}`);
  },
  aggregate: async (): Promise<RoleRoomEconomyAggregate> => {
    return jsonFetch('/role-room/economy/aggregate');
  },
  timeseries: async (): Promise<{ months: RoleRoomTimeseriesPoint[]; meta: { nokPerUsd: number } }> => {
    return jsonFetch('/role-room/economy/timeseries');
  },
  pauseSubscription: async (subscriptionId: string): Promise<{ ok: boolean }> => {
    return jsonFetch(`/role-room/subscription/${encodeURIComponent(subscriptionId)}/pause`, { method: 'POST' });
  },
  resumeSubscription: async (subscriptionId: string): Promise<{ ok: boolean }> => {
    return jsonFetch(`/role-room/subscription/${encodeURIComponent(subscriptionId)}/resume`, { method: 'POST' });
  },
  cancelSubscription: async (subscriptionId: string, opts: { immediate?: boolean; reason?: string } = {}): Promise<{ ok: boolean }> => {
    return jsonFetch(`/role-room/subscription/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(opts),
    });
  },
  reactivateSubscription: async (subscriptionId: string): Promise<{ ok: boolean }> => {
    return jsonFetch(`/role-room/subscription/${encodeURIComponent(subscriptionId)}/reactivate`, { method: 'POST' });
  },
};

export const platformFixedCostsApi = {
  list: async (): Promise<PlatformFixedCost[]> => {
    const data = await jsonFetch<{ items: PlatformFixedCost[] }>('/platform-fixed-costs');
    return data.items;
  },
  create: async (input: PlatformFixedCostInput): Promise<PlatformFixedCost> => {
    const data = await jsonFetch<{ item: PlatformFixedCost }>('/platform-fixed-costs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  patch: async (id: string, input: PlatformFixedCostInput): Promise<PlatformFixedCost> => {
    const data = await jsonFetch<{ item: PlatformFixedCost }>(`/platform-fixed-costs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  remove: async (id: string): Promise<void> => {
    await jsonFetch(`/platform-fixed-costs/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  refreshRender: async (): Promise<{ ok: boolean; created: number; updated: number; total: number }> => {
    return jsonFetch('/platform-fixed-costs/refresh/render', { method: 'POST' });
  },
  refreshNeon: async (): Promise<{ ok: boolean; created: number; updated: number; total: number }> => {
    return jsonFetch('/platform-fixed-costs/refresh/neon', { method: 'POST' });
  },
  refreshVercel: async (): Promise<{ ok: boolean; created: number; updated: number; total: number }> => {
    return jsonFetch('/platform-fixed-costs/refresh/vercel', { method: 'POST' });
  },
};

// ─────────────────────────────────────────────────────────
// Platform status — aggregert sanntidsbilde
// ─────────────────────────────────────────────────────────

export type ProviderHealth = 'ok' | 'warning' | 'error' | 'unconfigured';

export interface ProviderStatus {
  provider: string;
  health: ProviderHealth;
  message: string;
  metrics: Record<string, string | number>;
  dashboardUrl: string;
  lastCheckedAt: string;
}

export interface UserPresenceActive {
  id: string;
  email: string | null;
  name: string | null;
  profession: string | null;
  lastLoginAt: string;
  minutesAgo: number;
  currentRoute?: string | null;
  isIdle?: boolean | null;
  userAgentShort?: string | null;
}

export interface UserPresenceSummary {
  activeNow: number;
  activeLast24h: number;
  activeLast7d: number;
  totalRoleRoomUsers: number;
  recentUsers: UserPresenceActive[];
}

export interface PlatformStatusResponse {
  overall: ProviderHealth;
  summary: { okCount: number; warningCount: number; errorCount: number; unconfiguredCount: number };
  providers: ProviderStatus[];
  presence: UserPresenceSummary;
  checkedAt: string;
}

export const platformStatusApi = {
  fetch: async (): Promise<PlatformStatusResponse> => {
    return jsonFetch('/platform-status');
  },
};

// ─────────────────────────────────────────────────────────
// Migrations — admin-trigger av migrate.sh
// ─────────────────────────────────────────────────────────

export interface MigrationsState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  triggeredBy: string | null;
  lastLogLines: string[];
  exitCode: number | null;
  errorMessage: string | null;
  appliedThisRun: number;
  skippedThisRun: number;
  lockHeld: boolean;
  pendingFiles?: string[];
  pendingCount?: number;
}

export const migrationsApi = {
  status: async (): Promise<MigrationsState> => {
    return jsonFetch('/migrations/status');
  },
  run: async (): Promise<{ ok: boolean; state: MigrationsState; message: string }> => {
    return jsonFetch('/migrations/run', { method: 'POST' });
  },
};

// ─────────────────────────────────────────────────────────
// Newsletter — issues management
// ─────────────────────────────────────────────────────────

export type NewsletterIssueStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export interface NewsletterIssue {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  subject: string;
  preheader: string | null;
  body_markdown: string;
  body_html: string | null;
  body_blocks?: NewsletterBlock[];
  status: NewsletterIssueStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  body_length?: number;
}

export type NewsletterIssueInput = {
  title?: string;
  slug?: string;
  subject?: string;
  preheader?: string | null;
  bodyMarkdown?: string;
  bodyBlocks?: NewsletterBlock[];
  scheduledFor?: string | null;
};

export type NewsletterBlock =
  | { id: string; type: 'header'; level?: 1 | 2 | 3; text: string }
  | { id: string; type: 'text'; markdown: string }
  | { id: string; type: 'image'; url: string; alt?: string; caption?: string }
  | { id: string; type: 'cta'; label: string; url: string; align?: 'left' | 'center' | 'right' }
  | { id: string; type: 'divider' }
  | { id: string; type: 'quote'; text: string; attribution?: string };

export interface NewsletterAiSubject {
  text: string;
  rationale: string;
}

export interface NewsletterAiContentScore {
  score: number;
  breakdown: Record<string, number>;
  strengths: string[];
  improvements: Array<{ issue: string; suggestion: string }>;
}

export const newsletterAiApi = {
  subjectLines: async (input: { title: string; summary?: string; bodyMarkdown?: string }): Promise<{ subjects: NewsletterAiSubject[] }> => {
    return jsonFetch('/newsletter/role-room/ai/subject-lines', { method: 'POST', body: JSON.stringify(input) });
  },
  firstDraft: async (prompt: string): Promise<{ title: string; blocks: NewsletterBlock[] }> => {
    return jsonFetch('/newsletter/role-room/ai/first-draft', { method: 'POST', body: JSON.stringify({ prompt }) });
  },
  rewriteBlock: async (text: string, tone: 'shorter' | 'sharper' | 'friendlier' | 'stronger_hook'): Promise<{ rewritten: string }> => {
    return jsonFetch('/newsletter/role-room/ai/rewrite-block', { method: 'POST', body: JSON.stringify({ text, tone }) });
  },
  contentScore: async (input: { title: string; subject: string; content: string }): Promise<NewsletterAiContentScore> => {
    return jsonFetch('/newsletter/role-room/ai/content-score', { method: 'POST', body: JSON.stringify(input) });
  },
};

export const newsletterIssuesApi = {
  list: async (): Promise<NewsletterIssue[]> => {
    const data = await jsonFetch<{ items: NewsletterIssue[] }>('/newsletter/role-room/issues');
    return data.items;
  },
  get: async (id: string): Promise<NewsletterIssue> => {
    const data = await jsonFetch<{ item: NewsletterIssue }>(`/newsletter/role-room/issues/${encodeURIComponent(id)}`);
    return data.item;
  },
  create: async (input: NewsletterIssueInput): Promise<NewsletterIssue> => {
    const data = await jsonFetch<{ item: NewsletterIssue }>('/newsletter/role-room/issues', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  patch: async (id: string, input: NewsletterIssueInput): Promise<NewsletterIssue> => {
    const data = await jsonFetch<{ item: NewsletterIssue }>(`/newsletter/role-room/issues/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.item;
  },
  remove: async (id: string): Promise<void> => {
    await jsonFetch(`/newsletter/role-room/issues/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  sendTest: async (id: string, email?: string): Promise<{ ok: boolean; sentTo: string }> => {
    return jsonFetch(`/newsletter/role-room/issues/${encodeURIComponent(id)}/send-test`, {
      method: 'POST',
      body: JSON.stringify(email ? { email } : {}),
    });
  },
  send: async (id: string): Promise<{ ok: boolean; recipientCount: number; message: string }> => {
    return jsonFetch(`/newsletter/role-room/issues/${encodeURIComponent(id)}/send`, { method: 'POST' });
  },
};

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
};

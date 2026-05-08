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
  budgetBreakdown?: FundingBudgetLine[];
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
};

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

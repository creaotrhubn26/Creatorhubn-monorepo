/**
 * Split Sheet TypeScript Types
 * Type definitions for split sheet feature
 */

export type SplitSheetStatus = 'draft' | 'pending_signatures' | 'completed' | 'archived';

export type ContributorRole = 
  // Music roles (existing)
  | 'producer' 
  | 'artist' 
  | 'songwriter'
  | 'composer'
  | 'lyricist'
  | 'vocalist'
  | 'instrumentalist'
  | 'mix_engineer' 
  | 'mastering_engineer'
  | 'arranger'
  | 'featured_artist'
  | 'backing_vocalist'
  | 'session_musician'
  | 'publisher'
  | 'label'
  // Photographer roles (new)
  | 'second_shooter'
  | 'photo_editor'
  | 'retoucher'
  | 'assistant'
  | 'stylist'
  | 'makeup_artist'
  // Videographer roles (new)
  | 'video_editor'
  | 'colorist'
  | 'sound_engineer'
  | 'cinematographer'
  | 'grip'
  | 'gaffer'
  | 'director'
  | 'camera_operator'
  | 'drone_pilot'
  | 'production_assistant'
  | 'script_supervisor'
  | 'location_manager'
  | 'production_designer'
  | 'vfx_artist'
  | 'motion_graphics'
  | 'audio_mixer'
  // Generic
  | 'collaborator'
  | 'other';

export type InvitationStatus = 'not_sent' | 'sent' | 'viewed' | 'signed' | 'declined';

export interface SplitSheetContributor {
  id?: string;
  split_sheet_id?: string;
  name: string;
  email?: string;
  role: ContributorRole;
  percentage: number;
  signed_at?: string | null;
  signature_data?: SignatureData | null;
  invitation_sent_at?: string | null;
  invitation_status?: InvitationStatus;
  user_id?: string | null;
  order_index?: number;
  notes?: string | null;
  custom_fields?: Record<string, any>; // Custom fields like phone, PRO affiliation, IPI number, etc.
  created_at?: string;
  updated_at?: string;
}

export interface SignatureData {
  signature: string; // Base64 encoded signature image or text
  signed_by: string; // Name of person who signed
  signed_at: string; // ISO timestamp
  ip_address?: string;
  user_agent?: string;
}

export interface SplitSheet {
  id?: string;
  user_id?: string;
  project_id?: string | null;
  track_id?: string | null;
  songflow_project_id?: string | null;
  songflow_track_id?: string | null;
  title: string;
  description?: string | null;
  status: SplitSheetStatus;
  total_percentage?: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  contributors?: SplitSheetContributor[];
  contributor_count?: number;
  signed_count?: number;
}

export interface SplitSheetSongFlowLink {
  id?: string;
  split_sheet_id: string;
  songflow_project_id?: string | null;
  songflow_track_id?: string | null;
  link_type: 'project' | 'track';
  auto_created: boolean;
  linked_at?: string;
  linked_by?: string;
  metadata?: Record<string, any>;
}

export interface SplitSheetVersion {
  id?: string;
  split_sheet_id: string;
  version_number: number;
  changes: Record<string, any>;
  created_by: string;
  created_at?: string;
  snapshot_data?: Record<string, any>;
}

export interface CreateSplitSheetRequest {
  project_id?: string;
  track_id?: string;
  title: string;
  description?: string;
  contributors?: Omit<SplitSheetContributor, 'id' | 'split_sheet_id' | 'created_at' | 'updated_at'>[];
  metadata?: Record<string, any>;
}

export interface UpdateSplitSheetRequest {
  title?: string;
  description?: string;
  status?: SplitSheetStatus;
  project_id?: string;
  track_id?: string;
  contributors?: Omit<SplitSheetContributor, 'id' | 'split_sheet_id' | 'created_at' | 'updated_at'>[];
  metadata?: Record<string, any>;
}

export interface SignSplitSheetRequest {
  contributor_id: string;
  signature_data: SignatureData;
}

export interface ShareSplitSheetRequest {
  contributor_ids?: string[];
  message?: string;
}

export interface SplitSheetListResponse {
  success: boolean;
  data: SplitSheet[];
  error?: string;
}

export interface SplitSheetResponse {
  success: boolean;
  data: SplitSheet;
  error?: string;
}

export interface SplitSheetVersionResponse {
  success: boolean;
  data: SplitSheetVersion[];
  error?: string;
}

export interface SplitSheetPDFResponse {
  success: boolean;
  data: {
    splitSheet: SplitSheet;
    contributors: SplitSheetContributor[];
    pdfUrl?: string | null;
  };
  error?: string;
}

// Role display names (Norwegian)
export const ROLE_DISPLAY_NAMES: Record<ContributorRole, string> = {
  // Music roles
  producer: 'Produsent',
  artist: 'Artist',
  songwriter: 'Låtskriver',
  composer: 'Komponist',
  lyricist: 'Tekstforfatter',
  vocalist: 'Vokalist',
  instrumentalist: 'Instrumentalist',
  mix_engineer: 'Miksing',
  mastering_engineer: 'Mastering',
  arranger: 'Arrangør',
  featured_artist: 'Gjesteartist',
  backing_vocalist: 'Bakgrunnsvokalist',
  session_musician: 'Sessionmusiker',
  publisher: 'Forlag',
  label: 'Plateselskap',
  // Photographer roles
  second_shooter: 'Andrefotograf',
  photo_editor: 'Fotoeditor',
  retoucher: 'Retusjør',
  assistant: 'Assistent',
  stylist: 'Stylist',
  makeup_artist: 'Sminkør',
  // Videographer roles
  video_editor: 'Videoeditor',
  colorist: 'Kolorist',
  sound_engineer: 'Lydtekniker',
  cinematographer: 'Filmfotograf',
  grip: 'Grip',
  gaffer: 'Gaffer',
  director: 'Regissør',
  camera_operator: 'Kameraoperatør',
  drone_pilot: 'Dronepilot',
  production_assistant: 'Produksjonsassistent',
  script_supervisor: 'Script Supervisor',
  location_manager: 'Lokasjonsansvarlig',
  production_designer: 'Produksjonsdesigner',
  vfx_artist: 'VFX-artist',
  motion_graphics: 'Motion Graphics',
  audio_mixer: 'Lydmikser',
  // Generic
  collaborator: 'Samarbeidspartner',
  other: 'Annet'
};

// Status display names (Norwegian)
export const STATUS_DISPLAY_NAMES: Record<SplitSheetStatus, string> = {
  draft: 'Utkast',
  pending_signatures: 'Venter på signaturer',
  completed: 'Fullført',
  archived: 'Arkivert'
};

// Status colors
export const STATUS_COLORS: Record<SplitSheetStatus, string> = {
  draft: '#9e9e9e',
  pending_signatures: '#ff9800',
  completed: '#4caf50',
  archived: '#757575'
};

// Revenue types
export type RevenueSource = 'streaming' | 'sales' | 'sync' | 'performance' | 'mechanical' | 'publishing' | 'other';

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface SplitSheetRevenue {
  id?: string;
  split_sheet_id: string;
  amount: number;
  currency: string;
  revenue_source: RevenueSource;
  period_start: string;
  period_end: string;
  platform?: string | null;
  description?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  created_by: string;
}

export interface SplitSheetPayment {
  id?: string;
  split_sheet_id: string;
  contributor_id: string;
  revenue_id?: string | null;
  amount: number;
  currency: string;
  percentage: number;
  payment_status: PaymentStatus;
  payment_date?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  paid_at?: string | null;
  contributor?: SplitSheetContributor;
}

export interface CreateRevenueRequest {
  split_sheet_id: string;
  amount: number;
  currency?: string;
  revenue_source: RevenueSource;
  period_start: string;
  period_end: string;
  platform?: string;
  description?: string;
}

export interface UpdatePaymentRequest {
  payment_status?: PaymentStatus;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
}

// Revenue source display names (Norwegian)
export const REVENUE_SOURCE_NAMES: Record<RevenueSource, string> = {
  streaming: 'Streaming',
  sales: 'Salg',
  sync: 'Sync-lisens',
  performance: 'Opptredener',
  mechanical: 'Mekanisk',
  publishing: 'Forlag',
  other: 'Annet'
};

// Payment status display names (Norwegian)
export const PAYMENT_STATUS_NAMES: Record<PaymentStatus, string> = {
  pending: 'Venter',
  paid: 'Betalt',
  overdue: 'Forfalt',
  cancelled: 'Kansellert'
};

// Payment status colors
export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: '#ff9800',
  paid: '#4caf50',
  overdue: '#f44336',
  cancelled: '#757575'
};

// Contract types
export type ContractStatus = 'draft' | 'pending_signatures' | 'signed' | 'archived';

export interface ContractParty {
  id?: string;
  name: string;
  email?: string;
  role: string;
  organization?: string;
  address?: string;
}

export interface ContractObligation {
  id?: string;
  party_id?: string;
  description: string;
  deadline?: string;
  completed?: boolean;
}

export interface PaymentTerm {
  id?: string;
  party_id?: string;
  amount: number;
  currency: string;
  due_date?: string;
  payment_method?: string;
  percentage?: number;
}

export interface Contract {
  id?: string;
  project_id?: string;
  split_sheet_id?: string;
  title: string;
  content: string;
  parties: ContractParty[];
  obligations: ContractObligation[];
  payment_terms: PaymentTerm[];
  legal_references: string[]; // IDs fra LegalReferences
  applied_suggestions: string[]; // IDs fra LegalSuggestions
  status: ContractStatus;
  signature_status?: 'unsigned' | 'pending' | 'signed';
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

// Contract status display names (Norwegian)
export const CONTRACT_STATUS_DISPLAY_NAMES: Record<ContractStatus, string> = {
  draft: 'Utkast',
  pending_signatures: 'Venter på signaturer',
  signed: 'Signert',
  archived: 'Arkivert'
};

// Contract status colors
export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  draft: '#9e9e9e',
  pending_signatures: '#ff9800',
  signed: '#4caf50',
  archived: '#757575'
};

// ============================================
// UNION AGREEMENTS & RIGHTS MANAGEMENT
// From: datatilsynet.no, skuespillerforbund.no, filmforbundet.no
// ============================================

// Production types for union agreements
export type ProductionType = 
  | 'feature_film' 
  | 'short_film' 
  | 'documentary' 
  | 'tv_drama' 
  | 'tv_series' 
  | 'tv_entertainment'
  | 'commercial' 
  | 'music_video' 
  | 'corporate' 
  | 'streaming' 
  | 'student_film'
  | 'dubbing'
  | 'other';

// Production type labels (Norwegian)
export const PRODUCTION_TYPE_LABELS: Record<ProductionType, string> = {
  feature_film: 'Spillefilm',
  short_film: 'Kortfilm',
  documentary: 'Dokumentar',
  tv_drama: 'TV-drama',
  tv_series: 'TV-serie',
  tv_entertainment: 'TV-underholdning',
  commercial: 'Reklamefilm',
  music_video: 'Musikkvidoe',
  corporate: 'Bedriftsproduksjon',
  streaming: 'Strømmeplattform',
  student_film: 'Studentfilm',
  dubbing: 'Dubbing/versjonering',
  other: 'Annet',
};

// Participant types
export type ParticipantType = 'actor' | 'crew' | 'talent' | 'extra' | 'other';

export const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  actor: 'Skuespiller',
  crew: 'Filmarbeider / Crew',
  talent: 'Talent / Medvirkende',
  extra: 'Statist',
  other: 'Annet',
};

// Union membership types
export type UnionMembershipType = 'nsf_member' | 'nff_member' | 'both' | 'none' | 'other';

export const UNION_MEMBERSHIP_LABELS: Record<UnionMembershipType, string> = {
  nsf_member: 'NSF-medlem (Skuespillerforbundet)',
  nff_member: 'NFF-medlem (Filmforbundet)',
  both: 'Medlem av begge',
  none: 'Ikke fagorganisert',
  other: 'Annen fagforening',
};

// NSF (Norsk Skuespillerforbund) tariff agreement types
export type NSFAgreementType = 
  | 'filmavtalen' 
  | 'tv_drama' 
  | 'reklamefilm' 
  | 'strommeplattform' 
  | 'voice' 
  | 'none';

export const NSF_AGREEMENT_LABELS: Record<NSFAgreementType, string> = {
  filmavtalen: 'Filmavtalen (Spillefilm)',
  tv_drama: 'TV-dramaavtalen',
  reklamefilm: 'Reklamefilmavtalen',
  strommeplattform: 'Strømmeplattformavtalen',
  voice: 'Voiceavtalen',
  none: 'Ingen tariffavtale',
};

// NFF (Norsk Filmforbund) tariff agreement types
export type NFFAgreementType = 
  | 'spillefilm' 
  | 'tv_drama' 
  | 'tv_entertainment' 
  | 'reklame' 
  | 'dubbing' 
  | 'none';

export const NFF_AGREEMENT_LABELS: Record<NFFAgreementType, string> = {
  spillefilm: 'Spillefilmoverenskomsten',
  tv_drama: 'TV-dramaoverenskomsten',
  tv_entertainment: 'TV-underholdningsoverenskomsten',
  reklame: 'Reklame',
  dubbing: 'Dubbing/versjonering',
  none: 'Ingen tariffavtale',
};

// Rights management
export type RightsManagementType = 'for_filmforbundet' | 'tono' | 'gramo' | 'norwaco' | 'kopinor' | 'none' | 'other';

export const RIGHTS_MANAGEMENT_LABELS: Record<RightsManagementType, string> = {
  for_filmforbundet: 'F©R (Filmforbundets Organisasjon for Rettighetsforvaltning)',
  tono: 'TONO (Komponister/låtskrivere)',
  gramo: 'Gramo (Utøvere/produsenter)',
  norwaco: 'Norwaco',
  kopinor: 'Kopinor',
  none: 'Ingen rettighetsforvaltning',
  other: 'Annen rettighetsforvalter',
};

// Union agreement settings for a split sheet
export interface UnionAgreementSettings {
  // Participant type
  participantType: ParticipantType;
  
  // Union membership
  unionMembership: UnionMembershipType;
  
  // Production type
  productionType: ProductionType;
  
  // NSF (Skuespillerforbund) settings
  isProfessionalActor: boolean;
  nsfAgreementApplies: boolean;
  nsfAgreementType?: NSFAgreementType;
  
  // NFF (Filmforbundet) settings
  isFilmWorker: boolean;
  nffAgreementApplies: boolean;
  nffAgreementType?: NFFAgreementType;
  
  // Virke Produsentforeningen
  virkeProducerMember: boolean;
  
  // Rights management
  rightsManagement: RightsManagementType[];
  forRightsManagement: boolean; // F©R specifically
  
  // Compensation
  compensationAgreed: boolean;
  compensationAmount?: number;
  compensationCurrency?: string;
  rightsPaymentSeparate: boolean; // EU/Stortinget: "rimelig vederlag"
  
  // Additional notes
  additionalTerms?: string;
}

// Default union agreement settings
export const DEFAULT_UNION_AGREEMENT_SETTINGS: UnionAgreementSettings = {
  participantType: 'crew',
  unionMembership: 'none',
  productionType: 'other',
  isProfessionalActor: false,
  nsfAgreementApplies: false,
  isFilmWorker: false,
  nffAgreementApplies: false,
  virkeProducerMember: false,
  rightsManagement: [],
  forRightsManagement: false,
  compensationAgreed: false,
  rightsPaymentSeparate: false,
};

// Legal references for union agreements
export const UNION_LEGAL_REFERENCES = {
  nsf: {
    name: 'Norsk Skuespillerforbund (NSF)',
    url: 'https://www.skuespillerforbund.no/',
    description: 'Fagforening for profesjonelle skuespillere',
  },
  nff: {
    name: 'Norsk Filmforbund (NFF)',
    url: 'https://filmforbundet.no/',
    description: 'Fagforbund, rettighetsforvalter og kunstnerorganisasjon for film- og TV-arbeidere',
  },
  for: {
    name: 'F©R - Filmforbundets Organisasjon for Rettighetsforvaltning',
    url: 'https://filmforbundet.no/for-rettighetshavere/',
    description: 'Opphavsrettsvederlag for TV-distribusjon, strømming og privatkopiering',
  },
  virke: {
    name: 'Virke Produsentforeningen',
    url: 'https://www.virke.no/bransjer/produsentforeningen/',
    description: 'Arbeidsgiverforening - tariffavtaler gjelder ved medlemskap',
  },
  datatilsynet: {
    name: 'Datatilsynet',
    url: 'https://www.datatilsynet.no/',
    description: 'GDPR og personvernlovgivning',
  },
  lovdata_aandsverkloven: {
    name: 'Åndsverkloven',
    url: 'https://lovdata.no/dokument/NL/lov/2018-06-15-40',
    description: 'Lov om opphavsrett til åndsverk',
  },
};

// ============================================
// WAGE & SALARY REFERENCES
// Official tariff rates and minimum wages
// ============================================

// NSF Wage/Tariff references by production type
export const NSF_WAGE_REFERENCES = {
  filmavtalen: {
    name: 'Filmavtalen - Lønn og satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/film/',
    description: 'Tariffavtale mellom Virke Produsentforeningen og NSF om skuespillerarbeid i spillefilm',
    category: 'Film',
  },
  tv_drama: {
    name: 'TV-drama - Lønn og satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/tv/',
    description: 'Tariffavtale om skuespillerarbeid i dramatiserte TV-produksjoner',
    category: 'TV',
  },
  reklamefilm: {
    name: 'Reklamefilmavtalen - Lønn og satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/reklame/',
    description: 'Tariffavtale om produksjon og tilgjengeliggjøring av reklamefilm',
    category: 'Reklame',
  },
  streaming: {
    name: 'Strømmeplattform - Lønn og satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/strommeplattform/',
    description: 'Avtaler med Netflix og andre strømmeplattformer',
    category: 'Strømming',
  },
  voice: {
    name: 'Voice - Lønn og satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/voice/',
    description: 'Dubbing, lydbok, radio m.m.',
    category: 'Voice',
  },
  teater: {
    name: 'Teateravtalen - Lønn og satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/teater/',
    description: 'Tariffavtale mellom Spekter og NSF for institusjonsteatre',
    category: 'Teater',
  },
  nrk_drama: {
    name: 'NRK Drama - Lønn og satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/tv/',
    description: 'Tariffavtale mellom NRK og NSF for dramaproduksjoner',
    category: 'TV/NRK',
  },
  dks: {
    name: 'Den kulturelle skolesekken',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/den-kulturelle-skolesekken/',
    description: 'Satser for kunstnere i DKS',
    category: 'DKS',
  },
  fornoyelsespark: {
    name: 'Fornøyelsespark - Lønn og satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/fornoyelsespark/',
    description: 'Samarbeidsavtale for skuespilleroppgaver i fornøyelsesparker',
    category: 'Fornøyelsespark',
  },
  lydbok: {
    name: 'Lydbokavtalen - Satser',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/voice/',
    description: 'Standardavtale for lydbokinnlesning (NSF/Den norske Forleggerforening)',
    category: 'Voice',
  },
};

// NFF Wage/Tariff references for crew
export const NFF_WAGE_REFERENCES = {
  spillefilm: {
    name: 'Spillefilm - Crew lønn og satser',
    url: 'https://filmforbundet.no/tariff/',
    description: 'Spillefilmoverenskomsten - lønns- og arbeidsvilkår for filmarbeidere',
    category: 'Film',
  },
  tv_drama: {
    name: 'TV-drama - Crew lønn og satser',
    url: 'https://filmforbundet.no/tariff/',
    description: 'TV-dramaoverenskomsten for filmarbeidere',
    category: 'TV',
  },
  tv_entertainment: {
    name: 'TV-underholdning - Crew lønn',
    url: 'https://filmforbundet.no/tariff/',
    description: 'TV-underholdningsoverenskomsten',
    category: 'TV',
  },
  reklame: {
    name: 'Reklame - Crew lønn og satser',
    url: 'https://filmforbundet.no/tariff/',
    description: 'Reklamefilmoverenskomsten for crew',
    category: 'Reklame',
  },
  dubbing: {
    name: 'Dubbing/versjonering - Satser',
    url: 'https://filmforbundet.no/tariff/',
    description: 'Avtaler for dubbing og versjonering',
    category: 'Voice',
  },
};

// General wage info resources
export const WAGE_INFO_RESOURCES = {
  nsf_main: {
    name: 'NSF Lønn og tariff - Oversikt',
    url: 'https://www.skuespillerforbund.no/lonn-og-tariff/',
    description: 'Alle tariffavtaler og lønnsatser for skuespillere',
    type: 'overview' as const,
  },
  nff_main: {
    name: 'NFF Tariff - Oversikt',
    url: 'https://filmforbundet.no/tariff/',
    description: 'Alle tariffavtaler for filmarbeidere/crew',
    type: 'overview' as const,
  },
  nff_lonnskalkulator: {
    name: 'NFF Lønnskalkulator',
    url: 'https://filmforbundet.no/lonnskalkulator/',
    description: 'Beregn lønn basert på gjeldende tariffer',
    type: 'calculator' as const,
  },
  skuespillerkatalogen: {
    name: 'Skuespillerkatalogen',
    url: 'https://www.skuespillerforbund.no/skuespillerkatalogen/',
    description: 'Finn profesjonelle skuespillere (NSF-medlemmer)',
    type: 'directory' as const,
  },
  for_rights: {
    name: 'F©R Rettigheter',
    url: 'https://filmforbundet.no/for-rettighetshavere/',
    description: 'Opphavsrettsvederlag for TV, strømming og privatkopiering',
    type: 'rights' as const,
  },
  betaling_rettigheter: {
    name: 'NSF Betaling for rettigheter',
    url: 'https://www.skuespillerforbund.no/betaling-for-rettigheter/',
    description: 'Informasjon om opphavsrettsvederlag for skuespillere',
    type: 'rights' as const,
  },
};

// Wage type for a contributor
export interface ContributorWageInfo {
  // Base wage info
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  hourlyRate?: number;
  projectRate?: number;
  currency: string;
  
  // Tariff reference
  tariffReference?: keyof typeof NSF_WAGE_REFERENCES | keyof typeof NFF_WAGE_REFERENCES;
  isTariffRate: boolean;
  
  // Overtime & extras
  overtimeRate?: number;
  weekendRate?: number;
  nightRate?: number;
  travelCompensation?: number;
  perDiem?: number;
  
  // Rights/royalties (separate from salary)
  rightsPaymentIncluded: boolean;
  rightsPaymentAmount?: number;
  rightsPaymentPercentage?: number;
  
  // Notes
  notes?: string;
  validFrom?: string;
  validUntil?: string;
}

// Default wage info
export const DEFAULT_CONTRIBUTOR_WAGE_INFO: ContributorWageInfo = {
  currency: 'NOK',
  isTariffRate: false,
  rightsPaymentIncluded: false,
};

// Helper function to get relevant wage reference URL based on production type and participant type
export function getWageReferenceUrl(
  productionType: ProductionType,
  participantType: ParticipantType
): string {
  if (participantType === 'actor') {
    // NSF references for actors
    switch (productionType) {
      case 'feature_film':
      case 'short_film':
        return NSF_WAGE_REFERENCES.filmavtalen.url;
      case 'tv_drama':
      case 'tv_series':
        return NSF_WAGE_REFERENCES.tv_drama.url;
      case 'commercial':
        return NSF_WAGE_REFERENCES.reklamefilm.url;
      case 'streaming':
        return NSF_WAGE_REFERENCES.streaming.url;
      case 'dubbing':
        return NSF_WAGE_REFERENCES.voice.url;
      default:
        return WAGE_INFO_RESOURCES.nsf_main.url;
    }
  } else if (participantType === 'crew') {
    // NFF references for crew
    switch (productionType) {
      case 'feature_film':
      case 'short_film':
        return NFF_WAGE_REFERENCES.spillefilm.url;
      case 'tv_drama':
      case 'tv_series':
        return NFF_WAGE_REFERENCES.tv_drama.url;
      case 'tv_entertainment':
        return NFF_WAGE_REFERENCES.tv_entertainment.url;
      case 'commercial':
        return NFF_WAGE_REFERENCES.reklame.url;
      case 'dubbing':
        return NFF_WAGE_REFERENCES.dubbing.url;
      default:
        return WAGE_INFO_RESOURCES.nff_main.url;
    }
  }
  
  return WAGE_INFO_RESOURCES.nsf_main.url;
}

// Helper to get all relevant wage references for a production
export function getRelevantWageReferences(
  productionType: ProductionType,
  participantTypes: ParticipantType[]
): Array<{ name: string; url: string; description: string; category: string }> {
  const references: Array<{ name: string; url: string; description: string; category: string }> = [];
  
  // Add NSF references if actors involved
  if (participantTypes.includes('actor') || participantTypes.includes('talent')) {
    switch (productionType) {
      case 'feature_film':
      case 'short_film':
        references.push(NSF_WAGE_REFERENCES.filmavtalen);
        break;
      case 'tv_drama':
      case 'tv_series':
        references.push(NSF_WAGE_REFERENCES.tv_drama);
        references.push(NSF_WAGE_REFERENCES.nrk_drama);
        break;
      case 'commercial':
        references.push(NSF_WAGE_REFERENCES.reklamefilm);
        break;
      case 'streaming':
        references.push(NSF_WAGE_REFERENCES.streaming);
        break;
      case 'dubbing':
        references.push(NSF_WAGE_REFERENCES.voice);
        references.push(NSF_WAGE_REFERENCES.lydbok);
        break;
      default:
        // Add main overview
        references.push({
          name: WAGE_INFO_RESOURCES.nsf_main.name,
          url: WAGE_INFO_RESOURCES.nsf_main.url,
          description: WAGE_INFO_RESOURCES.nsf_main.description,
          category: 'Oversikt',
        });
    }
  }
  
  // Add NFF references if crew involved
  if (participantTypes.includes('crew')) {
    switch (productionType) {
      case 'feature_film':
      case 'short_film':
        references.push(NFF_WAGE_REFERENCES.spillefilm);
        break;
      case 'tv_drama':
      case 'tv_series':
        references.push(NFF_WAGE_REFERENCES.tv_drama);
        break;
      case 'tv_entertainment':
        references.push(NFF_WAGE_REFERENCES.tv_entertainment);
        break;
      case 'commercial':
        references.push(NFF_WAGE_REFERENCES.reklame);
        break;
      case 'dubbing':
        references.push(NFF_WAGE_REFERENCES.dubbing);
        break;
      default:
        references.push({
          name: WAGE_INFO_RESOURCES.nff_main.name,
          url: WAGE_INFO_RESOURCES.nff_main.url,
          description: WAGE_INFO_RESOURCES.nff_main.description,
          category: 'Oversikt',
        });
    }
  }
  
  return references;
}

// Helper to check if tariff agreements apply
export function checkTariffApplicability(settings: UnionAgreementSettings): {
  nsfApplies: boolean;
  nffApplies: boolean;
  reason: string;
} {
  const nsfApplies = settings.isProfessionalActor && 
                    settings.nsfAgreementApplies && 
                    settings.virkeProducerMember;
  
  const nffApplies = settings.isFilmWorker && 
                    settings.nffAgreementApplies && 
                    settings.virkeProducerMember;
  
  let reason = '';
  if (!settings.virkeProducerMember) {
    reason = 'Produsent er ikke medlem av Virke Produsentforeningen - individuelle avtaler gjelder';
  } else if (nsfApplies || nffApplies) {
    reason = 'Kollektive tariffavtaler gjelder';
  } else {
    reason = 'Ingen tariffavtale valgt';
  }
  
  return { nsfApplies, nffApplies, reason };
}

// Helper to get F©R rights text for contracts
export function getFORRightsText(agreementDate?: string): string {
  return `For medlemmer av Norsk Filmforbund med forvaltningskontrakt med F©R reguleres opphavsrettigheter i Avtale om rettigheter mellom Virke Produsentforeningen og Norsk Filmforbund/F©R${agreementDate ? ` av ${agreementDate}` : ''}.`;
}

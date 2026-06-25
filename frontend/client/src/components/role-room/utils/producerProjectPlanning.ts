// @ts-nocheck
import type {
  CastingProject,
  ProducerAccountAccessEntry,
  ProducerAccountAccessMethod,
  ProducerAccountAccessPlatform,
  ProducerAccountAccessRevealPolicy,
  ProducerAccountAccessRiskLevel,
  ProducerAccountAccessRoleTarget,
  ProducerAccountAccessSecretStatus,
  ProducerAccountAccessStatus,
  ProducerAccountAccessTier,
  ProducerAccountAccessTwoFactorStatus,
  ProducerAccountAccessVaultTab,
  ProducerAccountAccessWorkspace,
  ProducerActivationPlan,
  ProducerBrandGuide,
  ProducerCollaborationAgreementModel,
  ProducerCollaborationCompensationModel,
  ProducerCollaborationCostCoverage,
  ProducerCollaborationTerms,
  ProducerBrandLogoDetection,
  ProducerBrandLogoVariantSelection,
  ProducerBrandLogoVariantType,
  ProducerBrandLogoVariant,
  ProducerBrandLogoPlacement,
  ProducerBrandLogoTiming,
  ProducerBrandLogoTreatment,
  ProducerClientLogicMode,
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerClientMaterialType,
  ProducerContentLogic,
  ProducerContentCalendarItem,
  ProducerContentCalendarStatus,
  ProducerDeliveryPresetId,
  ProducerDeliveryWorkflow,
  ProducerMeetingAgendaItem,
  ProducerMeetingAssetRef,
  ProducerMeetingDecisionItem,
  ProducerMeetingFollowUpItem,
  ProducerMeetingParticipant,
  ProducerPlannerMeetingMode,
  ProducerPlannerMeetingType,
  ProducerMeetingWorkspace,
  ProducerMeetingWorkspaceStatus,
  ProducerPhasePlanItem,
  ProducerPlanningFrameworkStep,
  ProducerPlanningFrameworkStepKey,
  ProducerPlanningPhase,
  ProducerPlanningStatus,
  ProducerProjectPlanning,
  ProducerWorkspaceLayout,
  ProducerWorkspaceNavigation,
  ProducerWorkspacePage,
  ProducerWorkspacePagePlacement,
  ProducerWorkspaceSection,
  ProducerWorkspaceSurfaceKey,
  ProducerWorkspaceTabPlacement,
} from '../models/casting';
import type { ContentProductionEstimate } from '../services/contentProductionEstimateService';
import type { ProducerClientReview } from '../services/producerWorkflowService';
import type { StoryLogicState } from '../services/storyLogicService';

export const PRODUCER_PLANNING_PHASE_LABELS: Record<ProducerPlanningPhase, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjon',
  postproduction: 'Post-produksjon',
};

export const PRODUCER_PLANNING_STATUS_LABELS: Record<ProducerPlanningStatus, string> = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  at_risk: 'I risiko',
  review: 'Til gjennomgang',
  completed: 'Fullført',
};

export const PRODUCER_CONTENT_CALENDAR_STATUS_LABELS: Record<ProducerContentCalendarStatus, string> = {
  planned: 'Planlagt',
  in_review: 'Til gjennomgang',
  scheduled: 'Planlagt publisert',
  published: 'Publisert',
};

export const PRODUCER_PLANNER_MEETING_TYPE_LABELS: Record<ProducerPlannerMeetingType, string> = {
  casting: 'Casting',
  production: 'Production',
  creative: 'Creative',
  delivery: 'Delivery',
};

export const PRODUCER_PLANNER_MEETING_MODE_LABELS: Record<ProducerPlannerMeetingMode, string> = {
  digital: 'Digitalt',
  onsite: 'På lokasjon',
};

export interface ProducerContentFormatOption {
  value: string;
  label: string;
  helper: string;
  frame: {
    width: number;
    height: number;
  };
}

export interface ProducerContentChannelOption {
  value: string;
  label: string;
  helper: string;
  primaryFormat: ProducerContentFormatOption['value'];
  recommendedFormats: ProducerContentFormatOption['value'][];
}

export const PRODUCER_CONTENT_FORMAT_OPTIONS: ProducerContentFormatOption[] = [
  {
    value: '16:9',
    label: '16:9',
    helper: 'Nettside, YouTube, presentasjon og hero-video.',
    frame: { width: 16, height: 9 },
  },
  {
    value: '1:1',
    label: '1:1',
    helper: 'Kvadratisk feedformat for enkle kampanjeflater.',
    frame: { width: 1, height: 1 },
  },
  {
    value: '4:5',
    label: '4:5',
    helper: 'Feed-optimalisert format for Meta og LinkedIn.',
    frame: { width: 4, height: 5 },
  },
  {
    value: '9:16',
    label: '9:16',
    helper: 'Vertikal visning for reels, stories og shorts.',
    frame: { width: 9, height: 16 },
  },
];

export const PRODUCER_CONTENT_CHANNEL_OPTIONS: ProducerContentChannelOption[] = [
  {
    value: 'Web / salgsflate',
    label: 'Web / salgsflate',
    helper: 'Herofilm og forklaringsinnhold på nettside eller landingsside.',
    primaryFormat: '16:9',
    recommendedFormats: ['16:9'],
  },
  {
    value: 'LinkedIn / Meta',
    label: 'LinkedIn / Meta',
    helper: 'Paid/organic feed og kampanjeflater.',
    primaryFormat: '4:5',
    recommendedFormats: ['4:5', '1:1'],
  },
  {
    value: 'Reels / Stories',
    label: 'Reels / Stories',
    helper: 'Vertikale flater med rask krok og tydelig CTA.',
    primaryFormat: '9:16',
    recommendedFormats: ['9:16'],
  },
  {
    value: 'YouTube / webinar',
    label: 'YouTube / webinar',
    helper: 'Lengre formater med bred komposisjon og tydelige safe zones.',
    primaryFormat: '16:9',
    recommendedFormats: ['16:9'],
  },
  {
    value: 'Display / stills',
    label: 'Display / stills',
    helper: 'Statiske eller korte formatvarianter for annonser og assets.',
    primaryFormat: '1:1',
    recommendedFormats: ['1:1', '4:5'],
  },
];

export const getProducerContentFormatOption = (
  value?: string,
): ProducerContentFormatOption | null => (
  PRODUCER_CONTENT_FORMAT_OPTIONS.find((option) => option.value === value) ?? null
);

export const getProducerContentChannelOption = (
  value?: string,
): ProducerContentChannelOption | null => (
  PRODUCER_CONTENT_CHANNEL_OPTIONS.find((option) => option.value === value) ?? null
);

export const getRecommendedFormatsForProducerChannel = (channel?: string): ProducerContentFormatOption[] => {
  const option = getProducerContentChannelOption(channel);
  const values = option?.recommendedFormats ?? [];
  return PRODUCER_CONTENT_FORMAT_OPTIONS.filter((format) => values.includes(format.value));
};

export const getPrimaryFormatForProducerChannel = (channel?: string): string => (
  getProducerContentChannelOption(channel)?.primaryFormat ?? ''
);

export const PRODUCER_PLANNING_FRAMEWORK_LABELS: Record<ProducerPlanningFrameworkStepKey, string> = {
  strategy: 'Strategi',
  concept_development: 'Konseptutvikling',
  campaign_development: 'Kampanjeutvikling',
  content_production: 'Innholdsproduksjon',
  execution: 'Gjennomføring',
  evaluation: 'Evaluering',
};

export const PRODUCER_PLANNING_FRAMEWORK_HELPERS: Record<ProducerPlanningFrameworkStepKey, string> = {
  strategy: 'Hva skal prosjektet oppnå, hvem skal det nå, og hva må være sant når arbeidet er vellykket?',
  concept_development: 'Hva er den store ideen, opplevelsen og vinkelen som gjør at målgruppen bryr seg?',
  campaign_development: 'Hvordan bygges oppmerksomhet før, under og etter, og hvilke flater aktiveres?',
  content_production: 'Hvilket innhold må produseres i hver fase for å støtte retning, idé og aktivering?',
  execution: 'Hva publiseres eller leveres når, og hvem er ansvarlig under selve gjennomføringen?',
  evaluation: 'Hva fungerte, hva skapte respons, og hvordan brukes læringen videre?',
};

export interface ProducerPlanningClientMoment {
  id: string;
  type: 'framework_alignment' | 'phase_checkpoint' | 'content_delivery' | 'account_access';
  title: string;
  detail: string;
  phase: ProducerPlanningPhase;
  date?: string;
  owner?: string;
  linkedShotListId?: string;
  statusLabel: string;
  priority: number;
  reviewId?: string;
  reviewStatus?: string;
  reviewStatusLabel?: string;
  reviewRequestedAt?: string;
  reviewDecisionAt?: string;
  commentCount?: number;
  drivenByReview?: boolean;
}

export const PRODUCER_PLANNING_CLIENT_MOMENT_LABELS: Record<ProducerPlanningClientMoment['type'], string> = {
  framework_alignment: 'Retning / idé / aktivering',
  phase_checkpoint: 'Klientcheckpoint',
  content_delivery: 'Publisering / levering',
  account_access: 'Kontotilgang',
};

export type ProducerContentLogicMomentKind = 'hook' | 'cta' | 'proof';

export const PRODUCER_CONTENT_LOGIC_MOMENT_LABELS: Record<ProducerContentLogicMomentKind, string> = {
  hook: 'Hook',
  cta: 'CTA',
  proof: 'Bevis',
};

export const getProducerContentLogicMomentKind = (
  momentId?: string | null,
): ProducerContentLogicMomentKind | null => {
  if (momentId === 'content-logic:hook') {
    return 'hook';
  }
  if (momentId === 'content-logic:cta') {
    return 'cta';
  }
  if (momentId === 'content-logic:proof') {
    return 'proof';
  }
  return null;
};

export const getProducerAccountAccessPlatformFromMomentId = (
  momentId?: string | null,
): ProducerAccountAccessPlatform | null => {
  if (typeof momentId !== 'string') {
    return null;
  }
  const normalized = momentId.trim().toLowerCase();
  if (!normalized.startsWith('account-access:')) {
    return null;
  }
  const platform = normalized.replace(/^account-access:/, '').trim();
  if (platform in PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS) {
    return platform as ProducerAccountAccessPlatform;
  }
  return null;
};

export const getProducerClientMomentDisplayLabel = (
  moment: Pick<ProducerPlanningClientMoment, 'id' | 'type'>,
): string => {
  const contentLogicMomentKind = getProducerContentLogicMomentKind(moment.id);
  if (contentLogicMomentKind) {
    return `Content Logic · ${PRODUCER_CONTENT_LOGIC_MOMENT_LABELS[contentLogicMomentKind]}`;
  }
  return PRODUCER_PLANNING_CLIENT_MOMENT_LABELS[moment.type];
};

export const getProducerClientMomentTextEyebrow = (
  moment: Pick<ProducerPlanningClientMoment, 'id' | 'type'>,
): string => `[${getProducerClientMomentDisplayLabel(moment)}]`;

export interface ProducerOverlayEditorGuidance {
  safeZone: {
    horizontalPercent: number;
    verticalPercent: number;
    label: string;
  };
  opacity: {
    percent: number;
    label: string;
  };
  recommendedMargin: {
    pixelsAt1080: number;
    label: string;
  };
  note: string;
}

export interface ProducerOverlayFormatProfile extends ProducerOverlayEditorGuidance {
  format: string;
  formatLabel: string;
  recommendedVariantType: ProducerBrandLogoVariantType | null;
  recommendedVariantLabel: string;
}

export interface ProducerDeliveryManifestItem {
  id: string;
  title: string;
  channel: string;
  phase: ProducerPlanningPhase;
  format: string;
  filename: string;
  packageName: string;
  folderPath: string;
  versionLabel: string;
  deliveryStage: 'draft' | 'review' | 'ready' | 'final';
  deliveryStageLabel: string;
  publishAt?: string;
  publishDateLabel?: string;
  statusLabel: string;
  estimatedDurationLabel?: string;
  linkedShotListId?: string;
  backupRuleLabel?: string;
  logoVariantSelection: ProducerBrandLogoVariantSelection;
  logoVariantSelectionLabel: string;
  logoVariantResolvedType: ProducerBrandLogoVariantType | null;
  logoVariantResolvedLabel: string;
  logoVariantRecommendedLabel: string;
  logoVariantAutoApplied: boolean;
  notes?: string;
}

export interface ProducerDeliveryLogoUsageMatrixItem {
  id: string;
  title: string;
  channel: string;
  format: string;
  deliveryStageLabel: string;
  selectionLabel: string;
  resolvedLabel: string;
  recommendedLabel: string;
  autoApplied: boolean;
}

export interface ProducerDeliveryManifestAccountAccessItem {
  platform: ProducerAccountAccessPlatform;
  platformLabel: string;
  method: ProducerAccountAccessMethod;
  methodLabel: string;
  status: ProducerAccountAccessStatus;
  statusLabel: string;
  requiredForProject: boolean;
  accessScope: string;
  accountLabel?: string;
  inviteTarget?: string;
  clientOwnerLabel?: string;
  notes?: string;
  twoFactorRequired: boolean;
}

export interface ProducerDeliveryManifestAccountAccessSummary {
  requiredPlatformCount: number;
  connectedCount: number;
  clientActionCount: number;
  inviteSentCount: number;
  entries: ProducerDeliveryManifestAccountAccessItem[];
  securityNotes: string;
  revokePlan: string;
}

export interface ProducerDeliveryManifest {
  projectName: string;
  direction: string;
  idea: string;
  activation: string;
  businessGoal: string;
  targetAudience: string;
  coreMessage: string;
  successSignals: string[];
  primaryDeliveryLabel: string;
  recommendedShootDays: number;
  productionLoadLabel: string;
  pendingClientMoments: ProducerPlanningClientMoment[];
  deliveryItems: ProducerDeliveryManifestItem[];
  logoUsageMatrix: ProducerDeliveryLogoUsageMatrixItem[];
  accountAccessSummary: ProducerDeliveryManifestAccountAccessSummary;
  frameworkSections: Array<{
    key: ProducerPlanningFrameworkStepKey;
    label: string;
    focus: string;
    output: string;
    notes: string;
  }>;
  contentLogicSummary: {
    objective: string;
    audience: string;
    hook: string;
    coreMessage: string;
    proofPoints: string[];
    callToAction: string;
    distributionPlan: string;
  };
  logoPlacementLabel: string;
  logoTimingLabel: string;
  logoTreatmentLabel: string;
  logoTimingDetail: string;
  overlayEditorGuidance: ProducerOverlayEditorGuidance;
  overlayFormatProfiles: ProducerOverlayFormatProfile[];
  brandChecklist: string[];
  workflowChecklist: string[];
  generatedAt: string;
}

export interface ProducerClientGroundingSummary {
  briefReadyCount: number;
  totalBriefFields: number;
  materialCount: number;
  materialsByType: Record<string, number>;
  materialsByPhase: Record<ProducerPlanningPhase, number>;
  topMaterialTitles: string[];
  missingEssentials: string[];
}

export type ProducerClientContributionSourceType =
  | 'framework'
  | 'brand'
  | 'accounts'
  | 'delivery'
  | 'calendar';

export type ProducerClientContributionStatus =
  | 'missing'
  | 'partial'
  | 'ready';

export interface ProducerClientContributionTask {
  id: string;
  sourceType: ProducerClientContributionSourceType;
  sourceLabel: string;
  title: string;
  detail: string;
  phase: ProducerPlanningPhase;
  status: ProducerClientContributionStatus;
  statusLabel: string;
  priority: number;
  suggestedMaterialType: ProducerClientMaterialType;
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedUsageNotes: string;
  linkedCalendarItemId?: string;
  linkedShotListId?: string;
}

export const PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS: Record<ProducerClientContributionSourceType, string> = {
  framework: 'Retning / idé / aktivering',
  brand: 'Merkevareguide',
  accounts: 'Kontotilgang',
  delivery: 'Leveringsrutine',
  calendar: 'Content-kalender',
};

export const PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS: Record<ProducerClientContributionStatus, string> = {
  missing: 'Mangler',
  partial: 'Delvis klar',
  ready: 'Klar',
};

export const PRODUCER_WORKSPACE_SURFACE_LABELS: Record<ProducerWorkspaceSurfaceKey, string> = {
  brief: 'Brief',
  materials: 'Materiale',
  storyboard: 'Storyboard',
  manuscript: 'Manus',
  shotlist: 'Shotlist',
  brand: 'Merkevareguide',
  accounts: 'Kontotilgang',
  delivery: 'Leveringsrutine',
  meetings: 'Møte',
  'marketing-plan': 'Markedsplan',
};

export const PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS: Record<ProducerAccountAccessPlatform, string> = {
  google: 'Google Workspace',
  meta: 'Meta Business',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

export const PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS: Record<ProducerAccountAccessMethod, string> = {
  oauth: 'OAuth',
  business_invite: 'Business invite',
  manual_handoff: 'Klienthandling',
};

export const PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS: Record<ProducerAccountAccessStatus, string> = {
  not_started: 'Ikke startet',
  client_action: 'Venter på klient',
  invite_sent: 'Invitasjon sendt',
  connected: 'Koblet',
  revoked: 'Avsluttet',
};

export const PRODUCER_ACCOUNT_ACCESS_TIER_LABELS: Record<ProducerAccountAccessTier, string> = {
  delegated_access: 'Delegert tilgang',
  sensitive_secret: 'Sensitiv hemmelighet',
};

export const PRODUCER_ACCOUNT_ACCESS_RISK_LABELS: Record<ProducerAccountAccessRiskLevel, string> = {
  low: 'Lav risiko',
  medium: 'Middels risiko',
  high: 'Høy risiko',
};

export const PRODUCER_ACCOUNT_ACCESS_TWO_FACTOR_STATUS_LABELS: Record<ProducerAccountAccessTwoFactorStatus, string> = {
  enabled: '2FA aktiv',
  missing: '2FA mangler',
  unknown: '2FA ikke bekreftet',
};

export const PRODUCER_ACCOUNT_ACCESS_SECRET_STATUS_LABELS: Record<ProducerAccountAccessSecretStatus, string> = {
  not_shared: 'Ikke delt',
  requested: 'Etterspurt',
  stored_externally: 'Ligger sikkert utenfor Role Room',
  revoked: 'Tilbakekalt',
};

export const PRODUCER_ACCOUNT_ACCESS_REVEAL_POLICY_LABELS: Record<ProducerAccountAccessRevealPolicy, string> = {
  approval_required: 'Krever godkjenning',
  one_time: 'Kun én visning',
  manual_only: 'Manuell utlevering',
  mfa_required: '2FA-bekreftelse for hver visning',
};

export const PRODUCER_ACCOUNT_ACCESS_ROLE_TARGET_LABELS: Record<ProducerAccountAccessRoleTarget, string> = {
  client_owner: 'Klienteier',
  producer: 'Innholdsprodusent',
  editor: 'Klipper / editor',
  social_media_manager: 'SoMe-ansvarlig',
  admin: 'Administrator',
};

export const PRODUCER_ACCOUNT_ACCESS_VAULT_TAB_LABELS: Record<ProducerAccountAccessVaultTab, string> = {
  accounts: 'Kontoer',
  requests: 'Tilgangsforespørsler',
  secrets: 'Delte hemmeligheter',
  permissions: 'Rettigheter',
  audit: 'Aktivitetslogg',
  emergency: 'Nødtilgang',
  data_sources: 'Datakilder',
};

export const PRODUCER_COLLABORATION_STATUS_LABELS: Record<NonNullable<ProducerCollaborationTerms['status']>, string> = {
  discovery: 'Kartlegging',
  proposal_sent: 'Forslag sendt',
  under_review: 'Til vurdering',
  pilot_active: 'Oppstartsperiode',
  active: 'Aktivt samarbeid',
  paused: 'Satt på vent',
  completed: 'Avsluttet',
};

export const PRODUCER_COLLABORATION_AGREEMENT_MODEL_LABELS: Record<ProducerCollaborationAgreementModel, string> = {
  one_time_project: 'Engangsprosjekt',
  retainer: 'Fast samarbeid',
  startup_growth: 'Startup · vekstmodell',
  startup_equity: 'Startup · eierskapsmodell',
  holding_company: 'Holdingselskap / investeringsløp',
  hybrid: 'Hybridmodell',
};

export const PRODUCER_COLLABORATION_COMPENSATION_MODEL_LABELS: Record<ProducerCollaborationCompensationModel, string> = {
  fixed_fee: 'Fast honorar',
  growth_based: 'Vekstbasert modell',
  equity: 'Eierskapsmodell',
  hybrid: 'Hybrid kompensasjon',
};

export const PRODUCER_COLLABORATION_COST_COVERAGE_LABELS: Record<ProducerCollaborationCostCoverage, string> = {
  client: 'Kunden dekker',
  producer: 'Innholdsprodusent dekker',
  shared: 'Delt kostnad',
  case_by_case: 'Avklares per behov',
};

export const PRODUCER_MEETING_WORKSPACE_STATUS_LABELS: Record<ProducerMeetingWorkspaceStatus, string> = {
  planned: 'Planlagt',
  lobby: 'Lobby',
  live: 'Live',
  follow_up: 'Oppfølging',
};

export const PRODUCER_WORKSPACE_LAYOUT_LABELS: Record<ProducerWorkspaceLayout, string> = {
  focus: 'Fokus',
  split: 'Delt',
  grid: 'Grid',
};

export const PRODUCER_WORKSPACE_TAB_PLACEMENT_LABELS: Record<ProducerWorkspaceTabPlacement, string> = {
  top: 'Seksjoner øverst',
  left: 'Seksjoner til venstre',
};

export const PRODUCER_WORKSPACE_PAGE_PLACEMENT_LABELS: Record<ProducerWorkspacePagePlacement, string> = {
  left: 'Sider til venstre',
  right: 'Sider til høyre',
};

export const PRODUCER_WORKSPACE_SURFACE_COLORS: Record<ProducerWorkspaceSurfaceKey, string> = {
  brief: '#38bdf8',
  materials: '#fbbf24',
  storyboard: '#fb7185',
  manuscript: '#818cf8',
  shotlist: '#22d3ee',
  brand: '#a855f7',
  accounts: '#14b8a6',
  delivery: '#22c55e',
  meetings: '#f97316',
  'marketing-plan': '#ec4899',
};

export const PRODUCER_BRAND_LOGO_PLACEMENT_LABELS: Record<ProducerBrandLogoPlacement, string> = {
  top_left: 'Oppe venstre',
  top_right: 'Oppe høyre',
  bottom_left: 'Nede venstre',
  bottom_right: 'Nede høyre',
  center: 'Sentrert',
};

export const PRODUCER_BRAND_LOGO_TIMING_LABELS: Record<ProducerBrandLogoTiming, string> = {
  intro: 'Kun intro',
  outro: 'Kun outro',
  throughout: 'Hele videoen',
  custom: 'Fra / til sekunder',
  none: 'Ikke vis logo',
};

export const PRODUCER_BRAND_LOGO_TREATMENT_LABELS: Record<ProducerBrandLogoTreatment, string> = {
  clean: 'Ren logo',
  badge: 'Badge',
  watermark: 'Vannmerke',
};

export const PRODUCER_BRAND_LOGO_VARIANT_LABELS: Record<ProducerBrandLogoVariantType, string> = {
  primary: 'Primær',
  light: 'Lys',
  dark: 'Mørk',
  icon: 'Ikon',
};

export interface ProducerDeliveryWorkflowPreset {
  id: ProducerDeliveryPresetId;
  label: string;
  helper: string;
  workflow: Omit<ProducerDeliveryWorkflow, 'presetId'>;
}

export const PRODUCER_DELIVERY_WORKFLOW_PRESETS: ProducerDeliveryWorkflowPreset[] = [
  {
    id: 'social_pack',
    label: 'SoMe-pakke',
    helper: 'Flere korte versjoner, raske revisjoner og klare finalmapper per kanal.',
    workflow: {
      fileNamingConvention: '[Prosjekt]_[Kanal]_[Format]_[Dato]_[Versjon].mp4',
      versioningRule: 'Bruk v01-v09 for utkast. Lås FINAL når klienten har godkjent per kanalformat.',
      folderStructure: '01_Brief / 02_Assets / 03_Edit / 04_Review / 05_SoMe_Final / 06_Arkiv',
      draftVsFinalRule: 'Hold alle arbeidsfiler og preview-eksporter i Review. Flytt kun kanalspesifikke finaler til SoMe_Final.',
      backupRoutine: 'Backup etter hver større revisjon og alltid før publisering. Behold siste godkjente fil per kanal separat.',
      deliveryCadence: 'Del første cut raskt, samle tilbakemeldinger i én runde, og lever kanaltilpassede finaler samlet.',
    },
  },
  {
    id: 'web_pack',
    label: 'Web-pakke',
    helper: 'Hero-film, nettvideo og komprimerte webfiler med tydelig godkjenning før publisering.',
    workflow: {
      fileNamingConvention: '[Prosjekt]_[Leveranse]_[16x9]_[Dato]_[Versjon].mp4',
      versioningRule: 'Bruk v01-v05 internt. Sett FINAL først når nettansvarlig og klient har godkjent samme fil.',
      folderStructure: '01_Brief / 02_Prepro / 03_Edit / 04_Web_Review / 05_Web_Final / 06_Arkiv',
      draftVsFinalRule: 'Preview-filer går i Web_Review. Web_Final inneholder kun optimaliserte, publiseringsklare filer.',
      backupRoutine: 'Hold master, web-optimalisert fil og publisert fil i tre separate kopier.',
      deliveryCadence: 'Send én webpakke per godkjenningsrunde med tydelig versjonsnotat og publiseringsklar final.',
    },
  },
  {
    id: 'campaign_pack',
    label: 'Kampanjepakke',
    helper: 'Hovedfilm med cutdowns, statiske varianter og tydelig pakking per distribusjonsløp.',
    workflow: {
      fileNamingConvention: '[Prosjekt]_[Kampanje]_[Format]_[Variant]_[Versjon].mp4',
      versioningRule: 'Bruk én hovedversjon per kampanjebølge og undernummer for kanaltilpasninger.',
      folderStructure: '01_Strategi / 02_Master / 03_Cutdowns / 04_Client_Review / 05_Final_Packages / 06_Arkiv',
      draftVsFinalRule: 'Master og cutdowns holdes separat. Final_Packages inneholder bare godkjente leveranser med kanalmerking.',
      backupRoutine: 'Backup ved hver leveransebølge, og speil hele Final_Packages til separat arkiv.',
      deliveryCadence: 'Lever kampanjen som samlet pakke med hero, cutdowns og kanaloversikt i samme utsending.',
    },
  },
  {
    id: 'training_pack',
    label: 'Opplæringspakke',
    helper: 'Langsiktige filer, tydelig versjonskontroll og trygg overlevering til kundeorganisasjon.',
    workflow: {
      fileNamingConvention: '[Prosjekt]_[Modul]_[Språk]_[Dato]_[Versjon].mp4',
      versioningRule: 'Nummerer revisjoner fortløpende og hold FINAL kun for godkjent opplæringsversjon.',
      folderStructure: '01_Innhold / 02_Review / 03_Subtitles / 04_Final / 05_Source_Backup / 06_Arkiv',
      draftVsFinalRule: 'Review inneholder arbeidsfiler og QA-versjoner. Final inneholder kun leverte filer og tilhørende dokumentasjon.',
      backupRoutine: 'Oppbevar source, undertekster og finaler separat. Ta full backup etter hver godkjente modul.',
      deliveryCadence: 'Lever modulvis med tydelig status for hva som er klart, under review og arkivert.',
    },
  },
];

export const getProducerWorkspaceSurfaceForContributionSource = (
  sourceType: ProducerClientContributionSourceType,
): ProducerWorkspaceSurfaceKey => {
  if (sourceType === 'brand') {
    return 'brand';
  }
  if (sourceType === 'accounts') {
    return 'accounts';
  }
  if (sourceType === 'delivery') {
    return 'delivery';
  }
  if (sourceType === 'calendar') {
    return 'materials';
  }
  return 'brief';
};

export const getProducerWorkspaceLocationForSurface = (
  navigation: ProducerWorkspaceNavigation | null | undefined,
  surface: ProducerWorkspaceSurfaceKey,
): { sectionId: string; pageId: string } | null => {
  if (!navigation) {
    return null;
  }

  for (const section of navigation.sections) {
    const page = flattenProducerWorkspacePages(section).find((candidate) => candidate.surface === surface);
    if (page) {
      return {
        sectionId: section.id,
        pageId: page.id,
      };
    }
  }

  return null;
};

const DEFAULT_PHASE_PLAN: ProducerPhasePlanItem[] = [
  {
    phase: 'preproduction',
    title: 'Klargjør retning og produksjonsrammer',
    objective: 'Avklar merkevareguide, budskap, shotlist og opptaksdag før klienten låser planen.',
    clientCheckpoint: 'Kickoff og godkjenning av plan',
    status: 'planned',
  },
  {
    phase: 'production',
    title: 'Produser alt planlagt materiale',
    objective: 'Gjennomfør opptak effektivt og sikre alt som trengs til hovedfilm, kortversjoner og stills.',
    clientCheckpoint: 'Status etter opptaksdag',
    status: 'planned',
  },
  {
    phase: 'postproduction',
    title: 'Klipp, kvalitetssikre og lever',
    objective: 'Ferdigstill leveranser, hent klientgodkjenning og pakk finaler riktig for publisering og arkiv.',
    clientCheckpoint: 'Gjennomgang og endelig godkjenning',
    status: 'planned',
  },
];

const DEFAULT_CALENDAR_ITEMS: ProducerContentCalendarItem[] = [
  {
    id: 'calendar-hero',
    title: 'Hovedfilm',
    channel: 'Web / salgsflate',
    format: '16:9',
    phase: 'postproduction',
    status: 'planned',
  },
  {
    id: 'calendar-cutdown',
    title: 'Kampanje-cutdown',
    channel: 'LinkedIn / Meta',
    format: '4:5',
    phase: 'postproduction',
    status: 'planned',
  },
  {
    id: 'calendar-vertical',
    title: 'Vertikal teaser',
    channel: 'Reels / Stories',
    format: '9:16',
    phase: 'postproduction',
    status: 'planned',
  },
];

const DEFAULT_BRAND_GUIDE: ProducerBrandGuide = {
  activeLogoVariantType: 'primary',
  logoPlacement: 'bottom_right',
  logoTiming: 'outro',
  logoStartSecond: 0,
  logoEndSecond: 3,
  logoTreatment: 'clean',
  logoVariants: [],
  fonts: ['Primær font', 'Sekundær font'],
  toneOfVoice: 'Trygg, konkret og handlingsorientert. Skriv tydelig, menneskelig og uten unødvendig fagsjargong.',
  visualStyle: 'Rene komposisjoner, tydelig motivseparasjon, konsistente farger og gjenkjennelig merkevarebruk i alle flater.',
  dos: [
    'Bruk logo med riktig luft og tydelig kontrast.',
    'Hold fargebruk konsistent mellom film, stills og presentasjoner.',
    'Skriv korte budskap med tydelig call to action.',
  ],
  donts: [
    'Ikke strekk eller omfarg logo uten godkjenning.',
    'Ikke bland flere uttrykk eller fonthierarkier i samme leveranse.',
    'Ikke publiser uten siste godkjenning av tekst, grafikk og versjon.',
  ],
  colors: [],
};

const DEFAULT_CONTENT_LOGIC: ProducerContentLogic = {
  mode: 'content_logic',
  objective: '',
  audience: '',
  hook: '',
  coreMessage: '',
  industry: '',
  subIndustry: '',
  businessModel: '',
  contentCategory: '',
  productionApproach: '',
  proofPoints: [],
  callToAction: '',
  distributionPlan: '',
  successSignals: [],
};

const DEFAULT_ACCOUNT_ACCESS: ProducerAccountAccessWorkspace = {
  entries: [
    {
      platform: 'google',
      method: 'oauth',
      status: 'not_started',
      tier: 'delegated_access',
      riskLevel: 'low',
      accessScope: 'Drive, Kalender og Meet for prosjektet.',
      sharedWithRoles: ['producer', 'admin'],
      twoFactorStatus: 'unknown',
      secretStatus: 'not_shared',
      revealPolicy: 'approval_required',
      notes: 'Bruk Google OAuth. Ikke del passord eller 2FA-koder i prosjektrommet.',
      twoFactorRequired: true,
    },
    {
      platform: 'meta',
      method: 'business_invite',
      status: 'not_started',
      tier: 'delegated_access',
      riskLevel: 'low',
      accessScope: 'Meta Business Manager, side og annonsekontoer.',
      sharedWithRoles: ['producer', 'social_media_manager', 'admin'],
      twoFactorStatus: 'unknown',
      secretStatus: 'not_shared',
      revealPolicy: 'approval_required',
      notes: 'Be klienten invitere riktig jobbprofil eller Business Manager-bruker. Ikke lagre passord.',
      twoFactorRequired: true,
    },
    {
      platform: 'linkedin',
      method: 'business_invite',
      status: 'not_started',
      tier: 'delegated_access',
      riskLevel: 'low',
      accessScope: 'Company page og publiseringsrettigheter.',
      sharedWithRoles: ['producer', 'social_media_manager', 'admin'],
      twoFactorStatus: 'unknown',
      secretStatus: 'not_shared',
      revealPolicy: 'approval_required',
      notes: 'Be sideeier gi admin- eller super admin-tilgang. Hold 2-faktor hos klienten.',
      twoFactorRequired: true,
    },
    {
      platform: 'youtube',
      method: 'business_invite',
      status: 'not_started',
      tier: 'delegated_access',
      riskLevel: 'low',
      accessScope: 'Brand Account eller kanalrettigheter for opplasting.',
      sharedWithRoles: ['producer', 'editor', 'admin'],
      twoFactorStatus: 'unknown',
      secretStatus: 'not_shared',
      revealPolicy: 'approval_required',
      notes: 'Be om rollebasert kanaltilgang, ikke delt Google-passord.',
      twoFactorRequired: true,
    },
    {
      platform: 'tiktok',
      method: 'business_invite',
      status: 'not_started',
      tier: 'delegated_access',
      riskLevel: 'medium',
      accessScope: 'TikTok Business Center eller sikker publiseringstilgang for vertikale flater.',
      sharedWithRoles: ['producer', 'social_media_manager', 'admin'],
      twoFactorStatus: 'unknown',
      secretStatus: 'not_shared',
      revealPolicy: 'approval_required',
      notes: 'Bruk Business Center-invitasjon eller annen rollebasert tilgang. Unngå å lagre login i prosjektet.',
      twoFactorRequired: true,
    },
  ],
  activeVaultTab: 'accounts',
  securityNotes: 'Bruk OAuth, business invite eller klientstyrt handling. Ikke lagre passord eller 2FA-koder i Role Room.',
  revokePlan: 'Revider tilgang etter publisering og fjern koblinger som ikke lenger trengs.',
  emergencyContactName: '',
  emergencyContactEmail: '',
  emergencyContactPhone: '',
  emergencyAccessNotes: '',
  updatedAt: undefined,
};

const getProducerRequiredAccountPlatforms = (
  planning: Pick<ProducerProjectPlanning, 'contentCalendar'>,
): Set<ProducerAccountAccessPlatform> => {
  const channelSignature = planning.contentCalendar
    .map((item) => `${item.channel ?? ''} ${item.format ?? ''}`)
    .join(' ')
    .toLowerCase();
  const requiredPlatforms = new Set<ProducerAccountAccessPlatform>(['google']);

  if (
    channelSignature.includes('meta')
    || channelSignature.includes('reels')
    || channelSignature.includes('stories')
    || channelSignature.includes('instagram')
    || channelSignature.includes('facebook')
  ) {
    requiredPlatforms.add('meta');
  }
  if (channelSignature.includes('linkedin')) {
    requiredPlatforms.add('linkedin');
  }
  if (channelSignature.includes('youtube') || channelSignature.includes('webinar')) {
    requiredPlatforms.add('youtube');
  }
  if (channelSignature.includes('tiktok')) {
    requiredPlatforms.add('tiktok');
  }

  return requiredPlatforms;
};

const getRelevantProducerAccountAccessEntries = (
  planning: Pick<ProducerProjectPlanning, 'contentCalendar' | 'accountAccess'>,
): ProducerDeliveryManifestAccountAccessItem[] => {
  const requiredPlatforms = getProducerRequiredAccountPlatforms(planning);
  return planning.accountAccess.entries
    .filter((entry) => (
      requiredPlatforms.has(entry.platform)
      || entry.status !== 'not_started'
      || hasText(entry.accountLabel)
      || hasText(entry.inviteTarget)
    ))
    .map((entry) => ({
      platform: entry.platform,
      platformLabel: PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform],
      method: entry.method,
      methodLabel: PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS[entry.method],
      status: entry.status,
      statusLabel: PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status],
      requiredForProject: requiredPlatforms.has(entry.platform),
      accessScope: entry.accessScope ?? '',
      accountLabel: entry.accountLabel,
      inviteTarget: entry.inviteTarget,
      clientOwnerLabel: entry.ownerName,
      notes: entry.notes,
      twoFactorRequired: entry.twoFactorRequired,
    }));
};

const buildProducerAccountAccessSummary = (
  planning: Pick<ProducerProjectPlanning, 'contentCalendar' | 'accountAccess'>,
): ProducerDeliveryManifestAccountAccessSummary => {
  const entries = getRelevantProducerAccountAccessEntries(planning);
  return {
    requiredPlatformCount: entries.filter((entry) => entry.requiredForProject).length,
    connectedCount: entries.filter((entry) => entry.requiredForProject && entry.status === 'connected').length,
    clientActionCount: entries.filter((entry) => entry.requiredForProject && entry.status === 'client_action').length,
    inviteSentCount: entries.filter((entry) => entry.requiredForProject && entry.status === 'invite_sent').length,
    entries,
    securityNotes: planning.accountAccess.securityNotes ?? '',
    revokePlan: planning.accountAccess.revokePlan ?? '',
  };
};

const DEFAULT_DELIVERY_WORKFLOW: ProducerDeliveryWorkflow = {
  presetId: 'campaign_pack',
  fileNamingConvention: '[Prosjekt]_[Format]_[Dato]_[Versjon].ext',
  versioningRule: 'Bruk v01, v02, v03 for interne utkast og FINAL først når klienten har godkjent leveransen.',
  folderStructure: '01_Brief / 02_Prepro / 03_Produksjon / 04_Post / 05_Leveranser / 06_Arkiv',
  draftVsFinalRule: 'Legg alle arbeidsfiler i Draft. Flytt kun godkjente eksportfiler til Final med låst versjonsnummer.',
  backupRoutine: 'Minst tre kopier: lokal arbeidsdisk, prosjektserver/skylagring og separat backup etter opptaksdag.',
  deliveryCadence: 'Send første utkast med tydelig frist for tilbakemelding. Loggfør hver revisjon og bekreft leveringsklar final i samme tråd.',
};

const DEFAULT_COLLABORATION_TERMS: ProducerCollaborationTerms = {
  status: 'discovery',
  agreementModel: 'one_time_project',
  agreementLabel: '',
  commercialVehicle: '',
  agreementSummary: '',
  deliverablesInScopeVisible: true,
  deliverablesInScope: [],
  productionCadence: '',
  productionResponsibilities: [],
  brandingResponsibilities: [],
  marketingResponsibilities: [],
  startupEconomicModel: '',
  costItems: [
    { id: 'extras-cast', label: 'Statister', coveredBy: 'case_by_case', notes: '', amountLabel: '', reimbursable: true },
    { id: 'extras-props', label: 'Rekvisitter', coveredBy: 'case_by_case', notes: '', amountLabel: '', reimbursable: true },
    { id: 'extras-locations', label: 'Lokasjoner', coveredBy: 'case_by_case', notes: '', amountLabel: '', reimbursable: true },
    { id: 'extras-ads', label: 'Annonsering', coveredBy: 'case_by_case', notes: '', amountLabel: '', reimbursable: true },
    { id: 'extras-graphics', label: 'Grafiske elementer', coveredBy: 'case_by_case', notes: '', amountLabel: '', reimbursable: true },
    { id: 'extras-vendors', label: 'Eksterne leverandører', coveredBy: 'case_by_case', notes: '', amountLabel: '', reimbursable: true },
  ],
  compensationModel: 'fixed_fee',
  compensationSummary: '',
  evaluationPlan: '',
  clientUsageRights: '',
  producerPortfolioRights: '',
  workloadCap: '',
  liabilityExclusions: '',
};

const DEFAULT_MEETING_WORKSPACE: ProducerMeetingWorkspace = {
  status: 'planned',
  sessionLabel: 'Klientsync',
  meetingType: 'production',
  meetingMode: 'digital',
  phase: 'preproduction',
  scheduledAt: '',
  locationLabel: '',
  contextSummary: '',
  expectations: [],
  participants: [],
  assets: [],
  activeMeetUrl: '',
  activeMeetArtifactId: '',
  activeMeetCalendarEventId: '',
  liveNotes: '',
  agenda: [],
  decisions: [],
  followUps: [],
  updatedAt: undefined,
};

const DEFAULT_ACTIVATION_FRAMEWORK: ProducerPlanningFrameworkStep[] = [
  { key: 'strategy', focus: '', output: '', notes: '' },
  { key: 'concept_development', focus: '', output: '', notes: '' },
  { key: 'campaign_development', focus: '', output: '', notes: '' },
  { key: 'content_production', focus: '', output: '', notes: '' },
  { key: 'execution', focus: '', output: '', notes: '' },
  { key: 'evaluation', focus: '', output: '', notes: '' },
];

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const fillIfBlank = (current: string | undefined, suggested: string | undefined): string => (
  hasText(current) ? current.trim() : (hasText(suggested) ? suggested.trim() : '')
);

const joinNonEmpty = (parts: Array<string | undefined | null>, delimiter = ' · '): string => (
  parts
    .filter((value): value is string => hasText(value))
    .map((value) => value.trim())
    .join(delimiter)
);

const appendUniqueLines = (
  existing: string[] | undefined,
  additions: Array<string | undefined | null>,
): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of [...(existing ?? []), ...additions]) {
    if (!hasText(value)) {
      continue;
    }
    const normalized = value.trim();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
};

const normalizeStringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter(hasText).map((entry) => entry.trim())
    : []
);

const normalizeProducerAccountAccessPlatform = (value: unknown): ProducerAccountAccessPlatform => (
  value === 'google'
  || value === 'meta'
  || value === 'linkedin'
  || value === 'youtube'
  || value === 'tiktok'
    ? value
    : 'google'
);

const normalizeProducerCollaborationAgreementModel = (value: unknown): ProducerCollaborationAgreementModel => (
  value === 'retainer'
  || value === 'startup_growth'
  || value === 'startup_equity'
  || value === 'holding_company'
  || value === 'hybrid'
    ? value
    : 'one_time_project'
);

const normalizeProducerCollaborationStatus = (value: unknown): NonNullable<ProducerCollaborationTerms['status']> => (
  value === 'proposal_sent'
  || value === 'under_review'
  || value === 'pilot_active'
  || value === 'active'
  || value === 'paused'
  || value === 'completed'
    ? value
    : 'discovery'
);

const normalizeProducerCollaborationCompensationModel = (value: unknown): ProducerCollaborationCompensationModel => (
  value === 'growth_based'
  || value === 'equity'
  || value === 'hybrid'
    ? value
    : 'fixed_fee'
);

const normalizeProducerCollaborationCostCoverage = (value: unknown): ProducerCollaborationCostCoverage => (
  value === 'client'
  || value === 'producer'
  || value === 'shared'
    ? value
    : 'case_by_case'
);

const normalizeProducerAccountAccessMethod = (value: unknown, fallback: ProducerAccountAccessMethod): ProducerAccountAccessMethod => (
  value === 'oauth'
  || value === 'business_invite'
  || value === 'manual_handoff'
    ? value
    : fallback
);

const normalizeProducerAccountAccessStatus = (value: unknown): ProducerAccountAccessStatus => (
  value === 'not_started'
  || value === 'client_action'
  || value === 'invite_sent'
  || value === 'connected'
  || value === 'revoked'
    ? value
    : 'not_started'
);

const normalizeProducerAccountAccessTier = (value: unknown, fallback: ProducerAccountAccessTier): ProducerAccountAccessTier => (
  value === 'delegated_access'
  || value === 'sensitive_secret'
    ? value
    : fallback
);

const normalizeProducerAccountAccessRiskLevel = (
  value: unknown,
  fallback: ProducerAccountAccessRiskLevel,
): ProducerAccountAccessRiskLevel => (
  value === 'low'
  || value === 'medium'
  || value === 'high'
    ? value
    : fallback
);

const normalizeProducerAccountAccessTwoFactorStatus = (
  value: unknown,
  fallback: ProducerAccountAccessTwoFactorStatus,
): ProducerAccountAccessTwoFactorStatus => (
  value === 'enabled'
  || value === 'missing'
  || value === 'unknown'
    ? value
    : fallback
);

const normalizeProducerAccountAccessSecretStatus = (
  value: unknown,
  fallback: ProducerAccountAccessSecretStatus,
): ProducerAccountAccessSecretStatus => (
  value === 'not_shared'
  || value === 'requested'
  || value === 'stored_externally'
  || value === 'revoked'
    ? value
    : fallback
);

const normalizeProducerAccountAccessRevealPolicy = (
  value: unknown,
  fallback: ProducerAccountAccessRevealPolicy,
): ProducerAccountAccessRevealPolicy => (
  value === 'approval_required'
  || value === 'one_time'
  || value === 'manual_only'
  || value === 'mfa_required'
    ? value
    : fallback
);

const normalizeProducerAccountAccessRoleTarget = (
  value: unknown,
): ProducerAccountAccessRoleTarget | null => (
  value === 'client_owner'
  || value === 'producer'
  || value === 'editor'
  || value === 'social_media_manager'
  || value === 'admin'
    ? value
    : null
);

const normalizeProducerAccountAccessVaultTab = (
  value: unknown,
  fallback: ProducerAccountAccessVaultTab,
): ProducerAccountAccessVaultTab => (
  value === 'accounts'
  || value === 'requests'
  || value === 'secrets'
  || value === 'permissions'
  || value === 'audit'
  || value === 'emergency'
    ? value
    : fallback
);

const normalizeProducerAccountAccessEntry = (
  value: unknown,
  fallback: ProducerAccountAccessEntry,
): ProducerAccountAccessEntry => {
  const record = asRecord(value);
  return {
    platform: fallback.platform,
    method: normalizeProducerAccountAccessMethod(record.method, fallback.method),
    status: normalizeProducerAccountAccessStatus(record.status),
    tier: normalizeProducerAccountAccessTier(record.tier, fallback.tier ?? 'delegated_access'),
    riskLevel: normalizeProducerAccountAccessRiskLevel(record.riskLevel, fallback.riskLevel ?? 'low'),
    accountLabel: hasText(record.accountLabel) ? record.accountLabel.trim() : '',
    inviteTarget: hasText(record.inviteTarget) ? record.inviteTarget.trim() : '',
    accessScope: hasText(record.accessScope) ? record.accessScope.trim() : fallback.accessScope,
    ownerName: hasText(record.ownerName) ? record.ownerName.trim() : '',
    sharedWithRoles: Array.isArray(record.sharedWithRoles)
      ? record.sharedWithRoles
        .map(normalizeProducerAccountAccessRoleTarget)
        .filter((value): value is ProducerAccountAccessRoleTarget => value !== null)
      : (fallback.sharedWithRoles ?? []),
    twoFactorStatus: normalizeProducerAccountAccessTwoFactorStatus(
      record.twoFactorStatus,
      fallback.twoFactorStatus ?? 'unknown',
    ),
    lastUsedAt: hasText(record.lastUsedAt) ? record.lastUsedAt.trim() : undefined,
    expiresAt: hasText(record.expiresAt) ? record.expiresAt.trim() : undefined,
    secretStatus: normalizeProducerAccountAccessSecretStatus(record.secretStatus, fallback.secretStatus ?? 'not_shared'),
    secretLabel: hasText(record.secretLabel) ? record.secretLabel.trim() : '',
    maskedReference: hasText(record.maskedReference) ? record.maskedReference.trim() : '',
    revealPolicy: normalizeProducerAccountAccessRevealPolicy(record.revealPolicy, fallback.revealPolicy ?? 'approval_required'),
    notes: hasText(record.notes) ? record.notes.trim() : fallback.notes,
    twoFactorRequired: typeof record.twoFactorRequired === 'boolean' ? record.twoFactorRequired : fallback.twoFactorRequired,
    lastUpdatedAt: hasText(record.lastUpdatedAt) ? record.lastUpdatedAt.trim() : undefined,
  };
};

const normalizeProducerAccountAccessWorkspace = (
  value: unknown,
  fallback: ProducerAccountAccessWorkspace,
): ProducerAccountAccessWorkspace => {
  const record = asRecord(value);
  const rawEntries = Array.isArray(record.entries) ? record.entries : [];
  const entries = fallback.entries.map((defaultEntry) => {
    const matched = rawEntries.find((item) => normalizeProducerAccountAccessPlatform(asRecord(item).platform) === defaultEntry.platform);
    return normalizeProducerAccountAccessEntry(matched, defaultEntry);
  });

  return {
    entries,
    activeVaultTab: normalizeProducerAccountAccessVaultTab(record.activeVaultTab, fallback.activeVaultTab ?? 'accounts'),
    securityNotes: hasText(record.securityNotes) ? record.securityNotes.trim() : fallback.securityNotes,
    revokePlan: hasText(record.revokePlan) ? record.revokePlan.trim() : fallback.revokePlan,
    emergencyContactName: hasText(record.emergencyContactName) ? record.emergencyContactName.trim() : fallback.emergencyContactName,
    emergencyContactEmail: hasText(record.emergencyContactEmail) ? record.emergencyContactEmail.trim() : fallback.emergencyContactEmail,
    emergencyContactPhone: hasText(record.emergencyContactPhone) ? record.emergencyContactPhone.trim() : fallback.emergencyContactPhone,
    emergencyAccessNotes: hasText(record.emergencyAccessNotes) ? record.emergencyAccessNotes.trim() : fallback.emergencyAccessNotes,
    updatedAt: hasText(record.updatedAt) ? record.updatedAt.trim() : fallback.updatedAt,
  };
};

const normalizeProducerCollaborationTerms = (value: unknown): ProducerCollaborationTerms => {
  const record = asRecord(value);
  const costItemsSource = Array.isArray(record.costItems) ? record.costItems : DEFAULT_COLLABORATION_TERMS.costItems ?? [];

  return {
    status: normalizeProducerCollaborationStatus(record.status),
    agreementModel: normalizeProducerCollaborationAgreementModel(record.agreementModel),
    agreementLabel: hasText(record.agreementLabel) ? record.agreementLabel.trim() : '',
    commercialVehicle: hasText(record.commercialVehicle) ? record.commercialVehicle.trim() : '',
    agreementSummary: hasText(record.agreementSummary) ? record.agreementSummary.trim() : '',
    deliverablesInScopeVisible: typeof record.deliverablesInScopeVisible === 'boolean'
      ? record.deliverablesInScopeVisible
      : DEFAULT_COLLABORATION_TERMS.deliverablesInScopeVisible,
    deliverablesInScope: normalizeStringArray(record.deliverablesInScope),
    productionCadence: hasText(record.productionCadence) ? record.productionCadence.trim() : '',
    productionResponsibilities: normalizeStringArray(record.productionResponsibilities),
    brandingResponsibilities: normalizeStringArray(record.brandingResponsibilities),
    marketingResponsibilities: normalizeStringArray(record.marketingResponsibilities),
    startupEconomicModel: hasText(record.startupEconomicModel) ? record.startupEconomicModel.trim() : '',
    costItems: costItemsSource.map((item, index) => {
      const entry = asRecord(item);
      return {
        id: hasText(entry.id) ? entry.id.trim() : `collaboration-cost-${index + 1}`,
        label: hasText(entry.label) ? entry.label.trim() : `Kostnad ${index + 1}`,
        category: hasText(entry.category) ? entry.category.trim() : undefined,
        coveredBy: normalizeProducerCollaborationCostCoverage(entry.coveredBy),
        notes: hasText(entry.notes) ? entry.notes.trim() : '',
        amountLabel: hasText(entry.amountLabel) ? entry.amountLabel.trim() : '',
        reimbursable: typeof entry.reimbursable === 'boolean' ? entry.reimbursable : true,
        receiptFileId: hasText(entry.receiptFileId) ? entry.receiptFileId.trim() : '',
        receiptFileName: hasText(entry.receiptFileName) ? entry.receiptFileName.trim() : '',
        receiptUrl: hasText(entry.receiptUrl) ? entry.receiptUrl.trim() : '',
        receiptMerchant: hasText(entry.receiptMerchant) ? entry.receiptMerchant.trim() : '',
        receiptDate: hasText(entry.receiptDate) ? entry.receiptDate.trim() : '',
        receiptAmountValue: typeof entry.receiptAmountValue === 'number' && Number.isFinite(entry.receiptAmountValue)
          ? entry.receiptAmountValue
          : typeof entry.receiptAmountValue === 'string' && Number.isFinite(Number(entry.receiptAmountValue))
            ? Number(entry.receiptAmountValue)
            : undefined,
        ocrStatus: entry.ocrStatus === 'pending'
          || entry.ocrStatus === 'completed'
          || entry.ocrStatus === 'failed'
          || entry.ocrStatus === 'not_supported'
          ? entry.ocrStatus
          : undefined,
        ocrConfidence: entry.ocrConfidence === 'low'
          || entry.ocrConfidence === 'medium'
          || entry.ocrConfidence === 'high'
          ? entry.ocrConfidence
          : undefined,
      };
    }),
    compensationModel: normalizeProducerCollaborationCompensationModel(record.compensationModel),
    compensationSummary: hasText(record.compensationSummary) ? record.compensationSummary.trim() : '',
    evaluationPlan: hasText(record.evaluationPlan) ? record.evaluationPlan.trim() : '',
    clientUsageRights: hasText(record.clientUsageRights) ? record.clientUsageRights.trim() : '',
    producerPortfolioRights: hasText(record.producerPortfolioRights) ? record.producerPortfolioRights.trim() : '',
    workloadCap: hasText(record.workloadCap) ? record.workloadCap.trim() : '',
    liabilityExclusions: hasText(record.liabilityExclusions) ? record.liabilityExclusions.trim() : '',
    // Produksjonsteam-spesifikke felter — kun normaliseres hvis lagret
    filmFeeStructure: (
      record.filmFeeStructure === 'fixed_per_project'
      || record.filmFeeStructure === 'day_rate'
      || record.filmFeeStructure === 'per_episode'
      || record.filmFeeStructure === 'royalty_share'
      || record.filmFeeStructure === 'mixed'
    )
      ? record.filmFeeStructure
      : undefined,
    filmDayRate: hasText(record.filmDayRate) ? record.filmDayRate.trim() : '',
    filmRoyaltySplit: hasText(record.filmRoyaltySplit) ? record.filmRoyaltySplit.trim() : '',
    filmIpOwnership: (
      record.filmIpOwnership === 'production_company'
      || record.filmIpOwnership === 'client'
      || record.filmIpOwnership === 'shared'
      || record.filmIpOwnership === 'work_for_hire'
    )
      ? record.filmIpOwnership
      : undefined,
    filmDistributionRights: hasText(record.filmDistributionRights) ? record.filmDistributionRights.trim() : '',
    filmFestivalRights: hasText(record.filmFestivalRights) ? record.filmFestivalRights.trim() : '',
    filmSequelRights: hasText(record.filmSequelRights) ? record.filmSequelRights.trim() : '',
    filmMusicClearance: hasText(record.filmMusicClearance) ? record.filmMusicClearance.trim() : '',
    filmLikenessRights: hasText(record.filmLikenessRights) ? record.filmLikenessRights.trim() : '',
    filmInsurancePolicy: hasText(record.filmInsurancePolicy) ? record.filmInsurancePolicy.trim() : '',
    filmPerDiemPolicy: hasText(record.filmPerDiemPolicy) ? record.filmPerDiemPolicy.trim() : '',
    filmSafetyRequirements: hasText(record.filmSafetyRequirements) ? record.filmSafetyRequirements.trim() : '',
  };
};

// Display-labels for film-fee og film-IP-ownership — eksportert så
// ProjectAgreementsPanel kan vise menneske-lesbare alternativer.
export const PRODUCTION_FEE_STRUCTURE_LABELS: Record<NonNullable<ProducerCollaborationTerms['filmFeeStructure']>, string> = {
  fixed_per_project: 'Fast honorar per prosjekt',
  day_rate: 'Dagrate (per opptaksdag)',
  per_episode: 'Per episode',
  royalty_share: 'Royalty-andel',
  mixed: 'Hybrid (fast + royalty)',
};

export const PRODUCTION_IP_OWNERSHIP_LABELS: Record<NonNullable<ProducerCollaborationTerms['filmIpOwnership']>, string> = {
  production_company: 'Produksjonsselskapet',
  client: 'Oppdragsgiver / kunde',
  shared: 'Delt mellom partene',
  work_for_hire: 'Work-for-hire (kunde får full overdragelse)',
};

const createWorkspaceId = (prefix: 'section' | 'page'): string => (
  globalThis.crypto?.randomUUID?.()
    ? `${prefix}-${globalThis.crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`
);

const normalizeWorkspaceColor = (value: unknown, fallback: string): string => (
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback
);

const normalizeBrandLogoPlacement = (value: unknown): ProducerBrandLogoPlacement => (
  value === 'top_left'
  || value === 'top_right'
  || value === 'bottom_left'
  || value === 'bottom_right'
  || value === 'center'
    ? value
    : DEFAULT_BRAND_GUIDE.logoPlacement ?? 'bottom_right'
);

const normalizeBrandLogoTiming = (value: unknown): ProducerBrandLogoTiming => (
  value === 'intro'
  || value === 'outro'
  || value === 'throughout'
  || value === 'custom'
  || value === 'none'
    ? value
    : DEFAULT_BRAND_GUIDE.logoTiming ?? 'outro'
);

const normalizeBrandLogoSecond = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  return fallback;
};

const normalizeBrandLogoTreatment = (value: unknown): ProducerBrandLogoTreatment => (
  value === 'clean'
  || value === 'badge'
  || value === 'watermark'
    ? value
    : DEFAULT_BRAND_GUIDE.logoTreatment ?? 'clean'
);

const normalizeBrandLogoVariantType = (value: unknown): ProducerBrandLogoVariantType => (
  value === 'primary'
  || value === 'light'
  || value === 'dark'
  || value === 'icon'
    ? value
    : DEFAULT_BRAND_GUIDE.activeLogoVariantType ?? 'primary'
);

const normalizeBrandLogoVariantSelection = (value: unknown): ProducerBrandLogoVariantSelection => (
  value === 'auto'
  || value === 'primary'
  || value === 'light'
  || value === 'dark'
  || value === 'icon'
    ? value
    : 'auto'
);

const normalizeBrandLogoDetection = (
  value: unknown,
): ProducerBrandLogoDetection | undefined => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record) {
    return undefined;
  }

  const dominantColors = Array.isArray(record.dominantColors)
    ? record.dominantColors
      .map((item, index) => {
        const colorRecord = item !== null && typeof item === 'object' && !Array.isArray(item)
          ? item as Record<string, unknown>
          : null;
        if (!colorRecord || !hasText(colorRecord.label) || !hasText(colorRecord.hex)) {
          return null;
        }
        return {
          id: hasText(colorRecord.id) ? colorRecord.id.trim() : `detected-brand-color-${index + 1}`,
          label: colorRecord.label.trim(),
          hex: colorRecord.hex.trim(),
          usage: hasText(colorRecord.usage) ? colorRecord.usage.trim() : undefined,
        };
      })
      .filter((item): item is NonNullable<ProducerBrandLogoDetection['dominantColors']>[number] => item !== null)
    : [];

  const markType = record.markType === 'wordmark'
    || record.markType === 'symbol'
    || record.markType === 'combination'
    ? record.markType
    : undefined;

  return {
    sourceFileName: hasText(record.sourceFileName) ? record.sourceFileName.trim() : undefined,
    sourceProjectFileId: hasText(record.sourceProjectFileId) ? record.sourceProjectFileId.trim() : undefined,
    sourceProjectFileUrl: hasText(record.sourceProjectFileUrl) ? record.sourceProjectFileUrl.trim() : undefined,
    imageWidth: typeof record.imageWidth === 'number' && Number.isFinite(record.imageWidth) ? Math.max(1, Math.round(record.imageWidth)) : undefined,
    imageHeight: typeof record.imageHeight === 'number' && Number.isFinite(record.imageHeight) ? Math.max(1, Math.round(record.imageHeight)) : undefined,
    aspectRatioLabel: hasText(record.aspectRatioLabel) ? record.aspectRatioLabel.trim() : undefined,
    markType,
    hasTransparency: typeof record.hasTransparency === 'boolean' ? record.hasTransparency : undefined,
    dominantColors,
    suggestedPlacement: normalizeBrandLogoPlacement(record.suggestedPlacement),
    suggestedTiming: normalizeBrandLogoTiming(record.suggestedTiming),
    suggestedTreatment: normalizeBrandLogoTreatment(record.suggestedTreatment),
    suggestedOpacityPercent: typeof record.suggestedOpacityPercent === 'number' && Number.isFinite(record.suggestedOpacityPercent)
      ? Math.max(0, Math.min(100, Math.round(record.suggestedOpacityPercent)))
      : undefined,
    suggestedSafeZoneHorizontalPercent: typeof record.suggestedSafeZoneHorizontalPercent === 'number' && Number.isFinite(record.suggestedSafeZoneHorizontalPercent)
      ? Math.max(0, Math.min(40, Number(record.suggestedSafeZoneHorizontalPercent)))
      : undefined,
    suggestedSafeZoneVerticalPercent: typeof record.suggestedSafeZoneVerticalPercent === 'number' && Number.isFinite(record.suggestedSafeZoneVerticalPercent)
      ? Math.max(0, Math.min(40, Number(record.suggestedSafeZoneVerticalPercent)))
      : undefined,
    suggestedMarginPixelsAt1080: typeof record.suggestedMarginPixelsAt1080 === 'number' && Number.isFinite(record.suggestedMarginPixelsAt1080)
      ? Math.max(0, Math.round(record.suggestedMarginPixelsAt1080))
      : undefined,
    note: hasText(record.note) ? record.note.trim() : undefined,
    detectedAt: hasText(record.detectedAt) ? record.detectedAt.trim() : undefined,
  };
};

const normalizeBrandLogoVariant = (
  value: unknown,
  index: number,
): ProducerBrandLogoVariant | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record) {
    return null;
  }

  const type = normalizeBrandLogoVariantType(record.type);
  const detection = normalizeBrandLogoDetection(record.detection);
  const logoUrl = hasText(record.logoUrl)
    ? record.logoUrl.trim()
    : hasText(record.projectFileUrl)
      ? record.projectFileUrl.trim()
      : undefined;

  if (!logoUrl && !detection) {
    return null;
  }

  return {
    id: hasText(record.id) ? record.id.trim() : `brand-logo-variant-${type}-${index + 1}`,
    type,
    label: hasText(record.label) ? record.label.trim() : undefined,
    fileName: hasText(record.fileName) ? record.fileName.trim() : undefined,
    logoUrl,
    projectFileId: hasText(record.projectFileId) ? record.projectFileId.trim() : undefined,
    projectFileUrl: hasText(record.projectFileUrl) ? record.projectFileUrl.trim() : undefined,
    detection,
    uploadedAt: hasText(record.uploadedAt) ? record.uploadedAt.trim() : undefined,
  };
};

export const getProducerDeliveryWorkflowPreset = (
  presetId?: string | null,
): ProducerDeliveryWorkflowPreset | null => (
  PRODUCER_DELIVERY_WORKFLOW_PRESETS.find((preset) => preset.id === presetId) ?? null
);

export const applyProducerDeliveryWorkflowPreset = (
  presetId: ProducerDeliveryPresetId,
  current?: ProducerDeliveryWorkflow,
): ProducerDeliveryWorkflow => {
  const preset = getProducerDeliveryWorkflowPreset(presetId);
  if (!preset) {
    return {
      ...DEFAULT_DELIVERY_WORKFLOW,
      ...current,
    };
  }
  return {
    ...DEFAULT_DELIVERY_WORKFLOW,
    ...current,
    ...preset.workflow,
    presetId: preset.id,
  };
};

export const createProducerWorkspacePage = (
  surface: ProducerWorkspaceSurfaceKey = 'brief',
  overrides: Partial<ProducerWorkspacePage> = {},
): ProducerWorkspacePage => ({
  id: overrides.id && hasText(overrides.id) ? overrides.id.trim() : createWorkspaceId('page'),
  title: overrides.title && hasText(overrides.title)
    ? overrides.title.trim()
    : PRODUCER_WORKSPACE_SURFACE_LABELS[surface],
  surface,
  color: normalizeWorkspaceColor(overrides.color, PRODUCER_WORKSPACE_SURFACE_COLORS[surface]),
  pinned: Boolean(overrides.pinned),
  clientVisible: overrides.clientVisible !== false,
  order: typeof overrides.order === 'number' ? overrides.order : 0,
  parentPageId: hasText(overrides.parentPageId) ? overrides.parentPageId.trim() : null,
});

export const createProducerWorkspaceSection = (
  title: string,
  pages: ProducerWorkspacePage[],
  overrides: Partial<ProducerWorkspaceSection> = {},
): ProducerWorkspaceSection => ({
  id: overrides.id && hasText(overrides.id) ? overrides.id.trim() : createWorkspaceId('section'),
  title: hasText(title) ? title.trim() : 'Ny seksjon',
  color: normalizeWorkspaceColor(overrides.color, '#38bdf8'),
  pinned: Boolean(overrides.pinned),
  order: typeof overrides.order === 'number' ? overrides.order : 0,
  layout: overrides.layout === 'focus' || overrides.layout === 'grid' ? overrides.layout : 'split',
  pages,
});

export const getDefaultProducerWorkspaceNavigation = (): ProducerWorkspaceNavigation => {
  const foundationSection = createProducerWorkspaceSection(
    'Brief og materiale',
    [
      createProducerWorkspacePage('brief', { id: 'workspace-page-brief', pinned: true, order: 0 }),
      createProducerWorkspacePage('materials', { id: 'workspace-page-materials', pinned: true, order: 1 }),
    ],
    {
      id: 'workspace-section-foundation',
      color: '#38bdf8',
      pinned: true,
      order: 0,
      layout: 'split',
    },
  );
  const editorialSection = createProducerWorkspaceSection(
    'Storyboard og manus',
    [
      createProducerWorkspacePage('storyboard', { id: 'workspace-page-storyboard', pinned: true, order: 0 }),
      createProducerWorkspacePage('manuscript', { id: 'workspace-page-manuscript', pinned: true, order: 1 }),
      createProducerWorkspacePage('shotlist', { id: 'workspace-page-shotlist', pinned: true, order: 2 }),
    ],
    {
      id: 'workspace-section-editorial',
      color: '#818cf8',
      order: 1,
      layout: 'focus',
    },
  );
  // Markedsplanen (pillars, post-kalender, KPI) er en førsteklasses
  // produsent-flate, men lå tidligere KUN tilgjengelig via Role Room
  // Agent-dialogen. Egen seksjon her gjør den til en stående fane. Fordi
  // det er en separat seksjon med en surface (marketing-plan) som ikke
  // finnes i eksisterende prosjekters lagrede nav, plukker
  // normalizeProducerWorkspaceNavigation den opp automatisk for dem også.
  const marketingSection = createProducerWorkspaceSection(
    'Markedsføring',
    [
      createProducerWorkspacePage('marketing-plan', { id: 'workspace-page-marketing-plan', pinned: true, order: 0 }),
    ],
    {
      id: 'workspace-section-marketing',
      color: '#ec4899',
      order: 2,
      layout: 'focus',
    },
  );
  const deliverySection = createProducerWorkspaceSection(
    'Retning, tilgang og levering',
    [
      createProducerWorkspacePage('brand', { id: 'workspace-page-brand', order: 0 }),
      createProducerWorkspacePage('accounts', { id: 'workspace-page-accounts', order: 1 }),
      createProducerWorkspacePage('delivery', { id: 'workspace-page-delivery', order: 2 }),
    ],
    {
      id: 'workspace-section-delivery',
      color: '#a855f7',
      order: 3,
      layout: 'focus',
    },
  );
  const meetingsSection = createProducerWorkspaceSection(
    'Møte og oppfølging',
    [
      createProducerWorkspacePage('meetings', { id: 'workspace-page-meetings', pinned: true, order: 0 }),
    ],
    {
      id: 'workspace-section-meetings',
      color: '#f97316',
      order: 4,
      layout: 'focus',
    },
  );

  return {
    sectionTabPlacement: 'left',
    pageTabPlacement: 'left',
    navigationPinned: true,
    activeSectionId: foundationSection.id,
    activePageId: foundationSection.pages[0]?.id,
    sections: [foundationSection, editorialSection, marketingSection, deliverySection, meetingsSection],
  };
};

export const flattenProducerWorkspacePages = (section: ProducerWorkspaceSection): ProducerWorkspacePage[] => (
  [...section.pages].sort((left, right) => {
    const orderDifference = (left.order ?? 0) - (right.order ?? 0);
    if (orderDifference !== 0) {
      return orderDifference;
    }
    return left.title.localeCompare(right.title, 'nb-NO');
  })
);

const normalizeProducerWorkspacePage = (value: unknown, index: number): ProducerWorkspacePage | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record) {
    return null;
  }

  const surface = record.surface;
  const normalizedSurface: ProducerWorkspaceSurfaceKey = surface === 'materials'
    || surface === 'storyboard'
    || surface === 'manuscript'
    || surface === 'shotlist'
    || surface === 'brand'
    || surface === 'accounts'
    || surface === 'delivery'
    || surface === 'meetings'
      ? surface
    : 'brief';

  return createProducerWorkspacePage(normalizedSurface, {
    id: hasText(record.id) ? record.id.trim() : undefined,
    title: hasText(record.title) ? record.title.trim() : PRODUCER_WORKSPACE_SURFACE_LABELS[normalizedSurface],
    color: normalizeWorkspaceColor(record.color, PRODUCER_WORKSPACE_SURFACE_COLORS[normalizedSurface]),
    pinned: Boolean(record.pinned),
    clientVisible: record.clientVisible !== false,
    order: typeof record.order === 'number' ? record.order : index,
    parentPageId: hasText(record.parentPageId) ? record.parentPageId.trim() : null,
  });
};

const normalizeProducerWorkspaceSection = (value: unknown, index: number): ProducerWorkspaceSection | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record) {
    return null;
  }

  const pages = Array.isArray(record.pages)
    ? record.pages
      .map((page, pageIndex) => normalizeProducerWorkspacePage(page, pageIndex))
      .filter((page): page is ProducerWorkspacePage => page !== null)
    : [];

  if (pages.length === 0) {
    return null;
  }

  return createProducerWorkspaceSection(
    hasText(record.title) ? record.title.trim() : `Seksjon ${index + 1}`,
    pages,
    {
      id: hasText(record.id) ? record.id.trim() : undefined,
      color: normalizeWorkspaceColor(record.color, pages[0]?.color ?? '#38bdf8'),
      pinned: Boolean(record.pinned),
      order: typeof record.order === 'number' ? record.order : index,
      layout: record.layout === 'focus' || record.layout === 'grid' ? record.layout : 'split',
    },
  );
};

export const normalizeProducerWorkspaceNavigation = (
  raw: ProducerWorkspaceNavigation | undefined,
): ProducerWorkspaceNavigation => {
  const fallback = getDefaultProducerWorkspaceNavigation();
  if (!raw) {
    return fallback;
  }

  const sections = Array.isArray(raw.sections)
    ? raw.sections
      .map((section, index) => normalizeProducerWorkspaceSection(section, index))
      .filter((section): section is ProducerWorkspaceSection => section !== null)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    : [];

  const normalizedSectionsBase = sections.length > 0 ? sections : fallback.sections;
  const existingSurfaces = new Set(
    normalizedSectionsBase.flatMap((section) => flattenProducerWorkspacePages(section).map((page) => page.surface)),
  );
  // Legg til BARE de manglende sidene (ikke hele fallback-seksjonen) — ellers
  // ville en fallback-seksjon med én ny + én eksisterende side duplisert den
  // eksisterende siden.
  const missingFallbackSections = fallback.sections
    .map((section) => ({
      ...section,
      pages: section.pages
        .filter((page) => !existingSurfaces.has(page.surface))
        .map((page) => ({ ...page })),
    }))
    .filter((section) => section.pages.length > 0);
  // Global de-dup på `surface`: hver flate skal forekomme NØYAKTIG én gang i
  // navigasjonen. Dette (a) gjør normaliseringen idempotent —
  // normalize(normalize(x)) === normalize(x) — så gjentatte klikk/re-normaliser
  // ikke hoper opp faner, og (b) selv-helbreder nav-er som ALLEREDE har
  // akkumulert duplikater (f.eks. «Markedsplan» som dukket opp flere ganger).
  const seenSurfaces = new Set<string>();
  const normalizedSections = [...normalizedSectionsBase, ...missingFallbackSections]
    .map((section) => ({
      ...section,
      pages: flattenProducerWorkspacePages(section).filter((page) => {
        if (seenSurfaces.has(page.surface)) {
          return false;
        }
        seenSurfaces.add(page.surface);
        return true;
      }),
    }))
    .filter((section) => section.pages.length > 0)
    .map((section, index) => ({
      ...section,
      order: index,
    }));
  const allPages = normalizedSections.flatMap((section) => flattenProducerWorkspacePages(section));
  const activeSectionId = normalizedSections.some((section) => section.id === raw.activeSectionId)
    ? raw.activeSectionId
    : normalizedSections[0]?.id;
  const activePageId = allPages.some((page) => page.id === raw.activePageId)
    ? raw.activePageId
    : normalizedSections.find((section) => section.id === activeSectionId)?.pages[0]?.id ?? allPages[0]?.id;

  return {
    sectionTabPlacement: raw.sectionTabPlacement === 'left' ? 'left' : 'top',
    pageTabPlacement: raw.pageTabPlacement === 'right' ? 'right' : 'left',
    navigationPinned: raw.navigationPinned !== false,
    activeSectionId,
    activePageId,
    sections: normalizedSections,
  };
};

export const getClientVisibleProducerWorkspaceNavigation = (
  raw: ProducerWorkspaceNavigation | undefined,
): ProducerWorkspaceNavigation => {
  const navigation = normalizeProducerWorkspaceNavigation(raw);
  const visibleSections = navigation.sections
    .map((section, index) => {
      const visiblePages = flattenProducerWorkspacePages(section)
        .filter((page) => page.clientVisible !== false)
        .map((page) => ({ ...page }));

      if (visiblePages.length === 0) {
        return null;
      }

      const visiblePageIds = new Set(visiblePages.map((page) => page.id));
      return {
        ...section,
        order: index,
        pages: visiblePages.map((page) => ({
          ...page,
          parentPageId: page.parentPageId && visiblePageIds.has(page.parentPageId)
            ? page.parentPageId
            : null,
        })),
      };
    })
    .filter((section): section is ProducerWorkspaceSection => section !== null);

  if (visibleSections.length === 0) {
    return {
      ...navigation,
      activeSectionId: undefined,
      activePageId: undefined,
      sections: [],
    };
  }

  const activeSection = visibleSections.find((section) => section.id === navigation.activeSectionId)
    ?? visibleSections[0];
  const activePages = flattenProducerWorkspacePages(activeSection);
  const activePage = activePages.find((page) => page.id === navigation.activePageId)
    ?? activePages[0];

  return {
    ...navigation,
    activeSectionId: activeSection.id,
    activePageId: activePage?.id,
    sections: visibleSections,
  };
};

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const describeMissingRequirements = (items: string[]): string => {
  if (items.length === 0) {
    return '';
  }
  if (items.length === 1) {
    return `Mangler ${items[0]}.`;
  }
  if (items.length === 2) {
    return `Mangler ${items[0]} og ${items[1]}.`;
  }
  return `Mangler ${items.slice(0, -1).join(', ')} og ${items[items.length - 1]}.`;
};

const toContributionStatus = (
  readyCount: number,
  totalCount: number,
): ProducerClientContributionStatus => {
  if (totalCount <= 0 || readyCount >= totalCount) {
    return 'ready';
  }
  if (readyCount <= 0) {
    return 'missing';
  }
  return 'partial';
};

const parseClientMaterialLinkMetadata = (material: ProducerClientMaterial): {
  linkedCalendarItemId?: string;
  usageNotes?: string;
} => {
  const metadata = asRecord(material.metadata);
  return {
    linkedCalendarItemId: readFirstNonEmptyString(metadata.linkedCalendarItemId, metadata.calendarItemId),
    usageNotes: readFirstNonEmptyString(metadata.usageNotes, metadata.usage),
  };
};

const phaseOrder: Record<ProducerPlanningPhase, number> = {
  preproduction: 0,
  production: 1,
  postproduction: 2,
};

const normalizePhasePlanItem = (value: unknown, fallback: ProducerPhasePlanItem): ProducerPhasePlanItem => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const phase = record.phase === 'preproduction'
    || record.phase === 'production'
    || record.phase === 'postproduction'
    ? record.phase
    : fallback.phase;

  return {
    phase,
    title: hasText(record.title) ? record.title.trim() : fallback.title,
    objective: hasText(record.objective) ? record.objective.trim() : fallback.objective,
    startDate: hasText(record.startDate) ? record.startDate.trim() : undefined,
    endDate: hasText(record.endDate) ? record.endDate.trim() : undefined,
    owner: hasText(record.owner) ? record.owner.trim() : undefined,
    clientCheckpoint: hasText(record.clientCheckpoint) ? record.clientCheckpoint.trim() : fallback.clientCheckpoint,
    status: record.status === 'planned'
      || record.status === 'in_progress'
      || record.status === 'at_risk'
      || record.status === 'review'
      || record.status === 'completed'
      ? record.status
      : fallback.status,
    linkedShotListIds: Array.isArray(record.linkedShotListIds)
      ? record.linkedShotListIds.filter(hasText).map((entry) => entry.trim())
      : [],
    notes: hasText(record.notes) ? record.notes.trim() : undefined,
  };
};

const normalizeMeetingAgendaItem = (
  value: unknown,
  index: number,
): ProducerMeetingAgendaItem | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record || !hasText(record.title)) {
    return null;
  }

  const rawPhase = hasText(record.phase) ? record.phase.trim() : '';
  const phase = rawPhase === 'preproduction' || rawPhase === 'production' || rawPhase === 'postproduction'
    ? rawPhase
    : undefined;
  const rawSourceType = hasText(record.sourceType) ? record.sourceType.trim() : '';
  const sourceType = rawSourceType === 'client_review'
    || rawSourceType === 'timeline'
    || rawSourceType === 'framework'
    || rawSourceType === 'manual'
    ? rawSourceType
    : 'manual';

  return {
    id: hasText(record.id) ? record.id.trim() : `meeting-agenda-${index + 1}`,
    title: record.title.trim(),
    detail: hasText(record.detail) ? record.detail.trim() : undefined,
    phase,
    sourceType,
    linkedEntityType: hasText(record.linkedEntityType) ? record.linkedEntityType.trim() : undefined,
    linkedEntityId: hasText(record.linkedEntityId) ? record.linkedEntityId.trim() : undefined,
    completed: Boolean(record.completed),
  };
};

const normalizeMeetingDecisionItem = (
  value: unknown,
  index: number,
): ProducerMeetingDecisionItem | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record || !hasText(record.title)) {
    return null;
  }

  const rawPhase = hasText(record.phase) ? record.phase.trim() : '';
  const phase = rawPhase === 'preproduction' || rawPhase === 'production' || rawPhase === 'postproduction'
    ? rawPhase
    : undefined;

  return {
    id: hasText(record.id) ? record.id.trim() : `meeting-decision-${index + 1}`,
    title: record.title.trim(),
    phase,
    owner: hasText(record.owner) ? record.owner.trim() : undefined,
    dueAt: hasText(record.dueAt) ? record.dueAt.trim() : undefined,
    status: hasText(record.status) && record.status.trim() === 'done' ? 'done' : 'open',
    clientVisible: Boolean(record.clientVisible),
    linkedEntityType: hasText(record.linkedEntityType) ? record.linkedEntityType.trim() : undefined,
    linkedEntityId: hasText(record.linkedEntityId) ? record.linkedEntityId.trim() : undefined,
    notes: hasText(record.notes) ? record.notes.trim() : undefined,
  };
};

const normalizeMeetingFollowUpItem = (
  value: unknown,
  index: number,
): ProducerMeetingFollowUpItem | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record || !hasText(record.title)) {
    return null;
  }

  const rawStatus = hasText(record.status) ? record.status.trim() : '';
  const status = rawStatus === 'in_progress' || rawStatus === 'done' ? rawStatus : 'planned';
  const rawPhase = hasText(record.phase) ? record.phase.trim() : '';
  const phase = rawPhase === 'preproduction' || rawPhase === 'production' || rawPhase === 'postproduction'
    ? rawPhase
    : undefined;

  return {
    id: hasText(record.id) ? record.id.trim() : `meeting-follow-up-${index + 1}`,
    title: record.title.trim(),
    phase,
    owner: hasText(record.owner) ? record.owner.trim() : undefined,
    dueAt: hasText(record.dueAt) ? record.dueAt.trim() : undefined,
    status,
    linkedEntityType: hasText(record.linkedEntityType) ? record.linkedEntityType.trim() : undefined,
    linkedEntityId: hasText(record.linkedEntityId) ? record.linkedEntityId.trim() : undefined,
    notes: hasText(record.notes) ? record.notes.trim() : undefined,
  };
};

const normalizeMeetingParticipant = (
  value: unknown,
  index: number,
): ProducerMeetingParticipant | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record || !hasText(record.label)) {
    return null;
  }

  const availability = record.availability === 'available'
    || record.availability === 'tentative'
    || record.availability === 'unavailable'
    || record.availability === 'unknown'
    ? record.availability
    : 'unknown';

  return {
    id: hasText(record.id) ? record.id.trim() : `meeting-participant-${index + 1}`,
    label: record.label.trim(),
    role: hasText(record.role) ? record.role.trim() : undefined,
    kind: record.kind === 'client'
      || record.kind === 'crew'
      || record.kind === 'cast'
      || record.kind === 'internal'
      || record.kind === 'location'
      ? record.kind
      : undefined,
    required: typeof record.required === 'boolean' ? record.required : undefined,
    availability,
    note: hasText(record.note) ? record.note.trim() : undefined,
  };
};

const normalizeMeetingAssetRef = (
  value: unknown,
  index: number,
): ProducerMeetingAssetRef | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record || !hasText(record.label)) {
    return null;
  }

  const type = record.type === 'brief'
    || record.type === 'storyboard'
    || record.type === 'manuscript'
    || record.type === 'shotlist'
    || record.type === 'reference'
    || record.type === 'contract'
    || record.type === 'timeline'
    ? record.type
    : undefined;

  return {
    id: hasText(record.id) ? record.id.trim() : `meeting-asset-${index + 1}`,
    label: record.label.trim(),
    type,
    linkedEntityType: hasText(record.linkedEntityType) ? record.linkedEntityType.trim() : undefined,
    linkedEntityId: hasText(record.linkedEntityId) ? record.linkedEntityId.trim() : undefined,
  };
};

const normalizeMeetingWorkspace = (value: unknown, fallback: ProducerMeetingWorkspace): ProducerMeetingWorkspace => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawStatus = hasText(record.status) ? record.status.trim() : '';
  const status: ProducerMeetingWorkspaceStatus = rawStatus === 'lobby'
    || rawStatus === 'live'
    || rawStatus === 'follow_up'
    ? rawStatus
    : 'planned';
  const meetingType: ProducerPlannerMeetingType | undefined = record.meetingType === 'casting'
    || record.meetingType === 'production'
    || record.meetingType === 'creative'
    || record.meetingType === 'delivery'
    ? record.meetingType
    : fallback.meetingType;
  const meetingMode: ProducerPlannerMeetingMode | undefined = record.meetingMode === 'digital'
    || record.meetingMode === 'onsite'
    ? record.meetingMode
    : fallback.meetingMode;
  const phase = record.phase === 'preproduction'
    || record.phase === 'production'
    || record.phase === 'postproduction'
    ? record.phase
    : fallback.phase;

  return {
    status,
    sessionLabel: hasText(record.sessionLabel) ? record.sessionLabel.trim() : fallback.sessionLabel,
    meetingType,
    meetingMode,
    phase,
    scheduledAt: hasText(record.scheduledAt) ? record.scheduledAt.trim() : fallback.scheduledAt,
    locationLabel: hasText(record.locationLabel) ? record.locationLabel.trim() : fallback.locationLabel,
    contextSummary: hasText(record.contextSummary) ? record.contextSummary.trim() : fallback.contextSummary,
    expectations: Array.isArray(record.expectations)
      ? normalizeStringArray(record.expectations)
      : normalizeStringArray(fallback.expectations),
    participants: Array.isArray(record.participants)
      ? record.participants
        .map((item, itemIndex) => normalizeMeetingParticipant(item, itemIndex))
        .filter((item): item is ProducerMeetingParticipant => item !== null)
      : (fallback.participants ?? []).map((item) => ({ ...item })),
    assets: Array.isArray(record.assets)
      ? record.assets
        .map((item, itemIndex) => normalizeMeetingAssetRef(item, itemIndex))
        .filter((item): item is ProducerMeetingAssetRef => item !== null)
      : (fallback.assets ?? []).map((item) => ({ ...item })),
    activeMeetUrl: hasText(record.activeMeetUrl) ? record.activeMeetUrl.trim() : '',
    activeMeetArtifactId: hasText(record.activeMeetArtifactId) ? record.activeMeetArtifactId.trim() : '',
    activeMeetCalendarEventId: hasText(record.activeMeetCalendarEventId) ? record.activeMeetCalendarEventId.trim() : '',
    liveNotes: hasText(record.liveNotes) ? record.liveNotes.trim() : '',
    agenda: Array.isArray(record.agenda)
      ? record.agenda
        .map((item, itemIndex) => normalizeMeetingAgendaItem(item, itemIndex))
        .filter((item): item is ProducerMeetingAgendaItem => item !== null)
      : fallback.agenda.map((item) => ({ ...item })),
    decisions: Array.isArray(record.decisions)
      ? record.decisions
        .map((item, itemIndex) => normalizeMeetingDecisionItem(item, itemIndex))
        .filter((item): item is ProducerMeetingDecisionItem => item !== null)
      : fallback.decisions.map((item) => ({ ...item })),
    followUps: Array.isArray(record.followUps)
      ? record.followUps
        .map((item, itemIndex) => normalizeMeetingFollowUpItem(item, itemIndex))
        .filter((item): item is ProducerMeetingFollowUpItem => item !== null)
      : fallback.followUps.map((item) => ({ ...item })),
    updatedAt: hasText(record.updatedAt) ? record.updatedAt.trim() : fallback.updatedAt,
  };
};

const normalizeCalendarItem = (value: unknown, index: number): ProducerContentCalendarItem | null => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record || !hasText(record.title)) {
    return null;
  }

  return {
    id: hasText(record.id) ? record.id.trim() : `calendar-item-${index + 1}`,
    title: record.title.trim(),
    channel: hasText(record.channel) ? record.channel.trim() : undefined,
    format: hasText(record.format) ? record.format.trim() : undefined,
    logoVariantSelection: normalizeBrandLogoVariantSelection(record.logoVariantSelection),
    publishAt: hasText(record.publishAt) ? record.publishAt.trim() : undefined,
    owner: hasText(record.owner) ? record.owner.trim() : undefined,
    phase: record.phase === 'preproduction'
      || record.phase === 'production'
      || record.phase === 'postproduction'
      ? record.phase
      : 'postproduction',
    status: record.status === 'planned'
      || record.status === 'in_review'
      || record.status === 'scheduled'
      || record.status === 'published'
      ? record.status
      : 'planned',
    linkedShotListId: hasText(record.linkedShotListId) ? record.linkedShotListId.trim() : undefined,
    notes: hasText(record.notes) ? record.notes.trim() : undefined,
  };
};

const normalizeActivationFrameworkStep = (
  value: unknown,
  fallback: ProducerPlanningFrameworkStep,
): ProducerPlanningFrameworkStep => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const key = record.key === 'strategy'
    || record.key === 'concept_development'
    || record.key === 'campaign_development'
    || record.key === 'content_production'
    || record.key === 'execution'
    || record.key === 'evaluation'
    ? record.key
    : fallback.key;

  return {
    key,
    focus: hasText(record.focus) ? record.focus.trim() : '',
    output: hasText(record.output) ? record.output.trim() : '',
    notes: hasText(record.notes) ? record.notes.trim() : '',
  };
};

const normalizeActivationPlan = (
  value: unknown,
  defaults: ProducerActivationPlan,
): ProducerActivationPlan => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const sourceFramework = Array.isArray(record.framework) ? record.framework : [];

  return {
    direction: hasText(record.direction) ? record.direction.trim() : '',
    idea: hasText(record.idea) ? record.idea.trim() : '',
    activation: hasText(record.activation) ? record.activation.trim() : '',
    targetAudience: hasText(record.targetAudience) ? record.targetAudience.trim() : '',
    businessGoal: hasText(record.businessGoal) ? record.businessGoal.trim() : '',
    coreMessage: hasText(record.coreMessage) ? record.coreMessage.trim() : '',
    successSignals: normalizeStringArray(record.successSignals),
    framework: defaults.framework?.map((fallback) => {
      const matched = sourceFramework.find((item) => (
        item !== null
        && typeof item === 'object'
        && !Array.isArray(item)
        && (item as Record<string, unknown>).key === fallback.key
      )) ?? null;
      return normalizeActivationFrameworkStep(matched, fallback);
    }) ?? [],
  };
};

const normalizeProducerClientLogicMode = (value: unknown): ProducerClientLogicMode => (
  value === 'activation_plan' || value === 'content_logic'
    ? value
    : DEFAULT_CONTENT_LOGIC.mode ?? 'content_logic'
);

const getDefaultContentLogicFromActivationPlan = (
  activationPlan: ProducerActivationPlan,
): ProducerContentLogic => ({
  ...DEFAULT_CONTENT_LOGIC,
  objective: activationPlan.businessGoal ?? activationPlan.direction ?? '',
  audience: activationPlan.targetAudience ?? '',
  hook: activationPlan.idea ?? '',
  coreMessage: activationPlan.coreMessage ?? '',
  distributionPlan: activationPlan.activation ?? '',
  successSignals: activationPlan.successSignals ?? [],
});

const normalizeContentLogic = (
  value: unknown,
  activationPlan: ProducerActivationPlan,
): ProducerContentLogic => {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const fallback = getDefaultContentLogicFromActivationPlan(activationPlan);
  const proofPoints = normalizeStringArray(record.proofPoints);
  const successSignals = normalizeStringArray(record.successSignals);

  return {
    mode: normalizeProducerClientLogicMode(record.mode),
    objective: hasText(record.objective) ? record.objective.trim() : fallback.objective ?? '',
    audience: hasText(record.audience) ? record.audience.trim() : fallback.audience ?? '',
    hook: hasText(record.hook) ? record.hook.trim() : fallback.hook ?? '',
    coreMessage: hasText(record.coreMessage) ? record.coreMessage.trim() : fallback.coreMessage ?? '',
    proofPoints,
    callToAction: hasText(record.callToAction) ? record.callToAction.trim() : '',
    distributionPlan: hasText(record.distributionPlan) ? record.distributionPlan.trim() : fallback.distributionPlan ?? '',
    successSignals: successSignals.length > 0 ? successSignals : fallback.successSignals ?? [],
  };
};

const frameworkMomentMeta: Partial<Record<ProducerPlanningFrameworkStepKey, {
  title: string;
  phase: ProducerPlanningPhase;
  priority: number;
}>> = {
  strategy: {
    title: 'Retning',
    phase: 'preproduction',
    priority: -30,
  },
  concept_development: {
    title: 'Idé',
    phase: 'preproduction',
    priority: -29,
  },
  campaign_development: {
    title: 'Aktivering',
    phase: 'preproduction',
    priority: -28,
  },
};

const planningStatusPriority: Record<ProducerPlanningStatus, number> = {
  at_risk: 0,
  review: 1,
  in_progress: 2,
  planned: 3,
  completed: 4,
};

const calendarStatusPriority: Record<ProducerContentCalendarStatus, number> = {
  in_review: 0,
  planned: 1,
  scheduled: 2,
  published: 3,
};

const reviewStatusPriority: Record<string, number> = {
  changes_requested: -2,
  rejected: -1,
  pending: 0,
  approved: 4,
};

const PLANNING_REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Venter på klient',
  approved: 'Godkjent',
  changes_requested: 'Endringer ønsket',
  rejected: 'Avslått',
};

const formatSeconds = (seconds: number): string => {
  if (seconds <= 0) {
    return '0:00';
  }
  const totalMinutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  return `${totalMinutes}:${String(remainderSeconds).padStart(2, '0')}`;
};

const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) {
    return '0 t';
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) {
    return `${remainder} min`;
  }
  if (remainder <= 0) {
    return `${hours} t`;
  }
  return `${hours} t ${remainder} min`;
};

const normalizeFilenameToken = (value: string): string => value
  .trim()
  .replace(/[^\p{L}\p{N}\-_]+/gu, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const getPrimaryFormatLabel = (estimate: ContentProductionEstimate): string => {
  const primary = estimate.formatEstimates.find((item) => item.emphasis === 'primary') ?? estimate.formatEstimates[0];
  if (!primary) {
    return 'Ikke beregnet';
  }
  return `${primary.label} · ${formatSeconds(primary.estimatedSeconds)}`;
};

const formatManifestDate = (value?: string): string | undefined => {
  if (!hasText(value)) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium' }).format(parsed);
};

const splitWorkflowFolders = (value?: string): string[] => (
  hasText(value)
    ? value
      .split(/(?:\/|\n|→|>)+/g)
      .map((entry) => entry.trim())
      .filter(hasText)
    : []
);

const getDeliveryRootFolder = (workflow: ProducerDeliveryWorkflow): string => {
  const folders = splitWorkflowFolders(workflow.folderStructure);
  const preferred = folders.find((entry) => /leverans|deliver|export/i.test(entry));
  return preferred ?? '05_Leveranser';
};

const getDeliveryStage = (status?: ProducerContentCalendarStatus): Pick<ProducerDeliveryManifestItem, 'deliveryStage' | 'deliveryStageLabel'> => {
  switch (status) {
    case 'published':
      return {
        deliveryStage: 'final',
        deliveryStageLabel: 'Final',
      };
    case 'scheduled':
      return {
        deliveryStage: 'ready',
        deliveryStageLabel: 'Klar for publisering',
      };
    case 'in_review':
      return {
        deliveryStage: 'review',
        deliveryStageLabel: 'Til klientgjennomgang',
      };
    default:
      return {
        deliveryStage: 'draft',
        deliveryStageLabel: 'Produksjonsutkast',
      };
  }
};

const getDeliveryVersionLabel = (
  workflow: ProducerDeliveryWorkflow,
  stage: ProducerDeliveryManifestItem['deliveryStage'],
): string => {
  if (stage === 'final') {
    return /final/i.test(workflow.versioningRule ?? '')
      ? 'FINAL'
      : 'vFinal';
  }
  if (stage === 'ready') {
    return 'v03';
  }
  if (stage === 'review') {
    return 'v02';
  }
  return 'v01';
};

const getDeliveryStageFolderLabel = (stage: ProducerDeliveryManifestItem['deliveryStage']): string => {
  switch (stage) {
    case 'final':
      return 'Final';
    case 'ready':
      return 'Klar-for-publisering';
    case 'review':
      return 'Til-klientgjennomgang';
    default:
      return 'Draft';
  }
};

const getProducerBrandLogoTimingSummary = (brandGuide: ProducerBrandGuide): { label: string; detail: string } => {
  const customStart = Math.max(0, Math.floor(brandGuide.logoStartSecond ?? 0));
  const customEnd = Math.max(customStart + 1, Math.floor(brandGuide.logoEndSecond ?? customStart + 3));

  switch (brandGuide.logoTiming ?? 'outro') {
    case 'intro':
      return {
        label: 'Intro',
        detail: 'Logoen vises i introen og tar de første 3 sekundene av videoen.',
      };
    case 'throughout':
      return {
        label: 'Hele videoen',
        detail: 'Logoen ligger synlig gjennom hele videoen.',
      };
    case 'custom':
      return {
        label: `${formatSeconds(customStart)}-${formatSeconds(customEnd)}`,
        detail: `Logoen vises fra ${formatSeconds(customStart)} til ${formatSeconds(customEnd)} i videoen.`,
      };
    case 'none':
      return {
        label: 'Skjult',
        detail: 'Logoen vises ikke i denne videoen.',
      };
    case 'outro':
    default:
      return {
        label: 'Outro',
        detail: 'Logoen vises i outroen og følger de siste 3 sekundene av videoen.',
      };
  }
};

const getProducerOverlayEditorGuidance = (
  brandGuide: ProducerBrandGuide,
): ProducerOverlayEditorGuidance => {
  const placement = brandGuide.logoPlacement ?? 'bottom_right';
  const treatment = brandGuide.logoTreatment ?? 'clean';
  const timing = brandGuide.logoTiming ?? 'outro';

  if (timing === 'none') {
    return {
      safeZone: {
        horizontalPercent: 0,
        verticalPercent: 0,
        label: 'Ikke i bruk',
      },
      opacity: {
        percent: 0,
        label: '0%',
      },
      recommendedMargin: {
        pixelsAt1080: 0,
        label: 'Ikke i bruk',
      },
      note: 'Logo skal ikke legges på denne leveransen.',
    };
  }

  const isCentered = placement === 'center';
  const safeZoneHorizontalPercent = isCentered
    ? 18
    : treatment === 'watermark'
      ? 5
      : treatment === 'badge'
        ? 7
        : 8;
  const safeZoneVerticalPercent = isCentered
    ? 12
    : treatment === 'watermark'
      ? 5
      : treatment === 'badge'
        ? 7
        : 8;
  const opacityPercent = treatment === 'watermark'
    ? 42
    : treatment === 'badge'
      ? 96
      : 100;
  const recommendedMarginPxAt1080 = isCentered
    ? 0
    : treatment === 'watermark'
      ? 56
      : treatment === 'badge'
        ? 72
        : 96;

  const note = isCentered
    ? 'Sentrert logo trenger fri sone rundt motiv, teksting og CTA før den legges inn i bildet.'
    : treatment === 'watermark'
      ? 'Hold vannmerket lavt nok til at det ikke konkurrerer med teksting, CTA eller viktige motivflater.'
      : treatment === 'badge'
        ? 'Badge kan stå tettere på kanten, men skal fortsatt ligge innenfor safe zone og utenfor undertekster.'
        : 'Bruk full logo med ren luft mot kanten og hold den utenfor tekst, undertekster og UI-elementer.';

  return {
    safeZone: {
      horizontalPercent: safeZoneHorizontalPercent,
      verticalPercent: safeZoneVerticalPercent,
      label: `${safeZoneHorizontalPercent}% horisontalt / ${safeZoneVerticalPercent}% vertikalt`,
    },
    opacity: {
      percent: opacityPercent,
      label: `${opacityPercent}%`,
    },
    recommendedMargin: {
      pixelsAt1080: recommendedMarginPxAt1080,
      label: isCentered ? '0 px fra kant · bruk fri sone rundt logoen' : `${recommendedMarginPxAt1080} px @1080p`,
    },
    note,
  };
};

export const getProducerRecommendedBrandLogoVariantType = (
  brandGuide: ProducerBrandGuide,
  format?: string,
): ProducerBrandLogoVariantType | null => {
  const availableVariantTypes = new Set((brandGuide.logoVariants ?? []).map((item) => item.type));
  const preferredType = format === '9:16' || format === '1:1'
    ? 'icon'
    : 'primary';
  if (availableVariantTypes.has(preferredType)) {
    return preferredType;
  }
  if (availableVariantTypes.has('primary')) {
    return 'primary';
  }
  if (availableVariantTypes.has('icon')) {
    return 'icon';
  }
  return brandGuide.activeLogoVariantType ?? null;
};

export const resolveProducerBrandLogoVariant = (
  brandGuide: ProducerBrandGuide,
  format?: string,
  selection: ProducerBrandLogoVariantSelection = 'auto',
): {
  selection: ProducerBrandLogoVariantSelection;
  selectionLabel: string;
  recommendedType: ProducerBrandLogoVariantType | null;
  recommendedLabel: string;
  resolvedType: ProducerBrandLogoVariantType | null;
  resolvedLabel: string;
  autoApplied: boolean;
} => {
  const availableVariantTypes = new Set((brandGuide.logoVariants ?? []).map((item) => item.type));
  const recommendedType = getProducerRecommendedBrandLogoVariantType(brandGuide, format);
  const recommendedLabel = recommendedType
    ? PRODUCER_BRAND_LOGO_VARIANT_LABELS[recommendedType]
    : 'Ingen variant';
  const fallbackType = availableVariantTypes.has('primary')
    ? 'primary'
    : availableVariantTypes.has('icon')
      ? 'icon'
      : brandGuide.activeLogoVariantType ?? null;
  const requestedType = selection === 'auto'
    ? recommendedType
    : selection;
  const resolvedType = requestedType && availableVariantTypes.has(requestedType)
    ? requestedType
    : fallbackType;
  const resolvedLabel = resolvedType
    ? PRODUCER_BRAND_LOGO_VARIANT_LABELS[resolvedType]
    : 'Ingen variant';

  return {
    selection,
    selectionLabel: selection === 'auto'
      ? 'Bruk anbefalt variant'
      : `Tving ${PRODUCER_BRAND_LOGO_VARIANT_LABELS[selection]}`,
    recommendedType,
    recommendedLabel,
    resolvedType,
    resolvedLabel,
    autoApplied: selection === 'auto',
  };
};

export const getProducerOverlayFormatProfile = (
  brandGuide: ProducerBrandGuide,
  format?: string,
): ProducerOverlayFormatProfile => {
  const baseGuidance = getProducerOverlayEditorGuidance(brandGuide);
  const normalizedFormat = hasText(format) ? format.trim() : 'standard';
  const variantResolution = resolveProducerBrandLogoVariant(brandGuide, normalizedFormat, 'auto');

  if (normalizedFormat === '9:16') {
    return {
      format: normalizedFormat,
      formatLabel: '9:16',
      recommendedVariantType: variantResolution.recommendedType,
      recommendedVariantLabel: variantResolution.recommendedLabel,
      safeZone: {
        horizontalPercent: Math.max(baseGuidance.safeZone.horizontalPercent, 12),
        verticalPercent: Math.max(baseGuidance.safeZone.verticalPercent, 14),
        label: `${Math.max(baseGuidance.safeZone.horizontalPercent, 12)}% horisontalt / ${Math.max(baseGuidance.safeZone.verticalPercent, 14)}% vertikalt`,
      },
      opacity: baseGuidance.opacity,
      recommendedMargin: {
        pixelsAt1080: baseGuidance.recommendedMargin.pixelsAt1080 > 0
          ? Math.max(40, baseGuidance.recommendedMargin.pixelsAt1080 - 24)
          : 0,
        label: baseGuidance.recommendedMargin.pixelsAt1080 > 0
          ? `${Math.max(40, baseGuidance.recommendedMargin.pixelsAt1080 - 24)} px @1080x1920`
          : baseGuidance.recommendedMargin.label,
      },
      note: `${baseGuidance.note} Hold ekstra luft mot topp og bunn for UI, captions og CTA i vertikal feed.`,
    };
  }

  if (normalizedFormat === '4:5') {
    return {
      format: normalizedFormat,
      formatLabel: '4:5',
      recommendedVariantType: variantResolution.recommendedType,
      recommendedVariantLabel: variantResolution.recommendedLabel,
      safeZone: {
        horizontalPercent: Math.max(baseGuidance.safeZone.horizontalPercent, 10),
        verticalPercent: Math.max(baseGuidance.safeZone.verticalPercent, 12),
        label: `${Math.max(baseGuidance.safeZone.horizontalPercent, 10)}% horisontalt / ${Math.max(baseGuidance.safeZone.verticalPercent, 12)}% vertikalt`,
      },
      opacity: baseGuidance.opacity,
      recommendedMargin: {
        pixelsAt1080: baseGuidance.recommendedMargin.pixelsAt1080 > 0
          ? Math.max(48, baseGuidance.recommendedMargin.pixelsAt1080 - 16)
          : 0,
        label: baseGuidance.recommendedMargin.pixelsAt1080 > 0
          ? `${Math.max(48, baseGuidance.recommendedMargin.pixelsAt1080 - 16)} px @1080x1350`
          : baseGuidance.recommendedMargin.label,
      },
      note: `${baseGuidance.note} Feed-varianten trenger litt mer topp- og bunnluft enn bredformatet for tekst og plattformkrom.`,
    };
  }

  if (normalizedFormat === '1:1') {
    return {
      format: normalizedFormat,
      formatLabel: '1:1',
      recommendedVariantType: variantResolution.recommendedType,
      recommendedVariantLabel: variantResolution.recommendedLabel,
      safeZone: {
        horizontalPercent: Math.max(baseGuidance.safeZone.horizontalPercent, 10),
        verticalPercent: Math.max(baseGuidance.safeZone.verticalPercent, 10),
        label: `${Math.max(baseGuidance.safeZone.horizontalPercent, 10)}% horisontalt / ${Math.max(baseGuidance.safeZone.verticalPercent, 10)}% vertikalt`,
      },
      opacity: baseGuidance.opacity,
      recommendedMargin: {
        pixelsAt1080: baseGuidance.recommendedMargin.pixelsAt1080 > 0
          ? Math.max(48, baseGuidance.recommendedMargin.pixelsAt1080 - 12)
          : 0,
        label: baseGuidance.recommendedMargin.pixelsAt1080 > 0
          ? `${Math.max(48, baseGuidance.recommendedMargin.pixelsAt1080 - 12)} px @1080x1080`
          : baseGuidance.recommendedMargin.label,
      },
      note: `${baseGuidance.note} Kvadratisk uttak trenger balansert luft rundt logoen på alle kanter.`,
    };
  }

  if (normalizedFormat === '16:9') {
    return {
      format: normalizedFormat,
      formatLabel: '16:9',
      recommendedVariantType: variantResolution.recommendedType,
      recommendedVariantLabel: variantResolution.recommendedLabel,
      safeZone: {
        horizontalPercent: Math.max(baseGuidance.safeZone.horizontalPercent, 8),
        verticalPercent: Math.max(baseGuidance.safeZone.verticalPercent, 8),
        label: `${Math.max(baseGuidance.safeZone.horizontalPercent, 8)}% horisontalt / ${Math.max(baseGuidance.safeZone.verticalPercent, 8)}% vertikalt`,
      },
      opacity: baseGuidance.opacity,
      recommendedMargin: {
        pixelsAt1080: baseGuidance.recommendedMargin.pixelsAt1080,
        label: baseGuidance.recommendedMargin.pixelsAt1080 > 0
          ? `${baseGuidance.recommendedMargin.pixelsAt1080} px @1920x1080`
          : baseGuidance.recommendedMargin.label,
      },
      note: `${baseGuidance.note} Bredformatet tåler mer sideplass, men hold nedre tredel fri for captions og CTA.`,
    };
  }

  return {
    format: normalizedFormat,
    formatLabel: normalizedFormat,
    recommendedVariantType: variantResolution.recommendedType,
    recommendedVariantLabel: variantResolution.recommendedLabel,
    ...baseGuidance,
  };
};

const getPhaseFolderLabel = (phase: ProducerPlanningPhase): string => {
  switch (phase) {
    case 'preproduction':
      return 'Pre-produksjon';
    case 'production':
      return 'Produksjon';
    case 'postproduction':
      return 'Post-produksjon';
    default:
      return 'Leveranse';
  }
};

const buildDeliveryFolderPath = (
  workflow: ProducerDeliveryWorkflow,
  item: ProducerContentCalendarItem,
  stage: ProducerDeliveryManifestItem['deliveryStage'],
): string => {
  const rootFolder = getDeliveryRootFolder(workflow);
  const phaseFolder = getPhaseFolderLabel(item.phase);
  const stageFolder = getDeliveryStageFolderLabel(stage);
  const channelFolder = normalizeFilenameToken(item.channel || item.title || 'leveranse') || 'leveranse';
  return [rootFolder, phaseFolder, stageFolder, channelFolder].join('/');
};

export const createProducerContentCalendarItem = (
  phase: ProducerPlanningPhase = 'postproduction',
): ProducerContentCalendarItem => ({
  id: globalThis.crypto?.randomUUID?.() ?? `calendar-${Date.now()}-${Math.round(Math.random() * 1000)}`,
  title: '',
  channel: '',
  format: '',
  publishAt: '',
  owner: '',
  phase,
  status: 'planned',
  linkedShotListId: '',
  notes: '',
});

export const getDefaultProducerProjectPlanning = (projectName: string): ProducerProjectPlanning => ({
  activationPlan: {
    direction: '',
    idea: '',
    activation: '',
    targetAudience: '',
    businessGoal: '',
    coreMessage: '',
    successSignals: [],
    framework: DEFAULT_ACTIVATION_FRAMEWORK.map((item) => ({ ...item })),
  },
  contentLogic: { ...DEFAULT_CONTENT_LOGIC, proofPoints: [], successSignals: [] },
  phasePlan: DEFAULT_PHASE_PLAN.map((item) => ({
    ...item,
    notes: item.phase === 'preproduction'
      ? `Planen for ${projectName} skal være tydelig for klient, team og leveranseansvarlig.`
      : '',
  })),
  contentCalendar: DEFAULT_CALENDAR_ITEMS.map((item) => ({ ...item })),
  brandGuide: { ...DEFAULT_BRAND_GUIDE, colors: [] },
  accountAccess: {
    ...DEFAULT_ACCOUNT_ACCESS,
    entries: DEFAULT_ACCOUNT_ACCESS.entries.map((entry) => ({ ...entry })),
  },
  deliveryWorkflow: { ...DEFAULT_DELIVERY_WORKFLOW },
  collaborationTerms: {
    ...DEFAULT_COLLABORATION_TERMS,
    deliverablesInScope: [...(DEFAULT_COLLABORATION_TERMS.deliverablesInScope ?? [])],
    productionResponsibilities: [...(DEFAULT_COLLABORATION_TERMS.productionResponsibilities ?? [])],
    brandingResponsibilities: [...(DEFAULT_COLLABORATION_TERMS.brandingResponsibilities ?? [])],
    marketingResponsibilities: [...(DEFAULT_COLLABORATION_TERMS.marketingResponsibilities ?? [])],
    costItems: (DEFAULT_COLLABORATION_TERMS.costItems ?? []).map((item) => ({ ...item })),
  },
  meetingWorkspace: {
    ...DEFAULT_MEETING_WORKSPACE,
    sessionLabel: `Klientsync · ${projectName}`,
  },
  workspaceNavigation: getDefaultProducerWorkspaceNavigation(),
  updatedAt: undefined,
});

export const normalizeProducerProjectPlanning = (project: CastingProject): ProducerProjectPlanning => {
  const source = project.producerPlanning;
  const defaults = getDefaultProducerProjectPlanning(project.name);

  if (!source) {
    return defaults;
  }

  const activationPlan = normalizeActivationPlan(source.activationPlan, defaults.activationPlan);
  const phasePlan = defaults.phasePlan.map((fallback) => {
    const matched = source.phasePlan?.find((item) => item.phase === fallback.phase) ?? null;
    return normalizePhasePlanItem(matched, fallback);
  });

  const contentCalendar = Array.isArray(source.contentCalendar) && source.contentCalendar.length > 0
    ? source.contentCalendar
      .map((item, index) => normalizeCalendarItem(item, index))
      .filter((item): item is ProducerContentCalendarItem => item !== null)
    : defaults.contentCalendar;

  const brandGuide = source.brandGuide ?? {};
  const deliveryWorkflow = source.deliveryWorkflow ?? {};
  const accountAccess = normalizeProducerAccountAccessWorkspace(source.accountAccess, defaults.accountAccess);
  const logoStartSecond = normalizeBrandLogoSecond(
    brandGuide.logoStartSecond,
    DEFAULT_BRAND_GUIDE.logoStartSecond ?? 0,
  );
  const logoEndSecond = Math.max(
    logoStartSecond + 1,
    normalizeBrandLogoSecond(
      brandGuide.logoEndSecond,
      DEFAULT_BRAND_GUIDE.logoEndSecond ?? logoStartSecond + 3,
    ),
  );

  return {
    activationPlan,
    contentLogic: normalizeContentLogic(source.contentLogic, activationPlan),
    phasePlan,
    contentCalendar,
    brandGuide: {
      logoUrl: hasText(brandGuide.logoUrl) ? brandGuide.logoUrl.trim() : undefined,
      activeLogoVariantType: normalizeBrandLogoVariantType(brandGuide.activeLogoVariantType),
      logoPlacement: normalizeBrandLogoPlacement(brandGuide.logoPlacement),
      logoTiming: normalizeBrandLogoTiming(brandGuide.logoTiming),
      logoStartSecond,
      logoEndSecond,
      logoTreatment: normalizeBrandLogoTreatment(brandGuide.logoTreatment),
      logoDetection: normalizeBrandLogoDetection(brandGuide.logoDetection),
      logoVariants: Array.isArray(brandGuide.logoVariants)
        ? brandGuide.logoVariants
          .map((item, index) => normalizeBrandLogoVariant(item, index))
          .filter((item): item is ProducerBrandLogoVariant => item !== null)
        : [],
      fonts: normalizeStringArray(brandGuide.fonts),
      toneOfVoice: hasText(brandGuide.toneOfVoice) ? brandGuide.toneOfVoice.trim() : '',
      visualStyle: hasText(brandGuide.visualStyle) ? brandGuide.visualStyle.trim() : '',
      dos: normalizeStringArray(brandGuide.dos),
      donts: normalizeStringArray(brandGuide.donts),
      colors: Array.isArray(brandGuide.colors)
        ? brandGuide.colors
          .map((item, index) => {
            const record = item !== null && typeof item === 'object' && !Array.isArray(item)
              ? item as Record<string, unknown>
              : null;
            if (!record || !hasText(record.label) || !hasText(record.hex)) {
              return null;
            }
            return {
              id: hasText(record.id) ? record.id.trim() : `brand-color-${index + 1}`,
              label: record.label.trim(),
              hex: record.hex.trim(),
              usage: hasText(record.usage) ? record.usage.trim() : undefined,
            };
          })
          .filter((item): item is NonNullable<ProducerBrandGuide['colors']>[number] => item !== null)
        : [],
    },
    accountAccess,
    deliveryWorkflow: {
      presetId: getProducerDeliveryWorkflowPreset(
        hasText(deliveryWorkflow.presetId) ? deliveryWorkflow.presetId.trim() : '',
      )?.id ?? DEFAULT_DELIVERY_WORKFLOW.presetId,
      fileNamingConvention: hasText(deliveryWorkflow.fileNamingConvention) ? deliveryWorkflow.fileNamingConvention.trim() : '',
      versioningRule: hasText(deliveryWorkflow.versioningRule) ? deliveryWorkflow.versioningRule.trim() : '',
      folderStructure: hasText(deliveryWorkflow.folderStructure) ? deliveryWorkflow.folderStructure.trim() : '',
      draftVsFinalRule: hasText(deliveryWorkflow.draftVsFinalRule) ? deliveryWorkflow.draftVsFinalRule.trim() : '',
      backupRoutine: hasText(deliveryWorkflow.backupRoutine) ? deliveryWorkflow.backupRoutine.trim() : '',
      deliveryCadence: hasText(deliveryWorkflow.deliveryCadence) ? deliveryWorkflow.deliveryCadence.trim() : '',
    },
    collaborationTerms: normalizeProducerCollaborationTerms(source.collaborationTerms),
    meetingWorkspace: normalizeMeetingWorkspace(source.meetingWorkspace, defaults.meetingWorkspace),
    workspaceNavigation: normalizeProducerWorkspaceNavigation(source.workspaceNavigation),
    updatedAt: hasText(source.updatedAt) ? source.updatedAt.trim() : undefined,
  };
};

export const getProducerPlanningClientMoments = (
  planning: ProducerProjectPlanning,
): ProducerPlanningClientMoment[] => {
  const frameworkMoments: ProducerPlanningClientMoment[] = (planning.activationPlan.framework ?? [])
    .flatMap((section) => {
      const meta = frameworkMomentMeta[section.key];
      if (!meta) {
        return [];
      }

      const focusText = hasText(section.focus) ? section.focus.trim() : '';
      const outputText = hasText(section.output) ? section.output.trim() : '';
      const notesText = hasText(section.notes) ? section.notes.trim() : '';
      const fallbackText = section.key === 'strategy'
        ? joinNonEmpty([
          planning.activationPlan.direction,
          planning.activationPlan.businessGoal,
          planning.activationPlan.targetAudience,
        ], ' · ')
        : section.key === 'concept_development'
          ? joinNonEmpty([
            planning.activationPlan.idea,
            planning.activationPlan.coreMessage,
          ], ' · ')
          : joinNonEmpty([
            planning.activationPlan.activation,
            planning.activationPlan.successSignals.join(' · '),
          ], ' · ');

      const detail = [
        focusText ? `Fokus: ${focusText}` : '',
        outputText ? `Leveranse: ${outputText}` : '',
        notesText ? `Notater: ${notesText}` : '',
        !focusText && !outputText && !notesText && fallbackText ? fallbackText : '',
      ]
        .filter((value): value is string => value.trim().length > 0)
        .join(' · ');

      if (!detail) {
        return [];
      }

      const phaseItem = planning.phasePlan.find((item) => item.phase === meta.phase);
      const completenessScore = [focusText, outputText, notesText].filter((value) => value.length > 0).length;

      return [{
        id: `framework:${section.key}`,
        type: 'framework_alignment',
        title: meta.title,
        detail,
        phase: meta.phase,
        date: phaseItem?.startDate ?? phaseItem?.endDate,
        owner: phaseItem?.owner,
        linkedShotListId: phaseItem?.linkedShotListIds?.[0],
        statusLabel: completenessScore >= 2 ? 'Klar til godkjenning' : 'Trenger innspill',
        priority: meta.priority,
      }];
    });

  const contentLogic = planning.contentLogic ?? getDefaultContentLogicFromActivationPlan(planning.activationPlan);
  const preproductionPhaseItem = planning.phasePlan.find((item) => item.phase === 'preproduction');
  const contentLogicMoments: ProducerPlanningClientMoment[] = [
    {
      id: 'content-logic:hook',
      title: 'Content Logic · Hook',
      detail: joinNonEmpty([
        hasText(contentLogic.hook) ? `Hook: ${contentLogic.hook}` : '',
        hasText(contentLogic.coreMessage) ? `Budskap: ${contentLogic.coreMessage}` : '',
      ], ' · '),
      statusLabel: hasText(contentLogic.hook) ? 'Klar til godkjenning' : 'Trenger innspill',
      priority: -27,
    },
    {
      id: 'content-logic:cta',
      title: 'Content Logic · CTA',
      detail: joinNonEmpty([
        hasText(contentLogic.callToAction) ? `CTA: ${contentLogic.callToAction}` : '',
        hasText(contentLogic.distributionPlan) ? `Distribusjon: ${contentLogic.distributionPlan}` : '',
      ], ' · '),
      statusLabel: hasText(contentLogic.callToAction) ? 'Klar til godkjenning' : 'Trenger innspill',
      priority: -26,
    },
    {
      id: 'content-logic:proof',
      title: 'Content Logic · Bevis',
      detail: contentLogic.proofPoints.length > 0
        ? contentLogic.proofPoints.map((item) => `Bevis: ${item}`).join(' · ')
        : '',
      statusLabel: contentLogic.proofPoints.length > 0 ? 'Klar til godkjenning' : 'Trenger innspill',
      priority: -25,
    },
  ]
    .filter((moment) => hasText(moment.detail))
    .map((moment) => ({
      id: moment.id,
      type: 'framework_alignment' as const,
      title: moment.title,
      detail: moment.detail,
      phase: 'preproduction' as const,
      date: preproductionPhaseItem?.startDate ?? preproductionPhaseItem?.endDate,
      owner: preproductionPhaseItem?.owner,
      linkedShotListId: preproductionPhaseItem?.linkedShotListIds?.[0],
      statusLabel: moment.statusLabel,
      priority: moment.priority,
    }));

  const phaseMoments: ProducerPlanningClientMoment[] = planning.phasePlan
    .filter((item) => hasText(item.clientCheckpoint))
    .map((item) => ({
      id: `phase:${item.phase}`,
      type: 'phase_checkpoint',
      title: item.clientCheckpoint ?? item.title ?? PRODUCER_PLANNING_PHASE_LABELS[item.phase],
      detail: item.objective ?? item.notes ?? '',
      phase: item.phase,
      date: item.endDate ?? item.startDate,
      owner: item.owner,
      linkedShotListId: item.linkedShotListIds?.[0],
      statusLabel: PRODUCER_PLANNING_STATUS_LABELS[item.status ?? 'planned'],
      priority: planningStatusPriority[item.status ?? 'planned'],
    }));

  const contentMoments: ProducerPlanningClientMoment[] = planning.contentCalendar.map((item) => ({
    id: `content:${item.id}`,
    type: 'content_delivery',
    title: item.title,
    detail: [item.channel, item.format, item.notes].filter(hasText).join(' · '),
    phase: item.phase,
    date: item.publishAt,
    owner: item.owner,
    linkedShotListId: item.linkedShotListId,
    statusLabel: PRODUCER_CONTENT_CALENDAR_STATUS_LABELS[item.status ?? 'planned'],
    priority: calendarStatusPriority[item.status ?? 'planned'],
  }));

  const requiredAccountPlatforms = getProducerRequiredAccountPlatforms(planning);
  const postproductionPhaseItem = planning.phasePlan.find((item) => item.phase === 'postproduction');
  const accountAccessMoments: ProducerPlanningClientMoment[] = planning.accountAccess.entries
    .filter((entry) => requiredAccountPlatforms.has(entry.platform) && (entry.status === 'client_action' || entry.status === 'invite_sent'))
    .map((entry) => ({
      id: `account-access:${entry.platform}`,
      type: 'account_access' as const,
      title: `Kontotilgang · ${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}`,
      detail: [
        `Status: ${PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status]}`,
        `Metode: ${PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS[entry.method]}`,
        hasText(entry.accountLabel) ? `Konto: ${entry.accountLabel}` : '',
        hasText(entry.inviteTarget) ? `Invitasjon til: ${entry.inviteTarget}` : '',
        hasText(entry.accessScope) ? `Scope: ${entry.accessScope}` : '',
        entry.twoFactorRequired ? '2-faktor holdes hos kontoeier' : '',
      ].filter((value): value is string => value.trim().length > 0).join(' · '),
      phase: 'postproduction',
      date: postproductionPhaseItem?.startDate ?? postproductionPhaseItem?.endDate,
      owner: entry.ownerName ?? postproductionPhaseItem?.owner,
      statusLabel: PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status],
      priority: entry.status === 'client_action' ? 34 : 35,
    }));

  return [...frameworkMoments, ...contentLogicMoments, ...phaseMoments, ...contentMoments, ...accountAccessMoments].sort((left, right) => {
    const leftDate = left.date ? Date.parse(left.date) : Number.POSITIVE_INFINITY;
    const rightDate = right.date ? Date.parse(right.date) : Number.POSITIVE_INFINITY;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    if (phaseOrder[left.phase] !== phaseOrder[right.phase]) {
      return phaseOrder[left.phase] - phaseOrder[right.phase];
    }
    return left.title.localeCompare(right.title, 'nb-NO');
  });
};

const normalizePlanningReviewStatus = (status?: string | null): string => {
  if (status === 'approved' || status === 'changes_requested' || status === 'rejected') {
    return status;
  }
  return 'pending';
};

const isPlanningManagedReview = (review: ProducerClientReview): boolean => {
  const metadata = review.metadata !== null && typeof review.metadata === 'object' && !Array.isArray(review.metadata)
    ? review.metadata as Record<string, unknown>
    : {};
  return metadata.source === 'producer-planning'
    && (
      review.review_type === 'framework_alignment'
      || review.review_type === 'phase_checkpoint'
      || review.review_type === 'content_delivery'
      || review.review_type === 'account_access'
    );
};

const readPlanningMomentId = (review: ProducerClientReview): string | null => {
  const metadata = review.metadata !== null && typeof review.metadata === 'object' && !Array.isArray(review.metadata)
    ? review.metadata as Record<string, unknown>
    : {};
  const metadataMomentId = typeof metadata.planningMomentId === 'string' && metadata.planningMomentId.trim().length > 0
    ? metadata.planningMomentId.trim()
    : null;
  if (metadataMomentId) {
    return metadataMomentId;
  }
  return review.target_entity_id ?? null;
};

const getReviewSortTimestamp = (review: ProducerClientReview): number => {
  const parsed = Date.parse(review.decision_at ?? review.requested_at ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const mergeProducerPlanningClientMomentsWithReviews = (
  planning: ProducerProjectPlanning,
  reviews: ProducerClientReview[],
): ProducerPlanningClientMoment[] => {
  const moments = getProducerPlanningClientMoments(planning);
  const reviewByMomentId = new Map<string, ProducerClientReview>();

  [...reviews]
    .filter(isPlanningManagedReview)
    .sort((left, right) => getReviewSortTimestamp(right) - getReviewSortTimestamp(left))
    .forEach((review) => {
      const planningMomentId = readPlanningMomentId(review);
      if (!planningMomentId || reviewByMomentId.has(planningMomentId)) {
        return;
      }
      reviewByMomentId.set(planningMomentId, review);
    });

  return moments
    .map((moment) => {
      const review = reviewByMomentId.get(moment.id);
      if (!review) {
        return moment;
      }

      const normalizedReviewStatus = normalizePlanningReviewStatus(review.status);
      return {
        ...moment,
        statusLabel: PLANNING_REVIEW_STATUS_LABELS[normalizedReviewStatus] ?? moment.statusLabel,
        priority: Math.min(moment.priority, reviewStatusPriority[normalizedReviewStatus] ?? moment.priority),
        reviewId: review.id,
        reviewStatus: normalizedReviewStatus,
        reviewStatusLabel: PLANNING_REVIEW_STATUS_LABELS[normalizedReviewStatus] ?? moment.statusLabel,
        reviewRequestedAt: review.requested_at ?? undefined,
        reviewDecisionAt: review.decision_at ?? undefined,
        commentCount: review.comments?.length ?? 0,
        drivenByReview: true,
      };
    })
    .sort((left, right) => {
      const leftDate = left.date ? Date.parse(left.date) : Number.POSITIVE_INFINITY;
      const rightDate = right.date ? Date.parse(right.date) : Number.POSITIVE_INFINITY;
      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      if (phaseOrder[left.phase] !== phaseOrder[right.phase]) {
        return phaseOrder[left.phase] - phaseOrder[right.phase];
      }
      return left.title.localeCompare(right.title, 'nb-NO');
    });
};

export const isProducerPlanningMomentOpen = (moment: ProducerPlanningClientMoment): boolean => {
  if (moment.reviewStatus) {
    return moment.reviewStatus !== 'approved';
  }
  return moment.statusLabel !== 'Fullført' && moment.statusLabel !== 'Publisert';
};

export const summarizeProducerClientGrounding = (
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
): ProducerClientGroundingSummary => {
  const materialsByType = materials.reduce<Record<string, number>>((summary, material) => {
    summary[material.entry_type] = (summary[material.entry_type] ?? 0) + 1;
    return summary;
  }, {});

  const materialsByPhase = materials.reduce<Record<ProducerPlanningPhase, number>>((summary, material) => {
    if (material.phase === 'preproduction' || material.phase === 'production' || material.phase === 'postproduction') {
      summary[material.phase] += 1;
    }
    return summary;
  }, {
    preproduction: 0,
    production: 0,
    postproduction: 0,
  });

  const briefReadyCount = [
    intake.projectGoal,
    intake.deliverables,
    intake.targetAudience,
    intake.keyMessage,
    intake.contactName,
    intake.contactEmail,
  ].filter(hasText).length;

  const missingEssentials = [
    !hasText(intake.projectGoal) ? 'Prosjektmål mangler' : null,
    !hasText(intake.deliverables) ? 'Leveranser mangler' : null,
    !hasText(intake.targetAudience) ? 'Målgruppe mangler' : null,
    !hasText(intake.keyMessage) ? 'Kjernebudskap mangler' : null,
    materials.length === 0 ? 'Ingen klientmaterialer er lagt inn' : null,
    !materials.some((material) => material.entry_type === 'brand_asset') ? 'Merkevarefiler bør legges inn' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    briefReadyCount,
    totalBriefFields: 6,
    materialCount: materials.length,
    materialsByType,
    materialsByPhase,
    topMaterialTitles: materials
      .slice(0, 4)
      .map((material) => material.title)
      .filter(hasText),
    missingEssentials,
  };
};

export const getProducerClientContributionTasks = (
  planning: ProducerProjectPlanning,
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
): ProducerClientContributionTask[] => {
  const referenceCount = materials.filter((material) => material.entry_type === 'reference').length;
  const brandAssetCount = materials.filter((material) => material.entry_type === 'brand_asset').length;
  const briefNoteCount = materials.filter((material) => material.entry_type === 'brief_note').length;
  const tasks: ProducerClientContributionTask[] = [];

  const frameworkDefinitions: Array<{
    id: string;
    title: string;
    phase: ProducerPlanningPhase;
    priority: number;
    readySignals: boolean[];
    missingLabels: string[];
    detailParts: Array<string | undefined>;
    suggestedMaterialType: ProducerClientMaterialType;
    suggestedTitle: string;
    suggestedDescription: string;
    suggestedUsageNotes: string;
  }> = [
    {
      id: 'framework:strategy',
      title: 'Avklar retning og prosjektmål',
      phase: 'preproduction',
      priority: 10,
      readySignals: [
        hasText(intake.projectGoal),
        hasText(intake.targetAudience),
        hasText(planning.activationPlan.businessGoal),
        briefNoteCount > 0,
      ],
      missingLabels: [
        !hasText(intake.projectGoal) ? 'prosjektmål' : '',
        !hasText(intake.targetAudience) ? 'målgruppe' : '',
        !hasText(planning.activationPlan.businessGoal) ? 'forretningsmål' : '',
        briefNoteCount <= 0 ? 'briefnotat' : '',
      ].filter(hasText),
      detailParts: [
        hasText(intake.projectGoal) ? `Mål: ${intake.projectGoal}` : undefined,
        hasText(intake.targetAudience) ? `Målgruppe: ${intake.targetAudience}` : undefined,
        hasText(planning.activationPlan.businessGoal) ? `Forretningsmål: ${planning.activationPlan.businessGoal}` : undefined,
      ],
      suggestedMaterialType: 'brief_note',
      suggestedTitle: 'Retning og prosjektmål',
      suggestedDescription: 'Oppsummer hva prosjektet skal oppnå, hvem det skal treffe og hvilke mål virksomheten må nå gjennom produksjonen.',
      suggestedUsageNotes: 'Brukes til strategi, brief, faseplan og klientgodkjenning.',
    },
    {
      id: 'framework:concept_development',
      title: 'Avklar idé og kreativ retning',
      phase: 'preproduction',
      priority: 20,
      readySignals: [
        hasText(intake.keyMessage),
        hasText(intake.brandNotes),
        hasText(intake.referenceLinks) || referenceCount > 0,
      ],
      missingLabels: [
        !hasText(intake.keyMessage) ? 'kjernebudskap' : '',
        !hasText(intake.brandNotes) ? 'brand-notater' : '',
        !(hasText(intake.referenceLinks) || referenceCount > 0) ? 'referanser' : '',
      ].filter(hasText),
      detailParts: [
        hasText(intake.keyMessage) ? `Budskap: ${intake.keyMessage}` : undefined,
        hasText(intake.brandNotes) ? `Brand-notater: ${intake.brandNotes}` : undefined,
        referenceCount > 0 ? `${referenceCount} referanser ligger allerede i materialbanken` : undefined,
      ],
      suggestedMaterialType: 'reference',
      suggestedTitle: 'Kreative referanser og idé',
      suggestedDescription: 'Legg inn filmer, kampanjer, moodboards eller stilreferanser som viser ønsket tone, form og idéretning.',
      suggestedUsageNotes: 'Brukes til konseptutvikling, storyboard og kreativ godkjenning.',
    },
    {
      id: 'framework:campaign_development',
      title: 'Avklar aktivering og publiseringsløp',
      phase: 'preproduction',
      priority: 30,
      readySignals: [
        hasText(intake.deliverables),
        hasText(intake.timingConstraints),
        planning.contentCalendar.length > 0,
      ],
      missingLabels: [
        !hasText(intake.deliverables) ? 'leveranser' : '',
        !hasText(intake.timingConstraints) ? 'tidsrammer' : '',
        planning.contentCalendar.length === 0 ? 'content-kalender' : '',
      ].filter(hasText),
      detailParts: [
        hasText(intake.deliverables) ? `Leveranser: ${intake.deliverables}` : undefined,
        hasText(intake.timingConstraints) ? `Timing: ${intake.timingConstraints}` : undefined,
        planning.contentCalendar.length > 0 ? `${planning.contentCalendar.length} planlagte publiserings- eller leveransepunkter` : undefined,
      ],
      suggestedMaterialType: 'document',
      suggestedTitle: 'Aktivering, kampanjeløp og publiseringsplan',
      suggestedDescription: 'Beskriv hvordan prosjektet skal aktiveres før, under og etter gjennomføring, og hvilke publiseringspunkter som er viktigst.',
      suggestedUsageNotes: 'Brukes til content-kalender, klientflyt og publiseringsplan.',
    },
  ];

  frameworkDefinitions.forEach((definition) => {
    const readyCount = definition.readySignals.filter(Boolean).length;
    const status = toContributionStatus(readyCount, definition.readySignals.length);
    const detail = [
      ...definition.detailParts.filter(hasText),
      describeMissingRequirements(definition.missingLabels),
    ].filter(hasText).join(' · ');

    tasks.push({
      id: definition.id,
      sourceType: 'framework',
      sourceLabel: PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS.framework,
      title: definition.title,
      detail,
      phase: definition.phase,
      status,
      statusLabel: PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[status],
      priority: definition.priority,
      suggestedMaterialType: definition.suggestedMaterialType,
      suggestedTitle: definition.suggestedTitle,
      suggestedDescription: definition.suggestedDescription,
      suggestedUsageNotes: definition.suggestedUsageNotes,
    });
  });

  const brandReadySignals = [
    hasText(planning.brandGuide.logoUrl),
    (planning.brandGuide.colors?.length ?? 0) > 0,
    (planning.brandGuide.fonts?.filter(hasText).length ?? 0) > 0,
    hasText(planning.brandGuide.toneOfVoice),
    hasText(planning.brandGuide.visualStyle),
    brandAssetCount > 0,
  ];
  const brandMissing = [
    !hasText(planning.brandGuide.logoUrl) ? 'logo' : '',
    (planning.brandGuide.colors?.length ?? 0) <= 0 ? 'farger' : '',
    (planning.brandGuide.fonts?.filter(hasText).length ?? 0) <= 0 ? 'fonter' : '',
    !hasText(planning.brandGuide.toneOfVoice) ? 'tone of voice' : '',
    !hasText(planning.brandGuide.visualStyle) ? 'visuell stil' : '',
    brandAssetCount <= 0 ? 'merkevarefiler' : '',
  ].filter(hasText);
  const brandStatus = toContributionStatus(
    brandReadySignals.filter(Boolean).length,
    brandReadySignals.length,
  );

  tasks.push({
    id: 'brand:guide',
    sourceType: 'brand',
    sourceLabel: PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS.brand,
    title: 'Fullfør merkevareguiden',
    detail: [
      brandAssetCount > 0 ? `${brandAssetCount} merkevarefiler er lagt inn` : undefined,
      describeMissingRequirements(brandMissing),
    ].filter(hasText).join(' · '),
    phase: 'preproduction',
    status: brandStatus,
    statusLabel: PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[brandStatus],
    priority: 40,
    suggestedMaterialType: 'brand_asset',
    suggestedTitle: 'Merkevarepakke',
    suggestedDescription: 'Legg inn logo, fonter, profilmanual, fargebruk og andre brand assets som skal styre produksjonen.',
    suggestedUsageNotes: 'Brukes i grafikk, lower thirds, thumbnails, presentasjoner og endelige leveranser.',
  });

  const relevantAccountEntries = getRelevantProducerAccountAccessEntries(planning);
  const connectedAccountCount = relevantAccountEntries.filter((entry) => entry.status === 'connected').length;
  const startedAccountCount = relevantAccountEntries.filter((entry) => entry.status !== 'not_started').length;
  const accountStatus: ProducerClientContributionStatus = connectedAccountCount === relevantAccountEntries.length
    ? 'ready'
    : startedAccountCount > 0
      ? 'partial'
      : 'missing';
  const accessMissing = relevantAccountEntries
    .filter((entry) => entry.status !== 'connected')
    .slice(0, 3)
    .map((entry) => `${entry.platformLabel} · ${entry.statusLabel}`);

  tasks.push({
    id: 'accounts:access',
    sourceType: 'accounts',
    sourceLabel: PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS.accounts,
    title: 'Avklar kontotilgang',
    detail: [
      `${relevantAccountEntries.length} plattformer i arbeidsløpet`,
      connectedAccountCount > 0 ? `${connectedAccountCount} koblet` : undefined,
      describeMissingRequirements(accessMissing),
    ].filter(hasText).join(' · '),
    phase: 'postproduction',
    status: accountStatus,
    statusLabel: PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[accountStatus],
    priority: 45,
    suggestedMaterialType: 'document',
    suggestedTitle: 'Kontotilgang og publiseringsansvar',
    suggestedDescription: 'Avklar hvilke kontoer som skal brukes, hvem som eier tilgangen, og hvordan produsenten får sikker tilgang uten delte passord.',
    suggestedUsageNotes: 'Bruk OAuth, business invite eller klientstyrt handling. 2-faktor blir liggende hos kontoeier.',
  });

  const deliveryReadySignals = [
    hasText(planning.deliveryWorkflow.fileNamingConvention),
    hasText(planning.deliveryWorkflow.versioningRule),
    hasText(planning.deliveryWorkflow.folderStructure),
    hasText(planning.deliveryWorkflow.draftVsFinalRule),
    hasText(planning.deliveryWorkflow.backupRoutine),
    hasText(planning.deliveryWorkflow.deliveryCadence),
  ];
  const deliveryMissing = [
    !hasText(planning.deliveryWorkflow.fileNamingConvention) ? 'filnavnregel' : '',
    !hasText(planning.deliveryWorkflow.versioningRule) ? 'versjoneringsregel' : '',
    !hasText(planning.deliveryWorkflow.folderStructure) ? 'mappestruktur' : '',
    !hasText(planning.deliveryWorkflow.draftVsFinalRule) ? 'draft/final-regel' : '',
    !hasText(planning.deliveryWorkflow.backupRoutine) ? 'backuprutine' : '',
    !hasText(planning.deliveryWorkflow.deliveryCadence) ? 'leveringsrytme' : '',
  ].filter(hasText);
  const deliveryStatus = toContributionStatus(
    deliveryReadySignals.filter(Boolean).length,
    deliveryReadySignals.length,
  );

  tasks.push({
    id: 'delivery:routine',
    sourceType: 'delivery',
    sourceLabel: PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS.delivery,
    title: 'Avklar leveringsrutinen',
    detail: [
      describeMissingRequirements(deliveryMissing),
      hasText(planning.deliveryWorkflow.fileNamingConvention)
        ? `Filnavn: ${planning.deliveryWorkflow.fileNamingConvention}`
        : undefined,
    ].filter(hasText).join(' · '),
    phase: 'postproduction',
    status: deliveryStatus,
    statusLabel: PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[deliveryStatus],
    priority: 50,
    suggestedMaterialType: 'document',
    suggestedTitle: 'Leveringsrutine og filstruktur',
    suggestedDescription: 'Beskriv hvordan filer skal navngis, versjoneres, mappes, godkjennes og leveres til klient og arkiv.',
    suggestedUsageNotes: 'Brukes til eksport, overlevering, backup og final pakking.',
  });

  planning.contentCalendar.forEach((item, index) => {
    const linkedMaterials = materials.filter((material) => {
      const metadata = parseClientMaterialLinkMetadata(material);
      return metadata.linkedCalendarItemId === item.id
        || (hasText(item.linkedShotListId) && material.linked_shot_list_id === item.linkedShotListId);
    });

    const readySignals = [
      linkedMaterials.length > 0,
      hasText(item.channel),
      hasText(item.format),
      hasText(item.publishAt),
      hasText(item.owner),
    ];
    const missing = [
      linkedMaterials.length <= 0 ? 'klientmateriale' : '',
      !hasText(item.channel) ? 'kanal' : '',
      !hasText(item.format) ? 'format' : '',
      !hasText(item.publishAt) ? 'publiseringsdato' : '',
      !hasText(item.owner) ? 'ansvarlig' : '',
    ].filter(hasText);
    const status = toContributionStatus(readySignals.filter(Boolean).length, readySignals.length);
    const suggestedMaterialType: ProducerClientMaterialType = item.phase === 'postproduction'
      ? 'feedback'
      : item.linkedShotListId
        ? 'asset_link'
        : 'document';

    tasks.push({
      id: `calendar:${item.id}`,
      sourceType: 'calendar',
      sourceLabel: PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS.calendar,
      title: `Grunnlag for ${item.title}`,
      detail: [
        joinNonEmpty([item.channel, item.format, item.publishAt], ' · '),
        linkedMaterials.length > 0 ? `${linkedMaterials.length} materialer er allerede koblet til punktet` : undefined,
        describeMissingRequirements(missing),
      ].filter(hasText).join(' · '),
      phase: item.phase,
      status,
      statusLabel: PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[status],
      priority: 100 + index,
      suggestedMaterialType,
      suggestedTitle: `Materiale til ${item.title}`,
      suggestedDescription: `Legg inn alt klientgrunnlag som trengs for ${item.title.toLowerCase()} på ${item.channel || 'valgt kanal'} i format ${item.format || 'ikke satt'}.`,
      suggestedUsageNotes: hasText(item.notes)
        ? item.notes ?? ''
        : 'Brukes til content-kalender, klientgodkjenning og endelig levering.',
      linkedCalendarItemId: item.id,
      linkedShotListId: item.linkedShotListId ?? undefined,
    });
  });

  return tasks.sort((left, right) => {
    const statusOrder: Record<ProducerClientContributionStatus, number> = {
      missing: 0,
      partial: 1,
      ready: 2,
    };
    if (statusOrder[left.status] !== statusOrder[right.status]) {
      return statusOrder[left.status] - statusOrder[right.status];
    }
    if (phaseOrder[left.phase] !== phaseOrder[right.phase]) {
      return phaseOrder[left.phase] - phaseOrder[right.phase];
    }
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.title.localeCompare(right.title, 'nb-NO');
  });
};

const mapPlanningFramework = (
  framework: ProducerPlanningFrameworkStep[] | undefined,
  updater: (section: ProducerPlanningFrameworkStep) => ProducerPlanningFrameworkStep,
): ProducerPlanningFrameworkStep[] => (
  (framework ?? []).map((section) => updater(section))
);

export const applyProducerClientGroundingToPlanning = (
  planning: ProducerProjectPlanning,
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
): ProducerProjectPlanning => {
  const grounding = summarizeProducerClientGrounding(intake, materials);
  const materialTitles = grounding.topMaterialTitles.join(', ');
  const referenceCount = grounding.materialsByType.reference ?? 0;
  const brandAssetCount = grounding.materialsByType.brand_asset ?? 0;
  const documentCount = grounding.materialsByType.document ?? 0;
  const nextSuccessSignals = appendUniqueLines(planning.activationPlan.successSignals, [
    hasText(intake.deliverables) ? 'Alle avtalte leveranser er klare for godkjenning og publisering.' : undefined,
    hasText(intake.timingConstraints) ? `Prosjektet holder kritiske frister: ${intake.timingConstraints}` : undefined,
    grounding.materialCount > 0 ? `${grounding.materialCount} klientmaterialer er samlet som arbeidsgrunnlag.` : undefined,
  ]);

  return {
    ...planning,
    activationPlan: {
      ...planning.activationPlan,
      direction: fillIfBlank(planning.activationPlan.direction, intake.projectGoal),
      idea: fillIfBlank(
        planning.activationPlan.idea,
        joinNonEmpty([
          intake.keyMessage,
          materialTitles ? `Bygg konseptet videre på ${materialTitles}` : undefined,
        ], '. '),
      ),
      activation: fillIfBlank(
        planning.activationPlan.activation,
        joinNonEmpty([
          intake.deliverables ? `Aktiver prosjektet gjennom ${intake.deliverables}` : undefined,
          hasText(intake.timingConstraints) ? `hold planen mot ${intake.timingConstraints}` : undefined,
        ], ' · '),
      ),
      targetAudience: fillIfBlank(planning.activationPlan.targetAudience, intake.targetAudience),
      businessGoal: fillIfBlank(
        planning.activationPlan.businessGoal,
        joinNonEmpty([intake.projectGoal, intake.deliverables], ' · '),
      ),
      coreMessage: fillIfBlank(planning.activationPlan.coreMessage, intake.keyMessage),
      successSignals: nextSuccessSignals,
      framework: mapPlanningFramework(planning.activationPlan.framework, (section) => {
        if (section.key === 'strategy') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, joinNonEmpty([intake.projectGoal, intake.targetAudience], ' · ')),
            output: fillIfBlank(section.output, 'Et tydelig beslutningsgrunnlag for retning, målgruppe og leveranser.'),
            notes: fillIfBlank(section.notes, joinNonEmpty([
              hasText(intake.deliverables) ? `Leveranser: ${intake.deliverables}` : undefined,
              hasText(intake.timingConstraints) ? `Timing: ${intake.timingConstraints}` : undefined,
              hasText(intake.contactName) ? `Kontaktpunkt: ${intake.contactName}` : undefined,
            ], ' · ')),
          };
        }
        if (section.key === 'concept_development') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, joinNonEmpty([intake.keyMessage, intake.brandNotes], ' · ')),
            output: fillIfBlank(section.output, 'Konseptretning, kreativ vinkel og tydelig opplevelsesløfte.'),
            notes: fillIfBlank(section.notes, joinNonEmpty([
              referenceCount > 0 ? `${referenceCount} referanser er lagt inn av klienten` : undefined,
              brandAssetCount > 0 ? `${brandAssetCount} merkevarefiler finnes som grunnlag` : undefined,
              materialTitles ? `Start med disse materialene: ${materialTitles}` : undefined,
            ], ' · ')),
          };
        }
        if (section.key === 'campaign_development') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, 'Bygg oppmerksomhet før, under og etter selve produksjonen.'),
            output: fillIfBlank(section.output, 'Aktiveringsplan med kanaler, timing og klientpunkter.'),
            notes: fillIfBlank(section.notes, joinNonEmpty([
              hasText(intake.referenceLinks) ? `Referanselenker: ${intake.referenceLinks}` : undefined,
              documentCount > 0 ? `${documentCount} dokumenter gir innsikt til kampanjeutviklingen` : undefined,
            ], ' · ')),
          };
        }
        if (section.key === 'content_production') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, `Bruk klientgrunnlaget aktivt i storyboard, manus og shotlist.`),
            output: fillIfBlank(section.output, 'Shotlist, storyboard, manus og leveranseplan basert på samme materiale.'),
            notes: fillIfBlank(section.notes, joinNonEmpty([
              grounding.materialsByPhase.preproduction > 0 ? `${grounding.materialsByPhase.preproduction} materialer er direkte knyttet til pre-produksjon` : undefined,
              grounding.materialsByPhase.production > 0 ? `${grounding.materialsByPhase.production} materialer støtter produksjonsdagen` : undefined,
              grounding.materialsByPhase.postproduction > 0 ? `${grounding.materialsByPhase.postproduction} materialer støtter etterarbeid og levering` : undefined,
            ], ' · ')),
          };
        }
        if (section.key === 'execution') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, 'Hold beslutninger, ansvar og publiseringspunkter samlet gjennom opptak og levering.'),
            output: fillIfBlank(section.output, 'Operativ faseplan med tydelige klientcheckpoints og leveranser.'),
            notes: fillIfBlank(section.notes, joinNonEmpty([
              hasText(intake.contactEmail) ? `Primær kontakt: ${intake.contactEmail}` : undefined,
              hasText(intake.contactPhone) ? `Telefon: ${intake.contactPhone}` : undefined,
            ], ' · ')),
          };
        }
        return {
          ...section,
          focus: fillIfBlank(section.focus, 'Mål hva som fungerte, hva som skapte respons og hvordan materialet brukes videre.'),
          output: fillIfBlank(section.output, 'Evalueringsgrunnlag for neste publisering eller neste event.'),
          notes: fillIfBlank(section.notes, joinNonEmpty(planning.activationPlan.successSignals ?? [], ' · ')),
        };
      }),
    },
    contentLogic: {
      ...getDefaultContentLogicFromActivationPlan(planning.activationPlan),
      ...(planning.contentLogic ?? {}),
      objective: fillIfBlank(
        planning.contentLogic?.objective,
        joinNonEmpty([intake.projectGoal, intake.deliverables], ' · '),
      ),
      audience: fillIfBlank(planning.contentLogic?.audience, intake.targetAudience),
      hook: fillIfBlank(
        planning.contentLogic?.hook,
        joinNonEmpty([
          intake.keyMessage,
          materialTitles ? `Bygg vinkelen videre på ${materialTitles}` : undefined,
        ], '. '),
      ),
      coreMessage: fillIfBlank(planning.contentLogic?.coreMessage, intake.keyMessage),
      proofPoints: appendUniqueLines(planning.contentLogic?.proofPoints ?? [], [
        hasText(intake.deliverables) ? `Avtalte leveranser: ${intake.deliverables}` : undefined,
        referenceCount > 0 ? `${referenceCount} referanser ligger klare som bevisgrunnlag.` : undefined,
        brandAssetCount > 0 ? `${brandAssetCount} merkevarefiler finnes for grafikk og logo.` : undefined,
      ]),
      callToAction: fillIfBlank(
        planning.contentLogic?.callToAction,
        hasText(intake.deliverables) ? 'Be om godkjenning av leveransen og lås publiseringsklar versjon.' : '',
      ),
      distributionPlan: fillIfBlank(
        planning.contentLogic?.distributionPlan,
        joinNonEmpty([
          hasText(intake.deliverables) ? `Fordel ${intake.deliverables} per kanal og publiseringsløp.` : undefined,
          hasText(intake.timingConstraints) ? `Hold planen mot ${intake.timingConstraints}` : undefined,
        ], ' · '),
      ),
      successSignals: appendUniqueLines(planning.contentLogic?.successSignals ?? [], nextSuccessSignals),
    },
    phasePlan: planning.phasePlan.map((phaseItem) => {
      if (phaseItem.phase === 'preproduction') {
        return {
          ...phaseItem,
          notes: fillIfBlank(phaseItem.notes, joinNonEmpty([
            grounding.materialCount > 0 ? `${grounding.materialCount} klientmaterialer er tilgjengelige før planlåsing` : undefined,
            grounding.materialsByPhase.preproduction > 0 ? `${grounding.materialsByPhase.preproduction} er allerede knyttet til pre-produksjon` : undefined,
          ], ' · ')),
        };
      }
      if (phaseItem.phase === 'production') {
        return {
          ...phaseItem,
          notes: fillIfBlank(phaseItem.notes, joinNonEmpty([
            grounding.materialsByPhase.production > 0 ? `${grounding.materialsByPhase.production} materialer støtter opptaksdagen` : undefined,
            hasText(intake.timingConstraints) ? `Produksjonsdagen må ta høyde for: ${intake.timingConstraints}` : undefined,
          ], ' · ')),
        };
      }
      return {
        ...phaseItem,
        notes: fillIfBlank(phaseItem.notes, joinNonEmpty([
          grounding.materialsByPhase.postproduction > 0 ? `${grounding.materialsByPhase.postproduction} materialer brukes videre i post-produksjon` : undefined,
          hasText(planning.deliveryWorkflow.deliveryCadence) ? `Leveringsrytme: ${planning.deliveryWorkflow.deliveryCadence}` : undefined,
        ], ' · ')),
      };
    }),
  };
};

export const applyStoryLogicToProducerPlanning = (
  planning: ProducerProjectPlanning,
  storyLogic: StoryLogicState,
): ProducerProjectPlanning => {
  const concept = storyLogic.concept;
  const logline = storyLogic.logline;
  const theme = storyLogic.theme;
  const conceptSummary = joinNonEmpty([concept.corePremise, concept.uniqueAngle, concept.whyNow], ' · ');
  const themeSummary = joinNonEmpty([theme.themeStatement, theme.transformationArc, theme.moralArgument], ' · ');
  const emotionalJourney = Array.isArray(theme.emotionalJourney)
    ? theme.emotionalJourney.filter(hasText)
    : [];
  const nextSuccessSignals = appendUniqueLines(planning.activationPlan.successSignals, [
    hasText(logline.stakes) ? `Publikum skal forstå hva som står på spill: ${logline.stakes}` : undefined,
    hasText(theme.transformationArc) ? `Transformasjonen må være tydelig: ${theme.transformationArc}` : undefined,
  ]);

  return {
    ...planning,
    activationPlan: {
      ...planning.activationPlan,
      direction: fillIfBlank(planning.activationPlan.direction, conceptSummary),
      idea: fillIfBlank(
        planning.activationPlan.idea,
        joinNonEmpty([logline.fullLogline, concept.uniqueAngle, concept.corePremise], ' · '),
      ),
      activation: fillIfBlank(
        planning.activationPlan.activation,
        emotionalJourney.length > 0
          ? `Bygg aktiveringen rundt denne reisen: ${emotionalJourney.join(' → ')}`
          : concept.targetAudience,
      ),
      targetAudience: fillIfBlank(planning.activationPlan.targetAudience, concept.targetAudience),
      coreMessage: fillIfBlank(planning.activationPlan.coreMessage, joinNonEmpty([theme.themeStatement, theme.centralTheme], ' · ')),
      successSignals: nextSuccessSignals,
      framework: mapPlanningFramework(planning.activationPlan.framework, (section) => {
        if (section.key === 'strategy') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, joinNonEmpty([concept.corePremise, concept.targetAudience], ' · ')),
            output: fillIfBlank(section.output, 'En tydelig retning som er forankret i premiss, målgruppe og hvorfor dette må fortelles nå.'),
            notes: fillIfBlank(section.notes, concept.whyNow),
          };
        }
        if (section.key === 'concept_development') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, joinNonEmpty([concept.uniqueAngle, logline.fullLogline], ' · ')),
            output: fillIfBlank(section.output, 'Et konsept som gjør at målgruppen bryr seg og husker budskapet.'),
            notes: fillIfBlank(section.notes, joinNonEmpty([concept.marketComparables, theme.themeStatement], ' · ')),
          };
        }
        if (section.key === 'campaign_development') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, emotionalJourney.length > 0 ? emotionalJourney.join(' → ') : concept.targetAudience),
            output: fillIfBlank(section.output, 'Aktiveringsløp som bygger forventning, nærvær og oppfølging rundt prosjektet.'),
            notes: fillIfBlank(section.notes, theme.emotionalJourney.filter(hasText).join(' · ')),
          };
        }
        if (section.key === 'content_production') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, joinNonEmpty([logline.protagonist, logline.goal, logline.antagonisticForce], ' · ')),
            output: fillIfBlank(section.output, 'Innhold som tydelig viser premiss, konflikt, mål og transformasjon gjennom shotlist og leveranser.'),
            notes: fillIfBlank(section.notes, joinNonEmpty([theme.transformationArc, theme.emotionalJourney.filter(hasText).join(' → ')], ' · ')),
          };
        }
        if (section.key === 'execution') {
          return {
            ...section,
            focus: fillIfBlank(section.focus, hasText(logline.stakes) ? `Prioriter scener og leveranser som bærer stakes: ${logline.stakes}` : ''),
            output: fillIfBlank(section.output, 'En gjennomføring som følger den dramaturgiske prioriteten i materialet.'),
            notes: fillIfBlank(section.notes, hasText(logline.goal) ? `Målet som må være synlig i gjennomføringen: ${logline.goal}` : ''),
          };
        }
        return {
          ...section,
          focus: fillIfBlank(section.focus, joinNonEmpty([theme.centralTheme, theme.whatMustChange], ' · ')),
          output: fillIfBlank(section.output, 'Et tydelig grunnlag for evaluering, læring og videre bruk av materialet.'),
          notes: fillIfBlank(section.notes, themeSummary),
        };
      }),
    },
    contentLogic: {
      ...getDefaultContentLogicFromActivationPlan(planning.activationPlan),
      ...(planning.contentLogic ?? {}),
      objective: fillIfBlank(planning.contentLogic?.objective, conceptSummary),
      audience: fillIfBlank(planning.contentLogic?.audience, concept.targetAudience),
      hook: fillIfBlank(
        planning.contentLogic?.hook,
        joinNonEmpty([concept.uniqueAngle, logline.fullLogline, concept.corePremise], ' · '),
      ),
      coreMessage: fillIfBlank(
        planning.contentLogic?.coreMessage,
        joinNonEmpty([theme.themeStatement, theme.centralTheme], ' · '),
      ),
      proofPoints: appendUniqueLines(planning.contentLogic?.proofPoints ?? [], [
        hasText(logline.stakes) ? `Hva står på spill: ${logline.stakes}` : undefined,
        hasText(theme.moralArgument) ? `Moralsk konflikt: ${theme.moralArgument}` : undefined,
        hasText(theme.transformationArc) ? `Transformasjon: ${theme.transformationArc}` : undefined,
      ]),
      callToAction: fillIfBlank(
        planning.contentLogic?.callToAction,
        emotionalJourney.length > 0 ? `La publikum sitte igjen med ${emotionalJourney[emotionalJourney.length - 1]}.` : '',
      ),
      distributionPlan: fillIfBlank(
        planning.contentLogic?.distributionPlan,
        concept.targetAudience ? `Tilpass kanaluttak og publiseringsløp til ${concept.targetAudience}.` : '',
      ),
      successSignals: appendUniqueLines(planning.contentLogic?.successSignals ?? [], nextSuccessSignals),
    },
  };
};

export const getProducerStrategySnapshot = (planning: ProducerProjectPlanning): Array<{ label: string; value: string }> => {
  const activationPlan = planning.activationPlan;
  const contentLogic = planning.contentLogic;
  return [
    { label: 'Mål', value: contentLogic?.objective ?? activationPlan.businessGoal ?? activationPlan.direction ?? '' },
    { label: 'Hook', value: contentLogic?.hook ?? activationPlan.idea ?? '' },
    { label: 'CTA', value: contentLogic?.callToAction ?? contentLogic?.distributionPlan ?? activationPlan.activation ?? '' },
  ].filter((entry) => hasText(entry.value));
};

const applyNamingConvention = (
  workflow: ProducerDeliveryWorkflow,
  projectName: string,
  item: ProducerContentCalendarItem,
  versionLabel = 'v01',
): string => {
  const today = new Date().toISOString().slice(0, 10);
  const pattern = hasText(workflow.fileNamingConvention)
    ? workflow.fileNamingConvention
    : '[Prosjekt]_[Format]_[Dato]_[Versjon].ext';
  const extension = item.format?.includes(':') ? 'mp4' : 'mov';
  return pattern
    .replace('[Prosjekt]', normalizeFilenameToken(projectName))
    .replace('[Format]', normalizeFilenameToken(item.format || item.title || 'format'))
    .replace('[Dato]', normalizeFilenameToken(item.publishAt || today))
    .replace('[Versjon]', versionLabel)
    .replace('.ext', `.${extension}`);
};

export const buildProducerDeliveryManifest = (
  projectName: string,
  planning: ProducerProjectPlanning,
  estimate: ContentProductionEstimate,
  reviews: ProducerClientReview[] = [],
): ProducerDeliveryManifest => {
  const contentLogic = planning.contentLogic ?? getDefaultContentLogicFromActivationPlan(planning.activationPlan);
  const logoTimingSummary = getProducerBrandLogoTimingSummary(planning.brandGuide);
  const overlayEditorGuidance = getProducerOverlayEditorGuidance(planning.brandGuide);
  const accountAccessSummary = buildProducerAccountAccessSummary(planning);
  const deliveryItems: ProducerDeliveryManifestItem[] = planning.contentCalendar.map((item) => {
    const matchingFormat = estimate.formatEstimates.find((formatEstimate) => (
      hasText(item.format) && formatEstimate.aspectRatio === item.format
    ));
    const variantResolution = resolveProducerBrandLogoVariant(
      planning.brandGuide,
      item.format,
      item.logoVariantSelection ?? 'auto',
    );
    const stage = getDeliveryStage(item.status);
    const versionLabel = getDeliveryVersionLabel(planning.deliveryWorkflow, stage.deliveryStage);
    const filename = applyNamingConvention(planning.deliveryWorkflow, projectName, item, versionLabel);
    const folderPath = buildDeliveryFolderPath(planning.deliveryWorkflow, item, stage.deliveryStage);

    return {
      id: item.id,
      title: item.title,
      channel: item.channel ?? 'Ikke satt',
      phase: item.phase,
      format: item.format ?? 'Ikke satt',
      filename,
      packageName: filename.replace(/\.[^.]+$/, ''),
      folderPath,
      versionLabel,
      deliveryStage: stage.deliveryStage,
      deliveryStageLabel: stage.deliveryStageLabel,
      publishAt: item.publishAt,
      publishDateLabel: formatManifestDate(item.publishAt),
      statusLabel: PRODUCER_CONTENT_CALENDAR_STATUS_LABELS[item.status ?? 'planned'],
      estimatedDurationLabel: matchingFormat ? formatSeconds(matchingFormat.estimatedSeconds) : undefined,
      linkedShotListId: item.linkedShotListId,
      backupRuleLabel: planning.deliveryWorkflow.backupRoutine || 'Ikke satt',
      logoVariantSelection: item.logoVariantSelection ?? 'auto',
      logoVariantSelectionLabel: variantResolution.selectionLabel,
      logoVariantResolvedType: variantResolution.resolvedType,
      logoVariantResolvedLabel: variantResolution.resolvedLabel,
      logoVariantRecommendedLabel: variantResolution.recommendedLabel,
      logoVariantAutoApplied: variantResolution.autoApplied,
      notes: item.notes,
    };
  });

  const brandChecklist: string[] = [
    hasText(planning.brandGuide.logoUrl) ? 'Logo er koblet til prosjektet.' : 'Logo må legges inn før endelig levering.',
    `Logo i video: ${logoTimingSummary.detail}`,
    `Automatisk logovalg: Primær i 16:9 / 4:5, ikon i 9:16 / 1:1 når ikonvariant finnes.`,
    planning.brandGuide.colors && planning.brandGuide.colors.length > 0
      ? `${planning.brandGuide.colors.length} merkevarefarger er definert.`
      : 'Merkevarefarger bør defineres før eksport.',
    hasText(planning.brandGuide.toneOfVoice)
      ? `Tone of voice: ${planning.brandGuide.toneOfVoice}`
      : 'Tone of voice er ikke definert ennå.',
    hasText(planning.brandGuide.visualStyle)
      ? `Visuell stil: ${planning.brandGuide.visualStyle}`
      : 'Visuell stil er ikke definert ennå.',
  ];

  const workflowChecklist = [
    `Filnavn: ${planning.deliveryWorkflow.fileNamingConvention || 'Ikke satt'}`,
    `Versjonering: ${planning.deliveryWorkflow.versioningRule || 'Ikke satt'}`,
    `Mapper: ${planning.deliveryWorkflow.folderStructure || 'Ikke satt'}`,
    `Draft/final: ${planning.deliveryWorkflow.draftVsFinalRule || 'Ikke satt'}`,
    `Backup: ${planning.deliveryWorkflow.backupRoutine || 'Ikke satt'}`,
    `Leveringsrytme: ${planning.deliveryWorkflow.deliveryCadence || 'Ikke satt'}`,
  ];
  const overlayFormatProfiles = Array.from(
    new Set(
      planning.contentCalendar
        .map((item) => item.format?.trim())
        .filter((value): value is string => hasText(value)),
    ),
  ).map((format) => getProducerOverlayFormatProfile(planning.brandGuide, format));
  const logoUsageMatrix: ProducerDeliveryLogoUsageMatrixItem[] = deliveryItems.map((item) => ({
    id: item.id,
    title: item.title,
    channel: item.channel,
    format: item.format,
    deliveryStageLabel: item.deliveryStageLabel,
    selectionLabel: item.logoVariantSelectionLabel,
    resolvedLabel: item.logoVariantResolvedLabel,
    recommendedLabel: item.logoVariantRecommendedLabel,
    autoApplied: item.logoVariantAutoApplied,
  }));

  return {
    projectName,
    direction: planning.activationPlan.direction ?? '',
    idea: planning.activationPlan.idea ?? '',
    activation: planning.activationPlan.activation ?? '',
    businessGoal: planning.activationPlan.businessGoal ?? '',
    targetAudience: planning.activationPlan.targetAudience ?? '',
    coreMessage: planning.activationPlan.coreMessage ?? '',
    successSignals: planning.activationPlan.successSignals ?? [],
    primaryDeliveryLabel: getPrimaryFormatLabel(estimate),
    recommendedShootDays: estimate.suggestedShootDays,
    productionLoadLabel: formatMinutes(estimate.totalRealisticFieldMinutes),
    pendingClientMoments: mergeProducerPlanningClientMomentsWithReviews(planning, reviews)
      .filter((moment) => isProducerPlanningMomentOpen(moment)),
    deliveryItems,
    logoUsageMatrix,
    accountAccessSummary,
    frameworkSections: (planning.activationPlan.framework ?? []).map((section) => ({
      key: section.key,
      label: PRODUCER_PLANNING_FRAMEWORK_LABELS[section.key],
      focus: section.focus ?? '',
      output: section.output ?? '',
      notes: section.notes ?? '',
    })),
    contentLogicSummary: {
      objective: contentLogic.objective ?? '',
      audience: contentLogic.audience ?? '',
      hook: contentLogic.hook ?? '',
      coreMessage: contentLogic.coreMessage ?? '',
      proofPoints: contentLogic.proofPoints ?? [],
      callToAction: contentLogic.callToAction ?? '',
      distributionPlan: contentLogic.distributionPlan ?? '',
    },
    logoPlacementLabel: PRODUCER_BRAND_LOGO_PLACEMENT_LABELS[planning.brandGuide.logoPlacement ?? 'bottom_right'],
    logoTimingLabel: logoTimingSummary.label,
    logoTreatmentLabel: PRODUCER_BRAND_LOGO_TREATMENT_LABELS[planning.brandGuide.logoTreatment ?? 'clean'],
    logoTimingDetail: logoTimingSummary.detail,
    overlayEditorGuidance,
    overlayFormatProfiles,
    brandChecklist,
    workflowChecklist,
    generatedAt: new Date().toISOString(),
  };
};

export const formatProducerDeliveryManifestAsText = (manifest: ProducerDeliveryManifest): string => {
  const lines: string[] = [
    `Prosjekt: ${manifest.projectName}`,
    '',
    'RETNING',
    manifest.direction || 'Ikke satt',
    '',
    'IDÉ',
    manifest.idea || 'Ikke satt',
    '',
    'AKTIVERING',
    manifest.activation || 'Ikke satt',
    '',
    `Forretningsmål: ${manifest.businessGoal || 'Ikke satt'}`,
    `Målgruppe: ${manifest.targetAudience || 'Ikke satt'}`,
    `Kjernebudskap: ${manifest.coreMessage || 'Ikke satt'}`,
    `Content Logic mål: ${manifest.contentLogicSummary.objective || 'Ikke satt'}`,
    `Content Logic hook: ${manifest.contentLogicSummary.hook || 'Ikke satt'}`,
    `Content Logic CTA: ${manifest.contentLogicSummary.callToAction || 'Ikke satt'}`,
    `Logo plassering: ${manifest.logoPlacementLabel || 'Ikke satt'}`,
    `Logo behandling: ${manifest.logoTreatmentLabel || 'Ikke satt'}`,
    `Logo timing: ${manifest.logoTimingDetail || 'Ikke satt'}`,
    `Kontotilgang: ${manifest.accountAccessSummary.connectedCount}/${manifest.accountAccessSummary.requiredPlatformCount} nødvendige plattformer koblet`,
    `Safe zone: ${manifest.overlayEditorGuidance.safeZone.label}`,
    `Opacity: ${manifest.overlayEditorGuidance.opacity.label}`,
    `Anbefalt margin: ${manifest.overlayEditorGuidance.recommendedMargin.label}`,
    `Hovedleveranse: ${manifest.primaryDeliveryLabel}`,
    `Anbefalte opptaksdager: ${manifest.recommendedShootDays}`,
    `Produksjonsbelastning: ${manifest.productionLoadLabel}`,
    '',
    'KLIENTPUNKTER',
    ...(
      manifest.pendingClientMoments.length > 0
        ? manifest.pendingClientMoments.map((moment) => (
          `- ${getProducerClientMomentTextEyebrow(moment)} ${moment.title} (${PRODUCER_PLANNING_PHASE_LABELS[moment.phase]})${moment.date ? ` · ${moment.date}` : ''} · ${moment.statusLabel}`
        ))
        : ['- Ingen åpne klientpunkter']
    ),
    '',
    'LEVERANSER',
    ...manifest.deliveryItems.map((item) => (
      [
        `- ${item.title} · ${item.channel} · ${item.format}`,
        `  Mappe: ${item.folderPath}`,
        `  Pakke: ${item.packageName}`,
        `  Filnavn: ${item.filename}`,
        `  Versjon / stage: ${item.versionLabel} · ${item.deliveryStageLabel}`,
        `  Logo: ${item.logoVariantResolvedLabel} (${item.logoVariantSelectionLabel})`,
        item.publishDateLabel ? `  Publisering: ${item.publishDateLabel}` : '  Publisering: Ikke satt',
        item.estimatedDurationLabel ? `  Estimert lengde: ${item.estimatedDurationLabel}` : '  Estimert lengde: Ikke beregnet',
      ].join('\n')
    )),
    '',
    'LOGOBRUKSMATRISE',
    ...(
      manifest.logoUsageMatrix.length > 0
        ? manifest.logoUsageMatrix.map((item) => (
          [
            `- ${item.title} · ${item.channel} · ${item.format}`,
            `  Valg: ${item.selectionLabel}`,
            `  Brukes: ${item.resolvedLabel}`,
            `  Anbefalt: ${item.recommendedLabel}${item.autoApplied ? ' · auto aktiv' : ''}`,
            `  Leveringstrinn: ${item.deliveryStageLabel}`,
          ].join('\n')
        ))
        : ['- Ingen leveranser i matrisen']
    ),
    '',
    'MERKEVARE',
    ...manifest.brandChecklist.map((item) => `- ${item}`),
    '',
    'KONTOTILGANG',
    ...(
      manifest.accountAccessSummary.entries.length > 0
        ? manifest.accountAccessSummary.entries.map((entry) => (
          [
            `- ${entry.platformLabel}${entry.requiredForProject ? ' · kreves for prosjektet' : ''}`,
            `  Status: ${entry.statusLabel} · Metode: ${entry.methodLabel}`,
            `  Scope: ${entry.accessScope || 'Ikke satt'}`,
            `  Konto / side: ${entry.accountLabel || 'Ikke satt'}`,
            `  Invite / mottaker: ${entry.inviteTarget || 'Ikke satt'}`,
            `  Kontoeier: ${entry.clientOwnerLabel || 'Ikke satt'}`,
            `  2-faktor hos kontoeier: ${entry.twoFactorRequired ? 'Ja' : 'Nei'}`,
            `  Notat: ${entry.notes || 'Ingen notater.'}`,
          ].join('\n')
        ))
        : ['- Ingen kontotilganger registrert ennå.']
    ),
    `Sikkerhetsnotat: ${manifest.accountAccessSummary.securityNotes || 'Ikke satt'}`,
    `Revoke-plan: ${manifest.accountAccessSummary.revokePlan || 'Ikke satt'}`,
    '',
    'LEVERINGSRUTINE',
    ...manifest.workflowChecklist.map((item) => `- ${item}`),
  ];

  if (manifest.successSignals.length > 0) {
    lines.push('', 'TEGN PÅ SUKSESS', ...manifest.successSignals.map((item) => `- ${item}`));
  }

  const contentLogicRows = [
    `Mål: ${manifest.contentLogicSummary.objective || 'Ikke satt'}`,
    `Målgruppe: ${manifest.contentLogicSummary.audience || 'Ikke satt'}`,
    `Hook: ${manifest.contentLogicSummary.hook || 'Ikke satt'}`,
    `Budskap: ${manifest.contentLogicSummary.coreMessage || 'Ikke satt'}`,
    `CTA: ${manifest.contentLogicSummary.callToAction || 'Ikke satt'}`,
    `Distribusjon: ${manifest.contentLogicSummary.distributionPlan || 'Ikke satt'}`,
  ];

  if (manifest.contentLogicSummary.proofPoints.length > 0) {
    contentLogicRows.push('Bevis:');
    contentLogicRows.push(...manifest.contentLogicSummary.proofPoints.map((item) => `- ${item}`));
  }

  lines.push('', 'CONTENT LOGIC', ...contentLogicRows);
  lines.push(
    '',
    'OVERLAY-SPEC',
    `Safe zone: ${manifest.overlayEditorGuidance.safeZone.label}`,
    `Opacity: ${manifest.overlayEditorGuidance.opacity.label}`,
    `Anbefalt margin: ${manifest.overlayEditorGuidance.recommendedMargin.label}`,
    `Editornotat: ${manifest.overlayEditorGuidance.note}`,
  );

  if (manifest.overlayFormatProfiles.length > 0) {
    lines.push('', 'OVERLAY PER FORMAT');
    for (const profile of manifest.overlayFormatProfiles) {
      lines.push(
        `${profile.formatLabel}`,
        `Anbefalt variant: ${profile.recommendedVariantLabel}`,
        `Safe zone: ${profile.safeZone.label}`,
        `Opacity: ${profile.opacity.label}`,
        `Anbefalt margin: ${profile.recommendedMargin.label}`,
        `Editornotat: ${profile.note}`,
        '',
      );
    }
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
  }

  const filledFrameworkSections = manifest.frameworkSections.filter((section) => (
    hasText(section.focus) || hasText(section.output) || hasText(section.notes)
  ));
  if (filledFrameworkSections.length > 0) {
    lines.push('', 'PROSJEKTRAMME');
    for (const section of filledFrameworkSections) {
      lines.push(
        `${section.label}`,
        `Fokus: ${section.focus || 'Ikke satt'}`,
        `Leveranse: ${section.output || 'Ikke satt'}`,
        `Notater: ${section.notes || 'Ingen notater'}`,
        '',
      );
    }
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
  }

  return lines.join('\n');
};

export const formatProducerClientContributionTasksAsText = (
  tasks: ProducerClientContributionTask[],
): string => {
  const openTasks = tasks.filter((task) => task.status !== 'ready');
  const lines: string[] = [
    '',
    'ÅPNE KLIENTINNSPILL',
    ...(
      openTasks.length > 0
        ? openTasks.flatMap((task) => ([
          `- ${task.title} · ${PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType]} · ${PRODUCER_PLANNING_PHASE_LABELS[task.phase]} · ${PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[task.status]}`,
          `  ${task.detail || 'Ingen detaljer registrert.'}`,
        ]))
        : ['- Ingen åpne klientinnspill']
    ),
  ];

  return lines.join('\n');
};

import type {
  CastingProject,
  ProducerActivationPlan,
  ProducerBrandGuide,
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerClientMaterialType,
  ProducerContentCalendarItem,
  ProducerContentCalendarStatus,
  ProducerDeliveryWorkflow,
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
  type: 'framework_alignment' | 'phase_checkpoint' | 'content_delivery';
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
};

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
  notes?: string;
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
  frameworkSections: Array<{
    key: ProducerPlanningFrameworkStepKey;
    label: string;
    focus: string;
    output: string;
    notes: string;
  }>;
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
  brand: 'Merkevareguide',
  delivery: 'Leveringsrutine',
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
  brand: '#a855f7',
  delivery: '#22c55e',
};

export const getProducerWorkspaceSurfaceForContributionSource = (
  sourceType: ProducerClientContributionSourceType,
): ProducerWorkspaceSurfaceKey => {
  if (sourceType === 'brand') {
    return 'brand';
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

const DEFAULT_DELIVERY_WORKFLOW: ProducerDeliveryWorkflow = {
  fileNamingConvention: '[Prosjekt]_[Format]_[Dato]_[Versjon].ext',
  versioningRule: 'Bruk v01, v02, v03 for interne utkast og FINAL først når klienten har godkjent leveransen.',
  folderStructure: '01_Brief / 02_Prepro / 03_Produksjon / 04_Post / 05_Leveranser / 06_Arkiv',
  draftVsFinalRule: 'Legg alle arbeidsfiler i Draft. Flytt kun godkjente eksportfiler til Final med låst versjonsnummer.',
  backupRoutine: 'Minst tre kopier: lokal arbeidsdisk, prosjektserver/skylagring og separat backup etter opptaksdag.',
  deliveryCadence: 'Send første utkast med tydelig frist for tilbakemelding. Loggfør hver revisjon og bekreft leveringsklar final i samme tråd.',
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
  const deliverySection = createProducerWorkspaceSection(
    'Retning og levering',
    [
      createProducerWorkspacePage('brand', { id: 'workspace-page-brand', order: 0 }),
      createProducerWorkspacePage('delivery', { id: 'workspace-page-delivery', order: 1 }),
    ],
    {
      id: 'workspace-section-delivery',
      color: '#a855f7',
      order: 1,
      layout: 'focus',
    },
  );

  return {
    sectionTabPlacement: 'left',
    pageTabPlacement: 'left',
    navigationPinned: true,
    activeSectionId: foundationSection.id,
    activePageId: foundationSection.pages[0]?.id,
    sections: [foundationSection, deliverySection],
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
    || surface === 'brand'
    || surface === 'delivery'
    ? surface
    : 'brief';

  return createProducerWorkspacePage(normalizedSurface, {
    id: hasText(record.id) ? record.id.trim() : undefined,
    title: hasText(record.title) ? record.title.trim() : PRODUCER_WORKSPACE_SURFACE_LABELS[normalizedSurface],
    color: normalizeWorkspaceColor(record.color, PRODUCER_WORKSPACE_SURFACE_COLORS[normalizedSurface]),
    pinned: Boolean(record.pinned),
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

  const normalizedSections = sections.length > 0 ? sections : fallback.sections;
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
  phasePlan: DEFAULT_PHASE_PLAN.map((item) => ({
    ...item,
    notes: item.phase === 'preproduction'
      ? `Planen for ${projectName} skal være tydelig for klient, team og leveranseansvarlig.`
      : '',
  })),
  contentCalendar: DEFAULT_CALENDAR_ITEMS.map((item) => ({ ...item })),
  brandGuide: { ...DEFAULT_BRAND_GUIDE, colors: [] },
  deliveryWorkflow: { ...DEFAULT_DELIVERY_WORKFLOW },
  workspaceNavigation: getDefaultProducerWorkspaceNavigation(),
  updatedAt: undefined,
});

export const normalizeProducerProjectPlanning = (project: CastingProject): ProducerProjectPlanning => {
  const source = project.producerPlanning;
  const defaults = getDefaultProducerProjectPlanning(project.name);

  if (!source) {
    return defaults;
  }

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

  return {
    activationPlan: normalizeActivationPlan(source.activationPlan, defaults.activationPlan),
    phasePlan,
    contentCalendar,
    brandGuide: {
      logoUrl: hasText(brandGuide.logoUrl) ? brandGuide.logoUrl.trim() : undefined,
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
    deliveryWorkflow: {
      fileNamingConvention: hasText(deliveryWorkflow.fileNamingConvention) ? deliveryWorkflow.fileNamingConvention.trim() : '',
      versioningRule: hasText(deliveryWorkflow.versioningRule) ? deliveryWorkflow.versioningRule.trim() : '',
      folderStructure: hasText(deliveryWorkflow.folderStructure) ? deliveryWorkflow.folderStructure.trim() : '',
      draftVsFinalRule: hasText(deliveryWorkflow.draftVsFinalRule) ? deliveryWorkflow.draftVsFinalRule.trim() : '',
      backupRoutine: hasText(deliveryWorkflow.backupRoutine) ? deliveryWorkflow.backupRoutine.trim() : '',
      deliveryCadence: hasText(deliveryWorkflow.deliveryCadence) ? deliveryWorkflow.deliveryCadence.trim() : '',
    },
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

  return [...frameworkMoments, ...phaseMoments, ...contentMoments].sort((left, right) => {
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
      successSignals: appendUniqueLines(planning.activationPlan.successSignals, [
        hasText(intake.deliverables) ? 'Alle avtalte leveranser er klare for godkjenning og publisering.' : undefined,
        hasText(intake.timingConstraints) ? `Prosjektet holder kritiske frister: ${intake.timingConstraints}` : undefined,
        grounding.materialCount > 0 ? `${grounding.materialCount} klientmaterialer er samlet som arbeidsgrunnlag.` : undefined,
      ]),
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
      successSignals: appendUniqueLines(planning.activationPlan.successSignals, [
        hasText(logline.stakes) ? `Publikum skal forstå hva som står på spill: ${logline.stakes}` : undefined,
        hasText(theme.transformationArc) ? `Transformasjonen må være tydelig: ${theme.transformationArc}` : undefined,
      ]),
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
  };
};

export const getProducerStrategySnapshot = (planning: ProducerProjectPlanning): Array<{ label: string; value: string }> => {
  const activationPlan = planning.activationPlan;
  return [
    { label: 'Retning', value: activationPlan.direction ?? '' },
    { label: 'Idé', value: activationPlan.idea ?? '' },
    { label: 'Aktivering', value: activationPlan.activation ?? '' },
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
  const deliveryItems: ProducerDeliveryManifestItem[] = planning.contentCalendar.map((item) => {
    const matchingFormat = estimate.formatEstimates.find((formatEstimate) => (
      hasText(item.format) && formatEstimate.aspectRatio === item.format
    ));
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
      notes: item.notes,
    };
  });

  const brandChecklist: string[] = [
    hasText(planning.brandGuide.logoUrl) ? 'Logo er koblet til prosjektet.' : 'Logo må legges inn før endelig levering.',
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
    frameworkSections: (planning.activationPlan.framework ?? []).map((section) => ({
      key: section.key,
      label: PRODUCER_PLANNING_FRAMEWORK_LABELS[section.key],
      focus: section.focus ?? '',
      output: section.output ?? '',
      notes: section.notes ?? '',
    })),
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
    `Hovedleveranse: ${manifest.primaryDeliveryLabel}`,
    `Anbefalte opptaksdager: ${manifest.recommendedShootDays}`,
    `Produksjonsbelastning: ${manifest.productionLoadLabel}`,
    '',
    'KLIENTPUNKTER',
    ...(
      manifest.pendingClientMoments.length > 0
        ? manifest.pendingClientMoments.map((moment) => (
          `- ${moment.title} (${PRODUCER_PLANNING_PHASE_LABELS[moment.phase]})${moment.date ? ` · ${moment.date}` : ''} · ${moment.statusLabel}`
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
        item.publishDateLabel ? `  Publisering: ${item.publishDateLabel}` : '  Publisering: Ikke satt',
        item.estimatedDurationLabel ? `  Estimert lengde: ${item.estimatedDurationLabel}` : '  Estimert lengde: Ikke beregnet',
      ].join('\n')
    )),
    '',
    'MERKEVARE',
    ...manifest.brandChecklist.map((item) => `- ${item}`),
    '',
    'LEVERINGSRUTINE',
    ...manifest.workflowChecklist.map((item) => `- ${item}`),
  ];

  if (manifest.successSignals.length > 0) {
    lines.push('', 'TEGN PÅ SUKSESS', ...manifest.successSignals.map((item) => `- ${item}`));
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

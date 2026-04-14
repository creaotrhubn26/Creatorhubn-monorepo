import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AddOutlined as AddOutlinedIcon,
  AdminPanelSettingsOutlined as AdminPanelSettingsOutlinedIcon,
  ArticleOutlined as ArticleOutlinedIcon,
  AutoFixHigh as AutoFixHighIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  CloudDoneOutlined as CloudDoneOutlinedIcon,
  CloudSyncOutlined as CloudSyncOutlinedIcon,
  DragIndicator as DragIndicatorIcon,
  EditOutlined as EditOutlinedIcon,
  FactCheckOutlined as FactCheckOutlinedIcon,
  FiberManualRecord as FiberManualRecordIcon,
  GridViewOutlined as GridViewOutlinedIcon,
  HubOutlined as HubOutlinedIcon,
  ImageOutlined as ImageOutlinedIcon,
  PaletteOutlined as PaletteOutlinedIcon,
  PermMedia as PermMediaIcon,
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
  SaveOutlined as SaveOutlinedIcon,
  SpaceDashboardOutlined as SpaceDashboardOutlinedIcon,
  SubdirectoryArrowRight as SubdirectoryArrowRightIcon,
  CloudUpload as CloudUploadIcon,
  UploadFile as UploadFileIcon,
  VerticalSplitOutlined as VerticalSplitOutlinedIcon,
  MoreHoriz as MoreHorizIcon,
  PhotoCameraOutlined as PhotoCameraOutlinedIcon,
  VideoCallOutlined as VideoCallOutlinedIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  Manuscript,
  ProducerAccountAccessPlatform,
  ProducerAccountAccessRevealPolicy,
  ProducerAccountAccessRiskLevel,
  ProducerAccountAccessRoleTarget,
  ProducerAccountAccessSecretStatus,
  ProducerAccountAccessTier,
  ProducerAccountAccessTwoFactorStatus,
  ProducerAccountAccessVaultTab,
  ProducerBrandGuideColor,
  ProducerBrandLogoDetection,
  ProducerBrandLogoVariant,
  ProducerBrandLogoVariantType,
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerClientMaterialType,
  ProducerProjectPlanning,
  ProducerPlanningPhase,
  RoleRoomGoogleArtifactRef,
  ProducerWorkspaceLayout,
  ProducerWorkspacePage,
  ProducerWorkspacePagePlacement,
  ProducerWorkspaceSection,
  ProducerWorkspaceSurfaceKey,
  ProducerWorkspaceTabPlacement,
  RoleRoomAccessVaultRevealRequest,
  RoleRoomAccessVaultRevealResult,
  RoleRoomAccessVaultSecretSummary,
  RoleRoomAccessVaultState,
  ShotList,
} from '../../models/casting';
import { castingService } from '../../services/castingService';
import { manuscriptService } from '../../services/manuscriptService';
import settingsService from '../../services/settingsService';
import { authSessionService } from '../../services/authSessionService';
import { storyLogicService } from '../../services/storyLogicService';
import {
  producerWorkflowService,
  type ProducerClientReview,
  type ProducerTimelineItem,
} from '../../services/producerWorkflowService';
import roleRoomAgentService, {
  type RoleRoomAgentAccess,
  type RoleRoomAgentBrandColor,
  type RoleRoomAgentProducerBootstrapResult,
} from '../../services/roleRoomAgentService';
import { onProducerWorkflowEvent } from '../../services/producerWorkflowEvents';
import { onProjectAgreementEvent } from '../../services/projectAgreementEvents';
import { useProject } from '@/contexts/ProjectContext';
import {
  googleWorkspaceApi,
  linkedInWorkspaceApi,
  projectAgreementsApi,
  roleRoomAccessVaultApi,
  type ProjectAgreement,
} from '../../services/castingApiService';
import {
  applyProducerDeliveryWorkflowPreset,
  createProducerWorkspacePage,
  createProducerWorkspaceSection,
  flattenProducerWorkspacePages,
  getDefaultProducerWorkspaceNavigation,
  getProducerAccountAccessPlatformFromMomentId,
  PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS,
  PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS,
  PRODUCER_ACCOUNT_ACCESS_REVEAL_POLICY_LABELS,
  PRODUCER_ACCOUNT_ACCESS_RISK_LABELS,
  PRODUCER_ACCOUNT_ACCESS_ROLE_TARGET_LABELS,
  PRODUCER_ACCOUNT_ACCESS_SECRET_STATUS_LABELS,
  PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS,
  PRODUCER_ACCOUNT_ACCESS_TIER_LABELS,
  PRODUCER_ACCOUNT_ACCESS_TWO_FACTOR_STATUS_LABELS,
  PRODUCER_ACCOUNT_ACCESS_VAULT_TAB_LABELS,
  getProducerDeliveryWorkflowPreset,
  getProducerClientContributionTasks,
  PRODUCER_CONTENT_CALENDAR_STATUS_LABELS,
  getProducerOverlayFormatProfile,
  resolveProducerBrandLogoVariant,
  getProducerStrategySnapshot,
  normalizeProducerProjectPlanning,
  getClientVisibleProducerWorkspaceNavigation,
  normalizeProducerWorkspaceNavigation,
  PRODUCER_BRAND_LOGO_PLACEMENT_LABELS,
  PRODUCER_BRAND_LOGO_TIMING_LABELS,
  PRODUCER_BRAND_LOGO_TREATMENT_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS,
  PRODUCER_DELIVERY_WORKFLOW_PRESETS,
  PRODUCER_MEETING_WORKSPACE_STATUS_LABELS,
  PRODUCER_PLANNING_PHASE_LABELS,
  PRODUCER_WORKSPACE_LAYOUT_LABELS,
  PRODUCER_WORKSPACE_PAGE_PLACEMENT_LABELS,
  PRODUCER_WORKSPACE_SURFACE_COLORS,
  PRODUCER_WORKSPACE_SURFACE_LABELS,
  PRODUCER_WORKSPACE_TAB_PLACEMENT_LABELS,
} from '../../utils/producerProjectPlanning';
import {
  getAgreementClientFacingStatusSummary,
  getAgreementSignatureLabel,
  getAgreementSignatureProgress,
  getAgreementSignatureTone,
  PROJECT_AGREEMENT_STATUS_LABELS,
} from '../../utils/projectAgreements';
import {
  getAbsoluteProjectFileUrl,
  getProjectFileMetadataString,
  normalizeProjectFileRecords,
  type ProjectFileRecord,
} from '../../utils/projectFiles';
import { buildClientPortalUrl } from '../../utils/clientPortal';
import type { StoryArcNavigationFocus } from '../../utils/storyArcFocus';
import { shouldUseRoleRoomLocalFallback } from '../../utils/runtime';
import ProducerGoogleWorkspacePanel from './ProducerGoogleWorkspacePanel';
import ProducerMeetingWorkspace from './ProducerMeetingWorkspace';
import RoleRoomAgentDialog from './RoleRoomAgentDialog';
import AccountProviderLogo from './AccountProviderLogo';

interface ProducerMediaPanelProps {
  project: CastingProject;
  projectId: string;
  projectName: string;
  storyboardCount?: number;
  shotCount?: number;
  shotLists: ShotList[];
  readOnly?: boolean;
  canContributeClientInput?: boolean;
  isClientReviewerMode?: boolean;
  initialWorkspace?: ProducerWorkspaceSurfaceKey;
  initialSectionId?: string;
  initialPageId?: string;
  initialArtifactId?: string;
  onWorkspaceFocusChange?: (focus: ClientPortalWorkspaceFocus) => void;
  onOpenStoryboard?: (focus?: StoryArcNavigationFocus) => void;
  onOpenManuscript?: (focus?: StoryArcNavigationFocus) => void;
  onOpenShotList?: (focus?: StoryArcNavigationFocus) => void;
  onOpenSceneNotes?: () => void;
  onPrepareStoryboardReview?: () => void;
  onPrepareManuscriptReview?: () => void;
  onPrepareShotListReview?: () => void;
  onProjectUpdated?: (project: CastingProject) => Promise<void> | void;
  onCreateProjectFromAgent?: (draft: Partial<CastingProject>) => Promise<void> | void;
  onUnsavedStateChange?: (hasUnsaved: boolean, reason?: string) => void;
}

interface ClientMaterialDraft {
  id?: string;
  entryType: ProducerClientMaterialType;
  title: string;
  description: string;
  externalUrl: string;
  phase: ProducerPlanningPhase | '';
  linkedShotListId: string;
  linkedCalendarItemId: string;
  status: string;
  fileName: string;
  versionLabel: string;
  usageNotes: string;
  sourceLabel: string;
  priority: 'critical' | 'important' | 'reference';
  folderPath: string;
  packageName: string;
  projectFileId: string;
  projectFileDownloadUrl: string;
}

interface ClientMaterialTemplate {
  id: string;
  label: string;
  helper: string;
  draft: Pick<ClientMaterialDraft, 'entryType' | 'title' | 'description' | 'phase' | 'status' | 'fileName' | 'versionLabel' | 'usageNotes' | 'sourceLabel' | 'priority'>;
}

interface WorkspaceContextMenuState {
  targetType: 'section' | 'page';
  sectionId: string;
  pageId?: string;
  anchorPosition: {
    top: number;
    left: number;
  };
  renameValue: string;
  colorValue: string;
  layoutValue?: ProducerWorkspaceLayout;
  surfaceValue?: ProducerWorkspaceSurfaceKey;
  clientVisibleValue?: boolean;
}

interface WorkspaceSupportAction {
  id: string;
  label: string;
  variant?: 'contained' | 'outlined' | 'text';
  onClick?: () => void;
  href?: string;
}

interface WorkspaceSupportItem {
  id: string;
  title: string;
  detail?: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface WorkspaceSupportSection {
  id: string;
  title: string;
  description: string;
  items: WorkspaceSupportItem[];
  actions?: WorkspaceSupportAction[];
}

type WorkspaceSupportPriority = 'critical' | 'warning' | 'info' | 'ready';

interface WorkspaceSupportPanelState {
  title: string;
  intro: string;
  chipLabel: string;
  priority: WorkspaceSupportPriority;
  sections: WorkspaceSupportSection[];
}

interface ClientDashboardItem {
  id: string;
  title: string;
  detail: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}

interface ClientDashboardCard {
  id: string;
  title: string;
  summary: string;
  chipLabel: string;
  priority: WorkspaceSupportPriority;
  items: ClientDashboardItem[];
  action?: WorkspaceSupportAction;
}

interface VaultSecretDraft {
  label: string;
  secretType: string;
  username: string;
  secretValue: string;
  backupCode: string;
  maskedReference: string;
  expiresAt: string;
  requestReason: string;
  approvalNotes: string;
}

type BriefStepKey = 'goal' | 'audience' | 'logic' | 'foundation' | 'references' | 'contact';
type MaterialWizardStepKey = 'source' | 'details' | 'linking' | 'review';
type MaterialsMode = 'capture' | 'library';

const MOBILE_WORKSPACE_DRAFT_NAMESPACE = 'role-room-mobile-workspace-draft';

type MobileWorkspaceDraft = {
  intakeDraft?: ProducerClientIntake;
  activeBriefStep?: BriefStepKey;
  materialDraft?: ClientMaterialDraft;
  materialsMode?: MaterialsMode;
  updatedAt?: string;
};

const EMPTY_INTAKE: ProducerClientIntake = {
  projectGoal: '',
  deliverables: '',
  targetAudience: '',
  keyMessage: '',
  timingConstraints: '',
  brandNotes: '',
  materialOverview: '',
  referenceLinks: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  additionalNotes: '',
};

const mergePreferredStringArray = (current: string[] | undefined, incoming: string[] | undefined): string[] => (
  Array.isArray(incoming) && incoming.length > 0
    ? incoming
    : Array.isArray(current)
      ? current
      : []
);

const mapRoleRoomAgentBrandColors = (
  current: ProducerBrandGuideColor[] | undefined,
  incoming: RoleRoomAgentBrandColor[] | undefined,
): ProducerBrandGuideColor[] => {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return Array.isArray(current) ? current : [];
  }

  return incoming.map((color, index) => ({
    id: current?.[index]?.id || `brand-color-agent-${index + 1}`,
    label: color.label,
    hex: color.hex,
    usage: color.usage,
  }));
};

const EMPTY_MATERIAL_DRAFT: ClientMaterialDraft = {
  entryType: 'brief_note',
  title: '',
  description: '',
  externalUrl: '',
  phase: '',
  linkedShotListId: '',
  linkedCalendarItemId: '',
  status: 'provided',
  fileName: '',
  versionLabel: '',
  usageNotes: '',
  sourceLabel: '',
  priority: 'important',
  folderPath: '',
  packageName: '',
  projectFileId: '',
  projectFileDownloadUrl: '',
};

const MATERIAL_TYPE_LABELS: Record<ProducerClientMaterialType, string> = {
  brief_note: 'Briefnotat',
  asset_link: 'Lenke til materiale',
  brand_asset: 'Merkevarefil',
  reference: 'Referanse',
  document: 'Dokument',
  feedback: 'Tilbakemelding',
};

const MATERIAL_STATUS_LABELS: Record<string, string> = {
  provided: 'Levert',
  in_review: 'Til gjennomgang',
  approved: 'Godkjent',
  outdated: 'Trenger oppdatering',
};

const formatFileSize = (value?: number | null): string => {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return 'Ukjent størrelse';
  }
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatVideoSecond = (value: number): string => {
  const safeValue = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getLogoTimingPreview = (
  brandGuide: ProducerProjectPlanning['brandGuide'],
): { start: number; end: number; total: number; label: string; detail: string } => {
  const customStart = Math.max(0, Math.floor(brandGuide.logoStartSecond ?? 0));
  const customEnd = Math.max(customStart + 1, Math.floor(brandGuide.logoEndSecond ?? customStart + 3));

  switch (brandGuide.logoTiming ?? 'outro') {
    case 'intro':
      return {
        start: 0,
        end: 3,
        total: 15,
        label: 'Intro',
        detail: 'Logoen vises i introen og tar de første 3 sekundene av videoen.',
      };
    case 'throughout':
      return {
        start: 0,
        end: 15,
        total: 15,
        label: 'Hele videoen',
        detail: 'Logoen ligger synlig gjennom hele videoen.',
      };
    case 'custom': {
      const total = Math.max(15, customEnd + 3);
      return {
        start: customStart,
        end: customEnd,
        total,
        label: `${formatVideoSecond(customStart)}-${formatVideoSecond(customEnd)}`,
        detail: `Logoen vises fra ${formatVideoSecond(customStart)} til ${formatVideoSecond(customEnd)} i videoen.`,
      };
    }
    case 'none':
      return {
        start: 0,
        end: 0,
        total: 15,
        label: 'Skjult',
        detail: 'Logoen vises ikke i denne videoen.',
      };
    case 'outro':
    default:
      return {
        start: 12,
        end: 15,
        total: 15,
        label: 'Outro',
        detail: 'Logoen vises i outroen og følger de siste 3 sekundene av videoen.',
      };
  }
};

const WORKSPACE_SUPPORT_PRIORITY_THEME: Record<WorkspaceSupportPriority, {
  label: string;
  border: string;
  panelBackground: string;
  glow: string;
  chipBackground: string;
  chipColor: string;
  itemBorder: string;
  itemBackground: string;
  actionBackground: string;
  actionColor: string;
  actionHover: string;
}> = {
  critical: {
    label: 'Haster',
    border: 'rgba(248,113,113,0.28)',
    panelBackground: 'linear-gradient(180deg, rgba(69,10,10,0.3) 0%, rgba(9,17,32,0.94) 100%)',
    glow: 'rgba(248,113,113,0.14)',
    chipBackground: 'rgba(248,113,113,0.18)',
    chipColor: '#fecaca',
    itemBorder: 'rgba(248,113,113,0.16)',
    itemBackground: 'rgba(69,10,10,0.16)',
    actionBackground: '#f97316',
    actionColor: '#111827',
    actionHover: '#ea580c',
  },
  warning: {
    label: 'Prioritet',
    border: 'rgba(251,191,36,0.24)',
    panelBackground: 'linear-gradient(180deg, rgba(68,41,8,0.28) 0%, rgba(9,17,32,0.94) 100%)',
    glow: 'rgba(251,191,36,0.12)',
    chipBackground: 'rgba(251,191,36,0.16)',
    chipColor: '#fde68a',
    itemBorder: 'rgba(251,191,36,0.14)',
    itemBackground: 'rgba(68,41,8,0.14)',
    actionBackground: '#fbbf24',
    actionColor: '#111827',
    actionHover: '#f59e0b',
  },
  info: {
    label: 'Neste',
    border: 'rgba(96,165,250,0.2)',
    panelBackground: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(9,17,32,0.94) 100%)',
    glow: 'rgba(96,165,250,0.1)',
    chipBackground: 'rgba(59,130,246,0.16)',
    chipColor: '#bfdbfe',
    itemBorder: 'rgba(96,165,250,0.12)',
    itemBackground: 'rgba(15,23,42,0.46)',
    actionBackground: '#38bdf8',
    actionColor: '#082f49',
    actionHover: '#0ea5e9',
  },
  ready: {
    label: 'Klar',
    border: 'rgba(74,222,128,0.2)',
    panelBackground: 'linear-gradient(180deg, rgba(6,46,31,0.24) 0%, rgba(9,17,32,0.94) 100%)',
    glow: 'rgba(74,222,128,0.1)',
    chipBackground: 'rgba(34,197,94,0.16)',
    chipColor: '#bbf7d0',
    itemBorder: 'rgba(74,222,128,0.12)',
    itemBackground: 'rgba(6,46,31,0.14)',
    actionBackground: '#22c55e',
    actionColor: '#052e16',
    actionHover: '#16a34a',
  },
};

const MATERIAL_PRIORITY_LABELS: Record<ClientMaterialDraft['priority'], string> = {
  critical: 'Kritisk',
  important: 'Viktig',
  reference: 'Referanse',
};

const CLIENT_MATERIAL_TEMPLATES: ClientMaterialTemplate[] = [
  {
    id: 'brand-pack',
    label: 'Logo og merkevarefiler',
    helper: 'Logo, profilmanual, fonter og godkjente brand assets.',
    draft: {
      entryType: 'brand_asset',
      title: 'Logo og merkevarefiler',
      description: 'Legg inn logo, profilmanual, fonter og andre filer som styrer uttrykket i produksjonen.',
      phase: 'preproduction',
      status: 'provided',
      fileName: 'brand-pack.zip',
      versionLabel: 'v1',
      usageNotes: 'Brukes i grafikk, lower thirds, thumbnails og leveranser.',
      sourceLabel: 'Klient',
      priority: 'critical',
    },
  },
  {
    id: 'reference-film',
    label: 'Referansefilm',
    helper: 'Eksempler på stil, pacing, stemning eller oppbygging.',
    draft: {
      entryType: 'reference',
      title: 'Referansefilm / visuell retning',
      description: 'Legg inn filmer eller eksempler som viser ønsket uttrykk, tempo eller oppbygning.',
      phase: 'preproduction',
      status: 'provided',
      fileName: '',
      versionLabel: '',
      usageNotes: 'Brukes til konsept, storyboard og shotlist.',
      sourceLabel: 'Klient',
      priority: 'important',
    },
  },
  {
    id: 'brief-note',
    label: 'Kort briefnotat',
    helper: 'Kjernepunkter om mål, leveranse og budskap.',
    draft: {
      entryType: 'brief_note',
      title: 'Kort briefnotat',
      description: 'Oppsummer mål, leveranser, budskap og eventuelle avgrensninger som produsenten må ta hensyn til.',
      phase: 'preproduction',
      status: 'provided',
      fileName: '',
      versionLabel: '',
      usageNotes: 'Brukes som beslutningsgrunnlag i planleggingen.',
      sourceLabel: 'Klient',
      priority: 'critical',
    },
  },
  {
    id: 'product-docs',
    label: 'Dokumentasjon og krav',
    helper: 'Produktark, HMS-krav, fakta eller annet faggrunnlag.',
    draft: {
      entryType: 'document',
      title: 'Dokumentasjon og prosjektkrav',
      description: 'Legg inn produktark, prosedyrer, HMS-krav, talepunkter eller annen dokumentasjon produksjonen skal bygge på.',
      phase: 'preproduction',
      status: 'provided',
      fileName: 'grunnlagsdokumenter.pdf',
      versionLabel: 'v1',
      usageNotes: 'Brukes i manus, scene-notater og kvalitetssikring.',
      sourceLabel: 'Klient',
      priority: 'important',
    },
  },
  {
    id: 'location-practicals',
    label: 'Praktisk info',
    helper: 'Lokasjon, tilgang, kontaktpunkt og logistikk.',
    draft: {
      entryType: 'document',
      title: 'Praktisk informasjon for opptaksdag',
      description: 'Legg inn lokasjon, tilganger, sikkerhetskrav, parkering, kontaktpersoner og annen praktisk info.',
      phase: 'production',
      status: 'provided',
      fileName: 'praktisk-info.pdf',
      versionLabel: 'v1',
      usageNotes: 'Brukes på produksjonsdagen og i tidslinjen.',
      sourceLabel: 'Klient',
      priority: 'important',
    },
  },
  {
    id: 'approval-feedback',
    label: 'Tilbakemelding',
    helper: 'Klientsvar på utkast, leveranser eller ønskede endringer.',
    draft: {
      entryType: 'feedback',
      title: 'Klienttilbakemelding',
      description: 'Skriv inn endringer, godkjenninger eller kommentarer til pågående arbeid.',
      phase: 'postproduction',
      status: 'in_review',
      fileName: '',
      versionLabel: '',
      usageNotes: 'Brukes til revisjoner og endelig levering.',
      sourceLabel: 'Klient',
      priority: 'important',
    },
  },
];

const WORKSPACE_COLOR_OPTIONS = ['#38bdf8', '#fbbf24', '#a855f7', '#22c55e', '#fb7185', '#f97316', '#14b8a6', '#94a3b8'];
const ACCOUNT_ACCESS_PLATFORM_ORDER: ProducerAccountAccessPlatform[] = ['google', 'meta', 'linkedin', 'youtube', 'tiktok'];
const PRODUCER_WORKSPACE_SURFACE_VALUES: ProducerWorkspaceSurfaceKey[] = [
  'brief',
  'materials',
  'storyboard',
  'manuscript',
  'shotlist',
  'brand',
  'accounts',
  'delivery',
  'meetings',
];

const isProducerWorkspaceSurfaceKey = (value: unknown): value is ProducerWorkspaceSurfaceKey => (
  typeof value === 'string'
  && PRODUCER_WORKSPACE_SURFACE_VALUES.includes(value as ProducerWorkspaceSurfaceKey)
);

const getWorkspaceSurfaceIcon = (surface: ProducerWorkspaceSurfaceKey) => {
  if (surface === 'materials') {
    return <PermMediaIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'storyboard') {
    return <SpaceDashboardOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'manuscript') {
    return <ArticleOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'shotlist') {
    return <GridViewOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'brand') {
    return <PaletteOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'accounts') {
    return <HubOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'delivery') {
    return <FactCheckOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'meetings') {
    return <VideoCallOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  return <ArticleOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
};

const getWorkspaceSurfaceDescription = (
  surface: ProducerWorkspaceSurfaceKey,
  isClientReviewerMode: boolean,
): string => {
  if (surface === 'materials') {
    return isClientReviewerMode
      ? 'Referanser, dokumenter, merkevarefiler og eksisterende materiale.'
      : 'Referanser, dokumenter, brand assets og tilbakemeldinger.';
  }
  if (surface === 'brand') {
    return isClientReviewerMode
      ? 'Logo, farger, fonter og uttrykk som skal styre leveransene.'
      : 'Logo, farger, fonter og visuell retning.';
  }
  if (surface === 'storyboard') {
    return isClientReviewerMode
      ? 'Oversikt over storyboardet og et sted for inspirasjoner, referanser og visuelle innspill.'
      : 'Scenevis storyboard med klientinspirasjoner og framekontekst.';
  }
  if (surface === 'manuscript') {
    return isClientReviewerMode
      ? 'Les manus og skriv forslag til endringer uten å redigere originalteksten direkte.'
      : 'Samle manuslesning, klientforslag og neste omskrivninger på ett sted.';
  }
  if (surface === 'shotlist') {
    return isClientReviewerMode
      ? 'En ryddig, lesbar oversikt over planlagte shots, scene og sted uten produksjonsstøy.'
      : 'Klientvennlig shotlistoversikt som speiler scene- og storyboarddekning.';
  }
  if (surface === 'accounts') {
    return isClientReviewerMode
      ? 'Trygg tilgangsstyring med OAuth, invite og klientstyrte bekreftelser.'
      : 'Vedvarende konto- og publiseringstilgang uten delte passord.';
  }
  if (surface === 'delivery') {
    return isClientReviewerMode
      ? 'Hvordan dere vil motta filer, mapper, versjoner og finaler.'
      : 'Filnavn, versjoner, mapper, final/draft og backup.';
  }
  if (surface === 'meetings') {
    return isClientReviewerMode
      ? 'Agenda, klientsync, beslutninger og oppfølging i samme flate.'
      : 'Møteagenda, live-notater, beslutninger og oppfølging.';
  }
  return isClientReviewerMode
    ? 'Mål, leveranser, målgruppe og timing for produsenten.'
    : 'Mål, målgruppe, budskap og timing.';
};

const hasText = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim().length > 0;

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const readFirstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const EMAIL_ADDRESS_PATTERN = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

const readEmailAddress = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const match = trimmed.match(EMAIL_ADDRESS_PATTERN);
  return match?.[1]?.trim() ?? '';
};

interface AccountAccessPlatformFlowConfig {
  primaryLabel: string;
  primaryHref: string;
  primaryDescription: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

const ACCOUNT_ACCESS_PLATFORM_FLOW_CONFIG: Record<ProducerAccountAccessPlatform, AccountAccessPlatformFlowConfig> = {
  google: {
    primaryLabel: 'Google Workspace',
    primaryHref: '',
    primaryDescription: 'Drive, Kalender og Meet brukes automatisk som del av prosjektflyten.',
  },
  meta: {
    primaryLabel: 'Åpne Meta Business',
    primaryHref: 'https://business.facebook.com/latest/settings/people',
    primaryDescription: 'Kontoeier gir tilgang fra Meta Business Settings, ikke med delt passord.',
    secondaryLabel: 'Meta Business-hjelp',
    secondaryHref: 'https://www.facebook.com/business/help',
  },
  linkedin: {
    primaryLabel: 'Åpne LinkedIn-hjelp',
    primaryHref: 'https://www.linkedin.com/help/linkedin',
    primaryDescription: 'Sideeier må gi admin- eller super admin-tilgang i LinkedIn Page admin.',
  },
  youtube: {
    primaryLabel: 'Åpne YouTube Studio',
    primaryHref: 'https://studio.youtube.com',
    primaryDescription: 'Kanalrettigheter eller Brand Account-roller gis i YouTube Studio, ikke via delt Google-login.',
    secondaryLabel: 'YouTube-hjelp',
    secondaryHref: 'https://support.google.com/youtube/',
  },
  tiktok: {
    primaryLabel: 'Åpne TikTok Business Center',
    primaryHref: 'https://business.tiktok.com',
    primaryDescription: 'Inviter bruker eller partner fra TikTok Business Center i stedet for å dele konto.',
    secondaryLabel: 'TikTok-hjelp',
    secondaryHref: 'https://business.tiktok.com/help',
  },
};

const ACCOUNT_ACCESS_SECRET_PATTERN = /(?:passord|password|pwd|api(?:\s|-)?key|access(?:\s|-)?token|refresh(?:\s|-)?token|secret|backup(?:\s|-)?code|recovery(?:\s|-)?code|gjenopprettingskode|2fa|otp)\s*[:=]\s*\S+/i;
const ACCOUNT_ACCESS_TOKEN_PATTERN = /\b(?:ghp_[A-Za-z0-9]{20,}|sk_(?:live|test)_[A-Za-z0-9]+|AIza[0-9A-Za-z\-_]{20,}|ya29\.[0-9A-Za-z\-_]+)\b/;

const detectAccountAccessSecret = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (ACCOUNT_ACCESS_SECRET_PATTERN.test(trimmed) || ACCOUNT_ACCESS_TOKEN_PATTERN.test(trimmed)) {
    return 'Dette feltet ser ut til å inneholde en hemmelighet. Bruk sikker deling eller maskert referanse i stedet for rå credentials.';
  }
  return null;
};

const parseAccountAccessRoleTargets = (value: string): ProducerAccountAccessRoleTarget[] => {
  const next = new Set<ProducerAccountAccessRoleTarget>();
  value
    .split(/[,\n]/u)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .forEach((entry) => {
      if (entry === 'klienteier' || entry === 'client owner' || entry === 'client_owner') {
        next.add('client_owner');
      } else if (entry === 'innholdsprodusent' || entry === 'producer') {
        next.add('producer');
      } else if (entry === 'editor' || entry === 'klipper') {
        next.add('editor');
      } else if (entry === 'some-ansvarlig' || entry === 'social media manager' || entry === 'social_media_manager' || entry === 'sosiale medier') {
        next.add('social_media_manager');
      } else if (entry === 'administrator' || entry === 'admin') {
        next.add('admin');
      }
    });
  return Array.from(next);
};

const stringifyAccountAccessRoleTargets = (value: ProducerAccountAccessRoleTarget[] | undefined): string => (
  Array.isArray(value)
    ? value
      .map((entry) => PRODUCER_ACCOUNT_ACCESS_ROLE_TARGET_LABELS[entry] ?? entry)
      .join(', ')
    : ''
);

const toDateTimeLocalValue = (value: string | undefined): string => {
  if (!hasText(value)) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const fromDateTimeLocalValue = (value: string): string | undefined => {
  if (!hasText(value)) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

const VAULT_REVEAL_REQUEST_STATUS_LABELS: Record<RoleRoomAccessVaultRevealRequest['status'], string> = {
  pending: 'Venter på godkjenning',
  approved: 'Godkjent for innsyn',
  rejected: 'Avvist',
  revealed: 'Åpnet én gang',
  expired: 'Utløpt',
};

const VAULT_AUDIT_ACTION_LABELS: Record<string, string> = {
  secret_saved: 'Secret lagret',
  secret_revoked: 'Secret tilbakekalt',
  reveal_requested: 'Innsyn bedt om',
  reveal_approved: 'Innsyn godkjent',
  reveal_rejected: 'Innsyn avvist',
  secret_revealed: 'Secret åpnet',
};

const EMPTY_VAULT_SECRET_DRAFT: VaultSecretDraft = {
  label: '',
  secretType: '',
  username: '',
  secretValue: '',
  backupCode: '',
  maskedReference: '',
  expiresAt: '',
  requestReason: '',
  approvalNotes: '',
};

const readPlanningMomentIdFromReview = (review: ProducerClientReview): string | null => {
  const metadata = asRecord(review.metadata);
  return readFirstNonEmptyString(metadata.planningMomentId, review.target_entity_id) || null;
};

const normalizeAccountAccessPlatform = (value: unknown): ProducerAccountAccessPlatform | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized in PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS) {
    return normalized as ProducerAccountAccessPlatform;
  }
  return null;
};

const readAccountAccessPlatformsFromReview = (review: ProducerClientReview): ProducerAccountAccessPlatform[] => {
  const metadata = asRecord(review.metadata);
  const platforms = new Set<ProducerAccountAccessPlatform>();
  const candidates = [
    metadata.accountAccessPlatforms,
    metadata.account_access_platforms,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    candidate.forEach((value) => {
      const platform = normalizeAccountAccessPlatform(value);
      if (platform) {
        platforms.add(platform);
      }
    });
  }

  const directPlatform = normalizeAccountAccessPlatform(
    readFirstNonEmptyString(metadata.accountAccessPlatform, metadata.account_access_platform),
  );
  if (directPlatform) {
    platforms.add(directPlatform);
  }

  const platformFromMomentId = getProducerAccountAccessPlatformFromMomentId(readPlanningMomentIdFromReview(review));
  if (platformFromMomentId) {
    platforms.add(platformFromMomentId);
  }

  return Array.from(platforms);
};

const parseLineSeparatedValues = (value: string): string[] => (
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
);

const stringifyLineSeparatedValues = (value: string[] | undefined): string => (
  Array.isArray(value) ? value.join('\n') : ''
);

const normalizeColorHex = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};

const getInitials = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  const parts = trimmed.split(/\s+/u).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || fallback;
};

const stringifyBrandColors = (colors: ProducerBrandGuideColor[] | undefined): string => (
  Array.isArray(colors)
    ? colors
      .map((color) => [color.label, color.hex, color.usage].filter(hasText).join(' | '))
      .join('\n')
    : ''
);

const parseBrandColors = (value: string): ProducerBrandGuideColor[] => (
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map<ProducerBrandGuideColor | null>((entry, index) => {
      const [labelPart = '', hexPart = '', usagePart = ''] = entry.split('|').map((segment) => segment.trim());
      const label = labelPart;
      const hex = normalizeColorHex(hexPart);
      if (!label || !hex) {
        return null;
      }
      return {
        id: `brand-color-${index + 1}`,
        label,
        hex,
        usage: usagePart || undefined,
      };
    })
    .filter((entry): entry is ProducerBrandGuideColor => entry !== null)
);

const rgbToHex = (red: number, green: number, blue: number): string => `#${[red, green, blue]
  .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
  .join('')}`;

const getColorLuminance = (hex: string): number => {
  const normalized = normalizeColorHex(hex).replace('#', '');
  if (normalized.length !== 6) {
    return 0;
  }
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255;
};

const getColorDistance = (leftHex: string, rightHex: string): number => {
  const parseHex = (hex: string): [number, number, number] => {
    const normalized = normalizeColorHex(hex).replace('#', '');
    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
    ];
  };
  const [leftRed, leftGreen, leftBlue] = parseHex(leftHex);
  const [rightRed, rightGreen, rightBlue] = parseHex(rightHex);
  const redDistance = leftRed - rightRed;
  const greenDistance = leftGreen - rightGreen;
  const blueDistance = leftBlue - rightBlue;
  return Math.sqrt((redDistance ** 2) + (greenDistance ** 2) + (blueDistance ** 2));
};

const getBrandLogoMarkTypeLabel = (value?: ProducerBrandLogoDetection['markType']): string => {
  if (value === 'wordmark') {
    return 'Ordmerke';
  }
  if (value === 'symbol') {
    return 'Symbol';
  }
  if (value === 'combination') {
    return 'Kombinasjonslogo';
  }
  return 'Ukjent';
};

const BRAND_LOGO_VARIANT_ORDER: ProducerBrandLogoVariantType[] = ['primary', 'light', 'dark', 'icon'];

const BRAND_LOGO_VARIANT_LABELS: Record<ProducerBrandLogoVariantType, string> = {
  primary: 'Primær',
  light: 'Lys',
  dark: 'Mørk',
  icon: 'Ikon',
};

const BRAND_LOGO_VARIANT_HELPERS: Record<ProducerBrandLogoVariantType, string> = {
  primary: 'Hovedlogoen som normalt brukes i preview, overlevering og produksjon.',
  light: 'Brukes når logoen må stå lyst mot mørkere flater eller videobakgrunner.',
  dark: 'Brukes når logoen må stå mørkt mot lyse flater eller videobakgrunner.',
  icon: 'Brukes når formatet trenger et kompakt symbol i stedet for full logo.',
};

const syncBrandGuideWithLogoVariant = (
  brandGuide: ProducerProjectPlanning['brandGuide'],
  variant: Pick<ProducerBrandLogoVariant, 'type' | 'logoUrl' | 'detection'>,
): ProducerProjectPlanning['brandGuide'] => ({
  ...brandGuide,
  activeLogoVariantType: variant.type,
  logoUrl: variant.logoUrl ?? brandGuide.logoUrl,
  logoDetection: variant.detection ?? brandGuide.logoDetection,
});

const getBrandPreviewPlacementFromPointer = (
  xRatio: number,
  yRatio: number,
): NonNullable<ProducerProjectPlanning['brandGuide']['logoPlacement']> => {
  const clampedX = Math.max(0, Math.min(1, xRatio));
  const clampedY = Math.max(0, Math.min(1, yRatio));
  if (clampedX >= 0.34 && clampedX <= 0.66 && clampedY >= 0.3 && clampedY <= 0.7) {
    return 'center';
  }
  if (clampedX < 0.5 && clampedY < 0.5) {
    return 'top_left';
  }
  if (clampedX >= 0.5 && clampedY < 0.5) {
    return 'top_right';
  }
  if (clampedX < 0.5 && clampedY >= 0.5) {
    return 'bottom_left';
  }
  return 'bottom_right';
};

const loadImageFromObjectUrl = (objectUrl: string): Promise<HTMLImageElement> => (
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Kunne ikke lese logofilen som bilde.'));
    image.src = objectUrl;
  })
);

const analyzeBrandLogoFile = async (file: File): Promise<ProducerBrandLogoDetection> => {
  if (typeof document === 'undefined') {
    return {
      sourceFileName: file.name,
      note: 'Logoanalysen er bare tilgjengelig i nettleseren.',
      detectedAt: new Date().toISOString(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const canvas = document.createElement('canvas');
    const maxDimension = 240;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight, 1));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Canvas er ikke tilgjengelig for logoanalyse.');
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>();

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let opaquePixelCount = 0;
    let translucentPixelCount = 0;

    for (let index = 0; index < imageData.data.length; index += 4) {
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];
      const alpha = imageData.data[index + 3];
      if (alpha < 18) {
        continue;
      }

      const pixelIndex = index / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      opaquePixelCount += 1;
      if (alpha < 250) {
        translucentPixelCount += 1;
      }

      const quantizedRed = Math.floor(red / 24) * 24;
      const quantizedGreen = Math.floor(green / 24) * 24;
      const quantizedBlue = Math.floor(blue / 24) * 24;
      const bucketKey = `${quantizedRed}-${quantizedGreen}-${quantizedBlue}`;
      const bucket = buckets.get(bucketKey) ?? { count: 0, red: 0, green: 0, blue: 0 };
      bucket.count += 1;
      bucket.red += red;
      bucket.green += green;
      bucket.blue += blue;
      buckets.set(bucketKey, bucket);
    }

    const boundsWidth = opaquePixelCount > 0 ? Math.max(1, maxX - minX + 1) : width;
    const boundsHeight = opaquePixelCount > 0 ? Math.max(1, maxY - minY + 1) : height;
    const aspectRatio = boundsWidth / Math.max(1, boundsHeight);
    const markType: ProducerBrandLogoDetection['markType'] = aspectRatio >= 2.35
      ? 'wordmark'
      : aspectRatio <= 1.15
        ? 'symbol'
        : 'combination';
    const hasTransparency = translucentPixelCount > 0 || opaquePixelCount < (width * height * 0.92);
    const dominantColors = Array.from(buckets.values())
      .sort((left, right) => right.count - left.count)
      .map((bucket) => rgbToHex(bucket.red / bucket.count, bucket.green / bucket.count, bucket.blue / bucket.count))
      .filter((hex, colorIndex, colors) => colors.findIndex((candidate) => getColorDistance(candidate, hex) < 18) === colorIndex)
      .slice(0, 3)
      .map((hex, colorIndex) => ({
        id: `detected-brand-color-${colorIndex + 1}`,
        label: colorIndex === 0 ? 'Primærfarge' : colorIndex === 1 ? 'Sekundærfarge' : 'Accent',
        hex,
        usage: colorIndex === 0 ? 'Brukes i logo og hovedmarkeringer.' : colorIndex === 1 ? 'Brukes i sekundære flater og bakplater.' : 'Brukes i små detaljer eller CTA-er.',
      }));
    const primaryLuminance = dominantColors[0] ? getColorLuminance(dominantColors[0].hex) : 0.5;
    const suggestedTreatment = !hasTransparency
      ? 'badge'
      : primaryLuminance > 0.82
        ? 'badge'
        : 'clean';
    const suggestedPlacement = markType === 'symbol' ? 'top_right' : 'bottom_right';
    const suggestedTiming = suggestedTreatment === 'badge' ? 'outro' : markType === 'symbol' ? 'throughout' : 'outro';
    const suggestedOpacityPercent = suggestedTreatment === 'badge'
      ? 100
      : suggestedTiming === 'throughout'
        ? 38
        : 86;
    const suggestedSafeZoneHorizontalPercent = markType === 'wordmark' ? 9 : markType === 'combination' ? 8 : 7;
    const suggestedSafeZoneVerticalPercent = markType === 'wordmark' ? 7 : 8;
    const suggestedMarginPixelsAt1080 = markType === 'wordmark' ? 88 : 72;
    const note = [
      hasTransparency ? 'Transparent logo gjør ren overlay mulig.' : 'Logoen trenger bakplate eller badge for trygg kontrast.',
      markType === 'wordmark'
        ? 'Bred logo får mest luft nederst i rammen.'
        : markType === 'symbol'
          ? 'Kompakt logo tåler mindre footprint og kan ligge høyere i formatet.'
          : 'Kombinasjonslogo trenger litt ekstra safe zone og ro rundt seg.',
    ].join(' ');

    return {
      sourceFileName: file.name,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      aspectRatioLabel: `${boundsWidth}:${boundsHeight}`,
      markType,
      hasTransparency,
      dominantColors,
      suggestedPlacement,
      suggestedTiming,
      suggestedTreatment,
      suggestedOpacityPercent,
      suggestedSafeZoneHorizontalPercent,
      suggestedSafeZoneVerticalPercent,
      suggestedMarginPixelsAt1080,
      note,
      detectedAt: new Date().toISOString(),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const formatTimestamp = (value?: string): string => {
  if (!value) {
    return 'Ikke lagret ennå';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const extractWorkspacePhrases = (...values: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    if (!hasText(value)) {
      continue;
    }
    for (const rawPart of value.split(/[\n,.;•]+/u)) {
      const part = rawPart.trim();
      if (!part || part.length > 56) {
        continue;
      }
      unique.add(part);
      if (unique.size >= 8) {
        return Array.from(unique);
      }
    }
  }
  return Array.from(unique);
};

interface WorkspaceShowcaseTile {
  id: string;
  eyebrow: string;
  title: string;
  meta: string;
  storyArcFocus?: StoryArcNavigationFocus;
}

const getShotListLabel = (shotList: ShotList): string => (
  shotList.sceneName?.trim() || shotList.sceneId || shotList.id
);

const getSceneDisplayLabel = (
  scene: NonNullable<CastingProject['sceneBreakdowns']>[number],
): string => {
  const sceneNumber = scene.sceneNumber !== undefined && scene.sceneNumber !== null
    ? String(scene.sceneNumber).trim()
    : '';
  const sceneTitle = readFirstNonEmptyString(scene.sceneName, scene.sceneHeading, scene.heading, scene.id);
  const prefix = sceneNumber ? `Scene ${sceneNumber}` : 'Scene';
  return sceneTitle ? `${prefix} · ${sceneTitle}` : prefix;
};

const getStoryboardFrameDisplayLabel = (
  frame: NonNullable<NonNullable<CastingProject['sceneBreakdowns']>[number]['storyboardFrames']>[number],
  index: number,
): string => (
  readFirstNonEmptyString(frame.title, frame.description, `Frame ${index + 1}`)
);

interface ParsedMaterialMetadata {
  fileName: string;
  versionLabel: string;
  usageNotes: string;
  sourceLabel: string;
  priority: ClientMaterialDraft['priority'];
  linkedCalendarItemId: string;
  folderPath: string;
  packageName: string;
  projectFileId: string;
  projectFileDownloadUrl: string;
}

interface WorkspaceContributionMetadata {
  workspaceSurface: ProducerWorkspaceSurfaceKey | null;
  manuscriptId: string;
  sceneId: string;
  storyboardFrameId: string;
  rationale: string;
}

interface ManuscriptSuggestionDraft {
  manuscriptId: string;
  sceneId: string;
  title: string;
  suggestion: string;
  rationale: string;
}

interface StoryboardInspirationDraft {
  sceneId: string;
  storyboardFrameId: string;
  title: string;
  note: string;
  externalUrl: string;
}

interface DeliveryWorkspaceAssetSummary {
  latestPackage: ProjectFileRecord | null;
  workspaceFiles: ProjectFileRecord[];
  legalAgreements: ProjectAgreement[];
  googleArtifacts: RoleRoomGoogleArtifactRef[];
}

const LOCAL_PROJECT_AGREEMENTS_NAMESPACE = 'role-room-project-agreements';

interface WorkspaceArtifactFocus {
  artifactId: string;
  surface: ProducerWorkspaceSurfaceKey;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionUrl?: string;
}

const parseMaterialMetadata = (material: ProducerClientMaterial): ParsedMaterialMetadata => {
  const metadata = asRecord(material.metadata);
  const rawPriority = readFirstNonEmptyString(metadata.priority);
  return {
    fileName: readFirstNonEmptyString(metadata.fileName, metadata.filename),
    versionLabel: readFirstNonEmptyString(metadata.versionLabel, metadata.version),
    usageNotes: readFirstNonEmptyString(metadata.usageNotes, metadata.usage),
    sourceLabel: readFirstNonEmptyString(metadata.sourceLabel, metadata.source),
    priority: rawPriority === 'critical' || rawPriority === 'reference' ? rawPriority : 'important',
    linkedCalendarItemId: readFirstNonEmptyString(metadata.linkedCalendarItemId, metadata.calendarItemId),
    folderPath: readFirstNonEmptyString(metadata.folderPath),
    packageName: readFirstNonEmptyString(metadata.packageName),
    projectFileId: readFirstNonEmptyString(metadata.projectFileId),
    projectFileDownloadUrl: readFirstNonEmptyString(metadata.projectFileDownloadUrl),
  };
};

const parseWorkspaceContributionMetadata = (material: ProducerClientMaterial): WorkspaceContributionMetadata => {
  const metadata = asRecord(material.metadata);
  return {
    workspaceSurface: isProducerWorkspaceSurfaceKey(metadata.workspaceSurface)
      ? metadata.workspaceSurface
      : isProducerWorkspaceSurfaceKey(metadata.surface)
        ? metadata.surface
        : null,
    manuscriptId: readFirstNonEmptyString(metadata.manuscriptId),
    sceneId: readFirstNonEmptyString(metadata.sceneId),
    storyboardFrameId: readFirstNonEmptyString(metadata.storyboardFrameId, metadata.frameId),
    rationale: readFirstNonEmptyString(metadata.rationale, metadata.why),
  };
};

const getSurfaceForMaterial = (material: ProducerClientMaterial): ProducerWorkspaceSurfaceKey => {
  const contributionMetadata = parseWorkspaceContributionMetadata(material);
  if (contributionMetadata.workspaceSurface) {
    return contributionMetadata.workspaceSurface;
  }
  return material.entry_type === 'brand_asset' ? 'brand' : 'materials';
};

const getSurfaceForProjectFile = (file: ProjectFileRecord): ProducerWorkspaceSurfaceKey => {
  const source = getProjectFileMetadataString(file, 'source');
  const entryType = getProjectFileMetadataString(file, 'entryType');
  const configuredSurface = getProjectFileMetadataString(file, 'workspaceSurface', 'surface');
  if (isProducerWorkspaceSurfaceKey(configuredSurface)) {
    return configuredSurface;
  }
  if (source === 'role_room_client_material') {
    return entryType === 'brand_asset' ? 'brand' : 'materials';
  }
  if (source === 'role_room_meeting_workspace') {
    return 'meetings';
  }
  if (source === 'role_room_client_handoff_package' || source === 'role_room_delivery_workspace' || source.startsWith('role_room_delivery')) {
    return 'delivery';
  }
  return 'brief';
};

const findAgreementArtifact = (
  artifacts: RoleRoomGoogleArtifactRef[],
  artifactId?: string | null,
): RoleRoomGoogleArtifactRef | null => {
  if (!artifactId) {
    return null;
  }
  return artifacts.find((artifact) => artifact.id === artifactId) ?? null;
};

const resolveWorkspaceFocusArtifact = (
  artifactId: string,
  planning: ProducerProjectPlanning,
  materials: ProducerClientMaterial[],
  projectFiles: ProjectFileRecord[],
  agreements: ProjectAgreement[],
  googleArtifacts: RoleRoomGoogleArtifactRef[],
): WorkspaceArtifactFocus | null => {
  const normalizedArtifactId = artifactId.trim();
  if (!normalizedArtifactId) {
    return null;
  }

  const explicitAgreementId = normalizedArtifactId.startsWith('agreement:')
    ? normalizedArtifactId.slice('agreement:'.length).trim()
    : null;

  const matchedArtifact = googleArtifacts.find((artifact) => artifact.id === normalizedArtifactId);
  if (matchedArtifact?.localEntityType === 'project_agreement') {
    const linkedAgreement = agreements.find((agreement) => agreement.id === matchedArtifact.localEntityId);
    if (linkedAgreement) {
      return {
        artifactId: normalizedArtifactId,
        surface: 'delivery',
        title: linkedAgreement.title,
        subtitle: `${linkedAgreement.counterparty_name} · ${linkedAgreement.google_signature ? getAgreementSignatureLabel(linkedAgreement.google_signature) : PROJECT_AGREEMENT_STATUS_LABELS[linkedAgreement.status]}`,
        actionLabel: matchedArtifact.webViewUrl ? 'Åpne dokument' : undefined,
        actionUrl: matchedArtifact.webViewUrl ?? matchedArtifact.webContentLink ?? undefined,
      };
    }
  }

  const matchedAgreement = agreements.find((agreement) => (
    agreement.id === normalizedArtifactId || agreement.id === explicitAgreementId
  ));
  if (matchedAgreement) {
    const signedPdfArtifact = findAgreementArtifact(
      googleArtifacts,
      matchedAgreement.google_signature?.signedPdfArtifactId ?? null,
    );
    const pdfSnapshotArtifact = findAgreementArtifact(
      googleArtifacts,
      matchedAgreement.google_signature?.pdfSnapshotArtifactId ?? null,
    );
    const auditArtifact = findAgreementArtifact(
      googleArtifacts,
      matchedAgreement.google_signature?.auditArtifactId ?? null,
    );
    return {
      artifactId: explicitAgreementId ? `agreement:${matchedAgreement.id}` : normalizedArtifactId,
      surface: 'delivery',
      title: matchedAgreement.title,
      subtitle: `${matchedAgreement.counterparty_name} · ${matchedAgreement.google_signature ? getAgreementSignatureLabel(matchedAgreement.google_signature) : PROJECT_AGREEMENT_STATUS_LABELS[matchedAgreement.status]}`,
      actionLabel: signedPdfArtifact?.webViewUrl || pdfSnapshotArtifact?.webViewUrl || matchedAgreement.google_signature?.requestUrl
        ? 'Åpne juridisk dokument'
        : auditArtifact?.webViewUrl
          ? 'Åpne signaturspor'
          : undefined,
      actionUrl: signedPdfArtifact?.webViewUrl
        ?? pdfSnapshotArtifact?.webViewUrl
        ?? matchedAgreement.google_signature?.requestUrl
        ?? matchedAgreement.google_signature?.webViewUrl
        ?? auditArtifact?.webViewUrl
        ?? undefined,
    };
  }

  const matchedMaterial = materials.find((material) => {
    const metadata = parseMaterialMetadata(material);
    return material.id === normalizedArtifactId || metadata.projectFileId === normalizedArtifactId;
  });

  if (matchedMaterial) {
    const metadata = parseMaterialMetadata(matchedMaterial);
    return {
      artifactId: normalizedArtifactId,
      surface: getSurfaceForMaterial(matchedMaterial),
      title: matchedMaterial.title,
      subtitle: matchedMaterial.description?.trim()
        || metadata.usageNotes
        || 'Fokusert fra delt arbeidsflate.',
      actionLabel: metadata.projectFileDownloadUrl || matchedMaterial.external_url ? 'Åpne kilde' : undefined,
      actionUrl: metadata.projectFileDownloadUrl || matchedMaterial.external_url || undefined,
    };
  }

  const matchedFile = projectFiles.find((file) => file.id === normalizedArtifactId);
  if (matchedFile) {
    return {
      artifactId: normalizedArtifactId,
      surface: getSurfaceForProjectFile(matchedFile),
      title: matchedFile.name,
      subtitle: getProjectFileMetadataString(matchedFile, 'folderPath', 'packageName') || 'Fokusert prosjektfil fra delt arbeidsflate.',
      actionLabel: matchedFile.downloadUrl ? 'Åpne fil' : undefined,
      actionUrl: getAbsoluteProjectFileUrl(matchedFile.downloadUrl) || undefined,
    };
  }

  if (normalizedArtifactId === 'brief-summary') {
    return {
      artifactId: normalizedArtifactId,
      surface: 'brief',
      title: 'Brief-sammendrag',
      subtitle: 'Generert prosjektretning synket fra arbeidsflaten.',
    };
  }

  if (normalizedArtifactId === 'client-materials') {
    return {
      artifactId: normalizedArtifactId,
      surface: 'materials',
      title: 'Materialgrunnlag',
      subtitle: 'Samlet klientmateriale og innspill.',
    };
  }

  if (normalizedArtifactId === 'brand-guide') {
    return {
      artifactId: normalizedArtifactId,
      surface: 'brand',
      title: 'Merkevareguide',
      subtitle: 'Logo, farger, fonter og føringer for prosjektet.',
    };
  }

  if (normalizedArtifactId === 'delivery-manifest' || normalizedArtifactId === 'approval-queue') {
    return {
      artifactId: normalizedArtifactId,
      surface: 'delivery',
      title: normalizedArtifactId === 'delivery-manifest' ? 'Leveringsmanifest' : 'Godkjenningskø',
      subtitle: 'Fokusert fra delt arbeidsflate.',
    };
  }

  if (normalizedArtifactId === 'meeting-workspace') {
    return {
      artifactId: normalizedArtifactId,
      surface: 'meetings',
      title: 'Møteworkspace',
      subtitle: 'Agenda, beslutninger og oppfølging for klientsyncen.',
    };
  }

  if (normalizedArtifactId.startsWith('meeting-decision:')) {
    const meetingDecisionId = normalizedArtifactId.slice('meeting-decision:'.length).trim();
    const meetingDecision = planning.meetingWorkspace.decisions.find((item) => item.id === meetingDecisionId);
    if (meetingDecision) {
      return {
        artifactId: normalizedArtifactId,
        surface: 'meetings',
        title: meetingDecision.title,
        subtitle: meetingDecision.clientVisible
          ? 'Klientsynlig møtebeslutning.'
          : 'Intern møtebeslutning.',
      };
    }
  }

  if (normalizedArtifactId.startsWith('meeting-follow-up:')) {
    const followUpId = normalizedArtifactId.slice('meeting-follow-up:'.length).trim();
    const followUp = planning.meetingWorkspace.followUps.find((item) => item.id === followUpId);
    if (followUp) {
      return {
        artifactId: normalizedArtifactId,
        surface: 'meetings',
        title: followUp.title,
        subtitle: followUp.notes?.trim() || 'Oppfølgingspunkt fra møteworkspace.',
      };
    }
  }

  return null;
};

const toMaterialDraft = (material: ProducerClientMaterial): ClientMaterialDraft => {
  const metadata = parseMaterialMetadata(material);
  return {
    ...metadata,
    id: material.id,
    entryType: material.entry_type,
    title: material.title,
    description: material.description ?? '',
    externalUrl: material.external_url ?? '',
    phase: material.phase ?? '',
    linkedShotListId: material.linked_shot_list_id ?? '',
    linkedCalendarItemId: metadata.linkedCalendarItemId,
    status: material.status ?? 'provided',
    folderPath: metadata.folderPath,
    packageName: metadata.packageName,
    projectFileId: metadata.projectFileId,
    projectFileDownloadUrl: metadata.projectFileDownloadUrl,
  };
};

const sortPagesByParent = (
  pages: ProducerWorkspacePage[],
  parentPageId: string | null,
): ProducerWorkspacePage[] => (
  pages
    .filter((page) => (page.parentPageId ?? null) === parentPageId)
    .sort((left, right) => {
      const orderDifference = (left.order ?? 0) - (right.order ?? 0);
      if (orderDifference !== 0) {
        return orderDifference;
      }
      return left.title.localeCompare(right.title, 'nb-NO');
    })
);

const normalizePageOrders = (pages: ProducerWorkspacePage[]): ProducerWorkspacePage[] => {
  const nextPages = [...pages];
  const assignOrders = (parentPageId: string | null) => {
    const siblings = sortPagesByParent(nextPages, parentPageId);
    siblings.forEach((page, index) => {
      const pageIndex = nextPages.findIndex((item) => item.id === page.id);
      if (pageIndex >= 0) {
        nextPages[pageIndex] = {
          ...nextPages[pageIndex],
          order: index,
        };
      }
      assignOrders(page.id);
    });
  };

  assignOrders(null);
  return nextPages;
};

const movePageBeforeTarget = (
  section: ProducerWorkspaceSection,
  sourcePageId: string,
  targetPageId: string,
): ProducerWorkspaceSection => {
  const sourcePage = section.pages.find((page) => page.id === sourcePageId);
  const targetPage = section.pages.find((page) => page.id === targetPageId);
  if (!sourcePage || !targetPage || sourcePageId === targetPageId) {
    return section;
  }

  const siblingParentId = targetPage.parentPageId ?? null;
  const remainingPages = section.pages.filter((page) => page.id !== sourcePageId);
  const siblingPages = sortPagesByParent(remainingPages, siblingParentId);
  const targetIndex = siblingPages.findIndex((page) => page.id === targetPageId);
  const nextSiblingPages = [...siblingPages];
  nextSiblingPages.splice(targetIndex >= 0 ? targetIndex : nextSiblingPages.length, 0, {
    ...sourcePage,
    parentPageId: siblingParentId,
  });
  const mergedPages = [
    ...remainingPages.filter((page) => (page.parentPageId ?? null) !== siblingParentId),
    ...nextSiblingPages,
  ];

  return {
    ...section,
    pages: normalizePageOrders(mergedPages),
  };
};

const nestPageUnderTarget = (
  section: ProducerWorkspaceSection,
  sourcePageId: string,
  targetPageId: string,
): ProducerWorkspaceSection => {
  const sourcePage = section.pages.find((page) => page.id === sourcePageId);
  const targetPage = section.pages.find((page) => page.id === targetPageId);
  if (!sourcePage || !targetPage || sourcePageId === targetPageId) {
    return section;
  }

  let currentParentId = targetPage.parentPageId ?? null;
  while (currentParentId) {
    if (currentParentId === sourcePageId) {
      return section;
    }
    currentParentId = section.pages.find((page) => page.id === currentParentId)?.parentPageId ?? null;
  }

  const nextPages = section.pages.map((page) => (
    page.id === sourcePageId
      ? {
        ...page,
        parentPageId: targetPageId,
        order: sortPagesByParent(section.pages, targetPageId).length,
      }
      : page
  ));

  return {
    ...section,
    pages: normalizePageOrders(nextPages),
  };
};

const movePageToRootEnd = (
  section: ProducerWorkspaceSection,
  pageId: string,
): ProducerWorkspaceSection => {
  const page = section.pages.find((entry) => entry.id === pageId);
  if (!page) {
    return section;
  }

  const rootCount = sortPagesByParent(section.pages.filter((entry) => entry.id !== pageId), null).length;
  return {
    ...section,
    pages: normalizePageOrders(section.pages.map((entry) => (
      entry.id === pageId
        ? {
          ...entry,
          parentPageId: null,
          order: rootCount,
        }
        : entry
    ))),
  };
};

const removePageFromSection = (
  section: ProducerWorkspaceSection,
  pageId: string,
): ProducerWorkspaceSection => {
  const pageToDelete = section.pages.find((page) => page.id === pageId);
  if (!pageToDelete) {
    return section;
  }

  const nextPages = section.pages
    .filter((page) => page.id !== pageId)
    .map((page) => (
      page.parentPageId === pageId
        ? {
          ...page,
          parentPageId: pageToDelete.parentPageId ?? null,
        }
        : page
    ));

  return {
    ...section,
    pages: normalizePageOrders(nextPages),
  };
};

export default function ProducerMediaPanel({
  project,
  projectId,
  projectName,
  storyboardCount = 0,
  shotCount = 0,
  shotLists,
  readOnly = false,
  canContributeClientInput = false,
  isClientReviewerMode = false,
  initialWorkspace,
  initialSectionId,
  initialPageId,
  initialArtifactId,
  onWorkspaceFocusChange,
  onOpenStoryboard,
  onOpenManuscript,
  onOpenShotList,
  onOpenSceneNotes: _onOpenSceneNotes,
  onPrepareStoryboardReview,
  onPrepareManuscriptReview: _onPrepareManuscriptReview,
  onPrepareShotListReview,
  onProjectUpdated,
  onCreateProjectFromAgent,
  onUnsavedStateChange,
}: ProducerMediaPanelProps) {
  const { uploadProjectFile, deleteProjectFile, getProjectFiles } = useProject();
  const theme = useTheme();
  const isMobileWorkspace = useMediaQuery(theme.breakpoints.down('sm'));
  const useLocalAgreementFallback = shouldUseRoleRoomLocalFallback();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intakeDraft, setIntakeDraft] = useState<ProducerClientIntake>(EMPTY_INTAKE);
  const [materials, setMaterials] = useState<ProducerClientMaterial[]>([]);
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [reviews, setReviews] = useState<ProducerClientReview[]>([]);
  const [timelineItems, setTimelineItems] = useState<ProducerTimelineItem[]>([]);
  const [planningDraft, setPlanningDraft] = useState<ProducerProjectPlanning>(() => normalizeProducerProjectPlanning(project));
  const [brandFontsDraft, setBrandFontsDraft] = useState(() => stringifyLineSeparatedValues(normalizeProducerProjectPlanning(project).brandGuide.fonts));
  const [brandColorsDraft, setBrandColorsDraft] = useState(() => stringifyBrandColors(normalizeProducerProjectPlanning(project).brandGuide.colors));
  const [brandDosDraft, setBrandDosDraft] = useState(() => stringifyLineSeparatedValues(normalizeProducerProjectPlanning(project).brandGuide.dos));
  const [brandDontsDraft, setBrandDontsDraft] = useState(() => stringifyLineSeparatedValues(normalizeProducerProjectPlanning(project).brandGuide.donts));
  const [brandPreviewFormat, setBrandPreviewFormat] = useState<'16:9' | '4:5' | '9:16' | '1:1'>('16:9');
  const [brandPreviewDeliveryId, setBrandPreviewDeliveryId] = useState<string | null>(null);
  const [uploadingBrandLogo, setUploadingBrandLogo] = useState(false);
  const [brandLogoUploadVariantType, setBrandLogoUploadVariantType] = useState<ProducerBrandLogoVariantType>('primary');
  const [brandLogoVariantBusyKey, setBrandLogoVariantBusyKey] = useState<string | null>(null);
  const [brandLogoVariantDeleteConfirmType, setBrandLogoVariantDeleteConfirmType] = useState<ProducerBrandLogoVariantType | null>(null);
  const [draggingBrandLogo, setDraggingBrandLogo] = useState(false);
  const [savingIntake, setSavingIntake] = useState(false);
  const [savingPlanning, setSavingPlanning] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [uploadingMaterialFile, setUploadingMaterialFile] = useState(false);
  const [materialDraft, setMaterialDraft] = useState<ClientMaterialDraft>(EMPTY_MATERIAL_DRAFT);
  const [manuscriptSuggestionDraft, setManuscriptSuggestionDraft] = useState<ManuscriptSuggestionDraft>({
    manuscriptId: '',
    sceneId: '',
    title: '',
    suggestion: '',
    rationale: '',
  });
  const [storyboardInspirationDraft, setStoryboardInspirationDraft] = useState<StoryboardInspirationDraft>({
    sceneId: '',
    storyboardFrameId: '',
    title: '',
    note: '',
    externalUrl: '',
  });
  const [selectedMaterialFile, setSelectedMaterialFile] = useState<File | null>(null);
  const [selectedMaterialPreviewUrl, setSelectedMaterialPreviewUrl] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState(() => normalizeProducerProjectPlanning(project).workspaceNavigation?.activeSectionId ?? getDefaultProducerWorkspaceNavigation().activeSectionId ?? '');
  const [activePageId, setActivePageId] = useState(() => normalizeProducerProjectPlanning(project).workspaceNavigation?.activePageId ?? getDefaultProducerWorkspaceNavigation().activePageId ?? '');
  const activeSectionIdRef = useRef(activeSectionId);
  const activePageIdRef = useRef(activePageId);
  const [workspaceContextMenu, setWorkspaceContextMenu] = useState<WorkspaceContextMenuState | null>(null);
  const [workspaceToolsAnchorEl, setWorkspaceToolsAnchorEl] = useState<HTMLElement | null>(null);
  const [showWorkspaceOperations, setShowWorkspaceOperations] = useState(false);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [draggedPageRef, setDraggedPageRef] = useState<{ sectionId: string; pageId: string } | null>(null);
  const [activeBriefStep, setActiveBriefStep] = useState<BriefStepKey>('goal');
  const [briefWizardEnabled, setBriefWizardEnabled] = useState(true);
  const [materialsMode, setMaterialsMode] = useState<MaterialsMode>('capture');
  const [materialWizardEnabled, setMaterialWizardEnabled] = useState(true);
  const [activeMaterialWizardStep, setActiveMaterialWizardStep] = useState<MaterialWizardStepKey>('source');
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  const [deliveryWorkspaceAssets, setDeliveryWorkspaceAssets] = useState<DeliveryWorkspaceAssetSummary>({
    latestPackage: null,
    workspaceFiles: [],
    legalAgreements: [],
    googleArtifacts: [],
  });
  const [linkedInAccessStatus, setLinkedInAccessStatus] = useState<Awaited<ReturnType<typeof linkedInWorkspaceApi.getStatus>> | null>(null);
  const [loadingLinkedInAccessStatus, setLoadingLinkedInAccessStatus] = useState(false);
  const [linkedInAccessActionKey, setLinkedInAccessActionKey] = useState<string | null>(null);
  const [accountAccessActionKey, setAccountAccessActionKey] = useState<string | null>(null);
  const [roleRoomSession, setRoleRoomSession] = useState(() => authSessionService.getSessionSync());
  const [accessVaultState, setAccessVaultState] = useState<RoleRoomAccessVaultState>({
    secrets: [],
    requests: [],
    audit: [],
  });
  const [loadingAccessVault, setLoadingAccessVault] = useState(false);
  const [accessVaultError, setAccessVaultError] = useState<string | null>(null);
  const [accessVaultActionKey, setAccessVaultActionKey] = useState<string | null>(null);
  const [accessVaultDrafts, setAccessVaultDrafts] = useState<Partial<Record<ProducerAccountAccessPlatform, VaultSecretDraft>>>({});
  const [revealedVaultSecrets, setRevealedVaultSecrets] = useState<Record<string, RoleRoomAccessVaultRevealResult>>({});
  const [roleRoomAgentAccess, setRoleRoomAgentAccess] = useState<RoleRoomAgentAccess | null>(null);
  const [loadingRoleRoomAgentAccess, setLoadingRoleRoomAgentAccess] = useState(false);
  const [roleRoomAgentDialogOpen, setRoleRoomAgentDialogOpen] = useState(false);
  const [roleRoomAgentGenerating, setRoleRoomAgentGenerating] = useState(false);
  const [roleRoomAgentApplying, setRoleRoomAgentApplying] = useState(false);
  const [roleRoomAgentResult, setRoleRoomAgentResult] = useState<RoleRoomAgentProducerBootstrapResult | null>(null);
  const [roleRoomAgentError, setRoleRoomAgentError] = useState<string | null>(null);
  const [roleRoomAgentNotice, setRoleRoomAgentNotice] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);
  const [focusedArtifactId, setFocusedArtifactId] = useState<string | null>(initialArtifactId ?? null);
  const brandLogoFileInputRef = useRef<HTMLInputElement | null>(null);
  const brandPreviewFrameRef = useRef<HTMLDivElement | null>(null);
  const materialFileInputRef = useRef<HTMLInputElement | null>(null);
  const materialCameraInputRef = useRef<HTMLInputElement | null>(null);
  const linkedInAccessRequestRef = useRef(0);
  const savedIntakeSnapshotRef = useRef<string>(JSON.stringify(EMPTY_INTAKE));
  const savedPlanningSnapshotRef = useRef<string>('');
  const mobileWorkspaceDraftHydratedRef = useRef(false);

  const canEditClientInput = canContributeClientInput && !readOnly;
  const sessionRoleForVault = useMemo(
    () => String(roleRoomSession.adminUser?.role || '').trim().toLowerCase(),
    [roleRoomSession.adminUser?.role],
  );
  const canManageAccessVaultSecrets = canEditClientInput && !isClientReviewerMode;
  const canApproveAccessVaultReveal = isClientReviewerMode
    || sessionRoleForVault === 'producer'
    || sessionRoleForVault === 'director'
    || sessionRoleForVault === 'admin'
    || sessionRoleForVault === 'super_admin';
  const canRequestAccessVaultReveal = !isClientReviewerMode && (
    sessionRoleForVault === 'content_producer'
    || sessionRoleForVault === 'producer'
    || sessionRoleForVault === 'director'
    || sessionRoleForVault === 'production_manager'
    || sessionRoleForVault === 'admin'
    || sessionRoleForVault === 'super_admin'
  );
  const isBriefLockedByApproval = project.producerWorkflowStatus === 'approved';
  const canEditBriefInput = canEditClientInput && !isBriefLockedByApproval;
  const workspaceNavigation = useMemo(
    () => normalizeProducerWorkspaceNavigation(planningDraft.workspaceNavigation),
    [planningDraft.workspaceNavigation],
  );
  const effectiveWorkspaceNavigation = useMemo(
    () => (isClientReviewerMode
      ? getClientVisibleProducerWorkspaceNavigation(workspaceNavigation)
      : workspaceNavigation),
    [isClientReviewerMode, workspaceNavigation],
  );
  const workspaceSections = useMemo(
    () => [...effectiveWorkspaceNavigation.sections].sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    [effectiveWorkspaceNavigation.sections],
  );
  const activeSection = useMemo(() => {
    return workspaceSections.find((section) => section.id === activeSectionId) ?? workspaceSections[0] ?? null;
  }, [activeSectionId, workspaceSections]);
  const activeSectionPages = useMemo(
    () => (activeSection ? flattenProducerWorkspacePages(activeSection) : []),
    [activeSection],
  );
  const activePage = useMemo(() => {
    return activeSectionPages.find((page) => page.id === activePageId) ?? activeSectionPages[0] ?? null;
  }, [activePageId, activeSectionPages]);
  const activeWorkspace = activePage?.surface ?? 'brief';
  const showClientWorkspaceEmptyState = isClientReviewerMode && workspaceSections.length === 0;
  const activeLayout = activeSection?.layout ?? 'split';
  const mobileWorkspaceDraftStorageKey = useMemo(
    () => `role-room-mobile-workspace-draft:${projectId}`,
    [projectId],
  );
  const isClientPortalView = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return new URLSearchParams(window.location.search).get('portal') === 'client';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    mobileWorkspaceDraftHydratedRef.current = false;
  }, [projectId]);

  useEffect(() => {
    onWorkspaceFocusChange?.({
      workspace: activeWorkspace,
      sectionId: activeSection?.id,
      pageId: activePage?.id,
      artifactId: focusedArtifactId ?? undefined,
    });
  }, [activePage?.id, activeSection?.id, activeWorkspace, focusedArtifactId, onWorkspaceFocusChange]);
  const strategySnapshot = useMemo(
    () => getProducerStrategySnapshot(planningDraft),
    [planningDraft],
  );
  const serializeIntakeSnapshot = useCallback((value: ProducerClientIntake) => JSON.stringify({
    ...EMPTY_INTAKE,
    ...value,
    updatedAt: undefined,
    updatedByRole: undefined,
    lastSaved: undefined,
  }), []);
  const serializePlanningSnapshot = useCallback((value: ProducerProjectPlanning, drafts?: {
    fonts?: string;
    colors?: string;
    dos?: string;
    donts?: string;
  }) => JSON.stringify({
    ...value,
    updatedAt: undefined,
    brandGuide: {
      ...value.brandGuide,
      fonts: parseLineSeparatedValues(drafts?.fonts ?? stringifyLineSeparatedValues(value.brandGuide.fonts)),
      colors: parseBrandColors(drafts?.colors ?? stringifyBrandColors(value.brandGuide.colors)),
      dos: parseLineSeparatedValues(drafts?.dos ?? stringifyLineSeparatedValues(value.brandGuide.dos)),
      donts: parseLineSeparatedValues(drafts?.donts ?? stringifyLineSeparatedValues(value.brandGuide.donts)),
    },
  }), []);
  const contentLogicDraft = useMemo(() => ({
    objective: planningDraft.contentLogic?.objective ?? planningDraft.activationPlan.businessGoal ?? '',
    audience: planningDraft.contentLogic?.audience ?? planningDraft.activationPlan.targetAudience ?? '',
    hook: planningDraft.contentLogic?.hook ?? planningDraft.activationPlan.idea ?? '',
    coreMessage: planningDraft.contentLogic?.coreMessage ?? planningDraft.activationPlan.coreMessage ?? '',
    proofPoints: planningDraft.contentLogic?.proofPoints ?? [],
    callToAction: planningDraft.contentLogic?.callToAction ?? '',
    distributionPlan: planningDraft.contentLogic?.distributionPlan ?? planningDraft.activationPlan.activation ?? '',
    successSignals: planningDraft.contentLogic?.successSignals ?? planningDraft.activationPlan.successSignals ?? [],
  }), [planningDraft]);
  const normalizedSessionRole = String(roleRoomSession.adminUser?.role || '').trim().toLowerCase();
  const normalizedSessionLoginAs = String(roleRoomSession.adminUser?.loginAs || '').trim().toLowerCase();
  const normalizedSessionRequestedRole = String(roleRoomSession.adminUser?.requestedRole || '').trim().toLowerCase();
  const normalizedSelectedProfession = String(roleRoomSession.selectedProfession || '').trim().toLowerCase();
  const isRoleRoomAdmin = normalizedSessionRole === 'admin'
    || normalizedSessionRole === 'owner'
    || normalizedSessionRole === 'super_admin';
  const isContentProducerAgentSession = normalizedSessionLoginAs === 'content_producer'
    || normalizedSessionRequestedRole === 'content_producer'
    || normalizedSelectedProfession === 'content_producer'
    || (!normalizedSessionLoginAs && !normalizedSessionRequestedRole && normalizedSessionRole === 'content_producer');
  const canUseRoleRoomAgent = isRoleRoomAdmin
    && isContentProducerAgentSession
    && !isClientReviewerMode
    && !readOnly;

  const shotListOptions = useMemo(
    () => shotLists.map((shotList) => ({
      id: shotList.id,
      label: getShotListLabel(shotList),
    })),
    [shotLists],
  );
  const contentCalendarOptions = useMemo(
    () => planningDraft.contentCalendar.map((item) => ({
      id: item.id,
      label: item.title,
      phase: item.phase,
      linkedShotListId: item.linkedShotListId ?? '',
    })),
    [planningDraft.contentCalendar],
  );
  const focusedArtifact = useMemo(
    () => (
      focusedArtifactId
        ? resolveWorkspaceFocusArtifact(
            focusedArtifactId,
            planningDraft,
            materials,
            projectFiles,
            deliveryWorkspaceAssets.legalAgreements,
            deliveryWorkspaceAssets.googleArtifacts,
          )
        : null
    ),
    [deliveryWorkspaceAssets.googleArtifacts, deliveryWorkspaceAssets.legalAgreements, focusedArtifactId, materials, planningDraft, projectFiles],
  );
  const storyboardScenes = useMemo(
    () => Array.isArray(project.sceneBreakdowns) ? project.sceneBreakdowns : [],
    [project.sceneBreakdowns],
  );
  const storyboardFrameCount = useMemo(
    () => storyboardScenes.reduce((total, scene) => total + (scene.storyboardFrames?.length ?? 0), 0),
    [storyboardScenes],
  );
  const primaryManuscript = useMemo(
    () => manuscripts[0] ?? null,
    [manuscripts],
  );
  const totalShotCount = useMemo(
    () => shotLists.reduce((total, shotList) => total + shotList.shots.length, 0),
    [shotLists],
  );
  const uncoveredStoryboardSceneCount = useMemo(() => {
    return storyboardScenes.filter((scene) => !shotLists.some((shotList) => (
      (hasText(scene.id) && shotList.sceneId === scene.id)
      || (hasText(scene.sceneName) && shotList.sceneName?.trim() === scene.sceneName?.trim())
      || (scene.sceneNumber !== undefined && scene.sceneNumber !== null && String(shotList.sceneId).trim() === String(scene.sceneNumber).trim())
    ))).length;
  }, [shotLists, storyboardScenes]);
  const shotListRows = useMemo(() => {
    const roleNameById = new Map(project.roles.map((role) => [role.id, role.name]));
    const locationNameById = new Map(project.locations.map((location) => [location.id, location.name]));
    const sceneById = new Map(storyboardScenes.map((scene) => [scene.id, scene]));

    return shotLists.flatMap((shotList) => (
      shotList.shots.map((shot, index) => {
        const linkedScene = shot.sceneId ? sceneById.get(shot.sceneId) : null;
        const planLabel = typeof shot.estimatedTime === 'number' && shot.estimatedTime > 0
          ? `${shot.estimatedTime} min`
          : typeof shot.duration === 'number' && shot.duration > 0
            ? `${Math.max(1, Math.round(shot.duration / 60))} min`
            : `#${index + 1}`;
        const castSummary = Array.from(new Set([
          ...(shot.assignments ?? []).map((assignment) => readFirstNonEmptyString(
            assignment.name,
            assignment.roleName,
            assignment.roleId ? roleNameById.get(assignment.roleId) : '',
          )),
          readFirstNonEmptyString(shot.roleId ? roleNameById.get(shot.roleId) : ''),
        ].filter((value): value is string => hasText(value)))).slice(0, 4).join(', ');
        const locationLabel = readFirstNonEmptyString(
          shot.locationId ? locationNameById.get(shot.locationId) : '',
          linkedScene?.locationName,
          shot.locationId,
          shotList.sceneName,
          shotList.sceneId,
        );

        return {
          id: shot.id,
          planLabel,
          sceneLabel: readFirstNonEmptyString(
            linkedScene ? getSceneDisplayLabel(linkedScene) : '',
            getShotListLabel(shotList),
            shot.sceneId,
            shot.id,
          ),
          locationLabel: locationLabel || 'Ikke satt',
          castSummary: castSummary || 'Ikke spesifisert',
          description: readFirstNonEmptyString(
            shot.description,
            shot.notes,
            linkedScene?.description,
            `${shot.shotType} · ${shot.cameraAngle}`,
          ),
          shotListLabel: getShotListLabel(shotList),
        };
      })
    ));
  }, [project.locations, project.roles, shotLists, storyboardScenes]);
  const storyboardSceneOptions = useMemo(
    () => storyboardScenes.map((scene) => ({
      id: scene.id,
      label: getSceneDisplayLabel(scene),
      frameCount: scene.storyboardFrames?.length ?? 0,
    })),
    [storyboardScenes],
  );
  const storyboardFrameOptions = useMemo(() => {
    const selectedScene = storyboardScenes.find((scene) => scene.id === storyboardInspirationDraft.sceneId) ?? null;
    return (selectedScene?.storyboardFrames ?? []).map((frame, index) => ({
      id: frame.id,
      label: getStoryboardFrameDisplayLabel(frame, index),
      thumbnailUrl: frame.thumbnailUrl ?? frame.imageUrl ?? '',
    }));
  }, [storyboardInspirationDraft.sceneId, storyboardScenes]);
  const manuscriptExcerpt = useMemo(() => {
    if (!primaryManuscript?.content) {
      return '';
    }
    return primaryManuscript.content.replace(/\s+/g, ' ').trim().slice(0, 320);
  }, [primaryManuscript?.content]);

  useEffect(() => {
    activeSectionIdRef.current = activeSectionId;
  }, [activeSectionId]);

  useEffect(() => {
    activePageIdRef.current = activePageId;
  }, [activePageId]);

  useEffect(() => {
    setManuscriptSuggestionDraft((previous) => ({
      ...previous,
      manuscriptId: previous.manuscriptId || primaryManuscript?.id || '',
      sceneId: previous.sceneId || storyboardScenes[0]?.id || '',
    }));
  }, [primaryManuscript?.id, storyboardScenes]);

  useEffect(() => {
    setStoryboardInspirationDraft((previous) => {
      const nextSceneId = previous.sceneId || storyboardScenes[0]?.id || '';
      const nextScene = storyboardScenes.find((scene) => scene.id === nextSceneId) ?? null;
      const nextFrameId = previous.storyboardFrameId
        || nextScene?.storyboardFrames?.[0]?.id
        || '';
      return {
        ...previous,
        sceneId: nextSceneId,
        storyboardFrameId: nextFrameId,
      };
    });
  }, [storyboardScenes]);

  useEffect(() => {
    const normalizedPlanning = normalizeProducerProjectPlanning(project);
    setPlanningDraft(normalizedPlanning);
    setBrandFontsDraft(stringifyLineSeparatedValues(normalizedPlanning.brandGuide.fonts));
    setBrandColorsDraft(stringifyBrandColors(normalizedPlanning.brandGuide.colors));
    setBrandDosDraft(stringifyLineSeparatedValues(normalizedPlanning.brandGuide.dos));
    setBrandDontsDraft(stringifyLineSeparatedValues(normalizedPlanning.brandGuide.donts));
    const navigation = normalizeProducerWorkspaceNavigation(normalizedPlanning.workspaceNavigation);
    const previousPageId = activePageIdRef.current;
    const previousSectionId = activeSectionIdRef.current;
    const sectionForPreviousPage = previousPageId
      ? navigation.sections.find((section) => flattenProducerWorkspacePages(section).some((page) => page.id === previousPageId))
      : null;
    const preservedSection = sectionForPreviousPage
      ?? (previousSectionId ? navigation.sections.find((section) => section.id === previousSectionId) ?? null : null);
    const preservedPages = preservedSection ? flattenProducerWorkspacePages(preservedSection) : [];
    const nextSectionId = preservedSection?.id
      ?? navigation.activeSectionId
      ?? navigation.sections[0]?.id
      ?? '';
    const nextPageId = (previousPageId && preservedPages.some((page) => page.id === previousPageId))
      ? previousPageId
      : navigation.sections.find((section) => section.id === nextSectionId)
        ? (navigation.activePageId && flattenProducerWorkspacePages(
          navigation.sections.find((section) => section.id === nextSectionId)!,
        ).some((page) => page.id === navigation.activePageId)
          ? navigation.activePageId
          : flattenProducerWorkspacePages(
            navigation.sections.find((section) => section.id === nextSectionId)!,
          )[0]?.id ?? '')
        : '';
    setActiveSectionId(nextSectionId);
    setActivePageId(nextPageId);
    savedPlanningSnapshotRef.current = serializePlanningSnapshot(normalizedPlanning);
  }, [project, serializePlanningSnapshot]);

  const loadClientWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextIntake, nextMaterials, nextReviews, nextTimelineItems] = await Promise.allSettled([
        producerWorkflowService.getClientIntake(projectId),
        producerWorkflowService.getClientMaterials(projectId),
        producerWorkflowService.getReviews(projectId),
        producerWorkflowService.getTimeline(projectId),
      ]);

      const clientInputFailures: Array<'intake' | 'materials'> = [];

      if (nextIntake.status === 'fulfilled') {
        const nextDraft = {
          ...EMPTY_INTAKE,
          ...nextIntake.value,
        };
        setIntakeDraft(nextDraft);
        savedIntakeSnapshotRef.current = serializeIntakeSnapshot(nextDraft);
      } else {
        console.error('[ProducerMediaPanel] Failed to load client intake', nextIntake.reason);
        clientInputFailures.push('intake');
      }

      if (nextMaterials.status === 'fulfilled') {
        setMaterials(nextMaterials.value);
      } else {
        console.error('[ProducerMediaPanel] Failed to load client materials', nextMaterials.reason);
        clientInputFailures.push('materials');
      }

      if (nextReviews.status === 'fulfilled') {
        setReviews(nextReviews.value);
      } else {
        console.warn('[ProducerMediaPanel] Failed to load reviews', nextReviews.reason);
        setReviews([]);
      }

      if (nextTimelineItems.status === 'fulfilled') {
        setTimelineItems(nextTimelineItems.value);
      } else {
        console.warn('[ProducerMediaPanel] Failed to load timeline items', nextTimelineItems.reason);
        setTimelineItems([]);
      }

      if (clientInputFailures.length === 2) {
        setError('Kunne ikke hente klientbrief og materiale.');
      } else if (clientInputFailures[0] === 'intake') {
        setError('Kunne ikke hente klientbrief.');
      } else if (clientInputFailures[0] === 'materials') {
        setError('Kunne ikke hente klientmateriale.');
      }

      await Promise.allSettled([
        producerWorkflowService.ensureClientGroundingTimeline(projectId),
        producerWorkflowService.ensureClientGroundingReviews(projectId),
      ]);

      const meetingWorkflowResult = await Promise.allSettled([
        producerWorkflowService.ensureMeetingWorkspaceWorkflow(
          projectId,
          normalizeProducerProjectPlanning(project),
        ),
      ]);

      const meetingWorkflow = meetingWorkflowResult[0];
      if (meetingWorkflow.status === 'fulfilled') {
        setReviews(meetingWorkflow.value.reviews);
        setTimelineItems(meetingWorkflow.value.timelineItems);
      } else {
        console.warn('[ProducerMediaPanel] Failed to ensure meeting workflow', meetingWorkflow.reason);
      }
    } catch (loadError) {
      console.error('[ProducerMediaPanel] Failed to load client workspace', loadError);
      setError('Kunne ikke hente klientbrief og materiale.');
    } finally {
      setLoading(false);
    }
  }, [project, projectId, serializeIntakeSnapshot]);

  useEffect(() => {
    void loadClientWorkspace();
  }, [loadClientWorkspace]);

  useEffect(() => {
    if (!selectedMaterialFile || !selectedMaterialFile.type.startsWith('image/')) {
      setSelectedMaterialPreviewUrl(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedMaterialFile);
    setSelectedMaterialPreviewUrl(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedMaterialFile]);

  useEffect(() => {
    if (!isMobileWorkspace || loading || mobileWorkspaceDraftHydratedRef.current) {
      return undefined;
    }
    mobileWorkspaceDraftHydratedRef.current = true;
    let cancelled = false;

    const applyMobileWorkspaceDraft = (parsed: MobileWorkspaceDraft | null) => {
      if (cancelled || !parsed) {
        return;
      }
      if (parsed.intakeDraft && serializeIntakeSnapshot(parsed.intakeDraft) !== savedIntakeSnapshotRef.current) {
        setIntakeDraft({
          ...EMPTY_INTAKE,
          ...parsed.intakeDraft,
        });
      }
      if (parsed.activeBriefStep) {
        setActiveBriefStep(parsed.activeBriefStep);
      }
      if (parsed.materialDraft && JSON.stringify(parsed.materialDraft) !== JSON.stringify(EMPTY_MATERIAL_DRAFT)) {
        setMaterialDraft({
          ...EMPTY_MATERIAL_DRAFT,
          ...parsed.materialDraft,
        });
        setMaterialsMode(parsed.materialsMode === 'library' ? 'library' : 'capture');
      }
    };

    const loadMobileWorkspaceDraft = async () => {
      try {
        let parsed = await settingsService.getSetting<MobileWorkspaceDraft>(MOBILE_WORKSPACE_DRAFT_NAMESPACE, {
          projectId,
        });

        if (!parsed && typeof window !== 'undefined') {
          const rawDraft = window.localStorage.getItem(mobileWorkspaceDraftStorageKey);
          if (rawDraft) {
            parsed = JSON.parse(rawDraft) as MobileWorkspaceDraft;
          }
        }

        applyMobileWorkspaceDraft(parsed);
      } catch (storageError) {
        console.warn('[ProducerMediaPanel] Failed to restore mobile draft', storageError);
      }
    };

    void loadMobileWorkspaceDraft();

    return () => {
      cancelled = true;
    };
  }, [isMobileWorkspace, loading, mobileWorkspaceDraftStorageKey, projectId, serializeIntakeSnapshot]);

  useEffect(() => {
    if (!isMobileWorkspace || loading || typeof window === 'undefined') {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      const intakeDirty = serializeIntakeSnapshot(intakeDraft) !== savedIntakeSnapshotRef.current;
      const materialDraftDirty = JSON.stringify(materialDraft) !== JSON.stringify(EMPTY_MATERIAL_DRAFT);
      if (!intakeDirty && !materialDraftDirty) {
        window.localStorage.removeItem(mobileWorkspaceDraftStorageKey);
        void settingsService.deleteSetting(MOBILE_WORKSPACE_DRAFT_NAMESPACE, {
          projectId,
        });
        return;
      }
      const nextDraft: MobileWorkspaceDraft = {
        intakeDraft,
        activeBriefStep,
        materialDraft: materialDraftDirty ? materialDraft : undefined,
        materialsMode,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(mobileWorkspaceDraftStorageKey, JSON.stringify(nextDraft));
      void settingsService.setSetting(MOBILE_WORKSPACE_DRAFT_NAMESPACE, nextDraft, {
        projectId,
      });
    }, 280);
    return () => window.clearTimeout(timeoutId);
  }, [
    activeBriefStep,
    intakeDraft,
    isMobileWorkspace,
    loading,
    materialDraft,
    materialsMode,
    mobileWorkspaceDraftStorageKey,
    projectId,
    serializeIntakeSnapshot,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadManuscripts = async () => {
      try {
        const nextManuscripts = await manuscriptService.getManuscripts(projectId);
        if (!cancelled) {
          setManuscripts(nextManuscripts);
        }
      } catch (loadManuscriptError) {
        console.error('[ProducerMediaPanel] Failed to load manuscripts', loadManuscriptError);
        if (!cancelled) {
          setManuscripts([]);
        }
      }
    };

    void loadManuscripts();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadLinkedInAccessStatus = useCallback(async () => {
    const requestId = ++linkedInAccessRequestRef.current;
    setLoadingLinkedInAccessStatus(true);
    try {
      const nextStatus = await linkedInWorkspaceApi.getStatus();
      if (requestId !== linkedInAccessRequestRef.current) {
        return;
      }
      setLinkedInAccessStatus(nextStatus);
    } catch (statusError) {
      if (requestId !== linkedInAccessRequestRef.current) {
        return;
      }
      console.error('[ProducerMediaPanel] Failed to load LinkedIn access status', statusError);
    } finally {
      if (requestId === linkedInAccessRequestRef.current) {
        setLoadingLinkedInAccessStatus(false);
      }
    }
  }, []);

  useEffect(() => {
    const shouldLoadIntegrationAccessStatus = showWorkspaceOperations || activeWorkspace === 'accounts';
    if (!shouldLoadIntegrationAccessStatus) {
      return;
    }
    void loadLinkedInAccessStatus();
  }, [activeWorkspace, loadLinkedInAccessStatus, showWorkspaceOperations]);

  useEffect(() => () => {
    linkedInAccessRequestRef.current += 1;
  }, []);

  useEffect(() => {
    setFocusedArtifactId(initialArtifactId ?? null);
  }, [initialArtifactId]);

  useEffect(() => {
    if (initialSectionId || initialPageId) {
      const matchingSection = initialSectionId
        ? workspaceSections.find((section) => section.id === initialSectionId)
        : workspaceSections.find((section) => flattenProducerWorkspacePages(section).some((page) => page.id === initialPageId));
      if (matchingSection) {
        const matchingPage = initialPageId
          ? flattenProducerWorkspacePages(matchingSection).find((page) => page.id === initialPageId)
          : flattenProducerWorkspacePages(matchingSection)[0];
        setActiveSectionId(matchingSection.id);
        setActivePageId(matchingPage?.id ?? '');
        return;
      }
    }

    if (!initialWorkspace) {
      return;
    }
    const sectionWithWorkspace = workspaceSections.find((section) => section.pages.some((page) => page.surface === initialWorkspace));
    if (!sectionWithWorkspace) {
      return;
    }
    const pageForWorkspace = flattenProducerWorkspacePages(sectionWithWorkspace).find((page) => page.surface === initialWorkspace);
    setActiveSectionId(sectionWithWorkspace.id);
    if (pageForWorkspace) {
      setActivePageId(pageForWorkspace.id);
    }
  }, [initialPageId, initialSectionId, initialWorkspace, workspaceSections]);

  useEffect(() => {
    if (!isClientPortalView || typeof window === 'undefined' || !activeSection || !activePage) {
      return;
    }
    const nextUrl = buildClientPortalUrl(projectId, {
      tab: 'media',
      workspace: activeWorkspace,
      sectionId: activeSection.id,
      pageId: activePage.id,
      artifactId: focusedArtifactId ?? undefined,
    });
    if (!nextUrl) {
      return;
    }
    const currentUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    if (currentUrl === nextUrl) {
      return;
    }
    window.history.replaceState({}, '', nextUrl);
  }, [activePage, activeSection, activeWorkspace, focusedArtifactId, isClientPortalView, projectId]);

  const readLocalAgreements = useCallback(async (): Promise<ProjectAgreement[]> => {
    const stored = await settingsService.getSetting<ProjectAgreement[]>(LOCAL_PROJECT_AGREEMENTS_NAMESPACE, {
      projectId,
    });
    return Array.isArray(stored) ? stored : [];
  }, [projectId]);

  const loadDeliveryWorkspaceAssets = useCallback(async () => {
    try {
      const [projectFiles, legalAgreements, googleStatus] = await Promise.all([
        getProjectFiles(projectId),
        useLocalAgreementFallback
          ? readLocalAgreements()
          : projectAgreementsApi.getAll(projectId),
        googleWorkspaceApi.getStatus(projectId).catch(() => null),
      ]);
      const normalizedProjectFiles = normalizeProjectFileRecords(projectFiles);
      setProjectFiles(normalizedProjectFiles);
      const latestPackage = [...normalizedProjectFiles]
        .filter((file) => getProjectFileMetadataString(file, 'source') === 'role_room_client_handoff_package')
        .sort((left, right) => {
          const leftTime = Date.parse(left.uploadedAt || '');
          const rightTime = Date.parse(right.uploadedAt || '');
          return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
        })[0] ?? null;
      const workspaceFiles = normalizedProjectFiles
        .filter((file) => getProjectFileMetadataString(file, 'source') === 'role_room_delivery_workspace')
        .sort((left, right) => {
          const leftTime = Date.parse(left.uploadedAt || '');
          const rightTime = Date.parse(right.uploadedAt || '');
          return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
        });
      setDeliveryWorkspaceAssets({
        latestPackage,
        workspaceFiles,
        legalAgreements,
        googleArtifacts: googleStatus?.artifacts ?? [],
      });
    } catch (loadError) {
      console.warn('[ProducerMediaPanel] Failed to load delivery workspace assets', loadError);
    }
  }, [getProjectFiles, projectId, readLocalAgreements, useLocalAgreementFallback]);

  const loadAccessVault = useCallback(async () => {
    try {
      setLoadingAccessVault(true);
      const nextVault = await roleRoomAccessVaultApi.getVault(projectId);
      setAccessVaultState(nextVault);
      setAccessVaultError(null);
    } catch (vaultError) {
      console.error('[ProducerMediaPanel] Failed to load Client Access Vault', vaultError);
      setAccessVaultError(vaultError instanceof Error ? vaultError.message : 'Kunne ikke hente Client Access Vault.');
    } finally {
      setLoadingAccessVault(false);
    }
  }, [projectId]);

  const updateAccessVaultDraft = useCallback((
    platform: ProducerAccountAccessPlatform,
    updater: (draft: VaultSecretDraft) => VaultSecretDraft,
  ) => {
    setAccessVaultDrafts((previous) => ({
      ...previous,
      [platform]: updater(previous[platform] ?? EMPTY_VAULT_SECRET_DRAFT),
    }));
  }, []);

  useEffect(() => {
    void loadAccessVault();
  }, [loadAccessVault]);

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const nextSession = await authSessionService.loadSession();
      if (active) {
        setRoleRoomSession(nextSession);
      }
    };

    void syncSession();

    if (typeof window === 'undefined') {
      return () => {
        active = false;
      };
    }

    const handleSessionUpdate = () => {
      setRoleRoomSession(authSessionService.getSessionSync());
    };

    window.addEventListener('auth-session-updated', handleSessionUpdate);
    return () => {
      active = false;
      window.removeEventListener('auth-session-updated', handleSessionUpdate);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setRoleRoomAgentResult(null);
    roleRoomAgentService.getSnapshot(projectId)
      .then((snapshot) => {
        if (active && snapshot) {
          setRoleRoomAgentResult(snapshot);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!canUseRoleRoomAgent) {
      setRoleRoomAgentAccess(null);
      return;
    }

    let active = true;
    setLoadingRoleRoomAgentAccess(true);
    roleRoomAgentService.getAccess()
      .then((access) => {
        if (active) {
          setRoleRoomAgentAccess(access);
        }
      })
      .catch((accessError) => {
        console.error('[ProducerMediaPanel] Failed to load Role Room Agent access', accessError);
        if (active) {
          setRoleRoomAgentAccess(null);
          setRoleRoomAgentError('Kunne ikke hente tilgang til The Role Room Agent.');
        }
      })
      .finally(() => {
        if (active) {
          setLoadingRoleRoomAgentAccess(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canUseRoleRoomAgent]);

  useEffect(() => {
    void loadDeliveryWorkspaceAssets();
  }, [loadDeliveryWorkspaceAssets]);

  useEffect(() => {
    return onProducerWorkflowEvent((payload) => {
      if (payload.projectId !== projectId || payload.domain !== 'project') {
        return;
      }
      void loadClientWorkspace();
      void loadDeliveryWorkspaceAssets();
      void loadAccessVault();
    });
  }, [loadAccessVault, loadClientWorkspace, loadDeliveryWorkspaceAssets, projectId]);

  useEffect(() => onProjectAgreementEvent((payload) => {
    if (payload.projectId !== projectId) {
      return;
    }
    void loadDeliveryWorkspaceAssets();
  }), [loadDeliveryWorkspaceAssets, projectId]);

  const persistPlanningDraft = useCallback(async (
    nextPlanning: ProducerProjectPlanning,
    projectOverride?: CastingProject,
  ) => {
    const stampedPlanning: ProducerProjectPlanning = {
      ...nextPlanning,
      workspaceNavigation: normalizeProducerWorkspaceNavigation(nextPlanning.workspaceNavigation),
      updatedAt: new Date().toISOString(),
    };
    const nextProject: CastingProject = {
      ...(projectOverride ?? project),
      producerPlanning: stampedPlanning,
      updatedAt: new Date().toISOString(),
    };
    await castingService.saveProject(nextProject);
    await producerWorkflowService.syncPlanningClientReviews(projectId, stampedPlanning);
    const meetingWorkflow = await producerWorkflowService.syncMeetingWorkspaceWorkflow(projectId, stampedPlanning);
    await onProjectUpdated?.(nextProject);
    setReviews(meetingWorkflow.reviews);
    setTimelineItems(meetingWorkflow.timelineItems);
    setPlanningDraft(stampedPlanning);
    savedPlanningSnapshotRef.current = serializePlanningSnapshot(stampedPlanning, {
      fonts: brandFontsDraft,
      colors: brandColorsDraft,
      dos: brandDosDraft,
      donts: brandDontsDraft,
    });
    const navigation = normalizeProducerWorkspaceNavigation(stampedPlanning.workspaceNavigation);
    setActiveSectionId(navigation.activeSectionId ?? navigation.sections[0]?.id ?? '');
    setActivePageId(navigation.activePageId ?? navigation.sections[0]?.pages[0]?.id ?? '');
    setError(null);
  }, [brandColorsDraft, brandDosDraft, brandDontsDraft, brandFontsDraft, onProjectUpdated, project, projectId, serializePlanningSnapshot]);

  const updateWorkspaceNavigationLocal = useCallback((
    updater: (navigation: ReturnType<typeof normalizeProducerWorkspaceNavigation>) => ReturnType<typeof normalizeProducerWorkspaceNavigation>,
  ) => {
    setPlanningDraft((previous) => {
      const currentNavigation = normalizeProducerWorkspaceNavigation(previous.workspaceNavigation);
      const nextNavigation = normalizeProducerWorkspaceNavigation(updater(currentNavigation));
      return {
        ...previous,
        workspaceNavigation: nextNavigation,
      };
    });
  }, []);

  const persistWorkspaceNavigation = useCallback(async (
    updater: (navigation: ReturnType<typeof normalizeProducerWorkspaceNavigation>) => ReturnType<typeof normalizeProducerWorkspaceNavigation>,
  ) => {
    setSavingPlanning(true);
    setError(null);
    try {
      const currentNavigation = normalizeProducerWorkspaceNavigation(planningDraft.workspaceNavigation);
      const nextNavigation = normalizeProducerWorkspaceNavigation(updater(currentNavigation));
      await persistPlanningDraft({
        ...planningDraft,
        workspaceNavigation: nextNavigation,
      });
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save workspace navigation', saveError);
      setError('Kunne ikke lagre workspace-oppsettet.');
    } finally {
      setSavingPlanning(false);
    }
  }, [persistPlanningDraft, planningDraft]);

  const handleSaveIntake = useCallback(async () => {
    if (isBriefLockedByApproval) {
      setError('Briefen er låst fordi prosjektet er godkjent.');
      return;
    }

    setSavingIntake(true);
    setError(null);
    try {
      const saved = await producerWorkflowService.updateClientIntake(projectId, intakeDraft);
      await persistPlanningDraft(planningDraft);
      const nextDraft = {
        ...EMPTY_INTAKE,
        ...saved,
      };
      setIntakeDraft(nextDraft);
      savedIntakeSnapshotRef.current = serializeIntakeSnapshot(nextDraft);
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save client intake', saveError);
      setError('Kunne ikke lagre klientbrief og content logic.');
    } finally {
      setSavingIntake(false);
    }
  }, [intakeDraft, isBriefLockedByApproval, persistPlanningDraft, planningDraft, projectId, serializeIntakeSnapshot]);

  const handleGenerateRoleRoomAgent = useCallback(async (input: {
    projectId: string;
    projectName: string;
    websiteUrl: string;
    organizationNumber: string;
    companyName: string;
    extraContext: string;
  }) => {
    setRoleRoomAgentGenerating(true);
    setRoleRoomAgentError(null);
    setRoleRoomAgentNotice(null);

    try {
      const generated = await roleRoomAgentService.generateProducerBootstrap(input);
      setRoleRoomAgentResult(generated);
      setRoleRoomAgentNotice('The Role Room Agent har laget et nytt utkast for kundeprofil, brief og story logikk.');
    } catch (agentError) {
      console.error('[ProducerMediaPanel] Failed to generate Role Room Agent result', agentError);
      setRoleRoomAgentError(agentError instanceof Error ? agentError.message : 'Kunne ikke generere forslag fra The Role Room Agent.');
    } finally {
      setRoleRoomAgentGenerating(false);
    }
  }, []);

  const handleApplyRoleRoomAgent = useCallback(async (result: RoleRoomAgentProducerBootstrapResult) => {
    if (isBriefLockedByApproval) {
      const message = 'Briefen er låst fordi prosjektet er godkjent.';
      setRoleRoomAgentError(message);
      setError(message);
      return;
    }

    setRoleRoomAgentApplying(true);
    setRoleRoomAgentError(null);
    setRoleRoomAgentNotice(null);
    setError(null);

    try {
      const now = new Date().toISOString();
      const nextIntake: ProducerClientIntake = {
        ...intakeDraft,
        ...result.intakeDraft,
        updatedAt: now,
        updatedByRole: 'content_producer',
      };

      const nextPlanning: ProducerProjectPlanning = {
        ...planningDraft,
        activationPlan: {
          ...planningDraft.activationPlan,
          ...result.planningDraft.activationPlan,
          successSignals: mergePreferredStringArray(
            planningDraft.activationPlan.successSignals,
            result.planningDraft.activationPlan.successSignals,
          ),
        },
        contentLogic: {
          ...(planningDraft.contentLogic ?? {}),
          ...result.planningDraft.contentLogic,
          industry: result.planningDraft.contentLogic.industry || planningDraft.contentLogic?.industry,
          subIndustry: result.planningDraft.contentLogic.subIndustry || planningDraft.contentLogic?.subIndustry,
          businessModel: result.planningDraft.contentLogic.businessModel || planningDraft.contentLogic?.businessModel,
          contentCategory: result.planningDraft.contentLogic.contentCategory || planningDraft.contentLogic?.contentCategory,
          productionApproach: result.planningDraft.contentLogic.productionApproach || planningDraft.contentLogic?.productionApproach,
          proofPoints: mergePreferredStringArray(
            planningDraft.contentLogic?.proofPoints,
            result.planningDraft.contentLogic.proofPoints,
          ),
          successSignals: mergePreferredStringArray(
            planningDraft.contentLogic?.successSignals,
            result.planningDraft.contentLogic.successSignals,
          ),
        },
        brandGuide: {
          ...planningDraft.brandGuide,
          logoUrl: result.planningDraft.brandGuide.logoUrl || planningDraft.brandGuide.logoUrl,
          toneOfVoice: result.planningDraft.brandGuide.toneOfVoice || planningDraft.brandGuide.toneOfVoice,
          visualStyle: result.planningDraft.brandGuide.visualStyle || planningDraft.brandGuide.visualStyle,
          fonts: mergePreferredStringArray(
            planningDraft.brandGuide.fonts,
            result.planningDraft.brandGuide.fonts,
          ),
          dos: mergePreferredStringArray(
            planningDraft.brandGuide.dos,
            result.planningDraft.brandGuide.dos,
          ),
          donts: mergePreferredStringArray(
            planningDraft.brandGuide.donts,
            result.planningDraft.brandGuide.donts,
          ),
          colors: mapRoleRoomAgentBrandColors(
            planningDraft.brandGuide.colors,
            result.planningDraft.brandGuide.colors,
          ),
        },
        updatedAt: now,
      };

      const nextProject: CastingProject = {
        ...project,
        clientCompanyName: result.companyProfile.companyName || project.clientCompanyName,
        clientOrganizationNumber: result.companyProfile.organizationNumber || project.clientOrganizationNumber,
        clientCompanyAddress: result.companyProfile.probableLocationAddress || project.clientCompanyAddress,
        updatedAt: now,
      };

      const savedIntake = await producerWorkflowService.updateClientIntake(projectId, nextIntake);
      await persistPlanningDraft(nextPlanning, nextProject);

      const existingStoryLogic = await storyLogicService.getStoryLogic(projectId);
      const nextStoryLogic = {
        ...(existingStoryLogic ?? {}),
        ...(result.storyLogicDraft ?? {}),
        concept: {
          ...((existingStoryLogic as Record<string, unknown> | null)?.concept as Record<string, unknown> | undefined),
          ...((result.storyLogicDraft.concept as Record<string, unknown> | undefined) ?? {}),
        },
        logline: {
          ...((existingStoryLogic as Record<string, unknown> | null)?.logline as Record<string, unknown> | undefined),
          ...((result.storyLogicDraft.logline as Record<string, unknown> | undefined) ?? {}),
        },
        theme: {
          ...((existingStoryLogic as Record<string, unknown> | null)?.theme as Record<string, unknown> | undefined),
          ...((result.storyLogicDraft.theme as Record<string, unknown> | undefined) ?? {}),
        },
        phaseStatus: {
          ...((existingStoryLogic as Record<string, unknown> | null)?.phaseStatus as Record<string, unknown> | undefined),
          ...((result.storyLogicDraft.phaseStatus as Record<string, unknown> | undefined) ?? {}),
        },
        locks:
          result.storyLogicDraft.locks && typeof result.storyLogicDraft.locks === 'object'
            ? result.storyLogicDraft.locks
            : ((existingStoryLogic as Record<string, unknown> | null)?.locks as Record<string, unknown> | undefined) ?? { concept: false, logline: false, theme: false },
        versions: Array.isArray(result.storyLogicDraft.versions)
          ? result.storyLogicDraft.versions
          : Array.isArray((existingStoryLogic as Record<string, unknown> | null)?.versions)
            ? (existingStoryLogic as Record<string, unknown>).versions
            : [],
        lastSaved: now,
        isLocked: false,
      };
      await storyLogicService.saveStoryLogic(
        projectId,
        nextStoryLogic as Parameters<typeof storyLogicService.saveStoryLogic>[1],
      );

      const nextDraft = {
        ...EMPTY_INTAKE,
        ...savedIntake,
      };
      setIntakeDraft(nextDraft);
      savedIntakeSnapshotRef.current = serializeIntakeSnapshot(nextDraft);
      setRoleRoomAgentResult(result);
      setRoleRoomAgentDialogOpen(false);
      setRoleRoomAgentNotice('The Role Room Agent fylte nå brief, branding-utkast og story logikk i prosjektet.');
    } catch (agentError) {
      console.error('[ProducerMediaPanel] Failed to apply Role Room Agent result', agentError);
      const message = agentError instanceof Error
        ? agentError.message
        : 'Kunne ikke bruke forslagene fra The Role Room Agent.';
      setRoleRoomAgentError(message);
      setError(message);
    } finally {
      setRoleRoomAgentApplying(false);
    }
  }, [intakeDraft, isBriefLockedByApproval, persistPlanningDraft, planningDraft, project, projectId, serializeIntakeSnapshot]);

  const handleCreateProjectFromRoleRoomAgent = useCallback(async (result: RoleRoomAgentProducerBootstrapResult) => {
    if (!onCreateProjectFromAgent) {
      return;
    }

    const draft = result.projectCreationDraft;
    const companyName = draft?.clientCompanyName || result.companyProfile.companyName || result.brregCompany?.name || 'Kunde';
    const agreementNotes = draft?.suggestedAgreementNotes
      || (result.agreementSuggestions ?? []).map((entry) => `${entry.title}: ${entry.detail}`).join('\n');
    const socialProfiles = (result.socialProfileCandidates ?? [])
      .filter((entry) => entry.status === 'verified' || entry.status === 'likely')
      .map((entry) => ({
        platform: entry.platform,
        url: entry.url,
        handle: entry.handle ?? '',
        confidence: entry.confidence,
        status: entry.status,
        source: entry.source,
        evidence: entry.evidence,
      }));
    const competitorSummary = result.competitorAnalysis?.competitors
      ?.filter((entry) => entry.status === 'verified' || entry.status === 'likely')
      .slice(0, 5)
      .map((entry) => `${entry.name}: ${entry.relevanceReason} (${entry.confidence}%)`)
      .join('\n') || '';
    const localPresenceSummary = result.localPresencePlan?.nearbyOpportunities
      ?.filter((entry) => entry.status === 'verified' || entry.status === 'likely')
      .slice(0, 5)
      .map((entry) => `${entry.name}: ${entry.eventIdea} (${entry.radiusKm} km, ${entry.confidence}%)`)
      .join('\n') || '';
    const description = [
      draft?.description || result.companyProfile.summary || '',
      result.brregCompany?.lookupStatus === 'verified' && result.brregCompany.organizationNumber
        ? `Brreg-verifisert org.nr: ${result.brregCompany.organizationNumber}.`
        : '',
      result.companyAge?.label ? `Selskapsalder: ${result.companyAge.label}.` : '',
      socialProfiles.length > 0
        ? `Sosiale kontoer foreslått:\n${socialProfiles.map((entry) => `${entry.platform}: ${entry.url} (${entry.confidence}%)`).join('\n')}`
        : '',
      competitorSummary
        ? `Konkurrentanalyse:\n${competitorSummary}`
        : '',
      result.competitorAnalysis?.marketingOpportunities?.length
        ? `Markedsføringsmuligheter:\n${result.competitorAnalysis.marketingOpportunities.slice(0, 4).join('\n')}`
        : '',
      localPresenceSummary
        ? `Lokal synlighet/event:\n${localPresenceSummary}`
        : '',
      result.localPresencePlan?.recommendedEventConcepts?.length
        ? `Lokale eventkonsepter:\n${result.localPresencePlan.recommendedEventConcepts.slice(0, 4).join('\n')}`
        : '',
      agreementNotes ? `Avtalenotater:\n${agreementNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    await onCreateProjectFromAgent({
      name: draft?.projectName || `${companyName} · Innholdsproduksjon`,
      projectName: draft?.projectName || `${companyName} · Innholdsproduksjon`,
      description,
      projectType: draft?.projectType || 'content_production',
      genre: 'content_production',
      clientName: result.intakeDraft.contactName || companyName,
      clientEmail: result.intakeDraft.contactEmail || '',
      clientPhone: result.intakeDraft.contactPhone || '',
      clientCompanyName: companyName,
      clientOrganizationNumber: draft?.clientOrganizationNumber || result.companyProfile.organizationNumber || result.brregCompany?.organizationNumber || '',
      clientCompanyAddress: draft?.clientCompanyAddress || result.companyProfile.probableLocationAddress || result.brregCompany?.businessAddress || '',
      location: draft?.location || result.companyProfile.probableLocationAddress || result.brregCompany?.businessAddress || '',
      currency: 'NOK',
      status: 'draft',
      roles: [],
      candidates: [],
      crew: [],
      schedules: [],
      locations: [],
      props: [],
      socialProfiles,
      competitorAnalysis: result.competitorAnalysis ?? null,
      localPresencePlan: result.localPresencePlan ?? null,
      roleRoomAgentPrefill: {
        generatedAt: result.generatedAt,
        brregCompany: result.brregCompany ?? null,
        companyAge: result.companyAge ?? null,
        agreementSuggestions: result.agreementSuggestions ?? [],
        socialProfileCandidates: result.socialProfileCandidates ?? [],
        competitorAnalysis: result.competitorAnalysis ?? null,
        localPresencePlan: result.localPresencePlan ?? null,
        websiteUrl: draft?.websiteUrl || result.companyProfile.websiteUrl || '',
      },
    });
    setRoleRoomAgentDialogOpen(false);
    setRoleRoomAgentNotice('Prosjektmodalen er forhåndsutfylt med Brreg-data og agentens avtaleforslag. Kontroller kontaktfelt og lagre prosjektet.');
  }, [onCreateProjectFromAgent]);

  const handleImportGoogleContact = useCallback(async (contact: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
  }) => {
    const nextIntake: ProducerClientIntake = {
      ...intakeDraft,
      contactName: hasText(contact.name) ? contact.name.trim() : intakeDraft.contactName,
      contactEmail: hasText(contact.email) ? contact.email.trim() : intakeDraft.contactEmail,
      contactPhone: hasText(contact.phone) ? contact.phone.trim() : intakeDraft.contactPhone,
      updatedAt: new Date().toISOString(),
      updatedByRole: isClientReviewerMode ? 'client_reviewer' : 'content_producer',
    };

    const nextProject: CastingProject = {
      ...project,
      clientName: hasText(contact.name) ? contact.name.trim() : project.clientName,
      clientEmail: hasText(contact.email) ? contact.email.trim() : project.clientEmail,
      clientCompanyName: hasText(contact.organization) ? contact.organization.trim() : project.clientCompanyName,
      updatedAt: new Date().toISOString(),
    };

    const savedIntake = await producerWorkflowService.updateClientIntake(projectId, nextIntake);
    await castingService.saveProject(nextProject);
    await onProjectUpdated?.(nextProject);
    const nextDraft = {
      ...EMPTY_INTAKE,
      ...savedIntake,
    };
    setIntakeDraft(nextDraft);
    savedIntakeSnapshotRef.current = serializeIntakeSnapshot(nextDraft);
  }, [intakeDraft, isClientReviewerMode, onProjectUpdated, project, projectId, serializeIntakeSnapshot]);

  const handleSubmitManuscriptSuggestion = useCallback(async () => {
    if (!manuscriptSuggestionDraft.title.trim() || !manuscriptSuggestionDraft.suggestion.trim()) {
      setError('Forslaget må ha en tittel og en konkret endring.');
      return;
    }

    setSavingMaterial(true);
    setError(null);
    try {
      const created = await producerWorkflowService.createClientMaterial(projectId, {
        entryType: 'feedback',
        title: manuscriptSuggestionDraft.title.trim(),
        description: manuscriptSuggestionDraft.suggestion.trim(),
        status: 'suggested',
        metadata: {
          workspaceSurface: 'manuscript',
          manuscriptId: manuscriptSuggestionDraft.manuscriptId || primaryManuscript?.id || undefined,
          sceneId: manuscriptSuggestionDraft.sceneId || undefined,
          rationale: manuscriptSuggestionDraft.rationale.trim() || undefined,
          suggestionType: 'change_request',
        },
      });
      setMaterials((previous) => [created, ...previous]);
      setManuscriptSuggestionDraft({
        manuscriptId: manuscriptSuggestionDraft.manuscriptId || primaryManuscript?.id || '',
        sceneId: manuscriptSuggestionDraft.sceneId,
        title: '',
        suggestion: '',
        rationale: '',
      });
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save manuscript suggestion', saveError);
      setError('Kunne ikke lagre manusforslaget.');
    } finally {
      setSavingMaterial(false);
    }
  }, [manuscriptSuggestionDraft, primaryManuscript?.id, projectId]);

  const handleSubmitStoryboardInspiration = useCallback(async () => {
    if (!storyboardInspirationDraft.title.trim()) {
      setError('Inspirasjonen må ha en tittel.');
      return;
    }

    setSavingMaterial(true);
    setError(null);
    try {
      const created = await producerWorkflowService.createClientMaterial(projectId, {
        entryType: 'reference',
        title: storyboardInspirationDraft.title.trim(),
        description: storyboardInspirationDraft.note.trim() || undefined,
        externalUrl: storyboardInspirationDraft.externalUrl.trim() || undefined,
        status: 'provided',
        metadata: {
          workspaceSurface: 'storyboard',
          sceneId: storyboardInspirationDraft.sceneId || undefined,
          storyboardFrameId: storyboardInspirationDraft.storyboardFrameId || undefined,
          inspirationType: 'client_reference',
        },
      });
      setMaterials((previous) => [created, ...previous]);
      setStoryboardInspirationDraft((previous) => ({
        ...previous,
        title: '',
        note: '',
        externalUrl: '',
      }));
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save storyboard inspiration', saveError);
      setError('Kunne ikke lagre storyboard-inspirasjonen.');
    } finally {
      setSavingMaterial(false);
    }
  }, [projectId, storyboardInspirationDraft]);

  const handleSavePlanningContext = useCallback(async () => {
    setSavingPlanning(true);
    setError(null);
    try {
      const nextPlanning: ProducerProjectPlanning = {
        ...planningDraft,
        brandGuide: {
          ...planningDraft.brandGuide,
          fonts: parseLineSeparatedValues(brandFontsDraft),
          colors: parseBrandColors(brandColorsDraft),
          dos: parseLineSeparatedValues(brandDosDraft),
          donts: parseLineSeparatedValues(brandDontsDraft),
        },
      };
      await persistPlanningDraft(nextPlanning);
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save planning context', saveError);
      setError('Kunne ikke lagre arbeidsflateoppsettet.');
    } finally {
      setSavingPlanning(false);
    }
  }, [brandColorsDraft, brandDontsDraft, brandDosDraft, brandFontsDraft, persistPlanningDraft, planningDraft]);

  const hasUnsavedProducerMediaState = useMemo(() => {
    const intakeDirty = serializeIntakeSnapshot(intakeDraft) !== savedIntakeSnapshotRef.current;
    const planningDirty = serializePlanningSnapshot(planningDraft, {
      fonts: brandFontsDraft,
      colors: brandColorsDraft,
      dos: brandDosDraft,
      donts: brandDontsDraft,
    }) !== savedPlanningSnapshotRef.current;
    const materialDraftDirty = JSON.stringify(materialDraft) !== JSON.stringify(EMPTY_MATERIAL_DRAFT) || Boolean(selectedMaterialFile);
    const manuscriptSuggestionDirty = Boolean(
      manuscriptSuggestionDraft.title.trim()
      || manuscriptSuggestionDraft.suggestion.trim()
      || manuscriptSuggestionDraft.rationale.trim(),
    );
    const storyboardInspirationDirty = Boolean(
      storyboardInspirationDraft.title.trim()
      || storyboardInspirationDraft.note.trim()
      || storyboardInspirationDraft.externalUrl.trim(),
    );

    return (
      intakeDirty
      || planningDirty
      || materialDraftDirty
      || manuscriptSuggestionDirty
      || storyboardInspirationDirty
      || savingIntake
      || savingPlanning
      || savingMaterial
      || uploadingMaterialFile
    );
  }, [
    brandColorsDraft,
    brandDosDraft,
    brandDontsDraft,
    brandFontsDraft,
    intakeDraft,
    manuscriptSuggestionDraft.rationale,
    manuscriptSuggestionDraft.suggestion,
    manuscriptSuggestionDraft.title,
    materialDraft,
    planningDraft,
    savingIntake,
    savingMaterial,
    savingPlanning,
    selectedMaterialFile,
    serializeIntakeSnapshot,
    serializePlanningSnapshot,
    storyboardInspirationDraft.externalUrl,
    storyboardInspirationDraft.note,
    storyboardInspirationDraft.title,
    uploadingMaterialFile,
  ]);
  const unsavedProducerMediaReason = useMemo(() => {
    const labels: Partial<Record<ProducerWorkspaceSurfaceKey, string>> = {
      brief: 'brief',
      materials: 'materialer',
      storyboard: 'prosjektrom',
      manuscript: 'prosjektrom',
      shotlist: 'prosjektrom',
      brand: 'merkevare',
      accounts: 'kontotilgang',
      delivery: 'levering',
      meetings: 'møter',
    };
    return labels[activeWorkspace] ?? 'prosjektrom';
  }, [activeWorkspace]);

  useEffect(() => {
    onUnsavedStateChange?.(
      hasUnsavedProducerMediaState,
      hasUnsavedProducerMediaState ? unsavedProducerMediaReason : undefined,
    );

    return () => {
      onUnsavedStateChange?.(false);
    };
  }, [hasUnsavedProducerMediaState, onUnsavedStateChange, unsavedProducerMediaReason]);

  const updateAccountAccessEntry = useCallback((
    platform: ProducerAccountAccessPlatform,
    updater: (entry: ProducerProjectPlanning['accountAccess']['entries'][number]) => ProducerProjectPlanning['accountAccess']['entries'][number],
  ) => {
    setPlanningDraft((previous) => ({
      ...previous,
      accountAccess: {
        ...previous.accountAccess,
        entries: previous.accountAccess.entries.map((entry) => (
          entry.platform === platform
            ? {
              ...updater(entry),
              lastUpdatedAt: new Date().toISOString(),
            }
            : entry
        )),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const updateAccountAccessWorkspace = useCallback((
    updater: (workspace: ProducerProjectPlanning['accountAccess']) => ProducerProjectPlanning['accountAccess'],
  ) => {
    setPlanningDraft((previous) => ({
      ...previous,
      accountAccess: {
        ...updater(previous.accountAccess),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const handleStartLinkedInAccountLink = useCallback(async () => {
    try {
      setLinkedInAccessActionKey('connect');
      const response = await linkedInWorkspaceApi.startOauth({
        mode: 'link',
        projectId,
        returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        browserOrigin: window.location.origin,
        email: project.clientEmail ?? intakeDraft.contactEmail ?? undefined,
      });
      if (!hasText(response.authorizationUrl)) {
        throw new Error('Mangler autorisasjonslenke fra LinkedIn.');
      }
      window.location.assign(response.authorizationUrl);
    } catch (linkError) {
      console.error('[ProducerMediaPanel] Failed to start LinkedIn account link', linkError);
      setError(linkError instanceof Error ? linkError.message : 'Kunne ikke starte LinkedIn-koblingen.');
    } finally {
      setLinkedInAccessActionKey(null);
    }
  }, [intakeDraft.contactEmail, project.clientEmail, projectId]);

  const persistAccountAccessEntry = useCallback(async (
    platform: ProducerAccountAccessPlatform,
    updater: (entry: ProducerProjectPlanning['accountAccess']['entries'][number]) => ProducerProjectPlanning['accountAccess']['entries'][number],
  ) => {
    setAccountAccessActionKey(`${platform}:persist`);
    setError(null);
    try {
      const nextPlanning: ProducerProjectPlanning = {
        ...planningDraft,
        accountAccess: {
          ...planningDraft.accountAccess,
          entries: planningDraft.accountAccess.entries.map((entry) => (
            entry.platform === platform
              ? {
                ...updater(entry),
                lastUpdatedAt: new Date().toISOString(),
              }
              : entry
          )),
          updatedAt: new Date().toISOString(),
        },
      };
      await persistPlanningDraft(nextPlanning);
    } catch (persistError) {
      console.error('[ProducerMediaPanel] Failed to persist account access entry', persistError);
      setError('Kunne ikke lagre kontotilgangen.');
    } finally {
      setAccountAccessActionKey(null);
    }
  }, [persistPlanningDraft, planningDraft]);

  const handleConfirmAccountAccessConnected = useCallback(async (platform: ProducerAccountAccessPlatform) => {
    await persistAccountAccessEntry(platform, (entry) => ({
      ...entry,
      status: 'connected',
    }));
  }, [persistAccountAccessEntry]);

  const handleSaveAccessVaultSecret = useCallback(async (
    entry: ProducerProjectPlanning['accountAccess']['entries'][number],
  ) => {
    const draft = accessVaultDrafts[entry.platform] ?? EMPTY_VAULT_SECRET_DRAFT;
    setAccessVaultActionKey(`${entry.platform}:save`);
    setAccessVaultError(null);
    try {
      await roleRoomAccessVaultApi.upsertSecret(projectId, entry.platform, {
        label: readFirstNonEmptyString(draft.label, entry.accountLabel, PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]),
        secretType: readFirstNonEmptyString(draft.secretType, entry.secretLabel, 'Kontoopplysning'),
        username: draft.username.trim() || undefined,
        secretValue: draft.secretValue.trim() || undefined,
        backupCode: draft.backupCode.trim() || undefined,
        maskedReference: readFirstNonEmptyString(draft.maskedReference, entry.maskedReference),
        revealPolicy: entry.revealPolicy ?? 'approval_required',
        status: entry.secretStatus ?? 'stored_externally',
        tier: entry.tier ?? 'sensitive_secret',
        riskLevel: entry.riskLevel ?? 'medium',
        ownerName: entry.ownerName,
        sharedWithRoles: entry.sharedWithRoles,
        expiresAt: fromDateTimeLocalValue(draft.expiresAt) ?? entry.expiresAt ?? null,
        metadata: {
          source: 'producer_media_panel',
          method: entry.method,
          accessScope: entry.accessScope ?? null,
        },
      });
      setAccessVaultDrafts((previous) => ({
        ...previous,
        [entry.platform]: {
          ...(previous[entry.platform] ?? EMPTY_VAULT_SECRET_DRAFT),
          label: readFirstNonEmptyString(draft.label, entry.accountLabel, PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]) ?? '',
          secretType: readFirstNonEmptyString(draft.secretType, entry.secretLabel, 'Kontoopplysning') ?? '',
          username: '',
          secretValue: '',
          backupCode: '',
        },
      }));
      await loadAccessVault();
    } catch (vaultError) {
      console.error('[ProducerMediaPanel] Failed to save access vault secret', vaultError);
      setAccessVaultError(vaultError instanceof Error ? vaultError.message : 'Kunne ikke lagre secret.');
    } finally {
      setAccessVaultActionKey(null);
    }
  }, [accessVaultDrafts, loadAccessVault, projectId]);

  const handleRevokeAccessVaultSecret = useCallback(async (platform: ProducerAccountAccessPlatform) => {
    setAccessVaultActionKey(`${platform}:revoke`);
    setAccessVaultError(null);
    try {
      await roleRoomAccessVaultApi.revokeSecret(projectId, platform);
      await loadAccessVault();
    } catch (vaultError) {
      console.error('[ProducerMediaPanel] Failed to revoke access vault secret', vaultError);
      setAccessVaultError(vaultError instanceof Error ? vaultError.message : 'Kunne ikke tilbakekalle secret.');
    } finally {
      setAccessVaultActionKey(null);
    }
  }, [loadAccessVault, projectId]);

  const handleRequestAccessVaultReveal = useCallback(async (platform: ProducerAccountAccessPlatform) => {
    const draft = accessVaultDrafts[platform] ?? EMPTY_VAULT_SECRET_DRAFT;
    setAccessVaultActionKey(`${platform}:request`);
    setAccessVaultError(null);
    try {
      await roleRoomAccessVaultApi.requestReveal(projectId, platform, {
        requestReason: draft.requestReason.trim() || undefined,
      });
      setAccessVaultDrafts((previous) => ({
        ...previous,
        [platform]: {
          ...(previous[platform] ?? EMPTY_VAULT_SECRET_DRAFT),
          requestReason: '',
        },
      }));
      await loadAccessVault();
    } catch (vaultError) {
      console.error('[ProducerMediaPanel] Failed to request access vault reveal', vaultError);
      setAccessVaultError(vaultError instanceof Error ? vaultError.message : 'Kunne ikke be om innsyn.');
    } finally {
      setAccessVaultActionKey(null);
    }
  }, [accessVaultDrafts, loadAccessVault, projectId]);

  const handleDecideAccessVaultReveal = useCallback(async (
    request: RoleRoomAccessVaultRevealRequest,
    decision: 'approve' | 'reject',
  ) => {
    const draft = accessVaultDrafts[request.platform] ?? EMPTY_VAULT_SECRET_DRAFT;
    setAccessVaultActionKey(`${request.id}:${decision}`);
    setAccessVaultError(null);
    try {
      await roleRoomAccessVaultApi.decideRevealRequest(projectId, request.id, {
        decision,
        approvalNotes: draft.approvalNotes.trim() || undefined,
      });
      setAccessVaultDrafts((previous) => ({
        ...previous,
        [request.platform]: {
          ...(previous[request.platform] ?? EMPTY_VAULT_SECRET_DRAFT),
          approvalNotes: '',
        },
      }));
      await loadAccessVault();
    } catch (vaultError) {
      console.error('[ProducerMediaPanel] Failed to decide access vault reveal', vaultError);
      setAccessVaultError(vaultError instanceof Error ? vaultError.message : 'Kunne ikke oppdatere reveal-forespørselen.');
    } finally {
      setAccessVaultActionKey(null);
    }
  }, [accessVaultDrafts, loadAccessVault, projectId]);

  const handleRevealAccessVaultSecret = useCallback(async (request: RoleRoomAccessVaultRevealRequest) => {
    setAccessVaultActionKey(`${request.id}:reveal`);
    setAccessVaultError(null);
    try {
      const revealed = await roleRoomAccessVaultApi.revealSecret(projectId, request.id);
      if (revealed) {
        setRevealedVaultSecrets((previous) => ({
          ...previous,
          [request.id]: revealed,
        }));
      }
      await loadAccessVault();
    } catch (vaultError) {
      console.error('[ProducerMediaPanel] Failed to reveal access vault secret', vaultError);
      setAccessVaultError(vaultError instanceof Error ? vaultError.message : 'Kunne ikke åpne secret.');
    } finally {
      setAccessVaultActionKey(null);
    }
  }, [loadAccessVault, projectId]);

  const buildAccountAccessReviewUrl = useCallback((reviewId?: string | null) => (
    reviewId
      ? buildClientPortalUrl(projectId, {
        tab: 'reviews',
        workspace: 'accounts',
        reviewId,
      })
      : ''
  ), [projectId]);

  const buildAccountAccessInviteText = useCallback((
    entry: ProducerProjectPlanning['accountAccess']['entries'][number],
    review?: ProducerClientReview | null,
  ): string => {
    const platformFlow = ACCOUNT_ACCESS_PLATFORM_FLOW_CONFIG[entry.platform];
    const reviewUrl = review ? buildAccountAccessReviewUrl(review.id) : '';
    return [
      `[Kontotilgang · ${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}]`,
      '',
      'Dette må avklares for å fullføre publisering og overlevering:',
      `Plattform: ${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}`,
      `Metode: ${PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS[entry.method]}`,
      `Status: ${PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status]}`,
      `Konto / side: ${readFirstNonEmptyString(entry.accountLabel, 'Ikke satt')}`,
      `Invite / kontakt: ${readFirstNonEmptyString(entry.inviteTarget, intakeDraft.contactEmail, project.clientEmail, 'Ikke satt')}`,
      `Scope / rolle: ${readFirstNonEmptyString(entry.accessScope, 'Ikke satt')}`,
      `Kontoeier: ${readFirstNonEmptyString(entry.ownerName, 'Ikke satt')}`,
      `2-faktor hos kontoeier: ${entry.twoFactorRequired ? 'Ja' : 'Nei'}`,
      `Offisiell flyt: ${platformFlow.primaryDescription}`,
      entry.platform !== 'google' && hasText(platformFlow.primaryHref) ? `Åpne plattformen: ${platformFlow.primaryHref}` : '',
      entry.platform !== 'google' && hasText(platformFlow.secondaryHref) ? `Offisiell veiledning: ${platformFlow.secondaryHref}` : '',
      entry.notes ? `Notat: ${entry.notes}` : '',
      reviewUrl ? '' : '',
      reviewUrl ? `Åpne review og bekreft saken her: ${reviewUrl}` : '',
    ].filter((value) => value !== '').join('\n');
  }, [buildAccountAccessReviewUrl, intakeDraft.contactEmail, project.clientEmail]);

  const handleCopyAccountAccessInviteText = useCallback(async (
    entry: ProducerProjectPlanning['accountAccess']['entries'][number],
    review?: ProducerClientReview | null,
  ) => {
    const text = buildAccountAccessInviteText(entry, review);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    if (typeof window !== 'undefined') {
      window.prompt('Kopier invite-instruksen manuelt:', text);
    }
  }, [buildAccountAccessInviteText]);

  const handleOpenAccountAccessInviteMail = useCallback((
    entry: ProducerProjectPlanning['accountAccess']['entries'][number],
    review?: ProducerClientReview | null,
  ) => {
    if (typeof window === 'undefined') {
      return;
    }
    const recipient = readFirstNonEmptyString(
      readEmailAddress(entry.inviteTarget),
      project.clientEmail,
      intakeDraft.contactEmail,
    );
    const subject = `${projectName} · Kontotilgang · ${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}`;
    const body = buildAccountAccessInviteText(entry, review);
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [buildAccountAccessInviteText, intakeDraft.contactEmail, project.clientEmail, projectName]);

  const selectSection = useCallback((sectionId: string) => {
    const targetSection = workspaceSections.find((section) => section.id === sectionId);
    if (!targetSection) {
      return;
    }
    const nextPages = flattenProducerWorkspacePages(targetSection);
    const nextPageId = nextPages.some((page) => page.id === activePageId)
      ? activePageId
      : nextPages[0]?.id ?? '';
    setActiveSectionId(sectionId);
    setActivePageId(nextPageId);
    updateWorkspaceNavigationLocal((navigation) => ({
      ...navigation,
      activeSectionId: sectionId,
      activePageId: nextPageId,
    }));
  }, [activePageId, updateWorkspaceNavigationLocal, workspaceSections]);

  const selectPage = useCallback((sectionId: string, pageId: string) => {
    setActiveSectionId(sectionId);
    setActivePageId(pageId);
    updateWorkspaceNavigationLocal((navigation) => ({
      ...navigation,
      activeSectionId: sectionId,
      activePageId: pageId,
    }));
  }, [updateWorkspaceNavigationLocal]);

  const handleCreateSection = useCallback(async () => {
    const defaultSurface = activePage?.surface ?? 'brief';
    const nextSection = createProducerWorkspaceSection(
      `Workspace ${workspaceSections.length + 1}`,
      [
        createProducerWorkspacePage(defaultSurface, {
          title: PRODUCER_WORKSPACE_SURFACE_LABELS[defaultSurface],
          pinned: true,
          order: 0,
        }),
      ],
      {
        color: PRODUCER_WORKSPACE_SURFACE_COLORS[defaultSurface],
        order: workspaceSections.length,
        layout: activeLayout,
      },
    );
    setActiveSectionId(nextSection.id);
    setActivePageId(nextSection.pages[0]?.id ?? '');
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      activeSectionId: nextSection.id,
      activePageId: nextSection.pages[0]?.id,
      sections: [...navigation.sections, nextSection].map((section, index) => ({
        ...section,
        order: index,
      })),
    }));
  }, [activeLayout, activePage?.surface, persistWorkspaceNavigation, workspaceSections.length]);

  const handleCreatePage = useCallback(async (
    surface: ProducerWorkspaceSurfaceKey = activeWorkspace,
    parentPageId: string | null = null,
  ) => {
    if (!activeSection) {
      return;
    }
    const siblingCount = sortPagesByParent(activeSection.pages, parentPageId).length;
    const nextPage = createProducerWorkspacePage(surface, {
      title: parentPageId ? `${PRODUCER_WORKSPACE_SURFACE_LABELS[surface]} underside` : PRODUCER_WORKSPACE_SURFACE_LABELS[surface],
      color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface],
      pinned: parentPageId === null,
      order: siblingCount,
      parentPageId,
    });
    setActivePageId(nextPage.id);
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      activeSectionId: activeSection.id,
      activePageId: nextPage.id,
      sections: navigation.sections.map((section) => (
        section.id === activeSection.id
          ? {
            ...section,
            pages: normalizePageOrders([...section.pages, nextPage]),
          }
          : section
      )),
    }));
  }, [activeSection, activeWorkspace, persistWorkspaceNavigation]);

  const openWorkspaceContextMenu = useCallback((
    event: MouseEvent<HTMLElement>,
    targetType: 'section' | 'page',
    section: ProducerWorkspaceSection,
    page?: ProducerWorkspacePage,
  ) => {
    event.preventDefault();
    setWorkspaceContextMenu({
      targetType,
      sectionId: section.id,
      pageId: page?.id,
      anchorPosition: {
        top: event.clientY + 2,
        left: event.clientX + 2,
      },
      renameValue: targetType === 'page'
        ? (page?.title ?? '')
        : section.title,
      colorValue: targetType === 'page'
        ? (page?.color ?? section.color ?? '#38bdf8')
        : (section.color ?? '#38bdf8'),
      layoutValue: targetType === 'section' ? (section.layout ?? 'split') : undefined,
      surfaceValue: page?.surface,
      clientVisibleValue: targetType === 'page' ? page?.clientVisible !== false : undefined,
    });
  }, []);

  const closeWorkspaceContextMenu = useCallback(() => {
    setWorkspaceContextMenu(null);
  }, []);

  const handleApplyWorkspaceContextMenu = useCallback(async () => {
    if (!workspaceContextMenu) {
      return;
    }

    const menuState = workspaceContextMenu;
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      sections: navigation.sections.map((section) => {
        if (section.id !== menuState.sectionId) {
          return section;
        }
        if (menuState.targetType === 'section') {
          return {
            ...section,
            title: menuState.renameValue.trim() || section.title,
            color: menuState.colorValue.trim() || section.color,
            layout: menuState.layoutValue ?? section.layout,
          };
        }
        return {
          ...section,
          pages: section.pages.map((page) => (
            page.id === menuState.pageId
              ? {
                ...page,
                title: menuState.renameValue.trim() || page.title,
                color: menuState.colorValue.trim() || page.color,
                surface: menuState.surfaceValue ?? page.surface,
                clientVisible: menuState.clientVisibleValue !== false,
              }
              : page
          )),
        };
      }),
    }));
    closeWorkspaceContextMenu();
  }, [closeWorkspaceContextMenu, persistWorkspaceNavigation, workspaceContextMenu]);

  const handleToggleSectionPinned = useCallback(async (sectionId: string) => {
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      sections: navigation.sections.map((section) => (
        section.id === sectionId
          ? {
            ...section,
            pinned: !section.pinned,
          }
          : section
      )),
    }));
  }, [persistWorkspaceNavigation]);

  const handleTogglePagePinned = useCallback(async (sectionId: string, pageId: string) => {
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      sections: navigation.sections.map((section) => (
        section.id === sectionId
          ? {
            ...section,
            pages: section.pages.map((page) => (
              page.id === pageId
                ? {
                  ...page,
                  pinned: !page.pinned,
                }
                : page
            )),
          }
          : section
      )),
    }));
  }, [persistWorkspaceNavigation]);

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    if (workspaceSections.length <= 1) {
      return;
    }
    const remainingSections = workspaceSections.filter((section) => section.id !== sectionId);
    const fallbackSection = remainingSections[0] ?? null;
    const fallbackPageId = fallbackSection?.pages[0]?.id ?? '';
    setActiveSectionId(fallbackSection?.id ?? '');
    setActivePageId(fallbackPageId);
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      activeSectionId: fallbackSection?.id,
      activePageId: fallbackPageId,
      sections: navigation.sections
        .filter((section) => section.id !== sectionId)
        .map((section, index) => ({
          ...section,
          order: index,
        })),
    }));
    closeWorkspaceContextMenu();
  }, [closeWorkspaceContextMenu, persistWorkspaceNavigation, workspaceSections]);

  const handleDeletePage = useCallback(async (sectionId: string, pageId: string) => {
    const targetSection = workspaceSections.find((section) => section.id === sectionId);
    if (!targetSection || targetSection.pages.length <= 1) {
      return;
    }
    const nextSection = removePageFromSection(targetSection, pageId);
    const nextPageId = activePageId === pageId ? nextSection.pages[0]?.id ?? '' : activePageId;
    setActivePageId(nextPageId);
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      activeSectionId: sectionId,
      activePageId: nextPageId,
      sections: navigation.sections.map((section) => (
        section.id === sectionId ? nextSection : section
      )),
    }));
    closeWorkspaceContextMenu();
  }, [activePageId, closeWorkspaceContextMenu, persistWorkspaceNavigation, workspaceSections]);

  const handleSectionPlacementChange = useCallback(async (
    _event: MouseEvent<HTMLElement>,
    value: ProducerWorkspaceTabPlacement | null,
  ) => {
    if (!value) {
      return;
    }
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      sectionTabPlacement: value,
    }));
  }, [persistWorkspaceNavigation]);

  const handlePagePlacementChange = useCallback(async (
    _event: MouseEvent<HTMLElement>,
    value: ProducerWorkspacePagePlacement | null,
  ) => {
    if (!value) {
      return;
    }
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      pageTabPlacement: value,
    }));
  }, [persistWorkspaceNavigation]);

  const handleLayoutChange = useCallback(async (
    _event: MouseEvent<HTMLElement>,
    value: ProducerWorkspaceLayout | null,
  ) => {
    if (!value || !activeSection) {
      return;
    }
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      sections: navigation.sections.map((section) => (
        section.id === activeSection.id
          ? {
            ...section,
            layout: value,
          }
          : section
      )),
    }));
  }, [activeSection, persistWorkspaceNavigation]);

  const handleToggleNavigationPinned = useCallback(async () => {
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      navigationPinned: !navigation.navigationPinned,
    }));
  }, [persistWorkspaceNavigation]);

  const handleSectionDragStart = useCallback((sectionId: string) => {
    setDraggedSectionId(sectionId);
  }, []);

  const handleSectionDrop = useCallback(async (targetSectionId: string) => {
    if (!draggedSectionId || draggedSectionId === targetSectionId) {
      return;
    }
    await persistWorkspaceNavigation((navigation) => {
      const sections = [...navigation.sections];
      const sourceIndex = sections.findIndex((section) => section.id === draggedSectionId);
      const targetIndex = sections.findIndex((section) => section.id === targetSectionId);
      if (sourceIndex < 0 || targetIndex < 0) {
        return navigation;
      }
      const [sourceSection] = sections.splice(sourceIndex, 1);
      sections.splice(targetIndex, 0, sourceSection);
      return {
        ...navigation,
        sections: sections.map((section, index) => ({
          ...section,
          order: index,
        })),
      };
    });
    setDraggedSectionId(null);
  }, [draggedSectionId, persistWorkspaceNavigation]);

  const handlePageDragStart = useCallback((sectionId: string, pageId: string) => {
    setDraggedPageRef({ sectionId, pageId });
  }, []);

  const handlePageDropBefore = useCallback(async (sectionId: string, targetPageId: string) => {
    if (!draggedPageRef || draggedPageRef.sectionId !== sectionId || draggedPageRef.pageId === targetPageId) {
      return;
    }
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      sections: navigation.sections.map((section) => (
        section.id === sectionId
          ? movePageBeforeTarget(section, draggedPageRef.pageId, targetPageId)
          : section
      )),
    }));
    setDraggedPageRef(null);
  }, [draggedPageRef, persistWorkspaceNavigation]);

  const handlePageDropInto = useCallback(async (sectionId: string, targetPageId: string) => {
    if (!draggedPageRef || draggedPageRef.sectionId !== sectionId || draggedPageRef.pageId === targetPageId) {
      return;
    }
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      sections: navigation.sections.map((section) => (
        section.id === sectionId
          ? nestPageUnderTarget(section, draggedPageRef.pageId, targetPageId)
          : section
      )),
    }));
    setDraggedPageRef(null);
  }, [draggedPageRef, persistWorkspaceNavigation]);

  const handlePageDropToRoot = useCallback(async (sectionId: string) => {
    if (!draggedPageRef || draggedPageRef.sectionId !== sectionId) {
      return;
    }
    await persistWorkspaceNavigation((navigation) => ({
      ...navigation,
      sections: navigation.sections.map((section) => (
        section.id === sectionId
          ? movePageToRootEnd(section, draggedPageRef.pageId)
          : section
      )),
    }));
    setDraggedPageRef(null);
  }, [draggedPageRef, persistWorkspaceNavigation]);

  const handleDeleteMaterial = useCallback(async (materialId: string) => {
    setDeletingMaterialId(materialId);
    setError(null);
    try {
      const materialToDelete = materials.find((item) => item.id === materialId);
      const materialMetadata = materialToDelete ? parseMaterialMetadata(materialToDelete) : null;
      await producerWorkflowService.deleteClientMaterial(projectId, materialId);
      if (materialMetadata?.projectFileId) {
        await deleteProjectFile(projectId, materialMetadata.projectFileId).catch(() => {});
      }
      setMaterials((previous) => previous.filter((item) => item.id !== materialId));
      setMaterialDraft((previous) => (previous.id === materialId ? EMPTY_MATERIAL_DRAFT : previous));
      setSelectedMaterialFile((previous) => (
        previous && materialMetadata?.fileName && previous.name === materialMetadata.fileName
          ? null
          : previous
      ));
      void loadDeliveryWorkspaceAssets();
    } catch (deleteError) {
      console.error('[ProducerMediaPanel] Failed to delete client material', deleteError);
      setError('Kunne ikke slette klientmateriale.');
    } finally {
      setDeletingMaterialId(null);
    }
  }, [deleteProjectFile, loadDeliveryWorkspaceAssets, materials, projectId]);

  const sortedMaterials = useMemo(() => {
    const priorityWeight: Record<ClientMaterialDraft['priority'], number> = {
      critical: 0,
      important: 1,
      reference: 2,
    };

    return [...materials].sort((left, right) => {
      const leftMetadata = parseMaterialMetadata(left);
      const rightMetadata = parseMaterialMetadata(right);
      const priorityDifference = priorityWeight[leftMetadata.priority] - priorityWeight[rightMetadata.priority];
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const leftTime = Date.parse(left.updated_at ?? left.created_at ?? '');
      const rightTime = Date.parse(right.updated_at ?? right.created_at ?? '');
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });
  }, [materials]);
  const manuscriptSuggestions = useMemo(
    () => sortedMaterials.filter((material) => (
      material.entry_type === 'feedback' && getSurfaceForMaterial(material) === 'manuscript'
    )),
    [sortedMaterials],
  );
  const storyboardInspirations = useMemo(
    () => sortedMaterials.filter((material) => (
      material.entry_type === 'reference' && getSurfaceForMaterial(material) === 'storyboard'
    )),
    [sortedMaterials],
  );

  const workflowOpenLabels = isClientReviewerMode
    ? {
      storyboard: 'Se storyboard',
      manuscript: 'Se manus',
      shotList: 'Se shotlist',
      sceneNotes: 'Se scene-notater',
    }
    : {
      storyboard: 'Åpne storyboard',
      manuscript: 'Åpne manus',
      shotList: 'Åpne shotlist',
      sceneNotes: 'Åpne scene-notater',
    };

  const intakeUpdatedLabel = useMemo(() => {
    if (!intakeDraft.updatedAt) {
      return 'Klientbrief er ikke lagret ennå.';
    }
    const roleLabel = intakeDraft.updatedByRole ? ` · sist oppdatert av ${intakeDraft.updatedByRole}` : '';
    return `${formatTimestamp(intakeDraft.updatedAt)}${roleLabel}`;
  }, [intakeDraft.updatedAt, intakeDraft.updatedByRole]);

  const brandGuideReadyCount = useMemo(
    () => [
      planningDraft.brandGuide.logoUrl,
      parseLineSeparatedValues(brandFontsDraft).length ? 'fonts' : '',
      parseBrandColors(brandColorsDraft).length ? 'colors' : '',
      planningDraft.brandGuide.toneOfVoice,
      planningDraft.brandGuide.visualStyle,
    ].filter((value) => hasText(value ?? '')).length,
    [brandColorsDraft, brandFontsDraft, planningDraft.brandGuide.logoUrl, planningDraft.brandGuide.toneOfVoice, planningDraft.brandGuide.visualStyle],
  );

  const deliveryWorkflowReadyCount = useMemo(
    () => [
      planningDraft.deliveryWorkflow.fileNamingConvention,
      planningDraft.deliveryWorkflow.versioningRule,
      planningDraft.deliveryWorkflow.folderStructure,
      planningDraft.deliveryWorkflow.draftVsFinalRule,
      planningDraft.deliveryWorkflow.backupRoutine,
      planningDraft.deliveryWorkflow.deliveryCadence,
    ].filter((value) => hasText(value ?? '')).length,
    [planningDraft.deliveryWorkflow],
  );
  const deliveryWorkflowMissingItems = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(planningDraft.deliveryWorkflow.fileNamingConvention)) {
      items.push({ id: 'delivery-file-naming', label: 'Filnavnregel mangler' });
    }
    if (!hasText(planningDraft.deliveryWorkflow.versioningRule)) {
      items.push({ id: 'delivery-versioning', label: 'Versjoneringsregel mangler' });
    }
    if (!hasText(planningDraft.deliveryWorkflow.folderStructure)) {
      items.push({ id: 'delivery-folders', label: 'Mappestruktur mangler' });
    }
    if (!hasText(planningDraft.deliveryWorkflow.draftVsFinalRule)) {
      items.push({ id: 'delivery-draft-final', label: 'Draft vs final mangler' });
    }
    if (!hasText(planningDraft.deliveryWorkflow.backupRoutine)) {
      items.push({ id: 'delivery-backup', label: 'Backuprutine mangler' });
    }
    if (!hasText(planningDraft.deliveryWorkflow.deliveryCadence)) {
      items.push({ id: 'delivery-cadence', label: 'Leveringsrytme mangler' });
    }
    return items;
  }, [planningDraft.deliveryWorkflow]);
  const deliveryWorkflowSummary = useMemo(() => {
    if (deliveryWorkflowMissingItems.length > 0) {
      return '';
    }
    return readFirstNonEmptyString(
      [
        planningDraft.deliveryWorkflow.fileNamingConvention,
        planningDraft.deliveryWorkflow.versioningRule,
        planningDraft.deliveryWorkflow.folderStructure,
      ].filter((value) => hasText(value ?? '')).join(' · '),
      'Leveringsrutinen er klar for team og overlevering.',
    );
  }, [
    deliveryWorkflowMissingItems.length,
    planningDraft.deliveryWorkflow.fileNamingConvention,
    planningDraft.deliveryWorkflow.folderStructure,
    planningDraft.deliveryWorkflow.versioningRule,
  ]);
  const selectedDeliveryPreset = useMemo(
    () => getProducerDeliveryWorkflowPreset(planningDraft.deliveryWorkflow.presetId),
    [planningDraft.deliveryWorkflow.presetId],
  );
  const accountAccessEntries = useMemo(
    () => [...planningDraft.accountAccess.entries].sort(
      (left, right) => ACCOUNT_ACCESS_PLATFORM_ORDER.indexOf(left.platform) - ACCOUNT_ACCESS_PLATFORM_ORDER.indexOf(right.platform),
    ),
    [planningDraft.accountAccess.entries],
  );
  const accessVaultSecretsByPlatform = useMemo(() => {
    const lookup = new Map<ProducerAccountAccessPlatform, RoleRoomAccessVaultSecretSummary>();
    accessVaultState.secrets.forEach((entry) => {
      lookup.set(entry.platform, entry);
    });
    return lookup;
  }, [accessVaultState.secrets]);
  const accessVaultRequestsByPlatform = useMemo(() => {
    const lookup = new Map<ProducerAccountAccessPlatform, RoleRoomAccessVaultRevealRequest[]>();
    accessVaultState.requests.forEach((request) => {
      const current = lookup.get(request.platform) ?? [];
      current.push(request);
      lookup.set(request.platform, current);
    });
    return lookup;
  }, [accessVaultState.requests]);
  const currentRoleRoomUserId = useMemo(() => {
    if (typeof roleRoomSession.currentUserId === 'string' && roleRoomSession.currentUserId.trim().length > 0) {
      return roleRoomSession.currentUserId.trim();
    }
    return '';
  }, [roleRoomSession.currentUserId]);

  useEffect(() => {
    setAccessVaultDrafts((previous) => {
      const next: Partial<Record<ProducerAccountAccessPlatform, VaultSecretDraft>> = { ...previous };
      accountAccessEntries.forEach((entry) => {
        const existingDraft = previous[entry.platform];
        const serverSecret = accessVaultSecretsByPlatform.get(entry.platform);
        next[entry.platform] = {
          ...(existingDraft ?? EMPTY_VAULT_SECRET_DRAFT),
          label: existingDraft?.label ?? serverSecret?.label ?? entry.accountLabel ?? '',
          secretType: existingDraft?.secretType ?? serverSecret?.secretType ?? entry.secretLabel ?? '',
          maskedReference: existingDraft?.maskedReference ?? serverSecret?.maskedReference ?? entry.maskedReference ?? '',
          expiresAt: existingDraft?.expiresAt ?? toDateTimeLocalValue(serverSecret?.expiresAt ?? entry.expiresAt),
        };
      });
      return next;
    });
  }, [accessVaultSecretsByPlatform, accountAccessEntries]);
  const requiredAccountPlatforms = useMemo(() => {
    const signature = planningDraft.contentCalendar
      .map((item) => `${item.channel ?? ''} ${item.format ?? ''}`)
      .join(' ')
      .toLowerCase();
    const required = new Set<ProducerAccountAccessPlatform>();
    if (signature.includes('meta') || signature.includes('reels') || signature.includes('stories') || signature.includes('instagram') || signature.includes('facebook')) {
      required.add('meta');
    }
    if (signature.includes('linkedin')) {
      required.add('linkedin');
    }
    if (signature.includes('youtube') || signature.includes('webinar')) {
      required.add('youtube');
    }
    if (signature.includes('tiktok')) {
      required.add('tiktok');
    }
    return required;
  }, [planningDraft.contentCalendar]);
  const effectiveAccountEntries = useMemo(
    () => accountAccessEntries,
    [accountAccessEntries],
  );
  const requiredAccountEntries = useMemo(
    () => effectiveAccountEntries.filter((entry) => requiredAccountPlatforms.has(entry.platform)),
    [effectiveAccountEntries, requiredAccountPlatforms],
  );
  const connectedRequiredAccountCount = useMemo(
    () => requiredAccountEntries.filter((entry) => entry.status === 'connected').length,
    [requiredAccountEntries],
  );
  const pendingRequiredAccountCount = useMemo(
    () => requiredAccountEntries.filter((entry) => entry.status !== 'connected').length,
    [requiredAccountEntries],
  );
  const accountAccessSummary = useMemo(() => {
    if (requiredAccountEntries.length === 0) {
      return 'Ingen kontoer er markert som nødvendige ennå.';
    }
    return readFirstNonEmptyString(
      requiredAccountEntries
        .map((entry) => `${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}: ${PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status]}`)
        .slice(0, 3)
        .join(' · '),
      'Konto- og publiseringstilgang er ikke avklart ennå.',
    );
  }, [requiredAccountEntries]);
  const accountAccessMissingItems = useMemo(
    () => requiredAccountEntries
      .filter((entry) => entry.status !== 'connected')
      .map((entry) => ({
        id: `account-${entry.platform}`,
        label: `${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]} venter på sikker tilgang`,
      })),
    [requiredAccountEntries],
  );
  const accountAccessVaultTab = planningDraft.accountAccess.activeVaultTab ?? 'accounts';
  const accountAccessEntryWarnings = useMemo(() => (
    effectiveAccountEntries.reduce<Record<string, string>>((accumulator, entry) => {
      const warning = detectAccountAccessSecret(entry.notes);
      if (warning) {
        accumulator[`entry:${entry.platform}:notes`] = warning;
      }
      return accumulator;
    }, {})
  ), [effectiveAccountEntries]);
  const accountAccessWorkspaceWarnings = useMemo(() => {
    const warnings: Record<string, string> = {};
    const securityWarning = detectAccountAccessSecret(planningDraft.accountAccess.securityNotes);
    if (securityWarning) {
      warnings.securityNotes = securityWarning;
    }
    const emergencyWarning = detectAccountAccessSecret(planningDraft.accountAccess.emergencyAccessNotes);
    if (emergencyWarning) {
      warnings.emergencyAccessNotes = emergencyWarning;
    }
    const revokeWarning = detectAccountAccessSecret(planningDraft.accountAccess.revokePlan);
    if (revokeWarning) {
      warnings.revokePlan = revokeWarning;
    }
    return warnings;
  }, [
    planningDraft.accountAccess.emergencyAccessNotes,
    planningDraft.accountAccess.revokePlan,
    planningDraft.accountAccess.securityNotes,
  ]);
  const accountAccessGuardrailMessages = useMemo(
    () => [...Object.values(accountAccessEntryWarnings), ...Object.values(accountAccessWorkspaceWarnings)],
    [accountAccessEntryWarnings, accountAccessWorkspaceWarnings],
  );
  const accountAccessHasSensitiveContent = accountAccessGuardrailMessages.length > 0;

  const briefReadyCount = useMemo(
    () => [
      intakeDraft.projectGoal,
      intakeDraft.deliverables,
      intakeDraft.targetAudience,
      intakeDraft.keyMessage,
      intakeDraft.contactName,
      intakeDraft.contactEmail,
    ].filter((value) => hasText(value ?? '')).length,
    [
      intakeDraft.contactEmail,
      intakeDraft.contactName,
      intakeDraft.deliverables,
      intakeDraft.keyMessage,
      intakeDraft.projectGoal,
      intakeDraft.targetAudience,
    ],
  );

  const linkedCalendarMaterialCount = useMemo(
    () => materials.filter((material) => hasText(parseMaterialMetadata(material).linkedCalendarItemId)).length,
    [materials],
  );

  const openMeetingFollowUpCount = useMemo(
    () => planningDraft.meetingWorkspace.followUps.filter((item) => item.status !== 'done').length,
    [planningDraft.meetingWorkspace.followUps],
  );

  const meetingAgendaCoverageCount = useMemo(
    () => planningDraft.meetingWorkspace.agenda.filter((item) => hasText(item.title)).length,
    [planningDraft.meetingWorkspace.agenda],
  );

  const clientGroundingRequests = useMemo(() => {
    const requests: string[] = [];

    if (!hasText(intakeDraft.projectGoal)) {
      requests.push('Beskriv tydelig hva prosjektet skal oppnå.');
    }
    if (!hasText(intakeDraft.deliverables)) {
      requests.push('List opp hvilke leveranser, formater og kanaler som faktisk er ønsket.');
    }
    if (!hasText(intakeDraft.targetAudience)) {
      requests.push('Presiser hvem innholdet skal treffe.');
    }
    if (!hasText(intakeDraft.keyMessage)) {
      requests.push('Formuler hovedbudskapet som må sitte igjen etter leveransen.');
    }
    if (!materials.some((item) => item.entry_type === 'brand_asset')) {
      requests.push('Legg inn logo, profilmanual, fonter og andre merkevarefiler.');
    }
    if (!materials.some((item) => item.entry_type === 'reference')) {
      requests.push('Legg inn visuelle referanser eller tidligere filmer som peker retning.');
    }
    if (!materials.some((item) => item.entry_type === 'document')) {
      requests.push('Legg inn dokumentasjon, faktaark, sikkerhetskrav eller annen faginfo.');
    }
    if (planningDraft.contentCalendar.length > 0 && !hasText(intakeDraft.materialOverview)) {
      requests.push('Beskriv hvilket eksisterende materiale som kan gjenbrukes i content-kalenderen.');
    }
    if (shotLists.length > 0 && !materials.some((item) => hasText(item.linked_shot_list_id))) {
      requests.push('Knytt minst ett relevant materiale til shotlist der det finnes scene- eller leveransespesifikke avhengigheter.');
    }

    return requests.slice(0, 6);
  }, [
    intakeDraft.deliverables,
    intakeDraft.keyMessage,
    intakeDraft.materialOverview,
    intakeDraft.projectGoal,
    intakeDraft.targetAudience,
    materials,
    planningDraft.contentCalendar.length,
    shotLists.length,
  ]);

  const clientContributionTasks = useMemo(
    () => getProducerClientContributionTasks(planningDraft, intakeDraft, materials)
      .filter((task) => task.status !== 'ready')
      .slice(0, 6),
    [intakeDraft, materials, planningDraft],
  );
  const missingGoalFields = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(intakeDraft.projectGoal)) {
      items.push({ id: 'project-goal', label: 'Prosjektmål mangler' });
    }
    if (!hasText(intakeDraft.deliverables)) {
      items.push({ id: 'deliverables', label: 'Leveranser mangler' });
    }
    return items;
  }, [
    intakeDraft.deliverables,
    intakeDraft.projectGoal,
  ]);
  const missingAudienceFields = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(intakeDraft.targetAudience)) {
      items.push({ id: 'target-audience', label: 'Målgruppe mangler' });
    }
    if (!hasText(intakeDraft.keyMessage)) {
      items.push({ id: 'key-message', label: 'Kjernebudskap mangler' });
    }
    return items;
  }, [
    intakeDraft.keyMessage,
    intakeDraft.targetAudience,
  ]);
  const missingLogicFields = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(contentLogicDraft.objective)) {
      items.push({ id: 'logic-objective', label: 'Content Logic-mål mangler' });
    }
    if (!hasText(contentLogicDraft.audience)) {
      items.push({ id: 'logic-audience', label: 'Content Logic-målgruppe mangler' });
    }
    if (!hasText(contentLogicDraft.hook)) {
      items.push({ id: 'logic-hook', label: 'Hook mangler' });
    }
    if (!hasText(contentLogicDraft.callToAction)) {
      items.push({ id: 'logic-cta', label: 'CTA mangler' });
    }
    return items;
  }, [
    contentLogicDraft.audience,
    contentLogicDraft.callToAction,
    contentLogicDraft.hook,
    contentLogicDraft.objective,
  ]);
  const missingFoundationFields = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(intakeDraft.timingConstraints)) {
      items.push({ id: 'timing-constraints', label: 'Tidsrammer og avhengigheter mangler' });
    }
    if (!hasText(intakeDraft.brandNotes)) {
      items.push({ id: 'brand-notes', label: 'Merkevarenotater mangler' });
    }
    if (!hasText(intakeDraft.materialOverview)) {
      items.push({ id: 'material-overview', label: 'Eksisterende materiale er ikke beskrevet' });
    }
    return items;
  }, [
    intakeDraft.brandNotes,
    intakeDraft.materialOverview,
    intakeDraft.timingConstraints,
  ]);
  const missingReferenceFields = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(intakeDraft.referenceLinks) && !materials.some((item) => item.entry_type === 'reference')) {
      items.push({ id: 'reference-links', label: 'Referanser mangler' });
    }
    if (contentLogicDraft.proofPoints.length === 0) {
      items.push({ id: 'proof-points', label: 'Proof points mangler' });
    }
    if (!hasText(contentLogicDraft.distributionPlan)) {
      items.push({ id: 'distribution-plan', label: 'Distribusjonsplan mangler' });
    }
    return items;
  }, [
    contentLogicDraft.distributionPlan,
    contentLogicDraft.proofPoints.length,
    intakeDraft.referenceLinks,
    materials,
  ]);
  const missingContactFields = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(intakeDraft.contactName)) {
      items.push({ id: 'contact-name', label: 'Kontaktperson mangler' });
    }
    if (!hasText(intakeDraft.contactEmail)) {
      items.push({ id: 'contact-email', label: 'Kontakt-e-post mangler' });
    }
    return items;
  }, [
    intakeDraft.contactEmail,
    intakeDraft.contactName,
  ]);
  const briefMissingItems = useMemo(() => {
    return [
      ...missingGoalFields,
      ...missingAudienceFields,
      ...missingLogicFields,
      ...missingContactFields,
    ];
  }, [missingAudienceFields, missingContactFields, missingGoalFields, missingLogicFields]);
  const foundationBlockingItems = useMemo(
    () => [...briefMissingItems, ...missingFoundationFields, ...missingReferenceFields],
    [briefMissingItems, missingFoundationFields, missingReferenceFields],
  );
  const recommendedBriefStep = useMemo<BriefStepKey>(() => {
    if (missingGoalFields.length > 0) {
      return 'goal';
    }
    if (missingAudienceFields.length > 0) {
      return 'audience';
    }
    if (missingLogicFields.length > 0) {
      return 'logic';
    }
    if (missingFoundationFields.length > 0) {
      return 'foundation';
    }
    if (missingReferenceFields.length > 0) {
      return 'references';
    }
    if (missingContactFields.length > 0) {
      return 'contact';
    }
    return 'goal';
  }, [
    missingAudienceFields.length,
    missingContactFields.length,
    missingFoundationFields.length,
    missingGoalFields.length,
    missingLogicFields.length,
    missingReferenceFields.length,
  ]);
  const briefStepProgress = useMemo(() => ({
    goal: {
      ready: 2 - missingGoalFields.length,
      total: 2,
    },
    audience: {
      ready: 2 - missingAudienceFields.length,
      total: 2,
    },
    logic: {
      ready: 4 - missingLogicFields.length,
      total: 4,
    },
    foundation: {
      ready: 3 - missingFoundationFields.length,
      total: 3,
    },
    references: {
      ready: 3 - missingReferenceFields.length,
      total: 3,
    },
    contact: {
      ready: 2 - missingContactFields.length,
      total: 2,
    },
  }), [
    missingAudienceFields.length,
    missingContactFields.length,
    missingFoundationFields.length,
    missingGoalFields.length,
    missingLogicFields.length,
    missingReferenceFields.length,
  ]);
  const briefStepDescriptors = useMemo(() => ([
    {
      key: 'goal' as const,
      label: 'Mål og leveranse',
      description: 'Hva prosjektet skal oppnå og hva som faktisk skal leveres.',
      status: briefStepProgress.goal.ready === briefStepProgress.goal.total
        ? 'Klar'
        : `${briefStepProgress.goal.ready}/${briefStepProgress.goal.total} fylt`,
      missing: missingGoalFields,
    },
    {
      key: 'audience' as const,
      label: 'Målgruppe og budskap',
      description: 'Hvem innholdet er for og hva de skal sitte igjen med.',
      status: briefStepProgress.audience.ready === briefStepProgress.audience.total
        ? 'Klar'
        : `${briefStepProgress.audience.ready}/${briefStepProgress.audience.total} fylt`,
      missing: missingAudienceFields,
    },
    {
      key: 'logic' as const,
      label: 'Content Logic',
      description: 'Mål, krok og handling slik produsenten planlegger videre.',
      status: briefStepProgress.logic.ready === briefStepProgress.logic.total
        ? 'Klar'
        : `${briefStepProgress.logic.ready}/${briefStepProgress.logic.total} fylt`,
      missing: missingLogicFields,
    },
    {
      key: 'foundation' as const,
      label: 'Grunnlag',
      description: 'Tidsrammer, avklaringer og hva som allerede finnes.',
      status: briefStepProgress.foundation.ready === briefStepProgress.foundation.total
        ? 'Klar'
        : `${briefStepProgress.foundation.ready}/${briefStepProgress.foundation.total} fylt`,
      missing: missingFoundationFields,
    },
    {
      key: 'references' as const,
      label: 'Referanser og bevis',
      description: 'Referanser, proof points og hvordan innholdet skal fordeles.',
      status: briefStepProgress.references.ready === briefStepProgress.references.total
        ? 'Klar'
        : `${briefStepProgress.references.ready}/${briefStepProgress.references.total} fylt`,
      missing: missingReferenceFields,
    },
    {
      key: 'contact' as const,
      label: 'Kontakt',
      description: 'Kontaktpunkt og siste avklaringer.',
      status: briefStepProgress.contact.ready === briefStepProgress.contact.total
        ? 'Klar'
        : `${briefStepProgress.contact.ready}/${briefStepProgress.contact.total} fylt`,
      missing: missingContactFields,
    },
  ]), [
    briefStepProgress,
    missingAudienceFields,
    missingContactFields,
    missingFoundationFields,
    missingGoalFields,
    missingLogicFields,
    missingReferenceFields,
  ]);
  const activeBriefStepDescriptor = useMemo(
    () => briefStepDescriptors.find((step) => step.key === activeBriefStep) ?? briefStepDescriptors[0],
    [activeBriefStep, briefStepDescriptors],
  );
  const activeBriefStepIndex = useMemo(
    () => Math.max(briefStepDescriptors.findIndex((step) => step.key === activeBriefStep), 0),
    [activeBriefStep, briefStepDescriptors],
  );
  const completedBriefStepCount = useMemo(
    () => briefStepDescriptors.filter((step) => step.missing.length === 0).length,
    [briefStepDescriptors],
  );
  const previousBriefStepDescriptor = useMemo(
    () => briefStepDescriptors[Math.max(activeBriefStepIndex - 1, 0)] ?? null,
    [activeBriefStepIndex, briefStepDescriptors],
  );
  const nextBriefStepDescriptor = useMemo(
    () => briefStepDescriptors[Math.min(activeBriefStepIndex + 1, briefStepDescriptors.length - 1)] ?? null,
    [activeBriefStepIndex, briefStepDescriptors],
  );
  const visibleLibraryMaterials = useMemo(
    () => (showAllMaterials ? sortedMaterials : sortedMaterials.slice(0, 4)),
    [showAllMaterials, sortedMaterials],
  );
  const briefReferenceMaterials = useMemo(
    () => sortedMaterials.filter((material) => material.entry_type === 'reference').slice(0, 3),
    [sortedMaterials],
  );
  const briefReferenceDraftActive = materialDraft.entryType === 'reference';
  const canSubmitBriefReference = briefReferenceDraftActive
    && (Boolean(selectedMaterialFile) || hasText(materialDraft.projectFileId));
  const activeBriefStepSummary = useMemo(() => {
    if (activeBriefStep === 'goal') {
      return readFirstNonEmptyString(
        intakeDraft.projectGoal,
        intakeDraft.deliverables,
        'Mål og leveranse er ikke skrevet inn ennå.',
      );
    }
    if (activeBriefStep === 'audience') {
      return readFirstNonEmptyString(
        intakeDraft.targetAudience,
        intakeDraft.keyMessage,
        'Målgruppe og kjernebudskap er ikke beskrevet ennå.',
      );
    }
    if (activeBriefStep === 'logic') {
      return readFirstNonEmptyString(
        contentLogicDraft.objective,
        contentLogicDraft.hook,
        contentLogicDraft.callToAction,
        'Content Logic er ikke fylt ut ennå.',
      );
    }
    if (activeBriefStep === 'foundation') {
      return readFirstNonEmptyString(
        intakeDraft.timingConstraints,
        intakeDraft.materialOverview,
        intakeDraft.brandNotes,
        'Avhengigheter, materiale og avklaringer er ikke beskrevet ennå.',
      );
    }
    if (activeBriefStep === 'references') {
      return readFirstNonEmptyString(
        intakeDraft.referenceLinks,
        stringifyLineSeparatedValues(contentLogicDraft.proofPoints),
        contentLogicDraft.distributionPlan,
        'Referanser, proof points og distribusjon er ikke beskrevet ennå.',
      );
    }
    return readFirstNonEmptyString(
      intakeDraft.contactName,
      intakeDraft.contactEmail,
      intakeDraft.contactPhone,
      'Kontaktpunkt og siste avklaringer er ikke lagt inn ennå.',
    );
  }, [
    activeBriefStep,
    contentLogicDraft.callToAction,
    contentLogicDraft.distributionPlan,
    contentLogicDraft.hook,
    contentLogicDraft.objective,
    contentLogicDraft.proofPoints,
    intakeDraft.contactEmail,
    intakeDraft.contactName,
    intakeDraft.contactPhone,
    intakeDraft.deliverables,
    intakeDraft.brandNotes,
    intakeDraft.keyMessage,
    intakeDraft.materialOverview,
    intakeDraft.projectGoal,
    intakeDraft.referenceLinks,
    intakeDraft.timingConstraints,
    intakeDraft.targetAudience,
  ]);
  const briefSummarySections = useMemo(() => ([
    {
      key: 'goal',
      label: 'Mål',
      value: readFirstNonEmptyString(
        intakeDraft.projectGoal,
        contentLogicDraft.objective,
      ),
      helper: 'Hva prosjektet skal oppnå.',
      status: hasText(intakeDraft.projectGoal) || hasText(contentLogicDraft.objective) ? 'filled' : 'missing',
    },
    {
      key: 'deliverables',
      label: 'Leveranse',
      value: readFirstNonEmptyString(
        intakeDraft.deliverables,
        intakeDraft.materialOverview,
      ),
      helper: 'Hva som faktisk skal leveres.',
      status: hasText(intakeDraft.deliverables) ? 'filled' : 'missing',
    },
    {
      key: 'audience',
      label: 'Målgruppe',
      value: readFirstNonEmptyString(
        intakeDraft.targetAudience,
        contentLogicDraft.audience,
      ),
      helper: 'Hvem innholdet er for.',
      status: hasText(intakeDraft.targetAudience) || hasText(contentLogicDraft.audience) ? 'filled' : 'missing',
    },
    {
      key: 'message',
      label: 'Budskap og handling',
      value: readFirstNonEmptyString(
        intakeDraft.keyMessage,
        contentLogicDraft.hook,
        contentLogicDraft.callToAction,
      ),
      helper: 'Hva publikum skal sitte igjen med og gjøre.',
      status: hasText(intakeDraft.keyMessage) || hasText(contentLogicDraft.hook) || hasText(contentLogicDraft.callToAction) ? 'filled' : 'missing',
    },
    {
      key: 'references',
      label: 'Referanser og bevis',
      value: readFirstNonEmptyString(
        intakeDraft.referenceLinks,
        stringifyLineSeparatedValues(contentLogicDraft.proofPoints),
        contentLogicDraft.distributionPlan,
        briefReferenceMaterials.length > 0 ? `${briefReferenceMaterials.length} referanse${briefReferenceMaterials.length === 1 ? '' : 'r'} lastet opp` : '',
      ),
      helper: 'Referanser, proof points og distribusjon.',
      status: hasText(intakeDraft.referenceLinks)
        || contentLogicDraft.proofPoints.length > 0
        || hasText(contentLogicDraft.distributionPlan)
        || briefReferenceMaterials.length > 0
        ? 'filled'
        : 'missing',
    },
    {
      key: 'contact',
      label: 'Kontakt',
      value: readFirstNonEmptyString(
        intakeDraft.contactName,
        intakeDraft.contactEmail,
        intakeDraft.contactPhone,
      ),
      helper: 'Hvem produsenten følger opp.',
      status: hasText(intakeDraft.contactName) || hasText(intakeDraft.contactEmail) ? 'filled' : 'missing',
    },
  ]), [
    briefReferenceMaterials.length,
    contentLogicDraft.audience,
    contentLogicDraft.callToAction,
    contentLogicDraft.distributionPlan,
    contentLogicDraft.hook,
    contentLogicDraft.objective,
    contentLogicDraft.proofPoints,
    intakeDraft.contactEmail,
    intakeDraft.contactName,
    intakeDraft.contactPhone,
    intakeDraft.deliverables,
    intakeDraft.keyMessage,
    intakeDraft.materialOverview,
    intakeDraft.projectGoal,
    intakeDraft.referenceLinks,
    intakeDraft.targetAudience,
  ]);
  const briefSummaryMissingCount = useMemo(
    () => briefSummarySections.filter((section) => section.status !== 'filled').length,
    [briefSummarySections],
  );
  const materialSourceMissingItems = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(materialDraft.title)) {
      items.push({ id: 'material-title', label: 'Materialet må ha en tittel før du går videre.' });
    }
    return items;
  }, [materialDraft.title]);
  const materialWizardDescriptors = useMemo(() => ([
    {
      key: 'source' as const,
      label: 'Start',
      description: 'Velg mal, fil eller lenke og gi materialet et tydelig navn.',
      missing: materialSourceMissingItems,
    },
    {
      key: 'details' as const,
      label: 'Detaljer',
      description: 'Beskriv hva materialet er, hvor viktig det er, og hvilken fase det tilhører.',
      missing: !hasText(materialDraft.description) && !hasText(materialDraft.usageNotes)
        ? [{ id: 'material-description', label: 'Legg gjerne inn en kort beskrivelse eller brukskontekst.' }]
        : [],
    },
    {
      key: 'linking' as const,
      label: 'Kobling',
      description: 'Knytt materialet til plan, shotlist eller leveringsstruktur når det er relevant.',
      missing: !hasText(materialDraft.linkedCalendarItemId)
        && !hasText(materialDraft.linkedShotListId)
        && !hasText(materialDraft.folderPath)
        && !hasText(materialDraft.packageName)
        ? [{ id: 'material-linking', label: 'Vurder å koble materialet til plan eller leveranse før du lagrer.' }]
        : [],
    },
    {
      key: 'review' as const,
      label: 'Kontroll',
      description: 'Se over oppsettet og lagre materialet når det er klart.',
      missing: [],
    },
  ]), [
    materialDraft.description,
    materialDraft.folderPath,
    materialDraft.linkedCalendarItemId,
    materialDraft.linkedShotListId,
    materialDraft.packageName,
    materialDraft.usageNotes,
    materialSourceMissingItems,
  ]);
  const activeMaterialWizardDescriptor = useMemo(
    () => materialWizardDescriptors.find((step) => step.key === activeMaterialWizardStep) ?? materialWizardDescriptors[0],
    [activeMaterialWizardStep, materialWizardDescriptors],
  );
  const activeMaterialWizardIndex = useMemo(
    () => Math.max(materialWizardDescriptors.findIndex((step) => step.key === activeMaterialWizardStep), 0),
    [activeMaterialWizardStep, materialWizardDescriptors],
  );
  const previousMaterialWizardDescriptor = useMemo(
    () => materialWizardDescriptors[Math.max(activeMaterialWizardIndex - 1, 0)] ?? null,
    [activeMaterialWizardIndex, materialWizardDescriptors],
  );
  const nextMaterialWizardDescriptor = useMemo(
    () => materialWizardDescriptors[Math.min(activeMaterialWizardIndex + 1, materialWizardDescriptors.length - 1)] ?? null,
    [activeMaterialWizardIndex, materialWizardDescriptors],
  );
  const isMaterialWizardActive = materialWizardEnabled && materialsMode === 'capture';
  const completedMaterialStepCount = useMemo(
    () => materialWizardDescriptors.filter((step) => step.missing.length === 0).length,
    [materialWizardDescriptors],
  );
  const activeMaterialStepStatusLabel = activeMaterialWizardDescriptor.missing.length === 0
    ? 'Fylt ut'
    : activeMaterialWizardStep === 'source'
      ? 'Mangler'
      : 'Anbefalt';
  const canAdvanceMaterialWizard = activeMaterialWizardStep !== 'source' || materialSourceMissingItems.length === 0;
  const materialWizardReviewRows = useMemo(() => ([
    {
      label: 'Type',
      value: MATERIAL_TYPE_LABELS[materialDraft.entryType],
    },
    {
      label: 'Tittel',
      value: readFirstNonEmptyString(materialDraft.title, 'Ikke satt'),
    },
    {
      label: 'Beskrivelse',
      value: readFirstNonEmptyString(materialDraft.description, materialDraft.usageNotes, 'Ikke beskrevet'),
    },
    {
      label: 'Fase',
      value: materialDraft.phase ? PRODUCER_PLANNING_PHASE_LABELS[materialDraft.phase] : 'Ikke koblet til fase',
    },
    {
      label: 'Kobling',
      value: readFirstNonEmptyString(
        contentCalendarOptions.find((option) => option.id === materialDraft.linkedCalendarItemId)?.label,
        shotListOptions.find((option) => option.id === materialDraft.linkedShotListId)?.label,
        'Ingen kobling valgt',
      ),
    },
    {
      label: 'Leveranse',
      value: readFirstNonEmptyString(
        materialDraft.folderPath,
        materialDraft.packageName,
        materialDraft.fileName,
        'Ikke plassert i leveranseflyten',
      ),
    },
  ]), [
    contentCalendarOptions,
    materialDraft.description,
    materialDraft.entryType,
    materialDraft.fileName,
    materialDraft.folderPath,
    materialDraft.linkedCalendarItemId,
    materialDraft.linkedShotListId,
    materialDraft.packageName,
    materialDraft.phase,
    materialDraft.title,
    materialDraft.usageNotes,
    shotListOptions,
  ]);
  const activeMaterialStepSummary = useMemo(() => {
    if (activeMaterialWizardDescriptor.missing.length > 0) {
      return '';
    }
    const linkedCalendarLabel = contentCalendarOptions.find((option) => option.id === materialDraft.linkedCalendarItemId)?.label ?? '';
    const linkedShotListLabel = shotListOptions.find((option) => option.id === materialDraft.linkedShotListId)?.label ?? '';
    if (activeMaterialWizardStep === 'source') {
      return readFirstNonEmptyString(
        hasText(materialDraft.title) ? `${MATERIAL_TYPE_LABELS[materialDraft.entryType]}: ${materialDraft.title}` : '',
        materialDraft.projectFileId ? `Prosjektfil er koblet til materialet.` : '',
        hasText(materialDraft.externalUrl) ? 'Ekstern lenke er lagt inn.' : '',
        'Start er klart for neste steg.',
      );
    }
    if (activeMaterialWizardStep === 'details') {
      return readFirstNonEmptyString(
        materialDraft.description,
        materialDraft.usageNotes,
        materialDraft.phase ? `Knyttet til ${PRODUCER_PLANNING_PHASE_LABELS[materialDraft.phase]}.` : '',
        'Detaljene er klare for neste steg.',
      );
    }
    if (activeMaterialWizardStep === 'linking') {
      return readFirstNonEmptyString(
        linkedCalendarLabel ? `Koblet til ${linkedCalendarLabel}.` : '',
        linkedShotListLabel ? `Koblet til shotlist: ${linkedShotListLabel}.` : '',
        hasText(materialDraft.folderPath) || hasText(materialDraft.packageName)
          ? readFirstNonEmptyString(
            materialDraft.folderPath ? `Leveringsmappe: ${materialDraft.folderPath}.` : '',
            materialDraft.packageName ? `Pakke: ${materialDraft.packageName}.` : '',
          )
          : '',
        'Koblingene er klare for lagring.',
      );
    }
    return 'Materialet er klart til å lagres.';
  }, [
    activeMaterialWizardDescriptor.missing.length,
    activeMaterialWizardStep,
    contentCalendarOptions,
    materialDraft.description,
    materialDraft.entryType,
    materialDraft.externalUrl,
    materialDraft.folderPath,
    materialDraft.linkedCalendarItemId,
    materialDraft.linkedShotListId,
    materialDraft.packageName,
    materialDraft.phase,
    materialDraft.projectFileId,
    materialDraft.title,
    materialDraft.usageNotes,
    shotListOptions,
  ]);
  useEffect(() => {
    if (activeWorkspace === 'brief') {
      setActiveBriefStep((previous) => (briefWizardEnabled ? recommendedBriefStep : previous));
      return;
    }
    if (activeWorkspace === 'materials') {
      setMaterialsMode(
        materialWizardEnabled
          ? 'capture'
          : materialDraft.id || selectedMaterialFile || materials.length === 0
            ? 'capture'
            : 'library',
      );
    }
  }, [activeWorkspace, briefWizardEnabled, materialDraft.id, materialWizardEnabled, materials.length, recommendedBriefStep, selectedMaterialFile]);
  useEffect(() => {
    if (briefWizardEnabled) {
      setActiveBriefStep(recommendedBriefStep);
    }
  }, [briefWizardEnabled, recommendedBriefStep]);
  useEffect(() => {
    if (activeWorkspace === 'materials' && isMaterialWizardActive) {
      setActiveMaterialWizardStep(materialDraft.id ? 'details' : 'source');
    }
  }, [activeWorkspace, isMaterialWizardActive, materialDraft.id]);
  useEffect(() => {
    if (materialsMode !== 'library') {
      setShowAllMaterials(false);
    }
  }, [materialsMode]);
  const pendingReviewCount = useMemo(
    () => reviews.filter((review) => review.status === 'pending' || review.status === 'changes_requested').length,
    [reviews],
  );
  const workflowReadinessCards = useMemo(() => ([
    {
      key: 'foundation',
      label: 'Produksjonsgrunnlag',
      value: `${briefReadyCount}/6 brief · ${materials.length} materialer`,
      tone: briefMissingItems.length > 0 ? '#fde68a' : '#86efac',
    },
    {
      key: 'production',
      label: 'Produksjon',
      value: foundationBlockingItems.length > 0 ? 'Venter på produksjonsgrunnlag' : `${storyboardCount} storyboard · ${shotCount} shots`,
      tone: foundationBlockingItems.length > 0 ? '#94a3b8' : (storyboardCount > 0 || shotCount > 0 ? '#bfdbfe' : '#cbd5e1'),
    },
    {
      key: 'decision',
      label: 'Beslutning',
      value: foundationBlockingItems.length > 0 ? 'Låst til grunnlaget er klart' : `${pendingReviewCount} åpne reviews · ${openMeetingFollowUpCount} oppfølging`,
      tone: foundationBlockingItems.length > 0 ? '#94a3b8' : (pendingReviewCount > 0 || openMeetingFollowUpCount > 0 ? '#fcd34d' : '#86efac'),
    },
  ]), [
    foundationBlockingItems.length,
    briefReadyCount,
    materials.length,
    openMeetingFollowUpCount,
    pendingReviewCount,
    shotCount,
    storyboardCount,
  ]);
  const briefBlocksForwardFlow = foundationBlockingItems.length > 0;

  const openSurfaceWorkspace = useCallback((
    surface: ProducerWorkspaceSurfaceKey,
    options?: { artifactId?: string },
  ) => {
    const nextSection = workspaceSections.find((section) => flattenProducerWorkspacePages(section).some((page) => page.surface === surface));
    if (!nextSection) {
      return;
    }
    const nextPage = flattenProducerWorkspacePages(nextSection).find((page) => page.surface === surface);
    setFocusedArtifactId(options?.artifactId?.trim() || null);
    selectSection(nextSection.id);
    if (nextPage) {
      selectPage(nextSection.id, nextPage.id);
    }
  }, [selectPage, selectSection, workspaceSections]);

  useEffect(() => {
    if (!focusedArtifact || activeWorkspace === focusedArtifact.surface) {
      return;
    }
    openSurfaceWorkspace(focusedArtifact.surface, { artifactId: focusedArtifact.artifactId });
  }, [activeWorkspace, focusedArtifact, openSurfaceWorkspace]);

  const applyMaterialTemplate = useCallback((template: ClientMaterialTemplate) => {
    openSurfaceWorkspace('materials');
    setMaterialsMode('capture');
    setSelectedMaterialFile(null);
    if (materialFileInputRef.current) {
      materialFileInputRef.current.value = '';
    }
    setMaterialDraft({
      ...EMPTY_MATERIAL_DRAFT,
      ...template.draft,
    });
  }, [openSurfaceWorkspace]);

  const resetMaterialFileInput = useCallback(() => {
    if (materialFileInputRef.current) {
      materialFileInputRef.current.value = '';
    }
  }, []);

  const createReferenceMaterialDraft = useCallback((): ClientMaterialDraft => {
    const referenceTemplate = CLIENT_MATERIAL_TEMPLATES.find((template) => template.id === 'reference-film');
    return {
      ...EMPTY_MATERIAL_DRAFT,
      ...(referenceTemplate?.draft ?? {}),
      entryType: 'reference',
      phase: 'preproduction',
      status: 'provided',
      sourceLabel: isClientReviewerMode ? 'Klient' : (referenceTemplate?.draft.sourceLabel ?? 'Produsent'),
      usageNotes: referenceTemplate?.draft.usageNotes ?? 'Brukes til tone, tempo og forventninger i briefen.',
    };
  }, [isClientReviewerMode]);

  const buildMaterialPayload = useCallback((draft: ClientMaterialDraft) => ({
    entryType: draft.entryType,
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    externalUrl: draft.externalUrl.trim() || undefined,
    phase: draft.phase || undefined,
    linkedShotListId: draft.linkedShotListId || undefined,
    status: draft.status.trim() || 'provided',
    metadata: {
      fileName: draft.fileName.trim() || undefined,
      versionLabel: draft.versionLabel.trim() || undefined,
      usageNotes: draft.usageNotes.trim() || undefined,
      sourceLabel: draft.sourceLabel.trim() || undefined,
      priority: draft.priority,
      linkedCalendarItemId: draft.linkedCalendarItemId || undefined,
      folderPath: draft.folderPath.trim() || undefined,
      packageName: draft.packageName.trim() || undefined,
      projectFileId: draft.projectFileId.trim() || undefined,
      projectFileDownloadUrl: draft.projectFileDownloadUrl.trim() || undefined,
    },
  } as const), []);

  const uploadMaterialProjectFile = useCallback(async (
    file: File,
    draft: ClientMaterialDraft,
  ): Promise<Partial<ClientMaterialDraft>> => {
    const normalizedPhase = draft.phase || 'general';
    const folderPath = `client-materials/${normalizedPhase}/${draft.entryType}`;
    const packageName = `${projectName.trim() || 'prosjekt'}-client-materials`;
    const uploadedFile = await uploadProjectFile(projectId, file, {
      source: 'role_room_client_material',
      entryType: draft.entryType,
      phase: draft.phase || undefined,
      linkedShotListId: draft.linkedShotListId || undefined,
      linkedCalendarItemId: draft.linkedCalendarItemId || undefined,
      folderPath,
      packageName,
      versionLabel: draft.versionLabel.trim() || 'v1',
      sourceLabel: draft.sourceLabel.trim() || (isClientReviewerMode ? 'Klient' : 'Produsent'),
      usageNotes: draft.usageNotes.trim() || undefined,
      priority: draft.priority,
    });

    const downloadUrl = readFirstNonEmptyString(
      (uploadedFile as Record<string, unknown>).downloadUrl,
    );
    const projectFileId = readFirstNonEmptyString(
      (uploadedFile as Record<string, unknown>).id,
    );

    return {
      title: draft.title.trim().length > 0
        ? draft.title
        : file.name.replace(/\.[^.]+$/u, '').trim(),
      externalUrl: downloadUrl || draft.externalUrl,
      fileName: draft.fileName.trim().length > 0 ? draft.fileName : file.name,
      versionLabel: draft.versionLabel.trim().length > 0 ? draft.versionLabel : 'v1',
      sourceLabel: draft.sourceLabel.trim().length > 0 ? draft.sourceLabel : (isClientReviewerMode ? 'Klient' : 'Produsent'),
      description: draft.description.trim().length > 0
        ? draft.description
        : `Prosjektfil lastet opp: ${file.name}`,
      usageNotes: draft.usageNotes.trim().length > 0 ? draft.usageNotes : 'Brukes som prosjektfil i klientgrunnlaget.',
      status: draft.status.trim().length > 0 ? draft.status : 'provided',
      folderPath,
      packageName,
      projectFileId,
      projectFileDownloadUrl: downloadUrl,
    };
  }, [isClientReviewerMode, projectId, projectName, uploadProjectFile]);

  const handleOpenBriefReferenceFilePicker = useCallback(() => {
    if (isBriefLockedByApproval) {
      setError('Briefen er låst fordi prosjektet er godkjent.');
      return;
    }

    setSelectedMaterialFile(null);
    resetMaterialFileInput();
    setMaterialDraft((previous) => ({
      ...createReferenceMaterialDraft(),
      title: previous.entryType === 'reference' ? previous.title : '',
      description: previous.entryType === 'reference' ? previous.description : '',
      externalUrl: previous.entryType === 'reference' ? previous.externalUrl : '',
    }));
    materialFileInputRef.current?.click();
  }, [createReferenceMaterialDraft, isBriefLockedByApproval, resetMaterialFileInput]);

  const handleOpenBriefReferenceCameraPicker = useCallback(() => {
    if (isBriefLockedByApproval) {
      setError('Briefen er låst fordi prosjektet er godkjent.');
      return;
    }

    setSelectedMaterialFile(null);
    resetMaterialFileInput();
    setMaterialDraft((previous) => ({
      ...createReferenceMaterialDraft(),
      title: previous.entryType === 'reference' ? previous.title : '',
      description: previous.entryType === 'reference' ? previous.description : '',
      externalUrl: previous.entryType === 'reference' ? previous.externalUrl : '',
    }));
    materialCameraInputRef.current?.click();
  }, [createReferenceMaterialDraft, isBriefLockedByApproval, resetMaterialFileInput]);

  const handleSubmitMaterial = useCallback(async () => {
    if (!materialDraft.title.trim()) {
      setError('Materialet må ha en tittel.');
      return;
    }

    setSavingMaterial(true);
    setError(null);
    try {
      const payload = buildMaterialPayload(materialDraft);

      if (materialDraft.id) {
        const updated = await producerWorkflowService.updateClientMaterial(projectId, materialDraft.id, payload);
        setMaterials((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await producerWorkflowService.createClientMaterial(projectId, payload);
        setMaterials((previous) => [created, ...previous]);
      }

      setMaterialDraft(EMPTY_MATERIAL_DRAFT);
      setSelectedMaterialFile(null);
      setMaterialsMode('library');
      resetMaterialFileInput();
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save client material', saveError);
      setError('Kunne ikke lagre klientmateriale.');
    } finally {
      setSavingMaterial(false);
    }
  }, [buildMaterialPayload, materialDraft, projectId, resetMaterialFileInput]);

  const handleSubmitBriefReference = useCallback(async () => {
    if (isBriefLockedByApproval) {
      setError('Briefen er låst fordi prosjektet er godkjent.');
      return;
    }

    const hasExistingProjectFile = hasText(materialDraft.projectFileId);
    if (!selectedMaterialFile && !hasExistingProjectFile) {
      setError('Velg en referansefil før du legger den til i briefen.');
      return;
    }

    setSavingMaterial(true);
    setError(null);
    try {
      const baseDraft: ClientMaterialDraft = {
        ...createReferenceMaterialDraft(),
        ...materialDraft,
        entryType: 'reference',
        phase: materialDraft.phase || 'preproduction',
        status: materialDraft.status.trim() || 'provided',
        sourceLabel: materialDraft.sourceLabel.trim() || (isClientReviewerMode ? 'Klient' : 'Produsent'),
        title: materialDraft.title.trim() || selectedMaterialFile?.name.replace(/\.[^.]+$/u, '').trim() || 'Referanse',
        description: materialDraft.description.trim() || 'Referanse lastet opp direkte i briefen.',
        usageNotes: materialDraft.usageNotes.trim() || 'Brukes til retning, tone og forventninger i briefen.',
        priority: materialDraft.priority || 'important',
      };

      const finalDraft = selectedMaterialFile
        ? {
          ...baseDraft,
          ...(await uploadMaterialProjectFile(selectedMaterialFile, baseDraft)),
        }
        : baseDraft;

      const created = await producerWorkflowService.createClientMaterial(projectId, buildMaterialPayload(finalDraft));
      setMaterials((previous) => [created, ...previous]);
      setMaterialDraft(EMPTY_MATERIAL_DRAFT);
      setSelectedMaterialFile(null);
      resetMaterialFileInput();
      void loadDeliveryWorkspaceAssets();
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save brief reference', saveError);
      setError('Kunne ikke legge til referansen i briefen.');
    } finally {
      setSavingMaterial(false);
    }
  }, [buildMaterialPayload, createReferenceMaterialDraft, isBriefLockedByApproval, isClientReviewerMode, loadDeliveryWorkspaceAssets, materialDraft, projectId, resetMaterialFileInput, selectedMaterialFile, uploadMaterialProjectFile]);

  const handleMaterialFileSelected = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedMaterialFile(nextFile);
    setMaterialsMode('capture');
    if (!nextFile) {
      return;
    }

    const derivedTitle = nextFile.name.replace(/\.[^.]+$/u, '').trim();
    setMaterialDraft((previous) => ({
      ...previous,
      title: previous.title.trim().length > 0 ? previous.title : derivedTitle,
      fileName: previous.fileName.trim().length > 0 ? previous.fileName : nextFile.name,
      versionLabel: previous.versionLabel.trim().length > 0 ? previous.versionLabel : 'v1',
      externalUrl: '',
    }));
  }, []);

  const handleOpenMaterialFilePicker = useCallback(() => {
    materialFileInputRef.current?.click();
  }, []);

  const handleOpenMaterialCameraPicker = useCallback(() => {
    setMaterialsMode('capture');
    materialCameraInputRef.current?.click();
  }, []);

  const handleUploadMaterialFile = useCallback(async () => {
    if (!selectedMaterialFile) {
      setError('Velg en fil før du laster opp til prosjektet.');
      return;
    }

    setUploadingMaterialFile(true);
    setError(null);
    try {
      const uploadResult = await uploadMaterialProjectFile(selectedMaterialFile, materialDraft);
      setMaterialDraft((previous) => ({
        ...previous,
        ...uploadResult,
      }));
      void loadDeliveryWorkspaceAssets();
      setError(null);
    } catch (uploadError) {
      console.error('[ProducerMediaPanel] Failed to upload client material file', uploadError);
      setError('Kunne ikke laste opp filen til prosjektet.');
    } finally {
      setUploadingMaterialFile(false);
    }
  }, [loadDeliveryWorkspaceAssets, materialDraft, selectedMaterialFile, uploadMaterialProjectFile]);

  const handleOpenBrandLogoFilePicker = useCallback((variantType: ProducerBrandLogoVariantType = 'primary') => {
    setBrandLogoUploadVariantType(variantType);
    brandLogoFileInputRef.current?.click();
  }, []);

  const handleBrandLogoFileSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      return;
    }

    setUploadingBrandLogo(true);
    setError(null);
    try {
      const folderPath = 'brand-assets/logo';
      const packageName = `${projectName.trim() || 'prosjekt'}-brand-guide`;
      const uploadedFile = await uploadProjectFile(projectId, nextFile, {
        source: 'role_room_brand_logo',
        folderPath,
        packageName,
        versionLabel: 'v1',
        sourceLabel: isClientReviewerMode ? 'Klient' : 'Produsent',
        usageNotes: 'Brukes som prosjektlogo i merkevareguide, preview og overlay-spec.',
      });
      const projectFileId = readFirstNonEmptyString((uploadedFile as Record<string, unknown>).id);
      const downloadUrl = readFirstNonEmptyString((uploadedFile as Record<string, unknown>).downloadUrl);
      const detection = await analyzeBrandLogoFile(nextFile);
      const nextVariant: ProducerBrandLogoVariant = {
        id: `brand-logo-variant-${brandLogoUploadVariantType}`,
        type: brandLogoUploadVariantType,
        label: BRAND_LOGO_VARIANT_LABELS[brandLogoUploadVariantType],
        fileName: nextFile.name,
        logoUrl: downloadUrl || undefined,
        projectFileId: projectFileId || undefined,
        projectFileUrl: downloadUrl || undefined,
        detection: {
          ...detection,
          sourceProjectFileId: projectFileId || detection.sourceProjectFileId,
          sourceProjectFileUrl: downloadUrl || detection.sourceProjectFileUrl,
        },
        uploadedAt: new Date().toISOString(),
      };
      const nextLogoVariants = [
        ...(planningDraft.brandGuide.logoVariants ?? []).filter((item) => item.type !== brandLogoUploadVariantType),
        nextVariant,
      ].sort((left, right) => (
        BRAND_LOGO_VARIANT_ORDER.indexOf(left.type) - BRAND_LOGO_VARIANT_ORDER.indexOf(right.type)
      ));
      const shouldActivateVariant = brandLogoUploadVariantType === 'primary'
        || !planningDraft.brandGuide.logoUrl
        || planningDraft.brandGuide.activeLogoVariantType === brandLogoUploadVariantType
        || (planningDraft.brandGuide.logoVariants?.length ?? 0) === 0;
      const nextBrandGuideBase = {
        ...planningDraft.brandGuide,
        logoVariants: nextLogoVariants,
      };
      const nextBrandGuide = shouldActivateVariant
        ? syncBrandGuideWithLogoVariant(nextBrandGuideBase, nextVariant)
        : nextBrandGuideBase;
      const nextPlanning: ProducerProjectPlanning = {
        ...planningDraft,
        brandGuide: nextBrandGuide,
      };
      await persistPlanningDraft(nextPlanning);
    } catch (brandLogoError) {
      console.error('[ProducerMediaPanel] Failed to upload or analyze brand logo', brandLogoError);
      setError('Kunne ikke laste opp og analysere logoen.');
    } finally {
      setUploadingBrandLogo(false);
      if (brandLogoFileInputRef.current) {
        brandLogoFileInputRef.current.value = '';
      }
    }
  }, [brandLogoUploadVariantType, isClientReviewerMode, persistPlanningDraft, planningDraft, projectId, projectName, uploadProjectFile]);

  const applyContributionTask = useCallback((task: ReturnType<typeof getProducerClientContributionTasks>[number]) => {
    if (task.sourceType === 'framework') {
      openSurfaceWorkspace('brief');
      setActiveBriefStep(recommendedBriefStep);
      return;
    }
    if (task.sourceType === 'brand') {
      openSurfaceWorkspace('brand');
      return;
    }
    if (task.sourceType === 'accounts') {
      openSurfaceWorkspace('accounts');
      return;
    }
    if (task.sourceType === 'delivery') {
      openSurfaceWorkspace('delivery');
      return;
    }

    openSurfaceWorkspace('materials');
    setMaterialsMode('capture');
    setSelectedMaterialFile(null);
    if (materialFileInputRef.current) {
      materialFileInputRef.current.value = '';
    }
    setMaterialDraft({
      ...EMPTY_MATERIAL_DRAFT,
      entryType: task.suggestedMaterialType,
      title: task.suggestedTitle,
      description: task.suggestedDescription,
      phase: task.phase,
      linkedShotListId: task.linkedShotListId ?? '',
      linkedCalendarItemId: task.linkedCalendarItemId ?? '',
      status: 'provided',
      usageNotes: task.suggestedUsageNotes,
      sourceLabel: 'Klient',
      priority: task.status === 'missing' ? 'critical' : 'important',
    });
  }, [openSurfaceWorkspace, recommendedBriefStep]);

  const buildPageTree = useCallback((
    section: ProducerWorkspaceSection,
    parentPageId: string | null = null,
  ): ProducerWorkspacePage[] => {
    return sortPagesByParent(section.pages, parentPageId);
  }, []);

  const activeSectionRootPages = useMemo(
    () => (activeSection ? buildPageTree(activeSection, null) : []),
    [activeSection, buildPageTree],
  );
  const workspaceRootNavigationEntries = useMemo(
    () => workspaceSections.flatMap((section) => (
      buildPageTree(section, null).map((page) => ({
        sectionId: section.id,
        sectionTitle: section.title,
        page,
      }))
    )),
    [buildPageTree, workspaceSections],
  );

  const workspaceCards = useMemo(() => ([
    {
      key: 'brief' as const,
      title: 'Brief',
      subtitle: isClientReviewerMode
        ? 'Beskriv mål, leveranser, målgruppe og timing for produsenten.'
        : 'Mål, målgruppe, budskap og timing.',
      progressLabel: `${briefReadyCount}/6 klare`,
      detail: hasText(intakeDraft.projectGoal) ? intakeDraft.projectGoal : 'Prosjektmålet er ikke formulert ennå.',
      accent: 'rgba(56,189,248,0.18)',
      textColor: '#bfdbfe',
      icon: <ArticleOutlinedIcon sx={{ color: '#7dd3fc' }} />,
    },
    {
      key: 'materials' as const,
      title: 'Materiale',
      subtitle: isClientReviewerMode
        ? 'Legg inn referanser, dokumenter, eksisterende filer og tilbakemeldinger.'
        : 'Referanser, dokumenter, brand assets og tilbakemeldinger.',
      progressLabel: `${materials.length} registrert`,
      detail: linkedCalendarMaterialCount > 0
        ? `${linkedCalendarMaterialCount} materialer er koblet til content-kalenderen.`
        : 'Ingen materialer er koblet til content-kalenderen ennå.',
      accent: 'rgba(251,191,36,0.16)',
      textColor: '#fde68a',
      icon: <PermMediaIcon sx={{ color: '#fcd34d' }} />,
    },
    {
      key: 'storyboard' as const,
      title: 'Storyboard',
      subtitle: isClientReviewerMode
        ? 'Se scener og legg inn visuelle inspirasjoner uten å rote til produksjonsflaten.'
        : 'Storyboard med sceneoversikt, frames og klientinspirasjoner.',
      progressLabel: storyboardFrameCount > 0 ? `${storyboardFrameCount} frames` : 'Ingen frames ennå',
      detail: storyboardInspirations.length > 0
        ? `${storyboardInspirations.length} inspirasjoner er lagt inn på storyboardet.`
        : 'Ingen inspirasjoner er koblet til storyboardet ennå.',
      accent: 'rgba(251,113,133,0.16)',
      textColor: '#fecdd3',
      icon: <SpaceDashboardOutlinedIcon sx={{ color: '#fda4af' }} />,
    },
    {
      key: 'manuscript' as const,
      title: 'Manus',
      subtitle: isClientReviewerMode
        ? 'Les manus og skriv foreslåtte endringer uten å overskrive originalen.'
        : 'Samle manuslesning og klientforslag i én arbeidsflate.',
      progressLabel: primaryManuscript ? `${manuscriptSuggestions.length} forslag` : 'Manus mangler',
      detail: primaryManuscript?.title
        ? `${primaryManuscript.title}${primaryManuscript.version ? ` · ${primaryManuscript.version}` : ''}`
        : 'Ingen manus er koblet til prosjektet ennå.',
      accent: 'rgba(129,140,248,0.16)',
      textColor: '#c7d2fe',
      icon: <ArticleOutlinedIcon sx={{ color: '#a5b4fc' }} />,
    },
    {
      key: 'shotlist' as const,
      title: 'Shotlist',
      subtitle: isClientReviewerMode
        ? 'En ren oversikt over scene, sted, cast og beskrivelser for planlagte shots.'
        : 'Klientvennlig shotlist-tabell med dekning og sceneoversikt.',
      progressLabel: `${shotLists.length} lister · ${totalShotCount} shots`,
      detail: shotListRows.length > 0
        ? uncoveredStoryboardSceneCount > 0
          ? `${shotListRows.length} oversiktsrader klare · ${uncoveredStoryboardSceneCount} storyboardscener mangler shotlist.`
          : `${shotListRows.length} oversiktsrader klare for klientvisning.`
        : 'Ingen shotlist-rader er klare for klientoversikt ennå.',
      accent: 'rgba(34,211,238,0.16)',
      textColor: '#bae6fd',
      icon: <GridViewOutlinedIcon sx={{ color: '#67e8f9' }} />,
    },
    {
      key: 'brand' as const,
      title: 'Merkevareguide',
      subtitle: isClientReviewerMode
        ? 'Logo, farger, fonter og uttrykk som skal styre leveransene.'
        : 'Logo, farger, fonter og visuell retning.',
      progressLabel: `${brandGuideReadyCount}/5 klare`,
      detail: hasText(planningDraft.brandGuide.visualStyle)
        ? planningDraft.brandGuide.visualStyle ?? ''
        : 'Visuell stil og tone of voice bør defineres tydelig.',
      accent: 'rgba(168,85,247,0.16)',
      textColor: '#e9d5ff',
      icon: <PaletteOutlinedIcon sx={{ color: '#c4b5fd' }} />,
    },
    {
      key: 'accounts' as const,
      title: 'Kontotilgang',
      subtitle: isClientReviewerMode
        ? 'Trygg tilgang med invite, OAuth og klientstyrt 2-faktor.'
        : 'Vedvarende konto- og publiseringstilgang uten delte passord.',
      progressLabel: requiredAccountEntries.length > 0
        ? `${connectedRequiredAccountCount}/${requiredAccountEntries.length} koblet`
        : 'Ingen krav ennå',
      detail: accountAccessSummary,
      accent: 'rgba(20,184,166,0.16)',
      textColor: '#99f6e4',
      icon: <HubOutlinedIcon sx={{ color: '#5eead4' }} />,
    },
    {
      key: 'delivery' as const,
      title: 'Leveringsrutine',
      subtitle: isClientReviewerMode
        ? 'Hvordan dere vil motta filer, mapper, versjoner og finaler.'
        : 'Filnavn, versjoner, mapper, final/draft og backup.',
      progressLabel: `${deliveryWorkflowReadyCount}/6 klare`,
      detail: hasText(planningDraft.deliveryWorkflow.fileNamingConvention)
        ? planningDraft.deliveryWorkflow.fileNamingConvention ?? ''
        : 'Filnavnregel og leveringsstruktur mangler fortsatt.',
      accent: 'rgba(34,197,94,0.16)',
      textColor: '#bbf7d0',
      icon: <FactCheckOutlinedIcon sx={{ color: '#86efac' }} />,
    },
    {
      key: 'meetings' as const,
      title: 'Møte',
      subtitle: isClientReviewerMode
        ? 'Hold agenda, klientsync og oppfølging samlet rundt møtene.'
        : 'Koble Meet, agenda, beslutninger og oppfølging til samme prosjektflate.',
      progressLabel: `${meetingAgendaCoverageCount} agenda · ${openMeetingFollowUpCount} åpne`,
      detail: hasText(planningDraft.meetingWorkspace.liveNotes)
        ? planningDraft.meetingWorkspace.liveNotes ?? ''
        : 'Bruk møteflaten til agenda, live-notater, beslutninger og oppfølging.',
      accent: 'rgba(249,115,22,0.16)',
      textColor: '#fdba74',
      icon: <VideoCallOutlinedIcon sx={{ color: '#fdba74' }} />,
    },
  ]), [
    accountAccessSummary,
    briefReadyCount,
    brandGuideReadyCount,
    connectedRequiredAccountCount,
    deliveryWorkflowReadyCount,
    intakeDraft.projectGoal,
    isClientReviewerMode,
    linkedCalendarMaterialCount,
    manuscriptSuggestions.length,
    primaryManuscript,
    meetingAgendaCoverageCount,
    materials.length,
    planningDraft.brandGuide.visualStyle,
    planningDraft.deliveryWorkflow.fileNamingConvention,
    planningDraft.meetingWorkspace.liveNotes,
    openMeetingFollowUpCount,
    requiredAccountEntries.length,
    shotListRows.length,
    shotLists.length,
    storyboardFrameCount,
    storyboardInspirations.length,
    totalShotCount,
    uncoveredStoryboardSceneCount,
  ]);

  const activeWorkspaceCard = workspaceCards.find((card) => card.key === activeWorkspace) ?? workspaceCards[0];
  const mediaHeaderDescription = useMemo(() => {
    if (briefBlocksForwardFlow) {
      return 'Fullfør produksjonsgrunnlaget først. Brief og materiale skal være tydelige før storyboard, levering og beslutning får ta plass.';
    }
    return isClientReviewerMode
      ? 'Del mål, materiale, merkevaregrunnlag, leveringspreferanser og møtepunkter i én samlet workspace-shell.'
      : `${activeWorkspaceCard.title} er nå hovedflaten. Hold retning, materiale og neste handling koblet til samme produksjonsgrunnlag.`;
  }, [activeWorkspaceCard.title, briefBlocksForwardFlow, isClientReviewerMode]);
  const displayWorkspaceNavigation = useMemo(
    () => (showWorkspaceOperations ? effectiveWorkspaceNavigation : {
      ...effectiveWorkspaceNavigation,
      sectionTabPlacement: 'left' as ProducerWorkspaceTabPlacement,
      pageTabPlacement: 'left' as ProducerWorkspacePagePlacement,
      navigationPinned: true,
    }),
    [effectiveWorkspaceNavigation, showWorkspaceOperations],
  );
  const useReferenceWorkspaceShell = displayWorkspaceNavigation.sectionTabPlacement === 'left'
    && displayWorkspaceNavigation.pageTabPlacement === 'left'
    && displayWorkspaceNavigation.navigationPinned
    && activeLayout !== 'grid';
  const brandPackTemplate = CLIENT_MATERIAL_TEMPLATES.find((template) => template.id === 'brand-pack') ?? null;
  const clientDisplayName = readFirstNonEmptyString(
    intakeDraft.contactName,
    project.clientName,
    project.clientCompanyName,
    'Klient',
  );
  const clientMetaLabel = readFirstNonEmptyString(
    project.clientCompanyName,
    intakeDraft.contactEmail,
    intakeDraft.contactPhone,
    'Deler brief, materiale og godkjenninger',
  );
  const producerDisplayName = isClientReviewerMode ? 'Produsent' : 'Innholdsprodusent';
  const workspaceFocusLabel = showClientWorkspaceEmptyState
    ? 'Ingen rom åpnet'
    : activeSection
    ? `${activeSection.title} · ${activePage?.title ?? PRODUCER_WORKSPACE_SURFACE_LABELS[activeWorkspace]}`
    : PRODUCER_WORKSPACE_SURFACE_LABELS[activeWorkspace];
  const mediaHeaderMeta = useMemo(
    () => [clientDisplayName, projectName, workspaceFocusLabel].filter(Boolean).join(' · '),
    [clientDisplayName, projectName, workspaceFocusLabel],
  );
  const creativeDirectionTitle = readFirstNonEmptyString(
    planningDraft.activationPlan.direction,
    planningDraft.activationPlan.idea,
    intakeDraft.projectGoal,
    'Kreativ retning er ikke tydelig formulert ennå.',
  );
  const creativeDirectionTags = useMemo(
    () => extractWorkspacePhrases(
      planningDraft.activationPlan.direction,
      planningDraft.activationPlan.idea,
      planningDraft.activationPlan.targetAudience,
      planningDraft.brandGuide.toneOfVoice,
      planningDraft.brandGuide.visualStyle,
      intakeDraft.brandNotes,
      intakeDraft.deliverables,
    ).slice(0, 4),
    [
      intakeDraft.brandNotes,
      intakeDraft.deliverables,
      planningDraft.activationPlan.direction,
      planningDraft.activationPlan.idea,
      planningDraft.activationPlan.targetAudience,
      planningDraft.brandGuide.toneOfVoice,
      planningDraft.brandGuide.visualStyle,
    ],
  );
  const storyboardPreviewTiles = useMemo<WorkspaceShowcaseTile[]>(() => {
    if (storyboardScenes.length > 0) {
      return storyboardScenes.slice(0, 3).map((scene, index) => ({
        id: scene.id,
        eyebrow: index === 0 ? 'Storyboard' : 'Scene',
        title: getSceneDisplayLabel(scene),
        meta: `${scene.storyboardFrames?.length ?? 0} frames`,
        storyArcFocus: { sceneId: scene.id },
      }));
    }
    if (shotLists.length > 0) {
      return shotLists.slice(0, 3).map((shotList, index) => ({
        id: shotList.id,
        eyebrow: index === 0 ? 'Shot list' : 'Sceneplan',
        title: getShotListLabel(shotList),
        meta: `${shotList.shots.length} shots`,
        storyArcFocus: shotList.sceneId ? { sceneId: shotList.sceneId } : undefined,
      }));
    }
    if (planningDraft.contentCalendar.length > 0) {
      return planningDraft.contentCalendar.slice(0, 3).map((item) => ({
        id: item.id,
        eyebrow: 'Publiseringspunkt',
        title: item.title,
        meta: readFirstNonEmptyString(item.channel, item.format, PRODUCER_PLANNING_PHASE_LABELS[item.phase]),
      }));
    }
    return [
      {
        id: 'storyboard-placeholder-1',
        eyebrow: 'Storyboard',
        title: 'Første scene er ikke planlagt ennå',
        meta: 'Koble brief, retning og shotlist for å fylle denne raden.',
      },
      {
        id: 'storyboard-placeholder-2',
        eyebrow: 'Opptaksplan',
        title: 'Neste opptaksøyeblikk kommer fra shotlist og kalender',
        meta: 'Åpne storyboard eller shotlist for å fylle planverket.',
      },
    ];
  }, [planningDraft.contentCalendar, shotLists, storyboardScenes]);
  const primaryStoryboardFocus = useMemo(
    () => storyboardPreviewTiles.find((tile) => tile.storyArcFocus)?.storyArcFocus,
    [storyboardPreviewTiles],
  );
  const workspaceSummaryRows = useMemo(() => {
    if (activeWorkspace === 'materials') {
      return [
        { label: 'Registrert', value: `${materials.length} materialer` },
        { label: 'Koblet til plan', value: linkedCalendarMaterialCount > 0 ? `${linkedCalendarMaterialCount} kalenderpunkter` : 'Ingen koblinger ennå' },
        { label: 'Shotlist', value: materials.some((item) => hasText(item.linked_shot_list_id)) ? 'Koblet til scener' : 'Ikke koblet til shotlist' },
      ];
    }
    if (activeWorkspace === 'storyboard') {
      return [
        { label: 'Scener', value: `${storyboardScenes.length} registrert` },
        { label: 'Frames', value: storyboardFrameCount > 0 ? `${storyboardFrameCount} frames` : 'Ingen frames ennå' },
        { label: 'Inspirasjoner', value: storyboardInspirations.length > 0 ? `${storyboardInspirations.length} lagt inn` : 'Ingen inspirasjoner ennå' },
      ];
    }
    if (activeWorkspace === 'manuscript') {
      return [
        { label: 'Manus', value: primaryManuscript ? primaryManuscript.title : 'Ingen manus koblet ennå' },
        { label: 'Scener', value: storyboardScenes.length > 0 ? `${storyboardScenes.length} scener` : 'Ingen scener koblet' },
        { label: 'Forslag', value: manuscriptSuggestions.length > 0 ? `${manuscriptSuggestions.length} forslag` : 'Ingen forslag ennå' },
      ];
    }
    if (activeWorkspace === 'shotlist') {
      return [
        { label: 'Lister', value: `${shotLists.length} shotlists` },
        { label: 'Shots', value: `${totalShotCount} planlagt` },
        { label: 'Dekning', value: uncoveredStoryboardSceneCount > 0 ? `${uncoveredStoryboardSceneCount} scener mangler shotlist` : 'Alle storyboardscener er koblet' },
      ];
    }
    if (activeWorkspace === 'brand') {
      return [
        { label: 'Tone', value: readFirstNonEmptyString(planningDraft.brandGuide.toneOfVoice, 'Ikke definert') },
        { label: 'Visuell stil', value: readFirstNonEmptyString(planningDraft.brandGuide.visualStyle, 'Ikke definert') },
        { label: 'Farger', value: parseBrandColors(brandColorsDraft).length > 0 ? `${parseBrandColors(brandColorsDraft).length} valgt` : 'Ingen farger registrert' },
      ];
    }
    if (activeWorkspace === 'delivery') {
      return [
        { label: 'Filnavn', value: readFirstNonEmptyString(planningDraft.deliveryWorkflow.fileNamingConvention, 'Ikke satt') },
        { label: 'Versjon', value: readFirstNonEmptyString(planningDraft.deliveryWorkflow.versioningRule, 'Ikke satt') },
        { label: 'Mappe', value: readFirstNonEmptyString(planningDraft.deliveryWorkflow.folderStructure, 'Ikke satt') },
      ];
    }
    if (activeWorkspace === 'meetings') {
      return [
        { label: 'Møte', value: readFirstNonEmptyString(planningDraft.meetingWorkspace.sessionLabel, 'Klientsync') },
        { label: 'Status', value: planningDraft.meetingWorkspace.status ? PRODUCER_MEETING_WORKSPACE_STATUS_LABELS[planningDraft.meetingWorkspace.status] : 'Planlagt' },
        { label: 'Oppfølging', value: openMeetingFollowUpCount > 0 ? `${openMeetingFollowUpCount} åpne punkter` : 'Ingen åpne punkter' },
      ];
    }
    return [
      { label: 'Mål', value: readFirstNonEmptyString(intakeDraft.projectGoal, planningDraft.activationPlan.businessGoal, 'Ikke satt') },
      { label: 'Leveranse', value: readFirstNonEmptyString(intakeDraft.deliverables, planningDraft.activationPlan.activation, 'Ikke satt') },
      { label: 'Målgruppe', value: readFirstNonEmptyString(intakeDraft.targetAudience, planningDraft.activationPlan.targetAudience, 'Ikke satt') },
    ];
  }, [
    activeWorkspace,
    brandColorsDraft,
    intakeDraft.deliverables,
    intakeDraft.projectGoal,
    intakeDraft.targetAudience,
    linkedCalendarMaterialCount,
    manuscriptSuggestions.length,
    materials,
    openMeetingFollowUpCount,
    planningDraft.activationPlan.activation,
    planningDraft.activationPlan.businessGoal,
    planningDraft.activationPlan.targetAudience,
    planningDraft.brandGuide.toneOfVoice,
    planningDraft.brandGuide.visualStyle,
    planningDraft.deliveryWorkflow.fileNamingConvention,
    planningDraft.deliveryWorkflow.folderStructure,
    planningDraft.deliveryWorkflow.versioningRule,
    planningDraft.meetingWorkspace.sessionLabel,
    planningDraft.meetingWorkspace.status,
    primaryManuscript,
    shotListRows.length,
    shotLists.length,
    storyboardFrameCount,
    storyboardInspirations.length,
    storyboardScenes.length,
    totalShotCount,
    uncoveredStoryboardSceneCount,
  ]);
  const nextSignalList = useMemo(
    () => clientContributionTasks.slice(0, 3),
    [clientContributionTasks],
  );
  const readinessSummaryText = useMemo(
    () => workflowReadinessCards.map((node) => `${node.label}: ${node.value}`).join(' · '),
    [workflowReadinessCards],
  );
  const directionSupportText = useMemo(() => {
    const strategyLine = strategySnapshot
      .slice(0, 2)
      .map((item) => `${item.label}: ${item.value}`)
      .join(' · ');
    if (strategyLine) {
      return strategyLine;
    }
    if (creativeDirectionTags.length > 0) {
      return creativeDirectionTags.slice(0, 3).join(' · ');
    }
    return readinessSummaryText;
  }, [creativeDirectionTags, readinessSummaryText, strategySnapshot]);
  const parsedBrandColors = useMemo(
    () => parseBrandColors(brandColorsDraft),
    [brandColorsDraft],
  );
  const logoTimingPreview = useMemo(
    () => getLogoTimingPreview(planningDraft.brandGuide),
    [
      planningDraft.brandGuide.logoEndSecond,
      planningDraft.brandGuide.logoStartSecond,
      planningDraft.brandGuide.logoTiming,
    ],
  );
  const availableBrandPreviewFormats = useMemo<Array<'16:9' | '4:5' | '9:16' | '1:1'>>(() => {
    const formats = Array.from(
      new Set(
        planningDraft.contentCalendar
          .map((item) => item.format?.trim())
          .filter((value): value is '16:9' | '4:5' | '9:16' | '1:1' => (
            value === '16:9' || value === '4:5' || value === '9:16' || value === '1:1'
          )),
      ),
    );
    return formats.length > 0 ? formats : ['16:9', '4:5', '9:16'];
  }, [planningDraft.contentCalendar]);
  useEffect(() => {
    if (!availableBrandPreviewFormats.includes(brandPreviewFormat)) {
      setBrandPreviewFormat(availableBrandPreviewFormats[0] ?? '16:9');
    }
  }, [availableBrandPreviewFormats, brandPreviewFormat]);
  const brandPreviewDeliveries = useMemo(() => (
    planningDraft.contentCalendar.map((item) => {
      const normalizedFormat = item.format?.trim();
      const formatValue = normalizedFormat === '16:9'
        || normalizedFormat === '4:5'
        || normalizedFormat === '9:16'
        || normalizedFormat === '1:1'
        ? normalizedFormat
        : null;
      return {
        id: item.id,
        title: readFirstNonEmptyString(item.title, 'Uten tittel'),
        channel: readFirstNonEmptyString(item.channel, 'Kanal ikke satt'),
        formatLabel: readFirstNonEmptyString(item.format, 'Format ikke satt'),
        formatValue,
        logoVariantSelection: item.logoVariantSelection ?? 'auto',
        phaseLabel: PRODUCER_PLANNING_PHASE_LABELS[item.phase],
        publishLabel: item.publishAt ? formatTimestamp(item.publishAt) : 'Publisering ikke satt',
        statusLabel: PRODUCER_CONTENT_CALENDAR_STATUS_LABELS[item.status ?? 'planned'],
      };
    })
  ), [planningDraft.contentCalendar]);
  useEffect(() => {
    if (brandPreviewDeliveries.length === 0) {
      if (brandPreviewDeliveryId !== null) {
        setBrandPreviewDeliveryId(null);
      }
      return;
    }
    if (!brandPreviewDeliveries.some((item) => item.id === brandPreviewDeliveryId)) {
      setBrandPreviewDeliveryId(brandPreviewDeliveries[0]?.id ?? null);
    }
  }, [brandPreviewDeliveries, brandPreviewDeliveryId]);
  const selectedBrandPreviewDelivery = useMemo(
    () => brandPreviewDeliveries.find((item) => item.id === brandPreviewDeliveryId) ?? null,
    [brandPreviewDeliveries, brandPreviewDeliveryId],
  );
  const activeBrandPreviewFormat = selectedBrandPreviewDelivery?.formatValue ?? brandPreviewFormat;
  const selectedBrandOverlayProfile = useMemo(
    () => getProducerOverlayFormatProfile(planningDraft.brandGuide, activeBrandPreviewFormat),
    [activeBrandPreviewFormat, planningDraft.brandGuide],
  );
  const brandPreviewAspectRatio = useMemo(() => (
    activeBrandPreviewFormat === '16:9'
      ? '16 / 9'
      : activeBrandPreviewFormat === '4:5'
        ? '4 / 5'
        : activeBrandPreviewFormat === '9:16'
          ? '9 / 16'
          : '1 / 1'
  ), [activeBrandPreviewFormat]);
  const brandPreviewFrameMargin = useMemo(
    () => selectedBrandOverlayProfile.recommendedMargin.pixelsAt1080 > 0
      ? Math.max(14, Math.round(selectedBrandOverlayProfile.recommendedMargin.pixelsAt1080 / 6))
      : 0,
    [selectedBrandOverlayProfile.recommendedMargin.pixelsAt1080],
  );
  const brandLogoVariants = useMemo(
    () => planningDraft.brandGuide.logoVariants ?? [],
    [planningDraft.brandGuide.logoVariants],
  );
  const activeBrandLogoVariantType = planningDraft.brandGuide.activeLogoVariantType ?? 'primary';
  const activeBrandLogoVariant = useMemo(() => (
    brandLogoVariants.find((item) => item.type === activeBrandLogoVariantType)
    ?? brandLogoVariants.find((item) => item.type === 'primary')
    ?? brandLogoVariants[0]
    ?? null
  ), [activeBrandLogoVariantType, brandLogoVariants]);
  const brandPreviewVariantSelection = selectedBrandPreviewDelivery?.logoVariantSelection
    ?? (activeBrandLogoVariantType === 'primary' ? 'auto' : activeBrandLogoVariantType);
  const brandPreviewVariantResolution = useMemo(
    () => resolveProducerBrandLogoVariant(planningDraft.brandGuide, activeBrandPreviewFormat, brandPreviewVariantSelection),
    [activeBrandPreviewFormat, brandPreviewVariantSelection, planningDraft.brandGuide],
  );
  const autoBrandPreviewVariant = useMemo(() => (
    brandLogoVariants.find((item) => item.type === brandPreviewVariantResolution.resolvedType)
    ?? activeBrandLogoVariant
  ), [activeBrandLogoVariant, brandLogoVariants, brandPreviewVariantResolution.resolvedType]);
  const resolvedBrandLogoUrl = useMemo(
    () => {
      const candidate = activeBrandLogoVariant?.logoUrl ?? planningDraft.brandGuide.logoUrl;
      return getAbsoluteProjectFileUrl(candidate) || candidate || '';
    },
    [activeBrandLogoVariant?.logoUrl, planningDraft.brandGuide.logoUrl],
  );
  const resolvedBrandPreviewLogoUrl = useMemo(() => {
    const candidate = autoBrandPreviewVariant?.logoUrl ?? activeBrandLogoVariant?.logoUrl ?? planningDraft.brandGuide.logoUrl;
    return getAbsoluteProjectFileUrl(candidate) || candidate || '';
  }, [activeBrandLogoVariant?.logoUrl, autoBrandPreviewVariant?.logoUrl, planningDraft.brandGuide.logoUrl]);
  const brandPreviewVariantLabel = brandPreviewVariantResolution.resolvedLabel;
  const brandPreviewVariantDetail = useMemo(() => {
    if (!autoBrandPreviewVariant) {
      return 'Ingen aktiv logovariant valgt ennå.';
    }
    if (brandPreviewVariantSelection === 'auto') {
      return `Anbefalt variant for ${activeBrandPreviewFormat}: ${brandPreviewVariantResolution.recommendedLabel}. Previewen bruker ${brandPreviewVariantResolution.resolvedLabel.toLowerCase()}.`;
    }
    return `${brandPreviewVariantResolution.resolvedLabel} er låst manuelt for denne leveransen i ${activeBrandPreviewFormat}.`;
  }, [activeBrandPreviewFormat, autoBrandPreviewVariant, brandPreviewVariantResolution.recommendedLabel, brandPreviewVariantResolution.resolvedLabel, brandPreviewVariantSelection]);
  const brandLogoDetection = activeBrandLogoVariant?.detection ?? planningDraft.brandGuide.logoDetection;
  const brandLogoDetectionColors = brandLogoDetection?.dominantColors ?? [];
  const brandLogoDetectionSummary = useMemo(() => {
    if (!brandLogoDetection) {
      return null;
    }
    return {
      markTypeLabel: getBrandLogoMarkTypeLabel(brandLogoDetection.markType),
      transparencyLabel: brandLogoDetection.hasTransparency ? 'Transparent bakgrunn' : 'Bakplate trengs',
      placementLabel: brandLogoDetection.suggestedPlacement
        ? PRODUCER_BRAND_LOGO_PLACEMENT_LABELS[brandLogoDetection.suggestedPlacement]
        : 'Ikke foreslått',
      timingLabel: brandLogoDetection.suggestedTiming
        ? PRODUCER_BRAND_LOGO_TIMING_LABELS[brandLogoDetection.suggestedTiming]
        : 'Ikke foreslått',
      treatmentLabel: brandLogoDetection.suggestedTreatment
        ? PRODUCER_BRAND_LOGO_TREATMENT_LABELS[brandLogoDetection.suggestedTreatment]
        : 'Ikke foreslått',
    };
  }, [brandLogoDetection]);
  const setBrandColorsFromEntries = useCallback((colors: ProducerBrandGuideColor[]) => {
    setBrandColorsDraft(stringifyBrandColors(colors));
  }, []);
  const applyBrandLogoDetectionSuggestions = useCallback(async () => {
    if (!brandLogoDetection) {
      return;
    }
    const nextColors = brandLogoDetectionColors.length > 0
      ? brandLogoDetectionColors
      : parseBrandColors(brandColorsDraft);
    const nextPlanning: ProducerProjectPlanning = {
      ...planningDraft,
      brandGuide: {
        ...planningDraft.brandGuide,
        logoPlacement: brandLogoDetection.suggestedPlacement ?? planningDraft.brandGuide.logoPlacement,
        logoTiming: brandLogoDetection.suggestedTiming ?? planningDraft.brandGuide.logoTiming,
        logoTreatment: brandLogoDetection.suggestedTreatment ?? planningDraft.brandGuide.logoTreatment,
        colors: nextColors,
      },
    };
    if (brandLogoDetectionColors.length > 0) {
      setBrandColorsFromEntries(brandLogoDetectionColors);
    }
    setSavingPlanning(true);
    setError(null);
    try {
      await persistPlanningDraft(nextPlanning);
    } catch (brandSuggestionError) {
      console.error('[ProducerMediaPanel] Failed to apply brand logo suggestions', brandSuggestionError);
      setError('Kunne ikke bruke logoforslagene.');
    } finally {
      setSavingPlanning(false);
    }
  }, [brandColorsDraft, brandLogoDetection, brandLogoDetectionColors, persistPlanningDraft, planningDraft, setBrandColorsFromEntries]);
  const handleSelectActiveBrandLogoVariant = useCallback(async (variantType: ProducerBrandLogoVariantType) => {
    const targetVariant = brandLogoVariants.find((item) => item.type === variantType);
    if (!targetVariant) {
      return;
    }
    if ((planningDraft.brandGuide.activeLogoVariantType ?? 'primary') === variantType) {
      return;
    }
    const nextPlanning: ProducerProjectPlanning = {
      ...planningDraft,
      brandGuide: syncBrandGuideWithLogoVariant(planningDraft.brandGuide, targetVariant),
    };
    setBrandLogoVariantBusyKey(`activate:${variantType}`);
    setSavingPlanning(true);
    setError(null);
    try {
      await persistPlanningDraft(nextPlanning);
    } catch (brandVariantError) {
      console.error('[ProducerMediaPanel] Failed to persist active brand logo variant', brandVariantError);
      setError('Kunne ikke bytte aktiv logovariant.');
    } finally {
      setSavingPlanning(false);
      setBrandLogoVariantBusyKey(null);
    }
  }, [brandLogoVariants, persistPlanningDraft, planningDraft]);
  const handleDeleteBrandLogoVariant = useCallback(async (variantType: ProducerBrandLogoVariantType) => {
    const targetVariant = brandLogoVariants.find((item) => item.type === variantType);
    if (!targetVariant) {
      return;
    }
    const nextLogoVariants = brandLogoVariants.filter((item) => item.type !== variantType);
    const fallbackVariant = nextLogoVariants.find((item) => item.type === 'primary')
      ?? nextLogoVariants[0]
      ?? null;
    const nextBrandGuideBase: ProducerProjectPlanning['brandGuide'] = {
      ...planningDraft.brandGuide,
      logoVariants: nextLogoVariants,
    };
    const nextBrandGuide = (planningDraft.brandGuide.activeLogoVariantType ?? 'primary') === variantType
      ? (fallbackVariant
        ? syncBrandGuideWithLogoVariant(nextBrandGuideBase, fallbackVariant)
        : {
          ...nextBrandGuideBase,
          activeLogoVariantType: 'primary',
          logoUrl: undefined,
          logoDetection: undefined,
        })
      : nextBrandGuideBase;
    const nextPlanning: ProducerProjectPlanning = {
      ...planningDraft,
      brandGuide: nextBrandGuide,
    };
    setBrandLogoVariantBusyKey(`delete:${variantType}`);
    setBrandLogoVariantDeleteConfirmType(null);
    setSavingPlanning(true);
    setError(null);
    try {
      if (targetVariant.projectFileId) {
        await deleteProjectFile(projectId, targetVariant.projectFileId);
      }
      await persistPlanningDraft(nextPlanning);
      void loadDeliveryWorkspaceAssets();
    } catch (deleteVariantError) {
      console.error('[ProducerMediaPanel] Failed to delete brand logo variant', deleteVariantError);
      setError('Kunne ikke slette logovarianten.');
    } finally {
      setSavingPlanning(false);
      setBrandLogoVariantBusyKey(null);
    }
  }, [brandLogoVariants, deleteProjectFile, loadDeliveryWorkspaceAssets, persistPlanningDraft, planningDraft, projectId]);
  const handleBrandTimingRangeChange = useCallback((_: Event, nextValue: number | number[]) => {
    if (!Array.isArray(nextValue) || nextValue.length < 2) {
      return;
    }
    const nextStart = Math.max(0, Math.floor(Math.min(nextValue[0], nextValue[1] - 1)));
    const nextEnd = Math.max(nextStart + 1, Math.floor(Math.max(nextValue[0] + 1, nextValue[1])));
    setPlanningDraft((previous) => ({
      ...previous,
      brandGuide: {
        ...previous.brandGuide,
        logoTiming: 'custom',
        logoStartSecond: nextStart,
        logoEndSecond: nextEnd,
      },
    }));
  }, []);
  const handleSelectedBrandPreviewDeliveryVariantSelection = useCallback((selection: 'auto' | ProducerBrandLogoVariantType) => {
    if (!selectedBrandPreviewDelivery) {
      return;
    }
    setPlanningDraft((previous) => ({
      ...previous,
      contentCalendar: previous.contentCalendar.map((item) => (
        item.id === selectedBrandPreviewDelivery.id
          ? { ...item, logoVariantSelection: selection }
          : item
      )),
    }));
  }, [selectedBrandPreviewDelivery]);
  const handleBrandLogoPreviewPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canEditClientInput || !draggingBrandLogo || !brandPreviewFrameRef.current) {
      return;
    }
    const bounds = brandPreviewFrameRef.current.getBoundingClientRect();
    const nextPlacement = getBrandPreviewPlacementFromPointer(
      (event.clientX - bounds.left) / Math.max(1, bounds.width),
      (event.clientY - bounds.top) / Math.max(1, bounds.height),
    );
    setPlanningDraft((previous) => (
      previous.brandGuide.logoPlacement === nextPlacement
        ? previous
        : {
          ...previous,
          brandGuide: {
            ...previous.brandGuide,
            logoPlacement: nextPlacement,
          },
        }
    ));
  }, [canEditClientInput, draggingBrandLogo]);
  const handleBrandLogoPreviewPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canEditClientInput) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingBrandLogo(true);
    handleBrandLogoPreviewPointerMove(event);
  }, [canEditClientInput, handleBrandLogoPreviewPointerMove]);
  const handleBrandLogoPreviewPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingBrandLogo(false);
  }, []);
  const handleBrandColorChange = useCallback((
    index: number,
    patch: Partial<ProducerBrandGuideColor>,
  ) => {
    setBrandColorsFromEntries(
      parsedBrandColors.map((entry, entryIndex) => (
        entryIndex === index ? { ...entry, ...patch } : entry
      )),
    );
  }, [parsedBrandColors, setBrandColorsFromEntries]);
  const handleAddBrandColor = useCallback(() => {
    setBrandColorsFromEntries([
      ...parsedBrandColors,
      {
        id: `brand-color-${parsedBrandColors.length + 1}`,
        label: '',
        hex: '#ffffff',
        usage: '',
      },
    ]);
  }, [parsedBrandColors, setBrandColorsFromEntries]);
  const handleRemoveBrandColor = useCallback((index: number) => {
    setBrandColorsFromEntries(parsedBrandColors.filter((_, entryIndex) => entryIndex !== index));
  }, [parsedBrandColors, setBrandColorsFromEntries]);
  const parsedBrandFonts = useMemo(
    () => parseLineSeparatedValues(brandFontsDraft),
    [brandFontsDraft],
  );
  const parsedBrandDos = useMemo(
    () => parseLineSeparatedValues(brandDosDraft),
    [brandDosDraft],
  );
  const parsedBrandDonts = useMemo(
    () => parseLineSeparatedValues(brandDontsDraft),
    [brandDontsDraft],
  );
  const brandGuideMissingItems = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (!hasText(planningDraft.brandGuide.logoUrl)) {
      items.push({ id: 'brand-logo', label: 'Logo mangler' });
    }
    if (parsedBrandColors.length === 0) {
      items.push({ id: 'brand-colors', label: 'Merkevarefarger mangler' });
    }
    if (parsedBrandFonts.length === 0) {
      items.push({ id: 'brand-fonts', label: 'Fonter mangler' });
    }
    if (!hasText(planningDraft.brandGuide.toneOfVoice)) {
      items.push({ id: 'brand-tone', label: 'Tone of voice mangler' });
    }
    if (!hasText(planningDraft.brandGuide.visualStyle)) {
      items.push({ id: 'brand-style', label: 'Visuell stil mangler' });
    }
    return items;
  }, [
    parsedBrandColors.length,
    parsedBrandFonts.length,
    planningDraft.brandGuide.logoUrl,
    planningDraft.brandGuide.toneOfVoice,
    planningDraft.brandGuide.visualStyle,
  ]);
  const brandGuideSummary = useMemo(() => {
    if (brandGuideMissingItems.length > 0) {
      return '';
    }
    return readFirstNonEmptyString(
      [
        parsedBrandColors.length > 0 ? `${parsedBrandColors.length} farger` : '',
        parsedBrandFonts.length > 0 ? `${parsedBrandFonts.length} fonter` : '',
        hasText(planningDraft.brandGuide.toneOfVoice) ? planningDraft.brandGuide.toneOfVoice : '',
        hasText(planningDraft.brandGuide.visualStyle) ? planningDraft.brandGuide.visualStyle : '',
      ].filter(Boolean).join(' · '),
      'Merkevareguiden er klar for produksjon.',
    );
  }, [
    brandGuideMissingItems.length,
    parsedBrandColors.length,
    parsedBrandFonts.length,
    planningDraft.brandGuide.toneOfVoice,
    planningDraft.brandGuide.visualStyle,
  ]);
  const linkedShotListMaterialCount = useMemo(
    () => materials.filter((material) => hasText(material.linked_shot_list_id)).length,
    [materials],
  );
  const referenceMaterialCount = useMemo(
    () => materials.filter((material) => material.entry_type === 'reference').length,
    [materials],
  );
  const legalAgreementPendingCount = useMemo(
    () => deliveryWorkspaceAssets.legalAgreements.filter((agreement) => agreement.google_signature?.status !== 'signed' && agreement.status !== 'signed').length,
    [deliveryWorkspaceAssets.legalAgreements],
  );
  const showWorkspaceSupportColumn = activeLayout === 'split' && activeWorkspace !== 'meetings';
  const primaryLegalAgreement = useMemo(
    () => deliveryWorkspaceAssets.legalAgreements.find((agreement) => agreement.google_signature?.status !== 'signed' && agreement.status !== 'signed')
      ?? deliveryWorkspaceAssets.legalAgreements[0]
      ?? null,
    [deliveryWorkspaceAssets.legalAgreements],
  );
  const primaryLegalAgreementUrl = useMemo(() => {
    if (!primaryLegalAgreement) {
      return '';
    }
    const signedPdfArtifact = deliveryWorkspaceAssets.googleArtifacts.find((artifact) => artifact.id === primaryLegalAgreement.google_signature?.signedPdfArtifactId);
    const pdfSnapshotArtifact = deliveryWorkspaceAssets.googleArtifacts.find((artifact) => artifact.id === primaryLegalAgreement.google_signature?.pdfSnapshotArtifactId);

    return signedPdfArtifact?.webViewUrl
      ?? pdfSnapshotArtifact?.webViewUrl
      ?? primaryLegalAgreement.google_signature?.requestUrl
      ?? primaryLegalAgreement.google_signature?.webViewUrl
      ?? '';
  }, [deliveryWorkspaceAssets.googleArtifacts, primaryLegalAgreement]);
  const workspaceSupportPanel = useMemo<WorkspaceSupportPanelState>(() => {
    if (briefBlocksForwardFlow) {
      const foundationItems = foundationBlockingItems.slice(0, 4).map((item, index) => ({
        id: item.id,
        title: item.label,
        detail: clientGroundingRequests[index] ?? 'Dette må fylles ut før resten av planen gir mening.',
      }));
      const sections: WorkspaceSupportSection[] = [
        {
          id: 'foundation',
          title: 'Produksjonsgrunnlag',
          description: 'Fullfør dette først. Storyboard, leveranser og beslutninger skal ikke konkurrere med et uferdig grunnlag.',
          items: foundationItems,
          actions: [
            {
              id: 'open-brief',
              label: activeWorkspace === 'brief' ? 'Fortsett i briefen' : 'Åpne brief',
              variant: 'contained',
              onClick: () => {
                setActiveBriefStep(recommendedBriefStep);
                openSurfaceWorkspace('brief');
              },
            },
          ],
        },
      ];

      if (clientGroundingRequests.length > 0) {
        sections.push({
          id: 'grounding',
          title: 'Klientinnspill',
          description: 'Disse innspillene blokkerer videre arbeid akkurat nå.',
          items: clientGroundingRequests.slice(0, 2).map((request, index) => ({
            id: `grounding-${index}`,
            title: request,
          })),
          actions: canEditClientInput ? [
            {
              id: 'open-materials',
              label: 'Åpne materiale',
              variant: 'outlined',
              onClick: () => {
                setMaterialsMode('capture');
                openSurfaceWorkspace('materials');
              },
            },
          ] : [],
        });
      }

      return {
        title: 'Neste steg',
        intro: activeWorkspace === 'brief'
          ? 'Fullfør briefen før produksjon og godkjenning åpnes opp som parallelle spor.'
          : 'Hold fokus på produksjonsgrunnlaget først. Resten av flyten skal vente til briefen er tydelig.',
        chipLabel: `${foundationBlockingItems.length} mangler`,
        priority: foundationBlockingItems.length >= 3 ? 'critical' : 'warning',
        sections,
      };
    }

    if (activeWorkspace === 'brief') {
      return {
        title: 'Neste steg',
        intro: 'Briefen er klar nok til å drive produksjonen videre. Bruk sidekolonnen til å velge hva som faktisk skjer etter grunnlaget.',
        chipLabel: `${pendingReviewCount} åpne beslutninger`,
        priority: pendingReviewCount > 0 ? 'info' : 'ready',
        sections: [
          {
            id: 'production',
            title: 'Produksjon',
            description: 'Oversett briefen til storyboard, shotlist og manus.',
            items: storyboardPreviewTiles.slice(0, 2).map((tile) => ({
              id: tile.id,
              eyebrow: tile.eyebrow,
              title: tile.title,
              detail: tile.meta,
              actionLabel: tile.storyArcFocus && onOpenStoryboard ? 'Åpne scene' : undefined,
              onAction: tile.storyArcFocus && onOpenStoryboard
                ? () => onOpenStoryboard(tile.storyArcFocus)
                : undefined,
            })),
            actions: [
              {
                id: 'open-storyboard',
                label: workflowOpenLabels.storyboard,
                variant: 'contained',
                onClick: () => onOpenStoryboard?.(primaryStoryboardFocus),
              },
              {
                id: 'open-shotlist',
                label: workflowOpenLabels.shotList,
                variant: 'outlined',
                onClick: () => onOpenShotList?.(primaryStoryboardFocus),
              },
              {
                id: 'open-manus',
                label: workflowOpenLabels.manuscript,
                variant: 'text',
                onClick: () => onOpenManuscript?.(primaryStoryboardFocus),
              },
            ],
          },
          {
            id: 'decision',
            title: 'Beslutning',
            description: isClientReviewerMode
              ? 'Dette er det som kommer tilbake som godkjenning og neste handling.'
              : 'Forbered det som skal videre til klient, økonomi eller review.',
            items: (nextSignalList.length > 0
              ? nextSignalList.slice(0, 2).map((task) => ({
                id: task.id,
                eyebrow: PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType],
                title: task.title,
                detail: task.detail,
                actionLabel: canEditClientInput ? 'Åpne' : undefined,
                onAction: canEditClientInput ? () => applyContributionTask(task) : undefined,
              }))
              : [
                {
                  id: 'decision-ready',
                  title: pendingReviewCount > 0 ? `${pendingReviewCount} reviewpunkter venter` : 'Ingen åpne reviewpunkter',
                  detail: pendingReviewCount > 0
                    ? 'Klargjør de viktigste beslutningene og send dem videre i riktig rekkefølge.'
                    : 'Når produksjonsgrunnlaget er klart, kan du sende storyboard, manus eller shotlist videre.',
                },
              ]),
            actions: !isClientReviewerMode ? [
              {
                id: 'prepare-storyboard',
                label: 'Klargjør storyboard',
                variant: 'outlined',
                onClick: onPrepareStoryboardReview,
              },
              {
                id: 'prepare-shotlist',
                label: 'Klargjør shotlist',
                variant: 'text',
                onClick: onPrepareShotListReview,
              },
            ] : [],
          },
        ],
      };
    }

    if (activeWorkspace === 'brand') {
      return {
        title: 'Neste steg',
        intro: 'Merkevaren skal støtte det som faktisk skal produseres, ikke leve som et separat spor.',
        chipLabel: `${brandGuideReadyCount}/5 klare`,
        priority: brandGuideReadyCount < 3 ? 'warning' : 'info',
        sections: [
          {
            id: 'brand-signals',
            title: 'Merkevaresignaler',
            description: 'Hold uttrykket stramt nok til at storyboard og leveranser blir konsistente.',
            items: [
              {
                id: 'brand-colors',
                title: parsedBrandColors.length > 0 ? `${parsedBrandColors.length} farger registrert` : 'Farger mangler',
                detail: parsedBrandColors.length > 0 ? parsedBrandColors.slice(0, 3).map((color) => color.label).join(', ') : 'Definer primærfarger som faktisk skal brukes.',
              },
              {
                id: 'brand-fonts',
                title: parsedBrandFonts.length > 0 ? `${parsedBrandFonts.length} fonter definert` : 'Fonter mangler',
                detail: parsedBrandFonts.length > 0 ? parsedBrandFonts.slice(0, 3).join(', ') : 'Legg inn fontvalg som styrer grafikk og tekst.',
              },
              {
                id: 'brand-rules',
                title: `${parsedBrandDos.length} do's · ${parsedBrandDonts.length} don'ts`,
                detail: parsedBrandDos.length > 0 || parsedBrandDonts.length > 0
                  ? [...parsedBrandDos.slice(0, 1), ...parsedBrandDonts.slice(0, 1)].join(' · ')
                  : 'Tydelige do’s og don’ts gjør uttrykket enklere å holde konsekvent.',
              },
            ],
            actions: !materials.some((item) => item.entry_type === 'brand_asset') && brandPackTemplate && canEditClientInput ? [
              {
                id: 'add-brand-pack',
                label: 'Legg til merkevarefil',
                variant: 'contained',
                onClick: () => applyMaterialTemplate(brandPackTemplate),
              },
            ] : [],
          },
          {
            id: 'brand-production',
            title: 'Neste i produksjon',
            description: 'Knytt uttrykket til konkrete planer og produksjonselementer.',
            items: storyboardPreviewTiles.slice(0, 2).map((tile) => ({
              id: `brand-${tile.id}`,
              eyebrow: tile.eyebrow,
              title: tile.title,
              detail: tile.meta,
              actionLabel: tile.storyArcFocus && onOpenStoryboard ? 'Åpne scene' : undefined,
              onAction: tile.storyArcFocus && onOpenStoryboard
                ? () => onOpenStoryboard(tile.storyArcFocus)
                : undefined,
            })),
            actions: [
              {
                id: 'brand-open-storyboard',
                label: workflowOpenLabels.storyboard,
                variant: 'outlined',
                onClick: () => onOpenStoryboard?.(primaryStoryboardFocus),
              },
              {
                id: 'brand-open-shotlist',
                label: workflowOpenLabels.shotList,
                variant: 'text',
                onClick: () => onOpenShotList?.(primaryStoryboardFocus),
              },
            ],
          },
        ],
      };
    }

    if (activeWorkspace === 'accounts') {
      const primaryPendingAccount = requiredAccountEntries.find((entry) => entry.status !== 'connected') ?? null;
      return {
        title: 'Neste steg',
        intro: 'Kontotilgang holdes samlet i ett sikkert spor. Første godkjenning skjer eksplisitt, deretter brukes samme tilgang videre uten delte passord.',
        chipLabel: requiredAccountEntries.length > 0
          ? `${connectedRequiredAccountCount}/${requiredAccountEntries.length} koblet`
          : 'Ingen krav ennå',
        priority: pendingRequiredAccountCount > 0 ? 'warning' : 'ready',
        sections: [
          {
            id: 'accounts-status',
            title: 'Kontoer i dette prosjektet',
            description: 'Dette er tilgangene som faktisk må avklares før publisering og overlevering.',
            items: (requiredAccountEntries.length > 0
              ? requiredAccountEntries.slice(0, 3).map((entry) => ({
                id: `account-status-${entry.platform}`,
                eyebrow: `${PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS[entry.method]} · ${PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status]}`,
                title: PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform],
                detail: readFirstNonEmptyString(
                  entry.accountLabel || '',
                  entry.accessScope || '',
                  entry.notes || '',
                  'Tilgangen er ikke avklart ennå.',
                ),
              }))
              : [
                {
                  id: 'account-status-empty',
                  title: 'Ingen kontoer er markert som nødvendige ennå',
                  detail: 'Så snart kanalvalg og publiseringsløp er tydeligere, vil riktige kontoer dukke opp her.',
                },
              ]),
            actions: primaryPendingAccount ? [
              {
                id: 'open-account-track',
                label: 'Fortsett i kontotilgang',
                variant: 'contained',
                onClick: () => openSurfaceWorkspace('accounts'),
              },
            ] : [],
          },
          {
            id: 'accounts-security',
            title: 'Sikker praksis',
            description: 'Dette er et vedvarende tilgangsspor, ikke et manuelt passordarkiv.',
            items: [
              {
                id: 'security-oauth',
                title: 'Bruk rollebasert tilgang',
                detail: 'Meta, LinkedIn og YouTube bør bruke invite eller rollebasert tilgang som kan beholdes gjennom prosjektet.',
              },
              {
                id: 'security-two-factor',
                title: '2-faktor blir hos kontoeier',
                detail: 'Klienten beholder 2-faktor. Produsenten får bare nødvendig rolle eller kobling.',
              },
              {
                id: 'security-revoke',
                title: 'Planlegg når tilgangen fjernes',
                detail: readFirstNonEmptyString(
                  planningDraft.accountAccess.revokePlan ?? '',
                  'Avklar når kontoer eller koblinger skal ryddes bort etter publisering.',
                ),
              },
            ],
            actions: [],
          },
        ],
      };
    }

    if (activeWorkspace === 'materials') {
      return {
        title: 'Neste steg',
        intro: 'Materialet skal ikke bare samles. Det skal kobles til plan, shotlist og leveranse.',
        chipLabel: `${clientContributionTasks.length} åpne innspill`,
        priority: clientContributionTasks.length > 0 ? 'warning' : 'info',
        sections: [
          {
            id: 'materials-missing',
            title: 'Dette mangler fortsatt',
            description: 'Velg de materialene som faktisk blocker videre produksjon.',
            items: (nextSignalList.length > 0
              ? nextSignalList.slice(0, 3).map((task) => ({
                id: task.id,
                eyebrow: PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType],
                title: task.title,
                detail: task.detail,
                actionLabel: canEditClientInput ? 'Åpne' : undefined,
                onAction: canEditClientInput ? () => applyContributionTask(task) : undefined,
              }))
              : [
                {
                  id: 'materials-ready',
                  title: 'Ingen åpne materialforespørsler akkurat nå',
                  detail: 'Neste steg er å koble materialet til shotlist, kalender eller leveringspunkt.',
                },
              ]),
            actions: canEditClientInput ? [
              {
                id: 'open-materials',
                label: 'Registrer materiale',
                variant: 'contained',
                onClick: () => openSurfaceWorkspace('materials'),
              },
            ] : [],
          },
          {
            id: 'materials-production',
            title: 'Kobling til produksjon',
            description: 'Materialet må leve sammen med planen, ikke ved siden av den.',
            items: [
              {
                id: 'materials-calendar',
                title: `${linkedCalendarMaterialCount} koblet til kalender`,
                detail: linkedCalendarMaterialCount > 0 ? 'Materiale er allerede koblet til publiseringspunkter eller opptaksplan.' : 'Koble materiale til kalenderen når det påvirker timing eller publisering.',
              },
              {
                id: 'materials-shotlist',
                title: `${linkedShotListMaterialCount} koblet til shotlist`,
                detail: linkedShotListMaterialCount > 0 ? 'Shotlist har materiale knyttet til seg.' : 'Knytt materiale til shotlist der scener eller leveranser har avhengigheter.',
              },
              {
                id: 'materials-reference',
                title: `${referenceMaterialCount} referanser registrert`,
                detail: referenceMaterialCount > 0 ? 'Referanser gir produksjonen et faktisk visuelt utgangspunkt.' : 'Legg inn minst én referanse som peker ut retning og uttrykk.',
              },
            ],
            actions: [
              {
                id: 'materials-open-shotlist',
                label: workflowOpenLabels.shotList,
                variant: 'outlined',
                onClick: () => onOpenShotList?.(primaryStoryboardFocus),
              },
              {
                id: 'materials-open-storyboard',
                label: workflowOpenLabels.storyboard,
                variant: 'text',
                onClick: () => onOpenStoryboard?.(primaryStoryboardFocus),
              },
            ],
          },
        ],
      };
    }

    const latestPackageLabel = deliveryWorkspaceAssets.latestPackage
      ? `${deliveryWorkspaceAssets.latestPackage.name} · ${formatTimestamp(deliveryWorkspaceAssets.latestPackage.uploadedAt)}`
      : 'Ingen klientpakke er skrevet ennå.';

    return {
      title: 'Neste steg',
      intro: 'Overlevering skal oppleves som ett ryddig spor: pakke, juridikk og siste kontroll.',
      chipLabel: `${legalAgreementPendingCount} venter`,
      priority: legalAgreementPendingCount > 0 ? 'warning' : 'ready',
      sections: [
        {
          id: 'delivery-readiness',
          title: 'Levering',
          description: 'Sørg for at klientpakken og arbeidsområdet faktisk er klare.',
          items: [
            {
              id: 'delivery-package',
              title: deliveryWorkspaceAssets.latestPackage ? 'Klientpakke klar' : 'Klientpakke mangler',
              detail: latestPackageLabel,
            },
            {
              id: 'delivery-workspace',
              title: `${deliveryWorkspaceAssets.workspaceFiles.length} arbeidsfiler skrevet`,
              detail: deliveryWorkspaceAssets.workspaceFiles.length > 0
                ? 'Eksportfanen har skrevet konkrete arbeidsfiler med mappe, pakke og versjon.'
                : 'Arbeidsområdet opprettes når leveransen pakkes fra eksport.',
            },
          ],
          actions: [
            ...(deliveryWorkspaceAssets.latestPackage?.downloadUrl ? [{
              id: 'open-delivery-package',
              label: 'Åpne klientpakke',
              variant: 'contained' as const,
              href: deliveryWorkspaceAssets.latestPackage.downloadUrl,
            }] : []),
            {
              id: 'open-delivery-workspace',
              label: 'Åpne leveringsrutine',
              variant: deliveryWorkspaceAssets.latestPackage?.downloadUrl ? 'text' : 'outlined',
              onClick: () => openSurfaceWorkspace('delivery'),
            },
          ],
        },
        {
          id: 'delivery-legal',
          title: 'Juridisk status',
          description: 'Dette kan fortsatt blokkere overlevering eller sign-off.',
          items: (deliveryWorkspaceAssets.legalAgreements.length > 0
            ? deliveryWorkspaceAssets.legalAgreements.slice(0, 2).map((agreement) => ({
              id: agreement.id,
              eyebrow: PROJECT_AGREEMENT_STATUS_LABELS[agreement.status],
              title: agreement.title,
              detail: `${getAgreementClientFacingStatusSummary(agreement)} · ${getAgreementSignatureProgress(agreement).label}`,
            }))
            : [
              {
                id: 'delivery-legal-empty',
                title: 'Ingen juridiske dokumenter registrert',
                detail: 'Avtaler og signering vil dukke opp her når de kobles til prosjektet.',
              },
            ]),
          actions: [
            ...(primaryLegalAgreement ? [{
              id: 'open-primary-legal',
              label: 'Åpne juridisk spor',
              variant: 'outlined' as const,
              onClick: () => openSurfaceWorkspace('delivery', { artifactId: `agreement:${primaryLegalAgreement.id}` }),
            }] : []),
            ...(primaryLegalAgreementUrl ? [{
              id: 'open-primary-legal-doc',
              label: 'Åpne dokument',
              variant: 'text' as const,
              href: primaryLegalAgreementUrl,
            }] : []),
          ],
        },
      ],
    };
  }, [
    activeWorkspace,
    applyContributionTask,
    brandGuideReadyCount,
    brandPackTemplate,
    briefBlocksForwardFlow,
    connectedRequiredAccountCount,
    foundationBlockingItems,
    briefMissingItems,
    canEditClientInput,
    clientGroundingRequests,
    clientContributionTasks.length,
    deliveryWorkspaceAssets.googleArtifacts,
    deliveryWorkspaceAssets.latestPackage,
    deliveryWorkspaceAssets.legalAgreements,
    deliveryWorkspaceAssets.workspaceFiles.length,
    isClientReviewerMode,
    legalAgreementPendingCount,
    linkedCalendarMaterialCount,
    linkedShotListMaterialCount,
    nextSignalList,
    onOpenManuscript,
    onOpenShotList,
    onOpenStoryboard,
    onPrepareShotListReview,
    onPrepareStoryboardReview,
    primaryStoryboardFocus,
    openSurfaceWorkspace,
    parsedBrandColors,
    parsedBrandDos,
    parsedBrandDonts,
    parsedBrandFonts,
    planningDraft.accountAccess.revokePlan,
    pendingReviewCount,
    pendingRequiredAccountCount,
    primaryLegalAgreement,
    primaryLegalAgreementUrl,
    referenceMaterialCount,
    requiredAccountEntries,
    storyboardPreviewTiles,
    workflowOpenLabels.manuscript,
    workflowOpenLabels.shotList,
    workflowOpenLabels.storyboard,
  ]);
  const canManageWorkspaceShell = canEditClientInput && !isClientReviewerMode;
  const showClientDashboard = isClientPortalView || isClientReviewerMode;
  const pendingClientReviews = useMemo(
    () => reviews
      .filter((review) => review.status === 'pending' || review.status === 'changes_requested')
      .sort((left, right) => {
        const leftDate = left.due_at ?? left.requested_at ?? left.created_at;
        const rightDate = right.due_at ?? right.requested_at ?? right.created_at;
        return leftDate.localeCompare(rightDate, 'nb-NO');
      }),
    [reviews],
  );
  const pendingAccountAccessReviews = useMemo(
    () => pendingClientReviews.filter((review) => readAccountAccessPlatformsFromReview(review).length > 0),
    [pendingClientReviews],
  );
  const accountAccessReviewByPlatform = useMemo(() => {
    const lookup = new Map<ProducerAccountAccessPlatform, ProducerClientReview>();
    pendingAccountAccessReviews.forEach((review) => {
      readAccountAccessPlatformsFromReview(review).forEach((platform) => {
        if (!lookup.has(platform)) {
          lookup.set(platform, review);
        }
      });
    });
    return lookup;
  }, [pendingAccountAccessReviews]);
  const activeVaultRevealRequestsByPlatform = useMemo(() => {
    const lookup = new Map<ProducerAccountAccessPlatform, RoleRoomAccessVaultRevealRequest>();
    ACCOUNT_ACCESS_PLATFORM_ORDER.forEach((platform) => {
      const request = (accessVaultRequestsByPlatform.get(platform) ?? [])
        .filter((entry) => entry.status === 'pending' || entry.status === 'approved')
        .sort((left, right) => (right.requestedAt ?? '').localeCompare(left.requestedAt ?? '', 'nb-NO'))[0];
      if (request) {
        lookup.set(platform, request);
      }
    });
    return lookup;
  }, [accessVaultRequestsByPlatform]);
  const accountAccessRequestCards = useMemo(() => {
    const vaultRequests = accessVaultState.requests
      .filter((request) => request.status === 'pending' || request.status === 'approved')
      .map((request) => ({
        id: `vault-request-${request.id}`,
        platform: request.platform,
        eyebrow: 'Vault-innsyn',
        title: `${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[request.platform]} · ${VAULT_REVEAL_REQUEST_STATUS_LABELS[request.status]}`,
        detail: readFirstNonEmptyString(
          request.requestReason ?? '',
          request.requestedAt ? `Bedt om ${formatTimestamp(request.requestedAt)}` : '',
          request.expiresAt ? `Utløper ${formatTimestamp(request.expiresAt)}` : '',
          'Secret krever beslutning eller innsyn.',
        ),
        actionLabel: request.status === 'approved' ? 'Åpne secrets' : 'Se forespørsel',
        href: '',
      }));
    const reviewRequests = pendingAccountAccessReviews.map((review) => {
      const platforms = readAccountAccessPlatformsFromReview(review);
      const primaryPlatform = platforms[0] ?? null;
      return {
        id: `review-${review.id}`,
        platform: primaryPlatform,
        eyebrow: 'Klientbekreftelse',
        title: review.title,
        detail: readFirstNonEmptyString(
          review.description ?? '',
          review.due_at ? `Frist ${formatTimestamp(review.due_at)}` : '',
          review.requested_at ? `Bedt om ${formatTimestamp(review.requested_at)}` : '',
        ),
        actionLabel: 'Åpne review',
        href: buildAccountAccessReviewUrl(review.id),
      };
    });
    const operationalRequests = effectiveAccountEntries
      .filter((entry) => entry.status === 'client_action' || entry.status === 'invite_sent' || entry.status === 'not_started')
      .map((entry) => ({
        id: `request-${entry.platform}`,
        platform: entry.platform,
        eyebrow: entry.status === 'invite_sent' ? 'Invitasjon sendt' : 'Trenger avklaring',
        title: PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform],
        detail: readFirstNonEmptyString(
          entry.accessScope,
          entry.status === 'client_action'
            ? 'Klienten må fullføre delegert tilgang eller bekrefte ansvarlig person.'
            : entry.status === 'invite_sent'
              ? 'Invitasjonen er sendt, men er ikke bekreftet ferdig ennå.'
              : 'Ingen sikker tilgang er definert ennå.',
        ),
        actionLabel: 'Åpne konto',
        href: '',
      }));
    return [...vaultRequests, ...reviewRequests, ...operationalRequests];
  }, [accessVaultState.requests, buildAccountAccessReviewUrl, effectiveAccountEntries, pendingAccountAccessReviews]);
  const accessVaultPendingRequests = useMemo(
    () => accessVaultState.requests.filter((request) => request.status === 'pending'),
    [accessVaultState.requests],
  );
  const accessVaultApprovedRequests = useMemo(
    () => accessVaultState.requests.filter((request) => request.status === 'approved'),
    [accessVaultState.requests],
  );
  const accountAccessOperationalRequestCards = useMemo(
    () => accountAccessRequestCards.filter((item) => !item.id.startsWith('vault-request-')),
    [accountAccessRequestCards],
  );
  const accountAccessSensitiveEntries = useMemo(
    () => effectiveAccountEntries.filter((entry) => (
      entry.tier === 'sensitive_secret'
      || entry.method === 'manual_handoff'
      || entry.secretStatus !== 'not_shared'
      || accessVaultSecretsByPlatform.has(entry.platform)
    )),
    [accessVaultSecretsByPlatform, effectiveAccountEntries],
  );
  const accountAccessAuditItems = useMemo(() => {
    if (accessVaultState.audit.length > 0) {
      return accessVaultState.audit.map((item) => ({
        id: item.id,
        platform: item.platform ?? null,
        title: VAULT_AUDIT_ACTION_LABELS[item.action ?? ''] ?? 'Vault-hendelse',
        detail: readFirstNonEmptyString(
          typeof item.metadata.label === 'string' ? item.metadata.label : '',
          typeof item.metadata.requestReason === 'string' ? item.metadata.requestReason : '',
          typeof item.metadata.approvalNotes === 'string' ? item.metadata.approvalNotes : '',
          typeof item.metadata.revealPolicy === 'string' ? `Policy: ${item.metadata.revealPolicy}` : '',
          item.actorRole ? `Utført som ${item.actorRole}` : '',
          'Ingen detaljer loggført.',
        ),
        createdAt: item.createdAt ?? '',
      }));
    }
    const entryEvents = effectiveAccountEntries
      .filter((entry) => hasText(entry.lastUpdatedAt))
      .map((entry) => ({
        id: `audit-${entry.platform}`,
        platform: entry.platform,
        title: `${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]} oppdatert`,
        detail: [
          PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status],
          PRODUCER_ACCOUNT_ACCESS_TIER_LABELS[entry.tier ?? 'delegated_access'],
          entry.ownerName ? `Eier: ${entry.ownerName}` : '',
        ].filter(hasText).join(' · '),
        createdAt: entry.lastUpdatedAt ?? '',
      }));
    const reviewEvents = pendingAccountAccessReviews.map((review) => ({
      id: `audit-review-${review.id}`,
      platform: readAccountAccessPlatformsFromReview(review)[0] ?? null,
      title: review.status === 'changes_requested' ? 'Klient ba om endringer' : 'Klientreview venter',
      detail: review.title,
      createdAt: review.requested_at ?? review.created_at ?? '',
    }));
    return [...entryEvents, ...reviewEvents]
      .filter((item) => hasText(item.createdAt))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt, 'nb-NO'))
      .slice(0, 12);
  }, [accessVaultState.audit, effectiveAccountEntries, pendingAccountAccessReviews]);
  const readyDeliveryItems = useMemo(
    () => planningDraft.contentCalendar
      .filter((item) => item.status === 'scheduled' || item.status === 'published')
      .sort((left, right) => {
        const leftDate = left.publishAt ?? '9999-12-31T23:59:59.999Z';
        const rightDate = right.publishAt ?? '9999-12-31T23:59:59.999Z';
        return leftDate.localeCompare(rightDate, 'nb-NO');
      })
      .map((item) => ({
        id: item.id,
        title: readFirstNonEmptyString(item.title, 'Leveranse uten tittel'),
        eyebrow: PRODUCER_CONTENT_CALENDAR_STATUS_LABELS[item.status ?? 'planned'],
        detail: [
          readFirstNonEmptyString(item.channel, 'Kanal ikke satt'),
          readFirstNonEmptyString(item.format, 'Format ikke satt'),
          item.publishAt ? formatTimestamp(item.publishAt) : '',
        ].filter(hasText).join(' · '),
      })),
    [planningDraft.contentCalendar],
  );
  const clientPortalReviewUrl = useMemo(
    () => buildClientPortalUrl(projectId, {
      tab: 'reviews',
      workspace: 'brief',
      reviewId: pendingClientReviews[0]?.id,
    }),
    [pendingClientReviews, projectId],
  );
  const clientPortalAccountAccessReviewUrl = useMemo(
    () => buildAccountAccessReviewUrl(pendingAccountAccessReviews[0]?.id),
    [buildAccountAccessReviewUrl, pendingAccountAccessReviews],
  );
  const clientPortalExportUrl = useMemo(
    () => buildClientPortalUrl(projectId, {
      tab: 'export',
      workspace: 'delivery',
    }),
    [projectId],
  );
  const clientDashboardCards = useMemo<ClientDashboardCard[]>(() => {
    const leadCard: ClientDashboardCard = foundationBlockingItems.length > 0
      ? {
        id: 'now',
        title: 'Dette må du gjøre nå',
        summary: 'Produksjonsgrunnlaget må være tydelig før godkjenninger, leveranser og publisering gir mening.',
        chipLabel: `${foundationBlockingItems.length} blokkerer`,
        priority: foundationBlockingItems.length >= 3 ? 'critical' : 'warning',
        items: foundationBlockingItems.slice(0, 3).map((item, index) => ({
          id: item.id,
          eyebrow: index === 0 ? 'Grunnlag' : undefined,
          title: item.label,
          detail: clientGroundingRequests[index] ?? 'Dette må fylles ut før videre beslutninger blir presise.',
        })),
        action: {
          id: 'open-brief-dashboard',
          label: activeWorkspace === 'brief' ? 'Fortsett i briefen' : 'Åpne briefen',
          variant: 'contained',
          onClick: () => {
            setActiveBriefStep(recommendedBriefStep);
            openSurfaceWorkspace('brief');
          },
        },
      }
      : pendingAccountAccessReviews.length > 0
        ? {
          id: 'now',
          title: 'Dette må du gjøre nå',
          summary: 'Kontotilgang må avklares før publisering, handoff og overlevering kan kjøres trygt.',
          chipLabel: `${pendingAccountAccessReviews.length} åpne`,
          priority: pendingAccountAccessReviews.some((review) => review.status === 'changes_requested') ? 'warning' : 'info',
          items: pendingAccountAccessReviews.slice(0, 3).map((review) => {
            const platformLabels = readAccountAccessPlatformsFromReview(review)
              .map((platform) => PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[platform])
              .join(', ');
            return {
              id: review.id,
              eyebrow: `Kontotilgang${hasText(platformLabels) ? ` · ${platformLabels}` : ''}`,
              title: review.title,
              detail: readFirstNonEmptyString(
                review.description ?? '',
                review.due_at ? `Svar innen ${formatTimestamp(review.due_at)}` : '',
                `Bedt om ${formatTimestamp(review.requested_at)}`,
              ),
              actionLabel: 'Åpne review',
              href: buildAccountAccessReviewUrl(review.id),
            };
          }),
          action: clientPortalAccountAccessReviewUrl
            ? {
              id: 'open-account-access-reviews-dashboard',
              label: 'Åpne kontotilgang',
              variant: 'contained',
              href: clientPortalAccountAccessReviewUrl,
            }
            : undefined,
        }
        : pendingClientReviews.length > 0
        ? {
          id: 'now',
          title: 'Dette må du gjøre nå',
          summary: 'Det ligger åpne godkjenninger som stopper neste del av flyten.',
          chipLabel: `${pendingClientReviews.length} åpne`,
          priority: pendingClientReviews.some((review) => review.status === 'changes_requested') ? 'warning' : 'info',
          items: pendingClientReviews.slice(0, 3).map((review) => ({
            id: review.id,
            eyebrow: review.status === 'changes_requested' ? 'Endringer ønsket' : 'Venter på svar',
            title: review.title,
            detail: readFirstNonEmptyString(
              review.description ?? '',
              review.due_at ? `Svar innen ${formatTimestamp(review.due_at)}` : '',
              `Bedt om ${formatTimestamp(review.requested_at)}`,
            ),
          })),
          action: clientPortalReviewUrl
            ? {
              id: 'open-reviews-dashboard',
              label: 'Åpne godkjenninger',
              variant: 'contained',
              href: clientPortalReviewUrl,
            }
            : undefined,
        }
        : clientContributionTasks.length > 0
          ? {
            id: 'now',
            title: 'Dette må du gjøre nå',
            summary: 'Neste beslutning ligger i brief, merkevare, materialer eller leveringsrutine.',
            chipLabel: `${clientContributionTasks.length} åpne`,
            priority: 'info',
            items: clientContributionTasks.slice(0, 3).map((task) => ({
              id: task.id,
              eyebrow: PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType],
              title: task.title,
              detail: task.detail,
              actionLabel: 'Åpne',
              onAction: () => applyContributionTask(task),
            })),
            action: {
              id: 'open-next-choice-dashboard',
              label: 'Fortsett i arbeidsflaten',
              variant: 'contained',
              onClick: () => applyContributionTask(clientContributionTasks[0]!),
            },
          }
          : readyDeliveryItems.length > 0
            ? {
              id: 'now',
              title: 'Dette må du gjøre nå',
              summary: 'Leveranser er klare til overlevering eller publisering.',
              chipLabel: `${readyDeliveryItems.length} klare`,
              priority: 'ready',
              items: readyDeliveryItems.slice(0, 3),
              action: clientPortalExportUrl
                ? {
                  id: 'open-export-dashboard',
                  label: 'Åpne leveranser',
                  variant: 'contained',
                  href: clientPortalExportUrl,
                }
                : undefined,
            }
            : {
              id: 'now',
              title: 'Dette må du gjøre nå',
              summary: 'Ingen akutte blokkere akkurat nå. Neste steg er å holde godkjenninger og leveranser stramme.',
              chipLabel: 'Rolig spor',
              priority: 'ready',
              items: [
                {
                  id: 'now-clear',
                  title: 'Grunnlaget er på plass',
                  detail: 'Fortsett med merkevare, godkjenning eller leveranse når dere er klare.',
                },
              ],
            };

    return [
      leadCard,
      {
        id: 'choices',
        title: 'Ventende valg',
        summary: clientContributionTasks.length > 0
          ? 'Dette er valgene som fortsatt trenger klientinnspill eller bekreftelse.'
          : 'Ingen åpne valg akkurat nå.',
        chipLabel: `${clientContributionTasks.length} valg`,
        priority: clientContributionTasks.length > 0 ? 'warning' : 'ready',
        items: clientContributionTasks.length > 0
          ? clientContributionTasks.slice(0, 3).map((task) => ({
            id: `choice-${task.id}`,
            eyebrow: `${PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType]} · ${PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[task.status]}`,
            title: task.title,
            detail: task.detail,
            actionLabel: 'Åpne',
            onAction: () => applyContributionTask(task),
          }))
          : [{
            id: 'choice-clear',
            title: 'Alle valg er avklart',
            detail: 'Brief, materiale, merkevare og leveringsrutine er i en tilstand som ikke krever nye klientvalg akkurat nå.',
          }],
        action: clientContributionTasks.length > 0
          ? {
            id: 'open-choices-dashboard',
            label: 'Åpne valg',
            variant: 'outlined',
            onClick: () => applyContributionTask(clientContributionTasks[0]!),
          }
          : undefined,
      },
      {
        id: 'approvals',
        title: 'Ventende godkjenninger',
        summary: pendingClientReviews.length > 0
          ? 'Disse sakene må godkjennes eller få endringsønsker før flyten går videre.'
          : 'Ingen åpne godkjenninger akkurat nå.',
        chipLabel: `${pendingClientReviews.length} reviews`,
        priority: pendingClientReviews.length > 0 ? 'info' : 'ready',
        items: pendingClientReviews.length > 0
          ? pendingClientReviews.slice(0, 3).map((review) => {
            const platformLabels = readAccountAccessPlatformsFromReview(review)
              .map((platform) => PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[platform])
              .join(', ');
            const isAccountAccessReview = platformLabels.length > 0;
            return {
              id: `approval-${review.id}`,
              eyebrow: isAccountAccessReview
                ? `Kontotilgang · ${platformLabels}`
                : review.status === 'changes_requested'
                  ? 'Endringer ønsket'
                  : 'Venter på godkjenning',
              title: review.title,
              detail: readFirstNonEmptyString(
                review.description ?? '',
                review.due_at ? `Svar innen ${formatTimestamp(review.due_at)}` : '',
                `Bedt om ${formatTimestamp(review.requested_at)}`,
              ),
              actionLabel: isAccountAccessReview ? 'Åpne review' : undefined,
              href: isAccountAccessReview ? buildAccountAccessReviewUrl(review.id) : undefined,
            };
          })
          : [{
            id: 'approval-clear',
            title: 'Ingen åpne reviews',
            detail: 'Når noe sendes til godkjenning, dukker det opp her med direkte vei til reviewsporet.',
          }],
        action: pendingClientReviews.length > 0 && clientPortalReviewUrl
          ? {
            id: 'open-approvals-dashboard',
            label: 'Åpne godkjenninger',
            variant: 'outlined',
            href: clientPortalReviewUrl,
          }
          : undefined,
      },
      {
        id: 'deliveries',
        title: 'Klare leveranser',
        summary: readyDeliveryItems.length > 0
          ? 'Dette er leveranser som allerede er klare for overlevering, eksport eller publisering.'
          : planningDraft.contentCalendar.length > 0
            ? 'Ingen leveranser er markert klare ennå.'
            : 'Ingen leveranser er planlagt ennå.',
        chipLabel: `${readyDeliveryItems.length} klare`,
        priority: readyDeliveryItems.length > 0 ? 'ready' : 'info',
        items: readyDeliveryItems.length > 0
          ? readyDeliveryItems.slice(0, 3)
          : [{
            id: 'delivery-clear',
            title: planningDraft.contentCalendar.length > 0 ? 'Leveranser bygges fortsatt' : 'Ingen leveranser planlagt',
            detail: planningDraft.contentCalendar.length > 0
              ? 'Når et punkt er planlagt publisert eller publisert, vises det her som klart spor.'
              : 'Legg inn leveranser i content-kalenderen for å få et konkret publiserings- og eksportløp.',
          }],
        action: readyDeliveryItems.length > 0 && clientPortalExportUrl
          ? {
            id: 'open-deliveries-dashboard',
            label: 'Åpne leveranser',
            variant: 'outlined',
            href: clientPortalExportUrl,
          }
          : {
            id: 'open-delivery-workspace-dashboard',
            label: 'Åpne leveringsrutine',
            variant: 'outlined',
            onClick: () => openSurfaceWorkspace('delivery'),
          },
      },
    ];
  }, [
    activeWorkspace,
    applyContributionTask,
    buildAccountAccessReviewUrl,
    clientContributionTasks,
    clientGroundingRequests,
    clientPortalAccountAccessReviewUrl,
    clientPortalExportUrl,
    clientPortalReviewUrl,
    foundationBlockingItems,
    openSurfaceWorkspace,
    pendingAccountAccessReviews,
    pendingClientReviews,
    planningDraft.contentCalendar.length,
    readyDeliveryItems,
    recommendedBriefStep,
  ]);
  const primaryWorkspaceSupportSection = workspaceSupportPanel.sections[0] ?? null;
  const primaryWorkspaceSupportAction = primaryWorkspaceSupportSection?.actions?.[0] ?? null;
  const primaryWorkspaceSupportItem = primaryWorkspaceSupportSection?.items?.[0] ?? null;
  const workspaceSupportPriorityTheme = WORKSPACE_SUPPORT_PRIORITY_THEME[workspaceSupportPanel.priority];
  const renderFieldLead = (description: string, status: 'filled' | 'missing' | 'optional' = 'missing') => {
    const statusStyles = status === 'filled'
      ? {
        border: '1px solid rgba(34,197,94,0.18)',
        background: 'rgba(34,197,94,0.1)',
        color: '#86efac',
        label: 'Fylt ut',
      }
      : status === 'optional'
        ? {
          border: '1px solid rgba(148,163,184,0.14)',
          background: 'rgba(148,163,184,0.08)',
          color: 'rgba(203,213,225,0.78)',
          label: 'Valgfritt',
        }
        : {
          border: '1px solid rgba(96,165,250,0.14)',
          background: 'rgba(59,130,246,0.1)',
          color: '#bfdbfe',
          label: 'Mangler',
        };

    return (
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={0.45}
        sx={{ mb: 0.45, px: 0.15 }}
      >
        <Typography sx={{ color: 'rgba(148,163,184,0.76)', fontSize: '0.72rem', lineHeight: 1.55, minWidth: 0 }}>
          {description}
        </Typography>
        <Box
          sx={{
            flexShrink: 0,
            px: 0.62,
            py: 0.22,
            borderRadius: 999,
            border: statusStyles.border,
            bgcolor: statusStyles.background,
          }}
        >
          <Typography sx={{ color: statusStyles.color, fontSize: '0.64rem', fontWeight: 700, lineHeight: 1.1 }}>
            {statusStyles.label}
          </Typography>
        </Box>
      </Stack>
    );
  };
  const handleOpenWorkspaceTools = useCallback((event: MouseEvent<HTMLElement>) => {
    setWorkspaceToolsAnchorEl(event.currentTarget);
  }, []);
  const handleCloseWorkspaceTools = useCallback(() => {
    setWorkspaceToolsAnchorEl(null);
  }, []);

  const renderWorkspacePageNode = (page: ProducerWorkspacePage, depth = 0) => {
    const isActive = page.id === activePage?.id;
    const childPages = activeSection ? buildPageTree(activeSection, page.id) : [];

    return (
      <Box key={page.id} sx={{ ml: depth > 0 ? depth * 1.4 : 0 }}>
        <Box
          onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
          onDrop={() => {
            void handlePageDropBefore(activeSection?.id ?? '', page.id);
          }}
          sx={{
            height: 8,
            borderTop: draggedPageRef && draggedPageRef.pageId !== page.id
              ? '1px dashed rgba(96,165,250,0.32)'
              : '1px solid transparent',
            borderRadius: 999,
          }}
        />
        <Box
          draggable={canManageWorkspaceShell}
          onDragStart={() => {
            if (!canManageWorkspaceShell) {
              return;
            }
            handlePageDragStart(activeSection?.id ?? '', page.id);
          }}
          onDragEnd={() => setDraggedPageRef(null)}
          onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
          onDrop={() => {
            if (!canManageWorkspaceShell) {
              return;
            }
            void handlePageDropInto(activeSection?.id ?? '', page.id);
          }}
          onContextMenu={(event) => {
            if (!activeSection || !canManageWorkspaceShell) {
              return;
            }
            openWorkspaceContextMenu(event, 'page', activeSection, page);
          }}
          onClick={() => {
            if (!activeSection) {
              return;
            }
            selectPage(activeSection.id, page.id);
          }}
          sx={{
            p: 1,
            borderRadius: 2,
            border: isActive ? `1px solid ${page.color ?? '#38bdf8'}` : '1px solid rgba(96,165,250,0.14)',
            bgcolor: isActive ? 'rgba(15,23,42,0.88)' : 'rgba(15,23,42,0.56)',
            boxShadow: isActive ? '0 14px 32px rgba(0,0,0,0.28)' : 'none',
            cursor: 'pointer',
            transition: 'transform 120ms ease, border-color 120ms ease, background-color 120ms ease',
            '&:hover': {
              transform: 'translateY(-1px)',
              borderColor: page.color ?? '#38bdf8',
              bgcolor: isActive ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.62)',
            },
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              {canManageWorkspaceShell ? <DragIndicatorIcon sx={{ color: 'rgba(148,163,184,0.74)', fontSize: 17 }} /> : null}
              {depth > 0 ? <SubdirectoryArrowRightIcon sx={{ color: 'rgba(148,163,184,0.66)', fontSize: 16 }} /> : null}
              {getWorkspaceSurfaceIcon(page.surface)}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.89rem' }} noWrap>
                  {page.title}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.62)', fontSize: '0.76rem' }} noWrap>
                  {`${PRODUCER_WORKSPACE_SURFACE_LABELS[page.surface]} · ${page.clientVisible !== false ? 'Klient ser' : 'Kun internt'}`}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.35} alignItems="center">
              {page.pinned && canManageWorkspaceShell ? <PushPinIcon sx={{ color: '#f8fafc', fontSize: 16 }} /> : null}
              <FiberManualRecordIcon sx={{ color: page.color ?? '#38bdf8', fontSize: 10 }} />
            </Stack>
          </Stack>
        </Box>
        {childPages.length > 0 ? (
          <Stack spacing={0.55} sx={{ mt: 0.55 }}>
            {childPages.map((childPage) => renderWorkspacePageNode(childPage, depth + 1))}
          </Stack>
        ) : null}
      </Box>
    );
  };

  const pageNavigationRail = activeSection ? (
    <Box
      sx={{
        width: { xs: '100%', xl: 224 },
        p: 1,
        borderRadius: 1.7,
        border: '1px solid rgba(148,163,184,0.18)',
        bgcolor: 'rgba(15,23,42,0.55)',
        alignSelf: 'flex-start',
        '@media (min-width: 3840px)': { width: 256 },
        '@media (min-width: 5120px)': { width: 280 },
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row', xl: 'column' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
            Sider i {activeSection.title}
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.25 }}>
            Dra en side til linjen for å endre rekkefølge, eller slipp den på en annen side for å lage underside.
          </Typography>
        </Box>
        {canManageWorkspaceShell ? (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddOutlinedIcon />}
            onClick={() => {
              void handleCreatePage();
            }}
            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
          >
            Ny side
          </Button>
        ) : null}
      </Stack>

      {canManageWorkspaceShell ? (
        <Box
          onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
          onDrop={() => {
            void handlePageDropToRoot(activeSection.id);
          }}
          sx={{
            mb: 0.85,
            p: 0.8,
            borderRadius: 1.25,
            border: '1px dashed rgba(56,189,248,0.32)',
            color: '#bfdbfe',
            fontSize: '0.78rem',
          }}
        >
          Slipp her for å gjøre siden til toppnivå
        </Box>
      ) : null}

      <Stack spacing={0.55}>
        {activeSectionRootPages.map((page) => renderWorkspacePageNode(page))}
      </Stack>
    </Box>
  ) : null;
  const referenceWorkspaceRail = useReferenceWorkspaceShell ? (
    <Box
      sx={{
        width: { xs: '100%', lg: 196 },
        display: 'flex',
        flexDirection: 'column',
        gap: 0.55,
        p: 0.72,
        borderRadius: 2.6,
        border: '1px solid rgba(96,165,250,0.12)',
        bgcolor: 'rgba(7,16,34,0.84)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        alignSelf: 'flex-start',
        position: { lg: 'sticky' },
        top: { lg: 18 },
        '@media (min-width: 3840px)': { width: 220 },
        '@media (min-width: 5120px)': { width: 236 },
      }}
    >
      <Box sx={{ px: 0.45, pb: 0.2 }}>
        <Typography sx={{ color: 'rgba(191,219,254,0.6)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Arbeidsflate
        </Typography>
        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', mt: 0.15 }}>
          {activeSection?.title ?? 'Workspace'}
        </Typography>
      </Box>

      <Stack spacing={0.55}>
        {workspaceRootNavigationEntries.map(({ sectionId, page }) => {
          const isActive = activeSection?.id === sectionId && activePage?.id === page.id;
          return (
            <Box
              key={page.id}
              data-testid={`producer-media-page-${page.surface}`}
              onClick={() => selectPage(sectionId, page.id)}
              onContextMenu={(event) => {
                if (!canManageWorkspaceShell) {
                  return;
                }
                const parentSection = workspaceSections.find((section) => section.id === sectionId);
                if (!parentSection) {
                  return;
                }
                openWorkspaceContextMenu(event, 'page', parentSection, page);
              }}
              sx={{
                px: 0.9,
                py: 0.78,
                borderRadius: 1.7,
                border: isActive ? `1px solid ${page.color ?? '#38bdf8'}` : '1px solid rgba(96,165,250,0.08)',
                bgcolor: isActive ? 'rgba(23,37,66,0.96)' : 'rgba(10,18,34,0.48)',
                cursor: 'pointer',
                transition: 'transform 120ms ease, border-color 120ms ease, background-color 120ms ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  borderColor: page.color ?? '#38bdf8',
                  bgcolor: isActive ? 'rgba(23,37,66,0.98)' : 'rgba(15,23,42,0.76)',
                },
              }}
            >
                <Stack direction="row" spacing={0.8} alignItems="center">
                  {getWorkspaceSurfaceIcon(page.surface)}
                  <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.55 }}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem' }} noWrap>
                      {page.title}
                    </Typography>
                    {isActive ? <FiberManualRecordIcon sx={{ color: page.color ?? '#38bdf8', fontSize: 8 }} /> : null}
                  </Box>
                </Stack>
              </Box>
          );
        })}
      </Stack>
    </Box>
  ) : null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        p: { xs: 1.2, md: 1.45 },
        borderRadius: 4,
        border: '1px solid rgba(96,165,250,0.14)',
        background: 'radial-gradient(circle at top left, rgba(59,130,246,0.22) 0%, rgba(15,23,42,0.96) 36%, rgba(2,6,23,0.98) 100%)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={0.7}
        justifyContent="space-between"
        alignItems={{ lg: 'center' }}
        sx={{
          p: { xs: 0.75, md: 0.9 },
          borderRadius: 2.4,
          border: '1px solid rgba(96,165,250,0.12)',
          bgcolor: 'rgba(8,15,30,0.5)',
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.65} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 0.18 }}>
            <Typography
              sx={{
                color: '#f8fafc',
                fontWeight: 650,
                fontSize: { xs: '1.12rem', md: '1.28rem' },
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                fontFamily: '"Manrope","Avenir Next","Segoe UI",sans-serif',
              }}
            >
              {isClientReviewerMode ? 'Klientflate' : 'Creative Sync Workspace'}
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1,
                py: 0.36,
                borderRadius: 999,
                bgcolor: activeWorkspaceCard.accent,
              }}
            >
              <Typography sx={{ color: activeWorkspaceCard.textColor, fontSize: '0.72rem', fontWeight: 700 }}>
                {activeWorkspaceCard.progressLabel}
              </Typography>
            </Box>
          </Stack>
          <Typography
            sx={{
              color: 'rgba(226,232,240,0.88)',
              maxWidth: 860,
              fontSize: '0.76rem',
              lineHeight: 1.45,
              display: { xs: 'none', sm: 'block' },
              '@media (min-width: 3840px)': { maxWidth: 1320, fontSize: '0.84rem' },
              '@media (min-width: 5120px)': { maxWidth: 1520, fontSize: '0.9rem' },
            }}
          >
            {mediaHeaderDescription}
          </Typography>
        </Box>
        <Stack spacing={0.45} alignItems={{ lg: 'flex-end' }}>
          <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap justifyContent={{ lg: 'flex-end' }}>
            {canUseRoleRoomAgent && roleRoomAgentAccess?.allowed ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<AutoFixHighIcon />}
                onClick={() => {
                  setRoleRoomAgentError(null);
                  setRoleRoomAgentNotice(null);
                  setRoleRoomAgentDialogOpen(true);
                }}
                disabled={loadingRoleRoomAgentAccess}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  minHeight: 44,
                  borderRadius: 999,
                  px: 1.15,
                  color: '#082f49',
                  background: 'linear-gradient(135deg, rgba(34,211,238,0.96) 0%, rgba(59,130,246,0.96) 100%)',
                  boxShadow: '0 10px 28px rgba(34,211,238,0.16)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(103,232,249,1) 0%, rgba(96,165,250,1) 100%)',
                  },
                }}
              >
                The Role Room Agent
              </Button>
            ) : null}
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={() => setShowWorkspaceOperations((previous) => !previous)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                minHeight: 44,
                borderRadius: 999,
                px: 0.95,
                color: showWorkspaceOperations ? '#bfdbfe' : '#e2e8f0',
                bgcolor: showWorkspaceOperations ? 'rgba(59,130,246,0.12)' : 'transparent',
                borderColor: 'rgba(96,165,250,0.22)',
                '&:hover': {
                  bgcolor: 'rgba(248,250,252,0.06)',
                  borderColor: 'rgba(96,165,250,0.32)',
                },
              }}
            >
              {showWorkspaceOperations ? 'Skjul oppsett' : 'Workspace-oppsett'}
            </Button>
            {canManageWorkspaceShell ? (
              <Tooltip title="Flere workspace-valg">
                <IconButton
                  onClick={handleOpenWorkspaceTools}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: '1px solid rgba(96,165,250,0.18)',
                    color: '#e2e8f0',
                    bgcolor: 'rgba(15,23,42,0.72)',
                  }}
                >
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {roleRoomAgentNotice ? <Alert severity="success">{roleRoomAgentNotice}</Alert> : null}
      {loading ? <Alert severity="info">Laster klientbrief og materiale.</Alert> : null}

      <Box
        sx={{
          px: { xs: 0.95, md: 1.1 },
          py: { xs: 0.85, md: 0.95 },
          borderRadius: 2.4,
          border: '1px solid rgba(96,165,250,0.14)',
          background: 'linear-gradient(145deg, rgba(15,23,42,0.94) 0%, rgba(30,41,59,0.74) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xl: 'center' }}>
          <Stack spacing={0.32} sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
              {mediaHeaderMeta}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.74rem', lineHeight: 1.4 }}>
              {focusedArtifact ? `Fokus: ${focusedArtifact.title}` : clientMetaLabel}
            </Typography>
          </Stack>
          <Stack
            spacing={0.28}
            sx={{
              minWidth: 0,
              maxWidth: { xl: 620 },
              '@media (min-width: 3840px)': { maxWidth: 920 },
              '@media (min-width: 5120px)': { maxWidth: 1120 },
            }}
          >
            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.88rem' }}>
              Retning · {creativeDirectionTitle}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.75rem', lineHeight: 1.42 }}>
              {directionSupportText}
            </Typography>
            <Typography sx={{ color: 'rgba(191,219,254,0.92)', fontSize: '0.73rem', lineHeight: 1.4 }}>
              {readinessSummaryText}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      {showClientDashboard ? (
        <Box
          sx={{
            p: { xs: 0.95, md: 1.1 },
            borderRadius: 2.8,
            border: '1px solid rgba(96,165,250,0.14)',
            background: 'linear-gradient(145deg, rgba(9,17,34,0.94) 0%, rgba(15,23,42,0.82) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <Stack spacing={0.9}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ md: 'center' }}>
              <Box>
                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.96rem' }}>
                  Dette må klienten holde styr på
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.22 }}>
                  Ett sted for valg, godkjenninger og leveranser. Ingen skjult arbeidsflyt bak flere paneler.
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={`${clientContributionTasks.length} valg`}
                  sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                />
                <Chip
                  size="small"
                  label={`${pendingClientReviews.length} godkjenninger`}
                  sx={{ bgcolor: 'rgba(248,250,252,0.08)', color: '#e2e8f0' }}
                />
                <Chip
                  size="small"
                  label={`${readyDeliveryItems.length} klare leveranser`}
                  sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }}
                />
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 0.9,
              }}
            >
              {clientDashboardCards.map((card) => {
                const priorityTheme = WORKSPACE_SUPPORT_PRIORITY_THEME[card.priority];
                return (
                  <Box
                    key={card.id}
                    sx={{
                      p: 0.95,
                      borderRadius: 2.3,
                      border: `1px solid ${priorityTheme.border}`,
                      background: priorityTheme.panelBackground,
                      boxShadow: `0 0 0 1px ${priorityTheme.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                    }}
                  >
                    <Stack spacing={0.8}>
                      <Stack direction="row" spacing={0.55} justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem', lineHeight: 1.25 }}>
                            {card.title}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.73rem', lineHeight: 1.4, mt: 0.2 }}>
                            {card.summary}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={card.chipLabel}
                          sx={{
                            bgcolor: priorityTheme.chipBackground,
                            color: priorityTheme.chipColor,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        />
                      </Stack>

                      <Stack spacing={0.55}>
                        {card.items.map((item) => (
                          <Box
                            key={item.id}
                            sx={{
                              p: 0.72,
                              borderRadius: 1.8,
                              border: `1px solid ${priorityTheme.itemBorder}`,
                              background: priorityTheme.itemBackground,
                            }}
                          >
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.7} justifyContent="space-between" alignItems={{ sm: 'flex-start' }}>
                              <Box sx={{ minWidth: 0 }}>
                                {item.eyebrow ? (
                                  <Typography sx={{ color: priorityTheme.chipColor, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.22 }}>
                                    {item.eyebrow}
                                  </Typography>
                                ) : null}
                                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.77rem', lineHeight: 1.35 }}>
                                  {item.title}
                                </Typography>
                                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.71rem', lineHeight: 1.42, mt: 0.12 }}>
                                  {item.detail}
                                </Typography>
                              </Box>
                              {item.actionLabel ? (
                                item.href ? (
                                  <Button
                                    size="small"
                                    component="a"
                                    href={item.href}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      minHeight: 34,
                                      borderRadius: 999,
                                      px: 1,
                                      color: priorityTheme.actionColor,
                                      bgcolor: priorityTheme.actionBackground,
                                      '&:hover': {
                                        bgcolor: priorityTheme.actionHover,
                                      },
                                    }}
                                  >
                                    {item.actionLabel}
                                  </Button>
                                ) : (
                                  <Button
                                    size="small"
                                    onClick={item.onAction}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      minHeight: 34,
                                      borderRadius: 999,
                                      px: 1,
                                      color: priorityTheme.actionColor,
                                      bgcolor: priorityTheme.actionBackground,
                                      '&:hover': {
                                        bgcolor: priorityTheme.actionHover,
                                      },
                                    }}
                                  >
                                    {item.actionLabel}
                                  </Button>
                                )
                              ) : null}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>

                      {card.action ? (
                        card.action.href ? (
                          <Button
                            fullWidth
                            size="small"
                            component="a"
                            href={card.action.href}
                            variant={card.action.variant ?? 'contained'}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              minHeight: 38,
                              borderRadius: 999,
                            }}
                          >
                            {card.action.label}
                          </Button>
                        ) : (
                          <Button
                            fullWidth
                            size="small"
                            variant={card.action.variant ?? 'contained'}
                            onClick={card.action.onClick}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              minHeight: 38,
                              borderRadius: 999,
                            }}
                          >
                            {card.action.label}
                          </Button>
                        )
                      ) : null}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Stack>
        </Box>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          flexDirection: displayWorkspaceNavigation.sectionTabPlacement === 'left' ? 'row' : 'column',
          gap: 1.25,
        }}
      >
        {displayWorkspaceNavigation.sectionTabPlacement === 'left' && !useReferenceWorkspaceShell ? (
          <Box
            sx={{
              width: { xs: '100%', lg: useReferenceWorkspaceShell ? 186 : 196 },
              display: 'flex',
              flexDirection: 'column',
              gap: useReferenceWorkspaceShell ? 0.7 : 0.9,
              p: useReferenceWorkspaceShell ? 0.9 : 1,
              borderRadius: useReferenceWorkspaceShell ? 3.4 : 3,
              border: '1px solid rgba(96,165,250,0.12)',
              bgcolor: useReferenceWorkspaceShell ? 'rgba(7,16,34,0.84)' : 'rgba(15,23,42,0.7)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              alignSelf: 'flex-start',
              position: { lg: 'sticky' },
              top: { lg: 18 },
            }}
          >
            {useReferenceWorkspaceShell ? (
              <>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2.7,
                    border: '1px solid rgba(96,165,250,0.12)',
                    bgcolor: 'rgba(19,33,58,0.92)',
                  }}
                >
                  <Stack spacing={0.9} alignItems="center">
                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(96,165,250,0.1)', color: '#f8fafc', fontWeight: 800 }}>
                      {getInitials(producerDisplayName, 'P')}
                    </Avatar>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
                        {producerDisplayName}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.58)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        {activeSection?.title ?? 'Workspace'}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Stack spacing={0.55}>
                  {workspaceRootNavigationEntries.map(({ sectionId, sectionTitle, page }) => {
                    const isActive = activeSection?.id === sectionId && activePage?.id === page.id;
                    return (
                      <Box
                        key={page.id}
                        data-testid={`producer-media-page-${page.surface}`}
                        onClick={() => selectPage(sectionId, page.id)}
                        onContextMenu={(event) => {
                          if (!canManageWorkspaceShell) {
                            return;
                          }
                          const parentSection = workspaceSections.find((section) => section.id === sectionId);
                          if (!parentSection) {
                            return;
                          }
                          openWorkspaceContextMenu(event, 'page', parentSection, page);
                        }}
                        sx={{
                          px: 1.05,
                          py: 0.95,
                          borderRadius: 2.1,
                          border: isActive ? `1px solid ${page.color ?? '#38bdf8'}` : '1px solid rgba(96,165,250,0.08)',
                          bgcolor: isActive ? 'rgba(23,37,66,0.96)' : 'rgba(10,18,34,0.48)',
                          cursor: 'pointer',
                          transition: 'transform 120ms ease, border-color 120ms ease, background-color 120ms ease',
                          '&:hover': {
                            transform: 'translateY(-1px)',
                            borderColor: page.color ?? '#38bdf8',
                            bgcolor: isActive ? 'rgba(23,37,66,0.98)' : 'rgba(15,23,42,0.76)',
                          },
                        }}
                      >
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          {getWorkspaceSurfaceIcon(page.surface)}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.9rem' }} noWrap>
                              {page.title}
                            </Typography>
                            <Typography sx={{ color: 'rgba(203,213,225,0.54)', fontSize: '0.73rem' }} noWrap>
                              {`${sectionTitle} · ${page.clientVisible !== false ? 'Klient ser' : 'Kun internt'}`}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>

                {canManageWorkspaceShell ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditOutlinedIcon />}
                    onClick={() => setShowWorkspaceOperations(true)}
                    sx={{
                      mt: 0.35,
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 999,
                      color: '#bfdbfe',
                      borderColor: 'rgba(96,165,250,0.18)',
                    }}
                  >
                    Organiser workspace
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                {workspaceSections.map((section) => {
                  const isActive = section.id === activeSection?.id;
                  return (
                    <Box
                      key={section.id}
                      draggable={canManageWorkspaceShell}
                      onDragStart={() => {
                        if (!canManageWorkspaceShell) {
                          return;
                        }
                        handleSectionDragStart(section.id);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (!canManageWorkspaceShell) {
                          return;
                        }
                        void handleSectionDrop(section.id);
                      }}
                      onContextMenu={(event) => {
                        if (!canManageWorkspaceShell) {
                          return;
                        }
                        openWorkspaceContextMenu(event, 'section', section);
                      }}
                      sx={{
                        p: 1.05,
                        borderRadius: 2.2,
                        border: isActive ? `1px solid ${section.color ?? '#38bdf8'}` : '1px solid rgba(96,165,250,0.12)',
                        bgcolor: isActive ? 'rgba(15,23,42,0.92)' : 'rgba(15,23,42,0.46)',
                        cursor: 'pointer',
                        transition: 'transform 120ms ease, border-color 120ms ease, background-color 120ms ease',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          borderColor: section.color ?? '#38bdf8',
                          bgcolor: isActive ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.74)',
                        },
                      }}
                      onClick={() => selectSection(section.id)}
                    >
                      <Stack direction="row" spacing={0.85} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={0.85} alignItems="center" sx={{ minWidth: 0 }}>
                          {canManageWorkspaceShell ? <DragIndicatorIcon sx={{ color: 'rgba(148,163,184,0.76)', fontSize: 18 }} /> : null}
                          <FiberManualRecordIcon sx={{ color: section.color ?? '#38bdf8', fontSize: 11 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: '#f8fafc', fontWeight: 700 }} noWrap>
                              {section.title}
                            </Typography>
                            <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.78rem' }}>
                              {`${flattenProducerWorkspacePages(section).length} sider · ${PRODUCER_WORKSPACE_LAYOUT_LABELS[section.layout ?? 'split']}`}
                            </Typography>
                          </Box>
                        </Stack>
                        {canManageWorkspaceShell ? (
                          <Tooltip title={section.pinned ? 'Løsne seksjon' : 'Fest seksjon'}>
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleToggleSectionPinned(section.id);
                              }}
                            >
                              {section.pinned ? <PushPinIcon sx={{ color: '#f8fafc', fontSize: 18 }} /> : <PushPinOutlinedIcon sx={{ color: 'rgba(203,213,225,0.56)', fontSize: 18 }} />}
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
                {displayWorkspaceNavigation.navigationPinned && displayWorkspaceNavigation.pageTabPlacement === 'left' && activeSection ? (
                  <Box
                    sx={{
                      mt: 0.45,
                      pt: 0.9,
                      borderTop: '1px solid rgba(96,165,250,0.12)',
                    }}
                  >
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem', mb: 0.25 }}>
                      Sider i {activeSection.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.58)', fontSize: '0.76rem', mb: 0.75 }}>
                      {canManageWorkspaceShell
                        ? 'Drag sider for rekkefølge, eller legg dem som undersider.'
                        : 'Velg siden som skal være aktiv akkurat nå.'}
                    </Typography>
                    {canManageWorkspaceShell ? (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddOutlinedIcon />}
                        onClick={() => {
                          void handleCreatePage();
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700, mb: 0.85, alignSelf: 'flex-start' }}
                      >
                        Ny side
                      </Button>
                    ) : null}
                    {canManageWorkspaceShell ? (
                      <Box
                        onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                        onDrop={() => {
                          void handlePageDropToRoot(activeSection.id);
                        }}
                        sx={{
                          mb: 0.85,
                          p: 0.8,
                          borderRadius: 1.25,
                          border: '1px dashed rgba(56,189,248,0.32)',
                          color: '#bfdbfe',
                          fontSize: '0.78rem',
                        }}
                      >
                        Slipp her for å gjøre siden til toppnivå
                      </Box>
                    ) : null}
                    <Stack spacing={0.55}>
                      {activeSectionRootPages.map((page) => renderWorkspacePageNode(page))}
                    </Stack>
                  </Box>
                ) : null}
              </>
            )}
          </Box>
        ) : null}

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.1, minWidth: 0 }}>
          {displayWorkspaceNavigation.sectionTabPlacement === 'top' ? (
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.9} justifyContent="space-between">
              <Stack direction="row" spacing={0.85} flexWrap="wrap" useFlexGap>
                {workspaceSections.map((section) => {
                  const isActive = section.id === activeSection?.id;
                  return (
                    <Box
                      key={section.id}
                      draggable={canManageWorkspaceShell}
                      onDragStart={() => {
                        if (!canManageWorkspaceShell) {
                          return;
                        }
                        handleSectionDragStart(section.id);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (!canManageWorkspaceShell) {
                          return;
                        }
                        void handleSectionDrop(section.id);
                      }}
                      onContextMenu={(event) => {
                        if (!canManageWorkspaceShell) {
                          return;
                        }
                        openWorkspaceContextMenu(event, 'section', section);
                      }}
                      sx={{
                        cursor: 'pointer',
                        px: 1.15,
                        py: 0.85,
                        borderRadius: 1.6,
                        border: isActive ? `1px solid ${section.color ?? '#38bdf8'}` : '1px solid rgba(148,163,184,0.16)',
                        bgcolor: isActive ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.46)',
                      }}
                      onClick={() => selectSection(section.id)}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {canManageWorkspaceShell ? <DragIndicatorIcon sx={{ color: 'rgba(148,163,184,0.76)', fontSize: 18 }} /> : null}
                        <FiberManualRecordIcon sx={{ color: section.color ?? '#38bdf8', fontSize: 11 }} />
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                          {section.title}
                        </Typography>
                        {section.pinned && canManageWorkspaceShell ? <PushPinIcon sx={{ color: '#f8fafc', fontSize: 16 }} /> : null}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
              {canManageWorkspaceShell ? (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddOutlinedIcon />}
                  onClick={() => {
                    void handleCreateSection();
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                >
                  Ny seksjon
                </Button>
              ) : null}
            </Stack>
          ) : null}

          {useReferenceWorkspaceShell ? null : (
            <Box
              sx={{
                p: 1,
                borderRadius: 1.7,
                border: '1px solid rgba(148,163,184,0.16)',
                bgcolor: 'rgba(15,23,42,0.42)',
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Workspace
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                    {activeSection
                      ? `${activeSection.title} er aktiv seksjon. ${activeSectionPages.length} sider tilgjengelig.`
                      : 'Velg en seksjon for å åpne brief, materiale, merkevareguide eller leveringsrutine.'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                  <Chip
                    size="small"
                    label={PRODUCER_WORKSPACE_LAYOUT_LABELS[activeLayout]}
                    sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: '#e2e8f0' }}
                  />
                  <Chip
                    size="small"
                    label={displayWorkspaceNavigation.navigationPinned ? 'Navigasjon festet' : 'Navigasjon flytende'}
                    sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                  />
                  {!displayWorkspaceNavigation.navigationPinned && activeSectionPages.length > 0 ? (
                    activeSectionPages.slice(0, 4).map((page) => (
                      <Chip
                        key={page.id}
                        icon={getWorkspaceSurfaceIcon(page.surface)}
                        label={page.title}
                        onClick={() => {
                          if (!activeSection) {
                            return;
                          }
                          selectPage(activeSection.id, page.id);
                        }}
                        sx={{
                          bgcolor: page.id === activePage?.id ? `${page.color ?? '#38bdf8'}22` : 'rgba(148,163,184,0.12)',
                          color: page.id === activePage?.id ? '#f8fafc' : '#cbd5e1',
                          border: `1px solid ${page.color ?? '#38bdf8'}`,
                        }}
                      />
                    ))
                  ) : null}
                </Stack>
              </Stack>
            </Box>
          )}

          {activeLayout === 'grid' && activeSection ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              {workspaceSections.flatMap((section) => flattenProducerWorkspacePages(section).map((page) => ({
                sectionId: section.id,
                sectionTitle: section.title,
                page,
              }))).map(({ sectionId, sectionTitle, page }) => {
                const card = workspaceCards.find((item) => item.key === page.surface) ?? activeWorkspaceCard;
                const isActive = page.id === activePage?.id;
                return (
                  <Box
                    key={page.id}
                    data-testid={`producer-media-page-${page.surface}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectPage(sectionId, page.id)}
                    onContextMenu={(event) => {
                      const parentSection = workspaceSections.find((section) => section.id === sectionId);
                      if (!parentSection) {
                        return;
                      }
                      openWorkspaceContextMenu(event, 'page', parentSection, page);
                    }}
                    sx={{
                      p: 1.1,
                      borderRadius: 1.7,
                      border: isActive ? `1px solid ${page.color ?? '#38bdf8'}` : '1px solid rgba(148,163,184,0.16)',
                      bgcolor: isActive ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.48)',
                      cursor: 'pointer',
                    }}
                  >
                    <Stack direction="row" spacing={0.85} alignItems="center" sx={{ mb: 0.65 }}>
                      {getWorkspaceSurfaceIcon(page.surface)}
                      <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                        {page.title}
                      </Typography>
                      {page.pinned ? <PushPinIcon sx={{ color: '#fff', fontSize: 16 }} /> : null}
                    </Stack>
                    <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mb: 0.7 }}>
                      {getWorkspaceSurfaceDescription(page.surface, isClientReviewerMode)}
                    </Typography>
                    <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.76rem', mb: 0.55 }}>
                      {sectionTitle}
                    </Typography>
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={card.progressLabel}
                        sx={{ bgcolor: `${page.color ?? '#38bdf8'}22`, color: '#e2e8f0' }}
                      />
                      <Chip
                        size="small"
                        label={page.clientVisible !== false ? 'Klient ser' : 'Kun internt'}
                        sx={{
                          bgcolor: page.clientVisible !== false ? 'rgba(52,211,153,0.14)' : 'rgba(148,163,184,0.12)',
                          color: page.clientVisible !== false ? '#bbf7d0' : '#cbd5e1',
                        }}
                      />
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          ) : null}
        </Box>
      </Box>

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.35}
        alignItems="flex-start"
      >
        {useReferenceWorkspaceShell
          ? referenceWorkspaceRail
          : (
            displayWorkspaceNavigation.navigationPinned
            && displayWorkspaceNavigation.pageTabPlacement === 'left'
            && displayWorkspaceNavigation.sectionTabPlacement !== 'left'
              ? pageNavigationRail
              : null
          )}

        <Box
          sx={{
            flex: activeLayout === 'split' ? 1.22 : 1.3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          {showClientWorkspaceEmptyState ? (
            <Box
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(96,165,250,0.16)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                p: { xs: 1.6, md: 2 },
              }}
            >
              <Stack spacing={1.1}>
                <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.28rem' }}>
                  Ingen rom er åpnet for klient ennå
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', lineHeight: 1.65, maxWidth: 560 }}>
                  Produsenten har ikke delt noen rom i prosjektrommet ennå. Når et rom åpnes for klient, dukker det opp her automatisk.
                </Typography>
                <Alert severity="info" sx={{ bgcolor: 'rgba(8,47,73,0.34)', color: '#e2e8f0' }}>
                  Be produsenten åpne de rommene du skal bruke, for eksempel brief, materiale, levering eller møter.
                </Alert>
              </Stack>
            </Box>
          ) : null}

          <input
            ref={materialFileInputRef}
            type="file"
            hidden
            onChange={handleMaterialFileSelected}
          />
          <input
            ref={materialCameraInputRef}
            type="file"
            hidden
            accept="image/*,video/*"
            capture="environment"
            onChange={handleMaterialFileSelected}
          />

          {!showClientWorkspaceEmptyState && activeWorkspace === 'brief' ? (
            <Box
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(96,165,250,0.14)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                p: { xs: 1.25, md: 1.5 },
                '& .MuiInputBase-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(248,250,252,0.04)',
                  color: '#f8fafc',
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(203,213,225,0.62)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(96,165,250,0.14)',
                },
                '& .MuiFormHelperText-root': {
                  color: 'rgba(203,213,225,0.48)',
                },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.62rem', lineHeight: 1.05 }}>
                    Fullfør briefen
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.86rem', lineHeight: 1.55, mt: 0.3, maxWidth: 620 }}>
                    {isClientReviewerMode
                      ? 'Fyll inn grunnlaget produsenten trenger for å planlegge riktig.'
                      : 'Fyll inn prosjektgrunnlaget før du går videre til produksjon og godkjenning.'}
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.55} alignItems={{ md: 'flex-start' }}>
                  <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap>
                    <Box
                      sx={{
                        alignSelf: 'flex-start',
                        px: 0.7,
                        py: 0.28,
                        borderRadius: 999,
                        border: '1px solid rgba(96,165,250,0.12)',
                        bgcolor: briefWizardEnabled ? 'rgba(56,189,248,0.08)' : 'rgba(148,163,184,0.08)',
                      }}
                    >
                      <Typography
                        sx={{
                          color: briefWizardEnabled ? 'rgba(191,219,254,0.9)' : 'rgba(203,213,225,0.84)',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          lineHeight: 1.1,
                        }}
                      >
                        {briefWizardEnabled ? 'Wizard' : 'Fri flyt'}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        alignSelf: 'flex-start',
                        px: 0.7,
                        py: 0.28,
                        borderRadius: 999,
                        border: '1px solid rgba(96,165,250,0.08)',
                        bgcolor: 'rgba(15,23,42,0.24)',
                      }}
                    >
                      <Typography
                        sx={{
                          color: 'rgba(191,219,254,0.76)',
                          fontSize: '0.64rem',
                          fontWeight: 600,
                          lineHeight: 1.1,
                        }}
                      >
                        {intakeUpdatedLabel}
                      </Typography>
                    </Box>
                    {isMobileWorkspace ? (
                      <Box
                        sx={{
                          alignSelf: 'flex-start',
                          px: 0.7,
                          py: 0.28,
                          borderRadius: 999,
                          border: '1px solid rgba(74,222,128,0.14)',
                          bgcolor: 'rgba(20,83,45,0.24)',
                        }}
                      >
                        <Typography
                          sx={{
                            color: '#bbf7d0',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            lineHeight: 1.1,
                          }}
                        >
                          Mobilutkast lagres automatisk
                        </Typography>
                      </Box>
                    ) : null}
                  </Stack>
                  {canEditClientInput ? (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setBriefWizardEnabled((previous) => !previous)}
                      sx={{
                        px: 0.35,
                        py: 0.1,
                        minWidth: 0,
                        color: 'rgba(191,219,254,0.82)',
                        fontSize: '0.74rem',
                        textTransform: 'none',
                        fontWeight: 700,
                        alignSelf: 'flex-start',
                      }}
                    >
                      {briefWizardEnabled ? 'Gå fritt' : 'Start wizard'}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>

              {!isClientReviewerMode && !isMobileWorkspace ? (
                <Box
                  sx={{
                    mb: 1.05,
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid rgba(96,165,250,0.12)',
                    bgcolor: 'rgba(2,6,23,0.34)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={0.8}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    sx={{ mb: 0.95 }}
                  >
                    <Box>
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.98rem' }}>
                        Brief-sammendrag
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.2 }}>
                        Ett skjermkort med det viktigste produsenten trenger for å forstå retning, leveranse og oppfølging.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={`${briefSummarySections.length - briefSummaryMissingCount}/${briefSummarySections.length} felt klare`}
                        sx={{
                          bgcolor: 'rgba(56,189,248,0.14)',
                          color: '#bfdbfe',
                        }}
                      />
                      {briefSummaryMissingCount > 0 ? (
                        <Chip
                          size="small"
                          label={`${briefSummaryMissingCount} mangler fortsatt`}
                          sx={{
                            bgcolor: 'rgba(251,191,36,0.14)',
                            color: '#fde68a',
                          }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label="Klar til produksjon"
                          sx={{
                            bgcolor: 'rgba(34,197,94,0.14)',
                            color: '#86efac',
                          }}
                        />
                      )}
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      display: 'grid',
                      gap: 0.8,
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'repeat(2, minmax(0, 1fr))',
                        xl: 'repeat(3, minmax(0, 1fr))',
                      },
                    }}
                  >
                    {briefSummarySections.map((section) => (
                      <Box
                        key={section.key}
                        sx={{
                          minWidth: 0,
                          p: 0.9,
                          borderRadius: 1.6,
                          border: section.status === 'filled'
                            ? '1px solid rgba(56,189,248,0.12)'
                            : '1px solid rgba(251,191,36,0.12)',
                          bgcolor: section.status === 'filled'
                            ? 'rgba(15,23,42,0.28)'
                            : 'rgba(120,53,15,0.16)',
                        }}
                      >
                        <Stack direction="row" spacing={0.6} justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.45 }}>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.86rem' }}>
                            {section.label}
                          </Typography>
                          <Chip
                            size="small"
                            label={section.status === 'filled' ? 'Fylt ut' : 'Mangler'}
                            sx={{
                              height: 20,
                              bgcolor: section.status === 'filled'
                                ? 'rgba(34,197,94,0.14)'
                                : 'rgba(251,191,36,0.14)',
                              color: section.status === 'filled' ? '#86efac' : '#fde68a',
                            }}
                          />
                        </Stack>
                        <Typography sx={{ color: section.status === 'filled' ? 'rgba(226,232,240,0.92)' : 'rgba(253,230,138,0.92)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          {section.value || 'Ikke fylt ut ennå.'}
                        </Typography>
                        <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.72rem', lineHeight: 1.4, mt: 0.45 }}>
                          {section.helper}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : null}

              {!briefWizardEnabled ? (
                <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap sx={{ mb: 1.05 }}>
                  {briefStepDescriptors.map((step) => (
                    <Button
                      key={step.key}
                      size="small"
                      variant={step.key === activeBriefStep ? 'contained' : 'outlined'}
                      onClick={() => setActiveBriefStep(step.key)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        ...(step.key === activeBriefStep
                          ? {
                            bgcolor: '#38bdf8',
                            color: '#082f49',
                            '&:hover': { bgcolor: '#0ea5e9' },
                          }
                          : {}),
                      }}
                    >
                      {step.label}
                    </Button>
                  ))}
                </Stack>
              ) : null}

              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={0.8}
                justifyContent="space-between"
                sx={{ mb: 1.05 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: 'rgba(191,219,254,0.62)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {`Steg ${activeBriefStepIndex + 1} av ${briefStepDescriptors.length}`}
                  </Typography>
                  <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.15 }}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.96rem' }}>
                      {activeBriefStepDescriptor.label}
                    </Typography>
                    <Chip
                      size="small"
                      label={activeBriefStepDescriptor.status}
                      sx={{
                        height: 22,
                        bgcolor: activeBriefStepDescriptor.missing.length === 0 ? 'rgba(34,197,94,0.14)' : 'rgba(59,130,246,0.18)',
                        color: activeBriefStepDescriptor.missing.length === 0 ? '#86efac' : '#bfdbfe',
                      }}
                    />
                    {isBriefLockedByApproval ? (
                      <Chip
                        size="small"
                        label="Låst etter godkjenning"
                        sx={{
                          height: 22,
                          bgcolor: 'rgba(250,204,21,0.14)',
                          color: '#fde68a',
                        }}
                      />
                    ) : null}
                  </Stack>
                  <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.28, maxWidth: 500 }}>
                    {activeBriefStepDescriptor.description}
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={0.65}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  sx={{
                    minWidth: { lg: 320 },
                    px: 0.8,
                    py: 0.7,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.08)',
                    bgcolor: 'rgba(15,23,42,0.28)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(191,219,254,0.56)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Fremdrift
                  </Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {`${completedBriefStepCount}/${briefStepDescriptors.length} klare`}
                  </Typography>
                  <Box
                    sx={{
                      width: { xs: '100%', sm: 108 },
                      height: 5,
                      borderRadius: 999,
                      bgcolor: 'rgba(148,163,184,0.18)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(completedBriefStepCount / briefStepDescriptors.length) * 100}%`,
                        height: '100%',
                        borderRadius: 999,
                        bgcolor: '#38bdf8',
                      }}
                    />
                  </Box>
                  <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                    {isBriefLockedByApproval
                      ? 'Briefen er låst etter godkjenning. Endringer krever en ny godkjenningsrunde.'
                      : nextBriefStepDescriptor && nextBriefStepDescriptor.key !== activeBriefStep
                      ? `Deretter: ${nextBriefStepDescriptor.label}`
                      : activeBriefStepDescriptor.missing.length > 0
                        ? `Fyll ut ${activeBriefStepDescriptor.label.toLowerCase()} før du går videre.`
                        : 'Briefen er klar for neste arbeidsfase.'}
                  </Typography>
                </Stack>
              </Stack>

              {activeBriefStepDescriptor.missing.length > 0 ? (
                <Box
                  sx={{
                    mb: 1.05,
                    px: 0.8,
                    py: activeBriefStepDescriptor.missing.length <= 2 ? 0.58 : 0.72,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.1)',
                    bgcolor: 'rgba(15,23,42,0.22)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(191,219,254,0.7)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.35, mb: 0.32 }}>
                    {`Dette mangler i ${activeBriefStepDescriptor.label.toLowerCase()}`}
                  </Typography>
                  <Stack spacing={0.18}>
                    {activeBriefStepDescriptor.missing.map((item) => (
                      <Typography key={item.id} sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.4 }}>
                        • {item.label}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {isBriefLockedByApproval ? (
                <Alert
                  severity="success"
                  sx={{
                    mb: 1.05,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(20,83,45,0.28)',
                    border: '1px solid rgba(74,222,128,0.18)',
                    color: '#dcfce7',
                    '& .MuiAlert-icon': {
                      color: '#86efac',
                    },
                  }}
                >
                  Briefen er låst fordi prosjektet er godkjent. Endringer i mål, budskap, referanser og kontaktpunkt må tas gjennom en ny godkjenningsrunde.
                </Alert>
              ) : null}

              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  border: '1px solid rgba(96,165,250,0.14)',
                  bgcolor: 'rgba(2,6,23,0.38)',
                }}
              >
                <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.18, fontSize: '1rem' }}>
                  {activeBriefStepDescriptor.label}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.78rem', lineHeight: 1.5, mb: 0.95 }}>
                  {activeBriefStepDescriptor.description}
                </Typography>

                {activeBriefStep === 'goal' ? (
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Skriv målet for prosjektet.',
                        hasText(intakeDraft.projectGoal) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Hva skal prosjektet oppnå?"
                        value={intakeDraft.projectGoal ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, projectGoal: event.target.value }))}
                        fullWidth
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv hva som skal leveres.',
                        hasText(intakeDraft.deliverables) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Hva skal leveres?"
                        value={intakeDraft.deliverables ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, deliverables: event.target.value }))}
                        fullWidth
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                  </Stack>
                ) : null}

                {activeBriefStep === 'audience' ? (
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Skriv hvem innholdet er for.',
                        hasText(intakeDraft.targetAudience) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Målgruppe"
                        value={intakeDraft.targetAudience ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, targetAudience: event.target.value }))}
                        fullWidth
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv hva publikum skal sitte igjen med.',
                        hasText(intakeDraft.keyMessage) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Kjernebudskap"
                        value={intakeDraft.keyMessage ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, keyMessage: event.target.value }))}
                        fullWidth
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                  </Stack>
                ) : null}

                {activeBriefStep === 'logic' ? (
                  <Stack spacing={1.35}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.6,
                        border: '1px solid rgba(56,189,248,0.12)',
                        bgcolor: 'rgba(8,47,73,0.16)',
                      }}
                    >
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', mb: 0.22 }}>
                        Content Logic
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.76rem', lineHeight: 1.5, mb: 1 }}>
                        Samme struktur som produsenten bruker videre i planlegging og levering. Klienten beskriver målet, kroken og handlingen direkte her.
                      </Typography>
                      <Stack spacing={1.2}>
                        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2}>
                          <Box sx={{ flex: 1 }}>
                            {renderFieldLead(
                              'Skriv hva innholdet faktisk skal oppnå.',
                              hasText(contentLogicDraft.objective) ? 'filled' : 'missing',
                            )}
                            <TextField
                              label="Content Logic mål"
                              value={contentLogicDraft.objective}
                              onChange={(event) => setPlanningDraft((previous) => ({
                                ...previous,
                                contentLogic: {
                                  ...(previous.contentLogic ?? {}),
                                  mode: previous.contentLogic?.mode ?? 'content_logic',
                                  objective: event.target.value,
                                },
                                activationPlan: {
                                  ...previous.activationPlan,
                                  businessGoal: event.target.value,
                                },
                              }))}
                              fullWidth
                              disabled={!canEditBriefInput}
                            />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            {renderFieldLead(
                              'Skriv hvem innholdet skal treffe.',
                              hasText(contentLogicDraft.audience) ? 'filled' : 'missing',
                            )}
                            <TextField
                              label="Content Logic målgruppe"
                              value={contentLogicDraft.audience}
                              onChange={(event) => setPlanningDraft((previous) => ({
                                ...previous,
                                contentLogic: {
                                  ...(previous.contentLogic ?? {}),
                                  mode: previous.contentLogic?.mode ?? 'content_logic',
                                  audience: event.target.value,
                                },
                                activationPlan: {
                                  ...previous.activationPlan,
                                  targetAudience: event.target.value,
                                },
                              }))}
                              fullWidth
                              disabled={!canEditBriefInput}
                            />
                          </Box>
                        </Stack>
                        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2}>
                          <Box sx={{ flex: 1 }}>
                            {renderFieldLead(
                              'Skriv første vinkling som skal få folk til å stoppe opp.',
                              hasText(contentLogicDraft.hook) ? 'filled' : 'missing',
                            )}
                            <TextField
                              label="Hook"
                              value={contentLogicDraft.hook}
                              onChange={(event) => setPlanningDraft((previous) => ({
                                ...previous,
                                contentLogic: {
                                  ...(previous.contentLogic ?? {}),
                                  mode: previous.contentLogic?.mode ?? 'content_logic',
                                  hook: event.target.value,
                                },
                                activationPlan: {
                                  ...previous.activationPlan,
                                  idea: event.target.value,
                                },
                              }))}
                              fullWidth
                              disabled={!canEditBriefInput}
                            />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            {renderFieldLead(
                              'Skriv hva publikum skal gjøre etter å ha sett innholdet.',
                              hasText(contentLogicDraft.callToAction) ? 'filled' : 'missing',
                            )}
                            <TextField
                              label="CTA"
                              value={contentLogicDraft.callToAction}
                              onChange={(event) => setPlanningDraft((previous) => ({
                                ...previous,
                                contentLogic: {
                                  ...(previous.contentLogic ?? {}),
                                  mode: previous.contentLogic?.mode ?? 'content_logic',
                                  callToAction: event.target.value,
                                },
                              }))}
                              fullWidth
                              disabled={!canEditBriefInput}
                            />
                          </Box>
                        </Stack>
                      </Stack>
                    </Box>
                  </Stack>
                ) : null}

                {activeBriefStep === 'foundation' ? (
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Skriv tidsrammer og avhengigheter.',
                        hasText(intakeDraft.timingConstraints) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Tidsrammer og avhengigheter"
                        value={intakeDraft.timingConstraints ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, timingConstraints: event.target.value }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv brand- eller kommunikasjonsnotater.',
                        hasText(intakeDraft.brandNotes) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Merkevare- og kommunikasjonsnotater"
                        value={intakeDraft.brandNotes ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, brandNotes: event.target.value }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv hva slags materiale som allerede finnes.',
                        hasText(intakeDraft.materialOverview) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Hva slags materiale finnes allerede?"
                        value={intakeDraft.materialOverview ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, materialOverview: event.target.value }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                  </Stack>
                ) : null}

                {activeBriefStep === 'references' ? (
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Legg inn referanser som skal påvirke retningen.',
                        hasText(intakeDraft.referenceLinks) || materials.some((item) => item.entry_type === 'reference') ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Referanselenker"
                        value={intakeDraft.referenceLinks ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, referenceLinks: event.target.value }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.6,
                        border: '1px solid rgba(56,189,248,0.12)',
                        bgcolor: 'rgba(8,47,73,0.16)',
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', mb: 0.22 }}>
                            Last opp referanser direkte i briefen
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.76rem', lineHeight: 1.5 }}>
                            Legg ved filmer, PDF-er, bilder eller annet grunnlag her. Referansen blir lagret i prosjektet og kan brukes videre i prosjektrommet.
                          </Typography>
                        </Box>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ md: 'flex-start' }}>
                          <Button
                            variant="outlined"
                            startIcon={<UploadFileIcon />}
                            onClick={handleOpenBriefReferenceFilePicker}
                            disabled={!canEditBriefInput}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            Velg referansefil
                          </Button>
                          {isMobileWorkspace ? (
                            <Button
                              variant="outlined"
                              startIcon={<PhotoCameraOutlinedIcon />}
                              onClick={handleOpenBriefReferenceCameraPicker}
                              disabled={!canEditBriefInput}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Ta bilde/video
                            </Button>
                          ) : null}
                          <Button
                            variant="contained"
                            startIcon={<CloudUploadIcon />}
                            onClick={() => {
                              void handleSubmitBriefReference();
                            }}
                            disabled={!canEditBriefInput || savingMaterial || uploadingMaterialFile || !canSubmitBriefReference}
                            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
                          >
                            {savingMaterial || uploadingMaterialFile ? 'Laster opp...' : 'Legg til referanse'}
                          </Button>
                        </Stack>
                      </Stack>

                      {isMobileWorkspace && (selectedMaterialFile || hasText(materialDraft.projectFileId)) ? (
                        <Box
                          sx={{
                            mt: 0.9,
                            p: 0.9,
                            borderRadius: 1.4,
                            border: '1px solid rgba(96,165,250,0.12)',
                            bgcolor: 'rgba(15,23,42,0.26)',
                          }}
                        >
                          <Stack direction="row" spacing={0.85} alignItems="center">
                            {selectedMaterialPreviewUrl ? (
                              <Box
                                component="img"
                                src={selectedMaterialPreviewUrl}
                                alt={selectedMaterialFile?.name || 'Valgt referanse'}
                                sx={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 1.2,
                                  objectFit: 'cover',
                                  border: '1px solid rgba(148,163,184,0.18)',
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 1.2,
                                  display: 'grid',
                                  placeItems: 'center',
                                  bgcolor: 'rgba(30,41,59,0.82)',
                                  border: '1px solid rgba(148,163,184,0.18)',
                                }}
                              >
                                <PermMediaIcon sx={{ color: '#bfdbfe' }} />
                              </Box>
                            )}
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem' }}>
                                {selectedMaterialFile?.name || materialDraft.fileName || materialDraft.title || 'Referanse klar'}
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.74rem', mt: 0.18 }}>
                                {selectedMaterialFile
                                  ? `${selectedMaterialFile.type || 'Fil'} · ${formatFileSize(selectedMaterialFile.size)}`
                                  : 'Prosjektfil er allerede koblet og klar til lagring.'}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      ) : null}

                      {briefReferenceDraftActive && (selectedMaterialFile || hasText(materialDraft.projectFileId)) ? (
                        <Box
                          sx={{
                            mt: 0.9,
                            px: 0.85,
                            py: 0.7,
                            borderRadius: 1.4,
                            border: '1px solid rgba(96,165,250,0.12)',
                            bgcolor: 'rgba(15,23,42,0.28)',
                          }}
                        >
                          <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.8rem', fontWeight: 700 }}>
                            {selectedMaterialFile
                              ? `Klar til opplasting: ${selectedMaterialFile.name}`
                              : `Klar til å lagres: ${materialDraft.fileName || materialDraft.title || 'Referanse'}`}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.45, mt: 0.24 }}>
                            Referansen lagres som en egen prosjektressurs og blir tilgjengelig videre i Prosjektrom.
                          </Typography>
                        </Box>
                      ) : null}

                      {briefReferenceMaterials.length > 0 ? (
                        <Stack spacing={0.65} sx={{ mt: 0.95 }}>
                          <Typography sx={{ color: 'rgba(191,219,254,0.72)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                            Referanser som allerede er lagt inn
                          </Typography>
                          {briefReferenceMaterials.map((material) => {
                            const metadata = parseMaterialMetadata(material);
                            const materialLink = hasText(metadata.projectFileDownloadUrl)
                              ? metadata.projectFileDownloadUrl
                              : material.external_url;

                            return (
                              <Stack
                                key={material.id}
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={0.75}
                                justifyContent="space-between"
                                sx={{
                                  px: 0.85,
                                  py: 0.7,
                                  borderRadius: 1.4,
                                  border: '1px solid rgba(96,165,250,0.1)',
                                  bgcolor: 'rgba(15,23,42,0.24)',
                                }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.86rem' }}>
                                    {material.title}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.45, mt: 0.2 }}>
                                    {readFirstNonEmptyString(
                                      metadata.fileName ? `Fil: ${metadata.fileName}` : '',
                                      material.description ?? '',
                                      'Referanse lagt til i briefen.',
                                    )}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.65} alignItems="center">
                                  <Chip
                                    size="small"
                                    label={metadata.sourceLabel || 'Klient'}
                                    sx={{ bgcolor: 'rgba(59,130,246,0.18)', color: '#bfdbfe' }}
                                  />
                                  {hasText(materialLink) ? (
                                    <Button
                                      size="small"
                                      variant="text"
                                      href={materialLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      sx={{ textTransform: 'none', fontWeight: 700, color: 'rgba(191,219,254,0.82)' }}
                                    >
                                      Åpne
                                    </Button>
                                  ) : null}
                                </Stack>
                              </Stack>
                            );
                          })}
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => openSurfaceWorkspace('materials')}
                            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                          >
                            Se alle referanser i Prosjektrom
                          </Button>
                        </Stack>
                      ) : null}
                    </Box>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.6,
                        border: '1px solid rgba(56,189,248,0.12)',
                        bgcolor: 'rgba(8,47,73,0.16)',
                      }}
                    >
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', mb: 0.22 }}>
                        Content Logic videreføring
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.76rem', lineHeight: 1.5, mb: 1 }}>
                        Her konkretiseres hva som beviser budskapet og hvordan innholdet skal fordeles på flater.
                      </Typography>
                      <Stack spacing={1.2}>
                        <Box>
                          {renderFieldLead(
                            'Skriv konkrete proof points eller bevis, ett per linje.',
                            contentLogicDraft.proofPoints.length > 0 ? 'filled' : 'missing',
                          )}
                          <TextField
                            label="Bevis / proof points"
                            value={stringifyLineSeparatedValues(contentLogicDraft.proofPoints)}
                            onChange={(event) => setPlanningDraft((previous) => ({
                              ...previous,
                              contentLogic: {
                                ...(previous.contentLogic ?? {}),
                                mode: previous.contentLogic?.mode ?? 'content_logic',
                                proofPoints: parseLineSeparatedValues(event.target.value),
                              },
                            }))}
                            fullWidth
                            multiline
                            minRows={3}
                            disabled={!canEditBriefInput}
                          />
                        </Box>
                        <Box>
                          {renderFieldLead(
                            'Skriv hvordan innholdet skal fordeles mellom nettside, feed, reels eller andre flater.',
                            hasText(contentLogicDraft.distributionPlan) ? 'filled' : 'missing',
                          )}
                          <TextField
                            label="Distribusjon og kanalbruk"
                            value={contentLogicDraft.distributionPlan}
                            onChange={(event) => setPlanningDraft((previous) => ({
                              ...previous,
                              contentLogic: {
                                ...(previous.contentLogic ?? {}),
                                mode: previous.contentLogic?.mode ?? 'content_logic',
                                distributionPlan: event.target.value,
                              },
                              activationPlan: {
                                ...previous.activationPlan,
                                activation: event.target.value,
                              },
                            }))}
                            fullWidth
                            multiline
                            minRows={3}
                            disabled={!canEditBriefInput}
                          />
                        </Box>
                      </Stack>
                    </Box>
                  </Stack>
                ) : null}

                {activeBriefStep === 'contact' ? (
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Skriv hvem produsenten skal forholde seg til.',
                        hasText(intakeDraft.contactName) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Kontaktperson"
                        value={intakeDraft.contactName ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, contactName: event.target.value }))}
                        fullWidth
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv e-posten som brukes til godkjenning og oppfølging.',
                        hasText(intakeDraft.contactEmail) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Kontakt-e-post"
                        value={intakeDraft.contactEmail ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, contactEmail: event.target.value }))}
                        fullWidth
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Legg inn telefonnummer hvis det trengs i raske avklaringer.',
                        hasText(intakeDraft.contactPhone) ? 'filled' : 'optional',
                      )}
                      <TextField
                        label="Kontakttelefon"
                        value={intakeDraft.contactPhone ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, contactPhone: event.target.value }))}
                        fullWidth
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Legg inn ekstra notater hvis noe viktig mangler over.',
                        hasText(intakeDraft.additionalNotes) ? 'filled' : 'optional',
                      )}
                      <TextField
                        label="Tilleggsnotater"
                        value={intakeDraft.additionalNotes ?? ''}
                        onChange={(event) => setIntakeDraft((previous) => ({ ...previous, additionalNotes: event.target.value }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditBriefInput}
                      />
                    </Box>
                  </Stack>
                ) : null}
              </Box>

              {activeBriefStepDescriptor.missing.length === 0 ? (
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={0.55}
                  sx={{
                    px: 0.8,
                    py: 0.68,
                    mt: 0.9,
                    mb: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.08)',
                    bgcolor: 'rgba(15,23,42,0.26)',
                  }}
                >
                  <Typography
                    sx={{
                      color: 'rgba(191,219,254,0.56)',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}
                  >
                    Kort oppsummering
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
                    {activeBriefStepSummary}
                  </Typography>
                </Stack>
              ) : null}

              {canEditClientInput ? (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={0.9}
                  sx={{
                    mt: 1.05,
                    pt: 0.95,
                    borderTop: '1px solid rgba(96,165,250,0.12)',
                  }}
                >
                  {briefWizardEnabled ? (
                    <>
                      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setActiveBriefStep(previousBriefStepDescriptor?.key ?? 'goal')}
                          disabled={activeBriefStepIndex === 0}
                          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                        >
                          Tilbake
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SaveOutlinedIcon />}
                          onClick={() => {
                            void handleSaveIntake();
                          }}
                          disabled={!canEditBriefInput || savingIntake}
                          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                        >
                          {savingIntake ? 'Lagrer...' : 'Lagre'}
                        </Button>
                      </Stack>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {
                          if (nextBriefStepDescriptor && activeBriefStepIndex < briefStepDescriptors.length - 1) {
                            setActiveBriefStep(nextBriefStepDescriptor.key);
                            return;
                          }
                          setMaterialsMode('capture');
                          openSurfaceWorkspace('materials');
                        }}
                        disabled={activeBriefStepDescriptor.missing.length > 0}
                        sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
                      >
                        {nextBriefStepDescriptor && activeBriefStepIndex < briefStepDescriptors.length - 1
                          ? `Fortsett til ${nextBriefStepDescriptor.label}`
                          : 'Fortsett til Materiale'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Stack direction="row" spacing={0.75}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setActiveBriefStep(previousBriefStepDescriptor?.key ?? 'goal')}
                          disabled={activeBriefStepIndex === 0}
                          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                        >
                          {previousBriefStepDescriptor && activeBriefStepIndex > 0 ? `Til ${previousBriefStepDescriptor.label}` : 'Forrige steg'}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setActiveBriefStep(nextBriefStepDescriptor?.key ?? briefStepDescriptors[briefStepDescriptors.length - 1]?.key ?? 'contact')}
                          disabled={activeBriefStepIndex === briefStepDescriptors.length - 1}
                          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                        >
                          {nextBriefStepDescriptor && activeBriefStepIndex < briefStepDescriptors.length - 1 ? `Til ${nextBriefStepDescriptor.label}` : 'Neste steg'}
                        </Button>
                      </Stack>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SaveOutlinedIcon />}
                        onClick={() => {
                          void handleSaveIntake();
                        }}
                        disabled={!canEditBriefInput || savingIntake}
                        sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
                      >
                        {savingIntake ? 'Lagrer brief...' : 'Lagre brief'}
                      </Button>
                    </>
                  )}
                </Stack>
              ) : null}
            </Box>
          ) : null}

          {!showClientWorkspaceEmptyState && activeWorkspace === 'storyboard' ? (
            <Box
              data-testid="producer-media-storyboard-workspace"
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(251,113,133,0.18)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                p: { xs: 1.25, md: 1.5 },
                '& .MuiInputBase-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(248,250,252,0.04)',
                  color: '#f8fafc',
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(226,232,240,0.62)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(251,113,133,0.16)',
                },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.42rem', lineHeight: 1.05 }}>
                    Storyboard og inspirasjoner
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.82rem', lineHeight: 1.5, mt: 0.3, maxWidth: 720 }}>
                    Klienten ser scener og frames i rolig form, og kan legge inn inspirasjoner og referanser direkte på riktig scene uten å rote til produksjonseditoren.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${storyboardScenes.length} scener`} sx={{ bgcolor: 'rgba(251,113,133,0.14)', color: '#fecdd3' }} />
                  <Chip size="small" label={`${storyboardFrameCount} frames`} sx={{ bgcolor: 'rgba(129,140,248,0.14)', color: '#c7d2fe' }} />
                  <Chip size="small" label={`${storyboardInspirations.length} inspirasjoner`} sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#bae6fd' }} />
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', xl: '1.1fr 0.9fr' },
                  gap: 1,
                  mb: 1.2,
                }}
              >
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.8,
                    border: '1px solid rgba(148,163,184,0.14)',
                    bgcolor: 'rgba(2,6,23,0.4)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.96rem' }}>
                    Sceneoversikt
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem', mt: 0.22, mb: 0.9 }}>
                    Klienten får oversikt over hvilke scener som faktisk er blokkert i storyboardet og kan peke inspirasjoner inn på rett sted.
                  </Typography>
                  {storyboardScenes.length > 0 ? (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: 0.8,
                      }}
                    >
                      {storyboardScenes.map((scene) => {
                        const previewFrame = scene.storyboardFrames?.[0] ?? null;
                        return (
                          <Box
                            key={scene.id}
                            sx={{
                              borderRadius: 1.5,
                              border: '1px solid rgba(148,163,184,0.14)',
                              overflow: 'hidden',
                              background: 'rgba(15,23,42,0.52)',
                            }}
                          >
                            <Box
                              sx={{
                                aspectRatio: '16 / 9',
                                bgcolor: 'rgba(15,23,42,0.72)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              {previewFrame?.thumbnailUrl || previewFrame?.imageUrl ? (
                                <Box
                                  component="img"
                                  src={previewFrame.thumbnailUrl ?? previewFrame.imageUrl}
                                  alt={getSceneDisplayLabel(scene)}
                                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <SpaceDashboardOutlinedIcon sx={{ color: 'rgba(251,113,133,0.46)', fontSize: 34 }} />
                              )}
                            </Box>
                            <Box sx={{ p: 0.85 }}>
                              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem', lineHeight: 1.35 }}>
                                {getSceneDisplayLabel(scene)}
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem', lineHeight: 1.45, mt: 0.22 }}>
                                {readFirstNonEmptyString(scene.locationName, scene.intExt, scene.description, 'Storyboardscene uten ekstra notat')}
                              </Typography>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.7 }}>
                                <Chip size="small" label={`${scene.storyboardFrames?.length ?? 0} frames`} sx={{ bgcolor: 'rgba(251,113,133,0.14)', color: '#fecdd3' }} />
                                {scene.storyboardFrames?.[0]?.title ? (
                                  <Chip size="small" label={scene.storyboardFrames[0].title} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#e2e8f0' }} />
                                ) : null}
                              </Stack>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.84rem' }}>
                      Ingen storyboardscener er koblet til prosjektet ennå.
                    </Typography>
                  )}
                </Box>

                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.8,
                    border: '1px solid rgba(148,163,184,0.14)',
                    bgcolor: 'rgba(2,6,23,0.4)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.96rem' }}>
                    Legg til inspirasjon
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem', mt: 0.22, mb: 0.9 }}>
                    Bruk denne til visuelle referanser, tone, lys, komposisjon eller andre pekere produsenten skal ta med seg videre.
                  </Typography>
                  <Stack spacing={1.05}>
                    <TextField
                      select
                      label="Scene"
                      value={storyboardInspirationDraft.sceneId}
                      onChange={(event) => {
                        const nextSceneId = event.target.value;
                        const nextScene = storyboardScenes.find((scene) => scene.id === nextSceneId) ?? null;
                        setStoryboardInspirationDraft((previous) => ({
                          ...previous,
                          sceneId: nextSceneId,
                          storyboardFrameId: nextScene?.storyboardFrames?.[0]?.id ?? '',
                        }));
                      }}
                      fullWidth
                      disabled={!canEditClientInput || storyboardSceneOptions.length === 0}
                    >
                      {storyboardSceneOptions.map((scene) => (
                        <MenuItem key={scene.id} value={scene.id}>
                          {`${scene.label} · ${scene.frameCount} frames`}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Frame (valgfritt)"
                      value={storyboardInspirationDraft.storyboardFrameId}
                      onChange={(event) => setStoryboardInspirationDraft((previous) => ({
                        ...previous,
                        storyboardFrameId: event.target.value,
                      }))}
                      fullWidth
                      disabled={!canEditClientInput || storyboardFrameOptions.length === 0}
                    >
                      <MenuItem value="">Hele scenen</MenuItem>
                      {storyboardFrameOptions.map((frame) => (
                        <MenuItem key={frame.id} value={frame.id}>
                          {frame.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Tittel"
                      value={storyboardInspirationDraft.title}
                      onChange={(event) => setStoryboardInspirationDraft((previous) => ({ ...previous, title: event.target.value }))}
                      fullWidth
                      inputProps={{ 'data-testid': 'producer-media-storyboard-title-input' }}
                      disabled={!canEditClientInput}
                    />
                    <TextField
                      label="Lenke til referanse (valgfritt)"
                      value={storyboardInspirationDraft.externalUrl}
                      onChange={(event) => setStoryboardInspirationDraft((previous) => ({ ...previous, externalUrl: event.target.value }))}
                      fullWidth
                      inputProps={{ 'data-testid': 'producer-media-storyboard-url-input' }}
                      disabled={!canEditClientInput}
                    />
                    <TextField
                      label="Hva bør teamet se etter?"
                      value={storyboardInspirationDraft.note}
                      onChange={(event) => setStoryboardInspirationDraft((previous) => ({ ...previous, note: event.target.value }))}
                      fullWidth
                      multiline
                      minRows={4}
                      inputProps={{ 'data-testid': 'producer-media-storyboard-note-input' }}
                      disabled={!canEditClientInput}
                    />
                    {canEditClientInput ? (
                      <Button
                        data-testid="producer-media-storyboard-save-inspiration"
                        variant="contained"
                        onClick={() => {
                          void handleSubmitStoryboardInspiration();
                        }}
                        disabled={savingMaterial}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, bgcolor: '#fb7185', '&:hover': { bgcolor: '#f43f5e' } }}
                      >
                        {savingMaterial ? 'Lagrer inspirasjon...' : 'Lagre inspirasjon'}
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              </Box>

              <Box
                sx={{
                  p: 0.95,
                  borderRadius: 1.8,
                  border: '1px solid rgba(148,163,184,0.14)',
                  bgcolor: 'rgba(2,6,23,0.4)',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.96rem', mb: 0.22 }}>
                  Lagrede inspirasjoner
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem', mb: 0.95 }}>
                  Alle innspill her er knyttet til scene og kan plukkes opp videre i storyboard- og shot-arbeidet.
                </Typography>
                {storyboardInspirations.length > 0 ? (
                  <Stack spacing={0.8}>
                    {storyboardInspirations.map((material) => {
                      const metadata = parseWorkspaceContributionMetadata(material);
                      const sceneLabel = storyboardScenes.find((scene) => scene.id === metadata.sceneId);
                      const frameLabel = storyboardScenes
                        .flatMap((scene) => scene.storyboardFrames ?? [])
                        .find((frame) => frame.id === metadata.storyboardFrameId);
                      return (
                        <Box
                          key={material.id}
                          sx={{
                            p: 0.9,
                            borderRadius: 1.35,
                            border: '1px solid rgba(148,163,184,0.14)',
                            bgcolor: 'rgba(15,23,42,0.52)',
                          }}
                        >
                          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.9}>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                                {sceneLabel ? (
                                  <Chip size="small" label={getSceneDisplayLabel(sceneLabel)} sx={{ bgcolor: 'rgba(251,113,133,0.14)', color: '#fecdd3' }} />
                                ) : null}
                                {frameLabel ? (
                                  <Chip size="small" label={readFirstNonEmptyString(frameLabel.title, frameLabel.description, 'Frame')} sx={{ bgcolor: 'rgba(129,140,248,0.14)', color: '#c7d2fe' }} />
                                ) : null}
                              </Stack>
                              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>
                                {material.title}
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.78rem', lineHeight: 1.5, mt: 0.28 }}>
                                {material.description ?? 'Ingen ekstra notat lagt inn.'}
                              </Typography>
                              <Typography sx={{ color: 'rgba(148,163,184,0.76)', fontSize: '0.72rem', mt: 0.55 }}>
                                {formatTimestamp(material.updated_at ?? material.created_at ?? '')}
                              </Typography>
                            </Box>
                            <Stack direction={{ xs: 'row', md: 'column' }} spacing={0.65} alignItems={{ md: 'flex-end' }}>
                              {material.external_url ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  component="a"
                                  href={material.external_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne referanse
                                </Button>
                              ) : null}
                              {canEditClientInput ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => {
                                    void handleDeleteMaterial(material.id);
                                  }}
                                  disabled={deletingMaterialId === material.id}
                                  sx={{ textTransform: 'none', fontWeight: 700, color: '#fda4af' }}
                                >
                                  {deletingMaterialId === material.id ? 'Sletter...' : 'Fjern'}
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.84rem' }}>
                    Ingen storyboard-inspirasjoner er registrert ennå.
                  </Typography>
                )}
              </Box>
            </Box>
          ) : null}

          {!showClientWorkspaceEmptyState && activeWorkspace === 'manuscript' ? (
            <Box
              data-testid="producer-media-manuscript-workspace"
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(129,140,248,0.18)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                p: { xs: 1.25, md: 1.5 },
                '& .MuiInputBase-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(248,250,252,0.04)',
                  color: '#f8fafc',
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(226,232,240,0.62)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(129,140,248,0.16)',
                },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.42rem', lineHeight: 1.05 }}>
                    Manus og endringsforslag
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.82rem', lineHeight: 1.5, mt: 0.3, maxWidth: 720 }}>
                    Klienten leser manus i oversiktlig form og skriver forslag til endringer som egne innspill. Originalteksten blir ikke overskrevet direkte i klientflaten.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={primaryManuscript ? (primaryManuscript.version ? `Versjon ${primaryManuscript.version}` : 'Manus koblet') : 'Ingen manus'} sx={{ bgcolor: 'rgba(129,140,248,0.14)', color: '#c7d2fe' }} />
                  <Chip size="small" label={`${manuscriptSuggestions.length} forslag`} sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#bae6fd' }} />
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', xl: '1.05fr 0.95fr' },
                  gap: 1,
                  mb: 1.2,
                }}
              >
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.8,
                    border: '1px solid rgba(148,163,184,0.14)',
                    bgcolor: 'rgba(2,6,23,0.4)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.96rem' }}>
                    Manusoversikt
                  </Typography>
                  {primaryManuscript ? (
                    <>
                      <Typography sx={{ color: '#e0e7ff', fontWeight: 700, fontSize: '1rem', mt: 0.5 }}>
                        {primaryManuscript.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem', mt: 0.18 }}>
                        {[primaryManuscript.author, primaryManuscript.subtitle, primaryManuscript.format].filter(Boolean).join(' · ') || 'Manusdetaljer er ikke satt'}
                      </Typography>
                      <Box
                        sx={{
                          mt: 0.9,
                          p: 0.95,
                          borderRadius: 1.4,
                          border: '1px solid rgba(129,140,248,0.14)',
                          bgcolor: 'rgba(15,23,42,0.52)',
                        }}
                      >
                        <Typography sx={{ color: 'rgba(191,219,254,0.62)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', mb: 0.35 }}>
                          Utdrag
                        </Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.92)', fontSize: '0.82rem', lineHeight: 1.7 }}>
                          {manuscriptExcerpt || 'Manuset har ikke tekstinnhold ennå.'}
                          {manuscriptExcerpt && primaryManuscript.content.length > manuscriptExcerpt.length ? '…' : ''}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.84rem', mt: 0.6 }}>
                      Ingen manus er koblet til prosjektet ennå.
                    </Typography>
                  )}
                  <Box
                    sx={{
                      mt: 0.95,
                      p: 0.95,
                      borderRadius: 1.4,
                      border: '1px solid rgba(148,163,184,0.14)',
                      bgcolor: 'rgba(15,23,42,0.52)',
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem', mb: 0.55 }}>
                      Scenegrunnlag
                    </Typography>
                    {storyboardSceneOptions.length > 0 ? (
                      <Stack spacing={0.42}>
                        {storyboardSceneOptions.slice(0, 6).map((scene) => (
                          <Typography key={scene.id} sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                            {`${scene.label} · ${scene.frameCount} frames`}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                        Ingen scener er koblet til manusgrunnlaget ennå.
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.8,
                    border: '1px solid rgba(148,163,184,0.14)',
                    bgcolor: 'rgba(2,6,23,0.4)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.96rem' }}>
                    Foreslå endring
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem', mt: 0.22, mb: 0.9 }}>
                    Bruk dette til omskrivninger, tydeliggjøringer eller forslag til scenen, ikke til å redigere selve manuset direkte.
                  </Typography>
                  <Stack spacing={1.05}>
                    <TextField
                      select
                      label="Manus"
                      value={manuscriptSuggestionDraft.manuscriptId}
                      onChange={(event) => setManuscriptSuggestionDraft((previous) => ({
                        ...previous,
                        manuscriptId: event.target.value,
                      }))}
                      fullWidth
                      disabled={!canEditClientInput || manuscripts.length === 0}
                    >
                      {manuscripts.map((manuscript) => (
                        <MenuItem key={manuscript.id} value={manuscript.id}>
                          {manuscript.title}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Scene (valgfritt)"
                      value={manuscriptSuggestionDraft.sceneId}
                      onChange={(event) => setManuscriptSuggestionDraft((previous) => ({
                        ...previous,
                        sceneId: event.target.value,
                      }))}
                      fullWidth
                      disabled={!canEditClientInput || storyboardSceneOptions.length === 0}
                    >
                      <MenuItem value="">Hele manuset</MenuItem>
                      {storyboardSceneOptions.map((scene) => (
                        <MenuItem key={scene.id} value={scene.id}>
                          {scene.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Kort tittel"
                      value={manuscriptSuggestionDraft.title}
                      onChange={(event) => setManuscriptSuggestionDraft((previous) => ({ ...previous, title: event.target.value }))}
                      fullWidth
                      inputProps={{ 'data-testid': 'producer-media-manuscript-title-input' }}
                      disabled={!canEditClientInput}
                    />
                    <TextField
                      label="Hva foreslår du å endre?"
                      value={manuscriptSuggestionDraft.suggestion}
                      onChange={(event) => setManuscriptSuggestionDraft((previous) => ({ ...previous, suggestion: event.target.value }))}
                      fullWidth
                      multiline
                      minRows={4}
                      inputProps={{ 'data-testid': 'producer-media-manuscript-suggestion-input' }}
                      disabled={!canEditClientInput}
                    />
                    <TextField
                      label="Hvorfor?"
                      value={manuscriptSuggestionDraft.rationale}
                      onChange={(event) => setManuscriptSuggestionDraft((previous) => ({ ...previous, rationale: event.target.value }))}
                      fullWidth
                      multiline
                      minRows={3}
                      inputProps={{ 'data-testid': 'producer-media-manuscript-rationale-input' }}
                      disabled={!canEditClientInput}
                    />
                    {canEditClientInput ? (
                      <Button
                        data-testid="producer-media-manuscript-save-suggestion"
                        variant="contained"
                        onClick={() => {
                          void handleSubmitManuscriptSuggestion();
                        }}
                        disabled={savingMaterial}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, bgcolor: '#818cf8', '&:hover': { bgcolor: '#6366f1' } }}
                      >
                        {savingMaterial ? 'Lagrer forslag...' : 'Lagre forslag'}
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              </Box>

              <Box
                sx={{
                  p: 0.95,
                  borderRadius: 1.8,
                  border: '1px solid rgba(148,163,184,0.14)',
                  bgcolor: 'rgba(2,6,23,0.4)',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.96rem', mb: 0.22 }}>
                  Forslagslogg
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.76rem', mb: 0.95 }}>
                  Endringsforslagene ligger som egne punkter teamet kan følge opp, uten å blande klientkommentarer inn i selve manusstrukturen.
                </Typography>
                {manuscriptSuggestions.length > 0 ? (
                  <Stack spacing={0.8}>
                    {manuscriptSuggestions.map((material) => {
                      const metadata = parseWorkspaceContributionMetadata(material);
                      const sceneLabel = storyboardScenes.find((scene) => scene.id === metadata.sceneId);
                      return (
                        <Box
                          key={material.id}
                          sx={{
                            p: 0.9,
                            borderRadius: 1.35,
                            border: '1px solid rgba(148,163,184,0.14)',
                            bgcolor: 'rgba(15,23,42,0.52)',
                          }}
                        >
                          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.9}>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                                {sceneLabel ? (
                                  <Chip size="small" label={getSceneDisplayLabel(sceneLabel)} sx={{ bgcolor: 'rgba(129,140,248,0.14)', color: '#c7d2fe' }} />
                                ) : (
                                  <Chip size="small" label="Hele manuset" sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#e2e8f0' }} />
                                )}
                                <Chip size="small" label={material.status ?? 'suggested'} sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#bae6fd' }} />
                              </Stack>
                              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>
                                {material.title}
                              </Typography>
                              <Typography sx={{ color: 'rgba(226,232,240,0.92)', fontSize: '0.8rem', lineHeight: 1.55, mt: 0.28 }}>
                                {material.description}
                              </Typography>
                              {metadata.rationale ? (
                                <Typography sx={{ color: 'rgba(148,163,184,0.88)', fontSize: '0.76rem', lineHeight: 1.5, mt: 0.52 }}>
                                  {`Hvorfor: ${metadata.rationale}`}
                                </Typography>
                              ) : null}
                              <Typography sx={{ color: 'rgba(148,163,184,0.76)', fontSize: '0.72rem', mt: 0.55 }}>
                                {formatTimestamp(material.updated_at ?? material.created_at ?? '')}
                              </Typography>
                            </Box>
                            {canEditClientInput ? (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => {
                                  void handleDeleteMaterial(material.id);
                                }}
                                disabled={deletingMaterialId === material.id}
                                sx={{ textTransform: 'none', fontWeight: 700, color: '#c7d2fe', alignSelf: { md: 'flex-start' } }}
                              >
                                {deletingMaterialId === material.id ? 'Sletter...' : 'Fjern'}
                              </Button>
                            ) : null}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.84rem' }}>
                    Ingen manusforslag er registrert ennå.
                  </Typography>
                )}
              </Box>
            </Box>
          ) : null}

          {!showClientWorkspaceEmptyState && activeWorkspace === 'shotlist' ? (
            <Box
              data-testid="producer-media-shotlist-workspace"
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(34,211,238,0.18)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                p: { xs: 1.25, md: 1.5 },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.42rem', lineHeight: 1.05 }}>
                    Shotlist overview
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.82rem', lineHeight: 1.5, mt: 0.3, maxWidth: 760 }}>
                    Dette er klientvisningen av shotlisten: tydelig, rolig og sceneorientert. Den viser hva som skal dekkes, hvor og med hvem, men ikke den interne produksjonsstøyen.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${shotLists.length} shotlists`} sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#bae6fd' }} />
                  <Chip size="small" label={`${totalShotCount} shots`} sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a' }} />
                  <Chip
                    size="small"
                    label={uncoveredStoryboardSceneCount > 0 ? `${uncoveredStoryboardSceneCount} scener mangler` : 'Full storyboarddekning'}
                    sx={{
                      bgcolor: uncoveredStoryboardSceneCount > 0 ? 'rgba(251,113,133,0.14)' : 'rgba(34,197,94,0.14)',
                      color: uncoveredStoryboardSceneCount > 0 ? '#fecdd3' : '#bbf7d0',
                    }}
                  />
                </Stack>
              </Stack>

              <Box
                sx={{
                  mb: 1.1,
                  p: 0.95,
                  borderRadius: 1.8,
                  border: '1px solid rgba(148,163,184,0.14)',
                  bgcolor: 'rgba(2,6,23,0.4)',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.96rem', mb: 0.22 }}>
                  Klientformat
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                  Oversikten er bevisst komprimert til plan, scene, sted, cast og beskrivelse. Det gjør den rask å lese i møter og trygg å sende til klient uten at de må tolke intern shot-detaljering.
                </Typography>
              </Box>

              <TableContainer
                data-testid="producer-media-shotlist-table"
                sx={{
                  borderRadius: 2,
                  border: '1px solid rgba(148,163,184,0.14)',
                  bgcolor: 'rgba(2,6,23,0.4)',
                  overflow: 'hidden',
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'rgba(245,158,11,0.9)' }}>
                      <TableCell sx={{ color: '#111827', fontWeight: 800, fontSize: '0.78rem', width: 120 }}>Plan</TableCell>
                      <TableCell sx={{ color: '#111827', fontWeight: 800, fontSize: '0.78rem', minWidth: 220 }}>Scene / klipp</TableCell>
                      <TableCell sx={{ color: '#111827', fontWeight: 800, fontSize: '0.78rem', minWidth: 150 }}>Sted</TableCell>
                      <TableCell sx={{ color: '#111827', fontWeight: 800, fontSize: '0.78rem', minWidth: 180 }}>Cast</TableCell>
                      <TableCell sx={{ color: '#111827', fontWeight: 800, fontSize: '0.78rem', minWidth: 260 }}>Beskrivelse</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shotListRows.length > 0 ? shotListRows.map((row, index) => {
                      const showGroupRow = index === 0 || shotListRows[index - 1]?.shotListLabel !== row.shotListLabel;
                      return (
                        <Fragment key={row.id}>
                          {showGroupRow ? (
                            <TableRow sx={{ bgcolor: 'rgba(59,130,246,0.18)' }}>
                              <TableCell colSpan={5} sx={{ color: '#dbeafe', fontWeight: 800, fontSize: '0.76rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                {row.shotListLabel}
                              </TableCell>
                            </TableRow>
                          ) : null}
                          <TableRow
                            sx={{
                              bgcolor: index % 2 === 0 ? 'rgba(15,23,42,0.42)' : 'rgba(15,23,42,0.62)',
                              '& td': { borderColor: 'rgba(148,163,184,0.12)' },
                            }}
                          >
                            <TableCell sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.8rem' }}>{row.planLabel}</TableCell>
                            <TableCell sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.8rem' }}>{row.sceneLabel}</TableCell>
                            <TableCell sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.8rem' }}>{row.locationLabel}</TableCell>
                            <TableCell sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.8rem' }}>{row.castSummary}</TableCell>
                            <TableCell sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.8rem', lineHeight: 1.5 }}>{row.description}</TableCell>
                          </TableRow>
                        </Fragment>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', py: 2.4, textAlign: 'center' }}>
                          Ingen shotlist-rader er klare for klientoversikt ennå.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}

          {!showClientWorkspaceEmptyState && activeWorkspace === 'brand' ? (
            <Box
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(96,165,250,0.14)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                p: { xs: 1.25, md: 1.5 },
                '& .MuiInputBase-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(248,250,252,0.04)',
                  color: '#f8fafc',
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(203,213,225,0.62)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(96,165,250,0.14)',
                },
                '& .MuiFormHelperText-root': {
                  color: 'rgba(203,213,225,0.48)',
                },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.42rem', lineHeight: 1.05 }}>
                    Fullfør merkevareguiden
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', lineHeight: 1.5, mt: 0.3, maxWidth: 620 }}>
                    {isClientReviewerMode
                      ? 'Legg inn det som faktisk skal styre uttrykket i produksjonen.'
                      : 'Fyll inn det teamet faktisk skal bruke for å holde uttrykket konsistent.'}
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={0.65}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  sx={{
                    minWidth: { lg: 320 },
                    px: 0.8,
                    py: 0.7,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.08)',
                    bgcolor: 'rgba(15,23,42,0.28)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(191,219,254,0.56)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Fremdrift
                  </Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {`${brandGuideReadyCount}/5 klare`}
                  </Typography>
                  <Box
                    sx={{
                      width: { xs: '100%', sm: 108 },
                      height: 5,
                      borderRadius: 999,
                      bgcolor: 'rgba(148,163,184,0.18)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(brandGuideReadyCount / 5) * 100}%`,
                        height: '100%',
                        borderRadius: 999,
                        bgcolor: '#38bdf8',
                      }}
                    />
                  </Box>
                  <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                    {brandGuideMissingItems.length > 0
                      ? `Fyll ut ${brandGuideMissingItems[0]?.label.toLowerCase()} før du går videre.`
                      : 'Merkevareguiden er klar for produksjon.'}
                  </Typography>
                </Stack>
              </Stack>

              {brandGuideMissingItems.length > 0 ? (
                <Box
                  sx={{
                    mb: 1.05,
                    px: 0.8,
                    py: brandGuideMissingItems.length <= 2 ? 0.58 : 0.72,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.1)',
                    bgcolor: 'rgba(15,23,42,0.22)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(191,219,254,0.7)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.35, mb: 0.32 }}>
                    Dette mangler i merkevareguiden
                  </Typography>
                  <Stack spacing={0.18}>
                    {brandGuideMissingItems.map((item) => (
                      <Typography key={item.id} sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.4 }}>
                        • {item.label}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={0.55}
                  sx={{
                    px: 0.8,
                    py: 0.68,
                    mb: 1.05,
                    borderRadius: 1.5,
                    border: '1px solid rgba(34,197,94,0.12)',
                    bgcolor: 'rgba(15,23,42,0.22)',
                  }}
                >
                  <Typography
                    sx={{
                      color: '#86efac',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}
                  >
                    Klart
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
                    Merkevareguiden er klar for produksjon.
                  </Typography>
                </Stack>
              )}

              {!materials.some((item) => item.entry_type === 'brand_asset') && brandPackTemplate ? (
                <Box
                  sx={{
                    mb: 1.05,
                    px: 0.8,
                    py: 0.72,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.1)',
                    bgcolor: 'rgba(15,23,42,0.22)',
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Box>
                      <Typography sx={{ color: 'rgba(191,219,254,0.7)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.35, mb: 0.2 }}>
                        Dette bør du legge inn i materialet
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.4 }}>
                        Legg inn logo og profilfiler i materialbanken, så teamet bruker samme filer i produksjon og levering.
                      </Typography>
                    </Box>
                    {canEditClientInput ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => applyMaterialTemplate(brandPackTemplate)}
                        sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
                      >
                        Legg til merkevarefil
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                  gap: 0.95,
                }}
              >
                <Box
                  sx={{
                    p: 1.05,
                    borderRadius: 2,
                    border: '1px solid rgba(96,165,250,0.14)',
                    bgcolor: 'rgba(2,6,23,0.38)',
                  }}
                >
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.18, fontSize: '0.98rem' }}>
                    Legg inn visuell profil
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.76rem', lineHeight: 1.5, mb: 0.85 }}>
                    Fyll inn det som faktisk skal styre logo, farger og fonter i produksjonen.
                  </Typography>
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Legg inn logoen teamet faktisk skal bruke videre i produksjon og levering.',
                        hasText(planningDraft.brandGuide.logoUrl) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Logo-lenke"
                        value={planningDraft.brandGuide.logoUrl ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          brandGuide: {
                            ...previous.brandGuide,
                            logoUrl: event.target.value,
                          },
                        }))}
                        fullWidth
                        disabled={!canEditClientInput}
                      />
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.85} sx={{ mt: 0.8 }}>
                        <input
                          ref={brandLogoFileInputRef}
                          type="file"
                          hidden
                          accept=".png,.jpg,.jpeg,.webp,.svg"
                          onChange={(event) => {
                            void handleBrandLogoFileSelected(event);
                          }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ImageOutlinedIcon />}
                          onClick={() => handleOpenBrandLogoFilePicker('primary')}
                          disabled={!canEditClientInput || uploadingBrandLogo}
                          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                        >
                          {uploadingBrandLogo && brandLogoUploadVariantType === 'primary'
                            ? 'Laster opp og analyserer...'
                            : 'Last opp primærlogo'}
                        </Button>
                        {resolvedBrandLogoUrl ? (
                          <Button
                            size="small"
                            variant="text"
                            component="a"
                            href={resolvedBrandLogoUrl}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                          >
                            Åpne logofil
                          </Button>
                        ) : null}
                      </Stack>
                      <Box
                        sx={{
                          mt: 0.95,
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 0.75,
                        }}
                      >
                        {BRAND_LOGO_VARIANT_ORDER.map((variantType) => {
                          const variant = brandLogoVariants.find((item) => item.type === variantType) ?? null;
                          const isActiveVariant = activeBrandLogoVariant?.type === variantType;
                          const isAutoPreviewVariant = autoBrandPreviewVariant?.type === variantType;
                          const isDeleteConfirmOpen = brandLogoVariantDeleteConfirmType === variantType;
                          const variantLabel = BRAND_LOGO_VARIANT_LABELS[variantType];
                          const variantDetection = variant?.detection;
                          return (
                            <Box
                              key={variantType}
                              sx={{
                                p: 0.9,
                                borderRadius: 1.4,
                                border: isActiveVariant
                                  ? '1px solid rgba(56,189,248,0.34)'
                                  : '1px solid rgba(148,163,184,0.16)',
                                bgcolor: isActiveVariant
                                  ? 'rgba(14,165,233,0.1)'
                                  : 'rgba(2,6,23,0.36)',
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>
                                    {variantLabel}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.72rem', mt: 0.2, lineHeight: 1.45 }}>
                                    {BRAND_LOGO_VARIANT_HELPERS[variantType]}
                                  </Typography>
                                </Box>
                                <Chip
                                  size="small"
                                  label={isActiveVariant ? 'Aktiv' : variant ? 'Klar' : 'Mangler'}
                                  sx={{
                                    bgcolor: isActiveVariant
                                      ? 'rgba(56,189,248,0.16)'
                                      : variant
                                        ? 'rgba(34,197,94,0.14)'
                                        : 'rgba(148,163,184,0.14)',
                                    color: isActiveVariant
                                      ? '#dbeafe'
                                      : variant
                                        ? '#dcfce7'
                                        : '#cbd5e1',
                                    fontWeight: 700,
                                  }}
                                />
                              </Stack>
                              {variant ? (
                                <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap sx={{ mt: 0.55 }}>
                                  {variantType === 'primary' ? (
                                    <Chip
                                      size="small"
                                      label="Auto i 16:9 / 4:5"
                                      sx={{ bgcolor: 'rgba(56,189,248,0.12)', color: '#dbeafe', fontWeight: 700 }}
                                    />
                                  ) : null}
                                  {variantType === 'icon' ? (
                                    <Chip
                                      size="small"
                                      label="Auto i 9:16 / 1:1"
                                      sx={{ bgcolor: 'rgba(168,85,247,0.12)', color: '#f5d0fe', fontWeight: 700 }}
                                    />
                                  ) : null}
                                  {isAutoPreviewVariant ? (
                                    <Chip
                                      size="small"
                                      label={`Brukes nå i ${activeBrandPreviewFormat}`}
                                      sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#dcfce7', fontWeight: 700 }}
                                    />
                                  ) : null}
                                </Stack>
                              ) : null}
                              <Typography sx={{ color: 'rgba(191,219,254,0.76)', fontSize: '0.73rem', mt: 0.55 }} noWrap>
                                {readFirstNonEmptyString(
                                  variant?.fileName,
                                  variantDetection?.sourceFileName,
                                  'Ingen variant lastet opp ennå.',
                                )}
                              </Typography>
                              {variantDetection ? (
                                <Typography sx={{ color: 'rgba(148,163,184,0.76)', fontSize: '0.7rem', mt: 0.2 }} noWrap>
                                  {[
                                    getBrandLogoMarkTypeLabel(variantDetection.markType),
                                    variantDetection.hasTransparency ? 'transparent' : 'bakplate',
                                  ].join(' · ')}
                                </Typography>
                              ) : null}
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.7} sx={{ mt: 0.8 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleOpenBrandLogoFilePicker(variantType)}
                                  disabled={!canEditClientInput || uploadingBrandLogo || savingPlanning}
                                  sx={{ textTransform: 'none', fontWeight: 700, minHeight: 38 }}
                                >
                                  {uploadingBrandLogo && brandLogoUploadVariantType === variantType
                                    ? 'Laster opp...'
                                    : variant
                                      ? 'Bytt fil'
                                      : 'Last opp'}
                                </Button>
                                {variant ? (
                                  <Button
                                    size="small"
                                    variant={isActiveVariant ? 'contained' : 'text'}
                                    onClick={() => {
                                      void handleSelectActiveBrandLogoVariant(variantType);
                                    }}
                                    disabled={!canEditClientInput || isActiveVariant || uploadingBrandLogo || savingPlanning}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      minHeight: 38,
                                      ...(isActiveVariant
                                        ? { bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }
                                        : {}),
                                    }}
                                  >
                                    {brandLogoVariantBusyKey === `activate:${variantType}`
                                      ? 'Lagrer...'
                                      : isActiveVariant
                                        ? 'I preview nå'
                                        : 'Bruk i preview'}
                                  </Button>
                                ) : null}
                                {variant ? (
                                  <Button
                                    size="small"
                                    variant="text"
                                    color="error"
                                    onClick={() => {
                                      setBrandLogoVariantDeleteConfirmType((previous) => (
                                        previous === variantType ? null : variantType
                                      ));
                                    }}
                                    disabled={!canEditClientInput || uploadingBrandLogo || savingPlanning}
                                    sx={{ textTransform: 'none', fontWeight: 700, minHeight: 38 }}
                                  >
                                    {brandLogoVariantBusyKey === `delete:${variantType}`
                                      ? 'Sletter...'
                                      : isDeleteConfirmOpen
                                        ? 'Lukk'
                                        : 'Slett'}
                                  </Button>
                                ) : null}
                              </Stack>
                              {variant ? (
                                <Collapse in={isDeleteConfirmOpen}>
                                  <Alert
                                    severity="warning"
                                    sx={{
                                      mt: 0.85,
                                      borderRadius: 1.2,
                                      bgcolor: 'rgba(120,53,15,0.2)',
                                      border: '1px solid rgba(251,191,36,0.18)',
                                      '& .MuiAlert-message': { width: '100%' },
                                    }}
                                  >
                                    <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#fef3c7', mb: 0.3 }}>
                                      Slette {variantLabel.toLowerCase()}?
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.74rem', color: 'rgba(254,243,199,0.86)', lineHeight: 1.45 }}>
                                      Varianten fjernes fra prosjektet og filen slettes også hvis den er lastet opp her.
                                    </Typography>
                                    <Stack direction="row" spacing={0.7} sx={{ mt: 0.8 }}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="error"
                                        onClick={() => {
                                          void handleDeleteBrandLogoVariant(variantType);
                                        }}
                                        disabled={!canEditClientInput || uploadingBrandLogo || savingPlanning}
                                        sx={{ textTransform: 'none', fontWeight: 700 }}
                                      >
                                        {brandLogoVariantBusyKey === `delete:${variantType}` ? 'Sletter...' : 'Bekreft sletting'}
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => setBrandLogoVariantDeleteConfirmType(null)}
                                        disabled={brandLogoVariantBusyKey === `delete:${variantType}`}
                                        sx={{ textTransform: 'none', fontWeight: 700, color: '#fde68a' }}
                                      >
                                        Avbryt
                                      </Button>
                                    </Stack>
                                  </Alert>
                                </Collapse>
                              ) : null}
                            </Box>
                          );
                        })}
                      </Box>
                      {brandLogoDetection ? (
                        <Box
                          sx={{
                            mt: 0.9,
                            p: 0.95,
                            borderRadius: 1.5,
                            border: '1px solid rgba(56,189,248,0.18)',
                            bgcolor: 'rgba(8,47,73,0.16)',
                          }}
                        >
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                            <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
                              <Box
                                sx={{
                                  width: 72,
                                  height: 72,
                                  flexShrink: 0,
                                  borderRadius: 1.4,
                                  border: '1px solid rgba(148,163,184,0.18)',
                                  bgcolor: 'rgba(15,23,42,0.72)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                }}
                              >
                                {resolvedBrandLogoUrl ? (
                                  <Box
                                    component="img"
                                    src={resolvedBrandLogoUrl}
                                    alt="Opplastet logo"
                                    sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                  />
                                ) : (
                                  <ImageOutlinedIcon sx={{ color: 'rgba(191,219,254,0.72)' }} />
                                )}
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mb: 0.35 }}>
                                  <Chip
                                    size="small"
                                    icon={<AutoFixHighIcon />}
                                    label="Brand Intake Assistant"
                                    sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#e0f2fe' }}
                                  />
                                  <Chip
                                    size="small"
                                    label={`Aktiv variant · ${BRAND_LOGO_VARIANT_LABELS[activeBrandLogoVariant?.type ?? 'primary']}`}
                                    sx={{ bgcolor: 'rgba(14,165,233,0.14)', color: '#dbeafe' }}
                                  />
                                  <Chip
                                    size="small"
                                    label={brandLogoDetectionSummary?.markTypeLabel ?? 'Ukjent'}
                                    sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#f5d0fe' }}
                                  />
                                  <Chip
                                    size="small"
                                    label={brandLogoDetectionSummary?.transparencyLabel ?? 'Ingen analyse'}
                                    sx={{ bgcolor: 'rgba(15,118,110,0.16)', color: '#99f6e4' }}
                                  />
                                </Stack>
                                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                                  {readFirstNonEmptyString(brandLogoDetection.sourceFileName, 'Opplastet logo')}
                                </Typography>
                                <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.78rem', mt: 0.22, lineHeight: 1.45 }}>
                                  {readFirstNonEmptyString(
                                    brandLogoDetection.note,
                                    'Vi har lest logoen og laget forslag til farger, plassering og treatment.',
                                  )}
                                </Typography>
                                <Typography sx={{ color: 'rgba(191,219,254,0.78)', fontSize: '0.74rem', mt: 0.28 }}>
                                  {[
                                    brandLogoDetection.aspectRatioLabel ? `Forhold: ${brandLogoDetection.aspectRatioLabel}` : '',
                                    brandLogoDetection.imageWidth && brandLogoDetection.imageHeight ? `${brandLogoDetection.imageWidth}×${brandLogoDetection.imageHeight}` : '',
                                    brandLogoDetectionSummary?.placementLabel ? `Plassering: ${brandLogoDetectionSummary.placementLabel}` : '',
                                    brandLogoDetectionSummary?.treatmentLabel ? `Treatment: ${brandLogoDetectionSummary.treatmentLabel}` : '',
                                  ].filter(Boolean).join(' · ')}
                                </Typography>
                              </Box>
                            </Stack>
                            <Stack spacing={0.7} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
                              {canEditClientInput ? (
                                <>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<CheckCircleOutlineIcon />}
                                    onClick={() => {
                                      void applyBrandLogoDetectionSuggestions();
                                    }}
                                    sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
                                  >
                                    Bruk forslag
                                  </Button>
                                  {brandLogoDetectionColors.length > 0 ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => setBrandColorsFromEntries(brandLogoDetectionColors)}
                                      sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }}
                                    >
                                      Bruk bare farger
                                    </Button>
                                  ) : null}
                                </>
                              ) : null}
                              <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.72rem', maxWidth: 250, textAlign: { md: 'right' } }}>
                                Forslagene fyller ut merkevareguiden, men klienten kan fortsatt justere alt manuelt etterpå.
                              </Typography>
                            </Stack>
                          </Stack>
                          {brandLogoDetectionColors.length > 0 ? (
                            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 0.95 }}>
                              {brandLogoDetectionColors.map((color) => (
                                <Stack
                                  key={color.id}
                                  direction="row"
                                  spacing={0.55}
                                  alignItems="center"
                                  sx={{
                                    px: 0.75,
                                    py: 0.45,
                                    borderRadius: 999,
                                    border: '1px solid rgba(148,163,184,0.16)',
                                    bgcolor: 'rgba(15,23,42,0.56)',
                                  }}
                                >
                                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: color.hex, border: '1px solid rgba(255,255,255,0.2)' }} />
                                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {color.label}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.74rem' }}>
                                    {color.hex}
                                  </Typography>
                                </Stack>
                              ))}
                            </Stack>
                          ) : null}
                        </Box>
                      ) : null}
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Velg hvor logoen skal ligge, når den skal vises, og hvordan den skal behandles i videoen.',
                        hasText(planningDraft.brandGuide.logoUrl) ? 'filled' : 'optional',
                      )}
                      <Stack spacing={0.85}>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={planningDraft.brandGuide.logoPlacement ?? 'bottom_right'}
                          onChange={(_, nextValue: string | null) => {
                            if (!nextValue) {
                              return;
                            }
                            setPlanningDraft((previous) => ({
                              ...previous,
                              brandGuide: {
                                ...previous.brandGuide,
                                logoPlacement: nextValue as typeof previous.brandGuide.logoPlacement,
                              },
                            }));
                          }}
                          sx={{
                            flexWrap: 'wrap',
                            gap: 0.55,
                            '& .MuiToggleButton-root': {
                              borderRadius: '999px !important',
                              px: 0.9,
                              textTransform: 'none',
                              fontWeight: 700,
                              borderColor: 'rgba(148,163,184,0.2)',
                              color: 'rgba(226,232,240,0.82)',
                            },
                            '& .Mui-selected': {
                              bgcolor: 'rgba(168,85,247,0.16) !important',
                              borderColor: 'rgba(168,85,247,0.32) !important',
                              color: '#f5d0fe !important',
                            },
                          }}
                        >
                          {Object.entries(PRODUCER_BRAND_LOGO_PLACEMENT_LABELS).map(([value, label]) => (
                            <ToggleButton key={value} value={value} disabled={!canEditClientInput}>
                              {label}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                        <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.72rem', lineHeight: 1.45 }}>
                          Dra logoen i previewen for å snappe den til nærmeste plassering. Valget under oppdateres automatisk.
                        </Typography>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={planningDraft.brandGuide.logoTiming ?? 'outro'}
                          onChange={(_, nextValue: string | null) => {
                            if (!nextValue) {
                              return;
                            }
                            setPlanningDraft((previous) => ({
                              ...previous,
                              brandGuide: {
                                ...previous.brandGuide,
                                logoTiming: nextValue as typeof previous.brandGuide.logoTiming,
                                logoStartSecond: nextValue === 'custom'
                                  ? Math.max(0, previous.brandGuide.logoStartSecond ?? 0)
                                  : previous.brandGuide.logoStartSecond,
                                logoEndSecond: nextValue === 'custom'
                                  ? Math.max(
                                    (previous.brandGuide.logoStartSecond ?? 0) + 1,
                                    previous.brandGuide.logoEndSecond ?? 3,
                                  )
                                  : previous.brandGuide.logoEndSecond,
                              },
                            }));
                          }}
                          sx={{
                            flexWrap: 'wrap',
                            gap: 0.55,
                            '& .MuiToggleButton-root': {
                              borderRadius: '999px !important',
                              px: 0.9,
                              textTransform: 'none',
                              fontWeight: 700,
                              borderColor: 'rgba(148,163,184,0.2)',
                              color: 'rgba(226,232,240,0.82)',
                            },
                            '& .Mui-selected': {
                              bgcolor: 'rgba(56,189,248,0.16) !important',
                              borderColor: 'rgba(56,189,248,0.32) !important',
                              color: '#dbeafe !important',
                            },
                          }}
                        >
                          {Object.entries(PRODUCER_BRAND_LOGO_TIMING_LABELS).map(([value, label]) => (
                            <ToggleButton key={value} value={value} disabled={!canEditClientInput}>
                              {label}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                        {planningDraft.brandGuide.logoTiming === 'custom' ? (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.85}>
                            <TextField
                              size="small"
                              type="number"
                              label="Fra sekund"
                              value={planningDraft.brandGuide.logoStartSecond ?? 0}
                              disabled={!canEditClientInput}
                              inputProps={{ min: 0, step: 1 }}
                              onChange={(event) => {
                                const nextStart = Math.max(0, Number(event.target.value || 0));
                                setPlanningDraft((previous) => ({
                                  ...previous,
                                  brandGuide: {
                                    ...previous.brandGuide,
                                    logoStartSecond: nextStart,
                                    logoEndSecond: Math.max(nextStart + 1, previous.brandGuide.logoEndSecond ?? nextStart + 3),
                                  },
                                }));
                              }}
                              helperText="Velg når overlayet skal starte i videoen."
                            />
                            <TextField
                              size="small"
                              type="number"
                              label="Til sekund"
                              value={planningDraft.brandGuide.logoEndSecond ?? 3}
                              disabled={!canEditClientInput}
                              inputProps={{ min: (planningDraft.brandGuide.logoStartSecond ?? 0) + 1, step: 1 }}
                              onChange={(event) => {
                                const nextEnd = Number(event.target.value || 0);
                                setPlanningDraft((previous) => ({
                                  ...previous,
                                  brandGuide: {
                                    ...previous.brandGuide,
                                    logoEndSecond: Math.max((previous.brandGuide.logoStartSecond ?? 0) + 1, nextEnd),
                                  },
                                }));
                              }}
                              helperText="Velg når overlayet skal forsvinne igjen."
                            />
                          </Stack>
                        ) : null}
                        {planningDraft.brandGuide.logoTiming !== 'none' ? (
                          <Box
                            sx={{
                              px: 0.2,
                              pt: 0.3,
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.25 }}>
                              <Typography sx={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 700 }}>
                                Finjuster logo-timing
                              </Typography>
                              <Typography sx={{ color: 'rgba(125,211,252,0.9)', fontSize: '0.73rem', fontWeight: 700 }}>
                                {planningDraft.brandGuide.logoTiming === 'custom' ? 'Tilpasset' : 'Dra for å gjøre tilpasset'}
                              </Typography>
                            </Stack>
                            <Slider
                              value={[logoTimingPreview.start, logoTimingPreview.end]}
                              onChange={handleBrandTimingRangeChange}
                              min={0}
                              max={logoTimingPreview.total}
                              step={1}
                              disabled={!canEditClientInput}
                              valueLabelDisplay="auto"
                              valueLabelFormat={(value) => formatVideoSecond(value)}
                              sx={{
                                color: '#38bdf8',
                                px: 0.5,
                                '& .MuiSlider-thumb': {
                                  width: 16,
                                  height: 16,
                                },
                                '& .MuiSlider-rail': {
                                  opacity: 0.24,
                                  bgcolor: 'rgba(148,163,184,0.32)',
                                },
                                '& .MuiSlider-track': {
                                  border: 'none',
                                  boxShadow: '0 0 18px rgba(56,189,248,0.24)',
                                },
                              }}
                            />
                            <Stack direction="row" justifyContent="space-between">
                              <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.72rem' }}>
                                Start {formatVideoSecond(logoTimingPreview.start)}
                              </Typography>
                              <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.72rem' }}>
                                Slutt {formatVideoSecond(logoTimingPreview.end)}
                              </Typography>
                            </Stack>
                          </Box>
                        ) : null}
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1.4,
                            border: '1px solid rgba(148,163,184,0.16)',
                            background: 'rgba(2,6,23,0.48)',
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                              Logo i videoen
                            </Typography>
                            <Typography sx={{ color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700 }}>
                              {logoTimingPreview.label}
                            </Typography>
                          </Stack>
                          <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem', mt: 0.35 }}>
                            {logoTimingPreview.detail}
                          </Typography>
                          <Box
                            sx={{
                              position: 'relative',
                              mt: 1,
                              height: 10,
                              borderRadius: 999,
                              bgcolor: 'rgba(148,163,184,0.18)',
                              overflow: 'hidden',
                            }}
                          >
                            {planningDraft.brandGuide.logoTiming !== 'none' ? (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: `${(logoTimingPreview.start / Math.max(1, logoTimingPreview.total)) * 100}%`,
                                  width: `${Math.max(
                                    8,
                                    ((logoTimingPreview.end - logoTimingPreview.start) / Math.max(1, logoTimingPreview.total)) * 100,
                                  )}%`,
                                  borderRadius: 999,
                                  bgcolor: 'rgba(56,189,248,0.92)',
                                  boxShadow: '0 0 18px rgba(56,189,248,0.35)',
                                }}
                              />
                            ) : null}
                          </Box>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                            <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.72rem' }}>
                              0:00
                            </Typography>
                            <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.72rem' }}>
                              {formatVideoSecond(logoTimingPreview.total)}
                            </Typography>
                          </Stack>
                        </Box>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={planningDraft.brandGuide.logoTreatment ?? 'clean'}
                          onChange={(_, nextValue: string | null) => {
                            if (!nextValue) {
                              return;
                            }
                            setPlanningDraft((previous) => ({
                              ...previous,
                              brandGuide: {
                                ...previous.brandGuide,
                                logoTreatment: nextValue as typeof previous.brandGuide.logoTreatment,
                              },
                            }));
                          }}
                          sx={{
                            flexWrap: 'wrap',
                            gap: 0.55,
                            '& .MuiToggleButton-root': {
                              borderRadius: '999px !important',
                              px: 0.9,
                              textTransform: 'none',
                              fontWeight: 700,
                              borderColor: 'rgba(148,163,184,0.2)',
                              color: 'rgba(226,232,240,0.82)',
                            },
                            '& .Mui-selected': {
                              bgcolor: 'rgba(34,197,94,0.16) !important',
                              borderColor: 'rgba(34,197,94,0.32) !important',
                              color: '#dcfce7 !important',
                            },
                          }}
                        >
                          {Object.entries(PRODUCER_BRAND_LOGO_TREATMENT_LABELS).map(([value, label]) => (
                            <ToggleButton key={value} value={value} disabled={!canEditClientInput}>
                              {label}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                        <Box
                          sx={{
                            position: 'relative',
                            minHeight: 152,
                            borderRadius: 2,
                            border: '1px solid rgba(148,163,184,0.16)',
                            background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.82))',
                            overflow: 'hidden',
                            px: 1.1,
                            py: 0.95,
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} flexWrap="wrap">
                            <Typography sx={{ color: 'rgba(191,219,254,0.64)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              Preview
                            </Typography>
                            <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                              <Chip
                                size="small"
                                label={selectedBrandPreviewDelivery ? activeBrandPreviewFormat : `${activeBrandPreviewFormat} preview`}
                                sx={{
                                  bgcolor: 'rgba(56,189,248,0.16)',
                                  color: '#e0f2fe',
                                  border: '1px solid rgba(56,189,248,0.28)',
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={`Previewvariant · ${brandPreviewVariantLabel}`}
                                sx={{
                                  bgcolor: 'rgba(14,165,233,0.12)',
                                  color: '#dbeafe',
                                  border: '1px solid rgba(125,211,252,0.22)',
                                  fontWeight: 700,
                                }}
                              />
                            </Stack>
                          </Stack>
                          <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.74rem', mt: 0.25, maxWidth: 320 }}>
                            {readFirstNonEmptyString(
                              selectedBrandPreviewDelivery
                                ? `${selectedBrandPreviewDelivery.title} · ${selectedBrandPreviewDelivery.channel} · ${selectedBrandPreviewDelivery.formatLabel}`
                                : '',
                              hasText(planningDraft.brandGuide.logoUrl) ? 'Logoen er koblet til prosjektet.' : '',
                              logoTimingPreview.detail,
                              'Slik ser logo- og overlay-retningen ut i videorammen.',
                            )}
                          </Typography>
                          {isClientPortalView || isClientReviewerMode ? (
                            <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.74rem', mt: 0.55, lineHeight: 1.45 }}>
                              Velg leveransen du faktisk skal vurdere. Previewen oppdaterer safe zone, margin og logo-oppførsel mot riktig format for klientvisningen.
                            </Typography>
                          ) : null}
                          <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.72rem', mt: 0.45, lineHeight: 1.45 }}>
                            {brandPreviewVariantDetail}
                          </Typography>
                          {brandPreviewDeliveries.length > 0 ? (
                            <Box
                              sx={{
                                mt: 0.95,
                                display: 'grid',
                                gridTemplateColumns: {
                                  xs: '1fr',
                                  xl: 'repeat(2, minmax(0, 1fr))',
                                },
                                gap: 0.75,
                                maxHeight: 196,
                                overflowY: 'auto',
                                pr: 0.2,
                              }}
                            >
                              {brandPreviewDeliveries.map((item) => {
                                const isSelected = item.id === selectedBrandPreviewDelivery?.id;
                                return (
                                  <Box
                                    key={item.id}
                                    component="button"
                                    type="button"
                                    onClick={() => {
                                      setBrandPreviewDeliveryId(item.id);
                                      if (item.formatValue) {
                                        setBrandPreviewFormat(item.formatValue);
                                      }
                                    }}
                                    sx={{
                                      appearance: 'none',
                                      width: '100%',
                                      p: 0.9,
                                      textAlign: 'left',
                                      borderRadius: 1.3,
                                      border: isSelected
                                        ? '1px solid rgba(56,189,248,0.34)'
                                        : '1px solid rgba(148,163,184,0.18)',
                                      background: isSelected
                                        ? 'rgba(14,165,233,0.12)'
                                        : 'rgba(2,6,23,0.42)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                      <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700 }} noWrap>
                                          {item.title}
                                        </Typography>
                                        <Typography sx={{ color: 'rgba(191,219,254,0.78)', fontSize: '0.72rem', mt: 0.2 }} noWrap>
                                          {`${item.channel} · ${item.phaseLabel}`}
                                        </Typography>
                                      </Box>
                                      <Chip
                                        size="small"
                                        label={item.formatLabel}
                                        sx={{
                                          bgcolor: isSelected ? 'rgba(56,189,248,0.18)' : 'rgba(15,23,42,0.72)',
                                          color: isSelected ? '#e0f2fe' : '#cbd5e1',
                                          border: '1px solid rgba(148,163,184,0.22)',
                                          fontWeight: 700,
                                        }}
                                      />
                                    </Stack>
                                    <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.7rem', mt: 0.45 }} noWrap>
                                      {`${item.publishLabel} · ${item.statusLabel}`}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          ) : (
                            <ToggleButtonGroup
                              size="small"
                              exclusive
                              value={brandPreviewFormat}
                              onChange={(_, nextValue: '16:9' | '4:5' | '9:16' | '1:1' | null) => {
                                if (!nextValue) {
                                  return;
                                }
                                setBrandPreviewFormat(nextValue);
                              }}
                              sx={{
                                mt: 0.95,
                                gap: 0.45,
                                flexWrap: 'wrap',
                                '& .MuiToggleButton-root': {
                                  borderRadius: '999px !important',
                                  px: 0.75,
                                  py: 0.1,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  borderColor: 'rgba(148,163,184,0.18)',
                                  color: 'rgba(226,232,240,0.78)',
                                },
                                '& .Mui-selected': {
                                  bgcolor: 'rgba(56,189,248,0.16) !important',
                                  borderColor: 'rgba(56,189,248,0.28) !important',
                                  color: '#e0f2fe !important',
                                },
                              }}
                            >
                              {availableBrandPreviewFormats.map((format) => (
                                <ToggleButton key={format} value={format}>
                                  {format}
                                </ToggleButton>
                              ))}
                            </ToggleButtonGroup>
                          )}
                          {selectedBrandPreviewDelivery ? (
                            <Box
                              sx={{
                                mt: 0.95,
                                p: 0.85,
                                borderRadius: 1.3,
                                border: '1px solid rgba(148,163,184,0.16)',
                                bgcolor: 'rgba(2,6,23,0.36)',
                              }}
                            >
                              <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>
                                Logovariant for denne leveransen
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.74rem', mt: 0.2, lineHeight: 1.45 }}>
                                {`${selectedBrandPreviewDelivery.title} bruker nå ${brandPreviewVariantResolution.resolvedLabel.toLowerCase()}. Anbefalt for ${activeBrandPreviewFormat} er ${brandPreviewVariantResolution.recommendedLabel.toLowerCase()}.`}
                              </Typography>
                              <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={brandPreviewVariantSelection}
                                onChange={(_, nextValue: 'auto' | ProducerBrandLogoVariantType | null) => {
                                  if (!nextValue) {
                                    return;
                                  }
                                  handleSelectedBrandPreviewDeliveryVariantSelection(nextValue);
                                }}
                                sx={{
                                  mt: 0.8,
                                  gap: 0.45,
                                  flexWrap: 'wrap',
                                  '& .MuiToggleButton-root': {
                                    borderRadius: '999px !important',
                                    px: 0.75,
                                    py: 0.12,
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    borderColor: 'rgba(148,163,184,0.18)',
                                    color: 'rgba(226,232,240,0.78)',
                                  },
                                  '& .Mui-selected': {
                                    bgcolor: 'rgba(56,189,248,0.16) !important',
                                    borderColor: 'rgba(56,189,248,0.28) !important',
                                    color: '#e0f2fe !important',
                                  },
                                }}
                              >
                                <ToggleButton value="auto" disabled={!canEditClientInput}>
                                  Bruk anbefalt variant
                                </ToggleButton>
                                {brandLogoVariants.map((variant) => (
                                  <ToggleButton key={variant.id} value={variant.type} disabled={!canEditClientInput}>
                                    {`Tving ${BRAND_LOGO_VARIANT_LABELS[variant.type]}`}
                                  </ToggleButton>
                                ))}
                              </ToggleButtonGroup>
                            </Box>
                          ) : null}
                          <Box
                            ref={brandPreviewFrameRef}
                            sx={{
                              mt: 1,
                              width: '100%',
                              maxWidth: activeBrandPreviewFormat === '9:16' ? 214 : 360,
                              mx: 'auto',
                              position: 'relative',
                              aspectRatio: brandPreviewAspectRatio,
                              borderRadius: 1.6,
                              border: '1px solid rgba(191,219,254,0.14)',
                              boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.68)',
                              overflow: 'hidden',
                              background: 'linear-gradient(135deg, rgba(15,23,42,0.82), rgba(30,41,59,0.72))',
                            }}
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                inset: `${selectedBrandOverlayProfile.safeZone.verticalPercent}% ${selectedBrandOverlayProfile.safeZone.horizontalPercent}%`,
                                borderRadius: 1.2,
                                border: '1px dashed rgba(125,211,252,0.5)',
                                boxShadow: 'inset 0 0 0 1px rgba(14,165,233,0.08)',
                              }}
                            />
                            <Typography
                              sx={{
                                position: 'absolute',
                                top: 10,
                                left: 12,
                                color: 'rgba(191,219,254,0.72)',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                              }}
                            >
                              {`Safe zone · ${selectedBrandOverlayProfile.safeZone.label}`}
                            </Typography>
                            <Box
                              sx={{
                                position: 'absolute',
                                ...(planningDraft.brandGuide.logoPlacement === 'top_left' ? { top: brandPreviewFrameMargin, left: brandPreviewFrameMargin } : {}),
                                ...(planningDraft.brandGuide.logoPlacement === 'top_right' ? { top: brandPreviewFrameMargin, right: brandPreviewFrameMargin } : {}),
                                ...(planningDraft.brandGuide.logoPlacement === 'bottom_left' ? { bottom: brandPreviewFrameMargin, left: brandPreviewFrameMargin } : {}),
                                ...(planningDraft.brandGuide.logoPlacement === 'bottom_right' ? { bottom: brandPreviewFrameMargin, right: brandPreviewFrameMargin } : {}),
                                ...(planningDraft.brandGuide.logoPlacement === 'center' ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } : {}),
                                px: planningDraft.brandGuide.logoTreatment === 'badge' ? 0.95 : 0.72,
                                py: planningDraft.brandGuide.logoTreatment === 'badge' ? 0.58 : 0.42,
                                borderRadius: planningDraft.brandGuide.logoTreatment === 'badge' ? 999 : 1.1,
                                bgcolor: planningDraft.brandGuide.logoTreatment === 'watermark'
                                  ? 'rgba(255,255,255,0.08)'
                                  : planningDraft.brandGuide.logoTreatment === 'badge'
                                    ? 'rgba(15,23,42,0.86)'
                                    : 'rgba(15,23,42,0.48)',
                                border: '1px solid rgba(226,232,240,0.18)',
                                color: '#f8fafc',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                opacity: planningDraft.brandGuide.logoTiming === 'none'
                                  ? 0.32
                                  : selectedBrandOverlayProfile.opacity.percent / 100,
                                cursor: canEditClientInput
                                  ? (draggingBrandLogo ? 'grabbing' : 'grab')
                                  : 'default',
                                touchAction: 'none',
                              }}
                              onPointerDown={handleBrandLogoPreviewPointerDown}
                              onPointerMove={handleBrandLogoPreviewPointerMove}
                              onPointerUp={handleBrandLogoPreviewPointerUp}
                              onPointerCancel={handleBrandLogoPreviewPointerUp}
                            >
                              {resolvedBrandPreviewLogoUrl ? (
                                <Box
                                  component="img"
                                  src={resolvedBrandPreviewLogoUrl}
                                  alt={`Logo preview · ${brandPreviewVariantLabel}`}
                                  sx={{
                                    display: 'block',
                                    maxWidth: planningDraft.brandGuide.logoTreatment === 'badge' ? 110 : 118,
                                    maxHeight: 42,
                                    objectFit: 'contain',
                                  }}
                                />
                              ) : (
                                getInitials(projectName, 'LG')
                              )}
                            </Box>
                          </Box>
                          <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.72rem', mt: 0.55 }}>
                            Dra logoen i rammen for å velge plassering. Previewen bruker nå aktiv logovariant og riktig safe zone for valgt leveranse.
                          </Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} useFlexGap sx={{ mt: 0.9 }}>
                            <Chip
                              size="small"
                              label={`Opacity ${selectedBrandOverlayProfile.opacity.label}`}
                              sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#dcfce7' }}
                            />
                            <Chip
                              size="small"
                              label={`Margin ${selectedBrandOverlayProfile.recommendedMargin.label}`}
                              sx={{ bgcolor: 'rgba(56,189,248,0.12)', color: '#dbeafe' }}
                            />
                          </Stack>
                          <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.74rem', mt: 0.55 }}>
                            {selectedBrandOverlayProfile.note}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Legg inn fargene som faktisk skal brukes i design og grafikk.',
                        parsedBrandColors.length > 0 ? 'filled' : 'missing',
                      )}
                      <Stack spacing={0.8}>
                        {parsedBrandColors.length > 0 ? parsedBrandColors.map((color, index) => (
                          <Box
                            key={color.id}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', md: '48px minmax(120px, 0.7fr) minmax(180px, 1fr) auto' },
                              gap: 0.75,
                              alignItems: 'center',
                            }}
                          >
                            <Box
                              component="input"
                              type="color"
                              value={normalizeColorHex(color.hex) || '#ffffff'}
                              disabled={!canEditClientInput}
                              onChange={(event) => handleBrandColorChange(index, { hex: event.target.value })}
                              sx={{
                                width: 44,
                                height: 44,
                                p: 0,
                                border: '1px solid rgba(148,163,184,0.2)',
                                borderRadius: 1.2,
                                background: 'transparent',
                              }}
                            />
                            <TextField
                              size="small"
                              label="Fargenavn"
                              value={color.label}
                              disabled={!canEditClientInput}
                              onChange={(event) => handleBrandColorChange(index, { label: event.target.value })}
                            />
                            <TextField
                              size="small"
                              label="Bruk"
                              value={color.usage ?? ''}
                              disabled={!canEditClientInput}
                              onChange={(event) => handleBrandColorChange(index, { usage: event.target.value })}
                            />
                            {canEditClientInput ? (
                              <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                onClick={() => handleRemoveBrandColor(index)}
                                sx={{ textTransform: 'none', fontWeight: 700, justifySelf: 'flex-start' }}
                              >
                                Fjern
                              </Button>
                            ) : null}
                          </Box>
                        )) : (
                          <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                            Ingen farger er valgt ennå. Legg inn minst hovedfarge og aksentfarge.
                          </Typography>
                        )}
                        {canEditClientInput ? (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddOutlinedIcon />}
                            onClick={handleAddBrandColor}
                            sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                          >
                            Legg til farge
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Legg inn fontene som skal brukes i grafikk, teksting og overlays.',
                        parsedBrandFonts.length > 0 ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Fonter (én per linje)"
                        value={brandFontsDraft}
                        onChange={(event) => setBrandFontsDraft(event.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    p: 1.05,
                    borderRadius: 2,
                    border: '1px solid rgba(96,165,250,0.14)',
                    bgcolor: 'rgba(2,6,23,0.38)',
                  }}
                >
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.18, fontSize: '0.98rem' }}>
                    Definer språk og regler
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.76rem', lineHeight: 1.5, mb: 0.85 }}>
                    Fyll inn hvordan merkevaren skal høres ut, se ut og holdes konsekvent.
                  </Typography>
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Skriv hvordan merkevaren skal høres ut i tekst, voice-over, dialog og kundehenvendelser.',
                        hasText(planningDraft.brandGuide.toneOfVoice) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Tone of voice"
                        value={planningDraft.brandGuide.toneOfVoice ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          brandGuide: {
                            ...previous.brandGuide,
                            toneOfVoice: event.target.value,
                          },
                        }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv looken som skal styre foto, lys, farger, komposisjon og tempo.',
                        hasText(planningDraft.brandGuide.visualStyle) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Visuell stil"
                        value={planningDraft.brandGuide.visualStyle ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          brandGuide: {
                            ...previous.brandGuide,
                            visualStyle: event.target.value,
                          },
                        }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv konkrete ting produksjonen alltid bør gjøre.',
                        parsedBrandDos.length > 0 ? 'filled' : 'optional',
                      )}
                      <TextField
                        label="Do&apos;s (én per linje)"
                        value={brandDosDraft}
                        onChange={(event) => setBrandDosDraft(event.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv tydelige ting teamet skal unngå.',
                        parsedBrandDonts.length > 0 ? 'filled' : 'optional',
                      )}
                      <TextField
                        label="Don&apos;ts (én per linje)"
                        value={brandDontsDraft}
                        onChange={(event) => setBrandDontsDraft(event.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                  </Stack>
                </Box>
              </Box>

              {brandGuideMissingItems.length === 0 ? (
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={0.55}
                  sx={{
                    px: 0.8,
                    py: 0.68,
                    mt: 0.9,
                    mb: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.08)',
                    bgcolor: 'rgba(15,23,42,0.26)',
                  }}
                >
                  <Typography
                    sx={{
                      color: 'rgba(191,219,254,0.56)',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}
                  >
                    Kort oppsummering
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
                    {brandGuideSummary}
                  </Typography>
                </Stack>
              ) : null}

              {canEditClientInput ? (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={0.6}
                  sx={{
                    mt: 0.95,
                    pt: 0.75,
                    borderTop: '1px solid rgba(96,165,250,0.12)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                    Lagre når uttrykket faktisk kan brukes av produksjonsteamet.
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={() => {
                      void handleSavePlanningContext();
                    }}
                    disabled={savingPlanning}
                    sx={{
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                      minHeight: 32,
                      px: 1.2,
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: '#a855f7',
                      color: '#f5f3ff',
                      '&:hover': { bgcolor: '#9333ea' },
                    }}
                  >
                    {savingPlanning ? 'Lagrer merkevareguide...' : 'Lagre og bruk i produksjon'}
                  </Button>
                </Stack>
              ) : null}
            </Box>
          ) : null}

          {!showClientWorkspaceEmptyState && activeWorkspace === 'accounts' ? (
            <Box
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(96,165,250,0.14)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                p: { xs: 1.25, md: 1.5 },
                '& .MuiInputBase-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(248,250,252,0.04)',
                  color: '#f8fafc',
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(203,213,225,0.62)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(96,165,250,0.14)',
                },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.42rem', lineHeight: 1.05 }}>
                    Client Access Vault
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', lineHeight: 1.5, mt: 0.3, maxWidth: 660 }}>
                    Hold all klienttilgang i ett kontrollert spor. Start med delegert tilgang og invite-flyt. Hvis kunden faktisk må dele noe sensitivt, skal det beskrives som sikker håndtering, maskert referanse og tydelig ansvar, ikke som rå credentials i prosjekttekst.
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={0.65}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  sx={{
                    minWidth: { lg: 340 },
                    px: 0.8,
                    py: 0.7,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.08)',
                    bgcolor: 'rgba(15,23,42,0.28)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(191,219,254,0.56)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Fremdrift
                  </Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {requiredAccountEntries.length > 0
                      ? `${connectedRequiredAccountCount}/${requiredAccountEntries.length} koblet`
                      : 'Ingen krav ennå'}
                  </Typography>
                  <Box
                    sx={{
                      width: { xs: '100%', sm: 108 },
                      height: 5,
                      borderRadius: 999,
                      bgcolor: 'rgba(148,163,184,0.18)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${requiredAccountEntries.length > 0 ? (connectedRequiredAccountCount / requiredAccountEntries.length) * 100 : 0}%`,
                        height: '100%',
                        borderRadius: 999,
                        bgcolor: '#14b8a6',
                      }}
                    />
                  </Box>
                  <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                    {pendingRequiredAccountCount > 0
                      ? `${pendingRequiredAccountCount} nødvendige kontoer venter fortsatt på sikker tilgang.`
                      : 'Nødvendige kontoer er koblet eller klarert.'}
                  </Typography>
                </Stack>
              </Stack>

              <Stack
                direction="row"
                spacing={0.55}
                flexWrap="wrap"
                useFlexGap
                sx={{ mb: 1.05 }}
              >
                {(Object.keys(PRODUCER_ACCOUNT_ACCESS_VAULT_TAB_LABELS) as ProducerAccountAccessVaultTab[]).map((tab) => (
                  <Button
                    key={tab}
                    size="small"
                    variant={accountAccessVaultTab === tab ? 'contained' : 'outlined'}
                    onClick={() => updateAccountAccessWorkspace((workspace) => ({
                      ...workspace,
                      activeVaultTab: tab,
                    }))}
                    sx={{
                      minHeight: 34,
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 999,
                      px: 1.1,
                      borderColor: 'rgba(96,165,250,0.18)',
                      color: accountAccessVaultTab === tab ? '#f8fafc' : 'rgba(226,232,240,0.82)',
                      bgcolor: accountAccessVaultTab === tab ? 'rgba(59,130,246,0.24)' : 'transparent',
                      '&:hover': {
                        borderColor: 'rgba(125,211,252,0.34)',
                        bgcolor: accountAccessVaultTab === tab ? 'rgba(59,130,246,0.3)' : 'rgba(30,41,59,0.5)',
                      },
                    }}
                  >
                    {PRODUCER_ACCOUNT_ACCESS_VAULT_TAB_LABELS[tab]}
                  </Button>
                ))}
              </Stack>

              {accountAccessHasSensitiveContent ? (
                <Alert
                  severity="warning"
                  sx={{
                    mb: 1.05,
                    borderRadius: 1.8,
                    bgcolor: 'rgba(120,53,15,0.28)',
                    color: '#fde68a',
                    border: '1px solid rgba(245,158,11,0.2)',
                    '& .MuiAlert-icon': { color: '#fbbf24' },
                  }}
                >
                  {accountAccessGuardrailMessages[0]}
                </Alert>
              ) : null}
              {loadingAccessVault ? (
                <Alert
                  severity="info"
                  sx={{
                    mb: 1.05,
                    borderRadius: 1.8,
                    bgcolor: 'rgba(2,132,199,0.16)',
                    color: '#e0f2fe',
                    border: '1px solid rgba(56,189,248,0.16)',
                    '& .MuiAlert-icon': { color: '#7dd3fc' },
                  }}
                >
                  Henter Client Access Vault fra server...
                </Alert>
              ) : null}
              {accessVaultError ? (
                <Alert
                  severity="error"
                  sx={{
                    mb: 1.05,
                    borderRadius: 1.8,
                  }}
                >
                  {accessVaultError}
                </Alert>
              ) : null}

              {accountAccessVaultTab === 'accounts' && (accountAccessMissingItems.length > 0 ? (
                <Box
                  sx={{
                    mb: 1.05,
                    px: 0.8,
                    py: 0.72,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.1)',
                    bgcolor: 'rgba(15,23,42,0.22)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(191,219,254,0.7)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.35, mb: 0.32 }}>
                    Dette mangler i kontotilgang
                  </Typography>
                  <Stack spacing={0.18}>
                    {accountAccessMissingItems.map((item) => (
                      <Typography key={item.id} sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.4 }}>
                        • {item.label}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={0.55}
                  sx={{
                    px: 0.8,
                    py: 0.68,
                    mb: 1.05,
                    borderRadius: 1.5,
                    border: '1px solid rgba(34,197,94,0.12)',
                    bgcolor: 'rgba(15,23,42,0.22)',
                  }}
                >
                  <Typography
                    sx={{
                      color: '#86efac',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}
                  >
                    Klart
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
                    Kontotilgangen er avklart for de plattformene dette prosjektet faktisk bruker.
                  </Typography>
                </Stack>
              ))}

              {accountAccessVaultTab === 'accounts' && pendingAccountAccessReviews.length > 0 ? (
                <Box
                  sx={{
                    mb: 1.05,
                    px: 0.85,
                    py: 0.8,
                    borderRadius: 1.5,
                    border: '1px solid rgba(56,189,248,0.14)',
                    bgcolor: 'rgba(2,132,199,0.12)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', lg: 'row' }}
                    spacing={0.8}
                    justifyContent="space-between"
                    alignItems={{ lg: 'center' }}
                    sx={{ mb: 0.7 }}
                  >
                    <Box>
                      <Typography sx={{ color: '#e0f2fe', fontWeight: 700, fontSize: '0.84rem' }}>
                        Åpne kontotilgangsreviews
                      </Typography>
                      <Typography sx={{ color: 'rgba(224,242,254,0.82)', fontSize: '0.75rem', lineHeight: 1.45, mt: 0.15 }}>
                        Disse sakene trenger klientbekreftelse eller handling i samme sikre spor.
                      </Typography>
                    </Box>
                    {clientPortalAccountAccessReviewUrl ? (
                      <Button
                        size="small"
                        component="a"
                        href={clientPortalAccountAccessReviewUrl}
                        variant="outlined"
                        sx={{
                          alignSelf: { xs: 'flex-start', lg: 'center' },
                          minHeight: 34,
                          textTransform: 'none',
                          fontWeight: 700,
                          borderColor: 'rgba(125,211,252,0.28)',
                          color: '#e0f2fe',
                        }}
                      >
                        Åpne første review
                      </Button>
                    ) : null}
                  </Stack>
                  <Stack spacing={0.55}>
                    {pendingAccountAccessReviews.slice(0, 3).map((review) => {
                      const platformLabels = readAccountAccessPlatformsFromReview(review)
                        .map((platform) => PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[platform])
                        .join(', ');
                      return (
                        <Box
                          key={review.id}
                          sx={{
                            px: 0.72,
                            py: 0.68,
                            borderRadius: 1.4,
                            border: '1px solid rgba(125,211,252,0.14)',
                            bgcolor: 'rgba(15,23,42,0.28)',
                          }}
                        >
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.6} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ color: '#bae6fd', fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.16 }}>
                                {`Kontotilgang${hasText(platformLabels) ? ` · ${platformLabels}` : ''}`}
                              </Typography>
                              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.77rem', lineHeight: 1.35 }}>
                                {review.title}
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.72rem', lineHeight: 1.4, mt: 0.12 }}>
                                {readFirstNonEmptyString(
                                  review.description ?? '',
                                  review.due_at ? `Svar innen ${formatTimestamp(review.due_at)}` : '',
                                  `Bedt om ${formatTimestamp(review.requested_at)}`,
                                )}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              component="a"
                              href={buildAccountAccessReviewUrl(review.id)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                minHeight: 34,
                                borderRadius: 999,
                                px: 1,
                                color: '#e0f2fe',
                                bgcolor: 'rgba(59,130,246,0.18)',
                                '&:hover': {
                                  bgcolor: 'rgba(59,130,246,0.24)',
                                },
                              }}
                            >
                              Åpne review
                            </Button>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              ) : null}

              {accountAccessVaultTab === 'accounts' ? (
              <Box
                sx={{
                  mb: 1.05,
                  px: 0.9,
                  py: 0.85,
                  borderRadius: 1.5,
                  border: '1px solid rgba(20,184,166,0.14)',
                  bgcolor: 'rgba(6,78,59,0.14)',
                }}
              >
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.85} justifyContent="space-between">
                  <Box>
                    <Typography sx={{ color: '#f0fdfa', fontWeight: 700, fontSize: '0.9rem' }}>
                      Sikkerhetsmodell
                    </Typography>
                    <Typography sx={{ color: 'rgba(204,251,241,0.84)', fontSize: '0.76rem', lineHeight: 1.5, mt: 0.25 }}>
                      {readFirstNonEmptyString(
                        planningDraft.accountAccess.securityNotes ?? '',
                        'Bruk OAuth, invite eller klientstyrt handling. Role Room skal ikke være et lager for passord eller 2-faktor-koder.',
                      )}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap alignItems={{ lg: 'flex-start' }}>
                    <Chip size="small" icon={<AdminPanelSettingsOutlinedIcon />} label="Ingen passord" sx={{ bgcolor: 'rgba(20,184,166,0.14)', color: '#ccfbf1' }} />
                    <Chip size="small" icon={<HubOutlinedIcon />} label="Invite / OAuth" sx={{ bgcolor: 'rgba(20,184,166,0.14)', color: '#ccfbf1' }} />
                    <Chip size="small" icon={<CloudDoneOutlinedIcon />} label="2-faktor hos kontoeier" sx={{ bgcolor: 'rgba(20,184,166,0.14)', color: '#ccfbf1' }} />
                  </Stack>
                </Stack>
              </Box>
              ) : null}

              {accountAccessVaultTab === 'accounts' ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                  gap: 0.95,
                  mb: 1.25,
                }}
              >
                {effectiveAccountEntries.map((entry) => {
                  const isRequired = requiredAccountPlatforms.has(entry.platform);
                  const isGoogleEntry = entry.platform === 'google';
                  const isLinkedInEntry = entry.platform === 'linkedin';
                  const linkedAccountReview = accountAccessReviewByPlatform.get(entry.platform) ?? null;
                  const platformFlow = ACCOUNT_ACCESS_PLATFORM_FLOW_CONFIG[entry.platform];
                  const googleConnectionDetail = '';
                  const linkedInConnectionDetail = isLinkedInEntry
                    ? readFirstNonEmptyString(
                      linkedInAccessStatus?.connection?.linkedInName && linkedInAccessStatus?.connection?.linkedInEmail
                        ? `Medlemskonto koblet: ${linkedInAccessStatus.connection.linkedInName} (${linkedInAccessStatus.connection.linkedInEmail})`
                        : '',
                      linkedInAccessStatus?.connection?.linkedInName
                        ? `Medlemskonto koblet: ${linkedInAccessStatus.connection.linkedInName}`
                        : '',
                      linkedInAccessStatus?.state === 'expired'
                        ? 'LinkedIn-koblingen er utløpt. Koble på nytt før publisering.'
                        : '',
                      linkedInAccessStatus?.connection?.lastError ?? '',
                      linkedInAccessStatus && !linkedInAccessStatus.configured && linkedInAccessStatus.missing.length > 0
                        ? `Mangler: ${linkedInAccessStatus.missing.join(', ')}`
                        : '',
                    )
                    : '';

                  return (
                    <Box
                      key={entry.platform}
                      sx={{
                        p: 1,
                        borderRadius: 1.6,
                        border: isRequired
                          ? '1px solid rgba(20,184,166,0.24)'
                          : '1px solid rgba(148,163,184,0.16)',
                        background: isRequired
                          ? 'rgba(15,118,110,0.12)'
                          : 'rgba(2,6,23,0.38)',
                      }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.8} sx={{ mb: 0.85 }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap sx={{ mb: 0.35 }}>
                            <Chip
                              size="small"
                              label={PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS[entry.method]}
                              sx={{ bgcolor: 'rgba(248,250,252,0.08)', color: '#e2e8f0' }}
                            />
                            {!isGoogleEntry ? (
                              <Chip
                                size="small"
                                label={PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status]}
                                sx={{
                                  bgcolor: entry.status === 'connected'
                                    ? 'rgba(34,197,94,0.16)'
                                    : entry.status === 'invite_sent'
                                      ? 'rgba(56,189,248,0.16)'
                                      : entry.status === 'client_action'
                                        ? 'rgba(245,158,11,0.18)'
                                        : 'rgba(148,163,184,0.16)',
                                  color: entry.status === 'connected'
                                    ? '#bbf7d0'
                                    : entry.status === 'invite_sent'
                                      ? '#dbeafe'
                                      : entry.status === 'client_action'
                                        ? '#fde68a'
                                        : '#e2e8f0',
                                }}
                              />
                            ) : null}
                            <Chip
                              size="small"
                              label={isRequired ? 'Nødvendig i dette prosjektet' : 'Valgfri plattform'}
                              sx={{ bgcolor: isRequired ? 'rgba(20,184,166,0.16)' : 'rgba(148,163,184,0.1)', color: isRequired ? '#ccfbf1' : '#cbd5e1' }}
                            />
                            {isLinkedInEntry && linkedInAccessStatus?.state === 'connected' ? (
                              <Chip
                                size="small"
                                label="Medlemskonto koblet"
                                sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#dbeafe' }}
                              />
                            ) : null}
                          </Stack>
                          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.22 }}>
                            <AccountProviderLogo platform={entry.platform} size={38} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.98rem', lineHeight: 1.2 }}>
                                {PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}
                              </Typography>
                              <Typography sx={{ color: 'rgba(148,163,184,0.76)', fontSize: '0.71rem', lineHeight: 1.35 }}>
                                {`${PRODUCER_ACCOUNT_ACCESS_TIER_LABELS[entry.tier ?? 'delegated_access']} · ${PRODUCER_ACCOUNT_ACCESS_RISK_LABELS[entry.riskLevel ?? 'low']}`}
                              </Typography>
                            </Box>
                          </Stack>
                          <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.22 }}>
                            {readFirstNonEmptyString(
                              entry.accessScope || '',
                              googleConnectionDetail,
                              linkedInConnectionDetail,
                              platformFlow.primaryDescription,
                              entry.notes || '',
                              'Ingen sikker tilgang definert ennå.',
                            )}
                          </Typography>
                        </Box>
                        {isLinkedInEntry ? (
                          <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                            <Tooltip title="Oppdater LinkedIn-status">
                              <span>
                                <IconButton
                                  onClick={() => {
                                    void loadLinkedInAccessStatus();
                                  }}
                                  disabled={loadingLinkedInAccessStatus}
                                  sx={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 999,
                                    border: '1px solid rgba(96,165,250,0.16)',
                                    color: '#bfdbfe',
                                  }}
                                >
                                  <CloudSyncOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {canEditClientInput ? (
                              <Button
                                size="small"
                                variant={linkedInAccessStatus?.state === 'connected' ? 'outlined' : 'contained'}
                                onClick={() => {
                                  if (linkedInAccessStatus?.state !== 'connected') {
                                    void handleStartLinkedInAccountLink();
                                  }
                                }}
                                disabled={linkedInAccessActionKey === 'connect' || linkedInAccessStatus?.configured === false}
                                sx={{ textTransform: 'none', fontWeight: 700, minHeight: 38 }}
                              >
                                {linkedInAccessStatus?.configured === false
                                  ? 'LinkedIn ikke konfigurert'
                                  : linkedInAccessStatus?.state === 'connected'
                                    ? 'LinkedIn aktivert'
                                    : linkedInAccessActionKey === 'connect'
                                      ? 'Starter...'
                                      : 'Aktiver LinkedIn'}
                              </Button>
                            ) : null}
                          </Stack>
                        ) : linkedAccountReview ? (
                          <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                            <Button
                              size="small"
                              component="a"
                              href={buildAccountAccessReviewUrl(linkedAccountReview.id)}
                              variant="outlined"
                              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 38 }}
                            >
                              Åpne review
                            </Button>
                          </Stack>
                        ) : null}
                      </Stack>

                      {!isGoogleEntry ? (
                        <>
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={entry.method}
                            onChange={(_, nextValue: ProducerProjectPlanning['accountAccess']['entries'][number]['method'] | null) => {
                              if (!nextValue) {
                                return;
                              }
                              updateAccountAccessEntry(entry.platform, (current) => ({
                                ...current,
                                method: nextValue,
                                tier: nextValue === 'manual_handoff' ? 'sensitive_secret' : current.tier,
                                riskLevel: nextValue === 'manual_handoff' ? 'high' : current.riskLevel,
                                secretStatus: nextValue === 'manual_handoff'
                                  ? (current.secretStatus === 'not_shared' ? 'requested' : current.secretStatus)
                                  : current.secretStatus,
                              }));
                            }}
                            sx={{
                              mb: 0.72,
                              gap: 0.45,
                              flexWrap: 'wrap',
                              '& .MuiToggleButton-root': {
                                borderRadius: '999px !important',
                                px: 0.7,
                                py: 0.08,
                                textTransform: 'none',
                                fontWeight: 700,
                                borderColor: 'rgba(148,163,184,0.18)',
                                color: 'rgba(226,232,240,0.78)',
                              },
                              '& .Mui-selected': {
                                bgcolor: 'rgba(59,130,246,0.16) !important',
                                borderColor: 'rgba(59,130,246,0.28) !important',
                                color: '#dbeafe !important',
                              },
                            }}
                          >
                            <ToggleButton value="business_invite" disabled={!canEditClientInput}>Delegert invite</ToggleButton>
                            <ToggleButton value="manual_handoff" disabled={!canEditClientInput}>Sensitiv handoff</ToggleButton>
                          </ToggleButtonGroup>

                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={entry.status}
                            onChange={(_, nextValue: typeof entry.status | null) => {
                              if (!nextValue) {
                                return;
                              }
                              updateAccountAccessEntry(entry.platform, (current) => ({
                                ...current,
                                status: nextValue,
                              }));
                            }}
                            sx={{
                              mb: 0.72,
                              gap: 0.45,
                              flexWrap: 'wrap',
                              '& .MuiToggleButton-root': {
                                borderRadius: '999px !important',
                                px: 0.7,
                                py: 0.08,
                                textTransform: 'none',
                                fontWeight: 700,
                                borderColor: 'rgba(148,163,184,0.18)',
                                color: 'rgba(226,232,240,0.78)',
                              },
                              '& .Mui-selected': {
                                bgcolor: 'rgba(20,184,166,0.16) !important',
                                borderColor: 'rgba(20,184,166,0.28) !important',
                                color: '#ccfbf1 !important',
                              },
                            }}
                          >
                            <ToggleButton value="not_started" disabled={!canEditClientInput}>Ikke startet</ToggleButton>
                            <ToggleButton value="client_action" disabled={!canEditClientInput}>Venter på klient</ToggleButton>
                            <ToggleButton value="invite_sent" disabled={!canEditClientInput}>Invite sendt</ToggleButton>
                            <ToggleButton value="connected" disabled={!canEditClientInput}>Koblet</ToggleButton>
                            <ToggleButton value="revoked" disabled={!canEditClientInput}>Avsluttet</ToggleButton>
                          </ToggleButtonGroup>

                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.55} flexWrap="wrap" useFlexGap sx={{ mb: 0.9 }}>
                            <Button
                              size="small"
                              component="a"
                              href={platformFlow.primaryHref}
                              target="_blank"
                              rel="noreferrer"
                              variant="contained"
                              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34 }}
                            >
                              {platformFlow.primaryLabel}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                handleOpenAccountAccessInviteMail(entry, linkedAccountReview);
                              }}
                              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34 }}
                            >
                              Åpne invite-utkast
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => {
                                void handleCopyAccountAccessInviteText(entry, linkedAccountReview);
                              }}
                              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34 }}
                            >
                              Kopier invite-instruks
                            </Button>
                            {platformFlow.secondaryHref ? (
                              <Button
                                size="small"
                                component="a"
                                href={platformFlow.secondaryHref}
                                target="_blank"
                                rel="noreferrer"
                                variant="text"
                                sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34 }}
                              >
                                {platformFlow.secondaryLabel ?? 'Åpne veiledning'}
                              </Button>
                            ) : null}
                            {canEditClientInput && entry.status !== 'connected' ? (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => {
                                  void handleConfirmAccountAccessConnected(entry.platform);
                                }}
                                disabled={accountAccessActionKey === `${entry.platform}:persist`}
                                sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34 }}
                              >
                                {accountAccessActionKey === `${entry.platform}:persist` ? 'Lagrer...' : 'Bekreft koblet'}
                              </Button>
                            ) : null}
                            {linkedAccountReview ? (
                              <Button
                                size="small"
                                component="a"
                                href={buildAccountAccessReviewUrl(linkedAccountReview.id)}
                                variant="text"
                                sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34 }}
                              >
                                Åpne review
                              </Button>
                            ) : null}
                          </Stack>
                        </>
                      ) : null}

                      <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap sx={{ mb: 0.8 }}>
                        <Chip
                          size="small"
                          label={`Delt med: ${readFirstNonEmptyString(stringifyAccountAccessRoleTargets(entry.sharedWithRoles), 'Ingen mottakere satt')}`}
                          sx={{ bgcolor: 'rgba(15,23,42,0.48)', color: '#cbd5e1' }}
                        />
                        <Chip
                          size="small"
                          label={PRODUCER_ACCOUNT_ACCESS_TWO_FACTOR_STATUS_LABELS[entry.twoFactorStatus ?? 'unknown']}
                          sx={{ bgcolor: 'rgba(15,23,42,0.48)', color: '#cbd5e1' }}
                        />
                        <Chip
                          size="small"
                          label={entry.expiresAt ? `Utløper ${formatTimestamp(entry.expiresAt)}` : 'Ingen utløp satt'}
                          sx={{ bgcolor: 'rgba(15,23,42,0.48)', color: '#cbd5e1' }}
                        />
                      </Stack>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                          gap: 0.85,
                        }}
                      >
                        <TextField
                          label="Konto / side / kanal"
                          value={entry.accountLabel ?? ''}
                          onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                            ...current,
                            accountLabel: event.target.value,
                          }))}
                          fullWidth
                          disabled={!canEditClientInput}
                        />
                        <TextField
                          label="Invite til / kontakt"
                          value={entry.inviteTarget ?? ''}
                          onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                            ...current,
                            inviteTarget: event.target.value,
                          }))}
                          fullWidth
                          disabled={!canEditClientInput}
                        />
                        <TextField
                          label="Scope / rolle"
                          value={entry.accessScope ?? ''}
                          onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                            ...current,
                            accessScope: event.target.value,
                          }))}
                          fullWidth
                          disabled={!canEditClientInput}
                        />
                        <TextField
                          label="Ansvarlig hos klient"
                          value={entry.ownerName ?? ''}
                          onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                            ...current,
                            ownerName: event.target.value,
                          }))}
                          fullWidth
                          disabled={!canEditClientInput}
                        />
                        <TextField
                          label="Delt med roller"
                          value={stringifyAccountAccessRoleTargets(entry.sharedWithRoles)}
                          onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                            ...current,
                            sharedWithRoles: parseAccountAccessRoleTargets(event.target.value),
                          }))}
                          fullWidth
                          disabled={!canEditClientInput}
                          helperText="For eksempel Klienteier, Innholdsprodusent, Editor, SoMe-ansvarlig."
                        />
                        <TextField
                          label="Utløper"
                          type="datetime-local"
                          value={toDateTimeLocalValue(entry.expiresAt)}
                          onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                            ...current,
                            expiresAt: fromDateTimeLocalValue(event.target.value),
                          }))}
                          fullWidth
                          disabled={!canEditClientInput}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Box>

                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={0.7}
                        sx={{ mt: 0.85 }}
                      >
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={entry.tier ?? 'delegated_access'}
                          onChange={(_, nextValue: ProducerAccountAccessTier | null) => {
                            if (!nextValue) {
                              return;
                            }
                            updateAccountAccessEntry(entry.platform, (current) => ({
                              ...current,
                              tier: nextValue,
                              secretStatus: nextValue === 'sensitive_secret'
                                ? (current.secretStatus === 'not_shared' ? 'requested' : current.secretStatus)
                                : current.secretStatus,
                            }));
                          }}
                          sx={{
                            gap: 0.45,
                            flexWrap: 'wrap',
                            '& .MuiToggleButton-root': {
                              borderRadius: '999px !important',
                              px: 0.68,
                              py: 0.08,
                              textTransform: 'none',
                              fontWeight: 700,
                              borderColor: 'rgba(148,163,184,0.18)',
                              color: 'rgba(226,232,240,0.78)',
                            },
                            '& .Mui-selected': {
                              bgcolor: 'rgba(168,85,247,0.18) !important',
                              borderColor: 'rgba(168,85,247,0.28) !important',
                              color: '#f5d0fe !important',
                            },
                          }}
                        >
                          <ToggleButton value="delegated_access" disabled={!canEditClientInput}>Delegert tilgang</ToggleButton>
                          <ToggleButton value="sensitive_secret" disabled={!canEditClientInput}>Sensitiv hemmelighet</ToggleButton>
                        </ToggleButtonGroup>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={entry.riskLevel ?? 'low'}
                          onChange={(_, nextValue: ProducerAccountAccessRiskLevel | null) => {
                            if (!nextValue) {
                              return;
                            }
                            updateAccountAccessEntry(entry.platform, (current) => ({
                              ...current,
                              riskLevel: nextValue,
                            }));
                          }}
                          sx={{
                            gap: 0.45,
                            flexWrap: 'wrap',
                            '& .MuiToggleButton-root': {
                              borderRadius: '999px !important',
                              px: 0.68,
                              py: 0.08,
                              textTransform: 'none',
                              fontWeight: 700,
                              borderColor: 'rgba(148,163,184,0.18)',
                              color: 'rgba(226,232,240,0.78)',
                            },
                            '& .Mui-selected': {
                              bgcolor: 'rgba(244,114,182,0.16) !important',
                              borderColor: 'rgba(244,114,182,0.28) !important',
                              color: '#fbcfe8 !important',
                            },
                          }}
                        >
                          <ToggleButton value="low" disabled={!canEditClientInput}>Lav risiko</ToggleButton>
                          <ToggleButton value="medium" disabled={!canEditClientInput}>Middels</ToggleButton>
                          <ToggleButton value="high" disabled={!canEditClientInput}>Høy</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>

                      <TextField
                        label="Notater"
                        value={entry.notes ?? ''}
                        onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                          ...current,
                          notes: event.target.value,
                        }))}
                        fullWidth
                        multiline
                        minRows={2}
                        disabled={!canEditClientInput}
                        error={Boolean(accountAccessEntryWarnings[`entry:${entry.platform}:notes`])}
                        helperText={accountAccessEntryWarnings[`entry:${entry.platform}:notes`] ?? 'Bruk notater til prosess og ansvar, ikke hemmeligheter.'}
                        sx={{ mt: 0.85 }}
                      />

                      {(entry.tier === 'sensitive_secret' || entry.method === 'manual_handoff') ? (
                        <Box
                          sx={{
                            mt: 0.85,
                            p: 0.85,
                            borderRadius: 1.5,
                            border: '1px solid rgba(244,114,182,0.16)',
                            bgcolor: 'rgba(76,29,149,0.16)',
                          }}
                        >
                          <Typography sx={{ color: '#f5d0fe', fontWeight: 700, fontSize: '0.82rem', mb: 0.15 }}>
                            Sikker deling
                          </Typography>
                          <Typography sx={{ color: 'rgba(245,208,254,0.8)', fontSize: '0.73rem', lineHeight: 1.45, mb: 0.7 }}>
                            Role Room kan lagre hemmeligheten kryptert i Client Access Vault. Hold likevel vanlig prosjekttekst fri for passord, backup-koder og tokens.
                          </Typography>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                              gap: 0.8,
                            }}
                          >
                            <TextField
                              label="Type hemmelighet"
                              value={entry.secretLabel ?? ''}
                              onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                                ...current,
                                secretLabel: event.target.value,
                              }))}
                              fullWidth
                              disabled={!canEditClientInput}
                              helperText="For eksempel API key, recovery code, CMS-bruker eller annonsekonto."
                            />
                            <TextField
                              label="Maskert referanse"
                              value={entry.maskedReference ?? ''}
                              onChange={(event) => updateAccountAccessEntry(entry.platform, (current) => ({
                                ...current,
                                maskedReference: event.target.value,
                              }))}
                              fullWidth
                              disabled={!canEditClientInput}
                              helperText="For eksempel brukernavn eller de siste 4 tegnene. Ikke legg inn selve hemmeligheten."
                            />
                          </Box>
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.7} sx={{ mt: 0.75 }}>
                            <ToggleButtonGroup
                              size="small"
                              exclusive
                              value={entry.secretStatus ?? 'not_shared'}
                              onChange={(_, nextValue: ProducerAccountAccessSecretStatus | null) => {
                                if (!nextValue) {
                                  return;
                                }
                                updateAccountAccessEntry(entry.platform, (current) => ({
                                  ...current,
                                  secretStatus: nextValue,
                                }));
                              }}
                              sx={{
                                gap: 0.45,
                                flexWrap: 'wrap',
                                '& .MuiToggleButton-root': {
                                  borderRadius: '999px !important',
                                  px: 0.68,
                                  py: 0.08,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  borderColor: 'rgba(148,163,184,0.18)',
                                  color: 'rgba(226,232,240,0.78)',
                                },
                                '& .Mui-selected': {
                                  bgcolor: 'rgba(244,114,182,0.16) !important',
                                  borderColor: 'rgba(244,114,182,0.28) !important',
                                  color: '#fbcfe8 !important',
                                },
                              }}
                            >
                              <ToggleButton value="not_shared" disabled={!canEditClientInput}>Ikke delt</ToggleButton>
                              <ToggleButton value="requested" disabled={!canEditClientInput}>Etterspurt</ToggleButton>
                              <ToggleButton value="stored_externally" disabled={!canEditClientInput}>Ligger sikkert utenfor</ToggleButton>
                              <ToggleButton value="revoked" disabled={!canEditClientInput}>Tilbakekalt</ToggleButton>
                            </ToggleButtonGroup>
                            <ToggleButtonGroup
                              size="small"
                              exclusive
                              value={entry.revealPolicy ?? 'approval_required'}
                              onChange={(_, nextValue: ProducerAccountAccessRevealPolicy | null) => {
                                if (!nextValue) {
                                  return;
                                }
                                updateAccountAccessEntry(entry.platform, (current) => ({
                                  ...current,
                                  revealPolicy: nextValue,
                                }));
                              }}
                              sx={{
                                gap: 0.45,
                                flexWrap: 'wrap',
                                '& .MuiToggleButton-root': {
                                  borderRadius: '999px !important',
                                  px: 0.68,
                                  py: 0.08,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  borderColor: 'rgba(148,163,184,0.18)',
                                  color: 'rgba(226,232,240,0.78)',
                                },
                                '& .Mui-selected': {
                                  bgcolor: 'rgba(168,85,247,0.18) !important',
                                  borderColor: 'rgba(168,85,247,0.28) !important',
                                  color: '#f5d0fe !important',
                                },
                              }}
                            >
                              <ToggleButton value="approval_required" disabled={!canEditClientInput}>Krever godkjenning</ToggleButton>
                              <ToggleButton value="one_time" disabled={!canEditClientInput}>Kun én visning</ToggleButton>
                              <ToggleButton value="manual_only" disabled={!canEditClientInput}>Manuell utlevering</ToggleButton>
                            </ToggleButtonGroup>
                          </Stack>
                        </Box>
                      ) : null}

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.6} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 0.85 }}>
                        <Typography sx={{ color: 'rgba(148,163,184,0.74)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                          {readFirstNonEmptyString(
                            entry.lastUsedAt ? `Sist brukt ${formatTimestamp(entry.lastUsedAt)}` : '',
                            entry.lastUpdatedAt ? `Sist oppdatert ${formatTimestamp(entry.lastUpdatedAt)}` : '',
                            'Ikke loggført ennå.',
                          )}
                        </Typography>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={entry.twoFactorStatus ?? 'unknown'}
                          onChange={(_, nextValue: ProducerAccountAccessTwoFactorStatus | null) => {
                            if (!nextValue) {
                              return;
                            }
                            updateAccountAccessEntry(entry.platform, (current) => ({
                              ...current,
                              twoFactorRequired: nextValue === 'enabled',
                              twoFactorStatus: nextValue,
                            }));
                          }}
                          sx={{
                            gap: 0.45,
                            flexWrap: 'wrap',
                            '& .MuiToggleButton-root': {
                              borderRadius: '999px !important',
                              px: 0.65,
                              py: 0.08,
                              textTransform: 'none',
                              fontWeight: 700,
                              borderColor: 'rgba(148,163,184,0.18)',
                              color: 'rgba(226,232,240,0.78)',
                            },
                            '& .Mui-selected': {
                              bgcolor: 'rgba(56,189,248,0.16) !important',
                              borderColor: 'rgba(56,189,248,0.28) !important',
                              color: '#dbeafe !important',
                            },
                          }}
                        >
                          <ToggleButton value="enabled" disabled={!canEditClientInput}>2FA aktiv</ToggleButton>
                          <ToggleButton value="missing" disabled={!canEditClientInput}>2FA mangler</ToggleButton>
                          <ToggleButton value="unknown" disabled={!canEditClientInput}>Ikke bekreftet</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
              ) : null}

              {accountAccessVaultTab === 'accounts' ? (
              <Box
                sx={{
                  p: 0.95,
                  borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.16)',
                  background: 'rgba(2,6,23,0.42)',
                  mb: 1.1,
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Sikkerhetsnotat og tilbakekalling
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.84rem', mt: 0.35, lineHeight: 1.5, mb: 0.8 }}>
                  Skriv kort hvordan dere håndterer sikkerhet og når tilgang skal fjernes igjen etter publisering eller prosjektavslutning.
                </Typography>
                <Stack spacing={0.85}>
                  <TextField
                    label="Sikkerhetsnotat"
                    value={planningDraft.accountAccess.securityNotes ?? ''}
                    onChange={(event) => updateAccountAccessWorkspace((workspace) => ({
                      ...workspace,
                      securityNotes: event.target.value,
                    }))}
                    fullWidth
                    multiline
                    minRows={2}
                    disabled={!canEditClientInput}
                    error={Boolean(accountAccessWorkspaceWarnings.securityNotes)}
                    helperText={accountAccessWorkspaceWarnings.securityNotes ?? 'Bruk dette til policy og ansvar. Ikke legg inn passord, tokens eller backup-koder.'}
                  />
                  <TextField
                    label="Plan for tilbakekalling av tilgang"
                    value={planningDraft.accountAccess.revokePlan ?? ''}
                    onChange={(event) => updateAccountAccessWorkspace((workspace) => ({
                      ...workspace,
                      revokePlan: event.target.value,
                    }))}
                    fullWidth
                    multiline
                    minRows={2}
                    disabled={!canEditClientInput}
                    error={Boolean(accountAccessWorkspaceWarnings.revokePlan)}
                    helperText={accountAccessWorkspaceWarnings.revokePlan ?? 'Beskriv når tilgang trekkes tilbake, hvem som gjør det, og hva som må roteres.'}
                  />
                </Stack>
              </Box>
              ) : null}

              {accountAccessVaultTab === 'requests' ? (
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.14)',
                    bgcolor: 'rgba(2,6,23,0.42)',
                    mb: 1.1,
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.18 }}>
                    Tilgangsforespørsler
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.82rem', lineHeight: 1.5, mb: 0.9 }}>
                    Samle alt som venter på klient, review eller invitasjonsbekreftelse i én arbeidsliste.
                  </Typography>
                  <Stack spacing={0.75}>
                    {accessVaultPendingRequests.map((request) => {
                      const draft = accessVaultDrafts[request.platform] ?? EMPTY_VAULT_SECRET_DRAFT;
                      return (
                        <Box
                          key={`vault-request-${request.id}`}
                          sx={{
                            p: 0.85,
                            borderRadius: 1.5,
                            border: '1px solid rgba(244,114,182,0.16)',
                            bgcolor: 'rgba(15,23,42,0.4)',
                          }}
                        >
                          <Stack spacing={0.8}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                                <AccountProviderLogo platform={request.platform} size={34} />
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ color: '#bfdbfe', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.1 }}>
                                    Vault-innsyn
                                  </Typography>
                                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.35 }}>
                                    {PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[request.platform]} · {VAULT_REVEAL_REQUEST_STATUS_LABELS[request.status]}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.74rem', lineHeight: 1.42, mt: 0.14 }}>
                                    {readFirstNonEmptyString(
                                      request.requestReason ?? '',
                                      request.requestedAt ? `Bedt om ${formatTimestamp(request.requestedAt)}` : '',
                                      'Innsyn er bedt om og venter på godkjenning.',
                                    )}
                                  </Typography>
                                </Box>
                              </Stack>
                              <Chip
                                size="small"
                                label={request.requestedByRole ? `Bedt om som ${request.requestedByRole}` : 'Venter på godkjenning'}
                                sx={{ bgcolor: 'rgba(96,165,250,0.14)', color: '#dbeafe' }}
                              />
                            </Stack>
                            {canApproveAccessVaultReveal ? (
                              <>
                                <TextField
                                  label="Notat til beslutning"
                                  value={draft.approvalNotes}
                                  onChange={(event) => updateAccessVaultDraft(request.platform, (current) => ({
                                    ...current,
                                    approvalNotes: event.target.value,
                                  }))}
                                  fullWidth
                                  multiline
                                  minRows={2}
                                  helperText="Legg gjerne ved instruks eller begrunnelse for godkjenningen."
                                />
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.6}>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => {
                                      void handleDecideAccessVaultReveal(request, 'approve');
                                    }}
                                    disabled={Boolean(accessVaultActionKey)}
                                    sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34, bgcolor: '#14b8a6', '&:hover': { bgcolor: '#0f766e' } }}
                                  >
                                    {accessVaultActionKey === `${request.id}:approve` ? 'Godkjenner...' : 'Godkjenn innsyn'}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      void handleDecideAccessVaultReveal(request, 'reject');
                                    }}
                                    disabled={Boolean(accessVaultActionKey)}
                                    sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34, borderColor: 'rgba(244,114,182,0.28)', color: '#fbcfe8' }}
                                  >
                                    {accessVaultActionKey === `${request.id}:reject` ? 'Avviser...' : 'Avvis'}
                                  </Button>
                                </Stack>
                              </>
                            ) : (
                              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                                Innsynsforespørselen venter på en godkjenner med riktig rolle.
                              </Alert>
                            )}
                          </Stack>
                        </Box>
                      );
                    })}
                    {accessVaultApprovedRequests.map((request) => {
                      const canReveal = request.requestedByUserId === currentRoleRoomUserId
                        || normalizedSessionRole === 'admin'
                        || normalizedSessionRole === 'super_admin';
                      const revealed = revealedVaultSecrets[request.id];
                      return (
                        <Box
                          key={`vault-approved-${request.id}`}
                          sx={{
                            p: 0.85,
                            borderRadius: 1.5,
                            border: '1px solid rgba(20,184,166,0.16)',
                            bgcolor: 'rgba(15,23,42,0.4)',
                          }}
                        >
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                              <AccountProviderLogo platform={request.platform} size={34} />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ color: '#86efac', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.1 }}>
                                  Innsyn klart
                                </Typography>
                                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.35 }}>
                                  {PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[request.platform]} · {VAULT_REVEAL_REQUEST_STATUS_LABELS[request.status]}
                                </Typography>
                                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.74rem', lineHeight: 1.42, mt: 0.14 }}>
                                  {readFirstNonEmptyString(
                                    request.approvalNotes ?? '',
                                    request.approvedAt ? `Godkjent ${formatTimestamp(request.approvedAt)}` : '',
                                    'Innsyn er godkjent og kan åpnes én gang.',
                                  )}
                                </Typography>
                              </Box>
                            </Stack>
                            {canReveal ? (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  void handleRevealAccessVaultSecret(request);
                                }}
                                disabled={Boolean(accessVaultActionKey)}
                                sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34, bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}
                              >
                                {accessVaultActionKey === `${request.id}:reveal` ? 'Åpner...' : 'Åpne én gang'}
                              </Button>
                            ) : (
                              <Chip size="small" label="Kun den som ba om innsyn kan åpne" sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1' }} />
                            )}
                          </Stack>
                          {revealed ? (
                            <Alert severity="warning" sx={{ borderRadius: 1.5, mt: 0.8 }}>
                              Secret er åpnet. Denne visningen bør behandles som midlertidig og roteres ved behov.
                            </Alert>
                          ) : null}
                        </Box>
                      );
                    })}
                    {accountAccessOperationalRequestCards.length > 0 ? accountAccessOperationalRequestCards.map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 0.85,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.12)',
                          bgcolor: 'rgba(15,23,42,0.4)',
                        }}
                      >
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                            {item.platform ? <AccountProviderLogo platform={item.platform} size={34} /> : null}
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ color: '#bfdbfe', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.1 }}>
                                {item.eyebrow}
                              </Typography>
                              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.35 }}>
                                {item.title}
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.74rem', lineHeight: 1.42, mt: 0.14 }}>
                                {item.detail}
                              </Typography>
                            </Box>
                          </Stack>
                          <Button
                            size="small"
                            component={item.href ? 'a' : 'button'}
                            href={item.href || undefined}
                            onClick={item.href ? undefined : () => {
                              openSurfaceWorkspace('accounts');
                              updateAccountAccessWorkspace((workspace) => ({
                                ...workspace,
                                activeVaultTab: 'requests',
                              }));
                            }}
                            sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34 }}
                          >
                            {item.actionLabel}
                          </Button>
                        </Stack>
                      </Box>
                    )) : null}
                    {accessVaultPendingRequests.length === 0
                    && accessVaultApprovedRequests.length === 0
                    && accountAccessOperationalRequestCards.length === 0 ? (
                      <Alert severity="success" sx={{ borderRadius: 1.5 }}>
                        Ingen åpne tilgangsforespørsler akkurat nå.
                      </Alert>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}

              {accountAccessVaultTab === 'secrets' ? (
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(236,72,153,0.16)',
                    bgcolor: 'rgba(76,29,149,0.16)',
                    mb: 1.1,
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.18 }}>
                    Delte hemmeligheter
                  </Typography>
                  <Typography sx={{ color: 'rgba(245,208,254,0.82)', fontSize: '0.82rem', lineHeight: 1.5, mb: 0.9 }}>
                    Dette er den sikre flaten for sensitiv tilgang. Secrets lagres kryptert i backend, reveal krever egen flyt, og vanlig prosjekttekst skal fortsatt være fri for passord og backup-koder.
                  </Typography>
                  <Stack spacing={0.75}>
                    {accountAccessSensitiveEntries.length > 0 ? accountAccessSensitiveEntries.map((entry) => {
                      const serverSecret = accessVaultSecretsByPlatform.get(entry.platform);
                      const activeRevealRequest = activeVaultRevealRequestsByPlatform.get(entry.platform);
                      const draft = accessVaultDrafts[entry.platform] ?? EMPTY_VAULT_SECRET_DRAFT;
                      const revealed = activeRevealRequest ? revealedVaultSecrets[activeRevealRequest.id] : null;
                      const canRevealApprovedSecret = Boolean(
                        activeRevealRequest
                        && activeRevealRequest.status === 'approved'
                        && (
                          activeRevealRequest.requestedByUserId === currentRoleRoomUserId
                          || normalizedSessionRole === 'admin'
                          || normalizedSessionRole === 'super_admin'
                        ),
                      );
                      return (
                        <Box
                          key={`secret-${entry.platform}`}
                          sx={{
                            p: 0.85,
                            borderRadius: 1.5,
                            border: '1px solid rgba(244,114,182,0.16)',
                            bgcolor: 'rgba(15,23,42,0.38)',
                          }}
                        >
                          <Stack spacing={0.8}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                                <AccountProviderLogo platform={entry.platform} size={34} />
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ color: '#f5d0fe', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.1 }}>
                                    {PRODUCER_ACCOUNT_ACCESS_SECRET_STATUS_LABELS[(serverSecret?.status as ProducerAccountAccessSecretStatus | undefined) ?? entry.secretStatus ?? 'not_shared']}
                                  </Typography>
                                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.35 }}>
                                    {PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.74rem', lineHeight: 1.42, mt: 0.14 }}>
                                    {readFirstNonEmptyString(
                                      serverSecret?.secretType ?? entry.secretLabel,
                                      serverSecret?.maskedReference ? `Maskert referanse: ${serverSecret.maskedReference}` : '',
                                      entry.maskedReference ? `Maskert referanse: ${entry.maskedReference}` : '',
                                      PRODUCER_ACCOUNT_ACCESS_REVEAL_POLICY_LABELS[(serverSecret?.revealPolicy as ProducerAccountAccessRevealPolicy | undefined) ?? entry.revealPolicy ?? 'approval_required'],
                                      'Ingen sensitiv deling definert ennå.',
                                    )}
                                  </Typography>
                                </Box>
                              </Stack>
                              <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                                <Chip size="small" label={PRODUCER_ACCOUNT_ACCESS_RISK_LABELS[(serverSecret?.riskLevel as ProducerAccountAccessRiskLevel | undefined) ?? entry.riskLevel ?? 'low']} sx={{ bgcolor: 'rgba(236,72,153,0.14)', color: '#fbcfe8' }} />
                                <Chip size="small" label={(serverSecret?.expiresAt ?? entry.expiresAt) ? `Utløper ${formatTimestamp(serverSecret?.expiresAt ?? entry.expiresAt ?? '')}` : 'Ingen utløp'} sx={{ bgcolor: 'rgba(236,72,153,0.14)', color: '#fbcfe8' }} />
                                {serverSecret?.hasStoredSecret ? (
                                  <Chip size="small" label="Kryptert lagret" sx={{ bgcolor: 'rgba(20,184,166,0.14)', color: '#ccfbf1' }} />
                                ) : null}
                              </Stack>
                            </Stack>

                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                                gap: 0.8,
                              }}
                            >
                              <TextField
                                label="Label"
                                value={draft.label}
                                onChange={(event) => updateAccessVaultDraft(entry.platform, (current) => ({
                                  ...current,
                                  label: event.target.value,
                                }))}
                                fullWidth
                                disabled={!canManageAccessVaultSecrets}
                              />
                              <TextField
                                label="Type hemmelighet"
                                value={draft.secretType}
                                onChange={(event) => updateAccessVaultDraft(entry.platform, (current) => ({
                                  ...current,
                                  secretType: event.target.value,
                                }))}
                                fullWidth
                                disabled={!canManageAccessVaultSecrets}
                              />
                              <TextField
                                label="Brukernavn / konto"
                                value={draft.username}
                                onChange={(event) => updateAccessVaultDraft(entry.platform, (current) => ({
                                  ...current,
                                  username: event.target.value,
                                }))}
                                fullWidth
                                disabled={!canManageAccessVaultSecrets}
                                helperText={serverSecret?.hasUsername ? 'Brukernavn er lagret sikkert på serveren.' : 'Valgfritt. La stå tomt hvis bare selve secret skal lagres.'}
                              />
                              <TextField
                                label="Maskert referanse"
                                value={draft.maskedReference}
                                onChange={(event) => updateAccessVaultDraft(entry.platform, (current) => ({
                                  ...current,
                                  maskedReference: event.target.value,
                                }))}
                                fullWidth
                                disabled={!canManageAccessVaultSecrets}
                              />
                              <TextField
                                label="Secret"
                                type="password"
                                value={draft.secretValue}
                                onChange={(event) => updateAccessVaultDraft(entry.platform, (current) => ({
                                  ...current,
                                  secretValue: event.target.value,
                                }))}
                                fullWidth
                                disabled={!canManageAccessVaultSecrets}
                                helperText={serverSecret?.hasStoredSecret ? 'Ny verdi overskriver lagret secret. La stå tomt for å beholde dagens.' : 'Lagres kryptert på serveren når du trykker lagre.'}
                              />
                              <TextField
                                label="Backup-kode / recovery"
                                type="password"
                                value={draft.backupCode}
                                onChange={(event) => updateAccessVaultDraft(entry.platform, (current) => ({
                                  ...current,
                                  backupCode: event.target.value,
                                }))}
                                fullWidth
                                disabled={!canManageAccessVaultSecrets}
                                helperText={serverSecret?.hasBackupCode ? 'Backup-kode er allerede lagret. Fyll inn på nytt for å oppdatere.' : 'Valgfritt. Lagres kryptert hvis du fyller det inn.'}
                              />
                              <TextField
                                label="Utløper"
                                type="datetime-local"
                                value={draft.expiresAt}
                                onChange={(event) => updateAccessVaultDraft(entry.platform, (current) => ({
                                  ...current,
                                  expiresAt: event.target.value,
                                }))}
                                fullWidth
                                disabled={!canManageAccessVaultSecrets}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Box>

                            {revealed ? (
                              <Box
                                sx={{
                                  p: 0.8,
                                  borderRadius: 1.5,
                                  border: '1px solid rgba(245,158,11,0.18)',
                                  bgcolor: 'rgba(120,53,15,0.2)',
                                }}
                              >
                                <Typography sx={{ color: '#fde68a', fontWeight: 700, fontSize: '0.78rem', mb: 0.45 }}>
                                  Åpnet secret
                                </Typography>
                                <Box
                                  sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                                    gap: 0.75,
                                  }}
                                >
                                  <TextField label="Brukernavn" value={revealed.username ?? ''} fullWidth InputProps={{ readOnly: true }} />
                                  <TextField label="Secret" value={revealed.secretValue ?? ''} fullWidth InputProps={{ readOnly: true }} />
                                  <TextField label="Backup-kode" value={revealed.backupCode ?? ''} fullWidth InputProps={{ readOnly: true }} />
                                </Box>
                                <Typography sx={{ color: 'rgba(254,240,138,0.84)', fontSize: '0.73rem', lineHeight: 1.45, mt: 0.55 }}>
                                  Åpnet {formatTimestamp(revealed.revealedAt ?? '')}. Behandle dette som midlertidig innsyn og roter tilgangen ved behov.
                                </Typography>
                              </Box>
                            ) : null}

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.6} flexWrap="wrap" useFlexGap>
                              {canManageAccessVaultSecrets ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    void handleSaveAccessVaultSecret(entry);
                                  }}
                                  disabled={Boolean(accessVaultActionKey)}
                                  sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34, bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}
                                >
                                  {accessVaultActionKey === `${entry.platform}:save` ? 'Lagrer sikkert...' : 'Lagre sikkert'}
                                </Button>
                              ) : null}
                              {canRequestAccessVaultReveal && serverSecret?.hasStoredSecret && !activeRevealRequest ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    void handleRequestAccessVaultReveal(entry.platform);
                                  }}
                                  disabled={Boolean(accessVaultActionKey)}
                                  sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34, borderColor: 'rgba(125,211,252,0.28)', color: '#e0f2fe' }}
                                >
                                  {accessVaultActionKey === `${entry.platform}:request` ? 'Ber om innsyn...' : 'Be om innsyn'}
                                </Button>
                              ) : null}
                              {canRevealApprovedSecret && activeRevealRequest ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    void handleRevealAccessVaultSecret(activeRevealRequest);
                                  }}
                                  disabled={Boolean(accessVaultActionKey)}
                                  sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34, borderColor: 'rgba(192,132,252,0.28)', color: '#f5d0fe' }}
                                >
                                  {accessVaultActionKey === `${activeRevealRequest.id}:reveal` ? 'Åpner...' : 'Åpne godkjent innsyn'}
                                </Button>
                              ) : null}
                              {canManageAccessVaultSecrets && serverSecret ? (
                                <Button
                                  size="small"
                                  color="error"
                                  variant="text"
                                  onClick={() => {
                                    void handleRevokeAccessVaultSecret(entry.platform);
                                  }}
                                  disabled={Boolean(accessVaultActionKey)}
                                  sx={{ textTransform: 'none', fontWeight: 700, minHeight: 34 }}
                                >
                                  {accessVaultActionKey === `${entry.platform}:revoke` ? 'Tilbakekaller...' : 'Tilbakekall secret'}
                                </Button>
                              ) : null}
                            </Stack>

                            {canRequestAccessVaultReveal && serverSecret?.hasStoredSecret && !activeRevealRequest ? (
                              <TextField
                                label="Hvorfor trenger du innsyn?"
                                value={draft.requestReason}
                                onChange={(event) => updateAccessVaultDraft(entry.platform, (current) => ({
                                  ...current,
                                  requestReason: event.target.value,
                                }))}
                                fullWidth
                                multiline
                                minRows={2}
                                helperText="Begrunnelsen logges i audit og vises for godkjenner."
                              />
                            ) : null}

                            {activeRevealRequest ? (
                              <Alert
                                severity={activeRevealRequest.status === 'approved' ? 'success' : 'info'}
                                sx={{ borderRadius: 1.5 }}
                              >
                                {activeRevealRequest.status === 'approved'
                                  ? 'Innsyn er godkjent. Åpne det her eller fra Tilgangsforespørsler.'
                                  : `Innsyn venter allerede på behandling for ${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}.`}
                              </Alert>
                            ) : null}
                          </Stack>
                        </Box>
                      );
                    }) : (
                      <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                        Ingen sensitive secrets er registrert. Hold deg helst til delegert tilgang og invitasjoner.
                      </Alert>
                    )}
                  </Stack>
                </Box>
              ) : null}

              {accountAccessVaultTab === 'permissions' ? (
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.14)',
                    bgcolor: 'rgba(2,6,23,0.42)',
                    mb: 1.1,
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.18 }}>
                    Plattformrettigheter
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.82rem', lineHeight: 1.5, mb: 0.9 }}>
                    Vis hvem som eier kontoen, hvem som får tilgang, hvilken rolle som trengs og om 2FA er bekreftet.
                  </Typography>
                  <Stack spacing={0.75}>
                    {effectiveAccountEntries.map((entry) => (
                      <Box
                        key={`permission-${entry.platform}`}
                        sx={{
                          p: 0.85,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.12)',
                          bgcolor: 'rgba(15,23,42,0.4)',
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.85} justifyContent="space-between">
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <AccountProviderLogo platform={entry.platform} size={34} />
                            <Box>
                              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem' }}>
                                {PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]}
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.74rem', lineHeight: 1.42, mt: 0.14 }}>
                                {readFirstNonEmptyString(entry.accessScope, 'Ingen rolle eller scope er definert ennå.')}
                              </Typography>
                            </Box>
                          </Stack>
                          <Stack spacing={0.18} sx={{ minWidth: { md: 280 } }}>
                            <Typography sx={{ color: '#cbd5e1', fontSize: '0.74rem' }}>
                              Eier: {readFirstNonEmptyString(entry.ownerName, 'Ikke satt')}
                            </Typography>
                            <Typography sx={{ color: '#cbd5e1', fontSize: '0.74rem' }}>
                              Delt med: {readFirstNonEmptyString(stringifyAccountAccessRoleTargets(entry.sharedWithRoles), 'Ingen mottakere')}
                            </Typography>
                            <Typography sx={{ color: '#cbd5e1', fontSize: '0.74rem' }}>
                              {PRODUCER_ACCOUNT_ACCESS_TWO_FACTOR_STATUS_LABELS[entry.twoFactorStatus ?? 'unknown']}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {accountAccessVaultTab === 'audit' ? (
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.14)',
                    bgcolor: 'rgba(2,6,23,0.42)',
                    mb: 1.1,
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.18 }}>
                    Aktivitetslogg
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.82rem', lineHeight: 1.5, mb: 0.9 }}>
                    Se når kontoer ble oppdatert, hvilke reviews som venter, og hvilke plattformer som nylig har endret status.
                  </Typography>
                  <Stack spacing={0.72}>
                    {accountAccessAuditItems.length > 0 ? accountAccessAuditItems.map((item) => (
                      <Stack
                        key={item.id}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={0.75}
                        justifyContent="space-between"
                        sx={{
                          p: 0.78,
                          borderRadius: 1.4,
                          border: '1px solid rgba(148,163,184,0.12)',
                          bgcolor: 'rgba(15,23,42,0.4)',
                        }}
                      >
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                          {item.platform ? <AccountProviderLogo platform={item.platform} size={30} /> : null}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.79rem' }}>
                              {item.title}
                            </Typography>
                            <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.73rem', lineHeight: 1.42 }}>
                              {item.detail}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          {formatTimestamp(item.createdAt)}
                        </Typography>
                      </Stack>
                    )) : (
                      <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                        Ingen loggførte hendelser ennå.
                      </Alert>
                    )}
                  </Stack>
                </Box>
              ) : null}

              {accountAccessVaultTab === 'emergency' ? (
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(2,6,23,0.42)',
                    mb: 1.1,
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Nødtilgang og tilbakekalling
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.84rem', mt: 0.35, lineHeight: 1.5, mb: 0.8 }}>
                    Definer hvem som kontaktes hvis publisering stopper opp, hvordan tilgang tilbakekalles, og hva som må roteres når prosjektet avsluttes.
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                      gap: 0.85,
                      mb: 0.85,
                    }}
                  >
                    <TextField
                      label="Nødkontakt"
                      value={planningDraft.accountAccess.emergencyContactName ?? ''}
                      onChange={(event) => updateAccountAccessWorkspace((workspace) => ({
                        ...workspace,
                        emergencyContactName: event.target.value,
                      }))}
                      fullWidth
                      disabled={!canEditClientInput}
                    />
                    <TextField
                      label="Nødkontakt e-post"
                      value={planningDraft.accountAccess.emergencyContactEmail ?? ''}
                      onChange={(event) => updateAccountAccessWorkspace((workspace) => ({
                        ...workspace,
                        emergencyContactEmail: event.target.value,
                      }))}
                      fullWidth
                      disabled={!canEditClientInput}
                    />
                    <TextField
                      label="Nødkontakt telefon"
                      value={planningDraft.accountAccess.emergencyContactPhone ?? ''}
                      onChange={(event) => updateAccountAccessWorkspace((workspace) => ({
                        ...workspace,
                        emergencyContactPhone: event.target.value,
                      }))}
                      fullWidth
                      disabled={!canEditClientInput}
                    />
                  </Box>
                  <Stack spacing={0.85}>
                    <TextField
                      label="Sikkerhetsnotat"
                      value={planningDraft.accountAccess.securityNotes ?? ''}
                      onChange={(event) => updateAccountAccessWorkspace((workspace) => ({
                        ...workspace,
                        securityNotes: event.target.value,
                      }))}
                      fullWidth
                      multiline
                      minRows={2}
                      disabled={!canEditClientInput}
                      error={Boolean(accountAccessWorkspaceWarnings.securityNotes)}
                      helperText={accountAccessWorkspaceWarnings.securityNotes ?? 'Beskriv hva systemet lagrer, hva klienten eier, og hvilken metode som er foretrukket.'}
                    />
                    <TextField
                      label="Plan for tilbakekalling av tilgang"
                      value={planningDraft.accountAccess.revokePlan ?? ''}
                      onChange={(event) => updateAccountAccessWorkspace((workspace) => ({
                        ...workspace,
                        revokePlan: event.target.value,
                      }))}
                      fullWidth
                      multiline
                      minRows={2}
                      disabled={!canEditClientInput}
                      error={Boolean(accountAccessWorkspaceWarnings.revokePlan)}
                      helperText={accountAccessWorkspaceWarnings.revokePlan ?? 'Beskriv hvordan passord, tokens og invitasjoner roteres eller avsluttes etter prosjektet.'}
                    />
                    <TextField
                      label="Nødtilgangsnotat"
                      value={planningDraft.accountAccess.emergencyAccessNotes ?? ''}
                      onChange={(event) => updateAccountAccessWorkspace((workspace) => ({
                        ...workspace,
                        emergencyAccessNotes: event.target.value,
                      }))}
                      fullWidth
                      multiline
                      minRows={3}
                      disabled={!canEditClientInput}
                      error={Boolean(accountAccessWorkspaceWarnings.emergencyAccessNotes)}
                      helperText={accountAccessWorkspaceWarnings.emergencyAccessNotes ?? 'Beskriv hvem som kan godkjenne reveal, når nødtilgang er lov, og hvordan klienten varsles.'}
                    />
                  </Stack>
                </Box>
              ) : null}

              {canEditClientInput ? (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={0.6}
                  sx={{
                    mt: 0.95,
                    pt: 0.75,
                    borderTop: '1px solid rgba(96,165,250,0.12)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                    Lagre når vault-flyten faktisk speiler hvem som har tilgang, hva som krever klienthandling, og hvordan tilgang stoppes igjen.
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={() => {
                      void handleSavePlanningContext();
                    }}
                    disabled={savingPlanning || accountAccessHasSensitiveContent}
                    sx={{
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                      minHeight: 32,
                      px: 1.2,
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: '#14b8a6',
                      color: '#f0fdfa',
                      '&:hover': { bgcolor: '#0f766e' },
                    }}
                  >
                    {savingPlanning ? 'Lagrer kontotilgang...' : 'Lagre vault'}
                  </Button>
                </Stack>
              ) : null}
            </Box>
          ) : null}

          {!showClientWorkspaceEmptyState && activeWorkspace === 'delivery' ? (
            <Box
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(96,165,250,0.14)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                p: { xs: 1.25, md: 1.5 },
                '& .MuiInputBase-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(248,250,252,0.04)',
                  color: '#f8fafc',
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(203,213,225,0.62)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(96,165,250,0.14)',
                },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.42rem', lineHeight: 1.05 }}>
                    Fullfør leveringsrutinen
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', lineHeight: 1.5, mt: 0.3, maxWidth: 620 }}>
                    {isClientReviewerMode
                      ? 'Legg inn det teamet trenger for å levere riktig fil på riktig sted.'
                      : 'Fyll inn reglene teamet faktisk skal bruke når prosjektet pakkes, deles og leveres.'}
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={0.65}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  sx={{
                    minWidth: { lg: 320 },
                    px: 0.8,
                    py: 0.7,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.08)',
                    bgcolor: 'rgba(15,23,42,0.28)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(191,219,254,0.56)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Fremdrift
                  </Typography>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {`${deliveryWorkflowReadyCount}/6 klare`}
                  </Typography>
                  <Box
                    sx={{
                      width: { xs: '100%', sm: 108 },
                      height: 5,
                      borderRadius: 999,
                      bgcolor: 'rgba(148,163,184,0.18)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(deliveryWorkflowReadyCount / 6) * 100}%`,
                        height: '100%',
                        borderRadius: 999,
                        bgcolor: '#38bdf8',
                      }}
                    />
                  </Box>
                  <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                    {deliveryWorkflowMissingItems.length > 0
                      ? `Fyll ut ${deliveryWorkflowMissingItems[0]?.label.toLowerCase()} før du går videre.`
                      : 'Leveringsrutinen er klar for prosjektet.'}
                  </Typography>
                </Stack>
              </Stack>

              {deliveryWorkflowMissingItems.length > 0 ? (
                <Box
                  sx={{
                    mb: 1.05,
                    px: 0.8,
                    py: deliveryWorkflowMissingItems.length <= 2 ? 0.58 : 0.72,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.1)',
                    bgcolor: 'rgba(15,23,42,0.22)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(191,219,254,0.7)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.35, mb: 0.32 }}>
                    Dette mangler i leveringsrutinen
                  </Typography>
                  <Stack spacing={0.18}>
                    {deliveryWorkflowMissingItems.map((item) => (
                      <Typography key={item.id} sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.4 }}>
                        • {item.label}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={0.55}
                  sx={{
                    px: 0.8,
                    py: 0.68,
                    mb: 1.05,
                    borderRadius: 1.5,
                    border: '1px solid rgba(34,197,94,0.12)',
                    bgcolor: 'rgba(15,23,42,0.22)',
                  }}
                >
                  <Typography
                    sx={{
                      color: '#86efac',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}
                  >
                    Klart
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
                    Leveringsrutinen er klar for team og overlevering.
                  </Typography>
                </Stack>
              )}

              <Box
                sx={{
                  mb: 1.05,
                  p: 0.95,
                  borderRadius: 1.5,
                  border: '1px solid rgba(96,165,250,0.1)',
                  bgcolor: 'rgba(15,23,42,0.22)',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.9} sx={{ mb: 0.9 }}>
                  <Box>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
                      Velg leveringsmal
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.2 }}>
                      Start med en mal og juster bare det som faktisk avviker for prosjektet.
                    </Typography>
                  </Box>
                  {selectedDeliveryPreset ? (
                    <Chip
                      size="small"
                      label={`Aktiv: ${selectedDeliveryPreset.label}`}
                      sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#dbeafe', alignSelf: { md: 'flex-start' } }}
                    />
                  ) : (
                    <Chip
                      size="small"
                      label="Tilpasset"
                      sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#e2e8f0', alignSelf: { md: 'flex-start' } }}
                    />
                  )}
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                    gap: 0.8,
                  }}
                >
                  {PRODUCER_DELIVERY_WORKFLOW_PRESETS.map((preset) => (
                    <Box
                      key={preset.id}
                      sx={{
                        p: 0.9,
                        borderRadius: 1.35,
                        border: preset.id === planningDraft.deliveryWorkflow.presetId
                          ? '1px solid rgba(56,189,248,0.34)'
                          : '1px solid rgba(148,163,184,0.16)',
                        bgcolor: preset.id === planningDraft.deliveryWorkflow.presetId
                          ? 'rgba(59,130,246,0.12)'
                          : 'rgba(2,6,23,0.4)',
                      }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.7}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem' }}>
                            {preset.label}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem', lineHeight: 1.45, mt: 0.18 }}>
                            {preset.helper}
                          </Typography>
                        </Box>
                        {canEditClientInput ? (
                          <Button
                            size="small"
                            variant={preset.id === planningDraft.deliveryWorkflow.presetId ? 'contained' : 'outlined'}
                            onClick={() => setPlanningDraft((previous) => ({
                              ...previous,
                              deliveryWorkflow: applyProducerDeliveryWorkflowPreset(preset.id, previous.deliveryWorkflow),
                            }))}
                            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { sm: 'flex-start' } }}
                          >
                            {preset.id === planningDraft.deliveryWorkflow.presetId ? 'Aktiv' : 'Bruk mal'}
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                  gap: 0.95,
                  mb: 1.25,
                }}
              >
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(2,6,23,0.42)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Siste klientpakke
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.84rem', mt: 0.35 }}>
                    {deliveryWorkspaceAssets.latestPackage
                      ? `${deliveryWorkspaceAssets.latestPackage.name} · ${formatTimestamp(deliveryWorkspaceAssets.latestPackage.uploadedAt)}`
                      : 'Ingen klientpakke er skrevet til prosjektfiler ennå.'}
                  </Typography>
                  {deliveryWorkspaceAssets.latestPackage?.downloadUrl ? (
                    <Button
                      variant="outlined"
                      size="small"
                      href={deliveryWorkspaceAssets.latestPackage.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ mt: 0.85, textTransform: 'none', fontWeight: 700 }}
                    >
                      Åpne klientpakke
                    </Button>
                  ) : null}
                </Box>

                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(2,6,23,0.42)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Leveransearbeidsområde
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.84rem', mt: 0.35 }}>
                    {deliveryWorkspaceAssets.workspaceFiles.length > 0
                      ? 'Eksportfanen har skrevet konkrete prosjektfiler per leveransepunkt med riktig mappe, pakke og versjon.'
                      : 'Arbeidsområdet opprettes når produsenten skriver leveransearbeidsområdet fra eksport.'}
                  </Typography>
                  {deliveryWorkspaceAssets.workspaceFiles.length > 0 ? (
                    <Stack spacing={0.35} sx={{ mt: 0.85 }}>
                      {deliveryWorkspaceAssets.workspaceFiles.slice(0, 3).map((file) => (
                        <Typography key={file.id} sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.8rem' }}>
                          {`${getProjectFileMetadataString(file, 'folderPath') || 'Mappe ikke satt'} · ${getProjectFileMetadataString(file, 'deliveryTitle', 'workspaceType') || file.name}`}
                        </Typography>
                      ))}
                    </Stack>
                  ) : null}
                </Box>
              </Box>

                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(2,6,23,0.42)',
                  mb: 1.25,
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      Juridiske dokumenter
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.84rem', mt: 0.35 }}>
                      NDA-er, samarbeidsavtaler og øvrige juridiske dokumenter følger samme leveringsflate som resten av prosjektet.
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={`${deliveryWorkspaceAssets.legalAgreements.length} avtaler`}
                    sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#e9d5ff' }}
                  />
                </Stack>
                {deliveryWorkspaceAssets.legalAgreements.length > 0 ? (
                  <Stack spacing={0.8}>
                    {deliveryWorkspaceAssets.legalAgreements.slice(0, 4).map((agreement) => {
                      const signatureTone = getAgreementSignatureTone(agreement.google_signature);
                      const signatureProgress = getAgreementSignatureProgress(agreement);
                      const clientFacingSummary = getAgreementClientFacingStatusSummary(agreement);
                      const signedPdfArtifact = deliveryWorkspaceAssets.googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.signedPdfArtifactId);
                      const pdfSnapshotArtifact = deliveryWorkspaceAssets.googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.pdfSnapshotArtifactId);
                      const auditArtifact = deliveryWorkspaceAssets.googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.auditArtifactId);
                      const primaryUrl = signedPdfArtifact?.webViewUrl
                        ?? pdfSnapshotArtifact?.webViewUrl
                        ?? agreement.google_signature?.requestUrl
                        ?? agreement.google_signature?.webViewUrl
                        ?? '';

                      return (
                        <Box
                          key={agreement.id}
                          sx={{
                            p: 0.95,
                            borderRadius: 1.25,
                            border: '1px solid rgba(148,163,184,0.14)',
                            background: 'rgba(15,23,42,0.52)',
                          }}
                        >
                          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                                <Chip
                                  size="small"
                                  label={PROJECT_AGREEMENT_STATUS_LABELS[agreement.status]}
                                  sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                                />
                                <Chip
                                  size="small"
                                  label={`Juridisk signatur · ${getAgreementSignatureLabel(agreement.google_signature)}`}
                                  sx={{ bgcolor: signatureTone.background, color: signatureTone.color }}
                                />
                              </Stack>
                              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                                {agreement.title}
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.82rem', mt: 0.25 }}>
                                {`${agreement.counterparty_name}${agreement.counterparty_company_name ? ` · ${agreement.counterparty_company_name}` : ''}`}
                              </Typography>
                              <Typography sx={{ color: signatureTone.color, fontSize: '0.8rem', mt: 0.55 }}>
                                {clientFacingSummary}
                              </Typography>
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                                  gap: 0.45,
                                  mt: 0.8,
                                  maxWidth: 440,
                                }}
                              >
                                {signatureProgress.steps.map((step) => (
                                  <Box
                                    key={step.key}
                                    sx={{
                                      px: 0.55,
                                      py: 0.45,
                                      borderRadius: 1,
                                      border: step.state === 'current'
                                        ? '1px solid rgba(250,204,21,0.36)'
                                        : '1px solid rgba(148,163,184,0.16)',
                                      bgcolor: step.state === 'complete'
                                        ? 'rgba(16,185,129,0.14)'
                                        : step.state === 'current'
                                          ? 'rgba(250,204,21,0.12)'
                                          : 'rgba(15,23,42,0.46)',
                                    }}
                                  >
                                    <Typography
                                      sx={{
                                        color: step.state === 'complete'
                                          ? '#86efac'
                                          : step.state === 'current'
                                            ? '#fde68a'
                                            : 'rgba(148,163,184,0.84)',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                      }}
                                    >
                                      {step.label}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                              {signatureProgress.issueLabel ? (
                                <Chip
                                  size="small"
                                  label={signatureProgress.issueLabel}
                                  sx={{
                                    mt: 0.75,
                                    bgcolor: signatureProgress.issueTone?.background ?? 'rgba(148,163,184,0.16)',
                                    color: signatureProgress.issueTone?.color ?? '#cbd5e1',
                                  }}
                                />
                              ) : null}
                            </Box>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => openSurfaceWorkspace('delivery', { artifactId: `agreement:${agreement.id}` })}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                {isClientReviewerMode ? 'Åpne avtalen' : 'Åpne i workspace'}
                              </Button>
                              {primaryUrl ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  component="a"
                                  href={primaryUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  {agreement.google_signature?.status === 'signed' ? 'Åpne signert avtale' : 'Åpne dokument'}
                                </Button>
                              ) : null}
                              {auditArtifact?.webViewUrl ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  component="a"
                                  href={auditArtifact.webViewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Signaturspor
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.88rem' }}>
                    Ingen juridiske dokumenter er koblet til leveringsflaten ennå.
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                  gap: 0.95,
                }}
              >
                <Box
                  sx={{
                    p: 0.95,
                    borderRadius: 2,
                    border: '1px solid rgba(96,165,250,0.14)',
                    bgcolor: 'rgba(2,6,23,0.38)',
                  }}
                >
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.18, fontSize: '0.98rem' }}>
                    Definer struktur
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.76rem', lineHeight: 1.5, mb: 0.85 }}>
                    Fyll inn reglene som styrer navn, versjoner og mapper.
                  </Typography>
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Skriv mønsteret alle filer skal følge.',
                        hasText(planningDraft.deliveryWorkflow.fileNamingConvention) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Filnavnregel"
                        value={planningDraft.deliveryWorkflow.fileNamingConvention ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          deliveryWorkflow: {
                            ...previous.deliveryWorkflow,
                            presetId: undefined,
                            fileNamingConvention: event.target.value,
                          },
                        }))}
                        fullWidth
                        disabled={!canEditClientInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv hvordan versjoner skal navngis og gå fra intern til klientklar.',
                        hasText(planningDraft.deliveryWorkflow.versioningRule) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Versjoneringsregel"
                        value={planningDraft.deliveryWorkflow.versioningRule ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          deliveryWorkflow: {
                            ...previous.deliveryWorkflow,
                            presetId: undefined,
                            versioningRule: event.target.value,
                          },
                        }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv hvordan mapper skal bygges opp i leveranseflyten.',
                        hasText(planningDraft.deliveryWorkflow.folderStructure) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Mappestruktur"
                        value={planningDraft.deliveryWorkflow.folderStructure ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          deliveryWorkflow: {
                            ...previous.deliveryWorkflow,
                            presetId: undefined,
                            folderStructure: event.target.value,
                          },
                        }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    p: 1.05,
                    borderRadius: 2,
                    border: '1px solid rgba(96,165,250,0.14)',
                    bgcolor: 'rgba(2,6,23,0.38)',
                  }}
                >
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.18, fontSize: '0.98rem' }}>
                    Avklar rutiner
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.76rem', lineHeight: 1.5, mb: 0.85 }}>
                    Fyll inn reglene som styrer draft, backup og deling.
                  </Typography>
                  <Stack spacing={1.35}>
                    <Box>
                      {renderFieldLead(
                        'Skriv hva som er intern arbeidsfil og hva som er klientklar leveranse.',
                        hasText(planningDraft.deliveryWorkflow.draftVsFinalRule) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Draft vs final"
                        value={planningDraft.deliveryWorkflow.draftVsFinalRule ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          deliveryWorkflow: {
                            ...previous.deliveryWorkflow,
                            presetId: undefined,
                            draftVsFinalRule: event.target.value,
                          },
                        }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv hvor backup ligger og når den tas.',
                        hasText(planningDraft.deliveryWorkflow.backupRoutine) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Backuprutine"
                        value={planningDraft.deliveryWorkflow.backupRoutine ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          deliveryWorkflow: {
                            ...previous.deliveryWorkflow,
                            presetId: undefined,
                            backupRoutine: event.target.value,
                          },
                        }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                    <Box>
                      {renderFieldLead(
                        'Skriv hvor ofte og i hvilke steg filer skal deles.',
                        hasText(planningDraft.deliveryWorkflow.deliveryCadence) ? 'filled' : 'missing',
                      )}
                      <TextField
                        label="Leveringsrytme"
                        value={planningDraft.deliveryWorkflow.deliveryCadence ?? ''}
                        onChange={(event) => setPlanningDraft((previous) => ({
                          ...previous,
                          deliveryWorkflow: {
                            ...previous.deliveryWorkflow,
                            presetId: undefined,
                            deliveryCadence: event.target.value,
                          },
                        }))}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={!canEditClientInput}
                      />
                    </Box>
                  </Stack>
                </Box>
              </Box>

              {deliveryWorkflowMissingItems.length === 0 ? (
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={0.55}
                  sx={{
                    px: 0.8,
                    py: 0.68,
                    mt: 0.9,
                    mb: 0.95,
                    borderRadius: 1.5,
                    border: '1px solid rgba(96,165,250,0.08)',
                    bgcolor: 'rgba(15,23,42,0.26)',
                  }}
                >
                  <Typography
                    sx={{
                      color: 'rgba(191,219,254,0.56)',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}
                  >
                    Kort oppsummering
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
                    {deliveryWorkflowSummary}
                  </Typography>
                </Stack>
              ) : null}

              {canEditClientInput ? (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={0.85}
                  sx={{
                    mt: 1.1,
                    pt: 0.95,
                    borderTop: '1px solid rgba(96,165,250,0.12)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(148,163,184,0.76)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                    Lagre når rutinen faktisk kan brukes av teamet i eksport og overlevering.
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={() => {
                      void handleSavePlanningContext();
                    }}
                    disabled={savingPlanning}
                    sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, textTransform: 'none', fontWeight: 700, bgcolor: '#22c55e', color: '#052e16', '&:hover': { bgcolor: '#16a34a' } }}
                  >
                    {savingPlanning ? 'Lagrer leveringsrutine...' : 'Lagre og bruk i levering'}
                  </Button>
                </Stack>
              ) : null}
            </Box>
          ) : null}

          {!showClientWorkspaceEmptyState && activeWorkspace === 'meetings' ? (
            <>
              <ProducerMeetingWorkspace
                project={project}
                projectId={projectId}
                planning={planningDraft}
                intake={intakeDraft}
                reviews={reviews}
                timelineItems={timelineItems}
                googleArtifacts={deliveryWorkspaceAssets.googleArtifacts}
                focusedArtifactId={focusedArtifactId}
                readOnly={readOnly}
                isClientReviewerMode={isClientReviewerMode}
                saving={savingPlanning}
                onPlanningChange={setPlanningDraft}
                onSavePlanning={handleSavePlanningContext}
                onRefreshGoogleAssets={loadDeliveryWorkspaceAssets}
              />
            </>
          ) : null}

          {!showClientWorkspaceEmptyState && activeWorkspace === 'materials' ? (
            <>
              <Box
                sx={{
                  borderRadius: 3,
                  border: '1px solid rgba(96,165,250,0.14)',
                  bgcolor: 'rgba(15,23,42,0.62)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  p: { xs: 1.25, md: 1.5 },
                  '& .MuiInputBase-root': {
                    borderRadius: 2,
                    bgcolor: 'rgba(248,250,252,0.04)',
                    color: '#f8fafc',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(203,213,225,0.62)',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(96,165,250,0.14)',
                  },
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                  <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.05 }}>
                    {materialsMode === 'capture' ? 'Legg inn neste materiale' : 'Gå gjennom materialet'}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem', lineHeight: 1.5, mt: 0.25, maxWidth: 620 }}>
                    {materialsMode === 'capture'
                      ? 'Legg inn ett materiale om gangen og koble det til plan eller levering.'
                      : 'Se hva som er registrert, og rediger bare det som faktisk må endres.'}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ md: 'flex-start' }}>
                    {isMaterialWizardActive ? (
                      <>
                        <Chip
                          size="small"
                          label="Wizard på"
                          sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#bfdbfe', alignSelf: 'flex-start' }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setMaterialsMode('library')}
                          sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                        >
                          Bibliotek
                        </Button>
                        {canEditClientInput ? (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setMaterialWizardEnabled(false)}
                            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                          >
                            Gå fritt
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={materialsMode}
                          onChange={(_, value: MaterialsMode | null) => {
                            if (value) {
                              setMaterialsMode(value);
                            }
                          }}
                          sx={{ alignSelf: { md: 'flex-start' } }}
                        >
                          <ToggleButton value="capture">Legg inn</ToggleButton>
                          <ToggleButton value="library">Bibliotek</ToggleButton>
                        </ToggleButtonGroup>
                        {canEditClientInput && materialsMode === 'capture' ? (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                              setMaterialWizardEnabled(true);
                              setActiveMaterialWizardStep(materialDraft.id ? 'details' : 'source');
                            }}
                            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                          >
                            Start wizard
                          </Button>
                        ) : null}
                      </>
                    )}
                    <Chip
                      size="small"
                      label={materialDraft.id ? 'Redigerer' : `${materials.length} registrert`}
                      sx={{ bgcolor: 'rgba(59,130,246,0.18)', color: '#bfdbfe', alignSelf: 'flex-start' }}
                    />
                  </Stack>
                </Stack>

                <Typography sx={{ color: 'rgba(191,219,254,0.74)', fontSize: '0.76rem', lineHeight: 1.45, mb: 1.05 }}>
                  {workspaceSummaryRows.map((row) => `${row.label}: ${row.value}`).join(' · ')}
                </Typography>

                {clientGroundingRequests.length > 0 ? (
                  <Box
                    sx={{
                      mb: 1.05,
                      px: 0.8,
                      py: clientGroundingRequests.length <= 2 ? 0.58 : 0.72,
                      borderRadius: 1.5,
                      border: '1px solid rgba(96,165,250,0.1)',
                      bgcolor: 'rgba(15,23,42,0.22)',
                    }}
                  >
                    <Typography sx={{ color: 'rgba(191,219,254,0.7)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.35, mb: 0.32 }}>
                      Dette mangler i materialgrunnlaget
                    </Typography>
                    <Stack spacing={0.18}>
                      {clientGroundingRequests.slice(0, 4).map((request) => (
                        <Typography key={request} sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.4 }}>
                          • {request}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={0.55}
                    sx={{
                      px: 0.8,
                      py: 0.68,
                      mb: 1.05,
                      borderRadius: 1.5,
                      border: '1px solid rgba(34,197,94,0.12)',
                      bgcolor: 'rgba(15,23,42,0.22)',
                    }}
                  >
                    <Typography
                      sx={{
                        color: '#86efac',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                      }}
                    >
                      Klart
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
                      Materialgrunnlaget er klart for neste steg.
                    </Typography>
                  </Stack>
                )}

                <Box
                  sx={{
                    p: 0.85,
                    mb: 1.05,
                    borderRadius: 1.8,
                    border: '1px solid rgba(96,165,250,0.14)',
                    bgcolor: 'rgba(15,23,42,0.44)',
                  }}
                >
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: 'rgba(191,219,254,0.62)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {isMaterialWizardActive ? `Steg ${activeMaterialWizardIndex + 1} av ${materialWizardDescriptors.length}` : 'Gjør dette nå'}
                      </Typography>
                      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.15 }}>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
                          {isMaterialWizardActive
                            ? activeMaterialWizardDescriptor.label
                            : materialsMode === 'capture'
                              ? 'Legg inn neste materiale'
                              : 'Gå gjennom registrert materiale'}
                        </Typography>
                        {isMaterialWizardActive ? (
                          <Chip
                            size="small"
                            label={activeMaterialStepStatusLabel}
                            sx={{
                              height: 22,
                              bgcolor: activeMaterialWizardDescriptor.missing.length === 0 ? 'rgba(34,197,94,0.14)' : 'rgba(59,130,246,0.18)',
                              color: activeMaterialWizardDescriptor.missing.length === 0 ? '#86efac' : '#bfdbfe',
                            }}
                          />
                        ) : null}
                      </Stack>
                      <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.18 }}>
                        {isMaterialWizardActive
                          ? activeMaterialWizardDescriptor.description
                          : materialsMode === 'capture'
                            ? 'Velg mal eller fil, fyll inn det viktigste og lagre.'
                            : 'Bruk biblioteket til kontroll og raske endringer.'}
                      </Typography>
                    </Box>
                    {isMaterialWizardActive ? (
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={0.65}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        sx={{
                          minWidth: { lg: 320 },
                          px: 0.8,
                          py: 0.7,
                          borderRadius: 1.5,
                          border: '1px solid rgba(96,165,250,0.08)',
                          bgcolor: 'rgba(15,23,42,0.28)',
                        }}
                      >
                        <Typography sx={{ color: 'rgba(191,219,254,0.56)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          Fremdrift
                        </Typography>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {`${completedMaterialStepCount}/${materialWizardDescriptors.length} klare`}
                        </Typography>
                        <Box
                          sx={{
                            width: { xs: '100%', sm: 108 },
                            height: 5,
                            borderRadius: 999,
                            bgcolor: 'rgba(148,163,184,0.18)',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              width: `${(completedMaterialStepCount / materialWizardDescriptors.length) * 100}%`,
                              height: '100%',
                              borderRadius: 999,
                              bgcolor: '#38bdf8',
                            }}
                          />
                        </Box>
                        <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                          {nextMaterialWizardDescriptor && nextMaterialWizardDescriptor.key !== activeMaterialWizardStep
                            ? `Deretter: ${nextMaterialWizardDescriptor.label}`
                            : activeMaterialWizardDescriptor.missing.length > 0
                              ? `Fyll ut ${activeMaterialWizardDescriptor.label.toLowerCase()} før du går videre.`
                              : 'Materialet er klart for neste steg.'}
                        </Typography>
                      </Stack>
                    ) : null}
                  </Stack>
                </Box>

                {canEditClientInput && materialsMode === 'capture' ? (
                  isMaterialWizardActive && activeMaterialWizardStep === 'source' ? (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                        gap: 0.95,
                        mb: 1.25,
                      }}
                    >
                      <Box
                        sx={{
                          p: 0.95,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.16)',
                          background: 'rgba(2,6,23,0.42)',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.65, fontSize: '0.94rem' }}>
                          {isClientReviewerMode ? 'Start med det du vil sende inn' : 'Start med en ferdig mal'}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.8rem', lineHeight: 1.5, mb: 0.8 }}>
                          {isClientReviewerMode
                            ? 'Velg en mal og fyll inn det viktigste raskt.'
                            : 'Velg en mal og fyll inn vanlige leveranser raskt.'}
                        </Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          {CLIENT_MATERIAL_TEMPLATES.map((template) => (
                            <Button
                              key={template.id}
                              size="small"
                              variant="outlined"
                              onClick={() => applyMaterialTemplate(template)}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              {template.label}
                            </Button>
                          ))}
                        </Stack>
                      </Box>

                      <Box
                        sx={{
                          p: 0.95,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.16)',
                          background: 'rgba(2,6,23,0.42)',
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.3, fontSize: '0.94rem' }}>
                              Last opp fil til prosjektet
                            </Typography>
                            <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                              Last opp filen først, og koble den deretter til materialet.
                            </Typography>
                            {selectedMaterialFile ? (
                              <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.82rem', mt: 0.55 }}>
                                Valgt fil: {selectedMaterialFile.name}
                              </Typography>
                            ) : materialDraft.projectFileId ? (
                              <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.82rem', mt: 0.55 }}>
                                Koblet prosjektfil: {materialDraft.fileName || materialDraft.projectFileId}
                              </Typography>
                            ) : null}
                          </Box>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ md: 'flex-start' }}>
                            <Button
                              variant="outlined"
                              startIcon={<UploadFileIcon />}
                              onClick={handleOpenMaterialFilePicker}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Velg fil
                            </Button>
                            {isMobileWorkspace ? (
                              <Button
                                variant="outlined"
                                startIcon={<PhotoCameraOutlinedIcon />}
                                onClick={handleOpenMaterialCameraPicker}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Kamera
                              </Button>
                            ) : null}
                            <Button
                              variant="contained"
                              startIcon={<CloudUploadIcon />}
                              onClick={() => {
                                void handleUploadMaterialFile();
                              }}
                              disabled={uploadingMaterialFile || !selectedMaterialFile}
                              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
                            >
                              {uploadingMaterialFile ? 'Laster opp...' : 'Last opp til prosjekt'}
                            </Button>
                          </Stack>
                        </Stack>
                        {isMobileWorkspace && (selectedMaterialFile || hasText(materialDraft.projectFileId)) ? (
                          <Box
                            sx={{
                              mt: 0.9,
                              p: 0.9,
                              borderRadius: 1.4,
                              border: '1px solid rgba(96,165,250,0.12)',
                              bgcolor: 'rgba(15,23,42,0.26)',
                            }}
                          >
                            <Stack direction="row" spacing={0.85} alignItems="center">
                              {selectedMaterialPreviewUrl ? (
                                <Box
                                  component="img"
                                  src={selectedMaterialPreviewUrl}
                                  alt={selectedMaterialFile?.name || 'Valgt fil'}
                                  sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 1.2,
                                    objectFit: 'cover',
                                    border: '1px solid rgba(148,163,184,0.18)',
                                  }}
                                />
                              ) : (
                                <Box
                                  sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 1.2,
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: 'rgba(30,41,59,0.82)',
                                    border: '1px solid rgba(148,163,184,0.18)',
                                  }}
                                >
                                  <PermMediaIcon sx={{ color: '#bfdbfe' }} />
                                </Box>
                              )}
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem' }}>
                                  {selectedMaterialFile?.name || materialDraft.fileName || materialDraft.title || 'Fil klar'}
                                </Typography>
                                <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.74rem', mt: 0.18 }}>
                                  {selectedMaterialFile
                                    ? `${selectedMaterialFile.type || 'Fil'} · ${formatFileSize(selectedMaterialFile.size)}`
                                    : 'Prosjektfil er koblet og klar til materialet.'}
                                </Typography>
                              </Box>
                            </Stack>
                          </Box>
                        ) : null}
                      </Box>
                    </Box>
                  ) : !isMaterialWizardActive ? (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                        gap: 0.95,
                        mb: 1.25,
                      }}
                    >
                      <Box
                        sx={{
                          p: 0.95,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.16)',
                          background: 'rgba(2,6,23,0.42)',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.65, fontSize: '0.94rem' }}>
                          {isClientReviewerMode ? 'Start med det du vil sende inn' : 'Start med en ferdig mal'}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.8rem', lineHeight: 1.5, mb: 0.8 }}>
                          {isClientReviewerMode
                            ? 'Velg en mal og fyll inn det viktigste raskt.'
                            : 'Velg en mal og fyll inn vanlige leveranser raskt.'}
                        </Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          {CLIENT_MATERIAL_TEMPLATES.map((template) => (
                            <Button
                              key={template.id}
                              size="small"
                              variant="outlined"
                              onClick={() => applyMaterialTemplate(template)}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              {template.label}
                            </Button>
                          ))}
                        </Stack>
                      </Box>

                      <Box
                        sx={{
                          p: 0.95,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.16)',
                          background: 'rgba(2,6,23,0.42)',
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.3, fontSize: '0.94rem' }}>
                              Last opp fil til prosjektet
                            </Typography>
                            <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                              Last opp filen først, og koble den deretter til materialet.
                            </Typography>
                            {selectedMaterialFile ? (
                              <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.82rem', mt: 0.55 }}>
                                Valgt fil: {selectedMaterialFile.name}
                              </Typography>
                            ) : materialDraft.projectFileId ? (
                              <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.82rem', mt: 0.55 }}>
                                Koblet prosjektfil: {materialDraft.fileName || materialDraft.projectFileId}
                              </Typography>
                            ) : null}
                          </Box>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ md: 'flex-start' }}>
                            <Button
                              variant="outlined"
                              startIcon={<UploadFileIcon />}
                              onClick={handleOpenMaterialFilePicker}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Velg fil
                            </Button>
                            {isMobileWorkspace ? (
                              <Button
                                variant="outlined"
                                startIcon={<PhotoCameraOutlinedIcon />}
                                onClick={handleOpenMaterialCameraPicker}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Kamera
                              </Button>
                            ) : null}
                            <Button
                              variant="contained"
                              startIcon={<CloudUploadIcon />}
                              onClick={() => {
                                void handleUploadMaterialFile();
                              }}
                              disabled={uploadingMaterialFile || !selectedMaterialFile}
                              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
                            >
                              {uploadingMaterialFile ? 'Laster opp...' : 'Last opp til prosjekt'}
                            </Button>
                          </Stack>
                        </Stack>
                        {isMobileWorkspace && (selectedMaterialFile || hasText(materialDraft.projectFileId)) ? (
                          <Box
                            sx={{
                              mt: 0.9,
                              p: 0.9,
                              borderRadius: 1.4,
                              border: '1px solid rgba(96,165,250,0.12)',
                              bgcolor: 'rgba(15,23,42,0.26)',
                            }}
                          >
                            <Stack direction="row" spacing={0.85} alignItems="center">
                              {selectedMaterialPreviewUrl ? (
                                <Box
                                  component="img"
                                  src={selectedMaterialPreviewUrl}
                                  alt={selectedMaterialFile?.name || 'Valgt fil'}
                                  sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 1.2,
                                    objectFit: 'cover',
                                    border: '1px solid rgba(148,163,184,0.18)',
                                  }}
                                />
                              ) : (
                                <Box
                                  sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 1.2,
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: 'rgba(30,41,59,0.82)',
                                    border: '1px solid rgba(148,163,184,0.18)',
                                  }}
                                >
                                  <PermMediaIcon sx={{ color: '#bfdbfe' }} />
                                </Box>
                              )}
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.84rem' }}>
                                  {selectedMaterialFile?.name || materialDraft.fileName || materialDraft.title || 'Fil klar'}
                                </Typography>
                                <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.74rem', mt: 0.18 }}>
                                  {selectedMaterialFile
                                    ? `${selectedMaterialFile.type || 'Fil'} · ${formatFileSize(selectedMaterialFile.size)}`
                                    : 'Prosjektfil er koblet og klar til materialet.'}
                                </Typography>
                              </Box>
                            </Stack>
                          </Box>
                        ) : null}
                      </Box>
                    </Box>
                  ) : null
                ) : null}

                {materialsMode === 'capture' ? (
                  isMaterialWizardActive ? (
                    <>
                      {activeMaterialWizardDescriptor.missing.length > 0 ? (
                        <Box
                          sx={{
                            mb: 1.05,
                            px: 0.8,
                            py: activeMaterialWizardDescriptor.missing.length <= 2 ? 0.58 : 0.72,
                            borderRadius: 1.5,
                            border: '1px solid rgba(96,165,250,0.1)',
                            bgcolor: 'rgba(15,23,42,0.22)',
                          }}
                        >
                          <Typography sx={{ color: 'rgba(191,219,254,0.7)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.35, mb: 0.32 }}>
                            {`Dette mangler i ${activeMaterialWizardDescriptor.label.toLowerCase()}`}
                          </Typography>
                          <Stack spacing={0.18}>
                            {activeMaterialWizardDescriptor.missing.map((item) => (
                              <Typography key={item.id} sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.4 }}>
                                • {item.label}
                              </Typography>
                            ))}
                          </Stack>
                        </Box>
                      ) : null}

                      <Box
                        sx={{
                          p: 0.95,
                          borderRadius: 2,
                          border: '1px solid rgba(148,163,184,0.16)',
                          background: 'rgba(2,6,23,0.42)',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.18, fontSize: '0.94rem' }}>
                          {activeMaterialWizardDescriptor.label}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.76rem', lineHeight: 1.5, mb: 0.85 }}>
                          {activeMaterialWizardDescriptor.description}
                        </Typography>

                        {activeMaterialWizardStep === 'source' ? (
                          <Stack spacing={1}>
                            <TextField
                              select
                              label="Type"
                              value={materialDraft.entryType}
                              onChange={(event) => setMaterialDraft((previous) => ({
                                ...previous,
                                entryType: event.target.value as ProducerClientMaterialType,
                              }))}
                              disabled={!canEditClientInput}
                            >
                              {Object.entries(MATERIAL_TYPE_LABELS).map(([value, label]) => (
                                <MenuItem key={value} value={value}>
                                  {label}
                                </MenuItem>
                                ))}
                              </TextField>
                            <Box>
                              {renderFieldLead(
                                'Gi materialet et tydelig navn som gjør det lett å bruke videre.',
                                hasText(materialDraft.title) ? 'filled' : 'missing',
                              )}
                            <TextField
                              label="Tittel"
                              value={materialDraft.title}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, title: event.target.value }))}
                              disabled={!canEditClientInput}
                            />
                            </Box>
                            <Box>
                              {renderFieldLead(
                                'Legg inn en lenke hvis materialet ligger eksternt.',
                                hasText(materialDraft.externalUrl) ? 'filled' : 'optional',
                              )}
                            <TextField
                              label="Ekstern lenke"
                              value={materialDraft.externalUrl}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, externalUrl: event.target.value }))}
                              disabled={!canEditClientInput}
                              placeholder="https://..."
                            />
                            </Box>
                          </Stack>
                        ) : null}

                        {activeMaterialWizardStep === 'details' ? (
                          <Stack spacing={1}>
                            <TextField
                              select
                              label="Fase"
                              value={materialDraft.phase}
                              onChange={(event) => setMaterialDraft((previous) => ({
                                ...previous,
                                phase: event.target.value as ProducerPlanningPhase | '',
                              }))}
                              disabled={!canEditClientInput}
                            >
                              <MenuItem value="">Ikke knyttet til fase</MenuItem>
                              {Object.entries(PRODUCER_PLANNING_PHASE_LABELS).map(([value, label]) => (
                                <MenuItem key={value} value={value}>
                                  {label}
                                </MenuItem>
                              ))}
                            </TextField>
                            <TextField
                              select
                              label="Status"
                              value={materialDraft.status}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, status: event.target.value }))}
                              disabled={!canEditClientInput}
                            >
                              {Object.entries(MATERIAL_STATUS_LABELS).map(([value, label]) => (
                                <MenuItem key={value} value={value}>
                                  {label}
                                </MenuItem>
                              ))}
                            </TextField>
                            <TextField
                              select
                              label="Prioritet"
                              value={materialDraft.priority}
                              onChange={(event) => setMaterialDraft((previous) => ({
                                ...previous,
                                priority: event.target.value as ClientMaterialDraft['priority'],
                              }))}
                              disabled={!canEditClientInput}
                            >
                              {Object.entries(MATERIAL_PRIORITY_LABELS).map(([value, label]) => (
                                <MenuItem key={value} value={value}>
                                  {label}
                                </MenuItem>
                                ))}
                              </TextField>
                            <Box>
                              {renderFieldLead(
                                'Beskriv hva materialet faktisk er.',
                                hasText(materialDraft.description)
                                  ? 'filled'
                                  : hasText(materialDraft.usageNotes)
                                    ? 'optional'
                                    : 'missing',
                              )}
                            <TextField
                              label="Beskrivelse"
                              value={materialDraft.description}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, description: event.target.value }))}
                              multiline
                              minRows={3}
                              disabled={!canEditClientInput}
                            />
                            </Box>
                            <Box>
                              {renderFieldLead(
                                'Skriv hvordan materialet skal brukes i produksjonen.',
                                hasText(materialDraft.usageNotes)
                                  ? 'filled'
                                  : hasText(materialDraft.description)
                                    ? 'optional'
                                    : 'missing',
                              )}
                            <TextField
                              label="Brukes til"
                              value={materialDraft.usageNotes}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, usageNotes: event.target.value }))}
                              disabled={!canEditClientInput}
                            />
                            </Box>
                          </Stack>
                        ) : null}

                        {activeMaterialWizardStep === 'linking' ? (
                          <Stack spacing={1}>
                            <Box>
                              {renderFieldLead(
                                'Koble materialet til plan eller publisering hvis timing betyr noe.',
                                hasText(materialDraft.linkedCalendarItemId) ? 'filled' : 'optional',
                              )}
                            <TextField
                              select
                              label="Knytt til content-kalender"
                              value={materialDraft.linkedCalendarItemId}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                const linkedCalendarItem = contentCalendarOptions.find((option) => option.id === nextValue);
                                setMaterialDraft((previous) => ({
                                  ...previous,
                                  linkedCalendarItemId: nextValue,
                                  phase: linkedCalendarItem?.phase ?? previous.phase,
                                  linkedShotListId: linkedCalendarItem?.linkedShotListId
                                    ? linkedCalendarItem.linkedShotListId
                                    : previous.linkedShotListId,
                                }));
                              }}
                              disabled={!canEditClientInput}
                            >
                              <MenuItem value="">Ingen kobling</MenuItem>
                              {contentCalendarOptions.map((option) => (
                                <MenuItem key={option.id} value={option.id}>
                                  {option.label}
                                </MenuItem>
                                ))}
                              </TextField>
                            </Box>
                            <Box>
                              {renderFieldLead(
                                'Koble til shotlist hvis materialet styrer opptak eller klipp.',
                                hasText(materialDraft.linkedShotListId) ? 'filled' : 'optional',
                              )}
                            <TextField
                              select
                              label="Knytt til shotlist"
                              value={materialDraft.linkedShotListId}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, linkedShotListId: event.target.value }))}
                              disabled={!canEditClientInput}
                            >
                              <MenuItem value="">Ingen kobling</MenuItem>
                              {shotListOptions.map((option) => (
                                <MenuItem key={option.id} value={option.id}>
                                  {option.label}
                                </MenuItem>
                                ))}
                              </TextField>
                            </Box>
                            <Box>
                              {renderFieldLead(
                                'Legg inn mappe eller pakke hvis materialet skal inn i leveranseflyten.',
                                hasText(materialDraft.folderPath) || hasText(materialDraft.packageName) ? 'filled' : 'optional',
                              )}
                            <TextField
                              label="Filnavn / assetnavn"
                              value={materialDraft.fileName}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, fileName: event.target.value }))}
                              disabled={!canEditClientInput}
                            />
                            <TextField
                              label="Versjon"
                              value={materialDraft.versionLabel}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, versionLabel: event.target.value }))}
                              disabled={!canEditClientInput}
                            />
                            <TextField
                              label="Kilde / avsender"
                              value={materialDraft.sourceLabel}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, sourceLabel: event.target.value }))}
                              disabled={!canEditClientInput}
                            />
                            <TextField
                              label="Mappe i leveranseflyt"
                              value={materialDraft.folderPath}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, folderPath: event.target.value }))}
                              disabled={!canEditClientInput}
                            />
                            <TextField
                              label="Pakke"
                              value={materialDraft.packageName}
                              onChange={(event) => setMaterialDraft((previous) => ({ ...previous, packageName: event.target.value }))}
                              disabled={!canEditClientInput}
                            />
                            </Box>
                          </Stack>
                        ) : null}

                        {activeMaterialWizardStep === 'review' ? (
                          <Stack spacing={0.8}>
                            {materialWizardReviewRows.map((row) => (
                              <Box
                                key={row.label}
                                sx={{
                                  p: 0.8,
                                  borderRadius: 1.6,
                                  border: '1px solid rgba(96,165,250,0.12)',
                                  bgcolor: 'rgba(15,23,42,0.36)',
                                }}
                              >
                                <Typography sx={{ color: 'rgba(191,219,254,0.62)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                  {row.label}
                                </Typography>
                                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.86rem', mt: 0.15 }}>
                                  {row.value}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        ) : null}
                      </Box>

                      {activeMaterialWizardDescriptor.missing.length === 0 ? (
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={0.55}
                          sx={{
                            px: 0.8,
                            py: 0.68,
                            mt: 0.9,
                            mb: 0.95,
                            borderRadius: 1.5,
                            border: '1px solid rgba(96,165,250,0.08)',
                            bgcolor: 'rgba(15,23,42,0.26)',
                          }}
                        >
                          <Typography
                            sx={{
                              color: 'rgba(191,219,254,0.56)',
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              letterSpacing: '0.07em',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.3,
                            }}
                          >
                            Kort oppsummering
                          </Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
                            {activeMaterialStepSummary}
                          </Typography>
                        </Stack>
                      ) : null}

                      {canEditClientInput ? (
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={0.7}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          sx={{ mt: 1.05, pt: 0.78, borderTop: '1px solid rgba(96,165,250,0.12)' }}
                        >
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.65}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                if (activeMaterialWizardIndex === 0) {
                                  setMaterialWizardEnabled(false);
                                  return;
                                }
                                setActiveMaterialWizardStep(previousMaterialWizardDescriptor?.key ?? 'source');
                              }}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              {activeMaterialWizardIndex === 0 ? 'Gå fritt' : 'Tilbake'}
                            </Button>
                            {materialDraft.id ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setMaterialDraft(EMPTY_MATERIAL_DRAFT);
                                  setSelectedMaterialFile(null);
                                  setMaterialsMode('library');
                                  if (materialFileInputRef.current) {
                                    materialFileInputRef.current.value = '';
                                  }
                                }}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Avbryt redigering
                              </Button>
                            ) : null}
                          </Stack>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.65} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                            <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                              {activeMaterialWizardStep === 'review'
                                ? 'Kontroller koblinger og metadata før du lagrer.'
                                : nextMaterialWizardDescriptor
                                  ? `Neste: ${nextMaterialWizardDescriptor.label}`
                                  : 'Fortsett ett steg om gangen.'}
                            </Typography>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={activeMaterialWizardStep === 'review' ? <UploadFileIcon /> : undefined}
                              onClick={() => {
                                if (activeMaterialWizardStep === 'review') {
                                  void handleSubmitMaterial();
                                  return;
                                }
                                if (nextMaterialWizardDescriptor) {
                                  setActiveMaterialWizardStep(nextMaterialWizardDescriptor.key);
                                }
                              }}
                              disabled={activeMaterialWizardStep === 'source' ? !canAdvanceMaterialWizard : savingMaterial}
                              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#fbbf24', color: '#111827', '&:hover': { bgcolor: '#f59e0b' } }}
                            >
                              {activeMaterialWizardStep === 'review'
                                ? (savingMaterial ? 'Lagrer materiale...' : materialDraft.id ? 'Oppdater materiale' : 'Lagre materiale')
                                : nextMaterialWizardDescriptor
                                  ? `Fortsett til ${nextMaterialWizardDescriptor.label}`
                                  : 'Fortsett'}
                            </Button>
                          </Stack>
                        </Stack>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Box
                        sx={{
                          p: 0.95,
                          borderRadius: 2,
                          border: '1px solid rgba(148,163,184,0.16)',
                          background: 'rgba(2,6,23,0.42)',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.18, fontSize: '0.94rem' }}>
                          Registrer materiale
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.64)', fontSize: '0.76rem', lineHeight: 1.5, mb: 0.85 }}>
                          Fyll inn det som trengs for å bruke materialet videre.
                        </Typography>

                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                            gap: 0.95,
                          }}
                        >
                          <Box
                            sx={{
                              p: 0.95,
                              borderRadius: 1.6,
                              border: '1px solid rgba(96,165,250,0.12)',
                              bgcolor: 'rgba(15,23,42,0.36)',
                            }}
                          >
                            <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.65, fontSize: '0.98rem' }}>
                              Innhold og status
                            </Typography>
                            <Stack spacing={1}>
                              <TextField
                                select
                                label="Type"
                                value={materialDraft.entryType}
                                onChange={(event) => setMaterialDraft((previous) => ({
                                  ...previous,
                                  entryType: event.target.value as ProducerClientMaterialType,
                                }))}
                                disabled={!canEditClientInput}
                              >
                                {Object.entries(MATERIAL_TYPE_LABELS).map(([value, label]) => (
                                  <MenuItem key={value} value={value}>
                                    {label}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                label="Tittel"
                                value={materialDraft.title}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, title: event.target.value }))}
                                disabled={!canEditClientInput}
                              />
                              <TextField
                                label="Ekstern lenke"
                                value={materialDraft.externalUrl}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, externalUrl: event.target.value }))}
                                disabled={!canEditClientInput}
                                placeholder="https://..."
                              />
                              <TextField
                                select
                                label="Fase"
                                value={materialDraft.phase}
                                onChange={(event) => setMaterialDraft((previous) => ({
                                  ...previous,
                                  phase: event.target.value as ProducerPlanningPhase | '',
                                }))}
                                disabled={!canEditClientInput}
                              >
                                <MenuItem value="">Ikke knyttet til fase</MenuItem>
                                {Object.entries(PRODUCER_PLANNING_PHASE_LABELS).map(([value, label]) => (
                                  <MenuItem key={value} value={value}>
                                    {label}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                select
                                label="Status"
                                value={materialDraft.status}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, status: event.target.value }))}
                                disabled={!canEditClientInput}
                              >
                                {Object.entries(MATERIAL_STATUS_LABELS).map(([value, label]) => (
                                  <MenuItem key={value} value={value}>
                                    {label}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                select
                                label="Prioritet"
                                value={materialDraft.priority}
                                onChange={(event) => setMaterialDraft((previous) => ({
                                  ...previous,
                                  priority: event.target.value as ClientMaterialDraft['priority'],
                                }))}
                                disabled={!canEditClientInput}
                              >
                                {Object.entries(MATERIAL_PRIORITY_LABELS).map(([value, label]) => (
                                  <MenuItem key={value} value={value}>
                                    {label}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                label="Beskrivelse"
                                value={materialDraft.description}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, description: event.target.value }))}
                                multiline
                                minRows={3}
                                disabled={!canEditClientInput}
                              />
                            </Stack>
                          </Box>

                          <Box
                            sx={{
                              p: 0.95,
                              borderRadius: 1.6,
                              border: '1px solid rgba(96,165,250,0.12)',
                              bgcolor: 'rgba(15,23,42,0.36)',
                            }}
                          >
                            <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.65, fontSize: '0.98rem' }}>
                              Koblinger og levering
                            </Typography>
                            <Stack spacing={1}>
                              <TextField
                                select
                                label="Knytt til content-kalender"
                                value={materialDraft.linkedCalendarItemId}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  const linkedCalendarItem = contentCalendarOptions.find((option) => option.id === nextValue);
                                  setMaterialDraft((previous) => ({
                                    ...previous,
                                    linkedCalendarItemId: nextValue,
                                    phase: linkedCalendarItem?.phase ?? previous.phase,
                                    linkedShotListId: linkedCalendarItem?.linkedShotListId
                                      ? linkedCalendarItem.linkedShotListId
                                      : previous.linkedShotListId,
                                  }));
                                }}
                                disabled={!canEditClientInput}
                              >
                                <MenuItem value="">Ingen kobling</MenuItem>
                                {contentCalendarOptions.map((option) => (
                                  <MenuItem key={option.id} value={option.id}>
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                select
                                label="Knytt til shotlist"
                                value={materialDraft.linkedShotListId}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, linkedShotListId: event.target.value }))}
                                disabled={!canEditClientInput}
                              >
                                <MenuItem value="">Ingen kobling</MenuItem>
                                {shotListOptions.map((option) => (
                                  <MenuItem key={option.id} value={option.id}>
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                label="Filnavn / assetnavn"
                                value={materialDraft.fileName}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, fileName: event.target.value }))}
                                disabled={!canEditClientInput}
                              />
                              <TextField
                                label="Versjon"
                                value={materialDraft.versionLabel}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, versionLabel: event.target.value }))}
                                disabled={!canEditClientInput}
                              />
                              <TextField
                                label="Brukes til"
                                value={materialDraft.usageNotes}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, usageNotes: event.target.value }))}
                                disabled={!canEditClientInput}
                              />
                              <TextField
                                label="Kilde / avsender"
                                value={materialDraft.sourceLabel}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, sourceLabel: event.target.value }))}
                                disabled={!canEditClientInput}
                              />
                              <TextField
                                label="Mappe i leveranseflyt"
                                value={materialDraft.folderPath}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, folderPath: event.target.value }))}
                                disabled={!canEditClientInput}
                              />
                              <TextField
                                label="Pakke"
                                value={materialDraft.packageName}
                                onChange={(event) => setMaterialDraft((previous) => ({ ...previous, packageName: event.target.value }))}
                                disabled={!canEditClientInput}
                              />
                            </Stack>
                          </Box>
                        </Box>
                      </Box>

                      {canEditClientInput ? (
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={0.7}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          sx={{ mt: 1.05, pt: 0.78, borderTop: '1px solid rgba(96,165,250,0.12)' }}
                        >
                          <Box>
                            {materialDraft.id ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setMaterialDraft(EMPTY_MATERIAL_DRAFT);
                                  setSelectedMaterialFile(null);
                                  setMaterialsMode('library');
                                  if (materialFileInputRef.current) {
                                    materialFileInputRef.current.value = '';
                                  }
                                }}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Avbryt redigering
                              </Button>
                            ) : null}
                          </Box>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.65} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                            <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                              Lagre når metadata, koblinger og leveranseplassering er klare.
                            </Typography>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<UploadFileIcon />}
                              onClick={() => {
                                void handleSubmitMaterial();
                              }}
                              disabled={savingMaterial}
                              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#fbbf24', color: '#111827', '&:hover': { bgcolor: '#f59e0b' } }}
                            >
                              {savingMaterial ? 'Lagrer materiale...' : materialDraft.id ? 'Oppdater materiale' : 'Legg til materiale'}
                            </Button>
                          </Stack>
                        </Stack>
                      ) : null}
                    </>
                  )
                ) : null}

              {materialsMode === 'library' ? (
                <Box
                  sx={{
                    borderRadius: 2,
                    border: '1px solid rgba(148,163,184,0.18)',
                    bgcolor: 'rgba(15,23,42,0.55)',
                    p: { xs: 1.25, md: 1.5 },
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.94rem' }}>
                        Registrert materiale
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.8rem', mt: 0.2 }}>
                        Se det som allerede er registrert, uten å blande det med nye innsendinger.
                      </Typography>
                  </Box>
                  {canEditClientInput ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setMaterialDraft(EMPTY_MATERIAL_DRAFT);
                          setSelectedMaterialFile(null);
                          if (materialFileInputRef.current) {
                            materialFileInputRef.current.value = '';
                          }
                          setMaterialsMode('capture');
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { md: 'flex-start' } }}
                      >
                        Nytt materiale
                      </Button>
                    ) : null}
                  </Stack>
                <Stack spacing={1}>
                  {materials.length === 0 ? (
                    <Alert severity="info">
                      Ingen klientmaterialer er registrert ennå.
                    </Alert>
                  ) : visibleLibraryMaterials.map((material) => {
                    const metadata = parseMaterialMetadata(material);
                    const detailRows = [
                      metadata.fileName ? `Filnavn: ${metadata.fileName}` : '',
                      metadata.versionLabel ? `Versjon: ${metadata.versionLabel}` : '',
                      metadata.sourceLabel ? `Kilde: ${metadata.sourceLabel}` : '',
                      metadata.usageNotes ? `Brukes til: ${metadata.usageNotes}` : '',
                      metadata.folderPath ? `Mappe: ${metadata.folderPath}` : '',
                      metadata.packageName ? `Pakke: ${metadata.packageName}` : '',
                      metadata.projectFileId ? `Prosjektfil: ${metadata.projectFileId}` : '',
                      metadata.linkedCalendarItemId
                        ? `Kalenderpunkt: ${contentCalendarOptions.find((option) => option.id === metadata.linkedCalendarItemId)?.label ?? metadata.linkedCalendarItemId}`
                        : '',
                    ].filter(hasText);
                    const materialLink = hasText(metadata.projectFileDownloadUrl)
                      ? metadata.projectFileDownloadUrl
                      : material.external_url;

                    const libraryMetaParts = [
                      material.phase ? PRODUCER_PLANNING_PHASE_LABELS[material.phase] : '',
                      MATERIAL_PRIORITY_LABELS[metadata.priority],
                      MATERIAL_STATUS_LABELS[material.status ?? 'provided'] ?? (material.status ?? 'Levert'),
                      metadata.linkedCalendarItemId
                        ? contentCalendarOptions.find((option) => option.id === metadata.linkedCalendarItemId)?.label ?? 'Koblet til kalender'
                        : '',
                    ].filter(hasText);

                    return (
                      <Box
                        key={material.id}
                        sx={{
                          borderRadius: 1.75,
                          border: '1px solid rgba(148,163,184,0.16)',
                          bgcolor: 'rgba(2,6,23,0.45)',
                          p: 1.1,
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.48 }}>
                              <Chip
                                size="small"
                                label={MATERIAL_TYPE_LABELS[material.entry_type] ?? material.entry_type}
                                sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                              />
                            </Stack>
                            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                              {material.title}
                            </Typography>
                            {hasText(material.description) ? (
                              <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.9rem', mt: 0.35 }}>
                                {material.description}
                              </Typography>
                            ) : null}
                            {libraryMetaParts.length > 0 ? (
                              <Typography sx={{ color: 'rgba(191,219,254,0.74)', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.38 }}>
                                {libraryMetaParts.join(' · ')}
                              </Typography>
                            ) : null}
                            {detailRows.length > 0 ? (
                              <Stack spacing={0.24} sx={{ mt: 0.55 }}>
                                {detailRows.map((detail) => (
                                  <Typography key={detail} sx={{ color: 'rgba(191,219,254,0.74)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                                    {detail}
                                  </Typography>
                                ))}
                              </Stack>
                            ) : null}
                            <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.82rem', mt: 0.65 }}>
                              {shotListOptions.find((option) => option.id === material.linked_shot_list_id)?.label ?? 'Ikke koblet til shotlist'}
                              {' · '}
                              {formatTimestamp(material.updated_at ?? material.created_at)}
                              {material.created_by_role ? ` · ${material.created_by_role}` : ''}
                            </Typography>
                          </Box>
                          <Stack
                            direction="row"
                            spacing={0.2}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ alignSelf: { md: 'flex-start' } }}
                          >
                            {hasText(materialLink) ? (
                              <Button
                                variant="text"
                                size="small"
                                href={materialLink}
                                target="_blank"
                                rel="noreferrer"
                                sx={{
                                  minWidth: 0,
                                  px: 0.35,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  color: 'rgba(191,219,254,0.82)',
                                }}
                              >
                                Åpne
                              </Button>
                            ) : null}
                            {canEditClientInput ? (
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => {
                                  openSurfaceWorkspace('materials');
                                  setMaterialsMode('capture');
                                  setSelectedMaterialFile(null);
                                  if (materialFileInputRef.current) {
                                    materialFileInputRef.current.value = '';
                                  }
                                  setMaterialDraft(toMaterialDraft(material));
                                }}
                                sx={{
                                  minWidth: 0,
                                  px: 0.35,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  color: 'rgba(226,232,240,0.84)',
                                }}
                              >
                                Rediger
                              </Button>
                            ) : null}
                            {canEditClientInput ? (
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => {
                                  void handleDeleteMaterial(material.id);
                                }}
                                disabled={deletingMaterialId === material.id}
                                sx={{
                                  minWidth: 0,
                                  px: 0.35,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  color: 'rgba(252,165,165,0.9)',
                                }}
                              >
                                Fjern
                              </Button>
                            ) : null}
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })}
                  {sortedMaterials.length > 4 ? (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setShowAllMaterials((previous) => !previous)}
                      sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start', minHeight: 44 }}
                    >
                      {showAllMaterials ? 'Vis færre' : `Vis alle (${sortedMaterials.length})`}
                    </Button>
                  ) : null}
                </Stack>
                </Box>
                ) : null}
              </Box>
            </>
          ) : null}
        </Box>

        {showWorkspaceSupportColumn ? (
          <Box
            sx={{
              flex: { lg: '0 0 272px' },
              maxWidth: { lg: 272 },
              display: 'flex',
              flexDirection: 'column',
              gap: 0.8,
              minWidth: 0,
              '@media (min-width: 3840px)': {
                flex: '0 0 320px',
                maxWidth: 320,
              },
              '@media (min-width: 5120px)': {
                flex: '0 0 360px',
                maxWidth: 360,
              },
            }}
          >
            <Box
              sx={{
                borderRadius: 3,
                border: `1px solid ${workspaceSupportPriorityTheme.border}`,
                background: workspaceSupportPriorityTheme.panelBackground,
                boxShadow: `0 0 0 1px ${workspaceSupportPriorityTheme.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                p: { xs: 0.95, md: 1 },
                position: { lg: 'sticky' },
                top: { lg: 18 },
              }}
            >
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={0.55} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ color: workspaceSupportPriorityTheme.chipColor, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {workspaceSupportPriorityTheme.label}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.62)', fontSize: '0.7rem', lineHeight: 1.35 }}>
                    {workspaceSupportPanel.chipLabel}
                  </Typography>
                </Stack>

                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.25 }}>
                    {workspaceSupportPanel.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.45, mt: 0.18 }}>
                    {workspaceSupportPanel.intro}
                  </Typography>
                </Box>

                {primaryWorkspaceSupportSection ? (
                  <Box>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.35 }}>
                      {primaryWorkspaceSupportItem?.title ?? primaryWorkspaceSupportSection.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.45, mt: 0.18 }}>
                      {primaryWorkspaceSupportItem?.detail ?? primaryWorkspaceSupportSection.description}
                    </Typography>

                    {primaryWorkspaceSupportAction ? (
                      primaryWorkspaceSupportAction.href ? (
                        <Button
                          fullWidth
                          size="small"
                          variant={primaryWorkspaceSupportAction.variant ?? 'contained'}
                          component="a"
                          href={primaryWorkspaceSupportAction.href}
                          target="_blank"
                          rel="noreferrer"
                          sx={{
                            mt: 0.7,
                            textTransform: 'none',
                            fontWeight: 700,
                            ...(primaryWorkspaceSupportAction.variant === 'contained'
                              ? {
                                bgcolor: workspaceSupportPriorityTheme.actionBackground,
                                color: workspaceSupportPriorityTheme.actionColor,
                                '&:hover': { bgcolor: workspaceSupportPriorityTheme.actionHover },
                              }
                              : {
                                borderColor: workspaceSupportPriorityTheme.border,
                                color: workspaceSupportPriorityTheme.chipColor,
                              }),
                          }}
                        >
                          {primaryWorkspaceSupportAction.label}
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          size="small"
                          variant={primaryWorkspaceSupportAction.variant ?? 'contained'}
                          onClick={primaryWorkspaceSupportAction.onClick}
                          sx={{
                            mt: 0.7,
                            textTransform: 'none',
                            fontWeight: 700,
                            ...(primaryWorkspaceSupportAction.variant === 'contained'
                              ? {
                                bgcolor: workspaceSupportPriorityTheme.actionBackground,
                                color: workspaceSupportPriorityTheme.actionColor,
                                '&:hover': { bgcolor: workspaceSupportPriorityTheme.actionHover },
                              }
                              : {
                                borderColor: workspaceSupportPriorityTheme.border,
                                color: workspaceSupportPriorityTheme.chipColor,
                              }),
                          }}
                        >
                          {primaryWorkspaceSupportAction.label}
                        </Button>
                      )
                    ) : null}
                  </Box>
                ) : null}
              </Stack>
            </Box>
          </Box>
        ) : null}

        {displayWorkspaceNavigation.navigationPinned && displayWorkspaceNavigation.pageTabPlacement === 'right' ? pageNavigationRail : null}
      </Stack>

      <Collapse in={showWorkspaceOperations} unmountOnExit>
        <Stack spacing={1.5}>
          <ProducerGoogleWorkspacePanel
            project={project}
            projectId={projectId}
            projectName={projectName}
            planning={planningDraft}
            intake={intakeDraft}
            materials={materials}
            shotLists={shotLists}
            projectFiles={projectFiles}
            readOnly={readOnly}
            isClientReviewerMode={isClientReviewerMode}
            onOpenWorkspace={openSurfaceWorkspace}
            onGoogleContactImported={handleImportGoogleContact}
          />

          {clientContributionTasks.length > 0 ? (
            <Box
              sx={{
                p: { xs: 1.15, md: 1.35 },
                borderRadius: 3,
                border: '1px solid rgba(96,165,250,0.14)',
                bgcolor: 'rgba(15,23,42,0.62)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} justifyContent="space-between" sx={{ mb: 1.15 }}>
                <Box>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                    Klientoppgaver akkurat nå
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.86rem', mt: 0.35 }}>
                    Disse punktene er beregnet fra brief, content-kalender, merkevareguide og leveringsrutine.
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`${clientContributionTasks.length} åpne innspill`}
                  sx={{ bgcolor: 'rgba(59,130,246,0.18)', color: '#bfdbfe', alignSelf: { lg: 'flex-start' } }}
                />
              </Stack>
              <Stack spacing={0.9}>
                {clientContributionTasks.map((task) => (
                  <Box
                    key={task.id}
                    sx={{
                      p: 1,
                      borderRadius: 1.8,
                      border: '1px solid rgba(96,165,250,0.12)',
                      background: 'rgba(15,23,42,0.52)',
                    }}
                  >
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                          <Chip
                            size="small"
                            label={PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType]}
                            sx={{ bgcolor: 'rgba(248,250,252,0.08)', color: '#e2e8f0' }}
                          />
                          <Chip
                            size="small"
                            label={PRODUCER_PLANNING_PHASE_LABELS[task.phase]}
                            sx={{ bgcolor: 'rgba(248,250,252,0.08)', color: '#e2e8f0' }}
                          />
                          <Chip
                            size="small"
                            label={PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[task.status]}
                            sx={{
                              bgcolor: task.status === 'missing'
                                ? 'rgba(159,67,54,0.28)'
                                : 'rgba(59,130,246,0.18)',
                              color: task.status === 'missing' ? '#f7c7bf' : '#bfdbfe',
                            }}
                          />
                        </Stack>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                          {task.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.84rem', mt: 0.3 }}>
                          {task.detail}
                        </Typography>
                      </Box>
                      {canEditClientInput ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => applyContributionTask(task)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            alignSelf: { lg: 'flex-start' },
                            color: '#e2e8f0',
                            borderColor: 'rgba(96,165,250,0.24)',
                          }}
                        >
                          {task.sourceType === 'framework'
                            ? 'Åpne brief'
                            : task.sourceType === 'brand'
                              ? 'Åpne merkevareguide'
                              : task.sourceType === 'delivery'
                                ? 'Åpne leveringsrutine'
                                : 'Åpne materiale'}
                        </Button>
                      ) : null}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      </Collapse>

      <Menu
        anchorEl={workspaceToolsAnchorEl}
        open={workspaceToolsAnchorEl !== null}
        onClose={handleCloseWorkspaceTools}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              p: 1,
              borderRadius: 2,
              bgcolor: 'rgba(15,23,42,0.98)',
              border: '1px solid rgba(148,163,184,0.18)',
            },
          },
        }}
      >
        <Box onClick={(event) => event.stopPropagation()}>
          <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.85 }}>
            Workspace-oppsett
          </Typography>
          <Stack spacing={1.1}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={workspaceNavigation.sectionTabPlacement}
              onChange={handleSectionPlacementChange}
            >
              <ToggleButton value="top">{PRODUCER_WORKSPACE_TAB_PLACEMENT_LABELS.top}</ToggleButton>
              <ToggleButton value="left">{PRODUCER_WORKSPACE_TAB_PLACEMENT_LABELS.left}</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={workspaceNavigation.pageTabPlacement}
              onChange={handlePagePlacementChange}
            >
              <ToggleButton value="left">{PRODUCER_WORKSPACE_PAGE_PLACEMENT_LABELS.left}</ToggleButton>
              <ToggleButton value="right">{PRODUCER_WORKSPACE_PAGE_PLACEMENT_LABELS.right}</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={activeLayout}
              onChange={handleLayoutChange}
            >
              <ToggleButton value="focus"><SpaceDashboardOutlinedIcon sx={{ mr: 0.5, fontSize: 18 }} />Fokus</ToggleButton>
              <ToggleButton value="split"><VerticalSplitOutlinedIcon sx={{ mr: 0.5, fontSize: 18 }} />Delt</ToggleButton>
              <ToggleButton value="grid"><GridViewOutlinedIcon sx={{ mr: 0.5, fontSize: 18 }} />Grid</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Button
                variant={workspaceNavigation.navigationPinned ? 'contained' : 'outlined'}
                size="small"
                startIcon={workspaceNavigation.navigationPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                onClick={() => {
                  void handleToggleNavigationPinned();
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {workspaceNavigation.navigationPinned ? 'Løsne navigasjon' : 'Fest navigasjon'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddOutlinedIcon />}
                onClick={() => {
                  void handleCreateSection();
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Ny seksjon
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddOutlinedIcon />}
                onClick={() => {
                  void handleCreatePage();
                }}
                disabled={!activeSection}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Ny side
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Menu>

      <Menu
        open={workspaceContextMenu !== null}
        onClose={closeWorkspaceContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={workspaceContextMenu?.anchorPosition}
        slotProps={{
          paper: {
            sx: {
              width: 340,
              p: 1,
              borderRadius: 2,
              bgcolor: 'rgba(15,23,42,0.98)',
              border: '1px solid rgba(148,163,184,0.18)',
            },
          },
        }}
      >
        {workspaceContextMenu ? (
          <Box onClick={(event) => event.stopPropagation()}>
            <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.85 }}>
              {workspaceContextMenu.targetType === 'section' ? 'Rediger seksjon' : 'Rediger side'}
            </Typography>
            <Stack spacing={1}>
              <TextField
                size="small"
                label={workspaceContextMenu.targetType === 'section' ? 'Seksjonsnavn' : 'Sidetittel'}
                value={workspaceContextMenu.renameValue}
                onChange={(event) => setWorkspaceContextMenu((previous) => previous ? { ...previous, renameValue: event.target.value } : previous)}
              />
              {workspaceContextMenu.targetType === 'section' ? (
                <TextField
                  select
                  size="small"
                  label="Layout"
                  value={workspaceContextMenu.layoutValue ?? 'split'}
                  onChange={(event) => setWorkspaceContextMenu((previous) => previous ? {
                    ...previous,
                    layoutValue: event.target.value as ProducerWorkspaceLayout,
                  } : previous)}
                >
                  {Object.entries(PRODUCER_WORKSPACE_LAYOUT_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </TextField>
              ) : (
                <>
                  <TextField
                    select
                    size="small"
                    label="Sideflate"
                    value={workspaceContextMenu.surfaceValue ?? 'brief'}
                    onChange={(event) => setWorkspaceContextMenu((previous) => previous ? {
                      ...previous,
                      surfaceValue: event.target.value as ProducerWorkspaceSurfaceKey,
                    } : previous)}
                  >
                    {Object.entries(PRODUCER_WORKSPACE_SURFACE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={workspaceContextMenu.clientVisibleValue === false ? 'internal' : 'client'}
                    onChange={(_event, value: 'internal' | 'client' | null) => {
                      if (!value) {
                        return;
                      }
                      setWorkspaceContextMenu((previous) => previous ? {
                        ...previous,
                        clientVisibleValue: value === 'client',
                      } : previous);
                    }}
                  >
                    <ToggleButton value="client">Synlig for klient</ToggleButton>
                    <ToggleButton value="internal">Kun internt</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.76rem', lineHeight: 1.5 }}>
                    Dette styrer hvilke rom klientrollen kan åpne i Prosjektrom.
                  </Typography>
                </>
              )}
              <Box>
                <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.78rem', mb: 0.55 }}>
                  Farge
                </Typography>
                <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                  {WORKSPACE_COLOR_OPTIONS.map((color) => (
                    <IconButton
                      key={color}
                      size="small"
                      onClick={() => setWorkspaceContextMenu((previous) => previous ? { ...previous, colorValue: color } : previous)}
                      sx={{
                        border: workspaceContextMenu.colorValue === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.12)',
                        bgcolor: color,
                        width: 26,
                        height: 26,
                        '&:hover': { bgcolor: color },
                      }}
                    />
                  ))}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {workspaceContextMenu.targetType === 'section' ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={workspaceSections.find((section) => section.id === workspaceContextMenu.sectionId)?.pinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                    onClick={() => {
                      void handleToggleSectionPinned(workspaceContextMenu.sectionId);
                    }}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {workspaceSections.find((section) => section.id === workspaceContextMenu.sectionId)?.pinned ? 'Løsne seksjon' : 'Fest seksjon'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddOutlinedIcon />}
                      onClick={() => {
                        void handleCreatePage(workspaceContextMenu.surfaceValue ?? activeWorkspace, workspaceContextMenu.pageId ?? null);
                        closeWorkspaceContextMenu();
                      }}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Ny underside
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={activeSection?.pages.find((page) => page.id === workspaceContextMenu.pageId)?.pinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                      onClick={() => {
                        if (workspaceContextMenu.pageId) {
                          void handleTogglePagePinned(workspaceContextMenu.sectionId, workspaceContextMenu.pageId);
                        }
                      }}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      {activeSection?.pages.find((page) => page.id === workspaceContextMenu.pageId)?.pinned ? 'Løsne side' : 'Fest side'}
                    </Button>
                  </>
                )}
              </Stack>
              <Stack direction="row" spacing={1} justifyContent="space-between">
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      void handleApplyWorkspaceContextMenu();
                    }}
                    disabled={savingPlanning}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Lagre
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={closeWorkspaceContextMenu}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Lukk
                  </Button>
                </Stack>
                {workspaceContextMenu.targetType === 'section' ? (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => {
                      void handleDeleteSection(workspaceContextMenu.sectionId);
                    }}
                    disabled={workspaceSections.length <= 1}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Fjern seksjon
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => {
                      if (workspaceContextMenu.pageId) {
                        void handleDeletePage(workspaceContextMenu.sectionId, workspaceContextMenu.pageId);
                      }
                    }}
                    disabled={(activeSection?.pages.length ?? 0) <= 1}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Fjern side
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        ) : null}
      </Menu>
      <RoleRoomAgentDialog
        open={roleRoomAgentDialogOpen}
        onClose={() => setRoleRoomAgentDialogOpen(false)}
        projectId={projectId}
        projectName={projectName}
        access={roleRoomAgentAccess}
        initialWebsiteUrl={intakeDraft.referenceLinks || undefined}
        initialOrganizationNumber={project.clientOrganizationNumber || undefined}
        initialCompanyName={project.clientCompanyName || undefined}
        initialExtraContext={intakeDraft.additionalNotes || undefined}
        initialResult={roleRoomAgentResult}
        generating={roleRoomAgentGenerating}
        applying={roleRoomAgentApplying}
        error={roleRoomAgentError}
        notice={roleRoomAgentNotice}
        onGenerate={handleGenerateRoleRoomAgent}
        onApply={handleApplyRoleRoomAgent}
        onCreateProject={handleCreateProjectFromRoleRoomAgent}
      />
    </Box>
  );
}

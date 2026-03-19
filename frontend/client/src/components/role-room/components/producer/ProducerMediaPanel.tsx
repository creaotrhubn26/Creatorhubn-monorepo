import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AddOutlined as AddOutlinedIcon,
  ArticleOutlined as ArticleOutlinedIcon,
  DeleteOutline as DeleteOutlineIcon,
  DragIndicator as DragIndicatorIcon,
  EditOutlined as EditOutlinedIcon,
  FactCheckOutlined as FactCheckOutlinedIcon,
  FiberManualRecord as FiberManualRecordIcon,
  GridViewOutlined as GridViewOutlinedIcon,
  OpenInNew as OpenInNewIcon,
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
  ArrowForwardOutlined as ArrowForwardOutlinedIcon,
  AutoAwesomeOutlined as AutoAwesomeOutlinedIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  ProducerBrandGuideColor,
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
  ShotList,
} from '../../models/casting';
import { castingService } from '../../services/castingService';
import { producerWorkflowService } from '../../services/producerWorkflowService';
import { onProducerWorkflowEvent } from '../../services/producerWorkflowEvents';
import { onProjectAgreementEvent } from '../../services/projectAgreementEvents';
import { useProject } from '@/contexts/ProjectContext';
import {
  googleWorkspaceApi,
  projectAgreementsApi,
  type ProjectAgreement,
} from '../../services/castingApiService';
import {
  createProducerWorkspacePage,
  createProducerWorkspaceSection,
  flattenProducerWorkspacePages,
  getDefaultProducerWorkspaceNavigation,
  getProducerClientContributionTasks,
  getProducerStrategySnapshot,
  normalizeProducerProjectPlanning,
  normalizeProducerWorkspaceNavigation,
  PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS,
  PRODUCER_PLANNING_PHASE_LABELS,
  PRODUCER_WORKSPACE_LAYOUT_LABELS,
  PRODUCER_WORKSPACE_PAGE_PLACEMENT_LABELS,
  PRODUCER_WORKSPACE_SURFACE_COLORS,
  PRODUCER_WORKSPACE_SURFACE_LABELS,
  PRODUCER_WORKSPACE_TAB_PLACEMENT_LABELS,
} from '../../utils/producerProjectPlanning';
import {
  getAgreementSignatureLabel,
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
import ProducerGoogleWorkspacePanel from './ProducerGoogleWorkspacePanel';

interface ProducerMediaPanelProps {
  project: CastingProject;
  projectId: string;
  projectName: string;
  mediaCount?: number;
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
  onOpenStoryboard?: () => void;
  onOpenManuscript?: () => void;
  onOpenShotList?: () => void;
  onOpenSceneNotes?: () => void;
  onPrepareStoryboardReview?: () => void;
  onPrepareManuscriptReview?: () => void;
  onPrepareShotListReview?: () => void;
  onProjectUpdated?: (project: CastingProject) => Promise<void> | void;
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
}

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

const MATERIAL_PRIORITY_LABELS: Record<ClientMaterialDraft['priority'], string> = {
  critical: 'Kritisk',
  important: 'Viktig',
  reference: 'Referanse',
};

const MATERIAL_PRIORITY_COLORS: Record<ClientMaterialDraft['priority'], { background: string; color: string }> = {
  critical: { background: 'rgba(248,113,113,0.16)', color: '#fecaca' },
  important: { background: 'rgba(251,191,36,0.14)', color: '#fde68a' },
  reference: { background: 'rgba(148,163,184,0.14)', color: '#cbd5e1' },
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

const getWorkspaceSurfaceIcon = (surface: ProducerWorkspaceSurfaceKey) => {
  if (surface === 'materials') {
    return <PermMediaIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'brand') {
    return <PaletteOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
  }
  if (surface === 'delivery') {
    return <FactCheckOutlinedIcon sx={{ color: PRODUCER_WORKSPACE_SURFACE_COLORS[surface], fontSize: 18 }} />;
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
  if (surface === 'delivery') {
    return isClientReviewerMode
      ? 'Hvordan dere vil motta filer, mapper, versjoner og finaler.'
      : 'Filnavn, versjoner, mapper, final/draft og backup.';
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
        id: globalThis.crypto?.randomUUID?.() ?? `brand-color-${Date.now()}-${index}`,
        label,
        hex,
        usage: usagePart || undefined,
      };
    })
    .filter((entry): entry is ProducerBrandGuideColor => entry !== null)
);

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

const getShotListLabel = (shotList: ShotList): string => (
  shotList.sceneName?.trim() || shotList.sceneId || shotList.id
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

interface DeliveryWorkspaceAssetSummary {
  latestPackage: ProjectFileRecord | null;
  workspaceFiles: ProjectFileRecord[];
  legalAgreements: ProjectAgreement[];
  googleArtifacts: RoleRoomGoogleArtifactRef[];
}

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

const getSurfaceForMaterial = (material: ProducerClientMaterial): ProducerWorkspaceSurfaceKey => (
  material.entry_type === 'brand_asset' ? 'brand' : 'materials'
);

const getSurfaceForProjectFile = (file: ProjectFileRecord): ProducerWorkspaceSurfaceKey => {
  const source = getProjectFileMetadataString(file, 'source');
  const entryType = getProjectFileMetadataString(file, 'entryType');
  if (source === 'role_room_client_material') {
    return entryType === 'brand_asset' ? 'brand' : 'materials';
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
  mediaCount = 0,
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
  onOpenStoryboard,
  onOpenManuscript,
  onOpenShotList,
  onOpenSceneNotes,
  onPrepareStoryboardReview,
  onPrepareManuscriptReview,
  onPrepareShotListReview,
  onProjectUpdated,
}: ProducerMediaPanelProps) {
  const { uploadProjectFile, deleteProjectFile, getProjectFiles } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intakeDraft, setIntakeDraft] = useState<ProducerClientIntake>(EMPTY_INTAKE);
  const [materials, setMaterials] = useState<ProducerClientMaterial[]>([]);
  const [planningDraft, setPlanningDraft] = useState<ProducerProjectPlanning>(() => normalizeProducerProjectPlanning(project));
  const [brandFontsDraft, setBrandFontsDraft] = useState(() => stringifyLineSeparatedValues(normalizeProducerProjectPlanning(project).brandGuide.fonts));
  const [brandColorsDraft, setBrandColorsDraft] = useState(() => stringifyBrandColors(normalizeProducerProjectPlanning(project).brandGuide.colors));
  const [brandDosDraft, setBrandDosDraft] = useState(() => stringifyLineSeparatedValues(normalizeProducerProjectPlanning(project).brandGuide.dos));
  const [brandDontsDraft, setBrandDontsDraft] = useState(() => stringifyLineSeparatedValues(normalizeProducerProjectPlanning(project).brandGuide.donts));
  const [savingIntake, setSavingIntake] = useState(false);
  const [savingPlanning, setSavingPlanning] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [uploadingMaterialFile, setUploadingMaterialFile] = useState(false);
  const [materialDraft, setMaterialDraft] = useState<ClientMaterialDraft>(EMPTY_MATERIAL_DRAFT);
  const [selectedMaterialFile, setSelectedMaterialFile] = useState<File | null>(null);
  const [activeSectionId, setActiveSectionId] = useState(() => normalizeProducerProjectPlanning(project).workspaceNavigation?.activeSectionId ?? getDefaultProducerWorkspaceNavigation().activeSectionId ?? '');
  const [activePageId, setActivePageId] = useState(() => normalizeProducerProjectPlanning(project).workspaceNavigation?.activePageId ?? getDefaultProducerWorkspaceNavigation().activePageId ?? '');
  const [workspaceContextMenu, setWorkspaceContextMenu] = useState<WorkspaceContextMenuState | null>(null);
  const [workspaceToolsAnchorEl, setWorkspaceToolsAnchorEl] = useState<HTMLElement | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [draggedPageRef, setDraggedPageRef] = useState<{ sectionId: string; pageId: string } | null>(null);
  const [deliveryWorkspaceAssets, setDeliveryWorkspaceAssets] = useState<DeliveryWorkspaceAssetSummary>({
    latestPackage: null,
    workspaceFiles: [],
    legalAgreements: [],
    googleArtifacts: [],
  });
  const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);
  const [focusedArtifactId, setFocusedArtifactId] = useState<string | null>(initialArtifactId ?? null);
  const materialFileInputRef = useRef<HTMLInputElement | null>(null);

  const canEditClientInput = canContributeClientInput && !readOnly;
  const workspaceNavigation = useMemo(
    () => normalizeProducerWorkspaceNavigation(planningDraft.workspaceNavigation),
    [planningDraft.workspaceNavigation],
  );
  const workspaceSections = useMemo(
    () => [...workspaceNavigation.sections].sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    [workspaceNavigation.sections],
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
  const activeLayout = activeSection?.layout ?? 'split';
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
  const strategySnapshot = useMemo(
    () => getProducerStrategySnapshot(planningDraft),
    [planningDraft],
  );

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
            materials,
            projectFiles,
            deliveryWorkspaceAssets.legalAgreements,
            deliveryWorkspaceAssets.googleArtifacts,
          )
        : null
    ),
    [deliveryWorkspaceAssets.googleArtifacts, deliveryWorkspaceAssets.legalAgreements, focusedArtifactId, materials, projectFiles],
  );

  useEffect(() => {
    const normalizedPlanning = normalizeProducerProjectPlanning(project);
    setPlanningDraft(normalizedPlanning);
    setBrandFontsDraft(stringifyLineSeparatedValues(normalizedPlanning.brandGuide.fonts));
    setBrandColorsDraft(stringifyBrandColors(normalizedPlanning.brandGuide.colors));
    setBrandDosDraft(stringifyLineSeparatedValues(normalizedPlanning.brandGuide.dos));
    setBrandDontsDraft(stringifyLineSeparatedValues(normalizedPlanning.brandGuide.donts));
    const navigation = normalizeProducerWorkspaceNavigation(normalizedPlanning.workspaceNavigation);
    setActiveSectionId(navigation.activeSectionId ?? navigation.sections[0]?.id ?? '');
    setActivePageId(navigation.activePageId ?? navigation.sections[0]?.pages[0]?.id ?? '');
  }, [project]);

  const loadClientWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextIntake, nextMaterials] = await Promise.all([
        producerWorkflowService.getClientIntake(projectId),
        producerWorkflowService.getClientMaterials(projectId),
      ]);
      setIntakeDraft({
        ...EMPTY_INTAKE,
        ...nextIntake,
      });
      setMaterials(nextMaterials);
      await producerWorkflowService.ensureClientGroundingTimeline(projectId);
      await producerWorkflowService.ensureClientGroundingReviews(projectId);
    } catch (loadError) {
      console.error('[ProducerMediaPanel] Failed to load client workspace', loadError);
      setError('Kunne ikke hente klientbrief og materiale.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadClientWorkspace();
  }, [loadClientWorkspace]);

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

  const loadDeliveryWorkspaceAssets = useCallback(async () => {
    try {
      const [projectFiles, legalAgreements, googleStatus] = await Promise.all([
        getProjectFiles(projectId),
        projectAgreementsApi.getAll(projectId),
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
  }, [getProjectFiles, projectId]);

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
    });
  }, [loadClientWorkspace, loadDeliveryWorkspaceAssets, projectId]);

  useEffect(() => onProjectAgreementEvent((payload) => {
    if (payload.projectId !== projectId) {
      return;
    }
    void loadDeliveryWorkspaceAssets();
  }), [loadDeliveryWorkspaceAssets, projectId]);

  const persistPlanningDraft = useCallback(async (nextPlanning: ProducerProjectPlanning) => {
    const stampedPlanning: ProducerProjectPlanning = {
      ...nextPlanning,
      workspaceNavigation: normalizeProducerWorkspaceNavigation(nextPlanning.workspaceNavigation),
      updatedAt: new Date().toISOString(),
    };
    const nextProject: CastingProject = {
      ...project,
      producerPlanning: stampedPlanning,
      updatedAt: new Date().toISOString(),
    };
    await castingService.saveProject(nextProject);
    await producerWorkflowService.syncPlanningClientReviews(projectId, stampedPlanning);
    await onProjectUpdated?.(nextProject);
    setPlanningDraft(stampedPlanning);
    const navigation = normalizeProducerWorkspaceNavigation(stampedPlanning.workspaceNavigation);
    setActiveSectionId(navigation.activeSectionId ?? navigation.sections[0]?.id ?? '');
    setActivePageId(navigation.activePageId ?? navigation.sections[0]?.pages[0]?.id ?? '');
    setError(null);
  }, [onProjectUpdated, project, projectId]);

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
    setSavingIntake(true);
    setError(null);
    try {
      const saved = await producerWorkflowService.updateClientIntake(projectId, intakeDraft);
      setIntakeDraft({
        ...EMPTY_INTAKE,
        ...saved,
      });
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save client intake', saveError);
      setError('Kunne ikke lagre klientbrief.');
    } finally {
      setSavingIntake(false);
    }
  }, [intakeDraft, projectId]);

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
    setIntakeDraft({
      ...EMPTY_INTAKE,
      ...savedIntake,
    });
  }, [intakeDraft, isClientReviewerMode, onProjectUpdated, project, projectId]);

  const handleSubmitMaterial = useCallback(async () => {
    if (!materialDraft.title.trim()) {
      setError('Materialet må ha en tittel.');
      return;
    }

    setSavingMaterial(true);
    setError(null);
    try {
      const payload = {
        entryType: materialDraft.entryType,
        title: materialDraft.title.trim(),
        description: materialDraft.description.trim() || undefined,
        externalUrl: materialDraft.externalUrl.trim() || undefined,
        phase: materialDraft.phase || undefined,
        linkedShotListId: materialDraft.linkedShotListId || undefined,
        status: materialDraft.status.trim() || 'provided',
        metadata: {
          fileName: materialDraft.fileName.trim() || undefined,
          versionLabel: materialDraft.versionLabel.trim() || undefined,
          usageNotes: materialDraft.usageNotes.trim() || undefined,
          sourceLabel: materialDraft.sourceLabel.trim() || undefined,
          priority: materialDraft.priority,
          linkedCalendarItemId: materialDraft.linkedCalendarItemId || undefined,
          folderPath: materialDraft.folderPath.trim() || undefined,
          packageName: materialDraft.packageName.trim() || undefined,
          projectFileId: materialDraft.projectFileId.trim() || undefined,
          projectFileDownloadUrl: materialDraft.projectFileDownloadUrl.trim() || undefined,
        },
      } as const;

      if (materialDraft.id) {
        const updated = await producerWorkflowService.updateClientMaterial(projectId, materialDraft.id, payload);
        setMaterials((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await producerWorkflowService.createClientMaterial(projectId, payload);
        setMaterials((previous) => [created, ...previous]);
      }

      setMaterialDraft(EMPTY_MATERIAL_DRAFT);
      setSelectedMaterialFile(null);
      if (materialFileInputRef.current) {
        materialFileInputRef.current.value = '';
      }
    } catch (saveError) {
      console.error('[ProducerMediaPanel] Failed to save client material', saveError);
      setError('Kunne ikke lagre klientmateriale.');
    } finally {
      setSavingMaterial(false);
    }
  }, [materialDraft, projectId]);

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
      console.error('[ProducerMediaPanel] Failed to save brand and delivery context', saveError);
      setError('Kunne ikke lagre merkevareguide og leveringsrutine.');
    } finally {
      setSavingPlanning(false);
    }
  }, [brandColorsDraft, brandDontsDraft, brandDosDraft, brandFontsDraft, persistPlanningDraft, planningDraft]);

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

  const materialSummary = useMemo(() => {
    return materials.reduce<Record<string, number>>((summary, item) => {
      const key = item.entry_type;
      summary[key] = (summary[key] ?? 0) + 1;
      return summary;
    }, {});
  }, [materials]);

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

  const helperCopy = isClientReviewerMode
    ? 'Legg inn brief, referanser, merkevarefiler og materiale slik at produsenten kan jobbe ut fra samme grunnlag som kunden.'
    : 'Samler kundens brief, referanser og materiale, og holder leveranser og godkjenninger koblet til samme produksjonsgrunnlag.';
  const panelTitle = isClientReviewerMode ? 'Klientflate' : 'Klientbrief og materiale';
  const panelDescription = isClientReviewerMode
    ? 'Del mål, materiale, merkevaregrunnlag og leveringspreferanser i fire tydelige arbeidsflater. Dette blir produksjonsgrunnlaget videre i prosjektet.'
    : helperCopy;
  const materialChipLabel = isClientReviewerMode ? `Dine innspill ${materials.length}` : `Klientmateriale ${materials.length}`;
  const workspaceSummaryTitle = isClientReviewerMode ? 'Aktiv klientflate' : 'Aktiv arbeidsflate';
  const workflowConnectionsTitle = isClientReviewerMode ? 'Slik brukes dette videre' : 'Produksjonskilder';
  const workflowConnectionsDescription = isClientReviewerMode
    ? 'Når du fyller ut disse arbeidsflatene, bruker produsenten grunnlaget videre i storyboard, manus, shotlist og scene-notater.'
    : 'Åpne storyboard, manus, shotlist og scene-notater fra samme arbeidsflate.';
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

  const planningUpdatedLabel = useMemo(() => {
    if (!planningDraft.updatedAt) {
      return 'Ikke lagret ennå.';
    }
    return formatTimestamp(planningDraft.updatedAt);
  }, [planningDraft.updatedAt]);

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
    setSelectedMaterialFile(null);
    if (materialFileInputRef.current) {
      materialFileInputRef.current.value = '';
    }
    setMaterialDraft({
      ...EMPTY_MATERIAL_DRAFT,
      ...template.draft,
    });
  }, [openSurfaceWorkspace]);

  const handleMaterialFileSelected = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedMaterialFile(nextFile);
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

  const handleUploadMaterialFile = useCallback(async () => {
    if (!selectedMaterialFile) {
      setError('Velg en fil før du laster opp til prosjektet.');
      return;
    }

    setUploadingMaterialFile(true);
    setError(null);
    try {
      const normalizedPhase = materialDraft.phase || 'general';
      const folderPath = `client-materials/${normalizedPhase}/${materialDraft.entryType}`;
      const packageName = `${projectName.trim() || 'prosjekt'}-client-materials`;
      const uploadedFile = await uploadProjectFile(projectId, selectedMaterialFile, {
        source: 'role_room_client_material',
        entryType: materialDraft.entryType,
        phase: materialDraft.phase || undefined,
        linkedShotListId: materialDraft.linkedShotListId || undefined,
        linkedCalendarItemId: materialDraft.linkedCalendarItemId || undefined,
        folderPath,
        packageName,
        versionLabel: materialDraft.versionLabel.trim() || 'v1',
        sourceLabel: materialDraft.sourceLabel.trim() || (isClientReviewerMode ? 'Klient' : 'Produsent'),
        usageNotes: materialDraft.usageNotes.trim() || undefined,
        priority: materialDraft.priority,
      });

      const downloadUrl = readFirstNonEmptyString(
        (uploadedFile as Record<string, unknown>).downloadUrl,
      );
      const projectFileId = readFirstNonEmptyString(
        (uploadedFile as Record<string, unknown>).id,
      );

      setMaterialDraft((previous) => ({
        ...previous,
        title: previous.title.trim().length > 0
          ? previous.title
          : selectedMaterialFile.name.replace(/\.[^.]+$/u, '').trim(),
        externalUrl: downloadUrl || previous.externalUrl,
        fileName: previous.fileName.trim().length > 0 ? previous.fileName : selectedMaterialFile.name,
        versionLabel: previous.versionLabel.trim().length > 0 ? previous.versionLabel : 'v1',
        sourceLabel: previous.sourceLabel.trim().length > 0 ? previous.sourceLabel : (isClientReviewerMode ? 'Klient' : 'Produsent'),
        description: previous.description.trim().length > 0
          ? previous.description
          : `Prosjektfil lastet opp: ${selectedMaterialFile.name}`,
        usageNotes: previous.usageNotes.trim().length > 0 ? previous.usageNotes : 'Brukes som prosjektfil i klientgrunnlaget.',
        status: previous.status.trim().length > 0 ? previous.status : 'provided',
        folderPath,
        packageName,
        projectFileId,
        projectFileDownloadUrl: downloadUrl,
      }));
      void loadDeliveryWorkspaceAssets();
      setError(null);
    } catch (uploadError) {
      console.error('[ProducerMediaPanel] Failed to upload client material file', uploadError);
      setError('Kunne ikke laste opp filen til prosjektet.');
    } finally {
      setUploadingMaterialFile(false);
    }
  }, [isClientReviewerMode, loadDeliveryWorkspaceAssets, materialDraft.entryType, materialDraft.linkedCalendarItemId, materialDraft.linkedShotListId, materialDraft.phase, materialDraft.priority, materialDraft.sourceLabel, materialDraft.usageNotes, materialDraft.versionLabel, projectId, projectName, selectedMaterialFile, uploadProjectFile]);

  const applyContributionTask = useCallback((task: ReturnType<typeof getProducerClientContributionTasks>[number]) => {
    if (task.sourceType === 'framework') {
      openSurfaceWorkspace('brief');
      return;
    }
    if (task.sourceType === 'brand') {
      openSurfaceWorkspace('brand');
      return;
    }
    if (task.sourceType === 'delivery') {
      openSurfaceWorkspace('delivery');
      return;
    }

    openSurfaceWorkspace('materials');
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
  }, [openSurfaceWorkspace]);

  const buildPageTree = useCallback((
    section: ProducerWorkspaceSection,
    parentPageId: string | null = null,
  ): ProducerWorkspacePage[] => {
    return sortPagesByParent(section.pages, parentPageId);
  }, []);

  const pinnedWorkspaceLinks = useMemo(() => {
    return workspaceSections.flatMap((section) => flattenProducerWorkspacePages(section)
      .filter((page) => section.pinned || page.pinned)
      .map((page) => ({
        sectionId: section.id,
        page,
        sectionTitle: section.title,
      })));
  }, [workspaceSections]);

  const activeSectionRootPages = useMemo(
    () => (activeSection ? buildPageTree(activeSection, null) : []),
    [activeSection, buildPageTree],
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
  ]), [
    briefReadyCount,
    brandGuideReadyCount,
    deliveryWorkflowReadyCount,
    intakeDraft.projectGoal,
    isClientReviewerMode,
    linkedCalendarMaterialCount,
    materials.length,
    planningDraft.brandGuide.visualStyle,
    planningDraft.deliveryWorkflow.fileNamingConvention,
  ]);

  const activeWorkspaceCard = workspaceCards.find((card) => card.key === activeWorkspace) ?? workspaceCards[0];
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
  const producerMetaLabel = isClientReviewerMode
    ? 'Tolker retning, idé og aktivering'
    : 'Samler brief, plan og leveranser';
  const workspaceFocusLabel = activeSection
    ? `${activeSection.title} · ${activePage?.title ?? PRODUCER_WORKSPACE_SURFACE_LABELS[activeWorkspace]}`
    : PRODUCER_WORKSPACE_SURFACE_LABELS[activeWorkspace];
  const canManageWorkspaceShell = canEditClientInput && !isClientReviewerMode;
  const progressNodes = [
    { label: 'Idé', value: planningDraft.activationPlan.idea },
    { label: 'Retning', value: planningDraft.activationPlan.direction },
    { label: 'Storyboard', value: storyboardCount > 0 ? `${storyboardCount} klare` : '' },
  ];
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
              ? '1px dashed rgba(56,189,248,0.32)'
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
            p: 0.95,
            borderRadius: 1.45,
            border: isActive ? `1px solid ${page.color ?? '#38bdf8'}` : '1px solid rgba(148,163,184,0.14)',
            bgcolor: isActive ? 'rgba(15,23,42,0.9)' : 'rgba(2,6,23,0.42)',
            cursor: 'pointer',
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              {canManageWorkspaceShell ? <DragIndicatorIcon sx={{ color: 'rgba(148,163,184,0.74)', fontSize: 17 }} /> : null}
              {depth > 0 ? <SubdirectoryArrowRightIcon sx={{ color: 'rgba(148,163,184,0.66)', fontSize: 16 }} /> : null}
              {getWorkspaceSurfaceIcon(page.surface)}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }} noWrap>
                  {page.title}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.62)', fontSize: '0.76rem' }} noWrap>
                  {PRODUCER_WORKSPACE_SURFACE_LABELS[page.surface]}
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
        width: { xs: '100%', xl: 300 },
        p: 1,
        borderRadius: 1.7,
        border: '1px solid rgba(148,163,184,0.18)',
        bgcolor: 'rgba(15,23,42,0.55)',
        alignSelf: 'flex-start',
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.82) 100%)',
      }}
    >
      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xl: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: 'rgba(125,211,252,0.92)',
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              mb: 0.55,
            }}
          >
            Creative Sync Workspace
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <PermMediaIcon sx={{ color: '#60a5fa' }} />
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
              {panelTitle}
            </Typography>
          </Stack>
          <Typography sx={{ color: 'rgba(203,213,225,0.88)', maxWidth: 960 }}>
            {panelDescription}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xl: 'flex-end' }}>
          <Chip size="small" label={`Media ${mediaCount}`} />
          <Chip size="small" label={`Storyboards ${storyboardCount}`} />
          <Chip size="small" label={`Shots ${shotCount}`} />
          <Chip size="small" label={materialChipLabel} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
          {canManageWorkspaceShell ? (
            <Tooltip title="Workspace-oppsett">
              <IconButton
                size="small"
                onClick={handleOpenWorkspaceTools}
                sx={{
                  borderRadius: 1.2,
                  border: '1px solid rgba(148,163,184,0.18)',
                  color: '#e2e8f0',
                  bgcolor: 'rgba(15,23,42,0.52)',
                }}
              >
                <MoreHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <Alert severity="info">Laster klientbrief og materiale.</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.15fr) minmax(0, 0.95fr)' },
          gap: 1.25,
        }}
      >
        <Box
          sx={{
            p: { xs: 1.25, md: 1.5 },
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'linear-gradient(145deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.58) 100%)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} justifyContent="space-between">
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
              <Avatar sx={{ width: 52, height: 52, bgcolor: 'rgba(56,189,248,0.18)', color: '#e0f2fe', fontWeight: 800 }}>
                {getInitials(clientDisplayName, 'K')}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: 'rgba(148,163,184,0.74)', fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Klient
                </Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700 }} noWrap>
                  {clientDisplayName}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.84rem' }} noWrap>
                  {clientMetaLabel}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
              <Avatar sx={{ width: 52, height: 52, bgcolor: 'rgba(168,85,247,0.18)', color: '#f3e8ff', fontWeight: 800 }}>
                {getInitials(producerDisplayName, 'P')}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: 'rgba(148,163,184,0.74)', fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {producerDisplayName}
                </Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700 }} noWrap>
                  {projectName}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.84rem' }} noWrap>
                  {producerMetaLabel}
                </Typography>
              </Box>
            </Stack>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.85} sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={workspaceFocusLabel}
              sx={{ bgcolor: `${activeWorkspaceCard.accent}`, color: activeWorkspaceCard.textColor }}
            />
            {pinnedWorkspaceLinks.slice(0, 4).map(({ sectionId, page }) => (
              <Chip
                key={page.id}
                icon={getWorkspaceSurfaceIcon(page.surface)}
                label={page.title}
                onClick={() => selectPage(sectionId, page.id)}
                sx={{
                  bgcolor: page.id === activePage?.id ? 'rgba(59,130,246,0.16)' : 'rgba(148,163,184,0.12)',
                  color: page.id === activePage?.id ? '#bfdbfe' : '#e2e8f0',
                  border: `1px solid ${page.color ?? '#38bdf8'}`,
                }}
              />
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            p: { xs: 1.25, md: 1.5 },
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'linear-gradient(145deg, rgba(30,41,59,0.72) 0%, rgba(15,23,42,0.82) 100%)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.15} justifyContent="space-between" sx={{ mb: 1 }}>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                Retning og progresjon
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.25 }}>
                Idé, retning og storyboard holdes i samme sannhet for klient og produsent.
              </Typography>
            </Box>
            <Chip
              size="small"
              icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
              label={activeWorkspaceCard.progressLabel}
              sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(250,204,21,0.14)', color: '#fde68a' }}
            />
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 0.9,
            }}
          >
            {progressNodes.map((node, index) => (
              <Box
                key={node.label}
                sx={{
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.14)',
                  bgcolor: 'rgba(15,23,42,0.46)',
                }}
              >
                <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {node.label}
                </Typography>
                <Typography sx={{ color: '#fff', fontWeight: 600, mt: 0.35 }}>
                  {hasText(node.value) ? node.value : 'Ikke satt'}
                </Typography>
                {index < progressNodes.length - 1 ? (
                  <ArrowForwardOutlinedIcon sx={{ color: 'rgba(148,163,184,0.54)', fontSize: 16, mt: 0.8 }} />
                ) : null}
              </Box>
            ))}
          </Box>
          {strategySnapshot.length > 0 ? (
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {strategySnapshot.map((item) => (
                <Chip
                  key={item.label}
                  size="small"
                  label={`${item.label}: ${item.value}`}
                  sx={{ bgcolor: 'rgba(248,250,252,0.08)', color: '#e2e8f0' }}
                />
              ))}
            </Stack>
          ) : null}
        </Box>
      </Box>

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

      {focusedArtifact ? (
        <Alert
          severity="info"
          sx={{ mb: 1.25 }}
          action={(
            <Stack direction="row" spacing={0.75}>
              {focusedArtifact.actionUrl ? (
                <Button
                  color="inherit"
                  size="small"
                  component="a"
                  href={focusedArtifact.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<OpenInNewIcon />}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {focusedArtifact.actionLabel ?? 'Åpne'}
                </Button>
              ) : null}
              <Button
                color="inherit"
                size="small"
                onClick={() => setFocusedArtifactId(null)}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Fjern fokus
              </Button>
            </Stack>
          )}
        >
          <Typography sx={{ fontWeight: 700, mb: 0.25 }}>
            Fokusert arbeidsflate: {focusedArtifact.title}
          </Typography>
          <Typography sx={{ fontSize: '0.84rem' }}>
            {focusedArtifact.subtitle}
          </Typography>
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          flexDirection: workspaceNavigation.sectionTabPlacement === 'left' ? 'row' : 'column',
          gap: 1.25,
        }}
      >
        {workspaceNavigation.sectionTabPlacement === 'left' ? (
          <Box
            sx={{
              width: { xs: '100%', lg: 260 },
              display: 'flex',
              flexDirection: 'column',
              gap: 0.85,
            }}
          >
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
                    borderRadius: 1.65,
                    border: isActive ? `1px solid ${section.color ?? '#38bdf8'}` : '1px solid rgba(148,163,184,0.16)',
                    bgcolor: isActive ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.46)',
                    cursor: 'pointer',
                  }}
                  onClick={() => selectSection(section.id)}
                >
                  <Stack direction="row" spacing={0.85} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={0.85} alignItems="center" sx={{ minWidth: 0 }}>
                      {canManageWorkspaceShell ? <DragIndicatorIcon sx={{ color: 'rgba(148,163,184,0.76)', fontSize: 18 }} /> : null}
                      <FiberManualRecordIcon sx={{ color: section.color ?? '#38bdf8', fontSize: 12 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }} noWrap>
                          {section.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
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
                          {section.pinned ? <PushPinIcon sx={{ color: '#f8fafc', fontSize: 18 }} /> : <PushPinOutlinedIcon sx={{ color: 'rgba(148,163,184,0.82)', fontSize: 18 }} />}
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                </Box>
              );
            })}
            {workspaceNavigation.navigationPinned && workspaceNavigation.pageTabPlacement === 'left' && activeSection ? (
              <Box
                sx={{
                  mt: 0.45,
                  pt: 0.9,
                  borderTop: '1px solid rgba(148,163,184,0.14)',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.84rem', mb: 0.25 }}>
                  Sider i {activeSection.title}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.76rem', mb: 0.75 }}>
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
          </Box>
        ) : null}

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.1, minWidth: 0 }}>
          {workspaceNavigation.sectionTabPlacement === 'top' ? (
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
                  label={workspaceNavigation.navigationPinned ? 'Navigasjon festet' : 'Navigasjon flytende'}
                  sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                />
                {!workspaceNavigation.navigationPinned && activeSectionPages.length > 0 ? (
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
                    <Chip
                      size="small"
                      label={card.progressLabel}
                      sx={{ bgcolor: `${page.color ?? '#38bdf8'}22`, color: '#e2e8f0' }}
                    />
                  </Box>
                );
              })}
            </Box>
          ) : null}
        </Box>
      </Box>

      {clientContributionTasks.length > 0 ? (
        <Box
          sx={{
            p: { xs: 1.15, md: 1.35 },
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.18)',
            bgcolor: 'rgba(15,23,42,0.55)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} justifyContent="space-between" sx={{ mb: 1.15 }}>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                Klientoppgaver akkurat nå
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.86rem', mt: 0.35 }}>
                Disse punktene er beregnet fra brief, content-kalender, merkevareguide og leveringsrutine.
              </Typography>
            </Box>
            <Chip
              size="small"
              label={`${clientContributionTasks.length} åpne innspill`}
              sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a', alignSelf: { lg: 'flex-start' } }}
            />
          </Stack>
          <Stack spacing={0.9}>
            {clientContributionTasks.map((task) => (
              <Box
                key={task.id}
                sx={{
                  p: 1,
                  borderRadius: 1.4,
                  border: '1px solid rgba(148,163,184,0.14)',
                  background: 'rgba(2,6,23,0.46)',
                }}
              >
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                      <Chip
                        size="small"
                        label={PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType]}
                        sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                      />
                      <Chip
                        size="small"
                        label={PRODUCER_PLANNING_PHASE_LABELS[task.phase]}
                        sx={{ bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
                      />
                      <Chip
                        size="small"
                        label={PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[task.status]}
                        sx={{
                          bgcolor: task.status === 'missing'
                            ? 'rgba(248,113,113,0.16)'
                            : 'rgba(251,191,36,0.14)',
                          color: task.status === 'missing' ? '#fecaca' : '#fde68a',
                        }}
                      />
                    </Stack>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      {task.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.84rem', mt: 0.3 }}>
                      {task.detail}
                    </Typography>
                  </Box>
                  {canEditClientInput ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => applyContributionTask(task)}
                      sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { lg: 'flex-start' } }}
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

      <Stack
        direction={{ xs: 'column', xl: 'row' }}
        spacing={2}
        alignItems="flex-start"
      >
        {workspaceNavigation.navigationPinned
        && workspaceNavigation.pageTabPlacement === 'left'
        && workspaceNavigation.sectionTabPlacement !== 'left'
          ? pageNavigationRail
          : null}

        <Box
          sx={{
            flex: activeLayout === 'split' ? 1 : 1.25,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          {activeWorkspace === 'brief' ? (
            <Box
              sx={{
                borderRadius: 2,
                border: '1px solid rgba(148,163,184,0.18)',
                bgcolor: 'rgba(15,23,42,0.55)',
                p: { xs: 1.25, md: 1.5 },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Brief
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.88rem', mt: 0.35 }}>
                    {isClientReviewerMode
                      ? 'Beskriv mål, leveranser, målgruppe, budskap og kontaktpunkt slik at produsenten kan planlegge riktig.'
                      : 'Samle mål, målgruppe, budskap, timing og kontaktpunkt i ett tydelig grensesnitt før resten av planen bygges.'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={intakeUpdatedLabel}
                  sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(148,163,184,0.12)', color: '#cbd5e1' }}
                />
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.25,
                }}
              >
                <TextField
                  label="Hva skal prosjektet oppnå?"
                  value={intakeDraft.projectGoal ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, projectGoal: event.target.value }))}
                  fullWidth
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Hva skal leveres?"
                  value={intakeDraft.deliverables ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, deliverables: event.target.value }))}
                  fullWidth
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Målgruppe"
                  value={intakeDraft.targetAudience ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, targetAudience: event.target.value }))}
                  fullWidth
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Kjernebudskap"
                  value={intakeDraft.keyMessage ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, keyMessage: event.target.value }))}
                  fullWidth
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Tidsrammer og avhengigheter"
                  value={intakeDraft.timingConstraints ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, timingConstraints: event.target.value }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Merkevare- og kommunikasjonsnotater"
                  value={intakeDraft.brandNotes ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, brandNotes: event.target.value }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Hva slags materiale finnes allerede?"
                  value={intakeDraft.materialOverview ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, materialOverview: event.target.value }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Referanselenker"
                  value={intakeDraft.referenceLinks ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, referenceLinks: event.target.value }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Kontaktperson"
                  value={intakeDraft.contactName ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, contactName: event.target.value }))}
                  fullWidth
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Kontakt-e-post"
                  value={intakeDraft.contactEmail ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, contactEmail: event.target.value }))}
                  fullWidth
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Kontakttelefon"
                  value={intakeDraft.contactPhone ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, contactPhone: event.target.value }))}
                  fullWidth
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Tilleggsnotater"
                  value={intakeDraft.additionalNotes ?? ''}
                  onChange={(event) => setIntakeDraft((previous) => ({ ...previous, additionalNotes: event.target.value }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
              </Box>

              {canEditClientInput ? (
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.25 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={() => {
                      void handleSaveIntake();
                    }}
                    disabled={savingIntake}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
                  >
                    {savingIntake ? 'Lagrer brief...' : 'Lagre brief'}
                  </Button>
                </Stack>
              ) : null}
            </Box>
          ) : null}

          {activeWorkspace === 'brand' ? (
            <Box
              sx={{
                borderRadius: 2,
                border: '1px solid rgba(148,163,184,0.18)',
                bgcolor: 'rgba(15,23,42,0.55)',
                p: { xs: 1.25, md: 1.5 },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Merkevareguide
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.88rem', mt: 0.35 }}>
                    {isClientReviewerMode
                      ? 'Del logo, farger, fonter, tone of voice, visuell stil og tydelige do’s and don’ts for prosjektet.'
                      : 'Definer logo, farger, fonter, tone of voice, visuell stil og tydelige do’s and don’ts.'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={`Merkevare ${brandGuideReadyCount}/5`}
                    sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff' }}
                  />
                  <Chip
                    size="small"
                    label={planningUpdatedLabel}
                    sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: '#cbd5e1' }}
                  />
                </Stack>
              </Stack>

              {!materials.some((item) => item.entry_type === 'brand_asset') && brandPackTemplate ? (
                <Alert
                  severity="info"
                  sx={{ mb: 1.25 }}
                  action={canEditClientInput ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => applyMaterialTemplate(brandPackTemplate)}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Legg til merkevarefil
                    </Button>
                  ) : undefined}
                >
                  Det ligger ennå ingen merkevarefiler i materialbanken. Legg gjerne inn logo og profilfiler i materialflaten også.
                </Alert>
              ) : null}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.25,
                }}
              >
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
                <TextField
                  label="Fonter (én per linje)"
                  value={brandFontsDraft}
                  onChange={(event) => setBrandFontsDraft(event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Merkevarefarger (Label | #HEX | Bruk)"
                  value={brandColorsDraft}
                  onChange={(event) => setBrandColorsDraft(event.target.value)}
                  helperText="Én farge per linje. Eksempel: Primær | #0F172A | Bakgrunn og overskrifter"
                  fullWidth
                  multiline
                  minRows={4}
                  disabled={!canEditClientInput}
                />
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
                <TextField
                  label="Do's (én per linje)"
                  value={brandDosDraft}
                  onChange={(event) => setBrandDosDraft(event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Don'ts (én per linje)"
                  value={brandDontsDraft}
                  onChange={(event) => setBrandDontsDraft(event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
              </Box>

              {canEditClientInput ? (
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.25 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={() => {
                      void handleSavePlanningContext();
                    }}
                    disabled={savingPlanning}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#a855f7', color: '#f5f3ff', '&:hover': { bgcolor: '#9333ea' } }}
                  >
                    {savingPlanning ? 'Lagrer merkevareguide...' : 'Lagre merkevareguide'}
                  </Button>
                </Stack>
              ) : null}
            </Box>
          ) : null}

          {activeWorkspace === 'delivery' ? (
            <Box
              sx={{
                borderRadius: 2,
                border: '1px solid rgba(148,163,184,0.18)',
                bgcolor: 'rgba(15,23,42,0.55)',
                p: { xs: 1.25, md: 1.5 },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Leveringsrutine
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.88rem', mt: 0.35 }}>
                    {isClientReviewerMode
                      ? 'Avklar hvordan dere vil ha filer navngitt, versjonert, pakket i mapper og skilt mellom draft og final.'
                      : 'Definer hvordan filer skal navngis, versjoneres, mappes, skilles mellom draft/final og sikres i backup.'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={`Levering ${deliveryWorkflowReadyCount}/6`}
                    sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }}
                  />
                  <Chip
                    size="small"
                    label={planningUpdatedLabel}
                    sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: '#cbd5e1' }}
                  />
                  <Chip
                    size="small"
                    label={`${deliveryWorkspaceAssets.workspaceFiles.length} arbeidsfiler`}
                    sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                  />
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.1,
                  mb: 1.25,
                }}
              >
                <Box
                  sx={{
                    p: 1,
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
                    p: 1,
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
                  p: 1,
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
                            </Box>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => openSurfaceWorkspace('delivery', { artifactId: `agreement:${agreement.id}` })}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Åpne i workspace
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
                                  Åpne dokument
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
                  gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.25,
                }}
              >
                <TextField
                  label="Filnavnregel"
                  value={planningDraft.deliveryWorkflow.fileNamingConvention ?? ''}
                  onChange={(event) => setPlanningDraft((previous) => ({
                    ...previous,
                    deliveryWorkflow: {
                      ...previous.deliveryWorkflow,
                      fileNamingConvention: event.target.value,
                    },
                  }))}
                  fullWidth
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Versjoneringsregel"
                  value={planningDraft.deliveryWorkflow.versioningRule ?? ''}
                  onChange={(event) => setPlanningDraft((previous) => ({
                    ...previous,
                    deliveryWorkflow: {
                      ...previous.deliveryWorkflow,
                      versioningRule: event.target.value,
                    },
                  }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Mappestruktur"
                  value={planningDraft.deliveryWorkflow.folderStructure ?? ''}
                  onChange={(event) => setPlanningDraft((previous) => ({
                    ...previous,
                    deliveryWorkflow: {
                      ...previous.deliveryWorkflow,
                      folderStructure: event.target.value,
                    },
                  }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Draft vs final"
                  value={planningDraft.deliveryWorkflow.draftVsFinalRule ?? ''}
                  onChange={(event) => setPlanningDraft((previous) => ({
                    ...previous,
                    deliveryWorkflow: {
                      ...previous.deliveryWorkflow,
                      draftVsFinalRule: event.target.value,
                    },
                  }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Backuprutine"
                  value={planningDraft.deliveryWorkflow.backupRoutine ?? ''}
                  onChange={(event) => setPlanningDraft((previous) => ({
                    ...previous,
                    deliveryWorkflow: {
                      ...previous.deliveryWorkflow,
                      backupRoutine: event.target.value,
                    },
                  }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
                <TextField
                  label="Leveringsrytme"
                  value={planningDraft.deliveryWorkflow.deliveryCadence ?? ''}
                  onChange={(event) => setPlanningDraft((previous) => ({
                    ...previous,
                    deliveryWorkflow: {
                      ...previous.deliveryWorkflow,
                      deliveryCadence: event.target.value,
                    },
                  }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditClientInput}
                />
              </Box>

              {canEditClientInput ? (
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.25 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={() => {
                      void handleSavePlanningContext();
                    }}
                    disabled={savingPlanning}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#22c55e', color: '#052e16', '&:hover': { bgcolor: '#16a34a' } }}
                  >
                    {savingPlanning ? 'Lagrer leveringsrutine...' : 'Lagre leveringsrutine'}
                  </Button>
                </Stack>
              ) : null}
            </Box>
          ) : null}

          {activeWorkspace === 'materials' ? (
            <>
              <Box
                sx={{
                  borderRadius: 2,
                  border: '1px solid rgba(148,163,184,0.18)',
                  bgcolor: 'rgba(15,23,42,0.55)',
                  p: { xs: 1.25, md: 1.5 },
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
                  <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Materiale
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.88rem', mt: 0.35 }}>
                    {isClientReviewerMode
                      ? 'Legg inn referanser, dokumenter, merkevarefiler og eksisterende materiale som produsenten trenger før planlegging og produksjon.'
                      : 'Samle referanser, dokumenter, brand assets og tilbakemeldinger på ett sted, og knytt dem til content-kalender og shotlist.'}
                  </Typography>
                </Box>
                  <Chip
                    size="small"
                    label={materialDraft.id ? 'Redigerer eksisterende innslag' : `Prosjekt: ${projectName}`}
                    sx={{ bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0', alignSelf: 'flex-start' }}
                  />
                </Stack>

                {clientGroundingRequests.length > 0 ? (
                  <Alert severity="info" sx={{ mb: 1.25 }}>
                    <Typography sx={{ fontWeight: 700, mb: 0.45 }}>Dette trenger produsenten fortsatt fra klienten</Typography>
                    <Stack spacing={0.35}>
                      {clientGroundingRequests.map((request) => (
                        <Typography key={request} sx={{ fontSize: '0.85rem' }}>
                          • {request}
                        </Typography>
                      ))}
                    </Stack>
                  </Alert>
                ) : (
                  <Alert severity="success" sx={{ mb: 1.25 }}>
                    Klientgrunnlaget dekker de viktigste behovene for videre planlegging og produksjon.
                  </Alert>
                )}

                {canEditClientInput ? (
                  <Box
                    sx={{
                      mb: 1.25,
                      p: 1,
                      borderRadius: 1.5,
                      border: '1px solid rgba(148,163,184,0.16)',
                      background: 'rgba(2,6,23,0.42)',
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>
                      {isClientReviewerMode ? 'Start med det du vil sende inn' : 'Start med en ferdig mal'}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.84rem', mb: 0.9 }}>
                      {isClientReviewerMode
                        ? 'Velg en mal for å legge inn de vanligste klientleveransene raskt og konsekvent.'
                        : 'Velg en mal for å fylle inn vanlige klientleveranser raskt og konsekvent.'}
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
                ) : null}

                {canEditClientInput ? (
                  <Box
                    sx={{
                      mb: 1.25,
                      p: 1,
                      borderRadius: 1.5,
                      border: '1px solid rgba(148,163,184,0.16)',
                      background: 'rgba(2,6,23,0.42)',
                    }}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} justifyContent="space-between">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.35 }}>
                          Last opp fil til prosjektet
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.84rem' }}>
                          Filer lagres i prosjektet og kobles deretter til materialkortet med mappe, pakke og versjon.
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
                        <input
                          ref={materialFileInputRef}
                          type="file"
                          hidden
                          onChange={handleMaterialFileSelected}
                        />
                        <Button
                          variant="outlined"
                          startIcon={<UploadFileIcon />}
                          onClick={handleOpenMaterialFilePicker}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Velg fil
                        </Button>
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
                  </Box>
                ) : null}

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.25,
                  }}
                >
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
                    sx={{ gridColumn: { xs: '1 / -1', lg: '1 / -1' } }}
                  />
                </Box>

                {canEditClientInput ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mt: 1.25 }}>
                    {materialDraft.id ? (
                      <Button
                        variant="outlined"
                        onClick={() => setMaterialDraft(EMPTY_MATERIAL_DRAFT)}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Avbryt redigering
                      </Button>
                    ) : null}
                    <Button
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
                ) : null}
              </Box>

              <Box
                sx={{
                  borderRadius: 2,
                  border: '1px solid rgba(148,163,184,0.18)',
                  bgcolor: 'rgba(15,23,42,0.55)',
                  p: { xs: 1.25, md: 1.5 },
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                  Registrert materiale
                </Typography>
                <Stack spacing={1}>
                  {materials.length === 0 ? (
                    <Alert severity="info">
                      Ingen klientmaterialer er registrert ennå.
                    </Alert>
                  ) : sortedMaterials.map((material) => {
                    const metadata = parseMaterialMetadata(material);
                    const priorityColors = MATERIAL_PRIORITY_COLORS[metadata.priority];
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

                    return (
                      <Box
                        key={material.id}
                        sx={{
                          borderRadius: 1.75,
                          border: '1px solid rgba(148,163,184,0.16)',
                          bgcolor: 'rgba(2,6,23,0.45)',
                          p: 1.25,
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.65 }}>
                              <Chip
                                size="small"
                                label={MATERIAL_TYPE_LABELS[material.entry_type] ?? material.entry_type}
                                sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                              />
                              {material.phase ? (
                                <Chip
                                  size="small"
                                  label={PRODUCER_PLANNING_PHASE_LABELS[material.phase]}
                                  sx={{ bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
                                />
                              ) : null}
                              {metadata.linkedCalendarItemId ? (
                                <Chip
                                  size="small"
                                  label={contentCalendarOptions.find((option) => option.id === metadata.linkedCalendarItemId)?.label ?? 'Koblet til kalender'}
                                  sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff' }}
                                />
                              ) : null}
                              <Chip
                                size="small"
                                label={MATERIAL_PRIORITY_LABELS[metadata.priority]}
                                sx={{ bgcolor: priorityColors.background, color: priorityColors.color }}
                              />
                              <Chip
                                size="small"
                                label={MATERIAL_STATUS_LABELS[material.status ?? 'provided'] ?? (material.status ?? 'Levert')}
                                sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a' }}
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
                            {detailRows.length > 0 ? (
                              <Stack spacing={0.3} sx={{ mt: 0.65 }}>
                                {detailRows.map((detail) => (
                                  <Typography key={detail} sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.8rem' }}>
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
                          <Stack direction={{ xs: 'row', md: 'column' }} spacing={1}>
                            {hasText(materialLink) ? (
                              <Button
                                variant="outlined"
                                size="small"
                                endIcon={<OpenInNewIcon />}
                                href={materialLink}
                                target="_blank"
                                rel="noreferrer"
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Åpne
                              </Button>
                            ) : null}
                            {canEditClientInput ? (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<EditOutlinedIcon />}
                                onClick={() => {
                                  openSurfaceWorkspace('materials');
                                  setSelectedMaterialFile(null);
                                  if (materialFileInputRef.current) {
                                    materialFileInputRef.current.value = '';
                                  }
                                  setMaterialDraft(toMaterialDraft(material));
                                }}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Rediger
                              </Button>
                            ) : null}
                            {canEditClientInput ? (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<DeleteOutlineIcon />}
                                onClick={() => {
                                  void handleDeleteMaterial(material.id);
                                }}
                                disabled={deletingMaterialId === material.id}
                                sx={{ textTransform: 'none', fontWeight: 700, color: '#fca5a5', borderColor: 'rgba(248,113,113,0.4)' }}
                              >
                                Fjern
                              </Button>
                            ) : null}
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </>
          ) : null}
        </Box>

        <Box
          sx={{
            flex: activeLayout === 'split' ? 1 : 0.82,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              bgcolor: 'rgba(15,23,42,0.55)',
              p: { xs: 1.25, md: 1.5 },
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>
              {workspaceSummaryTitle}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.65 }}>
              {activeWorkspaceCard.icon}
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                {activeWorkspaceCard.title}
              </Typography>
            </Stack>
            <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.9rem', mb: 1 }}>
              {activeWorkspaceCard.subtitle}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.9 }}>
              <Chip size="small" label={activeWorkspaceCard.progressLabel} sx={{ bgcolor: activeWorkspaceCard.accent, color: activeWorkspaceCard.textColor }} />
              <Chip size="small" label={`${clientContributionTasks.length} åpne innspill`} sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a' }} />
            </Stack>
            <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.84rem' }}>
              {activeWorkspaceCard.detail}
            </Typography>
          </Box>

          <Box
            sx={{
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              bgcolor: 'rgba(15,23,42,0.55)',
              p: { xs: 1.25, md: 1.5 },
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.25 }}>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  {workflowConnectionsTitle}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.88rem', mt: 0.35 }}>
                  {workflowConnectionsDescription}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {Object.entries(materialSummary).slice(0, 3).map(([type, count]) => (
                  <Chip
                    key={type}
                    size="small"
                    label={`${MATERIAL_TYPE_LABELS[type as ProducerClientMaterialType] ?? type} ${count}`}
                    sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                  />
                ))}
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" endIcon={<OpenInNewIcon />} onClick={onOpenStoryboard} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {workflowOpenLabels.storyboard}
              </Button>
              <Button variant="outlined" endIcon={<OpenInNewIcon />} onClick={onOpenManuscript} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {workflowOpenLabels.manuscript}
              </Button>
              <Button variant="outlined" endIcon={<OpenInNewIcon />} onClick={onOpenShotList} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {workflowOpenLabels.shotList}
              </Button>
              <Button variant="outlined" endIcon={<OpenInNewIcon />} onClick={onOpenSceneNotes} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {workflowOpenLabels.sceneNotes}
              </Button>
            </Stack>

            {!isClientReviewerMode ? (
              <>
                <Divider sx={{ my: 1.5, borderColor: 'rgba(148,163,184,0.18)' }} />
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>
                  Send videre til godkjenning
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" endIcon={<OpenInNewIcon />} onClick={onPrepareStoryboardReview} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Klargjør storyboard i økonomi
                  </Button>
                  <Button variant="outlined" endIcon={<OpenInNewIcon />} onClick={onPrepareManuscriptReview} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Klargjør manus i økonomi
                  </Button>
                  <Button variant="outlined" endIcon={<OpenInNewIcon />} onClick={onPrepareShotListReview} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Klargjør shotlist i økonomi
                  </Button>
                </Stack>
              </>
            ) : null}
          </Box>
        </Box>

        {workspaceNavigation.navigationPinned && workspaceNavigation.pageTabPlacement === 'right' ? pageNavigationRail : null}
      </Stack>

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
    </Box>
  );
}

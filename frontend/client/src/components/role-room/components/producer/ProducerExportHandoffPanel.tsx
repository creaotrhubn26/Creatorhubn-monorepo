import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import {
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  AutoStories as AutoStoriesIcon,
  CalendarMonth as CalendarMonthIcon,
  ContentCopy as ContentCopyIcon,
  Download as DownloadIcon,
  Launch as LaunchIcon,
  Send as SendIcon,
  TaskAlt as TaskAltIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useProject } from '@/contexts/ProjectContext';
import { describeProducerError } from '../../utils/producerErrorMessage';
import { CollapsibleSection } from '../CollapsibleSection';
import type {
  CastingProject,
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerClientMaterialType,
  ProducerProjectPlanning,
  RoleRoomGoogleArtifactRef,
} from '../../models/casting';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import { useProjectProductionEstimate } from '../../hooks/useProjectProductionEstimate';
import { onProducerWorkflowEvent } from '../../services/producerWorkflowEvents';
import { onProjectAgreementEvent } from '../../services/projectAgreementEvents';
import { producerDeliveryPackageService } from '../../services/producerDeliveryPackageService';
import { producerDeliveryWorkspaceService } from '../../services/producerDeliveryWorkspaceService';
import { producerHandoffPdfExportService } from '../../services/producerHandoffPdfExportService';
import { producerWorkflowService } from '../../services/producerWorkflowService';
import {
  googleWorkspaceApi,
  projectAgreementsApi,
  type ProjectAgreement,
} from '../../services/castingApiService';
import {
  buildClientPortalUrl,
  toClientPortalWorkspace,
  type ClientPortalWorkspaceFocus,
} from '../../utils/clientPortal';
import {
  getAbsoluteProjectFileUrl,
  getProjectFileMetadataString,
  normalizeProjectFileRecord,
  normalizeProjectFileRecords,
} from '../../utils/projectFiles';
import {
  buildProducerDeliveryManifest,
  formatProducerClientContributionTasksAsText,
  getProducerAccountAccessPlatformFromMomentId,
  getProducerClientContributionTasks,
  getProducerClientMomentTextEyebrow,
  getProducerContentLogicMomentKind,
  getProducerWorkspaceLocationForSurface,
  getProducerWorkspaceSurfaceForContributionSource,
  formatProducerDeliveryManifestAsText,
  getProducerStrategySnapshot,
  normalizeProducerProjectPlanning,
  PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS,
  PRODUCER_CONTENT_LOGIC_MOMENT_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS,
  PRODUCER_PLANNING_FRAMEWORK_LABELS,
  PRODUCER_PLANNING_PHASE_LABELS,
} from '../../utils/producerProjectPlanning';
import {
  getAgreementSignatureLabel,
  getAgreementSignatureTone,
  getAgreementWorkspaceArtifactId,
  PROJECT_AGREEMENT_STATUS_LABELS,
} from '../../utils/projectAgreements';

interface ProducerExportHandoffPanelProps {
  project: CastingProject;
  onOpenManuscript?: () => void;
  onOpenShotList?: () => void;
  onOpenMedia?: (focus?: ClientPortalWorkspaceFocus) => void;
  onOpenReviews?: () => void;
  onOpenTimeline?: () => void;
  onSendToClient?: () => void | Promise<void>;
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

const buildMATERIAL_TYPE_LABELS = (t: TFn): Record<ProducerClientMaterialType, string> => ({
  brief_note: t('exportHandoff.s009'),
  asset_link: t('exportHandoff.s080'),
  brand_asset: t('exportHandoff.s105'),
  brand_logo: t('exportHandoff.s103'),
  brand_colors: t('exportHandoff.s101'),
  brand_fonts: t('exportHandoff.s102'),
  reference: t('exportHandoff.s126'),
  document: t('exportHandoff.s019'),
  feedback: t('exportHandoff.s139'),
  other: t('exportHandoff.s006'),
});

const buildMATERIAL_PRIORITY_LABELS = (t: TFn): Record<'critical' | 'important' | 'reference', string> => ({
  critical: t('exportHandoff.s072'),
  important: t('exportHandoff.s144'),
  reference: t('exportHandoff.s126'),
});

const hasText = (value: string | undefined | null): value is string => typeof value === 'string' && value.trim().length > 0;
const CLIENT_PACKAGE_INPUT_LOAD_TIMEOUT_MS = 12_000;

// Trafikklys: ett fargesystem med fast betydning (The Role Room-farger).
// Grønn = ferdig, gul = venter, rød = mangler. Kutter regnbuen så fargen
// alltid betyr det samme — mindre å tolke.
type StatusTone = 'go' | 'wait' | 'stop';
const TONE_COLORS: Record<StatusTone, { fg: string; stripe: string; bg: string }> = {
  go: { fg: '#34d399', stripe: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  wait: { fg: '#fbbf24', stripe: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  stop: { fg: '#f87171', stripe: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
};

// Dempet stil for sekundærhandlinger — de skal være tilgjengelige, men
// aldri konkurrere med hovedhandlingen om oppmerksomheten.
const SECONDARY_ACTION_SX = {
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.8rem',
  color: 'rgba(203,213,225,0.72)',
  minWidth: 0,
  px: 0.9,
  '&:hover': { color: '#e2e8f0', background: 'rgba(148,163,184,0.08)' },
};

function withClientPackageInputTimeout<T>(t: TFn, promise: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(t('exportHandoff.t039', { v0: label })));
      }, CLIENT_PACKAGE_INPUT_LOAD_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

function isRoleRoomSessionFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /session|sesjon|logg inn|x-api-key|unauthorized|forbidden/i.test(message);
}

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

const parseClientMaterialMetadata = (material: ProducerClientMaterial) => {
  const metadata = asRecord(material.metadata);
  const rawPriority = readFirstNonEmptyString(metadata.priority);
  return {
    fileName: readFirstNonEmptyString(metadata.fileName, metadata.filename),
    versionLabel: readFirstNonEmptyString(metadata.versionLabel, metadata.version),
    usageNotes: readFirstNonEmptyString(metadata.usageNotes, metadata.usage),
    sourceLabel: readFirstNonEmptyString(metadata.sourceLabel, metadata.source),
    priority: rawPriority === 'critical' || rawPriority === 'reference' ? rawPriority : 'important',
  } as const;
};

const normalizeFileToken = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'leveranse'
);

const formatDate = (t: TFn, value?: string): string => {
  if (!value) {
    return t('exportHandoff.s036');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium' }).format(parsed);
};

const buildReadinessChecklist = (t: TFn, project: CastingProject) => {
  const planning = normalizeProducerProjectPlanning(project);
  const brandGuide = planning.brandGuide;
  const deliveryWorkflow = planning.deliveryWorkflow;
  const logoTimingDetail = (() => {
    switch (brandGuide.logoTiming ?? 'outro') {
      case 'intro':
        return t('exportHandoff.s094');
      case 'throughout':
        return t('exportHandoff.s093');
      case 'custom':
        return t('exportHandoff.t019', { v0: brandGuide.logoStartSecond ?? 0, v1: brandGuide.logoEndSecond ?? 3 });
      case 'none':
        return t('exportHandoff.s096');
      case 'outro':
      default:
        return t('exportHandoff.s095');
    }
  })();

  const brandItems = [
    { label: 'Logo', ready: hasText(brandGuide.logoUrl), detail: hasText(brandGuide.logoUrl) ? t('exportHandoff.s089') : t('exportHandoff.s092') },
    { label: t('exportHandoff.s090'), ready: hasText(brandGuide.logoUrl) && brandGuide.logoTiming !== 'none', detail: hasText(brandGuide.logoUrl) ? logoTimingDetail : t('exportHandoff.s134') },
    { label: t('exportHandoff.s022'), ready: Boolean(brandGuide.colors?.length), detail: brandGuide.colors?.length ? t('exportHandoff.t035', { v0: brandGuide.colors.length }) : t('exportHandoff.s104') },
    { label: t('exportHandoff.s029'), ready: Boolean(brandGuide.fonts?.filter(hasText).length), detail: brandGuide.fonts?.filter(hasText).length ? t('exportHandoff.t031', { v0: brandGuide.fonts?.filter(hasText).length ?? 0 }) : t('exportHandoff.s030') },
    { label: 'Tone of voice', ready: hasText(brandGuide.toneOfVoice), detail: brandGuide.toneOfVoice || t('exportHandoff.s140') },
    { label: t('exportHandoff.s145'), ready: hasText(brandGuide.visualStyle), detail: brandGuide.visualStyle || t('exportHandoff.s146') },
  ];

  const workflowItems = [
    { label: t('exportHandoff.s026'), ready: hasText(deliveryWorkflow.fileNamingConvention), detail: deliveryWorkflow.fileNamingConvention || t('exportHandoff.s027') },
    { label: t('exportHandoff.s142'), ready: hasText(deliveryWorkflow.versioningRule), detail: deliveryWorkflow.versioningRule || t('exportHandoff.s143') },
    { label: t('exportHandoff.s098'), ready: hasText(deliveryWorkflow.folderStructure), detail: deliveryWorkflow.folderStructure || t('exportHandoff.s099') },
    { label: 'Draft / final', ready: hasText(deliveryWorkflow.draftVsFinalRule), detail: deliveryWorkflow.draftVsFinalRule || t('exportHandoff.s020') },
    { label: 'Backup', ready: hasText(deliveryWorkflow.backupRoutine), detail: deliveryWorkflow.backupRoutine || t('exportHandoff.s007') },
    { label: t('exportHandoff.s086'), ready: hasText(deliveryWorkflow.deliveryCadence), detail: deliveryWorkflow.deliveryCadence || t('exportHandoff.s087') },
  ];

  return {
    brandItems,
    workflowItems,
    brandReadyCount: brandItems.filter((item) => item.ready).length,
    workflowReadyCount: workflowItems.filter((item) => item.ready).length,
  };
};

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

interface UploadedClientPackageSummary {
  id: string;
  name: string;
  uploadedAt: string;
  downloadUrl: string;
  packageName: string;
  folderPath: string;
  versionLabel: string;
}

interface DeliveryWorkspaceFileSummary {
  id: string;
  name: string;
  folderPath: string;
  packageName: string;
  versionLabel: string;
  deliveryTitle: string;
  workspaceType: string;
  downloadUrl: string;
}

interface LegalAgreementSummary {
  agreements: ProjectAgreement[];
  googleArtifacts: RoleRoomGoogleArtifactRef[];
}

const buildClientInputSummaryText = (
  t: TFn,
  planning: ProducerProjectPlanning,
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
  contributionTasks: ReturnType<typeof getProducerClientContributionTasks>,
  pendingClientMoments: ReturnType<typeof buildProducerDeliveryManifest>['pendingClientMoments'],
): string => {
  const MATERIAL_TYPE_LABELS = buildMATERIAL_TYPE_LABELS(t);
  const MATERIAL_PRIORITY_LABELS = buildMATERIAL_PRIORITY_LABELS(t);
  const contentLogic = planning.contentLogic ?? {
    objective: '',
    audience: '',
    hook: '',
    coreMessage: '',
    proofPoints: [],
    callToAction: '',
    distributionPlan: '',
  };
  const summaryLines = [
    '',
    '',
    t('exportHandoff.s048'),
    '------------------------',
    t('exportHandoff.t023', { v0: intake.projectGoal || t('exportHandoff.s036') }),
    t('exportHandoff.t018', { v0: intake.deliverables || t('exportHandoff.s036') }),
    t('exportHandoff.t022', { v0: intake.targetAudience || t('exportHandoff.s036') }),
    t('exportHandoff.t014', { v0: intake.keyMessage || t('exportHandoff.s036') }),
    t('exportHandoff.t029', { v0: intake.timingConstraints || t('exportHandoff.s036') }),
    t('exportHandoff.t011', { v0: intake.brandNotes || t('exportHandoff.s036') }),
    t('exportHandoff.t020', { v0: intake.materialOverview || t('exportHandoff.s036') }),
    t('exportHandoff.t024', { v0: intake.referenceLinks || t('exportHandoff.s036') }),
    t('exportHandoff.t015', { v0: [intake.contactName, intake.contactEmail, intake.contactPhone].filter(hasText).join(' · ') || t('exportHandoff.s036') }),
    t('exportHandoff.t030', { v0: intake.additionalNotes || t('exportHandoff.s036') }),
    '',
    'CONTENT LOGIC',
    '-------------',
    t('exportHandoff.t021', { v0: contentLogic.objective || t('exportHandoff.s036') }),
    t('exportHandoff.t022', { v0: contentLogic.audience || t('exportHandoff.s036') }),
    `Hook: ${contentLogic.hook || t('exportHandoff.s036')}`,
    t('exportHandoff.t014', { v0: contentLogic.coreMessage || t('exportHandoff.s036') }),
    `CTA: ${contentLogic.callToAction || t('exportHandoff.s036')}`,
    t('exportHandoff.t012', { v0: contentLogic.distributionPlan || t('exportHandoff.s036') }),
    t('exportHandoff.t010', { v0: contentLogic.proofPoints?.length ? contentLogic.proofPoints.join(' · ') : t('exportHandoff.s036') }),
    '',
    t('exportHandoff.s153'),
    '-----------------------',
    ...(
      pendingClientMoments.length > 0
        ? pendingClientMoments.map((moment) => (
          `- ${getProducerClientMomentTextEyebrow(moment)} ${moment.title} · ${moment.reviewStatusLabel ?? moment.statusLabel}`
        ))
        : [t('exportHandoff.s003')]
    ),
    '',
    t('exportHandoff.s127'),
  ];

  if (materials.length === 0) {
    summaryLines.push(t('exportHandoff.s002'));
    return [
      summaryLines.join('\n'),
      formatProducerClientContributionTasksAsText(contributionTasks),
    ].join('\n');
  }

  materials.forEach((material) => {
    const metadata = parseClientMaterialMetadata(material);
    summaryLines.push(
      `- ${material.title}`,
      `  Type: ${MATERIAL_TYPE_LABELS[material.entry_type] ?? material.entry_type}`,
      t('exportHandoff.t007', { v0: MATERIAL_PRIORITY_LABELS[metadata.priority] }),
      t('exportHandoff.t003', { v0: material.phase ? material.phase : t('exportHandoff.s036') }),
      `  Status: ${material.status || t('exportHandoff.s088')}`,
      t('exportHandoff.t004', { v0: metadata.fileName || t('exportHandoff.s036') }),
      t('exportHandoff.t008', { v0: metadata.versionLabel || t('exportHandoff.s036') }),
      t('exportHandoff.t005', { v0: metadata.sourceLabel || t('exportHandoff.s036') }),
      t('exportHandoff.t002', { v0: metadata.usageNotes || t('exportHandoff.s036') }),
      t('exportHandoff.t001', { v0: material.description || t('exportHandoff.s036') }),
      t('exportHandoff.t006', { v0: material.external_url || t('exportHandoff.s036') }),
    );
  });

  return [
    summaryLines.join('\n'),
    formatProducerClientContributionTasksAsText(contributionTasks),
  ].join('\n');
};

export default function ProducerExportHandoffPanel({
  project,
  onOpenManuscript,
  onOpenShotList,
  onOpenMedia,
  onOpenReviews,
  onOpenTimeline,
  onSendToClient,
}: ProducerExportHandoffPanelProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const MATERIAL_TYPE_LABELS = useMemo(() => buildMATERIAL_TYPE_LABELS(t), [t]);
  const MATERIAL_PRIORITY_LABELS = useMemo(() => buildMATERIAL_PRIORITY_LABELS(t), [t]);
  const { uploadProjectFile, getProjectFiles, deleteProjectFile, shareProjectFile } = useProject();
  const [clientIntake, setClientIntake] = useState<ProducerClientIntake>(EMPTY_INTAKE);
  const [clientMaterials, setClientMaterials] = useState<ProducerClientMaterial[]>([]);
  const [loadingClientInput, setLoadingClientInput] = useState(false);
  const [clientInputError, setClientInputError] = useState<string | null>(null);
  const [sendingToClient, setSendingToClient] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [uploadingPackage, setUploadingPackage] = useState(false);
  const [writingWorkspace, setWritingWorkspace] = useState(false);
  const [latestPackage, setLatestPackage] = useState<UploadedClientPackageSummary | null>(null);
  const [latestPackageShareUrl, setLatestPackageShareUrl] = useState('');
  const [deliveryWorkspaceFiles, setDeliveryWorkspaceFiles] = useState<DeliveryWorkspaceFileSummary[]>([]);
  const [legalAgreements, setLegalAgreements] = useState<LegalAgreementSummary>({
    agreements: [],
    googleArtifacts: [],
  });
  const clientInputsRequestRef = useRef(0);
  const legalAgreementsRequestRef = useRef(0);
  const latestPackageRequestRef = useRef(0);
  const deliveryWorkspaceFilesRequestRef = useRef(0);
  const {
    items: reviewItems,
    loading: loadingReviews,
    error: reviewsError,
  } = useProducerReviews(project.id);
  const {
    productionEstimate,
    loading,
    error,
  } = useProjectProductionEstimate({
    projectId: project.id,
    initialProject: project,
    initialShotLists: project.shotLists,
    initialProductionDays: project.productionDays,
  });

  const planning = useMemo(
    () => normalizeProducerProjectPlanning(project),
    [project],
  );
  const resolveWorkspaceFocus = useCallback((workspace: ClientPortalWorkspaceFocus['workspace']): ClientPortalWorkspaceFocus => {
    const resolvedWorkspace = workspace ?? 'brief';
    const location = getProducerWorkspaceLocationForSurface(planning.workspaceNavigation, resolvedWorkspace);
    return {
      workspace: resolvedWorkspace,
      sectionId: location?.sectionId,
      pageId: location?.pageId,
    };
  }, [planning.workspaceNavigation]);
  const briefWorkspaceFocus = useMemo(() => resolveWorkspaceFocus('brief'), [resolveWorkspaceFocus]);
  const materialsWorkspaceFocus = useMemo(() => resolveWorkspaceFocus('materials'), [resolveWorkspaceFocus]);
  const brandWorkspaceFocus = useMemo(() => resolveWorkspaceFocus('brand'), [resolveWorkspaceFocus]);
  const accountsWorkspaceFocus = useMemo(() => resolveWorkspaceFocus('accounts'), [resolveWorkspaceFocus]);
  const deliveryWorkspaceFocus = useMemo(() => resolveWorkspaceFocus('delivery'), [resolveWorkspaceFocus]);
  const clientPortalUrl = useMemo(
    () => buildClientPortalUrl(project.id, {
      tab: 'media',
      workspace: deliveryWorkspaceFocus.workspace,
      sectionId: deliveryWorkspaceFocus.sectionId,
      pageId: deliveryWorkspaceFocus.pageId,
    }),
    [deliveryWorkspaceFocus.pageId, deliveryWorkspaceFocus.sectionId, deliveryWorkspaceFocus.workspace, project.id],
  );

  const loadClientPackageInputs = useCallback(async () => {
    const requestId = ++clientInputsRequestRef.current;
    setLoadingClientInput(true);
    setClientInputError(null);
    try {
      const [nextIntake, nextMaterials] = await Promise.allSettled([
        withClientPackageInputTimeout(t, producerWorkflowService.getClientIntake(project.id), t('exportHandoff.s051')),
        withClientPackageInputTimeout(t, producerWorkflowService.getClientMaterials(project.id), t('exportHandoff.s058')),
      ]);
      if (requestId !== clientInputsRequestRef.current) {
        return;
      }
      const failures: unknown[] = [];

      if (nextIntake.status === 'fulfilled') {
        setClientIntake({
          ...EMPTY_INTAKE,
          ...nextIntake.value,
        });
      } else {
        failures.push(nextIntake.reason);
      }

      if (nextMaterials.status === 'fulfilled') {
        setClientMaterials(nextMaterials.value);
      } else {
        failures.push(nextMaterials.reason);
      }

      if (failures.some(isRoleRoomSessionFailure)) {
        setClientInputError(t('exportHandoff.s128'));
      }
    } catch (loadError) {
      if (requestId !== clientInputsRequestRef.current) {
        return;
      }
      if (isRoleRoomSessionFailure(loadError)) {
        setClientInputError(t('exportHandoff.s128'));
      }
    } finally {
      if (requestId === clientInputsRequestRef.current) {
        setLoadingClientInput(false);
      }
    }
  }, [project.id]);

  useEffect(() => {
    void loadClientPackageInputs();
  }, [loadClientPackageInputs]);

  const loadLegalAgreements = useCallback(async () => {
    const requestId = ++legalAgreementsRequestRef.current;
    try {
      const [agreements, googleStatus] = await Promise.all([
        projectAgreementsApi.getAll(project.id),
        googleWorkspaceApi.getStatus(project.id).catch(() => null),
      ]);
      if (requestId !== legalAgreementsRequestRef.current) {
        return;
      }
      setLegalAgreements({
        agreements,
        googleArtifacts: googleStatus?.artifacts ?? [],
      });
    } catch (loadError) {
      if (requestId !== legalAgreementsRequestRef.current) {
        return;
      }
      console.warn('[ProducerExportHandoffPanel] Failed to load legal agreements', loadError);
    }
  }, [project.id]);

  useEffect(() => {
    void loadLegalAgreements();
  }, [loadLegalAgreements]);

  const loadLatestUploadedPackage = useCallback(async () => {
    const requestId = ++latestPackageRequestRef.current;
    try {
      const projectFiles = normalizeProjectFileRecords(await getProjectFiles(project.id));
      const latestUploadedPackage = [...projectFiles]
        .filter((file) => {
          return getProjectFileMetadataString(file, 'source') === 'role_room_client_handoff_package';
        })
        .sort((left, right) => {
          const leftTime = Date.parse(readFirstNonEmptyString(left.uploadedAt));
          const rightTime = Date.parse(readFirstNonEmptyString(right.uploadedAt));
          return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
        })[0];

      if (!latestUploadedPackage) {
        if (requestId !== latestPackageRequestRef.current) {
          return;
        }
        setLatestPackage(null);
        return;
      }

      if (requestId !== latestPackageRequestRef.current) {
        return;
      }
      setLatestPackage({
        id: latestUploadedPackage.id,
        name: latestUploadedPackage.name || latestUploadedPackage.originalName || t('exportHandoff.s059'),
        uploadedAt: latestUploadedPackage.uploadedAt || '',
        downloadUrl: latestUploadedPackage.downloadUrl || '',
        packageName: getProjectFileMetadataString(latestUploadedPackage, 'packageName'),
        folderPath: getProjectFileMetadataString(latestUploadedPackage, 'folderPath'),
        versionLabel: getProjectFileMetadataString(latestUploadedPackage, 'versionLabel'),
      });
    } catch (loadError) {
      if (requestId !== latestPackageRequestRef.current) {
        return;
      }
      console.warn('[ProducerExportHandoffPanel] Failed to load latest uploaded client package', loadError);
    }
  }, [getProjectFiles, project.id]);

  const loadDeliveryWorkspaceFiles = useCallback(async () => {
    const requestId = ++deliveryWorkspaceFilesRequestRef.current;
    try {
      const projectFiles = normalizeProjectFileRecords(await getProjectFiles(project.id));
      const nextFiles = projectFiles
        .filter((file) => getProjectFileMetadataString(file, 'source') === 'role_room_delivery_workspace')
        .sort((left, right) => {
          const leftTime = Date.parse(left.uploadedAt || '');
          const rightTime = Date.parse(right.uploadedAt || '');
          return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
        })
        .map<DeliveryWorkspaceFileSummary>((file) => ({
          id: file.id,
          name: file.name,
          folderPath: getProjectFileMetadataString(file, 'folderPath'),
          packageName: getProjectFileMetadataString(file, 'packageName'),
          versionLabel: getProjectFileMetadataString(file, 'versionLabel'),
          deliveryTitle: getProjectFileMetadataString(file, 'deliveryTitle'),
          workspaceType: getProjectFileMetadataString(file, 'workspaceType'),
          downloadUrl: file.downloadUrl || '',
        }));
      if (requestId !== deliveryWorkspaceFilesRequestRef.current) {
        return;
      }
      setDeliveryWorkspaceFiles(nextFiles);
    } catch (loadError) {
      if (requestId !== deliveryWorkspaceFilesRequestRef.current) {
        return;
      }
      console.warn('[ProducerExportHandoffPanel] Failed to load delivery workspace files', loadError);
    }
  }, [getProjectFiles, project.id]);

  useEffect(() => {
    return onProducerWorkflowEvent((payload) => {
      if (payload.projectId !== project.id || payload.domain !== 'project') {
        return;
      }
      void loadClientPackageInputs();
      void loadLatestUploadedPackage();
      void loadDeliveryWorkspaceFiles();
      void loadLegalAgreements();
    });
  }, [loadClientPackageInputs, loadDeliveryWorkspaceFiles, loadLatestUploadedPackage, loadLegalAgreements, project.id]);

  useEffect(() => onProjectAgreementEvent((payload) => {
    if (payload.projectId !== project.id) {
      return;
    }
    void loadLegalAgreements();
  }), [loadLegalAgreements, project.id]);

  useEffect(() => {
    void loadLatestUploadedPackage();
  }, [loadLatestUploadedPackage]);

  useEffect(() => {
    void loadDeliveryWorkspaceFiles();
  }, [loadDeliveryWorkspaceFiles]);

  useEffect(() => {
    setLatestPackageShareUrl('');
  }, [latestPackage?.id]);

  useEffect(() => () => {
    clientInputsRequestRef.current += 1;
    legalAgreementsRequestRef.current += 1;
    latestPackageRequestRef.current += 1;
    deliveryWorkspaceFilesRequestRef.current += 1;
  }, []);

  const manifest = useMemo(
    () => buildProducerDeliveryManifest(project.name, planning, productionEstimate, reviewItems),
    [planning, productionEstimate, project.name, reviewItems],
  );
  const strategySnapshot = useMemo(
    () => getProducerStrategySnapshot(planning),
    [planning],
  );
  const readiness = useMemo(
    () => buildReadinessChecklist(t, project),
    [project],
  );
  const upcomingDeliveries = useMemo(
    () => [...manifest.deliveryItems].sort((left, right) => {
      const leftTime = left.publishAt ? Date.parse(left.publishAt) : Number.POSITIVE_INFINITY;
      const rightTime = right.publishAt ? Date.parse(right.publishAt) : Number.POSITIVE_INFINITY;
      return leftTime - rightTime;
    }),
    [manifest.deliveryItems],
  );
  const frameworkSections = useMemo(
    () => manifest.frameworkSections.filter((section) => hasText(section.focus) || hasText(section.output) || hasText(section.notes)),
    [manifest.frameworkSections],
  );
  const clientBriefReadyCount = useMemo(
    () => [
      clientIntake.projectGoal,
      clientIntake.deliverables,
      clientIntake.targetAudience,
      clientIntake.keyMessage,
      clientIntake.contactName,
      clientIntake.contactEmail,
    ].filter(hasText).length,
    [clientIntake],
  );
  const clientContributionTasks = useMemo(
    () => getProducerClientContributionTasks(planning, clientIntake, clientMaterials),
    [clientIntake, clientMaterials, planning],
  );
  const openClientContributionTasks = useMemo(
    () => clientContributionTasks.filter((task) => task.status !== 'ready'),
    [clientContributionTasks],
  );
  const getWorkspaceFocusForContributionTask = useCallback((task: (typeof openClientContributionTasks)[number]): ClientPortalWorkspaceFocus => (
    // ProducerWorkspaceSurfaceKey er superset av ClientPortalWorkspace
    // (inkluderer 'marketing-plan'). Map til klient-portal-vokabular via
    // toClientPortalWorkspace (returnerer undefined for ikke-portal-keys).
    resolveWorkspaceFocus(toClientPortalWorkspace(getProducerWorkspaceSurfaceForContributionSource(task.sourceType)))
  ), [resolveWorkspaceFocus]);
  const materialTypeSummary = useMemo(
    () => clientMaterials.reduce<Record<string, number>>((summary, material) => {
      summary[material.entry_type] = (summary[material.entry_type] ?? 0) + 1;
      return summary;
    }, {}),
    [clientMaterials],
  );
  const prioritizedClientMaterials = useMemo(() => {
    const priorityWeight: Record<'critical' | 'important' | 'reference', number> = {
      critical: 0,
      important: 1,
      reference: 2,
    };

    return [...clientMaterials].sort((left, right) => {
      const leftMetadata = parseClientMaterialMetadata(left);
      const rightMetadata = parseClientMaterialMetadata(right);
      const priorityDifference = priorityWeight[leftMetadata.priority] - priorityWeight[rightMetadata.priority];
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const leftTime = Date.parse(left.updated_at ?? left.created_at ?? '');
      const rightTime = Date.parse(right.updated_at ?? right.created_at ?? '');
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });
  }, [clientMaterials]);

  const handleCopyBrief = useCallback(async () => {
    const content = [
      formatProducerDeliveryManifestAsText(manifest),
      buildClientInputSummaryText(
        t,
        planning,
        clientIntake,
        prioritizedClientMaterials,
        clientContributionTasks,
        manifest.pendingClientMoments,
      ),
    ].join('');
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(content);
        enqueueSnackbar(t('exportHandoff.s129'), { variant: 'success' });
        return;
      } catch (clipboardError) {
        console.warn('[ProducerExportHandoffPanel] Clipboard copy failed, falling back to file download', clipboardError);
      }
    }
    downloadTextFile(`${normalizeFileToken(project.name)}-overleveringsbrief.txt`, content);
    enqueueSnackbar(t('exportHandoff.s012'), { variant: 'info' });
  }, [clientContributionTasks, clientIntake, enqueueSnackbar, manifest, planning, prioritizedClientMaterials, project.name]);

  const handleDownloadManifest = useCallback(() => {
    downloadTextFile(
      `${normalizeFileToken(project.name)}-leveringsmanifest.txt`,
      [
        formatProducerDeliveryManifestAsText(manifest),
        formatProducerClientContributionTasksAsText(clientContributionTasks),
      ].join('\n'),
    );
    enqueueSnackbar(t('exportHandoff.s084'), { variant: 'success' });
  }, [clientContributionTasks, enqueueSnackbar, manifest, project.name]);

  const handleDownloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    setClientInputError(null);
    try {
      await producerHandoffPdfExportService.exportReport({
        projectName: project.name,
        planning,
        manifest,
        estimate: productionEstimate,
        clientIntake,
        clientMaterials,
      });
      enqueueSnackbar(t('exportHandoff.s060'), { variant: 'success' });
    } catch (exportError) {
      console.error('[ProducerExportHandoffPanel] Failed to export handoff PDF', exportError);
      setClientInputError(t('exportHandoff.s074'));
    } finally {
      setDownloadingPdf(false);
    }
  }, [clientIntake, clientMaterials, enqueueSnackbar, manifest, planning, productionEstimate, project.name]);

  const handleCopyClientPortalUrl = useCallback(async () => {
    if (!clientPortalUrl) {
      setClientInputError(t('exportHandoff.s073'));
      return;
    }

    try {
      await navigator.clipboard.writeText(clientPortalUrl);
      enqueueSnackbar(t('exportHandoff.s065'), { variant: 'success' });
    } catch (clipboardError) {
      console.error('[ProducerExportHandoffPanel] Failed to copy client portal url', clipboardError);
      setClientInputError(t('exportHandoff.s075'));
    }
  }, [clientPortalUrl, enqueueSnackbar]);

  const handleBuildAndUploadPackage = useCallback(async (): Promise<UploadedClientPackageSummary | null> => {
    setUploadingPackage(true);
    setClientInputError(null);
    try {
      await producerWorkflowService.syncPlanningClientReviews(project.id, planning);

      const manifestText = [
        formatProducerDeliveryManifestAsText(manifest),
        formatProducerClientContributionTasksAsText(clientContributionTasks),
      ].join('\n');
      const clientInputSummaryText = buildClientInputSummaryText(
        t,
        planning,
        clientIntake,
        prioritizedClientMaterials,
        clientContributionTasks,
        manifest.pendingClientMoments,
      );
      const contributionTasksText = formatProducerClientContributionTasksAsText(clientContributionTasks);
      const packageBuild = await producerDeliveryPackageService.buildClientPackage({
        projectId: project.id,
        projectName: project.name,
        planning,
        manifest,
        estimate: productionEstimate,
        clientIntake,
        clientMaterials: prioritizedClientMaterials,
        clientPortalUrl,
        clientInputSummaryText,
        manifestText,
        contributionTasksText,
      });

      const uploadedFile = await uploadProjectFile(project.id, packageBuild.file, {
        source: 'role_room_client_handoff_package',
        packageName: packageBuild.packageName,
        folderPath: packageBuild.folderPath,
        versionLabel: packageBuild.versionLabel,
        generatedAt: packageBuild.generatedAtIso,
        portalUrl: clientPortalUrl,
        deliveryStageLabel: t('exportHandoff.s059'),
      }) as Record<string, unknown>;

      const nextPackage: UploadedClientPackageSummary = {
        id: readFirstNonEmptyString(uploadedFile.id),
        name: readFirstNonEmptyString(uploadedFile.name, uploadedFile.originalName) || `${packageBuild.packageName}.zip`,
        uploadedAt: readFirstNonEmptyString(uploadedFile.uploadedAt) || packageBuild.generatedAtIso,
        downloadUrl: readFirstNonEmptyString(uploadedFile.downloadUrl),
        packageName: packageBuild.packageName,
        folderPath: packageBuild.folderPath,
        versionLabel: packageBuild.versionLabel,
      };
      setLatestPackage(nextPackage);
      enqueueSnackbar(t('exportHandoff.s061'), { variant: 'success' });
      return nextPackage;
    } catch (packageError) {
      console.error('[ProducerExportHandoffPanel] Failed to build and upload client package', packageError);
      setClientInputError(describeProducerError(packageError, t('exportHandoff.s150')));
      return null;
    } finally {
      setUploadingPackage(false);
    }
  }, [
    clientContributionTasks,
    clientIntake,
    clientPortalUrl,
    enqueueSnackbar,
    manifest,
    planning,
    prioritizedClientMaterials,
    productionEstimate,
    project.id,
    project.name,
    uploadProjectFile,
  ]);

  const handleWriteDeliveryWorkspace = useCallback(async (): Promise<DeliveryWorkspaceFileSummary[]> => {
    setWritingWorkspace(true);
    setClientInputError(null);
    try {
      const existingProjectFiles = normalizeProjectFileRecords(await getProjectFiles(project.id));
      const previousWorkspaceFiles = existingProjectFiles.filter((file) => (
        getProjectFileMetadataString(file, 'source') === 'role_room_delivery_workspace'
      ));

      for (const previousFile of previousWorkspaceFiles) {
        await deleteProjectFile(project.id, previousFile.id);
      }

      const workspaceBuild = producerDeliveryWorkspaceService.buildWorkspaceFiles(
        project.id,
        project.name,
        manifest,
        {
          agreements: legalAgreements.agreements,
          googleArtifacts: legalAgreements.googleArtifacts,
        },
      );

      const uploadedWorkspaceFiles: DeliveryWorkspaceFileSummary[] = [];
      for (const workspaceFile of workspaceBuild.files) {
        const uploadedFile = normalizeProjectFileRecord(
          await uploadProjectFile(project.id, workspaceFile.file, workspaceFile.metadata),
        );
        if (!uploadedFile) {
          continue;
        }

        uploadedWorkspaceFiles.push({
          id: uploadedFile.id,
          name: uploadedFile.name,
          folderPath: getProjectFileMetadataString(uploadedFile, 'folderPath'),
          packageName: getProjectFileMetadataString(uploadedFile, 'packageName'),
          versionLabel: getProjectFileMetadataString(uploadedFile, 'versionLabel'),
          deliveryTitle: getProjectFileMetadataString(uploadedFile, 'deliveryTitle'),
          workspaceType: getProjectFileMetadataString(uploadedFile, 'workspaceType'),
          downloadUrl: uploadedFile.downloadUrl || '',
        });
      }

      setDeliveryWorkspaceFiles(uploadedWorkspaceFiles);
      enqueueSnackbar(t('exportHandoff.s024'), { variant: 'success' });
      return uploadedWorkspaceFiles;
    } catch (workspaceError) {
      console.error('[ProducerExportHandoffPanel] Failed to write delivery workspace', workspaceError);
      setClientInputError(describeProducerError(workspaceError, t('exportHandoff.s151')));
      return [];
    } finally {
      setWritingWorkspace(false);
    }
  }, [
    deleteProjectFile,
    enqueueSnackbar,
    getProjectFiles,
    manifest,
    project.id,
    project.name,
    legalAgreements.agreements,
    legalAgreements.googleArtifacts,
    uploadProjectFile,
  ]);

  const handleShareLatestPackage = useCallback(async () => {
    if (!latestPackage) {
      setClientInputError(t('exportHandoff.s064'));
      return;
    }

    try {
      const response = await shareProjectFile(project.id, latestPackage.id, { expiresInHours: 72 });
      const absoluteShareUrl = getAbsoluteProjectFileUrl(readFirstNonEmptyString(response.shareUrl));
      setLatestPackageShareUrl(absoluteShareUrl);

      if (absoluteShareUrl && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteShareUrl);
      }

      enqueueSnackbar(t('exportHandoff.s015'), { variant: 'success' });
    } catch (shareError) {
      console.error('[ProducerExportHandoffPanel] Failed to share latest package', shareError);
      setClientInputError(describeProducerError(shareError, t('exportHandoff.s148')));
    }
  }, [enqueueSnackbar, latestPackage, project.id, shareProjectFile]);

  const handleSendToClient = useCallback(async () => {
    if (!onSendToClient) {
      return;
    }

    setSendingToClient(true);
    setClientInputError(null);
    try {
      const uploadedPackage = await handleBuildAndUploadPackage();
      if (!uploadedPackage) {
        return;
      }
      await handleWriteDeliveryWorkspace();
      await onSendToClient();
      enqueueSnackbar(t('exportHandoff.s063'), { variant: 'success' });
    } catch (sendError) {
      console.error('[ProducerExportHandoffPanel] Failed to prepare client handoff', sendError);
      setClientInputError(describeProducerError(sendError, t('exportHandoff.s147')));
    } finally {
      setSendingToClient(false);
    }
  }, [enqueueSnackbar, handleBuildAndUploadPackage, handleWriteDeliveryWorkspace, onSendToClient]);

  return (
    <Box
      data-testid="producer-export-handoff-panel"
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
      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.25} justifyContent="space-between">
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <AssignmentTurnedInIcon sx={{ color: '#fbbf24' }} />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
              
              {t('exportHandoff.s133')}
            </Typography>
          </Stack>
          <Typography sx={{ color: 'rgba(203,213,225,0.86)', maxWidth: 920 }}>
            
            {t('exportHandoff.s004')}
          </Typography>
        </Box>
        {/* Én hovedhandling (The Role Room-gradient), resten dempet til
            stille tekst-knapper — mindre å velge mellom på ett blikk. */}
        <Stack spacing={1} alignItems={{ sm: 'flex-end' }} sx={{ flexShrink: 0 }}>
          {onSendToClient ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<SendIcon />}
              data-testid="producer-export-send-package"
              onClick={() => { void handleSendToClient(); }}
              disabled={sendingToClient || uploadingPackage || writingWorkspace}
              sx={{
                textTransform: 'none', fontWeight: 800, fontSize: '1.02rem',
                px: 2.6, py: 1.1, borderRadius: 2.5, minHeight: 52,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                color: '#fff', boxShadow: '0 8px 24px rgba(139,92,246,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #7c4ff0 0%, #5457e0 100%)' },
                '&.Mui-disabled': { opacity: 0.45, color: '#fff' },
              }}
            >
              {sendingToClient ? t('exportHandoff.s050') : t('exportHandoff.s132')}
            </Button>
          ) : null}
          <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap justifyContent={{ sm: 'flex-end' }}>
            {onOpenManuscript ? (
              <Button variant="text" size="small" startIcon={<AutoStoriesIcon />} onClick={onOpenManuscript} sx={SECONDARY_ACTION_SX}>{t('exportHandoff.s164')}</Button>
            ) : null}
            {onOpenShotList ? (
              <Button variant="text" size="small" startIcon={<ViewListIcon />} onClick={onOpenShotList} sx={SECONDARY_ACTION_SX}>{t('exportHandoff.s169')}</Button>
            ) : null}
            {onOpenMedia ? (
              <Button variant="text" size="small" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(briefWorkspaceFocus)} sx={SECONDARY_ACTION_SX}>{t('exportHandoff.s154')}</Button>
            ) : null}
            <Button variant="text" size="small" startIcon={<ContentCopyIcon />} data-testid="producer-export-copy-portal" onClick={() => { void handleCopyClientPortalUrl(); }} sx={SECONDARY_ACTION_SX}>{t('exportHandoff.s069')}</Button>
            <Button variant="text" size="small" startIcon={<TaskAltIcon />} data-testid="producer-export-write-package" onClick={() => { void handleBuildAndUploadPackage(); }} disabled={uploadingPackage} sx={SECONDARY_ACTION_SX}>{uploadingPackage ? 'Skriver…' : t('exportHandoff.s077')}</Button>
            <Button variant="text" size="small" startIcon={<ViewListIcon />} data-testid="producer-export-write-workspace" onClick={() => { void handleWriteDeliveryWorkspace(); }} disabled={writingWorkspace} sx={SECONDARY_ACTION_SX}>{writingWorkspace ? 'Skriver…' : t('exportHandoff.s076')}</Button>
            {latestPackage ? (
              <Button variant="text" size="small" startIcon={<LaunchIcon />} data-testid="producer-export-share-package" onClick={() => { void handleShareLatestPackage(); }} sx={SECONDARY_ACTION_SX}>{t('exportHandoff.s014')}</Button>
            ) : null}
          </Stack>
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <Alert severity="info">{t('exportHandoff.s118')}</Alert> : null}
      {clientInputError ? <Alert severity="error">{clientInputError}</Alert> : null}
      {loadingClientInput ? <Alert severity="info">{t('exportHandoff.s033')}</Alert> : null}
      {reviewsError ? <Alert severity="warning">{reviewsError}</Alert> : null}
      {latestPackage ? (
        <Alert
          severity="success"
          data-testid="producer-export-latest-package-alert"
          action={hasText(latestPackage.downloadUrl) ? (
            <Button
              color="inherit"
              size="small"
              href={latestPackage.downloadUrl}
              target="_blank"
              rel="noreferrer"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              
              {t('exportHandoff.s166')}
            </Button>
          ) : undefined}
        >
          {t('exportHandoff.t028', { v0: latestPackage.name, v1: latestPackage.versionLabel || t('exportHandoff.s152'), v2: latestPackage.folderPath || t('exportHandoff.s149') })}
        </Alert>
      ) : null}
      {latestPackageShareUrl ? (
        <Alert
          severity="info"
          data-testid="producer-export-share-alert"
          action={(
            <Button
              color="inherit"
              size="small"
              href={latestPackageShareUrl}
              target="_blank"
              rel="noreferrer"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              
              {t('exportHandoff.s156')}
            </Button>
          )}
        >
          
          {t('exportHandoff.s062')}
        </Alert>
      ) : null}
      {!loading && !loadingClientInput && loadingReviews ? (
        <Alert severity="info">{t('exportHandoff.s119')}</Alert>
      ) : null}

      {strategySnapshot.length > 0 ? (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {strategySnapshot.map((item) => (
            <Chip
              key={item.label}
              size="small"
              label={`${item.label}: ${item.value}`}
              sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
            />
          ))}
          <Chip
            size="small"
            label={`Hovedleveranse: ${manifest.primaryDeliveryLabel}`}
            sx={{ bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
          />
          <Chip
            size="small"
            label={t('exportHandoff.t036', { v0: manifest.recommendedShootDays })}
            sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a' }}
          />
        </Stack>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 1.2,
        }}
      >
        {[
          {
            label: t('exportHandoff.s066'),
            tone: (manifest.pendingClientMoments.length > 0 ? 'wait' : 'go') as StatusTone,
            value: `${manifest.pendingClientMoments.length}`,
            detail: manifest.pendingClientMoments.length > 0
              ? t('exportHandoff.s167')
              : t('exportHandoff.s042'),
          },
          {
            label: t('exportHandoff.s108'),
            tone: (readiness.brandReadyCount === readiness.brandItems.length ? 'go' : 'wait') as StatusTone,
            value: `${readiness.brandReadyCount}/${readiness.brandItems.length}`,
            detail: readiness.brandReadyCount === readiness.brandItems.length
              ? t('exportHandoff.s107')
              : t('exportHandoff.s115'),
          },
          {
            label: t('exportHandoff.s085'),
            tone: (readiness.workflowReadyCount === readiness.workflowItems.length ? 'go' : 'wait') as StatusTone,
            value: `${readiness.workflowReadyCount}/${readiness.workflowItems.length}`,
            detail: readiness.workflowReadyCount === readiness.workflowItems.length
              ? t('exportHandoff.s028')
              : t('exportHandoff.s114'),
          },
          {
            label: t('exportHandoff.s056'),
            tone: (clientMaterials.length > 0 ? 'go' : 'wait') as StatusTone,
            value: t('exportHandoff.t040', { v0: clientBriefReadyCount, v1: clientMaterials.length }),
            detail: clientMaterials.length > 0
              ? t('exportHandoff.s053')
              : t('exportHandoff.s054'),
          },
          {
            label: t('exportHandoff.s044'),
            tone: 'wait' as StatusTone,
            value: [manifest.contentLogicSummary.objective, manifest.contentLogicSummary.hook, manifest.contentLogicSummary.callToAction].filter(hasText).length > 0
              ? `${[manifest.contentLogicSummary.objective, manifest.contentLogicSummary.hook, manifest.contentLogicSummary.callToAction].filter(hasText).length}/3`
              : '0/3',
            detail: hasText(manifest.contentLogicSummary.hook)
              ? `Hook: ${manifest.contentLogicSummary.hook}`
              : t('exportHandoff.s110'),
          },
          {
            label: t('exportHandoff.s034'),
            tone: (manifest.accountAccessSummary.connectedCount >= manifest.accountAccessSummary.requiredPlatformCount ? 'go' : manifest.accountAccessSummary.connectedCount === 0 ? 'stop' : 'wait') as StatusTone,
            value: `${manifest.accountAccessSummary.connectedCount}/${manifest.accountAccessSummary.requiredPlatformCount}`,
            detail: manifest.accountAccessSummary.clientActionCount > 0
              ? t('exportHandoff.t037', { v0: manifest.accountAccessSummary.clientActionCount, v1: manifest.accountAccessSummary.clientActionCount === 1 ? '' : 's' })
              : manifest.accountAccessSummary.inviteSentCount > 0
                ? t('exportHandoff.t032', { v0: manifest.accountAccessSummary.inviteSentCount, v1: manifest.accountAccessSummary.inviteSentCount === 1 ? '' : 's' })
                : t('exportHandoff.s116'),
          },
          {
            label: t('exportHandoff.s160'),
            tone: (openClientContributionTasks.length > 0 ? 'wait' : 'go') as StatusTone,
            value: `${openClientContributionTasks.length}`,
            detail: openClientContributionTasks.length > 0
              ? t('exportHandoff.s125')
              : t('exportHandoff.s041'),
          },
        ].map((card) => {
          const t = TONE_COLORS[card.tone];
          return (
          <Box
            key={card.label}
            data-testid={`producer-export-summary-${normalizeFileToken(card.label)}`}
            sx={{
              p: 1.3,
              pl: 1.5,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              borderLeft: `3px solid ${t.stripe}`,
              background: t.bg,
            }}
          >
            <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.82rem', fontWeight: 700 }}>
              {card.label}
            </Typography>
            <Typography sx={{ color: t.fg, fontWeight: 800, fontSize: '1.16rem', mt: 0.45, fontVariantNumeric: 'tabular-nums' }}>
              {card.value}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.45 }}>
              {card.detail}
            </Typography>
          </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            xl: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
          },
          gap: 2,
        }}
      >
        <Stack spacing={2}>
          <CollapsibleSection
            title={t('exportHandoff.s113')}
            defaultOpen
          >
            <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
              {onOpenReviews ? (
                <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={onOpenReviews} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  
                  {t('exportHandoff.s161')}
                </Button>
              ) : null}
              {onOpenTimeline ? (
                <Button size="small" variant="outlined" startIcon={<CalendarMonthIcon />} onClick={onOpenTimeline} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  
                  {t('exportHandoff.s170')}
                </Button>
              ) : null}
            </Stack>
            <Stack spacing={0.9}>
              {manifest.pendingClientMoments.slice(0, 6).map((moment) => {
                const contentLogicMomentKind = getProducerContentLogicMomentKind(moment.id);
                const isContentLogicMoment = Boolean(contentLogicMomentKind);
                const accountAccessPlatform = getProducerAccountAccessPlatformFromMomentId(moment.id);
                const isAccountAccessMoment = Boolean(accountAccessPlatform);
                const contentLogicMomentLabel = contentLogicMomentKind
                  ? PRODUCER_CONTENT_LOGIC_MOMENT_LABELS[contentLogicMomentKind]
                  : '';
                return (
                  <Box
                    key={moment.id}
                    sx={{
                      p: 1,
                      borderRadius: 1.25,
                      border: isContentLogicMoment
                        ? '1px solid rgba(167,139,250,0.26)'
                        : isAccountAccessMoment
                          ? '1px solid rgba(45,212,191,0.24)'
                        : '1px solid rgba(148,163,184,0.14)',
                      background: isContentLogicMoment
                        ? 'rgba(76,29,149,0.16)'
                        : isAccountAccessMoment
                          ? 'rgba(15,118,110,0.14)'
                        : 'rgba(2,6,23,0.56)',
                    }}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                          {isContentLogicMoment ? (
                            <>
                              <Chip
                                size="small"
                                label={t('exportHandoff.s044')}
                                sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#ede9fe' }}
                              />
                              <Chip
                                size="small"
                                label={contentLogicMomentLabel}
                                sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#cffafe' }}
                              />
                            </>
                          ) : null}
                          {isAccountAccessMoment && accountAccessPlatform ? (
                            <>
                              <Chip
                                size="small"
                                label={t('exportHandoff.s034')}
                                sx={{ bgcolor: 'rgba(45,212,191,0.16)', color: '#ccfbf1' }}
                              />
                              <Chip
                                size="small"
                                label={PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[accountAccessPlatform]}
                                sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                              />
                            </>
                          ) : null}
                          <Chip
                            size="small"
                            label={moment.reviewStatusLabel ?? moment.statusLabel}
                            sx={{
                              bgcolor: moment.reviewStatus === 'approved'
                                ? 'rgba(16,185,129,0.16)'
                                : moment.reviewStatus === 'changes_requested' || moment.reviewStatus === 'rejected'
                                  ? 'rgba(248,113,113,0.16)'
                                  : 'rgba(251,191,36,0.14)',
                              color: moment.reviewStatus === 'approved'
                                ? '#a7f3d0'
                                : moment.reviewStatus === 'changes_requested' || moment.reviewStatus === 'rejected'
                                  ? '#fecaca'
                                  : '#fde68a',
                            }}
                          />
                          {moment.commentCount ? (
                            <Chip
                              size="small"
                              label={t('exportHandoff.t033', { v0: moment.commentCount, v1: moment.commentCount === 1 ? '' : 's' })}
                              sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1' }}
                            />
                          ) : null}
                        </Stack>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                          {moment.title}
                        </Typography>
                        <Typography sx={{ color: isContentLogicMoment ? 'rgba(233,213,255,0.92)' : isAccountAccessMoment ? 'rgba(204,251,241,0.92)' : 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                          {moment.detail || t('exportHandoff.s037')}
                        </Typography>
                        {isContentLogicMoment ? (
                          <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.78rem', mt: 0.35 }}>
                            
                            {t('exportHandoff.s016')}
                          </Typography>
                        ) : null}
                        {isAccountAccessMoment ? (
                          <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.78rem', mt: 0.35 }}>
                            
                            {t('exportHandoff.s017')}
                          </Typography>
                        ) : null}
                        {moment.drivenByReview ? (
                          <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.78rem', mt: 0.35 }}>
                            {moment.reviewDecisionAt
                              ? t('exportHandoff.t027', { v0: formatDate(t, moment.reviewDecisionAt) })
                              : moment.reviewRequestedAt
                                ? t('exportHandoff.t026', { v0: formatDate(t, moment.reviewRequestedAt) })
                                : t('exportHandoff.s067')}
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack spacing={0.45} alignItems={{ md: 'flex-end' }}>
                        <Chip
                          size="small"
                          label={isContentLogicMoment ? t('exportHandoff.s045') : isAccountAccessMoment ? t('exportHandoff.s121') : PRODUCER_PLANNING_PHASE_LABELS[moment.phase]}
                          sx={{
                            bgcolor: isContentLogicMoment ? 'rgba(125,211,252,0.14)' : isAccountAccessMoment ? 'rgba(45,212,191,0.16)' : 'rgba(59,130,246,0.14)',
                            color: isContentLogicMoment ? '#cffafe' : isAccountAccessMoment ? '#ccfbf1' : '#bfdbfe',
                          }}
                        />
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem' }}>
                          {moment.date ? formatDate(t, moment.date) : t('exportHandoff.s013')}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
              {manifest.pendingClientMoments.length === 0 ? (
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.88rem' }}>
                  
                  {t('exportHandoff.s043')}
                </Typography>
              ) : null}
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s034')}
            summary={t('exportHandoff.t042', { v0: manifest.accountAccessSummary.connectedCount, v1: manifest.accountAccessSummary.requiredPlatformCount, v2: manifest.accountAccessSummary.clientActionCount })}
          >
            {onOpenMedia ? (
              <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(accountsWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700, mb: 1 }}>
                
                {t('exportHandoff.s162')}
              </Button>
            ) : null}
            <Stack spacing={0.7}>
              <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem' }}>
                {t('exportHandoff.t041', { v0: manifest.accountAccessSummary.connectedCount, v1: manifest.accountAccessSummary.requiredPlatformCount, v2: manifest.accountAccessSummary.clientActionCount, v3: manifest.accountAccessSummary.inviteSentCount })}
              </Typography>
              {manifest.accountAccessSummary.entries.map((entry) => (
                <Box
                  key={entry.platform}
                  sx={{
                    p: 0.85,
                    borderRadius: 1.15,
                    border: '1px solid rgba(45,212,191,0.16)',
                    bgcolor: entry.requiredForProject ? 'rgba(15,118,110,0.12)' : 'rgba(2,6,23,0.36)',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 0.35 }}>
                        <Chip
                          size="small"
                          label={entry.platformLabel}
                          sx={{ bgcolor: 'rgba(45,212,191,0.16)', color: '#ccfbf1' }}
                        />
                        <Chip
                          size="small"
                          label={entry.statusLabel}
                          sx={{
                            bgcolor: entry.status === 'connected'
                              ? 'rgba(16,185,129,0.16)'
                              : entry.status === 'client_action'
                                ? 'rgba(248,113,113,0.16)'
                                : 'rgba(251,191,36,0.14)',
                            color: entry.status === 'connected'
                              ? '#a7f3d0'
                              : entry.status === 'client_action'
                                ? '#fecaca'
                                : '#fde68a',
                          }}
                        />
                        {entry.requiredForProject ? (
                          <Chip size="small" label={t('exportHandoff.s071')} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }} />
                        ) : null}
                      </Stack>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700 }}>
                        {`${entry.methodLabel} · ${entry.accessScope || t('exportHandoff.s131')}`}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.78rem', mt: 0.2 }}>
                        {t('exportHandoff.t016', { v0: entry.accountLabel || t('exportHandoff.s036'), v1: entry.inviteTarget || t('exportHandoff.s036') })}
                      </Typography>
                      <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.76rem', mt: 0.2 }}>
                        {t('exportHandoff.t017', { v0: entry.clientOwnerLabel || t('exportHandoff.s036'), v1: entry.twoFactorRequired ? 'Ja' : 'Nei' })}
                      </Typography>
                      {hasText(entry.notes) ? (
                        <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.76rem', mt: 0.2 }}>
                          {entry.notes}
                        </Typography>
                      ) : null}
                    </Box>
                  </Stack>
                </Box>
              ))}
              <Box sx={{ pt: 0.2 }}>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                  
                  {t('exportHandoff.s136')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem', mt: 0.2 }}>
                  {manifest.accountAccessSummary.securityNotes || t('exportHandoff.s036')}
                </Typography>
                <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.78rem', mt: 0.25 }}>
                  {t('exportHandoff.t025', { v0: manifest.accountAccessSummary.revokePlan || t('exportHandoff.s036') })}
                </Typography>
              </Box>
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s025')}
            summary={`${deliveryWorkspaceFiles.length} prosjektfiler`}
            badge={<Chip size="small" label={String(deliveryWorkspaceFiles.length)} sx={{ height: 18, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe', fontSize: '0.68rem' }} />}
          >
            <Stack spacing={0.85}>
              {deliveryWorkspaceFiles.length > 0 ? deliveryWorkspaceFiles.slice(0, 8).map((file) => (
                <Box
                  key={file.id}
                  data-testid="producer-export-workspace-file"
                  sx={{
                    p: 1,
                    borderRadius: 1.25,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.56)',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                        {file.deliveryTitle || file.name}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                        {file.folderPath || t('exportHandoff.s097')}
                      </Typography>
                      <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.78rem', mt: 0.25 }}>
                        {`${file.packageName || t('exportHandoff.s120')} · ${file.versionLabel || t('exportHandoff.s152')} · ${file.workspaceType || 'arbeidsfil'}`}
                      </Typography>
                    </Box>
                    {hasText(file.downloadUrl) ? (
                      <Button
                        variant="outlined"
                        size="small"
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { md: 'flex-start' } }}
                      >
                        
                        {t('exportHandoff.s158')}
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              )) : (
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.88rem' }}>
                  
                  {t('exportHandoff.s040')}
                </Typography>
              )}
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s047')}
            summary={`${legalAgreements.agreements.length} avtaler`}
            badge={<Chip size="small" label={String(legalAgreements.agreements.length)} sx={{ height: 18, bgcolor: 'rgba(168,85,247,0.16)', color: '#e9d5ff', fontSize: '0.68rem' }} />}
          >
            {legalAgreements.agreements.length > 0 ? (
              <Stack spacing={0.85}>
                {legalAgreements.agreements.slice(0, 6).map((agreement) => {
                  const signatureTone = getAgreementSignatureTone(agreement.google_signature);
                  const signedPdfArtifact = legalAgreements.googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.signedPdfArtifactId);
                  const pdfSnapshotArtifact = legalAgreements.googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.pdfSnapshotArtifactId);
                  const auditArtifact = legalAgreements.googleArtifacts.find((artifact) => artifact.id === agreement.google_signature?.auditArtifactId);
                  const primaryUrl = signedPdfArtifact?.webViewUrl
                    ?? pdfSnapshotArtifact?.webViewUrl
                    ?? agreement.google_signature?.requestUrl
                    ?? agreement.google_signature?.webViewUrl
                    ?? '';

                  return (
                    <Box
                      key={agreement.id}
                      sx={{
                        p: 1,
                        borderRadius: 1.25,
                        border: '1px solid rgba(148,163,184,0.14)',
                        background: 'rgba(2,6,23,0.56)',
                      }}
                    >
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                            <Chip
                              size="small"
                              label={PROJECT_AGREEMENT_STATUS_LABELS[agreement.status]}
                              sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                            />
                            <Chip
                              size="small"
                              label={t('exportHandoff.t013', { v0: getAgreementSignatureLabel(agreement.google_signature) })}
                              sx={{ bgcolor: signatureTone.background, color: signatureTone.color }}
                            />
                          </Stack>
                          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                            {agreement.title}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                            {`${agreement.counterparty_name}${agreement.counterparty_company_name ? ` · ${agreement.counterparty_company_name}` : ''}`}
                          </Typography>
                        </Box>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                          {onOpenMedia ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<LaunchIcon />}
                              onClick={() => onOpenMedia({
                                ...deliveryWorkspaceFocus,
                                artifactId: getAgreementWorkspaceArtifactId(agreement),
                              })}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              
                              {t('exportHandoff.s159')}
                            </Button>
                          ) : null}
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
                              
                              {t('exportHandoff.s157')}
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
                              
                              {t('exportHandoff.s135')}
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
                
                {t('exportHandoff.s039')}
              </Typography>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s046')}
            summary={t('exportHandoff.t038', { v0: openClientContributionTasks.length })}
          >
            {onOpenMedia ? (
              <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(materialsWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700, mb: 1 }}>
                
                {t('exportHandoff.s155')}
              </Button>
            ) : null}
            <Stack spacing={0.85}>
              {openClientContributionTasks.slice(0, 6).map((task) => (
                <Box
                  key={task.id}
                  sx={{
                    p: 1,
                    borderRadius: 1.25,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.56)',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.4 }}>
                        <Chip
                          size="small"
                          label={PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType]}
                          sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
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
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.3 }}>
                        {task.detail}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={PRODUCER_PLANNING_PHASE_LABELS[task.phase]}
                      sx={{ bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0', alignSelf: { md: 'flex-start' } }}
                    />
                    {onOpenMedia ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LaunchIcon />}
                        onClick={() => onOpenMedia(getWorkspaceFocusForContributionTask(task))}
                        sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { md: 'flex-start' } }}
                      >
                        
                        {t('exportHandoff.s168')}
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              ))}
              {openClientContributionTasks.length === 0 ? (
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.88rem' }}>
                  
                  {t('exportHandoff.s057')}
                </Typography>
              ) : null}
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s083')}
            summary={t('exportHandoff.t034', { v0: upcomingDeliveries.length })}
          >
            <Stack spacing={0.9}>
              {upcomingDeliveries.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    p: 1,
                    borderRadius: 1.25,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.56)',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.3 }}>
                        {item.channel} · {item.format}
                      </Typography>
                      <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.8rem', mt: 0.25 }}>
                        {`${item.folderPath}/${item.filename}`}
                      </Typography>
                      <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.8rem', mt: 0.25 }}>
                        {`Pakke ${item.packageName}`}
                      </Typography>
                      <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.8rem', mt: 0.25 }}>
                        {`Versjon ${item.versionLabel} · ${item.deliveryStageLabel}`}
                        {item.backupRuleLabel ? ` · Backup: ${item.backupRuleLabel}` : ''}
                      </Typography>
                      <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.8rem', mt: 0.25 }}>
                        {`Logovariant: ${item.logoVariantResolvedLabel} · ${item.logoVariantSelectionLabel}`}
                      </Typography>
                      {item.notes ? (
                        <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.8rem', mt: 0.25 }}>
                          {item.notes}
                        </Typography>
                      ) : null}
                    </Box>
                    <Stack spacing={0.45} alignItems={{ md: 'flex-end' }}>
                      <Chip
                        size="small"
                        label={item.statusLabel}
                        sx={{ bgcolor: 'rgba(192,132,252,0.14)', color: '#e9d5ff' }}
                      />
                      <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem' }}>
                        {item.publishDateLabel ?? t('exportHandoff.s124')}
                      </Typography>
                      {item.estimatedDurationLabel ? (
                        <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.78rem' }}>
                          
                          {t('exportHandoff.s021')} {item.estimatedDurationLabel}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CollapsibleSection>
        </Stack>

        <Stack spacing={2}>
          <CollapsibleSection
            title={t('exportHandoff.s052')}
            defaultOpen
          >
            {onOpenMedia ? (
              <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(briefWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700, mb: 1 }}>
                
                {t('exportHandoff.s155')}
              </Button>
            ) : null}
            <Stack spacing={0.8}>
              {[
                [t('exportHandoff.s122'), clientIntake.projectGoal],
                [t('exportHandoff.s082'), clientIntake.deliverables],
                [t('exportHandoff.s112'), clientIntake.targetAudience],
                [t('exportHandoff.s049'), clientIntake.keyMessage],
                [t('exportHandoff.s068'), [clientIntake.contactName, clientIntake.contactEmail].filter(hasText).join(' · ')],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                    {hasText(value) ? value : t('exportHandoff.s035')}
                  </Typography>
                </Box>
              ))}
              <Divider sx={{ borderColor: 'rgba(148,163,184,0.14)' }} />
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                
                {t('exportHandoff.s100')}
              </Typography>
              {clientMaterials.length > 0 ? (
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  {Object.entries(materialTypeSummary).map(([entryType, count]) => (
                    <Chip
                      key={entryType}
                      size="small"
                      label={`${MATERIAL_TYPE_LABELS[entryType as ProducerClientMaterialType] ?? entryType}: ${count}`}
                      sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem' }}>
                  
                  {t('exportHandoff.s055')}
                </Typography>
              )}
              {prioritizedClientMaterials.length > 0 ? (
                <>
                  <Divider sx={{ borderColor: 'rgba(148,163,184,0.14)' }} />
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    
                    {t('exportHandoff.s117')}
                  </Typography>
                  <Stack spacing={0.8}>
                    {prioritizedClientMaterials.slice(0, 4).map((material) => {
                      const metadata = parseClientMaterialMetadata(material);
                      return (
                        <Box key={material.id}>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.35 }}>
                            <Chip
                              size="small"
                              label={MATERIAL_PRIORITY_LABELS[metadata.priority]}
                              sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a' }}
                            />
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
                          </Stack>
                          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.84rem' }}>
                            {material.title}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.2 }}>
                            {[
                              metadata.fileName ? `Filnavn ${metadata.fileName}` : '',
                              metadata.versionLabel ? `versjon ${metadata.versionLabel}` : '',
                              metadata.sourceLabel ? `kilde ${metadata.sourceLabel}` : '',
                            ].filter(hasText).join(' · ') || t('exportHandoff.s038')}
                          </Typography>
                          {(hasText(metadata.usageNotes) || hasText(material.description)) ? (
                            <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.78rem', mt: 0.2 }}>
                              {metadata.usageNotes || material.description}
                            </Typography>
                          ) : null}
                        </Box>
                      );
                    })}
                  </Stack>
                </>
              ) : null}
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s123')}
            summary={t('exportHandoff.s137')}
          >
            <Stack spacing={0.8}>
              {frameworkSections.map((section) => (
                <Box key={section.key}>
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    {section.label}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                    {section.focus || section.output || section.notes || PRODUCER_PLANNING_FRAMEWORK_LABELS[section.key]}
                  </Typography>
                </Box>
              ))}
              {frameworkSections.length === 0 ? (
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.88rem' }}>
                  
                  {t('exportHandoff.s138')}
                </Typography>
              ) : null}
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s044')}
            summary={t('exportHandoff.s111')}
          >
            <Stack spacing={0.8}>
              {[
                { label: t('exportHandoff.s109'), value: manifest.contentLogicSummary.objective },
                { label: t('exportHandoff.s112'), value: manifest.contentLogicSummary.audience },
                { label: 'Hook', value: manifest.contentLogicSummary.hook },
                { label: t('exportHandoff.s011'), value: manifest.contentLogicSummary.coreMessage },
                { label: 'CTA', value: manifest.contentLogicSummary.callToAction },
                { label: t('exportHandoff.s018'), value: manifest.contentLogicSummary.distributionPlan },
              ].map((item) => (
                <Box key={item.label}>
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                    {item.value || t('exportHandoff.s036')}
                  </Typography>
                </Box>
              ))}
              {manifest.contentLogicSummary.proofPoints.length > 0 ? (
                <Box>
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    
                    {t('exportHandoff.s008')}
                  </Typography>
                  <Stack spacing={0.2} sx={{ mt: 0.25 }}>
                    {manifest.contentLogicSummary.proofPoints.map((item) => (
                      <Typography key={item} sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem' }}>
                        • {item}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s106')}
            summary={t('exportHandoff.s023')}
          >
            {onOpenMedia ? (
              <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(brandWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700, mb: 1 }}>
                
                {t('exportHandoff.s165')}
              </Button>
            ) : null}
            <Stack spacing={0.7}>
              {readiness.brandItems.map((item) => (
                <Stack key={item.label} direction="row" spacing={1} alignItems="flex-start">
                  <TaskAltIcon sx={{ color: item.ready ? '#34d399' : '#f59e0b', fontSize: 18, mt: '2px' }} />
                  <Box>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                      {item.detail}
                    </Typography>
                  </Box>
                </Stack>
              ))}
              <Box sx={{ pt: 0.35 }}>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                  
                  {t('exportHandoff.s091')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                  {`${manifest.logoPlacementLabel} · ${manifest.logoTreatmentLabel} · ${manifest.logoTimingDetail}`}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                  Overlay-spec
                </Typography>
                <Stack spacing={0.2} sx={{ mt: 0.25 }}>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                    {`Safe zone: ${manifest.overlayEditorGuidance.safeZone.label}`}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                    {`Opacity: ${manifest.overlayEditorGuidance.opacity.label}`}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                    {t('exportHandoff.t009', { v0: manifest.overlayEditorGuidance.recommendedMargin.label })}
                  </Typography>
                  <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.78rem' }}>
                    {manifest.overlayEditorGuidance.note}
                  </Typography>
                </Stack>
              </Box>
              {manifest.overlayFormatProfiles.length > 0 ? (
                <Box>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                    
                    {t('exportHandoff.s031')}
                  </Typography>
                  <Stack spacing={0.35} sx={{ mt: 0.25 }}>
                    {manifest.overlayFormatProfiles.map((profile) => (
                      <Box key={profile.format} sx={{ p: 0.7, borderRadius: 1, bgcolor: 'rgba(2,6,23,0.36)' }}>
                        <Typography sx={{ color: '#f8fafc', fontSize: '0.8rem', fontWeight: 700 }}>
                          {profile.formatLabel}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem', mt: 0.2 }}>
                          {`${profile.recommendedVariantLabel} · ${profile.safeZone.label} · ${profile.opacity.label} · ${profile.recommendedMargin.label}`}
                        </Typography>
                        <Typography sx={{ color: 'rgba(191,219,254,0.8)', fontSize: '0.76rem', mt: 0.2 }}>
                          {profile.note}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}
              {manifest.logoUsageMatrix.length > 0 ? (
                <Box>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                    Logo-usage-matrix
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.35,
                      borderRadius: 1,
                      border: '1px solid rgba(148,163,184,0.16)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.5fr) minmax(0,0.7fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)' },
                        gap: { xs: 0.35, md: 0 },
                        px: 0.85,
                        py: 0.7,
                        bgcolor: 'rgba(59,130,246,0.12)',
                        borderBottom: '1px solid rgba(148,163,184,0.14)',
                      }}
                    >
                      {[t('exportHandoff.s081'), 'Format', t('exportHandoff.s141'), t('exportHandoff.s010'), t('exportHandoff.s005')].map((label) => (
                        <Typography key={label} sx={{ color: '#e2e8f0', fontSize: '0.73rem', fontWeight: 800 }}>
                          {label}
                        </Typography>
                      ))}
                    </Box>
                    {manifest.logoUsageMatrix.map((item, index) => (
                      <Box
                        key={item.id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.5fr) minmax(0,0.7fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)' },
                          gap: { xs: 0.4, md: 0.75 },
                          px: 0.85,
                          py: 0.8,
                          bgcolor: index % 2 === 0 ? 'rgba(2,6,23,0.36)' : 'rgba(15,23,42,0.24)',
                          borderTop: index === 0 ? 'none' : '1px solid rgba(148,163,184,0.12)',
                        }}
                      >
                        <Box>
                          <Typography sx={{ color: '#f8fafc', fontSize: '0.78rem', fontWeight: 700 }}>
                            {item.title}
                          </Typography>
                          <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.74rem', mt: 0.15 }}>
                            {item.channel} · {item.deliveryStageLabel}
                          </Typography>
                        </Box>
                        <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.76rem' }}>
                          {item.format}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.76rem' }}>
                          {item.selectionLabel}
                        </Typography>
                        <Typography sx={{ color: '#bfdbfe', fontSize: '0.76rem', fontWeight: 700 }}>
                          {item.resolvedLabel}
                        </Typography>
                        <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.76rem' }}>
                          {`${item.recommendedLabel}${item.autoApplied ? t('exportHandoff.s001') : ''}`}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : null}
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            title={t('exportHandoff.s085')}
            summary={t('exportHandoff.t043', { v0: readiness.workflowItems.filter((i) => i.ready).length, v1: readiness.workflowItems.length })}
          >
            {onOpenMedia ? (
              <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(deliveryWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700, mb: 1 }}>
                
                {t('exportHandoff.s163')}
              </Button>
            ) : null}
            <Stack spacing={0.7}>
              {readiness.workflowItems.map((item) => (
                <Stack key={item.label} direction="row" spacing={1} alignItems="flex-start">
                  <TaskAltIcon sx={{ color: item.ready ? '#34d399' : '#f59e0b', fontSize: 18, mt: '2px' }} />
                  <Box>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                      {item.detail}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </CollapsibleSection>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)' }} />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
        <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.82rem', maxWidth: 880 }}>
          
          {t('exportHandoff.s130')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            data-testid="producer-export-download-pdf"
            onClick={() => { void handleDownloadPdf(); }}
            disabled={downloadingPdf}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
          >
            {downloadingPdf ? t('exportHandoff.s032') : t('exportHandoff.s078')}
          </Button>
          <Button variant="outlined" startIcon={<ContentCopyIcon />} data-testid="producer-export-copy-brief" onClick={() => { void handleCopyBrief(); }} sx={{ textTransform: 'none', fontWeight: 700 }}>
            
            {t('exportHandoff.s070')}
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} data-testid="producer-export-download-manifest" onClick={handleDownloadManifest} sx={{ textTransform: 'none', fontWeight: 700 }}>
            
            {t('exportHandoff.s079')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

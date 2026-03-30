import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type ClientPortalWorkspaceFocus,
} from '../../utils/clientPortal';
import {
  getAbsoluteProjectFileUrl,
  getProjectFileMetadataString,
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

const MATERIAL_TYPE_LABELS: Record<ProducerClientMaterialType, string> = {
  brief_note: 'Briefnotat',
  asset_link: 'Lenke',
  brand_asset: 'Merkevarefil',
  reference: 'Referanse',
  document: 'Dokument',
  feedback: 'Tilbakemelding',
};

const MATERIAL_PRIORITY_LABELS: Record<'critical' | 'important' | 'reference', string> = {
  critical: 'Kritisk',
  important: 'Viktig',
  reference: 'Referanse',
};

const hasText = (value: string | undefined | null): value is string => typeof value === 'string' && value.trim().length > 0;

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

const formatDate = (value?: string): string => {
  if (!value) {
    return 'Ikke satt';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium' }).format(parsed);
};

const buildReadinessChecklist = (project: CastingProject) => {
  const planning = normalizeProducerProjectPlanning(project);
  const brandGuide = planning.brandGuide;
  const deliveryWorkflow = planning.deliveryWorkflow;
  const logoTimingDetail = (() => {
    switch (brandGuide.logoTiming ?? 'outro') {
      case 'intro':
        return 'Logo vises i introen.';
      case 'throughout':
        return 'Logo vises gjennom hele videoen.';
      case 'custom':
        return `Logo vises fra ${brandGuide.logoStartSecond ?? 0}s til ${brandGuide.logoEndSecond ?? 3}s.`;
      case 'none':
        return 'Logo vises ikke i videoen.';
      case 'outro':
      default:
        return 'Logo vises i outroen.';
    }
  })();

  const brandItems = [
    { label: 'Logo', ready: hasText(brandGuide.logoUrl), detail: hasText(brandGuide.logoUrl) ? 'Logo er koblet til prosjektet.' : 'Logo mangler i merkevareguiden.' },
    { label: 'Logo i video', ready: hasText(brandGuide.logoUrl) && brandGuide.logoTiming !== 'none', detail: hasText(brandGuide.logoUrl) ? logoTimingDetail : 'Sett logo først for å bestemme visning i videoen.' },
    { label: 'Farger', ready: Boolean(brandGuide.colors?.length), detail: brandGuide.colors?.length ? `${brandGuide.colors.length} merkevarefarger er definert.` : 'Merkevarefarger mangler.' },
    { label: 'Fonter', ready: Boolean(brandGuide.fonts?.filter(hasText).length), detail: brandGuide.fonts?.filter(hasText).length ? `${brandGuide.fonts?.filter(hasText).length ?? 0} fonter er definert.` : 'Fonter mangler.' },
    { label: 'Tone of voice', ready: hasText(brandGuide.toneOfVoice), detail: brandGuide.toneOfVoice || 'Tone of voice mangler.' },
    { label: 'Visuell stil', ready: hasText(brandGuide.visualStyle), detail: brandGuide.visualStyle || 'Visuell stil mangler.' },
  ];

  const workflowItems = [
    { label: 'Filnavn', ready: hasText(deliveryWorkflow.fileNamingConvention), detail: deliveryWorkflow.fileNamingConvention || 'Filnavnregel mangler.' },
    { label: 'Versjonering', ready: hasText(deliveryWorkflow.versioningRule), detail: deliveryWorkflow.versioningRule || 'Versjoneringsregel mangler.' },
    { label: 'Mapper', ready: hasText(deliveryWorkflow.folderStructure), detail: deliveryWorkflow.folderStructure || 'Mappestruktur mangler.' },
    { label: 'Draft / final', ready: hasText(deliveryWorkflow.draftVsFinalRule), detail: deliveryWorkflow.draftVsFinalRule || 'Draft/final-regel mangler.' },
    { label: 'Backup', ready: hasText(deliveryWorkflow.backupRoutine), detail: deliveryWorkflow.backupRoutine || 'Backuprutine mangler.' },
    { label: 'Leveringsrytme', ready: hasText(deliveryWorkflow.deliveryCadence), detail: deliveryWorkflow.deliveryCadence || 'Leveringsrytme mangler.' },
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
  planning: ProducerProjectPlanning,
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
  contributionTasks: ReturnType<typeof getProducerClientContributionTasks>,
  pendingClientMoments: ReturnType<typeof buildProducerDeliveryManifest>['pendingClientMoments'],
): string => {
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
    'KLIENTBRIEF OG MATERIALE',
    '------------------------',
    `Prosjektmål: ${intake.projectGoal || 'Ikke satt'}`,
    `Leveranser: ${intake.deliverables || 'Ikke satt'}`,
    `Målgruppe: ${intake.targetAudience || 'Ikke satt'}`,
    `Kjernebudskap: ${intake.keyMessage || 'Ikke satt'}`,
    `Tidsrammer: ${intake.timingConstraints || 'Ikke satt'}`,
    `Brand-notater: ${intake.brandNotes || 'Ikke satt'}`,
    `Materialoversikt: ${intake.materialOverview || 'Ikke satt'}`,
    `Referanselenker: ${intake.referenceLinks || 'Ikke satt'}`,
    `Kontaktperson: ${[intake.contactName, intake.contactEmail, intake.contactPhone].filter(hasText).join(' · ') || 'Ikke satt'}`,
    `Tilleggsnotater: ${intake.additionalNotes || 'Ikke satt'}`,
    '',
    'CONTENT LOGIC',
    '-------------',
    `Mål: ${contentLogic.objective || 'Ikke satt'}`,
    `Målgruppe: ${contentLogic.audience || 'Ikke satt'}`,
    `Hook: ${contentLogic.hook || 'Ikke satt'}`,
    `Kjernebudskap: ${contentLogic.coreMessage || 'Ikke satt'}`,
    `CTA: ${contentLogic.callToAction || 'Ikke satt'}`,
    `Distribusjon: ${contentLogic.distributionPlan || 'Ikke satt'}`,
    `Bevis: ${contentLogic.proofPoints?.length ? contentLogic.proofPoints.join(' · ') : 'Ikke satt'}`,
    '',
    'ÅPNE BESLUTNINGSPUNKTER',
    '-----------------------',
    ...(
      pendingClientMoments.length > 0
        ? pendingClientMoments.map((moment) => (
          `- ${getProducerClientMomentTextEyebrow(moment)} ${moment.title} · ${moment.reviewStatusLabel ?? moment.statusLabel}`
        ))
        : ['- Ingen åpne beslutningspunkter akkurat nå.']
    ),
    '',
    'Registrert materiale:',
  ];

  if (materials.length === 0) {
    summaryLines.push('- Ingen materialer registrert ennå.');
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
      `  Prioritet: ${MATERIAL_PRIORITY_LABELS[metadata.priority]}`,
      `  Fase: ${material.phase ? material.phase : 'Ikke satt'}`,
      `  Status: ${material.status || 'Levert'}`,
      `  Filnavn: ${metadata.fileName || 'Ikke satt'}`,
      `  Versjon: ${metadata.versionLabel || 'Ikke satt'}`,
      `  Kilde: ${metadata.sourceLabel || 'Ikke satt'}`,
      `  Brukes til: ${metadata.usageNotes || 'Ikke satt'}`,
      `  Beskrivelse: ${material.description || 'Ikke satt'}`,
      `  Lenke: ${material.external_url || 'Ikke satt'}`,
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
      const [nextIntake, nextMaterials] = await Promise.all([
        producerWorkflowService.getClientIntake(project.id),
        producerWorkflowService.getClientMaterials(project.id),
      ]);
      if (requestId !== clientInputsRequestRef.current) {
        return;
      }
      setClientIntake({
        ...EMPTY_INTAKE,
        ...nextIntake,
      });
      setClientMaterials(nextMaterials);
    } catch (loadError) {
      if (requestId !== clientInputsRequestRef.current) {
        return;
      }
      console.error('[ProducerExportHandoffPanel] Failed to load client handoff inputs', loadError);
      setClientInputError('Kunne ikke hente klientbrief og materiale til klientpakken.');
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
        name: latestUploadedPackage.name || latestUploadedPackage.originalName || 'Klientpakke',
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
    () => buildReadinessChecklist(project),
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
    resolveWorkspaceFocus(getProducerWorkspaceSurfaceForContributionSource(task.sourceType))
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
        enqueueSnackbar('Overleveringsbrief kopiert.', { variant: 'success' });
        return;
      } catch (clipboardError) {
        console.warn('[ProducerExportHandoffPanel] Clipboard copy failed, falling back to file download', clipboardError);
      }
    }
    downloadTextFile(`${normalizeFileToken(project.name)}-overleveringsbrief.txt`, content);
    enqueueSnackbar('Clipboard er ikke tilgjengelig. Briefen ble lastet ned som fil.', { variant: 'info' });
  }, [clientContributionTasks, clientIntake, enqueueSnackbar, manifest, planning, prioritizedClientMaterials, project.name]);

  const handleDownloadManifest = useCallback(() => {
    downloadTextFile(
      `${normalizeFileToken(project.name)}-leveringsmanifest.txt`,
      [
        formatProducerDeliveryManifestAsText(manifest),
        formatProducerClientContributionTasksAsText(clientContributionTasks),
      ].join('\n'),
    );
    enqueueSnackbar('Leveringsmanifest lastet ned.', { variant: 'success' });
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
      enqueueSnackbar('Klientpakken ble lastet ned som PDF.', { variant: 'success' });
    } catch (exportError) {
      console.error('[ProducerExportHandoffPanel] Failed to export handoff PDF', exportError);
      setClientInputError('Kunne ikke generere klientpakken som PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  }, [clientIntake, clientMaterials, enqueueSnackbar, manifest, planning, productionEstimate, project.name]);

  const handleCopyClientPortalUrl = useCallback(async () => {
    if (!clientPortalUrl) {
      setClientInputError('Kunne ikke bygge klientportal-lenken for dette prosjektet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(clientPortalUrl);
      enqueueSnackbar('Klientportal-lenke kopiert.', { variant: 'success' });
    } catch (clipboardError) {
      console.error('[ProducerExportHandoffPanel] Failed to copy client portal url', clipboardError);
      setClientInputError('Kunne ikke kopiere klientportal-lenken.');
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
        deliveryStageLabel: 'Klientpakke',
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
      enqueueSnackbar('Klientpakken ble skrevet til prosjektfiler.', { variant: 'success' });
      return nextPackage;
    } catch (packageError) {
      console.error('[ProducerExportHandoffPanel] Failed to build and upload client package', packageError);
      setClientInputError('Kunne ikke skrive klientpakken til prosjektets leveranseflyt.');
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
      enqueueSnackbar('Leveransearbeidsområdet ble skrevet til prosjektfiler.', { variant: 'success' });
      return uploadedWorkspaceFiles;
    } catch (workspaceError) {
      console.error('[ProducerExportHandoffPanel] Failed to write delivery workspace', workspaceError);
      setClientInputError('Kunne ikke skrive leveransearbeidsområdet til prosjektfiler.');
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
      setClientInputError('Klientpakken må skrives før den kan deles.');
      return;
    }

    try {
      const response = await shareProjectFile(project.id, latestPackage.id, { expiresInHours: 72 });
      const absoluteShareUrl = getAbsoluteProjectFileUrl(readFirstNonEmptyString(response.shareUrl));
      setLatestPackageShareUrl(absoluteShareUrl);

      if (absoluteShareUrl && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteShareUrl);
      }

      enqueueSnackbar('Delingslenke til klientpakken er klar.', { variant: 'success' });
    } catch (shareError) {
      console.error('[ProducerExportHandoffPanel] Failed to share latest package', shareError);
      setClientInputError('Kunne ikke lage delingslenke for klientpakken.');
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
      enqueueSnackbar('Klientpakken er klar for deling.', { variant: 'success' });
    } catch (sendError) {
      console.error('[ProducerExportHandoffPanel] Failed to prepare client handoff', sendError);
      setClientInputError('Kunne ikke klargjøre klientpakken for deling.');
    } finally {
      setSendingToClient(false);
    }
  }, [enqueueSnackbar, handleBuildAndUploadPackage, handleWriteDeliveryWorkspace, onSendToClient]);

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
      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.25} justifyContent="space-between">
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <AssignmentTurnedInIcon sx={{ color: '#fbbf24' }} />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
              Eksport og overlevering
            </Typography>
          </Stack>
          <Typography sx={{ color: 'rgba(203,213,225,0.86)', maxWidth: 920 }}>
            Samler klientpakke, publiseringspunkter, filnavn, merkevareguide og leveringsrutine i ett sted, slik at det som planlegges også er det som faktisk sendes og leveres.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {onOpenManuscript ? (
            <Button variant="outlined" startIcon={<AutoStoriesIcon />} onClick={onOpenManuscript} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Åpne manus
            </Button>
          ) : null}
          {onOpenShotList ? (
            <Button variant="outlined" startIcon={<ViewListIcon />} onClick={onOpenShotList} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Åpne shotlist
            </Button>
          ) : null}
          {onOpenMedia ? (
            <Button variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(briefWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Åpne klientbrief
            </Button>
          ) : null}
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={() => {
              void handleCopyClientPortalUrl();
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Kopier klientportal
          </Button>
          <Button
            variant="outlined"
            startIcon={<TaskAltIcon />}
            onClick={() => {
              void handleBuildAndUploadPackage();
            }}
            disabled={uploadingPackage}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {uploadingPackage ? 'Skriver pakke...' : 'Skriv klientpakke'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<ViewListIcon />}
            onClick={() => {
              void handleWriteDeliveryWorkspace();
            }}
            disabled={writingWorkspace}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {writingWorkspace ? 'Skriver arbeidsområde...' : 'Skriv leveransearbeidsområde'}
          </Button>
          {latestPackage ? (
            <Button
              variant="outlined"
              startIcon={<LaunchIcon />}
              onClick={() => {
                void handleShareLatestPackage();
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Del siste klientpakke
            </Button>
          ) : null}
          {onSendToClient ? (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => { void handleSendToClient(); }}
              disabled={sendingToClient || uploadingPackage || writingWorkspace}
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#fbbf24', color: '#111827', '&:hover': { bgcolor: '#f59e0b' } }}
            >
              {sendingToClient ? 'Klargjør klientpakke…' : 'Send klientpakke'}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <Alert severity="info">Oppdaterer eksportgrunnlag fra manus, shotlist og produksjonsplan.</Alert> : null}
      {clientInputError ? <Alert severity="error">{clientInputError}</Alert> : null}
      {loadingClientInput ? <Alert severity="info">Henter klientbrief og materiale til klientpakken.</Alert> : null}
      {reviewsError ? <Alert severity="warning">{reviewsError}</Alert> : null}
      {latestPackage ? (
        <Alert
          severity="success"
          action={hasText(latestPackage.downloadUrl) ? (
            <Button
              color="inherit"
              size="small"
              href={latestPackage.downloadUrl}
              target="_blank"
              rel="noreferrer"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Åpne pakke
            </Button>
          ) : undefined}
        >
          {`Siste klientpakke: ${latestPackage.name} · ${latestPackage.versionLabel || 'uten versjon'} · ${latestPackage.folderPath || 'mappe ikke satt'}`}
        </Alert>
      ) : null}
      {latestPackageShareUrl ? (
        <Alert
          severity="info"
          action={(
            <Button
              color="inherit"
              size="small"
              href={latestPackageShareUrl}
              target="_blank"
              rel="noreferrer"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Åpne delingslenke
            </Button>
          )}
        >
          Klientpakken er delt. Delingslenken er kopiert og kan åpnes direkte fra denne meldingen.
        </Alert>
      ) : null}
      {!loading && !loadingClientInput && loadingReviews ? (
        <Alert severity="info">Oppdaterer klientstatus for faseplan og content-kalender.</Alert>
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
            label={`${manifest.recommendedShootDays} opptaksdager`}
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
            label: 'Klientpunkter',
            value: `${manifest.pendingClientMoments.length}`,
            detail: manifest.pendingClientMoments.length > 0
              ? 'Åpne punkter fra faseplan og content-kalender.'
              : 'Ingen åpne klientpunkter akkurat nå.',
          },
          {
            label: 'Merkevareklarhet',
            value: `${readiness.brandReadyCount}/${readiness.brandItems.length}`,
            detail: readiness.brandReadyCount === readiness.brandItems.length
              ? 'Merkevareguiden er klar for levering.'
              : 'Noen merkevarepunkter bør fylles før final eksport.',
          },
          {
            label: 'Leveringsrutine',
            value: `${readiness.workflowReadyCount}/${readiness.workflowItems.length}`,
            detail: readiness.workflowReadyCount === readiness.workflowItems.length
              ? 'Filstruktur og levering er definert.'
              : 'Noen leveringsregler mangler for konsekvent handoff.',
          },
          {
            label: 'Klientgrunnlag',
            value: `${clientBriefReadyCount}/6 · ${clientMaterials.length} filer`,
            detail: clientMaterials.length > 0
              ? 'Klientbrief og opplastet materiale er koblet til pakken.'
              : 'Klienten bør legge inn brief og materiale før endelig handoff.',
          },
          {
            label: 'Content Logic',
            value: [manifest.contentLogicSummary.objective, manifest.contentLogicSummary.hook, manifest.contentLogicSummary.callToAction].filter(hasText).length > 0
              ? `${[manifest.contentLogicSummary.objective, manifest.contentLogicSummary.hook, manifest.contentLogicSummary.callToAction].filter(hasText).length}/3`
              : '0/3',
            detail: hasText(manifest.contentLogicSummary.hook)
              ? `Hook: ${manifest.contentLogicSummary.hook}`
              : 'Mål, hook og CTA bør fylles før klientpakken sendes.',
          },
          {
            label: 'Kontotilgang',
            value: `${manifest.accountAccessSummary.connectedCount}/${manifest.accountAccessSummary.requiredPlatformCount}`,
            detail: manifest.accountAccessSummary.clientActionCount > 0
              ? `${manifest.accountAccessSummary.clientActionCount} plattform${manifest.accountAccessSummary.clientActionCount === 1 ? '' : 'er'} krever klienthandling.`
              : manifest.accountAccessSummary.inviteSentCount > 0
                ? `${manifest.accountAccessSummary.inviteSentCount} invitasjon${manifest.accountAccessSummary.inviteSentCount === 1 ? '' : 'er'} venter på bekreftelse.`
                : 'Nødvendige kontoer er avklart eller koblet.',
          },
          {
            label: 'Åpne klientinnspill',
            value: `${openClientContributionTasks.length}`,
            detail: openClientContributionTasks.length > 0
              ? 'Punkter som fortsatt må avklares før pakken er helt trygg å sende.'
              : 'Ingen åpne klientinnspill akkurat nå.',
          },
        ].map((card) => (
          <Box
            key={card.label}
            sx={{
              p: 1.3,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.64)',
            }}
          >
            <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.82rem', fontWeight: 700 }}>
              {card.label}
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.16rem', mt: 0.45 }}>
              {card.value}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.45 }}>
              {card.detail}
            </Typography>
          </Box>
        ))}
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
          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                Neste klientpunkter
              </Typography>
              <Stack direction="row" spacing={1}>
                {onOpenReviews ? (
                  <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={onOpenReviews} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Åpne klientsamarbeid
                  </Button>
                ) : null}
                {onOpenTimeline ? (
                  <Button size="small" variant="outlined" startIcon={<CalendarMonthIcon />} onClick={onOpenTimeline} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Åpne tidslinje
                  </Button>
                ) : null}
              </Stack>
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
                                label="Content Logic"
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
                                label="Kontotilgang"
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
                              label={`${moment.commentCount} kommentar${moment.commentCount === 1 ? '' : 'er'}`}
                              sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1' }}
                            />
                          ) : null}
                        </Stack>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                          {moment.title}
                        </Typography>
                        <Typography sx={{ color: isContentLogicMoment ? 'rgba(233,213,255,0.92)' : isAccountAccessMoment ? 'rgba(204,251,241,0.92)' : 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                          {moment.detail || 'Ingen detaljer lagt inn ennå.'}
                        </Typography>
                        {isContentLogicMoment ? (
                          <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.78rem', mt: 0.35 }}>
                            Dette er en innholdsbeslutning som låser hook, CTA eller proof points før videre produksjon.
                          </Typography>
                        ) : null}
                        {isAccountAccessMoment ? (
                          <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.78rem', mt: 0.35 }}>
                            Dette klientpunktet låser invite, OAuth eller publiseringstilgang før eksport og levering er helt trygg.
                          </Typography>
                        ) : null}
                        {moment.drivenByReview ? (
                          <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.78rem', mt: 0.35 }}>
                            {moment.reviewDecisionAt
                              ? `Sist oppdatert ${formatDate(moment.reviewDecisionAt)}`
                              : moment.reviewRequestedAt
                                ? `Sendt til klient ${formatDate(moment.reviewRequestedAt)}`
                                : 'Klientpunktet styres av reviewflyten'}
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack spacing={0.45} alignItems={{ md: 'flex-end' }}>
                        <Chip
                          size="small"
                          label={isContentLogicMoment ? 'Innholdsvalg' : isAccountAccessMoment ? 'Plattformtilgang' : PRODUCER_PLANNING_PHASE_LABELS[moment.phase]}
                          sx={{
                            bgcolor: isContentLogicMoment ? 'rgba(125,211,252,0.14)' : isAccountAccessMoment ? 'rgba(45,212,191,0.16)' : 'rgba(59,130,246,0.14)',
                            color: isContentLogicMoment ? '#cffafe' : isAccountAccessMoment ? '#ccfbf1' : '#bfdbfe',
                          }}
                        />
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem' }}>
                          {moment.date ? formatDate(moment.date) : 'Dato ikke satt'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
              {manifest.pendingClientMoments.length === 0 ? (
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.88rem' }}>
                  Ingen åpne klientpunkter. Faseplan og content-kalender er enten fullført eller ikke satt opp ennå.
                </Typography>
              ) : null}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                Kontotilgang
              </Typography>
              {onOpenMedia ? (
                <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(accountsWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Åpne kontotilgang
                </Button>
              ) : null}
            </Stack>
            <Stack spacing={0.7}>
              <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem' }}>
                {`${manifest.accountAccessSummary.connectedCount}/${manifest.accountAccessSummary.requiredPlatformCount} nødvendige plattformer er koblet. ${manifest.accountAccessSummary.clientActionCount} krever klienthandling. ${manifest.accountAccessSummary.inviteSentCount} venter på invite-bekreftelse.`}
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
                          <Chip size="small" label="Kreves" sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }} />
                        ) : null}
                      </Stack>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700 }}>
                        {`${entry.methodLabel} · ${entry.accessScope || 'Scope ikke satt'}`}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.78rem', mt: 0.2 }}>
                        {`Konto / side: ${entry.accountLabel || 'Ikke satt'} · Invite: ${entry.inviteTarget || 'Ikke satt'}`}
                      </Typography>
                      <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.76rem', mt: 0.2 }}>
                        {`Kontoeier: ${entry.clientOwnerLabel || 'Ikke satt'} · 2-faktor hos kontoeier: ${entry.twoFactorRequired ? 'Ja' : 'Nei'}`}
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
                  Sikkerhetsmodell
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem', mt: 0.2 }}>
                  {manifest.accountAccessSummary.securityNotes || 'Ikke satt'}
                </Typography>
                <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.78rem', mt: 0.25 }}>
                  {`Revoke-plan: ${manifest.accountAccessSummary.revokePlan || 'Ikke satt'}`}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                Leveransearbeidsområde
              </Typography>
              <Chip
                size="small"
                label={`${deliveryWorkspaceFiles.length} prosjektfiler`}
                sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
              />
            </Stack>
            <Stack spacing={0.85}>
              {deliveryWorkspaceFiles.length > 0 ? deliveryWorkspaceFiles.slice(0, 8).map((file) => (
                <Box
                  key={file.id}
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
                        {file.folderPath || 'Mappe ikke satt'}
                      </Typography>
                      <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.78rem', mt: 0.25 }}>
                        {`${file.packageName || 'Pakke ikke satt'} · ${file.versionLabel || 'uten versjon'} · ${file.workspaceType || 'arbeidsfil'}`}
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
                        Åpne fil
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              )) : (
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.88rem' }}>
                  Ingen leveransefiler er skrevet ennå. Bruk "Skriv leveransearbeidsområde" for å opprette faktiske prosjektfiler per leveransepunkt.
                </Typography>
              )}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                Juridiske dokumenter
              </Typography>
              <Chip
                size="small"
                label={`${legalAgreements.agreements.length} avtaler`}
                sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#e9d5ff' }}
              />
            </Stack>
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
                              label={`Juridisk signatur · ${getAgreementSignatureLabel(agreement.google_signature)}`}
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
                              Åpne i klientflate
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
                Ingen juridiske dokumenter er koblet til klientpakken ennå.
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                Klientinnspill før handoff
              </Typography>
              {onOpenMedia ? (
                <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(materialsWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Åpne brief og materiale
                </Button>
              ) : null}
            </Stack>
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
                        Åpne riktig side
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              ))}
              {openClientContributionTasks.length === 0 ? (
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.88rem' }}>
                  Klientgrunnlaget er komplett nok til å sende videre som handoff-pakke.
                </Typography>
              ) : null}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
              Leveranser og filnavn
            </Typography>
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
                        {item.publishDateLabel ?? 'Publiseringsdato ikke satt'}
                      </Typography>
                      {item.estimatedDurationLabel ? (
                        <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.78rem' }}>
                          Estimert lengde {item.estimatedDurationLabel}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>

        <Stack spacing={2}>
          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                Klientbrief og materiale
              </Typography>
              {onOpenMedia ? (
                <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(briefWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Åpne brief og materiale
                </Button>
              ) : null}
            </Stack>
            <Stack spacing={0.8}>
              {[
                ['Prosjektmål', clientIntake.projectGoal],
                ['Leveranser', clientIntake.deliverables],
                ['Målgruppe', clientIntake.targetAudience],
                ['Kjernebudskap', clientIntake.keyMessage],
                ['Kontakt', [clientIntake.contactName, clientIntake.contactEmail].filter(hasText).join(' · ')],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                    {hasText(value) ? value : 'Ikke fylt ut ennå.'}
                  </Typography>
                </Box>
              ))}
              <Divider sx={{ borderColor: 'rgba(148,163,184,0.14)' }} />
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                Materialtyper
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
                  Klienten har ikke lagt inn materiale ennå.
                </Typography>
              )}
              {prioritizedClientMaterials.length > 0 ? (
                <>
                  <Divider sx={{ borderColor: 'rgba(148,163,184,0.14)' }} />
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    Nøkkelmateriale for produksjonen
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
                            ].filter(hasText).join(' · ') || 'Ingen fil- eller kildeinfo lagt inn ennå.'}
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
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
              Prosjektramme
            </Typography>
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
                  Strategi, konsept og aktivering er ikke fylt ut ennå.
                </Typography>
              ) : null}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
              Content Logic
            </Typography>
            <Stack spacing={0.8}>
              {[
                { label: 'Mål', value: manifest.contentLogicSummary.objective },
                { label: 'Målgruppe', value: manifest.contentLogicSummary.audience },
                { label: 'Hook', value: manifest.contentLogicSummary.hook },
                { label: 'Budskap', value: manifest.contentLogicSummary.coreMessage },
                { label: 'CTA', value: manifest.contentLogicSummary.callToAction },
                { label: 'Distribusjon', value: manifest.contentLogicSummary.distributionPlan },
              ].map((item) => (
                <Box key={item.label}>
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                    {item.value || 'Ikke satt'}
                  </Typography>
                </Box>
              ))}
              {manifest.contentLogicSummary.proofPoints.length > 0 ? (
                <Box>
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 700 }}>
                    Bevis
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
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                Merkevareguide
              </Typography>
              {onOpenMedia ? (
                <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(brandWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Åpne merkevareguide
                </Button>
              ) : null}
            </Stack>
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
                  Logo i videoen
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
                    {`Anbefalt margin: ${manifest.overlayEditorGuidance.recommendedMargin.label}`}
                  </Typography>
                  <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.78rem' }}>
                    {manifest.overlayEditorGuidance.note}
                  </Typography>
                </Stack>
              </Box>
              {manifest.overlayFormatProfiles.length > 0 ? (
                <Box>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
                    Formatprofiler
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
                      {['Leveranse', 'Format', 'Valg', 'Brukes', 'Anbefalt'].map((label) => (
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
                          {`${item.recommendedLabel}${item.autoApplied ? ' · auto aktiv' : ''}`}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : null}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.58)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                Leveringsrutine
              </Typography>
              {onOpenMedia ? (
                <Button size="small" variant="outlined" startIcon={<LaunchIcon />} onClick={() => onOpenMedia(deliveryWorkspaceFocus)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Åpne leveringsrutine
                </Button>
              ) : null}
            </Stack>
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
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)' }} />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
        <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.82rem', maxWidth: 880 }}>
          Overleveringsbriefen bygger automatisk på retning, idé, aktivering, content-kalender, merkevareguide og leveringsrutine. Filnavn og klientpunkter følger prosjektets egne regler.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => { void handleDownloadPdf(); }}
            disabled={downloadingPdf}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#38bdf8', color: '#082f49', '&:hover': { bgcolor: '#0ea5e9' } }}
          >
            {downloadingPdf ? 'Genererer PDF…' : 'Last ned PDF'}
          </Button>
          <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => { void handleCopyBrief(); }} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Kopier overleveringsbrief
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadManifest} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Last ned manifest
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

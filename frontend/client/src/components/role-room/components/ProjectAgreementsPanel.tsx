import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Description as DescriptionIcon,
  Draw as DrawIcon,
  OpenInNew as OpenInNewIcon,
  ReceiptLong as ReceiptLongIcon,
  Send as SendIcon,
  TaskAlt as TaskAltIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useProject } from '@/contexts/ProjectContext';
import type {
  Candidate,
  CastingProject,
  ProducerCollaborationTerms,
  RoleRoomGoogleAgreementSignatureStatus,
} from '../models/casting';
import { useProducerReviews } from '../hooks/useProducerReviews';
import authSessionService from '../services/authSessionService';
import settingsService from '../services/settingsService';
import {
  googleWorkspaceApi,
  projectAgreementsApi,
  type ProjectAgreement,
  type RoleRoomGoogleStatusResponse,
  type ProjectAgreementStatus,
} from '../services/castingApiService';
import {
  producerWorkflowService,
  type ProducerClientReview,
} from '../services/producerWorkflowService';
import {
  emitProjectAgreementEvent,
  onProjectAgreementEvent,
} from '../services/projectAgreementEvents';
import {
  onProducerWorkflowFocusEvent,
  type ProducerWorkflowFocusPayload,
} from '../services/producerWorkflowFocusEvents';
import { shouldUseRoleRoomLocalFallback } from '../utils/runtime';
import {
  buildAgreementTimelineDescription,
  buildAgreementTimelinePayload,
  isAgreementTimelineItem,
  needsClientCollaborationReview,
} from '../utils/projectAgreementWorkflow';
import {
  buildAgreementSections,
  buildAgreementSummary,
  buildDefaultClientAgreementDraft,
  buildDefaultExtraAgreementDraft,
  CLIENT_AGREEMENT_TEMPLATE_GROUPS,
  EXTRA_AGREEMENT_TEMPLATE_OPTIONS,
  getAgreementClientFacingStatusSummary,
  getAgreementPrimarySignatureAction,
  getAgreementSignatureProgress,
  getAgreementSignatureLabel,
  getAgreementSignatureTone,
  getAgreementTemplateConfig,
  getAgreementTypeLabel,
  getAgreementWorkspaceArtifactId,
  PROJECT_AGREEMENT_COUNTERPARTY_LABELS,
  PROJECT_AGREEMENT_SIGNATURE_STATUS_LABELS,
  PROJECT_AGREEMENT_STATUS_LABELS,
  type ClientAgreementType,
  type ExtraAgreementType,
  type ProjectAgreementDraft,
} from '../utils/projectAgreements';
import {
  normalizeProducerProjectPlanning,
  PRODUCER_COLLABORATION_AGREEMENT_MODEL_LABELS,
  PRODUCER_COLLABORATION_COMPENSATION_MODEL_LABELS,
  PRODUCER_COLLABORATION_COST_COVERAGE_LABELS,
  PRODUCER_COLLABORATION_STATUS_LABELS,
} from '../utils/producerProjectPlanning';
import { getAbsoluteProjectFileUrl, normalizeProjectFileRecord } from '../utils/projectFiles';
import { runReceiptOcr } from '../utils/receiptOcr';
import type { ClientPortalWorkspaceFocus } from '../utils/clientPortal';
import OffersContractsPanel from './OffersContractsPanel';

interface ProjectAgreementsPanelProps {
  project: CastingProject;
  readOnly?: boolean;
  onProjectUpdated?: (project: CastingProject) => Promise<void> | void;
  onCandidateStatusChange?: (candidateId: string, status: string) => void;
  onOpenReviews?: (focus?: Partial<ProducerWorkflowFocusPayload>) => void;
  onOpenTimeline?: (focus?: Partial<ProducerWorkflowFocusPayload>) => void;
  onOpenMedia?: (focus?: ClientPortalWorkspaceFocus) => void;
}

const LOCAL_PROJECT_AGREEMENTS_NAMESPACE = 'role-room-project-agreements';

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const getCandidateEmail = (candidate?: Candidate): string => (
  readFirstNonEmptyString(
    candidate?.contactInfo?.email,
    candidate?.contact_info?.email,
    candidate?.email,
  ) ?? ''
);

const sortAgreements = (items: ProjectAgreement[]): ProjectAgreement[] => (
  [...items].sort((left, right) => {
    const leftTime = left.signed_date ?? left.updated_at ?? left.created_at ?? '';
    const rightTime = right.signed_date ?? right.updated_at ?? right.created_at ?? '';
    return rightTime.localeCompare(leftTime, 'nb-NO');
  })
);

const agreementStatusColor = (status: ProjectAgreementStatus): string => {
  if (status === 'signed') return '#10b981';
  if (status === 'sent') return '#f59e0b';
  return '#94a3b8';
};

const formatAgreementEventTime = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Venter på klient',
  approved: 'Godkjent',
  changes_requested: 'Endringer ønsket',
  rejected: 'Avvist',
};

const GOOGLE_SIGNATURE_TRANSITION_LABELS: Record<RoleRoomGoogleAgreementSignatureStatus, string> = {
  not_started: 'Ikke startet',
  prepared: 'Klargjort i Google',
  sent: 'Sendt til signering',
  opened_in_google: 'Åpnet i Google',
  signed: 'Signert i Google',
  rejected: 'Avvist',
  changes_requested: 'Endringer ønsket',
  error: 'Feil i signaturflyten',
};

const RECEIPT_OCR_STATUS_LABELS = {
  pending: 'Leser kvittering',
  completed: 'OCR klar',
  failed: 'OCR feilet',
  not_supported: 'Kun fil lagret',
} as const;

const RECEIPT_OCR_CONFIDENCE_LABELS = {
  low: 'Lav sikkerhet',
  medium: 'Middels sikkerhet',
  high: 'Høy sikkerhet',
} as const;

const getReviewSummaryCopy = (review: ProducerClientReview): string => {
  const timestamp = formatAgreementEventTime(review.decision_at ?? review.requested_at);
  if (review.status === 'approved') {
    return `Klienten har godkjent denne avtalen${timestamp ? ` · ${timestamp}` : ''}.`;
  }
  if (review.status === 'changes_requested' || review.status === 'rejected') {
    return `Klienten har bedt om endringer i denne avtalen${timestamp ? ` · ${timestamp}` : ''}.`;
  }
  return `Avtalen venter på klientbeslutning${timestamp ? ` · sendt ${timestamp}` : ''}.`;
};

const getGoogleSignatureSummaryCopy = (agreement: ProjectAgreement): string => {
  const signature = agreement.google_signature;
  if (!signature) {
    return 'Avtalen er ikke klargjort for Google-signatur ennå.';
  }

  const timestamp = formatAgreementEventTime(
    signature.signedAt
      ?? signature.sentAt
      ?? signature.preparedAt
      ?? signature.lastSyncedAt
      ?? null,
  );

  if (signature.status === 'signed') {
    return `Google-signatur er fullført${timestamp ? ` · ${timestamp}` : ''}.`;
  }
  if (signature.status === 'rejected' || signature.status === 'changes_requested') {
    return `${PROJECT_AGREEMENT_SIGNATURE_STATUS_LABELS[signature.status]} i Google${timestamp ? ` · ${timestamp}` : ''}.`;
  }
  if (signature.status === 'opened_in_google') {
    return `Avtalen er åpnet i Google og venter på bekreftet signering tilbake i prosjektet${timestamp ? ` · ${timestamp}` : ''}.`;
  }
  if (signature.status === 'sent') {
    return `Avtalen er sendt til Google-signatur${timestamp ? ` · ${timestamp}` : ''}.`;
  }
  return `Avtalen er klargjort for Google-signatur${timestamp ? ` · ${timestamp}` : ''}.`;
};

const mergeDraftPartyFields = (
  previous: ProjectAgreementDraft,
  next: ProjectAgreementDraft,
): ProjectAgreementDraft => ({
  ...next,
  disclosingPartyName: previous.disclosingPartyName || next.disclosingPartyName,
  disclosingPartyCompanyName: previous.disclosingPartyCompanyName || next.disclosingPartyCompanyName,
  disclosingPartyOrganizationNumber: previous.disclosingPartyOrganizationNumber || next.disclosingPartyOrganizationNumber,
  counterpartyName: previous.counterpartyName || next.counterpartyName,
  counterpartyEmail: previous.counterpartyEmail || next.counterpartyEmail,
  counterpartyCompanyName: previous.counterpartyCompanyName || next.counterpartyCompanyName,
  counterpartyOrganizationNumber: previous.counterpartyOrganizationNumber || next.counterpartyOrganizationNumber,
  counterpartyId: previous.counterpartyId || next.counterpartyId,
  startDate: previous.startDate || next.startDate,
  endDate: previous.endDate || next.endDate,
});

const buildAgreementSectionsForDraft = (
  project: CastingProject,
  counterpartyType: 'client' | 'extra',
  draft: ProjectAgreementDraft,
): ProjectAgreement['sections'] => buildAgreementSections({
  projectName: project.name,
  agreementType: draft.agreementType,
  counterpartyType,
  disclosingPartyName: draft.disclosingPartyName,
  disclosingPartyCompanyName: draft.disclosingPartyCompanyName,
  disclosingPartyOrganizationNumber: draft.disclosingPartyOrganizationNumber,
  counterpartyName: draft.counterpartyName,
  counterpartyEmail: draft.counterpartyEmail,
  counterpartyCompanyName: draft.counterpartyCompanyName,
  counterpartyOrganizationNumber: draft.counterpartyOrganizationNumber,
  purpose: draft.purpose,
  details: draft.details,
  commercialTerms: draft.commercialTerms,
  startDate: draft.startDate,
  endDate: draft.endDate,
});

const ProjectAgreementsPanel: FC<ProjectAgreementsPanelProps> = ({
  project,
  readOnly = false,
  onProjectUpdated,
  onCandidateStatusChange,
  onOpenReviews,
  onOpenTimeline,
  onOpenMedia,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const { uploadProjectFile } = useProject();
  const [tabValue, setTabValue] = useState(0);
  const [agreements, setAgreements] = useState<ProjectAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleStatusLoading, setGoogleStatusLoading] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<RoleRoomGoogleStatusResponse | null>(null);
  const [signatureBusyAgreementId, setSignatureBusyAgreementId] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [extraDialogOpen, setExtraDialogOpen] = useState(false);
  const [previewAgreement, setPreviewAgreement] = useState<ProjectAgreement | null>(null);
  const [highlightedAgreementId, setHighlightedAgreementId] = useState<string | null>(null);
  const [pendingAgreementFocusId, setPendingAgreementFocusId] = useState<string | null>(null);
  const [expandedSignatureControlsAgreementId, setExpandedSignatureControlsAgreementId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState<ProjectAgreementDraft>({
    agreementType: 'startup_collaboration',
    title: '',
    purpose: '',
    details: '',
    commercialTerms: '',
    disclosingPartyName: '',
    disclosingPartyCompanyName: '',
    disclosingPartyOrganizationNumber: '',
    counterpartyName: '',
    counterpartyEmail: '',
    counterpartyCompanyName: '',
    counterpartyOrganizationNumber: '',
    startDate: '',
    endDate: '',
  });
  const [extraDraft, setExtraDraft] = useState<ProjectAgreementDraft>({
    agreementType: 'extra_terms',
    title: '',
    purpose: '',
    details: '',
    commercialTerms: '',
    disclosingPartyName: '',
    disclosingPartyCompanyName: '',
    disclosingPartyOrganizationNumber: '',
    counterpartyName: '',
    counterpartyEmail: '',
    counterpartyCompanyName: '',
    counterpartyOrganizationNumber: '',
    startDate: '',
    endDate: '',
  });
  const [collaborationDraft, setCollaborationDraft] = useState<ProducerCollaborationTerms>({});
  const [uploadingReceiptItemId, setUploadingReceiptItemId] = useState<string | null>(null);
  const [receiptOcrProgress, setReceiptOcrProgress] = useState<Record<string, number>>({});
  const useLocalFallback = shouldUseRoleRoomLocalFallback();
  const agreementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoSyncedAgreementMarkersRef = useRef<Record<string, string>>({});

  const currentUserLabel = useMemo(() => {
    const session = authSessionService.getSessionSync();
    return readFirstNonEmptyString(
      session.adminUser?.display_name,
      session.adminUser?.name,
      session.adminUser?.email,
    ) ?? '';
  }, []);
  const producerPlanning = useMemo(
    () => normalizeProducerProjectPlanning(project),
    [project],
  );
  const collaborationTerms = producerPlanning.collaborationTerms ?? null;
  const canEditCollaborationTerms = !readOnly && typeof onProjectUpdated === 'function';

  const updateCollaborationTerms = useCallback(async (
    updater: (current: ProducerCollaborationTerms) => ProducerCollaborationTerms,
  ) => {
    if (!onProjectUpdated) {
      return;
    }
    const nextCurrent = normalizeProducerProjectPlanning(project).collaborationTerms ?? {};
    const nextTerms = updater(nextCurrent);
    const nextProject: CastingProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      producerPlanning: {
        ...normalizeProducerProjectPlanning(project),
        collaborationTerms: nextTerms,
        updatedAt: new Date().toISOString(),
      },
    };
    await onProjectUpdated(nextProject);
  }, [onProjectUpdated, project]);

  const updateCollaborationTextList = useCallback(async (
    key: keyof Pick<
      ProducerCollaborationTerms,
      'deliverablesInScope'
      | 'productionResponsibilities'
      | 'brandingResponsibilities'
      | 'marketingResponsibilities'
    >,
    value: string,
  ) => {
    const items = value
      .split('\n')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    await updateCollaborationTerms((current) => ({
      ...current,
      [key]: items,
    }));
  }, [updateCollaborationTerms]);

  const updateCollaborationCostItemDraft = useCallback((
    itemId: string,
    updater: (item: NonNullable<ProducerCollaborationTerms['costItems']>[number]) => NonNullable<ProducerCollaborationTerms['costItems']>[number],
  ) => {
    setCollaborationDraft((prev) => ({
      ...prev,
      costItems: (prev.costItems ?? []).map((entry) => (
        entry.id === itemId ? updater(entry) : entry
      )),
    }));
  }, []);

  const persistCollaborationCostItem = useCallback(async (
    itemId: string,
    updater: (item: NonNullable<ProducerCollaborationTerms['costItems']>[number]) => NonNullable<ProducerCollaborationTerms['costItems']>[number],
  ) => {
    await updateCollaborationTerms((current) => ({
      ...current,
      costItems: (current.costItems ?? []).map((entry) => (
        entry.id === itemId ? updater(entry) : entry
      )),
    }));
  }, [updateCollaborationTerms]);

  useEffect(() => {
    setCollaborationDraft(producerPlanning.collaborationTerms ?? {});
  }, [producerPlanning.collaborationTerms, project.id]);

  const persistCollaborationDraft = useCallback(async () => {
    if (!canEditCollaborationTerms) {
      return;
    }
    await updateCollaborationTerms(() => ({
      ...collaborationDraft,
    }));
    enqueueSnackbar('Samarbeidsrammen er oppdatert.', { variant: 'success' });
  }, [canEditCollaborationTerms, collaborationDraft, enqueueSnackbar, updateCollaborationTerms]);

  const deliverablesInScopeValue = (collaborationDraft.deliverablesInScope ?? []).join('\n');
  const productionResponsibilitiesValue = (collaborationDraft.productionResponsibilities ?? []).join('\n');
  const brandingResponsibilitiesValue = (collaborationDraft.brandingResponsibilities ?? []).join('\n');
  const marketingResponsibilitiesValue = (collaborationDraft.marketingResponsibilities ?? []).join('\n');
  const handleReceiptUpload = useCallback(async (itemId: string, file: File) => {
    if (!canEditCollaborationTerms) {
      return;
    }

    const currentItem = (collaborationDraft.costItems ?? []).find((entry) => entry.id === itemId);
    if (!currentItem) {
      return;
    }

    setUploadingReceiptItemId(itemId);
    updateCollaborationCostItemDraft(itemId, (entry) => ({
      ...entry,
      ocrStatus: file.type.startsWith('image/') ? 'pending' : 'not_supported',
      ocrConfidence: undefined,
    }));

    try {
      const ocrResult = await runReceiptOcr(file, {
        onProgress: (progress) => {
          setReceiptOcrProgress((prev) => ({ ...prev, [itemId]: progress.progress }));
        },
      });

      const uploadResponse = await uploadProjectFile(project.id, file, {
        module: 'role_room_collaboration_receipt',
        source: 'role_room_collaboration_cost',
        collaborationCostItemId: itemId,
        collaborationCostLabel: currentItem.label,
        receiptMerchant: ocrResult.merchant,
        receiptDate: ocrResult.date,
        receiptAmountValue: ocrResult.amountValue,
        receiptAmountLabel: ocrResult.amountLabel,
        ocrStatus: ocrResult.status,
        ocrConfidence: ocrResult.confidence,
        ocrText: ocrResult.text,
      });

      const uploadedFile = normalizeProjectFileRecord(uploadResponse);
      const receiptUrl = uploadedFile ? getAbsoluteProjectFileUrl(uploadedFile.downloadUrl) || uploadedFile.downloadUrl || '' : '';
      const summaryParts = [
        ocrResult.merchant,
        ocrResult.amountLabel,
        ocrResult.date,
      ].filter((value) => typeof value === 'string' && value.trim().length > 0);

      const nextNotes = currentItem.notes?.trim()
        ? currentItem.notes
        : summaryParts.length > 0
          ? `Kvittering: ${summaryParts.join(' · ')}`
          : currentItem.notes ?? '';

      const updateItem = (
        entry: NonNullable<ProducerCollaborationTerms['costItems']>[number],
      ): NonNullable<ProducerCollaborationTerms['costItems']>[number] => ({
        ...entry,
        receiptFileId: uploadedFile?.id ?? entry.receiptFileId ?? '',
        receiptFileName: uploadedFile?.name ?? file.name,
        receiptUrl: receiptUrl || entry.receiptUrl || '',
        receiptMerchant: ocrResult.merchant || entry.receiptMerchant || '',
        receiptDate: ocrResult.date || entry.receiptDate || '',
        receiptAmountValue: typeof ocrResult.amountValue === 'number'
          ? ocrResult.amountValue
          : entry.receiptAmountValue,
        amountLabel: ocrResult.amountLabel || entry.amountLabel || '',
        notes: nextNotes,
        ocrStatus: ocrResult.status,
        ocrConfidence: ocrResult.confidence,
      });

      updateCollaborationCostItemDraft(itemId, updateItem);
      await persistCollaborationCostItem(itemId, updateItem);

      if (ocrResult.status === 'completed') {
        enqueueSnackbar('Kvittering lagret og lest med OCR.', { variant: 'success' });
      } else {
        enqueueSnackbar('Kvittering lagret. OCR trengte manuell oppfolging.', { variant: 'info' });
      }
    } catch (receiptError) {
      console.error('[ProjectAgreementsPanel] Failed to upload collaboration receipt', receiptError);
      updateCollaborationCostItemDraft(itemId, (entry) => ({
        ...entry,
        ocrStatus: 'failed',
        ocrConfidence: 'low',
      }));
      enqueueSnackbar('Kunne ikke laste opp kvitteringen.', { variant: 'error' });
    } finally {
      setUploadingReceiptItemId((current) => (current === itemId ? null : current));
      setReceiptOcrProgress((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }, [
    canEditCollaborationTerms,
    collaborationDraft.costItems,
    enqueueSnackbar,
    persistCollaborationCostItem,
    project.id,
    updateCollaborationCostItemDraft,
    uploadProjectFile,
  ]);
  const {
    items: reviewItems,
    summary: reviewSummary,
    loading: reviewsLoading,
  } = useProducerReviews(project.id);

  const clientTemplateConfig = useMemo(
    () => getAgreementTemplateConfig(clientDraft.agreementType),
    [clientDraft.agreementType],
  );
  const extraTemplateConfig = useMemo(
    () => getAgreementTemplateConfig(extraDraft.agreementType),
    [extraDraft.agreementType],
  );

  const clientAgreements = useMemo(
    () => agreements.filter((agreement) => agreement.counterparty_type === 'client'),
    [agreements],
  );
  const extraAgreements = useMemo(
    () => agreements.filter((agreement) => agreement.counterparty_type === 'extra'),
    [agreements],
  );
  const sortedReviewItems = useMemo(
    () => [...reviewItems].sort((left, right) => {
      const leftTime = left.decision_at ?? left.requested_at ?? '';
      const rightTime = right.decision_at ?? right.requested_at ?? '';
      return rightTime.localeCompare(leftTime, 'nb-NO');
    }),
    [reviewItems],
  );
  const statusDriverReview = useMemo(() => {
    if (project.producerWorkflowStatus === 'changes_requested') {
      return sortedReviewItems.find((review) => (
        review.status === 'changes_requested' || review.status === 'rejected'
      )) ?? null;
    }
    if (project.producerWorkflowStatus === 'awaiting_client') {
      return sortedReviewItems.find((review) => (
        review.status !== 'approved' && review.status !== 'changes_requested' && review.status !== 'rejected'
      )) ?? null;
    }
    if (project.producerWorkflowStatus === 'approved') {
      return sortedReviewItems.find((review) => review.status === 'approved') ?? null;
    }
    return null;
  }, [project.producerWorkflowStatus, sortedReviewItems]);
  const agreementReviewByAgreementId = useMemo(
    () => sortedReviewItems.reduce<Record<string, ProducerClientReview>>((next, review) => {
      const agreementId = readFirstNonEmptyString(
        review.target_entity_type === 'project_agreement' ? review.target_entity_id : undefined,
        review.metadata?.agreementId,
      );
      if (agreementId && !next[agreementId]) {
        next[agreementId] = review;
      }
      return next;
    }, {}),
    [sortedReviewItems],
  );
  const clientAgreementStatusSummary = useMemo(() => clientAgreements.reduce(
    (summary, agreement) => {
      const linkedReview = agreementReviewByAgreementId[agreement.id];
      if (!linkedReview) {
        summary.withoutReview += 1;
        return summary;
      }
      if (linkedReview.status === 'approved') {
        summary.approved += 1;
      } else if (linkedReview.status === 'changes_requested' || linkedReview.status === 'rejected') {
        summary.changesRequested += 1;
      } else {
        summary.pending += 1;
      }
      return summary;
    },
    { pending: 0, approved: 0, changesRequested: 0, withoutReview: 0 },
  ), [agreementReviewByAgreementId, clientAgreements]);
  const statusDriverAgreement = useMemo(() => {
    if (!statusDriverReview) {
      return null;
    }
    const agreementId = readFirstNonEmptyString(
      statusDriverReview.target_entity_type === 'project_agreement' ? statusDriverReview.target_entity_id : undefined,
      statusDriverReview.metadata?.agreementId,
    );
    if (!agreementId) {
      return null;
    }
    return agreements.find((agreement) => agreement.id === agreementId) ?? null;
  }, [agreements, statusDriverReview]);

  const clientPreviewSections = useMemo(
    () => buildAgreementSectionsForDraft(project, 'client', clientDraft),
    [clientDraft, project],
  );
  const extraPreviewSections = useMemo(
    () => buildAgreementSectionsForDraft(project, 'extra', extraDraft),
    [extraDraft, project],
  );

  const readLocalAgreements = useCallback(async (): Promise<ProjectAgreement[]> => {
    const stored = await settingsService.getSetting<ProjectAgreement[]>(LOCAL_PROJECT_AGREEMENTS_NAMESPACE, {
      projectId: project.id,
    });
    return sortAgreements(stored ?? []);
  }, [project.id]);

  const writeLocalAgreements = useCallback(async (nextAgreements: ProjectAgreement[]): Promise<ProjectAgreement[]> => {
    const sorted = sortAgreements(nextAgreements);
    await settingsService.setSetting(LOCAL_PROJECT_AGREEMENTS_NAMESPACE, sorted, {
      projectId: project.id,
    });
    return sorted;
  }, [project.id]);

  const buildDraftAgreementRecord = useCallback((
    agreementId: string,
    counterpartyType: 'client' | 'extra',
    draft: ProjectAgreementDraft,
    sections: ProjectAgreement['sections'],
  ): ProjectAgreement => ({
    id: agreementId,
    project_id: project.id,
    agreement_type: draft.agreementType,
    counterparty_type: counterpartyType,
    counterparty_id: counterpartyType === 'extra' ? draft.counterpartyId : undefined,
    title: draft.title,
    purpose: draft.purpose,
    disclosing_party_name: draft.disclosingPartyName,
    disclosing_party_company_name: draft.disclosingPartyCompanyName,
    disclosing_party_organization_number: draft.disclosingPartyOrganizationNumber,
    counterparty_name: draft.counterpartyName,
    counterparty_email: draft.counterpartyEmail,
    counterparty_company_name: draft.counterpartyCompanyName,
    counterparty_organization_number: draft.counterpartyOrganizationNumber,
    sections,
    start_date: draft.startDate || undefined,
    end_date: draft.endDate || undefined,
    status: 'draft',
    metadata: {
      template: draft.agreementType,
      projectName: project.name,
      details: draft.details,
      commercialTerms: draft.commercialTerms,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }), [project.id, project.name]);

  const syncAgreementTimeline = useCallback(async (agreement: ProjectAgreement) => {
    try {
      const timelineItems = await producerWorkflowService.getTimeline(project.id);
      const existingTimelineItem = timelineItems.find((item) => isAgreementTimelineItem(item, agreement.id));
      const payload = buildAgreementTimelinePayload(agreement);

      if (existingTimelineItem) {
        await producerWorkflowService.updateTimelineItem(project.id, existingTimelineItem.id, payload);
        return;
      }

      await producerWorkflowService.createTimelineItem(project.id, payload);
    } catch (error) {
      console.error('[ProjectAgreementsPanel] Failed to sync agreement timeline item', error);
      enqueueSnackbar('Avtalen ble lagret, men kunne ikke synkroniseres til økonomitidslinjen.', {
        variant: 'warning',
      });
    }
  }, [enqueueSnackbar, project.id]);

  const syncAgreementReview = useCallback(async (agreement: ProjectAgreement) => {
    if (!needsClientCollaborationReview(agreement) || agreement.status === 'draft') {
      return;
    }

    try {
      const reviews = await producerWorkflowService.getReviews(project.id);
      const matchingReviews = reviews.filter((review) => (
        (review.target_entity_type === 'project_agreement' && review.target_entity_id === agreement.id)
        || readFirstNonEmptyString(review.metadata?.agreementId) === agreement.id
      ));
      const pendingReview = matchingReviews.find((review) => review.status === 'pending');
      const latestMatchingReview = matchingReviews[0];

      const reviewPayload = {
        reviewType: String(agreement.agreement_type),
        title: agreement.title,
        description: buildAgreementTimelineDescription(agreement),
        targetEntityType: 'project_agreement',
        targetEntityId: agreement.id,
        dueAt: agreement.end_date ?? agreement.start_date ?? undefined,
        metadata: {
          ...(agreement.metadata ?? {}),
          source: 'project-agreement-sync',
          agreementId: agreement.id,
          agreementType: agreement.agreement_type,
          counterpartyType: agreement.counterparty_type,
          agreementStatus: agreement.status,
          projectName: project.name,
        },
      };

      const review = agreement.status === 'sent'
        ? pendingReview ?? await producerWorkflowService.createReviewWithTimeline(project.id, reviewPayload)
        : latestMatchingReview ?? await producerWorkflowService.createReviewWithTimeline(project.id, reviewPayload);

      const signatureStatus = agreement.google_signature?.status;

      if (agreement.status === 'signed' && review.status !== 'approved') {
        await producerWorkflowService.setReviewDecisionWithTimeline(project.id, review.id, {
          decision: 'approved',
          reason: 'Avtalen er signert og markert som fullført i prosjektets økonomi.',
        });
      } else if (signatureStatus === 'changes_requested' && review.status !== 'changes_requested') {
        await producerWorkflowService.setReviewDecisionWithTimeline(project.id, review.id, {
          decision: 'changes_requested',
          reason: 'Motparten har bedt om endringer i Google-signaturflyten.',
        });
      } else if (signatureStatus === 'rejected' && review.status !== 'rejected') {
        await producerWorkflowService.setReviewDecisionWithTimeline(project.id, review.id, {
          decision: 'rejected',
          reason: 'Motparten har avslått avtalen i Google-signaturflyten.',
        });
      }
    } catch (error) {
      console.error('[ProjectAgreementsPanel] Failed to sync agreement review item', error);
      enqueueSnackbar('Avtalen ble lagret, men kunne ikke synkroniseres til klientsamarbeid.', {
        variant: 'warning',
      });
    }
  }, [enqueueSnackbar, project.id, project.name]);

  const loadAgreements = useCallback(async () => {
    setLoading(true);
    try {
      const nextAgreements = useLocalFallback
        ? await readLocalAgreements()
        : await projectAgreementsApi.getAll(project.id);
      setAgreements(sortAgreements(nextAgreements));
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke laste prosjektavtaler',
        { variant: 'error' },
      );
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, project.id, readLocalAgreements, useLocalFallback]);

  const loadGoogleStatus = useCallback(async () => {
    if (useLocalFallback) {
      setGoogleStatus(null);
      return;
    }
    setGoogleStatusLoading(true);
    try {
      setGoogleStatus(await googleWorkspaceApi.getStatus(project.id));
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke laste signeringsgrunnlag',
        { variant: 'warning' },
      );
    } finally {
      setGoogleStatusLoading(false);
    }
  }, [enqueueSnackbar, project.id, useLocalFallback]);

  useEffect(() => {
    void loadAgreements();
  }, [loadAgreements]);

  useEffect(() => {
    void loadGoogleStatus();
  }, [loadGoogleStatus]);

  useEffect(() => onProjectAgreementEvent((payload) => {
    if (payload.projectId !== project.id) {
      return;
    }
    void loadAgreements();
    void loadGoogleStatus();
  }), [loadAgreements, loadGoogleStatus, project.id]);

  useEffect(() => onProducerWorkflowFocusEvent((payload) => {
    if (payload.projectId !== project.id || payload.panel !== 'economy') {
      return;
    }

    const focusedAgreementId = payload.agreementId
      ?? (payload.linkedEntityType === 'project_agreement' ? payload.linkedEntityId : undefined);
    if (!focusedAgreementId) {
      return;
    }

    setPendingAgreementFocusId(focusedAgreementId);
  }), [project.id]);

  useEffect(() => {
    if (!pendingAgreementFocusId) {
      return;
    }

    const targetAgreement = agreements.find((agreement) => agreement.id === pendingAgreementFocusId);
    if (!targetAgreement) {
      return;
    }

    setPendingAgreementFocusId(null);
    setTabValue(targetAgreement.counterparty_type === 'client' ? 1 : 2);
    setHighlightedAgreementId(pendingAgreementFocusId);

    window.setTimeout(() => {
      agreementRefs.current[pendingAgreementFocusId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
  }, [agreements, pendingAgreementFocusId]);

  useEffect(() => {
    if (!highlightedAgreementId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedAgreementId((current) => (
        current === highlightedAgreementId ? null : current
      ));
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedAgreementId]);

  const openClientAgreementDialog = () => {
    setClientDraft(buildDefaultClientAgreementDraft(project, currentUserLabel, 'startup_collaboration'));
    setClientDialogOpen(true);
  };

  const openExtraAgreementDialog = () => {
    setExtraDraft(buildDefaultExtraAgreementDraft(project, project.candidates[0], currentUserLabel, 'extra_terms'));
    setExtraDialogOpen(true);
  };

  const handleClientTemplateChange = (agreementType: ClientAgreementType) => {
    setClientDraft((previous) => mergeDraftPartyFields(
      previous,
      buildDefaultClientAgreementDraft(project, currentUserLabel, agreementType),
    ));
  };

  const handleExtraTemplateChange = (agreementType: ExtraAgreementType) => {
    const selectedCandidate = project.candidates.find((candidate) => candidate.id === extraDraft.counterpartyId);
    setExtraDraft((previous) => mergeDraftPartyFields(
      previous,
      buildDefaultExtraAgreementDraft(project, selectedCandidate, currentUserLabel, agreementType),
    ));
  };

  const handleExtraCandidateChange = (candidateId: string) => {
    const selectedCandidate = project.candidates.find((candidate) => candidate.id === candidateId);
    const defaultDraft = buildDefaultExtraAgreementDraft(
      project,
      selectedCandidate,
      currentUserLabel,
      extraDraft.agreementType as ExtraAgreementType,
    );

    setExtraDraft((previous) => ({
      ...previous,
      counterpartyId: selectedCandidate?.id,
      counterpartyName: selectedCandidate?.name ?? '',
      counterpartyEmail: getCandidateEmail(selectedCandidate),
      title: defaultDraft.title,
    }));
  };

  const createAgreement = async (
    counterpartyType: 'client' | 'extra',
    draft: ProjectAgreementDraft,
    sections: ProjectAgreement['sections'],
  ) => {
    setSubmitting(true);
    try {
      let createdAgreement: ProjectAgreement;
      if (useLocalFallback) {
        createdAgreement = buildDraftAgreementRecord(
          `agreement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          counterpartyType,
          draft,
          sections,
        );
        setAgreements(await writeLocalAgreements([...agreements, createdAgreement]));
      } else {
        const agreementId = await projectAgreementsApi.create({
          projectId: project.id,
          agreementType: draft.agreementType,
          counterpartyType,
          counterpartyId: counterpartyType === 'extra' ? draft.counterpartyId : undefined,
          title: draft.title,
          purpose: draft.purpose,
          disclosingPartyName: draft.disclosingPartyName,
          disclosingPartyCompanyName: draft.disclosingPartyCompanyName,
          disclosingPartyOrganizationNumber: draft.disclosingPartyOrganizationNumber,
          counterpartyName: draft.counterpartyName,
          counterpartyEmail: draft.counterpartyEmail,
          counterpartyCompanyName: draft.counterpartyCompanyName,
          counterpartyOrganizationNumber: draft.counterpartyOrganizationNumber,
          sections: sections ?? [],
          startDate: draft.startDate || undefined,
          endDate: draft.endDate || undefined,
          metadata: {
            template: draft.agreementType,
            projectName: project.name,
            details: draft.details,
            commercialTerms: draft.commercialTerms,
          },
        });
        const refreshedAgreements = sortAgreements(await projectAgreementsApi.getAll(project.id));
        setAgreements(refreshedAgreements);
        createdAgreement = refreshedAgreements.find((agreement) => agreement.id === agreementId)
          ?? buildDraftAgreementRecord(agreementId, counterpartyType, draft, sections);
      }

      await syncAgreementTimeline(createdAgreement);
      await syncAgreementReview(createdAgreement);
      emitProjectAgreementEvent({
        projectId: project.id,
        mutation: 'created',
        agreementId: createdAgreement.id,
      });

      enqueueSnackbar(
        counterpartyType === 'client'
          ? `${clientTemplateConfig.shortLabel} opprettet.`
          : `${extraTemplateConfig.shortLabel} opprettet.`,
        { variant: 'success' },
      );
      setClientDialogOpen(false);
      setExtraDialogOpen(false);
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke opprette prosjektavtalen',
        { variant: 'error' },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAgreementStatus = async (agreementId: string, status: ProjectAgreementStatus) => {
    try {
      let targetAgreement: ProjectAgreement | undefined;
      if (useLocalFallback) {
        const nextAgreements = agreements.map((agreement) => (
          agreement.id === agreementId
            ? {
                ...agreement,
                status,
                signed_date: status === 'signed' ? new Date().toISOString() : agreement.signed_date,
                updated_at: new Date().toISOString(),
              }
            : agreement
        ));
        const persistedAgreements = await writeLocalAgreements(nextAgreements);
        setAgreements(persistedAgreements);
        targetAgreement = persistedAgreements.find((agreement) => agreement.id === agreementId);
      } else {
        await projectAgreementsApi.updateStatus(agreementId, status);
        const refreshedAgreements = sortAgreements(await projectAgreementsApi.getAll(project.id));
        setAgreements(refreshedAgreements);
        targetAgreement = refreshedAgreements.find((agreement) => agreement.id === agreementId);
      }

      if (targetAgreement) {
        await syncAgreementTimeline(targetAgreement);
        await syncAgreementReview(targetAgreement);
        emitProjectAgreementEvent({
          projectId: project.id,
          mutation: 'status_updated',
          agreementId: targetAgreement.id,
        });
      }

      if (
        targetAgreement?.counterparty_type === 'extra'
        && targetAgreement.counterparty_id
        && onCandidateStatusChange
        && status === 'signed'
      ) {
        onCandidateStatusChange(targetAgreement.counterparty_id, 'contracted');
      }

      enqueueSnackbar(
        status === 'sent' ? 'Avtalen er markert som sendt.' : 'Avtalen er markert som signert.',
        { variant: 'success' },
      );
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke oppdatere avtalestatus',
        { variant: 'error' },
      );
    }
  };

  const persistLocalAgreement = useCallback(async (updatedAgreement: ProjectAgreement): Promise<ProjectAgreement> => {
    const nextAgreements = agreements.map((agreement) => (
      agreement.id === updatedAgreement.id ? updatedAgreement : agreement
    ));
    const persistedAgreements = await writeLocalAgreements(nextAgreements);
    setAgreements(persistedAgreements);
    return persistedAgreements.find((agreement) => agreement.id === updatedAgreement.id) ?? updatedAgreement;
  }, [agreements, writeLocalAgreements]);

  const handlePrepareGoogleSignature = useCallback(async (agreement: ProjectAgreement) => {
    setSignatureBusyAgreementId(agreement.id);
    try {
      let updatedAgreement: ProjectAgreement;
      if (useLocalFallback) {
        const now = new Date().toISOString();
        updatedAgreement = await persistLocalAgreement({
          ...agreement,
          status: 'draft',
          signed_date: undefined,
          updated_at: now,
          google_signature: {
            id: `local-google-signature-${agreement.id}`,
            projectId: project.id,
            agreementId: agreement.id,
            provider: 'google_workspace',
            status: 'prepared',
            documentTitle: agreement.title,
            counterpartyName: agreement.counterparty_name,
            counterpartyEmail: agreement.counterparty_email,
            preparedAt: now,
            lastSyncedAt: now,
            metadata: {},
          },
        });
      } else {
        const response = await projectAgreementsApi.prepareGoogleSignature(project.id, agreement.id);
        updatedAgreement = response.agreement;
      }

      await syncAgreementTimeline(updatedAgreement);
      await syncAgreementReview(updatedAgreement);
      emitProjectAgreementEvent({
        projectId: project.id,
        mutation: 'signature_updated',
        agreementId: agreement.id,
      });
      enqueueSnackbar('Avtalen er klargjort for Google-signatur.', { variant: 'success' });
      void loadAgreements();
      void loadGoogleStatus();
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke klargjøre Google-signatur',
        { variant: 'error' },
      );
    } finally {
      setSignatureBusyAgreementId(null);
    }
  }, [enqueueSnackbar, loadAgreements, loadGoogleStatus, persistLocalAgreement, project.id, syncAgreementReview, syncAgreementTimeline, useLocalFallback]);

  const applyGoogleSignatureStatusUpdate = useCallback(async (
    agreement: ProjectAgreement,
    status: RoleRoomGoogleAgreementSignatureStatus,
    options?: { silent?: boolean; skipReload?: boolean; successMessage?: string },
  ): Promise<ProjectAgreement> => {
    const { silent = false, skipReload = false, successMessage } = options ?? {};
    let updatedAgreement: ProjectAgreement;
    if (useLocalFallback) {
      const now = new Date().toISOString();
      const existingSignature = agreement.google_signature;
      const shouldStoreAudit = status === 'signed' || status === 'rejected' || status === 'changes_requested';
      const signedPdfArtifactId = status === 'signed'
        ? existingSignature?.signedPdfArtifactId ?? `local-signed-pdf-${agreement.id}`
        : existingSignature?.signedPdfArtifactId ?? null;
      const auditArtifactId = shouldStoreAudit
        ? existingSignature?.auditArtifactId ?? `local-audit-${agreement.id}`
        : existingSignature?.auditArtifactId ?? null;
      updatedAgreement = await persistLocalAgreement({
        ...agreement,
        status: status === 'signed' ? 'signed' : status === 'prepared' ? 'draft' : 'sent',
        signed_date: status === 'signed' ? now : agreement.signed_date,
        updated_at: now,
        google_signature: {
          id: existingSignature?.id ?? `local-google-signature-${agreement.id}`,
          projectId: project.id,
          agreementId: agreement.id,
          provider: 'google_workspace',
          status,
          documentTitle: agreement.title,
          counterpartyName: agreement.counterparty_name,
          counterpartyEmail: agreement.counterparty_email,
          preparedAt: existingSignature?.preparedAt ?? now,
          sentAt: status === 'sent'
            ? now
            : status === 'opened_in_google'
              ? existingSignature?.sentAt ?? now
              : existingSignature?.sentAt,
          signedAt: status === 'signed' ? now : existingSignature?.signedAt,
          declinedAt: status === 'rejected' || status === 'changes_requested' ? now : existingSignature?.declinedAt,
          lastOpenedAt: status === 'opened_in_google' ? now : existingSignature?.lastOpenedAt,
          requestUrl: existingSignature?.requestUrl ?? existingSignature?.webViewUrl ?? null,
          webViewUrl: existingSignature?.webViewUrl ?? existingSignature?.requestUrl ?? null,
          sourceArtifactId: existingSignature?.sourceArtifactId ?? null,
          pdfSnapshotArtifactId: existingSignature?.pdfSnapshotArtifactId ?? null,
          signedPdfArtifactId,
          auditArtifactId,
          signedDriveFileId: status === 'signed'
            ? existingSignature?.signedDriveFileId ?? `local-signed-drive-${agreement.id}`
            : existingSignature?.signedDriveFileId ?? null,
          lastSyncedAt: now,
          metadata: {
            ...(existingSignature?.metadata ?? {}),
            ...(shouldStoreAudit ? { auditArtifactId } : {}),
            ...(status === 'signed' ? { signedPdfArtifactId, syncedFromGoogleAt: now } : {}),
          },
        },
      });
    } else {
      const response = await projectAgreementsApi.updateGoogleSignatureStatus(project.id, agreement.id, status);
      updatedAgreement = response.agreement;
    }

    await syncAgreementTimeline(updatedAgreement);
    await syncAgreementReview(updatedAgreement);
    emitProjectAgreementEvent({
      projectId: project.id,
      mutation: 'signature_updated',
      agreementId: agreement.id,
    });

    if (
      updatedAgreement.counterparty_type === 'extra'
      && updatedAgreement.counterparty_id
      && onCandidateStatusChange
      && status === 'signed'
    ) {
      onCandidateStatusChange(updatedAgreement.counterparty_id, 'contracted');
    }

    if (!silent) {
      enqueueSnackbar(
        successMessage ?? `Google-signatur oppdatert: ${GOOGLE_SIGNATURE_TRANSITION_LABELS[status].toLowerCase()}.`,
        { variant: 'success' },
      );
    }
    if (!skipReload) {
      void loadAgreements();
      void loadGoogleStatus();
    }
    return updatedAgreement;
  }, [enqueueSnackbar, loadAgreements, loadGoogleStatus, onCandidateStatusChange, persistLocalAgreement, project.id, syncAgreementReview, syncAgreementTimeline, useLocalFallback]);

  const handleUpdateGoogleSignatureStatus = useCallback(async (
    agreement: ProjectAgreement,
    status: RoleRoomGoogleAgreementSignatureStatus,
  ) => {
    setSignatureBusyAgreementId(agreement.id);
    try {
      await applyGoogleSignatureStatusUpdate(agreement, status);
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke oppdatere Google-signaturstatusen',
        { variant: 'error' },
      );
    } finally {
      setSignatureBusyAgreementId(null);
    }
  }, [applyGoogleSignatureStatusUpdate, enqueueSnackbar]);

  const handleSendGoogleSignatureRequest = useCallback(async (agreement: ProjectAgreement) => {
    setSignatureBusyAgreementId(agreement.id);
    try {
      let updatedAgreement: ProjectAgreement;
      if (useLocalFallback) {
        const now = new Date().toISOString();
        const existingSignature = agreement.google_signature;
        updatedAgreement = await persistLocalAgreement({
          ...agreement,
          status: 'sent',
          signed_date: undefined,
          updated_at: now,
          google_signature: {
            id: existingSignature?.id ?? `local-google-signature-${agreement.id}`,
            projectId: project.id,
            agreementId: agreement.id,
            provider: 'google_workspace',
            status: 'sent',
            documentTitle: agreement.title,
            counterpartyName: agreement.counterparty_name,
            counterpartyEmail: agreement.counterparty_email,
            preparedAt: existingSignature?.preparedAt ?? now,
            sentAt: now,
            signedAt: existingSignature?.signedAt ?? null,
            declinedAt: existingSignature?.declinedAt ?? null,
            lastOpenedAt: existingSignature?.lastOpenedAt ?? null,
            requestUrl: existingSignature?.requestUrl ?? existingSignature?.webViewUrl ?? null,
            webViewUrl: existingSignature?.webViewUrl ?? null,
            sourceArtifactId: existingSignature?.sourceArtifactId ?? null,
            pdfSnapshotArtifactId: existingSignature?.pdfSnapshotArtifactId ?? null,
            signedPdfArtifactId: existingSignature?.signedPdfArtifactId ?? null,
            auditArtifactId: existingSignature?.auditArtifactId ?? null,
            lastSyncedAt: now,
            metadata: existingSignature?.metadata ?? {},
          },
        });
      } else {
        const response = await projectAgreementsApi.sendGoogleSignatureRequest(project.id, agreement.id);
        updatedAgreement = response.agreement;
      }

      await syncAgreementTimeline(updatedAgreement);
      await syncAgreementReview(updatedAgreement);
      emitProjectAgreementEvent({
        projectId: project.id,
        mutation: 'signature_updated',
        agreementId: agreement.id,
      });
      enqueueSnackbar('Signaturlenken er sendt og avtalen er lagt i juridisk flyt.', { variant: 'success' });
      void loadAgreements();
      void loadGoogleStatus();
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke sende signaturlenken',
        { variant: 'error' },
      );
    } finally {
      setSignatureBusyAgreementId(null);
    }
  }, [enqueueSnackbar, loadAgreements, loadGoogleStatus, persistLocalAgreement, project.id, syncAgreementReview, syncAgreementTimeline, useLocalFallback]);

  const handleCopyGoogleSignatureLink = useCallback(async (agreement: ProjectAgreement) => {
    const targetUrl = agreement.google_signature?.requestUrl ?? agreement.google_signature?.webViewUrl;
    if (!targetUrl) {
      enqueueSnackbar('Avtalen mangler en Google-lenke som kan deles.', { variant: 'warning' });
      return;
    }
    try {
      await navigator.clipboard.writeText(targetUrl);
      enqueueSnackbar('Signaturlenken er kopiert.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke kopiere signaturlenken',
        { variant: 'error' },
      );
    }
  }, [enqueueSnackbar]);

  const openGoogleSignature = useCallback((agreement: ProjectAgreement) => {
    const targetUrl = agreement.google_signature?.requestUrl ?? agreement.google_signature?.webViewUrl;
    if (!targetUrl) {
      enqueueSnackbar('Avtalen mangler en Google-lenke for signering.', { variant: 'warning' });
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
    if (agreement.google_signature?.status === 'prepared' || agreement.google_signature?.status === 'sent') {
      void handleUpdateGoogleSignatureStatus(agreement, 'opened_in_google');
    }
  }, [enqueueSnackbar, handleUpdateGoogleSignatureStatus]);

  const openAgreementReviewFocus = useCallback((agreement: ProjectAgreement) => {
    onOpenReviews?.({
      agreementId: agreement.id,
      linkedEntityType: 'project_agreement',
      linkedEntityId: agreement.id,
    });
  }, [onOpenReviews]);

  const openAgreementTimelineFocus = useCallback((agreement: ProjectAgreement) => {
    onOpenTimeline?.({
      agreementId: agreement.id,
      linkedEntityType: 'project_agreement',
      linkedEntityId: agreement.id,
    });
  }, [onOpenTimeline]);

  const openAgreementWorkspaceFocus = useCallback((agreement: ProjectAgreement) => {
    onOpenMedia?.({
      workspace: 'delivery',
      artifactId: getAgreementWorkspaceArtifactId(agreement),
    });
  }, [onOpenMedia]);

  const handleSyncGoogleSignature = useCallback(async (agreement: ProjectAgreement) => {
    const syncGoogleSignature = async (
      targetAgreement: ProjectAgreement,
      options?: { silent?: boolean; reloadAfter?: boolean },
    ): Promise<ProjectAgreement> => {
      const { silent = false, reloadAfter = true } = options ?? {};
      let updatedAgreement: ProjectAgreement;
      if (useLocalFallback) {
        const now = new Date().toISOString();
        const existingSignature = targetAgreement.google_signature;
        const inferredStatus = existingSignature?.signedPdfArtifactId || existingSignature?.signedDriveFileId
          ? 'signed'
          : existingSignature?.status ?? 'prepared';
        updatedAgreement = await persistLocalAgreement({
          ...targetAgreement,
          status: inferredStatus === 'signed' ? 'signed' : targetAgreement.status,
          signed_date: inferredStatus === 'signed'
            ? targetAgreement.signed_date ?? existingSignature?.signedAt ?? now
            : targetAgreement.signed_date,
          updated_at: now,
          google_signature: existingSignature ? {
            ...existingSignature,
            status: inferredStatus,
            lastSyncedAt: now,
            metadata: {
              ...existingSignature.metadata,
              syncedFromGoogleAt: now,
            },
          } : null,
        });
      } else {
        const response = await projectAgreementsApi.syncGoogleSignature(project.id, targetAgreement.id);
        updatedAgreement = response.agreement;
      }

      await syncAgreementTimeline(updatedAgreement);
      await syncAgreementReview(updatedAgreement);
      emitProjectAgreementEvent({
        projectId: project.id,
        mutation: 'signature_updated',
        agreementId: targetAgreement.id,
      });
      if (!silent) {
        enqueueSnackbar('Google-signaturflyten er synkronisert tilbake til prosjektet.', { variant: 'success' });
      }
      if (reloadAfter) {
        void loadAgreements();
        void loadGoogleStatus();
      }
      return updatedAgreement;
    };

    setSignatureBusyAgreementId(agreement.id);
    try {
      await syncGoogleSignature(agreement);
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke synkronisere Google-signaturflyten',
        { variant: 'error' },
      );
    } finally {
      setSignatureBusyAgreementId(null);
    }
  }, [enqueueSnackbar, loadAgreements, loadGoogleStatus, persistLocalAgreement, project.id, syncAgreementReview, syncAgreementTimeline, useLocalFallback]);

  const syncGoogleSignatureSilently = useCallback(async (agreement: ProjectAgreement) => {
    let updatedAgreement: ProjectAgreement;
    if (useLocalFallback) {
      const now = new Date().toISOString();
      const existingSignature = agreement.google_signature;
      const inferredStatus = existingSignature?.signedPdfArtifactId || existingSignature?.signedDriveFileId
        ? 'signed'
        : existingSignature?.status ?? 'prepared';
      updatedAgreement = await persistLocalAgreement({
        ...agreement,
        status: inferredStatus === 'signed' ? 'signed' : agreement.status,
        signed_date: inferredStatus === 'signed'
          ? agreement.signed_date ?? existingSignature?.signedAt ?? now
          : agreement.signed_date,
        updated_at: now,
        google_signature: existingSignature ? {
          ...existingSignature,
          status: inferredStatus,
          lastSyncedAt: now,
          metadata: {
            ...existingSignature.metadata,
            syncedFromGoogleAt: now,
          },
        } : null,
      });
    } else {
      const response = await projectAgreementsApi.syncGoogleSignature(project.id, agreement.id);
      updatedAgreement = response.agreement;
    }

    await syncAgreementTimeline(updatedAgreement);
    await syncAgreementReview(updatedAgreement);
    emitProjectAgreementEvent({
      projectId: project.id,
      mutation: 'signature_updated',
      agreementId: agreement.id,
    });
    return updatedAgreement;
  }, [persistLocalAgreement, project.id, syncAgreementReview, syncAgreementTimeline, useLocalFallback]);

  const handleConfirmGoogleSigned = useCallback(async (agreement: ProjectAgreement) => {
    setSignatureBusyAgreementId(agreement.id);
    try {
      const syncedAgreement = await syncGoogleSignatureSilently(agreement);
      const syncedStatus = syncedAgreement.google_signature?.status ?? null;

      if (syncedStatus === 'signed' || syncedAgreement.status === 'signed') {
        enqueueSnackbar('Signeringen er allerede bekreftet og lagret i prosjektet.', { variant: 'success' });
        void loadAgreements();
        void loadGoogleStatus();
        return;
      }

      if (syncedStatus === 'changes_requested' || syncedStatus === 'rejected') {
        enqueueSnackbar(
          syncedStatus === 'changes_requested'
            ? 'Google-flyten viser at avtalen kom tilbake med endringer. Den ble ikke markert som signert.'
            : 'Google-flyten viser at avtalen er avvist. Den ble ikke markert som signert.',
          { variant: 'warning' },
        );
        void loadAgreements();
        void loadGoogleStatus();
        return;
      }

      await applyGoogleSignatureStatusUpdate(syncedAgreement, 'signed', {
        silent: true,
        skipReload: true,
      });

      enqueueSnackbar('Signeringen er bekreftet. Signert PDF og signaturspor er lagret i prosjektet.', {
        variant: 'success',
      });
      void loadAgreements();
      void loadGoogleStatus();
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke bekrefte Google-signeringen',
        { variant: 'error' },
      );
    } finally {
      setSignatureBusyAgreementId(null);
    }
  }, [applyGoogleSignatureStatusUpdate, enqueueSnackbar, loadAgreements, loadGoogleStatus, syncGoogleSignatureSilently]);

  useEffect(() => {
    if (useLocalFallback || loading || googleStatusLoading) {
      return;
    }
    if (!googleStatus?.configured || googleStatus.state !== 'connected') {
      return;
    }

    const syncCandidates = agreements.filter((agreement) => {
      const signature = agreement.google_signature;
      if (!signature || (signature.status !== 'sent' && signature.status !== 'opened_in_google')) {
        return false;
      }
      const marker = [
        signature.status,
        signature.sentAt ?? '',
        signature.lastOpenedAt ?? '',
        signature.lastSyncedAt ?? '',
        agreement.updated_at ?? '',
      ].join('|');
      if (autoSyncedAgreementMarkersRef.current[agreement.id] === marker) {
        return false;
      }
      autoSyncedAgreementMarkersRef.current[agreement.id] = marker;
      return true;
    });

    if (syncCandidates.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const results = await Promise.all(syncCandidates.map(async (agreement) => {
        try {
          await syncGoogleSignatureSilently(agreement);
          return true;
        } catch (error) {
          console.warn('[ProjectAgreementsPanel] Auto-sync of Google agreement signature failed', error);
          return false;
        }
      }));

      if (!cancelled && results.some(Boolean)) {
        void loadAgreements();
        void loadGoogleStatus();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    agreements,
    googleStatus?.configured,
    googleStatus?.state,
    googleStatusLoading,
    loadAgreements,
    loadGoogleStatus,
    loading,
    syncGoogleSignatureSilently,
    useLocalFallback,
  ]);

  const renderAgreementCards = (items: ProjectAgreement[]) => {
    if (items.length === 0) {
      return (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}>
          Ingen avtaler opprettet ennå i denne kategorien.
        </Alert>
      );
    }

    return (
      <Grid container spacing={2}>
        {items.map((agreement) => {
          const statusColor = agreementStatusColor(agreement.status);
          const isHighlighted = highlightedAgreementId === agreement.id;
          const linkedReview = agreementReviewByAgreementId[agreement.id];
          const isStatusDriver = linkedReview?.id === statusDriverReview?.id;
          const linkedReviewStatusLabel = linkedReview ? REVIEW_STATUS_LABELS[linkedReview.status] ?? linkedReview.status : null;
          const signatureTone = getAgreementSignatureTone(agreement.google_signature);
          const signatureProgress = getAgreementSignatureProgress(agreement);
          const clientFacingStatusSummary = getAgreementClientFacingStatusSummary(agreement);
          const hasGoogleAccess = useLocalFallback || (
            Boolean(googleStatus?.configured) && googleStatus?.state === 'connected'
          );
          const primarySignatureAction = getAgreementPrimarySignatureAction(agreement, { hasGoogleAccess });
          const signatureBusy = signatureBusyAgreementId === agreement.id;
          const showAdvancedSignatureControls = expandedSignatureControlsAgreementId === agreement.id;
          const runPrimarySignatureAction = () => {
            switch (primarySignatureAction.key) {
              case 'prepare':
                void handlePrepareGoogleSignature(agreement);
                break;
              case 'send':
                void handleSendGoogleSignatureRequest(agreement);
                break;
              case 'open':
              case 'view':
                openGoogleSignature(agreement);
                break;
              case 'confirm_signed':
                void handleConfirmGoogleSigned(agreement);
                break;
              case 'sync':
                void handleSyncGoogleSignature(agreement);
                break;
              case 'manual_send':
                void handleAgreementStatus(agreement.id, 'sent');
                break;
              case 'manual_sign':
                void handleAgreementStatus(agreement.id, 'signed');
                break;
              default:
                break;
            }
          };
          return (
            <Grid size={{ xs: 12, md: 6, xl: 4 }} key={agreement.id}>
              <Card
                ref={(node) => {
                  agreementRefs.current[agreement.id] = node;
                }}
                sx={{
                  bgcolor: isHighlighted ? 'rgba(139,92,246,0.12)' : 'rgba(15,23,42,0.66)',
                  border: isHighlighted
                    ? '1px solid rgba(192,132,252,0.52)'
                    : '1px solid rgba(148,163,184,0.16)',
                  borderRadius: 2.5,
                  boxShadow: isHighlighted
                    ? '0 0 0 1px rgba(192,132,252,0.12), 0 16px 40px rgba(2,6,23,0.26)'
                    : 'none',
                  transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        {agreement.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.87rem' }}>
                        {agreement.counterparty_name}
                      </Typography>
                    </Box>
                    <Chip
                      label={PROJECT_AGREEMENT_STATUS_LABELS[agreement.status]}
                      size="small"
                      sx={{ bgcolor: `${statusColor}20`, color: statusColor, fontWeight: 700 }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.25 }}>
                    {isHighlighted ? (
                      <Chip
                        label="Åpnet fra økonomiflyt"
                        size="small"
                        sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }}
                      />
                    ) : null}
                    <Chip
                      label={PROJECT_AGREEMENT_COUNTERPARTY_LABELS[agreement.counterparty_type as 'client' | 'extra'] ?? agreement.counterparty_type}
                      size="small"
                      sx={{ bgcolor: 'rgba(6,182,212,0.16)', color: '#67e8f9' }}
                    />
                    <Chip
                      label={getAgreementTypeLabel(agreement.agreement_type)}
                      size="small"
                      sx={{ bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd' }}
                    />
                    {linkedReviewStatusLabel ? (
                      <Chip
                        label={`Klientstatus · ${linkedReviewStatusLabel}`}
                        size="small"
                        sx={{
                          bgcolor: linkedReview?.status === 'approved'
                            ? 'rgba(16,185,129,0.16)'
                            : linkedReview?.status === 'changes_requested' || linkedReview?.status === 'rejected'
                              ? 'rgba(251,191,36,0.16)'
                              : 'rgba(59,130,246,0.16)',
                          color: linkedReview?.status === 'approved'
                            ? '#86efac'
                            : linkedReview?.status === 'changes_requested' || linkedReview?.status === 'rejected'
                              ? '#fde68a'
                              : '#bfdbfe',
                        }}
                      />
                    ) : null}
                    <Chip
                      label={getAgreementSignatureLabel(agreement.google_signature)}
                      size="small"
                      sx={{
                        bgcolor: signatureTone.background,
                        color: signatureTone.color,
                      }}
                    />
                    {isStatusDriver ? (
                      <Chip
                        label="Driver prosjektstatus"
                        size="small"
                        sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }}
                      />
                    ) : null}
                  </Stack>

                  {agreement.counterparty_company_name ? (
                    <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.86rem', mb: 0.75 }}>
                      {agreement.counterparty_company_name}
                    </Typography>
                  ) : null}

                  <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.84rem', mb: 1.5, minHeight: 68 }}>
                    {buildAgreementSummary(agreement)}
                  </Typography>
                  {linkedReview ? (
                    <Typography sx={{ color: 'rgba(191,219,254,0.88)', fontSize: '0.8rem', mb: 0.35 }}>
                      {getReviewSummaryCopy(linkedReview)}
                    </Typography>
                  ) : null}
                  <Typography sx={{ color: signatureTone.color, fontSize: '0.8rem', mb: 0.35 }}>
                    {getGoogleSignatureSummaryCopy(agreement)}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.79rem', mb: 0.75 }}>
                    {clientFacingStatusSummary}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                      gap: 0.55,
                      mb: 1,
                    }}
                  >
                    {signatureProgress.steps.map((step) => (
                      <Box
                        key={step.key}
                        sx={{
                          px: 0.65,
                          py: 0.55,
                          borderRadius: 1.1,
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
                            fontSize: '0.72rem',
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
                        mb: 1.1,
                        bgcolor: signatureProgress.issueTone?.background ?? 'rgba(148,163,184,0.16)',
                        color: signatureProgress.issueTone?.color ?? '#cbd5e1',
                      }}
                    />
                  ) : null}
                  {linkedReview ? (
                    <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.78rem', mb: 1.2 }}>
                      {linkedReview.comments?.length ?? 0} kommentarer
                      {formatAgreementEventTime(linkedReview.decision_at ?? linkedReview.requested_at)
                        ? ` · sist oppdatert ${formatAgreementEventTime(linkedReview.decision_at ?? linkedReview.requested_at)}`
                        : ''}
                    </Typography>
                  ) : (
                    <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.8rem', mb: 1.2 }}>
                      Ingen klientreview koblet til avtalen ennå.
                    </Typography>
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    {!readOnly && primarySignatureAction.key !== 'none' ? (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={
                          primarySignatureAction.key === 'prepare'
                            ? <DescriptionIcon />
                            : primarySignatureAction.key === 'send' || primarySignatureAction.key === 'manual_send'
                              ? <SendIcon />
                              : primarySignatureAction.key === 'manual_sign'
                                ? <DrawIcon />
                                : primarySignatureAction.key === 'confirm_signed'
                                  ? <TaskAltIcon />
                                : <OpenInNewIcon />
                        }
                        onClick={runPrimarySignatureAction}
                        disabled={signatureBusy || googleStatusLoading}
                        sx={{
                          flex: 1.1,
                          textTransform: 'none',
                          fontWeight: 800,
                          bgcolor: primarySignatureAction.key === 'view' || primarySignatureAction.key === 'manual_sign'
                            ? '#10b981'
                            : primarySignatureAction.key === 'confirm_signed'
                              ? '#059669'
                            : primarySignatureAction.key === 'send' || primarySignatureAction.key === 'manual_send'
                              ? '#f59e0b'
                              : primarySignatureAction.key === 'prepare'
                                ? '#8b5cf6'
                                : '#2563eb',
                        }}
                      >
                        {primarySignatureAction.label}
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => setPreviewAgreement(agreement)}
                      sx={{ flex: 1, textTransform: 'none', fontWeight: 700 }}
                    >
                      Se avtale
                    </Button>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                    {!readOnly && agreement.google_signature ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<OpenInNewIcon />}
                        onClick={() => openGoogleSignature(agreement)}
                        disabled={signatureBusy}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Åpne i Google
                      </Button>
                    ) : null}
                    {!readOnly && (agreement.google_signature?.requestUrl || agreement.google_signature?.webViewUrl) ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => { void handleCopyGoogleSignatureLink(agreement); }}
                        disabled={signatureBusy}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Kopier signaturlenke
                      </Button>
                    ) : null}
                    {!readOnly && agreement.google_signature ? (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                          setExpandedSignatureControlsAgreementId((current) => (
                            current === agreement.id ? null : agreement.id
                          ));
                        }}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        {showAdvancedSignatureControls ? 'Skjul manuelle valg' : 'Vis manuelle valg'}
                      </Button>
                    ) : null}
                  </Stack>
                  {!readOnly && agreement.google_signature ? (
                    <Collapse in={showAdvancedSignatureControls} unmountOnExit>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { void handleSyncGoogleSignature(agreement); }}
                          disabled={signatureBusy}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Sync fra Google
                        </Button>
                        {agreement.google_signature.status !== 'signed' ? (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<DrawIcon />}
                            onClick={() => { void handleUpdateGoogleSignatureStatus(agreement, 'signed'); }}
                            disabled={signatureBusy}
                            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#10b981' }}
                          >
                            Bekreft signert
                          </Button>
                        ) : null}
                        {agreement.google_signature.status !== 'changes_requested' ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => { void handleUpdateGoogleSignatureStatus(agreement, 'changes_requested'); }}
                            disabled={signatureBusy}
                            sx={{ textTransform: 'none', fontWeight: 700, borderColor: '#f59e0b', color: '#fde68a' }}
                          >
                            Marker endringer
                          </Button>
                        ) : null}
                        {agreement.google_signature.status !== 'rejected' ? (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => { void handleUpdateGoogleSignatureStatus(agreement, 'rejected'); }}
                            disabled={signatureBusy}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            Marker avvist
                          </Button>
                        ) : null}
                      </Stack>
                    </Collapse>
                  ) : null}
                  {(onOpenReviews || onOpenTimeline || onOpenMedia) && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                      {onOpenMedia ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openAgreementWorkspaceFocus(agreement)}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Åpne i klientflate
                        </Button>
                      ) : null}
                      {onOpenReviews && agreement.status !== 'draft' && needsClientCollaborationReview(agreement) ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openAgreementReviewFocus(agreement)}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Åpne i klientsamarbeid
                        </Button>
                      ) : null}
                      {onOpenTimeline ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openAgreementTimelineFocus(agreement)}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Åpne i tidslinje
                        </Button>
                      ) : null}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Prosjektavtaler og godkjenninger
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.9rem', maxWidth: 860 }}>
            Hold samarbeidsavtaler, klientgodkjenninger, endringsordrer, NDA-er og medvirkendevilkår samlet i prosjektets økonomi, uten å blande dem sammen med castingtilbud og rollekontrakter.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {!readOnly ? (
            <>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={openExtraAgreementDialog}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Ny medvirkendeavtale
              </Button>
              <Button
                variant="contained"
                startIcon={<DescriptionIcon />}
                onClick={openClientAgreementDialog}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#8b5cf6' }}
              >
                Ny klientavtale
              </Button>
            </>
          ) : null}
        </Stack>
      </Box>

      <Card
        sx={{
          mb: 2.5,
          bgcolor: 'rgba(15,23,42,0.74)',
          border: '1px solid rgba(148,163,184,0.16)',
          borderRadius: 2.5,
        }}
      >
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between">
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                  Samarbeidsramme
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.88rem', maxWidth: 860 }}>
                  Avklar hvilken avtale prosjektet faktisk går på, hva som ligger innenfor scope, hvem som dekker ekstrakostnader og hvordan kompensasjonen er tenkt i oppstartsperioden og etterpå.
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={PRODUCER_COLLABORATION_STATUS_LABELS[collaborationDraft.status ?? 'discovery']}
                  sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                />
                <Chip
                  size="small"
                  label={PRODUCER_COLLABORATION_AGREEMENT_MODEL_LABELS[collaborationDraft.agreementModel ?? 'one_time_project']}
                  sx={{ bgcolor: 'rgba(139,92,246,0.16)', color: '#ddd6fe' }}
                />
                <Chip
                  size="small"
                  label={PRODUCER_COLLABORATION_COMPENSATION_MODEL_LABELS[collaborationDraft.compensationModel ?? 'fixed_fee']}
                  sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: '#86efac' }}
                />
                <Chip
                  size="small"
                  label={collaborationDraft.deliverablesInScopeVisible === false ? 'Scope skjult for klient' : 'Scope synlig for klient'}
                  sx={{
                    bgcolor: collaborationDraft.deliverablesInScopeVisible === false ? 'rgba(148,163,184,0.16)' : 'rgba(251,191,36,0.16)',
                    color: collaborationDraft.deliverablesInScopeVisible === false ? '#cbd5e1' : '#fde68a',
                  }}
                />
              </Stack>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={collaborationDraft.status ?? 'discovery'}
                    label="Status"
                    disabled={!canEditCollaborationTerms}
                    onChange={(event) => {
                      const nextValue = event.target.value as NonNullable<ProducerCollaborationTerms['status']>;
                      setCollaborationDraft((prev) => ({ ...prev, status: nextValue }));
                      void updateCollaborationTerms((prev) => ({ ...prev, status: nextValue }));
                    }}
                  >
                    {Object.entries(PRODUCER_COLLABORATION_STATUS_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Avtaletype</InputLabel>
                  <Select
                    value={collaborationDraft.agreementModel ?? 'one_time_project'}
                    label="Avtaletype"
                    disabled={!canEditCollaborationTerms}
                    onChange={(event) => {
                      const nextValue = event.target.value as NonNullable<ProducerCollaborationTerms['agreementModel']>;
                      setCollaborationDraft((prev) => ({ ...prev, agreementModel: nextValue }));
                      void updateCollaborationTerms((prev) => ({ ...prev, agreementModel: nextValue }));
                    }}
                  >
                    {Object.entries(PRODUCER_COLLABORATION_AGREEMENT_MODEL_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Kompensasjonsmodell</InputLabel>
                  <Select
                    value={collaborationDraft.compensationModel ?? 'fixed_fee'}
                    label="Kompensasjonsmodell"
                    disabled={!canEditCollaborationTerms}
                    onChange={(event) => {
                      const nextValue = event.target.value as NonNullable<ProducerCollaborationTerms['compensationModel']>;
                      setCollaborationDraft((prev) => ({ ...prev, compensationModel: nextValue }));
                      void updateCollaborationTerms((prev) => ({ ...prev, compensationModel: nextValue }));
                    }}
                  >
                    {Object.entries(PRODUCER_COLLABORATION_COMPENSATION_MODEL_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Hva slags samarbeid er dette?"
                  value={collaborationDraft.agreementLabel ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, agreementLabel: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  disabled={!canEditCollaborationTerms}
                  helperText="For eksempel: Holy Crust oppstartsperiode, engangsprosjekt eller holdingselskap-løp."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Hvilket selskap / vehicle går avtalen gjennom?"
                  value={collaborationDraft.commercialVehicle ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, commercialVehicle: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  disabled={!canEditCollaborationTerms}
                  helperText="For eksempel holdingselskap, driftsselskap eller personlig foretak."
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Kort samarbeidssammendrag"
                  value={collaborationDraft.agreementSummary ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, agreementSummary: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  multiline
                  minRows={2}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Leveranser innenfor scope"
                  value={deliverablesInScopeValue}
                  onChange={(event) => setCollaborationDraft((prev) => ({
                    ...prev,
                    deliverablesInScope: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean),
                  }))}
                  onBlur={(event) => { void updateCollaborationTextList('deliverablesInScope', event.target.value); }}
                  fullWidth
                  multiline
                  minRows={6}
                  disabled={!canEditCollaborationTerms}
                  helperText="Én leveranse per linje, for eksempel TikTok-innhold, Instagram reels eller BTS fra kjøkken."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack spacing={1}>
                  <Button
                    variant={collaborationDraft.deliverablesInScopeVisible === false ? 'outlined' : 'contained'}
                    onClick={() => {
                      const nextValue = !(collaborationDraft.deliverablesInScopeVisible === true);
                      setCollaborationDraft((prev) => ({ ...prev, deliverablesInScopeVisible: nextValue }));
                      void updateCollaborationTerms((prev) => ({ ...prev, deliverablesInScopeVisible: nextValue }));
                    }}
                    disabled={!canEditCollaborationTerms}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                  >
                    {collaborationDraft.deliverablesInScopeVisible === false ? 'Vis scope mot klient' : 'Skjul scope mot klient'}
                  </Button>
                  <TextField
                    label="Produksjonsdager per uke / måned"
                    value={collaborationDraft.productionCadence ?? ''}
                    onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, productionCadence: event.target.value }))}
                    onBlur={() => { void persistCollaborationDraft(); }}
                    fullWidth
                    disabled={!canEditCollaborationTerms}
                  />
                  <TextField
                    label="Oppstartsmodell / økonomi i pilotperioden"
                    value={collaborationDraft.startupEconomicModel ?? ''}
                    onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, startupEconomicModel: event.target.value }))}
                    onBlur={() => { void persistCollaborationDraft(); }}
                    fullWidth
                    multiline
                    minRows={2}
                    disabled={!canEditCollaborationTerms}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Rolle og ansvar · Produksjon"
                  value={productionResponsibilitiesValue}
                  onChange={(event) => setCollaborationDraft((prev) => ({
                    ...prev,
                    productionResponsibilities: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean),
                  }))}
                  onBlur={(event) => { void updateCollaborationTextList('productionResponsibilities', event.target.value); }}
                  fullWidth
                  multiline
                  minRows={6}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Rolle og ansvar · Branding"
                  value={brandingResponsibilitiesValue}
                  onChange={(event) => setCollaborationDraft((prev) => ({
                    ...prev,
                    brandingResponsibilities: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean),
                  }))}
                  onBlur={(event) => { void updateCollaborationTextList('brandingResponsibilities', event.target.value); }}
                  fullWidth
                  multiline
                  minRows={6}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Rolle og ansvar · Markedsføring"
                  value={marketingResponsibilitiesValue}
                  onChange={(event) => setCollaborationDraft((prev) => ({
                    ...prev,
                    marketingResponsibilities: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean),
                  }))}
                  onBlur={(event) => { void updateCollaborationTextList('marketingResponsibilities', event.target.value); }}
                  fullWidth
                  multiline
                  minRows={6}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                    Hvem dekker ekstrakostnader?
                  </Typography>
                  <Stack spacing={1}>
                    {(collaborationDraft.costItems ?? []).map((item, index) => (
                      <Grid container spacing={1} key={item.id}>
                        <Grid size={{ xs: 12, md: 3 }}>
                          <TextField
                            label="Kostnad"
                            value={item.label}
                            onChange={(event) => updateCollaborationCostItemDraft(item.id, (entry) => ({
                              ...entry,
                              label: event.target.value,
                            }))}
                            onBlur={() => { void persistCollaborationDraft(); }}
                            fullWidth
                            disabled={!canEditCollaborationTerms}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                          <FormControl fullWidth>
                            <InputLabel>Dekkes av</InputLabel>
                            <Select
                              label="Dekkes av"
                              value={item.coveredBy}
                              disabled={!canEditCollaborationTerms}
                              onChange={(event) => {
                                const nextValue = event.target.value as typeof item.coveredBy;
                                updateCollaborationCostItemDraft(item.id, (entry) => ({
                                  ...entry,
                                  coveredBy: nextValue,
                                }));
                                void updateCollaborationTerms((prev) => ({
                                  ...prev,
                                  costItems: (prev.costItems ?? []).map((entry, entryIndex) => (
                                    entryIndex === index ? { ...entry, coveredBy: nextValue } : entry
                                  )),
                                }));
                              }}
                            >
                              {Object.entries(PRODUCER_COLLABORATION_COST_COVERAGE_LABELS).map(([value, label]) => (
                                <MenuItem key={value} value={value}>{label}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, md: 2 }}>
                          <TextField
                            label="Beløp / ramme"
                            value={item.amountLabel ?? ''}
                            onChange={(event) => updateCollaborationCostItemDraft(item.id, (entry) => ({
                              ...entry,
                              amountLabel: event.target.value,
                            }))}
                            onBlur={() => { void persistCollaborationDraft(); }}
                            fullWidth
                            disabled={!canEditCollaborationTerms}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            label="Notat"
                            value={item.notes ?? ''}
                            onChange={(event) => updateCollaborationCostItemDraft(item.id, (entry) => ({
                              ...entry,
                              notes: event.target.value,
                            }))}
                            onBlur={() => { void persistCollaborationDraft(); }}
                            fullWidth
                            disabled={!canEditCollaborationTerms}
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'flex-start', md: 'center' }}
                            sx={{
                              p: 1.25,
                              borderRadius: 2,
                              border: '1px solid rgba(148,163,184,0.16)',
                              background: 'rgba(15,23,42,0.18)',
                            }}
                          >
                            <Button
                              component="label"
                              variant={item.receiptFileId ? 'outlined' : 'contained'}
                              color={item.receiptFileId ? 'inherit' : 'primary'}
                              startIcon={<ReceiptLongIcon />}
                              disabled={!canEditCollaborationTerms || uploadingReceiptItemId === item.id}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              {uploadingReceiptItemId === item.id
                                ? `Behandler${receiptOcrProgress[item.id] ? ` ${Math.round(receiptOcrProgress[item.id] * 100)}%` : '...'}`
                                : item.receiptFileId
                                  ? 'Bytt kvittering'
                                  : 'Last opp kvittering'}
                              <input
                                hidden
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(event) => {
                                  const nextFile = event.target.files?.[0];
                                  event.currentTarget.value = '';
                                  if (nextFile) {
                                    void handleReceiptUpload(item.id, nextFile);
                                  }
                                }}
                              />
                            </Button>
                            {item.receiptFileId ? (
                              <Button
                                variant="text"
                                color="inherit"
                                startIcon={<OpenInNewIcon />}
                                href={item.receiptUrl || undefined}
                                target="_blank"
                                rel="noreferrer"
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Åpne kvittering
                              </Button>
                            ) : null}
                            {item.receiptFileName ? (
                              <Chip
                                label={item.receiptFileName}
                                sx={{ color: '#e2e8f0', borderColor: 'rgba(148,163,184,0.28)' }}
                                variant="outlined"
                              />
                            ) : null}
                            {item.ocrStatus ? (
                              <Chip
                                label={RECEIPT_OCR_STATUS_LABELS[item.ocrStatus]}
                                color={item.ocrStatus === 'completed' ? 'success' : item.ocrStatus === 'failed' ? 'warning' : 'default'}
                                variant={item.ocrStatus === 'completed' ? 'filled' : 'outlined'}
                              />
                            ) : null}
                            {item.ocrConfidence ? (
                              <Chip
                                label={RECEIPT_OCR_CONFIDENCE_LABELS[item.ocrConfidence]}
                                variant="outlined"
                                sx={{ color: '#cbd5f5', borderColor: 'rgba(99,102,241,0.35)' }}
                              />
                            ) : null}
                            {(item.receiptMerchant || item.receiptDate || item.receiptAmountValue) ? (
                              <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: 13 }}>
                                {[item.receiptMerchant, item.amountLabel, item.receiptDate]
                                  .filter((value) => typeof value === 'string' && value.trim().length > 0)
                                  .join(' · ')}
                              </Typography>
                            ) : (
                              <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: 13 }}>
                                Last opp mobilbilde av kvittering for automatisk OCR og dokumentasjon av utlegg.
                              </Typography>
                            )}
                          </Stack>
                        </Grid>
                      </Grid>
                    ))}
                  </Stack>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Kompensasjonsoppsett etter oppstartsperioden"
                  value={collaborationDraft.compensationSummary ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, compensationSummary: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  multiline
                  minRows={4}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Evaluering etter samarbeidsperioden"
                  value={collaborationDraft.evaluationPlan ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, evaluationPlan: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  multiline
                  minRows={4}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Rettigheter til bruk hos kunden"
                  value={collaborationDraft.clientUsageRights ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, clientUsageRights: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Bruk i egen portefølje / markedsføring"
                  value={collaborationDraft.producerPortfolioRights ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, producerPortfolioRights: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Arbeidsomfang / timer per måned"
                  value={collaborationDraft.workloadCap ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, workloadCap: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Hva innholdsprodusenten ikke holdes ansvarlig for"
                  value={collaborationDraft.liabilityExclusions ?? ''}
                  onChange={(event) => setCollaborationDraft((prev) => ({ ...prev, liabilityExclusions: event.target.value }))}
                  onBlur={() => { void persistCollaborationDraft(); }}
                  fullWidth
                  multiline
                  minRows={2}
                  disabled={!canEditCollaborationTerms}
                />
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Tabs
        value={tabValue}
        onChange={(_, value) => setTabValue(value)}
        sx={{
          mb: 2,
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.78)', textTransform: 'none', fontWeight: 700 },
          '& .Mui-selected': { color: '#f8fafc' },
          '& .MuiTabs-indicator': { bgcolor: '#8b5cf6' },
        }}
      >
        <Tab label="Casting og rollekontrakter" />
        <Tab label={`Klientavtaler (${clientAgreements.length})`} />
        <Tab label={`Statister / medvirkende (${extraAgreements.length})`} />
      </Tabs>

      {tabValue === 0 ? (
        <OffersContractsPanel
          projectId={project.id}
          candidates={project.candidates}
          roles={project.roles}
          readOnly={readOnly}
          onCandidateStatusChange={onCandidateStatusChange}
        />
      ) : null}

      {tabValue === 1 ? (
        <Stack spacing={2}>
          <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}>
            Klientsporet samler NDA, samarbeidsavtaler, endringsordrer og formelle godkjenninger i én sammenhengende flyt.
          </Alert>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              size="small"
              label={`Klientavtaler ${clientAgreements.length}`}
              sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
            />
            <Chip
              size="small"
              label={`Venter ${clientAgreementStatusSummary.pending}`}
              sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#dbeafe' }}
            />
            <Chip
              size="small"
              label={`Godkjent ${clientAgreementStatusSummary.approved}`}
              sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: '#86efac' }}
            />
            <Chip
              size="small"
              label={`Endringer ${clientAgreementStatusSummary.changesRequested}`}
              sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }}
            />
            <Chip
              size="small"
              label={`Uten review ${clientAgreementStatusSummary.withoutReview}`}
              sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }}
            />
            <Chip
              size="small"
              label={`Klientsamarbeid totalt ${reviewSummary.pending + reviewSummary.approved + reviewSummary.changesRequested + reviewSummary.rejected}`}
              sx={{ bgcolor: 'rgba(192,132,252,0.14)', color: '#e9d5ff' }}
            />
          </Stack>
          {reviewsLoading ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(30,41,59,0.72)', color: '#dbeafe' }}>
              Oppdaterer klientbeslutninger og koblinger mot prosjektstatus…
            </Alert>
          ) : null}
          {statusDriverReview ? (
            <Alert
              severity={project.producerWorkflowStatus === 'changes_requested' ? 'warning' : project.producerWorkflowStatus === 'approved' ? 'success' : 'info'}
              sx={{
                bgcolor: project.producerWorkflowStatus === 'changes_requested'
                  ? 'rgba(251,191,36,0.12)'
                  : project.producerWorkflowStatus === 'approved'
                    ? 'rgba(16,185,129,0.12)'
                    : 'rgba(59,130,246,0.08)',
                color: '#e2e8f0',
              }}
              action={(
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {onOpenReviews ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        if (statusDriverAgreement) {
                          openAgreementReviewFocus(statusDriverAgreement);
                        }
                      }}
                      disabled={!statusDriverAgreement}
                      sx={{ textTransform: 'none', fontWeight: 700, color: '#f8fafc', borderColor: 'rgba(148,163,184,0.35)' }}
                    >
                      Åpne i klientsamarbeid
                    </Button>
                  ) : null}
                  {onOpenTimeline && statusDriverAgreement ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openAgreementTimelineFocus(statusDriverAgreement)}
                      sx={{ textTransform: 'none', fontWeight: 700, color: '#f8fafc', borderColor: 'rgba(148,163,184,0.35)' }}
                    >
                      Åpne i tidslinje
                    </Button>
                  ) : null}
                </Stack>
              )}
            >
              {statusDriverAgreement
                ? `Prosjektstatusen drives nå av avtalen «${statusDriverAgreement.title}» og reviewstatusen ${REVIEW_STATUS_LABELS[statusDriverReview.status] ?? statusDriverReview.status}.`
                : `Prosjektstatusen drives nå av klientbeslutningen «${statusDriverReview.title}».`}
            </Alert>
          ) : null}
          {loading ? (
            <Typography sx={{ color: 'rgba(203,213,225,0.74)' }}>Laster klientavtaler…</Typography>
          ) : renderAgreementCards(clientAgreements)}
        </Stack>
      ) : null}

      {tabValue === 2 ? (
        <Stack spacing={2}>
          <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}>
            Medvirkende-sporet samler konfidensialitet, oppmøte, praktiske vilkår og bruk av opptak i én avtalestrøm.
          </Alert>
          {loading ? (
            <Typography sx={{ color: 'rgba(203,213,225,0.74)' }}>Laster medvirkendeavtaler…</Typography>
          ) : renderAgreementCards(extraAgreements)}
        </Stack>
      ) : null}

      <Dialog open={!readOnly && clientDialogOpen} onClose={() => setClientDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Ny klientavtale</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ bgcolor: 'rgba(16,185,129,0.08)' }}>
              {clientTemplateConfig.description}
            </Alert>
            <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(139,92,246,0.24)', bgcolor: 'rgba(76,29,149,0.18)' }}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 800, mb: 0.4 }}>
                Best egnet for
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.84)', fontSize: '0.92rem', mb: 1.25 }}>
                {clientTemplateConfig.bestFor}
              </Typography>
              <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.6 }}>
                Malen dekker
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {clientTemplateConfig.coveragePoints.map((coveragePoint) => (
                  <Chip
                    key={coveragePoint}
                    label={coveragePoint}
                    size="small"
                    sx={{ bgcolor: 'rgba(15,23,42,0.66)', color: '#ddd6fe' }}
                  />
                ))}
              </Stack>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Maltype</InputLabel>
                  <Select
                    value={clientDraft.agreementType}
                    onChange={(event) => handleClientTemplateChange(event.target.value as ClientAgreementType)}
                    label="Maltype"
                  >
                    {CLIENT_AGREEMENT_TEMPLATE_GROUPS.flatMap((group) => [
                      <ListSubheader key={`header-${group.label}`}>{group.label}</ListSubheader>,
                      ...group.options.map((template) => (
                        <MenuItem key={template.type} value={template.type}>
                          {template.label}
                        </MenuItem>
                      )),
                    ])}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="Avtaletittel"
                  value={clientDraft.title}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, title: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label={clientTemplateConfig.purposeLabel}
                  value={clientDraft.purpose}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, purpose: event.target.value }))}
                  fullWidth
                />
              </Grid>
              {clientTemplateConfig.detailsLabel ? (
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label={clientTemplateConfig.detailsLabel}
                    value={clientDraft.details}
                    onChange={(event) => setClientDraft((prev) => ({ ...prev, details: event.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              ) : null}
              {clientTemplateConfig.commercialTermsLabel ? (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label={clientTemplateConfig.commercialTermsLabel}
                    value={clientDraft.commercialTerms}
                    onChange={(event) => setClientDraft((prev) => ({ ...prev, commercialTerms: event.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Avsender"
                  value={clientDraft.disclosingPartyName}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, disclosingPartyName: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Avsenders selskap"
                  value={clientDraft.disclosingPartyCompanyName}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, disclosingPartyCompanyName: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Avsenders org.nr."
                  value={clientDraft.disclosingPartyOrganizationNumber}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, disclosingPartyOrganizationNumber: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Kontaktperson hos klient"
                  value={clientDraft.counterpartyName}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, counterpartyName: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Klientselskap"
                  value={clientDraft.counterpartyCompanyName}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, counterpartyCompanyName: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Klientens org.nr."
                  value={clientDraft.counterpartyOrganizationNumber}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, counterpartyOrganizationNumber: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Klientens e-post"
                  value={clientDraft.counterpartyEmail}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, counterpartyEmail: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Startdato"
                  type="date"
                  value={clientDraft.startDate}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Sluttdato (valgfri)"
                  type="date"
                  value={clientDraft.endDate}
                  onChange={(event) => setClientDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </Grid>

            <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.66)' }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1.25 }}>
                Forhåndsvisning av avtaletekst
              </Typography>
              <Stack spacing={1.25}>
                {clientPreviewSections.map((section) => (
                  <Box key={section.id}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.35 }}>
                      {section.heading}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>
                      {section.body}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClientDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => { void createAgreement('client', clientDraft, clientPreviewSections); }}
            startIcon={submitting ? <DescriptionIcon /> : <AddIcon />}
            disabled={submitting || !clientDraft.title.trim() || !clientDraft.disclosingPartyName.trim() || !clientDraft.counterpartyName.trim() || !clientDraft.purpose.trim()}
            sx={{ bgcolor: '#8b5cf6' }}
          >
            {`Opprett ${clientTemplateConfig.shortLabel.toLowerCase()}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!readOnly && extraDialogOpen} onClose={() => setExtraDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Ny medvirkendeavtale</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ bgcolor: 'rgba(16,185,129,0.08)' }}>
              {extraTemplateConfig.description}
            </Alert>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Maltype</InputLabel>
                  <Select
                    value={extraDraft.agreementType}
                    onChange={(event) => handleExtraTemplateChange(event.target.value as ExtraAgreementType)}
                    label="Maltype"
                  >
                    {EXTRA_AGREEMENT_TEMPLATE_OPTIONS.map((template) => (
                      <MenuItem key={template.type} value={template.type}>
                        {template.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth disabled={project.candidates.length === 0}>
                  <InputLabel>Velg statist / medvirkende</InputLabel>
                  <Select
                    value={extraDraft.counterpartyId ?? ''}
                    onChange={(event) => handleExtraCandidateChange(event.target.value)}
                    label="Velg statist / medvirkende"
                  >
                    {project.candidates.map((candidate) => (
                      <MenuItem key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Avtaletittel"
                  value={extraDraft.title}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, title: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label={extraTemplateConfig.purposeLabel}
                  value={extraDraft.purpose}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, purpose: event.target.value }))}
                  fullWidth
                />
              </Grid>
              {extraTemplateConfig.detailsLabel ? (
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label={extraTemplateConfig.detailsLabel}
                    value={extraDraft.details}
                    onChange={(event) => setExtraDraft((prev) => ({ ...prev, details: event.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              ) : null}
              {extraTemplateConfig.commercialTermsLabel ? (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label={extraTemplateConfig.commercialTermsLabel}
                    value={extraDraft.commercialTerms}
                    onChange={(event) => setExtraDraft((prev) => ({ ...prev, commercialTerms: event.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Avsender"
                  value={extraDraft.disclosingPartyName}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, disclosingPartyName: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Avsenders selskap"
                  value={extraDraft.disclosingPartyCompanyName}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, disclosingPartyCompanyName: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Avsenders org.nr."
                  value={extraDraft.disclosingPartyOrganizationNumber}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, disclosingPartyOrganizationNumber: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Navn på motpart"
                  value={extraDraft.counterpartyName}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, counterpartyName: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Motparts e-post"
                  value={extraDraft.counterpartyEmail}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, counterpartyEmail: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Motparts selskap / agentur"
                  value={extraDraft.counterpartyCompanyName}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, counterpartyCompanyName: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Startdato"
                  type="date"
                  value={extraDraft.startDate}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Sluttdato (valgfri)"
                  type="date"
                  value={extraDraft.endDate}
                  onChange={(event) => setExtraDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </Grid>

            {project.candidates.length === 0 ? (
              <Alert severity="warning" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>
                Det finnes ingen statister eller medvirkende i prosjektet ennå. Legg til personer først, og opprett deretter medvirkendeavtalen.
              </Alert>
            ) : null}

            <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.66)' }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1.25 }}>
                Forhåndsvisning av avtaletekst
              </Typography>
              <Stack spacing={1.25}>
                {extraPreviewSections.map((section) => (
                  <Box key={section.id}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.35 }}>
                      {section.heading}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>
                      {section.body}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExtraDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => { void createAgreement('extra', extraDraft, extraPreviewSections); }}
            startIcon={submitting ? <DescriptionIcon /> : <AddIcon />}
            disabled={
              submitting
              || !extraDraft.title.trim()
              || !extraDraft.disclosingPartyName.trim()
              || !extraDraft.counterpartyName.trim()
              || !extraDraft.purpose.trim()
              || project.candidates.length === 0
            }
            sx={{ bgcolor: '#06b6d4' }}
          >
            {`Opprett ${extraTemplateConfig.shortLabel.toLowerCase()}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(previewAgreement)} onClose={() => setPreviewAgreement(null)} maxWidth="md" fullWidth>
        <DialogTitle>{previewAgreement?.title ?? 'Prosjektavtale'}</DialogTitle>
        <DialogContent>
          {previewAgreement ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    label={PROJECT_AGREEMENT_COUNTERPARTY_LABELS[previewAgreement.counterparty_type as 'client' | 'extra'] ?? previewAgreement.counterparty_type}
                    size="small"
                  />
                  <Chip
                    label={getAgreementTypeLabel(previewAgreement.agreement_type)}
                    size="small"
                  />
                  <Chip
                    label={PROJECT_AGREEMENT_STATUS_LABELS[previewAgreement.status]}
                    size="small"
                    sx={{ bgcolor: `${agreementStatusColor(previewAgreement.status)}20`, color: agreementStatusColor(previewAgreement.status) }}
                  />
                </Stack>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.84rem' }}>
                  {previewAgreement.signed_date ? `Signert ${new Date(previewAgreement.signed_date).toLocaleString('nb-NO')}` : 'Ikke signert ennå'}
                </Typography>
              </Stack>

              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.66)', border: '1px solid rgba(148,163,184,0.16)' }}>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Utleverende part
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.9rem' }}>
                  {previewAgreement.disclosing_party_name || 'Ikke oppgitt'}
                  {previewAgreement.disclosing_party_company_name ? `, ${previewAgreement.disclosing_party_company_name}` : ''}
                  {previewAgreement.disclosing_party_organization_number ? `, org.nr. ${previewAgreement.disclosing_party_organization_number}` : ''}
                </Typography>
                <Divider sx={{ my: 1.25, borderColor: 'rgba(148,163,184,0.14)' }} />
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Mottakende part
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.9rem' }}>
                  {previewAgreement.counterparty_name}
                  {previewAgreement.counterparty_company_name ? `, ${previewAgreement.counterparty_company_name}` : ''}
                  {previewAgreement.counterparty_organization_number ? `, org.nr. ${previewAgreement.counterparty_organization_number}` : ''}
                  {previewAgreement.counterparty_email ? `, ${previewAgreement.counterparty_email}` : ''}
                </Typography>
              </Box>

              <Stack spacing={1.5}>
                {(previewAgreement.sections ?? []).map((section) => (
                  <Box key={section.id}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.4 }}>
                      {section.heading}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
                      {section.body}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewAgreement(null)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectAgreementsPanel;

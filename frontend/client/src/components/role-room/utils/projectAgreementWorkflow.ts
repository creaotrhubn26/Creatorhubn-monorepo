import type { RoleRoomGoogleAgreementSignatureStatus } from '../models/casting';
import type {
  ProjectAgreement,
  ProjectAgreementStatus,
} from '../services/castingApiService';
import type {
  CreateProducerTimelineItemInput,
  ProducerPhase,
  ProducerReviewDecision,
  ProducerTimelineItem,
} from '../services/producerWorkflowService';

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

export function getAgreementTimelinePhase(
  agreement: Pick<ProjectAgreement, 'counterparty_type' | 'agreement_type'>,
): ProducerPhase {
  if (agreement.counterparty_type === 'extra') {
    return 'production';
  }

  if (agreement.agreement_type === 'change_order' || agreement.agreement_type === 'client_approval') {
    return 'production';
  }

  return 'preproduction';
}

export function getAgreementTimelineStatus(status: ProjectAgreementStatus): string {
  if (status === 'signed') {
    return 'completed';
  }
  if (status === 'sent') {
    return 'in_progress';
  }
  return 'planned';
}

function getAgreementTimelineStatusFromSignature(
  status?: RoleRoomGoogleAgreementSignatureStatus | null,
): string | null {
  if (!status || status === 'not_started') {
    return null;
  }
  if (status === 'signed') {
    return 'completed';
  }
  if (status === 'rejected' || status === 'changes_requested') {
    return 'blocked';
  }
  if (status === 'prepared') {
    return 'planned';
  }
  return 'in_progress';
}

export function needsClientCollaborationReview(
  agreement: Pick<ProjectAgreement, 'counterparty_type' | 'agreement_type'>,
): boolean {
  return agreement.counterparty_type === 'client'
    && (agreement.agreement_type === 'change_order' || agreement.agreement_type === 'client_approval');
}

export function buildAgreementTimelineDescription(agreement: ProjectAgreement): string {
  const summary = [
    agreement.counterparty_name,
    agreement.counterparty_company_name,
    agreement.purpose,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  return summary.join(' · ');
}

export function buildAgreementTimelinePayload(agreement: ProjectAgreement): CreateProducerTimelineItemInput {
  const signatureStatus = agreement.google_signature?.status ?? null;
  const timelineStatus = getAgreementTimelineStatusFromSignature(signatureStatus) ?? getAgreementTimelineStatus(agreement.status);
  return {
    phase: getAgreementTimelinePhase(agreement),
    title: `Avtale · ${agreement.title}`,
    description: buildAgreementTimelineDescription(agreement),
    dueAt: agreement.end_date ?? agreement.start_date ?? undefined,
    status: timelineStatus,
    linkedEntityType: 'project_agreement',
    linkedEntityId: agreement.id,
    metadata: {
      ...(agreement.metadata ?? {}),
      source: 'project-agreement-sync',
      agreementId: agreement.id,
      agreementType: agreement.agreement_type,
      counterpartyType: agreement.counterparty_type,
      agreementStatus: agreement.status,
      googleSignatureStatus: signatureStatus,
      googleSignatureSignedAt: agreement.google_signature?.signedAt ?? null,
      googleSignatureWebViewUrl: agreement.google_signature?.webViewUrl ?? null,
      googleSignatureRequestUrl: agreement.google_signature?.requestUrl ?? null,
      googleSignatureSourceArtifactId: agreement.google_signature?.sourceArtifactId ?? null,
      googleSignaturePdfSnapshotArtifactId: agreement.google_signature?.pdfSnapshotArtifactId ?? null,
      googleSignatureSignedPdfArtifactId: agreement.google_signature?.signedPdfArtifactId ?? null,
      googleSignatureAuditArtifactId: agreement.google_signature?.auditArtifactId ?? null,
    },
  };
}

export function isAgreementTimelineItem(
  item: ProducerTimelineItem,
  agreementId: string,
): boolean {
  return (item.linked_entity_type === 'project_agreement' && item.linked_entity_id === agreementId)
    || readFirstNonEmptyString(item.metadata?.agreementId) === agreementId;
}

export function getAgreementStatusFromReviewDecision(
  decision: ProducerReviewDecision,
  agreement?: ProjectAgreement | null,
): ProjectAgreementStatus {
  if (agreement?.google_signature) {
    return decision === 'approved' ? 'sent' : 'sent';
  }
  return decision === 'approved' ? 'signed' : 'sent';
}

/**
 * Public contract for standalone Workspace participant documents.
 *
 * These types deliberately contain no account, team-seat, or unrelated domain
 * concepts. A participant or guardian signs through a personal bearer link.
 */

export const WORKSPACE_PARTICIPANT_DOCUMENT_TYPES = [
  "contract",
  "media_consent",
] as const;

export type WorkspaceParticipantDocumentType =
  (typeof WORKSPACE_PARTICIPANT_DOCUMENT_TYPES)[number];

export type WorkspaceParticipantDocumentStatus =
  | "draft"
  | "issued"
  | "viewed"
  | "signed"
  | "declined"
  | "withdrawn"
  | "expired"
  | "superseded";

export type WorkspaceParticipantDocumentSignerRole = "participant" | "guardian";

export interface WorkspaceParticipantGuardianInput {
  name: string;
  email: string;
  relationship: string;
}

export interface WorkspaceParticipantContractTermsInput {
  workDescription: string;
  role: string;
  startsOn?: string | null;
  endsOn?: string | null;
  cancellationTerms?: string | null;
  safetyTerms?: string | null;
  confidentialityTerms?: string | null;
  additionalTerms?: string | null;
}

/**
 * Immutable, server-derived public compensation terms bound to a contract.
 * Clients never submit this value when issuing a document.
 */
export interface WorkspaceParticipantCompensationSnapshot {
  id: string;
  version: number;
  type: "hourly" | "fixed" | "unpaid";
  hourlyRate: number | null;
  estimatedHours: number | null;
  fixedAmount: number | null;
  estimatedAmount: number | null;
  currency: string;
  note: string | null;
  publicTermsHash: string;
}

export interface WorkspaceParticipantMediaConsentTermsInput {
  mediaTypes: Array<"photo" | "video" | "audio">;
  purposes: string[];
  channels: string[];
  territory: string;
  duration: string;
  retention: string;
  editingAllowed: boolean;
  paidMediaAllowed: boolean;
  withdrawalContact: string;
  additionalTerms?: string | null;
}

export type WorkspaceParticipantDocumentIssueInput =
  | {
      documentType: "contract";
      title?: string;
      invitationExpiresInDays?: number;
      guardian?: WorkspaceParticipantGuardianInput;
      terms: WorkspaceParticipantContractTermsInput;
    }
  | {
      documentType: "media_consent";
      title?: string;
      invitationExpiresInDays?: number;
      guardian?: WorkspaceParticipantGuardianInput;
      terms: WorkspaceParticipantMediaConsentTermsInput;
    };

export interface WorkspaceParticipantDocumentSignerSummary {
  id: string;
  role: WorkspaceParticipantDocumentSignerRole;
  name: string;
  email: string | null;
  status: "pending" | "signed" | "declined";
  tokenExpiresAt: string | null;
  tokenRevokedAt: string | null;
  signedAt: string | null;
}

export interface WorkspaceParticipantDocumentSummary {
  id: string;
  participantId: string;
  documentType: WorkspaceParticipantDocumentType;
  status: WorkspaceParticipantDocumentStatus;
  version: number;
  title: string;
  contentHash: string;
  supersedesDocumentId: string | null;
  issuedAt: string;
  expiresAt: string | null;
  signedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  signer: WorkspaceParticipantDocumentSignerSummary;
  delivery: {
    status: "sent" | "failed" | null;
    provider: string | null;
    reason: string | null;
    at: string | null;
  };
}

export interface WorkspaceParticipantDocumentListResponse {
  documents: WorkspaceParticipantDocumentSummary[];
  latest: Partial<
    Record<
      WorkspaceParticipantDocumentType,
      WorkspaceParticipantDocumentSummary
    >
  >;
}

export interface WorkspaceParticipantDocumentMutationResponse {
  document: WorkspaceParticipantDocumentSummary;
  delivery: {
    sent: boolean;
    provider: string | null;
    reason: string | null;
  };
}

export interface WorkspaceParticipantLegalSnapshot {
  schemaVersion: 1;
  document: {
    id: string;
    type: WorkspaceParticipantDocumentType;
    version: number;
    title: string;
    issuedAt: string;
  };
  project: {
    id: string;
    title: string;
    organizationId: string;
  };
  producer: {
    userId: string;
    name: string;
    email: string | null;
    companyName: string | null;
  };
  participant: {
    id: string;
    name: string;
    email: string | null;
    role: string | null;
    isMinor: boolean;
  };
  signer: {
    role: WorkspaceParticipantDocumentSignerRole;
    name: string;
    email: string;
    guardianRelationship: string | null;
  };
  acceptance: {
    version: "workspace-participant-legal-acceptance-v1";
    text: string;
  };
  /**
   * Always present on newly issued snapshots. Optional only so historical
   * documents created before compensation binding remain readable.
   */
  compensation?: WorkspaceParticipantCompensationSnapshot | null;
  terms:
    | ({ kind: "contract" } & WorkspaceParticipantContractTermsInput)
    | ({ kind: "media_consent" } & WorkspaceParticipantMediaConsentTermsInput);
}

export interface WorkspaceParticipantDocumentPublicResponse {
  documentId: string;
  documentType: WorkspaceParticipantDocumentType;
  status: WorkspaceParticipantDocumentStatus;
  version: number;
  title: string;
  contentHash: string;
  issuedAt: string;
  signedAt: string | null;
  withdrawnAt: string | null;
  signerName: string;
  signerRole: WorkspaceParticipantDocumentSignerRole;
  terms: WorkspaceParticipantLegalSnapshot;
  canSign: boolean;
  canWithdraw: boolean;
}

export interface WorkspaceParticipantDocumentSignInput {
  signerName: string;
  accepted: true;
  signatureMethod: "typed";
}

export interface WorkspaceParticipantDocumentWithdrawInput {
  confirmed: true;
  reason?: string;
}

export interface WorkspaceParticipantDocumentPublicMutationResponse {
  document: WorkspaceParticipantDocumentPublicResponse;
  alreadySigned?: boolean;
  alreadyWithdrawn?: boolean;
  delivery?: {
    sent: boolean;
    provider: string | null;
    reason: string | null;
  };
}

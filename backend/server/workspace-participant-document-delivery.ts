import {
  sendTransactionalEmail,
  type TransactionalEmailOptions,
  type TransactionalEmailResult,
} from "./transactional-email-service.js";
import type {
  WorkspaceParticipantDocumentDeliveryAdapter,
  WorkspaceParticipantDocumentDeliveryRequest,
  WorkspaceParticipantDocumentDeliveryResult,
} from "./workspace-participant-documents-routes.js";
import { escapeWorkspaceParticipantDocumentEmailHtml } from "./workspace-participant-documents-service.js";

type EmailSender = (
  options: TransactionalEmailOptions,
) => Promise<TransactionalEmailResult>;

export interface WorkspaceParticipantDocumentEmailDeliveryOptions {
  sendEmail?: EmailSender;
  fromAddress?: string | null;
}

const CREATORHUB_FROM_LABEL = "CreatorHub";
const CREATORHUB_DEFAULT_FROM_ADDRESS = "no-reply@creatorhubn.com";

function configuredValue(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

export function resolveWorkspaceParticipantDocumentFromAddress(): string {
  return (
    configuredValue(process.env.CREATORHUB_RESEND_FROM_EMAIL) ??
    configuredValue(process.env.CREATORHUB_TRANSACTIONAL_FROM_EMAIL) ??
    configuredValue(process.env.CREATORHUB_GMAIL_USER) ??
    CREATORHUB_DEFAULT_FROM_ADDRESS
  );
}

function documentTypeLabel(
  request: WorkspaceParticipantDocumentDeliveryRequest,
): string {
  return request.documentType === "contract" ? "kontrakten" : "mediesamtykket";
}

function headerText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function signingEmail(
  request: WorkspaceParticipantDocumentDeliveryRequest,
): Pick<TransactionalEmailOptions, "subject" | "html" | "text"> | null {
  if (!request.portalUrl) return null;

  const recipientName = escapeWorkspaceParticipantDocumentEmailHtml(
    request.recipientName,
  );
  const projectTitle = escapeWorkspaceParticipantDocumentEmailHtml(
    request.projectTitle,
  );
  const documentTitle = escapeWorkspaceParticipantDocumentEmailHtml(
    request.documentTitle,
  );
  const portalUrl = escapeWorkspaceParticipantDocumentEmailHtml(
    request.portalUrl,
  );
  const typeLabel = documentTypeLabel(request);
  const reissued = request.kind === "workspace_participant_document_reissued";
  const introduction = reissued
    ? `Det er opprettet en ny personlig lenke til ${typeLabel}.`
    : `Du har mottatt ${typeLabel} for prosjektet.`;
  const subjectPrefix = reissued ? "Ny sikker lenke" : "Dokument til gjennomgang";

  return {
    subject: headerText(
      `${subjectPrefix}: ${request.documentTitle} – ${request.projectTitle}`,
    ),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:640px;margin:0 auto">
        <p>Hei ${recipientName},</p>
        <p>${introduction}</p>
        <p><strong>${documentTitle}</strong><br>${projectTitle}</p>
        <p><a href="${portalUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#3157d5;color:#fff;text-decoration:none">Åpne og gjennomgå dokumentet</a></p>
        <p style="font-size:13px;color:#5d6575">Lenken er personlig og skal ikke videresendes. Bruk av lenken er ikke identitetsverifisering.</p>
        <p>Vennlig hilsen<br>${CREATORHUB_FROM_LABEL}</p>
      </div>
    `.trim(),
    text: [
      `Hei ${request.recipientName},`,
      "",
      introduction,
      `${request.documentTitle} – ${request.projectTitle}`,
      "",
      request.portalUrl,
      "",
      "Lenken er personlig og skal ikke videresendes. Bruk av lenken er ikke identitetsverifisering.",
      "",
      `Vennlig hilsen\n${CREATORHUB_FROM_LABEL}`,
    ].join("\n"),
  };
}

function notificationEmail(
  request: WorkspaceParticipantDocumentDeliveryRequest,
): Pick<TransactionalEmailOptions, "subject" | "html" | "text"> {
  const recipientName = escapeWorkspaceParticipantDocumentEmailHtml(
    request.recipientName,
  );
  const projectTitle = escapeWorkspaceParticipantDocumentEmailHtml(
    request.projectTitle,
  );
  const documentTitle = escapeWorkspaceParticipantDocumentEmailHtml(
    request.documentTitle,
  );
  const withdrawn = request.kind === "workspace_participant_consent_withdrawn";
  const statusText = withdrawn
    ? "Mediesamtykket er trukket tilbake via den personlige e-postlenken."
    : "Dokumentet er signert via den personlige e-postlenken.";
  const subjectPrefix = withdrawn
    ? "Mediesamtykke trukket tilbake"
    : "Dokument signert";

  return {
    subject: headerText(`${subjectPrefix}: ${request.documentTitle}`),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:640px;margin:0 auto">
        <p>Hei ${recipientName},</p>
        <p>${statusText}</p>
        <p><strong>${documentTitle}</strong><br>${projectTitle}</p>
        <p style="font-size:13px;color:#5d6575">Hendelsen bekrefter bruk av den personlige e-postlenken, ikke verifisert identitet.</p>
        <p>Vennlig hilsen<br>${CREATORHUB_FROM_LABEL}</p>
      </div>
    `.trim(),
    text: [
      `Hei ${request.recipientName},`,
      "",
      statusText,
      `${request.documentTitle} – ${request.projectTitle}`,
      "",
      "Hendelsen bekrefter bruk av den personlige e-postlenken, ikke verifisert identitet.",
      "",
      `Vennlig hilsen\n${CREATORHUB_FROM_LABEL}`,
    ].join("\n"),
  };
}

export function createWorkspaceParticipantDocumentEmailDeliveryAdapter(
  options: WorkspaceParticipantDocumentEmailDeliveryOptions,
): WorkspaceParticipantDocumentDeliveryAdapter {
  const sendEmail = options.sendEmail ?? sendTransactionalEmail;
  const fromAddress =
    configuredValue(options.fromAddress) ??
    resolveWorkspaceParticipantDocumentFromAddress();

  return async (
    request: WorkspaceParticipantDocumentDeliveryRequest,
  ): Promise<WorkspaceParticipantDocumentDeliveryResult> => {
    const recipient = configuredValue(request.to);
    if (!recipient) {
      return { sent: false, provider: null, reason: "recipient_missing" };
    }

    const needsSigningLink =
      request.kind === "workspace_participant_document_issued" ||
      request.kind === "workspace_participant_document_reissued";
    const content = needsSigningLink
      ? signingEmail(request)
      : notificationEmail(request);
    if (!content) {
      return { sent: false, provider: null, reason: "signing_link_missing" };
    }

    const result = await sendEmail({
      to: recipient,
      ...content,
      fromLabel: CREATORHUB_FROM_LABEL,
      fromAddress,
      credentialScope: "creatorhub",
      kind: request.kind,
      // Participant delivery is audited in the tenant-scoped
      // workspace_participant_events table by the route. Never mirror the
      // recipient, project or subject into the shared Admin Room email log.
      pool: null,
    });

    return {
      sent: result.sent,
      provider: result.provider,
      reason: result.reason,
    };
  };
}

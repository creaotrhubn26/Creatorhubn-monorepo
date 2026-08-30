import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTransactionalEmailConfigured,
  resolveTransactionalEmailResendApiKey,
} from "./transactional-email-service.js";
import {
  createWorkspaceParticipantDocumentEmailDeliveryAdapter,
  resolveWorkspaceParticipantDocumentFromAddress,
} from "./workspace-participant-document-delivery.js";
import type { WorkspaceParticipantDocumentDeliveryRequest } from "./workspace-participant-documents-routes.js";

const signingRequest: WorkspaceParticipantDocumentDeliveryRequest = {
  kind: "workspace_participant_document_issued",
  to: "guardian@example.test",
  recipientName: "Ola <Guardian>",
  projectId: "project-1",
  projectTitle: "Film & <foto>",
  documentId: "document-1",
  documentType: "contract",
  documentTitle: "Kontrakt <v1>",
  portalUrl:
    "https://creatorhubn.example/participant-document/document-1#token=secret-token",
  actorUserId: "manager-1",
};

const successfulEmailResult = {
  sent: true,
  reason: null,
  provider: "resend" as const,
  messageId: "message-1",
  accepted: ["guardian@example.test"],
  errorMessage: null,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Workspace participant document email delivery", () => {
  it("sends the personal link directly with explicit CreatorHub branding", async () => {
    const sendEmail = vi.fn(async () => successfulEmailResult);
    const adapter = createWorkspaceParticipantDocumentEmailDeliveryAdapter({
      sendEmail,
      fromAddress: "documents@creatorhubn.com",
    });

    const result = await adapter(signingRequest);

    expect(result).toEqual({ sent: true, provider: "resend", reason: null });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "guardian@example.test",
        fromLabel: "CreatorHub",
        fromAddress: "documents@creatorhubn.com",
        credentialScope: "creatorhub",
        kind: "workspace_participant_document_issued",
        pool: null,
      }),
    );
    expect(sendEmail.mock.calls[0]?.[0]).not.toHaveProperty("projectId");
    expect(sendEmail.mock.calls[0]?.[0]).not.toHaveProperty("sentByUserId");
    const message = sendEmail.mock.calls[0]?.[0];
    expect(message?.html).toContain("Ola &lt;Guardian&gt;");
    expect(message?.html).toContain("Film &amp; &lt;foto&gt;");
    expect(message?.html).not.toContain("Ola <Guardian>");
    expect(message?.html).not.toContain("The Role Room");
    expect(message?.text).toContain("#token=secret-token");
    expect(message?.text).toContain("ikke identitetsverifisering");
  });

  it("fails safely without sending when a signing link is absent", async () => {
    const sendEmail = vi.fn(async () => successfulEmailResult);
    const adapter = createWorkspaceParticipantDocumentEmailDeliveryAdapter({
      sendEmail,
    });

    const result = await adapter({ ...signingRequest, portalUrl: undefined });

    expect(result).toEqual({
      sent: false,
      provider: null,
      reason: "signing_link_missing",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("describes public-link actions without claiming verified identity", async () => {
    const sendEmail = vi.fn(async () => successfulEmailResult);
    const adapter = createWorkspaceParticipantDocumentEmailDeliveryAdapter({
      sendEmail,
    });

    await adapter({
      ...signingRequest,
      kind: "workspace_participant_document_signed",
      to: "producer@example.test",
      recipientName: "Produsent",
      portalUrl: undefined,
    });

    const message = sendEmail.mock.calls[0]?.[0];
    expect(message?.html).toContain("personlige e-postlenken");
    expect(message?.html).toContain("ikke verifisert identitet");
    expect(message?.html).not.toContain("secret-token");
  });

  it("never resolves a Role Room Resend key for CreatorHub delivery", () => {
    vi.stubEnv("ROLE_ROOM_RESEND_API_KEY", "role-room-only");
    vi.stubEnv("CREATORHUB_RESEND_API_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "generic-key");

    expect(resolveTransactionalEmailResendApiKey("creatorhub")).toBe(
      "generic-key",
    );
    expect(resolveTransactionalEmailResendApiKey("default")).toBe(
      "role-room-only",
    );
  });

  it("does not use shared Gmail credentials as a CreatorHub fallback", () => {
    vi.stubEnv("CREATORHUB_RESEND_API_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("CREATORHUB_GMAIL_USER", "");
    vi.stubEnv("CREATORHUB_GMAIL_APP_PASSWORD", "");
    vi.stubEnv("GMAIL_USER", "role-room@example.test");
    vi.stubEnv("GMAIL_APP_PASSWORD", "shared-password");

    expect(isTransactionalEmailConfigured("creatorhub")).toBe(false);
    expect(isTransactionalEmailConfigured("default")).toBe(true);
  });

  it("uses a CreatorHub sender fallback instead of the shared Role Room default", () => {
    vi.stubEnv("CREATORHUB_RESEND_FROM_EMAIL", "");
    vi.stubEnv("CREATORHUB_TRANSACTIONAL_FROM_EMAIL", "");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    vi.stubEnv("CREATORHUB_GMAIL_USER", "");
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("GOOGLE_WORKSPACE_EMAIL", "");
    vi.stubEnv("GOOGLE_ADMIN_EMAIL", "");

    expect(resolveWorkspaceParticipantDocumentFromAddress()).toBe(
      "no-reply@creatorhubn.com",
    );
  });
});

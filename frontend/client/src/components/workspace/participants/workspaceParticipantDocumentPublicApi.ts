import { normalizeRequestUrl } from "@/lib/normalizeRequestUrl";
import type {
  WorkspaceParticipantDocumentPublicMutationResponse,
  WorkspaceParticipantDocumentPublicResponse,
  WorkspaceParticipantDocumentSignInput,
  WorkspaceParticipantDocumentWithdrawInput,
} from "@shared/workspace-participant-documents";
import { WorkspaceParticipantDocumentsApiError } from "./workspaceParticipantDocumentErrors";

export const WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER =
  "X-Workspace-Participant-Document-Token";

function buildPublicApiUrl(path: string): string {
  const normalizedPath = normalizeRequestUrl(path);
  const apiBaseUrl = import.meta.env?.VITE_API_URL?.trim() || "";
  const isDevelopment =
    import.meta.env?.DEV ||
    (typeof window !== "undefined" && window.location.hostname === "localhost");
  if (normalizedPath.startsWith("http")) return normalizedPath;
  return isDevelopment || !apiBaseUrl
    ? normalizedPath
    : `${apiBaseUrl.replace(/\/$/, "")}${normalizedPath}`;
}

async function publicRequest<T>(
  path: string,
  token: string,
  options?: { method?: "POST"; body?: Record<string, unknown> },
): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
    [WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER]: token,
  });
  if (options?.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(buildPublicApiUrl(path), {
      method: options?.method ?? "GET",
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new WorkspaceParticipantDocumentsApiError({
      message: "Kunne ikke kontakte dokumenttjenesten.",
      code: "network_error",
    });
  }

  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok) {
    throw new WorkspaceParticipantDocumentsApiError({
      message:
        typeof payload?.message === "string"
          ? payload.message
          : "Dokumentlenken kunne ikke behandles.",
      status: response.status,
      code:
        typeof payload?.error === "string" ? payload.error : "request_failed",
      details: payload,
    });
  }
  return payload as T;
}

const publicDocumentPath = (documentId: string): string =>
  `/api/public/workspace-participant-documents/${encodeURIComponent(documentId)}`;

export const workspaceParticipantDocumentPublicApi = {
  get(
    documentId: string,
    token: string,
  ): Promise<WorkspaceParticipantDocumentPublicResponse> {
    return publicRequest(publicDocumentPath(documentId), token);
  },

  sign(
    documentId: string,
    token: string,
    input: WorkspaceParticipantDocumentSignInput,
  ): Promise<WorkspaceParticipantDocumentPublicMutationResponse> {
    return publicRequest(`${publicDocumentPath(documentId)}/sign`, token, {
      method: "POST",
      body: input as unknown as Record<string, unknown>,
    });
  },

  withdraw(
    documentId: string,
    token: string,
    input: WorkspaceParticipantDocumentWithdrawInput,
  ): Promise<WorkspaceParticipantDocumentPublicMutationResponse> {
    return publicRequest(`${publicDocumentPath(documentId)}/withdraw`, token, {
      method: "POST",
      body: input as unknown as Record<string, unknown>,
    });
  },
};

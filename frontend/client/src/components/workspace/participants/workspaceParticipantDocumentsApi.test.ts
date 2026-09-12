import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: mocks.apiRequest,
}));

import {
  WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER,
  workspaceParticipantDocumentPublicApi,
} from "./workspaceParticipantDocumentPublicApi";
import { workspaceParticipantDocumentsApi } from "./workspaceParticipantDocumentsApi";

const TOKEN = "B".repeat(43);

describe("workspace participant document API clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses encoded manager paths and a strict empty reissue body", async () => {
    mocks.apiRequest
      .mockResolvedValueOnce({ documents: [], latest: {} })
      .mockResolvedValueOnce({ document: {}, delivery: {} })
      .mockResolvedValueOnce({ document: {}, delivery: {} });

    await workspaceParticipantDocumentsApi.list("project / 1", "participant/1");
    await workspaceParticipantDocumentsApi.issue(
      "project / 1",
      "participant/1",
      {
        documentType: "contract",
        terms: { workDescription: "Opptaksdag", role: "Statist" },
      },
    );
    await workspaceParticipantDocumentsApi.reissueLink(
      "project / 1",
      "participant/1",
      "document/1",
    );

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      1,
      "/api/projects/project%20%2F%201/participants/participant%2F1/documents",
      undefined,
    );
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      2,
      "/api/projects/project%20%2F%201/participants/participant%2F1/documents/issue",
      {
        method: "POST",
        body: {
          documentType: "contract",
          terms: { workDescription: "Opptaksdag", role: "Statist" },
        },
      },
    );
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      3,
      "/api/projects/project%20%2F%201/participants/participant%2F1/documents/document%2F1/reissue-link",
      { method: "POST", body: {} },
    );
  });

  it("sends the public credential only in the dedicated header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ documentId: "document-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await workspaceParticipantDocumentPublicApi.get("document / 1", TOKEN);

    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(String(url)).toMatch(
      /\/api\/public\/workspace-participant-documents\/document%20%2F%201$/,
    );
    expect(String(url)).not.toContain(TOKEN);
    expect(headers.get(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER)).toBe(
      TOKEN,
    );
    expect(headers.get("Authorization")).toBeNull();
    expect(init).toMatchObject({
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  });

  it("keeps the credential out of typed-signature URL and body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ document: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await workspaceParticipantDocumentPublicApi.sign("document-1", TOKEN, {
      signerName: "Kari Nordmann",
      accepted: true,
      signatureMethod: "typed",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain(TOKEN);
    expect(String(init?.body)).not.toContain(TOKEN);
    expect(JSON.parse(String(init?.body))).toEqual({
      signerName: "Kari Nordmann",
      accepted: true,
      signatureMethod: "typed",
    });
  });
});

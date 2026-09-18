import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWorkspaceParticipantDocumentCredential,
  primeWorkspaceParticipantDocumentCredential,
  primeWorkspaceParticipantDocumentCredentialFromBridge,
  takeWorkspaceParticipantDocumentCredential,
  WORKSPACE_PARTICIPANT_DOCUMENT_CREDENTIAL_BRIDGE,
} from "./workspaceParticipantDocumentCredential";

const DOCUMENT_ID = "00000000-0000-4000-8000-000000000001";
const TOKEN = "F".repeat(43);

describe("workspace participant document credential bootstrap", () => {
  beforeEach(() => {
    clearWorkspaceParticipantDocumentCredential();
    delete (window as Window & Record<symbol, unknown>)[
      Symbol.for(WORKSPACE_PARTICIPANT_DOCUMENT_CREDENTIAL_BRIDGE)
    ];
  });

  it("takes and deletes the early head bridge before exposing module memory", () => {
    const bridgeKey = Symbol.for(
      WORKSPACE_PARTICIPANT_DOCUMENT_CREDENTIAL_BRIDGE,
    );
    let credential: { documentId: string; token: string } | null = {
      documentId: DOCUMENT_ID,
      token: TOKEN,
    };
    const takeBridge = vi.fn(() => {
      const value = credential;
      credential = null;
      return value;
    });
    Object.defineProperty(window, bridgeKey, {
      value: takeBridge,
      configurable: true,
      enumerable: false,
    });

    expect(primeWorkspaceParticipantDocumentCredentialFromBridge(window)).toBe(
      true,
    );
    expect(Object.prototype.hasOwnProperty.call(window, bridgeKey)).toBe(false);
    expect(takeBridge).toHaveBeenCalledTimes(1);
    expect(takeBridge()).toBeNull();
    expect(takeWorkspaceParticipantDocumentCredential(DOCUMENT_ID)).toBe(TOKEN);
    expect(takeWorkspaceParticipantDocumentCredential(DOCUMENT_ID)).toBeNull();
  });

  it("primes before consumers, cleans the URL, and allows one take", () => {
    const replace = vi.fn();
    expect(
      primeWorkspaceParticipantDocumentCredential(
        {
          pathname: "/participant-document/" + DOCUMENT_ID,
          search: "?language=no",
          hash: "#token=" + TOKEN,
        },
        replace,
      ),
    ).toBe(true);

    expect(replace).toHaveBeenCalledWith(
      "/participant-document/" + DOCUMENT_ID + "?language=no",
    );
    expect(takeWorkspaceParticipantDocumentCredential(DOCUMENT_ID)).toBe(TOKEN);
    expect(takeWorkspaceParticipantDocumentCredential(DOCUMENT_ID)).toBeNull();
  });

  it("does not touch unrelated routes and clear removes a primed credential", () => {
    const replace = vi.fn();
    expect(
      primeWorkspaceParticipantDocumentCredential(
        { pathname: "/workspace", search: "", hash: "#token=" + TOKEN },
        replace,
      ),
    ).toBe(false);
    expect(replace).not.toHaveBeenCalled();

    primeWorkspaceParticipantDocumentCredential(
      {
        pathname: "/participant-document/" + DOCUMENT_ID,
        search: "",
        hash: "#token=" + TOKEN,
      },
      replace,
    );
    clearWorkspaceParticipantDocumentCredential();
    expect(takeWorkspaceParticipantDocumentCredential(DOCUMENT_ID)).toBeNull();
  });
});

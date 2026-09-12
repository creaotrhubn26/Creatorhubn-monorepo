import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WorkspaceParticipantDocumentPublicResponse } from "@shared/workspace-participant-documents";

const TOKEN = "C".repeat(43);
const publicApi = vi.hoisted(() => ({
  get: vi.fn(),
  sign: vi.fn(),
  withdraw: vi.fn(),
}));

vi.mock("wouter", () => ({
  useParams: () => ({ documentId: "00000000-0000-4000-8000-000000000001" }),
}));
vi.mock(
  "@/components/workspace/participants/workspaceParticipantDocumentPublicApi",
  () => ({ workspaceParticipantDocumentPublicApi: publicApi }),
);
vi.mock(
  "@/components/workspace/participants/workspaceParticipantDocumentErrors",
  () => ({ workspaceParticipantDocumentsError: (error: unknown) => error }),
);

import ParticipantDocumentPage from "./participant-document";

function contractDocument(): WorkspaceParticipantDocumentPublicResponse {
  return {
    documentId: "00000000-0000-4000-8000-000000000001",
    documentType: "contract",
    status: "viewed",
    version: 1,
    title: "Kontrakt for opptaksdag",
    contentHash: "d".repeat(64),
    issuedAt: "2026-08-30T10:00:00.000Z",
    signedAt: null,
    withdrawnAt: null,
    signerName: "Kari Nordmann",
    signerRole: "participant",
    canSign: true,
    canWithdraw: false,
    terms: {
      schemaVersion: 1,
      document: {
        id: "00000000-0000-4000-8000-000000000001",
        type: "contract",
        version: 1,
        title: "Kontrakt for opptaksdag",
        issuedAt: "2026-08-30T10:00:00.000Z",
      },
      project: {
        id: "project-1",
        title: "Reklamefilm",
        organizationId: "org-1",
      },
      producer: {
        userId: "owner-1",
        name: "Produsent Navn",
        email: "producer@example.no",
        companyName: "Filmselskapet AS",
      },
      participant: {
        id: "participant-1",
        name: "Kari Nordmann",
        email: "kari@example.no",
        role: "Statist",
        isMinor: false,
      },
      signer: {
        role: "participant",
        name: "Kari Nordmann",
        email: "kari@example.no",
        guardianRelationship: null,
      },
      acceptance: {
        version: "workspace-participant-legal-acceptance-v1",
        text: "Jeg godtar kontrakten.",
      },
      compensation: {
        id: "00000000-0000-4000-8000-000000000040",
        version: 2,
        type: "hourly",
        hourlyRate: 850,
        estimatedHours: 4,
        fixedAmount: null,
        estimatedAmount: 3400,
        currency: "NOK",
        note: "Inkluderer kostymeprøve",
        publicTermsHash: "a".repeat(64),
      },
      terms: {
        kind: "contract",
        workDescription: "Opptak i Oslo sentrum.",
        role: "Statist",
      },
    },
  };
}

function mediaDocument(): WorkspaceParticipantDocumentPublicResponse {
  const base = contractDocument();
  return {
    ...base,
    documentType: "media_consent",
    status: "signed",
    canSign: false,
    canWithdraw: true,
    signedAt: "2026-08-30T11:00:00.000Z",
    terms: {
      ...base.terms,
      document: { ...base.terms.document, type: "media_consent" },
      terms: {
        kind: "media_consent",
        mediaTypes: ["photo", "video"],
        purposes: ["Markedsføring"],
        channels: ["Nettside"],
        territory: "Norge",
        duration: "To år",
        retention: "Slettes etter tre år",
        editingAllowed: true,
        paidMediaAllowed: false,
        withdrawalContact: "privacy@example.no",
      },
    },
  };
}

describe("ParticipantDocumentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      {},
      "",
      "/participant-document/00000000-0000-4000-8000-000000000001#token=" +
        TOKEN,
    );
  });

  it("removes the fragment before fetching and requires the exact signer name", async () => {
    const initial = contractDocument();
    publicApi.get.mockImplementation(async (_id: string, token: string) => {
      expect(window.location.hash).toBe("");
      expect(token).toBe(TOKEN);
      return initial;
    });
    publicApi.sign.mockResolvedValue({
      document: {
        ...initial,
        status: "signed",
        canSign: false,
        signedAt: "2026-08-30T11:00:00.000Z",
      },
    });

    render(<ParticipantDocumentPage />);

    expect(await screen.findByText("Kontrakt for opptaksdag")).toBeTruthy();
    expect(
      screen.getByText(/identiteten er ikke verifisert med eID eller BankID/),
    ).toBeTruthy();
    expect(screen.getByText("Inkluderer kostymeprøve")).toBeTruthy();
    expect(screen.getAllByText("Timesats")).toHaveLength(2);
    expect(window.location.hash).toBe("");
    const signButton = screen.getByRole("button", {
      name: "Signer med skrevet navn",
    });
    fireEvent.change(screen.getByLabelText("Mottakernavn"), {
      target: { value: "kari nordmann" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Jeg har lest vilkårene/ }),
    );
    expect((signButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Mottakernavn"), {
      target: { value: "Kari Nordmann" },
    });
    expect((signButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(signButton);

    await waitFor(() =>
      expect(publicApi.sign).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-000000000001",
        TOKEN,
        {
          signerName: "Kari Nordmann",
          accepted: true,
          signatureMethod: "typed",
        },
      ),
    );
  });

  it("requires a separate explicit confirmation to withdraw signed media consent", async () => {
    const media = mediaDocument();
    publicApi.get.mockResolvedValue(media);
    publicApi.withdraw.mockResolvedValue({
      document: { ...media, status: "withdrawn", canWithdraw: false },
    });

    render(<ParticipantDocumentPage />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Trekk tilbake mediesamtykke",
      }),
    );
    const confirm = screen.getByRole("button", {
      name: "Bekreft tilbaketrekking",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Jeg bekrefter uttrykkelig/ }),
    );
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(publicApi.withdraw).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-000000000001",
        TOKEN,
        { confirmed: true },
      ),
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  canReissueWorkspaceParticipantDocument,
  consumeWorkspaceParticipantDocumentToken,
  isExactWorkspaceParticipantSignerName,
  parseWorkspaceParticipantDocumentList,
} from "./workspaceParticipantDocumentModel";

const TOKEN = "A".repeat(43);

describe("workspace participant document model", () => {
  it("consumes the fragment token and replaces the URL without it", () => {
    const replace = vi.fn();
    const result = consumeWorkspaceParticipantDocumentToken(
      {
        pathname: "/participant-document/document-1",
        search: "?language=no",
        hash: "#token=" + TOKEN,
      },
      replace,
    );

    expect(result).toBe(TOKEN);
    expect(replace).toHaveBeenCalledWith(
      "/participant-document/document-1?language=no",
    );
  });

  it("never accepts a query credential and strips unrelated fragments", () => {
    const replace = vi.fn();
    expect(
      consumeWorkspaceParticipantDocumentToken(
        {
          pathname: "/participant-document/document-1",
          search: "?token=" + TOKEN,
          hash: "#section",
        },
        replace,
      ),
    ).toBeNull();
    expect(replace).toHaveBeenCalledWith(
      "/participant-document/document-1?token=" + TOKEN,
    );
  });

  it("normalizes manager list fields without weakening exact signer names", () => {
    expect(
      parseWorkspaceParticipantDocumentList(
        "Nettside, Sosiale medier\nnettside\n  Kino  ",
      ),
    ).toEqual(["Nettside", "Sosiale medier", "Kino"]);
    expect(
      isExactWorkspaceParticipantSignerName("Kari Nordmann", "Kari Nordmann"),
    ).toBe(true);
    expect(
      isExactWorkspaceParticipantSignerName("kari nordmann", "Kari Nordmann"),
    ).toBe(false);
  });

  it("blocks renewal for terminal document states", () => {
    expect(canReissueWorkspaceParticipantDocument("signed")).toBe(true);
    expect(canReissueWorkspaceParticipantDocument("superseded")).toBe(false);
    expect(canReissueWorkspaceParticipantDocument("expired")).toBe(false);
  });
});

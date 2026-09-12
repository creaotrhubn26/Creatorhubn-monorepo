import { describe, expect, it } from "vitest";
import {
  buildWorkspaceParticipantClearanceRequest,
  isWorkspaceParticipantEvidenceReference,
} from "./workspaceParticipantClearanceModel";

const INTERNAL_REFERENCE =
  "creatorhub-document:00000000-0000-4000-8000-000000000111";

describe("workspace participant work-permit clearance model", () => {
  it("builds a strict OCC request and trims accepted evidence", () => {
    expect(
      buildWorkspaceParticipantClearanceRequest({
        version: 4,
        status: "approved",
        evidenceReference: `  ${INTERNAL_REFERENCE}  `,
        note: "  Kontrollert av prosjektansvarlig  ",
      }),
    ).toEqual({
      ok: true,
      request: {
        version: 4,
        status: "approved",
        evidenceReference: INTERNAL_REFERENCE,
        note: "Kontrollert av prosjektansvarlig",
      },
    });
  });

  it("accepts credential-free HTTPS and rejects unsafe references", () => {
    expect(
      isWorkspaceParticipantEvidenceReference(
        "https://secure.example.test/evidence/permit-1",
      ),
    ).toBe(true);
    expect(
      isWorkspaceParticipantEvidenceReference(
        "https://user:secret@secure.example.test/evidence",
      ),
    ).toBe(false);
    expect(
      isWorkspaceParticipantEvidenceReference("http://example.test/evidence"),
    ).toBe(false);
    expect(isWorkspaceParticipantEvidenceReference("javascript:alert(1)")).toBe(
      false,
    );
  });

  it("requires evidence for approval and rejects control characters", () => {
    expect(
      buildWorkspaceParticipantClearanceRequest({
        version: 2,
        status: "approved",
        evidenceReference: "",
        note: "",
      }),
    ).toEqual({ ok: false, code: "evidence_required" });

    expect(
      buildWorkspaceParticipantClearanceRequest({
        version: 2,
        status: "pending",
        evidenceReference: "",
        note: "Ugyldig\u0000tekst",
      }),
    ).toEqual({ ok: false, code: "control_characters" });
  });
});

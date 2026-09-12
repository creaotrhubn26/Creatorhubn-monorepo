import { describe, expect, it } from "vitest";
import {
  parseWorkspaceParticipantAuthoritativeSession,
  workspaceParticipantAuditActorUserId,
  workspaceParticipantImpersonationPayload,
} from "./workspace-participant-authoritative-session.js";

describe("workspace participant authoritative sessions", () => {
  it("accepts an ordinary persisted session without impersonation markers", () => {
    const session = parseWorkspaceParticipantAuthoritativeSession({
      userId: "target-user",
      email: "person@example.test",
      impersonatedByAdmin: false,
    }, 1_000);

    expect(session).toEqual({
      userId: "target-user",
      email: "person@example.test",
    });
    expect(workspaceParticipantAuditActorUserId(session!)).toBe("target-user");
    expect(workspaceParticipantImpersonationPayload(session!)).toEqual({});
  });

  it.each([
    { impersonatedByAdmin: false, impersonatorId: "stale-admin" },
    { impersonatedByAdmin: false, impersonatorEmail: "admin@example.test" },
    { impersonatedByAdmin: false, impersonatorSnapshot: { userId: "admin-user" } },
    { impersonatedByAdmin: false, impersonationExpiresAt: 2_000 },
    {
      impersonatedByAdmin: false,
      impersonatorId: "stale-admin",
      impersonationExpiresAt: 2_000,
    },
    {
      impersonatedByAdmin: "true",
      impersonatorId: "admin-user",
      impersonationExpiresAt: 2_000,
    },
  ])("rejects mixed persisted impersonation markers %#", (fields) => {
    expect(parseWorkspaceParticipantAuthoritativeSession({
      userId: "target-user",
      ...fields,
    }, 1_000)).toBeNull();
  });

  it("keeps effective access separate from the real audit actor", () => {
    const session = parseWorkspaceParticipantAuthoritativeSession({
      userId: "target-user",
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonationExpiresAt: 2_000,
    }, 1_000);

    expect(session?.userId).toBe("target-user");
    expect(workspaceParticipantAuditActorUserId(session!)).toBe("admin-user");
    expect(workspaceParticipantImpersonationPayload(session!)).toEqual({
      impersonated: true,
      effectiveUserId: "target-user",
    });
  });

  it("accepts an active standalone target token without a restore snapshot", () => {
    const session = parseWorkspaceParticipantAuthoritativeSession({
      userId: "target-user",
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonationExpiresAt: 2_000,
    }, 1_000);

    expect(session?.userId).toBe("target-user");
    expect(workspaceParticipantAuditActorUserId(session!)).toBe("admin-user");
  });

  it.each([
    {
      userId: "different-admin",
      email: "admin@example.test",
      name: "Admin",
      role: "super_admin",
    },
    {
      userId: "admin-user",
      email: "admin@example.test",
      name: "Admin",
      role: "admin",
    },
  ])("rejects an active impersonation with an untrustworthy snapshot %#", (snapshot) => {
    expect(parseWorkspaceParticipantAuthoritativeSession({
      userId: "target-user",
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonatorEmail: "admin@example.test",
      impersonatorSnapshot: snapshot,
      impersonationExpiresAt: 2_000,
    }, 1_000)).toBeNull();
  });

  it.each([
    { impersonatorId: "admin-user", impersonationExpiresAt: 1_000 },
    { impersonatorId: "admin-user", impersonationExpiresAt: 999 },
    { impersonatorId: "admin-user", impersonationExpiresAt: undefined },
    { impersonatorId: "admin-user", impersonationExpiresAt: "2000" },
    { impersonatorId: "", impersonationExpiresAt: 2_000 },
  ])("rejects expired or unverifiable impersonation %#", (fields) => {
    expect(parseWorkspaceParticipantAuthoritativeSession({
      userId: "target-user",
      impersonatedByAdmin: true,
      ...fields,
    }, 1_000)).toBeNull();
  });
});

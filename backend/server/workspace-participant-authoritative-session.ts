import type { AuthoritativeSession } from "./workspace-project-participants-routes.js";
import { inspectImpersonationSession } from "./impersonation-session-policy.js";

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Parses the database-backed session used by the participant routes. An
 * impersonation session is accepted only while its explicit short-lived TTL
 * is valid and while the real administrator can still be attributed.
 */
export function parseWorkspaceParticipantAuthoritativeSession(
  value: unknown,
  nowMs = Date.now(),
): AuthoritativeSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;
  const userId = nonEmptyString(source.userId);
  if (!userId) return null;

  const session: AuthoritativeSession = {
    ...(source as AuthoritativeSession),
    userId,
  };

  const inspection = inspectImpersonationSession(source, nowMs);
  if (
    inspection.kind === "active_standalone" ||
    inspection.kind === "active_restorable"
  ) {
    const impersonatorId = nonEmptyString(source.impersonatorId);
    if (!impersonatorId) return null;
    session.impersonatedByAdmin = true;
    session.impersonatorId = impersonatorId;
    session.impersonationExpiresAt = inspection.expiresAt;
    return session;
  }

  if (inspection.kind !== "ordinary") {
    return null;
  }

  delete session.impersonatedByAdmin;
  delete session.impersonatorId;
  const rawSession = session as unknown as Record<string, unknown>;
  delete rawSession.impersonatorEmail;
  delete rawSession.impersonatorSnapshot;
  delete session.impersonationExpiresAt;
  return session;
}

export function workspaceParticipantAuditActorUserId(
  session: AuthoritativeSession,
): string {
  return session.impersonatedByAdmin && session.impersonatorId
    ? session.impersonatorId
    : session.userId;
}

export function workspaceParticipantImpersonationPayload(
  session: AuthoritativeSession,
): { impersonated: true; effectiveUserId: string } | Record<string, never> {
  return session.impersonatedByAdmin && session.impersonatorId
    ? { impersonated: true, effectiveUserId: session.userId }
    : {};
}

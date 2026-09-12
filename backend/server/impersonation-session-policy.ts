type SessionRecord = Record<string, unknown>;

export type ValidImpersonatorSnapshot = SessionRecord & {
  userId: string;
  email: string;
  name: string;
  role: "super_admin";
};

export type ImpersonationSessionInspection =
  | { kind: "ordinary" }
  | { kind: "active_standalone"; expiresAt: number }
  | {
      kind: "active_restorable";
      expiresAt: number;
      snapshot: ValidImpersonatorSnapshot;
    }
  | { kind: "expired_standalone"; expiresAt: number }
  | {
      kind: "expired_restorable";
      expiresAt: number;
      snapshot: ValidImpersonatorSnapshot;
    }
  | { kind: "invalid" };

function isRecord(value: unknown): value is SessionRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasOwn(source: SessionRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function parseRestorableSnapshot(
  value: unknown,
  impersonatorId: string,
  impersonatorEmail: unknown,
): ValidImpersonatorSnapshot | null {
  if (!isRecord(value)) return null;

  const userId = nonEmptyString(value.userId);
  const email = nonEmptyString(value.email);
  const name = nonEmptyString(value.name);
  const role = nonEmptyString(value.role)?.toLowerCase();
  if (
    !userId ||
    userId !== impersonatorId ||
    !email ||
    !name ||
    role !== "super_admin"
  ) {
    return null;
  }

  const declaredImpersonatorEmail = nonEmptyString(impersonatorEmail);
  if (
    impersonatorEmail !== undefined &&
    (!declaredImpersonatorEmail || declaredImpersonatorEmail.toLowerCase() !== email.toLowerCase())
  ) {
    return null;
  }

  if (
    value.impersonatedByAdmin === true ||
    hasOwn(value, "impersonatorId") ||
    hasOwn(value, "impersonatorEmail") ||
    hasOwn(value, "impersonatorSnapshot") ||
    hasOwn(value, "impersonationExpiresAt")
  ) {
    return null;
  }

  return {
    ...value,
    userId,
    email,
    name,
    role: "super_admin",
  };
}

/**
 * Classifies the server-owned impersonation markers on an auth session.
 * Standalone target tokens are legitimate while active, but are deliberately
 * not restorable because they never carried the administrator's full session.
 */
export function inspectImpersonationSession(
  value: unknown,
  nowMs = Date.now(),
): ImpersonationSessionInspection {
  if (!isRecord(value)) return { kind: "invalid" };

  if (value.impersonatedByAdmin !== true) {
    const hasMixedMarkers =
      hasOwn(value, "impersonatorId") ||
      hasOwn(value, "impersonatorEmail") ||
      hasOwn(value, "impersonatorSnapshot") ||
      hasOwn(value, "impersonationExpiresAt") ||
      (hasOwn(value, "impersonatedByAdmin") && value.impersonatedByAdmin !== false);
    return hasMixedMarkers ? { kind: "invalid" } : { kind: "ordinary" };
  }

  const impersonatorId = nonEmptyString(value.impersonatorId);
  const expiresAt = value.impersonationExpiresAt;
  if (
    !impersonatorId ||
    typeof expiresAt !== "number" ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(new Date(expiresAt).getTime())
  ) {
    return { kind: "invalid" };
  }

  const snapshotWasProvided = hasOwn(value, "impersonatorSnapshot");
  if (!snapshotWasProvided) {
    return expiresAt > nowMs
      ? { kind: "active_standalone", expiresAt }
      : { kind: "expired_standalone", expiresAt };
  }

  const snapshot = parseRestorableSnapshot(
    value.impersonatorSnapshot,
    impersonatorId,
    value.impersonatorEmail,
  );
  if (!snapshot) return { kind: "invalid" };

  return expiresAt > nowMs
    ? { kind: "active_restorable", expiresAt, snapshot }
    : { kind: "expired_restorable", expiresAt, snapshot };
}

export function isUsablePersistedAuthSession(
  value: unknown,
  nowMs = Date.now(),
): boolean {
  const inspection = inspectImpersonationSession(value, nowMs);
  return inspection.kind === "ordinary" || inspection.kind.startsWith("active_");
}

/**
 * Null means the normal sliding TTL may be used. A timestamp binds an
 * impersonated record to its short-lived deadline. Invalid marker sets are
 * persisted already-expired so they can never be rehydrated as ordinary users.
 */
export function persistedAuthSessionExpiryBound(
  value: unknown,
): number | null {
  const inspection = inspectImpersonationSession(value, Number.NEGATIVE_INFINITY);
  if (inspection.kind === "ordinary") return null;
  if (inspection.kind === "invalid") return 0;
  return inspection.expiresAt;
}

export function restoreImpersonatorSnapshot<T extends SessionRecord>(
  session: T,
  snapshot: ValidImpersonatorSnapshot,
): T {
  Object.assign(session, snapshot);
  const mutableSession = session as SessionRecord;
  mutableSession.impersonatedByAdmin = false;
  delete mutableSession.impersonatorId;
  delete mutableSession.impersonatorEmail;
  delete mutableSession.impersonatorSnapshot;
  delete mutableSession.impersonationExpiresAt;
  return session;
}

import type express from "express";
import {
  inspectImpersonationSession,
  restoreImpersonatorSnapshot,
} from "./impersonation-session-policy.js";

type GuardSession = Record<string, unknown> & {
  userId: string;
  impersonatedByAdmin?: boolean;
  impersonatorId?: string;
};

interface ImpersonationSessionGuardDeps<T extends GuardSession> {
  activeSessions: Map<string, T>;
  readSessionToken: (req: express.Request) => string | null | undefined;
  persistSession: (token: string, session: T) => void | Promise<void>;
  revokeSession: (token: string) => void | Promise<void>;
  auditWrite?: (
    impersonatorId: string,
    targetUserId: string,
    details: { method: string; path: string },
  ) => void | Promise<void>;
  now?: () => number;
}

function isWriteMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

/**
 * Enforces the short impersonation TTL before application routes run. A
 * standalone target token has no trustworthy administrator snapshot, so its
 * only safe terminal state is revocation and a 401 response.
 */
export function createImpersonationSessionGuard<T extends GuardSession>({
  activeSessions,
  readSessionToken,
  persistSession,
  revokeSession,
  auditWrite,
  now = Date.now,
}: ImpersonationSessionGuardDeps<T>): express.RequestHandler {
  return async (req, res, next) => {
    const token = readSessionToken(req);
    if (!token) {
      next();
      return;
    }

    const session = activeSessions.get(token);
    if (!session) {
      next();
      return;
    }

    const inspection = inspectImpersonationSession(session, now());
    if (inspection.kind === "ordinary") {
      next();
      return;
    }

    if (
      inspection.kind === "active_standalone" ||
      inspection.kind === "active_restorable"
    ) {
      const method = req.method.toUpperCase();
      if (
        auditWrite &&
        isWriteMethod(method) &&
        !req.path.includes("/impersonat") &&
        session.impersonatorId
      ) {
        void Promise.resolve(
          auditWrite(session.impersonatorId, session.userId, {
            method,
            path: String(req.path).slice(0, 200),
          }),
        ).catch(() => {
          // Audit availability must not change authorization behavior.
        });
      }
      next();
      return;
    }

    if (inspection.kind === "expired_restorable") {
      restoreImpersonatorSnapshot(session, inspection.snapshot);
      activeSessions.set(token, session);
      await Promise.resolve(persistSession(token, session)).catch(() => {
        // The in-memory identity is already restored. A failed persistence
        // leaves the old DB row expired, so it cannot authorize target access.
      });
      next();
      return;
    }

    activeSessions.delete(token);
    await Promise.resolve(revokeSession(token)).catch(() => {
      // The bounded DB expiry and persisted-session parser are the secondary
      // fail-closed layer if best-effort physical deletion is unavailable.
    });
    res.status(401).json({ error: "impersonation_session_expired" });
  };
}

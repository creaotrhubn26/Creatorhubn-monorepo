/**
 * role-room-turnstile-service.ts
 *
 * Cloudflare Turnstile-verifisering for Role Room sine offentlige
 * skjemaer (per nå: education-inquiries; senere kan andre offentlige
 * Role Room-endpoints bruke samme service).
 *
 * Eksporterer en factory `createRoleRoomTurnstileService(deps)` som tar
 * inn delte index.ts-helpers (`normalizeMailConfigValue`,
 * `getDefaultRoleRoomPublicOrigin`) og returnerer 3 hovedfunksjoner:
 *
 *   - getRoleRoomTurnstileSecretKey() — leser ROLE_ROOM_TURNSTILE_SECRET_KEY
 *     eller TURNSTILE_SECRET_KEY fra env. Tom streng = ikke konfigurert.
 *   - getRoleRoomTurnstileExpectedHostnames(req) — bygger forventet sett
 *     hostnames å akseptere fra Turnstile-svaret (origin/referer/host +
 *     localhost-aliaser i ikke-produksjon).
 *   - verifyRoleRoomTurnstileToken({ token, ipAddress, expectedAction,
 *     expectedHostnames }) — kaller Cloudflare verify-API og returnerer
 *     normalisert resultat med `configured`, `success`, `errorCodes`,
 *     `hostname`, `action` og evt. `reason` ved avvisning.
 *
 * Test-secret-key (Cloudflare's "always pass") har relaxet hostname/action-
 * sjekk slik at lokal utvikling ikke krever ekte siteverify-konfig.
 */

import type express from "express";

const ROLE_ROOM_TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ROLE_ROOM_TURNSTILE_TEST_SECRET_KEY =
  "1x0000000000000000000000000000000AA";

type RoleRoomTurnstileVerificationResult = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export interface RoleRoomTurnstileVerificationOutcome {
  configured: boolean;
  success: boolean;
  hostname: string | null;
  action: string | null;
  errorCodes: string[];
  reason?: string;
}

export interface RoleRoomTurnstileServiceDeps {
  normalizeMailConfigValue: (value: unknown) => string;
  getDefaultRoleRoomPublicOrigin: () => string;
}

export interface RoleRoomTurnstileService {
  getRoleRoomTurnstileSecretKey: () => string;
  getRoleRoomTurnstileExpectedHostnames: (req: express.Request) => Set<string>;
  verifyRoleRoomTurnstileToken: (input: {
    token: string;
    ipAddress: string;
    expectedAction: string;
    expectedHostnames: Set<string>;
  }) => Promise<RoleRoomTurnstileVerificationOutcome>;
}

export function createRoleRoomTurnstileService(
  deps: RoleRoomTurnstileServiceDeps,
): RoleRoomTurnstileService {
  const { normalizeMailConfigValue, getDefaultRoleRoomPublicOrigin } = deps;

  function isRoleRoomTurnstileTestSecretKey(secret: string) {
    return secret === ROLE_ROOM_TURNSTILE_TEST_SECRET_KEY;
  }

  function normalizeRoleRoomTurnstileHostname(value: unknown) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) {
      return "";
    }

    try {
      const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
      return parsed.hostname.trim().toLowerCase();
    } catch {
      return "";
    }
  }

  function getRoleRoomTurnstileSecretKey() {
    return (
      normalizeMailConfigValue(process.env.ROLE_ROOM_TURNSTILE_SECRET_KEY) ||
      normalizeMailConfigValue(process.env.TURNSTILE_SECRET_KEY)
    );
  }

  function getRoleRoomTurnstileExpectedHostnames(req: express.Request) {
    const hostnames = new Set<string>();
    const forwardedHost = req.headers["x-forwarded-host"];
    const candidates = [
      getDefaultRoleRoomPublicOrigin(),
      req.headers.origin,
      req.headers.referer,
      Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost,
      req.headers.host,
    ];

    for (const candidate of candidates) {
      const hostname = normalizeRoleRoomTurnstileHostname(candidate);
      if (hostname) {
        hostnames.add(hostname);
      }
    }

    if (process.env.NODE_ENV !== "production") {
      hostnames.add("localhost");
      hostnames.add("127.0.0.1");
      hostnames.add("0.0.0.0");
    }

    return hostnames;
  }

  async function verifyRoleRoomTurnstileToken(input: {
    token: string;
    ipAddress: string;
    expectedAction: string;
    expectedHostnames: Set<string>;
  }): Promise<RoleRoomTurnstileVerificationOutcome> {
    const secret = getRoleRoomTurnstileSecretKey();
    if (!secret) {
      return {
        configured: false,
        success: true,
        hostname: null,
        action: null,
        errorCodes: [] as string[],
      };
    }

    const formData = new URLSearchParams();
    formData.set("secret", secret);
    formData.set("response", input.token);
    if (input.ipAddress && input.ipAddress !== "unknown") {
      formData.set("remoteip", input.ipAddress);
    }

    const response = await fetch(ROLE_ROOM_TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const result =
      (await response.json().catch(() => null)) as RoleRoomTurnstileVerificationResult | null;
    const hostname =
      typeof result?.hostname === "string"
        ? result.hostname.trim().toLowerCase()
        : "";
    const action =
      typeof result?.action === "string" ? result.action.trim() : "";
    const errorCodes = Array.isArray(result?.["error-codes"])
      ? result?.["error-codes"].filter(
          (code): code is string => typeof code === "string" && code.trim().length > 0,
        )
      : [];

    if (!response.ok || !result?.success) {
      return {
        configured: true,
        success: false,
        hostname,
        action,
        errorCodes,
        reason: "verification_failed",
      };
    }

    if (!isRoleRoomTurnstileTestSecretKey(secret) && action !== input.expectedAction) {
      return {
        configured: true,
        success: false,
        hostname,
        action,
        errorCodes,
        reason: "action_mismatch",
      };
    }

    if (
      !isRoleRoomTurnstileTestSecretKey(secret) &&
      (!hostname || !input.expectedHostnames.has(hostname))
    ) {
      return {
        configured: true,
        success: false,
        hostname,
        action,
        errorCodes,
        reason: "hostname_mismatch",
      };
    }

    return {
      configured: true,
      success: true,
      hostname,
      action,
      errorCodes,
    };
  }

  return {
    getRoleRoomTurnstileSecretKey,
    getRoleRoomTurnstileExpectedHostnames,
    verifyRoleRoomTurnstileToken,
  };
}

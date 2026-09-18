/**
 * The well-known local admin token is a developer convenience, never a
 * portable credential. It is accepted only by a development process when the
 * direct TCP peer and the HTTP Host are both loopback.
 */
export const DEV_LOCAL_ADMIN_SESSION_TOKEN = "dev-admin-local-session";

function normalizeHost(rawHost: string | undefined): string {
  const value = String(rawHost ?? "")
    .trim()
    .toLowerCase();
  if (!value) return "";

  // URL handles ports and bracketed IPv6 without treating `:` in ::1 as a
  // hostname separator. Invalid Host headers fail closed.
  try {
    return new URL(`http://${value}`).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "";
  }
}

function normalizeRemoteAddress(rawAddress: string | undefined): string {
  const value = String(rawAddress ?? "")
    .trim()
    .toLowerCase()
    .split("%")[0];
  return value.startsWith("::ffff:") ? value.slice("::ffff:".length) : value;
}

function isLoopbackHttpOrigin(rawOrigin: string | undefined): boolean {
  const value = String(rawOrigin ?? "").trim();
  if (!value) return true;

  try {
    const origin = new URL(value);
    return (
      ["http:", "https:"].includes(origin.protocol) &&
      ["localhost", "127.0.0.1", "::1"].includes(
        origin.hostname.replace(/^\[|\]$/g, "").toLowerCase(),
      )
    );
  } catch {
    return false;
  }
}

export function isLoopbackAddress(rawAddress: string | undefined): boolean {
  const address = normalizeRemoteAddress(rawAddress);
  if (address === "::1") return true;
  if (!address.startsWith("127.")) return false;

  const octets = address.split(".");
  return (
    octets.length === 4 &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  );
}

export function canUseLocalDevelopmentAdminSession(input: {
  environment: string | undefined;
  explicitlyEnabled: string | boolean | undefined;
  sessionToken: string | null;
  remoteAddress: string | undefined;
  host: string | undefined;
  origin?: string | undefined;
  fetchSite?: string | undefined;
}): boolean {
  const explicitlyEnabled =
    input.explicitlyEnabled === true ||
    (typeof input.explicitlyEnabled === "string" &&
      input.explicitlyEnabled.trim().toLowerCase() === "true");
  if (
    !explicitlyEnabled ||
    input.environment !== "development" ||
    input.sessionToken !== DEV_LOCAL_ADMIN_SESSION_TOKEN
  ) {
    return false;
  }

  // A browser request proxied by Vite can make the backend peer and Host look
  // local even when the browser itself is on the LAN or a rebound DNS name.
  // Browser provenance must therefore also be loopback and never cross-site.
  if (
    String(input.fetchSite ?? "").trim().toLowerCase() === "cross-site" ||
    !isLoopbackHttpOrigin(input.origin)
  ) {
    return false;
  }

  return (
    isLoopbackAddress(input.remoteAddress) &&
    ["localhost", "127.0.0.1", "::1"].includes(normalizeHost(input.host))
  );
}

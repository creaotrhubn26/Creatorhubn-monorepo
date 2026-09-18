const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function resolveLoopbackOrigin(
  rawValue: string,
  variableName: string,
): string {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${variableName} må være en gyldig URL`);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    url.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${variableName} må være en ren http-origin på loopback med eksplisitt port`,
    );
  }
  return url.origin;
}

export function adminWorkspaceBackendOrigin(): string {
  return resolveLoopbackOrigin(
    process.env.ADMIN_WORKSPACE_E2E_BACKEND_URL ?? "http://127.0.0.1:3317",
    "ADMIN_WORKSPACE_E2E_BACKEND_URL",
  );
}

export const ADMIN_WORKSPACE_API_BASE = `${adminWorkspaceBackendOrigin()}/api/admin-room`;
export const AUTH_TOKEN = "dev-admin-local-session";
export const AUTH_USER = {
  id: "local-admin",
  email: "admin@local.dev",
  firstName: "Local",
  lastName: "Admin",
  name: "Local Admin",
  displayName: "Local Admin",
  role: "admin",
  roleLabel: "Admin",
  profession: "photographer",
  userType: "photographer",
  permissions: ["users:read", "users:write", "roles:write"],
  isAdmin: true,
  verified_email: true,
};

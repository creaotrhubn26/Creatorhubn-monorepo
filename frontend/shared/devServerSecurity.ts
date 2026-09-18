export type DevServerSecurity = {
  localAdminEnabled: boolean;
  host: "127.0.0.1" | "0.0.0.0";
  allowedHosts: string[];
  proxyChangeOrigin: boolean;
};

/**
 * Local-admin mode carries a well-known, development-only token. Keep that
 * mode reachable from loopback only and preserve the browser Host at the
 * proxy boundary. Ordinary device testing remains available by IP while DNS
 * hostnames stay allowlisted rather than universally trusted.
 */
export function resolveDevServerSecurity(input: {
  frontendFeatureFlag: string | undefined;
  backendFeatureFlag: string | undefined;
}): DevServerSecurity {
  const isEnabled = (value: string | undefined) =>
    String(value ?? "").trim().toLowerCase() === "true";
  const localAdminEnabled =
    isEnabled(input.frontendFeatureFlag) || isEnabled(input.backendFeatureFlag);
  return {
    localAdminEnabled,
    host: localAdminEnabled ? "127.0.0.1" : "0.0.0.0",
    // Vite always permits localhost and literal IP addresses with an empty
    // allowlist. It still rejects arbitrary DNS-rebinding hostnames.
    allowedHosts: [],
    proxyChangeOrigin: !localAdminEnabled,
  };
}

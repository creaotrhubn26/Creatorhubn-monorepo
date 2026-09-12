/**
 * Canonical, validated public origin for Leadgrid links and OAuth callbacks.
 * Production links must never inherit a Role Room origin.
 */

export function validatedPublicOrigin(
  label: string,
  ...values: Array<string | undefined>
): string {
  const configured = values
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
  if (!configured) {
    throw new Error(`${label} må være konfigurert`);
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(`${label} må være en gyldig absolutt URL`);
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(`${label} må bruke HTTPS (HTTP er kun tillatt lokalt)`);
  }
  if (
    url.username ||
    url.password ||
    (url.pathname && url.pathname !== "/") ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} må være et origin uten sti, query eller fragment`);
  }
  return url.origin;
}

export function leadgridPublicOrigin(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return validatedPublicOrigin(
    "LEADGRID_PUBLIC_URL",
    env.LEADGRID_PUBLIC_URL,
    "https://leadgrid.no",
  );
}

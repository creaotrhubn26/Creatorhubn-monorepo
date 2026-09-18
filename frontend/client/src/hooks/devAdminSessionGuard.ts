const DEV_ADMIN_LOOPBACK_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
]);

export const DEV_ADMIN_SESSION_TOKEN = 'dev-admin-local-session';

export function isDevAdminLoopbackHostname(hostname: string | null | undefined): boolean {
  if (typeof hostname !== 'string') {
    return false;
  }

  const normalizedHostname = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');

  return DEV_ADMIN_LOOPBACK_HOSTNAMES.has(normalizedHostname);
}

export function canUseLocalDevAdminSession(
  viteDevelopmentMode: boolean,
  hostname: string | null | undefined,
  featureEnabled: string | undefined,
): boolean {
  return (
    viteDevelopmentMode &&
    featureEnabled === 'true' &&
    isDevAdminLoopbackHostname(hostname)
  );
}

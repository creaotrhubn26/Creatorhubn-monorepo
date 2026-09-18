import {
  canUseLocalDevAdminSession,
  DEV_ADMIN_SESSION_TOKEN,
} from './hooks/devAdminSessionGuard';

export type CastingHarnessAuthResolution = {
  token: string | null;
  sanitizedPath: string;
};

/**
 * Resolve auth for the browser-only casting harness.
 *
 * Real test sessions may be supplied in the URL fragment, which is never sent
 * to Vite or written to access logs. Legacy query tokens are scrubbed but are
 * deliberately not accepted. The well-known dev token always uses the same
 * dev + loopback + explicit-opt-in guard as the application.
 */
export function resolveCastingHarnessAuth(input: {
  url: string;
  viteDevelopmentMode: boolean;
  hostname: string;
  featureEnabled: string | undefined;
}): CastingHarnessAuthResolution {
  const parsed = new URL(input.url, 'http://localhost');
  parsed.searchParams.delete('token');

  const fragmentParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const fragmentToken = fragmentParams.get('token')?.trim() || null;
  fragmentParams.delete('token');
  const nextFragment = fragmentParams.toString();

  const canUseKnownDevToken = canUseLocalDevAdminSession(
    input.viteDevelopmentMode,
    input.hostname,
    input.featureEnabled,
  );
  const token =
    fragmentToken === DEV_ADMIN_SESSION_TOKEN
      ? canUseKnownDevToken
        ? fragmentToken
        : null
      : fragmentToken || (canUseKnownDevToken ? DEV_ADMIN_SESSION_TOKEN : null);

  return {
    token,
    sanitizedPath: `${parsed.pathname}${parsed.search}${nextFragment ? `#${nextFragment}` : ''}`,
  };
}

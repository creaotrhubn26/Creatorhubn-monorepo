/**
 * Felles LinkedIn Marketing API-versjon.
 *
 * LinkedIn pensjonerer månedsversjoner fortløpende, så alle `/rest`-kall må
 * bruke samme, aktiv versjon. Miljøvariabelen finnes for kontrollert rollout,
 * mens standarden følger gjeldende versjon ved denne leveransen (august 2026).
 */
export const LINKEDIN_API_VERSION =
  process.env.LINKEDIN_API_VERSION?.trim() || '202608';

export const LINKEDIN_REST_BASE = 'https://api.linkedin.com/rest';

export function linkedInRestHeaders(
  accessToken: string,
  extras: Record<string, string> = {},
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': LINKEDIN_API_VERSION,
    ...extras,
  };
}

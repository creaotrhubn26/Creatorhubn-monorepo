export type LeadgridStatusRouteKind =
  | 'map'
  | 'api_keys'
  | 'connector_docs'
  | 'not_found';

export type LeadgridSupplementalRoute =
  | { kind: 'developers' }
  | { kind: 'partners' }
  | {
      kind: 'status';
      status: LeadgridStatusRouteKind;
      requestedConnector?: string;
    };

export type LeadgridBillingInterval = 'monthly' | 'yearly';

export type LeadgridSignupIntent =
  | { kind: 'free'; plan: 'solo_free' }
  | {
      kind: 'paid';
      plan: 'solo_pro' | 'agency';
      billing: LeadgridBillingInterval;
    };

const CANONICAL_LEADGRID_ROUTES = new Set([
  '/leadgrid',
  '/leadgrid/personvern',
  '/leadgrid/pricing',
  '/leadgrid/priser',
  '/leadgrid/welcome',
  '/leadgrid/skaffe-leads-guide',
  '/leadgrid/feltsalg-for-salgsteam',
  '/leadgrid/akademi',
  '/leadgrid/akademi/samarbeid-salg-marked',
  '/leadgrid/akademi/velge-crm-feltsalg',
  '/leadgrid/innstillinger/partnerskap',
  '/leadgrid/partner-dashboard',
  '/leadgrid/marketplace',
  '/leadgrid/connectors',
  '/leadgrid/import',
  '/leadgrid/workflows',
  '/leadgrid/workflows/webhooks',
  '/leadgrid/deals',
  '/leadgrid/utviklere',
  '/leadgrid/utviklere/soknad',
]);

function normalizePathname(pathname: string): string {
  const pathOnly = pathname.trim().split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const withoutTrailingSlash = withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, '')
    : withLeadingSlash;
  return withoutTrailingSlash.toLowerCase();
}

/**
 * Leadgrid uses casting-main as its route owner. This predicate lets the
 * localhost/bootstrap layer select that router for every prefixed Leadgrid URL.
 */
export function isLeadgridStandalonePath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === '/leadgrid' || normalized.startsWith('/leadgrid/');
}

/**
 * Routes that historically appeared in Leadgrid CTAs, but were not handled by
 * casting-main. Canonical routes are intentionally left to the existing router.
 */
export function resolveLeadgridSupplementalRoute(
  pathname: string,
): LeadgridSupplementalRoute | null {
  const normalized = normalizePathname(pathname);

  if (normalized === '/leadgrid/developers') {
    return { kind: 'developers' };
  }
  if (normalized === '/leadgrid/partners') {
    return { kind: 'partners' };
  }
  if (normalized === '/leadgrid/map') {
    return { kind: 'status', status: 'map' };
  }
  if (normalized === '/leadgrid/api-keys') {
    return { kind: 'status', status: 'api_keys' };
  }
  if (normalized === '/leadgrid/docs' || normalized.startsWith('/leadgrid/docs/')) {
    const requestedConnector = normalized.slice('/leadgrid/docs/'.length) || undefined;
    return { kind: 'status', status: 'connector_docs', requestedConnector };
  }
  if (CANONICAL_LEADGRID_ROUTES.has(normalized)) {
    return null;
  }
  if (normalized.startsWith('/leadgrid/')) {
    return { kind: 'status', status: 'not_found' };
  }

  return null;
}

/** Parse and validate the pricing → landing handoff. */
export function parseLeadgridSignupIntent(search: string): LeadgridSignupIntent | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const plan = params.get('signup');

  if (plan === 'solo_free') {
    return { kind: 'free', plan };
  }
  if (plan === 'solo_pro' || plan === 'agency') {
    return {
      kind: 'paid',
      plan,
      billing: params.get('billing') === 'yearly' ? 'yearly' : 'monthly',
    };
  }
  return null;
}

export function describeLeadgridPaidIntent(
  intent: Extract<LeadgridSignupIntent, { kind: 'paid' }>,
): string {
  const plan = intent.plan === 'solo_pro' ? 'Solo Pro' : 'Agency';
  const billing = intent.billing === 'yearly' ? 'årlig betaling' : 'månedlig betaling';
  return `${plan} · ${billing}`;
}

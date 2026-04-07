import type { Request } from 'express';

export type GoogleWorkspaceOauthApp = 'creatorhub' | 'role_room';

type GoogleWorkspaceOauthConfig = {
  app: GoogleWorkspaceOauthApp;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  configured: boolean;
  missing: string[];
};

function readStringValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function defaultCallbackPath(app: GoogleWorkspaceOauthApp): string {
  return app === 'creatorhub'
    ? '/api/creatorhub/google/oauth/callback'
    : '/api/role-room/google/oauth/callback';
}

function isLocalhostHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isRenderHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'onrender.com' || normalized.endsWith('.onrender.com');
}

function getDefaultPublicOrigin(app: GoogleWorkspaceOauthApp): string {
  if (app === 'creatorhub') {
    return (
      readStringValue(process.env.CREATORHUB_PUBLIC_URL)
      ?? readStringValue(process.env.APP_URL)
      ?? readStringValue(process.env.PUBLIC_APP_URL)
      ?? 'https://creatorhubn.com'
    );
  }

  return (
    readStringValue(process.env.ROLE_ROOM_PUBLIC_URL)
    ?? readStringValue(process.env.ROLE_ROOM_PUBLIC_ORIGIN)
    ?? 'https://theroleroom.com'
  );
}

function parseOriginCandidate(value: string | null): URL | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function resolveRequestOrigin(
  app: GoogleWorkspaceOauthApp,
  req?: Request,
): string | null {
  if (!req) {
    return getDefaultPublicOrigin(app);
  }

  const originHeader = parseOriginCandidate(readStringValue(req.headers.origin));
  if (originHeader) {
    return isRenderHostname(originHeader.hostname)
      ? getDefaultPublicOrigin(app)
      : originHeader.origin;
  }

  const refererHeader = parseOriginCandidate(readStringValue(req.headers.referer));
  if (refererHeader) {
    return isRenderHostname(refererHeader.hostname)
      ? getDefaultPublicOrigin(app)
      : refererHeader.origin;
  }

  const host = readStringValue(req.get('host'));
  if (!host) {
    return getDefaultPublicOrigin(app);
  }

  const forwardedProto = readStringValue(req.headers['x-forwarded-proto']);
  const protocol = forwardedProto ?? req.protocol ?? 'http';
  const hostOrigin = `${protocol}://${host}`;
  const parsedHostOrigin = parseOriginCandidate(hostOrigin);
  if (!parsedHostOrigin) {
    return getDefaultPublicOrigin(app);
  }

  if (isLocalhostHostname(parsedHostOrigin.hostname)) {
    return parsedHostOrigin.origin;
  }

  if (isRenderHostname(parsedHostOrigin.hostname)) {
    return getDefaultPublicOrigin(app);
  }

  return parsedHostOrigin.origin;
}

function defaultRedirectUri(app: GoogleWorkspaceOauthApp, req?: Request): string | null {
  const requestOrigin = resolveRequestOrigin(app, req);
  if (requestOrigin) {
    return `${requestOrigin}${defaultCallbackPath(app)}`;
  }

  return app === 'creatorhub'
    ? 'http://localhost:5000/api/creatorhub/google/oauth/callback'
    : 'http://localhost:5000/api/role-room/google/oauth/callback';
}

function resolveGoogleWorkspaceRedirectUri(
  app: GoogleWorkspaceOauthApp,
  configuredRedirectUri: string | null,
  req?: Request,
): string | null {
  const requestDerivedRedirectUri = defaultRedirectUri(app, req);
  if (!configuredRedirectUri) {
    return requestDerivedRedirectUri;
  }

  if (!requestDerivedRedirectUri) {
    return configuredRedirectUri;
  }

  try {
    const configuredUrl = new URL(configuredRedirectUri);
    const requestUrl = new URL(requestDerivedRedirectUri);
    const configuredIsLocal = isLocalhostHostname(configuredUrl.hostname);
    const requestIsLocal = isLocalhostHostname(requestUrl.hostname);

    if (configuredIsLocal || requestIsLocal) {
      return configuredRedirectUri;
    }

    if (
      configuredUrl.origin !== requestUrl.origin
      || configuredUrl.pathname !== requestUrl.pathname
    ) {
      return requestDerivedRedirectUri;
    }

    return configuredRedirectUri;
  } catch {
    return requestDerivedRedirectUri;
  }
}

function detectGoogleWorkspaceOauthApp(value: unknown): GoogleWorkspaceOauthApp | null {
  const normalized = readStringValue(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'creatorhub') {
    return 'creatorhub';
  }

  if (normalized === 'role_room' || normalized === 'role-room') {
    return 'role_room';
  }

  if (
    normalized.includes('theroleroom')
    || normalized.includes('role-room')
    || normalized.includes('/casting')
    || normalized.includes('casting.html')
    || normalized.includes('theroleroom.html')
  ) {
    return 'role_room';
  }

  if (normalized.includes('creatorhub')) {
    return 'creatorhub';
  }

  return null;
}

export function normalizeGoogleWorkspaceOauthApp(
  value: unknown,
  fallback: GoogleWorkspaceOauthApp = 'creatorhub',
): GoogleWorkspaceOauthApp {
  return detectGoogleWorkspaceOauthApp(value) ?? fallback;
}

export function deriveGoogleWorkspaceOauthApp(
  req?: Request,
  fallback: GoogleWorkspaceOauthApp = 'creatorhub',
): GoogleWorkspaceOauthApp {
  if (!req) {
    return fallback;
  }

  const directHeader = detectGoogleWorkspaceOauthApp(req.headers['x-google-workspace-app']);
  if (directHeader) {
    return directHeader;
  }

  const candidates = [
    req.headers.origin,
    req.headers.referer,
    req.get('host'),
    req.originalUrl,
    req.path,
  ];

  for (const candidate of candidates) {
    const detected = detectGoogleWorkspaceOauthApp(candidate);
    if (detected) {
      return detected;
    }
  }

  return fallback;
}

export function derivePreferredGoogleWorkspaceOauthApps(
  req?: Request,
  fallback: GoogleWorkspaceOauthApp = 'creatorhub',
): GoogleWorkspaceOauthApp[] {
  const preferred = deriveGoogleWorkspaceOauthApp(req, fallback);
  return preferred === 'role_room'
    ? ['role_room', 'creatorhub']
    : ['creatorhub', 'role_room'];
}

export function getGoogleWorkspaceOauthConfig(
  app: GoogleWorkspaceOauthApp,
  req?: Request,
): GoogleWorkspaceOauthConfig {
  const envPrefix = app === 'creatorhub' ? 'CREATORHUB_GOOGLE' : 'ROLE_ROOM_GOOGLE';
  const clientId = readStringValue(process.env[`${envPrefix}_CLIENT_ID`]);
  const clientSecret = readStringValue(process.env[`${envPrefix}_CLIENT_SECRET`]);
  const redirectUri = resolveGoogleWorkspaceRedirectUri(
    app,
    readStringValue(process.env[`${envPrefix}_REDIRECT_URI`]),
    req,
  );

  return {
    app,
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret && redirectUri),
    missing: [
      !clientId ? `${envPrefix}_CLIENT_ID` : null,
      !clientSecret ? `${envPrefix}_CLIENT_SECRET` : null,
      !redirectUri ? `${envPrefix}_REDIRECT_URI` : null,
    ].filter((entry): entry is string => Boolean(entry)),
  };
}

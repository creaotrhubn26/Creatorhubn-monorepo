import { normalizeRequestUrl } from './normalizeRequestUrl';

const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || '';
const IS_DEVELOPMENT =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || window.location.hostname === 'localhost');

export const CREATORHUB_AUTH_TOKEN_KEY = 'creatorhub_auth_token';
export const CREATORHUB_AUTH_USER_KEY = 'creatorhub_auth_user';
export const CREATORHUB_USER_ID_KEY = 'userId';
export const CREATORHUB_USER_EMAIL_KEY = 'userEmail';
export const CREATORHUB_GOOGLE_LOGIN_ERROR_KEY = 'creatorhub_google_login_error';

const GOOGLE_CALLBACK_PARAMS = [
  'chGoogleStatus',
  'chGoogleTransfer',
  'chGoogleMode',
  'chGoogleMessage',
] as const;

const DASHBOARD_ROLE_SET = new Set([
  'photographer',
  'videographer',
  'music_producer',
  'vendor',
  'couple',
  'partner',
  'enterprise',
]);

export interface CreatorHubAuthUser {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  role?: string;
  roleLabel?: string;
  profession?: string;
  userType?: string;
  requestedRole?: string | null;
  loginAs?: string;
  isAdmin?: boolean;
  permissions?: string[];
  vendorId?: string;
  businessName?: string;
  coupleProfileId?: string;
  picture?: string;
  verified_email?: boolean;
  impersonatedByAdmin?: boolean;
}

export interface CreatorHubSessionSnapshot {
  token: string | null;
  user: CreatorHubAuthUser | null;
  authenticated: boolean;
  isAdmin: boolean;
  userProfession: string | null;
}

type SessionValidationCacheEntry = {
  key: string;
  snapshot: CreatorHubSessionSnapshot;
  validatedAt: number;
};

type CreatorHubAuthSessionPayload = {
  authenticated?: boolean;
  user?: Record<string, unknown> | null;
};

const SESSION_VALIDATION_TTL_MS = 30_000;

let sessionValidationCache: SessionValidationCacheEntry | null = null;
let sessionValidationPromise:
  | { key: string; promise: Promise<CreatorHubSessionSnapshot> }
  | null = null;

type RoleRoomGoogleTransferResponse = {
  mode?: string | null;
  sessionToken?: string | null;
  user?: Record<string, unknown> | null;
  google?: {
    email?: string | null;
    subject?: string | null;
    profile?: Record<string, unknown> | null;
  } | null;
  error?: string;
  message?: string;
};

export type CreatorHubGoogleCallbackIntent = {
  status: string | null;
  transferId: string | null;
  mode: 'login' | 'link' | null;
  message: string | null;
};

export type CreatorHubAcademyAudience = 'student' | 'instructor' | 'admin';

function buildApiUrlCandidates(url: string): string[] {
  const normalizedUrl = normalizeRequestUrl(url);
  if (normalizedUrl.startsWith('http')) {
    return [normalizedUrl];
  }

  const sameOriginCandidate = normalizedUrl.startsWith('/') ? normalizedUrl : null;
  const remoteCandidate = API_BASE_URL
    ? `${API_BASE_URL}${normalizedUrl}`
    : sameOriginCandidate || normalizedUrl;

  if (!IS_DEVELOPMENT) {
    return sameOriginCandidate && sameOriginCandidate !== remoteCandidate
      ? [sameOriginCandidate, remoteCandidate]
      : [sameOriginCandidate || remoteCandidate];
  }

  const localCandidate = normalizedUrl;

  return localCandidate === remoteCandidate
    ? [localCandidate]
    : [localCandidate, remoteCandidate];
}

function readStringValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRoleLikeValue(value: unknown): string | null {
  const normalized = readStringValue(value)?.toLowerCase().replace(/-/g, '_') ?? null;
  return normalized && normalized.length > 0 ? normalized : null;
}

function readStringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => readStringValue(entry))
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => entry.trim());

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function readRecordValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readStoredJson<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Slice 9X.59 — Lagre med timestamp så vi kan ignorere gamle feil ved
// neste mount. Hindrer at "redirect_uri_mismatch" fra forrige forsøk
// dukker opp etter at brukeren har fikset config og logget vellykket inn.
const ERROR_TTL_MS = 30_000;

function writeGoogleLoginError(message: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload = JSON.stringify({ message, ts: Date.now() });
    window.sessionStorage.setItem(CREATORHUB_GOOGLE_LOGIN_ERROR_KEY, payload);
  } catch {
    // Ignore storage failures.
  }
}

function removeGoogleCallbackParams(url: URL): void {
  GOOGLE_CALLBACK_PARAMS.forEach((param) => {
    url.searchParams.delete(param);
  });
}

export function hasCreatorHubGoogleCallbackState(params: URLSearchParams): boolean {
  return GOOGLE_CALLBACK_PARAMS.some((param) => params.has(param));
}

export function readCreatorHubGoogleCallbackIntent(
  params: URLSearchParams,
): CreatorHubGoogleCallbackIntent {
  const modeValue = params.get('chGoogleMode');
  return {
    status: params.get('chGoogleStatus'),
    transferId: params.get('chGoogleTransfer'),
    mode: modeValue === 'login' || modeValue === 'link' ? modeValue : null,
    message: params.get('chGoogleMessage'),
  };
}

function isDashboardRole(value: string | null): boolean {
  return Boolean(value && DASHBOARD_ROLE_SET.has(value));
}

function deriveProfession(record: Record<string, unknown>, role: string | null): string | undefined {
  const profession =
    normalizeRoleLikeValue(record.profession)
    ?? normalizeRoleLikeValue(record.userType)
    ?? normalizeRoleLikeValue(record.selectedRole)
    ?? normalizeRoleLikeValue(record.requestedRole);

  if (profession) {
    return profession;
  }

  return isDashboardRole(role) ? role ?? undefined : undefined;
}

function hasPermission(
  user: Pick<CreatorHubAuthUser, 'permissions'> | null | undefined,
  permission: string,
): boolean {
  if (!user?.permissions || user.permissions.length === 0) {
    return false;
  }

  return user.permissions.some((entry) => entry.trim().toLowerCase() === permission);
}

function normalizeCreatorHubAuthUser(
  rawUser: Record<string, unknown>,
  fallbackEmail?: string | null,
): CreatorHubAuthUser | null {
  const idCandidate = rawUser.id ?? rawUser.userId;
  const emailCandidate = readStringValue(rawUser.email) ?? readStringValue(rawUser.userEmail) ?? fallbackEmail ?? null;
  const id =
    typeof idCandidate === 'string' && idCandidate.trim()
      ? idCandidate.trim()
      : typeof idCandidate === 'number'
        ? String(idCandidate)
        : null;
  const email = emailCandidate ? emailCandidate.trim().toLowerCase() : null;

  if (!id || !email) {
    return null;
  }

  const role = normalizeRoleLikeValue(rawUser.role);
  const profession = deriveProfession(rawUser, role);
  const permissions = readStringArrayValue(rawUser.permissions);
  const displayName =
    readStringValue(rawUser.displayName)
    ?? readStringValue(rawUser.display_name)
    ?? readStringValue(rawUser.name)
    ?? email.split('@')[0];
  const name = readStringValue(rawUser.name) ?? displayName;
  const requestedRole = normalizeRoleLikeValue(rawUser.requestedRole) ?? null;
  const isAdmin =
    rawUser.isAdmin === true ||
    role === 'admin' ||
    role === 'super_admin';

  return {
    ...(rawUser as Partial<CreatorHubAuthUser>),
    id,
    email,
    name,
    displayName,
    role: role ?? undefined,
    roleLabel: readStringValue(rawUser.roleLabel) ?? readStringValue(rawUser.role_label) ?? undefined,
    profession,
    userType: profession ?? undefined,
    requestedRole,
    loginAs: normalizeRoleLikeValue(rawUser.loginAs) ?? undefined,
    isAdmin,
    permissions,
    vendorId: readStringValue(rawUser.vendorId) ?? undefined,
    businessName: readStringValue(rawUser.businessName) ?? undefined,
    coupleProfileId: readStringValue(rawUser.coupleProfileId) ?? undefined,
    picture: readStringValue(rawUser.picture) ?? undefined,
    verified_email: rawUser.verified_email === true,
    impersonatedByAdmin: rawUser.impersonatedByAdmin === true,
  };
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function fetchCreatorHubJson<T>(
  url: string,
  options?: Omit<RequestInit, 'body'> & { body?: Record<string, unknown> | string },
): Promise<T> {
  const { body, headers, ...rest } = options ?? {};
  const candidateUrls = buildApiUrlCandidates(url);
  let lastError: Error | null = null;

  for (let index = 0; index < candidateUrls.length; index += 1) {
    const candidateUrl = candidateUrls[index];

    try {
      const response = await fetch(candidateUrl, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body:
          typeof body === 'string'
            ? body
            : body !== undefined
              ? JSON.stringify(body)
              : undefined,
      });

      const payload = await readResponsePayload(response);
      if (!response.ok) {
        const errorMessage =
          typeof payload === 'object' && payload !== null
            ? readStringValue((payload as Record<string, unknown>).error)
              ?? readStringValue((payload as Record<string, unknown>).message)
            : typeof payload === 'string'
              ? payload
              : null;
        const nextError = new Error(
          errorMessage || `Request failed with status ${response.status}`,
        );

        if (index < candidateUrls.length - 1 && response.status >= 500) {
          lastError = nextError;
          continue;
        }

        throw nextError;
      }

      return payload as T;
    } catch (error) {
      const nextError = error instanceof Error ? error : new Error(String(error));
      if (index < candidateUrls.length - 1) {
        lastError = nextError;
        continue;
      }
      throw nextError;
    }
  }

  throw lastError ?? new Error('Request failed');
}

export function readCreatorHubStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const token = window.localStorage.getItem(CREATORHUB_AUTH_TOKEN_KEY);
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

export function readCreatorHubStoredUser(): CreatorHubAuthUser | null {
  const stored = readStoredJson<Record<string, unknown>>(CREATORHUB_AUTH_USER_KEY);
  return stored ? normalizeCreatorHubAuthUser(stored) : null;
}

function buildCreatorHubStoredAuthHeaders(): Record<string, string> {
  const token = readCreatorHubStoredToken();
  const user = readCreatorHubStoredUser();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }

  if (user?.id) {
    headers['x-user-id'] = user.id;
  }

  if (user?.email) {
    headers['x-user-email'] = user.email;
  }

  return headers;
}

export function readCreatorHubSessionSnapshot(): CreatorHubSessionSnapshot {
  const token = readCreatorHubStoredToken();
  const user = readCreatorHubStoredUser();
  const authenticated = Boolean(token && user);
  const isAdmin = Boolean(user?.isAdmin);
  const userProfession = user?.profession ?? user?.userType ?? null;

  return {
    token,
    user: authenticated ? user : null,
    authenticated,
    isAdmin,
    userProfession,
  };
}

function buildCreatorHubSessionSnapshot(
  token: string | null,
  user: CreatorHubAuthUser | null,
): CreatorHubSessionSnapshot {
  const authenticated = Boolean(token && user);
  return {
    token,
    user: authenticated ? user : null,
    authenticated,
    isAdmin: Boolean(user?.isAdmin),
    userProfession: user?.profession ?? user?.userType ?? null,
  };
}

function buildSessionValidationKey(
  token: string | null,
  user: CreatorHubAuthUser | null,
): string | null {
  if (!token || !user) {
    return null;
  }

  return JSON.stringify({
    token,
    id: user.id,
    email: user.email,
    role: user.role ?? null,
    requestedRole: user.requestedRole ?? null,
    verified_email: user.verified_email === true,
    impersonatedByAdmin: user.impersonatedByAdmin === true,
  });
}

function readValidatedSessionCache(
  key: string | null,
): CreatorHubSessionSnapshot | null {
  if (!key || !sessionValidationCache || sessionValidationCache.key !== key) {
    return null;
  }

  if (Date.now() - sessionValidationCache.validatedAt > SESSION_VALIDATION_TTL_MS) {
    sessionValidationCache = null;
    return null;
  }

  return sessionValidationCache.snapshot;
}

function writeValidatedSessionCache(
  key: string | null,
  snapshot: CreatorHubSessionSnapshot,
): void {
  if (!key) {
    sessionValidationCache = null;
    return;
  }

  sessionValidationCache = {
    key,
    snapshot,
    validatedAt: Date.now(),
  };
}

function clearValidatedSessionCache(): void {
  sessionValidationCache = null;
  sessionValidationPromise = null;
}

function persistCreatorHubAuthSession(
  sessionToken: string,
  user: CreatorHubAuthUser,
  dispatchEvent: boolean,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CREATORHUB_AUTH_TOKEN_KEY, sessionToken);
    window.localStorage.setItem(CREATORHUB_AUTH_USER_KEY, JSON.stringify(user));
    window.localStorage.setItem(CREATORHUB_USER_ID_KEY, user.id);
    window.localStorage.setItem(CREATORHUB_USER_EMAIL_KEY, user.email);
    if (dispatchEvent) {
      window.dispatchEvent(new Event('auth-changed'));
    }
  } catch {
    // Ignore storage failures.
  }
}

export function storeCreatorHubAuthSession(
  sessionToken: string,
  user: CreatorHubAuthUser,
): void {
  clearValidatedSessionCache();
  persistCreatorHubAuthSession(sessionToken, user, true);
}

export function clearCreatorHubAuthSession(options?: { dispatch?: boolean }): void {
  if (typeof window === 'undefined') {
    return;
  }

  clearValidatedSessionCache();

  try {
    window.localStorage.removeItem(CREATORHUB_AUTH_TOKEN_KEY);
    window.localStorage.removeItem(CREATORHUB_AUTH_USER_KEY);
    window.localStorage.removeItem(CREATORHUB_USER_ID_KEY);
    window.localStorage.removeItem(CREATORHUB_USER_EMAIL_KEY);
    if (options?.dispatch !== false) {
      window.dispatchEvent(new Event('auth-changed'));
    }
  } catch {
    // Ignore storage failures.
  }
}

export async function validateCreatorHubStoredSession(): Promise<CreatorHubSessionSnapshot> {
  const token = readCreatorHubStoredToken();
  const storedUser = readCreatorHubStoredUser();

  if (!token || !storedUser) {
    clearValidatedSessionCache();
    return buildCreatorHubSessionSnapshot(null, null);
  }

  const validationKey = buildSessionValidationKey(token, storedUser);
  const cachedSnapshot = readValidatedSessionCache(validationKey);
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  if (sessionValidationPromise?.key === validationKey) {
    return sessionValidationPromise.promise;
  }

  const validationPromise = (async () => {
    try {
    const payload = await fetchCreatorHubJson<CreatorHubAuthSessionPayload>(
      '/api/auth/user',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const normalizedServerUser = payload.user
      ? normalizeCreatorHubAuthUser(payload.user, storedUser.email)
      : null;

      if (!payload.authenticated || !normalizedServerUser) {
        // Slice 9X.60 — IKKE clear session aggressivt. Server kan returnere
        // 200 + authenticated:false i et kort race-vindu rett etter Render-
        // restart (in-memory wiped, DB-fallback ikke ferdig). Behold
        // localStorage; neste validerings-runde vil få korrekt svar.
        // Returner snapshot uten å skrive cache — så vi prøver igjen.
        console.warn('[creatorhubGoogleAuth] validateCreatorHubStoredSession: server returnerte authenticated:false. Beholder stored session (race-fix).');
        return buildCreatorHubSessionSnapshot(token, storedUser);
      }

      const mergedUser: CreatorHubAuthUser = {
        ...storedUser,
        ...normalizedServerUser,
        id: normalizedServerUser.id,
        email: normalizedServerUser.email,
        name: normalizedServerUser.name,
        displayName: normalizedServerUser.displayName ?? storedUser.displayName,
        role: normalizedServerUser.role ?? storedUser.role,
        roleLabel: normalizedServerUser.roleLabel ?? storedUser.roleLabel,
        profession: normalizedServerUser.profession ?? storedUser.profession,
        userType: normalizedServerUser.userType ?? storedUser.userType,
        requestedRole:
          normalizedServerUser.requestedRole ?? storedUser.requestedRole ?? null,
        loginAs: normalizedServerUser.loginAs ?? storedUser.loginAs,
        isAdmin: normalizedServerUser.isAdmin,
        permissions: normalizedServerUser.permissions ?? storedUser.permissions,
        vendorId: normalizedServerUser.vendorId ?? storedUser.vendorId,
        businessName:
          normalizedServerUser.businessName ?? storedUser.businessName,
        coupleProfileId:
          normalizedServerUser.coupleProfileId ?? storedUser.coupleProfileId,
        picture: normalizedServerUser.picture ?? storedUser.picture,
        verified_email: normalizedServerUser.verified_email === true,
        impersonatedByAdmin: normalizedServerUser.impersonatedByAdmin === true,
      };

      persistCreatorHubAuthSession(token, mergedUser, false);
      const nextSnapshot = buildCreatorHubSessionSnapshot(token, mergedUser);
      writeValidatedSessionCache(validationKey, nextSnapshot);
      return nextSnapshot;
    } catch {
      const nextSnapshot = buildCreatorHubSessionSnapshot(token, null);
      writeValidatedSessionCache(validationKey, nextSnapshot);
      return nextSnapshot;
    } finally {
      if (sessionValidationPromise?.key === validationKey) {
        sessionValidationPromise = null;
      }
    }
  })();

  sessionValidationPromise = {
    key: validationKey ?? token,
    promise: validationPromise,
  };

  return validationPromise;
}

export function isCreatorHubAdminImpersonation(
  user: CreatorHubAuthUser | null | undefined,
): boolean {
  return Boolean(user?.impersonatedByAdmin === true);
}

export function hasCreatorHubVerifiedGoogleSession(
  user: CreatorHubAuthUser | null | undefined,
): boolean {
  return Boolean(
    user
    && user.verified_email === true
    && readStringValue(user.email),
  );
}

export function resolveCreatorHubAcademyAudience(
  user: CreatorHubAuthUser | null | undefined,
): CreatorHubAcademyAudience | null {
  if (!user) {
    return null;
  }

  const normalizedRole = normalizeRoleLikeValue(user.role);
  const normalizedProfession = normalizeRoleLikeValue(
    user.profession ?? user.userType ?? null,
  );

  if (
    user.isAdmin
    || normalizedRole === 'admin'
    || normalizedRole === 'super_admin'
    || hasPermission(user, 'academy:admin')
  ) {
    return 'admin';
  }

  if (
    normalizedRole === 'instructor'
    || normalizedProfession === 'instructor'
    || hasPermission(user, 'academy:write')
  ) {
    return 'instructor';
  }

  return 'student';
}

export function canAccessCreatorHubStudentAcademy(
  user: CreatorHubAuthUser | null | undefined,
): boolean {
  if (!user) {
    return false;
  }

  const audience = resolveCreatorHubAcademyAudience(user);
  return audience === 'student' || audience === 'admin' || isCreatorHubAdminImpersonation(user);
}

export function buildCreatorHubGoogleReturnPath(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  const url = new URL(window.location.href);
  removeGoogleCallbackParams(url);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function clearCreatorHubGoogleIntentFromUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  removeGoogleCallbackParams(url);
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export async function startCreatorHubGoogleLogin(options?: {
  returnPath?: string;
  browserOrigin?: string;
}): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const response = await fetchCreatorHubJson<{ authorizationUrl?: string }>('/api/creatorhub/google/oauth/start', {
    method: 'POST',
    body: {
      mode: 'login',
      browserOrigin: options?.browserOrigin ?? window.location.origin,
      returnPath: options?.returnPath ?? buildCreatorHubGoogleReturnPath(),
    },
  });

  if (!response.authorizationUrl) {
    throw new Error('Kunne ikke starte Google-innloggingen.');
  }

  window.location.assign(response.authorizationUrl);
}

export async function startCreatorHubGoogleWorkspaceLink(options?: {
  returnPath?: string;
  browserOrigin?: string;
  targetConnectionUserId?: string | null;
  targetConnectionEmail?: string | null;
}): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const snapshot = readCreatorHubSessionSnapshot();
  if (!snapshot.authenticated || !snapshot.user) {
    await startCreatorHubGoogleLogin();
    return;
  }

  const response = await fetchCreatorHubJson<{ authorizationUrl?: string }>(
    '/api/creatorhub/google/oauth/start',
    {
      method: 'POST',
      headers: buildCreatorHubStoredAuthHeaders(),
      body: {
        mode: 'link',
        browserOrigin: options?.browserOrigin ?? window.location.origin,
        returnPath: options?.returnPath ?? buildCreatorHubGoogleReturnPath(),
        targetConnectionUserId:
          options?.targetConnectionUserId ?? snapshot.user.id,
        targetConnectionEmail:
          options?.targetConnectionEmail ?? snapshot.user.email,
      },
    },
  );

  if (!response.authorizationUrl) {
    throw new Error('Kunne ikke starte Google-SSO.');
  }

  window.location.assign(response.authorizationUrl);
}

export async function startCreatorHubGoogleSso(options?: {
  returnPath?: string;
  browserOrigin?: string;
  targetConnectionUserId?: string | null;
  targetConnectionEmail?: string | null;
  forceLogin?: boolean;
}): Promise<void> {
  const snapshot = readCreatorHubSessionSnapshot();
  if (!options?.forceLogin && snapshot.authenticated && snapshot.user) {
    await startCreatorHubGoogleWorkspaceLink(options);
    return;
  }

  await startCreatorHubGoogleLogin();
}

export async function completeCreatorHubGoogleLoginTransfer(
  transferId: string,
): Promise<CreatorHubAuthUser> {
  const transfer = await fetchCreatorHubJson<RoleRoomGoogleTransferResponse>(
    `/api/creatorhub/google/oauth/session-result/${encodeURIComponent(transferId)}`,
  );

  if (transfer.mode !== 'login' || !transfer.sessionToken || !transfer.user) {
    throw new Error('Google-innloggingen mangler en gyldig brukerøkt.');
  }

  const googleProfile = readRecordValue(transfer.google?.profile);
  const normalizedUser = normalizeCreatorHubAuthUser(
    {
      ...(googleProfile ?? {}),
      ...transfer.user,
      verified_email:
        transfer.user.verified_email === true
          || googleProfile?.verified_email === true,
      picture:
        readStringValue(transfer.user.picture)
        ?? readStringValue(googleProfile?.picture)
        ?? undefined,
    },
    readStringValue(transfer.google?.email) ?? undefined,
  );

  if (!normalizedUser) {
    throw new Error('Klarte ikke å lese brukeren fra Google-innloggingen.');
  }

  storeCreatorHubAuthSession(transfer.sessionToken, normalizedUser);
  return normalizedUser;
}

export async function bootstrapCreatorHubGoogleLoginRedirect(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const googleIntent = readCreatorHubGoogleCallbackIntent(params);
  const googleStatus = googleIntent.status;
  const googleMode = googleIntent.mode;
  const googleTransferId = googleIntent.transferId;
  const googleMessage = googleIntent.message;

  if (!googleStatus) {
    return;
  }

  try {
    if (googleStatus === 'error') {
      throw new Error(googleMessage || 'Google-innloggingen feilet.');
    }

    if (googleStatus !== 'success' || googleMode !== 'login' || !googleTransferId) {
      return;
    }

    await completeCreatorHubGoogleLoginTransfer(googleTransferId);
  } catch (error) {
    writeGoogleLoginError(
      error instanceof Error ? error.message : 'Google-innloggingen feilet.',
    );
  } finally {
    clearCreatorHubGoogleIntentFromUrl();
  }
}

export function consumeCreatorHubGoogleLoginError(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(CREATORHUB_GOOGLE_LOGIN_ERROR_KEY);
    if (!raw) return null;
    // Alltid rydd — selv om feilen er for gammel til å vises.
    window.sessionStorage.removeItem(CREATORHUB_GOOGLE_LOGIN_ERROR_KEY);

    // Forsøk å parse strukturert payload (new format med timestamp).
    // Faller tilbake til legacy plain-string for bakoverkompatibilitet.
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.ts && parsed.message) {
        const ageMs = Date.now() - Number(parsed.ts);
        if (ageMs > ERROR_TTL_MS) {
          // Feilen er for gammel — sannsynligvis fra et tidligere forsøk
          // som ble fulgt av vellykket innlogging. Ikke vis.
          return null;
        }
        return String(parsed.message);
      }
    } catch {
      // Ikke JSON — legacy-format. Vis ikke (vi vet ikke alder, og
      // gammel cache er mer sannsynlig enn fersk feil).
      return null;
    }
  } catch {
    // Ignore storage failures.
  }

  return null;
}

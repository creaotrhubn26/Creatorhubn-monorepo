import type {
  RoleRoomGoogleLoginResult,
  RoleRoomGoogleOauthStartInput,
} from './models/casting';
import authSessionService, { type RoleRoomLoginUser } from './services/authSessionService';
import { googleWorkspaceApi } from './services/castingApiService';

const GOOGLE_INTENT_QUERY_KEYS = [
  'rrGoogleStatus',
  'rrGoogleTransfer',
  'rrGoogleMode',
  'rrGoogleMessage',
  'rrGoogleTempToken',
] as const;

const POST_AGENT_TOKEN_STORAGE_KEYS = [
  'role_room_auth_token',
  'creatorhub_auth_token',
  'auth_token',
  'authToken',
  'sessionToken',
  'rr_session',
  'auth_session',
] as const;

type LoginTransfer = RoleRoomGoogleLoginResult & {
  mode: 'login';
  sessionToken: string;
  user: NonNullable<RoleRoomGoogleLoginResult['user']>;
};

type TwoFactorLoginResponse = {
  success?: boolean;
  token?: string;
  user?: {
    id: number | string;
    email: string;
    role: string;
    display_name?: string;
    name?: string;
    loginAs?: string;
    requestedRole?: string | null;
  };
  message?: string;
};

function toRoleRoomLoginUser(user: NonNullable<TwoFactorLoginResponse['user']>): RoleRoomLoginUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    display_name: user.display_name ?? user.name ?? user.email,
    name: user.name,
    loginAs: user.loginAs,
    requestedRole: user.requestedRole ?? null,
  };
}

export function getCleanPostAgentReturnPath(href: string): string {
  const url = new URL(href);
  GOOGLE_INTENT_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildPostAgentRoleRoomOauthInput(href: string): RoleRoomGoogleOauthStartInput {
  const url = new URL(href);
  return {
    mode: 'login',
    returnPath: getCleanPostAgentReturnPath(href),
    browserOrigin: url.origin,
  };
}

export function getPostAgentBearerToken(
  storage: Pick<Storage, 'getItem'>,
): string | null {
  for (const key of POST_AGENT_TOKEN_STORAGE_KEYS) {
    const value = storage.getItem(key);
    if (value?.trim()) return value.trim();
  }
  return null;
}

export async function startPostAgentRoleRoomGoogleLogin(
  href: string,
  navigate: (authorizationUrl: string) => void,
): Promise<void> {
  const response = await googleWorkspaceApi.startOauth(buildPostAgentRoleRoomOauthInput(href));
  if (!response.authorizationUrl) {
    throw new Error('Mangler autorisasjonslenke fra Google Workspace');
  }
  navigate(response.authorizationUrl);
}

export async function completePostAgentRoleRoomGoogleLogin(
  transferId: string,
): Promise<LoginTransfer> {
  const transfer = await googleWorkspaceApi.getOauthSessionResult(transferId);
  if (transfer.mode !== 'login' || !transfer.user || !transfer.sessionToken) {
    throw new Error('Google-innloggingen returnerte ikke en gyldig Role Room-sesjon');
  }

  await authSessionService.applyRoleRoomLogin(
    {
      id: transfer.user.id,
      email: transfer.user.email,
      role: transfer.user.role,
      display_name: transfer.user.display_name,
      name: transfer.user.name,
      loginAs: transfer.user.loginAs,
      requestedRole: transfer.user.requestedRole ?? null,
    },
    transfer.sessionToken,
  );

  return transfer as LoginTransfer;
}

export async function completePostAgentRoleRoomTwoFactorLogin(
  tempToken: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl('/api/auth/login/complete-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tempToken, code: code.trim() }),
  });
  const payload = await response.json().catch(() => null) as TwoFactorLoginResponse | null;
  if (!response.ok || !payload?.success || !payload.token || !payload.user) {
    throw new Error(payload?.message ?? 'Feil 2FA-kode. Prøv å logge inn på nytt.');
  }

  await authSessionService.applyRoleRoomLogin(toRoleRoomLoginUser(payload.user), payload.token);
}

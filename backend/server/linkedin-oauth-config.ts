/**
 * Delt LinkedIn OAuth-klientkonfig for Role Room-tilkoblingen og
 * LinkedIn-innloggingen. Begge bruker samme LinkedIn-app og samme
 * registrerte callback-URL (/api/auth/linkedin/callback); forwarderen i
 * index.ts ruter på state-prefiks.
 */

type EnvLike = Readonly<Record<string, string | undefined>>;

type RequestLike = {
  get(name: string): string | undefined;
  headers: Record<string, unknown>;
  protocol?: string;
};

function readStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface LinkedInOauthClient {
  clientId: string | null;
  clientSecret: string | null;
  complete: boolean;
}

export function resolveLinkedInOauthClient(env: EnvLike = process.env): LinkedInOauthClient {
  const clientId = readStringValue(env.ROLE_ROOM_LINKEDIN_CLIENT_ID ?? env.LINKEDIN_CLIENT_ID);
  const clientSecret = readStringValue(
    env.ROLE_ROOM_LINKEDIN_CLIENT_SECRET ?? env.LINKEDIN_CLIENT_SECRET,
  );
  return { clientId, clientSecret, complete: Boolean(clientId && clientSecret) };
}

/**
 * Callback-URL-en som er registrert hos LinkedIn. Konfigurert verdi vinner;
 * ellers utledes den fra forespørselens host (bak proxy: x-forwarded-proto).
 */
export function resolveLinkedInRedirectUri(
  req?: RequestLike | null,
  env: EnvLike = process.env,
): string | null {
  const configured = readStringValue(env.ROLE_ROOM_LINKEDIN_REDIRECT_URI);
  if (configured) return configured;
  if (!req) return null;
  const host = req.get("host");
  if (!host) return null;
  const forwardedProto = readStringValue(req.headers["x-forwarded-proto"]);
  const protocol = forwardedProto ?? req.protocol ?? "http";
  return `${protocol}://${host}/api/auth/linkedin/callback`;
}

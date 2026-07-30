/**
 * ID-porten OIDC (authorization code + PKCE) — for Skatteetatens mva-melding
 * validerings-/innsendings-API-er, som krever et ID-PORTEN-token (pålogget
 * sluttbruker via BankID), ikke Maskinporten.
 *
 * Flyt:
 *   1) /idporten/login → bygg authorize-URL (PKCE S256, state, nonce), lagre
 *      code_verifier server-side. Bruker sendes til ID-porten og logger inn med BankID.
 *   2) ID-porten redirecter til /idporten/callback?code&state.
 *   3) Veksle code → access_token (+ refresh_token) med private_key_jwt-klient-
 *      autentisering (samme RSA-nøkkel som Maskinporten-klienten kan gjenbrukes).
 *   4) Access-tokenet (scope skatteetaten:mvameldingvalidering m.fl.) brukes som
 *      Bearer mot Skatteetatens API-er, og caches per org til det utløper.
 *
 * ÆRLIG STATUS: inaktiv uten IDPORTEN_CLIENT_ID + nøkkel (`configured=false`).
 * `fetchImpl`/`now` er injiserbare for test.
 */
import { createHash, createSign, randomBytes } from 'node:crypto';

export type IdPortenEnv = 'test' | 'prod';

const ENDPOINTS: Record<IdPortenEnv, { issuer: string; authorize: string; token: string }> = {
  prod: { issuer: 'https://idporten.no', authorize: 'https://login.idporten.no/authorize', token: 'https://idporten.no/token' },
  test: { issuer: 'https://test.idporten.no', authorize: 'https://login.test.idporten.no/authorize', token: 'https://test.idporten.no/token' },
};

export interface IdPortenConfig {
  env: IdPortenEnv;
  clientId: string;
  keyId: string;
  privateKeyPem: string;
  /** Mellomromsseparert, må inkludere `openid`. */
  scopes: string;
  redirectUri: string;
}

export interface IdPortenTokens {
  accessToken: string;
  refreshToken: string | null;
  scope: string;
  subject: string | null;
  expiresInSeconds: number;
}

export class IdPortenError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'IdPortenError'; }
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** PKCE: tilfeldig verifier + S256-challenge. */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function randomToken(): string {
  return base64url(randomBytes(24));
}

export class IdPortenClient {
  private readonly ep: (typeof ENDPOINTS)[IdPortenEnv];
  constructor(
    private readonly config: IdPortenConfig | undefined,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
    private readonly timeoutMs = 15000,
  ) {
    this.ep = ENDPOINTS[config?.env ?? 'prod'];
  }

  get configured(): boolean {
    return Boolean(this.config?.clientId && this.config?.privateKeyPem && this.config?.keyId && this.config?.redirectUri);
  }
  get env(): IdPortenEnv { return this.config?.env ?? 'prod'; }

  private ensure(): IdPortenConfig {
    if (!this.configured) throw new IdPortenError('ID-porten er ikke konfigurert (IDPORTEN_CLIENT_ID + nøkkel + redirect-URL mangler).');
    return this.config as IdPortenConfig;
  }

  /** Authorize-URL bruker sendes til (BankID-innlogging). */
  buildAuthorizeUrl(params: { state: string; nonce: string; codeChallenge: string }): string {
    const cfg = this.ensure();
    const q = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: 'code',
      scope: cfg.scopes,
      redirect_uri: cfg.redirectUri,
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
      ui_locales: 'nb',
    });
    return `${this.ep.authorize}?${q.toString()}`;
  }

  /** private_key_jwt klient-assertion (RFC 7523). aud = issuer. */
  private clientAssertion(): string {
    const cfg = this.ensure();
    const nowS = this.now();
    const header = { typ: 'JWT', alg: 'RS256', kid: cfg.keyId };
    const claims = { iss: cfg.clientId, sub: cfg.clientId, aud: this.ep.issuer, jti: randomToken(), iat: nowS, exp: nowS + 60 };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
    const sig = createSign('RSA-SHA256').update(signingInput).end().sign(cfg.privateKeyPem);
    return `${signingInput}.${base64url(sig)}`;
  }

  private async tokenRequest(body: Record<string, string>): Promise<IdPortenTokens> {
    const cfg = this.ensure();
    const form = new URLSearchParams({
      ...body,
      client_id: cfg.clientId,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: this.clientAssertion(),
    }).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.ep.token, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: form,
        signal: controller.signal,
      });
      const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new IdPortenError(`ID-porten token-feil (${res.status}): ${JSON.stringify(raw).slice(0, 300)}`, res.status);
      }
      const idToken = typeof raw.id_token === 'string' ? raw.id_token : null;
      let subject: string | null = null;
      if (idToken) {
        try {
          const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64').toString('utf-8'));
          subject = typeof payload.sub === 'string' ? payload.sub : null;
        } catch { /* ignorer */ }
      }
      if (typeof raw.access_token !== 'string') throw new IdPortenError('Fikk ikke access_token fra ID-porten.');
      return {
        accessToken: raw.access_token,
        refreshToken: typeof raw.refresh_token === 'string' ? raw.refresh_token : null,
        scope: typeof raw.scope === 'string' ? raw.scope : cfg.scopes,
        subject,
        expiresInSeconds: typeof raw.expires_in === 'number' ? raw.expires_in : 300,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Steg 3: veksle authorization code → tokens. */
  exchangeCode(params: { code: string; codeVerifier: string }): Promise<IdPortenTokens> {
    return this.tokenRequest({ grant_type: 'authorization_code', code: params.code, redirect_uri: this.ensure().redirectUri, code_verifier: params.codeVerifier });
  }

  /** Forny access-token uten ny BankID-innlogging. */
  refresh(refreshToken: string): Promise<IdPortenTokens> {
    return this.tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }
}

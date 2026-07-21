/**
 * Maskinporten-klient — henter access-token for Skatteetatens/Altinns
 * «granted»-API-er (bl.a. MVA-melding-innsending) via `private_key_jwt`
 * (RFC 7523 jwt-bearer grant).
 *
 * Verifisert mot metadata 2026-07-20:
 *  - PROD:  issuer https://maskinporten.no/    token https://maskinporten.no/token
 *  - TEST:  issuer https://test.maskinporten.no/ token https://test.maskinporten.no/token
 *  - grant_types_supported: ["urn:ietf:params:oauth:grant-type:jwt-bearer"]
 *  - token_endpoint_auth_methods_supported: ["private_key_jwt"]
 *
 * ÆRLIG STATUS: klienten er ikke aktiv uten en virksomhetssertifisert
 * Maskinporten-klient (client_id + privat nøkkel registrert som JWK hos Digdir).
 * Uten legitimasjon kaster `getAccessToken` `MaskinportenAuthError` FØR
 * nettverkskall. Ingen sandbox presenteres som ekte tilkobling.
 *
 * Signeringen bruker Nodes innebygde `crypto` (RS256) — ingen ekstra avhengighet,
 * i tråd med appens «stdlib framfor bibliotek»-linje.
 */

import { createSign, randomUUID } from 'node:crypto';

export class MaskinportenError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MaskinportenError';
  }
}

/** Manglende legitimasjon, eller at Maskinporten avviste grant-assertionen. */
export class MaskinportenAuthError extends MaskinportenError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = 'MaskinportenAuthError';
  }
}

export type MaskinportenEnv = 'test' | 'prod';

export interface MaskinportenConfig {
  /** 'test' | 'prod' — velger token-endepunkt og issuer/audience. */
  env: MaskinportenEnv;
  /** client_id fra Maskinporten-klienten (Digdir Samarbeidsportal). */
  clientId: string;
  /** Rettigheter/scopes, mellomromsseparert, f.eks. 'skatteetaten:mvameldinginnsending'. */
  scope: string;
  /** Privat nøkkel i PEM (PKCS#8/PKCS#1) som matcher registrert JWK. */
  privateKeyPem: string;
  /** Nøkkel-id (kid) på den registrerte JWK-en. */
  keyId: string;
  /**
   * Konsument-org (organisasjonsnummer) når klienten opptrer på vegne av andre.
   * Legges som `consumer_org` i grant-assertionen når satt.
   */
  consumerOrg?: string;
}

export interface MaskinportenToken {
  accessToken: string;
  tokenType: string;
  /** Sekunder til utløp. */
  expiresIn: number;
  scope: string;
}

export interface MaskinportenPort {
  /** Er en fullstendig Maskinporten-klient konfigurert? Styrer ærlig status. */
  readonly configured: boolean;
  /** Miljøet klienten peker mot ('test'/'prod'), for statusrapportering. */
  readonly env: MaskinportenEnv;
  /** Henter et access-token. Kaster `MaskinportenAuthError` uten legitimasjon. */
  getAccessToken(): Promise<MaskinportenToken>;
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;

const ENDPOINTS: Record<MaskinportenEnv, { issuer: string; token: string }> = {
  prod: { issuer: 'https://maskinporten.no/', token: 'https://maskinporten.no/token' },
  test: { issuer: 'https://test.maskinporten.no/', token: 'https://test.maskinporten.no/token' },
};

const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Bygger og signerer en Maskinporten grant-assertion (RS256).
 * Eksportert for testbarhet — assertionens struktur kan verifiseres uten nettverk.
 * `nowSeconds` injiseres for deterministiske tester.
 */
export function buildGrantAssertion(cfg: MaskinportenConfig, nowSeconds: number): string {
  const { issuer } = ENDPOINTS[cfg.env];
  const header = { alg: 'RS256', typ: 'JWT', kid: cfg.keyId };
  const claims: Record<string, unknown> = {
    aud: issuer,
    iss: cfg.clientId,
    scope: cfg.scope,
    iat: nowSeconds,
    // Maskinporten tillater maks 120 s levetid på assertionen.
    exp: nowSeconds + 120,
    jti: randomUUID(),
  };
  if (cfg.consumerOrg) claims['consumer_org'] = cfg.consumerOrg;
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(cfg.privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}

export class MaskinportenClient implements MaskinportenPort {
  constructor(
    private readonly config: MaskinportenConfig | undefined,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 8000,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  get configured(): boolean {
    const c = this.config;
    return Boolean(c && c.clientId && c.scope && c.privateKeyPem && c.keyId);
  }

  get env(): MaskinportenEnv {
    return this.config?.env ?? 'test';
  }

  async getAccessToken(): Promise<MaskinportenToken> {
    if (!this.configured) {
      throw new MaskinportenAuthError(
        'Maskinporten er ikke konfigurert (client_id, scope, privat nøkkel og kid kreves). MVA-melding-innsending er ikke aktiv. Sett MASKINPORTEN_*-variablene.',
      );
    }
    const cfg = this.config as MaskinportenConfig;
    const assertion = buildGrantAssertion(cfg, this.now());
    const body = new URLSearchParams({ grant_type: GRANT_TYPE, assertion }).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(ENDPOINTS[cfg.env].token, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body,
        signal: controller.signal,
      });
      if (res.status === 400 || res.status === 401) {
        const detail = await safeText(res);
        throw new MaskinportenAuthError(
          `Maskinporten avviste grant-assertionen (${res.status}). ${detail}`.trim(),
          res.status,
        );
      }
      if (!res.ok) {
        throw new MaskinportenError(`Maskinporten svarte med status ${res.status}.`, res.status);
      }
      const json = (await res.json()) as {
        access_token?: string;
        token_type?: string;
        expires_in?: number;
        scope?: string;
      };
      if (!json.access_token) {
        throw new MaskinportenError('Maskinporten-svaret manglet access_token.');
      }
      return {
        accessToken: json.access_token,
        tokenType: json.token_type ?? 'Bearer',
        expiresIn: json.expires_in ?? 0,
        scope: json.scope ?? cfg.scope,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Test-/sandboxstub: deterministisk token uten nettverk eller nøkler. */
export class StaticMaskinportenStub implements MaskinportenPort {
  readonly configured: boolean;
  readonly env: MaskinportenEnv;

  constructor(
    private readonly token: MaskinportenToken | null = {
      accessToken: 'stub-access-token',
      tokenType: 'Bearer',
      expiresIn: 120,
      scope: 'skatteetaten:mvameldinginnsending',
    },
    opts: { env?: MaskinportenEnv; configured?: boolean } = {},
  ) {
    this.env = opts.env ?? 'test';
    this.configured = opts.configured ?? this.token !== null;
  }

  async getAccessToken(): Promise<MaskinportenToken> {
    if (!this.configured || !this.token) {
      throw new MaskinportenAuthError('Stub konfigurert uten Maskinporten-legitimasjon.');
    }
    return this.token;
  }
}

async function safeText(res: { text(): Promise<string> }): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}

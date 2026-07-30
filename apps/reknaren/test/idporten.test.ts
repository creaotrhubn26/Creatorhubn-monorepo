/**
 * ID-porten OIDC-klient: authorize-URL (PKCE S256), private_key_jwt klient-
 * assertion, og code→token-veksling. Mock-et fetch, ingen nett.
 */
import { describe, expect, it } from 'vitest';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { IdPortenClient, generatePkce } from '../src/integrations/idporten.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const cfg = { env: 'prod' as const, clientId: 'client-123', keyId: 'kid-1', privateKeyPem: pem, scopes: 'openid skatteetaten:mvameldingvalidering', redirectUri: 'https://app.example.no/idporten/callback' };
const b64url = (b: Buffer) => b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

describe('generatePkce', () => {
  it('challenge = base64url(sha256(verifier))', () => {
    const { verifier, challenge } = generatePkce();
    expect(challenge).toBe(b64url(createHash('sha256').update(verifier).digest()));
    expect(verifier).not.toContain('=');
  });
});

describe('IdPortenClient', () => {
  it('configured=false uten config', () => {
    expect(new IdPortenClient(undefined).configured).toBe(false);
  });

  it('bygger authorize-URL med PKCE og alle parametre', () => {
    const url = new URL(new IdPortenClient(cfg).buildAuthorizeUrl({ state: 'st', nonce: 'no', codeChallenge: 'ch' }));
    expect(url.origin + url.pathname).toBe('https://login.idporten.no/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid skatteetaten:mvameldingvalidering');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.no/idporten/callback');
    expect(url.searchParams.get('code_challenge')).toBe('ch');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('st');
  });

  it('veksler code → token med private_key_jwt klient-assertion', async () => {
    let captured: string | undefined;
    const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
      expect(url).toBe('https://idporten.no/token');
      captured = init.body;
      const idPayload = b64url(Buffer.from(JSON.stringify({ sub: 'person-xyz' })));
      return { status: 200, ok: true, json: async () => ({ access_token: 'AT', refresh_token: 'RT', scope: 'openid skatteetaten:mvameldingvalidering', expires_in: 300, id_token: `h.${idPayload}.s` }), text: async () => '' };
    };
    const tokens = await new IdPortenClient(cfg, fetchImpl).exchangeCode({ code: 'CODE', codeVerifier: 'VER' });
    expect(tokens.accessToken).toBe('AT');
    expect(tokens.refreshToken).toBe('RT');
    expect(tokens.subject).toBe('person-xyz');
    const form = new URLSearchParams(captured);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('CODE');
    expect(form.get('code_verifier')).toBe('VER');
    expect(form.get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    // Klient-assertion er en JWT (3 deler) med riktig iss/aud.
    const assertion = form.get('client_assertion')!;
    expect(assertion.split('.')).toHaveLength(3);
    const claims = JSON.parse(Buffer.from(assertion.split('.')[1]!, 'base64').toString());
    expect(claims.iss).toBe('client-123');
    expect(claims.aud).toBe('https://idporten.no');
  });

  it('kaster ved token-feil fra ID-porten', async () => {
    const fetchImpl = async () => ({ status: 400, ok: false, json: async () => ({ error: 'invalid_grant' }), text: async () => '' });
    await expect(new IdPortenClient(cfg, fetchImpl).exchangeCode({ code: 'x', codeVerifier: 'y' })).rejects.toThrow(/ID-porten token-feil/);
  });
});

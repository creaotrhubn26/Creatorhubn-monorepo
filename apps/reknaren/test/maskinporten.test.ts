import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MaskinportenAuthError,
  MaskinportenClient,
  StaticMaskinportenStub,
  buildGrantAssertion,
  type MaskinportenConfig,
} from '../src/integrations/maskinporten.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const cfg: MaskinportenConfig = {
  env: 'test',
  clientId: 'test-client-id',
  scope: 'altinn:instances.read altinn:instances.write',
  privateKeyPem,
  keyId: 'kid-1',
};

function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
}

function fakeFetch(responder: (url: string, body: string) => { status: number; body?: unknown; text?: string }) {
  const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
  const impl = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    calls.push({ url, body: init.body, headers: init.headers });
    const r = responder(url, init.body);
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => {
        if (r.body === undefined) throw new Error('ikke JSON');
        return r.body;
      },
      text: async () => r.text ?? '',
    };
  };
  return { impl, calls };
}

describe('Maskinporten grant-assertion', () => {
  it('bygger en RS256-JWT med korrekte claims og gyldig signatur', () => {
    const now = 1_800_000_000;
    const jwt = buildGrantAssertion(cfg, now);
    const [h, p, s] = jwt.split('.');
    const header = decodeSegment(h!);
    const claims = decodeSegment(p!);

    expect(header['alg']).toBe('RS256');
    expect(header['kid']).toBe('kid-1');
    expect(claims['iss']).toBe('test-client-id');
    expect(claims['aud']).toBe('https://test.maskinporten.no/');
    expect(claims['scope']).toBe('altinn:instances.read altinn:instances.write');
    expect(claims['iat']).toBe(now);
    expect(claims['exp']).toBe(now + 120); // Maskinporten: maks 120 s
    expect(typeof claims['jti']).toBe('string');

    // Signaturen skal verifisere mot den offentlige nøkkelen.
    const ok = createVerify('RSA-SHA256')
      .update(`${h}.${p}`)
      .verify(publicKeyPem, Buffer.from(s!.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    expect(ok).toBe(true);
  });

  it('prod-miljø gir prod-issuer som audience', () => {
    const jwt = buildGrantAssertion({ ...cfg, env: 'prod' }, 1_800_000_000);
    expect(decodeSegment(jwt.split('.')[1]!)['aud']).toBe('https://maskinporten.no/');
  });

  it('inkluderer consumer_org bare når satt', () => {
    expect(decodeSegment(buildGrantAssertion(cfg, 1).split('.')[1]!)['consumer_org']).toBeUndefined();
    const withOrg = buildGrantAssertion({ ...cfg, consumerOrg: '999888777' }, 1);
    expect(decodeSegment(withOrg.split('.')[1]!)['consumer_org']).toBe('999888777');
  });
});

describe('MaskinportenClient', () => {
  it('uten legitimasjon: configured=false og getAccessToken kaster FØR nettverkskall', async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const client = new MaskinportenClient(undefined, impl);
    expect(client.configured).toBe(false);
    await expect(client.getAccessToken()).rejects.toBeInstanceOf(MaskinportenAuthError);
    expect(calls).toHaveLength(0);
  });

  it('med legitimasjon: POST-er jwt-bearer grant til test-endepunktet og parser token', async () => {
    const { impl, calls } = fakeFetch((url, body) => {
      expect(url).toBe('https://test.maskinporten.no/token');
      const params = new URLSearchParams(body);
      expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
      expect((params.get('assertion') ?? '').split('.')).toHaveLength(3);
      return { status: 200, body: { access_token: 'AT-123', token_type: 'Bearer', expires_in: 119, scope: cfg.scope } };
    });
    const client = new MaskinportenClient(cfg, impl, 8000, () => 1_800_000_000);
    const tok = await client.getAccessToken();
    expect(tok.accessToken).toBe('AT-123');
    expect(tok.expiresIn).toBe(119);
    expect(calls[0]!.headers['content-type']).toBe('application/x-www-form-urlencoded');
  });

  it('400/401 fra Maskinporten mappes til MaskinportenAuthError', async () => {
    const bad = new MaskinportenClient(cfg, fakeFetch(() => ({ status: 400, text: 'invalid_grant' })).impl);
    await expect(bad.getAccessToken()).rejects.toBeInstanceOf(MaskinportenAuthError);
  });
});

describe('StaticMaskinportenStub', () => {
  it('leverer et deterministisk token når konfigurert', async () => {
    const stub = new StaticMaskinportenStub();
    expect(stub.configured).toBe(true);
    expect((await stub.getAccessToken()).accessToken).toBe('stub-access-token');
  });

  it('kaster som klienten når ikke konfigurert', async () => {
    const stub = new StaticMaskinportenStub(null, { configured: false });
    expect(stub.configured).toBe(false);
    await expect(stub.getAccessToken()).rejects.toBeInstanceOf(MaskinportenAuthError);
  });
});

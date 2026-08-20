import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { ApnsClient, buildApnsJwt } from '../src/integrations/apns.js';

function ecKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    pub: publicKey,
  };
}

function b64urlToJson(seg: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

describe('buildApnsJwt (ES256 provider-token)', () => {
  it('bygger et gyldig JOSE-signert token med rett header/payload', () => {
    const { priv, pub } = ecKeyPair();
    const jwt = buildApnsJwt({ keyP8: priv, keyId: 'ABC1234567', teamId: 'TEAM123456' }, 1_700_000_000);
    const [h, p, s] = jwt.split('.');
    expect(b64urlToJson(h!)).toMatchObject({ alg: 'ES256', kid: 'ABC1234567' });
    expect(b64urlToJson(p!)).toMatchObject({ iss: 'TEAM123456', iat: 1_700_000_000 });

    // Signaturen (JOSE r||s, 64 byte) verifiserer med den offentlige nøkkelen.
    const sig = Buffer.from(s!.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    expect(sig.length).toBe(64);
    const ok = crypto.verify('SHA256', Buffer.from(`${h}.${p}`), { key: pub, dsaEncoding: 'ieee-p1363' }, sig);
    expect(ok).toBe(true);
  });
});

describe('ApnsClient — ærlig inaktiv uten konfig', () => {
  it('configured=false og send returnerer sent:false uten å kaste', async () => {
    const client = new ApnsClient(undefined);
    expect(client.configured).toBe(false);
    await expect(client.send('devicetoken123456', { title: 'Hei', body: 'Test' }))
      .resolves.toMatchObject({ sent: false, reason: 'not_configured' });
  });
});

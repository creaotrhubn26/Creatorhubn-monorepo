/**
 * Apple Push Notification service (APNs) — proaktive varsler til iOS-appen.
 * Config-gated: uten APNS_*-nøkler er den ærlig inaktiv (sender kaster aldri, returnerer
 * `sent:false`). Autentiserer med provider-token (ES256 JWT signert med .p8-nøkkelen).
 */
import crypto from 'node:crypto';
import http2 from 'node:http2';

export interface ApnsConfig {
  /** Innholdet i .p8-nøkkelen (EC-privatnøkkel, PEM). */
  keyP8: string;
  /** Key ID (10 tegn) fra Apple Developer. */
  keyId: string;
  /** Team ID (10 tegn). */
  teamId: string;
  /** apns-topic = app-ens bundle-id, f.eks. com.creatorhubn.Reknaren. */
  topic: string;
  /** 'prod' → api.push.apple.com, ellers sandbox. */
  env: 'prod' | 'sandbox';
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Bygger et APNs provider-token (ES256 JWT). Ren funksjon — testbar uten nettverk.
 * `nowSeconds` injiseres for deterministiske tester.
 */
export function buildApnsJwt(cfg: Pick<ApnsConfig, 'keyP8' | 'keyId' | 'teamId'>, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }));
  const payload = base64url(JSON.stringify({ iss: cfg.teamId, iat: nowSeconds }));
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('SHA256');
  signer.update(signingInput);
  // APNs krever JOSE-formatert (r||s) ES256-signatur, ikke DER.
  const der = signer.sign(cfg.keyP8);
  const sig = derToJoseES256(der);
  return `${signingInput}.${base64url(sig)}`;
}

/** Konverterer en DER-kodet ECDSA-signatur til JOSE (fast 64-byte r||s). */
function derToJoseES256(der: Buffer): Buffer {
  // DER: 0x30 len 0x02 rlen r 0x02 slen s
  let offset = 2;
  if (der[1]! & 0x80) offset += der[1]! & 0x7f; // lang lengde-form
  const readInt = (o: number): { val: Buffer; next: number } => {
    const len = der[o + 1]!;
    let start = o + 2;
    let l = len;
    while (l > 32 && der[start] === 0x00) { start++; l--; } // fjern ledende null
    return { val: der.subarray(start, start + l), next: o + 2 + len };
  };
  const r = readInt(offset);
  const s = readInt(r.next);
  const out = Buffer.alloc(64);
  r.val.copy(out, 32 - r.val.length);
  s.val.copy(out, 64 - s.val.length);
  return out;
}

export interface ApnsPort {
  readonly configured: boolean;
  send(deviceToken: string, note: { title: string; body: string; data?: Record<string, unknown> }): Promise<{ sent: boolean; status?: number; reason?: string }>;
}

export class ApnsClient implements ApnsPort {
  private readonly cfg: ApnsConfig | undefined;
  private readonly now: () => number;

  constructor(cfg: ApnsConfig | undefined, now: () => number = () => Math.floor(Date.now() / 1000)) {
    this.cfg = cfg;
    this.now = now;
  }

  get configured(): boolean {
    return Boolean(this.cfg?.keyP8 && this.cfg?.keyId && this.cfg?.teamId && this.cfg?.topic);
  }

  async send(deviceToken: string, note: { title: string; body: string; data?: Record<string, unknown> }) {
    if (!this.cfg || !this.configured) return { sent: false, reason: 'not_configured' };
    const host = this.cfg.env === 'prod' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
    const jwt = buildApnsJwt(this.cfg, this.now());
    const payload = JSON.stringify({ aps: { alert: { title: note.title, body: note.body }, sound: 'default' }, ...(note.data ?? {}) });
    return await new Promise<{ sent: boolean; status?: number; reason?: string }>((resolve) => {
      const client = http2.connect(host);
      client.on('error', () => resolve({ sent: false, reason: 'connect_error' }));
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': this.cfg!.topic,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
      });
      let status = 0;
      req.on('response', (h) => { status = Number(h[':status']) || 0; });
      req.on('end', () => { client.close(); resolve({ sent: status === 200, status }); });
      req.on('error', () => { client.close(); resolve({ sent: false, reason: 'request_error' }); });
      req.end(payload);
    });
  }
}

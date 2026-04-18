import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import {
  parseMetaWebhookEvent,
  summariseEvent,
  verifyMetaWebhookSignature,
} from './role-room-instagram-webhook';

const APP_SECRET = 'test-app-secret';

function sign(body: Buffer): string {
  return 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
}

describe('verifyMetaWebhookSignature', () => {
  it('accepts a correctly signed body', () => {
    const body = Buffer.from('{"object":"instagram","entry":[]}', 'utf8');
    expect(verifyMetaWebhookSignature(body, sign(body), APP_SECRET)).toBe(true);
  });

  it('rejects a body with a tampered byte', () => {
    const body = Buffer.from('{"object":"instagram","entry":[]}', 'utf8');
    const sig = sign(body);
    const tampered = Buffer.concat([body, Buffer.from(' ', 'utf8')]);
    expect(verifyMetaWebhookSignature(tampered, sig, APP_SECRET)).toBe(false);
  });

  it('rejects a missing header', () => {
    const body = Buffer.from('{}', 'utf8');
    expect(verifyMetaWebhookSignature(body, undefined, APP_SECRET)).toBe(false);
  });

  it('rejects a header without the sha256= prefix', () => {
    const body = Buffer.from('{}', 'utf8');
    const bare = crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
    expect(verifyMetaWebhookSignature(body, bare, APP_SECRET)).toBe(false);
  });

  it('rejects a header with wrong hex length', () => {
    const body = Buffer.from('{}', 'utf8');
    expect(verifyMetaWebhookSignature(body, 'sha256=abcd', APP_SECRET)).toBe(false);
  });

  it('rejects when the app secret differs', () => {
    const body = Buffer.from('{"x":1}', 'utf8');
    expect(verifyMetaWebhookSignature(body, sign(body), 'wrong-secret')).toBe(false);
  });

  it('tolerates an array-valued header (Node can coalesce dupes)', () => {
    const body = Buffer.from('{}', 'utf8');
    expect(verifyMetaWebhookSignature(body, [sign(body), 'junk'], APP_SECRET)).toBe(true);
  });

  it('does not crash on a non-hex payload in the header', () => {
    const body = Buffer.from('{}', 'utf8');
    const bogus = 'sha256=' + 'z'.repeat(64);
    expect(verifyMetaWebhookSignature(body, bogus, APP_SECRET)).toBe(false);
  });
});

describe('parseMetaWebhookEvent', () => {
  it('parses a well-formed event', () => {
    const body = Buffer.from(
      JSON.stringify({ object: 'instagram', entry: [{ id: '17841', changed_fields: ['permissions'] }] }),
      'utf8',
    );
    const event = parseMetaWebhookEvent(body);
    expect(event?.object).toBe('instagram');
    expect(event?.entry?.[0].changed_fields).toContain('permissions');
  });

  it('returns null for invalid JSON', () => {
    expect(parseMetaWebhookEvent(Buffer.from('not json', 'utf8'))).toBeNull();
  });

  it('returns null for a non-object JSON value', () => {
    expect(parseMetaWebhookEvent(Buffer.from('42', 'utf8'))).toBeNull();
  });
});

describe('summariseEvent', () => {
  it('lists the set of fields seen across entries', () => {
    const summary = summariseEvent({
      object: 'instagram',
      entry: [
        { id: '1', changes: [{ field: 'media' }, { field: 'mentions' }] },
        { id: '2', changed_fields: ['permissions'] },
      ],
    });
    expect(summary).toContain('object=instagram');
    expect(summary).toContain('entries=2');
    expect(summary).toMatch(/fields=\[[a-z,]+\]/);
    expect(summary).toContain('media');
    expect(summary).toContain('mentions');
    expect(summary).toContain('permissions');
  });

  it('renders an empty field list when nothing is changed', () => {
    const summary = summariseEvent({ object: 'instagram', entry: [{ id: '1' }] });
    expect(summary).toContain('fields=[]');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  higgsfieldConfigured, higgsfieldEstimate, higgsfieldPoll, higgsfieldSubmit,
} from './generative-media.js';

const envNames = [
  'HIGGSFIELD_API_KEY',
  'HIGGSFIELD_API_KEY_ID',
  'HIGGSFIELD_API_KEY_SECRET',
] as const;

const originalEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
) as Record<(typeof envNames)[number], string | undefined>;
const requestId = '018f47a2-8b32-7d19-a271-4f6319d03c2a';
const otherRequestId = '018f47a2-8b32-7d19-a271-4f6319d03c2b';

function clearHiggsfieldEnv() {
  for (const name of envNames) delete process.env[name];
}

function restoreHiggsfieldEnv() {
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

describe('Higgsfield server credential resolution', () => {
  beforeEach(() => {
    clearHiggsfieldEnv();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreHiggsfieldEnv();
  });

  it('stays disabled when only half of the separate credential is present', () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'test-key-id';

    expect(higgsfieldConfigured()).toBe(false);
  });

  it('supports the legacy combined server credential', () => {
    process.env.HIGGSFIELD_API_KEY = 'legacy-id:legacy-secret';

    expect(higgsfieldConfigured()).toBe(true);
  });

  it('treats missing poll credentials as reconciliation-blocked, not generation failure', async () => {
    await expect(higgsfieldPoll(
      `https://api.higgsfield.ai/requests/${requestId}/status`,
    )).resolves.toEqual({
      status: 'POLLING_BLOCKED',
      error: 'higgsfield_not_configured',
    });
  });

  it('combines the two Render secrets without exposing them in responses', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'separate-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'separate-secret';
    process.env.HIGGSFIELD_API_KEY = 'legacy-id:legacy-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-Correlation-ID': 'corr-submit-1' }),
      json: async () => ({
        request_id: requestId,
        status: 'queued',
        status_url: `https://api.higgsfield.ai/requests/${requestId}/status`,
        cancel_url: `https://api.higgsfield.ai/requests/${requestId}/cancel`,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png',
      prompt: 'Controlled camera push-in',
    });

    expect(higgsfieldConfigured()).toBe(true);
    expect(result).toEqual({
      id: requestId,
      status: 'queued',
      statusUrl: `https://api.higgsfield.ai/requests/${requestId}/status`,
      cancelUrl: `https://api.higgsfield.ai/requests/${requestId}/cancel`,
      correlationId: 'corr-submit-1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.higgsfield.ai/higgsfield-ai/dop/turbo',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Key separate-id:separate-secret',
        }),
        body: JSON.stringify({
          prompt: 'Controlled camera push-in',
          image_url: 'https://assets.example.com/storyboard.png',
          enhance_prompt: false,
        }),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
      'Idempotency-Key',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(result)).not.toMatch(/separate-secret|legacy-secret/);
  });

  it('marks a transport failure as submission_unknown without retrying POST', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'submit-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'submit-secret';
    const fetchMock = vi.fn(async () => {
      throw new TypeError('socket closed after request body');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png',
      prompt: 'Controlled camera push-in',
    })).resolves.toEqual({
      error: 'higgsfield_submit_threw:socket closed after request body',
      submissionUnknown: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['timeout', new DOMException('request timed out', 'TimeoutError')],
    ['redirect', new TypeError('fetch failed because redirect mode is error')],
  ])('parks a submit %s failure without repeating the paid POST', async (
    _kind,
    failure,
  ) => {
    process.env.HIGGSFIELD_API_KEY_ID = 'submit-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'submit-secret';
    const fetchMock = vi.fn(async () => { throw failure; });
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png',
      prompt: 'Controlled camera push-in',
    })).resolves.toMatchObject({ submissionUnknown: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('treats 5xx and a 2xx without request id as ambiguous acceptance', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'submit-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'submit-secret';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false, status: 503,
        json: async () => ({ detail: 'upstream unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ status: 'queued' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png', prompt: 'Push in',
    })).resolves.toEqual({
      error: 'upstream unavailable', submissionUnknown: true,
    });
    await expect(higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png', prompt: 'Push in',
    })).resolves.toEqual({
      error: 'higgsfield_invalid_request_id', submissionUnknown: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parks an accepted request when lifecycle URLs fail the exact contract', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'submit-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'submit-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-Correlation-ID': 'corr-contract-1' }),
      json: async () => ({
        request_id: requestId,
        status: 'queued',
        status_url: `https://api.higgsfield.ai/requests/${otherRequestId}/status`,
        cancel_url: `https://api.higgsfield.ai/requests/${requestId}/cancel?unsafe=1`,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png',
      prompt: 'Controlled camera push-in',
    })).resolves.toMatchObject({
      id: requestId,
      status: 'queued',
      error: 'higgsfield_lifecycle_url_missing_or_invalid',
      acceptedContractUnknown: true,
      correlationId: 'corr-contract-1',
    });
  });

  it('passes the callback only through the documented hf_webhook query field', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'submit-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'submit-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        request_id: requestId,
        status: 'queued',
        status_url: `https://api.higgsfield.ai/requests/${requestId}/status`,
        cancel_url: `https://api.higgsfield.ai/requests/${requestId}/cancel`,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const webhookUrl =
      'https://theroleroom.com/api/role-room/'
      + `storyboard-video-webhooks/higgsfield/${'a'.repeat(64)}`;

    await expect(higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png',
      prompt: 'Controlled camera push-in',
      webhookUrl,
    })).resolves.toMatchObject({ id: requestId, status: 'queued' });

    const submittedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(submittedUrl.origin + submittedUrl.pathname).toBe(
      'https://api.higgsfield.ai/higgsfield-ai/dop/turbo',
    );
    expect(submittedUrl.searchParams.get('hf_webhook')).toBe(webhookUrl);
    expect(submittedUrl.searchParams.size).toBe(1);
  });

  it('rejects a non-HTTPS callback before provider I/O', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'submit-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'submit-secret';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png',
      prompt: 'Controlled camera push-in',
      webhookUrl: 'http://localhost/provider-callback',
    })).resolves.toEqual({ error: 'higgsfield_invalid_webhook_url' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'retryable'],
    [403, 'retryable'],
    [423, 'retryable'],
    [429, 'unknown'],
    [401, 'permanent'],
    [404, 'permanent'],
    [422, 'permanent'],
  ] as const)('classifies an explicit HTTP %s rejection as %s', async (
    status,
    rejectionKind,
  ) => {
    process.env.HIGGSFIELD_API_KEY_ID = 'submit-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'submit-secret';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status,
      headers: new Headers({ 'X-Correlation-ID': `corr-${status}` }),
      json: async () => ({ detail: `provider-${status}` }),
    })));

    await expect(higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png',
      prompt: 'Controlled camera push-in',
    })).resolves.toEqual({
      error: `provider-${status}`,
      correlationId: `corr-${status}`,
      rejectionKind,
    });
  });

  it('uses the official estimate endpoint before a paid submission', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'estimate-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'estimate-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ credits: '6.400', usd: '0.400' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldEstimate({
      imageUrl: 'https://assets.example.com/final.png',
      prompt: 'Preserve every graphite line',
    })).resolves.toEqual({ credits: 6.4, usd: 0.4 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.higgsfield.ai/estimate/higgsfield-ai/dop/turbo',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('fails a timed-out estimate closed without retrying the request', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'estimate-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'estimate-secret';
    const fetchMock = vi.fn(async () => {
      throw new DOMException('request timed out', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldEstimate({
      imageUrl: 'https://assets.example.com/final.png',
      prompt: 'Preserve every graphite line',
    })).resolves.toEqual({
      error: 'higgsfield_estimate_threw:request timed out',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('reads the current video response and rejects untrusted poll hosts', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'poll-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'poll-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-Correlation-ID': 'corr-poll-1' }),
      json: async () => ({
        request_id: requestId,
        status: 'completed',
        video: { url: 'https://cdn.example.com/final.mp4' },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldPoll(
      `https://api.higgsfield.ai/requests/${requestId}/status`,
    )).resolves.toEqual({
      status: 'COMPLETED',
      providerStatus: 'completed',
      requestId,
      outputUrl: 'https://cdn.example.com/final.mp4',
      correlationId: 'corr-poll-1',
    });
    await expect(higgsfieldPoll(
      `https://attacker.example.com/requests/${requestId}/status`,
    )).resolves.toEqual({
      status: 'CONTRACT_UNKNOWN', error: 'higgsfield_invalid_status_url',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not treat polling transport failures as terminal generation failure', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'poll-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'poll-secret';
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('temporary network loss');
    }));

    await expect(higgsfieldPoll(
      `https://api.higgsfield.ai/requests/${requestId}/status`,
    )).resolves.toEqual({
      status: 'RETRYABLE_ERROR',
      error: 'higgsfield_poll_threw:temporary network loss',
    });
  });

  it.each([
    ['timeout', new DOMException('request timed out', 'TimeoutError')],
    ['redirect', new TypeError('fetch failed because redirect mode is error')],
  ])('treats a polling %s failure as retryable', async (_kind, failure) => {
    process.env.HIGGSFIELD_API_KEY_ID = 'poll-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'poll-secret';
    const fetchMock = vi.fn(async () => { throw failure; });
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldPoll(
      `https://api.higgsfield.ai/requests/${requestId}/status`,
    )).resolves.toMatchObject({ status: 'RETRYABLE_ERROR' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('parks a mismatched polling response instead of adopting another request', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'poll-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'poll-secret';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-Correlation-ID': 'corr-mismatch' }),
      json: async () => ({ request_id: otherRequestId, status: 'queued' }),
    })));

    await expect(higgsfieldPoll(
      `https://api.higgsfield.ai/requests/${requestId}/status`,
    )).resolves.toEqual({
      status: 'CONTRACT_UNKNOWN',
      error: 'higgsfield_poll_request_mismatch',
      correlationId: 'corr-mismatch',
    });
  });
});

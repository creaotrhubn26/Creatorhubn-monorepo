import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendGmailApi, resolveGoogleConnection, createTransport } = vi.hoisted(() => ({
  sendGmailApi: vi.fn(),
  resolveGoogleConnection: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    gmail: vi.fn(() => ({ users: { messages: { send: sendGmailApi } } })),
  },
}));

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

vi.mock('./contract-google-signing', () => ({
  resolveRoleRoomGoogleConnection: resolveGoogleConnection,
}));

import { sendTransactionalEmail } from './transactional-email-service';

describe('sendTransactionalEmail Gmail API fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ROLE_ROOM_RESEND_API_KEY = 'test_resend_key';
    process.env.ROLE_ROOM_RESEND_FROM_EMAIL = 'no-reply@theroleroom.com';
    process.env.GOOGLE_ADMIN_EMAIL = 'daniel@creatorhubn.com';
    process.env.GMAIL_USER = 'daniel@creatorhubn.com';
    process.env.GMAIL_APP_PASSWORD = 'invalid-test-password';
  });

  afterEach(() => {
    delete process.env.ROLE_ROOM_RESEND_API_KEY;
    delete process.env.ROLE_ROOM_RESEND_FROM_EMAIL;
    delete process.env.GOOGLE_ADMIN_EMAIL;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    vi.unstubAllGlobals();
  });

  it('uses the encrypted connected Google account after explicit Resend-domain and SMTP-auth failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        name: 'validation_error',
        message: 'The theroleroom.com domain is not verified',
      }),
    }));

    createTransport.mockImplementation((options: { streamTransport?: boolean }) => ({
      sendMail: options.streamTransport
        ? vi.fn().mockResolvedValue({ message: Buffer.from('raw-message') })
        : vi.fn().mockRejectedValue(Object.assign(new Error('Bad credentials'), {
            code: 'EAUTH',
            responseCode: 535,
          })),
    }));
    resolveGoogleConnection.mockResolvedValue({
      oauthClient: {},
      connection: {
        googleEmail: 'daniel@creatorhubn.com',
        storedScopes: ['https://www.googleapis.com/auth/gmail.compose'],
      },
    });
    sendGmailApi.mockResolvedValue({ data: { id: 'gmail-message-123' } });

    const logQuery = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM role_room_google_connections')) {
        return Promise.resolve({ rows: [{ user_id: 'admin-user-id' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await sendTransactionalEmail({
      to: 'daniel@creatorhubn.com',
      subject: '[prototype_tester_pricing] Ny prototypesøknad',
      html: '<p>Ny søknad</p>',
      text: 'Ny søknad',
      kind: 'admin_inbound_notify',
      pool: { query: logQuery } as never,
    });

    expect(result).toEqual({
      sent: true,
      reason: null,
      provider: 'gmail_api',
      messageId: 'gmail-message-123',
      accepted: ['daniel@creatorhubn.com'],
      errorMessage: null,
    });
    expect(resolveGoogleConnection).toHaveBeenCalledWith(
      expect.anything(),
      'admin-user-id',
      expect.objectContaining({ allowFallbackToAnyUser: false }),
    );
    expect(sendGmailApi).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'me',
      requestBody: { raw: Buffer.from('raw-message').toString('base64url') },
    }));
    expect(logQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactional_email_log'),
      expect.arrayContaining(['gmail_api', 'sent', 'gmail-message-123', 'daniel@creatorhubn.com']),
    );
  });

  it('uses the Resend owner sender only for the configured internal admin recipient', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          name: 'validation_error',
          message: 'The theroleroom.com domain is not verified',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend-owner-message-123' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const logQuery = vi.fn().mockResolvedValue({ rows: [] });
    const result = await sendTransactionalEmail({
      to: 'daniel@creatorhubn.com',
      subject: '[prototype_tester_pricing] Ny prototypesøknad',
      html: '<p>Ny søknad</p>',
      text: 'Ny søknad',
      kind: 'admin_inbound_notify',
      pool: { query: logQuery } as never,
    });

    expect(result).toEqual({
      sent: true,
      reason: null,
      provider: 'resend',
      messageId: 'resend-owner-message-123',
      accepted: ['daniel@creatorhubn.com'],
      errorMessage: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      from: 'CreatorHub <onboarding@resend.dev>',
      to: ['daniel@creatorhubn.com'],
    });
    expect(createTransport).not.toHaveBeenCalled();
    expect(logQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactional_email_log'),
      expect.arrayContaining(['resend', 'sent', 'resend-owner-message-123', 'daniel@creatorhubn.com']),
    );
  });

  it('does not use the Resend owner sender for a non-admin recipient', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        name: 'validation_error',
        message: 'The theroleroom.com domain is not verified',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    createTransport.mockReturnValue({
      sendMail: vi.fn().mockRejectedValue(Object.assign(new Error('Bad credentials'), {
        code: 'EAUTH',
        responseCode: 535,
      })),
    });

    const result = await sendTransactionalEmail({
      to: 'kunde@example.com',
      subject: 'Kundemail',
      html: '<p>Kundemail</p>',
      text: 'Kundemail',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(false);
    expect(result.provider).toBe('smtp');
  });
});

import { describe, expect, it } from 'vitest';
import {
  EmailError,
  EmailNotConfiguredError,
  InMemoryEmailStub,
  ResendEmailClient,
  SmtpEmailClient,
  type MailTransport,
} from '../src/integrations/email.js';

function fakeFetch(status = 200) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const impl = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    calls.push({ url, headers: init.headers, body: init.body });
    return { status, ok: status >= 200 && status < 300, text: async () => 'detail' };
  };
  return { impl, calls };
}

const msg = { to: 'kunde@example.com', subject: 'Påminnelse', text: 'Hei' };

describe('ResendEmailClient', () => {
  it('uten nøkkel/avsender: configured=false og send kaster FØR nettverkskall', async () => {
    const { impl, calls } = fakeFetch();
    const client = new ResendEmailClient(undefined, undefined, impl);
    expect(client.configured).toBe(false);
    await expect(client.send(msg)).rejects.toBeInstanceOf(EmailNotConfiguredError);
    expect(calls).toHaveLength(0);
  });

  it('med nøkkel+avsender: POST-er til Resend med Bearer + from/to/subject/text', async () => {
    const { impl, calls } = fakeFetch(200);
    const client = new ResendEmailClient('re_key', 'faktura@creatorhubn.com', impl);
    expect(client.configured).toBe(true);
    await client.send(msg);
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(calls[0]!.headers['authorization']).toBe('Bearer re_key');
    const body = JSON.parse(calls[0]!.body);
    expect(body).toMatchObject({ from: 'faktura@creatorhubn.com', to: 'kunde@example.com', subject: 'Påminnelse' });
  });

  it('ikke-2xx fra Resend → EmailError', async () => {
    const client = new ResendEmailClient('re_key', 'f@x.no', fakeFetch(422).impl);
    await expect(client.send(msg)).rejects.toBeInstanceOf(EmailError);
  });
});

describe('SmtpEmailClient (Gmail)', () => {
  const smtp = { host: 'smtp.gmail.com', port: 465, user: 'bot@gmail.com', pass: 'app-pass', from: 'Creatorhub AS <faktura@creatorhubn.com>' };

  it('uten konfig: configured=false og send kaster', async () => {
    const client = new SmtpEmailClient(undefined);
    expect(client.configured).toBe(false);
    await expect(client.send(msg)).rejects.toBeInstanceOf(EmailNotConfiguredError);
  });

  it('med konfig: sender via transport med riktig from/to/subject', async () => {
    const sent: unknown[] = [];
    const transport: MailTransport = { sendMail: async (o) => (sent.push(o), 'ok') };
    const client = new SmtpEmailClient(smtp, () => transport);
    expect(client.configured).toBe(true);
    await client.send(msg);
    expect(sent[0]).toMatchObject({ from: 'Creatorhub AS <faktura@creatorhubn.com>', to: 'kunde@example.com', subject: 'Påminnelse' });
  });

  it('transport-feil pakkes som EmailError', async () => {
    const transport: MailTransport = { sendMail: async () => { throw new Error('SMTP nede'); } };
    const client = new SmtpEmailClient(smtp, () => transport);
    await expect(client.send(msg)).rejects.toBeInstanceOf(EmailError);
  });
});

describe('InMemoryEmailStub', () => {
  it('samler sendte e-poster', async () => {
    const stub = new InMemoryEmailStub();
    await stub.send(msg);
    expect(stub.sent).toHaveLength(1);
    expect(stub.sent[0]!.to).toBe('kunde@example.com');
  });

  it('uten konfig kaster', async () => {
    const stub = new InMemoryEmailStub({ configured: false });
    await expect(stub.send(msg)).rejects.toBeInstanceOf(EmailNotConfiguredError);
  });
});

/**
 * Utgående e-post (for betalingspåminnelser m.m.). Reknaren hadde ingen sender
 * fra før (kun innkommende Gmail-sandbox). Bak en port, med ærlig status: uten
 * `REKNAREN_RESEND_API_KEY` (+ avsender) er sending IKKE aktiv og `send` kaster
 * `EmailNotConfiguredError` FØR nettverkskall.
 *
 * Provider: Resend (enkelt HTTP-API). Bytt til SMTP/SendGrid ved å implementere
 * `EmailPort` på nytt — resten av koden bryr seg bare om porten.
 */

export class EmailError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

export class EmailNotConfiguredError extends EmailError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailNotConfiguredError';
  }
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  /** MIME-type, f.eks. 'application/pdf'. */
  contentType: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  /** Ren tekst. */
  text: string;
  /** Valgfrie vedlegg (f.eks. faktura-PDF). */
  attachments?: EmailAttachment[];
}

export interface EmailPort {
  /** Er e-postsending konfigurert? Styrer ærlig status. */
  readonly configured: boolean;
  /** Sender én e-post. Kaster `EmailNotConfiguredError` uten konfig. */
  send(message: EmailMessage): Promise<void>;
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

export class ResendEmailClient implements EmailPort {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly from: string | undefined,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly timeoutMs = 10000,
  ) {}

  get configured(): boolean {
    return Boolean(this.apiKey && this.from);
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.configured) {
      throw new EmailNotConfiguredError(
        'E-postsending er ikke konfigurert (REKNAREN_RESEND_API_KEY + REKNAREN_REMINDER_FROM mangler).',
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.attachments?.length
            ? {
                attachments: message.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content.toString('base64'),
                  content_type: a.contentType,
                })),
              }
            : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 200);
        throw new EmailError(`Resend svarte med status ${res.status}. ${detail}`.trim(), res.status);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** Avsender, f.eks. 'Creatorhub AS <faktura@creatorhubn.com>' (Gmail send-as-alias). */
  from: string;
}

/** Minimal transport-kontrakt (nodemailer) — injiserbar for test. */
export interface MailTransport {
  sendMail(opts: {
    from: string;
    to: string;
    subject: string;
    text: string;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
  }): Promise<unknown>;
}

/**
 * SMTP-sender (f.eks. Gmail med app-passord + send-as-alias faktura@creatorhubn.com).
 * Uten host/bruker/passord/avsender er den ærlig inaktiv.
 */
export class SmtpEmailClient implements EmailPort {
  private transport: MailTransport | null = null;

  constructor(
    private readonly config: SmtpConfig | undefined,
    private readonly transportFactory?: (c: SmtpConfig) => MailTransport,
  ) {}

  get configured(): boolean {
    const c = this.config;
    return Boolean(c && c.host && c.user && c.pass && c.from);
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.configured) {
      throw new EmailNotConfiguredError('SMTP er ikke konfigurert (host/bruker/passord/avsender mangler).');
    }
    const c = this.config as SmtpConfig;
    if (!this.transport) {
      this.transport = this.transportFactory
        ? this.transportFactory(c)
        : await defaultNodemailerTransport(c);
    }
    try {
      await this.transport.sendMail({
        from: c.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.attachments?.length ? { attachments: message.attachments } : {}),
      });
    } catch (err) {
      throw new EmailError(`SMTP-sending feilet: ${err instanceof Error ? err.message : 'ukjent feil'}`);
    }
  }
}

async function defaultNodemailerTransport(c: SmtpConfig): Promise<MailTransport> {
  const nodemailer = (await import('nodemailer')).default;
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    auth: { user: c.user, pass: c.pass },
  }) as unknown as MailTransport;
}

/** Test-/sandboxsender: samler e-poster i minnet, sender ingenting. */
export class InMemoryEmailStub implements EmailPort {
  readonly sent: EmailMessage[] = [];
  readonly configured: boolean;

  constructor(opts: { configured?: boolean } = {}) {
    this.configured = opts.configured ?? true;
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.configured) throw new EmailNotConfiguredError('Stub uten e-postkonfig.');
    this.sent.push(message);
  }
}

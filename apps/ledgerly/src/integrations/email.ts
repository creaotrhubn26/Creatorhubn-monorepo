/**
 * Utgående e-post (for betalingspåminnelser m.m.). Ledgerly hadde ingen sender
 * fra før (kun innkommende Gmail-sandbox). Bak en port, med ærlig status: uten
 * `LEDGERLY_RESEND_API_KEY` (+ avsender) er sending IKKE aktiv og `send` kaster
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

export interface EmailMessage {
  to: string;
  subject: string;
  /** Ren tekst. */
  text: string;
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
        'E-postsending er ikke konfigurert (LEDGERLY_RESEND_API_KEY + LEDGERLY_REMINDER_FROM mangler).',
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

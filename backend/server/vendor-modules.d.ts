declare module 'nodemailer' {
  export interface SendMailOptions {
    from?: string;
    to?: string | string[];
    replyTo?: string;
    subject?: string;
    text?: string;
    html?: string;
    [key: string]: unknown;
  }

  export interface SentMessageInfo {
    messageId?: string;
    accepted?: unknown[];
    message?: unknown;
    [key: string]: unknown;
  }

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<SentMessageInfo>;
  }

  export function createTransport(options: Record<string, unknown>): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}

declare module 'wawoff2' {
  export function decompress(buf: Uint8Array | Buffer): Promise<Uint8Array>;
  export function compress(buf: Uint8Array | Buffer): Promise<Uint8Array>;
  const wawoff2: { decompress: typeof decompress; compress: typeof compress };
  export default wawoff2;
}

declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(subscription: PushSubscription, payload?: string | Buffer): Promise<unknown>;

  const webPush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };

  export default webPush;
}

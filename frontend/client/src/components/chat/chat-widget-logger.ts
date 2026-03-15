export type ChatLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ChatLogMeta {
  [key: string]: unknown;
}

const isDevelopment = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

export function logChatWidgetEvent(
  widget: string,
  level: ChatLogLevel,
  message: string,
  meta?: ChatLogMeta,
): void {
  if (level === 'debug' && !isDevelopment) {
    return;
  }

  const payload = {
    widget,
    message,
    timestamp: new Date().toISOString(),
    ...(meta || {}),
  };

  const prefix = `[${widget}] ${message}`;
  if (level === 'error') {
    console.error(prefix, payload);
    return;
  }
  if (level === 'warn') {
    console.warn(prefix, payload);
    return;
  }
  if (level === 'info') {
    console.info(prefix, payload);
    return;
  }
  console.debug(prefix, payload);
}


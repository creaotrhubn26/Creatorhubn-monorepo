/**
 * Minimal scoped console logger.
 *
 * `logger.module(name)` returns a scoped logger that prefixes every line
 * with `[name]`. Mirrors the small surface the role-room Planning panels
 * already used before the original logger module was removed.
 */

type LogArgs = readonly unknown[];

export interface ScopedLogger {
  debug(message: string, ...args: LogArgs): void;
  info(message: string, ...args: LogArgs): void;
  warn(message: string, ...args: LogArgs): void;
  error(message: string, ...args: LogArgs): void;
}

function format(scope: string, message: string): string {
  return `[${scope}] ${message}`;
}

function makeScoped(scope: string): ScopedLogger {
  return {
    debug(message, ...args) {
      // eslint-disable-next-line no-console
      console.debug(format(scope, message), ...args);
    },
    info(message, ...args) {
      // eslint-disable-next-line no-console
      console.info(format(scope, message), ...args);
    },
    warn(message, ...args) {
      // eslint-disable-next-line no-console
      console.warn(format(scope, message), ...args);
    },
    error(message, ...args) {
      // eslint-disable-next-line no-console
      console.error(format(scope, message), ...args);
    },
  };
}

export const logger = {
  module(scope: string): ScopedLogger {
    return makeScoped(scope);
  },
};

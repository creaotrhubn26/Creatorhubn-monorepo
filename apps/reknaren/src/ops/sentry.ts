/**
 * Feilovervåking (Sentry) — ærlig og valgfri.
 *
 * Aktiveres KUN når `SENTRY_DSN` er satt. Uten DSN er alt en no-op og
 * `/api/integrations/status` rapporterer feilovervåking som ikke aktiv — ingen
 * stille «liksom-tilkobling».
 *
 * Modulen er koblet fra selve Sentry-SDK-en via `SentryLike`, slik at den kan
 * enhetstestes uten nettverk og uten å initialisere den ekte klienten.
 * `main.ts` injiserer `@sentry/node`.
 *
 * Personvern: kun uventede serverfeil (5xx) rapporteres — ikke forventede
 * validerings-/domenefeil (4xx). Send aldri regnskaps-/persondata i feilkonteksten.
 */

export interface SentryLike {
  init(options: {
    dsn: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
  }): void;
  captureException(err: unknown): void;
  close?(timeout?: number): Promise<boolean>;
}

/** Minimalkontrakt API-laget er avhengig av — ikke Sentry direkte. */
export interface ErrorMonitor {
  readonly active: boolean;
  capture(err: unknown): void;
}

export interface SentryHandle extends ErrorMonitor {
  status(): { mode: string; active: boolean; note: string };
  close(): Promise<void>;
}

export interface SentryInitOptions {
  dsn?: string | undefined;
  environment?: string;
  release?: string | undefined;
  tracesSampleRate?: number;
}

const INACTIVE_NOTE =
  'Feilovervåking er ikke aktiv: SENTRY_DSN er ikke satt. Sett SENTRY_DSN (og evt. SENTRY_RELEASE) for å aktivere.';

/**
 * Initialiserer feilovervåking. Returnerer alltid et gyldig handle — er DSN
 * fraværende, er `active=false` og `capture` en no-op.
 *
 * @param sentry Injiseres for testbarhet; `main.ts` sender `@sentry/node`.
 *               Kreves når DSN er satt.
 */
export function initSentry(opts: SentryInitOptions, sentry?: SentryLike): SentryHandle {
  if (!opts.dsn) {
    return {
      active: false,
      capture: () => {},
      status: () => ({ mode: 'not_configured', active: false, note: INACTIVE_NOTE }),
      close: async () => {},
    };
  }
  if (!sentry) {
    throw new Error('initSentry: SENTRY_DSN er satt, men Sentry-SDK-en ble ikke injisert.');
  }
  sentry.init({
    dsn: opts.dsn,
    ...(opts.environment ? { environment: opts.environment } : {}),
    ...(opts.release ? { release: opts.release } : {}),
    tracesSampleRate: opts.tracesSampleRate ?? 0,
  });
  return {
    active: true,
    capture: (err) => {
      try {
        sentry.captureException(err);
      } catch {
        // Feilovervåking skal aldri velte forespørselen.
      }
    },
    status: () => ({
      mode: 'sentry',
      active: true,
      note: `Sentry aktiv${opts.environment ? ` (${opts.environment})` : ''}. Kun uventede serverfeil (5xx) rapporteres.`,
    }),
    close: async () => {
      try {
        await sentry.close?.(2000);
      } catch {
        /* best-effort */
      }
    },
  };
}

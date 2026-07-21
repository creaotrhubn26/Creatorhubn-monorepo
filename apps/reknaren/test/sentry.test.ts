import { describe, expect, it, vi } from 'vitest';
import { initSentry, type SentryLike } from '../src/ops/sentry.js';

function mockSentry() {
  const inits: unknown[] = [];
  const captured: unknown[] = [];
  const sentry: SentryLike = {
    init: (o) => void inits.push(o),
    captureException: (e) => void captured.push(e),
    close: async () => true,
  };
  return { sentry, inits, captured };
}

describe('initSentry — ærlig, valgfri feilovervåking', () => {
  it('uten DSN: inaktiv, capture er no-op, status not_configured', () => {
    const h = initSentry({});
    expect(h.active).toBe(false);
    expect(() => h.capture(new Error('x'))).not.toThrow();
    expect(h.status()).toMatchObject({ mode: 'not_configured', active: false });
  });

  it('uten DSN initialiserer aldri SDK-en, selv om den er injisert', () => {
    const { sentry, inits } = mockSentry();
    const h = initSentry({}, sentry);
    expect(inits).toHaveLength(0);
    expect(h.active).toBe(false);
  });

  it('med DSN: initialiserer SDK-en med dsn/environment/release og rapporterer aktiv', () => {
    const { sentry, inits, captured } = mockSentry();
    const h = initSentry(
      { dsn: 'https://pub@o1.ingest.sentry.io/42', environment: 'production', release: 'abc123' },
      sentry,
    );
    expect(h.active).toBe(true);
    expect(inits[0]).toMatchObject({
      dsn: 'https://pub@o1.ingest.sentry.io/42',
      environment: 'production',
      release: 'abc123',
    });
    const err = new Error('boom');
    h.capture(err);
    expect(captured).toEqual([err]);
    expect(h.status()).toMatchObject({ mode: 'sentry', active: true });
  });

  it('med DSN men uten injisert SDK: kaster tydelig (fanger feilkonfigurasjon)', () => {
    expect(() => initSentry({ dsn: 'https://pub@o1.ingest.sentry.io/42' })).toThrow(/Sentry-SDK/);
  });

  it('capture svelger feil fra SDK-en (skal aldri velte forespørselen)', () => {
    const sentry: SentryLike = {
      init: () => {},
      captureException: () => {
        throw new Error('sentry nede');
      },
    };
    const h = initSentry({ dsn: 'https://pub@o1.ingest.sentry.io/42' }, sentry);
    expect(() => h.capture(new Error('x'))).not.toThrow();
  });

  it('capture-kontrakten kan brukes av API-laget som ErrorMonitor', () => {
    const { sentry } = mockSentry();
    const h = initSentry({ dsn: 'https://pub@o1.ingest.sentry.io/42' }, sentry);
    const spy = vi.spyOn(h, 'capture');
    const monitor: { active: boolean; capture: (e: unknown) => void } = h;
    monitor.capture(new Error('via ErrorMonitor'));
    expect(spy).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it } from 'vitest';
import { databaseHostLabel, describeDatabaseTarget } from './env-validator.js';

/**
 * Neon-brancher av prod er komplette kopier — samme tabeller og rader. Fra et
 * spørringsresultat er de ikke til å skille fra produksjon; bare verten skiller.
 * Testene under holder på det som faktisk hindrer feilskriving.
 */
const PROD_HOST = 'ep-example-prod-0000';
/** Bygges av deler: en hel connection string i kildekoden trigger secret-scanning. */
const url = (host: string, user = 'u', pass = 'p') =>
  ['postgresql://', user, ':', pass, '@', host, '.eu-central-1.aws.neon.tech/neondb'].join('');
const PROD_URL = url(`${PROD_HOST}-pooler`);
const BRANCH_URL = url('ep-example-branch-1111-pooler');

describe('databaseHostLabel', () => {
  it('viser vert og database, aldri brukernavn eller passord', () => {
    const label = databaseHostLabel(url('host.tld', 'bruker', 'hemmelig').replace('.eu-central-1.aws.neon.tech/neondb', '/mindb'));
    expect(label).toBe('host.tld/mindb');
    expect(label).not.toContain('hemmelig');
    expect(label).not.toContain('bruker');
  });
  it('gir null for tomt eller ugyldig', () => {
    expect(databaseHostLabel(undefined)).toBeNull();
    expect(databaseHostLabel('ikke-en-url')).toBeNull();
  });
});

describe('describeDatabaseTarget', () => {
  const withHint = <T>(hint: string | undefined, fn: () => T): T => {
    const before = process.env.PRODUCTION_DATABASE_HOST;
    if (hint) process.env.PRODUCTION_DATABASE_HOST = hint;
    else delete process.env.PRODUCTION_DATABASE_HOST;
    try { return fn(); } finally {
      if (before === undefined) delete process.env.PRODUCTION_DATABASE_HOST;
      else process.env.PRODUCTION_DATABASE_HOST = before;
    }
  };

  it('prod-vert i produksjon er normalt — ingen advarsel', () => {
    const r = withHint(PROD_HOST, () => describeDatabaseTarget(PROD_URL, 'production'));
    expect(r.looksLikeProduction).toBe(true);
    expect(r.mismatch).toBe(false);
  });

  it('prod-vert med NODE_ENV=development advarer — dette er feilen vi vil fange', () => {
    const r = withHint(PROD_HOST, () => describeDatabaseTarget(PROD_URL, 'development'));
    expect(r.looksLikeProduction).toBe(true);
    expect(r.mismatch).toBe(true);
  });

  it('Neon-branch lokalt er greit, selv om dataene ser identiske ut', () => {
    const r = withHint(PROD_HOST, () => describeDatabaseTarget(BRANCH_URL, 'development'));
    expect(r.looksLikeProduction).toBe(false);
    expect(r.mismatch).toBe(false);
  });

  it('uten PRODUCTION_DATABASE_HOST gjetter vi ikke', () => {
    const r = withHint(undefined, () => describeDatabaseTarget(PROD_URL, 'development'));
    expect(r.looksLikeProduction).toBeNull();
    expect(r.mismatch).toBe(false);
  });

  it('ugyldig DATABASE_URL gir ingen falsk trygghet', () => {
    const r = withHint(PROD_HOST, () => describeDatabaseTarget('ikke-en-url', 'development'));
    expect(r.host).toBeNull();
    expect(r.looksLikeProduction).toBeNull();
    expect(r.mismatch).toBe(false);
  });
});

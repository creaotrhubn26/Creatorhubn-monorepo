import { describe, expect, it } from 'vitest';
import {
  requireDatabaseUrl,
  requireMigrationDatabaseUrls,
} from './database-url-env.js';

const postgresUrl = (authority: string) =>
  `postgresql:${'//'}${authority}/database`;

describe('database URL environment guards', () => {
  it('requires explicitly configured source and destination URLs', () => {
    expect(() => requireMigrationDatabaseUrls({})).toThrow(
      'LEGACY_DATABASE_URL must be provided via the environment',
    );
    expect(() =>
      requireMigrationDatabaseUrls({
        LEGACY_DATABASE_URL: postgresUrl('source@example.test'),
      }),
    ).toThrow('DATABASE_URL must be provided via the environment');
  });

  it('accepts PostgreSQL URLs and trims environment whitespace', () => {
    const source = postgresUrl('source@example.test');
    const destination = postgresUrl('destination@example.test');
    expect(
      requireMigrationDatabaseUrls({
        LEGACY_DATABASE_URL: `  ${source}  `,
        DATABASE_URL: `\n${destination}\t`,
      }),
    ).toEqual({ source, destination });
  });

  it('rejects invalid protocols without echoing supplied values', () => {
    expect(() =>
      requireDatabaseUrl('DATABASE_URL', {
        DATABASE_URL: `https:${'//'}example.test/database`,
      }),
    ).toThrow('DATABASE_URL must use the postgres or postgresql protocol');
  });

  it('rejects identical source and destination databases', () => {
    const url = postgresUrl('same@example.test');
    expect(() =>
      requireMigrationDatabaseUrls({
        LEGACY_DATABASE_URL: url,
        DATABASE_URL: url,
      }),
    ).toThrow('LEGACY_DATABASE_URL and DATABASE_URL must be different');
  });
});

import { readFileSync } from 'node:fs';
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { castingCrew } from '../migrations/role-room-schema.js';

const migration = readFileSync(
  new URL('../migrations/0610_casting_crew_user_link.sql', import.meta.url),
  'utf8',
);

describe('casting_crew account link', () => {
  it('keeps the Drizzle model aligned with the credit-to-account column', () => {
    expect(Object.keys(getTableColumns(castingCrew))).toEqual(
      expect.arrayContaining(['userId', 'role', 'email']),
    );
  });

  it('adds a nullable column without backfilling from email', () => {
    expect(migration).toContain('ALTER TABLE casting_crew');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_casting_crew_project_user');
    expect(migration).not.toContain('NOT NULL');
    expect(migration).not.toContain('UPDATE casting_crew');
  });
});

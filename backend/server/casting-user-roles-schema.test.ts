import { readFileSync } from 'node:fs';
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { castingUserRoles } from '../migrations/role-room-schema.js';

const migration = readFileSync(
  new URL('../migrations/0575_casting_user_roles_lifecycle_contract.sql', import.meta.url),
  'utf8',
);

describe('casting_user_roles lifecycle contract', () => {
  it('keeps the Drizzle model aligned with active-membership authorization', () => {
    expect(Object.keys(getTableColumns(castingUserRoles))).toEqual(expect.arrayContaining([
      'expiresAt',
      'deactivatedAt',
      'deactivatedByUserId',
      'deactivationReason',
    ]));
  });

  it('converges existing databases idempotently', () => {
    expect(migration).toContain('ALTER TABLE casting_user_roles');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS expires_at');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS deactivated_at');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS deactivated_by_user_id');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS deactivation_reason');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_cur_project_active');
  });
});

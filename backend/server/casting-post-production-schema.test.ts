import { readFileSync } from 'node:fs';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { roleRoomPostProductionOperations } from '../migrations/role-room-schema.js';

describe('post-production SQL/Drizzle contract', () => {
  it('keeps the table, columns, indexes and constraints aligned with migration 0660', () => {
    const config = getTableConfig(roleRoomPostProductionOperations);
    const migration = readFileSync(
      new URL('../migrations/0660_role_room_post_production_operations.sql', import.meta.url),
      'utf8',
    );

    expect(config.name).toBe('role_room_post_production_operations');
    expect(config.columns.map((column) => column.name)).toEqual([
      'id',
      'project_id',
      'operations',
      'version',
      'updated_by',
      'created_at',
      'updated_at',
    ]);
    expect(config.indexes.map((index) => index.config.name)).toContain('idx_role_room_post_production_updated');
    expect(config.uniqueConstraints.map((constraint) => constraint.name)).toContain('uq_role_room_post_production_project');
    expect(config.checks.map((check) => check.name)).toEqual(expect.arrayContaining([
      'chk_role_room_post_production_payload',
      'chk_role_room_post_production_version',
    ]));

    for (const identifier of [
      config.name,
      ...config.columns.map((column) => column.name),
      ...config.indexes.map((index) => index.config.name),
      ...config.uniqueConstraints.map((constraint) => constraint.name),
      ...config.checks.map((check) => check.name),
    ]) {
      expect(migration).toContain(identifier);
    }
  });
});

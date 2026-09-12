import { describe, expect, it } from 'vitest';
import { buildRoleRoomPublicStatsRelationCountQuery } from './role-room-public-stats.js';

describe('Role Room public stats dataflow', () => {
  const liveProjectsCte = 'WITH live_projects AS (SELECT id FROM casting_projects)';

  it.each([
    ['crew', 'casting_crew'],
    ['locations', 'casting_locations'],
  ] as const)('counts %s from its canonical casting table', (relation, table) => {
    const query = buildRoleRoomPublicStatsRelationCountQuery(liveProjectsCte, relation);

    expect(query).toContain(liveProjectsCte);
    expect(query).toContain(`FROM ${table}`);
    expect(query).toContain(`ON lp.id = ${table}.project_id`);
    expect(query).not.toContain(`FROM ${relation}`);
  });
});

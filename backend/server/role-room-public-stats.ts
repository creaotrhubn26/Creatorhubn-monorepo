export type RoleRoomPublicStatsRelation = 'crew' | 'locations';

const ROLE_ROOM_PUBLIC_STATS_TABLES: Record<RoleRoomPublicStatsRelation, string> = {
  crew: 'casting_crew',
  locations: 'casting_locations',
};

export function buildRoleRoomPublicStatsRelationCountQuery(
  liveProjectsCte: string,
  relation: RoleRoomPublicStatsRelation,
): string {
  const table = ROLE_ROOM_PUBLIC_STATS_TABLES[relation];
  return `${liveProjectsCte}
         SELECT COUNT(*) AS n
         FROM ${table}
         INNER JOIN live_projects lp ON lp.id = ${table}.project_id`;
}

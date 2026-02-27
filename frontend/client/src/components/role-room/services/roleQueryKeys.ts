export const roleQueryKeys = {
  pool: ['rolePool'] as const,
  projectRoles: (projectId: string) => ['projectRoles', projectId] as const,
};

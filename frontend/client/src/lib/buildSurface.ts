export type CreatorHubBuildSurface = 'creatorhub' | 'leadgrid' | 'the-role-room';

export function resolveCreatorHubBuildSurface(
  branch?: string | null,
  siteName?: string | null,
): CreatorHubBuildSurface {
  const deploymentIdentity = `${branch || ''} ${siteName || ''}`.trim().toLowerCase();

  if (deploymentIdentity.includes('leadgrid')) return 'leadgrid';
  if (
    deploymentIdentity.includes('roleroom') ||
    deploymentIdentity.includes('role-room') ||
    deploymentIdentity.includes('theroleroom')
  ) {
    return 'the-role-room';
  }

  return 'creatorhub';
}

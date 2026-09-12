import { describe, expect, it } from 'vitest';
import { resolveCreatorHubBuildSurface } from './buildSurface';

describe('resolveCreatorHubBuildSurface', () => {
  it('identifies CreatorHub production from its deployment branch', () => {
    expect(resolveCreatorHubBuildSurface('live/creatorhub', 'creatorhub-frontend-mig')).toBe('creatorhub');
  });

  it('identifies Leadgrid by branch or site name', () => {
    expect(resolveCreatorHubBuildSurface('live/leadgrid', 'creatorhub-frontend-mig')).toBe('leadgrid');
    expect(resolveCreatorHubBuildSurface('main', 'leadgrid-no')).toBe('leadgrid');
  });

  it('identifies Role Room by branch or site name', () => {
    expect(resolveCreatorHubBuildSurface('live/roleroom', 'creatorhub-frontend-mig')).toBe('the-role-room');
    expect(resolveCreatorHubBuildSurface('main', 'theroleroom')).toBe('the-role-room');
  });

  it('defaults local and preview builds to CreatorHub', () => {
    expect(resolveCreatorHubBuildSurface('feat/sound-room-auth', null)).toBe('creatorhub');
  });
});

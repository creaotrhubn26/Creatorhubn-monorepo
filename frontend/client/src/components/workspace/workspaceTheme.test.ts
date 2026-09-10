import { describe, expect, it } from 'vitest';
import { navForCategory, shouldFallbackWorkspaceTab } from './workspaceTheme';

describe('shouldFallbackWorkspaceTab', () => {
  it('preserves a category deep-link while workspace bootstrap is loading', () => {
    const temporaryServiceNav = navForCategory('service');

    expect(shouldFallbackWorkspaceTab('sound-room', temporaryServiceNav, true)).toBe(false);
  });

  it('keeps a Sound Room deep-link after a music workspace resolves', () => {
    expect(shouldFallbackWorkspaceTab('sound-room', navForCategory('music'), false)).toBe(false);
  });

  it('falls back after a non-music workspace has resolved', () => {
    expect(shouldFallbackWorkspaceTab('sound-room', navForCategory('service'), false)).toBe(true);
  });
});

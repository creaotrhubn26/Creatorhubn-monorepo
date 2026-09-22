import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TABS_BY_ROLE, USER_ROLE_LABELS } from '../hooks/useRoleNavConfig';
import { castingAuthService } from './castingAuthService';
import { castingService } from './castingService';

describe('1st AD role contract', () => {
  it('grants production-day control without broader creative or roster ownership', () => {
    expect(castingAuthService.getDefaultPermissions('first_ad')).toMatchObject({
      canViewAll: true,
      canEditProduction: true,
      canManageCrew: false,
      canEditCasting: false,
      canEditScript: false,
      canEditShotLists: false,
      canManageLocations: false,
      canApprove: false,
      canViewEconomy: false,
      canComment: true,
      canRequestChanges: true,
    });
  });

  it('exposes the production tabs and the same role label used by sharing', () => {
    expect(DEFAULT_TABS_BY_ROLE.first_ad).toEqual(expect.arrayContaining([
      'shooting',
      'schedule',
      'crew',
      'shotlist',
    ]));
    expect(USER_ROLE_LABELS.first_ad).toBe('Innspillingsleder / 1st AD');
  });
});

describe('2nd AD role contract', () => {
  it('can manage production-day operations without creative or roster ownership', () => {
    expect(castingAuthService.getDefaultPermissions('second_ad')).toMatchObject({
      canViewAll: true,
      canEditProduction: true,
      canManageCrew: false,
      canEditCasting: false,
      canEditScript: false,
      canEditShotLists: false,
    });
    expect(DEFAULT_TABS_BY_ROLE.second_ad).toEqual(expect.arrayContaining(['shooting', 'schedule', 'crew', 'roles']));
    expect(USER_ROLE_LABELS.second_ad).toBe('2. regiassistent / 2nd AD');
  });
});

describe('production coordinator role contract', () => {
  it('owns coordination without inheriting PM decisions or broad production writes', () => {
    expect(castingAuthService.getDefaultPermissions('production_coordinator')).toMatchObject({
      canViewAll: true,
      canCoordinateProduction: true,
      canEditProduction: false,
      canManageCrew: false,
      canManageLocations: false,
      canApprove: false,
      canViewEconomy: false,
    });
    expect(DEFAULT_TABS_BY_ROLE.production_coordinator).toEqual(expect.arrayContaining([
      'schedule', 'crew', 'shooting', 'mannskap',
    ]));
    expect(USER_ROLE_LABELS.production_coordinator).toBe('Produksjonskoordinator');
  });
});

describe('producer and casting role contracts', () => {
  it('keeps executive, line and casting responsibilities separated', () => {
    expect(castingAuthService.getDefaultPermissions('executive_producer')).toMatchObject({
      canViewAll: true,
      canApprove: true,
      canViewEconomy: true,
      canEditCasting: false,
      canEditProduction: false,
    });
    expect(castingAuthService.getDefaultPermissions('line_producer')).toMatchObject({
      canEditProduction: true,
      canCoordinateProduction: true,
      canManageCrew: true,
      canManageLocations: true,
      canViewEconomy: true,
      canEditCasting: false,
    });
    for (const role of ['casting_director', 'local_casting_director', 'extras_casting_director'] as const) {
      expect(castingAuthService.getDefaultPermissions(role)).toMatchObject({
        canViewAll: true,
        canEditCasting: true,
        canEditProduction: false,
        canViewEconomy: false,
      });
    }
  });

  it('covers the missing hierarchy aliases with least-privilege defaults', () => {
    expect(castingAuthService.getDefaultPermissions('second_second_assistant_director')).toMatchObject({
      canEditProduction: true,
      canManageCrew: false,
    });
    expect(castingAuthService.getDefaultPermissions('set_production_assistant')).toMatchObject({
      canEditProduction: false,
      canComment: true,
    });
    for (const role of ['production_secretary', 'office_production_assistant'] as const) {
      expect(castingAuthService.getDefaultPermissions(role)).toMatchObject({
        canCoordinateProduction: true,
        canEditProduction: false,
      });
    }
  });
});

describe('location department role contract', () => {
  it('lets managers and scouts maintain readiness while security remains read-only', () => {
    expect(castingAuthService.getDefaultPermissions('location_manager')).toMatchObject({
      canViewAll: true,
      canManageLocations: true,
      canEditProduction: false,
      canManageCrew: false,
    });
    expect(castingAuthService.getDefaultPermissions('location_scout')).toMatchObject({
      canViewAll: true,
      canManageLocations: true,
      canEditProduction: false,
    });
    expect(castingAuthService.getDefaultPermissions('location_security')).toMatchObject({
      canViewAll: true,
      canManageLocations: false,
      canComment: true,
    });
    expect(USER_ROLE_LABELS.location_manager).toBe('Location manager');
    expect(DEFAULT_TABS_BY_ROLE.location_manager).toEqual(expect.arrayContaining(['schedule', 'crew', 'shooting']));
  });
});

describe('server-resolved project role', () => {
  const ROSTER = [
    { id: 'row-1', userId: 'user-1', projectId: 'project-1', role: 'location_manager', permissions: { canManageLocations: true } },
    { id: 'row-2', userId: 'user-2', projectId: 'project-1', role: 'director', permissions: {} },
  ];

  const withStubs = async (
    access: Awaited<ReturnType<typeof castingService.getProjectAccess>>,
    run: () => Promise<unknown>,
  ) => {
    const roles = vi.spyOn(castingService, 'getUserRoles').mockResolvedValue(ROSTER as never);
    const projectAccess = vi.spyOn(castingService, 'getProjectAccess').mockResolvedValue(access);
    const currentUser = vi.spyOn(castingAuthService, 'getCurrentUserId').mockReturnValue('user-1');
    try {
      return await run();
    } finally {
      roles.mockRestore();
      projectAccess.mockRestore();
      currentUser.mockRestore();
    }
  };

  const serverAccess = (role: string | null, extra: Record<string, unknown> = {}) => ({
    projectId: 'project-1',
    role,
    roles: role ? [role] : [],
    isOwner: false,
    isMember: role !== null,
    permissions: {},
    grants: {},
    ...extra,
  });

  it('drops a role the server no longer recognises', async () => {
    const result = await withStubs(serverAccess(null), () =>
      castingAuthService.getUserRole('project-1'));

    expect(result).toBeNull();
  });

  it('keeps the roster row when the server agrees', async () => {
    const result = await withStubs(serverAccess('location_manager'), () =>
      castingAuthService.getUserRole('project-1'));

    expect(result).toMatchObject({ id: 'row-1', role: 'location_manager' });
    expect(result).toHaveProperty('permissions.canManageLocations', true);
  });

  it('lets the server correct a stale roster role', async () => {
    const result = await withStubs(serverAccess('production_manager'), () =>
      castingAuthService.getUserRole('project-1'));

    expect(result).toMatchObject({ id: 'row-1', role: 'production_manager' });
  });

  it('preserves additional roles and lets authoritative grants override stale false values', async () => {
    const result = await withStubs(serverAccess('viewer', {
      roles: ['viewer', 'casting_director'],
      grants: { canEditCasting: true },
    }), () => castingAuthService.getUserRole('project-1'));

    expect(result).toMatchObject({
      additionalRoles: ['casting_director'],
      serverGrants: { canEditCasting: true },
      permissions: { canEditCasting: true },
    });
  });

  it('keeps an owner without a membership row on the roster answer', async () => {
    const result = await withStubs(
      serverAccess(null, { isOwner: true }),
      () => castingAuthService.getUserRole('project-1'),
    );

    expect(result).toMatchObject({ id: 'row-1' });
  });

  it('falls back to roster matching when the server cannot answer', async () => {
    const result = await withStubs(null, () => castingAuthService.getUserRole('project-1'));

    expect(result).toMatchObject({ id: 'row-1', role: 'location_manager' });
  });

  it('does not apply the caller access to another user', async () => {
    const result = await withStubs(serverAccess(null), () =>
      castingAuthService.getUserRole('project-1', 'user-2'));

    expect(result).toMatchObject({ id: 'row-2', role: 'director' });
  });
});

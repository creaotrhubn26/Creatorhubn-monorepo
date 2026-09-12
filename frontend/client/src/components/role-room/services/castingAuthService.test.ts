import { describe, expect, it } from 'vitest';
import { DEFAULT_TABS_BY_ROLE, USER_ROLE_LABELS } from '../hooks/useRoleNavConfig';
import { castingAuthService } from './castingAuthService';

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

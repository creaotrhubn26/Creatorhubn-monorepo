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

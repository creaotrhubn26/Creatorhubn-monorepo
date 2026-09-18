import { describe, expect, it } from 'vitest';
import { mapContributor } from './split-sheet-signing-routes';

describe('split sheet signing compensation mapping', () => {
  it('derives a share amount from the normalized persisted percentage', () => {
    const contributor = mapContributor({
      id: 'share-1',
      name: 'Ada',
      role: 'collaborator',
      percentage: 33.33,
      custom_fields: {
        compensationType: 'share',
        estimatedAmount: 3334,
        currency: 'NOK',
      },
    }, 10_000);

    expect(contributor.estimatedAmount).toBe(3333);
    expect(contributor.amountKr).toBe(3333);
  });

  it('preserves decimal hourly terms and their estimate', () => {
    const contributor = mapContributor({
      id: 'hourly-1',
      name: 'Lin',
      role: 'photographer',
      percentage: 0,
      custom_fields: {
        compensationType: 'hourly',
        hourlyRate: 850.555,
        estimatedHours: 7.5,
        currency: 'NOK',
      },
    }, 10_000);

    expect(contributor.hourlyRate).toBe(850.56);
    expect(contributor.estimatedHours).toBe(7.5);
    expect(contributor.estimatedAmount).toBe(6379.2);
    expect(contributor.amountKr).toBe(6379.2);
  });
});

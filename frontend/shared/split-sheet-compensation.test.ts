import { describe, expect, it } from 'vitest';
import {
  calculateHourlyAmount,
  calculateHourlyDistribution,
  hasRequiredSplitSheetParticipantCount,
  normalizeCurrencyAmount,
  normalizeEstimatedHours,
  readSplitSheetCompensationFields,
  splitSheetCompensationModel,
} from './split-sheet-compensation';

describe('split sheet hourly compensation', () => {
  it('calculates decimal hours without rounding away billable time', () => {
    expect(calculateHourlyAmount(850, 7.5)).toBe(6375);
  });

  it('canonicalizes rates, hours, and estimates to two decimals', () => {
    expect(normalizeCurrencyAmount(850.555)).toBe(850.56);
    expect(normalizeEstimatedHours(7.555)).toBe(7.56);
    expect(calculateHourlyAmount(850.555, 7.5)).toBe(6379.2);
    expect(readSplitSheetCompensationFields({
      compensationType: 'hourly',
      hourlyRate: 850.555,
      estimatedHours: 7.5,
    })).toMatchObject({
      hourlyRate: 850.56,
      estimatedHours: 7.5,
      estimatedAmount: 6379.2,
    });
  });

  it('treats invalid and negative values as zero', () => {
    expect(calculateHourlyAmount(-500, 8)).toBe(0);
    expect(calculateHourlyAmount('not-a-rate', 8)).toBe(0);
  });

  it('derives a percentage only for storage compatibility', () => {
    const result = calculateHourlyDistribution([
      { id: 'photo', hourlyRate: 1000, estimatedHours: 4 },
      { id: 'edit', hourlyRate: 500, estimatedHours: 8 },
    ]);

    expect(result.total).toBe(8000);
    expect(result.lines.map((line) => line.amount)).toEqual([4000, 4000]);
    expect(result.lines.reduce((sum, line) => sum + line.percentage, 0)).toBeCloseTo(100);
  });

  it('falls back to rate times hours when estimated amount is not persisted', () => {
    expect(readSplitSheetCompensationFields({
      compensationType: 'hourly',
      hourlyRate: 725,
      estimatedHours: 6,
      currency: 'nok',
    })).toMatchObject({
      compensationType: 'hourly',
      hourlyRate: 725,
      estimatedHours: 6,
      estimatedAmount: 4350,
      currency: 'NOK',
    });
  });

  it('normalizes the legacy fee fields already used by audio split sheets', () => {
    expect(readSplitSheetCompensationFields({
      feeType: 'hourly',
      feeAmount: 900,
      feeCurrency: 'nok',
      estimatedHours: 5,
    })).toMatchObject({
      compensationType: 'hourly',
      hourlyRate: 900,
      estimatedHours: 5,
      estimatedAmount: 4500,
      currency: 'NOK',
    });
  });

  it('distinguishes hourly and mixed agreements from regular shares', () => {
    expect(splitSheetCompensationModel([
      { compensationType: 'hourly' },
      { compensationType: 'hourly' },
    ])).toBe('hourly');
    expect(splitSheetCompensationModel([
      { compensationType: 'hourly' },
      { compensationType: 'share' },
    ])).toBe('mixed');
    expect(splitSheetCompensationModel([{ compensationType: 'share' }])).toBe('share');
    expect(splitSheetCompensationModel([
      { compensationType: 'hourly' },
      { compensationType: 'fixed' },
    ])).toBe('mixed');
    expect(splitSheetCompensationModel([
      { compensationType: 'fixed' },
      { compensationType: 'fixed' },
    ])).toBe('mixed');
  });

  it('requires two participants only for a pure share agreement', () => {
    expect(hasRequiredSplitSheetParticipantCount('share', 1)).toBe(false);
    expect(hasRequiredSplitSheetParticipantCount('share', 2)).toBe(true);
    expect(hasRequiredSplitSheetParticipantCount('hourly', 1)).toBe(true);
    expect(hasRequiredSplitSheetParticipantCount('mixed', 1)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  isVersionedSignedSplitSheet,
  splitSheetCompensationModelOf,
  splitSheetSignedCount,
  splitSheetTotalPercentage,
  splitSheetUsesFeeCompensation,
  type SplitSheet,
} from './types';

const sheet = (overrides: Partial<SplitSheet> = {}): SplitSheet => ({
  title: 'Avtale',
  status: 'draft',
  metadata: { agreementVersion: 1, compensationModel: 'share' },
  ...overrides,
});

describe('split sheet agreement presentation rules', () => {
  it('locks a versioned agreement after the first aggregate signature', () => {
    expect(isVersionedSignedSplitSheet(sheet({ signed_count: 1 }))).toBe(true);
    expect(isVersionedSignedSplitSheet(sheet({ signed_count: 0 }))).toBe(false);
  });

  it('falls back to contributor signatures when detail data is used', () => {
    const detailed = sheet({
      contributors: [{
        name: 'Ada',
        role: 'collaborator',
        percentage: 100,
        signed_at: '2026-08-29T10:00:00.000Z',
      }],
    });

    expect(splitSheetSignedCount(detailed)).toBe(1);
    expect(isVersionedSignedSplitSheet(detailed)).toBe(true);
  });

  it('does not apply the versioned lock policy to legacy agreements', () => {
    expect(isVersionedSignedSplitSheet(sheet({ metadata: {}, signed_count: 2 }))).toBe(false);
  });

  it('recognizes JSON metadata and fee-based agreement models', () => {
    const hourly = sheet({
      metadata: JSON.stringify({ agreementVersion: 1, compensationModel: 'hourly' }) as any,
    });
    const mixed = sheet({ metadata: { agreementVersion: 1, compensationModel: 'mixed' } });

    expect(splitSheetCompensationModelOf(hourly)).toBe('hourly');
    expect(splitSheetUsesFeeCompensation(hourly)).toBe(true);
    expect(splitSheetUsesFeeCompensation(mixed)).toBe(true);
  });

  it('normalizes PostgreSQL DECIMAL percentages before presentation', () => {
    expect(splitSheetTotalPercentage(sheet({ total_percentage: '50.00' as any }))).toBe(50);
    expect(splitSheetTotalPercentage(sheet({ total_percentage: 'invalid' as any }))).toBe(0);
  });
});

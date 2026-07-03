import { describe, expect, it } from 'vitest';
import {
  aggregateNaceBusinessModel,
  computeConfidenceCalibration,
  computeFieldAcceptanceRates,
  confidenceBucket,
  type FieldFeedbackRow,
} from './role-room-agent-learning-aggregate.js';

function row(over: Partial<FieldFeedbackRow>): FieldFeedbackRow {
  return {
    fieldPath: 'companyProfile.businessModel',
    action: 'accepted',
    aiValue: null,
    finalValue: null,
    naceCode: null,
    businessModel: null,
    geoScope: null,
    sourceChain: null,
    confidence: null,
    ...over,
  };
}

describe('aggregateNaceBusinessModel', () => {
  it('proposes the modal producer-chosen model when samples + agreement pass', () => {
    const rows: FieldFeedbackRow[] = [
      ...Array.from({ length: 9 }, () =>
        row({ naceCode: '70.100', action: 'edited', aiValue: 'B2B', finalValue: 'B2C' }),
      ),
      row({ naceCode: '70.100', action: 'accepted', aiValue: 'B2B', finalValue: 'B2B' }),
    ];
    const proposals = aggregateNaceBusinessModel(rows);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      overrideType: 'nace_business_model',
      overrideKey: '70.100',
      proposedValue: 'B2C',
      sampleCount: 10,
      agreementPct: 90,
    });
  });

  it('suppresses a proposal below the sample threshold', () => {
    const rows = Array.from({ length: 5 }, () =>
      row({ naceCode: '70.100', action: 'edited', aiValue: 'B2B', finalValue: 'B2C' }),
    );
    expect(aggregateNaceBusinessModel(rows)).toHaveLength(0);
  });

  it('suppresses a proposal below the agreement threshold (noisy field)', () => {
    const rows: FieldFeedbackRow[] = [
      ...Array.from({ length: 5 }, () => row({ naceCode: '55.100', finalValue: 'B2C', action: 'edited', aiValue: 'B2B' })),
      ...Array.from({ length: 5 }, () => row({ naceCode: '55.100', finalValue: 'B2B', action: 'accepted', aiValue: 'B2B' })),
    ];
    expect(aggregateNaceBusinessModel(rows, { minSamples: 8, minAgreementPct: 70 })).toHaveLength(0);
  });

  it('ignores rows for other fields or without a NACE code', () => {
    const rows: FieldFeedbackRow[] = [
      ...Array.from({ length: 10 }, () => row({ fieldPath: 'companyProfile.summary', naceCode: '70.100', finalValue: 'B2C', action: 'edited' })),
      ...Array.from({ length: 10 }, () => row({ naceCode: null, finalValue: 'B2C', action: 'edited' })),
    ];
    expect(aggregateNaceBusinessModel(rows)).toHaveLength(0);
  });
});

describe('confidenceBucket', () => {
  it('buckets into 20-wide bands capped at 80-100', () => {
    expect(confidenceBucket(0)).toBe('0-20');
    expect(confidenceBucket(55)).toBe('40-60');
    expect(confidenceBucket(100)).toBe('80-100');
    expect(confidenceBucket(95)).toBe('80-100');
  });
});

describe('computeConfidenceCalibration', () => {
  it('reports actual acceptance rate per confidence bucket', () => {
    const rows: FieldFeedbackRow[] = [
      ...Array.from({ length: 6 }, () => row({ confidence: 90, action: 'accepted' })),
      ...Array.from({ length: 4 }, () => row({ confidence: 95, action: 'edited', finalValue: 'x' })),
    ];
    const [bucket] = computeConfidenceCalibration(rows, { minSamples: 8 });
    expect(bucket.overrideKey).toBe('80-100');
    expect(bucket.proposedValue).toBe('60'); // 6 of 10 accepted
    expect(bucket.sampleCount).toBe(10);
  });
});

describe('computeFieldAcceptanceRates', () => {
  it('sorts the worst-accepted fields first', () => {
    const rows: FieldFeedbackRow[] = [
      row({ fieldPath: 'a', action: 'accepted' }),
      row({ fieldPath: 'a', action: 'accepted' }),
      row({ fieldPath: 'b', action: 'edited', finalValue: 'x' }),
      row({ fieldPath: 'b', action: 'edited', finalValue: 'x' }),
    ];
    const stats = computeFieldAcceptanceRates(rows);
    expect(stats[0].fieldPath).toBe('b');
    expect(stats[0].acceptanceRate).toBe(0);
    expect(stats[1].fieldPath).toBe('a');
    expect(stats[1].acceptanceRate).toBe(100);
  });
});

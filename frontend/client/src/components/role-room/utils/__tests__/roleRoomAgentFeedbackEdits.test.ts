import { describe, expect, it } from 'vitest';
import {
  buildClassificationFeedbackEdits,
  type FeedbackSourceResult,
} from '../roleRoomAgentFeedbackEdits';

const result: FeedbackSourceResult = {
  companyProfile: {
    industry: 'Restaurant og servering',
    subIndustry: 'Servering',
    businessModel: 'B2B',
    contentCategory: 'Meny og kampanje',
    productionApproach: 'Produktdrevet',
  },
  fieldMetadata: {
    'companyProfile.businessModel': { confidence: 55, sourceChain: ['fallback_rules'] },
    'companyProfile.industry': { confidence: 90, sourceChain: ['brreg'] },
  },
  brregCompany: { industryCode: { code: '56.101' } },
};

describe('buildClassificationFeedbackEdits', () => {
  it('marks all five classification fields, carrying NACE code', () => {
    const edits = buildClassificationFeedbackEdits(result);
    expect(edits).toHaveLength(5);
    expect(edits.every((e) => e.naceCode === '56.101')).toBe(true);
    expect(edits.map((e) => e.fieldPath)).toContain('companyProfile.businessModel');
  });

  it('marks businessModel as edited when the producer corrects it', () => {
    const edits = buildClassificationFeedbackEdits(result, 'B2C');
    const bm = edits.find((e) => e.fieldPath === 'companyProfile.businessModel');
    expect(bm?.action).toBe('edited');
    expect(bm?.aiValue).toBe('B2B');
    expect(bm?.finalValue).toBe('B2C');
    expect(bm?.businessModel).toBe('B2C');
    expect(bm?.confidence).toBe(55);
    expect(bm?.sourceChain).toEqual(['fallback_rules']);
  });

  it('marks businessModel accepted when the choice equals the AI value', () => {
    const edits = buildClassificationFeedbackEdits(result, 'B2B');
    const bm = edits.find((e) => e.fieldPath === 'companyProfile.businessModel');
    expect(bm?.action).toBe('accepted');
    expect(bm?.finalValue).toBe('B2B');
  });

  it('accepts when no choice is given', () => {
    const edits = buildClassificationFeedbackEdits(result);
    const bm = edits.find((e) => e.fieldPath === 'companyProfile.businessModel');
    expect(bm?.action).toBe('accepted');
  });

  it('carries per-field confidence/sourceChain from fieldMetadata', () => {
    const edits = buildClassificationFeedbackEdits(result);
    const industry = edits.find((e) => e.fieldPath === 'companyProfile.industry');
    expect(industry?.confidence).toBe(90);
    expect(industry?.sourceChain).toEqual(['brreg']);
  });

  it('tolerates a missing companyProfile / metadata / brreg', () => {
    const edits = buildClassificationFeedbackEdits({});
    expect(edits).toHaveLength(5);
    expect(edits.every((e) => e.naceCode === null)).toBe(true);
  });
});

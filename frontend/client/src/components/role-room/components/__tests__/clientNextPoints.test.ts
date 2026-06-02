import { describe, expect, it } from 'vitest';
import { deriveClientNextPoints } from '../NextClientPointsButton';
import type { ProducerWorkflowProjectMeta } from '../../models/casting';

const meta = (over: Partial<ProducerWorkflowProjectMeta>): ProducerWorkflowProjectMeta => ({
  totalReviews: 0, pendingReviews: 0, approvedReviews: 0, rejectedReviews: 0,
  changesRequestedReviews: 0, budgetReviewCount: 0, agreementReviewCount: 0, deliverableReviewCount: 0,
  ...over,
});

describe('deriveClientNextPoints (tall på hva som må gjøres)', () => {
  it('teller endringsønsker + venter-på-klient + handoff-innspill i openCount', () => {
    const r = deriveClientNextPoints(meta({ totalReviews: 5, pendingReviews: 2, changesRequestedReviews: 1, approvedReviews: 2 }), 'changes_requested', 3);
    expect(r.openCount).toBe(2 + 1 + 3); // pending + changes + handoff
    expect(r.points.find((p) => p.key === 'handoff-input')?.count).toBe(3);
    expect(r.points.find((p) => p.key === 'changes')?.count).toBe(1);
    expect(r.points.find((p) => p.key === 'pending')?.count).toBe(2);
    expect(r.points.find((p) => p.key === 'approved')?.count).toBe(2);
  });

  it('flagger «ingenting sendt» når ingen reviews finnes', () => {
    const r = deriveClientNextPoints(meta({ totalReviews: 0 }), 'planning', 0);
    expect(r.openCount).toBe(1);
    expect(r.points.some((p) => p.key === 'nothing-sent')).toBe(true);
  });

  it('viser «alt i orden» når alt er godkjent og ingenting åpent', () => {
    const r = deriveClientNextPoints(meta({ totalReviews: 3, approvedReviews: 3 }), 'approved', 0);
    expect(r.openCount).toBe(0);
    expect(r.points.some((p) => p.key === 'approved')).toBe(true);
  });

  it('takler manglende meta/status (defaults)', () => {
    const r = deriveClientNextPoints(undefined, undefined, 0);
    expect(r.status).toBe('planning');
    expect(r.openCount).toBe(1); // totalReviews=0 → "ingenting sendt"
  });
});

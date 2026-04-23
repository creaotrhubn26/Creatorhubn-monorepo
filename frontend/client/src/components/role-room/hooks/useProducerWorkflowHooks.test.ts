import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProducerEconomy } from './useProducerEconomy';
import { useProducerReviews } from './useProducerReviews';
import { useProducerTimeline } from './useProducerTimeline';

const serviceMocks = vi.hoisted(() => ({
  getTimeline: vi.fn(),
  createTimelineItem: vi.fn(),
  updateTimelineItem: vi.fn(),
  deleteTimelineItem: vi.fn(),
  getEconomyItems: vi.fn(),
  createEconomyItem: vi.fn(),
  updateEconomyItem: vi.fn(),
  deleteEconomyItem: vi.fn(),
  getReviews: vi.fn(),
  createReview: vi.fn(),
  addReviewComment: vi.fn(),
  setReviewDecision: vi.fn(),
  setReviewDecisionWithTimeline: vi.fn(),
}));

vi.mock('../services/producerWorkflowService', () => ({
  producerWorkflowService: serviceMocks,
  // Inline reimplementation of the pure helper so useProducerReviews
  // can derive summary counters without the test pulling in the entire
  // service module (doing so would reach for browser-only globals
  // during hook render). Mirrors the shape the hook consumes.
  summarizeProducerReviewStatuses: (reviews: Array<{ status?: string }>) => {
    const summary = {
      pendingReviews: 0,
      approvedReviews: 0,
      rejectedReviews: 0,
      changesRequestedReviews: 0,
      totalReviews: reviews.length,
    };
    for (const r of reviews) {
      switch (r.status) {
        case 'approved':          summary.approvedReviews += 1; break;
        case 'rejected':          summary.rejectedReviews += 1; break;
        case 'changes_requested': summary.changesRequestedReviews += 1; break;
        default:                  summary.pendingReviews += 1; break;
      }
    }
    return summary;
  },
}));

describe('producer workflow hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and groups timeline items and appends created milestone', async () => {
    serviceMocks.getTimeline.mockResolvedValue([
      {
        id: 't-1',
        project_id: 'p-1',
        phase: 'preproduction',
        title: 'Storyboard klar',
        status: 'planned',
        sort_order: 0,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 't-2',
        project_id: 'p-1',
        phase: 'production',
        title: 'Opptaksdag 1',
        status: 'in_progress',
        sort_order: 0,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
    ]);
    serviceMocks.createTimelineItem.mockResolvedValue({
      id: 't-3',
      project_id: 'p-1',
      phase: 'postproduction',
      title: 'Ferdig klipp',
      status: 'planned',
      sort_order: 0,
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    });
    serviceMocks.updateTimelineItem.mockResolvedValue({
      id: 't-3',
      project_id: 'p-1',
      phase: 'postproduction',
      title: 'Ferdig klipp',
      status: 'completed',
      sort_order: 0,
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T01:00:00.000Z',
    });
    serviceMocks.deleteTimelineItem.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProducerTimeline('p-1'));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });
    expect(result.current.groupedByPhase.preproduction).toHaveLength(1);
    expect(result.current.groupedByPhase.production).toHaveLength(1);
    expect(result.current.groupedByPhase.postproduction).toHaveLength(0);

    await act(async () => {
      await result.current.createItem({
        phase: 'postproduction',
        title: 'Ferdig klipp',
      });
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.groupedByPhase.postproduction).toHaveLength(1);

    await act(async () => {
      await result.current.updateItem('t-3', { status: 'completed' });
    });
    expect(result.current.items.find((item) => item.id === 't-3')?.status).toBe('completed');

    await act(async () => {
      await result.current.removeItem('t-3');
    });
    expect(result.current.items).toHaveLength(2);
  });

  it('computes economy totals and patches an item in local state', async () => {
    serviceMocks.getEconomyItems.mockResolvedValue([
      {
        id: 'e-1',
        project_id: 'p-1',
        phase: 'preproduction',
        category: 'Crew',
        item_name: 'Planlegging',
        estimate: '100.50',
        approved: '80',
        actual: '20',
        currency: 'NOK',
        status: 'draft',
        client_visible: true,
        sort_order: 0,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'e-2',
        project_id: 'p-1',
        phase: 'production',
        category: 'Location',
        item_name: 'Studioleie',
        estimate: 50,
        approved: 50,
        actual: 25,
        currency: 'NOK',
        status: 'approved',
        client_visible: true,
        sort_order: 0,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
    ]);
    serviceMocks.updateEconomyItem.mockResolvedValue({
      id: 'e-1',
      project_id: 'p-1',
      phase: 'preproduction',
      category: 'Crew',
      item_name: 'Planlegging',
      estimate: '100.50',
      approved: '90',
      actual: '20',
      currency: 'NOK',
      status: 'approved',
      client_visible: true,
      sort_order: 0,
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T01:00:00.000Z',
    });
    serviceMocks.deleteEconomyItem.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProducerEconomy('p-1'));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });
    expect(result.current.totals.estimate).toBeCloseTo(150.5);
    expect(result.current.totals.approved).toBeCloseTo(130);
    expect(result.current.totals.actual).toBeCloseTo(45);

    await act(async () => {
      await result.current.updateItem('e-1', { approved: 90, status: 'approved' });
    });

    expect(result.current.items.find((item) => item.id === 'e-1')?.approved).toBe('90');
    expect(result.current.items.find((item) => item.id === 'e-1')?.status).toBe('approved');

    await act(async () => {
      await result.current.removeItem('e-2');
    });
    expect(result.current.items).toHaveLength(1);
  });

  it('summarizes review states and supports comment + decision updates', async () => {
    serviceMocks.getReviews.mockResolvedValue([
      {
        id: 'r-1',
        project_id: 'p-1',
        review_type: 'shotlist',
        title: 'Shotlist review',
        requested_at: '2026-03-01T00:00:00.000Z',
        status: 'pending',
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
        comments: [],
      },
    ]);
    serviceMocks.addReviewComment.mockResolvedValue({
      id: 'c-1',
      review_id: 'r-1',
      project_id: 'p-1',
      comment_text: 'Se på scene 3',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    });
    // Hook dispatches through setReviewDecisionWithTimeline now (the
    // timeline side-effect variant); the plain setReviewDecision was
    // renamed. Stub both so the suite stays tolerant to either wiring.
    const approvedReview = {
      id: 'r-1',
      project_id: 'p-1',
      review_type: 'shotlist',
      title: 'Shotlist review',
      requested_at: '2026-03-01T00:00:00.000Z',
      status: 'approved',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T01:00:00.000Z',
      comments: [],
    };
    serviceMocks.setReviewDecision.mockResolvedValue(approvedReview);
    serviceMocks.setReviewDecisionWithTimeline.mockResolvedValue(approvedReview);

    const { result } = renderHook(() => useProducerReviews('p-1'));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    expect(result.current.summary.pending).toBe(1);
    expect(result.current.summary.approved).toBe(0);

    await act(async () => {
      await result.current.addComment('r-1', { commentText: 'Se på scene 3' });
    });
    expect(result.current.items[0]?.comments).toHaveLength(1);

    await act(async () => {
      await result.current.setDecision('r-1', { decision: 'approved' });
    });
    expect(result.current.summary.pending).toBe(0);
    expect(result.current.summary.approved).toBe(1);
  });
});

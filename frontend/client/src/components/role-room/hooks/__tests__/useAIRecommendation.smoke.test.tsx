// @ts-nocheck
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ToastStack';
import { useAIRecommendation } from '../useAIRecommendation';
import type { AIRecommendationDedupAdapter } from '../../utils/aiRecommendationDedup';

const makeAdapter = (): AIRecommendationDedupAdapter & {
  seen: Set<string>;
  forgotten: Set<string>;
} => {
  const seen = new Set<string>();
  const forgotten = new Set<string>();
  return {
    seen,
    forgotten,
    hasSeen: (id) => seen.has(id),
    markSeen: (id) => seen.add(id),
    forget: (id) => {
      seen.delete(id);
      forgotten.add(id);
    },
    forgetAll: () => seen.clear(),
  };
};

const wrap = (children: React.ReactNode) => <ToastProvider>{children}</ToastProvider>;

describe('Sprint 4.2 — useAIRecommendation', () => {
  it('shows a toast on first call and marks the recommendation as seen', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useAIRecommendation({ adapter }), {
      wrapper: ({ children }) => wrap(children),
    });

    let showed = false;
    act(() => {
      showed = result.current.recommend({
        recommendationId: 'try-storyboard',
        message: 'Prøv storyboard nå',
      });
    });
    expect(showed).toBe(true);
    expect(adapter.seen.has('try-storyboard')).toBe(true);
  });

  it('does not show twice for the same recommendationId without force=true', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useAIRecommendation({ adapter }), {
      wrapper: ({ children }) => wrap(children),
    });

    let first = false;
    let second = false;
    act(() => {
      first = result.current.recommend({
        recommendationId: 'try-storyboard',
        message: 'Prøv storyboard nå',
      });
    });
    act(() => {
      second = result.current.recommend({
        recommendationId: 'try-storyboard',
        message: 'Prøv storyboard nå',
      });
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('honors force=true to re-show a previously seen recommendation', () => {
    const adapter = makeAdapter();
    adapter.markSeen('cmd-k-tip');

    const { result } = renderHook(() => useAIRecommendation({ adapter }), {
      wrapper: ({ children }) => wrap(children),
    });

    let showed = false;
    act(() => {
      showed = result.current.recommend({
        recommendationId: 'cmd-k-tip',
        message: 'Trykk Cmd+K for hurtigsøk',
        force: true,
      });
    });
    expect(showed).toBe(true);
  });

  it('rejects empty recommendationId', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useAIRecommendation({ adapter }), {
      wrapper: ({ children }) => wrap(children),
    });

    let showed = true;
    act(() => {
      showed = result.current.recommend({
        recommendationId: '',
        message: 'Burde ikke vises',
      });
    });
    expect(showed).toBe(false);
  });

  it('forget removes a recommendation from the dedup store', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useAIRecommendation({ adapter }), {
      wrapper: ({ children }) => wrap(children),
    });

    act(() => {
      result.current.recommend({ recommendationId: 'tip-1', message: 'tip' });
    });
    expect(result.current.hasSeen('tip-1')).toBe(true);

    act(() => {
      result.current.forget('tip-1');
    });
    expect(result.current.hasSeen('tip-1')).toBe(false);
  });

  it('renders the AI prefix and CTA button when actionLabel + onAction provided', () => {
    const adapter = makeAdapter();
    const onAction = vi.fn();

    const Harness = () => {
      const ai = useAIRecommendation({ adapter });
      return (
        <button
          type="button"
          onClick={() =>
            ai.recommend({
              recommendationId: 'open-palette',
              message: 'Trykk Cmd+K for hurtigsøk',
              actionLabel: 'Vis meg',
              onAction,
            })
          }
        >
          fire
        </button>
      );
    };

    render(<ToastProvider>{<Harness />}</ToastProvider>);
    fireEvent.click(screen.getByText('fire'));

    expect(screen.getByText(/Trykk Cmd\+K for hurtigsøk/)).toBeInTheDocument();
    expect(screen.getByText('✨', { exact: false })).toBeInTheDocument();

    const cta = screen.getByRole('button', { name: /Vis meg/ });
    fireEvent.click(cta);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

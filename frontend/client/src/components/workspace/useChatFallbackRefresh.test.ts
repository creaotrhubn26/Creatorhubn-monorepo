import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatFallbackRefresh } from './useChatFallbackRefresh';

describe('useChatFallbackRefresh', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('henter ingenting så lenge sanntidsstrømmen er oppe', () => {
    const refresh = vi.fn();
    renderHook(() => useChatFallbackRefresh(true, refresh, 1000));

    vi.advanceTimersByTime(10_000);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('tar over når forbindelsen ryker', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ live }) => useChatFallbackRefresh(live, refresh, 1000),
      { initialProps: { live: true } },
    );

    rerender({ live: false });
    vi.advanceTimersByTime(3000);

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('stopper igjen så snart forbindelsen er tilbake', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ live }) => useChatFallbackRefresh(live, refresh, 1000),
      { initialProps: { live: false } },
    );

    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(2);

    rerender({ live: true });
    vi.advanceTimersByTime(10_000);

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('lar en skjult fane være i fred', () => {
    const refresh = vi.fn();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    renderHook(() => useChatFallbackRefresh(false, refresh, 1000));

    vi.advanceTimersByTime(5000);

    expect(refresh).not.toHaveBeenCalled();
    hidden.mockRestore();
  });

  it('rydder opp ved unmount', () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useChatFallbackRefresh(false, refresh, 1000));

    unmount();
    vi.advanceTimersByTime(10_000);

    expect(refresh).not.toHaveBeenCalled();
  });
});

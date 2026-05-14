// @ts-nocheck
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBeforeUnloadIfDirty } from '../useBeforeUnloadIfDirty';

describe('Sprint 5.3 — useBeforeUnloadIfDirty', () => {
  let listeners: Array<{ event: string; handler: EventListener }> = [];
  let originalAdd: typeof window.addEventListener;
  let originalRemove: typeof window.removeEventListener;

  beforeEach(() => {
    listeners = [];
    originalAdd = window.addEventListener;
    originalRemove = window.removeEventListener;
    window.addEventListener = vi.fn((event, handler) => {
      listeners.push({ event, handler: handler as EventListener });
      originalAdd.call(window, event, handler);
    }) as typeof window.addEventListener;
    window.removeEventListener = vi.fn((event, handler) => {
      listeners = listeners.filter((l) => !(l.event === event && l.handler === handler));
      originalRemove.call(window, event, handler);
    }) as typeof window.removeEventListener;
  });

  afterEach(() => {
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
  });

  const beforeUnloadCount = () =>
    listeners.filter((l) => l.event === 'beforeunload').length;

  it('registers a beforeunload listener when isDirty=true', () => {
    renderHook(() => useBeforeUnloadIfDirty({ isDirty: true }));
    expect(beforeUnloadCount()).toBe(1);
  });

  it('does NOT register listener when isDirty=false', () => {
    renderHook(() => useBeforeUnloadIfDirty({ isDirty: false }));
    expect(beforeUnloadCount()).toBe(0);
  });

  it('removes the listener when component unmounts', () => {
    const { unmount } = renderHook(() => useBeforeUnloadIfDirty({ isDirty: true }));
    expect(beforeUnloadCount()).toBe(1);
    unmount();
    expect(beforeUnloadCount()).toBe(0);
  });

  it('toggles listener when isDirty changes', () => {
    const { rerender } = renderHook(({ dirty }) => useBeforeUnloadIfDirty({ isDirty: dirty }), {
      initialProps: { dirty: false },
    });
    expect(beforeUnloadCount()).toBe(0);

    rerender({ dirty: true });
    expect(beforeUnloadCount()).toBe(1);

    rerender({ dirty: false });
    expect(beforeUnloadCount()).toBe(0);
  });

  it('preventDefault fires and handler returns the message while dirty', () => {
    renderHook(() => useBeforeUnloadIfDirty({ isDirty: true, message: 'Du har endringer' }));
    const listener = listeners.find((l) => l.event === 'beforeunload')!;
    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefault = vi.spyOn(event, 'preventDefault');
    // Handler returnerer melding for legacy-Safari/Firefox-kompatibilitet.
    const result = (listener.handler as (e: Event) => unknown)(event);
    expect(preventDefault).toHaveBeenCalled();
    expect(result).toBe('Du har endringer');
  });

  it('confirmIfDirty() returns true immediately when not dirty', () => {
    const { result } = renderHook(() => useBeforeUnloadIfDirty({ isDirty: false }));
    expect(result.current.confirmIfDirty()).toBe(true);
  });

  it('confirmIfDirty() shows window.confirm when dirty and returns its result', () => {
    const { result } = renderHook(() =>
      useBeforeUnloadIfDirty({ isDirty: true, message: 'Forlate?' }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => {
      expect(result.current.confirmIfDirty()).toBe(true);
    });
    expect(confirmSpy).toHaveBeenCalledWith('Forlate?');

    confirmSpy.mockReturnValue(false);
    act(() => {
      expect(result.current.confirmIfDirty()).toBe(false);
    });
    confirmSpy.mockRestore();
  });
});

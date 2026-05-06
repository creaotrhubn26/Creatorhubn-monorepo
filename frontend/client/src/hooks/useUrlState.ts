/**
 * URL-driven UI state hooks. Replace useState for tab-index, filter,
 * and search-string state so:
 *
 *   1. Browser back/forward navigates between previous UI states.
 *   2. URL is shareable — paste it in another tab and you land on the
 *      exact same view (filters applied, tab open).
 *   3. Page reload preserves state (no resets to default tab 0).
 *
 * Built on wouter's `useLocation`. Updates use history.pushState so
 * each change is a real history entry — back-button-friendly.
 *
 * Two flavours:
 *   - `useUrlTab(key, defaultValue)` for numeric tab indices
 *   - `useUrlParam(key, defaultValue)` for arbitrary string state
 *     (search terms, filter selections, sub-tab names)
 *
 * Both keep the URL clean: parameters at default value get stripped
 * out so you don't accumulate `?tab=0&search=&filter=all` cruft.
 */

import { useCallback, useEffect, useState } from 'react';

function readSearch(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function writeSearch(next: URLSearchParams, replace = false): void {
  if (typeof window === 'undefined') return;
  const search = next.toString();
  const url = `${window.location.pathname}${search ? '?' + search : ''}${window.location.hash}`;
  if (replace) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
}

/// Subscribe to popstate so all useUrlTab/useUrlParam consumers re-read
/// the URL when the user clicks back/forward. Module-level listener
/// avoids duplicate registrations per hook instance.
type Listener = () => void;
const listeners = new Set<Listener>();
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    for (const l of listeners) l();
  });
}

function useUrlSync(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return tick;
}

/**
 * Numeric tab index synced to a URL query parameter.
 *
 * @example
 *   const [tab, setTab] = useUrlTab('admin', 0);
 *   // URL: /showcase-admin?admin=2
 */
export function useUrlTab(
  key: string,
  defaultValue = 0,
): [number, (value: number) => void] {
  useUrlSync();
  const value = (() => {
    const raw = readSearch().get(key);
    if (raw == null) return defaultValue;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  })();
  const setValue = useCallback(
    (next: number) => {
      const params = readSearch();
      if (next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, String(next));
      }
      writeSearch(params);
      // Trigger re-read across all subscribers (popstate doesn't fire
      // for pushState calls, only browser back/forward).
      for (const l of listeners) l();
    },
    [key, defaultValue],
  );
  return [value, setValue];
}

/**
 * String state (search-term, filter-name, sub-tab id) synced to URL.
 *
 * @example
 *   const [filter, setFilter] = useUrlParam('status', 'all');
 *   // URL: /crm?status=active
 */
export function useUrlParam(
  key: string,
  defaultValue = '',
): [string, (value: string) => void] {
  useUrlSync();
  const value = readSearch().get(key) ?? defaultValue;
  const setValue = useCallback(
    (next: string) => {
      const params = readSearch();
      if (!next || next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      writeSearch(params);
      for (const l of listeners) l();
    },
    [key, defaultValue],
  );
  return [value, setValue];
}

/**
 * Imperatively replace several params at once. Useful when navigating
 * from a deep-link (e.g., "open gallery X events dialog") so you don't
 * trigger N separate history entries.
 */
export function setUrlParams(updates: Record<string, string | number | null | undefined>): void {
  const params = readSearch();
  for (const [k, v] of Object.entries(updates)) {
    if (v == null || v === '' || v === 0) {
      params.delete(k);
    } else {
      params.set(k, String(v));
    }
  }
  writeSearch(params);
  for (const l of listeners) l();
}

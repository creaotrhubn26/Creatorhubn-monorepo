import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() { return store.size; },
    key(index: number) { return Array.from(store.keys())[index] ?? null; },
    getItem(key: string) { return store.has(key) ? store.get(key)! : null; },
    setItem(key: string, value: string) { store.set(key, String(value)); },
    removeItem(key: string) { store.delete(key); },
    clear() { store.clear(); },
  };
  Object.defineProperty(window, 'localStorage', { value: storage, writable: true, configurable: true });
}

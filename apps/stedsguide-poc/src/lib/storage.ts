/**
 * Tynn localStorage-wrapper. Alle kall er try/catch-et: private vinduer,
 * blokkert lagring og SSR skal aldri knekke appen.
 */
const PREFIX = 'stedsguide:';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignorer – lagring er en bekvemmelighet, ikke et krav */
  }
}

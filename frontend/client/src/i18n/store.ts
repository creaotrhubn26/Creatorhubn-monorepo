import type { Lang } from './resources';

// Modul-nivå språk-lager (ingen Provider nødvendig — appen har flere entry-points).
// Komponenter abonnerer via useSyncExternalStore i useT().
const STORAGE_KEY = 'roleroom.lang';
const listeners = new Set<() => void>();

function readInitial(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'no' || v === 'en') return v;
  } catch { /* localStorage utilgjengelig — bruk default */ }
  return 'no'; // norsk-først
}

let current: Lang = readInitial();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  listeners.forEach((cb) => cb());
}

export function subscribeLang(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

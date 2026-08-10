import type { Lang } from './resources';
import { apiRequest } from '../lib/queryClient';

// Modul-nivå språk-lager (ingen Provider nødvendig — appen har flere entry-points).
// Komponenter abonnerer via useSyncExternalStore i useT().
// Persistens: localStorage (umiddelbart, per nettleser) + brukerprofil-backend
// (per konto, via den eksisterende /api/user/kv-nøkkellagringen) så valget følger
// brukeren på tvers av enheter.
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

// Oppdater i minne + localStorage + varsle abonnenter. Returnerer false hvis uendret.
function apply(lang: Lang): boolean {
  if (lang === current) return false;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  listeners.forEach((cb) => cb());
  return true;
}

function hasAuthToken(): boolean {
  try {
    return !!(localStorage.getItem('creatorhub_auth_token')
      || localStorage.getItem('role_room_auth_token')
      || localStorage.getItem('token'));
  } catch { return false; }
}

export function setLang(lang: Lang): void {
  if (!apply(lang)) return;
  // Synk til brukerprofil (fire-and-forget). localStorage er allerede oppdatert,
  // så UI-et er live uansett om nettverket feiler. Hopp over hvis uinnlogget
  // (unngår skriv til delt "guest"-scope).
  if (!hasAuthToken()) return;
  apiRequest('/api/user/kv', {
    method: 'POST',
    body: JSON.stringify({ key: STORAGE_KEY, value: lang }),
  }).catch(() => { /* nettverksfeil — localStorage holder til neste synk */ });
}

export function subscribeLang(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// Hydrer språk fra brukerprofilen ved oppstart. Backend-verdien vinner over
// localStorage (den er kilden som er synket på tvers av enheter). Kjøres kun når
// en auth-token finnes, for å unngå 401-støy på offentlige sider.
// ponytail: kjører ved modul-last; logg-inn-uten-reload hydreres først ved neste
// reload — flytt til et post-login-hook hvis in-session språkbytte trengs.
export function hydrateLangFromServer(): void {
  if (!hasAuthToken()) return;
  apiRequest(`/api/user/kv/${STORAGE_KEY}`)
    .then((j) => { const v = j?.data; if (v === 'no' || v === 'en') apply(v); })
    .catch(() => { /* uinnlogget / ingen lagret verdi — behold localStorage */ });
}

hydrateLangFromServer();

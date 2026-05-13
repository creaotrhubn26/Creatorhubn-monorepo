/**
 * clarity.ts
 *
 * Tynn type-safe wrapper rundt Microsoft Clarity-API.
 * Skriptet er allerede installert i theroleroom.html / index.html /
 * casting.html via consent-gating. Denne fila lar React-koden
 * sende custom tags, identifiere brukere og fyre custom events
 * uten direkte window.clarity-kall.
 *
 * Clarity finner automatisk UX-problemer (rage clicks, dead clicks,
 * quick backs, excessive scroll, JS-errors). Custom tags lar oss
 * filtrere disse innsiktene per side-type i Clarity-dashboardet —
 * f.eks. "vis kun rage-clicks på /vs-studiobinder".
 *
 * Bruk:
 *   import { clarityTag, clarityIdentify } from '@/lib/clarity';
 *   clarityTag('page_type', 'student-seo');
 *   clarityIdentify(userId, sessionId, pageId);
 *
 * Robust: ingen exception kastes hvis Clarity ikke er lastet
 * (localhost, blokkert av adblock, consent ikke gitt).
 */

type ClarityFn = ((...args: unknown[]) => void) & {
  q?: unknown[];
};

interface WindowWithClarity extends Window {
  clarity?: ClarityFn;
}

function getClarity(): ClarityFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as WindowWithClarity;
  return typeof w.clarity === 'function' ? w.clarity : null;
}

/**
 * Sett en custom-tag på current session. Tags brukes i Clarity-
 * dashboardet til å filtrere session-replays + heat maps.
 *
 * Eksempler:
 *   clarityTag('page_type', 'student-seo')
 *   clarityTag('page_slug', 'vs-studiobinder')
 *   clarityTag('user_role', 'casting_director')
 */
export function clarityTag(key: string, value: string | string[]): void {
  const clarity = getClarity();
  if (!clarity) return;
  try {
    clarity('set', key, value);
  } catch {
    // Ignorer — Clarity skal aldri kaste i prod
  }
}

/**
 * Knytt current session til en kjent bruker. Lar oss følge
 * samme brukers session-replays over tid og linker Clarity-
 * data til GA4 via custom dimensions.
 */
export function clarityIdentify(
  userId: string | null | undefined,
  sessionId?: string,
  pageId?: string,
  friendlyName?: string,
): void {
  const clarity = getClarity();
  if (!clarity || !userId) return;
  try {
    clarity('identify', userId, sessionId, pageId, friendlyName);
  } catch {
    // Ignorer
  }
}

/**
 * Fyr et custom Clarity-event. Brukes til å markere viktige
 * milepæler i en session ("audition_created", "checkout_started")
 * som vises i session-replay-tidslinjen.
 */
export function clarityEvent(name: string): void {
  const clarity = getClarity();
  if (!clarity) return;
  try {
    clarity('event', name);
  } catch {
    // Ignorer
  }
}

/**
 * Marker current session som "viktig" — Clarity prioriterer
 * disse i sampling-algoritmen sin. Bruk sparsomt for høyverdige
 * sessioner (signup, payment, churn-risk).
 */
export function clarityUpgrade(reason: string): void {
  const clarity = getClarity();
  if (!clarity) return;
  try {
    clarity('upgrade', reason);
  } catch {
    // Ignorer
  }
}

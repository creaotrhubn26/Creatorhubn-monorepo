/**
 * ScrollRestoration — bevarer scroll-posisjon per route+search-string så
 * browser back/forward setter brukeren tilbake der de var, ikke på toppen
 * av siden.
 *
 * Ulike scenarier:
 *   - Click navigation (push) → scroll to top på ny destinasjon
 *   - Browser back/forward (pop) → restore lagret scrollY for den routen
 *   - Reload (samme URL) → restore (browser gjør dette selv, men vi
 *     forsikrer oss likevel)
 *
 * Lagrer i sessionStorage så posisjoner overlever reload men ikke
 * tab-lukking. Bruker pathname+search som key så ulike filter-tilstander
 * får sin egen scroll-posisjon (CRM med "status=active" husker annen
 * scroll enn CRM med "status=lead").
 *
 * Mount én gang på App-nivå. Renderer ingenting; rene side-effects.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';

const STORAGE_PREFIX = 'creatorhub:scroll:';

function makeKey(): string {
  if (typeof window === 'undefined') return STORAGE_PREFIX;
  return `${STORAGE_PREFIX}${window.location.pathname}${window.location.search}`;
}

function saveScroll(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(makeKey(), String(window.scrollY));
  } catch {
    // sessionStorage full / disabled — silent skip
  }
}

function restoreScroll(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(makeKey());
    if (raw == null) {
      window.scrollTo(0, 0);
      return;
    }
    const y = Number.parseInt(raw, 10);
    if (Number.isFinite(y)) {
      // Vent en frame så lazy-rendert innhold rekker å mounte før vi
      // setter scroll. Uten dette setter vi mot side som ennå er kortere
      // enn lagret scrollY → snap til bunnen.
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }
  } catch {
    // ignore
  }
}

export function ScrollRestoration() {
  const [location] = useLocation();

  useEffect(() => {
    // Telemetri: lagre scroll med kort throttle så vi ikke fyrer per
    // pixel under scroll. saveScroll på unload + popstate er hoved-
    // signalene.
    let savePending = false;
    const onScroll = () => {
      if (savePending) return;
      savePending = true;
      requestAnimationFrame(() => {
        saveScroll();
        savePending = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('beforeunload', saveScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', saveScroll);
    };
  }, []);

  useEffect(() => {
    // Når wouter-location endres (klikk-nav eller popstate) — restore.
    // For klikk-nav vil sessionStorage som regel ikke ha entry → scroll
    // til 0. For popstate vil entry finnes → restore lagret posisjon.
    restoreScroll();
  }, [location]);

  return null;
}

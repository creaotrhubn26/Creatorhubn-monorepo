import { useEffect } from 'react';

/**
 * MUI v6.1 setter aria-hidden="true" på alle siblings + ancestors av en
 * åpen Modal/Dialog. Hvis et fokusert element (typisk en knapp som åpnet
 * modalen) ikke har mistet fokus før attributtet settes, gir Chrome en
 * konsoll-warning:
 *
 *   Blocked aria-hidden on an element because its descendant retained
 *   focus. The focus must not be hidden from assistive technology users.
 *
 * MUI v6.4+ bytter til `inert`, men vi sitter på 6.1.6. Denne hooken
 * lytter globalt etter aria-hidden-attribute-mutations og blur-er
 * eventuelle fokuserte elementer som ender opp under et aria-hidden-tre.
 * Best-effort — krasjer ikke hvis MutationObserver eller blur() feiler.
 */
export function useAriaHiddenFocusFix(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes') continue;
        if (mutation.attributeName !== 'aria-hidden') continue;
        const target = mutation.target as HTMLElement | null;
        if (!target || target.getAttribute('aria-hidden') !== 'true') continue;
        const focused = document.activeElement as HTMLElement | null;
        if (!focused || focused === document.body) continue;
        if (!target.contains(focused)) continue;
        try {
          focused.blur();
        } catch {
          // Ignore — neste mutation rydder evt. opp.
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden'],
    });

    return () => observer.disconnect();
  }, [enabled]);
}

export default useAriaHiddenFocusFix;

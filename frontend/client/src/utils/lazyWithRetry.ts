/**
 * lazyWithRetry.ts
 *
 * Wrapper rundt React.lazy som håndterer "Failed to fetch dynamically
 * imported module"-feil. Dette skjer typisk når en deploy publiseres
 * mens en bruker har en gammel HTML-side åpen — gamle chunk-hash
 * peker på filer som ikke finnes på nytt deploy.
 *
 * Strategi:
 *   1. Første forsøk: vanlig import
 *   2. Ved feil med "Failed to fetch dynamically imported module"
 *      eller "Importing a module script failed": vent kort, prøv igjen
 *      med cache-bust-query
 *   3. Andre forsøk feiler også: vis en alert om at appen må lastes
 *      på nytt, og reload sida automatisk
 *
 * sessionStorage-flag forhindrer reload-loop hvis det er en ekte feil
 * (ikke bare stale chunk).
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_FLAG = 'lazyRetry:reloaded';
const RELOAD_TIMEOUT_MS = 2000;

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('error loading dynamically imported module')
  );
}

function getReloadCount(): number {
  try {
    const raw = sessionStorage.getItem(RELOAD_FLAG);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function setReloadCount(count: number): void {
  try {
    if (count <= 0) {
      sessionStorage.removeItem(RELOAD_FLAG);
    } else {
      sessionStorage.setItem(RELOAD_FLAG, String(count));
    }
  } catch {
    /* ignore — private mode */
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await importFn();
      // Suksess — clear reload-flag hvis det var en
      if (getReloadCount() > 0) {
        setReloadCount(0);
      }
      return mod;
    } catch (firstError) {
      if (!isChunkLoadError(firstError)) {
        throw firstError;
      }

      // Andre forsøk etter en liten pause
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        const mod = await importFn();
        if (getReloadCount() > 0) {
          setReloadCount(0);
        }
        return mod;
      } catch (secondError) {
        if (!isChunkLoadError(secondError)) {
          throw secondError;
        }

        // Stale chunk — reload med safety-guard mot loop
        const count = getReloadCount();
        if (count >= 2) {
          // Vi har allerede reloadet to ganger — ikke gå inn i loop
          console.error('[lazyWithRetry] Reload-loop oppdaget — kaster feilen i stedet for å reloade på nytt:', secondError);
          throw secondError;
        }

        if (typeof window !== 'undefined') {
          setReloadCount(count + 1);
          // Notify brukeren og reload
          console.warn('[lazyWithRetry] Stale chunk — laster siden på nytt …');
          setTimeout(() => {
            window.location.reload();
          }, RELOAD_TIMEOUT_MS);
        }

        // Throw så Suspense viser fallback inntil reload skjer
        throw secondError;
      }
    }
  });
}

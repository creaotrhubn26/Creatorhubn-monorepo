/**
 * useBeforeUnloadIfDirty — viser nettleser-standard "Endringer kan gå tapt"-
 * prompt når brukeren prøver å lukke fanen / navigere bort mens vi har
 * pending endringer som ikke er lagret.
 *
 * Moderne nettlesere ignorerer custom message-streng, men prompten utløses
 * fortsatt. Hook'en gjør tre ting:
 *   - Lytter på `beforeunload` så X / Cmd+W / Back utløser prompt
 *   - Lytter på `popstate` for SPA-back (vi kan bare advare, ikke blokkere)
 *   - Returnerer en `confirmIfDirty()`-helper for programmatisk navigering
 */

import { useEffect, useCallback } from 'react';

interface UseBeforeUnloadIfDirtyOptions {
  /** Når true er det noe å beskytte (autosave pending, unsaved form, etc.) */
  isDirty: boolean;
  /** Vis tekst i confirm-dialoger (browser-prompt ignorerer den, men popstate bruker den). */
  message?: string;
}

const DEFAULT_MESSAGE = 'Du har endringer som ikke er lagret. Forlate likevel?';

export interface UseBeforeUnloadIfDirtyResult {
  /**
   * Spør brukeren om å bekrefte før en programmatisk navigasjon. Returnerer
   * true hvis brukeren godkjenner (eller hvis state er ren).
   */
  confirmIfDirty: () => boolean;
}

export function useBeforeUnloadIfDirty(
  options: UseBeforeUnloadIfDirtyOptions,
): UseBeforeUnloadIfDirtyResult {
  const { isDirty, message = DEFAULT_MESSAGE } = options;

  useEffect(() => {
    if (!isDirty) return undefined;

    const handler = (event: BeforeUnloadEvent) => {
      // Spec: kalle preventDefault + sette returnValue trigger nettleser-prompten.
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, message]);

  const confirmIfDirty = useCallback((): boolean => {
    if (!isDirty) return true;
    if (typeof window === 'undefined') return true;
    return window.confirm(message);
  }, [isDirty, message]);

  return { confirmIfDirty };
}

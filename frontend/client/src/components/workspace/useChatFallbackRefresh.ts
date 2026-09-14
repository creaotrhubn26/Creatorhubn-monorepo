import { useEffect, useRef } from 'react';

/** Sjelden med vilje: dette er unntakstilstanden, ikke normaldriften. */
export const CHAT_FALLBACK_INTERVAL_MS = 45_000;

/**
 * Nettet under sanntidschatten.
 *
 * Normalt kommer meldinger som `chat.message` på bruker-event-strømmen og
 * ingen timer finnes. Ryker strømmen slutter chatten å oppdatere seg helt
 * stille — verre enn en treg chat — så da, og bare da, henter vi periodisk
 * igjen. Kommer strømmen tilbake stopper timeren umiddelbart; det som ble
 * borte hentes av gjenkoblingssignalet (`WORKSPACE_FULL_REFRESH_SCOPE`), ikke
 * av denne.
 *
 * Skjult fane henter ikke — den får alt ved `visibilitychange`/`focus`.
 */
export function useChatFallbackRefresh(
  realtimeConnected: boolean,
  refresh: () => void,
  intervalMs: number = CHAT_FALLBACK_INTERVAL_MS,
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (realtimeConnected) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshRef.current();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [realtimeConnected, intervalMs]);
}

export default useChatFallbackRefresh;

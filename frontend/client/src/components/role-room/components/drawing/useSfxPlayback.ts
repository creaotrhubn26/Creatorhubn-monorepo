/**
 * useSfxPlayback — kobler en liste over scheduled SFX-events til
 * HTMLAudioElements som spilles av i takt med animatic-currentTime.
 *
 * En audio-element opprettes lazy per event (kun events som har en
 * tilknyttet clipUrl). Når currentTime entrer et events vindu,
 * spiller vi av lyden fra start. Når vinduet forlates, pauses.
 *
 * For ambient/music holder vi lyden i loop slik at den fyller hele
 * vinduet uavhengig av klipp-lengde. Event-lag spilles én gang.
 *
 * Hook'en eksponerer en array av aktive audio-elementer slik at
 * de kan inkluderes i recording-grafen.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { getActiveSfxAt, type ScheduledSfx } from './sfxScheduler';

export interface UseSfxPlaybackOptions {
  scheduled: ScheduledSfx[];
  /** Bruker-leverte / AI-generete clips per event-id. */
  clipUrls: Record<string, string>;
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed?: number;
  /** Master-volum for SFX. 1 = full. */
  masterGain?: number;
}

export interface UseSfxPlaybackResult {
  /** Alle audio-elementer som har lyd lastet (for recording-graf). */
  audioElements: HTMLAudioElement[];
  /** Hvilke event-id'er som spiller akkurat nå (for UI-debug). */
  activeIds: string[];
}

export function useSfxPlayback(options: UseSfxPlaybackOptions): UseSfxPlaybackResult {
  const {
    scheduled,
    clipUrls,
    isPlaying,
    currentTime,
    playbackSpeed = 1,
    masterGain = 1,
  } = options;

  // Map eventId → HTMLAudioElement. Holdes i ref så den ikke trigger re-render.
  const elementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const wasActiveRef = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);

  // Behov: når clipUrls endrer seg, opprett/oppdater audio-elementer.
  useEffect(() => {
    const current = elementsRef.current;
    // Legg til/oppdater
    for (const [eventId, url] of Object.entries(clipUrls)) {
      let el = current.get(eventId);
      if (!el) {
        el = new Audio();
        el.preload = 'auto';
        current.set(eventId, el);
      }
      if (el.src !== url) {
        el.src = url;
      }
    }
    // Fjern de som ikke lenger har URL
    for (const [eventId, el] of current.entries()) {
      if (!(eventId in clipUrls)) {
        try { el.pause(); } catch {}
        current.delete(eventId);
      }
    }
    forceRender((n) => n + 1);
  }, [clipUrls]);

  // Master-volum og hastighet propageres til alle elementene.
  useEffect(() => {
    for (const el of elementsRef.current.values()) {
      el.volume = Math.max(0, Math.min(1, masterGain));
      el.playbackRate = playbackSpeed;
    }
  }, [masterGain, playbackSpeed]);

  // Aktive events ved gjeldende tid.
  const activeNow = useMemo(
    () => getActiveSfxAt(scheduled, currentTime),
    [scheduled, currentTime],
  );

  // Sync play/pause-state for hver event vs. forrige tilstand.
  useEffect(() => {
    const activeIds = new Set(activeNow.map((a) => a.event.id));
    const prev = wasActiveRef.current;

    // Stop events som ikke lenger er aktive.
    for (const id of prev) {
      if (!activeIds.has(id)) {
        const el = elementsRef.current.get(id);
        if (el) {
          try { el.pause(); el.currentTime = 0; } catch {}
        }
      }
    }

    // Start events som nettopp ble aktive (eller endrer mens isPlaying).
    if (isPlaying) {
      for (const item of activeNow) {
        const el = elementsRef.current.get(item.event.id);
        if (!el || !el.src) continue;
        const layer = item.event.layer;
        if (!prev.has(item.event.id)) {
          // Nylig aktiv: spill fra start (event) eller fortsett (ambient/music).
          try {
            el.currentTime = 0;
            el.loop = layer !== 'event';
            const p = el.play();
            if (p && typeof p.then === 'function') p.catch(() => {});
          } catch {}
        }
      }
    } else {
      // Hvis vi ikke spiller: pause alle.
      for (const id of prev) {
        const el = elementsRef.current.get(id);
        if (el) {
          try { el.pause(); } catch {}
        }
      }
    }

    wasActiveRef.current = activeIds;
  }, [activeNow, isPlaying]);

  // Cleanup ved unmount: pause alle.
  useEffect(() => () => {
    for (const el of elementsRef.current.values()) {
      try { el.pause(); } catch {}
    }
    elementsRef.current.clear();
  }, []);

  const audioElements = Array.from(elementsRef.current.values());
  return {
    audioElements,
    activeIds: activeNow.map((a) => a.event.id),
  };
}

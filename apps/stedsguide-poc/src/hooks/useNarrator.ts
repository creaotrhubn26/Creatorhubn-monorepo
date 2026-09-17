import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GuideScript } from '../data/types';
import { cancelSpeech, hasVoiceFor, isSpeechSupported, pauseSpeech, resumeSpeech, speak } from '../lib/speech';

export type NarratorPhase = 'audioDescription' | 'narration' | 'scene';
export type NarratorStatus = 'idle' | 'playing' | 'paused' | 'ended';

export interface NarratorState {
  index: number;
  phase: NarratorPhase;
  status: NarratorStatus;
  /** Tegnindeks i gjeldende tekst for ord-markering (−1 = ukjent). */
  charIndex: number;
  /** Teksten som leses akkurat nå (det som skal tekstes). */
  currentText: string;
  speechSupported: boolean;
  voiceAvailable: boolean;
}

export interface NarratorOptions {
  lang: string;
  rate: number;
  audioDescription: boolean;
  startIndex?: number;
  onSegmentChange?: (index: number) => void;
}

/**
 * Sekvenserer guiden: for hvert segment leses (valgfritt) synstolking
 * først, så fortellingen. Teksting får `currentText` + `charIndex`.
 * Uten talestøtte fungerer alt som «tekst + Neste».
 */
export function useNarrator(script: GuideScript, opts: NarratorOptions) {
  const { lang, rate, audioDescription, startIndex = 0, onSegmentChange } = opts;
  const total = script.segments.length;
  const speechSupported = useMemo(() => isSpeechSupported(), []);
  const [voiceAvailable, setVoiceAvailable] = useState(() => hasVoiceFor(lang));

  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, total - 1)));
  const [phase, setPhase] = useState<NarratorPhase>(audioDescription ? 'audioDescription' : 'narration');
  const [status, setStatus] = useState<NarratorStatus>('idle');
  const [charIndex, setCharIndex] = useState(-1);

  // Stemmer lastes asynkront i noen nettlesere – sjekk igjen litt senere.
  useEffect(() => {
    setVoiceAvailable(hasVoiceFor(lang));
    const id = window.setTimeout(() => setVoiceAvailable(hasVoiceFor(lang)), 800);
    return () => window.clearTimeout(id);
  }, [lang]);

  const latest = useRef({ index, phase, audioDescription, total });
  latest.current = { index, phase, audioDescription, total };

  const textFor = useCallback(
    (i: number, p: NarratorPhase): string => {
      if (p === 'scene') return script.sceneDescription;
      const seg = script.segments[i];
      if (!seg) return '';
      return p === 'audioDescription' ? seg.audioDescription : seg.narration;
    },
    [script],
  );

  const stop = useCallback(() => {
    cancelSpeech();
  }, []);

  /** Starter avspilling av (i, p). Går selv videre når teksten er ferdig. */
  const playAt = useCallback(
    (i: number, p: NarratorPhase) => {
      stop();
      setIndex(i);
      setPhase(p);
      setCharIndex(-1);
      setStatus('playing');
      const text = textFor(i, p);
      const advance = () => {
        const cur = latest.current;
        if (p === 'scene') {
          // Etter stedsbeskrivelse: fortsett der vi var, uten å hoppe videre.
          setStatus('paused');
          setPhase(cur.audioDescription ? 'audioDescription' : 'narration');
          setCharIndex(-1);
          return;
        }
        if (p === 'audioDescription') {
          playAt(i, 'narration');
          return;
        }
        if (i + 1 < cur.total) {
          onSegmentChange?.(i + 1);
          playAt(i + 1, cur.audioDescription ? 'audioDescription' : 'narration');
        } else {
          setStatus('ended');
          setCharIndex(-1);
        }
      };
      const spoken = speak(text, {
        lang,
        rate,
        onBoundary: (ci) => setCharIndex(ci),
        onEnd: advance,
        onError: () => {
          // Ingen stemme / motorfeil: bli stående som tekst, brukeren trykker Neste.
          setStatus('paused');
        },
      });
      if (!spoken || !hasVoiceFor(lang)) {
        // Ingen tale: vis teksten, ikke auto-fortsett.
        setStatus('paused');
      }
    },
    [lang, rate, stop, textFor, onSegmentChange],
  );

  const play = useCallback(() => {
    const cur = latest.current;
    if (status === 'paused' && speechSupported && window.speechSynthesis.paused) {
      resumeSpeech();
      setStatus('playing');
      return;
    }
    if (status === 'ended') {
      onSegmentChange?.(0);
      playAt(0, cur.audioDescription ? 'audioDescription' : 'narration');
      return;
    }
    playAt(cur.index, cur.phase === 'scene' ? (cur.audioDescription ? 'audioDescription' : 'narration') : cur.phase);
  }, [status, speechSupported, playAt, onSegmentChange]);

  const pause = useCallback(() => {
    if (status !== 'playing') return;
    pauseSpeech();
    setStatus('paused');
  }, [status]);

  const next = useCallback(() => {
    const cur = latest.current;
    if (cur.phase === 'audioDescription') {
      // Fra synstolking: hopp til selve fortellingen for samme del.
      playAt(cur.index, 'narration');
      return;
    }
    if (cur.index + 1 < cur.total) {
      onSegmentChange?.(cur.index + 1);
      playAt(cur.index + 1, cur.audioDescription ? 'audioDescription' : 'narration');
    } else {
      stop();
      setStatus('ended');
      setCharIndex(-1);
    }
  }, [playAt, stop, onSegmentChange]);

  const prev = useCallback(() => {
    const cur = latest.current;
    const target = Math.max(0, cur.index - 1);
    onSegmentChange?.(target);
    playAt(target, cur.audioDescription ? 'audioDescription' : 'narration');
  }, [playAt, onSegmentChange]);

  const replay = useCallback(() => {
    const cur = latest.current;
    playAt(cur.index, cur.audioDescription ? 'audioDescription' : 'narration');
  }, [playAt]);

  const describeScene = useCallback(() => {
    playAt(latest.current.index, 'scene');
  }, [playAt]);

  /** Hopp direkte til et segment (fra transkripsjonen). */
  const jumpTo = useCallback(
    (i: number) => {
      const cur = latest.current;
      const target = Math.min(Math.max(0, i), cur.total - 1);
      onSegmentChange?.(target);
      playAt(target, cur.audioDescription ? 'audioDescription' : 'narration');
    },
    [playAt, onSegmentChange],
  );

  // Rydd opp når komponenten forlates.
  useEffect(() => () => cancelSpeech(), []);

  // Endret språk/hastighet midt i avspilling: start gjeldende tekst på nytt.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (status === 'playing') playAt(latest.current.index, latest.current.phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, rate]);

  const state: NarratorState = {
    index,
    phase,
    status,
    charIndex,
    currentText: textFor(index, phase),
    speechSupported,
    voiceAvailable,
  };

  return { state, play, pause, next, prev, replay, describeScene, jumpTo, stop, total };
}

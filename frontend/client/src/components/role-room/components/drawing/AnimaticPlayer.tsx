// @ts-nocheck
/**
 * AnimaticPlayer — spiller storyboard-frames i sekvens basert på
 * `frame.duration`. Lar artisten teste pacing uten å produsere video.
 *
 * Funksjoner (MVP-runde 1):
 *   - Play / pause / restart
 *   - Scrubber (slider) for å hoppe i tidslinjen
 *   - Tids- og frame-teller
 *   - Hastighetsvelger (0.5x, 1x, 2x)
 *   - Loop-toggle
 *
 * Audio og dialog-sync kommer i runde 2.
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Slider,
  ToggleButton,
  Tooltip,
  Select,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Replay,
  Loop,
  Movie,
  MicNone,
  Close as CloseIcon,
  FiberManualRecord,
  Stop as StopIcon,
  Download as DownloadIcon,
  Fullscreen,
  FullscreenExit,
  GraphicEq,
  UploadFile,
  VolumeUp,
  VolumeOff,
  AutoAwesome,
  PlayCircleOutline,
  Psychology,
} from '@mui/icons-material';
import { useAnimaticPlayback } from './useAnimaticPlayback';
import { useAnimaticAudio } from './useAnimaticAudio';
import { useAnimaticRecorder } from './useAnimaticRecorder';
import {
  saveScratchTrack,
  loadScratchTrack,
  deleteScratchTrack,
  saveFrameVoiceover,
  loadFrameVoiceovers,
  deleteFrameVoiceover,
  saveSfxClipBlob,
  saveSfxClipReference,
  loadSfxClips,
  deleteSfxClip,
} from './animaticAudioStore';
import {
  createRecordingAudioGraph,
  fadeInRecording,
  fadeOutRecording,
  type RecordingAudioGraph,
} from './recordingAudioGraph';
import { detectSequenceSfx, groupEventsByFrame, type SfxEvent } from './sfxDetector';
import { scheduleSfx } from './sfxScheduler';
import { useSfxPlayback } from './useSfxPlayback';
import { matchSfx, generateSfx, type SfxMatchHit } from '../../services/sfxMatchClient';
import {
  AnimaticStageCanvas,
  STAGE_CANVAS_WIDTH as STAGE_W,
  STAGE_CANVAS_HEIGHT as STAGE_H,
} from './AnimaticStageCanvas';
import { AnimaticVoiceoverStrip } from './AnimaticVoiceoverStrip';
import { AnimaticSfxPanel } from './AnimaticSfxPanel';
import { AnimaticTransportBar } from './AnimaticTransportBar';

export interface AnimaticFrameMeta {
  id: string;
  duration?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  shotNumber?: string;
  description?: string;
  /** Manus-linjer som hører til dette framet (vises som caption under
   *  stagen). Brukes for pacing-test av dialog. */
  caption?: string;
  /** Per-frame voiceover (objektURL eller data-URL). Spilles av når
   *  framet er aktivt under playback. */
  voiceoverUrl?: string;
}

export interface AnimaticPlayerProps {
  frames: AnimaticFrameMeta[];
  /** Standard sett av hastigheter. */
  speeds?: number[];
  /** Aspect ratio for stage-området (default 16:9). */
  aspectRatio?: number;
  compact?: boolean;
  /** Kalles når aktiv frame endrer seg (for sync med annen UI). */
  onActiveFrameChange?: (frameId: string, index: number) => void;
  /** Sekunder med cross-fade mellom frames. 0 = hard cut. Default 0.3. */
  transitionDuration?: number;
  /** Hvis satt: scratch-track persisteres i IndexedDB per scene. */
  sceneId?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STAGE_CANVAS_WIDTH = STAGE_W;
const STAGE_CANVAS_HEIGHT = STAGE_H;

export const AnimaticPlayer: React.FC<AnimaticPlayerProps> = ({
  frames,
  speeds = [0.5, 1, 1.5, 2],
  aspectRatio = 16 / 9,
  compact = false,
  onActiveFrameChange,
  transitionDuration = 0.3,
  sceneId,
}) => {
  const [speed, setSpeed] = React.useState(1);
  const [loop, setLoop] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioName, setAudioName] = React.useState<string | null>(null);
  const [audioElement, setAudioElement] = React.useState<HTMLAudioElement | null>(null);
  // Per-frame voiceover: ett delt audio-element som bytter src ved
  // frame-skift. Sources holdes i en map basert på frameId så vi kan
  // lookupe url'en raskt under playback.
  const [voiceoverElement, setVoiceoverElement] = React.useState<HTMLAudioElement | null>(null);
  const [voiceoverUrls, setVoiceoverUrls] = React.useState<Record<string, string>>({});
  const voiceoverFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const voiceoverTargetFrameRef = React.useRef<string | null>(null);
  // SFX: bruker-leverte audio-clips per event-id (eventId → objectURL).
  const [sfxClipUrls, setSfxClipUrls] = React.useState<Record<string, string>>({});
  const sfxFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const sfxTargetEventRef = React.useRef<string | null>(null);
  const [sfxEnabled, setSfxEnabled] = React.useState(true);
  // Bruker kan også fjerne en auto-detektert event (skjul den).
  const [hiddenSfxEventIds, setHiddenSfxEventIds] = React.useState<Set<string>>(new Set());
  // Forslag fra CLAP-match per event-id.
  const [sfxSuggestions, setSfxSuggestions] = React.useState<Record<string, {
    loading: boolean;
    error?: string;
    hits?: SfxMatchHit[];
  }>>({});
  // AI-generering status per event-id.
  const [sfxGenerating, setSfxGenerating] = React.useState<Record<string, {
    loading: boolean;
    error?: string;
  }>>({});
  // Preview-audio for forslag (lazy laget per suggestion-url).
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = React.useRef<HTMLDivElement | null>(null);
  const playerRootRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [recordingElapsed, setRecordingElapsed] = React.useState(0);
  const recordingStartRef = React.useRef<number | null>(null);
  // Web Audio-graf bygges når opptak starter, rives ned når det stopper.
  const audioGraphRef = React.useRef<RecordingAudioGraph | null>(null);
  const [audioStreamOverride, setAudioStreamOverride] = React.useState<MediaStream | null>(null);

  const handleActiveFrameChange = React.useCallback(
    (segment) => {
      onActiveFrameChange?.(segment.frameId, segment.frameIndex);
    },
    [onActiveFrameChange],
  );

  const player = useAnimaticPlayback({
    frames,
    playbackSpeed: speed,
    loop,
    onActiveFrameChange: handleActiveFrameChange,
  });

  // Synk scene-level scratch-track med playback-state.
  useAnimaticAudio({
    audioElement,
    isPlaying: player.isPlaying,
    currentTime: player.currentTime,
    playbackSpeed: speed,
  });

  // Resolved voiceover-URL for et frame: prop-verdi vinner over
  // user-uploaded (i tilfelle caller setter den eksplisitt).
  const resolveVoiceoverUrl = React.useCallback((frame: AnimaticFrameMeta): string | undefined => {
    return frame.voiceoverUrl || voiceoverUrls[frame.id];
  }, [voiceoverUrls]);

  // Per-frame voiceover-sync: bytt src og spill når aktivt frame
  // skifter til et som har voiceover. Pauser ellers.
  React.useEffect(() => {
    if (!voiceoverElement) return;
    const active = player.activeFrameIndex >= 0 ? frames[player.activeFrameIndex] : null;
    const vUrl = active ? resolveVoiceoverUrl(active) : undefined;
    if (vUrl && voiceoverElement.src !== vUrl) {
      voiceoverElement.src = vUrl;
      voiceoverElement.currentTime = 0;
    }
    if (vUrl && player.isPlaying) {
      const result = voiceoverElement.play();
      if (result && typeof result.then === 'function') result.catch(() => {});
    } else {
      voiceoverElement.pause();
    }
  }, [voiceoverElement, player.activeFrameIndex, player.isPlaying, frames, resolveVoiceoverUrl]);

  // Voiceover-hastighet skal følge playback-fart.
  React.useEffect(() => {
    if (!voiceoverElement) return;
    voiceoverElement.playbackRate = speed;
  }, [voiceoverElement, speed]);

  // Auto-detekter SFX-events fra frame-tekst (description + caption).
  const detectedSfxEvents = React.useMemo<SfxEvent[]>(() => {
    if (!sfxEnabled) return [];
    return detectSequenceSfx(
      frames.map((f) => ({
        id: f.id,
        description: f.description,
        caption: f.caption,
      })),
    );
  }, [frames, sfxEnabled]);

  // Filtrer bort skjulte events.
  const visibleSfxEvents = React.useMemo(
    () => detectedSfxEvents.filter((e) => !hiddenSfxEventIds.has(e.id)),
    [detectedSfxEvents, hiddenSfxEventIds],
  );

  // Schedule til absolutt tid.
  const scheduledSfx = React.useMemo(
    () => scheduleSfx(visibleSfxEvents, player.timeline),
    [visibleSfxEvents, player.timeline],
  );

  // Spill av SFX i takt med timeline (auto-miks).
  const sfxPlayback = useSfxPlayback({
    scheduled: scheduledSfx,
    clipUrls: sfxClipUrls,
    isPlaying: player.isPlaying,
    currentTime: player.currentTime,
    playbackSpeed: speed,
  });

  const sfxByFrame = React.useMemo(
    () => groupEventsByFrame(visibleSfxEvents),
    [visibleSfxEvents],
  );

  // Opptak-controller — kobler canvas (video) + audio (valgfritt) til
  // en MediaRecorder som dumper til WebM. Hvis vi har en Web Audio-
  // graf for fade, brukes dens stream som override.
  const recorder = useAnimaticRecorder({
    canvas: canvasRef.current,
    audioElement,
    audioStreamOverride,
  });

  // Når opptak er aktivt og playback når slutt: stopp opptaket.
  // Vi spotter dette via player.isPlaying som blir false ved slutt.
  const wasRecordingRef = React.useRef(false);
  React.useEffect(() => {
    if (recorder.state === 'recording' && !player.isPlaying && wasRecordingRef.current) {
      recorder.stop();
    }
    wasRecordingRef.current = recorder.state === 'recording';
  }, [recorder, player.isPlaying]);

  // Tell opptak-tid i sanntid mens recorder er aktiv.
  React.useEffect(() => {
    if (recorder.state !== 'recording') {
      recordingStartRef.current = null;
      setRecordingElapsed(0);
      return;
    }
    recordingStartRef.current = performance.now();
    const interval = setInterval(() => {
      if (recordingStartRef.current === null) return;
      setRecordingElapsed((performance.now() - recordingStartRef.current) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [recorder.state]);

  const handleRecord = React.useCallback(() => {
    if (recorder.state === 'recording') {
      const graph = audioGraphRef.current;
      if (graph) {
        fadeOutRecording(graph, () => {
          recorder.stop();
          player.pause();
          graph.cleanup();
          audioGraphRef.current = null;
          setAudioStreamOverride(null);
        });
      } else {
        recorder.stop();
        player.pause();
      }
      return;
    }

    // Bygg Web Audio-graf med alle aktive audio-kilder (scene-track
    // + per-frame voiceover + SFX-clips) for miksing under opptak + fade.
    let pendingStream: MediaStream | null = null;
    const elementsForRecording: HTMLAudioElement[] = [];
    if (audioElement) elementsForRecording.push(audioElement);
    if (voiceoverElement && Object.keys(voiceoverUrls).length > 0) {
      elementsForRecording.push(voiceoverElement);
    }
    // SFX-elementer: hver event med last opp clip har sin egen <audio>
    // via useSfxPlayback. Vi inkluderer dem i grafen.
    for (const el of sfxPlayback.audioElements) {
      if (el) elementsForRecording.push(el);
    }
    if (elementsForRecording.length > 0) {
      const graph = createRecordingAudioGraph(elementsForRecording);
      if (graph) {
        audioGraphRef.current = graph;
        pendingStream = graph.recordingStream;
        setAudioStreamOverride(graph.recordingStream);
        fadeInRecording(graph);
      }
    }

    // Vi må vente på neste render så useAnimaticRecorder ser
    // audioStreamOverride før start(). Workaround: liten timeout.
    player.seek(0);
    setTimeout(() => {
      const started = recorder.start();
      if (started) {
        setTimeout(() => player.play(), 50);
      } else if (audioGraphRef.current) {
        audioGraphRef.current.cleanup();
        audioGraphRef.current = null;
        setAudioStreamOverride(null);
      }
    }, pendingStream ? 30 : 0);
  }, [recorder, player, audioElement, voiceoverElement, voiceoverUrls, sfxPlayback.audioElements]);

  // Auto-fade-out + cleanup når opptaket avsluttes via naturlig
  // playback-slutt (recorder.stop() trigget av effect over).
  React.useEffect(() => {
    if (recorder.state === 'idle' && audioGraphRef.current) {
      // Hadde ikke fade-out fra handleRecord — gjør oppryddingen nå.
      audioGraphRef.current.cleanup();
      audioGraphRef.current = null;
      setAudioStreamOverride(null);
    }
  }, [recorder.state]);

  // Keyboard shortcuts: Space=toggle, ←/→=frame-nav, R=record. Aktive
  // bare når player-root har fokus (eller fullscreen), så vi ikke
  // hijacker tastatur når brukeren skriver et annet sted i appen.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Hopp over når et input-element har fokus.
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      // Krev at fokus er på player-root eller fullscreen-stage.
      const root = playerRootRef.current;
      const isOurFocus =
        root && (root.contains(event.target as Node) || document.activeElement === document.body);
      if (!isOurFocus && !isFullscreen) return;

      if (event.code === 'Space') {
        event.preventDefault();
        player.toggle();
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        const next = Math.min(frames.length - 1, player.activeFrameIndex + 1);
        if (next !== player.activeFrameIndex) player.seekToFrame(next);
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        const prev = Math.max(0, player.activeFrameIndex - 1);
        if (prev !== player.activeFrameIndex) player.seekToFrame(prev);
      } else if (event.code === 'KeyR' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        if (recorder.isSupported) handleRecord();
      } else if (event.code === 'KeyF' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player, frames.length, recorder.isSupported, handleRecord, isFullscreen, toggleFullscreen]);

  const handleAudioPick = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) return;
    // Revoker forrige object-URL hvis den finnes — vi vil ikke lekke.
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name);
    // Persistens i IndexedDB om sceneId er satt — fire and forget.
    if (sceneId) {
      saveScratchTrack(sceneId, file).catch(() => {});
    }
  }, [audioUrl, sceneId]);

  const clearAudio = React.useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioName(null);
    setAudioElement(null);
    if (sceneId) {
      deleteScratchTrack(sceneId).catch(() => {});
    }
  }, [audioUrl, sceneId]);

  // Last persistert scratch-track ved scene-bytte.
  React.useEffect(() => {
    if (!sceneId) return;
    let cancelled = false;
    loadScratchTrack(sceneId).then((stored) => {
      if (cancelled || !stored) return;
      const url = URL.createObjectURL(stored.blob);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setAudioName(stored.fileName);
    });
    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  // Last alle persisterte per-frame voiceovers ved scene-bytte.
  React.useEffect(() => {
    if (!sceneId) return;
    let cancelled = false;
    loadFrameVoiceovers(sceneId).then((stored) => {
      if (cancelled || Object.keys(stored).length === 0) return;
      setVoiceoverUrls((prev) => {
        // Revoke alle eksisterende blob-URLs for å unngå lekkasje.
        Object.values(prev).forEach((url) => {
          try { URL.revokeObjectURL(url); } catch {}
        });
        const next: Record<string, string> = {};
        for (const [frameId, record] of Object.entries(stored)) {
          next[frameId] = URL.createObjectURL(record.blob);
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  // Last alle persisterte SFX-clips ved scene-bytte. Blob-clips lages
  // som object-URL; URL-referanser (CLAP/AI) brukes direkte.
  React.useEffect(() => {
    if (!sceneId) return;
    let cancelled = false;
    loadSfxClips(sceneId).then((stored) => {
      if (cancelled || Object.keys(stored).length === 0) return;
      setSfxClipUrls((prev) => {
        // Revoke alle eksisterende blob-URLs.
        Object.values(prev).forEach((url) => {
          if (url.startsWith('blob:')) {
            try { URL.revokeObjectURL(url); } catch {}
          }
        });
        const next: Record<string, string> = {};
        for (const [eventId, record] of Object.entries(stored)) {
          if (record.kind === 'blob' && record.blob) {
            next[eventId] = URL.createObjectURL(record.blob);
          } else if (record.kind === 'url' && record.url) {
            next[eventId] = record.url;
          }
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  // Cleanup object-URL ved unmount.
  React.useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  // Per-frame voiceover: trigger file-picker for et bestemt frame.
  const openVoiceoverPickerForFrame = React.useCallback((frameId: string) => {
    voiceoverTargetFrameRef.current = frameId;
    voiceoverFileInputRef.current?.click();
  }, []);

  const handleVoiceoverPick = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const frameId = voiceoverTargetFrameRef.current;
    voiceoverTargetFrameRef.current = null;
    if (!file || !frameId) return;
    if (!file.type.startsWith('audio/')) return;
    setVoiceoverUrls((prev) => {
      // Revoke forrige om den var bruker-uploadet.
      if (prev[frameId]) URL.revokeObjectURL(prev[frameId]);
      return { ...prev, [frameId]: URL.createObjectURL(file) };
    });
    // Persistens — fire-and-forget. Kun hvis sceneId er satt.
    if (sceneId) {
      saveFrameVoiceover(sceneId, frameId, file).catch(() => {});
    }
  }, [sceneId]);

  const clearVoiceoverForFrame = React.useCallback((frameId: string) => {
    setVoiceoverUrls((prev) => {
      if (!prev[frameId]) return prev;
      URL.revokeObjectURL(prev[frameId]);
      const next = { ...prev };
      delete next[frameId];
      return next;
    });
    if (sceneId) {
      deleteFrameVoiceover(sceneId, frameId).catch(() => {});
    }
  }, [sceneId]);

  // Cleanup ALLE per-frame voiceover-URLs ved unmount.
  React.useEffect(() => () => {
    Object.values(voiceoverUrls).forEach((url) => {
      try { URL.revokeObjectURL(url); } catch {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bygg en engelsk prompt fra event-metadata. CLAP er trent på engelsk,
  // og kategori-ID-ene våre er allerede kebab-case-engelsk.
  const buildSfxPrompt = React.useCallback((ev: SfxEvent): string => {
    const base = ev.category.id.replace(/-/g, ' ');
    const intensity =
      ev.intensity === 'high' ? 'loud' :
      ev.intensity === 'low' ? 'soft, distant' :
      '';
    return intensity ? `sound of ${base}, ${intensity}` : `sound of ${base}`;
  }, []);

  const suggestSfxForEvent = React.useCallback(async (ev: SfxEvent) => {
    setSfxSuggestions((prev) => ({
      ...prev,
      [ev.id]: { loading: true },
    }));
    try {
      const prompt = buildSfxPrompt(ev);
      const result = await matchSfx({
        prompt,
        topK: 3,
        categoryId: ev.categoryId,
      });
      setSfxSuggestions((prev) => ({
        ...prev,
        [ev.id]: {
          loading: false,
          hits: result.matches,
          error: result.warning === 'library_empty' ? 'Sample-bibliotek er tomt. Bygg det først (se README).' : undefined,
        },
      }));
    } catch (err: any) {
      setSfxSuggestions((prev) => ({
        ...prev,
        [ev.id]: {
          loading: false,
          error: err?.message ?? 'Kunne ikke hente forslag',
        },
      }));
    }
  }, [buildSfxPrompt]);

  const playPreview = React.useCallback((url: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.volume = 0.7;
    previewAudioRef.current = audio;
    audio.play().catch(() => {});
  }, []);

  const useSuggestion = React.useCallback((eventId: string, hit: SfxMatchHit) => {
    setSfxClipUrls((prev) => {
      // Hvis det allerede er en bruker-uploadet URL: revoke og erstatt.
      if (prev[eventId] && prev[eventId].startsWith('blob:')) {
        URL.revokeObjectURL(prev[eventId]);
      }
      return { ...prev, [eventId]: hit.url };
    });
    // Lukk suggestion-listen for dette eventet.
    setSfxSuggestions((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    // Persistens: lagre URL-referansen + label.
    if (sceneId) {
      saveSfxClipReference(sceneId, eventId, hit.url, `CLAP: ${hit.title}`).catch(() => {});
    }
  }, [sceneId]);

  // Cleanup preview-audio ved unmount.
  React.useEffect(() => () => {
    if (previewAudioRef.current) {
      try { previewAudioRef.current.pause(); } catch {}
    }
  }, []);

  // Generer via ElevenLabs som fallback når CLAP-match ikke har gode treff.
  const generateSfxForEvent = React.useCallback(async (ev: SfxEvent) => {
    setSfxGenerating((prev) => ({ ...prev, [ev.id]: { loading: true } }));
    try {
      const prompt = buildSfxPrompt(ev);
      // Default-varighet basert på layer: event=2s, ambient=8s, music=8s.
      const durationSec =
        ev.layer === 'event' ? 2 :
        ev.layer === 'ambient' ? 8 :
        8;
      const result = await generateSfx({ prompt, durationSec });
      setSfxClipUrls((prev) => {
        if (prev[ev.id] && prev[ev.id].startsWith('blob:')) {
          URL.revokeObjectURL(prev[ev.id]);
        }
        return { ...prev, [ev.id]: result.url };
      });
      setSfxGenerating((prev) => {
        const next = { ...prev };
        delete next[ev.id];
        return next;
      });
      // Persistens: lagre AI-URL'en som referanse.
      if (sceneId) {
        saveSfxClipReference(sceneId, ev.id, result.url, `AI: ${ev.category.label}`).catch(() => {});
      }
    } catch (err: any) {
      setSfxGenerating((prev) => ({
        ...prev,
        [ev.id]: {
          loading: false,
          error: err?.message ?? 'Generering feilet',
        },
      }));
    }
  }, [buildSfxPrompt, sceneId]);

  // SFX-upload-handlers.
  const openSfxPickerForEvent = React.useCallback((eventId: string) => {
    sfxTargetEventRef.current = eventId;
    sfxFileInputRef.current?.click();
  }, []);

  const handleSfxPick = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const eventId = sfxTargetEventRef.current;
    sfxTargetEventRef.current = null;
    if (!file || !eventId) return;
    if (!file.type.startsWith('audio/')) return;
    setSfxClipUrls((prev) => {
      if (prev[eventId] && prev[eventId].startsWith('blob:')) {
        URL.revokeObjectURL(prev[eventId]);
      }
      return { ...prev, [eventId]: URL.createObjectURL(file) };
    });
    if (sceneId) {
      saveSfxClipBlob(sceneId, eventId, file).catch(() => {});
    }
  }, [sceneId]);

  const clearSfxClip = React.useCallback((eventId: string) => {
    setSfxClipUrls((prev) => {
      if (!prev[eventId]) return prev;
      // Kun revoke hvis det er en blob-URL — server-URL-er (CLAP/AI)
      // skal ikke revokes.
      if (prev[eventId].startsWith('blob:')) {
        URL.revokeObjectURL(prev[eventId]);
      }
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    if (sceneId) {
      deleteSfxClip(sceneId, eventId).catch(() => {});
    }
  }, [sceneId]);

  const hideSfxEvent = React.useCallback((eventId: string) => {
    setHiddenSfxEventIds((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });
    clearSfxClip(eventId);
  }, [clearSfxClip]);

  // Cleanup ALLE SFX-URLs ved unmount.
  React.useEffect(() => () => {
    Object.values(sfxClipUrls).forEach((url) => {
      try { URL.revokeObjectURL(url); } catch {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFrame = player.activeFrameIndex >= 0 ? frames[player.activeFrameIndex] : null;
  const hasFrames = frames.length > 0 && player.totalDuration > 0;

  // Preload bilder for de neste 2 frames så switch ikke flimrer.
  React.useEffect(() => {
    if (!hasFrames || player.activeFrameIndex < 0) return;
    const upcoming = [1, 2]
      .map((offset) => frames[player.activeFrameIndex + offset])
      .filter((f) => f && (f.imageUrl || f.thumbnailUrl));
    const preloaders: HTMLImageElement[] = [];
    for (const f of upcoming) {
      const img = new Image();
      img.src = (f.imageUrl || f.thumbnailUrl) as string;
      preloaders.push(img);
    }
    return () => {
      // GC tar seg av img-objektene; bare slipp referansene.
      preloaders.length = 0;
    };
  }, [frames, player.activeFrameIndex, hasFrames]);

  // Fullscreen: lytt på endringer i browser-state.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === stageContainerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = React.useCallback(async () => {
    if (typeof document === 'undefined') return;
    const el = stageContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    } else {
      try { await el.requestFullscreen(); } catch {}
    }
  }, []);

  // Stage-canvas-rendering + cross-fade er eksternalisert til
  // AnimaticStageCanvas. canvasRef forwardes så MediaRecorder kan
  // capture-streame den.

  if (!hasFrames) {
    return (
      <Box
        data-testid="animatic-player-empty"
        sx={{
          p: compact ? 1 : 1.5,
          borderRadius: 1.5,
          bgcolor: 'rgba(15,15,25,0.92)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Movie sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Legg til frames med varighet for å spille animatic.
          </Typography>
        </Stack>
      </Box>
    );
  }

  const stageMaxWidth = compact ? 280 : 420;

  return (
    <Box
      data-testid="animatic-player"
      ref={playerRootRef}
      tabIndex={0}
      sx={{
        p: compact ? 1 : 1.5,
        borderRadius: 1.5,
        bgcolor: 'rgba(15,15,25,0.92)',
        border: '1px solid rgba(255,255,255,0.06)',
        outline: 'none',
        '&:focus-visible': { boxShadow: '0 0 0 2px rgba(165,180,252,0.4)' },
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <Movie sx={{ fontSize: 14, color: '#a5b4fc' }} />
        <Typography variant="overline" sx={{ fontSize: 10, letterSpacing: '0.08em', color: '#a5b4fc', fontWeight: 800 }}>
          Animatic-avspilling
        </Typography>
        {recorder.state === 'recording' && (
          <Stack direction="row" spacing={0.25} alignItems="center" sx={{ ml: 0.5 }} data-testid="animatic-rec-badge">
            <FiberManualRecord sx={{ fontSize: 10, color: '#f87171', animation: 'pulse 1.2s ease-in-out infinite' }} />
            <Typography variant="caption" sx={{ color: '#fca5a5', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}>
              REC {formatTime(recordingElapsed)} / {formatTime(player.totalDuration)}
            </Typography>
          </Stack>
        )}
        <Box sx={{ flex: 1 }} />
        {audioName && (
          <Stack direction="row" spacing={0.25} alignItems="center">
            <MicNone sx={{ fontSize: 12, color: '#86efac' }} />
            <Typography variant="caption" sx={{ color: '#86efac', fontSize: 10, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {audioName}
            </Typography>
            <Tooltip title="Fjern lyd">
              <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)', p: 0.25 }} onClick={clearAudio} data-testid="animatic-audio-clear">
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, ml: audioName ? 1 : 0 }}>
          Frame {player.activeFrameIndex + 1} / {frames.length}
        </Typography>
      </Stack>

      <AnimaticStageCanvas
        ref={canvasRef}
        frames={frames}
        activeFrameIndex={player.activeFrameIndex}
        currentTime={player.currentTime}
        timelineSegments={player.timeline.segments}
        transitionDuration={transitionDuration}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        aspectRatio={aspectRatio}
        stageMaxWidth={stageMaxWidth}
        onContainerRef={(el) => { stageContainerRef.current = el; }}
        onTap={player.toggle}
        onSwipeLeft={() => {
          const next = Math.min(frames.length - 1, player.activeFrameIndex + 1);
          if (next !== player.activeFrameIndex) player.seekToFrame(next);
        }}
        onSwipeRight={() => {
          const prev = Math.max(0, player.activeFrameIndex - 1);
          if (prev !== player.activeFrameIndex) player.seekToFrame(prev);
        }}
      />

      {/* Dialog-caption for aktivt frame — viser manuslinje(r) så
          artisten ser om dialog matcher visuelt tempo. */}
      {activeFrame?.caption && (
        <Box
          data-testid="animatic-caption"
          sx={{
            maxWidth: isFullscreen ? '70%' : stageMaxWidth,
            mx: 'auto',
            mb: 0.75,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(165,180,252,0.2)',
            textAlign: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.92)',
              fontSize: isFullscreen ? 14 : 11,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {activeFrame.caption}
          </Typography>
        </Box>
      )}

      <AnimaticVoiceoverStrip
        frames={frames}
        activeFrameIndex={player.activeFrameIndex}
        voiceoverUrls={voiceoverUrls}
        hasVoiceover={(f) => !!resolveVoiceoverUrl(f as AnimaticFrameMeta)}
        isFullscreen={isFullscreen}
        stageMaxWidth={stageMaxWidth}
        onPick={openVoiceoverPickerForFrame}
        onClear={clearVoiceoverForFrame}
      />

      <AnimaticSfxPanel
        events={activeFrame ? (sfxByFrame.get(activeFrame.id) ?? []) : []}
        sfxClipUrls={sfxClipUrls}
        sfxSuggestions={sfxSuggestions}
        sfxGenerating={sfxGenerating}
        activeEventIds={sfxPlayback.activeIds}
        sfxEnabled={sfxEnabled}
        onToggleSfxEnabled={() => setSfxEnabled((v) => !v)}
        onSuggest={suggestSfxForEvent}
        onGenerate={generateSfxForEvent}
        onUpload={openSfxPickerForEvent}
        onClearClip={clearSfxClip}
        onHideEvent={hideSfxEvent}
        onPreviewHit={playPreview}
        onUseHit={useSuggestion}
        isFullscreen={isFullscreen}
        stageMaxWidth={stageMaxWidth}
      />
      <input
        ref={sfxFileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleSfxPick}
        style={{ display: 'none' }}
        data-testid="animatic-sfx-input"
      />

      {/* Scrubber med frame-grenser som marker */}
      <Box sx={{ px: 1, mb: 0.5 }}>
        <Slider
          size="small"
          min={0}
          max={player.totalDuration}
          step={0.05}
          value={player.currentTime}
          onChange={(_, value) => player.seek(Array.isArray(value) ? value[0] : value)}
          marks={
            // Marks for hver frame-grense (utelater 0 og slutten for å unngå
            // dobbel-rendring med slider-endene).
            player.timeline.segments.slice(1).map((s) => ({ value: s.start }))
          }
          sx={{
            color: '#a5b4fc',
            '& .MuiSlider-mark': {
              height: 8,
              width: 1.5,
              bgcolor: 'rgba(255,255,255,0.35)',
            },
            '& .MuiSlider-markActive': {
              bgcolor: 'rgba(165,180,252,0.7)',
            },
          }}
          data-testid="animatic-scrubber"
        />
      </Box>

      <AnimaticTransportBar
        isPlaying={player.isPlaying}
        onTogglePlay={player.toggle}
        onSeekToStart={() => player.seek(0)}
        loop={loop}
        onToggleLoop={() => setLoop((l) => !l)}
        audioUrl={audioUrl}
        onOpenAudioPicker={() => audioFileInputRef.current?.click()}
        recorderState={recorder.state}
        recorderIsSupported={recorder.isSupported}
        recorderHasLastBlob={!!recorder.lastBlob}
        onRecord={handleRecord}
        onDownloadLastBlob={() => recorder.downloadLastBlob()}
        currentTime={player.currentTime}
        totalDuration={player.totalDuration}
        speed={speed}
        speeds={speeds}
        onSpeedChange={setSpeed}
      >
        {/* Hidden audio-elementer og file-inputs — refs eies av
            AnimaticPlayer så Web Audio-grafen kan kobles til dem. */}
        <input
          ref={audioFileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleAudioPick}
          style={{ display: 'none' }}
          data-testid="animatic-audio-input"
        />
        <input
          ref={voiceoverFileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleVoiceoverPick}
          style={{ display: 'none' }}
          data-testid="animatic-voiceover-input"
        />
        {audioUrl && (
          <audio
            ref={setAudioElement}
            src={audioUrl}
            preload="auto"
            style={{ display: 'none' }}
            data-testid="animatic-audio-element"
          />
        )}
        {Object.keys(voiceoverUrls).length > 0 && (
          <audio
            ref={setVoiceoverElement}
            preload="auto"
            style={{ display: 'none' }}
            data-testid="animatic-voiceover-element"
          />
        )}
      </AnimaticTransportBar>
    </Box>
  );
};

export default AnimaticPlayer;

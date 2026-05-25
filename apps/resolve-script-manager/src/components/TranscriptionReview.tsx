import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, executeScript } from "../api";
import { IconPlay } from "./Icons";

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface TranscriptionResult {
  audioPath: string;
  model?: string;
  language?: string;
  durationSeconds: number;
  diarizationEnabled?: boolean;
  segmentCount: number;
  segments: TranscriptionSegment[];
}

interface Props {
  result: TranscriptionResult;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEAKER_COLORS = ["#ff6f3c", "#4ea7e8", "#4caf50", "#f0a500", "#b965d6"];

function speakerColor(speaker: string | null | undefined, allSpeakers: string[]): string | undefined {
  if (!speaker) return undefined;
  const idx = allSpeakers.indexOf(speaker);
  return idx >= 0 ? SPEAKER_COLORS[idx % SPEAKER_COLORS.length] : undefined;
}

export function TranscriptionReview({ result }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [addingMarkers, setAddingMarkers] = useState(false);
  const [markerStatus, setMarkerStatus] = useState<string | null>(null);

  const speakers = useMemo(() => {
    const set = new Set<string>();
    result.segments.forEach((s) => {
      if (s.speaker) set.add(s.speaker);
    });
    return Array.from(set);
  }, [result.segments]);

  const visible = useMemo(() => {
    if (!query.trim()) return result.segments.map((s, i) => ({ seg: s, idx: i }));
    const needle = query.toLowerCase();
    return result.segments
      .map((seg, idx) => ({ seg, idx }))
      .filter(({ seg }) => seg.text.toLowerCase().includes(needle));
  }, [result.segments, query]);

  const sourceUrl = convertFileSrc(result.audioPath);

  useEffect(() => {
    const audio = new Audio(sourceUrl);
    audio.preload = "metadata";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    };
  }, [sourceUrl]);

  const playSegment = useCallback((seg: TranscriptionSegment, idx: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    audio.currentTime = seg.start;
    audio
      .play()
      .then(() => {
        setPlayingIdx(idx);
        stopTimerRef.current = window.setTimeout(() => {
          audio.pause();
          setPlayingIdx(null);
        }, (seg.end - seg.start) * 1000);
      })
      .catch(() => {});
  }, []);

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause();
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setPlayingIdx(null);
  }, []);

  const addMarkers = useCallback(async () => {
    setAddingMarkers(true);
    setMarkerStatus(null);
    try {
      const toAdd = visible.map(({ seg }) => seg);
      if (toAdd.length === 0) {
        setMarkerStatus("Ingen segmenter å legge til.");
        return;
      }
      const summary = await executeScript(
        "add_transcription_markers",
        { segments: toAdd },
        false,
      );
      const r = summary.events.find((e) => e.type === "result")?.value as
        | { markersAdded: number; markersSkipped: number; timelineName: string }
        | undefined;
      if (r) {
        setMarkerStatus(
          `Lagt til ${r.markersAdded} marker${r.markersAdded === 1 ? "" : "s"} på "${r.timelineName}"${
            r.markersSkipped > 0 ? ` (${r.markersSkipped} hoppet over)` : ""
          }`,
        );
      } else {
        setMarkerStatus("Markers-script returnerte ikke noe resultat.");
      }
    } catch (e) {
      setMarkerStatus(`Feil: ${String(e)}`);
    } finally {
      setAddingMarkers(false);
    }
  }, [visible]);

  return (
    <div className="transcription-review">
      <div className="transcription-meta">
        <span className="chip ready">{result.segmentCount} segmenter</span>
        <span className="card-chip-meta">
          Språk: {result.language ?? "?"} · Modell: {result.model ?? "?"} · {Math.round(result.durationSeconds)}s
        </span>
        {speakers.length > 1 && (
          <span className="card-chip-meta">{speakers.length} talere detektert</span>
        )}
      </div>
      <div className="transcription-actions">
        <input
          type="text"
          className="transcription-search"
          placeholder="Søk i transkripsjonen…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="small primary"
          onClick={addMarkers}
          disabled={addingMarkers || visible.length === 0}
          title={`Legg ${visible.length} markers på aktiv Resolve-timeline`}
        >
          {addingMarkers ? "Adding…" : <><IconPlay /> Add {visible.length} markers in Resolve</>}
        </button>
      </div>
      {markerStatus && (
        <div className="card-chip-meta" style={{ marginTop: 4 }}>{markerStatus}</div>
      )}
      <div className="transcription-segments">
        {visible.length === 0 ? (
          <div className="empty">Ingen treff på "{query}".</div>
        ) : (
          visible.map(({ seg, idx }) => {
            const isPlaying = playingIdx === idx;
            const color = speakerColor(seg.speaker, speakers);
            return (
              <div key={idx} className={`transcription-segment ${isPlaying ? "playing" : ""}`}>
                <div className="transcription-segment-meta">
                  <span className="transcription-time">{formatTime(seg.start)}</span>
                  {seg.speaker && (
                    <span className="transcription-speaker" style={color ? { background: color } : undefined}>
                      {seg.speaker}
                    </span>
                  )}
                  <button
                    className="small"
                    onClick={() => (isPlaying ? stopPlayback() : playSegment(seg, idx))}
                  >
                    {isPlaying ? "Stop" : <IconPlay />}
                  </button>
                </div>
                <div className="transcription-text">{seg.text}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "../api";
import { IconMusic, IconPlay, IconStar } from "./Icons";

export interface RetakeTake {
  takeId: string;
  startSeconds: number;
  endSeconds: number;
  isHeroSuggestion?: boolean;
}

export interface RetakeGroup {
  groupId: string;
  contentDurationSeconds: number;
  takeCount: number;
  audioConfidence: number;
  takes: RetakeTake[];
}

export interface RetakeResult {
  audioPath: string;
  totalDurationSeconds: number;
  windowCount: number;
  takeGroups: RetakeGroup[];
}

interface Props {
  result: RetakeResult;
  onPickHero: (groupId: string, takeId: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RetakeReview({ result, onPickHero }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);
  const [heroByGroup, setHeroByGroup] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    result.takeGroups.forEach((g) => {
      const hero = g.takes.find((t) => t.isHeroSuggestion) ?? g.takes[g.takes.length - 1];
      if (hero) initial[g.groupId] = hero.takeId;
    });
    return initial;
  });
  const [currentPosition, setCurrentPosition] = useState(0);

  const sourceUrl = convertFileSrc(result.audioPath);

  // Initialise audio element
  useEffect(() => {
    const audio = new Audio(sourceUrl);
    audio.preload = "metadata";
    audioRef.current = audio;
    const onTimeUpdate = () => setCurrentPosition(audio.currentTime);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audioRef.current = null;
      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
      }
    };
  }, [sourceUrl]);

  const playTake = useCallback(
    (take: RetakeTake) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
      }
      audio.currentTime = take.startSeconds;
      const ms = (take.endSeconds - take.startSeconds) * 1000;
      audio
        .play()
        .then(() => {
          setPlayingTakeId(take.takeId);
          stopTimerRef.current = window.setTimeout(() => {
            audio.pause();
            setPlayingTakeId(null);
          }, ms);
        })
        .catch((err) => {
          console.warn("Audio play failed:", err);
        });
    },
    [],
  );

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setPlayingTakeId(null);
  }, []);

  const pickHero = useCallback(
    (groupId: string, takeId: string) => {
      setHeroByGroup((prev) => ({ ...prev, [groupId]: takeId }));
      onPickHero(groupId, takeId);
    },
    [onPickHero],
  );

  return (
    <div className="retake-review">
      <div className="retake-summary">
        <span className="chip ready">{result.takeGroups.length} retake-grupper</span>
        <span className="card-chip-meta">
          analyserte {Math.round(result.totalDurationSeconds)}s i {result.windowCount} vinduer
        </span>
      </div>

      {result.takeGroups.length === 0 ? (
        <div className="empty">Ingen retakes funnet — lyden hadde ikke nok matching innhold.</div>
      ) : (
        result.takeGroups.map((group) => (
          <div key={group.groupId} className="retake-group">
            <div className="retake-group-header">
              <div>
                <strong>Gruppe {group.groupId.slice(0, 6)}</strong>
                <span className="card-chip-meta">
                  · {group.takeCount} takes · {group.contentDurationSeconds}s innhold
                </span>
              </div>
              <span
                className={`chip ${group.audioConfidence >= 0.85 ? "ready" : group.audioConfidence >= 0.7 ? "risk-medium" : "stub"}`}
                title="Hvor likt fingerprint-ene er i denne gruppen"
              >
                <IconMusic /> {Math.round(group.audioConfidence * 100)}% match
              </span>
            </div>
            <div className="retake-takes">
              {group.takes.map((take) => {
                const isHero = heroByGroup[group.groupId] === take.takeId;
                const isPlaying = playingTakeId === take.takeId;
                const progress = isPlaying
                  ? Math.min(
                      100,
                      Math.max(0, ((currentPosition - take.startSeconds) / (take.endSeconds - take.startSeconds)) * 100),
                    )
                  : 0;
                return (
                  <div key={take.takeId} className={`retake-take ${isHero ? "hero" : ""}`}>
                    <div className="retake-take-time">
                      <strong>{formatTime(take.startSeconds)}</strong>
                      <span className="card-chip-meta">– {formatTime(take.endSeconds)}</span>
                    </div>
                    <div className="retake-take-bar">
                      <div
                        className="retake-take-progress"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="retake-take-actions">
                      <button
                        className="small"
                        onClick={() => (isPlaying ? stopPlayback() : playTake(take))}
                      >
                        {isPlaying ? "Stop" : <><IconPlay /> Hør</>}
                      </button>
                      <button
                        className={`small ${isHero ? "primary" : ""}`}
                        onClick={() => pickHero(group.groupId, take.takeId)}
                      >
                        {isHero ? <>Hero <IconStar /></> : "Pick hero"}
                      </button>
                    </div>
                    {take.isHeroSuggestion && !isHero && (
                      <span className="card-chip-meta" style={{ fontSize: 10 }}>
                        AI: foreslår denne (siste take)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

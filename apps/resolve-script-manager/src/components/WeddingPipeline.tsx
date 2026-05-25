/**
 * WeddingPipeline — dedicated workflow panel for wedding-film projects.
 * Surfaces only when the active Role Room production has a wedding-type
 * (bryllup/wedding/wedding_film/norwedfilm). Walks the lead/Bjarne through
 * the steps unique to wedding post-production:
 *
 *   1. Fetch source song from YouTube (private-use only) — gives the
 *      analyzer a pristine beat-grid instead of the muddied final-mix
 *   2. Analyze the exported wedding film with auto-aligned beat-grid
 *      from the downloaded source song
 *   3. Match shots back to DIT footage (raw source clips)
 *   4. Apply Norwedfilm look pack + create wedding master timeline
 *      (existing scripts — buttons here trigger them)
 *
 * State flow is intentionally linear — each step's output feeds the next.
 */

import { useState } from "react";
import { executeScript } from "../api";

const WEDDING_PROJECT_TYPES = new Set(["bryllup", "wedding", "wedding_film", "norwedfilm"]);

export function isWeddingProjectType(projectType?: string | null): boolean {
  if (!projectType) return false;
  return WEDDING_PROJECT_TYPES.has(projectType.toLowerCase());
}

interface Props {
  projectId: string;
  projectType: string | null | undefined;
  exportedVideoPath?: string;
  /** Called when the source song is fetched, so parent can pass to analyze */
  onSourceSongReady?: (audioPath: string, tempo?: number) => void;
}

interface FetchSongResult {
  localAudioPath: string;
  durationSeconds?: number;
  tempo?: number;
  beatsDetected?: number;
}

export function WeddingPipeline({ projectId, projectType, exportedVideoPath, onSourceSongReady }: Props) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [fetchingSong, setFetchingSong] = useState(false);
  const [songResult, setSongResult] = useState<FetchSongResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isWeddingProjectType(projectType)) return null;

  async function fetchSourceSong() {
    if (!youtubeUrl.trim()) return;
    setFetchingSong(true);
    setError(null);
    setSongResult(null);
    try {
      const summary = await executeScript(
        "fetch_source_song",
        {
          youtubeUrl: youtubeUrl.trim(),
          projectId,
          projectType: projectType || "bryllup",
        },
        false,
      );
      const r = summary.events.find((e) => e.type === "result")?.value as FetchSongResult | undefined;
      const err = summary.events.find((e) => e.type === "error")?.value as { message?: string } | undefined;
      if (err?.message) {
        setError(err.message);
        return;
      }
      if (r?.localAudioPath) {
        setSongResult(r);
        onSourceSongReady?.(r.localAudioPath, r.tempo);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetchingSong(false);
    }
  }

  return (
    <div style={{
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      background: "linear-gradient(135deg, rgba(236,72,153,0.10), rgba(160,48,192,0.05))",
      border: "1px solid rgba(236,72,153,0.35)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#ec4899">
          <path d="M12 2.5l3.09 6.26L22 9.77l-5 4.87 1.18 6.88L12 18.27l-6.18 3.25L7 14.64l-5-4.87 6.91-1.01L12 2.5z"/>
        </svg>
        <strong style={{ fontSize: 14 }}>Bryllups-pipeline</strong>
        <span style={{ fontSize: 10, color: "#ec4899", padding: "2px 6px", background: "rgba(236,72,153,0.15)", borderRadius: 4 }}>
          {projectType}
        </span>
      </div>

      {/* Step 1: YouTube source song */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#d8c8e8", fontWeight: 600, marginBottom: 4 }}>
          1. Hent source-sang fra YouTube
        </div>
        <div style={{ fontSize: 11, color: "#8674a8", marginBottom: 8 }}>
          Gir analyzer'n en pristine beat-grid uten dialog/applaus i miksen. Auto-aligner sangen til riktig timecode i den ferdige videoen.
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=…"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            disabled={fetchingSong}
            style={{
              flex: 1,
              background: "#1a0d45",
              border: "1px solid rgba(236,72,153,0.30)",
              color: "#f0eaff",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
            }}
          />
          <button
            onClick={fetchSourceSong}
            disabled={fetchingSong || !youtubeUrl.trim()}
            style={{
              background: "#ec4899",
              border: "none",
              color: "white",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: fetchingSong || !youtubeUrl.trim() ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {fetchingSong ? "Laster ned…" : "Hent"}
          </button>
        </div>
        <div style={{ fontSize: 10, color: "#8674a8" }}>
          ⓘ Kun for privat bryllups-bruk. Sangen lagres lokalt — ingen filer går til skyen.
        </div>

        {songResult && (
          <div style={{
            marginTop: 6,
            padding: 8,
            background: "rgba(74,212,138,0.10)",
            border: "1px solid rgba(74,212,138,0.40)",
            color: "#4ad48a",
            borderRadius: 6,
            fontSize: 11,
          }}>
            <strong>✓</strong> {songResult.durationSeconds?.toFixed(0)}s sang
            {songResult.tempo != null && `, ${songResult.tempo.toFixed(0)} BPM`}
            {songResult.beatsDetected != null && `, ${songResult.beatsDetected} beats detektert`}
            <div style={{ fontSize: 10, color: "#8674a8", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {songResult.localAudioPath}
            </div>
            <div style={{ fontSize: 10, color: "#8674a8", marginTop: 4 }}>
              Klart for "Analysér ferdig video" — beat-grid auto-aligner mot pristine source.
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 6,
            padding: 8,
            background: "rgba(239,79,111,0.10)",
            border: "1px solid rgba(239,79,111,0.40)",
            color: "#ef4f6f",
            borderRadius: 6,
            fontSize: 11,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Step 2-pointer to existing analyze section */}
      <div style={{
        marginTop: 12,
        padding: 8,
        background: "rgba(160,48,192,0.08)",
        borderLeft: "2px solid #a030c0",
        borderRadius: 4,
        fontSize: 11,
        color: "#d8c8e8",
      }}>
        <strong>2. Neste:</strong> bruk "Analysér ferdig video" nedenfor. Når en source-sang er hentet, brukes den automatisk for nøyaktig beat-grid.
        {exportedVideoPath && (
          <div style={{ marginTop: 4, fontSize: 10, color: "#8674a8" }}>
            Eksportert video valgt: {exportedVideoPath.split("/").pop()}
          </div>
        )}
      </div>
    </div>
  );
}

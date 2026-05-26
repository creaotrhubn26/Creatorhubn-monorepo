"""Scan + Recommend Music — analyser lang film, identifiser alle sanger via
Shazam, beregn BPM, og gi anbefalinger om hvilke sanger som passer best for
en highlight av en gitt lengde + visuell pace.

Workflow:
  1. Detekter music-seksjoner via silencedetect (>= 10s, RMS-basert)
  2. For hver seksjon: identifiser sang via Shazam (samples 1/3 inn)
  3. Beregn BPM per seksjon via librosa.beat.beat_track
  4. Deduplicate (samme sang i flere seksjoner aggregeres)
  5. Anbefal: (a) N sanger basert på highlight-lengde, (b) hvilke
     sanger som passer best til visuell-pace via BPM-matching

Anbefalings-tabell:
  30s-1min   → 1 sang  (mest dominerende)
  1-3 min    → 2 sanger
  4-6 min    → 3 sanger
  6-10 min   → 4 sanger
  10+ min    → 5+ sanger

Beat-matching:
  Hvis vi mottar picks-payload via param, beregner vi cut-rate per
  pick (1/varighet) som proxy for visuell pace. Picks med høyere
  cut-rate → matches mot høyere-BPM sanger; lavere cut-rate (lange,
  rolige shots) → lavere-BPM ballader.

Input params:
  videoPath:        absolute path til source film (required)
  picksPath:        optional — JSON med highlight-picks for beat-matching
  highlightLengthSec: optional — sek for length-based recommendation

Output: {
  uniqueSongs: [{ title, artist, totalDuration, bpm, sections, genre }],
  recommendations: {
    byLength: { highlightSec → topSongs },
    byBeatMatch: { pickIndex → { song, bpm_match_score } }
  }
}
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
SILENCEDETECT_RE = re.compile(r"silence_(start|end): ([\d.]+)")


def find_tool(*names: str) -> str | None:
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    for base in ("/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin", "/usr/bin"):
        for n in names:
            p = os.path.join(base, n)
            if os.path.isfile(p):
                return p
    return None


def probe_duration(ffprobe: str, path: str) -> float:
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=20,
        )
        return float((r.stdout or "0").strip())
    except (subprocess.SubprocessError, ValueError):
        return 0.0


def detect_music_sections(ffmpeg: str, video: str, duration: float,
                          min_dur: float = 10.0) -> list[tuple[float, float]]:
    """Reuse silencedetect → non-silent regions >= min_dur seconds = music candidates."""
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-i", video,
        "-af", "silencedetect=noise=-32dB:d=0.4",
        "-vn", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except Exception:  # noqa: BLE001
        return []
    silences: list[tuple[float, float]] = []
    cur: float | None = None
    for kind, val in SILENCEDETECT_RE.findall(r.stderr):
        t = float(val)
        if kind == "start":
            cur = t
        elif kind == "end" and cur is not None:
            silences.append((cur, t))
            cur = None
    if cur is not None:
        silences.append((cur, duration))
    sections: list[tuple[float, float]] = []
    cursor = 0.0
    for s_start, s_end in silences:
        if s_start - cursor > 3.0:
            sections.append((cursor, s_start))
        cursor = s_end
    if duration - cursor > 3.0:
        sections.append((cursor, duration))
    return [(s, e) for s, e in sections if (e - s) >= min_dur]


def extract_audio_sample(ffmpeg: str, video: str, start: float, dur: float,
                          mp3: bool = True) -> str | None:
    """Extract audio to a temp file. mp3=True for Shazam, False for librosa-WAV."""
    ext = ".mp3" if mp3 else ".wav"
    fd, tmp = tempfile.mkstemp(suffix=ext); os.close(fd)
    codec = ["-vn", "-ac", "2", "-ar", "44100"] if mp3 else ["-vn", "-ac", "1", "-ar", "22050"]
    try:
        r = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{start:.3f}", "-t", f"{dur:.3f}",
             "-i", video, *codec, tmp],
            capture_output=True, timeout=60,
        )
        if r.returncode != 0 or not os.path.isfile(tmp):
            return None
        return tmp
    except Exception:  # noqa: BLE001
        return None


def compute_bpm(audio_path: str) -> float | None:
    """librosa beat-track → BPM. Returns None if librosa not available."""
    try:
        import librosa  # type: ignore
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        if y.size < sr:
            return None
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        val = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
        return round(val, 1) if val > 0 else None
    except Exception:  # noqa: BLE001
        return None


def compute_beat_times(audio_path: str, song_start_offset: float = 0.0) -> list[float]:
    """librosa beat-track → list of beat times (seconds). For Resolve markers.

    `song_start_offset` is added to each beat-time so the returned timestamps
    are absolute positions on the source-video timeline (not relative to the
    sampled audio chunk).
    """
    try:
        import librosa  # type: ignore
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        if y.size < sr:
            return []
        _, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
        return [round(float(b) + song_start_offset, 3) for b in beats]
    except Exception:  # noqa: BLE001
        return []


def beat_times_to_resolve_markers(beat_times: list[float], fps: float,
                                  color: str = "Blue", name: str = "Beat") -> list[dict]:
    """Convert beat-times (seconds) → Resolve marker objects.

    Resolve Timeline.AddMarker(frame, color, name, note, duration, customData)
    expects frame-numbers (not seconds). We pre-compute frame positions here so
    the build_highlight_from_picks script can iterate + call AddMarker directly.

    Compatible with Resolve's `Find Music Beats` Fairlight feature — both place
    markers on the timeline; this function emulates the same output format so
    user can snap cuts to either (or both) sets of markers.
    """
    return [{
        "frame": int(round(t * fps)),
        "color": color,
        "name": f"{name} {i+1}",
        "note": f"BPM-beat @ {t:.3f}s",
        "duration": 1,
    } for i, t in enumerate(beat_times)]


async def shazam_identify(audio_path: str) -> dict:
    try:
        from shazamio import Shazam  # type: ignore
    except ImportError:
        return {"title": None, "artist": None, "error": "shazamio not installed"}
    s = Shazam()
    try:
        r = await s.recognize(audio_path)
        t = r.get("track", {})
        return {
            "title": t.get("title"),
            "artist": t.get("subtitle"),
            "genre": (t.get("genres") or {}).get("primary"),
        }
    except Exception as e:  # noqa: BLE001
        return {"title": None, "artist": None, "error": str(e)}


def recommend_song_count(highlight_sec: float) -> int:
    m = highlight_sec / 60.0
    if m < 1.5:  return 1
    if m < 3.0:  return 2
    if m < 6.0:  return 3
    if m < 10.0: return 4
    return 5


def match_song_to_picks(picks: list[dict], songs: list[dict]) -> list[dict]:
    """For each pick, find the song whose BPM best matches the pick's visual
    pace. Pace proxy = 1 / pick.durationSec (short picks = high pace).
    BPM ~ 60-180; pace ~ 0.1-2 Hz. We map pace to target-BPM via:
       target_bpm = 60 + pace * 60   (capped 60-180)
    Then for each pick, choose song with min |bpm - target|.
    """
    assignments = []
    songs_with_bpm = [s for s in songs if s.get("bpm")]
    if not songs_with_bpm:
        return assignments
    for p in picks:
        dur = p.get("durationSec") or (p.get("endSec", 0) - p.get("startSec", 0))
        pace = 1.0 / max(dur, 0.1)
        target_bpm = max(60, min(180, 60 + pace * 60))
        best = min(songs_with_bpm, key=lambda s: abs(s["bpm"] - target_bpm))
        assignments.append({
            "pickIndex": p.get("index"),
            "durationSec": round(dur, 2),
            "pace_hz": round(pace, 2),
            "targetBpm": round(target_bpm, 1),
            "assignedSong": {"title": best["title"], "artist": best["artist"], "bpm": best["bpm"]},
            "bpmDiff": round(abs(best["bpm"] - target_bpm), 1),
        })
    return assignments


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' is not a file")
        sys.exit(1)

    picks_path = (params.get("picksPath") or "").strip()
    highlight_sec = float(params.get("highlightLengthSec") or 0)

    ffmpeg = find_tool("ffmpeg")
    ffprobe = find_tool("ffprobe")
    if not ffmpeg or not ffprobe:
        bridge.error("Missing ffmpeg/ffprobe")
        sys.exit(1)

    bridge.progress(0, 100, "Probing duration…")
    duration = probe_duration(ffprobe, video_path)
    bridge.log(f"Source: {duration:.0f}s ({duration/60:.1f} min)")

    bridge.progress(5, 100, "Detecting music sections…")
    sections = detect_music_sections(ffmpeg, video_path, duration)
    bridge.log(f"Detected {len(sections)} music sections")

    if not sections:
        bridge.error("No music sections found")
        sys.exit(1)

    if dry_run:
        bridge.result({"wouldScan": len(sections),
                       "sections": [{"startSec": s, "endSec": e} for s, e in sections]})
        return

    # Scan each section: identify + BPM + beat-times (for Resolve markers)
    fps = float(params.get("fps") or 25.0)  # Resolve frame-rate; default PAL-25
    export_beats = bool(params.get("exportBeatMarkers", True))
    identifications = []
    for i, (s_start, s_end) in enumerate(sections):
        bridge.progress(10 + int(70 * (i + 1) / len(sections)), 100,
                        f"Analyzing section {i+1}/{len(sections)}")
        sec_dur = s_end - s_start
        sample_ts = s_start + sec_dur * 0.33
        sample_dur = min(20.0, sec_dur * 0.6)

        # Shazam identify (mp3)
        mp3 = extract_audio_sample(ffmpeg, video_path, sample_ts, sample_dur, mp3=True)
        info = {}
        if mp3:
            try:
                info = asyncio.run(shazam_identify(mp3))
            finally:
                try: os.unlink(mp3)
                except OSError: pass

        # BPM + beat-times via librosa (wav). For longer sections we sample more
        # for higher-fidelity beat-tracking that Resolve markers can use.
        beat_wav_dur = min(30.0, sec_dur * 0.8) if export_beats else sample_dur
        beat_wav_start = s_start + sec_dur * 0.1  # skip first 10% (often crossfade-in)
        wav = extract_audio_sample(ffmpeg, video_path, beat_wav_start, beat_wav_dur, mp3=False)
        bpm = None
        beat_times: list[float] = []
        if wav:
            bpm = compute_bpm(wav)
            if export_beats:
                beat_times = compute_beat_times(wav, song_start_offset=beat_wav_start)
            try: os.unlink(wav)
            except OSError: pass

        title = info.get("title")
        bridge.log(
            f"  Section {i+1}: {s_start:.0f}-{s_end:.0f}s "
            f"({'✓' if title else '—'} {title or '(no match)'}, BPM={bpm or '?'}, "
            f"{len(beat_times)} beats)"
        )
        identifications.append({
            "section_idx": i, "startSec": s_start, "endSec": s_end,
            "durationSec": sec_dur,
            "title": title, "artist": info.get("artist"),
            "genre": info.get("genre"), "bpm": bpm,
            "beatTimes": beat_times,
            # Resolve-compatible marker payload (same format as Fairlight's
            # 'Find Music Beats' produces; can be applied via Timeline.AddMarker)
            "resolveMarkers": beat_times_to_resolve_markers(beat_times, fps),
        })

    # Deduplicate songs (group sections by title|artist)
    unique: dict[str, dict] = {}
    total_song_time = 0.0
    for r in identifications:
        if not r.get("title"):
            continue
        key = f"{r['title'].lower().strip()}|{(r.get('artist') or '').lower().strip()}"
        if key not in unique:
            unique[key] = {
                "title": r["title"], "artist": r.get("artist", ""),
                "genre": r.get("genre", ""),
                "totalDuration": 0.0, "sections": [], "bpms": [],
            }
        unique[key]["totalDuration"] += r["durationSec"]
        unique[key]["sections"].append({"startSec": r["startSec"], "endSec": r["endSec"]})
        if r.get("bpm"):
            unique[key]["bpms"].append(r["bpm"])
        total_song_time += r["durationSec"]

    # Compute average BPM per song
    song_list = []
    for s in unique.values():
        bpms = s["bpms"]
        avg_bpm = round(sum(bpms) / len(bpms), 1) if bpms else None
        song_list.append({
            "title": s["title"], "artist": s["artist"], "genre": s["genre"],
            "totalDuration": round(s["totalDuration"], 1),
            "percentOfMusic": round(s["totalDuration"] / total_song_time * 100, 1) if total_song_time else 0,
            "bpm": avg_bpm, "sections": s["sections"],
        })
    song_list.sort(key=lambda s: -s["totalDuration"])

    bridge.progress(85, 100, "Building recommendations…")

    # Length-based recommendations
    by_length = {}
    for hl_min in [0.5, 1, 2, 4, 6, 10]:
        n = min(recommend_song_count(hl_min * 60), len(song_list))
        by_length[f"{hl_min}min"] = {
            "songCount": n,
            "topSongs": song_list[:n],
        }

    # Beat-matching (if picks payload supplied)
    beat_match = []
    if picks_path and os.path.isfile(picks_path):
        with open(picks_path) as f:
            picks_data = json.load(f)
        picks = picks_data.get("picks", [])
        beat_match = match_song_to_picks(picks, song_list)
        bridge.log(f"Beat-matched {len(beat_match)} picks against {len([s for s in song_list if s.get('bpm')])} songs with known BPM")

    # Specific recommendation for requested highlight-length
    specific = None
    if highlight_sec > 0:
        n = min(recommend_song_count(highlight_sec), len(song_list))
        specific = {
            "highlightSec": highlight_sec,
            "songCount": n,
            "topSongs": song_list[:n],
        }

    bridge.progress(100, 100, "Ferdig")

    cache_path = os.path.join(CACHE_DIR, "music_advisor.json")
    payload = {
        "savedAt": time.time(),
        "sourceVideo": video_path,
        "sourceDurationMin": round(duration / 60, 1),
        "totalMusicMin": round(total_song_time / 60, 1),
        "uniqueSongs": song_list,
        "recommendations": {
            "byLength": by_length,
            "byBeatMatch": beat_match,
            "specific": specific,
        },
    }
    with open(cache_path, "w") as f:
        json.dump(payload, f, indent=2)
    bridge.log(f"Cached → {cache_path}")

    bridge.result(payload)


if __name__ == "__main__":
    bridge.main_guard(run)

"""Detect Music Beats — extracts BPM + beat-timestamps from an audio file.

Used by the music_video Magic Cut pipeline as the timing grid that
downstream steps (assign_clips_to_beats, place_clips_on_beat_grid)
align cuts to. Without a beat grid, music-video assembly degrades to
the standard sequential placement (still works, just not synced).

Params:
  musicPath:     absolute path to .mp3/.wav/.aac/.m4a (required)
  targetFps:     framerate to convert seconds → frames (default 25)
  beatLimit:     max beats to return (default 1024 = ~5 min @ 120 BPM)

Output:
  bpm:           detected tempo (float)
  beats:         [seconds, ...] absolute timestamps
  frames:        [int, ...] frame numbers at targetFps
  downbeats:     [seconds, ...] every 4th beat (1st of each bar) if librosa
                 returns enough to estimate; otherwise empty.
  durationSec:   total music length

Dependencies: librosa (installed in the dedicated venv via install_dependency.py).
On systems without librosa, the script falls back to a constant-BPM grid
estimated from ffprobe duration — better than nothing for synced cuts.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

bridge.reexec_in_venv_if_present()


def _probe_duration(audio_path: str) -> float:
    """Return duration in seconds via ffprobe, or 0 on failure."""
    ffprobe = (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFPROBE")
        or shutil.which("ffprobe")
        or "/opt/homebrew/bin/ffprobe"
    )
    if not os.path.isfile(ffprobe):
        return 0.0
    try:
        out = subprocess.check_output(
            [
                ffprobe,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                audio_path,
            ],
            text=True,
            timeout=10,
        )
        return float(out.strip())
    except (subprocess.SubprocessError, ValueError):
        return 0.0


def _fallback_constant_bpm(audio_path: str, target_fps: float, default_bpm: float = 120.0) -> dict:
    """When librosa isn't available, lay down a constant-BPM grid based on duration."""
    duration = _probe_duration(audio_path)
    if duration <= 0:
        bridge.error(
            f"Could not probe duration of {audio_path}. "
            "Install ffprobe via `brew install ffmpeg`, or librosa via pip."
        )
        sys.exit(1)
    seconds_per_beat = 60.0 / default_bpm
    n_beats = min(int(duration / seconds_per_beat) + 1, 1024)
    beats = [round(i * seconds_per_beat, 3) for i in range(n_beats)]
    frames = [int(t * target_fps) for t in beats]
    downbeats = [beats[i] for i in range(0, len(beats), 4)]
    bridge.warn(
        f"librosa not installed — using constant-{default_bpm:.0f}-BPM grid "
        f"({len(beats)} beats over {duration:.1f}s). Install via "
        "Settings → Dependencies → pip librosa for true beat detection."
    )
    return {
        "bpm": default_bpm,
        "beats": beats,
        "frames": frames,
        "downbeats": downbeats,
        "durationSec": duration,
        "method": "constant_bpm_fallback",
    }


def detect_with_librosa(audio_path: str, target_fps: float, beat_limit: int, max_duration: float = 300.0) -> dict | None:
    """Use librosa.beat.beat_track to extract real beats. Returns None on failure.

    Defensive against UI freeze:
      - Suppress librosa's stderr noise (codec warnings, deprecation chatter)
        so the Tauri log panel doesn't get flooded with unhelpful output
        that could appear as a 'black screen' if the WebView falls behind.
      - Heartbeat progress events at each phase so the renderer keeps refreshing
        even while librosa is in a long blocking call.
      - Lower default duration cap (300s vs 600s) — 5 min covers virtually all
        wedding songs and halves the memory + CPU pressure during load.
    """
    try:
        import librosa  # type: ignore[import-not-found]
    except ImportError:
        return None

    # Suppress non-critical noise from librosa/audioread/soundfile so the
    # log panel only shows our own structured events. librosa is chatty
    # about deprecation + codec quirks via stderr — those flood the UI.
    import warnings as _w, contextlib, io
    _w.filterwarnings("ignore")
    null_stream = io.StringIO()

    try:
        bridge.progress(5, 100, "Importerer librosa…")
        bridge.log(f"Audio: {os.path.basename(audio_path)} (cap {max_duration:.0f}s)")
        bridge.progress(10, 100, "Laster audio…")

        with contextlib.redirect_stderr(null_stream):
            y, sr = librosa.load(audio_path, sr=22050, mono=True, duration=max_duration)

        bridge.progress(40, 100, f"Loaded {len(y)/sr:.1f}s @ {sr} Hz — analyserer tempo…")

        with contextlib.redirect_stderr(null_stream):
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)

        bridge.progress(75, 100, "Beregner downbeats…")
        bpm = float(tempo) if hasattr(tempo, "__float__") else float(tempo[0])
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
        beat_times = beat_times[:beat_limit]
        downbeats = beat_times[::4]
        frames = [int(t * target_fps) for t in beat_times]
        bridge.progress(100, 100, "Ferdig")
        return {
            "bpm": round(bpm, 2),
            "beats": [round(t, 3) for t in beat_times],
            "frames": frames,
            "downbeats": [round(t, 3) for t in downbeats],
            "durationSec": round(len(y) / sr, 2),
            "method": "librosa",
        }
    except MemoryError:
        bridge.warn("librosa loaded out of memory — switching to fallback BPM grid")
        return None
    except Exception as exc:
        bridge.warn(f"librosa failed: {type(exc).__name__}: {exc} — falling back to constant BPM")
        return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    music_path = params.get("musicPath") or params.get("musicFile") or ""
    # Use `or default` instead of dict.get(key, default) — if the UI sent ''
    # as the value (empty input), .get returns '' (not default), then float()
    # would raise ValueError.
    target_fps = float(params.get("targetFps") or 25)
    beat_limit = int(params.get("beatLimit") or 1024)

    if not music_path:
        bridge.error(
            "musicPath is required. Pick a music file in the Magic Cut dialog "
            "(music_video template only)."
        )
        sys.exit(1)
    if not os.path.isfile(music_path):
        bridge.error(f"musicPath does not exist: {music_path}")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "musicPath": music_path,
            "targetFps": target_fps,
            "wouldDetectBeats": True,
        })
        return

    bridge.log(f"Detecting beats in {os.path.basename(music_path)}")
    bridge.progress(0, 100, "Starting beat detection")

    result = detect_with_librosa(music_path, target_fps, beat_limit)
    if result is None:
        result = _fallback_constant_bpm(music_path, target_fps)

    bridge.log(
        f"Detected {len(result['beats'])} beats at {result['bpm']:.1f} BPM "
        f"({result['method']})"
    )
    bridge.result(result)


if __name__ == "__main__":
    bridge.main_guard(run)

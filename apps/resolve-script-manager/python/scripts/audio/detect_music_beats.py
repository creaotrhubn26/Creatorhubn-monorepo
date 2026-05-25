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


def detect_with_librosa(audio_path: str, target_fps: float, beat_limit: int) -> dict | None:
    """Use librosa.beat.beat_track to extract real beats. Returns None on failure."""
    try:
        import librosa  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        bridge.log(f"Loading audio with librosa: {os.path.basename(audio_path)}")
        # mono=True simplifies analysis; sr=None preserves native sample rate.
        # Long files: load up to 600s of audio so we don't OOM on a 1h podcast.
        y, sr = librosa.load(audio_path, sr=None, mono=True, duration=600.0)
        bridge.log(f"Sample rate: {sr} Hz · duration: {len(y) / sr:.1f}s")
        bridge.progress(20, 100, "Analyzing tempo")
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        # Cast tempo — librosa can return either a scalar or a 1-element ndarray
        bpm = float(tempo) if hasattr(tempo, "__float__") else float(tempo[0])
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
        beat_times = beat_times[:beat_limit]
        bridge.progress(70, 100, "Estimating downbeats")
        # Simple downbeat heuristic: every 4th beat (4/4 time). For better
        # downbeat detection use librosa.beat.beat_track with units='time'
        # and the more advanced madmom library, but that's a heavy dep.
        downbeats = beat_times[::4]
        frames = [int(t * target_fps) for t in beat_times]
        bridge.progress(100, 100, "Done")
        return {
            "bpm": round(bpm, 2),
            "beats": [round(t, 3) for t in beat_times],
            "frames": frames,
            "downbeats": [round(t, 3) for t in downbeats],
            "durationSec": round(len(y) / sr, 2),
            "method": "librosa",
        }
    except Exception as exc:
        bridge.warn(f"librosa failed: {exc} — falling back to constant BPM")
        return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    music_path = params.get("musicPath") or params.get("musicFile") or ""
    target_fps = float(params.get("targetFps", 25))
    beat_limit = int(params.get("beatLimit", 1024))

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

"""Generate Music Ducking Plan — detects speech regions, emits marker plan + JSON for fader rides.

v1 strategy:
  1. Read dialogue tracks (A2-A5 by default) from current timeline
  2. Use ffmpeg `silencedetect` to identify speech vs silent regions
  3. Build a ducking-plan JSON: per-region {start, end, duck_db, fade_in, fade_out}
  4. Optionally add yellow markers on timeline at speech onset/offset
  5. Export plan as JSON for manual Fairlight fader-rides or external automation
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def find_ffmpeg() -> str | None:
    for candidate in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def detect_speech_regions(ffmpeg: str, audio_path: str, noise_db: float = -32, min_silence_s: float = 1.5) -> list[dict]:
    """Inverse of silencedetect → speech regions = the gaps between silent stretches."""
    cmd = [
        ffmpeg, "-nostats", "-hide_banner", "-i", audio_path,
        "-af", f"silencedetect=noise={noise_db}dB:d={min_silence_s}",
        "-f", "null", "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        return []

    silences: list[tuple[float, float]] = []
    starts = re.findall(r"silence_start:\s*(\d+\.?\d*)", result.stderr or "")
    ends = re.findall(r"silence_end:\s*(\d+\.?\d*)", result.stderr or "")
    for s, e in zip(starts, ends):
        silences.append((float(s), float(e)))

    duration_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", result.stderr or "")
    if not duration_match:
        return []
    h, m, s = duration_match.groups()
    total = int(h) * 3600 + int(m) * 60 + float(s)

    speech: list[dict] = []
    cursor = 0.0
    for sil_start, sil_end in silences:
        if sil_start > cursor + 0.2:
            speech.append({"start": cursor, "end": sil_start, "durationSeconds": sil_start - cursor})
        cursor = sil_end
    if cursor < total - 0.2:
        speech.append({"start": cursor, "end": total, "durationSeconds": total - cursor})
    return speech


def run(params: dict, dry_run: bool) -> None:
    audio_path = params.get("audioPath")
    duck_db = float(params.get("duckDb", -8))
    fade_in = float(params.get("fadeInSeconds", 0.5))
    fade_out = float(params.get("fadeOutSeconds", 0.8))
    add_markers = bool(params.get("addMarkersInResolve", False))

    if dry_run:
        bridge.result({
            "summary": "Dry run — would detect speech segments via silencedetect and build a ducking plan",
            "duckDb": duck_db,
            "fadeIn": fade_in,
            "fadeOut": fade_out,
            "addMarkers": add_markers,
            "output": {
                "speechRegions": "[{ start, end, durationSeconds }, ...]",
                "duckingPlan": "[{ start, end, duckDb, fadeIn, fadeOut, reason }, ...]",
            },
        })
        return

    if not audio_path or not os.path.isfile(audio_path):
        bridge.error("audioPath required and must exist on disk (export your dialogue stem first)")
        sys.exit(1)

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not found")
        sys.exit(1)

    bridge.log(f"Detecting speech regions in {os.path.basename(audio_path)}")
    speech = detect_speech_regions(ffmpeg, audio_path)
    bridge.log(f"Found {len(speech)} speech regions")

    plan = [
        {
            "start": region["start"],
            "end": region["end"],
            "durationSeconds": region["durationSeconds"],
            "duckDb": duck_db,
            "fadeInSeconds": fade_in,
            "fadeOutSeconds": fade_out,
            "reason": "speech",
        }
        for region in speech
    ]

    if add_markers:
        conn = bridge.ResolveConnection()
        if conn.connect() and conn.require_project():
            timeline = conn.project.GetCurrentTimeline()
            if timeline:
                fps_str = timeline.GetSetting("timelineFrameRate") or "25"
                try:
                    fps = float(fps_str)
                except ValueError:
                    fps = 25.0
                start_frame = int(timeline.GetStartFrame() or 0)
                added = 0
                for region in speech:
                    frame = start_frame + int(region["start"] * fps)
                    if timeline.AddMarker(frame, "Yellow", "Music duck start", "auto-ducking-plan", 1, "duck_in"):
                        added += 1
                    out_frame = start_frame + int(region["end"] * fps)
                    if timeline.AddMarker(out_frame, "Sand", "Music duck end", "auto-ducking-plan", 1, "duck_out"):
                        added += 1
                bridge.log(f"Added {added} ducking markers to {timeline.GetName()}")

    bridge.result({
        "audioPath": audio_path,
        "speechRegions": speech,
        "duckingPlan": plan,
        "duckDb": duck_db,
        "fadeIn": fade_in,
        "fadeOut": fade_out,
        "totalSpeechSeconds": round(sum(r["durationSeconds"] for r in speech), 1),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""QC Source Video — kjør gap- og silence-deteksjon direkte på en video-fil
via ffmpeg, uten å kreve at Resolve er åpen.

Use case: før Bjarne sender en video til kunde, sjekk om det finnes
svarte intervaller (uintenderte blackouts) eller stille perioder. Returnerer
samme rapport som detect_timeline_gaps + detect_silent_sections, men på en
raw video-fil i stedet for Resolve-timeline.

Input:
  videoPath:       absolute path til video-filen
  minBlackSec:     default 0.5 — minimum varighet for å regne som svart
  pixelThreshold:  default 0.10 — frame regnes svart hvis < threshold pixels er ikke-svarte
  minSilenceSec:   default 3.0 — minimum varighet for stille
  noiseThreshold:  default -40 — dB-grense for stille

Output:
  blackIntervals: [{ startSec, endSec, durationSec }]
  silentIntervals: [{ startSec, endSec, durationSec }]
  totalBlackSec: float
  totalSilentSec: float
  durationSec: float
  verdict: "clean" | "minor_issues" | "major_issues"
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


BLACK_RE = re.compile(r"black_start:([\d.]+).*black_end:([\d.]+).*black_duration:([\d.]+)")
SILENCE_START_RE = re.compile(r"silence_start:\s*([\d.]+)")
SILENCE_END_RE = re.compile(r"silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)")


def find_tool(name: str) -> str | None:
    p = shutil.which(name)
    if p: return p
    for base in ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"):
        full = os.path.join(base, name)
        if os.path.isfile(full): return full
    return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    min_black = float(params.get("minBlackSec") or 0.5)
    pixel_th = float(params.get("pixelThreshold") or 0.10)
    min_silence = float(params.get("minSilenceSec") or 3.0)
    noise_th = float(params.get("noiseThreshold") or -40)

    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' is not a file")
        sys.exit(1)

    ffmpeg = find_tool("ffmpeg")
    ffprobe = find_tool("ffprobe")
    if not ffmpeg or not ffprobe:
        bridge.error("ffmpeg/ffprobe mangler")
        sys.exit(1)

    # Hent duration
    try:
        r = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration",
                            "-of", "csv=p=0", video_path], capture_output=True, text=True, timeout=15)
        duration = float(r.stdout.strip() or 0)
    except (subprocess.TimeoutExpired, ValueError, OSError):
        duration = 0.0

    if dry_run:
        bridge.result({"wouldScan": video_path, "duration": duration})
        return

    bridge.progress(5, 100, f"Skanner svarte intervaller …")
    # Blackdetect
    black_cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-i", video_path,
        "-vf", f"blackdetect=d={min_black}:pix_th={pixel_th}",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(black_cmd, capture_output=True, text=True, timeout=1800)
        black_log = r.stderr
    except subprocess.TimeoutExpired:
        bridge.warn("blackdetect timeout etter 30 min")
        black_log = ""

    black_intervals = []
    for m in BLACK_RE.finditer(black_log):
        s, e, d = float(m.group(1)), float(m.group(2)), float(m.group(3))
        black_intervals.append({
            "startSec": round(s, 2), "endSec": round(e, 2), "durationSec": round(d, 2),
        })

    bridge.progress(60, 100, "Skanner stille intervaller …")
    # Silencedetect
    silence_cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-i", video_path,
        "-af", f"silencedetect=noise={noise_th}dB:d={min_silence}",
        "-vn", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(silence_cmd, capture_output=True, text=True, timeout=1800)
        silence_log = r.stderr
    except subprocess.TimeoutExpired:
        bridge.warn("silencedetect timeout etter 30 min")
        silence_log = ""

    silent_intervals = []
    pending_start = None
    for line in silence_log.split("\n"):
        sm = SILENCE_START_RE.search(line)
        if sm:
            pending_start = float(sm.group(1))
            continue
        em = SILENCE_END_RE.search(line)
        if em and pending_start is not None:
            end_s = float(em.group(1))
            dur_s = float(em.group(2))
            silent_intervals.append({
                "startSec": round(pending_start, 2),
                "endSec": round(end_s, 2),
                "durationSec": round(dur_s, 2),
            })
            pending_start = None

    bridge.progress(100, 100, "Ferdig")

    total_black = sum(b["durationSec"] for b in black_intervals)
    total_silent = sum(s["durationSec"] for s in silent_intervals)

    # Verdict
    if not black_intervals and not silent_intervals:
        verdict = "clean"
    elif total_black > 5 or total_silent > 30:
        verdict = "major_issues"
    else:
        verdict = "minor_issues"

    bridge.log(f"QC ferdig: {len(black_intervals)} svarte ({total_black:.1f}s) + "
               f"{len(silent_intervals)} stille ({total_silent:.1f}s) — {verdict}")

    bridge.result({
        "videoPath": video_path,
        "durationSec": round(duration, 1),
        "blackIntervals": black_intervals,
        "silentIntervals": silent_intervals,
        "blackCount": len(black_intervals),
        "silentCount": len(silent_intervals),
        "totalBlackSec": round(total_black, 1),
        "totalSilentSec": round(total_silent, 1),
        "verdict": verdict,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

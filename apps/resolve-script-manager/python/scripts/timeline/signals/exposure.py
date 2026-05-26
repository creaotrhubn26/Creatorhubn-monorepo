"""Exposure-clipping detection.

Uses ffmpeg's `signalstats` filter to extract Y-channel min/max per
frame. Computes the fraction of frames with clipped highlights
(YMAX >= 250) or clipped shadows (YMIN <= 4).

Returns 1.0 = FULLY CLIPPED (bad), 0.0 = clean. The orchestrator
multiplies by the genre's NEGATIVE weight, so:
   penalty = (-0.10) × 1.0 = -0.10  on clipped shots
   penalty = (-0.10) × 0.0 =  0.00  on clean shots
Higher signal-value = worse exposure = larger negative contribution.

(Previous version returned the inverse and clean shots got penalized
instead of clipped ones — discovered during real-world validation on
Bjarne's 4K wedding footage.)
"""

from __future__ import annotations

import re
import subprocess


def available() -> bool:
    # signalstats is part of stock ffmpeg since 2014 — assume ok if ffmpeg works.
    return True


YMAX_RE = re.compile(r"lavfi\.signalstats\.YMAX=([\d.]+)")
YMIN_RE = re.compile(r"lavfi\.signalstats\.YMIN=([\d.]+)")


def _score_shot(ffmpeg: str, video: str, start: float, end: float) -> float:
    duration = max(0.1, min(end - start, 8.0))  # sample max 8s for speed
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
        "-i", video,
        "-vf", "scale=320:180,signalstats=stat=tout+vrep+brng,metadata=mode=print",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception:  # noqa: BLE001
        return 0.0  # unknown → don't penalize (treat as clean)
    out = r.stderr
    # signalstats outputs PIXEL VALUES (0..255), not fractions:
    #   YMAX = max Y value in this frame
    #   YMIN = min Y value in this frame
    #   YHIGH/YLOW = 90th/10th percentile pixel values
    # We treat a frame as "clipped" if YMAX >= 250 (highlights pegged) OR
    # YMIN <= 5 (shadows crushed). Score = fraction of clipped frames.
    ymax = [float(m) for m in YMAX_RE.findall(out)]
    ymin = [float(m) for m in YMIN_RE.findall(out)]
    n = max(len(ymax), len(ymin))
    if n == 0:
        return 0.0
    clipped = 0
    for i in range(n):
        hi = ymax[i] if i < len(ymax) else 0.0
        lo = ymin[i] if i < len(ymin) else 255.0
        if hi >= 250.0 or lo <= 5.0:
            clipped += 1
    # Return clipping-fraction (0=clean, 1=every frame clipped). Orchestrator
    # multiplies by negative genre-weight → clipped = penalty.
    return clipped / n


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        out[i] = _score_shot(ffmpeg, video, s, e)
    return out

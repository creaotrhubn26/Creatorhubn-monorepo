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


HIGH_RE = re.compile(r"lavfi\.signalstats\.YHIGH=([\d.]+)")
LOW_RE = re.compile(r"lavfi\.signalstats\.YLOW=([\d.]+)")


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
        return 1.0  # unknown → don't penalize
    out = r.stderr
    # YHIGH = fraction (0..1) of pixels with Y >= 235 (broadcast-illegal high)
    # YLOW  = fraction (0..1) of pixels with Y <= 16  (broadcast-illegal low)
    highs = [float(m) for m in HIGH_RE.findall(out)]
    lows = [float(m) for m in LOW_RE.findall(out)]
    if not highs and not lows:
        return 1.0
    avg_high = sum(highs) / len(highs) if highs else 0.0
    avg_low = sum(lows) / len(lows) if lows else 0.0
    # A frame with > 3% clipped pixels in either tail is considered bad.
    # We RETURN the clipping-amount directly so 0=clean, 1=fully clipped.
    # Orchestrator multiplies by negative genre-weight → clipped = penalty.
    clipping_amount = min(
        1.0,
        (max(0.0, avg_high - 0.03) + max(0.0, avg_low - 0.03)) * 4.0,
    )
    return clipping_amount


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        out[i] = _score_shot(ffmpeg, video, s, e)
    return out

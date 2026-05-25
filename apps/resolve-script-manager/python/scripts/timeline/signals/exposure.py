"""Exposure-clipping detection.

Uses ffmpeg's `signalstats` filter to extract Y-channel min/max per
frame. Computes the fraction of frames with clipped highlights
(YMAX >= 250) or clipped shadows (YMIN <= 4). Score = 1.0 if clean,
0.0 if fully clipped. Returned as positive value (1 = good); the
orchestrator multiplies by negative weight to apply as penalty.
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
    # A frame with > 3% clipped pixels in either tail is considered bad
    # Score = 1 - (sum of clipping fractions, capped at 1)
    penalty = min(1.0, (max(0.0, avg_high - 0.03) + max(0.0, avg_low - 0.03)) * 4.0)
    return max(0.0, 1.0 - penalty)


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        out[i] = _score_shot(ffmpeg, video, s, e)
    return out

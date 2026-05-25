"""Slow-motion / cinematic-pace bonus.

For an already-conformed source (highlight is an exported film), real
slow-motion shows as smooth-but-low frame-to-frame difference. This
signal computes the mean Y-channel pixel difference between consecutive
frames via `tblend=difference` + `signalstats`. Low mean diff with
non-trivial content (i.e. shot isn't black) → slow-mo → boost.

Score:
  diff < 4    → 1.0  (very slow motion or near-still)
  diff 4..15  → linear 1.0 → 0.5
  diff > 15   → 0.0
"""

from __future__ import annotations

import re
import subprocess


def available() -> bool:
    return True


YAVG_RE = re.compile(r"lavfi\.signalstats\.YAVG=([\d.]+)")


def _diff_mean(ffmpeg: str, video: str, start: float, end: float) -> float:
    """Mean Y-channel value of the inter-frame difference stream.
    Lower = more similar consecutive frames = slow-mo or static."""
    duration = max(0.1, min(end - start, 6.0))
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
        "-i", video,
        "-vf",
        "scale=240:135,tblend=all_mode=difference,signalstats,metadata=mode=print",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception:  # noqa: BLE001
        return 50.0
    vals = [float(m) for m in YAVG_RE.findall(r.stderr)]
    if not vals:
        return 50.0
    return sum(vals) / len(vals)


def _score(diff: float) -> float:
    # < 4 = very still or slow-mo conformed
    # > 15 = normal motion
    if diff <= 4.0:
        return 1.0
    if diff >= 15.0:
        return 0.0
    return max(0.0, 1.0 - (diff - 4.0) / 11.0 * 0.5 - 0.5 * max(0.0, diff - 4.0) / 11.0)


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        # Skip ultra-short flash cuts (no signal value)
        if e - s < 0.5:
            out[i] = 0.0
            continue
        d = _diff_mean(ffmpeg, video, s, e)
        out[i] = _score(d)
    return out

"""Color-grade detection.

Distinguishes graded SDR footage from flat/log footage by looking at
the Y-channel histogram via `signalstats`. Heuristic:

  graded SDR     : wide dynamic range (YMAX-YMIN > 220), high YSTDEV
  log / flat     : compressed range (YMAX < 200, YMIN > 20), low YSTDEV

Score 1.0 = graded, 0.0 = ungraded. Used as gentle positive bonus —
ungraded clips still allowed in the highlight, just slightly less
favored. (Don't make this a hard penalty — sometimes the entire source
is graded uniformly.)
"""

from __future__ import annotations

import re
import subprocess


def available() -> bool:
    return True


YMIN_RE = re.compile(r"lavfi\.signalstats\.YMIN=(\d+)")
YMAX_RE = re.compile(r"lavfi\.signalstats\.YMAX=(\d+)")
YSTDEV_RE = re.compile(r"lavfi\.signalstats\.YSTDEV=([\d.]+)")


def _shot_grade(ffmpeg: str, video: str, start: float, end: float) -> float:
    duration = max(0.1, min(end - start, 4.0))
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
        "-i", video,
        "-vf", "scale=240:135,signalstats,metadata=mode=print",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
    except Exception:  # noqa: BLE001
        return 0.5
    ymin = [int(m) for m in YMIN_RE.findall(r.stderr)]
    ymax = [int(m) for m in YMAX_RE.findall(r.stderr)]
    ystd = [float(m) for m in YSTDEV_RE.findall(r.stderr)]
    if not ymin or not ymax:
        return 0.5
    avg_min = sum(ymin) / len(ymin)
    avg_max = sum(ymax) / len(ymax)
    avg_std = sum(ystd) / len(ystd) if ystd else 30.0
    dyn_range = avg_max - avg_min
    # Score components
    # Dynamic range: > 220 = graded (1.0), < 160 = log (0.0)
    range_score = max(0.0, min(1.0, (dyn_range - 160) / 60.0))
    # Std dev: > 60 = contrasty/graded (1.0), < 25 = flat/log (0.0)
    std_score = max(0.0, min(1.0, (avg_std - 25) / 35.0))
    return 0.5 * range_score + 0.5 * std_score


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        out[i] = _shot_grade(ffmpeg, video, s, e)
    return out

"""Scene detection — prefers PySceneDetect when available, falls back to
ffmpeg's `select='gt(scene,T)'` filter when not.

PySceneDetect's ContentDetector uses HSV color differences plus luma deltas,
which is more robust than ffmpeg's raw scene-change metric:
  - Handles fade-to-black/white without false positives
  - Correctly catches cross-dissolves as gradual transitions (not flash cuts)
  - Stable threshold mapping: PySceneDetect default 27.0 ≈ ffmpeg 0.4
"""

from __future__ import annotations

import re
import subprocess


PTS_RE = re.compile(r"pts_time:([\d.]+)")


def pyscenedetect_available() -> bool:
    try:
        from scenedetect import detect, ContentDetector  # noqa: F401
        return True
    except ImportError:
        return False


def _ffmpeg_threshold_to_pyscenedetect(t: float) -> float:
    """Map ffmpeg's 0..1 scene metric onto PySceneDetect's 0..100 scale.
    ffmpeg 0.4 ≈ PySceneDetect 27 (the default). Linear interpolation."""
    return max(5.0, min(95.0, t * 67.5))


def detect_cuts(ffmpeg: str, video: str, threshold: float,
                logger=None) -> list[float]:
    """Return shot-boundary timestamps in seconds, sorted ascending.

    Tries PySceneDetect first. Falls back to ffmpeg's scene filter on
    ImportError or any other failure. Both modes return the same data
    schema so callers don't need to care which engine ran.
    """
    if pyscenedetect_available():
        try:
            from scenedetect import detect, ContentDetector  # type: ignore
            ps_threshold = _ffmpeg_threshold_to_pyscenedetect(threshold)
            scenes = detect(
                video,
                ContentDetector(threshold=ps_threshold, min_scene_len=12),
                show_progress=False,
            )
            cuts = sorted({float(s[0].get_seconds()) for s in scenes if s[0]})
            if logger:
                logger(f"PySceneDetect: {len(cuts)} cuts (threshold={ps_threshold:.1f})")
            if cuts:
                return cuts
        except Exception as exc:
            if logger:
                logger(f"PySceneDetect failed ({exc}); falling back to ffmpeg")
    return _ffmpeg_detect(ffmpeg, video, threshold, logger)


def _ffmpeg_detect(ffmpeg: str, video: str, threshold: float,
                   logger=None) -> list[float]:
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-i", video,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-an", "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        cuts = sorted({float(m) for m in PTS_RE.findall(proc.stderr)})
        if logger:
            logger(f"ffmpeg scene-detect: {len(cuts)} cuts (threshold={threshold})")
        return cuts
    except Exception as exc:  # noqa: BLE001
        if logger:
            logger(f"ffmpeg detect_cuts failed: {exc}")
        return []

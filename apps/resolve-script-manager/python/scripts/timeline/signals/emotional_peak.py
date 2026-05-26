"""Emotional peak detection.

Emotional peaks in wedding/documentary footage typically feature an audio
crescendo (music swell or applause) coinciding with sustained visual
motion (camera movement following the moment). We compute, for each
shot:

  audio_crescendo  = peak-RMS / mean-RMS within the shot
                     (high = swelling music)
  motion_sustain   = fraction of mid-shot frames with > 30 % of peak motion
                     (high = continuous coverage, not flash-cut)

Score = sigmoid combining both. Returns 0..1.

Requires librosa. Falls back to ffmpeg-RMS-only if librosa is missing.
"""

from __future__ import annotations

import math
import os
import subprocess
import tempfile


def available() -> bool:
    try:
        import librosa  # noqa: F401
        return True
    except ImportError:
        return False


def _crescendo_via_librosa(ffmpeg: str, video: str, start: float, end: float) -> float:
    import numpy as np  # type: ignore
    import librosa  # type: ignore
    duration = max(0.3, end - start)
    fd, tmp = tempfile.mkstemp(prefix="emo_", suffix=".wav")
    os.close(fd)
    try:
        r = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
             "-i", video,
             "-vn", "-acodec", "pcm_s16le", "-ar", "22050", "-ac", "1",
             tmp],
            capture_output=True, timeout=25,
        )
        if r.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) < 1000:
            return 0.0
        y, sr = librosa.load(tmp, sr=22050, mono=True)
        if y.size < sr // 2:
            return 0.0
        # 50ms hop, 100ms window RMS
        hop = 1102
        rms = librosa.feature.rms(y=y, frame_length=2205, hop_length=hop)[0]
        if rms.size < 4:
            return 0.0
        # Crescendo signal: rising RMS over the shot. Score is the linear
        # regression slope normalized by mean (positive slope = swelling).
        peak = float(np.max(rms))
        mean = float(np.mean(rms))
        if mean < 1e-6:
            return 0.0
        ratio = peak / mean
        # ratio of 2+ is a clear swell; 1.0 = flat
        return float(min(1.0, max(0.0, (ratio - 1.1) / 1.4)))
    except Exception:  # noqa: BLE001
        return 0.0
    finally:
        try: os.unlink(tmp)
        except OSError: pass


def _motion_sustain(ffmpeg: str, video: str, start: float, end: float) -> float:
    """How sustained is visual motion in this shot? Returns 0..1."""
    import re
    duration = max(0.3, end - start)
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-y",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
        "-i", video,
        "-vf", "scale=160:90,scdet=threshold=0:sc_pass=0",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        deltas = [float(m) for m in re.findall(r"lavfi\.scd\.score[:=]\s*([\d.]+)", r.stderr)]
    except Exception:  # noqa: BLE001
        return 0.0
    if not deltas:
        return 0.0
    peak = max(deltas)
    if peak < 0.1:
        return 0.0
    threshold = peak * 0.3
    above = sum(1 for d in deltas if d >= threshold)
    return above / len(deltas)


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        if e - s < 0.4:
            out[i] = 0.0
            continue
        crescendo = _crescendo_via_librosa(ffmpeg, video, s, e)
        sustain = _motion_sustain(ffmpeg, video, s, e)
        # Combine multiplicatively — needs BOTH signals to be high
        combined = math.sqrt(crescendo * sustain) if crescendo > 0 and sustain > 0 else 0.0
        out[i] = combined
    return out

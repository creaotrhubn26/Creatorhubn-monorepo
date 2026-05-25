"""Speech detection — used as a penalty signal in highlight scoring.

Dialog-heavy shots tear a highlight out of its rhythm: you can't drop a
2-second clip of someone mid-sentence into a music-driven montage. We
detect speech via WebRTC VAD (voice-activity-detection) on each shot's
audio and return a value in [0, 1] representing the fraction of speech-
heavy frames. The orchestrator multiplies by the genre's `speech` weight
(usually negative for wedding/music-video, slightly positive for
corporate where speech IS the content).

Requires `webrtcvad` package. Gracefully unavailable otherwise.
"""

from __future__ import annotations

import os
import subprocess
import tempfile


def available() -> bool:
    try:
        import webrtcvad  # noqa: F401
        return True
    except ImportError:
        return False


def _extract_pcm(ffmpeg: str, video: str, start: float, end: float) -> bytes | None:
    """Pull a mono 16kHz s16le PCM stream of the shot's audio. WebRTC VAD
    requires this exact format, in 10/20/30ms frames."""
    duration = max(0.1, end - start)
    fd, tmp = tempfile.mkstemp(prefix="vad_", suffix=".pcm")
    os.close(fd)
    try:
        r = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
             "-i", video,
             "-vn", "-acodec", "pcm_s16le",
             "-ar", "16000", "-ac", "1",
             "-f", "s16le", tmp],
            capture_output=True, timeout=30,
        )
        if r.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) < 320:
            return None
        with open(tmp, "rb") as f:
            return f.read()
    except Exception:  # noqa: BLE001
        return None
    finally:
        try: os.unlink(tmp)
        except OSError: pass


def _speech_fraction(pcm: bytes) -> float:
    """Run WebRTC VAD over 30ms frames; return frac of frames classified
    as speech (0..1). Aggressiveness 2 = moderate; high enough to suppress
    music being falsely flagged as speech."""
    import webrtcvad  # type: ignore
    vad = webrtcvad.Vad(2)
    # 30 ms @ 16 kHz mono s16le = 960 bytes per frame
    frame_size = 960
    total = 0
    voiced = 0
    for i in range(0, len(pcm) - frame_size, frame_size):
        frame = pcm[i:i + frame_size]
        try:
            if vad.is_speech(frame, 16000):
                voiced += 1
        except Exception:  # noqa: BLE001
            continue
        total += 1
    if total == 0:
        return 0.0
    return voiced / total


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        if e - s < 0.3:
            out[i] = 0.0
            continue
        pcm = _extract_pcm(ffmpeg, video, s, e)
        if pcm is None:
            out[i] = 0.0
            continue
        # Return speech fraction inverted: 1.0 = no speech, 0.0 = all speech.
        # The genre weight handles sign (negative = penalty, positive = bonus).
        # We return the raw "speech-presence" value 0..1 so the orchestrator
        # can apply the weight cleanly.
        out[i] = _speech_fraction(pcm)
    return out

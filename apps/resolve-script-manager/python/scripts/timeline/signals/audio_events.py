"""YAMNet audio-event-detection signal.

Wedding-relevant audio events score per shot — applaus/latter/gråt/music
er sterke proxies for "emotional moment" som motion+audio-volume ikke
fanger. F.eks. tear-of-joy under vows = lav audio-volum, lav motion, men
SHOULD score high; YAMNet detekterer crying/sobbing direkte.

YAMNet er Googles open-source 521-klasses audio-event-classifier (AudioSet
ontology). TFLite-modell ~17MB. Inferens ~1s per 1s audio på CPU.

Wedding-relevante AudioSet-indekser (vekter trent inn):
  132 applause          → ceremony reactions, moments after kiss
  133 clapping          → applause's sibling
  162 laughter          → joy moments
  163 baby laughter
  164 giggle
  170 chuckle, chortle
  173 crying, sobbing   → emotional vows / tears of joy
  175 wail              → strong-emotion
  176 whimper
  293 music
   0  speech            → suppresses (we don't boost speech-only shots)

Falls graceful → om tensorflow eller tensorflow-hub mangler, signalet
returnerer 0 og logger en hint. Ikke i R2.
"""

from __future__ import annotations

import os
import subprocess
import tempfile


# Subset of AudioSet ontology indices that signal emotional-moments in
# wedding/social context. Values are weights (positive = boost, negative =
# suppress).
WEDDING_EVENT_WEIGHTS: dict[int, float] = {
    132: 0.9,   # applause
    133: 0.8,   # clapping
    162: 1.0,   # laughter
    163: 0.85,  # baby laughter
    164: 0.6,   # giggle
    170: 0.7,   # chuckle/chortle
    173: 1.0,   # crying, sobbing
    175: 0.9,   # wail
    176: 0.7,   # whimper
    293: 0.3,   # music — mild bonus (background-score moments)
    0:  -0.10,  # speech alone — slight suppress (use other signals for dialog)
}


def available() -> bool:
    try:
        import tensorflow as tf  # noqa: F401
        import tensorflow_hub as hub  # noqa: F401
        return True
    except ImportError:
        return False


_MODEL = None


def _load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    try:
        import tensorflow_hub as hub  # type: ignore
        # Google's YAMNet — cached to ~/.cache/tfhub after first download
        _MODEL = hub.load("https://tfhub.dev/google/yamnet/1")
        return _MODEL
    except Exception:  # noqa: BLE001
        return None


def _extract_audio(ffmpeg: str, video: str, start: float, end: float) -> str | None:
    """16kHz mono WAV — YAMNet's expected input format."""
    duration = max(0.3, end - start)
    fd, tmp = tempfile.mkstemp(prefix="yamnet_", suffix=".wav")
    os.close(fd)
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
        "-i", video,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        tmp,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=30)
        if r.returncode == 0 and os.path.getsize(tmp) > 320:
            return tmp
    except Exception:  # noqa: BLE001
        pass
    try: os.unlink(tmp)
    except OSError: pass
    return None


def _classify_audio(model, wav_path: str) -> dict[int, float]:
    """Run YAMNet → return {class_idx: peak_score} for the wedding subset.
    YAMNet outputs (N_patches, 521) scores; we take MAX per class over the
    shot duration so a brief 200ms laugh-burst still scores."""
    try:
        import tensorflow as tf  # type: ignore
        import numpy as np  # type: ignore
    except ImportError:
        return {}
    try:
        audio_binary = tf.io.read_file(wav_path)
        audio, _sr = tf.audio.decode_wav(audio_binary, desired_channels=1)
        audio = tf.squeeze(audio, axis=-1)
        scores, _embeddings, _spec = model(audio)
        scores_np = scores.numpy()
        max_per_class = np.max(scores_np, axis=0)  # (521,)
        result: dict[int, float] = {}
        for cls_idx in WEDDING_EVENT_WEIGHTS:
            if cls_idx < max_per_class.shape[0]:
                result[cls_idx] = float(max_per_class[cls_idx])
        return result
    except Exception:  # noqa: BLE001
        return {}


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    model = _load_model()
    if model is None:
        return {}
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        if e - s < 0.4:
            out[i] = 0.0
            continue
        wav = _extract_audio(ffmpeg, video, s, e)
        if wav is None:
            out[i] = 0.0
            continue
        try:
            class_scores = _classify_audio(model, wav)
            # Weighted sum, clipped to [0, 1]
            total = sum(class_scores.get(c, 0) * w
                        for c, w in WEDDING_EVENT_WEIGHTS.items())
            out[i] = max(0.0, min(1.0, total / 1.5))
        finally:
            try: os.unlink(wav)
            except OSError: pass
    return out

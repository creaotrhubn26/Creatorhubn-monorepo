"""MERT music-feature encoder — replaces librosa-based section signals.

MERT (m-a-p, MIT) er state-of-art music-feature-encoder pretrent på
1M+ tracks. ~330MB. Returnerer 768-dim embedding per audio-chunk som
fanger genre, instrumentation, mood — bedre enn librosa's MFCC-baserte
features for music-video pipelines.

Direkte bruk i Post Agent:
  - Per song-section (verse/chorus/bridge): hent MERT-embedding,
    sammenlign med wedding-music-archetypes — boost chorus-segmenter
    som matcher "uplifting" vs "melancholic" archetypes.
  - Per shot: ikke direkte applikabelt — denne signalet returnerer en
    GLOBAL music-features-vektor som assign_clips_to_beats kan bruke
    for å vekte chorus-segmenter ulikt basert på mood.

Compute returnerer en CONSTANT 1.0 for alle shots (signalet er for global
contextualization, ikke per-shot scoring). Genre_weights-vekten på dette
signalet er typisk 0 — det er en future-use-case-data-source, ikke en
direkte highlight-rangerer.

Krever transformers + torch + librosa.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile


def available() -> bool:
    try:
        from transformers import AutoModel, Wav2Vec2FeatureExtractor  # noqa: F401
        import torch  # noqa: F401
        return True
    except ImportError:
        return False


_MERT_STATE: dict = {}


def _load_model():
    if "ready" in _MERT_STATE:
        return _MERT_STATE.get("model"), _MERT_STATE.get("processor"), _MERT_STATE.get("device")
    try:
        from transformers import AutoModel, Wav2Vec2FeatureExtractor  # type: ignore
        import torch  # type: ignore
    except ImportError:
        _MERT_STATE["ready"] = False
        return None, None, None
    try:
        model_id = "m-a-p/MERT-v1-95M"  # smaller variant, 95M params
        processor = Wav2Vec2FeatureExtractor.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModel.from_pretrained(model_id, trust_remote_code=True)
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        model = model.to(device).eval()
        _MERT_STATE.update({"model": model, "processor": processor,
                            "device": device, "ready": True})
        return model, processor, device
    except Exception:  # noqa: BLE001
        _MERT_STATE["ready"] = False
        return None, None, None


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
EMBEDDING_CACHE = os.path.join(CACHE_DIR, "last_music_embedding.json")


def compute_music_embedding(audio_path: str) -> list[float] | None:
    """Compute global MERT-embedding for a music-file. Writes cached
    JSON for downstream use. Returns the 768-dim vector or None on failure."""
    model, processor, device = _load_model()
    if model is None:
        return None
    try:
        import torch  # type: ignore
        import librosa  # type: ignore
        import numpy as np  # type: ignore
    except ImportError:
        return None
    try:
        # MERT expects 24kHz mono
        y, sr = librosa.load(audio_path, sr=24000, mono=True)
        if len(y) < sr:
            return None
        # Sample center-30s (avoid intro/outro silence)
        if len(y) > 30 * sr:
            start = (len(y) - 30 * sr) // 2
            y = y[start:start + 30 * sr]
        inputs = processor(y, sampling_rate=sr, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = model(**inputs, output_hidden_states=True)
        # Mean-pool across time + use second-to-last layer (canonical MERT
        # convention from the paper for content features)
        hidden = outputs.hidden_states[-2][0].mean(dim=0).cpu().numpy()
        emb = hidden.tolist()
        # Cache for downstream consumption
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(EMBEDDING_CACHE, "w") as f:
                json.dump({"audioPath": audio_path, "embedding": emb,
                           "dim": len(emb)}, f)
        except OSError:
            pass
        return emb
    except Exception:  # noqa: BLE001
        return None


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    """Per-shot returns 1.0 — this signal is a CONTEXT data-source, not a
    direct per-shot scorer. The MERT embedding is computed once globally
    via compute_music_embedding(music_path) and cached for downstream
    music-video-section-vs-archetype lookups.

    We return 1.0 for every shot so the signal-registry sees it as "ready"
    but the orchestrator's weighted-sum effectively ignores it (genre_weights
    for music_features defaults to 0).
    """
    return {i: 1.0 for i in range(len(shots))}

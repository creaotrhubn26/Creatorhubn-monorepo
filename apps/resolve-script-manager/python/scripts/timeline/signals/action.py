"""VideoMAE v2 action-classification signal.

Sampler 16 frames jevnt over hver shot → action-class-probabilities.
Boost shots with wedding-relevante actions:
  dancing, kissing, hugging, walking_with_purpose, sitting_in_ceremony,
  cake_cutting (mappet til 'eating'), applauding, crying, laughing

VideoMAE v2 (Microsoft, MIT) trent på Kinetics-710 (710 klasser). HF
hosts pre-trained checkpoint. Modell ~250MB. Inferens ~1-2s per shot
på Apple Silicon MPS.

Krever: transformers + decord (eller pyav for frame-reading).
"""

from __future__ import annotations

import os
import subprocess
import tempfile


# Subset of Kinetics-710 / SSv2 class indices weighted for wedding/social.
# Indices may need lookup against the model's id2label dict at inference time.
WEDDING_ACTION_PATTERNS: dict[str, float] = {
    "dancing":          0.95,
    "hugging":          0.85,
    "kissing":          1.00,
    "applauding":       0.80,
    "crying":           0.85,
    "laughing":         0.75,
    "smiling":          0.55,
    "cutting cake":     0.90,
    "cake":             0.40,
    "drinking":         0.30,
    "playing music":    0.55,
    "singing":          0.55,
    "talking":          0.20,
    "walking":          0.10,
    "sitting":          0.10,
}


def available() -> bool:
    try:
        from transformers import VideoMAEImageProcessor, VideoMAEForVideoClassification  # noqa: F401
        return True
    except ImportError:
        return False


_MODEL_STATE: dict = {}


def _load_model():
    if "ready" in _MODEL_STATE:
        return _MODEL_STATE.get("model"), _MODEL_STATE.get("processor"), _MODEL_STATE.get("device")
    try:
        from transformers import (  # type: ignore
            VideoMAEImageProcessor,
            VideoMAEForVideoClassification,
        )
        import torch  # type: ignore
    except ImportError:
        _MODEL_STATE["ready"] = False
        return None, None, None
    try:
        # Use the largest publicly-available action-classifier
        # MCG-NJU/videomae-base-finetuned-kinetics has 400 K400 classes
        model_id = "MCG-NJU/videomae-base-finetuned-kinetics"
        processor = VideoMAEImageProcessor.from_pretrained(model_id)
        model = VideoMAEForVideoClassification.from_pretrained(model_id)
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        model = model.to(device).eval()
        _MODEL_STATE.update({"model": model, "processor": processor,
                             "device": device, "ready": True})
        return model, processor, device
    except Exception:  # noqa: BLE001
        _MODEL_STATE["ready"] = False
        return None, None, None


def _extract_clip_frames(ffmpeg: str, video: str, start: float, end: float,
                        n_frames: int = 16) -> list:
    """Sample n_frames evenly spaced across [start, end] and return as
    list of numpy arrays (RGB)."""
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except ImportError:
        return []
    duration = max(0.3, end - start)
    timestamps = [start + (duration * i / max(1, n_frames - 1)) for i in range(n_frames)]
    frames: list = []
    for ts in timestamps:
        fd, tmp = tempfile.mkstemp(prefix="vmae_", suffix=".jpg")
        os.close(fd)
        try:
            subprocess.run(
                [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                 "-ss", f"{ts:.3f}", "-i", video,
                 "-vframes", "1", "-q:v", "3",
                 "-vf", "scale=224:224:force_original_aspect_ratio=increase,crop=224:224",
                 tmp],
                capture_output=True, timeout=8,
            )
            if os.path.exists(tmp):
                img = cv2.imread(tmp)
                if img is not None:
                    frames.append(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        finally:
            try: os.unlink(tmp)
            except OSError: pass
    return frames if len(frames) == n_frames else []


def _classify_clip(model, processor, device, frames: list) -> dict[str, float]:
    """Returns {label: prob} for the top-10 predicted actions."""
    try:
        import torch  # type: ignore
        inputs = processor(frames, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits[0]
            probs = torch.softmax(logits, dim=-1).cpu().numpy()
        id2label = model.config.id2label
        # Top-10
        top_indices = probs.argsort()[-10:][::-1]
        return {id2label[i]: float(probs[i]) for i in top_indices}
    except Exception:  # noqa: BLE001
        return {}


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    model, processor, device = _load_model()
    if model is None:
        return {}
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        if e - s < 0.8:  # need enough duration for 16-frame sample
            out[i] = 0.0
            continue
        frames = _extract_clip_frames(ffmpeg, video, s, e)
        if not frames:
            out[i] = 0.0
            continue
        preds = _classify_clip(model, processor, device, frames)
        if not preds:
            out[i] = 0.0
            continue
        # Weighted max — find any wedding-relevant action with high prob
        score = 0.0
        for label, prob in preds.items():
            label_lc = label.lower()
            for pattern, weight in WEDDING_ACTION_PATTERNS.items():
                if pattern in label_lc:
                    candidate = prob * weight
                    if candidate > score:
                        score = candidate
        out[i] = max(0.0, min(1.0, score))
    return out

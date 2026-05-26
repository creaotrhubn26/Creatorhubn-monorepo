"""Depth Anything v2 signal — depth-distribution analytics per shot.

Bytedance's Depth Anything v2 (Apache-2 license, ~150MB) gir state-of-art
single-image depth estimation. Vi bruker depth-distribution som proxy
for "cinematic" — close-up portrait med blur'd background har bimodal
depth-distribution (sharp foreground spike + blurred background mass),
mens flat handheld-shot har uniform depth.

Per shot:
  cinematic_score = std(depth_map) / mean(depth_map)
                    boosted hvis foreground-depth-cluster < 0.3
                    (signaler shallow-DOF)

Krever transformers + depth_anything_v2. Modell auto-downloaded fra HF
første kjøring.

Future bonus: depth-map kan også brukes til SYNTETISK BOKEH-effekt på
flate footage (foreground sharp + gaussian-blurred background masked
av depth) — separate render-script kommer i neste batch.
"""

from __future__ import annotations

import os
import subprocess
import tempfile


def available() -> bool:
    try:
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation  # noqa: F401
        return True
    except ImportError:
        return False


_DEPTH_STATE: dict = {}


def _load_model():
    if "ready" in _DEPTH_STATE:
        return _DEPTH_STATE.get("model"), _DEPTH_STATE.get("processor"), _DEPTH_STATE.get("device")
    try:
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation  # type: ignore
        import torch  # type: ignore
    except ImportError:
        _DEPTH_STATE["ready"] = False
        return None, None, None
    try:
        # Small (97M params) — good speed/accuracy ratio for shot-scoring
        model_id = "depth-anything/Depth-Anything-V2-Small-hf"
        processor = AutoImageProcessor.from_pretrained(model_id)
        model = AutoModelForDepthEstimation.from_pretrained(model_id)
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        model = model.to(device).eval()
        _DEPTH_STATE.update({"model": model, "processor": processor,
                             "device": device, "ready": True})
        return model, processor, device
    except Exception:  # noqa: BLE001
        _DEPTH_STATE["ready"] = False
        return None, None, None


def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    fd, tmp = tempfile.mkstemp(prefix="depth_", suffix=".jpg")
    os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts:.3f}", "-i", video,
             "-vframes", "1", "-q:v", "3",
             "-vf", "scale=518:-1",
             tmp],
            capture_output=True, timeout=12,
        )
        return tmp if os.path.exists(tmp) else None
    except Exception:  # noqa: BLE001
        return None


def _estimate_cinematic_from_depth(model, processor, device, image_path: str) -> float:
    """Run depth-estimation, then compute a 0..1 "cinematic depth" score.

    Heuristic:
      - Compute std/mean of depth map (depth-variance proxy)
      - Find dominant peak (foreground-cluster center)
      - Bonus if peak is < 0.3 of max-depth (close subject + far blur)
    """
    try:
        from PIL import Image
        import torch  # type: ignore
        import numpy as np  # type: ignore
        img = Image.open(image_path).convert("RGB")
        inputs = processor(images=img, return_tensors="pt").to(device)
        with torch.no_grad():
            out = model(**inputs)
            depth = out.predicted_depth[0].cpu().numpy()
        if depth.size == 0:
            return 0.0
        d_norm = depth / (depth.max() + 1e-6)
        d_std = float(np.std(d_norm))
        d_mean = float(np.mean(d_norm))
        variance_score = min(1.0, d_std / max(0.05, d_mean) / 0.7)

        # Find foreground-cluster center via histogram peak
        hist, edges = np.histogram(d_norm.flatten(), bins=20, range=(0, 1))
        peak_idx = int(hist.argmax())
        peak_depth = (edges[peak_idx] + edges[peak_idx + 1]) / 2
        # Bonus when peak is close (< 0.3) — indicates close subject
        proximity_bonus = max(0.0, (0.3 - peak_depth)) * 1.5

        return max(0.0, min(1.0, variance_score * 0.7 + proximity_bonus))
    except Exception:  # noqa: BLE001
        return 0.0


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    model, processor, device = _load_model()
    if model is None:
        return {}
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        ts = (s + e) / 2
        tmp = _sample_frame(ffmpeg, video, ts)
        if tmp is None:
            out[i] = 0.0
            continue
        try:
            out[i] = _estimate_cinematic_from_depth(model, processor, device, tmp)
        finally:
            try: os.unlink(tmp)
            except OSError: pass
    return out

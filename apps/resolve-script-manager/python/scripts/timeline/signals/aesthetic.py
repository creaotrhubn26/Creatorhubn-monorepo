"""LAION-Aesthetic-Predictor v2 — cinematic-score per shot.

Uses CLIP ViT-L/14 image-embedding fed into a small linear regressor
trained on the LAION-Aesthetics dataset. Outputs a 1-10 score that
correlates well with "looks like a curated photo" (good composition,
lighting, focus, color).

Wedding-impact: shots med rule-of-thirds + nice bokeh + golden-hour
light scorer høyt. Snapshots med flat lys + clutter scorer lavt. Lar
extract_highlight_from_film prioritere cinematic over chaotic.

Krever:
  - open_clip_torch (pip)
  - torch (allerede dep)
  - Pre-trained LAION aesthetic predictor weights (last fra
    https://github.com/christophschuhmann/improved-aesthetic-predictor —
    sac+logos+ava1-l14-linearMSE.pth, ~3MB)
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile


_PYTHON_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _PYTHON_ROOT not in sys.path:
    sys.path.insert(0, _PYTHON_ROOT)
try:
    import bridge as _bridge  # noqa: E402
except ImportError:
    _bridge = None  # type: ignore[assignment]


def available() -> bool:
    try:
        import open_clip  # noqa: F401
        import torch  # noqa: F401
        return True
    except ImportError:
        return False


# LAION's aesthetic-predictor MLP weights URL. Single file, ~3MB.
LAION_AESTHETIC_URL = (
    "https://github.com/christophschuhmann/improved-aesthetic-predictor/"
    "raw/main/sac%2Blogos%2Bava1-l14-linearMSE.pth"
)
LAION_AESTHETIC_LOCAL = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/"
    "ai_models_cache/laion-aesthetic-sac-logos-ava1-l14.pth"
)


def _ensure_weights() -> str | None:
    if os.path.isfile(LAION_AESTHETIC_LOCAL) and os.path.getsize(LAION_AESTHETIC_LOCAL) > 100_000:
        return LAION_AESTHETIC_LOCAL
    os.makedirs(os.path.dirname(LAION_AESTHETIC_LOCAL), exist_ok=True)
    try:
        import urllib.request
        if _bridge is not None:
            _bridge.log(f"Downloading LAION aesthetic predictor from GitHub…")
        urllib.request.urlretrieve(LAION_AESTHETIC_URL, LAION_AESTHETIC_LOCAL)
        return LAION_AESTHETIC_LOCAL
    except Exception:  # noqa: BLE001
        if _bridge is not None:
            _bridge.warn("Could not download LAION aesthetic weights — skipping signal")
        return None


_MODEL_STATE: dict = {}


def _load_models():
    """Lazy-init CLIP + aesthetic-MLP. Cached after first call."""
    if "ready" in _MODEL_STATE:
        return _MODEL_STATE.get("clip"), _MODEL_STATE.get("aesthetic"), _MODEL_STATE.get("preprocess"), _MODEL_STATE.get("device")
    try:
        import open_clip  # type: ignore
        import torch  # type: ignore
        from torch import nn
    except ImportError:
        _MODEL_STATE["ready"] = False
        return None, None, None, None

    weights = _ensure_weights()
    if not weights:
        _MODEL_STATE["ready"] = False
        return None, None, None, None

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    clip_model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-L-14", pretrained="openai", device=device,
    )
    clip_model.eval()

    # Aesthetic predictor: simple MLP over 768-dim CLIP-ViT-L embeddings
    class AestheticMLP(nn.Module):
        def __init__(self, in_dim: int = 768):
            super().__init__()
            self.layers = nn.Sequential(
                nn.Linear(in_dim, 1024), nn.Dropout(0.2),
                nn.Linear(1024, 128), nn.Dropout(0.2),
                nn.Linear(128, 64), nn.Dropout(0.1),
                nn.Linear(64, 16), nn.Linear(16, 1),
            )
        def forward(self, x):
            return self.layers(x)

    mlp = AestheticMLP().to(device)
    state = torch.load(weights, map_location=device)
    mlp.load_state_dict(state)
    mlp.eval()

    _MODEL_STATE.update({
        "clip": clip_model, "aesthetic": mlp,
        "preprocess": preprocess, "device": device, "ready": True,
    })
    return clip_model, mlp, preprocess, device


def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    fd, tmp = tempfile.mkstemp(prefix="aesth_", suffix=".jpg")
    os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts:.3f}", "-i", video,
             "-vframes", "1", "-q:v", "3",
             "-vf", "scale=512:-1",
             tmp],
            capture_output=True, timeout=12,
        )
        return tmp if os.path.exists(tmp) and os.path.getsize(tmp) > 1000 else None
    except Exception:  # noqa: BLE001
        return None


def _score_frame(clip_model, mlp, preprocess, device, image_path: str) -> float:
    """Returns aesthetic score normalised to [0, 1]. LAION's raw output is
    ~1-10; we map (3..9) → (0..1) which captures the meaningful range."""
    try:
        import torch  # type: ignore
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        tensor = preprocess(img).unsqueeze(0).to(device)
        with torch.no_grad():
            emb = clip_model.encode_image(tensor)
            # normalize embeddings (LAION trained on normalized features)
            emb = emb / emb.norm(dim=-1, keepdim=True)
            score = mlp(emb.float()).cpu().numpy()[0][0]
        # Map 3..9 → 0..1 (clamp). LAION raw range is ~1-10 but practical
        # variance is 3.5-8.5 for natural imagery.
        return max(0.0, min(1.0, (float(score) - 3.0) / 6.0))
    except Exception:  # noqa: BLE001
        return 0.0


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    clip_model, mlp, preprocess, device = _load_models()
    if clip_model is None:
        return {}
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        # Sample 2 frames evenly through the shot, take the max
        scores: list[float] = []
        for frac in (0.33, 0.66):
            ts = s + (e - s) * frac
            tmp = _sample_frame(ffmpeg, video, ts)
            if tmp is None:
                continue
            try:
                scores.append(_score_frame(clip_model, mlp, preprocess, device, tmp))
            finally:
                try: os.unlink(tmp)
                except OSError: pass
        out[i] = max(scores) if scores else 0.0
    return out

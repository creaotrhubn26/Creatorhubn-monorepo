"""Post Agent's view of the Role Room R2 AI-model registry.

Mirrors a subset of backend/server/index.ts's DEFAULT_AI_MODEL_SPECS so
scripts can request models by stable id and get them downloaded via
bridge.r2_download(). Only contains models that Post Agent actually uses;
the canonical full list lives backend-side.

Adding a new model:
  1. Confirm the R2 key in the backend registry
  2. Add an entry here with the SAME id so cache-paths stay consistent
  3. Update the relevant script to call ensure_local_model(id)
"""

from __future__ import annotations

import os
import sys
from typing import TypedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bridge


class ModelSpec(TypedDict):
    """One model the Post Agent knows how to download from R2."""
    id: str
    r2_key: str
    description: str
    min_bytes: int
    pip_packages: tuple[str, ...]  # informational — packages that consume the weights


REGISTRY: dict[str, ModelSpec] = {
    # ── SAM2 segmentation ────────────────────────────────────────────────
    "sam2-tiny": {
        "id": "sam2-tiny",
        "r2_key": "models/sam2/sam2_hiera_tiny.pt",
        "description": "Meta SAM2 (Segment Anything 2) — tiny variant, ~150MB",
        "min_bytes": 100_000_000,
        "pip_packages": ("sam2",),
    },
    "sam2-small": {
        "id": "sam2-small",
        "r2_key": "models/sam2/sam2_hiera_small.pt",
        "description": "Meta SAM2 small variant, ~200MB",
        "min_bytes": 150_000_000,
        "pip_packages": ("sam2",),
    },

    # ── Whisper (OpenAI .pt format) ──────────────────────────────────────
    # Note: WhisperX uses CTranslate2 format from HF, NOT these. These are
    # for direct use with openai-whisper package (alternative transcription
    # path when WhisperX is unavailable or for offline use).
    "whisper-tiny": {
        "id": "whisper-tiny",
        "r2_key": "models/whisper/tiny.pt",
        "description": "OpenAI Whisper tiny — fast, lower accuracy (~75MB)",
        "min_bytes": 50_000_000,
        "pip_packages": ("openai-whisper",),
    },
    "whisper-base": {
        "id": "whisper-base",
        "r2_key": "models/whisper/base.pt",
        "description": "OpenAI Whisper base (~140MB)",
        "min_bytes": 100_000_000,
        "pip_packages": ("openai-whisper",),
    },
    "whisper-medium": {
        "id": "whisper-medium",
        "r2_key": "models/whisper/medium.pt",
        "description": "OpenAI Whisper medium (~1.5GB)",
        "min_bytes": 1_000_000_000,
        "pip_packages": ("openai-whisper",),
    },
    "whisper-large": {
        "id": "whisper-large",
        "r2_key": "models/whisper/large-v2.pt",
        "description": "OpenAI Whisper large-v2 (~3GB)",
        "min_bytes": 2_500_000_000,
        "pip_packages": ("openai-whisper",),
    },

    # ── GFPGAN face restoration ──────────────────────────────────────────
    "gfpgan-v1.4": {
        "id": "gfpgan-v1.4",
        "r2_key": "models/gfpgan/weights/GFPGANv1.4.pth",
        "description": "Tencent GFPGAN v1.4 — face restoration (~340MB)",
        "min_bytes": 300_000_000,
        "pip_packages": ("gfpgan",),
    },

    # ── REMBG background removal ─────────────────────────────────────────
    "rembg-u2net": {
        "id": "rembg-u2net",
        "r2_key": "models/rembg/u2net/u2net.onnx",
        "description": "U2Net for general background removal (~170MB)",
        "min_bytes": 100_000_000,
        "pip_packages": ("rembg",),
    },

    # ── Real-ESRGAN upscaling ────────────────────────────────────────────
    "realesrgan-x4plus": {
        "id": "realesrgan-x4plus",
        "r2_key": "models/realesrgan/experiments/pretrained_models/RealESRGAN_x4plus.pth",
        "description": "Real-ESRGAN 4× video upscale (~64MB)",
        "min_bytes": 50_000_000,
        "pip_packages": ("realesrgan",),
    },

    # ── Audio denoise ────────────────────────────────────────────────────
    "fullsubnet-plus": {
        "id": "fullsubnet-plus",
        "r2_key": "models/audio/fullsubnet/fullsubnet_plus.pth",
        "description": "FullSubNet+ noise-suppression (~80MB)",
        "min_bytes": 50_000_000,
        "pip_packages": ("fullsubnet",),  # custom — uses research repo
    },
    "flowse": {
        "id": "flowse",
        "r2_key": "models/audio/flowse/MeanFlowSE-Weights.ckpt",
        "description": "MeanFlowSE speech enhancement (~150MB)",
        "min_bytes": 100_000_000,
        "pip_packages": (),
    },
}


def ensure_local_model(model_id: str, force: bool = False) -> str | None:
    """Return local path to a registered model, downloading from R2 if needed.

    Returns None if R2 is not configured OR download failed. Caller should
    handle None gracefully (fall back to HF / skip optional feature).
    """
    spec = REGISTRY.get(model_id)
    if not spec:
        bridge.warn(f"Unknown model id: {model_id}")
        return None
    return bridge.r2_download(
        spec["r2_key"],
        expected_min_bytes=spec["min_bytes"],
        force=force,
    )


def list_available() -> list[dict]:
    """Return registry entries enriched with cache-path + download status —
    used by health_check + a future "Models" UI panel."""
    out: list[dict] = []
    for spec in REGISTRY.values():
        # Don't trigger download here — just check whether it's cached
        candidate = os.path.expanduser(
            f"~/Library/Application Support/no.creatorhubn.roleroom-post-agent/"
            f"ai_models_cache/{spec['r2_key']}"
        )
        cached = os.path.isfile(candidate)
        size_mb = 0
        if cached:
            try:
                size_mb = os.path.getsize(candidate) // (1024 ** 2)
            except OSError:
                pass
        out.append({
            **spec,
            "cached": cached,
            "cachePath": candidate if cached else None,
            "sizeMb": size_mb,
        })
    return out

"""GroundingDINO open-vocabulary detection.

YOLOv8 har 80 faste COCO-klasser — wedding-rings, custom outfits, eller
location-spesifikke objekter er ikke i den listen. GroundingDINO tar en
TEXT-prompt + bilde og returnerer bboxes for hva som matcher prompten.

Wedding use cases:
  "bride in white dress"     → boost shots with the bride visible
  "wedding ring on finger"   → catch ring-exchange moments
  "wedding cake"             → cake-cutting events (already in YOLO 'cake'
                                but more reliable)
  "kissing couple"           → kiss-detection
  "bouquet of flowers"       → bouquet-toss / portrait
  "the priest / officiant"   → ceremony scenes

Bruker (`groundingdino-py` pip pakke). Modell ~660MB — første kjøring laster
fra HuggingFace. Custom-prompt-list defineres per genre i genre_weights.py
(eller via param).

Default prompt-set for wedding (kan overrides via param til extract):
"""

from __future__ import annotations

import os
import subprocess
import tempfile


DEFAULT_WEDDING_PROMPTS: list[tuple[str, float]] = [
    ("a bride in white dress",       0.85),
    ("a groom in suit",              0.80),
    ("two people kissing",           1.00),
    ("two people hugging",           0.70),
    ("wedding ring on a finger",     0.85),
    ("wedding cake",                 0.60),
    ("a bouquet of flowers",         0.55),
    ("an officiant or priest",       0.50),
    ("dancing couple",               0.75),
    ("guests sitting on chairs",     0.30),
]


# South Asian (Pakistani / Indian / Bangladeshi / Sri Lankan) wedding prompts.
# Lehenga (red/maroon/gold), sherwani (groom), garland-exchange (varmala/
# jaymala), henna (mehndi), turmeric paste (haldi), fire-ceremony (havan),
# dhol drums, mandap canopy.
DEFAULT_SOUTH_ASIAN_WEDDING_PROMPTS: list[tuple[str, float]] = [
    ("a bride in red lehenga",                    0.95),
    ("a bride in maroon sari",                    0.90),
    ("a groom in sherwani",                       0.85),
    ("a groom in kurta",                          0.75),
    ("garland exchange between bride and groom",  1.00),  # varmala/jaymala
    ("varmala ceremony",                          1.00),
    ("jaymala garland",                           0.95),
    ("henna patterns on hands",                   0.85),  # mehndi
    ("mehndi design on hand",                     0.85),
    ("turmeric paste on face",                    0.80),  # haldi
    ("haldi ceremony",                            0.85),
    ("fire ceremony with sacred fire",            0.95),  # havan / saat phere
    ("a sacred fire pit",                         0.85),
    ("couple walking around fire",                0.90),  # saat phere
    ("mandap canopy at wedding",                  0.80),
    ("dhol drummer playing",                      0.70),
    ("traditional Indian sweets",                 0.50),
    ("nikkah signing of marriage contract",       0.85),
    ("bidaai farewell",                           0.85),
    ("baraat groom procession on horse",          0.80),
    ("bollywood dance group",                     0.75),
    ("bhangra dancers",                           0.80),
    ("priest pandit officiating",                 0.55),
    ("guests in traditional indian attire",       0.35),
]


def available() -> bool:
    try:
        import groundingdino  # noqa: F401
        import torch  # noqa: F401
        return True
    except ImportError:
        return False


_MODEL = None


def _load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    try:
        from groundingdino.util.inference import load_model  # type: ignore
        # GroundingDINO_SwinT_OGC = lighter (smaller backbone)
        # Auto-downloaded from HF on first call via the package
        config_path = "groundingdino/config/GroundingDINO_SwinT_OGC.py"
        weights_path = "groundingdino_swint_ogc.pth"
        _MODEL = load_model(config_path, weights_path)
        return _MODEL
    except Exception:  # noqa: BLE001
        return None


def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    fd, tmp = tempfile.mkstemp(prefix="gdino_", suffix=".jpg")
    os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts:.3f}", "-i", video,
             "-vframes", "1", "-q:v", "3",
             "-vf", "scale=640:-1",
             tmp],
            capture_output=True, timeout=12,
        )
        return tmp if os.path.exists(tmp) else None
    except Exception:  # noqa: BLE001
        return None


def _detect_prompts(model, image_path: str,
                    prompts: list[tuple[str, float]]) -> dict[str, float]:
    """For each (prompt, weight) test if GroundingDINO finds it.
    Returns {prompt: peak_confidence} only for prompts that hit."""
    try:
        from groundingdino.util.inference import load_image, predict  # type: ignore
    except ImportError:
        return {}
    try:
        image_source, image = load_image(image_path)
    except Exception:  # noqa: BLE001
        return {}

    out: dict[str, float] = {}
    for prompt_text, _weight in prompts:
        try:
            boxes, logits, phrases = predict(
                model=model, image=image,
                caption=prompt_text,
                box_threshold=0.30, text_threshold=0.25,
            )
            if len(logits) > 0:
                out[prompt_text] = float(logits.max())
        except Exception:  # noqa: BLE001
            continue
    return out


def get_prompts_for_genre(genre: str) -> list[tuple[str, float]]:
    """Return the appropriate prompt-set based on genre name. Used by
    extract_highlight_from_film so SA-weddings auto-get SA-prompts."""
    g = (genre or "").lower().replace("-", "_")
    if g in ("south_asian_wedding", "pakistani_wedding", "indian_wedding",
            "desi_wedding"):
        return DEFAULT_SOUTH_ASIAN_WEDDING_PROMPTS
    return DEFAULT_WEDDING_PROMPTS


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]],
            prompts: list[tuple[str, float]] | None = None,
            ) -> dict[int, float]:
    """Same shape as other signals. `prompts` defaults to the wedding-set.

    Note: GroundingDINO inference is heavy (~3-5s per frame on CPU,
    ~1s on MPS). For shot-lists > 100, restrict to top-priority prompts
    or sample fewer frames.
    """
    model = _load_model()
    if model is None:
        return {}
    if prompts is None:
        prompts = DEFAULT_WEDDING_PROMPTS
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        ts = (s + e) / 2
        tmp = _sample_frame(ffmpeg, video, ts)
        if tmp is None:
            out[i] = 0.0
            continue
        try:
            hits = _detect_prompts(model, tmp, prompts)
            # Weighted max — strongest prompt-hit × its wedding-weight
            score = 0.0
            for prompt_text, weight in prompts:
                if prompt_text in hits:
                    candidate = hits[prompt_text] * weight
                    if candidate > score:
                        score = candidate
            out[i] = max(0.0, min(1.0, score))
        finally:
            try: os.unlink(tmp)
            except OSError: pass
    return out

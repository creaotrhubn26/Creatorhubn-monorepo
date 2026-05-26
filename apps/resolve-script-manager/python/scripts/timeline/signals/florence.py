"""Florence-2 (Microsoft) multi-task vision signal.

Florence-2 (microsoft/Florence-2-base, ~770MB) er en unified vision-
language model som dekker:
  - Caption (dense, detailed)
  - Detection (open-vocabulary, similar to GroundingDINO)
  - OCR (read text on signs / wedding-decor)
  - Visual-question-answering
  - Grounding (anchor caption phrases to bbox)

For Post Agent's highlight-scoring bruker vi kun caption-mode: per shot,
generate a 1-sentence description. Vi scorer captions mot wedding-event-
keywords for å boost shots med rich-content captions.

Eksempel-output per shot:
  "A bride in white dress walking down an aisle with her father, surrounded
  by guests in a sunlit chapel."

Wedding-keyword-score over captions er bredere enn YOLO/GroundingDINO
fordi Florence-2 captioner alt — inkludert subtile cues som "guests
applauding", "sunlit", "candles burning" som ikke har eksplisitte object-
klasser.

Krever transformers + torch + Pillow. Auto-downloads weights fra HF
(første kjøring ~770MB).
"""

from __future__ import annotations

import os
import subprocess
import tempfile


# Wedding-keywords scoring vs Florence-2-generated captions. Each keyword
# vs caption is a substring-match (case-insensitive). Multiple matches
# stack additively, capped at score = 1.0.
CAPTION_KEYWORD_WEIGHTS: dict[str, float] = {
    # Subject identifiers
    "bride": 0.30,
    "groom": 0.25,
    "couple": 0.30,
    "wedding": 0.20,
    "ceremony": 0.20,
    "reception": 0.15,
    # Specific moments / objects
    "kiss": 0.40,
    "kissing": 0.40,
    "embrace": 0.30,
    "hug": 0.25,
    "ring": 0.30,
    "exchange": 0.20,
    "cake": 0.20,
    "bouquet": 0.20,
    "veil": 0.15,
    "altar": 0.20,
    "aisle": 0.20,
    "garland": 0.25,
    "mandap": 0.30,
    "lehenga": 0.30,
    "sherwani": 0.25,
    "henna": 0.20,
    "mehndi": 0.20,
    "haldi": 0.20,
    "fire": 0.15,  # for fire-ceremony
    "candle": 0.10,
    # Emotional cues
    "smiling": 0.25,
    "laughing": 0.30,
    "crying": 0.35,
    "tears": 0.30,
    "joy": 0.25,
    "happy": 0.15,
    # Action / dynamic content
    "dancing": 0.30,
    "applauding": 0.25,
    "applause": 0.25,
    "celebrating": 0.20,
    "raising glass": 0.15,
    "toast": 0.20,
    "walking down aisle": 0.40,
    "first dance": 0.40,
    # Lighting / aesthetic cues
    "sunlit": 0.15,
    "golden hour": 0.20,
    "candlelit": 0.15,
    "bokeh": 0.10,
    # Penalty for boring shots
    "empty": -0.15,
    "background": -0.05,
    "blurred": -0.10,
}


def available() -> bool:
    try:
        from transformers import AutoProcessor, AutoModelForCausalLM  # noqa: F401
        import torch  # noqa: F401
        from PIL import Image  # noqa: F401
        return True
    except ImportError:
        return False


_MODEL_STATE: dict = {}


def _load_model():
    if "ready" in _MODEL_STATE:
        return _MODEL_STATE.get("model"), _MODEL_STATE.get("processor"), _MODEL_STATE.get("device")
    try:
        from transformers import AutoProcessor, AutoModelForCausalLM  # type: ignore
        import torch  # type: ignore
    except ImportError:
        _MODEL_STATE["ready"] = False
        return None, None, None
    try:
        model_id = "microsoft/Florence-2-base"
        processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(model_id, trust_remote_code=True)
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        model = model.to(device).eval()
        _MODEL_STATE.update({"model": model, "processor": processor,
                             "device": device, "ready": True})
        return model, processor, device
    except Exception:  # noqa: BLE001
        _MODEL_STATE["ready"] = False
        return None, None, None


def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    fd, tmp = tempfile.mkstemp(prefix="florence_", suffix=".jpg")
    os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts:.3f}", "-i", video,
             "-vframes", "1", "-q:v", "3",
             "-vf", "scale=768:-1",
             tmp],
            capture_output=True, timeout=12,
        )
        return tmp if os.path.exists(tmp) else None
    except Exception:  # noqa: BLE001
        return None


def _caption_image(model, processor, device, image_path: str) -> str:
    """Generate detailed caption for one image via Florence-2."""
    try:
        from PIL import Image
        import torch  # type: ignore
        img = Image.open(image_path).convert("RGB")
        # Florence-2 task tokens: <CAPTION>, <DETAILED_CAPTION>, <MORE_DETAILED_CAPTION>
        prompt = "<DETAILED_CAPTION>"
        inputs = processor(text=prompt, images=img, return_tensors="pt").to(device)
        with torch.no_grad():
            generated_ids = model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=128,
                num_beams=3,
                early_stopping=True,
            )
        generated_text = processor.batch_decode(
            generated_ids, skip_special_tokens=False,
        )[0]
        # Florence-2 returns text wrapped i task-token format; parse out caption
        parsed = processor.post_process_generation(
            generated_text, task=prompt, image_size=img.size,
        )
        return str(parsed.get(prompt, "")).strip()
    except Exception:  # noqa: BLE001
        return ""


def _score_caption(caption: str) -> float:
    """Sum weighted keyword-matches over the caption. Clipped 0..1."""
    if not caption:
        return 0.0
    cap = caption.lower()
    score = 0.0
    for keyword, weight in CAPTION_KEYWORD_WEIGHTS.items():
        if keyword in cap:
            score += weight
    return max(0.0, min(1.0, score))


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    """Per-shot Florence-2-caption-derived score. Inferens ~1-2s per shot
    på Apple Silicon MPS.

    For-store-shot-lister (>50) bør caches via bridge.cache_path_for —
    captions er deterministisk per (file, timestamp), så re-runs er gratis.
    """
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
            caption = _caption_image(model, processor, device, tmp)
            out[i] = _score_caption(caption)
        finally:
            try: os.unlink(tmp)
            except OSError: pass
    return out


def caption_shots(ffmpeg: str, video: str,
                  shots: list[tuple[float, float]]) -> list[str]:
    """Expose caption-extraction for standalone use (caption_shots.py script).
    Returns 1 caption per shot, or empty string on failure."""
    model, processor, device = _load_model()
    if model is None:
        return [""] * len(shots)
    out: list[str] = []
    for s, e in shots:
        ts = (s + e) / 2
        tmp = _sample_frame(ffmpeg, video, ts)
        if tmp is None:
            out.append("")
            continue
        try:
            out.append(_caption_image(model, processor, device, tmp))
        finally:
            try: os.unlink(tmp)
            except OSError: pass
    return out

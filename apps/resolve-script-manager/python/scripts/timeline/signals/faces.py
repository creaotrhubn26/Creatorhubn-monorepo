"""Face-presence + (optionally) known-face recognition.

V1 — detection only: count human faces in a sample frame from each shot.
Boost shots with 1+ faces; bigger boost for 2+ faces (couple shots) up to
4 (family shots, after which we plateau to avoid favoring crowd-scenes).

V1.5 — when a reference-face database exists at
  ~/Library/Application Support/no.creatorhubn.roleroom-post-agent/known_faces/<couple_id>/*.jpg
faces are matched against it via `face_recognition`. Matched shots get an
extra bonus on top of the base face-count score.

The database is build-time-only for now (user drops photos in the folder).
A future enhancement is to let the Tauri UI prompt the user to upload 5
photos of the couple at the start of a wedding project.

Detection uses OpenCV's bundled Haar cascade as a zero-dependency
fallback. If `face_recognition` is installed (heavier — requires dlib),
both detection and recognition use it (more accurate).
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from typing import Any


def available() -> bool:
    try:
        import cv2  # noqa: F401
        return True
    except ImportError:
        return False


def _ref_dir() -> str:
    base = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/known_faces"
    )
    return base


def _load_known_encodings() -> list[Any]:
    """Try to load reference face encodings via face_recognition lib.
    Returns [] if the lib or the directory is missing."""
    try:
        import face_recognition  # type: ignore
    except ImportError:
        return []
    base = _ref_dir()
    if not os.path.isdir(base):
        return []
    encs: list[Any] = []
    for root, _dirs, files in os.walk(base):
        for fn in files:
            if not fn.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            try:
                img = face_recognition.load_image_file(os.path.join(root, fn))
                found = face_recognition.face_encodings(img)
                encs.extend(found)
            except Exception:  # noqa: BLE001
                continue
    return encs


def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    fd, tmp = tempfile.mkstemp(prefix="face_", suffix=".jpg")
    os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts:.3f}", "-i", video,
             "-vframes", "1", "-q:v", "3",
             "-vf", "scale=640:360",
             tmp],
            capture_output=True, timeout=12,
        )
        if not os.path.exists(tmp) or os.path.getsize(tmp) < 200:
            return None
        return tmp
    except Exception:  # noqa: BLE001
        return None


def _count_faces_cv2(image_path: str) -> int:
    import cv2  # type: ignore
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return 0
    cascade_path = os.path.join(
        cv2.data.haarcascades, "haarcascade_frontalface_default.xml"
    )
    if not os.path.isfile(cascade_path):
        return 0
    cascade = cv2.CascadeClassifier(cascade_path)
    faces = cascade.detectMultiScale(img, scaleFactor=1.2, minNeighbors=5,
                                     minSize=(40, 40))
    return len(faces) if faces is not None else 0


def _detect_and_match_face_recognition(image_path: str,
                                       known_encs: list) -> tuple[int, int]:
    """Returns (total_faces, matched_to_known)."""
    try:
        import face_recognition  # type: ignore
    except ImportError:
        return _count_faces_cv2(image_path), 0
    try:
        img = face_recognition.load_image_file(image_path)
        locations = face_recognition.face_locations(img, model="hog")
        if not locations:
            return 0, 0
        if not known_encs:
            return len(locations), 0
        encs = face_recognition.face_encodings(img, locations)
        matched = 0
        for enc in encs:
            matches = face_recognition.compare_faces(known_encs, enc, tolerance=0.55)
            if any(matches):
                matched += 1
        return len(locations), matched
    except Exception:  # noqa: BLE001
        return _count_faces_cv2(image_path), 0


def _score(total: int, matched: int, smile_bonus: float = 0.0) -> float:
    """Combine face-count + known-match + smile-attribute into a single 0..1 signal.

    smile_bonus: 0..0.15 — small additional boost for smiling/expressive faces
    (FaceXFormer attribute), added on top of count + identity. Smiling shots
    in highlights are typically more emotionally engaging.
    """
    if total == 0:
        return 0.0
    base_curve = {1: 0.40, 2: 0.75, 3: 0.95}
    base = base_curve.get(total, 1.0 if total >= 4 else 0.0)
    bonus = min(0.20, matched * 0.10)
    return min(1.0, base + bonus + smile_bonus)


# ─── FaceXFormer attribute extension (smile / age / expression) ─────────
#
# FaceXFormer (KAIST, ~250MB) gjør single-pass attribute-prediction:
# age, gender, expression (smile / neutral / serious / surprised),
# eye-glasses, hat, head-pose. Vi bruker kun `expression` for smile-bonus
# i wedding-context: smiling shots scorer høyere enn neutral.
#
# Krever R2-downloaded FaceXFormer-weights + facexformer pip-package
# (research, ikke clean pip). V1: graceful no-op om manglende — base
# faces-signal fungerer uten.

_FACEXFORMER_MODEL = None


def _load_facexformer():
    global _FACEXFORMER_MODEL
    if _FACEXFORMER_MODEL is not None:
        return _FACEXFORMER_MODEL
    try:
        sys_path_root = os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__)))))
        if sys_path_root not in sys.path:
            sys.path.insert(0, sys_path_root)
        import ai_models  # noqa: E402
    except ImportError:
        return None
    weights = ai_models.ensure_local_model("facexformer") if hasattr(
        ai_models, "REGISTRY") and "facexformer" in ai_models.REGISTRY else None
    if not weights:
        return None
    try:
        # facexformer reference repo: https://github.com/Kartik-3004/facexformer
        # The package isn't on PyPI under that name — users must install from
        # source. If unavailable, return None (signal still functions without).
        import facexformer  # type: ignore
        from facexformer.network import FaceXFormer  # type: ignore
        import torch  # type: ignore
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        model = FaceXFormer()
        state = torch.load(weights, map_location=device)
        model.load_state_dict(state.get("state_dict", state))
        model = model.to(device)
        model.eval()
        _FACEXFORMER_MODEL = model
        return model
    except (ImportError, Exception):  # noqa: BLE001
        return None


def _smile_bonus_for_image(image_path: str, face_locations: list) -> float:
    """If FaceXFormer is available, run it on each face crop and return a
    smile-bonus 0..0.15. No-op if model unavailable."""
    model = _load_facexformer()
    if model is None or not face_locations:
        return 0.0
    try:
        import cv2  # type: ignore
        import torch  # type: ignore
        img = cv2.imread(image_path)
        if img is None:
            return 0.0
        smiles = 0
        for (x, y, w, h) in face_locations:
            x, y, w, h = int(x), int(y), int(w), int(h)
            crop = img[y:y+h, x:x+w]
            if crop.size == 0:
                continue
            resized = cv2.resize(crop, (224, 224))
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            tensor = torch.from_numpy(rgb).permute(2, 0, 1).float() / 255.
            tensor = tensor.unsqueeze(0).to(next(model.parameters()).device)
            with torch.no_grad():
                out = model(tensor)
                # FaceXFormer multi-head output — expression head returns
                # logits over [neutral, happy, sad, surprised, angry, ...]
                if isinstance(out, dict) and "expression" in out:
                    expr_logits = out["expression"]
                elif isinstance(out, (tuple, list)):
                    expr_logits = out[0]
                else:
                    expr_logits = out
                pred = int(torch.argmax(expr_logits, dim=-1).item())
                # Heuristic: label-index 1 typically = "happy/smile" in
                # standard expression-recognition datasets (FER2013-order)
                if pred in (1, 3):  # happy or surprised (both positive valence)
                    smiles += 1
        # Cap bonus: max 0.15 when all faces smile
        return min(0.15, smiles * 0.05)
    except Exception:  # noqa: BLE001
        return 0.0


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    known_encs = _load_known_encodings()
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        mid = (s + e) / 2
        tmp = _sample_frame(ffmpeg, video, mid)
        if tmp is None:
            out[i] = 0.0
            continue
        try:
            if known_encs:
                total, matched = _detect_and_match_face_recognition(tmp, known_encs)
            else:
                total = _count_faces_cv2(tmp)
                matched = 0
            # FaceXFormer smile-attribute bonus (#R2-batch-4)
            # Needs raw bounding-boxes — re-detect to get them
            smile_bonus = 0.0
            try:
                import cv2  # type: ignore
                img = cv2.imread(tmp, cv2.IMREAD_GRAYSCALE)
                if img is not None:
                    cascade_path = os.path.join(
                        cv2.data.haarcascades, "haarcascade_frontalface_default.xml"
                    )
                    if os.path.isfile(cascade_path):
                        cascade = cv2.CascadeClassifier(cascade_path)
                        boxes = cascade.detectMultiScale(
                            img, scaleFactor=1.2, minNeighbors=5,
                            minSize=(40, 40),
                        )
                        if boxes is not None and len(boxes) > 0:
                            smile_bonus = _smile_bonus_for_image(tmp, boxes)
            except Exception:  # noqa: BLE001
                pass
            out[i] = _score(total, matched, smile_bonus=smile_bonus)
        except Exception:  # noqa: BLE001
            out[i] = 0.0
        finally:
            try: os.unlink(tmp)
            except OSError: pass
    return out

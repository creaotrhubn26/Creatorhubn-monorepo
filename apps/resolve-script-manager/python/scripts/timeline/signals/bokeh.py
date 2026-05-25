"""Shallow-DOF / cinematic-framing detection.

Cinematic shots have a clear focus subject (high local sharpness in
center) with a defocused background (low sharpness near edges). We
sample one frame from the middle of each shot, compute the Laplacian
variance (a standard sharpness metric) for the center crop vs the full
frame, and use the ratio as a "bokeh score".

  center / full > 1.8 → strong bokeh (1.0)
  ratio 1.0–1.8       → linear scale
  ratio < 1.0         → 0.0 (background is sharper than center → not bokeh)

Requires OpenCV. Gracefully unavailable otherwise.
"""

from __future__ import annotations

import subprocess
import tempfile
import os


def available() -> bool:
    try:
        import cv2  # noqa: F401
        return True
    except ImportError:
        return False


def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    fd, tmp = tempfile.mkstemp(prefix="bokeh_", suffix=".jpg")
    os.close(fd)
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{ts:.3f}", "-i", video,
        "-vframes", "1", "-q:v", "4",
        "-vf", "scale=640:360",
        tmp,
    ]
    try:
        subprocess.run(cmd, capture_output=True, timeout=15)
    except Exception:  # noqa: BLE001
        os.unlink(tmp) if os.path.exists(tmp) else None
        return None
    if not os.path.exists(tmp) or os.path.getsize(tmp) < 100:
        return None
    return tmp


def _bokeh_score(image_path: str) -> float:
    import cv2  # type: ignore
    import numpy as np
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return 0.0
    h, w = img.shape
    # Full-frame sharpness (Laplacian variance)
    full_var = cv2.Laplacian(img, cv2.CV_64F).var()
    if full_var < 1.0:
        return 0.0  # nearly black or extremely blurred everywhere
    # Center 1/3 crop
    cy0, cy1 = h // 3, h * 2 // 3
    cx0, cx1 = w // 3, w * 2 // 3
    center = img[cy0:cy1, cx0:cx1]
    center_var = cv2.Laplacian(center, cv2.CV_64F).var()
    if center_var < 1.0:
        return 0.0
    # Edges: mean Laplacian variance of 4 corner crops
    crop_size = min(h, w) // 4
    corners = [
        img[:crop_size, :crop_size],
        img[:crop_size, w - crop_size:],
        img[h - crop_size:, :crop_size],
        img[h - crop_size:, w - crop_size:],
    ]
    edge_var = float(np.mean([cv2.Laplacian(c, cv2.CV_64F).var() for c in corners]))
    if edge_var < 0.5:
        edge_var = 0.5  # avoid div-by-zero
    ratio = center_var / edge_var
    if ratio <= 1.0:
        return 0.0
    if ratio >= 1.8:
        return 1.0
    return (ratio - 1.0) / 0.8


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        mid = (s + e) / 2
        tmp = _sample_frame(ffmpeg, video, mid)
        if tmp is None:
            out[i] = 0.0
            continue
        try:
            out[i] = _bokeh_score(tmp)
        except Exception:  # noqa: BLE001
            out[i] = 0.0
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass
    return out

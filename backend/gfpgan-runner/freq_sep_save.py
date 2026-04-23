"""16-bit PNG save for the frequency-sep retouch editor.

The browser canvas pipeline can only write 8-bit PNG. After a frequency-
separation retouch — which operates internally on Float32 and therefore
has well above 8-bit precision in the low/mid bands — saving back to 8-bit
would collapse all the headroom the editor spent careful math preserving.
This module handles the last hop: take the editor's final buffer,
written as Uint16 per channel in native byte order, and emit a real
16-bit-per-channel PNG.

Implementation uses OpenCV for the PNG encode. Pillow is in the
dependency tree but its 16-bit RGB support is awkward (mode "I;16" is
single-channel, there is no first-class RGB;16 mode that round-trips
cleanly through ``Image.save``). OpenCV's ``imencode`` writes true 16-bit
per channel RGB/RGBA PNGs out of the box when handed a uint16 array, so
that's what we use — Pillow stays in play for any grayscale 16-bit case
via ``save_mask_as_16bit_png``.
"""
from __future__ import annotations

import base64
import io
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image


@dataclass
class SavePayload:
    """Validated 16-bit-save payload, ready to hand to ``encode_png_16bit``."""

    width: int
    height: int
    channels: int
    pixels_u16: np.ndarray  # shape (height, width, channels), dtype=uint16


def parse_payload(
    *,
    width: int,
    height: int,
    channels: int,
    pixels_base64: str,
) -> SavePayload:
    """Decode and validate an incoming save request.

    Raises ``ValueError`` on any structural mismatch (dimensions, channel
    count, byte length) so the FastAPI layer can turn those into 400s
    instead of 500s.
    """
    if width <= 0 or height <= 0:
        raise ValueError(f"non-positive dimensions: {width}x{height}")
    if channels not in (3, 4):
        raise ValueError(f"channels must be 3 or 4, got {channels}")
    if width * height > 200_000_000:
        # Guardrail: a 200MP image with 4 × uint16 channels is 1.6GB — we
        # refuse before we OOM the runner. Typical retouch stills top out
        # near 60MP (Phase One IQ4 150MP would need a config bump).
        raise ValueError(f"image too large: {width}x{height} = {width * height} pixels")

    try:
        raw = base64.b64decode(pixels_base64, validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"pixels_base64 is not valid base64: {exc}") from exc

    expected_bytes = width * height * channels * 2  # 2 bytes per uint16
    if len(raw) != expected_bytes:
        raise ValueError(
            f"pixel byte length mismatch: got {len(raw)}, expected {expected_bytes} "
            f"({width}x{height}x{channels}x2)"
        )

    # Browser sends little-endian (every js runtime we care about).
    arr = np.frombuffer(raw, dtype="<u2").reshape(height, width, channels)
    # Convert to native byte order on the server to keep cv2 happy across
    # big-endian hosts (unlikely in prod but cheap to be correct).
    if arr.dtype.byteorder not in ("=", "|"):
        arr = arr.astype(np.uint16, copy=False)

    return SavePayload(width=width, height=height, channels=channels, pixels_u16=arr)


def encode_png_16bit(payload: SavePayload) -> bytes:
    """Encode a validated payload as a 16-bit-per-channel PNG.

    Input pixel order is **RGB(A)** — matches the browser canvas byte
    order. OpenCV expects BGR internally, so we swap channels before
    handing it over. Alpha, when present, is preserved.
    """
    arr = payload.pixels_u16
    if arr.dtype != np.uint16:
        raise TypeError(f"expected uint16 array, got {arr.dtype}")

    if payload.channels == 3:
        bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    else:
        # RGBA → BGRA: swap R/B, leave A alone.
        bgr = cv2.cvtColor(arr, cv2.COLOR_RGBA2BGRA)

    # PNG compression level 6 is a decent throughput/size compromise —
    # level 9 spends ~3× the CPU for <5% smaller files at this bit depth.
    ok, buf = cv2.imencode(".png", bgr, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    if not ok:
        raise RuntimeError("cv2.imencode returned failure for 16-bit PNG")
    return buf.tobytes()


def save_mask_as_16bit_png(mask_u16: np.ndarray) -> bytes:
    """Alternate path for single-channel 16-bit masks, via Pillow.

    Kept because OpenCV can't write grayscale 16-bit with ``imencode``
    and a ``(H, W)`` shape — it insists on 2D + one of its colour flags.
    Pillow's ``I;16`` mode handles this directly.
    """
    if mask_u16.dtype != np.uint16:
        raise TypeError(f"expected uint16 array, got {mask_u16.dtype}")
    if mask_u16.ndim != 2:
        raise ValueError(f"expected 2D mask, got shape {mask_u16.shape}")
    # Pillow infers mode "I;16" from a 2D uint16 array automatically.
    # Passing `mode=` here is deprecated and removed in Pillow 13.
    img = Image.fromarray(mask_u16)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()

"""Deterministic tests for the 16-bit PNG save path.

Round-trips a synthetic Uint16 RGB/RGBA buffer through
``parse_payload`` + ``encode_png_16bit`` + ``cv2.imdecode`` and asserts
that every channel value survives bit-for-bit. Run with:

    cd backend/gfpgan-runner
    python -m pytest test_freq_sep_save.py -v
"""
from __future__ import annotations

import base64

import cv2
import numpy as np
import pytest

from freq_sep_save import (
    encode_png_16bit,
    parse_payload,
    save_mask_as_16bit_png,
)


def _encode_bytes(arr_u16: np.ndarray) -> str:
    """Serialise a (H, W, C) uint16 array to the browser wire format."""
    assert arr_u16.dtype == np.uint16
    return base64.b64encode(arr_u16.astype("<u2").tobytes()).decode("ascii")


def _decode_png_16bit_rgb(png_bytes: bytes) -> np.ndarray:
    """Decode a 16-bit PNG back to an (H, W, C) uint16 RGB(A) array."""
    buf = np.frombuffer(png_bytes, dtype=np.uint8)
    decoded = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    assert decoded is not None, "cv2.imdecode failed"
    assert decoded.dtype == np.uint16, f"expected uint16, got {decoded.dtype}"
    if decoded.ndim == 2:
        return decoded
    # cv2 returns BGR(A); swap back to RGB(A) for the test assertions.
    if decoded.shape[2] == 3:
        return cv2.cvtColor(decoded, cv2.COLOR_BGR2RGB)
    return cv2.cvtColor(decoded, cv2.COLOR_BGRA2RGBA)


class TestParsePayload:
    def test_accepts_valid_rgb_payload(self):
        arr = np.arange(3 * 4 * 3, dtype=np.uint16).reshape(3, 4, 3)
        payload = parse_payload(
            width=4, height=3, channels=3, pixels_base64=_encode_bytes(arr)
        )
        assert payload.width == 4
        assert payload.height == 3
        assert payload.channels == 3
        np.testing.assert_array_equal(payload.pixels_u16, arr)

    def test_accepts_valid_rgba_payload(self):
        arr = np.arange(2 * 2 * 4, dtype=np.uint16).reshape(2, 2, 4) * 1000
        payload = parse_payload(
            width=2, height=2, channels=4, pixels_base64=_encode_bytes(arr)
        )
        np.testing.assert_array_equal(payload.pixels_u16, arr)

    def test_rejects_zero_or_negative_dimensions(self):
        with pytest.raises(ValueError, match="non-positive"):
            parse_payload(width=0, height=10, channels=3, pixels_base64="")
        with pytest.raises(ValueError, match="non-positive"):
            parse_payload(width=10, height=-1, channels=3, pixels_base64="")

    def test_rejects_invalid_channel_count(self):
        arr = np.zeros((2, 2, 1), dtype=np.uint16)
        with pytest.raises(ValueError, match="channels must be 3 or 4"):
            parse_payload(
                width=2, height=2, channels=1, pixels_base64=_encode_bytes(arr)
            )

    def test_rejects_oversize_image(self):
        with pytest.raises(ValueError, match="image too large"):
            parse_payload(
                width=20000, height=20000, channels=4, pixels_base64=""
            )

    def test_rejects_truncated_payload(self):
        arr = np.zeros((4, 4, 3), dtype=np.uint16)
        b64 = _encode_bytes(arr)
        # Lop off a chunk of bytes — decode should fail the length check.
        truncated = b64[:-20]
        with pytest.raises(ValueError, match="pixel byte length mismatch"):
            parse_payload(
                width=4, height=4, channels=3, pixels_base64=truncated
            )

    def test_rejects_non_base64_payload(self):
        with pytest.raises(ValueError, match="not valid base64"):
            parse_payload(
                width=1, height=1, channels=3, pixels_base64="not base 64 at all!!!"
            )


class TestEncodePng16bit:
    def test_round_trips_rgb_exactly(self):
        # Build an RGB gradient that exercises the full 16-bit range per channel.
        h, w = 8, 12
        r = np.linspace(0, 65535, num=h * w, dtype=np.uint16).reshape(h, w)
        g = np.linspace(65535, 0, num=h * w, dtype=np.uint16).reshape(h, w)
        b = np.full((h, w), 12345, dtype=np.uint16)
        arr = np.stack([r, g, b], axis=-1)

        payload = parse_payload(
            width=w, height=h, channels=3, pixels_base64=_encode_bytes(arr)
        )
        png = encode_png_16bit(payload)
        decoded = _decode_png_16bit_rgb(png)

        assert decoded.shape == arr.shape
        np.testing.assert_array_equal(decoded, arr)

    def test_round_trips_rgba_including_alpha(self):
        h, w = 4, 4
        arr = np.zeros((h, w, 4), dtype=np.uint16)
        arr[..., 0] = 10_000  # R
        arr[..., 1] = 20_000  # G
        arr[..., 2] = 30_000  # B
        # Alpha: non-trivial, non-opaque values.
        arr[..., 3] = np.arange(h * w, dtype=np.uint16).reshape(h, w) * 4000

        payload = parse_payload(
            width=w, height=h, channels=4, pixels_base64=_encode_bytes(arr)
        )
        png = encode_png_16bit(payload)
        decoded = _decode_png_16bit_rgb(png)

        assert decoded.shape == (h, w, 4)
        np.testing.assert_array_equal(decoded, arr)

    def test_preserves_precision_above_8bit(self):
        # Values differing only in the low byte must survive intact in
        # a true 16-bit save — if we accidentally downcast to 8-bit, the
        # low byte is lost and these become equal.
        arr = np.array([[[256, 257, 258]]], dtype=np.uint16)
        payload = parse_payload(
            width=1, height=1, channels=3, pixels_base64=_encode_bytes(arr)
        )
        png = encode_png_16bit(payload)
        decoded = _decode_png_16bit_rgb(png)
        assert decoded[0, 0, 0] == 256
        assert decoded[0, 0, 1] == 257
        assert decoded[0, 0, 2] == 258

    def test_channels_stay_in_rgb_order_after_round_trip(self):
        # Encode a pixel with distinct channel magnitudes so a BGR/RGB swap
        # anywhere on either side would misorder the output.
        arr = np.array([[[65535, 0, 0]]], dtype=np.uint16)  # pure red
        payload = parse_payload(
            width=1, height=1, channels=3, pixels_base64=_encode_bytes(arr)
        )
        decoded = _decode_png_16bit_rgb(encode_png_16bit(payload))
        assert decoded[0, 0, 0] == 65535
        assert decoded[0, 0, 1] == 0
        assert decoded[0, 0, 2] == 0

    def test_output_is_actually_png(self):
        arr = np.zeros((2, 2, 3), dtype=np.uint16)
        payload = parse_payload(
            width=2, height=2, channels=3, pixels_base64=_encode_bytes(arr)
        )
        png = encode_png_16bit(payload)
        # PNG signature: 89 50 4E 47 0D 0A 1A 0A
        assert png[:8] == bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])


class TestSaveMask16bit:
    def test_round_trips_grayscale_16bit(self):
        mask = (np.arange(16 * 16, dtype=np.uint16) * 256).reshape(16, 16)
        png = save_mask_as_16bit_png(mask)
        # Decode via cv2 (IMREAD_UNCHANGED gives a 16-bit single-channel array).
        decoded = cv2.imdecode(
            np.frombuffer(png, dtype=np.uint8), cv2.IMREAD_UNCHANGED
        )
        assert decoded.dtype == np.uint16
        np.testing.assert_array_equal(decoded, mask)

    def test_rejects_wrong_dtype(self):
        with pytest.raises(TypeError, match="uint16"):
            save_mask_as_16bit_png(np.zeros((4, 4), dtype=np.uint8))

    def test_rejects_wrong_shape(self):
        with pytest.raises(ValueError, match="2D"):
            save_mask_as_16bit_png(np.zeros((4, 4, 3), dtype=np.uint16))

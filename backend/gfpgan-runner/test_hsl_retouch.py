"""Deterministic tests for 8-band HSL colour grading.

All tests use synthetic single-colour or gradient images so we can assert
on mean HSV deltas after the pass. HSV is OpenCV full-range: H in
[0, 180], S + V in [0, 255].

Run with:

    cd backend/gfpgan-runner
    python -m pytest test_hsl_retouch.py -v
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from hsl_retouch import (
    HSL_BAND_CENTERS,
    HSL_BAND_ORDER,
    apply_hsl,
)


def _solid_bgr(bgr: tuple[int, int, int], size: int = 32) -> np.ndarray:
    img = np.zeros((size, size, 3), dtype=np.uint8)
    img[:, :] = bgr
    return img


def _mean_hsv(image: np.ndarray) -> tuple[float, float, float]:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
    return (
        float(hsv[..., 0].mean()),
        float(hsv[..., 1].mean()),
        float(hsv[..., 2].mean()),
    )


def _zeros(**overrides) -> dict:
    base = {name: {"h": 0, "s": 0, "l": 0} for name in HSL_BAND_ORDER}
    base.update(overrides)
    return base


def test_identity_when_all_zero():
    image = _solid_bgr((30, 120, 200))  # dusty blue
    out = apply_hsl(image, _zeros())
    assert np.array_equal(out, image)


def test_identity_on_none_params():
    image = _solid_bgr((80, 80, 80))
    assert np.array_equal(apply_hsl(image, None), image)


def test_identity_on_empty_params():
    image = _solid_bgr((200, 200, 200))
    assert np.array_equal(apply_hsl(image, {}), image)


def test_empty_image_returns_input():
    empty = np.zeros((0, 0, 3), dtype=np.uint8)
    assert apply_hsl(empty, _zeros(red={"h": 50, "s": 0, "l": 0})).shape == empty.shape


def test_red_saturation_pushes_pure_red_up():
    # Pure red at low saturation — the band should bring saturation up.
    hsv_src = np.array([[[0, 120, 220]]], dtype=np.uint8)
    image = cv2.cvtColor(np.tile(hsv_src, (16, 16, 1)), cv2.COLOR_HSV2BGR)
    _, s0, _ = _mean_hsv(image)
    out = apply_hsl(image, _zeros(red={"h": 0, "s": 100, "l": 0}))
    _, s1, _ = _mean_hsv(out)
    assert s1 > s0 + 20


def test_red_luminance_lifts_value():
    hsv_src = np.array([[[0, 200, 120]]], dtype=np.uint8)  # low V
    image = cv2.cvtColor(np.tile(hsv_src, (16, 16, 1)), cv2.COLOR_HSV2BGR)
    _, _, v0 = _mean_hsv(image)
    out = apply_hsl(image, _zeros(red={"h": 0, "s": 0, "l": 100}))
    _, _, v1 = _mean_hsv(out)
    assert v1 > v0 + 20


def test_blue_hue_rotates_only_blue_pixels():
    # Compose two stripes: blue (H≈120 in full-range ÷2 = 120° HSV) and red (H≈0).
    # We only push the "blue" band hue — red should barely move.
    h, w = 32, 64
    image = np.zeros((h, w, 3), dtype=np.uint8)
    # Left half: pure blue (BGR = (255, 0, 0) → HSV H=120 in full-range/2 = 120).
    image[:, : w // 2] = (255, 0, 0)
    # Right half: pure red (BGR = (0, 0, 255) → HSV H=0).
    image[:, w // 2 :] = (0, 0, 255)

    hsv_before = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
    blue_before = float(hsv_before[..., 0][:, : w // 2].mean()) * 2.0
    red_before = float(hsv_before[..., 0][:, w // 2 :].mean()) * 2.0

    out = apply_hsl(image, _zeros(blue={"h": 100, "s": 0, "l": 0}))

    hsv_after = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    blue_after = float(hsv_after[..., 0][:, : w // 2].mean()) * 2.0
    red_after = float(hsv_after[..., 0][:, w // 2 :].mean()) * 2.0

    # Blue pixels must rotate meaningfully; red pixels must not.
    assert abs(blue_after - blue_before) > 10.0
    assert abs(red_after - red_before) < 2.0


def test_desaturate_red_to_zero_saturation():
    hsv_src = np.array([[[0, 255, 200]]], dtype=np.uint8)  # max-sat red
    image = cv2.cvtColor(np.tile(hsv_src, (8, 8, 1)), cv2.COLOR_HSV2BGR)
    out = apply_hsl(image, _zeros(red={"h": 0, "s": -100, "l": 0}))
    _, s_after, _ = _mean_hsv(out)
    assert s_after < 40  # nearly desaturated


def test_orange_band_affects_orange_not_green():
    # Orange ≈ H=30° (full-range 15), green ≈ H=120° (full-range 60).
    h, w = 32, 64
    image = np.zeros((h, w, 3), dtype=np.uint8)
    image[:, : w // 2] = cv2.cvtColor(
        np.array([[[15, 220, 220]]], dtype=np.uint8), cv2.COLOR_HSV2BGR
    )[0, 0]
    image[:, w // 2 :] = cv2.cvtColor(
        np.array([[[60, 220, 220]]], dtype=np.uint8), cv2.COLOR_HSV2BGR
    )[0, 0]

    out = apply_hsl(image, _zeros(orange={"h": 0, "s": -100, "l": 0}))
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)

    orange_sat = float(hsv[..., 1][:, : w // 2].mean())
    green_sat = float(hsv[..., 1][:, w // 2 :].mean())
    # Orange should be substantially desaturated, green mostly untouched.
    assert orange_sat < 80
    assert green_sat > 180


def test_clamps_slider_values_out_of_range():
    hsv_src = np.array([[[0, 255, 255]]], dtype=np.uint8)
    image = cv2.cvtColor(np.tile(hsv_src, (8, 8, 1)), cv2.COLOR_HSV2BGR)
    # Both 500 and -500 should behave exactly like ±100.
    a = apply_hsl(image, _zeros(red={"h": 500, "s": 500, "l": 500}))
    b = apply_hsl(image, _zeros(red={"h": 100, "s": 100, "l": 100}))
    assert np.array_equal(a, b)


def test_malformed_band_is_ignored():
    image = _solid_bgr((100, 100, 200))
    out = apply_hsl(image, {"red": "garbage", "blue": {"h": "?", "s": None, "l": 0}})
    assert np.array_equal(out, image)


def test_adjacent_bands_produce_smooth_gradient():
    """Cranking adjacent bands to opposite values should not produce a
    banding artefact — the cosine window is supposed to feather across
    band boundaries."""
    # Hue sweep from 0° → 180° (half-range in HSV full-range: 0 → 90).
    grad = np.linspace(0, 90, 256, dtype=np.float32)
    hue = np.tile(grad, (8, 1))
    hsv = np.stack([hue, np.full_like(hue, 220), np.full_like(hue, 220)], axis=-1)
    image = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    out = apply_hsl(
        image,
        _zeros(
            red={"h": 0, "s": 100, "l": 0},
            orange={"h": 0, "s": -100, "l": 0},
            yellow={"h": 0, "s": 100, "l": 0},
        ),
    )
    # Along the horizontal axis the saturation curve should be piecewise
    # continuous: the absolute finite-difference should never exceed the
    # full swing in a single pixel step.
    sat = cv2.cvtColor(out, cv2.COLOR_BGR2HSV)[..., 1].astype(np.float32)
    diffs = np.abs(np.diff(sat, axis=1))
    assert diffs.max() < 40, f"max sat step {diffs.max()} — band edge likely not feathered"


def test_passes_float_image_through_uint8_cast():
    image = np.full((4, 4, 3), 120.7, dtype=np.float32)
    out = apply_hsl(image, _zeros(red={"h": 0, "s": 50, "l": 0}))
    assert out.dtype == np.uint8


def test_enumerates_all_eight_bands():
    # Every band centre must exist and be unique. Guards against a copy-
    # paste bug where two bands alias to the same centre.
    assert len(HSL_BAND_ORDER) == 8
    assert len(set(HSL_BAND_CENTERS)) == 8

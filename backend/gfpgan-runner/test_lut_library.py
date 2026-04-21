"""Contract tests for the built-in LUT library.

Each look asserts the *direction* of its effect (warm lifts R drops B,
cool mirrors, neutral is identity) rather than exact values, so future
tuning changes don't require brittle numeric updates.
"""
from __future__ import annotations

import numpy as np
import pytest

from cube_lut import apply_lut
from lut_library import get_builtin_lut, list_builtin_luts


def _solid_bgr(bgr: tuple[int, int, int], size: int = 16) -> np.ndarray:
    img = np.zeros((size, size, 3), dtype=np.uint8)
    img[:, :] = bgr
    return img


def test_registry_lists_every_builtin():
    names = {entry["id"] for entry in list_builtin_luts()}
    assert names == {"neutral", "warm_soft", "cool_soft"}
    for entry in list_builtin_luts():
        assert set(entry.keys()) >= {"id", "displayName", "description", "swatch", "size"}
        swatch = entry["swatch"]
        assert 0 <= swatch["r"] <= 255
        assert 0 <= swatch["g"] <= 255
        assert 0 <= swatch["b"] <= 255


def test_unknown_id_returns_none():
    assert get_builtin_lut("nothing_here") is None


def test_neutral_is_numerical_identity():
    lut = get_builtin_lut("neutral")
    assert lut is not None
    image = np.array([
        [[0, 0, 0], [128, 128, 128]],
        [[60, 200, 40], [255, 255, 255]],
    ], dtype=np.uint8)
    out = apply_lut(image, lut, strength=100)
    assert np.all(np.abs(out.astype(int) - image.astype(int)) <= 1)


def test_warm_soft_lifts_red_drops_blue_on_midtone():
    lut = get_builtin_lut("warm_soft")
    assert lut is not None
    mid = _solid_bgr((128, 128, 128))
    warm = apply_lut(mid, lut, strength=100)
    mean_b, mean_g, mean_r = warm.mean(axis=(0, 1))
    assert mean_r > 128
    assert mean_b < 128


def test_cool_soft_mirrors_warm_direction():
    lut = get_builtin_lut("cool_soft")
    assert lut is not None
    mid = _solid_bgr((128, 128, 128))
    cool = apply_lut(mid, lut, strength=100)
    mean_b, mean_g, mean_r = cool.mean(axis=(0, 1))
    assert mean_r < 128
    assert mean_b > 128


def test_strength_interpolates_between_identity_and_full_look():
    lut = get_builtin_lut("warm_soft")
    assert lut is not None
    mid = _solid_bgr((128, 128, 128))
    full = apply_lut(mid, lut, strength=100)
    half = apply_lut(mid, lut, strength=50)
    # Half-strength should sit between input (128) and full output on R.
    _, _, r_half = half.mean(axis=(0, 1))
    _, _, r_full = full.mean(axis=(0, 1))
    assert 128 < r_half < r_full


def test_looks_preserve_white_and_black():
    """Black should stay black and white should stay white across all
    built-in LUTs — a safety property so a warm/cool look doesn't
    accidentally clip highlights or lift shadows off the floor."""
    for lut_id in ("neutral", "warm_soft", "cool_soft"):
        lut = get_builtin_lut(lut_id)
        assert lut is not None
        black = apply_lut(_solid_bgr((0, 0, 0)), lut, strength=100)
        white = apply_lut(_solid_bgr((255, 255, 255)), lut, strength=100)
        # Accept some drift — ±3 on shadows and highlights is within
        # quantisation noise for an intentionally subtle look.
        assert black.mean() <= 3, f"{lut_id} lifted black to {black.mean():.1f}"
        assert white.mean() >= 252, f"{lut_id} crushed white to {white.mean():.1f}"

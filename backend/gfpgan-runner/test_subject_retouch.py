"""Deterministic tests for subject_retouch.

Each look is exercised on synthetic solid-colour images where we can
predict the direction of the LAB shift analytically. No ML models, no
image fixtures on disk — everything is reproducible on any CI box with
numpy + opencv.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from subject_retouch import (
    apply_aviation_look,
    apply_food_look,
    apply_landscape_look,
    apply_product_look,
    apply_subject_look,
    apply_vehicle_look,
)


def _solid_bgr(color: tuple[int, int, int], size: int = 64) -> np.ndarray:
    img = np.zeros((size, size, 3), dtype=np.uint8)
    img[:, :] = color
    return img


def _mean_lab(image: np.ndarray) -> tuple[float, float, float]:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    return (
        float(lab[..., 0].mean()),
        float(lab[..., 1].mean()),
        float(lab[..., 2].mean()),
    )


def _lab_range(image: np.ndarray) -> tuple[float, float, float]:
    """Per-channel range (max - min) — useful for asserting contrast
    moved. Contrast-increasing effects widen the L range."""
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    return (
        float(lab[..., 0].max() - lab[..., 0].min()),
        float(lab[..., 1].max() - lab[..., 1].min()),
        float(lab[..., 2].max() - lab[..., 2].min()),
    )


def _gradient_bgr(size: int = 64) -> np.ndarray:
    """Build a horizontal greyscale gradient so contrast-widening
    effects have something to widen. Solid colour images have 0 range
    by definition so L-range tests are meaningless on them."""
    xs = np.linspace(40, 215, size, dtype=np.uint8)
    row = np.tile(xs, (size, 1))
    return cv2.cvtColor(row, cv2.COLOR_GRAY2BGR)


def _tinted_gradient(a_cast: int = 0, b_cast: int = 0, size: int = 64) -> np.ndarray:
    """Greyscale gradient shifted in LAB so tests have something to
    saturate. a/b_cast are deltas around neutral 128."""
    grad = _gradient_bgr(size)
    lab = cv2.cvtColor(grad, cv2.COLOR_BGR2LAB).astype(np.int32)
    lab[..., 1] = np.clip(lab[..., 1] + a_cast, 0, 255)
    lab[..., 2] = np.clip(lab[..., 2] + b_cast, 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


# ───────────────────────────── Food ──────────────────────────────────

def test_food_shifts_toward_warm():
    # Start neutral grey — the warm shift should show up as b > 128.
    img = _solid_bgr((128, 128, 128))
    _, _, b_before = _mean_lab(img)
    out = apply_food_look(img, 1.0)
    _, _, b_after = _mean_lab(out)
    # Food push nudges b toward yellow for neutral mids.
    assert b_after > b_before


def test_food_strength_zero_is_identity():
    img = _solid_bgr((120, 120, 120))
    out = apply_food_look(img, 0.0)
    np.testing.assert_array_equal(out, img)


def test_food_strength_negative_is_identity():
    img = _solid_bgr((120, 120, 120))
    out = apply_food_look(img, -0.5)
    np.testing.assert_array_equal(out, img)


def test_food_strength_is_monotone_in_warm_direction():
    # Higher strength should push b further, not less.
    img = _solid_bgr((128, 128, 128))
    _, _, b0 = _mean_lab(img)
    _, _, b_mid = _mean_lab(apply_food_look(img, 0.4))
    _, _, b_full = _mean_lab(apply_food_look(img, 1.0))
    assert b_mid > b0
    assert b_full > b_mid


def test_food_boosts_warm_saturation_harder_than_cool():
    # Warm (positive b) side should expand more than cool side.
    warm_in = _tinted_gradient(b_cast=+30)
    cool_in = _tinted_gradient(b_cast=-30)
    _, _, b_warm_before = _mean_lab(warm_in)
    _, _, b_cool_before = _mean_lab(cool_in)
    _, _, b_warm_after = _mean_lab(apply_food_look(warm_in, 1.0))
    _, _, b_cool_after = _mean_lab(apply_food_look(cool_in, 1.0))
    # Warm side moves more from its original than cool side does.
    warm_delta = abs(b_warm_after - b_warm_before)
    cool_delta = abs(b_cool_after - b_cool_before)
    assert warm_delta > cool_delta


# ─────────────────────────── Landscape ───────────────────────────────

def test_landscape_increases_L_range():
    # The dehaze curve widens L-range on gradients — that's the whole
    # point of the contrast push.
    grad = _gradient_bgr()
    L_range_before, _, _ = _lab_range(grad)
    L_range_after, _, _ = _lab_range(apply_landscape_look(grad, 1.0))
    assert L_range_after > L_range_before + 2


def test_landscape_boosts_saturation_both_directions():
    # Landscape saturation push is symmetric — it expands a/b away
    # from 128 in either direction. Tint on either side must grow.
    tinted = _tinted_gradient(a_cast=+20, b_cast=-15)
    _, a_before, b_before = _mean_lab(tinted)
    _, a_after, b_after = _mean_lab(apply_landscape_look(tinted, 1.0))
    # a was +20 above neutral → should grow further above.
    assert a_after > a_before
    # b was -15 below neutral → should shrink further below.
    assert b_after < b_before


def test_landscape_strength_zero_identity():
    img = _gradient_bgr()
    out = apply_landscape_look(img, 0)
    np.testing.assert_array_equal(out, img)


# ──────────────────────────── Vehicle ────────────────────────────────

def test_vehicle_sharpens_edges():
    # Create a hard edge, verify unsharp increases the edge contrast.
    img = np.full((64, 64, 3), 140, dtype=np.uint8)
    img[:, 32:] = 110       # step edge at x=32
    out = apply_vehicle_look(img, 1.0)
    # Edge magnitude = difference across the step. Sharpened edge is
    # sharper, so the two sides diverge more.
    edge_before = int(img[32, 31, 0]) - int(img[32, 32, 0])
    edge_after = int(out[32, 31, 0]) - int(out[32, 32, 0])
    assert abs(edge_after) > abs(edge_before)


def test_vehicle_strength_zero_identity():
    img = _solid_bgr((120, 120, 120))
    out = apply_vehicle_look(img, 0)
    np.testing.assert_array_equal(out, img)


def test_vehicle_preserves_flat_areas_approximately():
    # Large flat area should stay near its original tone (unsharp on
    # a flat has 0 high-freq signal → no change). Allow LAB round-trip
    # slack.
    img = _solid_bgr((150, 150, 150), size=48)
    out = apply_vehicle_look(img, 1.0)
    diff = int(img[24, 24, 0]) - int(out[24, 24, 0])
    assert abs(diff) <= 3


# ──────────────────────────── Aviation ───────────────────────────────

def test_aviation_widens_L_more_than_landscape():
    # Aviation pushes contrast harder than landscape at the same
    # strength — that's the design.
    grad = _gradient_bgr()
    L_landscape, _, _ = _lab_range(apply_landscape_look(grad, 1.0))
    L_aviation, _, _ = _lab_range(apply_aviation_look(grad, 1.0))
    assert L_aviation > L_landscape


def test_aviation_saturates_gentler_than_landscape():
    # And it saturates GENTLER than landscape — avoids cobalt-sky.
    tint = _tinted_gradient(b_cast=-30)  # strong cool tint (sky blue)
    _, _, b_before = _mean_lab(tint)
    _, _, b_landscape = _mean_lab(apply_landscape_look(tint, 1.0))
    _, _, b_aviation = _mean_lab(apply_aviation_look(tint, 1.0))
    # Both push b further below 128, but aviation should push less.
    landscape_delta = abs(b_landscape - b_before)
    aviation_delta = abs(b_aviation - b_before)
    assert landscape_delta > aviation_delta


# ──────────────────────────── Product ────────────────────────────────

def test_product_lifts_highlights():
    # Gamma < 1 in the L-curve brightens mids. A mid-grey should read
    # brighter after the pass.
    img = _solid_bgr((140, 140, 140))
    L_before, _, _ = _mean_lab(img)
    out = apply_product_look(img, 1.0)
    L_after, _, _ = _mean_lab(out)
    assert L_after > L_before


def test_product_strength_zero_identity():
    img = _solid_bgr((220, 220, 220))
    out = apply_product_look(img, 0)
    np.testing.assert_array_equal(out, img)


# ──────────────────────── Dispatcher ─────────────────────────────────

def test_dispatch_routes_to_matching_look():
    img = _solid_bgr((128, 128, 128))
    # Food must produce the same result as calling apply_food_look direct.
    direct = apply_food_look(img, 0.7)
    via = apply_subject_look(img, 'food', 0.7)
    np.testing.assert_array_equal(via, direct)


def test_dispatch_case_and_whitespace_tolerant():
    img = _solid_bgr((128, 128, 128))
    baseline = apply_subject_look(img, 'food', 0.7)
    np.testing.assert_array_equal(
        apply_subject_look(img, '  FOOD  ', 0.7), baseline,
    )
    np.testing.assert_array_equal(
        apply_subject_look(img, 'Food', 0.7), baseline,
    )


@pytest.mark.parametrize(
    'subject',
    ['portrait', 'group_portrait', 'other', '', None, 'moose', 'unknown'],
)
def test_dispatch_noop_on_non_subject_kinds(subject):
    img = _gradient_bgr()
    out = apply_subject_look(img, subject, 1.0)
    np.testing.assert_array_equal(out, img)


def test_dispatch_zero_strength_is_identity_for_all_kinds():
    img = _gradient_bgr()
    for subject in ('food', 'landscape', 'vehicle', 'aviation', 'product'):
        out = apply_subject_look(img, subject, 0.0)
        np.testing.assert_array_equal(out, img, err_msg=subject)


def test_dispatch_negative_strength_is_identity():
    img = _gradient_bgr()
    np.testing.assert_array_equal(
        apply_subject_look(img, 'food', -0.5), img,
    )


def test_dispatch_survives_raising_look_function(monkeypatch):
    # If a look function throws, the dispatcher must return the input
    # unchanged — enhance response never depends on the look passing.
    import subject_retouch as sr

    def explode(_image: np.ndarray, _strength: float) -> np.ndarray:
        raise RuntimeError('synthetic failure')

    monkeypatch.setitem(sr._LOOKS, 'food', explode)
    img = _solid_bgr((180, 160, 150))
    out = apply_subject_look(img, 'food', 1.0)
    np.testing.assert_array_equal(out, img)

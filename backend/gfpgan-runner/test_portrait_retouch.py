"""Deterministic tests for the portrait retouch module.

All tests build synthetic images + synthetic masks so the suite does not
depend on MediaPipe being installed (CI-safe). The orchestrator path is
exercised by passing a manually-constructed ``FaceRegions`` dataclass,
which bypasses the MediaPipe detector entirely.

Run with:

    cd backend/gfpgan-runner
    python -m pytest test_portrait_retouch.py -v

All effects are designed around LAB colour space, so we assert on LAB
deltas rather than BGR differences — that makes the tests robust to the
lossy BGR↔LAB round-trip quantisation.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from portrait_retouch import (
    FaceRegions,
    apply_portrait_retouch,
    brighten_eyes,
    build_regions_from_points,
    feather_mask,
    polygon_mask,
    remove_blemishes,
    whiten_sclera,
    whiten_teeth,
)


# ─────────────────────────── Helpers ─────────────────────────────────

def _solid_bgr(color: tuple[int, int, int], size: int = 64) -> np.ndarray:
    """Build an (size, size, 3) BGR image filled with ``color``."""
    img = np.zeros((size, size, 3), dtype=np.uint8)
    img[:, :] = color
    return img


def _mean_lab(image: np.ndarray, mask: np.ndarray) -> tuple[float, float, float]:
    """Mean LAB triplet inside ``mask`` (uint8, >0 = included)."""
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    inside = mask > 0
    if not inside.any():
        raise AssertionError("mask selects no pixels")
    return (
        float(lab[..., 0][inside].mean()),
        float(lab[..., 1][inside].mean()),
        float(lab[..., 2][inside].mean()),
    )


def _disc_mask(shape: tuple[int, int], center: tuple[int, int], radius: int) -> np.ndarray:
    mask = np.zeros(shape, dtype=np.uint8)
    cv2.circle(mask, center, radius, 255, thickness=-1)
    return mask


# ───────────────────────── Mask utilities ────────────────────────────

def test_feather_mask_preserves_max_at_centre():
    mask = np.zeros((40, 40), dtype=np.uint8)
    cv2.circle(mask, (20, 20), 10, 255, thickness=-1)
    feathered = feather_mask(mask, pixels=5)
    # Feathering only softens the edges, not the interior.
    assert feathered[20, 20] == pytest.approx(1.0, abs=0.01)
    # Just outside the original radius we expect some weight (edge
    # bleed) but still well under 1.
    assert 0.0 < feathered[20, 30] < 1.0


def test_feather_mask_zero_pixels_returns_plain_weights():
    mask = np.full((8, 8), 128, dtype=np.uint8)
    feathered = feather_mask(mask, pixels=0)
    # No blur, just normalise to 0..1.
    np.testing.assert_allclose(feathered, np.full((8, 8), 128 / 255.0), atol=1e-6)


def test_polygon_mask_triangle():
    mask = polygon_mask((20, 20), np.array([[2, 2], [18, 2], [10, 18]]))
    # Triangle vertices are inside the mask.
    assert mask[2, 2] > 0
    assert mask[10, 10] > 0
    # Corner opposite the apex stays zero.
    assert mask[19, 0] == 0


def test_polygon_mask_too_few_points_returns_empty():
    mask = polygon_mask((10, 10), np.array([[1, 1], [2, 2]]))
    assert mask.max() == 0


# ────────────────────────── Teeth whiten ─────────────────────────────

def test_whiten_teeth_neutralises_yellow_cast():
    # Yellowish BGR "teeth" (low blue, high red+green).
    img = _solid_bgr((120, 200, 210), size=64)
    mask = _disc_mask(img.shape[:2], (32, 32), 14)

    _, _, b_before = _mean_lab(img, mask)
    out = whiten_teeth(img, mask, strength=1.0, feather_px=3)
    _, _, b_after = _mean_lab(out, mask)

    # Yellow cast means LAB b-channel > 128. After whitening the mean b
    # inside the mask should move measurably toward 128.
    assert b_before > 128
    assert b_after < b_before - 2


def test_whiten_teeth_strength_zero_is_identity():
    img = _solid_bgr((120, 200, 210), size=32)
    mask = _disc_mask(img.shape[:2], (16, 16), 8)
    out = whiten_teeth(img, mask, strength=0.0)
    np.testing.assert_array_equal(out, img)


def test_whiten_teeth_empty_mask_is_identity():
    img = _solid_bgr((100, 150, 180), size=16)
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    out = whiten_teeth(img, mask, strength=1.0)
    np.testing.assert_array_equal(out, img)


def test_whiten_teeth_mask_shape_mismatch_raises():
    img = _solid_bgr((120, 200, 210), size=32)
    bad = np.ones((10, 10), dtype=np.uint8) * 255
    with pytest.raises(ValueError):
        whiten_teeth(img, bad, strength=0.5)


def test_whiten_teeth_does_not_touch_pixels_outside_mask():
    img = _solid_bgr((120, 200, 210), size=48)
    mask = _disc_mask(img.shape[:2], (24, 24), 10)
    out = whiten_teeth(img, mask, strength=1.0, feather_px=0)
    # A corner far from the mask must be essentially untouched. We
    # tolerate 1 LSB drift because cv2.cvtColor(BGR→LAB→BGR) is not
    # bit-exact (floor(scale) rounding on each channel). What matters
    # is the effect doesn't leak meaningfully past the mask edge.
    np.testing.assert_allclose(
        out[0, 0].astype(np.int16),
        img[0, 0].astype(np.int16),
        atol=1,
    )


# ────────────────────────── Eye brighten ─────────────────────────────

def test_brighten_eyes_lifts_L_inside_mask():
    img = _solid_bgr((80, 60, 40), size=32)  # dark iris stand-in
    mask = _disc_mask(img.shape[:2], (16, 16), 6)
    L_before, _, _ = _mean_lab(img, mask)
    out = brighten_eyes(img, mask, strength=1.0, feather_px=1)
    L_after, _, _ = _mean_lab(out, mask)
    assert L_after > L_before + 3


def test_brighten_eyes_preserves_iris_colour():
    # Any colour direction should keep its direction after brightening —
    # we're moving on L, not a/b.
    img = _solid_bgr((40, 20, 90), size=32)  # reddish iris
    mask = _disc_mask(img.shape[:2], (16, 16), 6)
    _, a_before, b_before = _mean_lab(img, mask)
    out = brighten_eyes(img, mask, strength=1.0, feather_px=1)
    _, a_after, b_after = _mean_lab(out, mask)
    # a/b deltas should be near zero (LAB quantisation may wiggle a bit).
    assert abs(a_after - a_before) < 3
    assert abs(b_after - b_before) < 3


# ────────────────────────── Eye whiten ───────────────────────────────

def test_whiten_sclera_reduces_red_cast():
    # Slightly reddened sclera (a-channel above 128).
    img = _solid_bgr((230, 230, 245), size=40)
    mask = _disc_mask(img.shape[:2], (20, 20), 9)
    _, a_before, _ = _mean_lab(img, mask)
    # Nudge the a-channel upward so we have a defined redness to remove.
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.int32)
    lab[..., 1] = np.clip(lab[..., 1] + 12, 0, 255)
    img = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)

    _, a_before, _ = _mean_lab(img, mask)
    out = whiten_sclera(img, mask, strength=1.0, feather_px=1)
    _, a_after, _ = _mean_lab(out, mask)
    assert a_before > 128
    assert a_after < a_before - 2


# ────────────────────────── Blemish removal ──────────────────────────

def test_remove_blemishes_removes_small_spot():
    # Flat skin with a single dark "blemish" pixel — bilateral +
    # median heals it to near the surrounding tone.
    img = _solid_bgr((180, 160, 150), size=64)
    img[32, 32] = (40, 30, 20)  # one dark pixel
    mask = _disc_mask(img.shape[:2], (32, 32), 14)
    out = remove_blemishes(img, mask, strength=1.0, feather_px=3)

    # Distance from the healed centre to the surrounding colour should
    # shrink dramatically. We test in float32 to avoid uint8 rounding.
    before = np.linalg.norm(img[32, 32].astype(np.float32) - np.array([180, 160, 150]))
    after = np.linalg.norm(out[32, 32].astype(np.float32) - np.array([180, 160, 150]))
    assert after < before * 0.3


def test_remove_blemishes_preserves_background_outside_mask():
    img = _solid_bgr((180, 160, 150), size=48)
    # A feature outside the mask that must remain untouched.
    img[2, 2] = (20, 20, 20)
    mask = _disc_mask(img.shape[:2], (24, 24), 8)
    out = remove_blemishes(img, mask, strength=1.0, feather_px=0)
    np.testing.assert_array_equal(out[2, 2], img[2, 2])


# ─────────────────────── Orchestrator / regions ──────────────────────

def _fake_face_regions(shape: tuple[int, int]) -> FaceRegions:
    """Build a FaceRegions set that covers plausible portrait geometry
    on a synthetic 128x128 canvas."""
    h, w = shape
    skin_points = np.array(
        [[w // 2, 10], [w - 10, h // 2], [w // 2, h - 10], [10, h // 2]],
    )
    teeth = _disc_mask(shape, (w // 2, int(h * 0.72)), 8)
    left_iris = _disc_mask(shape, (int(w * 0.38), int(h * 0.45)), 3)
    right_iris = _disc_mask(shape, (int(w * 0.62), int(h * 0.45)), 3)
    left_sclera = cv2.bitwise_and(
        _disc_mask(shape, (int(w * 0.38), int(h * 0.45)), 6),
        cv2.bitwise_not(left_iris),
    )
    right_sclera = cv2.bitwise_and(
        _disc_mask(shape, (int(w * 0.62), int(h * 0.45)), 6),
        cv2.bitwise_not(right_iris),
    )
    skin = polygon_mask(shape, skin_points)
    # Skin excludes features so blemish removal doesn't smear eyes/teeth.
    for sub in (teeth, left_iris, right_iris, left_sclera, right_sclera):
        skin = cv2.bitwise_and(skin, cv2.bitwise_not(sub))
    return FaceRegions(
        teeth=teeth,
        left_iris=left_iris,
        right_iris=right_iris,
        left_sclera=left_sclera,
        right_sclera=right_sclera,
        skin=skin,
    )


def test_apply_portrait_retouch_noop_when_all_strengths_zero():
    img = _solid_bgr((180, 160, 150), size=128)
    regions = _fake_face_regions(img.shape[:2])
    out = apply_portrait_retouch(img, {}, regions=regions)
    # Must return the exact same array when no slider is active.
    np.testing.assert_array_equal(out, img)


def test_apply_portrait_retouch_runs_all_effects():
    # Skin with a yellow-teeth zone + reddish sclera + one dark spot.
    img = _solid_bgr((170, 160, 150), size=128)
    regions = _fake_face_regions(img.shape[:2])
    # Stamp a yellow cast on the teeth zone so whitening has something
    # to do.
    img[regions.teeth > 0] = (80, 180, 200)
    # Stamp a reddish cast on the sclera zones.
    for sclera in (regions.left_sclera, regions.right_sclera):
        img[sclera > 0] = (210, 210, 245)
    # Stamp a dark blemish inside skin.
    ys, xs = np.where(regions.skin > 0)
    if len(ys):
        img[ys[0], xs[0]] = (30, 30, 30)

    out = apply_portrait_retouch(
        img,
        {
            "teethWhiteness": 100,
            "eyeBrightness": 80,
            "eyeWhiteness": 70,
            "blemishRemoval": 90,
        },
        regions=regions,
    )
    assert out.shape == img.shape
    assert out.dtype == np.uint8
    # At least one effect zone must show a measurable change, otherwise
    # the orchestrator wired nothing.
    _, _, b_before = _mean_lab(img, regions.teeth)
    _, _, b_after = _mean_lab(out, regions.teeth)
    assert b_after < b_before


def test_apply_portrait_retouch_returns_input_when_no_face():
    img = _solid_bgr((200, 200, 200), size=64)
    # Passing regions=None and not invoking MediaPipe is handled by
    # detect_face_regions returning None when mediapipe isn't present.
    # In the test env we mimic that by feeding an all-None regions.
    empty = FaceRegions(
        teeth=None,
        left_iris=None,
        right_iris=None,
        left_sclera=None,
        right_sclera=None,
        skin=None,
    )
    out = apply_portrait_retouch(
        img,
        {"teethWhiteness": 100, "blemishRemoval": 100},
        regions=empty,
    )
    np.testing.assert_array_equal(out, img)


def test_apply_portrait_retouch_ignores_unknown_keys():
    img = _solid_bgr((170, 160, 150), size=64)
    regions = _fake_face_regions(img.shape[:2])
    # Unknown sliders must not raise or affect output.
    out = apply_portrait_retouch(
        img,
        {"moustacheLength": 999, "alienAntennas": True},
        regions=regions,
    )
    np.testing.assert_array_equal(out, img)


def test_intensity_profile_scales_lab_shift():
    """At the same slider value, `strong` must push LAB further than
    `normal`, which must push further than `subtle`. This is the core
    invariant of the profile system — if it breaks, the three presets
    collapse into the same effect."""
    img = _solid_bgr((120, 200, 210), size=64)  # yellow-cast teeth
    mask = _disc_mask(img.shape[:2], (32, 32), 14)

    _, _, b_orig = _mean_lab(img, mask)
    _, _, b_sub = _mean_lab(
        whiten_teeth(img, mask, strength=1.0, feather_px=3, profile="subtle"),
        mask,
    )
    _, _, b_norm = _mean_lab(
        whiten_teeth(img, mask, strength=1.0, feather_px=3, profile="normal"),
        mask,
    )
    _, _, b_strong = _mean_lab(
        whiten_teeth(img, mask, strength=1.0, feather_px=3, profile="strong"),
        mask,
    )
    # All three pull b toward 128, and each profile should pull further
    # than the previous. Allow 0.5 LSB slack for LAB round-trip.
    assert b_orig > b_sub > b_norm > b_strong
    assert (b_orig - b_strong) > (b_orig - b_norm) + 0.5
    assert (b_orig - b_norm) > (b_orig - b_sub) + 0.5


def test_intensity_profile_unknown_falls_back_to_normal():
    img = _solid_bgr((120, 200, 210), size=48)
    mask = _disc_mask(img.shape[:2], (24, 24), 10)
    # Unknown profile value must behave identically to "normal".
    _, _, b_bogus = _mean_lab(
        whiten_teeth(img, mask, strength=1.0, feather_px=3, profile="whatever"),
        mask,
    )
    _, _, b_normal = _mean_lab(
        whiten_teeth(img, mask, strength=1.0, feather_px=3, profile="normal"),
        mask,
    )
    assert abs(b_bogus - b_normal) < 0.5


def test_blemish_profile_changes_max_blend():
    """Blemish profile gates the ceiling of how aggressively the
    healed layer replaces the original. At strength=1.0, `subtle` must
    leave measurable original contrast while `strong` erases it."""
    img = _solid_bgr((180, 160, 150), size=64)
    img[32, 32] = (40, 30, 20)  # dark spot
    mask = _disc_mask(img.shape[:2], (32, 32), 14)

    def _distance_after(profile: str) -> float:
        out = remove_blemishes(img, mask, strength=1.0, feather_px=3, profile=profile)
        return float(np.linalg.norm(
            out[32, 32].astype(np.float32) - np.array([180, 160, 150])
        ))

    d_sub = _distance_after("subtle")
    d_norm = _distance_after("normal")
    d_strong = _distance_after("strong")
    # Stronger profile → closer to the healed colour → smaller distance.
    assert d_strong < d_norm < d_sub


def test_orchestrator_reads_profile_keys():
    """The orchestrator must route the per-effect profile keys from
    ``controls`` into the effect functions. We smoke-test by setting
    `strong` on teeth + `subtle` on blemish and verifying that teeth
    LAB-shift is larger than the plain normal baseline would give."""
    img = _solid_bgr((170, 160, 150), size=128)
    regions = _fake_face_regions(img.shape[:2])
    img[regions.teeth > 0] = (80, 180, 200)  # yellow teeth

    _, _, b_before = _mean_lab(img, regions.teeth)
    out = apply_portrait_retouch(
        img,
        {
            "teethWhiteness": 100,
            "teethProfile": "strong",
            "blemishRemoval": 50,
            "blemishProfile": "subtle",
        },
        regions=regions,
    )
    _, _, b_after_strong = _mean_lab(out, regions.teeth)

    out_normal = apply_portrait_retouch(
        img,
        {"teethWhiteness": 100},  # profile defaults to normal
        regions=regions,
    )
    _, _, b_after_normal = _mean_lab(out_normal, regions.teeth)

    # Strong profile pulls b further toward 128 than the default normal.
    assert b_after_strong < b_after_normal


def test_apply_portrait_retouch_handles_nan_and_negative():
    img = _solid_bgr((170, 160, 150), size=64)
    regions = _fake_face_regions(img.shape[:2])
    # Garbage inputs clamp to 0 instead of poisoning the LAB math.
    out = apply_portrait_retouch(
        img,
        {
            "teethWhiteness": float("nan"),
            "blemishRemoval": -50,
            "eyeBrightness": "oops",
            "eyeWhiteness": 200,  # out-of-range → clamps to 100
        },
        regions=regions,
    )
    assert out.shape == img.shape
    assert out.dtype == np.uint8


# ─────────────────── Landmark-driven mask builder ────────────────────

def test_build_regions_from_points_returns_region_masks():
    shape = (64, 64)
    # Construct a 478-point fake landmark array where the indices we
    # care about form sensible polygons. Everything else can be (0, 0).
    points = np.zeros((478, 2), dtype=np.int32)
    from portrait_retouch import (
        FACE_OVAL_INDICES,
        LEFT_EYE_CONTOUR_INDICES,
        LEFT_IRIS_INDICES,
        MOUTH_INNER_INDICES,
        RIGHT_EYE_CONTOUR_INDICES,
        RIGHT_IRIS_INDICES,
    )

    def place(indices, polygon):
        for idx, pt in zip(indices, polygon):
            points[idx] = pt

    place(MOUTH_INNER_INDICES, [[28, 45], [36, 45], [36, 50], [28, 50]])
    place(LEFT_IRIS_INDICES, [[22, 28], [25, 28], [25, 31], [22, 31], [23, 29]])
    place(RIGHT_IRIS_INDICES, [[39, 28], [42, 28], [42, 31], [39, 31], [40, 29]])
    place(LEFT_EYE_CONTOUR_INDICES, [
        [18, 28], [28, 28], [28, 33], [18, 33],
        [19, 29], [27, 29], [27, 32], [19, 32],
        [20, 30], [26, 30], [26, 31], [20, 31],
        [21, 29], [25, 29], [25, 32], [21, 32],
    ])
    place(RIGHT_EYE_CONTOUR_INDICES, [
        [36, 28], [46, 28], [46, 33], [36, 33],
        [37, 29], [45, 29], [45, 32], [37, 32],
        [38, 30], [44, 30], [44, 31], [38, 31],
        [39, 29], [43, 29], [43, 32], [39, 32],
    ])
    place(FACE_OVAL_INDICES, [
        [32, 5], [40, 6], [46, 10], [50, 16], [52, 22], [54, 28],
        [54, 34], [52, 40], [48, 46], [44, 52], [38, 57], [32, 59],
        [26, 57], [20, 52], [16, 46], [12, 40], [10, 34], [10, 28],
        [12, 22], [14, 16], [18, 10], [24, 6],
        [32, 7], [38, 8], [42, 12], [46, 18], [48, 24], [50, 30],
        [50, 36], [48, 42], [44, 48], [40, 54], [34, 58], [32, 58],
        [30, 58], [24, 54],
    ])

    regions = build_regions_from_points(points, shape)
    assert regions.teeth is not None and regions.teeth.max() > 0
    assert regions.left_iris is not None and regions.left_iris.max() > 0
    assert regions.right_iris is not None and regions.right_iris.max() > 0
    assert regions.left_sclera is not None and regions.left_sclera.max() > 0
    assert regions.right_sclera is not None and regions.right_sclera.max() > 0
    assert regions.skin is not None and regions.skin.max() > 0

    # Sclera must not overlap iris (the subtraction worked).
    assert cv2.bitwise_and(regions.left_sclera, regions.left_iris).max() == 0
    assert cv2.bitwise_and(regions.right_sclera, regions.right_iris).max() == 0

    # Skin must not overlap eyes or mouth (we exclude features so
    # blemish removal can't smear them).
    assert cv2.bitwise_and(regions.skin, regions.teeth).max() == 0

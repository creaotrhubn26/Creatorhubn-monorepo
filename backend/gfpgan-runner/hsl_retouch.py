"""8-band HSL colour grading for the CreatorHub photo enhancer.

This module runs post-GFPGAN / portrait retouch and before subject look.
It exposes the 8 hue bands Evoto / Lightroom photographers are used to
(red, orange, yellow, green, aqua, blue, purple, magenta) and for each
band accepts ±100 hue / saturation / luminance offsets.

Design:
    * Pure function ``apply_hsl(image, params)``. No global state, no
      file I/O, no cv2.cvtColor side effects leaked back out.
    * Vectorised numpy — one pass over the pixels, no Python inner loops.
    * Band weights use a raised-cosine window so adjacent bands overlap
      smoothly. We normalise the weights per pixel so the weighted deltas
      always reconstruct to a unit sum — prevents over-saturation in the
      overlap regions.
    * All math in float32 until the final cast back to uint8.
    * Silently no-ops on an empty / malformed params dict, so calling this
      with default zero values never touches the pixels (identity).

Band contract (centre degrees on the HSV hue circle, 0-360°):

    red      0°    (wraps to 360°)
    orange   30°
    yellow   60°
    green    120°
    aqua     180°
    blue     240°
    purple   270°
    magenta  300°

Params shape (matches ``PhotoEnhancerSettings.hsl`` in the TS routes):

    {
      "red":     {"h": 0, "s": 0, "l": 0},
      "orange":  {"h": 0, "s": 0, "l": 0},
      ...
    }

Each value is an int/float in [-100, 100]. We clamp defensively.
"""
from __future__ import annotations

import logging
from typing import Any, Mapping

import cv2
import numpy as np

logger = logging.getLogger("creatorhub.hsl_retouch")


HSL_BAND_ORDER: tuple[str, ...] = (
    "red",
    "orange",
    "yellow",
    "green",
    "aqua",
    "blue",
    "purple",
    "magenta",
)

# Centre hue for each band, degrees on the 0–360 HSV circle. These map
# directly to Evoto / Lightroom conventions so a photographer tweaking
# "Blue" on either gets visually comparable results.
HSL_BAND_CENTERS: tuple[float, ...] = (
    0.0,    # red (wraps)
    30.0,   # orange
    60.0,   # yellow
    120.0,  # green
    180.0,  # aqua
    240.0,  # blue
    270.0,  # purple
    300.0,  # magenta
)

# Half-width of the cosine window for each band's influence, in degrees.
# Chosen so adjacent bands overlap by ~half — smooth transitions without
# giant cross-band bleed. Centres closer than others (blue→purple only
# 30° apart) naturally see tighter mutual overlap; the normaliser below
# handles that without manual per-band tuning.
HSL_BAND_HALF_WIDTH_DEG: float = 40.0

# Scale factors from ±100 slider units to practical HSV deltas:
#   hue       : slider units ↦ degrees of hue rotation (±30° max)
#   saturation: slider units ↦ multiplicative factor (0.5–1.5 at ±100)
#   lightness : slider units ↦ additive V offset in [0..1] space (±0.2 max)
#
# These match the "noticeable but not destructive" tuning target — a
# 100-slider feels strong but doesn't blow the channel out.
HUE_DELTA_PER_UNIT: float = 0.30          # degrees per slider unit (±30° at ±100)
SAT_DELTA_PER_UNIT: float = 0.010         # × multiplier per slider unit (0.0–2.0 at ±100, matches Evoto)
LUM_DELTA_PER_UNIT: float = 0.0025        # additive V per slider unit (±0.25 at ±100)

_DEFAULT_BAND: Mapping[str, float] = {"h": 0.0, "s": 0.0, "l": 0.0}


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _band_params(raw: Any) -> tuple[float, float, float]:
    """Extract clamped (h, s, l) slider values from a per-band params dict."""
    if not isinstance(raw, Mapping):
        return (0.0, 0.0, 0.0)
    h = _clamp(_coerce_float(raw.get("h")), -100.0, 100.0)
    s = _clamp(_coerce_float(raw.get("s")), -100.0, 100.0)
    l = _clamp(_coerce_float(raw.get("l")), -100.0, 100.0)
    return h, s, l


def _hsl_params_are_identity(params: Mapping[str, Any] | None) -> bool:
    if not params:
        return True
    for name in HSL_BAND_ORDER:
        h, s, l = _band_params(params.get(name))
        if h != 0.0 or s != 0.0 or l != 0.0:
            return False
    return True


def _compute_band_weights(
    hue_deg: np.ndarray, centres: np.ndarray, half_width: float
) -> np.ndarray:
    """Return (H, W, N) raised-cosine band weights for each pixel's hue.

    Weights are raised-cosine across the band's half-width, clipped to 0
    beyond the window, and per-pixel normalised so the 8 weights sum to 1.
    This guarantees the output is a convex combination of the per-band
    deltas — no band can "double count" in overlap regions.
    """
    # Angular distance on the hue circle: min(|h-c|, 360-|h-c|).
    diff = np.abs(hue_deg[..., np.newaxis] - centres[np.newaxis, np.newaxis, :])
    distance = np.minimum(diff, 360.0 - diff)

    # Raised cosine inside half_width, 0 outside. Clip before cosine so
    # pixels far from every band still get a valid (but near-zero) weight
    # sum.
    clipped = np.clip(distance / half_width, 0.0, 1.0)
    weights = 0.5 * (1.0 + np.cos(np.pi * clipped))
    weights = np.where(distance <= half_width, weights, 0.0)

    # If a pixel sits in a cold zone where every band's weight is zero
    # (rare — requires a band gap wider than 2*half_width), fall back to
    # the nearest-band indicator so we still apply *some* shift rather
    # than leave the pixel untouched for sliders the user explicitly
    # moved.
    weight_sum = weights.sum(axis=-1, keepdims=True)
    empty = weight_sum <= 1e-6
    if empty.any():
        nearest = np.argmin(distance, axis=-1)
        fallback = np.eye(centres.shape[0], dtype=weights.dtype)[nearest]
        weights = np.where(empty, fallback, weights)
        weight_sum = weights.sum(axis=-1, keepdims=True)

    return weights / weight_sum


def apply_hsl(image: np.ndarray, params: Mapping[str, Any] | None) -> np.ndarray:
    """Apply 8-band HSL to a BGR uint8 image. Returns a new BGR uint8 array.

    Safe to call with ``params=None`` or missing bands — unspecified bands
    default to zero and the function is identity when all sliders are 0.
    """
    if image is None or image.size == 0:
        return image
    if _hsl_params_are_identity(params):
        return image

    bgr = image
    if bgr.dtype != np.uint8:
        bgr = np.clip(bgr, 0, 255).astype(np.uint8)

    # Work in HSV full-range. OpenCV's HSV uses H in [0, 180] for uint8
    # and V/S in [0, 255] — we scale to degrees + unit floats so the math
    # below is hue-circle-correct.
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    hue_deg = hsv[..., 0] * 2.0  # 0..360
    sat = hsv[..., 1] / 255.0
    val = hsv[..., 2] / 255.0

    centres = np.asarray(HSL_BAND_CENTERS, dtype=np.float32)
    weights = _compute_band_weights(hue_deg, centres, HSL_BAND_HALF_WIDTH_DEG)

    # Build per-band delta vectors from the slider values.
    hue_deltas = np.zeros(len(HSL_BAND_ORDER), dtype=np.float32)
    sat_multipliers = np.ones(len(HSL_BAND_ORDER), dtype=np.float32)
    lum_deltas = np.zeros(len(HSL_BAND_ORDER), dtype=np.float32)
    params = params or {}
    for i, name in enumerate(HSL_BAND_ORDER):
        h, s, l = _band_params(params.get(name, _DEFAULT_BAND))
        hue_deltas[i] = h * HUE_DELTA_PER_UNIT                 # degrees
        sat_multipliers[i] = 1.0 + s * SAT_DELTA_PER_UNIT      # ×
        lum_deltas[i] = l * LUM_DELTA_PER_UNIT                 # additive V

    # Weighted per-pixel shifts.
    hue_shift = np.sum(weights * hue_deltas, axis=-1)
    sat_mul = np.sum(weights * sat_multipliers, axis=-1)
    lum_shift = np.sum(weights * lum_deltas, axis=-1)

    new_hue = (hue_deg + hue_shift) % 360.0
    new_sat = np.clip(sat * sat_mul, 0.0, 1.0)
    new_val = np.clip(val + lum_shift, 0.0, 1.0)

    hsv_out = np.empty_like(hsv)
    hsv_out[..., 0] = (new_hue / 2.0).astype(np.float32)
    hsv_out[..., 1] = (new_sat * 255.0).astype(np.float32)
    hsv_out[..., 2] = (new_val * 255.0).astype(np.float32)

    hsv_out = np.clip(hsv_out, 0.0, 255.0).astype(np.uint8)
    return cv2.cvtColor(hsv_out, cv2.COLOR_HSV2BGR)


__all__ = [
    "apply_hsl",
    "HSL_BAND_ORDER",
    "HSL_BAND_CENTERS",
    "HSL_BAND_HALF_WIDTH_DEG",
]

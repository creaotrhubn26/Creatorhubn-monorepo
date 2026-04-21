"""Face-region post-processing for the CreatorHub photo enhancer.

This module sits *after* GFPGAN face restoration in the enhance pipeline
and implements the Evoto-parity portrait sliders the web UI exposes:

    teethWhiteness  — neutralise yellow cast on teeth + gentle L-boost.
    eyeBrightness   — iris luminance lift without desaturating iris colour.
    eyeWhiteness    — sclera desaturation + subtle brighten.
    blemishRemoval  — frequency-separated healing pass on skin region.

Design goals:
    * All effects are pure functions of ``(image, mask, strength)`` so we
      can unit-test them on synthetic masks without pulling MediaPipe into
      the test environment (CI-safe).
    * Landmark detection is abstracted behind ``FaceLandmarkProvider`` and
      is lazy-initialised. If MediaPipe is missing or no face is found,
      the orchestrator silently skips the effects and returns the input —
      the GFPGAN path still succeeds.
    * Every effect feathers its mask before blending so there are no
      visible boundaries.
    * Strength is clamped to 0..100 and mapped to conservative intensities
      that match the "tasteful, non-plasticky" look Evoto ships. A slider
      at 100 is a noticeable but not exaggerated effect.

The caller (``app.py``) wires this in via a single call:

    image = apply_portrait_retouch(image, controls)

All math is done in float32 until the final cast back to uint8, so we
avoid compounding quantisation error across the four effects.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from threading import Lock
from typing import Any, Literal, Optional

import cv2
import numpy as np

logger = logging.getLogger("creatorhub.portrait_retouch")


# ─────────────────────── Intensity profiles ─────────────────────────
# Each portrait effect has a tuning profile that scales its internal
# LAB multipliers + feather radius. We expose the profile as a 3-way
# selector in the UI (subtle / normal / strong) rather than exposing
# the individual multipliers — the three profiles are tuned on real
# portraits, arbitrary per-knob access lets users plaster the face.
#
# ``normal`` is the reference tuning; ``subtle`` softens effects to
# ~60% of the LAB shift and tightens feather; ``strong`` pushes to
# ~140% and widens feather so larger regions blend smoothly.

IntensityProfile = Literal["subtle", "normal", "strong"]

_PROFILE_SCALES = {
    "subtle": 0.6,
    "normal": 1.0,
    "strong": 1.4,
}

# Feather-size deltas per profile. Subtle keeps the effect tight,
# strong widens so the bigger LAB push doesn't reveal a hard edge.
_PROFILE_FEATHER_DELTA = {
    "subtle": -2,
    "normal":  0,
    "strong": +3,
}


def _normalise_profile(value: Any) -> IntensityProfile:
    """Accept any caller input and clamp to one of the three known
    profiles. Defaults to ``normal`` on anything unrecognised so a
    broken settings round-trip still produces safe output."""
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("subtle", "normal", "strong"):
            return lowered  # type: ignore[return-value]
    return "normal"


def _scale_for(profile: Any) -> float:
    """Defensive lookup — any caller that sneaks in an unknown profile
    (e.g. direct tests or a typo in the controls payload) falls back to
    the ``normal`` tuning rather than crashing the retouch pass."""
    return _PROFILE_SCALES[_normalise_profile(profile)]


def _feather(profile: Any, base: int) -> int:
    """Produce the feather radius this profile wants given the effect's
    baseline. Kept ≥ 1 (and odd when we pass into Gaussian kernels —
    that's enforced inside ``feather_mask``). Defensive against unknown
    profiles for the same reason as ``_scale_for``."""
    return max(1, base + _PROFILE_FEATHER_DELTA[_normalise_profile(profile)])


# ───────────────────────── Strength helpers ──────────────────────────

def _clamp_strength(value: Any) -> float:
    """Map any user input to a 0.0..1.0 intensity.

    Settings arrive as 0..100 ints from the web UI, but we accept floats
    and out-of-range values defensively so that a misbehaving caller
    can't NaN-poison the LAB math downstream.
    """
    try:
        raw = float(value)
    except (TypeError, ValueError):
        return 0.0
    if raw != raw:  # NaN check
        return 0.0
    return max(0.0, min(100.0, raw)) / 100.0


# ────────────────────────── Mask utilities ───────────────────────────

def feather_mask(mask: np.ndarray, pixels: int = 9) -> np.ndarray:
    """Gaussian-feather a uint8 mask to a float32 0..1 weight map.

    A pure mask would create visible boundaries where the effect meets
    untouched pixels, so we soften the edges before blending. The
    kernel size is odd and scales with the effect radius — 9 px at the
    default works well on portraits resized to the 1600-px budget.
    """
    if pixels <= 0:
        return (mask.astype(np.float32) / 255.0)
    k = max(1, pixels | 1)  # ensure odd
    blurred = cv2.GaussianBlur(mask, (k, k), 0)
    return blurred.astype(np.float32) / 255.0


def _ensure_mask_shape(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Match mask shape to image (H,W). Refuses silent broadcasts that
    would paint effects into the wrong region."""
    if mask.shape[:2] != image.shape[:2]:
        raise ValueError(
            f"mask shape {mask.shape[:2]} does not match image {image.shape[:2]}"
        )
    if mask.dtype != np.uint8:
        mask = mask.astype(np.uint8)
    return mask


def polygon_mask(shape: tuple[int, int], points: np.ndarray) -> np.ndarray:
    """Fill a convex polygon into an empty uint8 mask.

    Used by both the landmark-driven builders and the tests (which pass
    synthetic points so the suite doesn't depend on MediaPipe).
    """
    mask = np.zeros(shape, dtype=np.uint8)
    if points is None or len(points) < 3:
        return mask
    pts = np.asarray(points, dtype=np.int32).reshape(-1, 1, 2)
    cv2.fillConvexPoly(mask, pts, 255)
    return mask


# ──────────────────────────── Effect ops ─────────────────────────────
# Each effect takes (image_bgr_uint8, mask_uint8, strength_0_to_1)
# and returns image_bgr_uint8. ``strength == 0`` always returns the
# input unchanged so the orchestrator can safely wire all four in
# series regardless of which sliders the user moved.

def whiten_teeth(
    image: np.ndarray,
    mask: np.ndarray,
    strength: float,
    feather_px: int = 7,
    profile: IntensityProfile = "normal",
) -> np.ndarray:
    """Pull teeth toward neutral (reduce yellow/red cast) and lift
    luminance gently. Conservative by design — pushing `strength` to 1.0
    on ``normal`` targets a professional portrait look, not a TV-ad
    glare. ``subtle`` scales the LAB push to 60% and ``strong`` to
    140% with a wider feather for larger mouths / deeper shadows."""
    if strength <= 0:
        return image
    mask = _ensure_mask_shape(image, mask)
    scale = _scale_for(profile)
    weight = feather_mask(mask, _feather(profile, feather_px))
    if weight.max() <= 0:
        return image

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]

    # LAB is centred at 128 for a/b, so shifting toward 128 neutralises
    # colour cast. Pulling b harder than a tracks how yellow-dominant
    # dental staining actually is.
    target_a = 128.0
    target_b = 128.0
    a_shift = (target_a - a) * (strength * 0.45 * scale)
    b_shift = (target_b - b) * (strength * 0.65 * scale)
    L_boost = strength * 12.0 * scale

    new_L = np.clip(L + L_boost * weight, 0, 255)
    new_a = np.clip(a + a_shift * weight, 0, 255)
    new_b = np.clip(b + b_shift * weight, 0, 255)

    out_lab = np.stack([new_L, new_a, new_b], axis=-1).astype(np.uint8)
    return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)


def brighten_eyes(
    image: np.ndarray,
    mask: np.ndarray,
    strength: float,
    feather_px: int = 5,
    profile: IntensityProfile = "normal",
) -> np.ndarray:
    """Lift iris luminance without touching colour. The mask should
    cover the iris disc only — sclera whitening is a separate effect.
    ``subtle`` keeps the lift under +12 L (barely perceptible catch-
    light tweak), ``strong`` goes to ~+25 L (dramatic, use on very
    dark eyes)."""
    if strength <= 0:
        return image
    mask = _ensure_mask_shape(image, mask)
    scale = _scale_for(profile)
    weight = feather_mask(mask, _feather(profile, feather_px))
    if weight.max() <= 0:
        return image

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]

    # 18 L-units at slider=100 / normal is noticeable but doesn't wipe
    # out dark brown iris texture.
    L_boost = strength * 18.0 * scale
    new_L = np.clip(L + L_boost * weight, 0, 255)
    out_lab = np.stack([new_L, a, b], axis=-1).astype(np.uint8)
    return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)


def whiten_sclera(
    image: np.ndarray,
    mask: np.ndarray,
    strength: float,
    feather_px: int = 5,
    profile: IntensityProfile = "normal",
) -> np.ndarray:
    """Desaturate redness in the whites of the eyes and brighten
    subtly. Caller's mask must be the sclera only — including iris
    here would wash out iris colour. ``subtle`` barely touches tired
    eyes, ``strong`` pushes close to clinical-white (use sparingly —
    over-whitening reads as uncanny)."""
    if strength <= 0:
        return image
    mask = _ensure_mask_shape(image, mask)
    scale = _scale_for(profile)
    weight = feather_mask(mask, _feather(profile, feather_px))
    if weight.max() <= 0:
        return image

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]

    # Sclera redness comes from blood vessels — shifting a toward 128
    # removes that cast. Blue channel stays because sclera is naturally
    # slightly cool, so shifting b by half the amount reads as "clean"
    # rather than "jaundiced".
    a_shift = (128.0 - a) * (strength * 0.5 * scale)
    b_shift = (128.0 - b) * (strength * 0.25 * scale)
    L_boost = strength * 8.0 * scale

    new_L = np.clip(L + L_boost * weight, 0, 255)
    new_a = np.clip(a + a_shift * weight, 0, 255)
    new_b = np.clip(b + b_shift * weight, 0, 255)

    out_lab = np.stack([new_L, new_a, new_b], axis=-1).astype(np.uint8)
    return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)


def remove_blemishes(
    image: np.ndarray,
    mask: np.ndarray,
    strength: float,
    feather_px: int = 15,
    profile: IntensityProfile = "normal",
) -> np.ndarray:
    """Healing pass over the skin region that removes small blemishes
    without destroying natural pore texture.

    The approach blends two complementary passes:

    1. A small-radius median filter that erases isolated dark spots
       (pimples, moles) because they sit at a different luminance than
       the surrounding skin. Median is the right tool for spot removal
       because it replaces the outlier with the neighbourhood majority.

    2. A bilateral filter with a permissive ``sigmaColor`` that softens
       uneven skin tone while preserving the big edges (nose, lips).
       Bilateral is the right tool for tone work because it ignores
       pore-scale noise when ``sigmaColor`` is wide enough.

    Combining the two gives you the Evoto "blemish removal" feel: small
    spots disappear cleanly, tone flattens slightly, and real structure
    (shadows under the brow, nasolabial fold) stays in place. At
    ``strength == 1.0`` the healed layer is blended at 85% over the
    original inside the mask — strong enough to clear genuine blemishes,
    gentle enough to leave freckles and natural skin character.
    """
    if strength <= 0:
        return image
    mask = _ensure_mask_shape(image, mask)
    resolved_profile = _normalise_profile(profile)
    weight = feather_mask(mask, _feather(resolved_profile, feather_px))
    if weight.max() <= 0:
        return image

    src = image.astype(np.float32)
    # Median radius widens with the profile so ``strong`` can erase
    # larger blemishes and ``subtle`` stays delicate enough to keep
    # freckles. Strength still tips the 3→5 threshold independently.
    base_ksize = 3 if strength < 0.66 else 5
    if resolved_profile == "subtle":
        ksize = 3
    elif resolved_profile == "strong":
        ksize = 5 if strength < 0.5 else 7
    else:
        ksize = base_ksize
    # Median first so spots are erased before bilateral runs. Running
    # bilateral on the raw image leaks the spot's colour back into the
    # neighbourhood (the spot's pixel weighs itself at gaussian=1.0 in
    # its own output), which made heavy blemishes only partly fade.
    # Doing bilateral over the median output lets the tone work happen
    # on clean skin.
    median = cv2.medianBlur(image, ksize)
    bilateral = cv2.bilateralFilter(median, d=9, sigmaColor=55, sigmaSpace=9)
    healed = bilateral.astype(np.float32)

    # Max blend ceiling scales with the profile so ``strong`` can erase
    # heavy acne + scars at slider=100 while ``subtle`` stays below
    # 55% — enough to calm minor spots without touching character.
    max_blend = {"subtle": 0.55, "normal": 0.85, "strong": 0.98}[resolved_profile]
    blend_strength = strength * max_blend
    w3 = weight[..., None] * blend_strength
    out = src * (1.0 - w3) + healed * w3
    return np.clip(out, 0, 255).astype(np.uint8)


# ──────────────────── MediaPipe landmark adapter ─────────────────────
# Lazy singleton. Tests never touch this — they build masks directly
# from synthetic points. Production calls it once per enhance().

_FM_LOCK = Lock()
_FACE_MESH = None
_FACE_MESH_IMPORT_FAILED = False


# MediaPipe Face Mesh index groups. Documented at
# https://developers.google.com/mediapipe/solutions/vision/face_landmarker
# — indices picked to form convex hulls around the region we care about.
# We keep these as module-level constants so tests and callers can
# introspect them (and so a future landmark provider swap lands in one
# place).

MOUTH_INNER_INDICES: tuple[int, ...] = (
    78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
)
LEFT_IRIS_INDICES: tuple[int, ...] = (468, 469, 470, 471, 472)
RIGHT_IRIS_INDICES: tuple[int, ...] = (473, 474, 475, 476, 477)
LEFT_EYE_CONTOUR_INDICES: tuple[int, ...] = (
    33, 7, 163, 144, 145, 153, 154, 155, 133,
    173, 157, 158, 159, 160, 161, 246,
)
RIGHT_EYE_CONTOUR_INDICES: tuple[int, ...] = (
    362, 382, 381, 380, 374, 373, 390, 249, 263,
    466, 388, 387, 386, 385, 384, 398,
)
FACE_OVAL_INDICES: tuple[int, ...] = (
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
)


def _landmarks_to_points(landmarks: Any, width: int, height: int) -> np.ndarray:
    """MediaPipe returns normalised (x,y,z) in 0..1; convert to pixel
    coordinates as an (N, 2) int32 array."""
    pts = np.array(
        [[lm.x * width, lm.y * height] for lm in landmarks],
        dtype=np.float32,
    )
    return np.clip(pts, 0, [width - 1, height - 1]).astype(np.int32)


def _lazy_face_mesh():
    """Import MediaPipe on first use. Failing silently is intentional —
    deployments without the dep still get GFPGAN restoration."""
    global _FACE_MESH, _FACE_MESH_IMPORT_FAILED
    if _FACE_MESH_IMPORT_FAILED:
        return None
    if _FACE_MESH is not None:
        return _FACE_MESH
    with _FM_LOCK:
        if _FACE_MESH is not None:
            return _FACE_MESH
        if _FACE_MESH_IMPORT_FAILED:
            return None
        try:
            import mediapipe as mp  # type: ignore[import-not-found]
            _FACE_MESH = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,  # enables iris landmarks
                min_detection_confidence=0.5,
            )
            return _FACE_MESH
        except Exception as exc:  # noqa: BLE001
            logger.warning("mediapipe unavailable — skipping face retouch: %s", exc)
            _FACE_MESH_IMPORT_FAILED = True
            return None


@dataclass
class FaceRegions:
    """Pixel masks for the regions the sliders target. Any mask may be
    ``None`` if the corresponding landmark group was out of frame."""
    teeth: Optional[np.ndarray]
    left_iris: Optional[np.ndarray]
    right_iris: Optional[np.ndarray]
    left_sclera: Optional[np.ndarray]
    right_sclera: Optional[np.ndarray]
    skin: Optional[np.ndarray]


def build_regions_from_points(
    points: np.ndarray,
    shape: tuple[int, int],
) -> FaceRegions:
    """Build the per-region masks given the full 478-point landmark
    array. Exposed publicly so tests can feed synthetic landmarks."""
    def group(indices: tuple[int, ...]) -> Optional[np.ndarray]:
        valid = [idx for idx in indices if idx < len(points)]
        if len(valid) < 3:
            return None
        return polygon_mask(shape, points[list(valid)])

    teeth = group(MOUTH_INNER_INDICES)
    left_iris = group(LEFT_IRIS_INDICES)
    right_iris = group(RIGHT_IRIS_INDICES)
    left_eye = group(LEFT_EYE_CONTOUR_INDICES)
    right_eye = group(RIGHT_EYE_CONTOUR_INDICES)
    face_oval = group(FACE_OVAL_INDICES)

    # Sclera = full eye minus iris. Avoids bleaching the iris colour
    # when the "whiten eyes" slider is on.
    def subtract(whole: Optional[np.ndarray], part: Optional[np.ndarray]) -> Optional[np.ndarray]:
        if whole is None:
            return None
        if part is None:
            return whole
        return cv2.bitwise_and(whole, cv2.bitwise_not(part))

    left_sclera = subtract(left_eye, left_iris)
    right_sclera = subtract(right_eye, right_iris)

    # Skin = face oval minus eyes, iris and mouth. Blemish removal runs
    # only here; we never median-filter the eyes or lips.
    skin: Optional[np.ndarray] = face_oval
    if skin is not None:
        for sub in (left_eye, right_eye, teeth):
            if sub is not None:
                skin = cv2.bitwise_and(skin, cv2.bitwise_not(sub))

    return FaceRegions(
        teeth=teeth,
        left_iris=left_iris,
        right_iris=right_iris,
        left_sclera=left_sclera,
        right_sclera=right_sclera,
        skin=skin,
    )


def detect_face_regions(image: np.ndarray) -> Optional[FaceRegions]:
    """Production entry point: run MediaPipe Face Mesh and return the
    region masks, or ``None`` if the detector is unavailable or failed
    to land on a face."""
    mesh = _lazy_face_mesh()
    if mesh is None:
        return None
    height, width = image.shape[:2]
    try:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        result = mesh.process(rgb)
    except Exception as exc:  # noqa: BLE001
        logger.warning("mediapipe process() failed: %s", exc)
        return None
    if not result.multi_face_landmarks:
        return None
    landmarks = result.multi_face_landmarks[0].landmark
    points = _landmarks_to_points(landmarks, width, height)
    return build_regions_from_points(points, (height, width))


# ─────────────────────── Public orchestrator ────────────────────────

def _resolve_profiles(controls: dict[str, Any]) -> dict[str, IntensityProfile]:
    """Pull the per-effect intensity profiles out of the controls
    payload. Falls back to ``normal`` for each effect on missing /
    unrecognised input so legacy callers (that only sent strength) get
    the reference tuning."""
    return {
        "teeth":  _normalise_profile(controls.get("teethProfile")),
        "eye_bright": _normalise_profile(controls.get("eyeBrightnessProfile")),
        "eye_white":  _normalise_profile(controls.get("eyeWhitenessProfile")),
        "blemish":    _normalise_profile(controls.get("blemishProfile")),
    }


def apply_portrait_retouch(
    image: np.ndarray,
    controls: dict[str, Any],
    regions: Optional[FaceRegions] = None,
) -> np.ndarray:
    """Run the teeth/eye/skin effects in a defined order.

    Order matters: blemish removal affects luminance, so we run it
    before the eye brightens (which nudges L further) to avoid
    compounding. Teeth + sclera are independent regions, order doesn't
    matter there.

    Parameters
    ----------
    image:
        BGR uint8 frame in the shape ``(H, W, 3)``.
    controls:
        The ``controls`` payload forwarded from the web layer. Only
        these keys are read; unknown ones are ignored:
          - ``blemishRemoval``
          - ``teethWhiteness``
          - ``eyeBrightness``
          - ``eyeWhiteness``
    regions:
        Optional pre-computed region masks (tests pass these directly
        so the suite doesn't need MediaPipe). In production we call
        :func:`detect_face_regions` here if omitted.

    Returns
    -------
    np.ndarray
        The retouched BGR uint8 image. Returned unchanged if no slider
        is active or if no face was detected.
    """
    blemish = _clamp_strength(controls.get("blemishRemoval"))
    teeth = _clamp_strength(controls.get("teethWhiteness"))
    eye_bright = _clamp_strength(controls.get("eyeBrightness"))
    eye_white = _clamp_strength(controls.get("eyeWhiteness"))

    if blemish == 0 and teeth == 0 and eye_bright == 0 and eye_white == 0:
        return image

    if regions is None:
        regions = detect_face_regions(image)
    if regions is None:
        # No face — silently skip so the GFPGAN output still ships.
        return image

    profiles = _resolve_profiles(controls)
    out = image
    if blemish > 0 and regions.skin is not None:
        out = remove_blemishes(out, regions.skin, blemish, profile=profiles["blemish"])
    if teeth > 0 and regions.teeth is not None:
        out = whiten_teeth(out, regions.teeth, teeth, profile=profiles["teeth"])
    if eye_white > 0:
        if regions.left_sclera is not None:
            out = whiten_sclera(out, regions.left_sclera, eye_white, profile=profiles["eye_white"])
        if regions.right_sclera is not None:
            out = whiten_sclera(out, regions.right_sclera, eye_white, profile=profiles["eye_white"])
    if eye_bright > 0:
        if regions.left_iris is not None:
            out = brighten_eyes(out, regions.left_iris, eye_bright, profile=profiles["eye_bright"])
        if regions.right_iris is not None:
            out = brighten_eyes(out, regions.right_iris, eye_bright, profile=profiles["eye_bright"])
    return out


__all__ = [
    "FaceRegions",
    "apply_portrait_retouch",
    "brighten_eyes",
    "build_regions_from_points",
    "detect_face_regions",
    "feather_mask",
    "polygon_mask",
    "remove_blemishes",
    "whiten_sclera",
    "whiten_teeth",
]

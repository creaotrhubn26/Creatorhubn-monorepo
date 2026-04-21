"""Subject-aware post-processing for the CreatorHub photo enhancer.

This module is the non-portrait sibling of ``portrait_retouch.py``.
When Claude Vision (or a future on-device classifier) tells us the
image is a plate of food, a landscape, a car, or an aircraft, we run a
short category-specific pass that nudges the look in the direction a
professional retoucher would — without needing landmarks, masks, or
extra ML models.

Design goals:
    * All looks are pure functions of ``(image, strength)`` so each is
      unit-testable on synthetic images without any classifier.
    * Every look is LAB-space so we can push colour without breaking
      neutral grey patches (for white-balance fidelity in product /
      vehicle / aviation shots where clients match to a spec).
    * The dispatcher ``apply_subject_look`` is what ``app.py`` calls
      with the subject string the request carried. Unknown or empty
      subjects no-op so legacy callers (manual slider workflow with no
      AI pass) are unaffected.

Intensity model:
    ``strength`` is a 0..1 float. The effects are designed so
    ``strength=1.0`` roughly matches a tasteful Lightroom preset for
    that subject. Values above 1.0 are clamped; negative values no-op
    (no inverted looks — we never push *toward* ugly).

Not covered here (intentional):
    * ``portrait`` / ``group_portrait`` — handled by portrait_retouch.
    * ``product`` — the interesting work (background clean-up to pure
      white) needs a segmentation mask we don't have yet. We apply a
      conservative highlight lift so the slider at least does something,
      and leave the real product pass as a follow-up.
    * ``other`` — no-op by design.
"""
from __future__ import annotations

import logging
from typing import Any, Callable

import cv2
import numpy as np

logger = logging.getLogger("creatorhub.subject_retouch")


SubjectKind = str  # one of: food, landscape, product, vehicle, aviation, other


def _clamp_strength(value: Any) -> float:
    """Map any caller input to a 0.0..1.0 intensity. Mirrors the helper
    in ``portrait_retouch`` — duplicated here rather than imported so
    the two post-processors stay independent modules."""
    try:
        raw = float(value)
    except (TypeError, ValueError):
        return 0.0
    if raw != raw:  # NaN
        return 0.0
    return max(0.0, min(1.0, raw))


def _blend(src: np.ndarray, processed: np.ndarray, alpha: float) -> np.ndarray:
    """Linear blend between src and processed, both uint8. Keeps the
    call sites terse: each look just produces a "full strength"
    variant, and the blend here mixes it with the input by strength."""
    if alpha <= 0:
        return src
    a = np.clip(alpha, 0.0, 1.0)
    if a >= 1.0:
        return processed
    out = src.astype(np.float32) * (1.0 - a) + processed.astype(np.float32) * a
    return np.clip(out, 0, 255).astype(np.uint8)


# ───────────────────────────── Food ──────────────────────────────────

def apply_food_look(image: np.ndarray, strength: float) -> np.ndarray:
    """Warm, appetising pass.

    What professional food retouchers actually do:
        * Nudge white balance 1-3 mireds warmer (the plate feels cooked,
          not refrigerated).
        * Boost saturation on the warm half of the colour wheel (reds,
          oranges, yellows — where meat, bread, tomato, egg yolk live)
          without pushing the cool half (blue backgrounds, garnish).
        * Apply a small local-contrast lift to crust / texture so the
          surface reads "fresh" instead of plastic.

    This pass is 100% global LAB-space, no masks needed. The warm-side
    saturation trick works because LAB's b-axis (+yellow/-blue) and
    a-axis (+red/-green) are orthogonal — we scale the positive
    components harder than the negative.
    """
    s = _clamp_strength(strength)
    if s <= 0:
        return image
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]

    # Warm shift done in two stages:
    #   1) absolute offset so even a perfectly neutral grey pixel
    #      (b=128) moves toward +yellow — otherwise the centre of the
    #      LAB axis is fixed and neutral areas never warm up.
    #   2) asymmetric scale on the *post-offset* channel: pixels that
    #      are already warm (above 128) get an additional bump so
    #      reds/oranges/yellows expand harder than cool blues contract.
    #      This is the core "food warmth" trick — mids warm gently,
    #      already-warm tones warm a lot, cool backgrounds stay put.
    b_shifted = b + 4.0 * s
    b_warm = np.where(
        b_shifted > 128,
        (b_shifted - 128) * (1.0 + 0.12 * s) + 128,
        b_shifted,
    )
    a_shifted = a + 2.0 * s
    a_warm = np.where(
        a_shifted > 128,
        (a_shifted - 128) * (1.0 + 0.09 * s) + 128,
        a_shifted,
    )

    # Micro contrast on L via CLAHE applied at low clipLimit. Keeps
    # shadows nuanced (dark coffee, charred grill marks) while giving
    # highlights more presence.
    clahe = cv2.createCLAHE(clipLimit=max(1.0, 1.5 * s), tileGridSize=(8, 8))
    L_u8 = np.clip(L, 0, 255).astype(np.uint8)
    L_micro = clahe.apply(L_u8).astype(np.float32)
    L_out = L * (1.0 - 0.6 * s) + L_micro * (0.6 * s)

    out_lab = np.stack(
        [
            np.clip(L_out, 0, 255),
            np.clip(a_warm, 0, 255),
            np.clip(b_warm, 0, 255),
        ],
        axis=-1,
    ).astype(np.uint8)
    return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)


# ─────────────────────────── Landscape ───────────────────────────────

def apply_landscape_look(image: np.ndarray, strength: float) -> np.ndarray:
    """Dehaze + sky pop pass.

    Landscape photographs lose saturation and contrast to atmospheric
    haze — distant ridges read flatter than they looked to the eye.
    The standard dehazing trick is to increase global contrast while
    biasing the tone curve to lift the mids (recovers air-scattering
    loss) and pull highlights slightly.

    Saturation is global because landscape scenes are dominated by the
    kinds of colours (sky blue, foliage green, rock earth) that all
    benefit from a modest push. We specifically DO NOT use the LAB
    b-warm trick from food — landscapes usually want cool blues pushed
    *away* from yellow, not toward.
    """
    s = _clamp_strength(strength)
    if s <= 0:
        return image
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]

    # Contrast bias: stretch mids. A simple sigmoid-like curve lifts
    # shadows a tiny bit and deepens highlights — reveals distant
    # detail without crushing blacks.
    L_norm = L / 255.0
    # 0.5 is the pivot; strength scales how hard we pull. At s=1 the
    # mid-tone at 0.5 stays at 0.5 but values either side get pulled.
    L_curved = 0.5 + (L_norm - 0.5) * (1.0 + 0.35 * s)
    L_out = L * (1.0 - s) + np.clip(L_curved * 255.0, 0, 255) * s

    # Saturation push: expand a/b around 128 neutral.
    sat_scale = 1.0 + 0.25 * s
    a_out = (a - 128.0) * sat_scale + 128.0
    b_out = (b - 128.0) * sat_scale + 128.0

    out_lab = np.stack(
        [
            np.clip(L_out, 0, 255),
            np.clip(a_out, 0, 255),
            np.clip(b_out, 0, 255),
        ],
        axis=-1,
    ).astype(np.uint8)
    return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)


# ──────────────────────────── Vehicle ────────────────────────────────

def apply_vehicle_look(image: np.ndarray, strength: float) -> np.ndarray:
    """Panel-punch pass for car / motorcycle / bike / truck shots.

    Vehicle photography trades on two visual signatures:
        * Paint reflections — local contrast on metal panels separates
          the highlight band from the body tone and makes the car look
          "wet" (light cleaner).
        * Chrome + trim — pure black, pure white, no colour cast.
          Global a/b neutral pull toward 128 cleans chrome.

    We combine an unsharp-mask pass (gives panel reflections snap)
    with a very mild global saturation bump so reds, blues, and pearls
    don't go flat during the contrast work.
    """
    s = _clamp_strength(strength)
    if s <= 0:
        return image

    # Unsharp mask: sharpens paint edges without touching overall tone.
    blurred = cv2.GaussianBlur(image, (0, 0), sigmaX=3.0)
    # Amount scales with strength; cv2.addWeighted is the standard
    # unsharp formulation: sharpened = image + amount * (image - blur).
    amount = 0.6 * s
    sharpened = cv2.addWeighted(image, 1.0 + amount, blurred, -amount, 0)

    # Small LAB saturation boost on the sharpened result.
    lab = cv2.cvtColor(sharpened, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    sat_scale = 1.0 + 0.14 * s
    a_out = (a - 128.0) * sat_scale + 128.0
    b_out = (b - 128.0) * sat_scale + 128.0
    out_lab = np.stack(
        [L, np.clip(a_out, 0, 255), np.clip(b_out, 0, 255)], axis=-1
    ).astype(np.uint8)
    return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)


# ──────────────────────────── Aviation ───────────────────────────────

def apply_aviation_look(image: np.ndarray, strength: float) -> np.ndarray:
    """Dehaze + sky sat pass tuned for atmospheric haze on distant
    subjects.

    Aviation shots share the haze problem with landscape, but:
        * The haze is usually heavier (subjects are further away).
        * The sky is more of the frame, so saturation must stay
          restrained or it blue-casts the airliner livery.

    We dehaze harder than landscape on L-channel contrast, but scale
    a/b saturation less. Result: cleaner contrast silhouette + sky
    readability without cartoon-blue sky.
    """
    s = _clamp_strength(strength)
    if s <= 0:
        return image
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]

    # Harder contrast curve than landscape — aviation can take it.
    L_norm = L / 255.0
    L_curved = 0.5 + (L_norm - 0.5) * (1.0 + 0.45 * s)
    L_out = L * (1.0 - s) + np.clip(L_curved * 255.0, 0, 255) * s

    # Gentler saturation — avoids cobalt sky.
    sat_scale = 1.0 + 0.14 * s
    a_out = (a - 128.0) * sat_scale + 128.0
    b_out = (b - 128.0) * sat_scale + 128.0

    out_lab = np.stack(
        [
            np.clip(L_out, 0, 255),
            np.clip(a_out, 0, 255),
            np.clip(b_out, 0, 255),
        ],
        axis=-1,
    ).astype(np.uint8)
    return cv2.cvtColor(out_lab, cv2.COLOR_LAB2BGR)


# ──────────────────────────── Product ────────────────────────────────

def apply_product_look(image: np.ndarray, strength: float) -> np.ndarray:
    """Conservative catch-for-now pass for e-commerce product shots.

    The *interesting* product work is background clean-up to pure
    white + edge-preserving detail sharpening on the product silhouette.
    Both need a segmentation mask we don't have in this module yet, so
    here we apply a restrained global pass:
        * Mild highlight lift — brightens near-white backgrounds so
          they read cleaner.
        * Mild unsharp mask — edges crisper.
        * No saturation change — client often matches to brand spec.

    When we wire a real product segmenter (rembg / SAM / U²-Net) the
    plan is to replace this function's body, keep the signature.
    """
    s = _clamp_strength(strength)
    if s <= 0:
        return image

    # Highlight lift: push upper-mid tones a little brighter without
    # blowing the white point. Done via a gamma-style curve on L.
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    L_norm = L / 255.0
    L_lifted = np.power(L_norm, 1.0 - 0.15 * s)
    L_out = L * (1.0 - s) + np.clip(L_lifted * 255.0, 0, 255) * s

    lifted_lab = np.stack(
        [np.clip(L_out, 0, 255), a, b], axis=-1
    ).astype(np.uint8)
    lifted = cv2.cvtColor(lifted_lab, cv2.COLOR_LAB2BGR)

    # Light unsharp for edges. Smaller sigma than vehicle so we don't
    # halo on product silhouettes against clean backgrounds.
    blurred = cv2.GaussianBlur(lifted, (0, 0), sigmaX=1.5)
    amount = 0.35 * s
    return cv2.addWeighted(lifted, 1.0 + amount, blurred, -amount, 0)


# ────────────────────────── Dispatcher ───────────────────────────────

_LOOKS: dict[str, Callable[[np.ndarray, float], np.ndarray]] = {
    "food":      apply_food_look,
    "landscape": apply_landscape_look,
    "vehicle":   apply_vehicle_look,
    "aviation":  apply_aviation_look,
    "product":   apply_product_look,
}


def apply_subject_look(
    image: np.ndarray,
    subject: str | None,
    strength: float,
) -> np.ndarray:
    """Run the category-specific look for ``subject`` at ``strength``.

    Returns the input unchanged when:
        * subject is missing / empty
        * subject is ``portrait``, ``group_portrait`` (handled by
          portrait_retouch)
        * subject is ``other``, or any unrecognised label
        * strength is 0 or negative

    This is deliberate — the function must be safe to call at the end
    of every enhance request without a classifier. If we don't know
    what the subject is, we don't push the look.
    """
    s = _clamp_strength(strength)
    if s <= 0 or not subject:
        return image
    fn = _LOOKS.get(subject.strip().lower())
    if fn is None:
        return image
    try:
        return fn(image, s)
    except Exception as exc:  # noqa: BLE001
        # Never break the enhance response because a look misbehaved —
        # the caller already got GFPGAN + slider tone work. Log and
        # return the pre-look image.
        logger.warning(
            "subject look %r failed, returning input unchanged: %s", subject, exc
        )
        return image


__all__ = [
    "apply_aviation_look",
    "apply_food_look",
    "apply_landscape_look",
    "apply_product_look",
    "apply_subject_look",
    "apply_vehicle_look",
]

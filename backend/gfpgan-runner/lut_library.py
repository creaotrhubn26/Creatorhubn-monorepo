"""Built-in LUT library for the CreatorHub photo enhancer.

This module ships a small set of algorithmically-generated LUTs so the
enhancer can offer "one-click looks" without bundling third-party .cube
files (licensing nightmare on a commercial product).

Each LUT is generated once at import time and cached. LUTs are small
17³ grids — plenty smooth for photography, cheap to generate.

Registry entries expose:
    id            — stable slug, used over the wire
    displayName   — label for the UI dropdown
    description   — one-liner shown under the dropdown
    swatch        — RGB triplet in [0, 255] showing how mid-grey maps
                    (used by the UI as a colour cue next to the name)
    lut           — ParsedCubeLut, ready for apply_lut()

To add a new look later, write a generator that returns a size^3
sequence of RGB triplets in Adobe order (r fastest), then register it
here. Tests in test_lut_library.py enforce identity / monotonicity
contracts per look so a tuning change cannot silently regress the
colour behaviour.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Callable, Tuple

import numpy as np

from cube_lut import ParsedCubeLut, build_3d_cube_table


DEFAULT_SIZE = 17

LutGenerator = Callable[[int], "list[Tuple[float, float, float]]"]


# ───────────────────────── Look generators ────────────────────────────

def _identity(size: int) -> "list[Tuple[float, float, float]]":
    entries: list[Tuple[float, float, float]] = []
    for b_i in range(size):
        for g_i in range(size):
            for r_i in range(size):
                entries.append((r_i / (size - 1), g_i / (size - 1), b_i / (size - 1)))
    return entries


def _midtone_bump(x: float, amount: float) -> float:
    """Parabolic bump peaking at x=0.5, zero at x∈{0,1}.

    Keeps shadows pinned to 0 and highlights pinned to 1 so our looks
    don't accidentally clip or lift endpoints — black stays black, white
    stays white. ``amount`` sets the peak offset at midtone.
    """
    return amount * 4.0 * x * (1.0 - x)


def _warm_soft(size: int) -> "list[Tuple[float, float, float]]":
    """Gentle warmth — midtone R +0.06, B −0.05, G +0.01. Endpoint-safe."""
    entries: list[Tuple[float, float, float]] = []
    for b_i in range(size):
        for g_i in range(size):
            for r_i in range(size):
                r = r_i / (size - 1)
                g = g_i / (size - 1)
                b = b_i / (size - 1)
                r = np.clip(r + _midtone_bump(r, 0.06), 0.0, 1.0)
                g = np.clip(g + _midtone_bump(g, 0.01), 0.0, 1.0)
                b = np.clip(b - _midtone_bump(b, 0.05), 0.0, 1.0)
                entries.append((float(r), float(g), float(b)))
    return entries


def _cool_soft(size: int) -> "list[Tuple[float, float, float]]":
    """Mirror of warm_soft — cools midtones while preserving endpoints."""
    entries: list[Tuple[float, float, float]] = []
    for b_i in range(size):
        for g_i in range(size):
            for r_i in range(size):
                r = r_i / (size - 1)
                g = g_i / (size - 1)
                b = b_i / (size - 1)
                r = np.clip(r - _midtone_bump(r, 0.05), 0.0, 1.0)
                g = np.clip(g + _midtone_bump(g, 0.01), 0.0, 1.0)
                b = np.clip(b + _midtone_bump(b, 0.07), 0.0, 1.0)
                entries.append((float(r), float(g), float(b)))
    return entries


# ────────────────────────── Registry type ─────────────────────────────

@dataclass(frozen=True)
class BuiltInLut:
    id: str
    displayName: str
    description: str
    generator: LutGenerator
    swatch_seed: Tuple[int, int, int]  # input RGB (0-255) used to derive the UI swatch


_REGISTRY: "dict[str, BuiltInLut]" = {
    "neutral": BuiltInLut(
        id="neutral",
        displayName="Nøytral",
        description="Identitet — ingen fargejustering.",
        generator=_identity,
        swatch_seed=(128, 128, 128),
    ),
    "warm_soft": BuiltInLut(
        id="warm_soft",
        displayName="Varm (mild)",
        description="Lett varmere hudtoner, dempede blå.",
        generator=_warm_soft,
        swatch_seed=(200, 170, 150),
    ),
    "cool_soft": BuiltInLut(
        id="cool_soft",
        displayName="Kjølig (mild)",
        description="Kjølere skygger, bevarte hudtoner.",
        generator=_cool_soft,
        swatch_seed=(150, 170, 200),
    ),
}


@lru_cache(maxsize=None)
def _compile_lut(lut_id: str, size: int = DEFAULT_SIZE) -> ParsedCubeLut:
    entry = _REGISTRY[lut_id]
    table = build_3d_cube_table(size, entry.generator(size))
    return ParsedCubeLut(
        kind="3D",
        size=size,
        domain_min=(0.0, 0.0, 0.0),
        domain_max=(1.0, 1.0, 1.0),
        title=entry.displayName,
        table=table,
    )


def get_builtin_lut(lut_id: str) -> ParsedCubeLut | None:
    """Resolve a built-in LUT by id. Returns None for unknown ids so
    callers can distinguish "no LUT" from "LUT with failure"."""
    if lut_id not in _REGISTRY:
        return None
    return _compile_lut(lut_id, DEFAULT_SIZE)


def list_builtin_luts() -> "list[dict[str, object]]":
    """Registry description suitable for the GET /luts endpoint. Returns
    each LUT's id / display / swatch so the frontend can render the
    dropdown without any per-LUT round-trips."""
    result: list[dict[str, object]] = []
    for entry in _REGISTRY.values():
        swatch = _compute_swatch(entry)
        result.append({
            "id": entry.id,
            "displayName": entry.displayName,
            "description": entry.description,
            "swatch": swatch,
            "size": DEFAULT_SIZE,
        })
    return result


def _compute_swatch(entry: BuiltInLut) -> "dict[str, int]":
    """Return the mid-grey (or seed) mapping as a 0-255 RGB dict.

    We pick the LUT's reported ``swatch_seed`` so the UI can show a
    representative colour chip, not just grey — useful for warm/cool
    LUTs where grey stays roughly grey but the intent is skin/sky.
    """
    lut = _compile_lut(entry.id, DEFAULT_SIZE)
    r, g, b = entry.swatch_seed
    image = np.array([[[b, g, r]]], dtype=np.uint8)  # BGR for apply_lut
    from cube_lut import apply_lut  # local to avoid circular
    out = apply_lut(image, lut, strength=100)
    bb, gg, rr = out[0, 0]
    return {"r": int(rr), "g": int(gg), "b": int(bb)}


__all__ = [
    "get_builtin_lut",
    "list_builtin_luts",
    "DEFAULT_SIZE",
]

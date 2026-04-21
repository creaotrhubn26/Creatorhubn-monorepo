"""Adobe .cube LUT parsing and application for the CreatorHub runner.

Spec reference: Adobe "Cube LUT Specification 1.0" (commonly followed by
every LUT tool on the market — Lightroom, Resolve, LUT Buddy, etc.).

Supported:
    * 1D LUTs  (LUT_1D_SIZE N, N entries of R G B)
    * 3D LUTs  (LUT_3D_SIZE N, N³ entries of R G B in b-major order)
    * TITLE "Example"                — captured but otherwise ignored
    * DOMAIN_MIN r g b               — defaults to (0, 0, 0)
    * DOMAIN_MAX r g b               — defaults to (1, 1, 1)
    * Comments beginning with ``#``  — ignored
    * BOM, CRLF, mixed whitespace

The parser is strict enough to reject malformed files early (wrong entry
count, non-finite values, conflicting declarations) but tolerant of
whitespace / casing / ordering. It returns a ``ParsedCubeLut`` struct
with numpy tables ready for application.

``apply_lut`` does trilinear interpolation on a 3D LUT and linear
interpolation on a 1D LUT. Vectorised over the full image in float32.

Design rules:
    * Pure function of (image, lut, strength). No file IO, no global
      state. Easy to unit-test without loading the whole runner.
    * Strength in [0, 100] maps to a linear mix between the identity
      (input pixel) and the LUT output, so a mid-strength LUT still
      preserves tonal behaviour the photographer expects.
    * Out-of-domain pixels clamp to the LUT range rather than wrapping —
      clamp is the safer default for real-world RAW inputs that may
      contain values beyond 0-1 after tone mapping.
    * Every return path produces a uint8 image matching the input shape.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence, Tuple

import numpy as np


class CubeLutError(ValueError):
    """Raised when a .cube file is malformed or cannot be applied."""


@dataclass(frozen=True)
class ParsedCubeLut:
    """In-memory representation of a parsed .cube LUT."""

    kind: str               # "1D" or "3D"
    size: int               # N for LUT_1D_SIZE / LUT_3D_SIZE
    domain_min: Tuple[float, float, float]
    domain_max: Tuple[float, float, float]
    title: str              # may be empty
    table: np.ndarray       # float32 table, shape (size, 3) for 1D or (size, size, size, 3) for 3D

    @property
    def entry_count(self) -> int:
        return self.size if self.kind == "1D" else self.size ** 3


# ───────────────────────────── Parsing ─────────────────────────────────

def parse_cube(source: str | bytes) -> ParsedCubeLut:
    """Parse a .cube LUT from its file contents.

    Accepts both ``str`` and ``bytes`` so callers can hand off the raw
    upload buffer without decoding first. BOM is stripped; CRLF / LF are
    normalised. Unknown directives (``LUT_ND_SIZE``, etc.) are rejected
    loudly rather than silently.
    """
    if isinstance(source, bytes):
        source = source.decode("utf-8-sig", errors="replace")
    if source.startswith("\ufeff"):
        source = source[1:]

    kind: str | None = None
    size: int | None = None
    title: str = ""
    domain_min = (0.0, 0.0, 0.0)
    domain_max = (1.0, 1.0, 1.0)
    entries: List[Tuple[float, float, float]] = []

    lines = source.replace("\r\n", "\n").split("\n")
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        upper = line.upper()
        if upper.startswith("TITLE"):
            title = _extract_title(line)
            continue
        if upper.startswith("LUT_1D_SIZE"):
            kind = _declare_kind(kind, "1D")
            size = _parse_positive_int(line, "LUT_1D_SIZE")
            _validate_lut_size(size, "1D")
            continue
        if upper.startswith("LUT_3D_SIZE"):
            kind = _declare_kind(kind, "3D")
            size = _parse_positive_int(line, "LUT_3D_SIZE")
            _validate_lut_size(size, "3D")
            continue
        if upper.startswith("DOMAIN_MIN"):
            domain_min = _parse_three_floats(line, "DOMAIN_MIN")
            continue
        if upper.startswith("DOMAIN_MAX"):
            domain_max = _parse_three_floats(line, "DOMAIN_MAX")
            continue

        # Anything else must be a data row of three floats. We are
        # intentionally strict: malformed rows fail closed.
        entries.append(_parse_three_floats(line, "entry"))

    if kind is None or size is None:
        raise CubeLutError(
            ".cube file is missing LUT_1D_SIZE or LUT_3D_SIZE declaration.",
        )

    expected = size if kind == "1D" else size ** 3
    if len(entries) != expected:
        raise CubeLutError(
            f".cube file declares {expected} entries but contains {len(entries)}.",
        )

    if any(a >= b for a, b in zip(domain_min, domain_max)):
        raise CubeLutError(
            f"DOMAIN_MIN {domain_min} must be strictly less than DOMAIN_MAX {domain_max}.",
        )

    flat = np.asarray(entries, dtype=np.float32)
    if flat.shape != (expected, 3):
        raise CubeLutError(f".cube table shape {flat.shape} does not match declared size.")

    if kind == "1D":
        table = flat.reshape(size, 3)
    else:
        # Adobe spec: the red channel varies fastest, then green, then
        # blue. So entry i = (r + size*(g + size*b)). Reshape respects
        # that when indexed as table[b, g, r, :].
        table = flat.reshape(size, size, size, 3)

    return ParsedCubeLut(
        kind=kind,
        size=size,
        domain_min=domain_min,
        domain_max=domain_max,
        title=title,
        table=table,
    )


def _declare_kind(current: str | None, candidate: str) -> str:
    if current is not None and current != candidate:
        raise CubeLutError(
            f".cube file declares both LUT_1D_SIZE and LUT_3D_SIZE (got {candidate} after {current}).",
        )
    if current == candidate:
        raise CubeLutError(f".cube file declares LUT_{candidate}_SIZE more than once.")
    return candidate


def _parse_positive_int(line: str, label: str) -> int:
    parts = line.split()
    if len(parts) < 2:
        raise CubeLutError(f"{label} requires one integer argument (got {line!r}).")
    try:
        value = int(parts[1])
    except ValueError as exc:
        raise CubeLutError(f"{label} argument must be an integer (got {parts[1]!r}).") from exc
    if value <= 0:
        raise CubeLutError(f"{label} must be positive (got {value}).")
    return value


def _parse_three_floats(line: str, label: str) -> Tuple[float, float, float]:
    parts = line.split()
    # Lead-in keyword (DOMAIN_MIN / DOMAIN_MAX / TITLE) is stripped by
    # slicing when present; entries have no leading keyword.
    if label in {"DOMAIN_MIN", "DOMAIN_MAX"}:
        parts = parts[1:]
    if len(parts) != 3:
        raise CubeLutError(f"{label} requires three numeric components (got {line!r}).")
    try:
        values = tuple(float(v) for v in parts)
    except ValueError as exc:
        raise CubeLutError(f"{label} contains a non-numeric value ({line!r}).") from exc
    for v in values:
        if not np.isfinite(v):
            raise CubeLutError(f"{label} contains a non-finite value ({line!r}).")
    return values  # type: ignore[return-value]


def _extract_title(line: str) -> str:
    remainder = line[len("TITLE"):].strip()
    if remainder.startswith('"') and remainder.endswith('"') and len(remainder) >= 2:
        return remainder[1:-1]
    return remainder


def _validate_lut_size(size: int, kind: str) -> None:
    # Sanity caps. A 3D LUT of size > 65 is absurd (> 2.7M entries).
    max_size = 4096 if kind == "1D" else 65
    if size > max_size:
        raise CubeLutError(f"LUT_{kind}_SIZE of {size} exceeds safe cap ({max_size}).")


# ─────────────────────── Serialisation helpers ────────────────────────

def build_3d_cube_table(
    size: int,
    mapping: "Sequence[Tuple[float, float, float]] | Iterable[Tuple[float, float, float]]",
) -> np.ndarray:
    """Construct a 3D LUT table from a flat sequence in Adobe order.

    Primarily used by the built-in LUT library (``lut_library.py``) to
    generate identity / warm / cool tables at service boot. Accepts any
    iterable that produces ``size**3`` RGB triplets in r-fastest order.
    """
    flat = np.asarray(list(mapping), dtype=np.float32)
    if flat.shape != (size ** 3, 3):
        raise CubeLutError(
            f"build_3d_cube_table expected {size ** 3} entries, got {flat.shape[0]}.",
        )
    return flat.reshape(size, size, size, 3)


# ───────────────────────────── Application ─────────────────────────────

TonalMix = str  # 'all' | 'highlights' | 'midtones' | 'shadows'


def apply_lut(
    image: np.ndarray,
    lut: ParsedCubeLut,
    strength: float,
    tonal_mix: str = "all",
) -> np.ndarray:
    """Apply a parsed .cube LUT to a BGR uint8 image.

    ``strength`` is a percentage in [0, 100]. At 0 the function is the
    identity; at 100 the output is the full LUT.

    ``tonal_mix`` optionally limits the effect to a tonal range:
        "all"        — apply across the full image (default)
        "highlights" — apply only where input luminance ≳ 0.65
        "midtones"   — apply only near mid-grey
        "shadows"    — apply only where input luminance ≲ 0.35
    The mask uses a smoothstep so the LUT fades in/out rather than
    hard-cutting.

    The input image is BGR (OpenCV default) but LUTs are authored for RGB
    domain, so we swap axes at the boundary. All interpolation is done
    in float32. The return array is uint8 with the same shape as input.
    """
    if image is None or image.size == 0:
        return image
    strength_norm = max(0.0, min(100.0, float(strength))) / 100.0
    if strength_norm <= 0.0:
        return image

    if image.dtype != np.uint8:
        image = np.clip(image, 0, 255).astype(np.uint8)

    # BGR uint8 → RGB float normalised into the LUT domain.
    rgb = image[..., ::-1].astype(np.float32) / 255.0
    domain_min = np.asarray(lut.domain_min, dtype=np.float32)
    domain_max = np.asarray(lut.domain_max, dtype=np.float32)
    span = np.maximum(domain_max - domain_min, 1e-6)
    rgb_scaled = np.clip((rgb - domain_min) / span, 0.0, 1.0)

    if lut.kind == "1D":
        mapped = _apply_1d(rgb_scaled, lut.table, lut.size)
    else:
        mapped = _apply_3d_trilinear(rgb_scaled, lut.table, lut.size)

    # Unscale back to [0, 1] RGB.
    mapped = domain_min + mapped * span

    # Tonal-mix mask — smoothstep based on input luminance so the LUT
    # fades in/out across a range rather than hard-cutting.
    mix_weight = _tonal_mix_weight(rgb, tonal_mix)
    effective_strength = strength_norm * mix_weight

    blended = rgb * (1.0 - effective_strength) + mapped * effective_strength
    blended = np.clip(blended, 0.0, 1.0)

    bgr_out = (blended[..., ::-1] * 255.0).round().astype(np.uint8)
    return bgr_out


def _tonal_mix_weight(rgb: np.ndarray, tonal_mix: str) -> np.ndarray:
    """Return a luminance-based mask in [0, 1] with the same (H, W) shape
    as ``rgb`` so the final mix can multiply element-wise.

    Matches the WebGL preview shader's behaviour so the photographer's
    live preview and the committed runner output line up tonally.
    """
    if tonal_mix == "all" or not tonal_mix:
        return np.ones(rgb.shape[:-1] + (1,), dtype=np.float32)
    luminance = (
        rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    ).astype(np.float32)
    mode = tonal_mix.lower()
    if mode == "highlights":
        weight = _smoothstep(0.45, 0.85, luminance)
    elif mode == "shadows":
        weight = 1.0 - _smoothstep(0.15, 0.55, luminance)
    elif mode == "midtones":
        distance = np.abs(luminance - 0.5)
        weight = 1.0 - _smoothstep(0.15, 0.4, distance)
    else:
        weight = np.ones_like(luminance, dtype=np.float32)
    return weight[..., np.newaxis]


def _smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / max(edge1 - edge0, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _apply_1d(rgb: np.ndarray, table: np.ndarray, size: int) -> np.ndarray:
    grid_x = rgb * (size - 1)
    lo = np.floor(grid_x).astype(np.int32)
    hi = np.minimum(lo + 1, size - 1)
    frac = grid_x - lo.astype(np.float32)

    r = table[lo[..., 0], 0] * (1 - frac[..., 0]) + table[hi[..., 0], 0] * frac[..., 0]
    g = table[lo[..., 1], 1] * (1 - frac[..., 1]) + table[hi[..., 1], 1] * frac[..., 1]
    b = table[lo[..., 2], 2] * (1 - frac[..., 2]) + table[hi[..., 2], 2] * frac[..., 2]
    return np.stack([r, g, b], axis=-1)


def _apply_3d_trilinear(rgb: np.ndarray, table: np.ndarray, size: int) -> np.ndarray:
    # table is indexed as table[b, g, r, :]. We walk the 8 cube corners.
    grid = rgb * (size - 1)
    lo = np.floor(grid).astype(np.int32)
    hi = np.minimum(lo + 1, size - 1)
    frac = grid - lo.astype(np.float32)

    r0, g0, b0 = lo[..., 0], lo[..., 1], lo[..., 2]
    r1, g1, b1 = hi[..., 0], hi[..., 1], hi[..., 2]
    fr, fg, fb = frac[..., 0:1], frac[..., 1:2], frac[..., 2:3]

    c000 = table[b0, g0, r0]
    c100 = table[b0, g0, r1]
    c010 = table[b0, g1, r0]
    c110 = table[b0, g1, r1]
    c001 = table[b1, g0, r0]
    c101 = table[b1, g0, r1]
    c011 = table[b1, g1, r0]
    c111 = table[b1, g1, r1]

    c00 = c000 * (1 - fr) + c100 * fr
    c10 = c010 * (1 - fr) + c110 * fr
    c01 = c001 * (1 - fr) + c101 * fr
    c11 = c011 * (1 - fr) + c111 * fr

    c0 = c00 * (1 - fg) + c10 * fg
    c1 = c01 * (1 - fg) + c11 * fg

    return c0 * (1 - fb) + c1 * fb


__all__ = [
    "CubeLutError",
    "ParsedCubeLut",
    "apply_lut",
    "build_3d_cube_table",
    "parse_cube",
]

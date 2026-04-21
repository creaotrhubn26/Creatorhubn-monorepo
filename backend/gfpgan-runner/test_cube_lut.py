"""Deterministic tests for the .cube parser + trilinear applier.

Pure numpy tests — no runner, no network. Run with:

    cd backend/gfpgan-runner
    python -m pytest test_cube_lut.py -v
"""
from __future__ import annotations

import numpy as np
import pytest

from cube_lut import (
    CubeLutError,
    apply_lut,
    build_3d_cube_table,
    parse_cube,
)


# ───────────────────────── Parser helpers ────────────────────────────

def _minimal_3d_cube(size: int) -> str:
    """Build a valid identity .cube of the given size."""
    lines = [f"LUT_3D_SIZE {size}"]
    for b in range(size):
        for g in range(size):
            for r in range(size):
                lines.append(
                    f"{r / (size - 1):.6f} {g / (size - 1):.6f} {b / (size - 1):.6f}"
                )
    return "\n".join(lines)


def _minimal_1d_cube(size: int) -> str:
    lines = [f"LUT_1D_SIZE {size}"]
    for i in range(size):
        v = i / (size - 1)
        lines.append(f"{v:.6f} {v:.6f} {v:.6f}")
    return "\n".join(lines)


# ───────────────────────── Parser tests ──────────────────────────────

def test_parses_minimal_3d_identity():
    lut = parse_cube(_minimal_3d_cube(3))
    assert lut.kind == "3D"
    assert lut.size == 3
    assert lut.table.shape == (3, 3, 3, 3)
    assert lut.domain_min == (0.0, 0.0, 0.0)
    assert lut.domain_max == (1.0, 1.0, 1.0)


def test_parses_minimal_1d_identity():
    lut = parse_cube(_minimal_1d_cube(16))
    assert lut.kind == "1D"
    assert lut.size == 16
    assert lut.table.shape == (16, 3)


def test_parses_title_quoted_and_unquoted():
    a = parse_cube("TITLE \"Warm look\"\n" + _minimal_3d_cube(2))
    assert a.title == "Warm look"
    b = parse_cube("TITLE Warm\n" + _minimal_3d_cube(2))
    assert b.title == "Warm"


def test_strips_bom_and_handles_crlf():
    source = "\ufeff" + _minimal_3d_cube(2).replace("\n", "\r\n")
    lut = parse_cube(source)
    assert lut.size == 2


def test_accepts_bytes_input():
    data = _minimal_3d_cube(2).encode("utf-8")
    lut = parse_cube(data)
    assert lut.size == 2


def test_skips_comments_and_blank_lines():
    source = "\n".join([
        "# header",
        "",
        "   ",
        "TITLE test",
        "# inline",
        _minimal_3d_cube(2),
    ])
    lut = parse_cube(source)
    assert lut.size == 2


def test_honours_custom_domain():
    source = "LUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 2 2 2\n" + "\n".join(
        f"{r} {g} {b}"
        for b in (0.0, 2.0)
        for g in (0.0, 2.0)
        for r in (0.0, 2.0)
    )
    lut = parse_cube(source)
    assert lut.domain_max == (2.0, 2.0, 2.0)


def test_rejects_missing_size():
    with pytest.raises(CubeLutError, match="LUT_1D_SIZE or LUT_3D_SIZE"):
        parse_cube("0 0 0\n0 0 0")


def test_rejects_wrong_entry_count():
    source = "LUT_3D_SIZE 3\n0 0 0\n1 1 1\n"
    with pytest.raises(CubeLutError, match="declares 27 entries"):
        parse_cube(source)


def test_rejects_both_sizes_declared():
    source = "LUT_3D_SIZE 2\nLUT_1D_SIZE 4\n"
    with pytest.raises(CubeLutError, match="both"):
        parse_cube(source)


def test_rejects_repeated_size_declaration():
    source = "LUT_3D_SIZE 2\nLUT_3D_SIZE 3\n"
    with pytest.raises(CubeLutError, match="more than once"):
        parse_cube(source)


def test_rejects_non_numeric_entry():
    source = "LUT_3D_SIZE 2\n" + ("0 0 0\n" * 7) + "a b c\n"
    with pytest.raises(CubeLutError, match="non-numeric"):
        parse_cube(source)


def test_rejects_domain_min_not_below_max():
    source = "LUT_3D_SIZE 2\nDOMAIN_MIN 1 1 1\nDOMAIN_MAX 1 1 1\n" + ("0 0 0\n" * 8)
    with pytest.raises(CubeLutError, match="strictly less"):
        parse_cube(source)


def test_rejects_oversize_3d_lut():
    source = "LUT_3D_SIZE 100\n"
    with pytest.raises(CubeLutError, match="exceeds safe cap"):
        parse_cube(source)


# ───────────────────────── Applier tests ─────────────────────────────

def _identity_lut(size: int):
    return parse_cube(_minimal_3d_cube(size))


def test_identity_lut_roundtrip_exact():
    image = np.array([
        [[0, 0, 0], [128, 128, 128]],
        [[64, 200, 40], [255, 255, 255]],
    ], dtype=np.uint8)
    lut = _identity_lut(17)
    out = apply_lut(image, lut, strength=100)
    # Identity with strength 100 — allow ≤1 quantisation bit of drift.
    assert np.all(np.abs(out.astype(int) - image.astype(int)) <= 1)


def test_zero_strength_is_identity():
    image = np.full((4, 4, 3), 77, dtype=np.uint8)
    lut = _identity_lut(9)
    out = apply_lut(image, lut, strength=0)
    assert np.array_equal(out, image)


def test_strength_mid_blends_toward_lut():
    # Build a 3D LUT that inverts the input: entry (r, g, b) → (1-r, 1-g, 1-b).
    entries = []
    for b_i in range(3):
        for g_i in range(3):
            for r_i in range(3):
                r = r_i / 2.0
                g = g_i / 2.0
                b = b_i / 2.0
                entries.append((1.0 - r, 1.0 - g, 1.0 - b))
    inverted_table = build_3d_cube_table(3, entries)
    from cube_lut import ParsedCubeLut
    lut = ParsedCubeLut(
        kind="3D",
        size=3,
        domain_min=(0.0, 0.0, 0.0),
        domain_max=(1.0, 1.0, 1.0),
        title="invert",
        table=inverted_table,
    )
    image = np.full((2, 2, 3), 200, dtype=np.uint8)
    out = apply_lut(image, lut, strength=50)
    # Midway between 200 (input) and 55 (inverted). Allow small drift.
    assert np.all(np.abs(out.astype(int) - 127) <= 3)


def test_corner_points_exact_on_identity():
    image = np.array([[[0, 0, 0]], [[255, 255, 255]]], dtype=np.uint8)
    lut = _identity_lut(17)
    out = apply_lut(image, lut, strength=100)
    assert out[0, 0, 0] == 0
    assert out[1, 0, 2] == 255


def test_clamps_out_of_domain_safely():
    # Even when strength > 100, applier clamps internally → no drift
    # beyond max LUT result.
    image = np.full((2, 2, 3), 128, dtype=np.uint8)
    lut = _identity_lut(5)
    out = apply_lut(image, lut, strength=1_000_000)
    assert out.dtype == np.uint8
    assert np.all((out >= 0) & (out <= 255))


def test_handles_empty_image():
    empty = np.zeros((0, 0, 3), dtype=np.uint8)
    lut = _identity_lut(3)
    out = apply_lut(empty, lut, strength=100)
    assert out.shape == empty.shape


def test_applier_casts_float_input_to_uint8():
    image = np.full((3, 3, 3), 160.7, dtype=np.float32)
    lut = _identity_lut(5)
    out = apply_lut(image, lut, strength=50)
    assert out.dtype == np.uint8


def test_tonal_mix_highlights_leaves_shadows_unchanged():
    # Build a "shift toward magenta" LUT at every cell so the effect is
    # obvious when applied. Then verify shadows stay near original while
    # highlights move.
    size = 5
    entries = []
    for b_i in range(size):
        for g_i in range(size):
            for r_i in range(size):
                r = min(1.0, r_i / (size - 1) + 0.2)
                g = max(0.0, g_i / (size - 1) - 0.2)
                b = min(1.0, b_i / (size - 1) + 0.15)
                entries.append((r, g, b))
    lut_table = build_3d_cube_table(size, entries)
    from cube_lut import ParsedCubeLut
    lut = ParsedCubeLut(
        kind="3D",
        size=size,
        domain_min=(0.0, 0.0, 0.0),
        domain_max=(1.0, 1.0, 1.0),
        title="shift",
        table=lut_table,
    )
    # Build an image with a top-half highlights (values around 220) and
    # bottom-half shadows (values around 40).
    image = np.zeros((16, 16, 3), dtype=np.uint8)
    image[:8, :] = 220
    image[8:, :] = 40

    out = apply_lut(image, lut, strength=100, tonal_mix="highlights")
    # The LUT shifts G down by 0.2 — assert per-channel direction so
    # opposing R/B/G drifts don't cancel out in a mean.
    highlight_g_before = image[:8, :, 1].astype(int).mean()
    highlight_g_after = out[:8, :, 1].astype(int).mean()
    shadow_g_before = image[8:, :, 1].astype(int).mean()
    shadow_g_after = out[8:, :, 1].astype(int).mean()
    assert highlight_g_before - highlight_g_after > 30, (
        f"highlights G drift: {highlight_g_before - highlight_g_after}"
    )
    assert abs(shadow_g_after - shadow_g_before) < 2


def test_tonal_mix_shadows_is_mirror_of_highlights():
    from cube_lut import ParsedCubeLut
    entries = []
    size = 5
    for _ in range(size ** 3):
        entries.append((0.0, 0.0, 0.0))  # map everything to black
    lut = ParsedCubeLut(
        kind="3D",
        size=size,
        domain_min=(0.0, 0.0, 0.0),
        domain_max=(1.0, 1.0, 1.0),
        title="crush",
        table=build_3d_cube_table(size, entries),
    )
    image = np.zeros((16, 16, 3), dtype=np.uint8)
    image[:8, :] = 220
    image[8:, :] = 40
    out = apply_lut(image, lut, strength=100, tonal_mix="shadows")
    # Shadows should collapse toward black; highlights should stay lifted.
    assert out[8:].mean() < 30
    assert out[:8].mean() > 180


def test_1d_lut_applies_per_channel():
    # 1D gamma-ish LUT: squares the input value.
    source_lines = ["LUT_1D_SIZE 9"]
    for i in range(9):
        v = (i / 8.0) ** 2
        source_lines.append(f"{v:.6f} {v:.6f} {v:.6f}")
    lut = parse_cube("\n".join(source_lines))
    image = np.full((2, 2, 3), 128, dtype=np.uint8)
    out = apply_lut(image, lut, strength=100)
    # 128/255 = 0.502. 0.502^2 ≈ 0.252 → 64 ±1.
    assert np.all(np.abs(out.astype(int) - 64) <= 3)

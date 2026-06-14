"""Build Fusion Demo — bygger en KOMPLETT DaVinci Resolve-timeline med
Fusion-komposisjoner for en produkt-/SaaS-demo: profesjonelle virtuelle
kamerabevegelser + rene UI-animasjoner (motion graphics i samme stil som
moderne software-merker og landingssider).

Dette er Post Agent sin "maks Resolve Fusion-integrasjon":

  1. Setter timeline KORREKT (oppløsning, fps — default 60 for smooth motion,
     color science, audio) FØR noe annet, så ferdig output aldri trenger
     re-export.
  2. Importerer scene-media (screenshots ELLER opptak) i en egen bin.
  3. Legger hver scene på timeline med riktig varighet.
  4. Bygger PER SCENE en Fusion-graf med ALLE nodene som trengs:
        MediaIn → Transform (virtuelt kamera, eased keyframes)
                → Merge(caption-gruppe: Background-bar + Text+, slide+fade)
                → Merge(cinematic reveal/fade fra svart inn + ut)
                → MediaOut
     Kamerabevegelsen følger brukerens fokus og bruker myke ease-kurver.
  5. Kryss-toning mellom klipp gjøres INNE i Fusion (fade fra/til svart),
     så hele effekten lever i Fusion-grafen slik bruker ba om.

Kamera-vokabular (matcher Demo Studio sine per-scene-overstyringer):
  push_in / zoom_in, zoom_out, pan_left, pan_right, section_snap, parallax,
  cinematic_reveal, auto (varierer automatisk).

Robusthet: alt Fusion-arbeid er pakket i try/except per node + keyframe og
rapporteres i resultatet. Selv om en Resolve-versjon mangler en finesse,
faller scenen tilbake til en ren zoom + tekst som alltid virker. dry_run
skriver hele node/keyframe-planen uten å røre Resolve.
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# ── Timeline-presets (fps default 60 for smooth SaaS-motion) ──────────────
TIMELINE_PRESETS = {
    "youtube_master":          {"label": "YouTube Master 1080p", "width": 1920, "height": 1080, "fps": 60},
    "youtube_master_4k":       {"label": "YouTube 4K",           "width": 3840, "height": 2160, "fps": 60},
    "landing_hero":            {"label": "Landing-hero 16:9",    "width": 1920, "height": 1080, "fps": 60},
    "instagram_reels":         {"label": "Instagram Reels 9:16", "width": 1080, "height": 1920, "fps": 30},
    "tiktok":                  {"label": "TikTok 9:16",          "width": 1080, "height": 1920, "fps": 30},
    "instagram_feed_portrait": {"label": "Instagram Feed 4:5",   "width": 1080, "height": 1350, "fps": 30},
    "square":                  {"label": "Square 1:1",           "width": 1080, "height": 1080, "fps": 30},
    "linkedin":                {"label": "LinkedIn 16:9",        "width": 1920, "height": 1080, "fps": 30},
}

DEFAULT_BRAND = {
    "accent":    [0.231, 0.510, 0.965],  # #3B82F6 SaaS-blå
    "textColor": [1.0, 1.0, 1.0],
    "barColor":  [0.04, 0.05, 0.09],     # nær-svart panel
    "font":      "Open Sans",
    "fontStyle": "Bold",
}


def _ease(start_v, end_v, frames, settle=0.78):
    """Lag et 3-punkts ease-out/ease-in nøkkelramme-sett for smooth bevegelse.
    Hovedbevegelsen skjer tidlig (settle) og 'lander' rolig — SaaS-følelsen.
    Returnerer liste av (frame, value)."""
    mid = max(1, int(frames * 0.62))
    mid_v = start_v + (end_v - start_v) * settle
    return [(0, start_v), (mid, mid_v), (max(2, frames), end_v)]


def _camera_keys(move, frames):
    """Returnerer dict med eased keyframes for Transform-inputene
    (Size scalar, Center [x,y]) for et gitt kamera-trekk.
    Center 0.5/0.5 = sentrert."""
    f = max(2, frames)
    if move in ("push_in", "zoom_in"):
        return {"Size": _ease(1.0, 1.12, f), "Center": None}
    if move == "zoom_out":
        return {"Size": _ease(1.16, 1.0, f), "Center": None}
    if move == "pan_left":
        return {"Size": [(0, 1.08), (f, 1.08)], "Center": _ease_pt((0.56, 0.5), (0.44, 0.5), f)}
    if move == "pan_right":
        return {"Size": [(0, 1.08), (f, 1.08)], "Center": _ease_pt((0.44, 0.5), (0.56, 0.5), f)}
    if move == "section_snap":
        return {"Size": [(0, 1.06), (f, 1.06)], "Center": _ease_pt((0.5, 0.58), (0.5, 0.42), f)}
    if move == "parallax":
        return {"Size": _ease(1.14, 1.20, f), "Center": _ease_pt((0.53, 0.52), (0.47, 0.48), f)}
    if move == "cinematic_reveal":
        return {"Size": _ease(1.22, 1.02, f), "Center": None, "reveal": True}
    # auto / ukjent → mild push-in
    return {"Size": _ease(1.0, 1.10, f), "Center": None}


def _ease_pt(start_xy, end_xy, frames):
    """Eased 2D-bevegelse → liste av (frame, [x,y])."""
    f = max(2, frames)
    mid = max(1, int(f * 0.62))
    sx, sy = start_xy
    ex, ey = end_xy
    mx = sx + (ex - sx) * 0.78
    my = sy + (ey - sy) * 0.78
    return [(0, [sx, sy]), (mid, [mx, my]), (f, [ex, ey])]


CAM_CYCLE = ["push_in", "pan_right", "parallax", "zoom_out", "pan_left", "section_snap"]


def _make_solid_png(path, w, h, rgb):
    """Avhengighetsfri solid-farge-PNG (for brand intro/outro-bakgrunn)."""
    import zlib
    import struct
    r, g, b = [int(max(0.0, min(1.0, float(c))) * 255) for c in rgb[:3]]
    row = bytes([r, g, b]) * w
    raw = bytearray()
    for _ in range(h):
        raw.append(0)  # filter-type 0 per rad
        raw.extend(row)

    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data
                + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    try:
        with open(path, "wb") as f:
            f.write(png)
        return path
    except OSError:
        return None


# ── Live Fusion-API-hjelpere (defensive) ──────────────────────────────────
# Verifisert mot Resolve 21: animasjon settes ved å koble en BezierSpline
# (scalar) eller en XYPath m/ to BezierSpliner (point/Center) til inputen, og
# kalle SetKeyFrames({frame: value}). SetKeyFrames gir automatisk smooth
# bezier-handles (RH/LH) = SaaS-ease. SetInput(name,value,frame) keyframer IKKE.
def _kf_scalar(comp, tool, name, keys, report):
    """Animer en scalar input (Size/Blend/GlowSize/Width…) med en BezierSpline."""
    try:
        sp = comp.BezierSpline()
        setattr(tool, name, sp)
        sp.SetKeyFrames({float(f): float(v) for f, v in keys})
        return True
    except Exception as exc:  # noqa: BLE001
        report.append(f"scalar keyframe {name} feilet: {exc}")
        # fallback: statisk siste verdi så scenen ikke blir tom
        try:
            tool.SetInput(name, float(keys[-1][1]))
        except Exception:  # noqa: BLE001
            pass
        return False


def _kf_point(comp, tool, name, keys, report):
    """Animer en point input (Center) med XYPath + to BezierSpliner (X/Y)."""
    try:
        xp = comp.XYPath({})
        setattr(tool, name, xp)
        spx = comp.BezierSpline()
        spy = comp.BezierSpline()
        xp.X = spx
        xp.Y = spy
        spx.SetKeyFrames({float(f): float(xy[0]) for f, xy in keys})
        spy.SetKeyFrames({float(f): float(xy[1]) for f, xy in keys})
        return True
    except Exception as exc:  # noqa: BLE001
        report.append(f"point keyframe {name} feilet: {exc}")
        try:
            tool.SetInput(name, [float(keys[-1][1][0]), float(keys[-1][1][1])])
        except Exception:  # noqa: BLE001
            pass
        return False


def _set(tool, name, value, report):
    try:
        tool.SetInput(name, value)
        return True
    except Exception as exc:  # noqa: BLE001
        report.append(f"SetInput {name} feilet: {exc}")
        return False


def _add(comp, reg_id, x, y, report):
    try:
        t = comp.AddTool(reg_id, x, y)
        if t is None:
            report.append(f"AddTool {reg_id} returnerte None")
        return t
    except Exception as exc:  # noqa: BLE001
        report.append(f"AddTool {reg_id} feilet: {exc}")
        return None


def _connect(dst, input_name, src, report):
    try:
        dst.ConnectInput(input_name, src)
        return True
    except Exception as exc:  # noqa: BLE001
        report.append(f"ConnectInput {input_name} feilet: {exc}")
        return False


def _find(comp, reg_id):
    try:
        d = comp.GetToolList(False, reg_id)
        if d:
            return d.get(1) or list(d.values())[0]
    except Exception:  # noqa: BLE001
        pass
    return None


def _build_scene_comp(comp, scene, idx, total, fps, brand, dur, report):
    """Bygg én scenes Fusion-graf. Returnerer dict med hva som ble laget."""
    dur = max(2, int(dur))
    move = (scene.get("cameraMove") or "auto").strip().lower()
    if move == "auto":
        move = CAM_CYCLE[idx % len(CAM_CYCLE)]
    built = {"scene": idx, "cameraMove": move, "durationFrames": dur, "nodes": [], "warnings": report}

    media_in = _find(comp, "MediaIn")
    media_out = _find(comp, "MediaOut")
    if not media_in or not media_out:
        report.append("MediaIn/MediaOut mangler i comp — kan ikke bygge")
        return built

    # 1) Virtuelt kamera (Transform), eased keyframes som følger fokus
    cam = _add(comp, "Transform", 1, 0, report)
    cam_keys = _camera_keys(move, dur)
    if cam:
        built["nodes"].append("Transform(camera)")
        _connect(cam, "Input", media_in, report)
        _kf_scalar(comp, cam, "Size", cam_keys["Size"], report)
        if cam_keys.get("Center"):
            _kf_point(comp, cam, "Center", cam_keys["Center"], report)
    last = cam or media_in

    # 2) Ren UI-caption: Background-bar (masket) + Text+, slide-up + fade
    caption = (scene.get("caption") or "").strip()
    if caption:
        cap_out = _build_caption(comp, caption, dur, fps, brand, report)
        if cap_out:
            built["nodes"].append("Caption(Text++Background+Merge)")
            mrg = _add(comp, "Merge", 2, 0, report)
            if mrg:
                _connect(mrg, "Background", last, report)
                _connect(mrg, "Foreground", cap_out, report)
                last = mrg

    # 2b) Motion-graphics-effekter (CTA-highlight, spotlight, callout, cursor,
    #     card, light-sweep) — lag-på-lag merget over media+caption.
    for fx in (scene.get("effects") or []):
        try:
            fx_out, fx_name = _build_effect(comp, fx, dur, fps, brand, report)
        except Exception as exc:  # noqa: BLE001
            report.append(f"effekt {fx.get('type')} kastet: {exc}")
            fx_out, fx_name = None, None
        if fx_out:
            built["nodes"].append(fx_name)
            m = _add(comp, "Merge", 2, 1, report)
            if m:
                _connect(m, "Background", last, report)
                _connect(m, "Foreground", fx_out, report)
                last = m

    # 3) Cinematic reveal / kryss-toning: svart Background med Blend-keyframes
    rev = _build_reveal(comp, dur, fps, idx, total, force=cam_keys.get("reveal", False),
                        report=report)
    if rev:
        built["nodes"].append("Reveal(fade fra/til svart)")
        mrg2 = _add(comp, "Merge", 3, 0, report)
        if mrg2:
            _connect(mrg2, "Background", last, report)
            _connect(mrg2, "Foreground", rev, report)
            last = mrg2

    # 4) Koble til MediaOut
    _connect(media_out, "Input", last, report)
    return built


def _build_caption(comp, text, dur, fps, brand, report):
    """Lower-third: dark bar (Background masket av Rectangle) bak Text+.
    Hele gruppen slides opp + fades inn via Transform + Merge-blend."""
    # Text+
    txt = _add(comp, "TextPlus", 0, 2, report)
    if not txt:
        return None
    _set(txt, "StyledText", text, report)
    _set(txt, "Font", brand.get("font", "Open Sans"), report)
    _set(txt, "Style", brand.get("fontStyle", "Bold"), report)
    _set(txt, "Size", 0.045, report)            # relativ font-størrelse
    _set(txt, "Center", [0.5, 0.16], report)    # nedre tredjedel
    try:
        txt.SetInput("Red1", brand["textColor"][0])
        txt.SetInput("Green1", brand["textColor"][1])
        txt.SetInput("Blue1", brand["textColor"][2])
    except Exception:  # noqa: BLE001
        report.append("Text+ farge feilet")

    # Bakgrunns-bar (accent-tonet, lav opacity) masket til en pill
    bar = _add(comp, "Background", 0, 3, report)
    rect = _add(comp, "RectangleMask", -1, 3, report)
    bar_out = txt
    if bar and rect:
        try:
            bar.SetInput("TopLeftRed", brand["barColor"][0])
            bar.SetInput("TopLeftGreen", brand["barColor"][1])
            bar.SetInput("TopLeftBlue", brand["barColor"][2])
            bar.SetInput("TopLeftAlpha", 0.82)
        except Exception:  # noqa: BLE001
            report.append("bar-farge feilet")
        _set(rect, "Width", 0.6, report)
        _set(rect, "Height", 0.1, report)
        _set(rect, "Center", [0.5, 0.16], report)
        _set(rect, "CornerRadius", 0.5, report)
        _connect(bar, "EffectMask", rect, report)
        # Merge: bar bak, tekst foran
        bm = _add(comp, "Merge", 1, 2, report)
        if bm:
            _connect(bm, "Background", bar, report)
            _connect(bm, "Foreground", txt, report)
            bar_out = bm

    # Slide-up + fade-in via Transform foran gruppen
    anim = _add(comp, "Transform", 2, 2, report)
    if anim and bar_out:
        _connect(anim, "Input", bar_out, report)
        intro = max(2, int(round(0.5 * fps)))
        # slide opp (Center.y -0.06 → 0) + alpha-blend 0 → 1
        _kf_point(comp, anim, "Center", [(0, [0.5, 0.44]), (intro, [0.5, 0.5])], report)
        _kf_scalar(comp, anim, "Blend", [(0, 0.0), (intro, 1.0)], report)
        return anim
    return bar_out


def _build_reveal(comp, dur, fps, idx, total, force, report):
    """Svart Background med Blend-keyframes: fade fra svart inn (alle klipp,
    kort) + ut mot slutten — gir kryss-toning mellom scener i Fusion."""
    bg = _add(comp, "Background", 0, 4, report)
    if not bg:
        return None
    try:
        for ch in ("TopLeftRed", "TopLeftGreen", "TopLeftBlue"):
            bg.SetInput(ch, 0.0)
        bg.SetInput("TopLeftAlpha", 1.0)
    except Exception:  # noqa: BLE001
        report.append("reveal-bg farge feilet")
    fade_in = max(2, int(round((0.5 if force else 0.33) * fps)))
    fade_out = max(2, int(round(0.33 * fps)))
    keys = [(0, 1.0), (fade_in, 0.0)]
    if dur - fade_out > fade_in:
        keys += [(dur - fade_out, 0.0), (dur, 1.0)]
    _kf_scalar(comp, bg, "Blend", keys, report)
    return bg


# ── Motion-graphics-effekt-recipes (compositing-lag i Fusion) ─────────────
def _rect_to_fusion(rect):
    """[x,y,w,h] i skjerm-koord (top-left, y ned, 0..1) → (cx,cy,w,h) i
    Fusion-koord (senter, y opp)."""
    x, y, w, h = (list(rect) + [0.3, 0.3, 0.3, 0.12])[:4]
    cx = x + w / 2.0
    cy = 1.0 - (y + h / 2.0)
    return cx, cy, w, h


def _build_effect(comp, fx, dur, fps, brand, report):
    """Dispatcher: returnerer (output_tool, navn) for én effekt, eller (None,None)."""
    kind = (fx.get("type") or "").strip()
    if kind in ("ctaHighlight", "spotlight"):
        return _fx_spotlight(comp, fx, dur, fps, brand, report,
                             with_glow=True, with_label=(kind == "ctaHighlight"))
    if kind == "callout":
        return _fx_callout(comp, fx, dur, fps, brand, report)
    if kind == "cursor":
        return _fx_cursor(comp, fx, dur, fps, brand, report)
    if kind == "card":
        return _fx_card(comp, fx, dur, fps, brand, report)
    if kind in ("lightSweep", "light_sweep"):
        return _fx_light_sweep(comp, fx, dur, fps, brand, report)
    if kind == "glow":
        return _fx_glow(comp, fx, dur, fps, brand, report)
    report.append(f"ukjent effekt-type: {kind}")
    return None, None


def _fx_spotlight(comp, fx, dur, fps, brand, report, with_glow, with_label):
    """Mørk overlay over alt UNNTATT fokus-rekt (invertert mask) + valgfri
    pulserende glow-ring + label. = CTA-highlight / spotlight."""
    cx, cy, w, h = _rect_to_fusion(fx.get("rect") or [0.4, 0.45, 0.2, 0.1])
    dim = float(fx.get("dim", 0.58))
    overlay = _add(comp, "Background", 0, 5, report)
    hole = _add(comp, "RectangleMask", -1, 5, report)
    if not overlay or not hole:
        return None, None
    for ch in ("TopLeftRed", "TopLeftGreen", "TopLeftBlue"):
        _set(overlay, ch, 0.02, report)
    _set(overlay, "TopLeftAlpha", 1.0, report)
    _set(hole, "Center", [cx, cy], report)
    _set(hole, "Width", w * 1.12, report)
    _set(hole, "Height", h * 1.5, report)
    _set(hole, "CornerRadius", 0.4, report)
    _set(hole, "SoftEdge", 0.03, report)
    _set(hole, "Invert", 1, report)          # mask = utenfor rekt
    _connect(overlay, "EffectMask", hole, report)
    # fade overlay inn
    fade = max(2, int(round(0.4 * fps)))
    _kf_scalar(comp, overlay, "Blend", [(0, 0.0), (fade, dim)], report)
    out = overlay

    if with_glow:
        ring = _add(comp, "Background", 0, 6, report)
        ring_mask = _add(comp, "RectangleMask", -1, 6, report)
        if ring and ring_mask:
            _set(ring, "TopLeftRed", brand["accent"][0], report)
            _set(ring, "TopLeftGreen", brand["accent"][1], report)
            _set(ring, "TopLeftBlue", brand["accent"][2], report)
            _set(ring, "TopLeftAlpha", 1.0, report)
            _set(ring_mask, "Center", [cx, cy], report)
            _set(ring_mask, "Width", w * 1.12, report)
            _set(ring_mask, "Height", h * 1.5, report)
            _set(ring_mask, "CornerRadius", 0.4, report)
            _set(ring_mask, "BorderWidth", 0.006, report)
            _set(ring_mask, "Solid", 0, report)   # bare omriss
            _connect(ring, "EffectMask", ring_mask, report)
            glow = _add(comp, "Glow", 1, 6, report)
            if glow:
                _connect(glow, "Input", ring, report)
                # pulserende glow-gain
                half = max(2, int(dur / 2))
                _kf_scalar(comp, glow, "GlowSize", [(0, 8.0), (half, 22.0), (dur, 8.0)], report)
                ring = glow
            gm = _add(comp, "Merge", 1, 5, report)
            if gm:
                _connect(gm, "Background", out, report)
                _connect(gm, "Foreground", ring, report)
                out = gm

    if with_label:
        label = (fx.get("label") or "Start her").strip()
        txt = _add(comp, "TextPlus", 0, 7, report)
        if txt:
            _set(txt, "StyledText", ("➜ " + label) if fx.get("arrow", True) else label, report)
            _set(txt, "Font", brand["font"], report)
            _set(txt, "Style", brand["fontStyle"], report)
            _set(txt, "Size", 0.04, report)
            _set(txt, "Center", [cx, min(0.93, cy + h * 1.4)], report)
            for i, ch in enumerate(("Red1", "Green1", "Blue1")):
                _set(txt, ch, brand["textColor"][i], report)
            anim = _add(comp, "Transform", 1, 7, report)
            if anim:
                _connect(anim, "Input", txt, report)
                intro = max(2, int(round(0.4 * fps)))
                _kf_scalar(comp, anim, "Blend", [(0, 0.0), (intro, 1.0)], report)
                txt = anim
            lm = _add(comp, "Merge", 1, 4, report)
            if lm:
                _connect(lm, "Background", out, report)
                _connect(lm, "Foreground", txt, report)
                out = lm

    return out, ("CTA-highlight" if with_label else "Spotlight")


def _fx_glow(comp, fx, dur, fps, brand, report):
    """Bare en pulserende glow-ring rundt et element (uten dimming)."""
    return _fx_spotlight(comp, {**fx, "dim": 0.0}, dur, fps, brand, report,
                         with_glow=True, with_label=False)


def _fx_callout(comp, fx, dur, fps, brand, report):
    """Elegant tekstboks med pil som peker mot fokus-rekt, glow + slide-in."""
    cx, cy, w, h = _rect_to_fusion(fx.get("rect") or [0.5, 0.4, 0.18, 0.1])
    text = (fx.get("text") or "").strip()
    side = (fx.get("side") or "top").lower()
    # plasser boks over/under/ved siden av fokus
    bx, by = cx, cy
    arrow_char = "▼"
    if side == "top":
        by = min(0.9, cy + h * 1.6); arrow_char = "▼"
    elif side == "bottom":
        by = max(0.1, cy - h * 1.6); arrow_char = "▲"
    elif side == "left":
        bx = max(0.18, cx - w * 1.4); arrow_char = "▶"
    else:
        bx = min(0.82, cx + w * 1.4); arrow_char = "◀"

    bar = _add(comp, "Background", 0, 8, report)
    rect = _add(comp, "RectangleMask", -1, 8, report)
    out = None
    if bar and rect:
        for i, ch in enumerate(("TopLeftRed", "TopLeftGreen", "TopLeftBlue")):
            _set(bar, ch, brand["barColor"][i], report)
        _set(bar, "TopLeftAlpha", 0.88, report)
        _set(rect, "Center", [bx, by], report)
        _set(rect, "Width", max(0.18, min(0.4, 0.012 * len(text) + 0.08)), report)
        _set(rect, "Height", 0.085, report)
        _set(rect, "CornerRadius", 0.4, report)
        _set(rect, "SoftEdge", 0.004, report)
        _connect(bar, "EffectMask", rect, report)
        out = bar
    txt = _add(comp, "TextPlus", 0, 9, report)
    if txt:
        _set(txt, "StyledText", text, report)
        _set(txt, "Font", brand["font"], report)
        _set(txt, "Style", brand["fontStyle"], report)
        _set(txt, "Size", 0.032, report)
        _set(txt, "Center", [bx, by], report)
        for i, ch in enumerate(("Red1", "Green1", "Blue1")):
            _set(txt, ch, brand["textColor"][i], report)
        if out:
            tm = _add(comp, "Merge", 1, 8, report)
            if tm:
                _connect(tm, "Background", out, report)
                _connect(tm, "Foreground", txt, report)
                out = tm
        else:
            out = txt
    # pil mot fokus
    arrow = _add(comp, "TextPlus", 0, 10, report)
    if arrow and out:
        _set(arrow, "StyledText", arrow_char, report)
        _set(arrow, "Size", 0.05, report)
        _set(arrow, "Center", [cx, (by + cy) / 2.0], report)
        for i, ch in enumerate(("Red1", "Green1", "Blue1")):
            _set(arrow, ch, brand["accent"][i], report)
        am = _add(comp, "Merge", 1, 9, report)
        if am:
            _connect(am, "Background", out, report)
            _connect(am, "Foreground", arrow, report)
            out = am
    # slide-in + fade
    anim = _add(comp, "Transform", 2, 8, report)
    if anim and out:
        _connect(anim, "Input", out, report)
        intro = max(2, int(round(0.45 * fps)))
        dy = 0.04 if side in ("top", "right", "left") else -0.04
        _kf_point(comp, anim, "Center", [(0, [0.5, 0.5 - dy]), (intro, [0.5, 0.5])], report)
        _kf_scalar(comp, anim, "Blend", [(0, 0.0), (intro, 1.0)], report)
        out = anim
    return out, "Callout(boks+pil+glow)"


def _fx_cursor(comp, fx, dur, fps, brand, report):
    """Animert cursor: hvit prikk som beveger seg fra→til + klikk-ripple."""
    frm = fx.get("from") or [0.3, 0.7]
    to = fx.get("to") or [0.5, 0.5]
    # konverter top-left → Fusion-senter
    fx0, fy0 = frm[0], 1.0 - frm[1]
    tx0, ty0 = to[0], 1.0 - to[1]
    dot = _add(comp, "Background", 0, 11, report)
    dmask = _add(comp, "EllipseMask", -1, 11, report)
    out = None
    if dot and dmask:
        for i, ch in enumerate(("TopLeftRed", "TopLeftGreen", "TopLeftBlue")):
            _set(dot, ch, 1.0, report)
        _set(dot, "TopLeftAlpha", 1.0, report)
        _set(dmask, "Width", 0.02, report)
        _set(dmask, "Height", 0.02 * 16 / 9, report)
        _set(dmask, "SoftEdge", 0.01, report)
        _connect(dot, "EffectMask", dmask, report)
        move = _add(comp, "Transform", 1, 11, report)
        if move:
            _connect(move, "Input", dot, report)
            travel = max(2, int(dur * 0.55))
            _kf_point(comp, move, "Center", [(0, [fx0, fy0]), (travel, [tx0, ty0]),
                                       (dur, [tx0, ty0])], report)
            out = move
    # klikk-ripple ved ankomst
    if fx.get("click", True) and out:
        ring = _add(comp, "Background", 0, 12, report)
        rmask = _add(comp, "EllipseMask", -1, 12, report)
        if ring and rmask:
            for i, ch in enumerate(("TopLeftRed", "TopLeftGreen", "TopLeftBlue")):
                _set(ring, ch, brand["accent"][i], report)
            _set(ring, "TopLeftAlpha", 1.0, report)
            _set(rmask, "Center", [tx0, ty0], report)
            _set(rmask, "BorderWidth", 0.004, report)
            _set(rmask, "Solid", 0, report)
            _connect(ring, "EffectMask", rmask, report)
            click = max(2, int(dur * 0.6))
            _kf_scalar(comp, rmask, "Width", [(click, 0.01), (click + int(0.4 * fps), 0.08)], report)
            _kf_scalar(comp, ring, "Blend", [(click, 0.9), (click + int(0.4 * fps), 0.0)], report)
            cm = _add(comp, "Merge", 1, 11, report)
            if cm:
                _connect(cm, "Background", out, report)
                _connect(cm, "Foreground", ring, report)
                out = cm
    return out, "Animert cursor + klikk"


def _fx_card(comp, fx, dur, fps, brand, report):
    """Floating feature-card (glassmorphism-look): tonet panel + tittel/tekst,
    slide-in nedenfra."""
    pos = fx.get("pos") or [0.78, 0.3]
    px, py = pos[0], 1.0 - pos[1]
    title = (fx.get("title") or "").strip()
    body = (fx.get("text") or "").strip()
    bar = _add(comp, "Background", 0, 13, report)
    rect = _add(comp, "RectangleMask", -1, 13, report)
    out = None
    if bar and rect:
        for i, ch in enumerate(("TopLeftRed", "TopLeftGreen", "TopLeftBlue")):
            _set(bar, ch, brand["barColor"][i] + 0.04, report)
        _set(bar, "TopLeftAlpha", 0.8, report)
        _set(rect, "Center", [px, py], report)
        _set(rect, "Width", 0.26, report)
        _set(rect, "Height", 0.18, report)
        _set(rect, "CornerRadius", 0.25, report)
        _set(rect, "SoftEdge", 0.003, report)
        _connect(bar, "EffectMask", rect, report)
        out = bar
    if title and out:
        t = _add(comp, "TextPlus", 0, 14, report)
        if t:
            _set(t, "StyledText", title, report)
            _set(t, "Font", brand["font"], report)
            _set(t, "Style", brand["fontStyle"], report)
            _set(t, "Size", 0.035, report)
            _set(t, "Center", [px, py + 0.04], report)
            for i, ch in enumerate(("Red1", "Green1", "Blue1")):
                _set(t, ch, brand["accent"][i], report)
            tm = _add(comp, "Merge", 1, 13, report)
            if tm:
                _connect(tm, "Background", out, report)
                _connect(tm, "Foreground", t, report)
                out = tm
    if body and out:
        b = _add(comp, "TextPlus", 0, 15, report)
        if b:
            _set(b, "StyledText", body, report)
            _set(b, "Font", brand["font"], report)
            _set(b, "Size", 0.026, report)
            _set(b, "Center", [px, py - 0.02], report)
            for i, ch in enumerate(("Red1", "Green1", "Blue1")):
                _set(b, ch, brand["textColor"][i], report)
            bm = _add(comp, "Merge", 1, 14, report)
            if bm:
                _connect(bm, "Background", out, report)
                _connect(bm, "Foreground", b, report)
                out = bm
    anim = _add(comp, "Transform", 2, 13, report)
    if anim and out:
        _connect(anim, "Input", out, report)
        intro = max(2, int(round(0.5 * fps)))
        _kf_point(comp, anim, "Center", [(0, [0.5, 0.44]), (intro, [0.5, 0.5])], report)
        _kf_scalar(comp, anim, "Blend", [(0, 0.0), (intro, 1.0)], report)
        out = anim
    return out, "Floating feature-card"


def _fx_light_sweep(comp, fx, dur, fps, brand, report):
    """Premium light-sweep: lys diagonal stripe som feier over bildet."""
    stripe = _add(comp, "Background", 0, 16, report)
    smask = _add(comp, "RectangleMask", -1, 16, report)
    if not stripe or not smask:
        return None, None
    for ch in ("TopLeftRed", "TopLeftGreen", "TopLeftBlue"):
        _set(stripe, ch, 1.0, report)
    _set(stripe, "TopLeftAlpha", 0.5, report)
    _set(smask, "Width", 0.08, report)
    _set(smask, "Height", 1.6, report)
    _set(smask, "Angle", 22.0, report)
    _set(smask, "SoftEdge", 0.06, report)
    _connect(stripe, "EffectMask", smask, report)
    glow = _add(comp, "Glow", 1, 16, report)
    out = stripe
    if glow:
        _connect(glow, "Input", stripe, report)
        _set(glow, "GlowSize", 14.0, report)
        out = glow
    sweep = _add(comp, "Transform", 2, 16, report)
    if sweep:
        _connect(sweep, "Input", out, report)
        dwell = max(2, int(dur * 0.5))
        _kf_point(comp, sweep, "Center", [(0, [-0.3, 0.5]), (dwell, [1.3, 0.5])], report)
        _kf_scalar(comp, sweep, "Blend", [(0, 1.0), (dwell, 1.0), (dwell + 1, 0.0)], report)
        out = sweep
    return out, "Light-sweep"


def _apply_timeline_settings(project, preset, fps, report):
    settings = [
        ("timelineResolutionWidth",  str(preset["width"])),
        ("timelineResolutionHeight", str(preset["height"])),
        ("timelineFrameRate",        str(fps)),
        ("timelinePlaybackFrameRate", str(fps)),
        ("timelineOutputResolutionWidth",  str(preset["width"])),
        ("timelineOutputResolutionHeight", str(preset["height"])),
        ("timelineOutputResMatchesTimelineRes", "1"),
        ("timelineSampleRate", "48000"),
        ("colorScienceMode", "davinciYRGBColorManagedv2"),
        ("colorSpaceTimeline", "Rec.709 Gamma 2.4"),
        ("timelinePixelAspectRatio", "Square"),
    ]
    applied = {}
    for key, val in settings:
        try:
            applied[key] = bool(project.SetSetting(key, val))
        except Exception:  # noqa: BLE001
            applied[key] = False
            report.append(f"SetSetting {key} feilet")
    return applied


def run(params: dict[str, Any], dry_run: bool) -> None:
    scenes = params.get("scenes") or []
    if isinstance(scenes, str):
        import json as _json
        try:
            scenes = _json.loads(scenes)
        except Exception:  # noqa: BLE001
            scenes = []
    if not scenes:
        bridge.error("Ingen scener oppgitt. Send 'scenes': [{imagePath/clipPath, caption, durationSec, cameraMove}].")
        sys.exit(1)

    platform = (params.get("platform") or "youtube_master").strip().lower()
    preset = TIMELINE_PRESETS.get(platform, TIMELINE_PRESETS["youtube_master"])
    fps = int(params.get("fps") or preset["fps"])
    project_name = params.get("projectName") or "Post Agent Demo"
    timeline_name = params.get("timelineName") or "Demo – Fusion Motion"
    brand = {**DEFAULT_BRAND, **(params.get("brand") or {})}

    # Normaliser scener
    norm = []
    for i, s in enumerate(scenes):
        path = s.get("clipPath") or s.get("imagePath") or s.get("path") or ""
        norm.append({
            "path": path,
            "caption": s.get("caption") or s.get("overlayText") or "",
            "durationSec": float(s.get("durationSec") or s.get("dwellSec") or 4.0),
            "cameraMove": (s.get("cameraMove") or "auto"),
            "effects": s.get("effects") or [],
        })

    # Brand motion-system: logo-intro + CTA/end-screen som egne scener.
    _tmp_dir = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/fusion_demo")
    try:
        os.makedirs(_tmp_dir, exist_ok=True)
    except OSError:
        _tmp_dir = os.path.dirname(os.path.abspath(__file__))
    if brand.get("intro"):
        logo = brand.get("logoPath") if (brand.get("logoPath") and os.path.isfile(brand.get("logoPath", ""))) else None
        bg = logo or _make_solid_png(os.path.join(_tmp_dir, "intro_bg.png"),
                                     320, 180, brand["barColor"])
        if bg:
            norm.insert(0, {
                "path": bg,
                "caption": brand.get("title") or project_name,
                "durationSec": float(brand.get("introSec", 2.4)),
                "cameraMove": "cinematic_reveal",
                "effects": [],
                "_brand": "intro",
            })
    if brand.get("outro"):
        bg = _make_solid_png(os.path.join(_tmp_dir, "outro_bg.png"),
                             320, 180, brand["accent"])
        if bg:
            norm.append({
                "path": bg,
                "caption": "",
                "durationSec": float(brand.get("outroSec", 2.6)),
                "cameraMove": "push_in",
                "effects": [{"type": "card", "title": brand.get("cta") or "Book demo",
                             "text": brand.get("ctaSub") or "", "pos": [0.5, 0.5]}],
                "_brand": "outro",
            })

    plan = {
        "platform": platform,
        "preset": preset,
        "fps": fps,
        "projectName": project_name,
        "timelineName": timeline_name,
        "sceneCount": len(norm),
        "scenes": [
            {
                "index": i,
                "caption": s["caption"],
                "durationSec": s["durationSec"],
                "durationFrames": max(2, int(round(s["durationSec"] * fps))),
                "cameraMove": (s["cameraMove"] if s["cameraMove"] != "auto"
                               else CAM_CYCLE[i % len(CAM_CYCLE)]),
                "effects": [fx.get("type") for fx in (s.get("effects") or [])],
                "fusionNodes": ["MediaIn", "Transform(camera)",
                                "Caption(Text++Background+Rectangle+Merge+Transform)"
                                if s["caption"] else "(ingen caption)",
                                *[f"Effect:{fx.get('type')}" for fx in (s.get("effects") or [])],
                                "Reveal(Background+Blend)", "Merge", "MediaOut"],
                "hasMedia": bool(s["path"]) and os.path.isfile(s["path"]),
            }
            for i, s in enumerate(norm)
        ],
    }

    if dry_run:
        bridge.result({"dryRun": True, "plan": plan,
                       "note": "Ingen Resolve-kall i dry-run. Kjør uten dry_run med Resolve åpent for å bygge."})
        return

    missing = [s["path"] for s in norm if not (s["path"] and os.path.isfile(s["path"]))]
    if missing:
        bridge.warn(f"{len(missing)} scene-media finnes ikke på disk: {missing[:3]}")

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    pm = conn.project_manager
    project = conn.project
    # Opprett prosjekt hvis ingen er åpent
    if not project:
        try:
            project = pm.CreateProject(project_name) or pm.LoadProject(project_name)
            conn.project = project
            conn.media_pool = project.GetMediaPool() if project else None
        except Exception as exc:  # noqa: BLE001
            bridge.error(f"Kunne ikke opprette/åpne prosjekt: {exc}")
            return
    if not project:
        bridge.error("Ingen prosjekt åpent og kunne ikke opprette ett.")
        return

    media_pool = conn.media_pool or project.GetMediaPool()

    # 1) Timeline-settings FØR alt
    applied = _apply_timeline_settings(project, preset, fps, [])
    bridge.log(f"Timeline-config: {preset['width']}×{preset['height']} @{fps}fps "
               f"({sum(1 for v in applied.values() if v)}/{len(applied)} settings)")

    # 2) Importer media i egen bin
    root = media_pool.GetRootFolder()
    bin_name = "Post Agent Demo"
    demo_bin = None
    try:
        for sub in (root.GetSubFolderList() or []):
            if sub.GetName() == bin_name:
                demo_bin = sub
                break
        if not demo_bin:
            demo_bin = media_pool.AddSubFolder(root, bin_name)
        media_pool.SetCurrentFolder(demo_bin or root)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Bin-oppsett feilet, bruker rot: {exc}")

    paths = [s["path"] for s in norm if s["path"] and os.path.isfile(s["path"])]
    pool_items = []
    if paths:
        try:
            pool_items = media_pool.ImportMedia(paths) or []
        except Exception as exc:  # noqa: BLE001
            bridge.error(f"ImportMedia feilet: {exc}")
            return
    bridge.log(f"Importerte {len(pool_items)}/{len(paths)} media-filer")

    # map path → pool item (ImportMedia bevarer rekkefølge, men vær defensiv)
    by_name = {}
    for it in pool_items:
        try:
            by_name[os.path.basename(it.GetClipProperty("File Path") or it.GetName() or "")] = it
        except Exception:  # noqa: BLE001
            pass

    # 3) Lag tom timeline + append klipp med varighet
    try:
        timeline = media_pool.CreateEmptyTimeline(timeline_name)
        project.SetCurrentTimeline(timeline)
    except Exception as exc:  # noqa: BLE001
        bridge.error(f"Kunne ikke lage timeline: {exc}")
        return

    appended = 0
    for i, s in enumerate(norm):
        it = None
        if s["path"]:
            it = by_name.get(os.path.basename(s["path"]))
        if not it and i < len(pool_items):
            it = pool_items[i]
        if not it:
            continue
        dur_frames = max(2, int(round(s["durationSec"] * fps)))
        clip_info = {"mediaPoolItem": it, "startFrame": 0, "endFrame": dur_frames - 1}
        try:
            res = media_pool.AppendToTimeline([clip_info])
            if res:
                appended += 1
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"AppendToTimeline scene {i} feilet: {exc}")
    bridge.log(f"La {appended} klipp på timeline")

    if not conn.ensure_alive():
        return

    # 4) Bygg Fusion-graf per timeline-item
    try:
        items = timeline.GetItemListInTrack("video", 1) or []
    except Exception as exc:  # noqa: BLE001
        bridge.error(f"Kunne ikke hente timeline-items: {exc}")
        return

    scene_reports = []
    for i, ti in enumerate(items):
        scene = norm[i] if i < len(norm) else {"caption": "", "durationSec": 4.0, "cameraMove": "auto"}
        per_report = []
        try:
            cnt = ti.GetFusionCompCount()
            comp = ti.GetFusionCompByIndex(1) if cnt and cnt > 0 else ti.AddFusionComp()
        except Exception as exc:  # noqa: BLE001
            scene_reports.append({"scene": i, "error": f"comp-tilgang feilet: {exc}"})
            continue
        if not comp:
            scene_reports.append({"scene": i, "error": "ingen Fusion-comp"})
            continue
        try:
            comp.Lock()
        except Exception:  # noqa: BLE001
            pass
        dur_frames = max(2, int(round(float(scene.get("durationSec", 4.0)) * fps)))
        try:
            built = _build_scene_comp(comp, scene, i, len(items), fps, brand, dur_frames, per_report)
            built["warnings"] = per_report
            scene_reports.append(built)
        except Exception as exc:  # noqa: BLE001
            scene_reports.append({"scene": i, "error": str(exc), "warnings": per_report})
        finally:
            try:
                comp.Unlock()
            except Exception:  # noqa: BLE001
                pass
        bridge.progress(i + 1, len(items), f"Fusion-scene {i + 1}/{len(items)}")

    ok_scenes = sum(1 for r in scene_reports if not r.get("error"))
    bridge.log(f"Bygde Fusion-grafer på {ok_scenes}/{len(items)} scener")
    bridge.result({
        "platform": platform,
        "timelineName": timeline_name,
        "fps": fps,
        "resolution": f"{preset['width']}×{preset['height']}",
        "settingsApplied": applied,
        "mediaImported": len(pool_items),
        "clipsAppended": appended,
        "scenesBuilt": ok_scenes,
        "sceneReports": scene_reports,
        "nextStep": "Åpne Fusion-fanen på en klip for å finjustere, eller gå til Deliver for å rendre.",
    })


bridge.main_guard(run)

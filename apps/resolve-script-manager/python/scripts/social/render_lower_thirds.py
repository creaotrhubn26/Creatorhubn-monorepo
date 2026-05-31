"""Render Lower Thirds — eksporter transparent PNG per lower-third-item
slik at de kan importeres som titler i DaVinci Resolve.

Hver item rendres som en 1920×1080 PNG med full alpha-kanal, hvor
selve lower-third-en er plassert på riktig posisjon (bottom-left,
top-right etc.) og resten er transparent. Editor kan da:
  1. File → Import Media → velg PNG-mappen
  2. Dra PNG inn på en title-track over hovedvideoen
  3. Lengde + position kan endres i Inspector

Output via bridge.result():
  {
    "outputDir": "/path/to/out",
    "renderedCount": 5,
    "renderedFiles": [
      { "itemId": "lt-abc", "filename": "lt_abc_taler-navn.png",
        "path": "/full/path", "startTime": 12.4, "duration": 6.0 },
      ...
    ]
  }

Input params:
  items:       liste av LowerThirdItem-objekter (samme shape som UI'en)
  outputDir:   (optional) custom output-dir; default app_data/lower_thirds
  width:       (optional, default 1920) render-bredde
  height:      (optional, default 1080) render-høyde
"""

from __future__ import annotations

import os
import re
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _hex_to_rgba(color: str, opacity: float = 1.0) -> tuple[int, int, int, int]:
    """Parser hex/rgba/rgb-string til RGBA-tuple. Returnerer (0,0,0,0)
    for transparent eller for ukjente formater (inkl. gradients)."""
    if not color or not isinstance(color, str):
        return (0, 0, 0, 0)
    s = color.strip()
    if s == "transparent" or "gradient" in s:
        return (0, 0, 0, 0)
    if s.startswith("rgba"):
        # rgba(r, g, b, a)
        nums = re.findall(r"[\d.]+", s)
        if len(nums) >= 4:
            return (
                int(float(nums[0])),
                int(float(nums[1])),
                int(float(nums[2])),
                int(float(nums[3]) * 255 * opacity),
            )
    if s.startswith("rgb"):
        nums = re.findall(r"[\d.]+", s)
        if len(nums) >= 3:
            return (
                int(float(nums[0])),
                int(float(nums[1])),
                int(float(nums[2])),
                int(255 * opacity),
            )
    if s.startswith("#"):
        h = s.lstrip("#")
        if len(h) == 6:
            try:
                return (
                    int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16),
                    int(255 * opacity),
                )
            except ValueError: pass
        if len(h) == 8:
            try:
                return (
                    int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16),
                    int(int(h[6:8], 16) * opacity),
                )
            except ValueError: pass
    return (255, 255, 255, int(255 * opacity))


def _parse_gradient_fallback(color: str) -> tuple[int, int, int, int]:
    """Hvis bakgrunnen er en gradient, fall tilbake til den første
    fargen i gradient-en (PIL støtter ikke CSS-gradients direkte —
    full gradient-render krever ekstra arbeid, V2)."""
    if not color or "gradient" not in color:
        return (0, 0, 0, 0)
    # Match første hex eller rgba i gradient-strengen
    hex_match = re.search(r"#[0-9a-fA-F]{6,8}", color)
    if hex_match:
        return _hex_to_rgba(hex_match.group(0))
    rgba_match = re.search(r"rgba?\([^)]+\)", color)
    if rgba_match:
        return _hex_to_rgba(rgba_match.group(0))
    return (0, 0, 0, 200)  # subtil mørk fallback


def _resolve_background_color(bg: str, opacity: float) -> tuple[int, int, int, int]:
    """Returner RGBA for bakgrunnen. Gradients faller til første farge."""
    if not bg or bg == "transparent":
        return (0, 0, 0, 0)
    if "gradient" in bg:
        r, g, b, _a = _parse_gradient_fallback(bg)
        return (r, g, b, int(255 * opacity * 0.92))
    return _hex_to_rgba(bg, opacity)


def _calc_position(
    pos: str, item_w: int, item_h: int,
    canvas_w: int, canvas_h: int,
) -> tuple[int, int]:
    margin = int(min(canvas_w, canvas_h) * 0.05)  # 5% margin
    if pos == "bottom-left":   return (margin, canvas_h - item_h - margin)
    if pos == "bottom-center": return ((canvas_w - item_w) // 2, canvas_h - item_h - margin)
    if pos == "bottom-right":  return (canvas_w - item_w - margin, canvas_h - item_h - margin)
    if pos == "top-left":      return (margin, margin)
    if pos == "top-center":    return ((canvas_w - item_w) // 2, margin)
    if pos == "top-right":     return (canvas_w - item_w - margin, margin)
    if pos == "left-center":   return (margin, (canvas_h - item_h) // 2)
    if pos == "right-center":  return (canvas_w - item_w - margin, (canvas_h - item_h) // 2)
    # default: bottom-left
    return (margin, canvas_h - item_h - margin)


def _get_font(size_px: int, bold: bool = False) -> Any:
    """Forsøk å finne system-font på macOS/Linux."""
    from PIL import ImageFont
    candidates = []
    if bold:
        candidates += [
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
    candidates += [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Avenir.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for f in candidates:
        if os.path.isfile(f):
            try:
                return ImageFont.truetype(f, size_px)
            except (OSError, IOError): continue
    return ImageFont.load_default()


def _sanitize_filename(s: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9æøåÆØÅ_-]", "-", s.strip().lower())
    return re.sub(r"-+", "-", cleaned)[:50] or "untitled"


def _render_one(
    item: dict[str, Any],
    canvas_w: int, canvas_h: int,
    output_path: str,
) -> bool:
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        bridge.error("Pillow (PIL) ikke installert")
        return False

    try:
        style = item.get("style", {})
        title = str(item.get("title", "")).strip()
        subtitle = str(item.get("subtitle", "")).strip()
        position = str(item.get("position", "bottom-left"))

        width_pct = float(style.get("widthPercent", 38))
        font_size = int(style.get("fontSize", 26))
        sub_size = int(style.get("subtitleFontSize", 14))
        padding = int(style.get("padding", 14))
        border_radius = int(style.get("borderRadius", 4))
        accent_bar_w = int(style.get("accentBarWidth", 4))
        opacity = float(style.get("opacity", 1.0))

        bg_rgba = _resolve_background_color(style.get("background", ""), opacity)
        text_rgba = _hex_to_rgba(style.get("text", "#ffffff"), opacity)
        accent_rgba = _hex_to_rgba(style.get("accent", "#a030c0"), opacity)

        # Skaler font basert på canvas — UI'en bruker 16:9-container,
        # font_size er gitt for "natural" preview-størrelse. Vi skalerer
        # opp til faktisk canvas så det matcher 1920×1080-output.
        # UI-preview er typisk 800px bred; vi multipliserer med ratio.
        scale = canvas_w / 1280  # antar UI-preview er ~1280px
        if scale < 1: scale = 1
        font_size_px = int(font_size * scale)
        sub_size_px = int(sub_size * scale)
        padding_px = int(padding * scale)
        border_radius_px = int(border_radius * scale)
        accent_bar_w_px = int(accent_bar_w * scale)

        title_font = _get_font(font_size_px, bold=True)
        sub_font = _get_font(sub_size_px)

        # Mål tekst-størrelser
        canvas_img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas_img, "RGBA")

        item_w_max = int(canvas_w * (width_pct / 100))

        # Tekst-bredde med wrapping basert på item-bredde
        title_bbox = draw.textbbox((0, 0), title, font=title_font)
        title_w = title_bbox[2] - title_bbox[0]
        title_h = title_bbox[3] - title_bbox[1]

        sub_w = 0
        sub_h = 0
        if subtitle:
            sub_bbox = draw.textbbox((0, 0), subtitle, font=sub_font)
            sub_w = sub_bbox[2] - sub_bbox[0]
            sub_h = sub_bbox[3] - sub_bbox[1]

        text_block_w = max(title_w, sub_w)
        text_block_h = title_h + (sub_h + int(8 * scale) if subtitle else 0)

        item_w = min(item_w_max,
                     text_block_w + 2 * padding_px + accent_bar_w_px + int(8 * scale))
        item_h = text_block_h + 2 * padding_px

        # Posisjon på canvas
        item_x, item_y = _calc_position(position, item_w, item_h, canvas_w, canvas_h)

        # Tegne lower-third-card
        # Bakgrunn (rounded)
        if bg_rgba[3] > 0:
            if border_radius_px > 0:
                draw.rounded_rectangle(
                    [(item_x, item_y), (item_x + item_w, item_y + item_h)],
                    radius=border_radius_px, fill=bg_rgba,
                )
            else:
                draw.rectangle(
                    [(item_x, item_y), (item_x + item_w, item_y + item_h)],
                    fill=bg_rgba,
                )

        # Accent-linje (vertikal, venstre kant)
        if accent_bar_w_px > 0:
            draw.rectangle(
                [(item_x, item_y), (item_x + accent_bar_w_px, item_y + item_h)],
                fill=accent_rgba,
            )

        # Tekst-posisjon (inne i card etter padding + accent-bar)
        text_x = item_x + padding_px + accent_bar_w_px + (int(8 * scale)
                                                          if accent_bar_w_px > 0 else 0)
        text_y = item_y + padding_px

        draw.text((text_x, text_y), title, font=title_font, fill=text_rgba)
        if subtitle:
            sub_y = text_y + title_h + int(6 * scale)
            draw.text((text_x, sub_y), subtitle, font=sub_font, fill=accent_rgba)

        canvas_img.save(output_path, "PNG")
        return True
    except Exception as exc:
        bridge.warn(f"Render feilet for item: {exc}")
        return False


def run(params: dict[str, Any], dry_run: bool) -> None:
    items_raw = params.get("items") or []
    if not isinstance(items_raw, list) or len(items_raw) == 0:
        bridge.error("Ingen items å rendere")
        sys.exit(1)

    output_dir = (params.get("outputDir") or "").strip()
    if not output_dir:
        output_dir = os.path.expanduser(
            "~/Library/Application Support/"
            "no.creatorhubn.roleroom-post-agent/lower_thirds"
        )
    os.makedirs(output_dir, exist_ok=True)

    canvas_w = int(params.get("width") or 1920)
    canvas_h = int(params.get("height") or 1080)

    if dry_run:
        bridge.result({
            "wouldRender": len(items_raw),
            "outputDir": output_dir,
            "canvasSize": f"{canvas_w}×{canvas_h}",
        })
        return

    bridge.log(f"Renderer {len(items_raw)} lower-thirds til {output_dir} …")

    rendered = []
    for i, item in enumerate(items_raw):
        if not isinstance(item, dict):
            continue
        if not item.get("enabled", True):
            continue
        item_id = str(item.get("id", f"item_{i}"))
        title = str(item.get("title", "untitled"))
        # Filename: lt_<sanitized-id>_<sanitized-title>.png
        filename = f"lt_{_sanitize_filename(item_id)}_{_sanitize_filename(title)}.png"
        out_path = os.path.join(output_dir, filename)
        if _render_one(item, canvas_w, canvas_h, out_path):
            rendered.append({
                "itemId": item_id,
                "filename": filename,
                "path": out_path,
                "startTime": float(item.get("startTime", 0)),
                "duration": float(item.get("duration", 0)),
            })
            bridge.progress(i + 1, len(items_raw), f"Rendret {filename}")

    bridge.log(f"Ferdig: {len(rendered)} av {len(items_raw)} PNG-er")
    bridge.result({
        "outputDir": output_dir,
        "renderedCount": len(rendered),
        "renderedFiles": rendered,
        "canvasSize": f"{canvas_w}×{canvas_h}",
    })


bridge.main_guard(run)

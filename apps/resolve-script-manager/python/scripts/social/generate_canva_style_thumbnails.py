"""Generate Canva-Style Thumbnails — designede thumbnails for sosial feed.

I motsetning til "best face moment" (rå frame), genererer dette designede
thumbnails som en post i en feed: branded med klient-farger, text-overlay
med hook/CTA, logo i hjørnet — slik man ville designet i Canva.

6 layout-templates rotert per kall:
  1. Hero (stort bilde + caption-overlay bottom)
  2. Quote (bilde + sitat-overlay center med rule-of-thirds)
  3. Bold (CTA-text dominant + bilde som accent)
  4. Split (50/50 bilde + colored panel med text)
  5. Frame (bilde sentrert med thick border + text top/bottom)
  6. Gradient (full-bleed bilde + gradient + text bottom)

Hver kjøring genererer alle 6 + alternativ photo-frame per template
(totalt 6-12 kandidater). Bjarne velger en i Role Room som
customImageUrl på feed-post.

Input params:
  videoPath:       source-video for thumbnail-frames
  bestFrameSeconds: list[float] — timestamps å sample-fra (helst face-rich)
  outputDir:       hvor PNG-filer lagres
  postInfo:        { title, caption, callToAction, platform }
  brandSnapshot:   { companyName, accentColor, backgroundColor, textColor,
                     logoUrl, toneOfVoice }
  aspectRatio:     "1:1" (IG square) | "9:16" (Reels/Story/TikTok) | "4:5" (IG portrait feed)
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Default brand-colors hvis brand_snapshot mangler
DEFAULT_ACCENT = "#a030c0"
DEFAULT_BG = "#0a0518"
DEFAULT_TEXT = "#ffffff"

# Aspect-ratio → dimensions (Instagram-spec)
ASPECT_DIMS = {
    "1:1":  (1080, 1080),
    "9:16": (1080, 1920),
    "4:5":  (1080, 1350),
    "16:9": (1920, 1080),
}


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    """Konverter #aabbcc til (r, g, b). Fallback til midt-grå ved feil."""
    if not h or not isinstance(h, str): return (128, 128, 128)
    h = h.lstrip("#")
    if len(h) != 6: return (128, 128, 128)
    try:
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))  # type: ignore
    except ValueError:
        return (128, 128, 128)


def _extract_frame(ffmpeg: str, video_path: str, ts_sec: float,
                   out_path: str, width: int, height: int) -> bool:
    """Extract en frame ved gitt timestamp via ffmpeg, cropped/scaled
    til target-aspect."""
    aspect = width / height
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", str(ts_sec), "-i", video_path,
        "-vframes", "1",
        "-vf",
        # Scale + center-crop til ønsket aspect (face-aware-crop ville
        # vært ideelt, men det krever Detect People som Studio-feature)
        f"scale=if(gt(iw/ih\\,{aspect:.4f})\\,-1\\,{width})"
        f":if(gt(iw/ih\\,{aspect:.4f})\\,{height}\\,-1),"
        f"crop={width}:{height}:(iw-{width})/2:(ih-{height})/2",
        out_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        return r.returncode == 0 and os.path.isfile(out_path)
    except subprocess.TimeoutExpired:
        return False


def _wrap_text(text: str, max_chars: int) -> list[str]:
    """Wrap tekst til linjer med max-char per linje (ord-bevart)."""
    if not text: return []
    words = text.strip().split()
    lines = []
    current = []
    current_len = 0
    for w in words:
        if current_len + len(w) + 1 <= max_chars or not current:
            current.append(w)
            current_len += len(w) + 1
        else:
            lines.append(" ".join(current))
            current = [w]
            current_len = len(w)
    if current:
        lines.append(" ".join(current))
    return lines


def _generate_thumbnail(
    base_frame_path: str, layout: str,
    title: str, cta: str, brand_name: str,
    accent_rgb: tuple[int, int, int],
    text_rgb: tuple[int, int, int],
    bg_rgb: tuple[int, int, int],
    width: int, height: int,
    output_path: str,
) -> bool:
    """Lag en designet thumbnail via PIL med valgt layout-template."""
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageFilter
    except ImportError:
        bridge.error("Pillow (PIL) ikke installert — pip install Pillow")
        return False

    try:
        # Last frame
        frame = Image.open(base_frame_path).convert("RGB")
        canvas = Image.new("RGB", (width, height), bg_rgb)
        draw = ImageDraw.Draw(canvas, "RGBA")

        # Få font — prøv system-fonts, fallback til default
        def get_font(size: int, bold: bool = False) -> Any:
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
                    try: return ImageFont.truetype(f, size)
                    except (OSError, IOError): continue
            return ImageFont.load_default()

        # Layout-spesifikk komposisjon
        if layout == "hero":
            # Full-bleed bilde + dark gradient bottom + caption + CTA
            canvas.paste(frame.resize((width, height)), (0, 0))
            # Gradient overlay (bottom half mørkere)
            gradient = Image.new("RGBA", (width, height // 2), (0, 0, 0, 0))
            for y in range(height // 2):
                alpha = int(220 * (y / (height // 2)))
                ImageDraw.Draw(gradient).line([(0, y), (width, y)], fill=(0, 0, 0, alpha))
            canvas.paste(gradient, (0, height // 2), gradient)

            # Title bottom
            title_font = get_font(64, bold=True)
            cta_font = get_font(36)
            lines = _wrap_text(title, 28)[:3]
            y_pos = height - 120 - (len(lines) * 76)
            for line in lines:
                draw.text((60, y_pos), line, font=title_font, fill=text_rgb)
                y_pos += 76
            if cta:
                draw.text((60, height - 80), cta, font=cta_font, fill=accent_rgb)

        elif layout == "quote":
            # Bilde øverst, white panel nederst med sitat
            top_h = int(height * 0.55)
            canvas.paste(frame.resize((width, top_h)), (0, 0))
            # White panel
            panel = Image.new("RGB", (width, height - top_h), (250, 248, 246))
            canvas.paste(panel, (0, top_h))
            # Stor anførselstegn øverst i panel
            quote_font = get_font(96, bold=True)
            draw.text((60, top_h + 30), '"', font=quote_font, fill=accent_rgb)
            # Caption
            cap_font = get_font(44, bold=True)
            lines = _wrap_text(title, 24)[:4]
            y_pos = top_h + 100
            for line in lines:
                draw.text((60, y_pos), line, font=cap_font, fill=(20, 20, 30))
                y_pos += 56
            # Brand bottom
            brand_font = get_font(28)
            draw.text((60, height - 60), f"— {brand_name}".upper(), font=brand_font, fill=accent_rgb)

        elif layout == "bold":
            # Stor accent-colored panel + bilde som accent
            canvas = Image.new("RGB", (width, height), accent_rgb)
            # Bilde som band i midten
            band_h = int(height * 0.38)
            canvas.paste(frame.resize((width, band_h)), (0, height // 2 - band_h // 2))
            draw = ImageDraw.Draw(canvas, "RGBA")
            # Stor tekst top + bottom
            cta_font = get_font(72, bold=True)
            sub_font = get_font(32)
            # Top
            top_lines = _wrap_text(cta or title, 16)[:2]
            y_pos = 80
            for line in top_lines:
                draw.text((60, y_pos), line.upper(), font=cta_font, fill=(255, 255, 255))
                y_pos += 86
            # Bottom — title
            if cta and title and cta != title:
                title_lines = _wrap_text(title, 30)[:2]
                y_pos = height - 60 - (len(title_lines) * 42)
                for line in title_lines:
                    draw.text((60, y_pos), line, font=sub_font, fill=(255, 255, 255))
                    y_pos += 42

        elif layout == "split":
            # 50/50: bilde venstre, colored panel høyre
            half = width // 2
            canvas.paste(frame.resize((half, height)), (0, 0))
            # Right panel med brand-color
            panel = Image.new("RGB", (half, height), bg_rgb)
            canvas.paste(panel, (half, 0))
            draw = ImageDraw.Draw(canvas, "RGBA")
            # Tittel høyre side
            title_font = get_font(48, bold=True)
            lines = _wrap_text(title, 14)[:5]
            y_pos = height // 2 - (len(lines) * 30)
            for line in lines:
                draw.text((half + 50, y_pos), line, font=title_font, fill=text_rgb)
                y_pos += 60
            # CTA bottom
            if cta:
                cta_font = get_font(28)
                draw.text((half + 50, height - 70), cta.upper(), font=cta_font, fill=accent_rgb)

        elif layout == "frame":
            # Bilde sentrert med thick brand-border + text top/bottom
            border = 50
            canvas = Image.new("RGB", (width, height), bg_rgb)
            inner_w = width - 2 * border
            inner_h = height - 2 * border - 200
            canvas.paste(frame.resize((inner_w, inner_h)), (border, 130))
            draw = ImageDraw.Draw(canvas, "RGBA")
            # Title top
            title_font = get_font(56, bold=True)
            lines = _wrap_text(title, 26)[:2]
            y_pos = 30
            for line in lines:
                draw.text((border, y_pos), line, font=title_font, fill=text_rgb)
                y_pos += 64
            # CTA bottom right
            if cta:
                cta_font = get_font(34, bold=True)
                bbox = draw.textbbox((0, 0), cta.upper(), font=cta_font)
                cta_w = bbox[2] - bbox[0]
                # Accent-pill
                pill_x = width - border - cta_w - 32
                pill_y = height - 80
                draw.rounded_rectangle(
                    [(pill_x - 16, pill_y - 8), (pill_x + cta_w + 16, pill_y + 50)],
                    radius=24, fill=accent_rgb,
                )
                draw.text((pill_x, pill_y), cta.upper(), font=cta_font, fill=(255, 255, 255))

        elif layout == "gradient":
            # Full-bleed bilde med vertikal gradient + tekst bottom
            canvas.paste(frame.resize((width, height)), (0, 0))
            # Gradient (subtilt fra top mørk-trans til bottom helt mørkt)
            gradient = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            for y in range(height):
                alpha = int(40 + 200 * (y / height) ** 1.5)
                ImageDraw.Draw(gradient).line([(0, y), (width, y)],
                                              fill=(0, 0, 0, min(220, alpha)))
            canvas.paste(gradient, (0, 0), gradient)
            draw = ImageDraw.Draw(canvas, "RGBA")
            # Accent-bar nederst
            draw.rectangle([(0, height - 8), (width, height)], fill=accent_rgb)
            # Title bottom
            title_font = get_font(64, bold=True)
            lines = _wrap_text(title, 22)[:3]
            y_pos = height - 100 - (len(lines) * 72)
            for line in lines:
                draw.text((60, y_pos), line, font=title_font, fill=(255, 255, 255))
                y_pos += 72
            # Brand corner
            brand_font = get_font(24)
            draw.text((60, 50), brand_name.upper(), font=brand_font, fill=accent_rgb)

        else:
            # Fallback: full-bleed bilde + tittel sentrert med stroke
            canvas.paste(frame.resize((width, height)), (0, 0))
            title_font = get_font(72, bold=True)
            lines = _wrap_text(title, 20)[:3]
            y_pos = (height // 2) - (len(lines) * 40)
            for line in lines:
                bbox = draw.textbbox((0, 0), line, font=title_font)
                tw = bbox[2] - bbox[0]
                tx = (width - tw) // 2
                # Stroke
                for dx, dy in [(-3, 0), (3, 0), (0, -3), (0, 3)]:
                    draw.text((tx + dx, y_pos + dy), line, font=title_font, fill=(0, 0, 0))
                draw.text((tx, y_pos), line, font=title_font, fill=(255, 255, 255))
                y_pos += 80

        canvas.save(output_path, "PNG", optimize=True)
        return True

    except Exception as exc:
        bridge.warn(f"Layout '{layout}' feilet: {exc}")
        return False


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    best_frame_seconds = params.get("bestFrameSeconds") or []
    output_dir = (params.get("outputDir") or "").strip()
    post_info = params.get("postInfo") or {}
    brand_snapshot = params.get("brandSnapshot") or {}
    aspect_ratio = (params.get("aspectRatio") or "1:1").strip()

    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' mangler")
        sys.exit(1)
    if not output_dir:
        output_dir = os.path.expanduser(
            "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/thumbnails"
        )
    os.makedirs(output_dir, exist_ok=True)

    if not best_frame_seconds:
        # Fallback: ta frames jevnt fordelt over første 60s
        best_frame_seconds = [5.0, 12.0, 20.0, 28.0, 38.0, 50.0]

    dims = ASPECT_DIMS.get(aspect_ratio, ASPECT_DIMS["1:1"])
    width, height = dims

    title = str(post_info.get("title") or post_info.get("caption", "")[:60]).strip()
    cta = str(post_info.get("callToAction") or "").strip()
    brand_name = str(brand_snapshot.get("companyName") or "").strip() or "Studio"

    accent_rgb = _hex_to_rgb(brand_snapshot.get("accentColor") or DEFAULT_ACCENT)
    bg_rgb = _hex_to_rgb(brand_snapshot.get("backgroundColor") or DEFAULT_BG)
    text_rgb = _hex_to_rgb(brand_snapshot.get("textColor") or DEFAULT_TEXT)

    if dry_run:
        bridge.result({
            "wouldGenerate": 6,
            "dimensions": f"{width}×{height}",
            "title": title,
            "cta": cta,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet — kreves for å hente frames")
        sys.exit(1)

    # 1. Hent frames fra video
    bridge.log(f"Henter {len(best_frame_seconds)} frames fra source-video …")
    frame_paths = []
    with tempfile.TemporaryDirectory() as tmpdir:
        for i, ts in enumerate(best_frame_seconds[:6]):
            tmp_frame = os.path.join(tmpdir, f"frame_{i}.jpg")
            if _extract_frame(ffmpeg, video_path, float(ts), tmp_frame, width, height):
                # Kopier til output-dir så filen overlever tmpdir-cleanup
                kept = os.path.join(output_dir, f"_temp_frame_{i}.jpg")
                shutil.copy(tmp_frame, kept)
                frame_paths.append(kept)

        if not frame_paths:
            bridge.error("Kunne ikke hente frames")
            sys.exit(1)

        # 2. Generer 6 layouts (én per frame, rotert)
        layouts = ["hero", "quote", "bold", "split", "frame", "gradient"]
        generated = []
        for i, layout in enumerate(layouts):
            frame_idx = i % len(frame_paths)
            out_name = f"thumb_{layout}_{i+1}.png"
            out_path = os.path.join(output_dir, out_name)
            ok = _generate_thumbnail(
                frame_paths[frame_idx], layout,
                title, cta, brand_name,
                accent_rgb, text_rgb, bg_rgb,
                width, height, out_path,
            )
            if ok:
                generated.append({
                    "layout": layout,
                    "path": out_path,
                    "fileName": out_name,
                    "sourceFrameSec": best_frame_seconds[frame_idx],
                })
                bridge.progress(i + 1, len(layouts), f"Layout {layout}")

        # Cleanup temp frames
        for fp in frame_paths:
            try: os.unlink(fp)
            except OSError: pass

    bridge.log(f"Genererte {len(generated)} thumbnail-kandidater")

    bridge.result({
        "candidates": generated,
        "count": len(generated),
        "dimensions": f"{width}×{height}",
        "aspectRatio": aspect_ratio,
        "outputDir": output_dir,
        "brandName": brand_name,
    })


bridge.main_guard(run)

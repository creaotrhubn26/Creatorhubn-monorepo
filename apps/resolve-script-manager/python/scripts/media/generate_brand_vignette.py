"""Generate a brand vignette MP4 — logo fades in on black, holds, fades out.

Produces a 1920x1080 50fps h264 MP4 from a logo PNG (or any image):
black background, logo centered, fade-in (fadeSec) → hold → fade-out
(fadeSec). An optional tagline is rendered below the logo — via ffmpeg
`drawtext` when the local ffmpeg was built with libfreetype, otherwise the
text is burned onto a transparent Pillow PNG and composited as an overlay.

Registry id: generate_brand_vignette
Params:
    logoPath     (str, required) — path to a logo image (PNG/alpha ok).
    outPath      (str, optional) — output MP4 path. Default:
                 ~/Library/Application Support/no.creatorhubn.roleroom-post-agent/brand/vignette.mp4
    durationSec  (number, optional, default 7) — total clip length.
    tagline      (str, optional) — text rendered under the logo.
    fadeSec      (number, optional, default 1.2) — fade-in / fade-out length.

Result: { vignettePath, durationSec }

Why both drawtext and Pillow: the Homebrew ffmpeg shipped on the dev/build
machines was compiled WITHOUT --enable-libfreetype, so `drawtext` is missing.
We probe for it at runtime and fall back to a Pillow-rendered overlay so the
tagline always lands regardless of the ffmpeg build. Pillow ships in the
default Python 3.14 that Tauri uses, so no venv re-exec is needed here.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

WIDTH = 1920
HEIGHT = 1080
FPS = 50

DEFAULT_OUT = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/brand/vignette.mp4"
)

# Candidate fonts on macOS for the tagline (drawtext + Pillow).
FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
)


def _find_font() -> str | None:
    for path in FONT_CANDIDATES:
        if os.path.isfile(path):
            return path
    return None


def _ffmpeg_has_drawtext(ffmpeg: str) -> bool:
    """True only if this ffmpeg build exposes the drawtext filter."""
    try:
        out = subprocess.run(
            [ffmpeg, "-hide_banner", "-filters"],
            capture_output=True, text=True, timeout=15,
        )
        return any(
            line.split()[1] == "drawtext"
            for line in out.stdout.splitlines()
            if len(line.split()) >= 2
        )
    except (subprocess.SubprocessError, OSError):
        return False


def _build_tagline_png(tagline: str, font_path: str | None, out_png: str) -> bool:
    """Render the tagline onto a transparent 1920x1080 RGBA PNG via Pillow.

    Centered horizontally, positioned below where the logo sits, with a
    dark stroke + soft shadow for legibility on bright logos. Returns True
    on success.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False

    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    font_size = 56
    font = None
    if font_path:
        try:
            font = ImageFont.truetype(font_path, font_size)
        except OSError:
            font = None
    if font is None:
        font = ImageFont.load_default()

    try:
        bbox = draw.textbbox((0, 0), tagline, font=font, stroke_width=2)
    except TypeError:  # very old Pillow without stroke kwarg
        bbox = draw.textbbox((0, 0), tagline, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    x = (WIDTH - text_w) / 2 - bbox[0]
    # Logo is centered; place tagline in the lower third, below the logo.
    y = HEIGHT * 0.66 - text_h / 2 - bbox[1]

    # Soft drop shadow for depth.
    shadow = (0, 0, 0, 170)
    for dx, dy in ((2, 2), (3, 3)):
        try:
            draw.text((x + dx, y + dy), tagline, font=font, fill=shadow,
                      stroke_width=2, stroke_fill=shadow)
        except TypeError:
            draw.text((x + dx, y + dy), tagline, font=font, fill=shadow)

    try:
        draw.text((x, y), tagline, font=font, fill=(255, 255, 255, 255),
                  stroke_width=2, stroke_fill=(0, 0, 0, 200))
    except TypeError:
        draw.text((x, y), tagline, font=font, fill=(255, 255, 255, 255))

    try:
        canvas.save(out_png)
        return True
    except OSError:
        return False


def run(params: dict, dry_run: bool) -> None:
    logo_path = params.get("logoPath")
    if not logo_path:
        bridge.error("Missing required input: logoPath")
        sys.exit(1)
    logo_path = os.path.expanduser(logo_path)
    if not os.path.isfile(logo_path):
        bridge.error(f"Logo file does not exist: {logo_path}")
        sys.exit(1)

    out_path = os.path.expanduser(params.get("outPath") or DEFAULT_OUT)

    try:
        duration = float(params.get("durationSec", 7) or 7)
    except (TypeError, ValueError):
        duration = 7.0
    duration = max(2.0, duration)

    try:
        fade = float(params.get("fadeSec", 1.2) or 1.2)
    except (TypeError, ValueError):
        fade = 1.2
    # Fade-in + fade-out must fit inside the clip with hold time left over.
    fade = max(0.2, min(fade, (duration - 0.4) / 2.0))

    tagline = (params.get("tagline") or "").strip()

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        bridge.error("ffmpeg not found on PATH (try: brew install ffmpeg)")
        sys.exit(1)

    fade_out_start = max(0.0, duration - fade)

    if dry_run:
        bridge.result({
            "summary": (
                f"Dry run — would render {duration:.1f}s {WIDTH}x{HEIGHT} {FPS}fps "
                f"vignette from {os.path.basename(logo_path)}"
                + (f" + tagline '{tagline}'" if tagline else "")
            ),
            "vignettePath": out_path,
            "durationSec": duration,
            "fadeSec": fade,
            "ffmpeg": ffmpeg,
        })
        return

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    if not bridge.check_disk_space(os.path.dirname(out_path) or ".", required_gb=0.5):
        sys.exit(1)

    has_drawtext = tagline and _ffmpeg_has_drawtext(ffmpeg)
    font_path = _find_font()

    bridge.progress(0, 3, "Preparing")

    # Optional Pillow overlay PNG (used only when drawtext is unavailable).
    overlay_png: str | None = None
    if tagline and not has_drawtext:
        bridge.log("ffmpeg has no drawtext filter — rendering tagline overlay with Pillow")
        try:
            from PIL import Image  # noqa: F401
        except ImportError:
            bridge.warn("Pillow not installed — vignette will render WITHOUT the tagline")
        else:
            fd, overlay_png = tempfile.mkstemp(suffix="_tagline.png")
            os.close(fd)
            if not _build_tagline_png(tagline, font_path, overlay_png):
                bridge.warn("Could not render tagline PNG — proceeding without tagline")
                try:
                    os.unlink(overlay_png)
                except OSError:
                    pass
                overlay_png = None

    bridge.progress(1, 3, "Encoding")

    # ── Build the filtergraph ────────────────────────────────────────────
    # Input 0: black color source (the canvas).
    # Input 1: the logo image (looped to the full duration).
    # Optional input 2: the Pillow tagline overlay PNG.
    #
    # The logo is flattened onto black first (so logos with alpha don't show
    # transparency artefacts), scaled to fit within ~55% of the frame, then
    # overlaid centered. fade in/out is applied to the composited result.
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", f"color=c=black:s={WIDTH}x{HEIGHT}:r={FPS}:d={duration:.3f}",
        "-loop", "1", "-i", logo_path,
    ]
    if overlay_png:
        cmd += ["-loop", "1", "-i", overlay_png]

    logo_scale = (
        f"[1:v]format=rgba,"
        f"scale='min(iw,{int(WIDTH * 0.55)})':'min(ih,{int(HEIGHT * 0.45)})'"
        f":force_original_aspect_ratio=decrease[logo];"
    )
    # Center the logo slightly above middle to leave room for the tagline.
    composite = "[0:v][logo]overlay=(W-w)/2:(H-h)/2-60[comp];"

    filter_parts = [logo_scale, composite]
    last_label = "comp"

    if overlay_png:
        filter_parts.append("[comp][2:v]overlay=0:0[withtext];")
        last_label = "withtext"
    elif has_drawtext and font_path:
        # Escape characters that are special inside drawtext's text= value.
        safe = (
            tagline.replace("\\", "\\\\")
            .replace(":", "\\:")
            .replace("'", "\\'")
            .replace("%", "\\%")
        )
        font_esc = font_path.replace(":", "\\:")
        filter_parts.append(
            f"[comp]drawtext=fontfile='{font_esc}':text='{safe}':"
            f"fontcolor=white:fontsize=56:borderw=2:bordercolor=black@0.8:"
            f"shadowcolor=black@0.6:shadowx=2:shadowy=2:"
            f"x=(w-text_w)/2:y=h*0.66-text_h/2[withtext];"
        )
        last_label = "withtext"

    fade_filter = (
        f"[{last_label}]"
        f"fade=t=in:st=0:d={fade:.3f},"
        f"fade=t=out:st={fade_out_start:.3f}:d={fade:.3f},"
        f"format=yuv420p[outv]"
    )
    filter_parts.append(fade_filter)
    filter_complex = "".join(filter_parts)

    cmd += [
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-t", f"{duration:.3f}",
        "-r", str(FPS),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-preset", "medium",
        "-crf", "18",
        "-movflags", "+faststart",
        out_path,
    ]

    bridge.log(f"Rendering brand vignette → {out_path}")
    proc = subprocess.run(cmd, capture_output=True, text=True)

    if overlay_png:
        try:
            os.unlink(overlay_png)
        except OSError:
            pass

    if proc.returncode != 0 or not os.path.isfile(out_path):
        bridge.error(f"ffmpeg failed: {proc.stderr[:400]}")
        sys.exit(1)

    bridge.progress(3, 3, "Done")
    bridge.result({
        "vignettePath": out_path,
        "durationSec": duration,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

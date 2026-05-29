"""Export Multi-Aspect — render en ferdig video i alle 4 vanlige
aspect-ratios (16:9, 9:16, 1:1, 4:5) i én operasjon. Foundation for
cross-posting til YouTube + Reels/TikTok + IG Feed + IG Portrait.

Strategi:
  1. For 16:9: behold source (eller pad black-bars hvis source er smalere)
  2. For 9:16: smart-crop midt (eller bruk face-aware-center hvis
     OpenCV er installert) til 1080×1920
  3. For 1:1: center-crop til 1080×1080
  4. For 4:5: center-crop til 1080×1350

Output via bridge.result():
  {
    "outputDir": "/path/to/out",
    "renderedCount": 4,
    "renders": [
      { "aspect": "16:9", "path": "/full/path.mp4", "sizeMB": 12.4 },
      ...
    ]
  }

Input params:
  videoPath:     source-video som skal eksporteres
  outputDir:     (optional) custom output-dir
  aspects:       (optional) array av aspects å rendere
                 (default ["16:9", "9:16", "1:1", "4:5"])
  fileNamePrefix: (optional) prefix for filnavn (default "export")
  bitrate:       (optional, default 8M) video-bitrate
  faceAware:     (optional, default true) bruk face-detect for crop hvis OpenCV
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


ASPECT_DIMS = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1":  (1080, 1080),
    "4:5":  (1080, 1350),
    "16:9_youtube_thumbnail": (1920, 1080),
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


def _get_video_dimensions(ffmpeg: str, video_path: str) -> tuple[int, int] | None:
    """Hent source-video dimensjoner via ffprobe (eller ffmpeg pseudo-probe)."""
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    if os.path.isfile(ffprobe):
        try:
            r = subprocess.run([
                ffprobe, "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=p=0", video_path,
            ], capture_output=True, text=True, timeout=20)
            if r.returncode == 0:
                parts = r.stdout.strip().split(",")
                if len(parts) >= 2:
                    return (int(parts[0]), int(parts[1]))
        except (subprocess.TimeoutExpired, ValueError): pass

    # Fallback: parse fra ffmpeg
    try:
        r = subprocess.run(
            [ffmpeg, "-i", video_path, "-f", "null", "-"],
            capture_output=True, text=True, timeout=20,
        )
        for line in r.stderr.split("\n"):
            if "Stream" in line and "Video:" in line:
                # Match e.g. "1920x1080"
                import re
                m = re.search(r"(\d{2,5})x(\d{2,5})", line)
                if m: return (int(m.group(1)), int(m.group(2)))
    except subprocess.TimeoutExpired: pass
    return None


def _detect_face_center(ffmpeg: str, video_path: str) -> tuple[float, float] | None:
    """Hent et mid-frame og kjør OpenCV face-detect for å finne face-center.
    Returnerer (x_frac, y_frac) i 0-1, eller None hvis ingen ansikt funnet
    eller OpenCV ikke installert."""
    try:
        import cv2  # type: ignore
    except ImportError:
        return None
    try:
        # Hent frame midt i videoen via ffmpeg
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            mid_frame = os.path.join(tmpdir, "mid.jpg")
            # Hent frame ved 50%
            subprocess.run([
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                "-ss", "10", "-i", video_path, "-vframes", "1", mid_frame,
            ], capture_output=True, timeout=20)
            if not os.path.isfile(mid_frame):
                return None
            img = cv2.imread(mid_frame)
            if img is None: return None
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
            faces = cascade.detectMultiScale(gray, 1.2, 5, minSize=(60, 60))
            if len(faces) == 0: return None
            # Velg største ansikt
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            cx = (x + w / 2) / img.shape[1]
            cy = (y + h / 2) / img.shape[0]
            return (cx, cy)
    except Exception as exc:
        bridge.warn(f"Face-detect feilet: {exc}")
        return None


def _render_aspect(
    ffmpeg: str, src_path: str, out_path: str,
    src_w: int, src_h: int,
    target_w: int, target_h: int,
    bitrate: str,
    face_center: tuple[float, float] | None = None,
) -> bool:
    """Render én aspect via ffmpeg crop + scale. Face-aware crop hvis
    face_center er gitt og target-aspect avviker fra source."""
    src_aspect = src_w / src_h
    tgt_aspect = target_w / target_h

    # Beregn crop-rektangel
    if abs(src_aspect - tgt_aspect) < 0.01:
        # Source matcher target — bare scale
        vf = f"scale={target_w}:{target_h}"
    elif src_aspect > tgt_aspect:
        # Source er bredere — crop horisontalt
        crop_h = src_h
        crop_w = int(src_h * tgt_aspect)
        if face_center:
            face_x = int(face_center[0] * src_w)
            left = max(0, min(src_w - crop_w, face_x - crop_w // 2))
        else:
            left = (src_w - crop_w) // 2
        vf = (f"crop={crop_w}:{crop_h}:{left}:0,"
              f"scale={target_w}:{target_h}")
    else:
        # Source er smalere — crop vertikalt
        crop_w = src_w
        crop_h = int(src_w / tgt_aspect)
        if face_center:
            face_y = int(face_center[1] * src_h)
            top = max(0, min(src_h - crop_h, face_y - crop_h // 2))
        else:
            top = (src_h - crop_h) // 2
        vf = (f"crop={crop_w}:{crop_h}:0:{top},"
              f"scale={target_w}:{target_h}")

    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "warning",
        "-i", src_path,
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-b:v", bitrate,
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        out_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if r.returncode == 0 and os.path.isfile(out_path):
            return True
        bridge.warn(f"Render feilet for {target_w}×{target_h}: {r.stderr[-300:]}")
        return False
    except subprocess.TimeoutExpired:
        bridge.warn(f"Render timeout for {target_w}×{target_h}")
        return False


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' mangler")
        sys.exit(1)

    output_dir = (params.get("outputDir") or "").strip()
    if not output_dir:
        output_dir = os.path.expanduser(
            "~/Library/Application Support/"
            "no.creatorhubn.roleroom-post-agent/multi_aspect_exports"
        )
    os.makedirs(output_dir, exist_ok=True)

    aspects_raw = params.get("aspects") or ["16:9", "9:16", "1:1", "4:5"]
    aspects = [a for a in aspects_raw if a in ASPECT_DIMS]
    if not aspects:
        bridge.error("Ingen gyldige aspects")
        sys.exit(1)

    file_name_prefix = str(params.get("fileNamePrefix") or "export")
    bitrate = str(params.get("bitrate") or "8M")
    face_aware = bool(params.get("faceAware", True))

    if dry_run:
        bridge.result({
            "wouldRender": aspects,
            "outputDir": output_dir,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    src_dims = _get_video_dimensions(ffmpeg, video_path)
    if not src_dims:
        bridge.error("Kunne ikke lese source-dimensjoner")
        sys.exit(1)
    src_w, src_h = src_dims
    bridge.log(f"Source: {src_w}×{src_h} · target aspects: {aspects}")

    face_center = None
    if face_aware:
        face_center = _detect_face_center(ffmpeg, video_path)
        if face_center:
            bridge.log(
                f"Face-center detektert: ({face_center[0]:.2f}, {face_center[1]:.2f})"
            )
        else:
            bridge.log("Ingen ansikt funnet — bruker center-crop")

    renders = []
    for i, aspect in enumerate(aspects):
        target_w, target_h = ASPECT_DIMS[aspect]
        safe_aspect = aspect.replace(":", "x").replace("_", "-")
        out_filename = f"{file_name_prefix}_{safe_aspect}_{target_w}x{target_h}.mp4"
        out_path = os.path.join(output_dir, out_filename)

        bridge.progress(i, len(aspects), f"Rendering {aspect} ({target_w}×{target_h})")

        if _render_aspect(
            ffmpeg, video_path, out_path,
            src_w, src_h, target_w, target_h, bitrate, face_center,
        ):
            try:
                size_mb = os.path.getsize(out_path) / (1024 * 1024)
            except OSError: size_mb = 0
            renders.append({
                "aspect": aspect,
                "path": out_path,
                "filename": out_filename,
                "sizeMB": round(size_mb, 1),
                "dimensions": f"{target_w}×{target_h}",
            })

    bridge.log(f"Ferdig: {len(renders)} av {len(aspects)} renders")
    bridge.result({
        "outputDir": output_dir,
        "renderedCount": len(renders),
        "renders": renders,
        "sourceDimensions": f"{src_w}×{src_h}",
        "faceAwareUsed": face_center is not None,
    })


bridge.main_guard(run)

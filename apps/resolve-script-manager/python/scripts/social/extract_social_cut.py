"""Extract Social Cut — render én social-cut fra source-video med
vertikal crop, optional captions-burn, og thumbnail.

Brukes av SocialCutsStudio for å materialiserer transkript-baserte
standout-moments som faktiske MP4-filer klare for upload.

Strategi:
  1. Trim source mellom startSec og endSec
  2. Face-aware vertikal crop til 1080×1920 (eller annen aspect)
  3. Optional captions-burn (SRT-fil rendret som drawtext overlay)
  4. Thumbnail-extract fra midten av cuten

Output via bridge.result():
  {
    "outputPath": "/path/cut.mp4",
    "thumbnailPath": "/path/thumb.jpg",
    "durationSec": 32.5,
    "sizeMB": 12.4,
    "captionsBurnt": true,
    "aspectRatio": "9:16",
    "sourceSegment": [124.3, 156.8]
  }
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


ASPECT_DIMS = {
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
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


def _detect_face_center(
    ffmpeg: str, video_path: str, mid_sec: float,
) -> tuple[float, float] | None:
    """Hent face-center fra mid-frame, returner (x_frac, y_frac) 0-1."""
    try:
        import cv2  # type: ignore
    except ImportError:
        return None
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            mid_frame = os.path.join(tmpdir, "mid.jpg")
            subprocess.run([
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                "-ss", str(mid_sec), "-i", video_path,
                "-vframes", "1", mid_frame,
            ], capture_output=True, timeout=20)
            if not os.path.isfile(mid_frame): return None
            img = cv2.imread(mid_frame)
            if img is None: return None
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
            faces = cascade.detectMultiScale(gray, 1.2, 5, minSize=(60, 60))
            if len(faces) == 0: return None
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            cx = (x + w / 2) / img.shape[1]
            cy = (y + h / 2) / img.shape[0]
            return (cx, cy)
    except Exception as exc:
        bridge.warn(f"Face-detect feilet: {exc}")
        return None


def _build_srt_from_segments(
    segments: list[dict[str, Any]],
    cut_start_sec: float, cut_end_sec: float,
    out_srt: str,
) -> bool:
    """Bygg SRT-fil med transcript-segmenter som faller innenfor cut-
    vinduet, re-baseret til cut-relative tidsstempler."""
    relevant: list[dict[str, Any]] = []
    for seg in segments:
        s_start = float(seg.get("start", 0))
        s_end = float(seg.get("end", 0))
        if s_end <= cut_start_sec or s_start >= cut_end_sec:
            continue
        # Klip segment til cut-bounds
        rel_start = max(0, s_start - cut_start_sec)
        rel_end = min(cut_end_sec - cut_start_sec, s_end - cut_start_sec)
        if rel_end <= rel_start:
            continue
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        relevant.append({
            "start": rel_start, "end": rel_end, "text": text,
        })

    if not relevant:
        return False

    lines = []
    for i, seg in enumerate(relevant):
        lines.append(str(i + 1))
        lines.append(f"{_fmt_srt_time(seg['start'])} --> {_fmt_srt_time(seg['end'])}")
        lines.append(seg["text"])
        lines.append("")

    try:
        with open(out_srt, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return True
    except OSError:
        return False


def _fmt_srt_time(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int((sec % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _build_crop_filter(
    src_w: int, src_h: int,
    target_w: int, target_h: int,
    face_center: tuple[float, float] | None,
) -> str:
    """Bygg ffmpeg crop+scale-filter for å transformere source til target."""
    src_aspect = src_w / src_h
    tgt_aspect = target_w / target_h

    if abs(src_aspect - tgt_aspect) < 0.01:
        return f"scale={target_w}:{target_h}"

    if src_aspect > tgt_aspect:
        # Source bredere — crop horisontalt
        crop_h = src_h
        crop_w = int(src_h * tgt_aspect)
        if face_center:
            face_x = int(face_center[0] * src_w)
            left = max(0, min(src_w - crop_w, face_x - crop_w // 2))
        else:
            left = (src_w - crop_w) // 2
        return f"crop={crop_w}:{crop_h}:{left}:0,scale={target_w}:{target_h}"
    else:
        # Source smalere — crop vertikalt
        crop_w = src_w
        crop_h = int(src_w / tgt_aspect)
        if face_center:
            face_y = int(face_center[1] * src_h)
            top = max(0, min(src_h - crop_h, face_y - crop_h // 2))
        else:
            top = (src_h - crop_h) // 2
        return f"crop={crop_w}:{crop_h}:0:{top},scale={target_w}:{target_h}"


def _get_video_dimensions(ffmpeg: str, video_path: str) -> tuple[int, int] | None:
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
        except (ValueError, subprocess.TimeoutExpired): pass
    return None


def _escape_path_for_filter(path: str) -> str:
    """Escape spesialtegn for ffmpeg filter_complex."""
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    start_sec = float(params.get("startSec") or 0)
    end_sec = float(params.get("endSec") or 0)
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' mangler")
        sys.exit(1)
    if end_sec <= start_sec:
        bridge.error("endSec må være > startSec")
        sys.exit(1)

    aspect = (params.get("aspectRatio") or "9:16").strip()
    if aspect not in ASPECT_DIMS:
        bridge.error(f"ugyldig aspectRatio '{aspect}'")
        sys.exit(1)
    target_w, target_h = ASPECT_DIMS[aspect]

    burn_captions = bool(params.get("burnCaptions", False))
    segments = params.get("transcriptSegments") or []
    face_aware = bool(params.get("faceAware", True))

    output_dir = (params.get("outputDir") or "").strip()
    if not output_dir:
        output_dir = os.path.expanduser(
            "~/Library/Application Support/"
            "no.creatorhubn.roleroom-post-agent/social_cuts"
        )
    os.makedirs(output_dir, exist_ok=True)

    file_name_safe = re.sub(r"[^a-zA-Z0-9_-]", "_",
                             os.path.basename(video_path))[:40]
    out_filename = f"cut_{file_name_safe}_{int(start_sec)}-{int(end_sec)}_{aspect.replace(':', 'x')}.mp4"
    out_path = os.path.join(output_dir, out_filename)
    thumb_filename = out_filename.replace(".mp4", ".jpg")
    thumb_path = os.path.join(output_dir, thumb_filename)

    if dry_run:
        bridge.result({
            "wouldExtract": out_path,
            "aspect": aspect,
            "burnCaptions": burn_captions,
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

    face_center = None
    if face_aware:
        mid_sec = (start_sec + end_sec) / 2
        face_center = _detect_face_center(ffmpeg, video_path, mid_sec)
        if face_center:
            bridge.log(
                f"Face-center: ({face_center[0]:.2f}, {face_center[1]:.2f})"
            )

    crop_filter = _build_crop_filter(
        src_w, src_h, target_w, target_h, face_center,
    )
    bridge.log(f"Crop-filter: {crop_filter}")

    # Bygg SRT hvis vi skal burn captions
    srt_path: str | None = None
    if burn_captions and isinstance(segments, list) and len(segments) > 0:
        with tempfile.TemporaryDirectory() as tmpdir_for_srt:
            tmp_srt = os.path.join(tmpdir_for_srt, "captions.srt")
            if _build_srt_from_segments(segments, start_sec, end_sec, tmp_srt):
                # Kopier SRT til output_dir så vi kan referere senere
                final_srt = out_path.replace(".mp4", ".srt")
                shutil.copy(tmp_srt, final_srt)
                srt_path = final_srt
            else:
                bridge.warn("Ingen relevante captions for denne cuten — skipping burn")
                burn_captions = False

    # Bygg ffmpeg-command
    duration = end_sec - start_sec
    vf = crop_filter
    if burn_captions and srt_path:
        # subtitles-filter med custom styling
        vf += (
            f",subtitles='{_escape_path_for_filter(srt_path)}':"
            f"force_style='FontName=Helvetica,FontSize=10,"
            f"PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,"
            f"BorderStyle=1,Outline=1,Shadow=0,Alignment=2,MarginV=80'"
        )

    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "warning",
        "-ss", str(start_sec), "-i", video_path,
        "-t", str(duration),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        out_path,
    ]
    bridge.log(f"Rendrer cut {start_sec:.1f}-{end_sec:.1f}s ({duration:.1f}s)")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            bridge.error(f"Cut-render feilet: {r.stderr[-500:]}")
            sys.exit(1)
    except subprocess.TimeoutExpired:
        bridge.error("Cut-render timeout (10 min)")
        sys.exit(1)

    # Thumbnail fra mid-time av cuten
    thumb_time = duration / 2
    try:
        subprocess.run([
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", str(thumb_time), "-i", out_path,
            "-vframes", "1",
            "-vf", "scale='min(640,iw)':-2",
            thumb_path,
        ], capture_output=True, timeout=30)
    except subprocess.TimeoutExpired:
        bridge.warn("Thumbnail-extract timeout")

    try:
        size_mb = os.path.getsize(out_path) / (1024 * 1024)
    except OSError:
        size_mb = 0

    bridge.log(f"Ferdig: {out_path} ({size_mb:.1f} MB)")
    bridge.result({
        "outputPath": out_path,
        "thumbnailPath": thumb_path if os.path.isfile(thumb_path) else None,
        "durationSec": round(duration, 2),
        "sizeMB": round(size_mb, 1),
        "captionsBurnt": burn_captions and srt_path is not None,
        "aspectRatio": aspect,
        "sourceSegment": [round(start_sec, 2), round(end_sec, 2)],
        "srtPath": srt_path,
    })


bridge.main_guard(run)

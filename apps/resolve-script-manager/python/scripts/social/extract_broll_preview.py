"""Extract B-roll Preview — generér kort MP4-preview og thumbnail-PNG
for hover-preview i B-roll Library-UI.

Output:
  - Preview MP4: 3 sek av klippet starting at mid-frame, 480px wide,
    h264 baseline, 1Mbps — kjapt å starte i hover-state
  - Thumbnail PNG: én frame ved mid-time, 320px wide, fast load

Begge cache'es i app_data/broll_previews/ med klipp-hash som filnavn.

Input params:
  videoPath:  source-klipp
  outputDir:  (optional) hvor preview-filene skal lagres
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


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


def _get_duration(ffmpeg: str, video_path: str) -> float:
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    if os.path.isfile(ffprobe):
        try:
            r = subprocess.run([
                ffprobe, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "csv=p=0", video_path,
            ], capture_output=True, text=True, timeout=20)
            if r.returncode == 0:
                return float(r.stdout.strip() or 0)
        except (ValueError, subprocess.TimeoutExpired): pass
    return 0.0


def _path_hash(video_path: str) -> str:
    return hashlib.sha256(video_path.encode("utf-8")).hexdigest()[:16]


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' mangler")
        sys.exit(1)

    output_dir = (params.get("outputDir") or "").strip()
    if not output_dir:
        output_dir = os.path.expanduser(
            "~/Library/Application Support/"
            "no.creatorhubn.roleroom-post-agent/broll_previews"
        )
    os.makedirs(output_dir, exist_ok=True)

    if dry_run:
        bridge.result({
            "wouldGenerate": video_path, "outputDir": output_dir,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    h = _path_hash(video_path)
    duration = _get_duration(ffmpeg, video_path)
    if duration <= 0:
        bridge.error("Kunne ikke lese duration")
        sys.exit(1)

    # Preview: 3 sek startende fra 20% inn (eller midten hvis veldig kort)
    preview_start = max(0, min(duration * 0.2, duration - 3))
    preview_duration = min(3.0, max(0.5, duration - preview_start))

    preview_mp4 = os.path.join(output_dir, f"preview_{h}.mp4")
    cmd_preview = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", str(preview_start), "-i", video_path,
        "-t", str(preview_duration),
        "-vf", "scale='min(480,iw)':-2:flags=lanczos",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
        "-profile:v", "baseline", "-pix_fmt", "yuv420p",
        "-b:v", "1M", "-maxrate", "1.5M", "-bufsize", "2M",
        "-an",  # no audio for preview
        "-movflags", "+faststart",
        preview_mp4,
    ]
    try:
        r = subprocess.run(cmd_preview, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            bridge.warn(f"Preview-MP4 feilet: {r.stderr[-200:]}")
    except subprocess.TimeoutExpired:
        bridge.warn("Preview-MP4 timeout")

    # Thumbnail: én frame fra midten
    mid = duration / 2
    thumbnail_png = os.path.join(output_dir, f"thumb_{h}.png")
    cmd_thumb = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", str(mid), "-i", video_path,
        "-vframes", "1",
        "-vf", "scale='min(320,iw)':-2:flags=lanczos",
        thumbnail_png,
    ]
    try:
        subprocess.run(cmd_thumb, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        bridge.warn("Thumbnail-PNG timeout")

    preview_exists = os.path.isfile(preview_mp4)
    thumb_exists = os.path.isfile(thumbnail_png)

    bridge.log(
        f"Preview: {'OK' if preview_exists else 'FEIL'}, "
        f"Thumb: {'OK' if thumb_exists else 'FEIL'}"
    )
    bridge.result({
        "previewVideoPath": preview_mp4 if preview_exists else None,
        "previewThumbnailPath": thumbnail_png if thumb_exists else None,
        "durationSec": round(duration, 1),
    })


bridge.main_guard(run)

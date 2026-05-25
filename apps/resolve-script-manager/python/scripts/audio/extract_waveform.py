"""Extract Waveform — renders ffmpeg showwavespic PNGs for audio segments.

Used by Retake Detection UI to render waveform previews side-by-side.

Params:
  audioPath:     source audio file (long recording)
  segments:      [{takeId, startSeconds, endSeconds}, ...] from detect_retakes
  width:         PNG width in pixels (default 600)
  height:        PNG height in pixels (default 80)
  outputDir:     where PNGs land (default: app data dir thumbnails/waveforms)

Returns paths to per-segment PNGs.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def find_ffmpeg() -> str | None:
    for candidate in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def render_segment(ffmpeg: str, audio_path: str, start: float, end: float,
                    out_path: str, width: int, height: int) -> bool:
    duration = max(0.1, end - start)
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-ss", f"{start:.3f}",
        "-t", f"{duration:.3f}",
        "-i", audio_path,
        "-filter_complex",
        f"aformat=channel_layouts=mono,compand=gain=-6,showwavespic=s={width}x{height}:colors=#ff6f3c|#d65a2f:split_channels=0",
        "-frames:v", "1",
        out_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return r.returncode == 0 and os.path.exists(out_path)
    except subprocess.TimeoutExpired:
        return False


def run(params: dict, dry_run: bool) -> None:
    audio_path = params.get("audioPath")
    segments = params.get("segments") or []
    width = int(params.get("width", 600))
    height = int(params.get("height", 80))
    output_dir = params.get("outputDir") or os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/thumbnails/waveforms"
    )

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would render {len(segments)} waveform PNGs ({width}x{height}) from {audio_path or '<audioPath>'}",
            "outputDir": output_dir,
            "method": "ffmpeg showwavespic filter, accent-colour waveform on transparent bg",
        })
        return

    if not audio_path or not os.path.isfile(audio_path):
        bridge.error("audioPath required and must exist")
        sys.exit(1)
    if not segments:
        bridge.error("segments list is empty")
        sys.exit(1)

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not found")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    audio_hash = hashlib.sha1(audio_path.encode("utf-8")).hexdigest()[:10]

    rendered: list[dict] = []
    failed: list[dict] = []
    for segment in segments:
        take_id = segment.get("takeId", "")
        start = float(segment.get("startSeconds", 0))
        end = float(segment.get("endSeconds", 0))
        if end <= start:
            failed.append({"takeId": take_id, "error": "invalid span"})
            continue
        out_name = f"{audio_hash}_{take_id}_{int(start*1000)}.png"
        out_path = os.path.join(output_dir, out_name)
        if render_segment(ffmpeg, audio_path, start, end, out_path, width, height):
            rendered.append({
                "takeId": take_id,
                "startSeconds": start,
                "endSeconds": end,
                "imagePath": out_path,
            })
        else:
            failed.append({"takeId": take_id, "error": "ffmpeg failed"})

    bridge.result({
        "outputDir": output_dir,
        "rendered": rendered,
        "failed": failed,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""Extract thumbnails from video clips via ffmpeg.

Usage:
    python3 extract_thumbnails.py --params='{"clips":[...], "frames":3, "cacheDir":"..."}'

Each clip → N frames at evenly distributed timestamps (default 10%, 50%, 90%).
Cached by clip-path SHA → idempotent (re-run skips already-extracted).
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def clip_hash(path: str) -> str:
    return hashlib.sha1(path.encode("utf-8")).hexdigest()[:16]


def probe_duration(ffprobe: str, clip_path: str) -> float | None:
    try:
        out = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", clip_path],
            capture_output=True, text=True, timeout=15,
        )
        return float(out.stdout.strip()) if out.stdout.strip() else None
    except (subprocess.TimeoutExpired, ValueError, FileNotFoundError):
        return None


def extract_one(ffmpeg: str, clip_path: str, target_path: str, timestamp: float) -> bool:
    if os.path.exists(target_path):
        return True
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-ss", f"{timestamp:.3f}",
        "-i", clip_path,
        "-frames:v", "1",
        "-vf", "scale='if(gt(iw,640),640,iw)':-2",
        "-q:v", "4",
        target_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            bridge.warn(f"ffmpeg failed for {os.path.basename(clip_path)}: {result.stderr[:200]}")
            return False
        return os.path.exists(target_path)
    except subprocess.TimeoutExpired:
        bridge.warn(f"ffmpeg timed out for {os.path.basename(clip_path)}")
        return False


def run(params: dict, dry_run: bool) -> None:
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")

    if not ffmpeg or not ffprobe:
        bridge.error("ffmpeg and ffprobe must be installed (try: brew install ffmpeg)")
        sys.exit(1)

    clips: list[str] = params.get("clips") or []
    frames_per_clip = int(params.get("frames", 3))
    cache_dir = params.get("cacheDir") or os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/thumbnails"
    )

    if not clips:
        bridge.error("No clips provided")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would extract {frames_per_clip} thumbnails per clip × {len(clips)} clips",
            "ffmpegPath": ffmpeg,
            "cacheDir": cache_dir,
            "expectedFrames": frames_per_clip * len(clips),
        })
        return

    os.makedirs(cache_dir, exist_ok=True)
    positions = [(i + 1) / (frames_per_clip + 1) for i in range(frames_per_clip)]

    results: list[dict] = []
    for index, clip_path in enumerate(clips):
        if not os.path.isfile(clip_path):
            bridge.warn(f"Skipping missing file: {clip_path}")
            continue
        clip_id = clip_hash(clip_path)
        clip_cache = os.path.join(cache_dir, clip_id)
        os.makedirs(clip_cache, exist_ok=True)

        duration = probe_duration(ffprobe, clip_path)
        thumbnails: list[str] = []
        if duration and duration > 0.5:
            for i, fraction in enumerate(positions):
                ts = duration * fraction
                target = os.path.join(clip_cache, f"f{i+1}.jpg")
                if extract_one(ffmpeg, clip_path, target, ts):
                    thumbnails.append(target)
        else:
            # Fallback: single frame at 1.0s
            target = os.path.join(clip_cache, "f1.jpg")
            if extract_one(ffmpeg, clip_path, target, 1.0):
                thumbnails.append(target)

        results.append({
            "clipPath": clip_path,
            "clipName": os.path.basename(clip_path),
            "durationSeconds": duration,
            "thumbnails": thumbnails,
        })

        if (index + 1) % 10 == 0 or index == len(clips) - 1:
            bridge.log(f"Extracted thumbnails for {index + 1}/{len(clips)} clips")

    bridge.result({
        "cacheDir": cache_dir,
        "clips": results,
        "successCount": sum(1 for r in results if r["thumbnails"]),
        "failureCount": sum(1 for r in results if not r["thumbnails"]),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

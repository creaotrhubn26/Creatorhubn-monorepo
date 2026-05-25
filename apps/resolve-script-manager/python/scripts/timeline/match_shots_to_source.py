"""Match Shots to Source — for each shot in a finished/exported video,
find the matching raw clip + timecode in the raw-footage folders.

Approach:
  1. Detect cuts in the exported video (or accept pre-computed list)
  2. For each shot, extract a mid-frame and compute a 64-bit perceptual
     hash (8x8 grayscale aHash via ffmpeg — no PIL/imagehash needed)
  3. Walk source folders, find video files, sample frames every Ns,
     compute the same hash for each sample
  4. For each shot, scan source-frame hashes for the minimum Hamming
     distance — that's the best-guess source clip + timecode

Hamming threshold:
  ≤ 6  bits diff → very confident match (≥ 90%)
  ≤ 12 bits diff → likely match (≥ 75%)
  > 18 bits diff → uncertain (likely no source available)

Input params:
  editedVideoPath:  absolute path to exported video
  sourceFolders:    list of absolute paths to raw-footage directories
  sceneThreshold:   float, ffmpeg scene-detect sensitivity (default 0.4)
  sampleEverySec:   float, source-frame sampling interval (default 1.5)
  maxSourceFrames:  int, cap on total source frames to hash (default 5000)

Output:
  matches: [{
    shotIndex, shotTime, sourcePath, sourceFile, sourceTime,
    hashDistance, confidence: 'high'|'medium'|'low'|'none'
  }]
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


VIDEO_EXTS = {".mp4", ".mov", ".mxf", ".mts", ".m2ts", ".avi", ".mkv", ".m4v", ".braw"}
SIDECAR_FFMPEG_PATHS = (
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
)
PTS_RE = re.compile(r"pts_time:([\d.]+)")


def find_ffmpeg() -> tuple[str | None, str | None]:
    env = os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
    if env and os.path.isfile(env):
        probe = env.replace("ffmpeg", "ffprobe")
        if os.path.isfile(probe):
            return env, probe
    ffm = shutil.which("ffmpeg")
    ffp = shutil.which("ffprobe")
    if ffm and ffp:
        return ffm, ffp
    for c in SIDECAR_FFMPEG_PATHS:
        if os.path.isfile(c):
            p = c.replace("ffmpeg", "ffprobe")
            if os.path.isfile(p):
                return c, p
    return None, None


def probe_duration(ffprobe: str, path: str) -> float:
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=20,
        )
        return float((r.stdout or "0").strip())
    except Exception:  # noqa: BLE001
        return 0.0


def detect_cuts(ffmpeg: str, path: str, threshold: float) -> list[float]:
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-i", path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-an", "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        cuts = sorted({float(m) for m in PTS_RE.findall(proc.stderr)})
        return cuts
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"detect_cuts failed: {exc}")
        return []


def perceptual_hash(ffmpeg: str, video: str, time_sec: float) -> int | None:
    """Average-hash: 8x8 grayscale → 64-bit hash. Returns None on extraction
    failure. Uses raw ffmpeg pixel output — no image library dependency.
    """
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{time_sec:.3f}",
        "-i", video,
        "-vframes", "1",
        "-vf", "scale=8:8:flags=area,format=gray",
        "-f", "rawvideo",
        "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=15)
        if r.returncode != 0 or len(r.stdout) < 64:
            return None
        # First 64 bytes = 8x8 grayscale pixels
        pixels = r.stdout[:64]
        avg = sum(pixels) / 64.0
        h = 0
        for i, p in enumerate(pixels):
            if p > avg:
                h |= 1 << i
        return h
    except Exception:  # noqa: BLE001
        return None


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def find_video_files(folders: list[str]) -> list[str]:
    out: list[str] = []
    for root_dir in folders:
        if not os.path.isdir(root_dir):
            bridge.warn(f"source folder not found: {root_dir}")
            continue
        for dirpath, _dirnames, filenames in os.walk(root_dir):
            for fn in filenames:
                if fn.startswith("."):
                    continue
                ext = os.path.splitext(fn)[1].lower()
                if ext in VIDEO_EXTS:
                    out.append(os.path.join(dirpath, fn))
    return out


def classify_confidence(distance: int) -> str:
    if distance <= 6:
        return "high"
    if distance <= 12:
        return "medium"
    if distance <= 18:
        return "low"
    return "none"


def run(params: dict, dry_run: bool) -> None:
    edited = (params.get("editedVideoPath") or "").strip()
    source_folders = params.get("sourceFolders") or []
    if isinstance(source_folders, str):
        source_folders = [source_folders]
    try:
        threshold = float(params.get("sceneThreshold", 0.4))
        sample_every = float(params.get("sampleEverySec", 1.5))
        max_frames = int(params.get("maxSourceFrames", 5000))
    except (TypeError, ValueError):
        threshold, sample_every, max_frames = 0.4, 1.5, 5000

    if not edited or not os.path.isfile(edited):
        bridge.error(f"editedVideoPath '{edited}' is not a file")
        sys.exit(1)
    if not source_folders:
        bridge.error("sourceFolders must contain at least one path")
        sys.exit(1)

    ffmpeg, ffprobe = find_ffmpeg()
    if not ffmpeg or not ffprobe:
        bridge.error("ffmpeg/ffprobe not on PATH — install via Dependencies modal")
        sys.exit(1)

    bridge.progress(0, 100, "Finding source videos…")
    sources = find_video_files(source_folders)
    if not sources:
        bridge.error("No video files found in source folders")
        sys.exit(1)
    bridge.log(f"Found {len(sources)} source video(s) across {len(source_folders)} folder(s)")

    # Pre-computed cuts allow re-using the analyze step's result without re-detecting
    cuts_arg = params.get("shotCuts")
    if isinstance(cuts_arg, list) and cuts_arg:
        cuts = [float(t) for t in cuts_arg if isinstance(t, (int, float))]
    else:
        bridge.progress(5, 100, "Detecting shot cuts in edited video…")
        cuts = detect_cuts(ffmpeg, edited, threshold)
        if not cuts or cuts[0] > 0.05:
            cuts = [0.0] + cuts

    edited_duration = probe_duration(ffprobe, edited)

    # Hash all source frames first (mode: pre-build a flat index)
    bridge.progress(10, 100, "Hashing source frames…")
    source_index: list[tuple[int, int, float]] = []  # (hash, source_idx, time_sec)
    total_frames_target = 0
    for src in sources:
        dur = probe_duration(ffprobe, src)
        total_frames_target += max(1, int(dur / sample_every))
    # If we'd exceed max_frames, increase sample interval proportionally
    if total_frames_target > max_frames and max_frames > 0:
        sample_every = sample_every * (total_frames_target / max_frames)
        bridge.log(f"Source corpus large — increasing sample interval to {sample_every:.2f}s")

    for si, src in enumerate(sources):
        dur = probe_duration(ffprobe, src)
        if dur <= 0:
            continue
        steps = max(1, int(dur / sample_every))
        for step in range(steps):
            t = step * sample_every + 0.1
            if t >= dur:
                break
            h = perceptual_hash(ffmpeg, src, t)
            if h is not None:
                source_index.append((h, si, t))
        if (si + 1) % 5 == 0:
            bridge.progress(
                10 + int(60 * (si + 1) / len(sources)),
                100,
                f"Hashed {si + 1}/{len(sources)} source clips ({len(source_index)} frames)",
            )

    if not source_index:
        bridge.error("Could not hash any source frames — check that ffmpeg can read the source videos")
        sys.exit(1)

    bridge.log(f"Source index built: {len(source_index)} frame-hashes")

    # Hash each edited shot's mid-frame and find best match
    bridge.progress(75, 100, "Matching shots to source…")
    matches: list[dict] = []
    for i, cut in enumerate(cuts):
        next_cut = cuts[i + 1] if i + 1 < len(cuts) else edited_duration
        mid = cut + (next_cut - cut) * 0.5
        h_shot = perceptual_hash(ffmpeg, edited, mid)
        if h_shot is None:
            matches.append({
                "shotIndex": i, "shotTime": cut, "sourcePath": None,
                "sourceFile": None, "sourceTime": None,
                "hashDistance": None, "confidence": "none",
                "error": "could_not_hash_shot",
            })
            continue
        best_dist = 999
        best_src_idx = -1
        best_src_time = 0.0
        for h_src, src_idx, src_time in source_index:
            d = hamming(h_shot, h_src)
            if d < best_dist:
                best_dist = d
                best_src_idx = src_idx
                best_src_time = src_time
                if d == 0:
                    break
        src_path = sources[best_src_idx] if best_src_idx >= 0 else None
        matches.append({
            "shotIndex": i,
            "shotTime": cut,
            "sourcePath": src_path,
            "sourceFile": os.path.basename(src_path) if src_path else None,
            "sourceTime": best_src_time if src_path else None,
            "hashDistance": best_dist if src_path else None,
            "confidence": classify_confidence(best_dist) if src_path else "none",
        })
        if (i + 1) % 10 == 0:
            bridge.progress(75 + int(20 * (i + 1) / len(cuts)), 100, f"Matched {i + 1}/{len(cuts)}")

    bridge.progress(100, 100, "Done.")

    confidence_counts = {"high": 0, "medium": 0, "low": 0, "none": 0}
    for m in matches:
        confidence_counts[m["confidence"]] = confidence_counts.get(m["confidence"], 0) + 1

    if dry_run:
        bridge.result({
            "summary": (
                f"Would match {len(cuts)} shots against {len(source_index)} source-frames "
                f"from {len(sources)} clips"
            ),
            "shotCount": len(cuts),
            "sourceCount": len(sources),
            "sourceFrameCount": len(source_index),
        })
        return

    bridge.result({
        "editedVideo": edited,
        "shotCount": len(cuts),
        "sourceCount": len(sources),
        "sourceFrameCount": len(source_index),
        "sampleEverySec": sample_every,
        "matches": matches,
        "confidenceBreakdown": confidence_counts,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

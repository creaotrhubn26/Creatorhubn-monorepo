"""Analyze Loudness — runs ffmpeg loudnorm per clip; returns integrated LUFS, true peak, LRA.

Real ffmpeg-backed implementation. Targets:
  - Wedding film:        dialogue ~ -16 LUFS, peak ≤ -1 dBTP
  - YouTube:             integrated -14 LUFS, peak ≤ -1 dBTP
  - Podcast:             integrated -16 LUFS, peak ≤ -1 dBTP
  - Instagram Reel:      integrated -14 LUFS, peak ≤ -1 dBTP
  - Broadcast:           integrated -23 LUFS, peak ≤ -2 dBTP
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


TARGETS = {
    "wedding":    {"integrated": -16, "truePeak": -1, "lra": 11},
    "youtube":    {"integrated": -14, "truePeak": -1, "lra": 11},
    "instagram":  {"integrated": -14, "truePeak": -1, "lra": 11},
    "podcast":    {"integrated": -16, "truePeak": -1, "lra": 11},
    "broadcast":  {"integrated": -23, "truePeak": -2, "lra": 7},
}


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


def measure_loudness(ffmpeg: str, clip_path: str) -> dict | None:
    """Run loudnorm in measure-mode; parse the JSON summary at end of stderr."""
    cmd = [
        ffmpeg, "-nostats", "-hide_banner", "-i", clip_path,
        "-af", "loudnorm=I=-16:LRA=11:TP=-1:print_format=json",
        "-f", "null", "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return None

    # The JSON block is at the very end of stderr
    text = result.stderr or ""
    start = text.rfind("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def run(params: dict, dry_run: bool) -> None:
    delivery = params.get("deliveryTarget", "wedding")
    target = TARGETS.get(delivery, TARGETS["wedding"])
    sample_size = int(params.get("sampleSize", 30))  # cap at 30 by default to keep dry run quick
    clip_paths = params.get("clipPaths") or []

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would measure LUFS/TP/LRA on {sample_size or 'all'} clips via ffmpeg loudnorm",
            "deliveryTarget": delivery,
            "target": target,
            "perClipFields": ["input_i", "input_tp", "input_lra", "input_thresh"],
            "summaryFields": ["averageLufs", "maxTruePeak", "clipsBelowTarget", "clipsAboveTruePeak"],
        })
        return

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not found — install via `brew install ffmpeg`")
        sys.exit(1)

    # Allow direct file list (used by Audio Assistant UI) or fall back to Media Pool walk
    paths_to_scan: list[str] = []
    if clip_paths:
        paths_to_scan = [p for p in clip_paths if os.path.isfile(p)]
    else:
        conn = bridge.ResolveConnection()
        if not conn.connect() or not conn.require_project():
            return
        all_clips: list = []
        walk_clips(conn.media_pool.GetRootFolder(), all_clips)
        for clip in all_clips:
            try:
                props = clip.GetClipProperty() or {}
            except Exception:
                continue
            path = props.get("File Path")
            if path and os.path.isfile(path):
                paths_to_scan.append(path)

    if sample_size and len(paths_to_scan) > sample_size:
        bridge.warn(f"Limiting to first {sample_size} clips — set sampleSize=0 for full scan")
        paths_to_scan = paths_to_scan[:sample_size]

    results: list[dict] = []
    total = len(paths_to_scan)
    for idx, path in enumerate(paths_to_scan):
        bridge.progress(idx, total, f"Measuring {os.path.basename(path)}")
        bridge.log(f"Measuring {idx + 1}/{total} — {os.path.basename(path)}")
        measurement = measure_loudness(ffmpeg, path)
        if not measurement:
            results.append({"clipPath": path, "clipName": os.path.basename(path), "error": "no audio or measurement failed"})
            continue
        results.append({
            "clipPath": path,
            "clipName": os.path.basename(path),
            "integratedLufs": float(measurement.get("input_i", 0) or 0),
            "truePeak": float(measurement.get("input_tp", 0) or 0),
            "lra": float(measurement.get("input_lra", 0) or 0),
            "threshold": float(measurement.get("input_thresh", 0) or 0),
        })

    valid = [r for r in results if "integratedLufs" in r]
    if not valid:
        bridge.warn("No clips with measurable audio")
        bridge.result({"clipsScanned": len(results), "valid": 0})
        return

    lufs_values = [r["integratedLufs"] for r in valid]
    peak_values = [r["truePeak"] for r in valid]
    avg_lufs = sum(lufs_values) / len(lufs_values)
    max_peak = max(peak_values)

    below_target_lufs = [r for r in valid if r["integratedLufs"] < target["integrated"] - 3]
    above_peak = [r for r in valid if r["truePeak"] > target["truePeak"]]

    bridge.result({
        "deliveryTarget": delivery,
        "target": target,
        "clipsScanned": len(results),
        "clipsMeasured": len(valid),
        "averageLufs": round(avg_lufs, 1),
        "maxTruePeak": round(max_peak, 1),
        "clipsBelowTarget": [{"name": r["clipName"], "lufs": r["integratedLufs"]} for r in below_target_lufs[:20]],
        "clipsAboveTruePeak": [{"name": r["clipName"], "truePeak": r["truePeak"]} for r in above_peak[:20]],
        "perClip": results,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

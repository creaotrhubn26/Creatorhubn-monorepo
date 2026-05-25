"""Flag Clipping — uses ffmpeg astats to find clips with peak ≥ 0.0 dBFS (digital clipping)."""

from __future__ import annotations

import os
import re
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


def measure_peak(ffmpeg: str, clip_path: str) -> tuple[float | None, int | None]:
    """Return (peak_db, num_clipped_samples)."""
    cmd = [
        ffmpeg, "-nostats", "-hide_banner", "-i", clip_path,
        "-af", "astats=metadata=1:reset=0:measure_perchannel=none:measure_overall=Peak_level+Number_of_samples+Number_of_NaNs",
        "-f", "null", "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        return (None, None)

    stderr = result.stderr or ""
    peak_match = re.search(r"Peak level dB:\s*(-?\d+\.?\d*)", stderr)
    peak_db = float(peak_match.group(1)) if peak_match else None
    return (peak_db, None)


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def run(params: dict, dry_run: bool) -> None:
    threshold = float(params.get("thresholdDb", -0.1))  # peaks ≥ this are flagged
    clip_paths = params.get("clipPaths") or []

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would flag every clip with peak ≥ {threshold} dBFS via ffmpeg astats",
            "threshold": threshold,
            "willMarkInResolve": "Add Red marker 'Clipping' on offending timeline items (if requested)",
        })
        return

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not found")
        sys.exit(1)

    paths: list[str] = []
    if clip_paths:
        paths = [p for p in clip_paths if os.path.isfile(p)]
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
            p = props.get("File Path")
            if p and os.path.isfile(p):
                paths.append(p)

    flagged: list[dict] = []
    clean = 0
    for idx, path in enumerate(paths):
        peak, _ = measure_peak(ffmpeg, path)
        if peak is None:
            continue
        if peak >= threshold:
            flagged.append({"name": os.path.basename(path), "peakDb": peak, "path": path})
        else:
            clean += 1
        if (idx + 1) % 10 == 0 or idx == len(paths) - 1:
            bridge.log(f"Scanned {idx + 1}/{len(paths)} clips · flagged {len(flagged)}")

    bridge.result({
        "threshold": threshold,
        "clipsScanned": len(paths),
        "cleanCount": clean,
        "clippedCount": len(flagged),
        "flagged": flagged,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

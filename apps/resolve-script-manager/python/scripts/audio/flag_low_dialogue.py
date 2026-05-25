"""Flag Low Dialogue — flags clips with integrated LUFS below threshold (default -28).

Pair with analyze_loudness for per-clip data; this script focuses on the *low dialogue* subset
and adds optional timeline markers in Resolve.
"""

from __future__ import annotations

import json
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


def measure_lufs(ffmpeg: str, clip_path: str) -> float | None:
    cmd = [
        ffmpeg, "-nostats", "-hide_banner", "-i", clip_path,
        "-af", "loudnorm=print_format=json",
        "-f", "null", "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired:
        return None
    text = result.stderr or ""
    start = text.rfind("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        data = json.loads(text[start : end + 1])
        return float(data.get("input_i", 0) or 0)
    except (json.JSONDecodeError, ValueError):
        return None


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def run(params: dict, dry_run: bool) -> None:
    threshold_lufs = float(params.get("thresholdLufs", -28))
    clip_paths = params.get("clipPaths") or []
    add_markers = bool(params.get("addMarkersInResolve", False))

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would flag every clip with integrated LUFS below {threshold_lufs}",
            "threshold": threshold_lufs,
            "addMarkers": add_markers,
        })
        return

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not found")
        sys.exit(1)

    paths: list[str] = []
    timeline_items_by_path: dict[str, list] = {}
    conn = None

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
    for idx, path in enumerate(paths):
        lufs = measure_lufs(ffmpeg, path)
        if lufs is not None and lufs < threshold_lufs:
            flagged.append({"name": os.path.basename(path), "lufs": lufs, "path": path})
        if (idx + 1) % 10 == 0 or idx == len(paths) - 1:
            bridge.log(f"Scanned {idx + 1}/{len(paths)} clips · flagged {len(flagged)}")

    if add_markers and conn and flagged:
        bridge.warn("Marker placement on timeline — needs timeline-item lookup. Stub for v1.")

    bridge.result({
        "threshold": threshold_lufs,
        "clipsScanned": len(paths),
        "lowDialogueCount": len(flagged),
        "flagged": flagged,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""Flag Underexposed Clips — uses ffmpeg signalstats to compute per-clip mean luma (YAVG).

Real implementation: ffmpeg's `signalstats` filter reports YAVG (0-255 luma). We convert that
to IRE roughly via (YAVG - 16) * 100 / 219. Threshold default = 25 IRE.
"""

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


def measure_yavg(ffmpeg: str, path: str, sample_seconds: float = 3.0) -> float | None:
    """Run signalstats on a short sample at the midpoint of the clip."""
    cmd = [
        ffmpeg, "-nostats", "-hide_banner",
        "-ss", "0",  # sample from start; faster than seeking midpoint
        "-t", str(sample_seconds),
        "-i", path,
        "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG",
        "-f", "null", "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        return None

    values: list[float] = []
    for line in (result.stderr or "").splitlines():
        m = re.search(r"YAVG=([\d.]+)", line)
        if m:
            try:
                values.append(float(m.group(1)))
            except ValueError:
                continue
    if not values:
        return None
    return sum(values) / len(values)


def yavg_to_ire(yavg: float) -> float:
    return max(0.0, (yavg - 16) * 100 / 219)


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def run(params: dict, dry_run: bool) -> None:
    threshold_ire = float(params.get("thresholdIRE", 25))
    add_markers = bool(params.get("addMarkersInResolve", False))
    clip_paths = params.get("clipPaths") or []

    if dry_run:
        bridge.result({
            "summary": f"Dry run — ffmpeg signalstats per clip; flag YAVG below {threshold_ire} IRE",
            "thresholdIRE": threshold_ire,
            "method": "ffmpeg -vf signalstats (no Resolve grab needed)",
        })
        return

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not found")
        sys.exit(1)

    paths: list[tuple[str, object | None]] = []
    conn: bridge.ResolveConnection | None = None

    if clip_paths:
        paths = [(p, None) for p in clip_paths if os.path.isfile(p)]
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
                paths.append((p, clip))

    flagged: list[dict] = []
    clean = 0
    measure_failures: list[str] = []

    for idx, (path, _) in enumerate(paths):
        yavg = measure_yavg(ffmpeg, path)
        if yavg is None:
            measure_failures.append(os.path.basename(path))
            continue
        ire = yavg_to_ire(yavg)
        if ire < threshold_ire:
            flagged.append({"name": os.path.basename(path), "yavg": round(yavg, 1), "ire": round(ire, 1), "path": path})
        else:
            clean += 1
        if (idx + 1) % 10 == 0 or idx == len(paths) - 1:
            bridge.log(f"Scanned {idx + 1}/{len(paths)} clips · flagged {len(flagged)}")

    if add_markers and conn and flagged:
        timeline = conn.project.GetCurrentTimeline()
        if timeline:
            items = timeline.GetItemListInTrack("video", 1) or []
            flagged_paths = {f["path"] for f in flagged}
            markers_added = 0
            for item in items:
                try:
                    mp_item = item.GetMediaPoolItem()
                    if not mp_item:
                        continue
                    item_path = (mp_item.GetClipProperty() or {}).get("File Path")
                    if item_path in flagged_paths:
                        start = int(item.GetStart() or 0)
                        if item.AddMarker(start, "Orange", "Needs exposure", "ffmpeg-signalstats", 1, "underexposed"):
                            markers_added += 1
                except Exception:
                    continue
            bridge.log(f"Added {markers_added} 'Needs exposure' markers")

    bridge.result({
        "thresholdIRE": threshold_ire,
        "clipsScanned": len(paths),
        "cleanCount": clean,
        "flaggedCount": len(flagged),
        "measureFailures": measure_failures,
        "flagged": flagged[:30],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

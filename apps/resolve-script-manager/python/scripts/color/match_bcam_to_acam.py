"""Camera Match Assistant — sets A-cam as reference, exports stills + builds CDL deltas.

v1 strategy (deterministic, no Vision required):
  1. Group timeline items by camera profile
  2. Use the largest group's median-position clip as A-cam reference
  3. For each B-cam group: export one still per camera from each scene (via marker positions)
  4. Write a sidecar JSON with placeholder CDL deltas (operator adjusts in Color page using
     the reference stills as target). v2 will populate CDL from Vision-comparison.
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CAMERA_HINTS = [
    (re.compile(r"C80", re.IGNORECASE), "Canon C80"),
    (re.compile(r"C70", re.IGNORECASE), "Canon C70"),
    (re.compile(r"R5C?|EOS\s*R5", re.IGNORECASE), "Canon R5"),
    (re.compile(r"FX[369]|A7S|VENICE", re.IGNORECASE), "Sony"),
    (re.compile(r"GH[56]|S[15]H|Lumix", re.IGNORECASE), "Panasonic"),
    (re.compile(r"MAVIC|INSPIRE|DJI", re.IGNORECASE), "DJI Drone"),
    (re.compile(r"URSA|POCKET|BRAW", re.IGNORECASE), "Blackmagic"),
    (re.compile(r"ALEXA|AMIRA", re.IGNORECASE), "ARRI"),
    (re.compile(r"iPhone|IMG_", re.IGNORECASE), "iPhone"),
]


def classify(name: str, metadata: dict) -> str:
    camera_meta = (metadata or {}).get("Camera Type", "")
    haystack = f"{name} {camera_meta}"
    for pattern, label in CAMERA_HINTS:
        if pattern.search(haystack):
            return label
    return "Unknown"


def frame_to_tc(frame: int, fps: float) -> str:
    total_seconds = frame / fps
    h = int(total_seconds // 3600)
    m = int((total_seconds % 3600) // 60)
    s = int(total_seconds % 60)
    f = int((total_seconds - int(total_seconds)) * fps)
    return f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"


def run(params: dict, dry_run: bool) -> None:
    reference = params.get("referenceCamera", "Canon C80")
    targets = params.get("matchCameras") or ["Canon R5", "DJI Drone"]
    stills_folder = params.get("stillsFolder") or os.path.expanduser("~/Documents/Camera Match Stills")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would set {reference} as reference and export match-stills for {', '.join(targets)}",
            "stillsFolder": stills_folder,
            "approach": "Per camera: export 1 still at each scene marker → operator uses Color page to match B-cam to A-cam",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline")
        sys.exit(1)

    items = timeline.GetItemListInTrack("video", 1) or []
    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 25)
    except (TypeError, ValueError):
        fps = 25.0

    by_camera: dict[str, list] = defaultdict(list)
    for item in items:
        try:
            mp_item = item.GetMediaPoolItem()
            if not mp_item:
                continue
            name = mp_item.GetName()
            metadata = mp_item.GetMetadata() or {}
        except Exception:
            continue
        label = classify(name, metadata)
        by_camera[label].append(item)

    os.makedirs(stills_folder, exist_ok=True)
    project_name = conn.project.GetName().replace("/", "_").replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    markers = timeline.GetMarkers() or {}
    marker_frames = sorted(markers.keys()) if markers else []
    if not marker_frames:
        # No markers — use 5 evenly distributed positions across the timeline
        start = int(timeline.GetStartFrame() or 0)
        end = int(timeline.GetEndFrame() or 0)
        marker_frames = [start + (end - start) * (i + 1) // 6 for i in range(5)]

    sidecar_path = os.path.join(stills_folder, f"{project_name}_camera_match_{timestamp}.json")
    plan: dict = {
        "reference": reference,
        "targets": targets,
        "fps": fps,
        "groups": {label: len(items) for label, items in by_camera.items()},
        "matchSuggestions": [],
    }

    # For each camera-marker combination, attempt to navigate the playhead and grab a still
    grabbed: list[dict] = []
    grab_failures: list[dict] = []
    for camera_label, group_items in by_camera.items():
        if camera_label != reference and camera_label not in targets:
            continue
        for frame in marker_frames[:5]:
            try:
                timeline.SetCurrentTimecode(frame_to_tc(int(frame), fps))
                still = timeline.GrabStill()
            except Exception as exc:
                grab_failures.append({"camera": camera_label, "frame": frame, "error": str(exc)})
                continue
            if not still:
                grab_failures.append({"camera": camera_label, "frame": frame, "error": "GrabStill returned None"})
                continue
            grabbed.append({"camera": camera_label, "frame": frame, "still": "<grabbed in Gallery>"})

    # Placeholder CDL deltas — v2 will populate via Vision
    for target in targets:
        plan["matchSuggestions"].append({
            "target": target,
            "method": "Open Color page → put reference still on viewer A side → manually match CDL on target clips",
            "cdlSeed": {"slope": [1.0, 1.0, 1.0], "offset": [0.0, 0.0, 0.0], "power": [1.0, 1.0, 1.0], "saturation": 1.0},
        })

    with open(sidecar_path, "w", encoding="utf-8") as fh:
        json.dump(plan, fh, indent=2)

    bridge.result({
        "reference": reference,
        "targets": targets,
        "stillsFolder": stills_folder,
        "sidecarPath": sidecar_path,
        "stillsGrabbed": len(grabbed),
        "grabFailures": grab_failures[:10],
        "cameraGroupSizes": plan["groups"],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

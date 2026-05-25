"""Organize by Camera — moves clips in the Media Pool into bins by camera model + date."""

from __future__ import annotations

import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Heuristic camera classification — extended by inspecting Resolve metadata when available
CAMERA_HINTS = [
    (re.compile(r"C80|Canon C80", re.IGNORECASE), "Canon C80"),
    (re.compile(r"C70|Canon C70", re.IGNORECASE), "Canon C70"),
    (re.compile(r"C300", re.IGNORECASE), "Canon C300"),
    (re.compile(r"R5|EOS R5", re.IGNORECASE), "Canon R5"),
    (re.compile(r"R5C", re.IGNORECASE), "Canon R5C"),
    (re.compile(r"FX3|FX6|FX9|A7S|Sony", re.IGNORECASE), "Sony"),
    (re.compile(r"GH5|GH6|S1H|Panasonic|Lumix", re.IGNORECASE), "Panasonic"),
    (re.compile(r"DJI|Mavic|Inspire|Air|Drone", re.IGNORECASE), "DJI Drone"),
    (re.compile(r"BRAW|BlackMagic|URSA|Pocket", re.IGNORECASE), "Blackmagic"),
    (re.compile(r"iPhone|IMG_", re.IGNORECASE), "iPhone"),
    (re.compile(r"Zoom|H6|Mic|Audio", re.IGNORECASE), "External Audio"),
]


def classify(clip_name: str, metadata: dict) -> str:
    camera_model = (metadata or {}).get("Camera Type") or (metadata or {}).get("Camera Model") or ""
    haystack = f"{clip_name} {camera_model}"
    for pattern, label in CAMERA_HINTS:
        if pattern.search(haystack):
            return label
    return "Unknown Camera"


def run(params: dict, dry_run: bool) -> None:
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    media_pool = conn.media_pool
    root = media_pool.GetRootFolder()
    clips = root.GetClipList() or []
    bridge.log(f"Scanning {len(clips)} clips in root bin")

    buckets: dict[str, list] = defaultdict(list)
    for clip in clips:
        try:
            name = clip.GetName()
            metadata = clip.GetMetadata() or {}
        except Exception:
            continue
        label = classify(name, metadata)
        buckets[label].append(clip)

    plan = {label: len(clips) for label, clips in buckets.items()}

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would create {len(buckets)} camera bins and move {sum(plan.values())} clips",
            "clipsByCamera": plan,
        })
        return

    moved = 0
    for label, bucket_clips in buckets.items():
        existing = next(
            (f for f in root.GetSubFolderList() if f.GetName() == label),
            None,
        )
        bin_folder = existing or media_pool.AddSubFolder(root, label)
        if not bin_folder:
            bridge.warn(f"Could not create/find bin '{label}'")
            continue
        if media_pool.MoveClips(bucket_clips, bin_folder):
            moved += len(bucket_clips)

    bridge.result({
        "clipsByCamera": plan,
        "clipsMoved": moved,
        "unknownCount": plan.get("Unknown Camera", 0),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

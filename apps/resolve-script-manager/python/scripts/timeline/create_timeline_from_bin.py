"""Create Timeline from Bin — builds a new Resolve timeline from every
clip inside a named Media Pool bin, sorted chronologically by clip start
metadata (or alphabetically by name as a fallback).

Use case (per workflows.json): step 1 of the Social Media Batch workflow —
collect a set of clips in a bin, dump them onto a master timeline that
later steps export to multiple aspect ratios.

Input via params:
  binName:       name of the bin to read clips from (exact match)
  timelineName:  name to give the new timeline
  sortBy:        'chronological' (default) | 'name' | 'pool_order'

Behavior:
  - Finds the bin by name (top-level OR nested — depth-first scan)
  - Reads all clips in that bin (not recursive into sub-bins)
  - Sorts them
  - Calls MediaPool.CreateTimelineFromClips
  - Reports timeline name + clip count
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def find_bin(root: Any, target_name: str) -> Any | None:
    """DFS for a bin by exact name. Returns the folder object or None."""
    try:
        if root.GetName() == target_name:
            return root
        for sub in root.GetSubFolderList() or []:
            found = find_bin(sub, target_name)
            if found:
                return found
    except Exception:  # noqa: BLE001
        pass
    return None


def list_bin_names(root: Any, prefix: str = "") -> list[str]:
    """Flatten all bin names for the error message when target isn't found."""
    names: list[str] = []
    try:
        name = root.GetName()
        names.append(f"{prefix}{name}")
        for sub in root.GetSubFolderList() or []:
            names.extend(list_bin_names(sub, prefix=f"{prefix}{name}/"))
    except Exception:  # noqa: BLE001
        pass
    return names


def clip_sort_key(clip: Any, mode: str) -> Any:
    if mode == "name":
        try:
            return (clip.GetName() or "").lower()
        except Exception:  # noqa: BLE001
            return ""
    if mode == "chronological":
        # Resolve clip property 'Date Created' / 'Date Recorded' / 'Start TC'
        for prop in ("Date Recorded", "Date Created", "Start TC"):
            try:
                val = clip.GetClipProperty(prop)
                if val:
                    return val
            except Exception:  # noqa: BLE001
                continue
        # Fallback to name
        try:
            return (clip.GetName() or "").lower()
        except Exception:  # noqa: BLE001
            return ""
    # pool_order: keep Resolve's native ordering
    return 0


def run(params: dict, dry_run: bool) -> None:
    bin_name = (params.get("binName") or "").strip()
    timeline_name = (params.get("timelineName") or "").strip()
    sort_by = (params.get("sortBy") or "chronological").lower()
    if sort_by not in ("chronological", "name", "pool_order"):
        sort_by = "chronological"

    if not bin_name:
        bridge.error("binName is required")
        sys.exit(1)
    if not timeline_name:
        bridge.error("timelineName is required")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": f"Would build timeline '{timeline_name}' from clips in bin '{bin_name}' (sort: {sort_by})",
            "binName": bin_name,
            "timelineName": timeline_name,
            "sortBy": sort_by,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No current Resolve project — open one and try again")
        sys.exit(1)

    media_pool = conn.project.GetMediaPool()
    if not media_pool:
        bridge.error("Could not access Media Pool")
        sys.exit(1)
    root = media_pool.GetRootFolder()
    if not root:
        bridge.error("Could not access Media Pool root folder")
        sys.exit(1)

    bridge.progress(10, 100, f"Finner bin '{bin_name}'…")
    target = find_bin(root, bin_name)
    if not target:
        available = list_bin_names(root)[:50]
        bridge.error(
            f"Bin '{bin_name}' not found in current project. "
            f"Available bins: {', '.join(available[:20])}"
            f"{' …' if len(available) > 20 else ''}"
        )
        sys.exit(1)

    bridge.progress(40, 100, "Henter klipp fra bin'en…")
    clips = []
    try:
        clips = list(target.GetClipList() or [])
    except Exception as exc:  # noqa: BLE001
        bridge.error(f"GetClipList failed: {exc}")
        sys.exit(1)

    if not clips:
        bridge.error(f"Bin '{bin_name}' is empty — nothing to add to timeline")
        sys.exit(1)

    bridge.progress(60, 100, f"Sorterer {len(clips)} klipp ({sort_by})…")
    if sort_by != "pool_order":
        try:
            clips.sort(key=lambda c: clip_sort_key(c, sort_by))
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Sort failed ({exc}) — keeping pool order")

    bridge.progress(80, 100, f"Lager timeline '{timeline_name}'…")
    try:
        timeline = media_pool.CreateTimelineFromClips(timeline_name, clips)
    except Exception as exc:  # noqa: BLE001
        bridge.error(f"CreateTimelineFromClips threw: {exc}")
        sys.exit(1)

    if not timeline:
        bridge.error(
            f"CreateTimelineFromClips returned None — timeline name '{timeline_name}' "
            "may already exist, or the clips couldn't be added (check codec compatibility)."
        )
        sys.exit(1)

    bridge.progress(100, 100, "Ferdig.")

    clip_names = []
    for c in clips[:20]:
        try:
            clip_names.append(c.GetName())
        except Exception:  # noqa: BLE001
            clip_names.append("?")

    bridge.result({
        "projectName": conn.project.GetName(),
        "timelineName": timeline_name,
        "binName": bin_name,
        "clipCount": len(clips),
        "sortBy": sort_by,
        "sampleClips": clip_names,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

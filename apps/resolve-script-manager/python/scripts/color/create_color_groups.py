"""Create Color Groups — buckets timeline items into Resolve color groups by camera + scene."""

from __future__ import annotations

import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


DEFAULT_GROUPS = ["Canon C80", "Canon R5", "DJI Drone", "Low light", "Reception", "Ceremony"]


CAMERA_HINTS = [
    (re.compile(r"C80", re.IGNORECASE), "Canon C80"),
    (re.compile(r"R5C?|EOS\s*R5", re.IGNORECASE), "Canon R5"),
    (re.compile(r"MAVIC|INSPIRE|DJI", re.IGNORECASE), "DJI Drone"),
]


SCENE_HINTS = [
    (re.compile(r"CEREMONY|VOWS|RING", re.IGNORECASE), "Ceremony"),
    (re.compile(r"RECEPTION|DINNER|SPEECH", re.IGNORECASE), "Reception"),
    (re.compile(r"DANCE|PARTY|EVENING|LOW", re.IGNORECASE), "Low light"),
]


CLIP_COLOR_BY_LABEL = {
    "Canon C80": "Orange",
    "Canon R5": "Apricot",
    "DJI Drone": "Sky",
    "Low light": "Navy",
    "Reception": "Yellow",
    "Ceremony": "Cyan",
}


def pick_group(name: str, metadata: dict) -> str | None:
    camera_meta = (metadata or {}).get("Camera Type", "")
    haystack = f"{name} {camera_meta}"
    for pattern, label in CAMERA_HINTS:
        if pattern.search(haystack):
            return label
    for pattern, label in SCENE_HINTS:
        if pattern.search(haystack):
            return label
    return None


def run(params: dict, dry_run: bool) -> None:
    groups = params.get("groups") or DEFAULT_GROUPS
    track_index = int(params.get("trackIndex", 1))

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would create {len(groups)} color groups and assign timeline items by camera + scene",
            "groups": groups,
            "fallback": "Clip-color tagging when color-group API is missing",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline")
        sys.exit(1)

    color_groups: dict = {}
    api_supported = hasattr(timeline, "CreateColorGroup")
    if api_supported:
        for label in groups:
            try:
                grp = timeline.CreateColorGroup(label)
                if grp:
                    color_groups[label] = grp
            except Exception as exc:
                bridge.warn(f"CreateColorGroup('{label}') raised: {exc}")
                api_supported = False
                break

    items = timeline.GetItemListInTrack("video", track_index) or []
    assignments: dict[str, list[str]] = {label: [] for label in groups}
    unassigned: list[str] = []

    for item in items:
        try:
            mp_item = item.GetMediaPoolItem()
            if not mp_item:
                continue
            name = mp_item.GetName()
            metadata = mp_item.GetMetadata() or {}
        except Exception:
            continue
        label = pick_group(name, metadata)
        if not label:
            unassigned.append(name)
            continue
        if api_supported and label in color_groups:
            try:
                if item.AssignToColorGroup(color_groups[label]):
                    assignments[label].append(name)
                    continue
            except Exception:
                pass
        try:
            item.SetClipColor(CLIP_COLOR_BY_LABEL.get(label, "Sand"))
            assignments[label].append(name)
        except Exception as exc:
            bridge.warn(f"SetClipColor failed for {name}: {exc}")

    bridge.result({
        "method": "CreateColorGroup" if api_supported else "ClipColor fallback",
        "groupsCreated": list(color_groups.keys()) if api_supported else [],
        "assignments": {k: len(v) for k, v in assignments.items()},
        "unassignedCount": len(unassigned),
        "unassignedSample": unassigned[:20],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

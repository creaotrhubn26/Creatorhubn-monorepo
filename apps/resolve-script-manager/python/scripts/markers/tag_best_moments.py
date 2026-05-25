"""Tag Best Moments — adds a per-clip marker for each tag in `taggedClips`.

Params:
  taggedClips: { tag_label: [clip_name_or_path, ...], ... }
    e.g. { "Best reaction": ["C0042.MOV"], "Use in trailer": ["C0011.MOV", "C0042.MOV"] }
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


TAG_COLORS = {
    "Best reaction": "Pink",
    "Good audio": "Green",
    "Use in trailer": "Red",
    "Use in full film": "Blue",
    "Possible reel": "Cyan",
    "Needs color fix": "Yellow",
    "Needs audio cleanup": "Yellow",
}


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def run(params: dict, dry_run: bool) -> None:
    tagged = params.get("taggedClips") or {}
    total = sum(len(v) for v in tagged.values())

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would add {total} markers across {len(tagged)} tag-groups",
            "tagColors": TAG_COLORS,
            "incomingByTag": {k: len(v) for k, v in tagged.items()},
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    all_clips: list = []
    walk_clips(conn.media_pool.GetRootFolder(), all_clips)
    by_basename: dict = {}
    for clip in all_clips:
        try:
            by_basename[clip.GetName()] = clip
            props = clip.GetClipProperty() or {}
            path = props.get("File Path")
            if path:
                by_basename[os.path.basename(path)] = clip
        except Exception:
            continue

    added: list[dict] = []
    not_found: list[str] = []
    for tag, names in tagged.items():
        color = TAG_COLORS.get(tag, "Sand")
        for name in names:
            clip = by_basename.get(name) or by_basename.get(os.path.basename(name))
            if not clip:
                not_found.append(name)
                continue
            try:
                ok = clip.AddMarker(0, color, tag, tag, 1, tag)
                added.append({"clip": name, "tag": tag, "color": color, "ok": bool(ok)})
            except Exception as exc:
                bridge.warn(f"AddMarker failed for {name}: {exc}")

    bridge.result({
        "tagsApplied": len([a for a in added if a["ok"]]),
        "clipsNotFound": not_found,
        "details": added,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

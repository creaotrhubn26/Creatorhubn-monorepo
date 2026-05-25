"""Sync Audio by Filename Pattern — fallback when TC missing. Matches C80_A001 ↔ Zoom_A001."""

from __future__ import annotations

import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


DEFAULT_PATTERN = r".*?_?A(\d{3,4})"


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def run(params: dict, dry_run: bool) -> None:
    pattern_str = params.get("pattern") or DEFAULT_PATTERN

    if dry_run:
        try:
            re.compile(pattern_str)
            valid = True
        except re.error:
            valid = False
        bridge.result({
            "summary": f"Dry run — would group clips by regex '{pattern_str}' and call AutoSyncAudio('Waveform') per group",
            "regexValid": valid,
            "example": "C80_A001.mov + Zoom_A001.wav both yield '001' → grouped",
        })
        return

    pattern = re.compile(pattern_str)
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    all_clips: list = []
    walk_clips(conn.media_pool.GetRootFolder(), all_clips)

    groups: dict[str, list] = defaultdict(list)
    for clip in all_clips:
        try:
            name = clip.GetName()
        except Exception:
            continue
        m = pattern.search(name)
        if m:
            groups[m.group(1)].append(clip)

    bridge.log(f"Grouped {sum(len(v) for v in groups.values())} clips into {len(groups)} pattern-keys")

    successful: list[dict] = []
    failed: list[dict] = []
    skipped_solo: int = 0
    for key, group in groups.items():
        if len(group) < 2:
            skipped_solo += len(group)
            continue
        try:
            ok = conn.media_pool.AutoSyncAudio(group, ["Sound"], "Waveform")
        except Exception as exc:
            failed.append({"key": key, "clips": [c.GetName() for c in group], "error": str(exc)})
            continue
        names = [c.GetName() for c in group]
        (successful if ok else failed).append({"key": key, "clips": names})

    bridge.result({
        "pattern": pattern_str,
        "groupsTried": len(successful) + len(failed),
        "synced": len(successful),
        "failed": len(failed),
        "soloClipCount": skipped_solo,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

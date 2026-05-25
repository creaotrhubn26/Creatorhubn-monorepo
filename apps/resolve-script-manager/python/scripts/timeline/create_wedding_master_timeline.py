"""Create Wedding Master Timeline — segments for Bride Prep → Party using bin clips."""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


TEMPLATE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "templates",
    "wedding_bins.json",
)


def load_segments() -> list[str]:
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return [bin_name for bin_name in data["bins"] if bin_name not in ("11 Audio", "12 Music", "Exports")]


def run(params: dict, dry_run: bool) -> None:
    timeline_name = params.get("timelineName", "Master_Timeline_V01")
    segments = load_segments()

    bridge.log(f"Preparing master timeline '{timeline_name}' with {len(segments)} segments")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would create timeline '{timeline_name}' assembling {len(segments)} bin segments",
            "segmentOrder": segments,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    media_pool = conn.media_pool
    root = media_pool.GetRootFolder()
    bins_by_name = {f.GetName(): f for f in root.GetSubFolderList() or []}

    new_timeline = media_pool.CreateEmptyTimeline(timeline_name)
    if not new_timeline:
        bridge.error(f"CreateEmptyTimeline('{timeline_name}') returned None — name may already exist")
        sys.exit(1)

    conn.project.SetCurrentTimeline(new_timeline)

    appended = 0
    segment_summary: list[dict] = []
    for segment in segments:
        bin_folder = bins_by_name.get(segment)
        if not bin_folder:
            bridge.warn(f"Bin '{segment}' not found — skipping")
            segment_summary.append({"segment": segment, "clipsAppended": 0, "skipped": True})
            continue
        clips = bin_folder.GetClipList() or []
        if not clips:
            segment_summary.append({"segment": segment, "clipsAppended": 0})
            continue
        if media_pool.AppendToTimeline(clips):
            appended += len(clips)
            segment_summary.append({"segment": segment, "clipsAppended": len(clips)})
        else:
            bridge.warn(f"AppendToTimeline failed for '{segment}'")
            segment_summary.append({"segment": segment, "clipsAppended": 0, "appendFailed": True})

    bridge.result({
        "timelineName": timeline_name,
        "clipsAppended": appended,
        "segments": segment_summary,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

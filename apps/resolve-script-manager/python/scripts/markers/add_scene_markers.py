"""Add Wedding Scene Markers — places CEREMONY_START, VOWS, RING_EXCHANGE, FIRST_KISS, etc.

Params:
  markerTimestamps: {markerName: frameNumber, ...}
                    Falls back to placing markers at evenly-spaced positions
                    across the current timeline.
"""

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


def load_scene_markers() -> list[dict]:
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)["sceneMarkers"]


def run(params: dict, dry_run: bool) -> None:
    markers = load_scene_markers()
    timestamps = params.get("markerTimestamps") or {}
    bridge.log(f"Placing {len(markers)} scene markers")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would add {len(markers)} markers to current timeline",
            "plannedMarkers": markers,
            "timestampSource": "params.markerTimestamps" if timestamps else "auto (evenly spaced)",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline. Open or create a timeline before running this script.")
        sys.exit(1)

    end_frame = int(timeline.GetEndFrame() or 0)
    start_frame = int(timeline.GetStartFrame() or 0)
    span = max(1, end_frame - start_frame)
    step = span // (len(markers) + 1)

    added: list[dict] = []
    for idx, marker in enumerate(markers):
        frame_id = timestamps.get(marker["name"])
        if frame_id is None:
            frame_id = start_frame + step * (idx + 1)
        ok = timeline.AddMarker(int(frame_id), marker["color"], marker["name"], "", 1, marker["name"])
        added.append({"name": marker["name"], "frame": frame_id, "ok": bool(ok)})
        if not ok:
            bridge.warn(f"AddMarker failed for '{marker['name']}' @ frame {frame_id}")

    bridge.result({
        "timelineName": timeline.GetName(),
        "markersAdded": [m for m in added if m["ok"]],
        "markersFailed": [m for m in added if not m["ok"]],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""Prepare Audio for Fairlight — sets up A1-A7 with standard wedding labels."""

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


def run(params: dict, dry_run: bool) -> None:
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as fh:
        layout = json.load(fh)["audioLayout"]

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would relabel/add {len(layout)} audio tracks on current timeline",
            "trackLayout": layout,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline.")
        sys.exit(1)

    current_count = timeline.GetTrackCount("audio") or 0
    bridge.log(f"Current timeline has {current_count} audio tracks, target {len(layout)}")

    while current_count < len(layout):
        if not timeline.AddTrack("audio"):
            bridge.warn("AddTrack(audio) returned False — stopping")
            break
        current_count += 1

    for entry in layout:
        try:
            timeline.SetTrackName("audio", entry["track"], entry["label"])
        except Exception as exc:
            bridge.warn(f"SetTrackName failed for A{entry['track']}: {exc}")

    bridge.result({"audioTracksConfigured": current_count, "layout": layout})


if __name__ == "__main__":
    bridge.main_guard(run)

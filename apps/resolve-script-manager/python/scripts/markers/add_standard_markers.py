"""Add Standard Markers — places Intro, Body, Outro at 0%, 33%, 66% of timeline."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


STANDARD = [
    ("Intro", 0.0, "Green"),
    ("Body", 0.33, "Blue"),
    ("Outro", 0.66, "Red"),
]


def run(params: dict, dry_run: bool) -> None:
    if dry_run:
        bridge.result({
            "summary": "Dry run — would add Intro/Body/Outro markers at 0%/33%/66% of current timeline",
            "markers": [{"name": n, "positionPct": p * 100, "color": c} for n, p, c in STANDARD],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline.")
        sys.exit(1)

    start = int(timeline.GetStartFrame() or 0)
    end = int(timeline.GetEndFrame() or 0)
    span = max(1, end - start)

    added = []
    for name, pct, color in STANDARD:
        frame = start + int(span * pct)
        ok = timeline.AddMarker(frame, color, name, "", 1, name)
        added.append({"name": name, "frame": frame, "ok": bool(ok)})

    bridge.result({"timelineName": timeline.GetName(), "markersAdded": added})


if __name__ == "__main__":
    bridge.main_guard(run)

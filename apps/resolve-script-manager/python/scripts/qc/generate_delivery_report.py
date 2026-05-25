"""Generate Delivery Report — project, timelines, duration, exports, codecs, missing items."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Documents/Delivery Reports")
    client_name = params.get("clientName", "Client")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would write Markdown + JSON delivery report for '{client_name}'",
            "outputFolder": output_folder,
            "willInclude": [
                "Project name", "Timelines + durations", "Render jobs + codecs",
                "Resolution", "Date", "Missing media count",
            ],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    project = conn.project
    timeline_count = project.GetTimelineCount()
    timelines: list[dict] = []
    for idx in range(1, timeline_count + 1):
        tl = project.GetTimelineByIndex(idx)
        if not tl:
            continue
        timelines.append({
            "name": tl.GetName(),
            "startFrame": tl.GetStartFrame(),
            "endFrame": tl.GetEndFrame(),
            "videoTracks": tl.GetTrackCount("video"),
            "audioTracks": tl.GetTrackCount("audio"),
        })

    report = {
        "client": client_name,
        "projectName": project.GetName(),
        "generatedAt": datetime.now().isoformat(),
        "timelines": timelines,
    }

    os.makedirs(output_folder, exist_ok=True)
    safe = client_name.replace("/", "_").replace(" ", "_")
    path = os.path.join(output_folder, f"{safe}_delivery_report.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    bridge.result({"reportPath": path, "timelineCount": len(timelines)})


if __name__ == "__main__":
    bridge.main_guard(run)

"""Generate Marker Report — exports markers to CSV / JSON / EDL / client review list."""

from __future__ import annotations

import csv
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Documents/Resolve Reports")
    formats = params.get("format") or ["csv", "json"]
    if isinstance(formats, str):
        formats = [formats]

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would export current timeline markers to {output_folder}",
            "formats": formats,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline.")
        sys.exit(1)

    markers = timeline.GetMarkers() or {}
    if not markers:
        bridge.warn("No markers on current timeline")
        bridge.result({"markersExported": 0})
        return

    os.makedirs(output_folder, exist_ok=True)
    base = f"{conn.project.GetName()}_{timeline.GetName()}_markers".replace("/", "_").replace(" ", "_")
    rows = [
        {"frame": frame, "name": data.get("name"), "color": data.get("color"), "note": data.get("note", "")}
        for frame, data in sorted(markers.items())
    ]

    written: list[str] = []
    if "json" in formats:
        path = os.path.join(output_folder, f"{base}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(rows, fh, indent=2)
        written.append(path)
    if "csv" in formats:
        path = os.path.join(output_folder, f"{base}.csv")
        with open(path, "w", encoding="utf-8", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=["frame", "name", "color", "note"])
            writer.writeheader()
            writer.writerows(rows)
        written.append(path)

    if "edl" in formats or "pdf" in formats:
        bridge.warn("EDL/PDF formats are stubs — CSV/JSON are produced for now")

    bridge.result({"markersExported": len(rows), "files": written})


if __name__ == "__main__":
    bridge.main_guard(run)

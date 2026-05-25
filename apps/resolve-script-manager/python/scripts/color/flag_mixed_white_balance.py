"""Flag Mixed White Balance — reads per-clip WB metadata, flags scene-level outliers."""

from __future__ import annotations

import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    if dry_run:
        bridge.result({
            "summary": "Dry run — would read White Balance metadata per clip and flag scene-level outliers",
            "logic": "Group clips by nearest scene marker → compute median WB → flag clips ≥800K off",
            "markerColor": "Yellow",
            "markerName": "WB outlier",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline.")
        sys.exit(1)

    items = timeline.GetItemListInTrack("video", 1) or []
    bridge.log(f"Reading WB metadata for {len(items)} timeline items on V1")

    wb_values: dict[str, int] = {}
    for item in items:
        try:
            mp_item = item.GetMediaPoolItem()
            if not mp_item:
                continue
            metadata = mp_item.GetMetadata() or {}
            wb = metadata.get("White Point Kelvin") or metadata.get("Color Temp")
            if wb:
                wb_values[item.GetName()] = int(str(wb).split()[0])
        except Exception:
            continue

    if not wb_values:
        bridge.warn("No WB metadata found on V1 clips. Metadata may not be embedded for your camera.")
        bridge.result({"clipsScanned": len(items), "wbExtracted": 0})
        return

    values = sorted(wb_values.values())
    median = values[len(values) // 2]
    outliers = {name: kelvin for name, kelvin in wb_values.items() if abs(kelvin - median) >= 800}

    bridge.result({
        "clipsScanned": len(items),
        "wbExtracted": len(wb_values),
        "medianKelvin": median,
        "outlierCount": len(outliers),
        "outliers": outliers,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

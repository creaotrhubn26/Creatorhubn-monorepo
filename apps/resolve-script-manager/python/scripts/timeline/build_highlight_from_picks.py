"""Build Highlight from Picks — second half of the interactive highlight flow.

extract_highlight_from_film (review mode) cached the picks + thumbnails.
The Tauri UI lets the user keep/skip + adjust startSec/endSec per shot.
That UI calls this script with the FINAL picks list to build the Resolve
timeline.

Input params:
  picks:           array of {startSec, endSec, ...} — only those user approved
                    (if omitted, reads last_highlight_picks.json from cache)
  sourceVideo:     absolute path to the source video (if omitted, reads cache)
  timelineName:    name for the new timeline (default 'Highlight — reviewed')
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _load_cached_picks() -> dict:
    path = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_highlight_picks.json"
    )
    if not os.path.isfile(path):
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def run(params: dict[str, Any], dry_run: bool) -> None:
    picks = params.get("picks") or []
    source_video = (params.get("sourceVideo") or "").strip()
    timeline_name = (params.get("timelineName") or "").strip()

    if not picks or not source_video:
        cached = _load_cached_picks()
        if not picks:
            picks = cached.get("picks") or []
        if not source_video:
            source_video = cached.get("sourceVideo") or ""
        if not timeline_name:
            timeline_name = cached.get("timelineName") or "Highlight — reviewed"

    if not picks:
        bridge.error("No picks provided — run extract_highlight_from_film with interactiveReview first")
        sys.exit(1)
    if not source_video or not os.path.isfile(source_video):
        bridge.error(f"sourceVideo '{source_video}' not found on disk")
        sys.exit(1)
    if not timeline_name:
        timeline_name = f"{os.path.splitext(os.path.basename(source_video))[0]} — highlight reviewed"

    total = sum((p.get("endSec", 0) - p.get("startSec", 0)) for p in picks)
    bridge.log(
        f"Building timeline '{timeline_name}' from {len(picks)} approved picks "
        f"(total {total:.1f}s)"
    )

    if dry_run:
        bridge.result({
            "summary": f"Would build '{timeline_name}' from {len(picks)} picks ({total:.0f}s)",
            "picks": picks[:10],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No current Resolve project — open one and try again")
        sys.exit(1)

    media_pool = conn.project.GetMediaPool()
    if not media_pool:
        bridge.error("Could not access Media Pool")
        sys.exit(1)

    # Import (or find) the source video in Media Pool
    bridge.progress(20, 100, "Importing source video…")
    items = media_pool.ImportMedia([source_video]) or []
    if not items:
        bridge.error(f"Could not import {source_video}")
        sys.exit(1)
    source_item = items[0]

    bridge.progress(50, 100, "Creating timeline…")
    timeline = media_pool.CreateEmptyTimeline(timeline_name)
    if not timeline:
        bridge.error(f"CreateEmptyTimeline('{timeline_name}') returned None — name may exist")
        sys.exit(1)
    conn.project.SetCurrentTimeline(timeline)

    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 25)
    except Exception:  # noqa: BLE001
        fps = 25.0

    # Sort picks chronologically (UI may reorder, but narrative arc usually = original order)
    picks_sorted = sorted(picks, key=lambda p: float(p.get("startSec") or 0))

    append_specs = []
    for p in picks_sorted:
        start_sec = float(p.get("startSec") or 0)
        end_sec = float(p.get("endSec") or 0)
        if end_sec <= start_sec:
            continue
        start_f = int(round(start_sec * fps))
        end_f = int(round(end_sec * fps)) - 1
        if end_f <= start_f:
            continue
        append_specs.append({
            "mediaPoolItem": source_item,
            "startFrame": start_f,
            "endFrame": end_f,
        })

    if not append_specs:
        bridge.error("No valid picks to append (all had zero duration?)")
        sys.exit(1)

    bridge.progress(80, 100, f"Appending {len(append_specs)} approved shots…")
    placed = media_pool.AppendToTimeline(append_specs)
    placed_count = len(placed) if isinstance(placed, list) else 0

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "timelineName": timeline_name,
        "picksApproved": len(picks),
        "shotsPlaced": placed_count,
        "totalDurationSec": round(total, 1),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

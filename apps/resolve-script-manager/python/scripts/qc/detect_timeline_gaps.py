"""Detect Timeline Gaps — sjekk for svarte mellomrom mellom klipp i en
Resolve-timeline.

Use case: før brudeparet får levert filmen, sjekk at det IKKE er
ufrivillige sorte mellomrom mellom cuts. Slike gap kan oppstå hvis:
  - Et klipp ble fjernet fra timelinen uten ripple-delete
  - Multi-track edit hvor V1 har gap selv om V2/V3 spiller
  - Manuelle juster har forskyvet klipp

Returnerer liste over gaps + total svart-tid + verdict.

Input:
  timelineName:    (optional) navn på timeline å sjekke. Default = current
  autoFix:         (optional, bool) hvis true, fjern gaps via ripple-delete

Output:
  gaps: [{ startSec, endSec, durationSec, position }]
  totalGapSec: float
  verdict: "clean" | "minor_gaps" | "major_gaps"
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


GAP_THRESHOLD_SEC = 0.04  # 1 frame ved 25fps = 0.04s — alt under er bare cut-grense


def run(params: dict[str, Any], dry_run: bool) -> None:
    timeline_name = (params.get("timelineName") or "").strip()
    auto_fix = bool(params.get("autoFix", False))

    if dry_run:
        bridge.result({"wouldCheck": timeline_name or "current"})
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        sys.exit(1)
    if not conn.project:
        bridge.error("No project open in Resolve")
        sys.exit(1)

    timeline = None
    if timeline_name:
        # Finn navngitt timeline
        n = conn.project.GetTimelineCount() or 0
        for i in range(1, n + 1):
            t = conn.project.GetTimelineByIndex(i)
            if t and t.GetName() == timeline_name:
                timeline = t
                break
        if not timeline:
            bridge.error(f"Timeline '{timeline_name}' not found")
            sys.exit(1)
    else:
        timeline = conn.project.GetCurrentTimeline()
        if not timeline:
            bridge.error("No current timeline")
            sys.exit(1)

    # Hent FPS for sekund-konvertering
    fps_str = timeline.GetSetting("timelineFrameRate")
    try:
        fps = float(fps_str)
    except (TypeError, ValueError):
        fps = 25.0

    start_frame = timeline.GetStartFrame() or 0
    end_frame = timeline.GetEndFrame() or 0

    # Hent items på V1
    items = timeline.GetItemListInTrack("video", 1) or []
    if not items:
        bridge.result({
            "gaps": [],
            "totalGapSec": 0,
            "verdict": "clean",
            "message": "Ingen video-klipp på V1 å sjekke",
        })
        return

    # Sortér etter start-frame
    items_sorted = sorted(items, key=lambda it: it.GetStart() or 0)

    gaps = []
    cursor = items_sorted[0].GetStart() or start_frame
    # Sjekk gap FØR første klipp (hvis timeline-start ikke matcher)
    if items_sorted[0].GetStart() > start_frame:
        gap_start_f = start_frame
        gap_end_f = items_sorted[0].GetStart()
        dur_f = gap_end_f - gap_start_f
        if dur_f / fps > GAP_THRESHOLD_SEC:
            gaps.append({
                "startSec": (gap_start_f - start_frame) / fps,
                "endSec": (gap_end_f - start_frame) / fps,
                "durationSec": dur_f / fps,
                "position": "før første klipp",
            })

    # Sjekk gap MELLOM klipp
    for i, item in enumerate(items_sorted):
        item_start = item.GetStart() or 0
        item_end = item.GetEnd() or 0

        if i > 0:
            prev_end = (items_sorted[i - 1].GetEnd() or 0)
            if item_start > prev_end:
                dur_f = item_start - prev_end
                if dur_f / fps > GAP_THRESHOLD_SEC:
                    gaps.append({
                        "startSec": (prev_end - start_frame) / fps,
                        "endSec": (item_start - start_frame) / fps,
                        "durationSec": dur_f / fps,
                        "position": f"mellom klipp {i} og {i + 1}",
                    })
        cursor = item_end

    # Sjekk gap ETTER siste klipp (sjeldent et problem, men logger det)
    last_end = items_sorted[-1].GetEnd() or 0
    if end_frame and last_end < end_frame:
        dur_f = end_frame - last_end
        if dur_f / fps > GAP_THRESHOLD_SEC:
            gaps.append({
                "startSec": (last_end - start_frame) / fps,
                "endSec": (end_frame - start_frame) / fps,
                "durationSec": dur_f / fps,
                "position": "etter siste klipp",
            })

    total_gap = sum(g["durationSec"] for g in gaps)

    # Verdict basert på total gap-tid
    if not gaps:
        verdict = "clean"
    elif total_gap < 2.0:
        verdict = "minor_gaps"  # < 2s totalt = sannsynligvis intensjonelle pauser
    else:
        verdict = "major_gaps"  # > 2s = trolig feil

    bridge.log(f"Timeline '{timeline.GetName()}': {len(gaps)} gaps, total {total_gap:.2f}s, verdict={verdict}")

    # Auto-fix: ripple-delete hver gap (skift alle påfølgende klipp venstre)
    fixed = 0
    if auto_fix and gaps:
        # Resolve har ikke direkte RippleDelete på timeline-items via API i v18.
        # Workaround: for hver gap, flytt alle items etter prev_end venstre med gap-dur.
        # Dette er komplekst og risikabelt — for nå rapporterer vi bare.
        bridge.warn("auto-fix ikke fullt implementert — bruk manuell ripple-delete i Resolve")

    bridge.result({
        "timelineName": timeline.GetName(),
        "gaps": gaps,
        "gapCount": len(gaps),
        "totalGapSec": round(total_gap, 2),
        "verdict": verdict,
        "fixed": fixed,
        "fps": fps,
        "totalItems": len(items_sorted),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

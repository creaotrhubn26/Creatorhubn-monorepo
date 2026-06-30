"""Find Jump Cuts — skanner gjeldende Resolve-timeline for «brå switching».

Flagger to ting som gir den hakkete/jump-cut-følelsen:
  1) FLASH CUTS  — klipp kortere enn minDurationSec (default 2.0s) → maskingevær.
  2) JUMP CUTS   — to nabo-klipp hvis KILDE-tider er nærmere enn neighborGapSec
                   (default 9.0s) → trolig nesten-like utsnitt → øyet «hopper».

Den gjetter ikke visuell likhet (krever ikke vision) — den bruker kilde-nærhet,
som er en billig, treffsikker proxy for «to shots fra samme øyeblikk/vinkel».

Input params:
  minDurationSec:    flash-cut-terskel (default 2.0)
  neighborGapSec:    jump-cut kilde-gap-terskel (default 9.0)
  trackIndex:        video-spor å skanne (default 1)

Output: { clips, flashCuts:[...], jumpCuts:[...], summary }
  Hver flagg har timeline-tidskode + kilde-tid så du finner det raskt i Resolve.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

SOURCE_FPS_FALLBACK = 50.0


def _tc(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 60}:{s % 60:02d}"


def run(params: dict, dry_run: bool) -> None:
    min_dur = float(params.get("minDurationSec") or 2.0)
    gap = float(params.get("neighborGapSec") or 9.0)
    track_index = int(params.get("trackIndex") or 1)

    if dry_run:
        bridge.result({
            "summary": f"Would scan video track {track_index} for flash cuts <{min_dur}s "
                       f"and jump cuts (source gap <{gap}s)",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen åpen Resolve-timeline å skanne.")
        sys.exit(1)

    tl = conn.project.GetCurrentTimeline()
    if not tl:
        bridge.error("Ingen aktiv timeline.")
        sys.exit(1)

    fps = float(conn.project.GetSetting("timelineFrameRate") or 25)
    sf = int(tl.GetStartFrame() or 0)
    items = tl.GetItemListInTrack("video", track_index) or []
    bridge.progress(20, 100, f"Skanner {len(items)} klipp på V{track_index}…")

    flash_cuts = []
    jump_cuts = []
    prev_src = None
    prev_name = None
    for it in items:
        try:
            dur = it.GetDuration() / fps
            pos = (it.GetStart() - sf) / fps
            src = it.GetSourceStartFrame() / SOURCE_FPS_FALLBACK
            name = it.GetName() or "?"
        except Exception:  # noqa: BLE001
            continue
        if dur < min_dur:
            flash_cuts.append({"timeline": _tc(pos), "timelineSec": round(pos, 2),
                               "durationSec": round(dur, 2), "name": name})
        if prev_src is not None and abs(src - prev_src) < gap:
            jump_cuts.append({"timeline": _tc(pos), "timelineSec": round(pos, 2),
                              "sourceGapSec": round(abs(src - prev_src), 2),
                              "fromSource": _tc(prev_src), "toSource": _tc(src)})
        prev_src, prev_name = src, name

    bridge.progress(90, 100, "Oppsummerer…")
    for f in flash_cuts:
        bridge.log(f"FLASH CUT @ {f['timeline']} — {f['durationSec']}s")
    for j in jump_cuts:
        bridge.log(f"JUMP CUT @ {j['timeline']} — kilde {j['fromSource']}→{j['toSource']} (Δ{j['sourceGapSec']}s)")

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "clips": len(items),
        "flashCuts": flash_cuts,
        "jumpCuts": jump_cuts,
        "thresholds": {"minDurationSec": min_dur, "neighborGapSec": gap},
        "summary": (f"{len(flash_cuts)} flash cut(s) <{min_dur}s, "
                    f"{len(jump_cuts)} jump-cut-risiko (kilde-gap <{gap}s) "
                    f"av {len(items)} klipp på V{track_index}."),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

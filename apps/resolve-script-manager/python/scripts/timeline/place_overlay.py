"""Place Overlay — legg en transparent infographic-overlay (ProRes 4444 m/alfa,
rendret fra Infographic Studio sine HTML-maler) på et overlay-spor i Resolve, ved
det tidspunktet den skal dukke opp i videoen.

Dette er Resolve-siden av studio→Resolve-pipelinen:
  HTML-mal → CSS/JS-animasjon → transparent PNG-sekvens → ProRes 4444 (alfa)
  → DENNE: importer + plasser på V2/V3 ved recordFrame (når den skal vises).

Params:
  overlays: [ { "path": "/…/PV Cards.mov",   # alfa-clip
               "atSec": 4.0,                  # når i videoen den skal dukke opp
               "durationSec": 0,              # 0 = bruk klippets egen lengde
               "track": 2 } ]                 # overlay-spor (≥2)
  fps: timeline-fps (default 60). Hvis et prosjekt/timeline er åpent brukes dens fps.
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    overlays = params.get("overlays") or []
    if isinstance(overlays, str):
        import json as _json
        try:
            overlays = _json.loads(overlays)
        except Exception:  # noqa: BLE001
            overlays = []
    if not overlays:
        bridge.error("Ingen overlays oppgitt. Send 'overlays': [{path, atSec, durationSec, track}].")
        sys.exit(1)
    fps = int(params.get("fps") or 60)

    norm = []
    for o in overlays:
        p = o.get("path") or ""
        norm.append({
            "path": p,
            "atSec": float(o.get("atSec") or 0),
            "durationSec": float(o.get("durationSec") or 0),
            "track": int(o.get("track") or 2),
            "exists": bool(p) and os.path.isfile(p),
        })

    if dry_run:
        bridge.result({"dryRun": True, "fps": fps, "overlays": norm})
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    media_pool = conn.media_pool or project.GetMediaPool()
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen timeline åpen. Åpne videoen din i en timeline først.")
        return
    try:
        tfps = float(timeline.GetSetting("timelineFrameRate") or fps)
        if tfps > 0:
            fps = int(round(tfps))
    except Exception:  # noqa: BLE001
        pass

    start_frame = timeline.GetStartFrame()
    placed = 0
    reports = []
    for i, o in enumerate(norm):
        if not o["exists"]:
            reports.append({"i": i, "skipped": "fil finnes ikke", "path": o["path"]})
            continue
        try:
            item = (media_pool.ImportMedia([o["path"]]) or [None])[0]
        except Exception as exc:  # noqa: BLE001
            reports.append({"i": i, "error": f"import feilet: {exc}"})
            continue
        if not item:
            reports.append({"i": i, "error": "import returnerte ingenting"})
            continue
        # sørg for at overlay-sporet finnes
        track = max(2, o["track"])
        while timeline.GetTrackCount("video") < track:
            timeline.AddTrack("video")
        clip = {
            "mediaPoolItem": item,
            "trackIndex": track,
            "recordFrame": start_frame + int(round(o["atSec"] * fps)),
        }
        if o["durationSec"] > 0:
            clip["startFrame"] = 0
            clip["endFrame"] = max(1, int(round(o["durationSec"] * fps)) - 1)
        try:
            res = media_pool.AppendToTimeline([clip])
            if res:
                placed += 1
                reports.append({"i": i, "track": track, "atSec": o["atSec"], "ok": True})
            else:
                reports.append({"i": i, "error": "AppendToTimeline returnerte tomt"})
        except Exception as exc:  # noqa: BLE001
            reports.append({"i": i, "error": f"AppendToTimeline feilet: {exc}"})
        bridge.progress(i + 1, len(norm), f"Overlay {i + 1}/{len(norm)}")

    bridge.log(f"Plasserte {placed}/{len(norm)} infographic-overlays")
    bridge.result({"placed": placed, "total": len(norm), "fps": fps, "reports": reports})


bridge.main_guard(run)

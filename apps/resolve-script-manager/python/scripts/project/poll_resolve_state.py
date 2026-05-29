"""Poll Resolve State — lett-vekt status-snapshot av aktivt prosjekt.

Brukes av Creative Editor's useResolveSync-hook hvert 5. sekund for å
detektere endringer Bjarne gjør i Resolve (nye markører, timeline-bytter,
clip-changes) og synce dem tilbake til CE.

Output er kompakt nok til å pollse ofte uten merkbar load:
  {
    connected: bool,
    projectName: str | None,
    timelineName: str | None,
    fps: float,
    timelineDurationFrames: int,
    markers: [{frame, sec, name, color, note}],
    clipCount: int,
    sampledAt: float (unix ts)
  }

Returnerer always-success med connected=false hvis Resolve ikke kjører
(slik at frontend kan vise "Resolve ikke åpen" uten exception-håndtering).
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    sampled_at = time.time()

    # Pre-empt connection-feil med try-block så frontend alltid får
    # JSON-respons (connected=false) i stedet for crash
    try:
        conn = bridge.ResolveConnection()
        if not conn.connect():
            bridge.result({
                "connected": False,
                "reason": "Resolve not running",
                "sampledAt": sampled_at,
            })
            return
        if not conn.project:
            bridge.result({
                "connected": True,
                "projectName": None,
                "timelineName": None,
                "fps": 0,
                "markers": [],
                "clipCount": 0,
                "reason": "No project open",
                "sampledAt": sampled_at,
            })
            return

        project_name = ""
        try: project_name = conn.project.GetName() or ""
        except Exception: pass

        timeline = conn.project.GetCurrentTimeline()
        if not timeline:
            bridge.result({
                "connected": True,
                "projectName": project_name,
                "timelineName": None,
                "fps": 0,
                "markers": [],
                "clipCount": 0,
                "reason": "No timeline open",
                "sampledAt": sampled_at,
            })
            return

        timeline_name = ""
        try: timeline_name = timeline.GetName() or ""
        except Exception: pass

        # FPS for frame → sec konvertering
        fps = 24.0
        try:
            settings = conn.project.GetSetting("timelineFrameRate")
            if settings: fps = float(settings)
        except Exception: pass

        # Markers fra timeline
        markers = []
        try:
            raw_markers = timeline.GetMarkers() or {}
            # Returneres som { frame: { color, name, note, ... } }
            for frame_str, info in raw_markers.items():
                try:
                    frame = int(frame_str)
                    sec = frame / fps if fps > 0 else 0
                    markers.append({
                        "frame": frame,
                        "sec": round(sec, 3),
                        "name": (info.get("name") or "")[:120],
                        "color": info.get("color") or "Blue",
                        "note": (info.get("note") or "")[:200],
                    })
                except (TypeError, ValueError):
                    continue
        except Exception as exc:
            bridge.warn(f"GetMarkers failed: {exc}")

        # Total clip-count (lett-vekt — bare sum over video-tracks)
        clip_count = 0
        try:
            track_count = int(timeline.GetTrackCount("video") or 0)
            for t in range(1, track_count + 1):
                items = timeline.GetItemListInTrack("video", t) or []
                clip_count += len(items)
        except Exception:
            pass

        # Timeline-duration i frames
        duration_frames = 0
        try:
            start = int(timeline.GetStartFrame() or 0)
            end = int(timeline.GetEndFrame() or 0)
            duration_frames = max(0, end - start)
        except Exception:
            pass

        bridge.result({
            "connected": True,
            "projectName": project_name,
            "timelineName": timeline_name,
            "fps": fps,
            "timelineDurationFrames": duration_frames,
            "markers": sorted(markers, key=lambda m: m["frame"]),
            "clipCount": clip_count,
            "sampledAt": sampled_at,
        })

    except Exception as exc:
        bridge.result({
            "connected": False,
            "reason": f"poll failed: {type(exc).__name__}",
            "sampledAt": sampled_at,
        })


bridge.main_guard(run)

"""Push Markers to Resolve — sender CE-markører til aktiv Resolve-timeline.

Andre halvdel av bidireksjonell sync. CE detekterer at brukeren har lagt
til/oppdatert en markør lokalt, og kaller dette scriptet for å pushe den
inn i Resolve's timeline. Med 'rr-'-prefiks-markørene som allerede kom
FRA Resolve (via poll_resolve_state) skiller vi ut hva som er nytt.

Input params:
  markers: [{ id, frame OR sec, label, color, comment }]
    - frame foretrukket; sec konverteres til frame via timeline-FPS
    - color = hex eller Resolve-fargenavn ("Red", "Green", etc.)
    - id brukes som duplikat-key så samme markør kan re-pushes idempotent

Conflict-policy:
  - Vi rører ikke eksisterende Resolve-markører som ikke matcher våre IDer
  - Vi sletter våre forrige push hvis frame eller name har endret seg
  - Hvis bruker har slettet vår markør i Resolve, lar vi det stå

Output: { added, updated, skipped, failed }
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# CE-hex → Resolve-fargenavn (Resolve aksepterer ikke hex direkte i AddMarker)
HEX_TO_RESOLVE_COLOR = {
    "#ef4f6f": "Pink",
    "#4ad48a": "Green",
    "#f0a500": "Yellow",
    "#4a8de0": "Blue",
    "#4adde0": "Cyan",
    "#a030c0": "Purple",
    "#c850e0": "Fuchsia",
    "#6e3fc7": "Purple",
    "#8674a8": "Lavender",
    "#7ec4ff": "Sky",
}


def _resolve_color(name_or_hex: str) -> str:
    if not name_or_hex: return "Blue"
    if not name_or_hex.startswith("#"):
        return name_or_hex
    return HEX_TO_RESOLVE_COLOR.get(name_or_hex.lower(), "Blue")


def run(params: dict[str, Any], dry_run: bool) -> None:
    markers_in = params.get("markers") or []
    if not isinstance(markers_in, list) or len(markers_in) == 0:
        bridge.error("Ingen markører i input")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldPush": len(markers_in),
            "markers": [
                {"id": m.get("id"), "label": m.get("label"), "color": _resolve_color(m.get("color", ""))}
                for m in markers_in[:10]
            ],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen aktiv timeline i Resolve")
        sys.exit(1)

    # Hent FPS for sec → frame konvertering
    fps = 24.0
    try:
        fps_str = conn.project.GetSetting("timelineFrameRate")
        if fps_str: fps = float(fps_str)
    except Exception:
        pass

    start_frame = int(timeline.GetStartFrame() or 0)
    end_frame = int(timeline.GetEndFrame() or 0)
    duration = max(1, end_frame - start_frame)

    # Eksisterende markører — vi bruker dette til dedup + cleanup av outdated
    # CE-pushes (samme ID, annet frame).
    existing_markers = {}
    try:
        raw = timeline.GetMarkers() or {}
        for frame, info in raw.items():
            try:
                existing_markers[int(frame)] = info
            except (TypeError, ValueError):
                continue
    except Exception:
        pass

    added = 0
    updated = 0
    skipped = 0
    failed = 0

    for m in markers_in:
        try:
            label = (m.get("label") or "").strip() or "Marker"
            color = _resolve_color(m.get("color", "Blue"))
            note = (m.get("comment") or "").strip()

            # Beregn frame
            frame = m.get("frame")
            if frame is None:
                sec = m.get("sec")
                if sec is None: sec = m.get("timeSec")
                if sec is None:
                    skipped += 1
                    continue
                try: frame = int(float(sec) * fps)
                except (TypeError, ValueError):
                    skipped += 1
                    continue

            # Clamp til timeline-range
            if frame < start_frame: frame = start_frame
            if frame >= end_frame: frame = end_frame - 1

            # Marker-ID lagres i customData så vi kan re-finne den
            custom_id = f"ce:{m.get('id', '')}"

            # Hvis det allerede er en markør på denne frame med samme customData
            # → AddMarker vil feile (Resolve tillater ikke duplikater på exact frame).
            # Vi sletter den først hvis den er vår.
            if frame in existing_markers:
                ex = existing_markers[frame]
                ex_custom = (ex.get("customData") or "")
                if ex_custom.startswith("ce:"):
                    # Vår tidligere push — slett + add på nytt for å oppdatere
                    try:
                        timeline.DeleteMarkerAtFrame(frame)
                        updated += 1
                    except Exception:
                        pass
                else:
                    skipped += 1
                    continue

            ok = timeline.AddMarker(frame, color, label, note, 1, custom_id)
            if ok:
                if frame not in existing_markers: added += 1
            else:
                failed += 1
        except Exception as exc:
            bridge.warn(f"Push av markør {m.get('id')} feilet: {exc}")
            failed += 1

    bridge.result({
        "added": added,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "totalSent": len(markers_in),
        "timelineFrames": duration,
        "fps": fps,
    })


bridge.main_guard(run)

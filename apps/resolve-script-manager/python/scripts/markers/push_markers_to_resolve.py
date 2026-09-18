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
    remove_missing_creatorhub = bool(params.get("removeMissingCreatorHub"))
    if not isinstance(markers_in, list) or (len(markers_in) == 0 and not remove_missing_creatorhub):
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
    existing_by_custom = {}
    try:
        raw = timeline.GetMarkers() or {}
        for frame, info in raw.items():
            try:
                frame_number = int(frame)
                existing_markers[frame_number] = info
                custom_data = (info.get("customData") or "").strip()
                if custom_data:
                    existing_by_custom[custom_data] = (frame_number, info)
            except (TypeError, ValueError):
                continue
    except Exception:
        pass

    added = 0
    updated = 0
    skipped = 0
    failed = 0
    removed = 0
    conflicts = 0
    desired_custom_ids = {f"ce:{m.get('id', '')}" for m in markers_in if m.get("id")}

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
            marker_updated = False

            # Finn samme ID uavhengig av frame. Dette gjør flytting og tekst-
            # endringer idempotente, ikke bare oppdateringer på identisk frame.
            previous = existing_by_custom.get(custom_id)
            if previous:
                previous_frame, previous_info = previous
                same_payload = (
                    previous_frame == frame
                    and (previous_info.get("name") or "") == label
                    and (previous_info.get("note") or "") == note
                    and (previous_info.get("color") or "Blue") == color
                )
                if same_payload:
                    skipped += 1
                    continue
                deleted = False
                try:
                    if hasattr(timeline, "DeleteMarkerByCustomData"):
                        deleted = bool(timeline.DeleteMarkerByCustomData(custom_id))
                    if not deleted:
                        deleted = bool(timeline.DeleteMarkerAtFrame(previous_frame))
                except Exception:
                    deleted = False
                if not deleted:
                    failed += 1
                    continue
                existing_markers.pop(previous_frame, None)
                existing_by_custom.pop(custom_id, None)
                updated += 1
                marker_updated = True

            # Resolve tillater én timeline-markør per frame. En umanaged
            # markør med nøyaktig samme innhold er en Resolve-opprettet review-
            # markør som nettopp kom tilbake fra backend: adopter den ved å
            # erstatte den med samme markør + vår stabile customData. En annen
            # markør på framen røres aldri.
            if frame in existing_markers:
                ex = existing_markers[frame]
                ex_custom = (ex.get("customData") or "").strip()
                exact_unmanaged_match = (
                    not ex_custom
                    and (ex.get("name") or "") == label
                    and (ex.get("note") or "") == note
                    and (ex.get("color") or "Blue") == color
                )
                if exact_unmanaged_match:
                    try:
                        if not timeline.DeleteMarkerAtFrame(frame):
                            failed += 1
                            continue
                        existing_markers.pop(frame, None)
                        updated += 1
                        marker_updated = True
                    except Exception:
                        failed += 1
                        continue
                elif ex_custom != custom_id:
                    skipped += 1
                    conflicts += 1
                    continue

            ok = timeline.AddMarker(frame, color, label, note, 1, custom_id)
            if ok:
                if not marker_updated: added += 1
                existing_markers[frame] = {
                    "name": label,
                    "note": note,
                    "color": color,
                    "customData": custom_id,
                }
                existing_by_custom[custom_id] = (frame, existing_markers[frame])
            else:
                failed += 1
        except Exception as exc:
            bridge.warn(f"Push av markør {m.get('id')} feilet: {exc}")
            failed += 1

    # Cloud-side deletion may remove a review comment. Propagate that only for
    # IDs owned by this Video Room bridge; other CE/AP markers are untouched.
    if remove_missing_creatorhub:
        for custom_id, (marker_frame, _info) in list(existing_by_custom.items()):
            managed = custom_id.startswith("ce:creatorhub:") or custom_id.startswith("ce:resolve-native:")
            if not managed or custom_id in desired_custom_ids:
                continue
            try:
                deleted = False
                if hasattr(timeline, "DeleteMarkerByCustomData"):
                    deleted = bool(timeline.DeleteMarkerByCustomData(custom_id))
                if not deleted:
                    deleted = bool(timeline.DeleteMarkerAtFrame(marker_frame))
                if deleted:
                    removed += 1
            except Exception as exc:
                bridge.warn(f"Sletting av utgått Video Room-markør feilet: {exc}")
                failed += 1

    bridge.result({
        "added": added,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "removed": removed,
        "conflicts": conflicts,
        "totalSent": len(markers_in),
        "timelineFrames": duration,
        "fps": fps,
    })


bridge.main_guard(run)

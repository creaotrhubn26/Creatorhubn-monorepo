"""Apply a Music Video Agent look to one exact Resolve timeline.

Resolve 21.1 exposes TimelineItem.GetNodeGraph() and Graph.SetLUT(). This
script uses only those documented APIs: it never invents nodes and it skips
items that already have a multi-node graph or an existing LUT by default.
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


LUT_ROOTS = (
    "/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT",
    os.path.expanduser("~/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT"),
)

LOOK_LUT_FILES = {
    "cinematic-film": "Rec709 Kodak 2383 D60.cube",
    "neon-night": "Color - Le Reve V.cube",
    "gritty-documentary": "Rec709 Fujifilm 3513DI D55.cube",
    "stadium-performance": "Rec709 Kodak 2383 D65.cube",
    "lo-fi-vhs": "WIR Timbre 03.cube",
    "minimal-modern": "WIR Dolce 02.cube",
    "sun-bleached": "WIR Dolce 04.cube",
    "underground-club": "Color - Le Reve VI.cube",
}


def _find_lut(look_pack: str, explicit_path: str = "") -> str | None:
    if explicit_path and os.path.isfile(explicit_path):
        candidate = os.path.realpath(explicit_path)
        allowed_roots = [os.path.realpath(root) for root in LUT_ROOTS]
        if candidate.lower().endswith(".cube") and any(
            os.path.commonpath([candidate, root]) == root for root in allowed_roots
        ):
            return candidate
        return None
    wanted = LOOK_LUT_FILES.get(look_pack)
    if not wanted:
        return None
    for root in LUT_ROOTS:
        if not os.path.isdir(root):
            continue
        for directory, _folders, files in os.walk(root):
            if wanted in files:
                return os.path.join(directory, wanted)
    return None


def _find_timeline(project, unique_id: str, name: str):
    for index in range(1, int(project.GetTimelineCount() or 0) + 1):
        timeline = project.GetTimelineByIndex(index)
        if not timeline:
            continue
        try:
            timeline_id = timeline.GetUniqueId() or ""
        except Exception:  # noqa: BLE001
            timeline_id = ""
        if unique_id and timeline_id == unique_id:
            return timeline
        if not unique_id and name and (timeline.GetName() or "") == name:
            return timeline
    return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    look_pack = str(params.get("lookPack") or "").strip()
    timeline_id = str(params.get("timelineUniqueId") or "").strip()
    timeline_name = str(params.get("timelineName") or "").strip()
    expected_project_id = str(params.get("projectId") or "").strip()
    respect_existing = bool(params.get("respectExistingWork", True))
    lut_path = _find_lut(look_pack, str(params.get("lutPath") or "").strip())

    if not expected_project_id or not timeline_id:
        bridge.error("Look-operasjonen krever eksakt prosjekt-ID og timeline-ID.")
        return
    if not lut_path:
        bridge.error(f"Fant ingen installert LUT for look-pack '{look_pack}'.")
        return
    if dry_run:
        bridge.result({
            "wouldApply": True,
            "lookPack": look_pack,
            "lutPath": lut_path,
            "timelineUniqueId": timeline_id or None,
            "timelineName": timeline_name or None,
            "respectExistingWork": respect_existing,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    try:
        project_id = project.GetUniqueId() or ""
    except Exception:  # noqa: BLE001
        project_id = ""
    if expected_project_id and project_id != expected_project_id:
        bridge.error("Aktivt Resolve-prosjekt er ikke prosjektet som ble godkjent.")
        return

    timeline = _find_timeline(project, timeline_id, timeline_name)
    if not timeline:
        bridge.error("Fant ikke den eksakte Music Video-timelinen som skulle grades.")
        return
    if not project.SetCurrentTimeline(timeline):
        bridge.error("Resolve kunne ikke aktivere mål-timelinen for grading.")
        return

    applied = 0
    skipped_existing = 0
    skipped_no_node = 0
    errors: list[str] = []
    for track_index in range(1, int(timeline.GetTrackCount("video") or 0) + 1):
        for item in timeline.GetItemListInTrack("video", track_index) or []:
            try:
                graph = item.GetNodeGraph()
                node_count = int(graph.GetNumNodes() or 0) if graph else 0
                existing_lut = graph.GetLUT(1) if graph and node_count >= 1 else ""
                if node_count < 1:
                    skipped_no_node += 1
                    continue
                if respect_existing and (node_count > 1 or existing_lut):
                    skipped_existing += 1
                    continue
                if graph.SetLUT(1, lut_path):
                    applied += 1
                else:
                    errors.append(f"{item.GetName() or '?'}: SetLUT returned false")
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{item.GetName() or '?'}: {exc}")

    bridge.result({
        "timelineName": timeline.GetName() or timeline_name,
        "timelineUniqueId": timeline_id or None,
        "lookPack": look_pack,
        "lutPath": lut_path,
        "clipsProcessed": applied,
        "skippedExisting": skipped_existing,
        "skippedNoNode": skipped_no_node,
        "errorCount": len(errors),
        "errors": errors[:20],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

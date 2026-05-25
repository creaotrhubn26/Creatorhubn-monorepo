"""Backup Project — exports DRP, timeline XML and a marker report to a backup folder."""

from __future__ import annotations

import os
import sys
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    backup_folder = params.get("backupFolder") or os.path.expanduser("~/Documents/Resolve Backups")

    if dry_run:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        bridge.result({
            "summary": f"Dry run — would export DRP + XML + markers to {backup_folder}",
            "willCreate": [
                f"{backup_folder}/<ProjectName>_{ts}.drp",
                f"{backup_folder}/<ProjectName>_{ts}_<TimelineName>.xml",
                f"{backup_folder}/<ProjectName>_{ts}_markers.csv",
            ],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    os.makedirs(backup_folder, exist_ok=True)
    project_name = conn.project.GetName().replace("/", "_").replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    drp_path = os.path.join(backup_folder, f"{project_name}_{timestamp}.drp")
    drp_ok = False
    try:
        drp_ok = conn.project_manager.ExportProject(project_name, drp_path)
    except Exception as exc:
        bridge.warn(f"ExportProject raised: {exc}")

    timeline_count = conn.project.GetTimelineCount()
    xml_paths: list[str] = []
    for idx in range(1, timeline_count + 1):
        timeline = conn.project.GetTimelineByIndex(idx)
        if not timeline:
            continue
        tname = timeline.GetName().replace("/", "_").replace(" ", "_")
        xml_path = os.path.join(backup_folder, f"{project_name}_{timestamp}_{tname}.xml")
        try:
            if timeline.Export(xml_path, conn.resolve.EXPORT_FCPXML_1_8):
                xml_paths.append(xml_path)
        except Exception as exc:
            bridge.warn(f"Export of timeline '{tname}' failed: {exc}")

    current = conn.project.GetCurrentTimeline()
    markers_path = None
    if current:
        markers = current.GetMarkers() or {}
        markers_path = os.path.join(backup_folder, f"{project_name}_{timestamp}_markers.json")
        with open(markers_path, "w", encoding="utf-8") as fh:
            json.dump({"timeline": current.GetName(), "markers": markers}, fh, indent=2)

    bridge.result({
        "backupFolder": backup_folder,
        "drpPath": drp_path if drp_ok else None,
        "drpExportSucceeded": drp_ok,
        "timelineXmlPaths": xml_paths,
        "markersJsonPath": markers_path,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

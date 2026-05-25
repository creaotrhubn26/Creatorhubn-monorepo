"""Batch Render All Timelines — queues a render per approved timeline + optional start."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


DEFAULT_APPROVED = ["Trailer", "Highlight", "Full Wedding Film", "Speeches", "Ceremony"]


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Movies/Renders")
    approved = params.get("approvedTimelineNames") or DEFAULT_APPROVED
    preset = params.get("presetName") or "H.264 Master"
    start_render = bool(params.get("startRender", False))

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would queue {len(approved)} render jobs (one per timeline) using preset '{preset}'",
            "outputFolder": output_folder,
            "timelines": approved,
            "startRender": start_render,
            "warning": "Real render is HIGH RISK — confirm DRP backup ran first",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    project = conn.project
    os.makedirs(output_folder, exist_ok=True)

    count = project.GetTimelineCount()
    timeline_by_name: dict = {}
    for idx in range(1, count + 1):
        tl = project.GetTimelineByIndex(idx)
        if tl:
            timeline_by_name[tl.GetName()] = tl

    available_presets = project.GetRenderPresetList() or []
    preset_to_load = preset if preset in available_presets else None
    if not preset_to_load:
        bridge.warn(f"Preset '{preset}' not found. Available: {available_presets[:6]}…")

    queued: list[dict] = []
    skipped: list[dict] = []
    failed: list[dict] = []
    job_ids: list[str] = []

    for name in approved:
        tl = timeline_by_name.get(name)
        if not tl:
            skipped.append({"timeline": name, "reason": "not found in project"})
            continue
        if not project.SetCurrentTimeline(tl):
            failed.append({"timeline": name, "error": "SetCurrentTimeline returned false"})
            continue

        if preset_to_load:
            project.LoadRenderPreset(preset_to_load)

        safe_name = name.replace("/", "_").replace(" ", "_")
        try:
            project.SetRenderSettings({
                "TargetDir": output_folder,
                "CustomName": safe_name,
                "ExportVideo": True,
                "ExportAudio": True,
            })
            job_id = project.AddRenderJob()
        except Exception as exc:
            failed.append({"timeline": name, "error": str(exc)})
            continue

        if job_id:
            queued.append({"timeline": name, "jobId": job_id, "outputName": safe_name})
            job_ids.append(job_id)
        else:
            failed.append({"timeline": name, "error": "AddRenderJob returned no ID"})

    if start_render and job_ids:
        try:
            project.StartRendering(job_ids, False)
            bridge.log(f"Rendering started — {len(job_ids)} jobs in queue")
        except Exception as exc:
            bridge.warn(f"StartRendering raised: {exc}")

    bridge.result({
        "outputFolder": output_folder,
        "presetUsed": preset_to_load,
        "queued": queued,
        "skipped": skipped,
        "failed": failed,
        "renderStarted": start_render,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

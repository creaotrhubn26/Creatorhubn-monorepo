"""Create Render Queue — adds render jobs from named presets (YouTube 4K, Reel, Review …)."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


DEFAULT_PRESETS = [
    "YouTube 4K",
    "Instagram Reel",
    "Client Review 1080p",
    "Archive ProRes",
    "Full Wedding Film",
    "Trailer",
    "Highlight",
]


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Movies/Resolve Renders")
    presets = params.get("presets") or DEFAULT_PRESETS

    bridge.log(f"Preparing {len(presets)} render jobs in {output_folder}")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would queue {len(presets)} render jobs",
            "outputFolder": output_folder,
            "presetsToQueue": presets,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    project = conn.project
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline.")
        sys.exit(1)

    os.makedirs(output_folder, exist_ok=True)
    project_name = project.GetName().replace("/", "_")

    available = project.GetRenderPresetList() or []
    available_lower = {p.lower(): p for p in available}

    jobs: list[dict] = []
    for preset in presets:
        matched = available_lower.get(preset.lower())
        if not matched:
            bridge.warn(f"Preset '{preset}' not found in project — skipping")
            jobs.append({"preset": preset, "queued": False, "reason": "preset_not_found"})
            continue
        if not project.LoadRenderPreset(matched):
            jobs.append({"preset": preset, "queued": False, "reason": "load_failed"})
            continue
        target_path = os.path.join(output_folder, project_name)
        project.SetRenderSettings({
            "TargetDir": output_folder,
            "CustomName": f"{project_name}_{preset.replace(' ', '_')}",
        })
        job_id = project.AddRenderJob()
        jobs.append({"preset": preset, "queued": bool(job_id), "jobId": job_id, "targetDir": output_folder})

    bridge.result({
        "outputFolder": output_folder,
        "jobs": jobs,
        "queued": sum(1 for j in jobs if j["queued"]),
        "skipped": sum(1 for j in jobs if not j["queued"]),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

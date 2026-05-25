"""Export Social Versions — queues a render job per aspect ratio with Smart Reframe."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


RATIO_FRAME_SIZES = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1":  (1080, 1080),
    "4:5":  (1080, 1350),
    "2:3":  (1080, 1620),
}


DEFAULT_RATIOS = ["16:9", "9:16", "1:1", "4:5"]


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Movies/Social")
    ratios = params.get("aspectRatios") or DEFAULT_RATIOS
    base_name = params.get("baseName", "Social")
    start_render = bool(params.get("startRender", False))

    unknown = [r for r in ratios if r not in RATIO_FRAME_SIZES]
    if unknown:
        bridge.error(f"Unknown aspect ratios: {unknown}. Supported: {list(RATIO_FRAME_SIZES)}")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would queue {len(ratios)} render jobs ({', '.join(ratios)}) with Smart Reframe",
            "outputFolder": output_folder,
            "frameSizes": {r: RATIO_FRAME_SIZES[r] for r in ratios},
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline")
        sys.exit(1)

    os.makedirs(output_folder, exist_ok=True)

    queued: list[dict] = []
    failed: list[dict] = []
    job_ids: list[str] = []

    for ratio in ratios:
        width, height = RATIO_FRAME_SIZES[ratio]
        custom_name = f"{base_name}_{ratio.replace(':', 'x')}"
        settings = {
            "TargetDir": output_folder,
            "CustomName": custom_name,
            "FormatWidth": width,
            "FormatHeight": height,
            "VideoCodec": "H.264",
            "AudioCodec": "AAC",
            "ExportVideo": True,
            "ExportAudio": True,
            "VideoQuality": "Automatic best",
            # Reframe — Resolve names this differently per build; "Reframe" usually maps to Smart Reframe
            "ReframeMode": "Smart Reframe",
        }
        try:
            conn.project.SetRenderSettings(settings)
            job_id = conn.project.AddRenderJob()
        except Exception as exc:
            failed.append({"ratio": ratio, "error": str(exc)})
            continue

        if job_id:
            queued.append({"ratio": ratio, "jobId": job_id, "frameSize": [width, height], "name": custom_name})
            job_ids.append(job_id)
        else:
            failed.append({"ratio": ratio, "error": "AddRenderJob returned no ID"})

    if start_render and job_ids:
        try:
            conn.project.StartRendering(job_ids, False)
            bridge.log(f"Started rendering {len(job_ids)} jobs")
        except Exception as exc:
            bridge.warn(f"StartRendering raised: {exc}")

    bridge.result({
        "outputFolder": output_folder,
        "queuedJobs": queued,
        "failed": failed,
        "renderStarted": start_render,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

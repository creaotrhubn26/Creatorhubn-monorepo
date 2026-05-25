"""Export Client Review — H.264 1080p render job for the current timeline."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Movies/Client Reviews")
    filename_prefix = params.get("filenamePrefix", "Couple_Highlight_Review")
    version = params.get("version", "V01")
    add_watermark = bool(params.get("addWatermark", False))
    start_render = bool(params.get("startRender", False))

    target_name = f"{filename_prefix}_{version}"

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would queue render {target_name}.mp4 (H.264 1080p)",
            "targetFolder": output_folder,
            "watermark": add_watermark,
            "startRenderAfterQueue": start_render,
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

    # Prefer to load a built-in "YouTube 1080p" preset if available
    available = conn.project.GetRenderPresetList() or []
    loaded_preset = None
    for candidate in ("YouTube 1080p", "H.264 Master", "Vimeo 1080p", "MP4"):
        if candidate in available:
            if conn.project.LoadRenderPreset(candidate):
                loaded_preset = candidate
                break
    if not loaded_preset:
        bridge.warn("No matching built-in render preset found — falling back to manual H.264 settings")

    settings = {
        "TargetDir": output_folder,
        "CustomName": target_name,
        "VideoQuality": "Automatic best",
        "ExportVideo": True,
        "ExportAudio": True,
    }
    if not loaded_preset:
        settings.update({
            "FormatWidth": 1920,
            "FormatHeight": 1080,
            "VideoCodec": "H.264",
            "AudioCodec": "AAC",
            "AudioBitDepth": 16,
        })

    try:
        conn.project.SetRenderSettings(settings)
    except Exception as exc:
        bridge.warn(f"SetRenderSettings raised: {exc}")

    job_id = conn.project.AddRenderJob()
    if not job_id:
        bridge.error("AddRenderJob returned no ID — check render settings + permissions")
        sys.exit(1)

    if start_render:
        try:
            conn.project.StartRendering([job_id], False)
            bridge.log(f"Rendering started for job {job_id}")
        except Exception as exc:
            bridge.warn(f"StartRendering raised: {exc}")

    bridge.result({
        "targetFolder": output_folder,
        "targetName": f"{target_name}.mp4",
        "presetUsed": loaded_preset,
        "jobId": job_id,
        "renderStarted": start_render,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

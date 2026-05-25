"""Get Media Pool State — read-only snapshot of the current Resolve project.

Returns bins (recursive tree), clip counts/sizes per bin, timelines, current page,
and render-queue status. Drives the Live Media Pool sidebar in the Tauri app.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def walk_bin(folder, depth: int = 0) -> dict:
    """Recursive bin → tree node."""
    try:
        name = folder.GetName()
    except Exception:
        name = "(unknown)"
    try:
        clips = folder.GetClipList() or []
    except Exception:
        clips = []
    try:
        subs = folder.GetSubFolderList() or []
    except Exception:
        subs = []

    clip_summary = []
    total_bytes = 0
    for clip in clips[:200]:  # cap per bin
        try:
            props = clip.GetClipProperty() or {}
        except Exception:
            continue
        size = 0
        path = props.get("File Path", "")
        if path:
            try:
                size = os.path.getsize(path) if os.path.isfile(path) else 0
            except OSError:
                size = 0
        total_bytes += size
        clip_summary.append({
            "name": clip.GetName(),
            "type": props.get("Type", ""),
            "fps": props.get("FPS"),
            "resolution": props.get("Resolution"),
            "duration": props.get("Duration"),
            "startTc": props.get("Start TC"),
            "fileSize": size,
            "filePath": path,
        })

    return {
        "name": name,
        "depth": depth,
        "clipCount": len(clips),
        "totalBytes": total_bytes,
        "clips": clip_summary,
        "subBins": [walk_bin(sub, depth + 1) for sub in subs],
    }


def run(params: dict, dry_run: bool) -> None:
    include_clips = bool(params.get("includeClips", True))
    max_clips_per_bin = int(params.get("maxClipsPerBin", 50))

    if dry_run:
        bridge.result({
            "summary": "Dry run — would snapshot current Resolve project's Media Pool + Timelines + render queue",
            "outputShape": {
                "projectName": "str",
                "currentPage": "str",
                "rootBin": "{ recursive tree of bins + clip summaries }",
                "timelines": "[{ name, trackCount, duration }]",
                "renderQueue": "[{ jobId, name, status }]",
            },
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    project = conn.project
    root = conn.media_pool.GetRootFolder()
    snapshot: dict = {
        "projectName": project.GetName(),
    }

    try:
        snapshot["currentPage"] = conn.resolve.GetCurrentPage()
    except Exception:
        snapshot["currentPage"] = None

    # Bin tree
    if include_clips:
        snapshot["rootBin"] = walk_bin(root)
    else:
        snapshot["rootBin"] = {"name": root.GetName(), "clipCount": 0, "subBins": []}

    # Timelines
    timeline_count = project.GetTimelineCount()
    timelines = []
    current_tl = None
    try:
        current_tl = project.GetCurrentTimeline()
    except Exception:
        pass
    for idx in range(1, timeline_count + 1):
        tl = project.GetTimelineByIndex(idx)
        if not tl:
            continue
        try:
            timelines.append({
                "name": tl.GetName(),
                "startFrame": int(tl.GetStartFrame() or 0),
                "endFrame": int(tl.GetEndFrame() or 0),
                "videoTracks": tl.GetTrackCount("video"),
                "audioTracks": tl.GetTrackCount("audio"),
                "isCurrent": bool(current_tl and tl.GetName() == current_tl.GetName()),
            })
        except Exception:
            continue
    snapshot["timelines"] = timelines

    # Render queue (best-effort — API varies)
    render_jobs = []
    try:
        jobs = project.GetRenderJobList() or []
        for job in jobs[:20]:
            render_jobs.append({
                "jobId": job.get("JobId"),
                "name": job.get("RenderJobName") or job.get("JobName"),
                "status": project.GetRenderJobStatus(job.get("JobId")) if hasattr(project, "GetRenderJobStatus") else None,
                "targetDir": job.get("TargetDir"),
            })
    except Exception:
        pass
    snapshot["renderQueue"] = render_jobs
    snapshot["renderQueueCount"] = len(render_jobs)

    bridge.result(snapshot)


if __name__ == "__main__":
    bridge.main_guard(run)

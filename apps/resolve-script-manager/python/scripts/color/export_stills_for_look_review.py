"""Export Stills for Look Review — exports stills from key-scene markers for client review."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


KEY_SCENE_PATTERNS = [
    "bride", "groom", "ceremony", "portrait", "reception",
    "speech", "first_dance", "party", "dance", "drone",
]


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Documents/Look Reviews")
    format_choice = params.get("format", "png")  # png | jpg | dpx | tif

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would export 1 still per key-scene marker on the current timeline",
            "outputFolder": output_folder,
            "format": format_choice,
            "keyScenes": KEY_SCENE_PATTERNS,
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
    project_name = conn.project.GetName().replace("/", "_").replace(" ", "_")

    markers = timeline.GetMarkers() or {}
    if not markers:
        bridge.warn("No markers on current timeline. Run add_scene_markers first.")
        bridge.result({"stillsExported": 0})
        return

    # Pick one frame per matching scene marker
    matched: list[tuple[int, str]] = []
    for frame, data in sorted(markers.items()):
        name = (data or {}).get("name", "")
        if not name:
            continue
        if any(pattern in name.lower() for pattern in KEY_SCENE_PATTERNS):
            matched.append((int(frame), name))

    if not matched:
        bridge.warn("No scene markers matched the key-scene patterns. Add markers with scene names like 'bride_prep', 'ceremony', etc.")
        bridge.result({"stillsExported": 0, "markersOnTimeline": len(markers)})
        return

    exported: list[dict] = []
    failed: list[dict] = []
    for frame, name in matched:
        # Navigate playhead to the marker frame, then GrabStill on the current clip
        try:
            timeline.SetCurrentTimecode(_frame_to_tc(frame, timeline))
        except Exception as exc:
            failed.append({"marker": name, "error": f"SetCurrentTimecode: {exc}"})
            continue

        try:
            still = timeline.GrabStill()
        except Exception as exc:
            failed.append({"marker": name, "error": f"GrabStill: {exc}"})
            continue
        if not still:
            failed.append({"marker": name, "error": "GrabStill returned None"})
            continue

        safe_name = name.replace("/", "_").replace(" ", "_")
        gallery = conn.project.GetGallery() if hasattr(conn.project, "GetGallery") else None
        if gallery and hasattr(gallery, "ExportStill"):
            target = os.path.join(output_folder, f"{project_name}_{safe_name}.{format_choice}")
            try:
                ok = gallery.ExportStill(still, target, format_choice.upper())
                if ok:
                    exported.append({"marker": name, "path": target})
                    continue
            except Exception as exc:
                bridge.warn(f"ExportStill raised for {name}: {exc}")

        # Some Resolve builds expose ExportStills on the timeline still object directly
        target = os.path.join(output_folder, f"{project_name}_{safe_name}.{format_choice}")
        try:
            if hasattr(still, "ExportStill"):
                ok = still.ExportStill(target, format_choice.upper())
                if ok:
                    exported.append({"marker": name, "path": target})
                    continue
        except Exception as exc:
            failed.append({"marker": name, "error": f"still.ExportStill: {exc}"})
            continue

        failed.append({"marker": name, "error": "No ExportStill path succeeded"})

    bridge.result({
        "outputFolder": output_folder,
        "format": format_choice,
        "exported": exported,
        "failed": failed,
        "markersMatched": len(matched),
    })


def _frame_to_tc(frame: int, timeline) -> str:
    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 25)
    except (TypeError, ValueError):
        fps = 25.0
    total_seconds = frame / fps
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    frames = int((total_seconds - int(total_seconds)) * fps)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}:{frames:02d}"


if __name__ == "__main__":
    bridge.main_guard(run)

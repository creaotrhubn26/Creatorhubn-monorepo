"""Create Highlight Rough Cut — builds Highlight_Edit_Draft_V01 by filtering tagged clips.

Strategy:
  1. Scan Media Pool for clips that have any of `params.tags` in their marker-notes or marker-names.
  2. If `params.rankedClips` is provided (from analyze_clips_for_highlights), use that ranking
     instead — pick highest-scoring clips first.
  3. Cap total duration at `params.maxDurationSeconds`.
  4. Create timeline `params.timelineName` and append picked clips.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


TEMPLATE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "templates",
    "wedding_bins.json",
)


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def clip_matches_tags(clip, tags: set[str]) -> bool:
    try:
        markers = clip.GetMarkers() or {}
    except Exception:
        return False
    for data in markers.values():
        name = ((data or {}).get("name") or "").lower()
        note = ((data or {}).get("note") or "").lower()
        for tag in tags:
            if tag.lower() in name or tag.lower() in note:
                return True
    return False


def clip_duration_seconds(clip) -> float:
    try:
        props = clip.GetClipProperty() or {}
        duration_tc = props.get("Duration", "00:00:00:00")
        fps_str = props.get("FPS", "25")
        fps = float(fps_str)
        parts = duration_tc.split(":")
        if len(parts) == 4:
            h, m, s, f = (int(p) for p in parts)
            return h * 3600 + m * 60 + s + f / fps
    except (ValueError, AttributeError):
        pass
    return 0.0


def run(params: dict, dry_run: bool) -> None:
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as fh:
        defaults = json.load(fh)["highlightTags"]

    tags = set(params.get("tags") or defaults)
    max_duration = int(params.get("maxDurationSeconds", 240))
    ranked_clips = params.get("rankedClips") or []
    timeline_name = params.get("timelineName", "Highlight_Edit_Draft_V01")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would assemble '{timeline_name}' (≤{max_duration}s) from tagged clips",
            "tags": sorted(tags),
            "usingVisionRanking": bool(ranked_clips),
            "rankedClipCount": len(ranked_clips),
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    all_clips: list = []
    walk_clips(conn.media_pool.GetRootFolder(), all_clips)
    bridge.log(f"Scanning {len(all_clips)} clips")

    by_basename: dict = {}
    for clip in all_clips:
        try:
            by_basename[clip.GetName()] = clip
        except Exception:
            continue

    # Pick candidate clips
    candidates: list = []
    if ranked_clips:
        for entry in ranked_clips:
            clip_name = (entry or {}).get("clipName")
            if clip_name and clip_name in by_basename:
                candidates.append(by_basename[clip_name])
    else:
        candidates = [c for c in all_clips if clip_matches_tags(c, tags)]

    if not candidates:
        bridge.warn("No candidate clips found. Either tag clips with markers matching the requested tags, or pass rankedClips from analyze_clips_for_highlights.")
        bridge.result({"timelineName": timeline_name, "clipsAppended": 0})
        return

    # Cap by duration
    picked: list = []
    used_seconds = 0.0
    for clip in candidates:
        dur = clip_duration_seconds(clip)
        if dur <= 0:
            continue
        if used_seconds + dur > max_duration and picked:
            break
        picked.append(clip)
        used_seconds += dur

    bridge.log(f"Picked {len(picked)} clips totalling {used_seconds:.1f}s (cap {max_duration}s)")

    # Create timeline and append
    timeline = conn.media_pool.CreateEmptyTimeline(timeline_name)
    if not timeline:
        bridge.error(f"CreateEmptyTimeline('{timeline_name}') returned None — name may already exist")
        sys.exit(1)

    conn.project.SetCurrentTimeline(timeline)
    appended = conn.media_pool.AppendToTimeline(picked) or []

    bridge.result({
        "timelineName": timeline_name,
        "candidatesFound": len(candidates),
        "clipsAppended": len(appended),
        "totalDurationSeconds": round(used_seconds, 1),
        "maxDurationSeconds": max_duration,
        "sourceRanking": "vision" if ranked_clips else "marker_tags",
    })


if __name__ == "__main__":
    bridge.main_guard(run)

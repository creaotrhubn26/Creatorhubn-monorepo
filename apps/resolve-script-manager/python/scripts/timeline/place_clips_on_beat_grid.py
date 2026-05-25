"""Place Clips on Beat Grid — builds a beat-aligned timeline.

Replaces the sequential placement of place_clips_on_timeline for music-video
work. Each clip is dropped at its assigned beat-segment with trim-to-duration
so cuts land exactly on beats.

Resolve Scripting note:
`media_pool.AppendToTimeline(clips_list)` accepts either MediaPoolItem objects
(plays the whole clip) or dicts of {mediaPoolItem, startFrame, endFrame} for
trimmed insertion. We use the trimmed form so each clip fits its segment.

Params:
  segments:       output from assign_clips_to_beats (required)
  musicPath:      music file to drop on audio track A6 (optional)
  timelineName:   timeline name (default "Beat_Cut_V01")
  targetFps:      timeline FPS (default 25)

Output:
  timelineCreated, timelineName, segmentsPlaced, musicAdded
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _seconds_to_frames(seconds: float, fps: float) -> int:
    return int(round(seconds * fps))


def _seconds_to_clip_frames(media_item, segment_dur_sec: float, fps: float) -> tuple[int, int]:
    """Return (start_frame, end_frame) inside the source clip — uses first N frames
    matching the segment duration. We trim from clip-start because most music-video
    cuts grab the energetic opening of each shot."""
    try:
        clip_total = int(media_item.GetClipProperty("Frames") or 0)
    except Exception:
        clip_total = 0
    needed = _seconds_to_frames(segment_dur_sec, fps)
    if clip_total > 0 and needed > clip_total:
        # Clip shorter than segment — use the whole thing
        return (0, max(0, clip_total - 1))
    return (0, max(0, needed - 1))


def _load_cached_assignments() -> list:
    """Fallback: read last assign_clips_to_beats segments from disk so this
    step can run independently in the Tauri UI without re-passing them."""
    import json as _json
    cache_path = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_beat_assignments.json"
    )
    if not os.path.isfile(cache_path):
        return []
    try:
        with open(cache_path) as f:
            data = _json.load(f)
            return data.get("segments") or []
    except (OSError, _json.JSONDecodeError):
        return []


def _load_cached_music_path() -> str:
    """Read musicPath from the last detect_music_beats run — same file Bjarne
    pointed at when running Detect Beats, so the timeline gets that exact
    song attached without re-asking."""
    import json as _json
    cache_path = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_beat_session.json"
    )
    if not os.path.isfile(cache_path):
        return ""
    try:
        with open(cache_path) as f:
            data = _json.load(f)
            return data.get("musicPath") or ""
    except (OSError, _json.JSONDecodeError):
        return ""


def run(params: dict[str, Any], dry_run: bool) -> None:
    segments = params.get("segments") or []
    music_path = params.get("musicPath") or params.get("musicFile") or ""
    timeline_name = params.get("timelineName") or "Beat_Cut_V01"
    target_fps = float(params.get("targetFps") or 25)

    if not segments:
        segments = _load_cached_assignments()
        if segments:
            bridge.log(f"Loaded {len(segments)} cached segments from last assign_clips_to_beats run")

    if not music_path:
        cached_music = _load_cached_music_path()
        if cached_music and os.path.isfile(cached_music):
            music_path = cached_music
            bridge.log(f"Using music from last Detect Beats run: {os.path.basename(music_path)}")
        elif cached_music:
            bridge.warn(f"Cached music path missing on disk: {cached_music}")

    if not segments:
        bridge.error(
            "segments[] is required — run assign_clips_to_beats first. "
            "If this is auto_rough_cut, ensure detect_music_beats + assign_clips_to_beats "
            "ran successfully."
        )
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldCreateTimeline": timeline_name,
            "segmentCount": len(segments),
            "musicAttached": bool(music_path),
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    media_pool = conn.media_pool
    project = conn.project

    # Map clipPath → MediaPoolItem (search across all bins recursively)
    clip_paths = {s["clipPath"] for s in segments if s.get("clipPath")}
    bridge.log(f"Resolving {len(clip_paths)} unique clips in Media Pool")

    def index_pool(folder, into: dict) -> None:
        for item in folder.GetClipList() or []:
            try:
                path = item.GetClipProperty("File Path") or ""
            except Exception:
                path = ""
            if path:
                into[path] = item
        for sub in folder.GetSubFolderList() or []:
            index_pool(sub, into)

    media_index: dict = {}
    index_pool(media_pool.GetRootFolder(), media_index)

    # Some clips may not be imported yet — import any missing ones
    missing = [p for p in clip_paths if p not in media_index]
    if missing:
        bridge.log(f"Importing {len(missing)} clips that weren't in Media Pool")
        new_items = media_pool.ImportMedia(missing) or []
        for item in new_items:
            try:
                path = item.GetClipProperty("File Path") or ""
                if path:
                    media_index[path] = item
            except Exception:
                continue

    # Create the timeline
    timeline = media_pool.CreateEmptyTimeline(timeline_name)
    if not timeline:
        bridge.error(f"CreateEmptyTimeline('{timeline_name}') returned None — name may already exist")
        sys.exit(1)
    project.SetCurrentTimeline(timeline)

    # Build the append-list with per-clip trim info + EXPLICIT recordFrame
    # so each clip lands at its beat-window's start time on the timeline.
    # Without recordFrame, AppendToTimeline puts clips sequentially, so any
    # rounding error or duration drift means the cuts no longer land on beats.
    append_specs: list[dict] = []
    skipped = 0
    for i, seg in enumerate(segments):
        bridge.progress(i, len(segments), f"Building segment {i + 1}/{len(segments)}")
        clip_path = seg.get("clipPath")
        media_item = media_index.get(clip_path)
        if not media_item:
            bridge.warn(f"Segment {i}: clip not found in Media Pool ({os.path.basename(clip_path or '?')})")
            skipped += 1
            continue
        seg_dur = seg.get("durationSec") or 0
        start_sec = seg.get("startSec") or 0
        start_f, end_f = _seconds_to_clip_frames(media_item, seg_dur, target_fps)
        record_frame = int(round(start_sec * target_fps))
        append_specs.append({
            "mediaPoolItem": media_item,
            "startFrame": start_f,
            "endFrame": end_f,
            "mediaType": 1,        # video+linked-audio
            "trackIndex": 1,       # V1
            "recordFrame": record_frame,
        })

    if not append_specs:
        bridge.error("No clips could be matched to media-pool items.")
        sys.exit(1)

    bridge.log(f"Appending {len(append_specs)} beat-aligned segments to timeline ({skipped} skipped)")
    bridge.log(f"First segment: clip={os.path.basename(append_specs[0].get('mediaPoolItem').GetName() or '?')} "
               f"frame {append_specs[0]['startFrame']}-{append_specs[0]['endFrame']} "
               f"@ recordFrame {append_specs[0]['recordFrame']}")

    # Resolve's AppendToTimeline returns a LIST of placed TimelineItems
    # (truthy if any landed) or None/empty on failure. Try the rich spec
    # first; if Resolve rejects (some 18.x builds dislike recordFrame),
    # fall back to plain sequential append.
    placed_items = media_pool.AppendToTimeline(append_specs)
    placed_count = len(placed_items) if isinstance(placed_items, list) else 0
    if placed_count == 0:
        bridge.warn(
            f"AppendToTimeline with recordFrame returned {placed_items!r} — "
            "Resolve may not support that spec field on this build. "
            "Falling back to sequential append (cuts will land sequentially, "
            "not beat-aligned)."
        )
        # Strip the placement-control fields for the fallback
        simple_specs = [
            {k: v for k, v in s.items() if k in ("mediaPoolItem", "startFrame", "endFrame")}
            for s in append_specs
        ]
        placed_items = media_pool.AppendToTimeline(simple_specs)
        placed_count = len(placed_items) if isinstance(placed_items, list) else 0

    if placed_count == 0:
        bridge.error(
            f"Resolve rejected both rich + simple AppendToTimeline. "
            f"Tried {len(append_specs)} segments — none placed. "
            "Check Resolve Edit page is active and timeline is selected."
        )
        sys.exit(1)
    bridge.log(f"Placed {placed_count} clips on V1")

    # Add music as a separate audio-only spec on A2 starting at frame 0.
    music_added = False
    music_count = 0
    if music_path and os.path.isfile(music_path):
        bridge.log(f"Importing music: {os.path.basename(music_path)}")
        music_items = media_pool.ImportMedia([music_path]) or []
        if music_items:
            # Try the spec first
            music_spec = [{
                "mediaPoolItem": music_items[0],
                "mediaType": 2,
                "trackIndex": 2,
                "recordFrame": 0,
            }]
            music_placed = media_pool.AppendToTimeline(music_spec)
            music_count = len(music_placed) if isinstance(music_placed, list) else 0
            if music_count == 0:
                bridge.warn("Music spec with recordFrame rejected — trying plain append on A1")
                music_placed = media_pool.AppendToTimeline([{"mediaPoolItem": music_items[0]}])
                music_count = len(music_placed) if isinstance(music_placed, list) else 0
            music_added = music_count > 0
            if music_added:
                bridge.log(f"Music placed: {os.path.basename(music_path)} ({music_count} item(s))")
            else:
                bridge.warn(f"AppendToTimeline returned {music_placed!r} for music — Resolve refused to add it")
        else:
            bridge.warn(f"ImportMedia returned empty for {music_path}")
    elif music_path:
        bridge.warn(f"Music path doesn't exist on disk: {music_path}")

    bridge.result({
        "timelineCreated": True,
        "timelineName": timeline_name,
        "segmentsAttempted": len(append_specs),
        "segmentsPlaced": placed_count,
        "segmentsSkipped": skipped,
        "musicAdded": music_added,
        "musicItemCount": music_count,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

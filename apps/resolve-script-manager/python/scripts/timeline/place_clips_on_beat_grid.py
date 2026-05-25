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


_MOTION_PROFILE_CACHE: dict[str, list[float]] = {}


def _clip_motion_profile(ffmpeg: str, video_path: str, max_seconds: float = 90.0) -> list[float]:
    """Per-second motion profile for a clip — used to find the BEST sub-window
    that matches a segment's energy demand. Values are 0..1, one per second
    of clip (capped at max_seconds for performance). Cached by path so
    re-using a clip across segments doesn't re-probe it.
    """
    if video_path in _MOTION_PROFILE_CACHE:
        return _MOTION_PROFILE_CACHE[video_path]
    import re, subprocess
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-y",
        "-t", f"{max_seconds:.1f}",
        "-i", video_path,
        "-vf", "scale=160:90,scdet=threshold=0:sc_pass=0",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        deltas = [float(m) for m in re.findall(r"lavfi\.scd\.mafd=([\d.]+)", r.stderr)]
    except Exception:  # noqa: BLE001
        deltas = []
    if not deltas:
        _MOTION_PROFILE_CACHE[video_path] = []
        return []
    # Reduce to 1Hz: group every ~fps frames into seconds (assume 24fps if unknown)
    # Simpler: bucket-average deltas into max_seconds buckets.
    secs = min(int(max_seconds), max(1, len(deltas) // 24))
    bucket_size = max(1, len(deltas) // secs)
    profile = []
    for i in range(0, len(deltas), bucket_size):
        chunk = deltas[i:i + bucket_size]
        if not chunk:
            break
        avg = sum(chunk) / len(chunk)
        profile.append(min(1.0, avg / 30.0))
    _MOTION_PROFILE_CACHE[video_path] = profile
    return profile


def _best_window_for_demand(profile: list[float], window_seconds: int, demand: float) -> int:
    """Slide a `window_seconds`-second window over the motion profile, return
    the START SECOND of the window whose mean motion is closest to `demand`.
    Falls back to 0 if profile is too short."""
    if not profile or window_seconds <= 0:
        return 0
    window_seconds = min(window_seconds, len(profile))
    if window_seconds >= len(profile):
        return 0
    best_start = 0
    best_distance = 999.0
    for start in range(len(profile) - window_seconds + 1):
        mean = sum(profile[start:start + window_seconds]) / window_seconds
        d = abs(mean - demand)
        if d < best_distance:
            best_distance = d
            best_start = start
    return best_start


def _resolve_ffmpeg_path() -> str:
    import shutil
    return (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
        or shutil.which("ffmpeg")
        or "/opt/homebrew/bin/ffmpeg"
    )


def _probe_audio_track_count(video_path: str) -> int:
    """Count audio streams in a video file via ffprobe. Returns 0 on failure
    or for files without audio. Used to determine how many audio tracks the
    timeline needs (Canon C80 = 1-2 streams; multi-XLR rigs = 2-4 streams)."""
    import shutil, subprocess
    ffprobe = (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFPROBE")
        or shutil.which("ffprobe")
        or "/opt/homebrew/bin/ffprobe"
    )
    if not os.path.isfile(ffprobe):
        return 0
    try:
        r = subprocess.run(
            [
                ffprobe, "-v", "error",
                "-select_streams", "a",
                "-show_entries", "stream=index",
                "-of", "csv=p=0",
                video_path,
            ],
            capture_output=True, text=True, timeout=15,
        )
        lines = [l for l in (r.stdout or "").splitlines() if l.strip()]
        return len(lines)
    except Exception:  # noqa: BLE001
        return 0


def _seconds_to_clip_frames(
    media_item,
    segment_dur_sec: float,
    fps: float,
    clip_path: str = "",
    energy_demand: float | None = None,
    ffmpeg: str = "",
) -> tuple[int, int]:
    """Return (start_frame, end_frame) inside the source clip.

    If energy_demand + ffmpeg are provided, scans the WHOLE clip and picks
    the sub-window whose motion best matches the demand. Otherwise falls
    back to the first N frames matching the segment duration.
    """
    try:
        clip_total = int(media_item.GetClipProperty("Frames") or 0)
    except Exception:  # noqa: BLE001
        clip_total = 0
    needed = _seconds_to_frames(segment_dur_sec, fps)
    if clip_total > 0 and needed > clip_total:
        return (0, max(0, clip_total - 1))

    if energy_demand is None or not ffmpeg or not clip_path:
        return (0, max(0, needed - 1))

    profile = _clip_motion_profile(ffmpeg, clip_path)
    if not profile:
        return (0, max(0, needed - 1))

    window_seconds = max(1, int(round(segment_dur_sec)))
    best_start_sec = _best_window_for_demand(profile, window_seconds, energy_demand)
    start_f = int(round(best_start_sec * fps))
    end_f = start_f + needed - 1
    if clip_total > 0 and end_f >= clip_total:
        end_f = clip_total - 1
        start_f = max(0, end_f - needed + 1)
    return (start_f, max(start_f, end_f))


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

    # Probe a sample of clips to find the max audio-track count. Canon C80 =
    # typically 1-2 streams; multi-XLR rigs (Sound Devices MixPre etc) may
    # have 2-4. Sample first 10 to balance speed vs. accuracy.
    bridge.log("Probing audio streams in source clips…")
    max_audio_streams = 0
    sample = list(clip_paths)[:10]
    for sp in sample:
        if os.path.isfile(sp):
            n = _probe_audio_track_count(sp)
            if n > max_audio_streams:
                max_audio_streams = n
    if max_audio_streams == 0:
        max_audio_streams = 1  # Default safety — Resolve always creates A1 for linked-audio
    bridge.log(f"Source clips have up to {max_audio_streams} audio stream(s) — linked audio will occupy A1..A{max_audio_streams}")

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

    # CRITICAL: use the timeline's actual fps for recordFrame math.
    try:
        actual_fps = float(timeline.GetSetting("timelineFrameRate") or target_fps)
    except Exception:  # noqa: BLE001
        actual_fps = target_fps
    if abs(actual_fps - target_fps) > 0.01:
        bridge.log(
            f"Re-mapping beat positions from {target_fps} → {actual_fps} fps "
            f"(timeline inherited project setting)"
        )
        target_fps = actual_fps

    # CRITICAL #2: Resolve timelines don't start at frame 0 — they typically
    # start at frame 86400 (= 01:00:00:00 @ 24 fps), per the SMPTE convention.
    # recordFrame is ABSOLUTE timeline frames, so we must offset by the
    # timeline's start frame or clips land BEFORE the timeline begins (i.e.
    # invisible — Resolve clamps them to nothing useful).
    try:
        timeline_start_frame = int(timeline.GetStartFrame() or 0)
    except Exception:  # noqa: BLE001
        timeline_start_frame = 0
    if timeline_start_frame > 0:
        bridge.log(f"Timeline starts at frame {timeline_start_frame} — offsetting recordFrames")

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
        energy_demand = seg.get("energyDemand")  # set by assign_clips_to_beats curve
        start_f, end_f = _seconds_to_clip_frames(
            media_item, seg_dur, target_fps,
            clip_path=clip_path,
            energy_demand=energy_demand,
            ffmpeg=_resolve_ffmpeg_path(),
        )
        # Offset by timeline start (Resolve timelines start at SMPTE 01:00:00:00)
        record_frame = timeline_start_frame + int(round(start_sec * target_fps))
        # NOTE: mediaType in Resolve's API means 1=video-only, 2=audio-only.
        # Omitting it gives the default 'video+linked-audio' behavior — which
        # is what we want so camera audio lands on A1..A_N for sync reference.
        append_specs.append({
            "mediaPoolItem": media_item,
            "startFrame": start_f,
            "endFrame": end_f,
            "trackIndex": 1,       # V1 — linked audio auto-flows to A1..A_N
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

    # Verify by reading back what's actually on V1 — AppendToTimeline can
    # return a non-empty list of items even when they're stacked at frame 0
    # or have 0-frame durations. Reading back via GetItemListInTrack is
    # the source of truth.
    try:
        v1_items = timeline.GetItemListInTrack("video", 1) or []
        if v1_items:
            verified = len(v1_items)
            first = v1_items[0]
            try:
                first_start = first.GetStart()
                first_end = first.GetEnd()
                bridge.log(
                    f"Verified {verified} items on V1. First: '{first.GetName()}' "
                    f"frames {first_start}-{first_end} "
                    f"(timeline fps {target_fps})"
                )
            except Exception:  # noqa: BLE001
                bridge.log(f"Verified {verified} items on V1")
            placed_count = verified
        else:
            bridge.warn(
                f"AppendToTimeline returned {placed_count} items, but V1 reads back as "
                "empty. Resolve accepted the spec but didn't actually place the clips."
            )
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Could not verify V1 contents: {exc}")

    bridge.log(f"Placed {placed_count} clips on V1")

    # Music goes on the track AFTER all the linked-audio tracks from video
    # clips. If video has 2 audio streams, linked-audio = A1+A2, music = A3.
    music_track = max_audio_streams + 1

    # Add music on the correct audio track. Resolve's CreateEmptyTimeline
    # only creates V1+A1 by default — must explicitly add tracks up to
    # music_track before placement.
    music_added = False
    music_count = 0
    if music_path and os.path.isfile(music_path):
        bridge.log(f"Importing music: {os.path.basename(music_path)}")
        music_items = media_pool.ImportMedia([music_path]) or []
        if music_items:
            # Ensure music_track exists
            try:
                existing_audio_tracks = timeline.GetTrackCount("audio")
            except Exception:  # noqa: BLE001
                existing_audio_tracks = 1
            tracks_to_add = max(0, music_track - existing_audio_tracks)
            for _ in range(tracks_to_add):
                try:
                    timeline.AddTrack("audio")
                except Exception as exc:  # noqa: BLE001
                    bridge.warn(f"AddTrack failed: {exc}")
                    break
            if tracks_to_add > 0:
                bridge.log(f"Added {tracks_to_add} audio track(s) — music lands on A{music_track}")

            music_spec = [{
                "mediaPoolItem": music_items[0],
                "mediaType": 2,
                "trackIndex": music_track,
                "recordFrame": timeline_start_frame,
            }]
            music_placed = media_pool.AppendToTimeline(music_spec)
            music_count = len(music_placed) if isinstance(music_placed, list) else 0

            if music_count == 0:
                bridge.warn(f"A{music_track} spec rejected — trying A{music_track} without recordFrame")
                music_placed = media_pool.AppendToTimeline([{
                    "mediaPoolItem": music_items[0],
                    "mediaType": 2,
                    "trackIndex": music_track,
                }])
                music_count = len(music_placed) if isinstance(music_placed, list) else 0

            if music_count == 0:
                bridge.warn("trackIndex spec rejected — trying plain append (will go to end)")
                music_placed = media_pool.AppendToTimeline([{"mediaPoolItem": music_items[0]}])
                music_count = len(music_placed) if isinstance(music_placed, list) else 0

            music_added = music_count > 0

            # Verify by reading back the music track
            try:
                items = timeline.GetItemListInTrack("audio", music_track) or []
                if items:
                    first = items[0]
                    bridge.log(
                        f"Verified A{music_track} (music): '{first.GetName()}' "
                        f"frames {first.GetStart()}-{first.GetEnd()}"
                    )
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"Could not verify music placement: {exc}")

            if music_added:
                bridge.log(f"Music placed: {os.path.basename(music_path)} ({music_count} item(s))")
            else:
                bridge.warn(f"AppendToTimeline returned {music_placed!r} for music — Resolve refused")
        else:
            bridge.warn(f"ImportMedia returned empty for {music_path}")
    elif music_path:
        bridge.warn(f"Music path doesn't exist on disk: {music_path}")

    # Mute every linked-audio track (A1..A_max_audio_streams) so only the
    # music plays. Waveforms stay visible for sync verification.
    muted_tracks: list[int] = []
    if music_added:
        for track_idx in range(1, max_audio_streams + 1):
            try:
                ok = timeline.SetTrackEnable("audio", track_idx, False)
                if ok:
                    muted_tracks.append(track_idx)
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"Could not mute A{track_idx}: {exc}")
        if muted_tracks:
            track_list = ", ".join(f"A{t}" for t in muted_tracks)
            bridge.log(f"Muted {track_list} (camera audio) — A{music_track} (music) plays solo")
        else:
            bridge.warn("SetTrackEnable returned falsy for all linked-audio tracks — mute manually via M button")

    bridge.result({
        "timelineCreated": True,
        "timelineName": timeline_name,
        "segmentsAttempted": len(append_specs),
        "segmentsPlaced": placed_count,
        "segmentsSkipped": skipped,
        "sourceAudioStreams": max_audio_streams,
        "musicAdded": music_added,
        "musicItemCount": music_count,
        "musicTrack": f"A{music_track}",
        "mutedTracks": [f"A{t}" for t in muted_tracks],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

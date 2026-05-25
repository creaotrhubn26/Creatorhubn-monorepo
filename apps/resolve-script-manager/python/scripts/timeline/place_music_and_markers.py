"""Place Music + Beat Markers — adds music to A6 track + Intro/Build/Drop/Soft/Finale markers."""

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


BEAT_COLORS = {
    "Intro": "Sand",
    "Build": "Yellow",
    "Drop": "Red",
    "Soft moment": "Cyan",
    "Finale": "Pink",
}


def run(params: dict, dry_run: bool) -> None:
    music_file = params.get("musicFile")
    beats = params.get("beatTimestamps") or {}  # { label: frame_or_seconds }
    track_index = int(params.get("audioTrackIndex", 6))

    with open(TEMPLATE_PATH, "r", encoding="utf-8") as fh:
        beat_labels = json.load(fh)["musicBeats"]

    if not music_file:
        bridge.error("Missing required input: musicFile")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would place '{os.path.basename(music_file)}' on A{track_index} and add {len(beat_labels)} beat markers",
            "beatLabels": beat_labels,
            "providedTimestamps": list(beats.keys()) if beats else "auto (5 evenly spaced)",
        })
        return

    music_file = os.path.expanduser(music_file)
    if not os.path.isfile(music_file):
        bridge.error(f"Music file does not exist: {music_file}")
        sys.exit(1)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline")
        sys.exit(1)

    # Ensure A6 exists
    while (timeline.GetTrackCount("audio") or 0) < track_index:
        if not timeline.AddTrack("audio"):
            bridge.warn("AddTrack(audio) returned false — track creation stopped")
            break

    # Import music file
    imported = conn.media_pool.ImportMedia([music_file]) or []
    if not imported:
        bridge.error("ImportMedia failed for music file")
        sys.exit(1)

    music_clip = imported[0]
    music_name = music_clip.GetName()
    bridge.log(f"Imported {music_name}")

    # Append to timeline. AppendToTimeline returns the new TimelineItems list.
    appended = conn.media_pool.AppendToTimeline([music_clip]) or []
    if not appended:
        bridge.error("AppendToTimeline failed for music")
        sys.exit(1)

    music_item = appended[0]

    # If the music landed on V1, move it: Resolve auto-appends video+audio. For pure WAV,
    # it usually picks A1 by default; users typically drag it. We can't reliably move tracks
    # post-append via the public API, so we log the location for manual reassignment if needed.
    try:
        track_info = music_item.GetTrack() if hasattr(music_item, "GetTrack") else None
        bridge.log(f"Music placed; manual move to A{track_index} may be required (Resolve API does not expose item-track relocation)")
    except Exception:
        pass

    # Build beat markers
    start_frame = int(timeline.GetStartFrame() or 0)
    end_frame = int(timeline.GetEndFrame() or 0)
    span = max(1, end_frame - start_frame)

    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 25)
    except (TypeError, ValueError):
        fps = 25.0

    added: list[dict] = []
    for idx, label in enumerate(beat_labels):
        ts = beats.get(label)
        if isinstance(ts, (int, float)):
            # Treat large values as frames, small as seconds
            frame_id = int(ts) if ts > 1000 else int(start_frame + ts * fps)
        else:
            frame_id = start_frame + (span * (idx + 1)) // (len(beat_labels) + 1)
        color = BEAT_COLORS.get(label, "Sand")
        try:
            ok = timeline.AddMarker(int(frame_id), color, label, "beat", 1, label)
        except Exception as exc:
            bridge.warn(f"AddMarker failed for '{label}': {exc}")
            ok = False
        added.append({"label": label, "frame": frame_id, "color": color, "ok": bool(ok)})

    bridge.result({
        "musicFile": music_file,
        "musicClipName": music_name,
        "targetAudioTrack": track_index,
        "markersAdded": [m for m in added if m["ok"]],
        "markersFailed": [m for m in added if not m["ok"]],
        "manualStep": f"If music landed on A1, drag it to A{track_index} (Resolve API doesn't expose item-track moves)",
    })


if __name__ == "__main__":
    bridge.main_guard(run)

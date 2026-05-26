"""Apply beat-markers from music_advisor.json to active Resolve timeline.

Output-formatet matcher DaVinci Resolve's `Find Music Beats` (Fairlight) —
samme marker-struktur, så bruker kan snap-til-marker i Edit page enten
markers kommer fra vår scan eller fra Resolve's egne audio-analyse.

Workflow:
  1. scan_and_recommend_music.py er kjørt → music_advisor.json finnes
  2. build_highlight_from_picks.py har bygd timeline med sangene
  3. Åpne timeline i Resolve
  4. Kjør dette → beat-markers blir lagt til på timeline
  5. Snap cuts til markers (Edit page → V/J/L navigering + Z snap)

Input params:
  markerColor:  Resolve marker color (default "Blue")
  songTitle:    optional — apply markers for only this song (else all songs)
  fpsOverride:  optional — override timeline FPS detection
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
ADVISOR_JSON = os.path.join(CACHE_DIR, "music_advisor.json")


def run(params: dict[str, Any], dry_run: bool) -> None:
    if not os.path.isfile(ADVISOR_JSON):
        bridge.error("No music_advisor.json found — run scan_and_recommend_music.py first")
        sys.exit(1)

    with open(ADVISOR_JSON) as f:
        advisor = json.load(f)

    color = (params.get("markerColor") or "Blue").strip()
    song_filter = (params.get("songTitle") or "").strip().lower()
    fps_override = float(params.get("fpsOverride") or 0)

    songs = advisor.get("uniqueSongs", [])
    if song_filter:
        songs = [s for s in songs if song_filter in (s.get("title") or "").lower()]
    if not songs:
        bridge.error("No matching songs in advisor cache")
        sys.exit(1)

    if dry_run:
        total_markers = 0
        for s in songs:
            for sec in s.get("sections", []):
                total_markers += len(sec.get("resolveMarkers", []))
        bridge.result({
            "wouldAddMarkers": total_markers,
            "songs": [{"title": s["title"], "bpm": s.get("bpm")} for s in songs],
        })
        return

    bridge.progress(0, 100, "Connecting to Resolve…")
    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No project open in Resolve")
        sys.exit(1)
    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No active timeline — open one and try again")
        sys.exit(1)

    try:
        timeline_fps = fps_override or float(timeline.GetSetting("timelineFrameRate") or 25.0)
    except Exception:  # noqa: BLE001
        timeline_fps = 25.0
    bridge.log(f"Timeline FPS: {timeline_fps}")

    # Get start-frame of timeline (Resolve uses 1-hour offset by default = 86400 @ 24fps)
    try:
        start_frame = int(timeline.GetStartFrame() or 0)
    except Exception:  # noqa: BLE001
        start_frame = 0

    added = 0
    skipped = 0
    for s_idx, song in enumerate(songs):
        bridge.progress(int(100 * (s_idx + 1) / len(songs)), 100,
                        f"Adding markers for '{song['title'][:30]}'")
        for section in song.get("sections", []):
            # beatTimes are absolute source-video-time. Convert to timeline-frame.
            # In most workflows the timeline is built from a slice of source video
            # placed at timeline-start, so source-time maps directly to timeline-time.
            # If user has multiple clips, this remains an approximation — they can
            # snap markers manually via Resolve's tools.
            for beat_t in section.get("beatTimes", []):
                frame = start_frame + int(round(beat_t * timeline_fps))
                # AddMarker(frame, color, name, note, duration, customData=None)
                bpm = song.get("bpm") or "?"
                name = f"♪ {song['title'][:20]} ({bpm} BPM)"
                note = f"Source @ {beat_t:.3f}s — auto-detected beat"
                try:
                    ok = timeline.AddMarker(frame, color, name, note, 1)
                    if ok:
                        added += 1
                    else:
                        skipped += 1  # likely already a marker at this frame
                except Exception as e:  # noqa: BLE001
                    bridge.warn(f"AddMarker failed @ frame {frame}: {e}")
                    skipped += 1

    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"Added {added} beat-markers ({skipped} skipped — likely duplicates)")
    bridge.result({
        "markersAdded": added,
        "markersSkipped": skipped,
        "songs": [{"title": s["title"], "bpm": s.get("bpm"),
                   "totalBeats": sum(len(sec.get("beatTimes", [])) for sec in s.get("sections", []))}
                  for s in songs],
        "timelineFps": timeline_fps,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

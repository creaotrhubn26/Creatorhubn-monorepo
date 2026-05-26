"""Build Highlight from Picks — second half of the interactive highlight flow.

extract_highlight_from_film (review mode) cached the picks + thumbnails.
The Tauri UI lets the user keep/skip + adjust startSec/endSec per shot.
That UI calls this script with the FINAL picks list to build the Resolve
timeline.

Input params:
  picks:           array of {startSec, endSec, ...} — only those user approved
                    (if omitted, reads last_highlight_picks.json from cache)
  sourceVideo:     absolute path to the source video (if omitted, reads cache)
  timelineName:    name for the new timeline (default 'Highlight — reviewed')
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _load_cached_picks() -> dict:
    path = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_highlight_picks.json"
    )
    if not os.path.isfile(path):
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def run(params: dict[str, Any], dry_run: bool) -> None:
    picks = params.get("picks") or []
    source_video = (params.get("sourceVideo") or "").strip()
    timeline_name = (params.get("timelineName") or "").strip()
    # #432 audio-ducking strategy:
    #   "music_only"     — mute linked audio entirely (default, original behavior)
    #   "dialog_preserve" — keep linked audio + reduce music -6dB so dialog cuts through
    audio_mix = (params.get("audioMix") or "music_only").strip().lower()
    if audio_mix not in ("music_only", "dialog_preserve"):
        audio_mix = "music_only"

    if not picks or not source_video:
        cached = _load_cached_picks()
        if not picks:
            picks = cached.get("picks") or []
        if not source_video:
            source_video = cached.get("sourceVideo") or ""
        if not timeline_name:
            timeline_name = cached.get("timelineName") or "Highlight — reviewed"

    if not picks:
        bridge.error("No picks provided — run extract_highlight_from_film with interactiveReview first")
        sys.exit(1)
    if not source_video or not os.path.isfile(source_video):
        bridge.error(f"sourceVideo '{source_video}' not found on disk")
        sys.exit(1)
    if not timeline_name:
        timeline_name = f"{os.path.splitext(os.path.basename(source_video))[0]} — highlight reviewed"

    total = sum((p.get("endSec", 0) - p.get("startSec", 0)) for p in picks)
    bridge.log(
        f"Building timeline '{timeline_name}' from {len(picks)} approved picks "
        f"(total {total:.1f}s)"
    )

    if dry_run:
        bridge.result({
            "summary": f"Would build '{timeline_name}' from {len(picks)} picks ({total:.0f}s)",
            "picks": picks[:10],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No current Resolve project — open one and try again")
        sys.exit(1)

    media_pool = conn.project.GetMediaPool()
    if not media_pool:
        bridge.error("Could not access Media Pool")
        sys.exit(1)

    # Import (or find) the source video in Media Pool
    bridge.progress(20, 100, "Importing source video…")
    items = media_pool.ImportMedia([source_video]) or []
    if not items:
        bridge.error(f"Could not import {source_video}")
        sys.exit(1)
    source_item = items[0]

    bridge.progress(50, 100, "Creating timeline…")
    # Auto-suffix if a timeline with this name already exists in the project
    timeline = media_pool.CreateEmptyTimeline(timeline_name)
    if not timeline:
        original_name = timeline_name
        for n in range(2, 100):
            candidate = f"{original_name} {n}"
            timeline = media_pool.CreateEmptyTimeline(candidate)
            if timeline:
                timeline_name = candidate
                bridge.log(f"Timeline '{original_name}' existed; created '{candidate}' instead")
                break
        else:
            bridge.error(f"Could not create timeline after 100 attempts (project has > 100 with name '{original_name}'?)")
            sys.exit(1)
    conn.project.SetCurrentTimeline(timeline)

    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 25)
    except Exception:  # noqa: BLE001
        fps = 25.0

    # Sort picks chronologically (UI may reorder, but narrative arc usually = original order)
    picks_sorted = sorted(picks, key=lambda p: float(p.get("startSec") or 0))

    append_specs = []
    for p in picks_sorted:
        start_sec = float(p.get("startSec") or 0)
        end_sec = float(p.get("endSec") or 0)
        if end_sec <= start_sec:
            continue
        start_f = int(round(start_sec * fps))
        end_f = int(round(end_sec * fps)) - 1
        if end_f <= start_f:
            continue
        append_specs.append({
            "mediaPoolItem": source_item,
            "startFrame": start_f,
            "endFrame": end_f,
        })

    if not append_specs:
        bridge.error("No valid picks to append (all had zero duration?)")
        sys.exit(1)

    bridge.progress(80, 100, f"Appending {len(append_specs)} approved shots…")
    placed = media_pool.AppendToTimeline(append_specs)
    placed_count = len(placed) if isinstance(placed, list) else 0

    # Place identified source songs on a separate audio track if available.
    # Each song's startSec on the timeline = where its section landed in the
    # rebuilt highlight (we map original-video-timecode → highlight-timecode).
    songs_placed = []
    songs_cache_path = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_identified_songs.json"
    )
    if os.path.isfile(songs_cache_path):
        try:
            with open(songs_cache_path) as f:
                songs_data = json.load(f)
        except (OSError, json.JSONDecodeError):
            songs_data = {}
        sections = songs_data.get("sections", []) if isinstance(songs_data, dict) else []
        downloaded = [s for s in sections if s.get("downloadedPath") and os.path.isfile(s["downloadedPath"])]
        if downloaded:
            # Determine track number: source has linked audio on A1+
            try:
                existing_audio = timeline.GetTrackCount("audio") or 1
            except Exception:  # noqa: BLE001
                existing_audio = 1
            # Add a new audio track for the source songs
            song_track = existing_audio + 1
            try:
                timeline.AddTrack("audio")
                bridge.log(f"Added A{song_track} for clean source songs")
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"Could not add song track: {exc}")
                song_track = existing_audio

            # Build map: for each downloaded section, find where in the highlight
            # its time-range maps to. The highlight is a sequential cut of picks,
            # so we walk picks_sorted accumulating timeline-time.
            try:
                timeline_start_frame = int(timeline.GetStartFrame() or 0)
            except Exception:  # noqa: BLE001
                timeline_start_frame = 0

            highlight_time = 0.0
            song_placements: list[tuple[str, float, float]] = []  # (path, timeline_start_sec, dur)
            for p in picks_sorted:
                pick_start = float(p.get("startSec") or 0)
                pick_end = float(p.get("endSec") or 0)
                pick_dur = max(0.0, pick_end - pick_start)
                for section in downloaded:
                    sec_start = float(section.get("startSec") or 0)
                    sec_end = float(section.get("endSec") or 0)
                    # Does this section overlap with the pick's source range?
                    overlap_start = max(sec_start, pick_start)
                    overlap_end = min(sec_end, pick_end)
                    if overlap_end > overlap_start:
                        # Place the song at the highlight-timeline position
                        # corresponding to where the overlap starts within the pick
                        offset_in_pick = overlap_start - pick_start
                        timeline_pos = highlight_time + offset_in_pick
                        song_placements.append((
                            section["downloadedPath"],
                            timeline_pos,
                            overlap_end - overlap_start,
                        ))
                highlight_time += pick_dur

            if song_placements:
                # Deduplicate by path (one song imported once, placed multiple times)
                unique_paths = list(dict.fromkeys(p[0] for p in song_placements))
                imported_songs: dict[str, Any] = {}
                for path in unique_paths:
                    items = media_pool.ImportMedia([path]) or []
                    if items:
                        imported_songs[path] = items[0]
                for path, t_start, t_dur in song_placements:
                    item = imported_songs.get(path)
                    if not item:
                        continue
                    record_frame = timeline_start_frame + int(round(t_start * fps))
                    spec = [{
                        "mediaPoolItem": item,
                        "mediaType": 2,
                        "trackIndex": song_track,
                        "recordFrame": record_frame,
                    }]
                    placed_song = media_pool.AppendToTimeline(spec)
                    if isinstance(placed_song, list) and placed_song:
                        songs_placed.append({"path": path, "timelineStartSec": round(t_start, 2)})

                if songs_placed:
                    bridge.log(f"Placed {len(songs_placed)} song instance(s) on A{song_track}")
                    # #53: verify song-placement-overlap before muting linked audio.
                    covered_sec = sum(t_dur for (_p, _ts, t_dur) in song_placements)
                    highlight_sec = total
                    coverage = covered_sec / highlight_sec if highlight_sec > 0 else 0
                    bridge.log(
                        f"Song-coverage check: {covered_sec:.1f}s of "
                        f"{highlight_sec:.1f}s highlight = {coverage:.0%}"
                    )
                    # #432: branch on audioMix strategy
                    if audio_mix == "dialog_preserve":
                        # Keep linked audio audible. Reduce music clip volume so
                        # the camera audio (where dialog/speeches live) cuts
                        # through. Resolve TimelineItem.SetProperty('Volume', n)
                        # is in dB-equivalent units roughly mapping to:
                        #   1.0 = 0dB,   0.5 ≈ -6dB,   0.25 ≈ -12dB
                        try:
                            song_items = timeline.GetItemListInTrack("audio", song_track) or []
                            for itm in song_items:
                                try:
                                    itm.SetProperty("Volume", 0.5)
                                except Exception:  # noqa: BLE001
                                    pass
                            bridge.log(
                                f"audioMix=dialog_preserve — reduced A{song_track} by ~-6dB, "
                                f"kept A1..A{existing_audio} unmuted so dialog cuts through"
                            )
                        except Exception as exc:  # noqa: BLE001
                            bridge.warn(f"Could not lower song volume: {exc}")
                    elif coverage >= 0.6:
                        for t in range(1, existing_audio + 1):
                            try:
                                timeline.SetTrackEnable("audio", t, False)
                            except Exception:  # noqa: BLE001
                                pass
                        bridge.log(
                            f"Muted A1..A{existing_audio} — clean songs cover "
                            f"{coverage:.0%} of highlight, A{song_track} plays solo"
                        )
                    else:
                        bridge.warn(
                            f"Song coverage only {coverage:.0%} of highlight — "
                            f"keeping A1..A{existing_audio} UN-muted so uncovered "
                            "sections aren't silent. Mute manually if you want clean-only."
                        )

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "timelineName": timeline_name,
        "picksApproved": len(picks),
        "shotsPlaced": placed_count,
        "totalDurationSec": round(total, 1),
        "songsPlaced": songs_placed,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

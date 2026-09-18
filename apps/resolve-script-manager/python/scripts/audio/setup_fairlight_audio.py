"""Setup Fairlight Audio — anvender Claude's audio-direction direkte på
Resolve's Fairlight-page.

ffmpeg-side polish (apply_audio_polish.py) lager en NY ferdig MP4. Denne
scripten i stedet konfigurerer Fairlight-tracks slik at Bjarne kan se
+ tweake auto-pilot's audio-arbeid VISUELT i Fairlight-page.

Hva vi gjør på Fairlight-side:
  1. Sjekker eksisterende track-layout. Hvis Bjarne har manuell setup,
     respekterer vi den (legger til markers i stedet for å overskrive).
  2. Setter clip-level volume gain per chapter (Claude's musicVolume/
     ambientVolume).
  3. Legger til markører ved ducking-punkter med customData='ce:audio:'
     prefiks så Bjarne ser hvor systemet ville duke + kan flytte.
  4. Tagger eventuelle nye tracks med "AP: " prefiks.

VIKTIG: Vi kan IKKE legge til VST/AU-plugins via Resolve free Python API
(Studio-only). Bruker referer da til ffmpeg-polish-output. Hvis Bjarne
har Studio kan han manuelt legge inn deesser/EQ-plugins på vår track
basert på vår direction-info som vi setter i markørene.

Conflict-policy:
  - Respekterer eksisterende track-layout
  - Tagger alle våre additions med "AP:" prefiks + customData
  - Lager markører i stedet for å endre clips når mulig
"""

from __future__ import annotations

import math
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _linear_to_db(value: float) -> float:
    """Convert the existing 0-1 direction scale to Resolve's 21.1 dB scale."""
    if value <= 0:
        return -100.0
    return max(-100.0, min(30.0, 20.0 * math.log10(value)))


# Resolve marker-colors mappet til chapter-typer for visuell konsistens
CHAPTER_MARKER_COLOR = {
    "ceremony": "Purple",
    "nikkah":   "Purple",
    "vows":     "Pink",
    "speeches": "Yellow",
    "first_dance": "Cyan",
    "party":    "Green",
    "portrait": "Blue",
    "details":  "Sky",
    "preparation": "Sand",
    "highlight": "Fuchsia",
}


def run(params: dict[str, Any], dry_run: bool) -> None:
    per_chapter = params.get("perChapter") or {}
    pick_chapters = params.get("pickChapters") or []  # [{ pickIndex, chapter, startSec, endSec }]
    overall_lufs = float(params.get("overallLufsTarget") or -14.0)
    respect_existing = bool(params.get("respectExistingWork", True))

    if not per_chapter:
        bridge.error("Ingen perChapter audio-direction i input")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldSetup": True,
            "chapters": list(per_chapter.keys()),
            "lufsTarget": overall_lufs,
            "respectExisting": respect_existing,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen aktiv timeline i Resolve")
        sys.exit(1)

    # Bytt til Fairlight-page slik at API-features er tilgjengelig
    try:
        if hasattr(conn.resolve, "OpenPage"):
            conn.resolve.OpenPage("fairlight")
    except Exception:
        pass

    fps = 24.0
    try:
        fps_str = conn.project.GetSetting("timelineFrameRate")
        if fps_str: fps = float(fps_str)
    except Exception:
        pass

    # SAFETY: respekterer Bjarnes track-layout
    existing_audio_tracks = 0
    try:
        existing_audio_tracks = int(timeline.GetTrackCount("audio") or 0)
    except Exception:
        pass

    bridge.log(f"Fairlight: {existing_audio_tracks} eksisterende audio-tracks, respect_existing={respect_existing}")

    # 1. Legg til markører ved ducking-punkter slik at Bjarne ser dem i
    #    både Edit + Fairlight page
    duck_markers_added = 0
    for pick in pick_chapters:
        ch = (pick.get("chapter") or "details").lower()
        direction = per_chapter.get(ch)
        if not direction:
            continue
        duck_db = float(direction.get("duckingDb", 0))
        if duck_db >= -1.0:  # < 1dB ducking → ikke verdt en markør
            continue
        start_sec = float(pick.get("startSec", 0))
        # Sett markør på pick's start i highlight-timeline-koordinater
        start_frame = int(start_sec * fps)
        try:
            ok = timeline.AddMarker(
                start_frame,
                CHAPTER_MARKER_COLOR.get(ch, "Blue"),
                f"AP: Duck {duck_db:.0f}dB",
                f"{ch}: {direction.get('reasoning', '')}",
                1,
                f"ce:audio:{pick.get('pickIndex')}",
            )
            if ok: duck_markers_added += 1
        except Exception as exc:
            bridge.warn(f"Kunne ikke legge til ducking-markør på frame {start_frame}: {exc}")

    bridge.log(f"Lagt til {duck_markers_added} ducking-markører på timeline")

    # 2. Legg til en summary-markør på frame 0 med LUFS-target + Claude's
    #    overordnede strategi så Bjarne ser hva auto-pilot gjorde
    try:
        summary_note = (
            f"Auto-pilot audio direction\n"
            f"LUFS target: {overall_lufs}\n"
            f"Chapters: {', '.join(per_chapter.keys())}\n\n"
            f"Markører på timelinen viser Claude's ducking-anbefalinger. "
            f"Du kan flytte/slette dem i Fairlight."
        )
        timeline.AddMarker(0, "Cocoa", "AP: Audio Summary", summary_note, 1, "ce:audio:summary")
    except Exception:
        pass

    # 3. Hvis vi har clip-level volume-info: sett gain pr clip basert på
    #    chapter (Bjarne kan da bytte til manual-control i Fairlight om
    #    han vil tweake).
    clips_adjusted = 0
    clips_adjusted_native = 0
    clips_skipped_existing = 0
    try:
        audio_track_count = int(timeline.GetTrackCount("audio") or 0)
        for track_idx in range(1, audio_track_count + 1):
            items = timeline.GetItemListInTrack("audio", track_idx) or []
            for item in items:
                # Bestem chapter via overlap med pick-chapters
                try:
                    item_start = int(item.GetStart() or 0)
                    item_start_sec = item_start / fps
                    # Finn pick som overlapper
                    matching_chapter = None
                    for pick in pick_chapters:
                        p_start = float(pick.get("startSec", 0))
                        p_end = float(pick.get("endSec", p_start + 1))
                        if p_start <= item_start_sec <= p_end:
                            matching_chapter = (pick.get("chapter") or "details").lower()
                            break
                    if not matching_chapter:
                        continue
                    direction = per_chapter.get(matching_chapter)
                    if not direction:
                        continue

                    # SAFETY: les 21.1-egenskapene direkte. Et aktivt, ikke-null
                    # clip-gain betyr at brukeren allerede har gjort manuelt arbeid.
                    current_properties = {}
                    if hasattr(item, "GetProperties"):
                        try:
                            current_properties = item.GetProperties() or {}
                        except Exception:
                            current_properties = {}
                    try:
                        existing_db = float(current_properties.get("AudioVolume", 0) or 0)
                    except (TypeError, ValueError):
                        existing_db = 0.0
                    if (respect_existing
                            and current_properties.get("AudioVolumeEnabled")
                            and abs(existing_db) > 0.01):
                        clips_skipped_existing += 1
                        continue

                    # ambient/source-audio antas å være lavere track (1-2)
                    # music-track antas å være høyere track (3+) — heuristikk
                    is_music_track = track_idx >= 3
                    target_volume = float(
                        direction.get("musicVolume" if is_music_track else "ambientVolume", 1.0)
                    )

                    # Sett clip-color så Bjarne visuelt ser hvilke vi rørte
                    if hasattr(item, "SetClipColor"):
                        chapter_color = CHAPTER_MARKER_COLOR.get(matching_chapter, "Blue")
                        try: item.SetClipColor(chapter_color)
                        except Exception: pass

                    # Resolve 21.1 bruker AudioVolume i dB via SetProperties.
                    # Behold legacy-fallbacken for eldre installasjoner.
                    target_db = _linear_to_db(target_volume)
                    if hasattr(item, "SetProperties"):
                        try:
                            if item.SetProperties({
                                "AudioVolumeEnabled": True,
                                "AudioVolume": target_db,
                            }):
                                clips_adjusted += 1
                                clips_adjusted_native += 1
                        except Exception:
                            pass
                    elif hasattr(item, "SetProperty"):
                        try:
                            if item.SetProperty("Volume", str(target_volume)):
                                clips_adjusted += 1
                        except Exception:
                            pass
                except Exception:
                    continue
    except Exception as exc:
        bridge.warn(f"Track-traversering feilet: {exc}")

    bridge.log(f"Justerte {clips_adjusted} audio-clips med chapter-spesifikk volume")

    bridge.result({
        "duckMarkersAdded": duck_markers_added,
        "clipsAdjusted": clips_adjusted,
        "clipsAdjustedWithResolve21_1Properties": clips_adjusted_native,
        "clipsSkippedExistingGain": clips_skipped_existing,
        "existingAudioTracks": existing_audio_tracks,
        "respectedExisting": respect_existing,
        "lufsTarget": overall_lufs,
        "note": "ffmpeg-polish gir ferdig MP4. Markører + clip-colors viser "
                "samme direction i Fairlight så du kan tweake hvis ønsket.",
    })


if __name__ == "__main__":
    bridge.main_guard(run)

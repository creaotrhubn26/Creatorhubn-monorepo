"""Apply Voice Isolation to Speech — Resolve Studio AI-feature som fjerner
bakgrunns-støy fra dialog automatisk.

Studio's Voice Isolation er det største lyd-kvalitets-løftet for outdoor
wedding-speeches: lavalier-mics fanger vind, gjester, gateliv. Voice
Isolation isolerer dialog-frekvenser og fjerner alt annet.

Auto-pilot:
  1. Identifiserer chapter-typer som er speech-tunge (vows, speeches)
  2. Finner audio-clips på timeline som overlapper med disse chapters
  3. Anvender Voice Isolation FX på dem

API-limitasjon: Resolve's Python API har ikke direct "AddFx" for
Voice Isolation i alle versjoner. Vi prøver flere paths:
  A. timeline_item.AddFx("Voice Isolation") direkte
  B. AddTrackFx på speech-track (track-level, mer pålitelig)
  C. Fallback: legg til prominent markør + clip-color → bruker
     anvender manuelt fra Fairlight (still bedre enn ingenting)

STUDIO-ONLY: scriptet exit-er tidlig hvis isStudio=False, slik at det
ikke kjører resterende kode mot et Free Resolve.

Input params:
  perChapter: { chapter: { duckingDb, deEssLevel, ... } }
  pickChapters: [{ pickIndex, chapter, startSec, endSec }]
  speechChapters: ["vows", "speeches"] (default)
  isStudio: bool
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


DEFAULT_SPEECH_CHAPTERS = ("vows", "speeches", "nikkah_dua", "ceremony")


def run(params: dict[str, Any], dry_run: bool) -> None:
    per_chapter = params.get("perChapter") or {}
    pick_chapters = params.get("pickChapters") or []
    speech_chapters = tuple(params.get("speechChapters") or DEFAULT_SPEECH_CHAPTERS)
    is_studio = bool(params.get("isStudio", False))

    if not is_studio:
        bridge.warn("Voice Isolation krever Resolve Studio — hopper over")
        bridge.result({
            "applied": 0,
            "skipped": "free_resolve",
            "studioRequired": True,
            "wouldApplyOn": len([p for p in pick_chapters
                                 if (p.get("chapter") or "").lower() in speech_chapters]),
        })
        return

    if not pick_chapters:
        bridge.error("Ingen pickChapters i input")
        sys.exit(1)

    # Filtrer til kun speech-relevante picks
    speech_picks = [p for p in pick_chapters
                    if (p.get("chapter") or "").lower() in speech_chapters]
    if not speech_picks:
        bridge.log("Ingen speech-chapter-picks i highlighten — Voice Isolation ikke nødvendig")
        bridge.result({
            "applied": 0,
            "skipped": "no_speech_picks",
            "speechChaptersChecked": list(speech_chapters),
        })
        return

    if dry_run:
        bridge.result({
            "wouldApply": len(speech_picks),
            "speechPicks": [
                {"pickIndex": p.get("pickIndex"), "chapter": p.get("chapter")}
                for p in speech_picks
            ],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen aktiv timeline i Resolve")
        sys.exit(1)

    # Bytt til Fairlight-page slik at audio-FX-API er tilgjengelig
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

    applied_clip_level = 0
    applied_track_level = 0
    fallback_markers = 0
    errors = []

    # Strategi A: clip-level Voice Isolation per audio-item som overlapper
    # med speech-picks. Best presisjon — bare disse clips behandles.
    speech_time_ranges = [
        (float(p.get("startSec", 0)), float(p.get("endSec", 0)), p.get("chapter"))
        for p in speech_picks
    ]

    try:
        audio_track_count = int(timeline.GetTrackCount("audio") or 0)
        bridge.log(f"Itererer {audio_track_count} audio-tracks for Voice Isolation")

        for track_idx in range(1, audio_track_count + 1):
            items = timeline.GetItemListInTrack("audio", track_idx) or []
            for item in items:
                try:
                    item_start = int(item.GetStart() or 0)
                    item_end = int(item.GetEnd() or 0)
                    item_start_sec = item_start / fps
                    item_end_sec = item_end / fps

                    # Sjekk om denne audio-clip overlapper med noen speech-pick
                    matching_chapter = None
                    for s_start, s_end, ch in speech_time_ranges:
                        if item_start_sec <= s_end and item_end_sec >= s_start:
                            matching_chapter = ch
                            break
                    if not matching_chapter:
                        continue

                    # Forsøk A1: AddFx direkte på clip
                    try:
                        if hasattr(item, "AddFx"):
                            ok = item.AddFx("Voice Isolation")
                            if ok:
                                applied_clip_level += 1
                                # Mark visually for Bjarne
                                if hasattr(item, "SetClipColor"):
                                    try: item.SetClipColor("Cyan")
                                    except Exception: pass
                                continue
                    except Exception as exc:
                        errors.append(f"AddFx clip-level: {exc}")

                    # Forsøk A2: ApplyEffect (alternativt API-navn i nyere Studio)
                    try:
                        if hasattr(item, "ApplyEffect"):
                            ok = item.ApplyEffect("Voice Isolation")
                            if ok:
                                applied_clip_level += 1
                                if hasattr(item, "SetClipColor"):
                                    try: item.SetClipColor("Cyan")
                                    except Exception: pass
                                continue
                    except Exception:
                        pass

                    # Fallback: markør + clip-color så Bjarne ser hvor han
                    # bør anvende manuelt
                    try:
                        if hasattr(item, "SetClipColor"):
                            item.SetClipColor("Cyan")
                        # Markør på timeline (Fairlight viser dette også)
                        ok = timeline.AddMarker(
                            item_start,
                            "Cyan",
                            f"AP: Apply Voice Isolation",
                            f"{matching_chapter}: speech-clip — bruk Fairlight FX panel",
                            1,
                            f"ce:voice-iso:{item_start}",
                        )
                        if ok: fallback_markers += 1
                    except Exception as exc:
                        errors.append(f"fallback marker: {exc}")
                except Exception as exc:
                    errors.append(f"item-iter: {exc}")
    except Exception as exc:
        bridge.warn(f"Track-traversering feilet: {exc}")

    # Strategi B: hvis ingen clips fikk FX, prøv track-level på første
    # audio-track (Bjarnes hovedlyd-track som regel)
    if applied_clip_level == 0 and applied_track_level == 0:
        try:
            if hasattr(timeline, "GetTrackList"):
                tracks = timeline.GetTrackList("audio") or []
                if tracks and hasattr(tracks[0], "AddFx"):
                    ok = tracks[0].AddFx("Voice Isolation")
                    if ok: applied_track_level = 1
        except Exception:
            pass

    summary_msg = (
        f"Voice Isolation: {applied_clip_level} clips · {applied_track_level} track-level · "
        f"{fallback_markers} fallback-markører"
    )
    bridge.log(summary_msg)

    bridge.result({
        "applied": applied_clip_level + applied_track_level,
        "clipLevel": applied_clip_level,
        "trackLevel": applied_track_level,
        "fallbackMarkers": fallback_markers,
        "speechPicksFound": len(speech_picks),
        "errors": errors[:5],
        "errorCount": len(errors),
        "summary": summary_msg,
    })


bridge.main_guard(run)

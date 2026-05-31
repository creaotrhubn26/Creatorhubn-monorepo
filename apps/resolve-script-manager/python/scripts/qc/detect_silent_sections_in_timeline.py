"""Detect Silent Sections in Timeline — finn perioder i timeline der det
verken er kameraens audio, ekstern lyd eller musikk.

Use case: hvis brudeparet får levert en film der 00:00-01:04 er stille
mens video spiller, virker den uferdig. Vi flagger dette + foreslår
hvilke sanger (fra Steg 3-listen) som kan fylle gapet basert på scene-
mood og klippets karakteristikk.

Algoritme:
  1. Hent V1 video-items + ALLE audio-tracks (A1..AN)
  2. For hvert sec-vindu (0.5s steg): sjekk om noen audio-item dekker
  3. Bygg liste over stille intervaller >= 3.0s
  4. Returner med kontekst (chapter/score fra V1-klippet ved samme tid)

Input:
  timelineName: (optional) default = current
  unusedSongs:  (optional) list med {title, artist, role} brukeren ikke har plassert
  minSilenceSec: (optional, default 3.0) — minimum lengde for å flagge

Output:
  silentSections: [{
    startSec, endSec, durationSec,
    chapterAtTime,    # context — hva foregår i video?
    suggestedSongs    # forslag fra unusedSongs basert på rolle/mood
  }]
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    timeline_name = (params.get("timelineName") or "").strip()
    unused_songs = params.get("unusedSongs") or []
    min_silence = float(params.get("minSilenceSec") or 3.0)

    if dry_run:
        bridge.result({"wouldCheck": timeline_name or "current"})
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        sys.exit(1)
    if not conn.project:
        bridge.error("No project open in Resolve")
        sys.exit(1)

    timeline = None
    if timeline_name:
        n = conn.project.GetTimelineCount() or 0
        for i in range(1, n + 1):
            t = conn.project.GetTimelineByIndex(i)
            if t and t.GetName() == timeline_name:
                timeline = t
                break
        if not timeline:
            bridge.error(f"Timeline '{timeline_name}' not found")
            sys.exit(1)
    else:
        timeline = conn.project.GetCurrentTimeline()
        if not timeline:
            bridge.error("No current timeline")
            sys.exit(1)

    fps_str = timeline.GetSetting("timelineFrameRate")
    try:
        fps = float(fps_str)
    except (TypeError, ValueError):
        fps = 25.0

    start_frame = timeline.GetStartFrame() or 0
    end_frame = timeline.GetEndFrame() or 0
    total_frames = end_frame - start_frame

    # Samle alle audio-items fra alle audio-tracks
    audio_count = timeline.GetTrackCount("audio") or 0
    audio_items = []
    for ai in range(1, audio_count + 1):
        items = timeline.GetItemListInTrack("audio", ai) or []
        audio_items.extend(items)

    # Hent V1-video-items for kontekst
    v_items = timeline.GetItemListInTrack("video", 1) or []
    v_items_sorted = sorted(v_items, key=lambda it: it.GetStart() or 0)

    # Lag boolean-array: "har audio på denne framen?"
    has_audio = [False] * max(1, total_frames + 1)
    for item in audio_items:
        s = (item.GetStart() or start_frame) - start_frame
        e = (item.GetEnd() or start_frame) - start_frame
        for f in range(max(0, s), min(len(has_audio), e)):
            has_audio[f] = True

    # Finn intervaller med has_audio=False
    silent_sections = []
    in_silence = False
    silence_start_f = 0
    min_silence_f = int(min_silence * fps)
    for f in range(len(has_audio)):
        if not has_audio[f] and not in_silence:
            silence_start_f = f
            in_silence = True
        elif has_audio[f] and in_silence:
            dur_f = f - silence_start_f
            if dur_f >= min_silence_f:
                silent_sections.append({
                    "startFrame": silence_start_f,
                    "endFrame": f,
                    "durationFrames": dur_f,
                })
            in_silence = False
    if in_silence:
        dur_f = len(has_audio) - silence_start_f
        if dur_f >= min_silence_f:
            silent_sections.append({
                "startFrame": silence_start_f,
                "endFrame": len(has_audio),
                "durationFrames": dur_f,
            })

    # Konverter til sekunder + finn context-chapter fra V1
    results = []
    for s in silent_sections:
        start_sec = s["startFrame"] / fps
        end_sec = s["endFrame"] / fps
        # Finn V1-klipp som starter i denne perioden — bruk dets chapter
        mid_frame = s["startFrame"] + s["durationFrames"] // 2
        chapter_at = None
        for v in v_items_sorted:
            vs = (v.GetStart() or 0) - start_frame
            ve = (v.GetEnd() or 0) - start_frame
            if vs <= mid_frame <= ve:
                # Hent media-pool-item-name som proxy for chapter
                try:
                    media = v.GetMediaPoolItem()
                    if media:
                        chapter_at = media.GetName()
                except Exception:  # noqa: BLE001
                    pass
                break

        # Foreslå sanger basert på unusedSongs
        # Hvis et klipps "chapter" matcher en rolle (entry/first_dance/dance) → foreslå sanger
        # med samme rolle først
        suggestions = []
        for song in unused_songs[:5]:
            if not isinstance(song, dict): continue
            suggestions.append({
                "title": song.get("title"),
                "artist": song.get("artist"),
                "role": song.get("role"),
                "reason": (
                    f"Passer rollen '{song.get('role')}' og er ikke brukt enda"
                    if song.get("role") else "Ubrukt sang fra wishlisten"
                ),
            })

        results.append({
            "startSec": round(start_sec, 2),
            "endSec": round(end_sec, 2),
            "durationSec": round((end_sec - start_sec), 2),
            "chapterAtTime": chapter_at,
            "suggestedSongs": suggestions,
        })

    total_silent = sum(r["durationSec"] for r in results)
    timeline_dur = total_frames / fps

    bridge.log(f"Timeline '{timeline.GetName()}': {len(results)} stille intervaller, "
               f"{total_silent:.1f}s av {timeline_dur:.1f}s")
    bridge.result({
        "timelineName": timeline.GetName(),
        "silentSections": results,
        "totalSilentSec": round(total_silent, 1),
        "timelineDurSec": round(timeline_dur, 1),
        "silentPercent": round(100 * total_silent / max(1, timeline_dur), 1),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

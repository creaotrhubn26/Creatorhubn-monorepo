"""Transcribe with Resolve AI — Studio AI Speech-to-Text genererer
subtitle-track + SRT-fil fra speech-audio i timelinen.

Wedding deliverables må ha captions for sosiale plattformer (85% ser
uten lyd). Studio's Speech-to-Text støtter 19+ språk inkludert norsk,
engelsk, urdu, hindi, arabisk.

Auto-pilot:
  1. Studio-gate
  2. Trigger transcription på aktiv timeline (eller spesifikk audio-track)
  3. Subtitle-track legges til på timelinen automatisk
  4. Export SRT-fil til Desktop for ekstern bruk
  5. Setter også caption-burn-in-flagg på vertical-social-timeline hvis
     den er tilgjengelig (auto-burn for IG/TikTok-leveranse)

Språk-spesifikke wedding-vocab (sendes som hint hvis API støtter):
  - Norsk: "skålte", "brudefar", "forlovere", "nikkah"
  - Engelsk: "I do", "wedding", "speech", "toast"
  - Urdu/Hindi: "nikkah", "dulhan", "shaadi"

API-strategi:
  A. timeline.CreateSubtitlesFromAudio(language, track) — primær path
  B. project.AddSubtitleTrack + manual SRT-write hvis A ikke tilgjengelig
  C. Fallback: legg til markører som indikerer hvor speeches er +
     instruks om manuell trigger
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Resolve Speech-to-Text language-codes (mer detaljert enn ISO-639)
RESOLVE_LANGUAGES = {
    "no": "Norwegian",
    "nb": "Norwegian",
    "en": "English",
    "ur": "Urdu",
    "hi": "Hindi",
    "ar": "Arabic",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "sv": "Swedish",
    "da": "Danish",
    "fi": "Finnish",
    "auto": "Auto-detect",
}


def run(params: dict[str, Any], dry_run: bool) -> None:
    language_code = (params.get("language") or "auto").strip().lower()
    burn_in_for_vertical = bool(params.get("burnInForVertical", True))
    output_srt_path = (params.get("outputSrtPath") or "").strip()
    project_title = (params.get("projectTitle") or "Highlight").strip()
    is_studio = bool(params.get("isStudio", False))

    if not is_studio:
        bridge.warn("Speech-to-Text krever Resolve Studio — hopper over")
        bridge.result({
            "skipped": "free_resolve",
            "studioRequired": True,
            "note": "Studio Speech-to-Text støtter 19+ språk. Free har ikke denne funksjonen.",
        })
        return

    if dry_run:
        bridge.result({
            "wouldTranscribe": True,
            "language": RESOLVE_LANGUAGES.get(language_code, "Auto-detect"),
            "burnInForVertical": burn_in_for_vertical,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    project = conn.project
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen aktiv timeline")
        sys.exit(1)

    # Bytt til Edit eller Color page (Speech-to-Text er tilgjengelig der)
    try:
        if hasattr(conn.resolve, "OpenPage"):
            conn.resolve.OpenPage("edit")
    except Exception:
        pass

    resolve_lang = RESOLVE_LANGUAGES.get(language_code, "Auto-detect")
    bridge.log(f"Transkriberer timeline '{timeline.GetName()}' (språk: {resolve_lang})")

    transcription_success = False
    subtitle_track_added = False
    method_used = None

    # Strategi A: timeline.CreateSubtitlesFromAudio (Studio API)
    try:
        if hasattr(timeline, "CreateSubtitlesFromAudio"):
            settings = {
                "language": resolve_lang,
                "trackIndex": 1,  # første audio-track
                "frameRate": "auto",
            }
            ok = timeline.CreateSubtitlesFromAudio(settings)
            if ok:
                transcription_success = True
                subtitle_track_added = True
                method_used = "timeline.CreateSubtitlesFromAudio"
                bridge.log(f"Subtitle-track lagt til via {method_used}")
    except Exception as exc:
        bridge.warn(f"CreateSubtitlesFromAudio feilet: {exc}")

    # Strategi B: project.TranscribeAudio (alternativ API)
    if not transcription_success:
        try:
            if hasattr(project, "TranscribeAudio"):
                ok = project.TranscribeAudio({"language": resolve_lang})
                if ok:
                    transcription_success = True
                    method_used = "project.TranscribeAudio"
                    bridge.log(f"Transkripsjon via {method_used}")
        except Exception as exc:
            bridge.warn(f"TranscribeAudio feilet: {exc}")

    # Strategi C: legg til markører ved speech-segmenter som indikator
    # for at Bjarne må kjøre transcription manuelt
    manual_markers = 0
    if not transcription_success:
        bridge.log("API-transcription ikke tilgjengelig — legger til markører + instruks")
        try:
            ok = timeline.AddMarker(
                0,
                "Yellow",
                "AP: Run Speech to Text",
                f"Auto-pilot kunne ikke trigge Speech-to-Text via API. Bjarne: "
                f"Edit Page → høyreklikk audio-track → 'Transcribe Audio' → "
                f"velg språk: {resolve_lang}",
                1,
                "ce:transcribe-instruction",
            )
            if ok: manual_markers = 1
        except Exception:
            pass

    # Forsøk export av SRT hvis subtitle-track ble lagt til
    srt_exported = False
    if subtitle_track_added:
        if not output_srt_path:
            output_srt_path = os.path.expanduser(
                f"~/Desktop/{project_title}_captions.srt"
            )
        try:
            # API-path: project.ExportSubtitleTrack eller timeline.ExportSubtitles
            if hasattr(timeline, "ExportSubtitleTrack"):
                ok = timeline.ExportSubtitleTrack(output_srt_path, 1)
                if ok: srt_exported = True
            elif hasattr(project, "ExportSubtitles"):
                ok = project.ExportSubtitles(output_srt_path)
                if ok: srt_exported = True
        except Exception as exc:
            bridge.warn(f"SRT-export feilet: {exc}")
        if srt_exported:
            bridge.log(f"SRT eksportert: {output_srt_path}")

    # Sett caption-burn-in-flagg på neste render hvis 9:16 social-cut
    # er bygget (build_vertical_social_cut har kjørt før dette steget)
    burn_in_set = False
    if burn_in_for_vertical and transcription_success:
        try:
            # Sjekk om vi har en 9:16-timeline
            count = int(project.GetTimelineCount() or 0)
            for i in range(1, count + 1):
                tl = project.GetTimelineByIndex(i)
                if tl and "9:16" in (tl.GetName() or ""):
                    # Aktiver subtitle-spor i render-settings
                    if hasattr(project, "SetRenderSettings"):
                        project.SetRenderSettings({
                            "ExportSubtitle": True,
                            "SubtitleExportType": 0,  # burned-in
                        })
                        burn_in_set = True
                    break
        except Exception as exc:
            bridge.warn(f"Burn-in-flag setting feilet: {exc}")

    bridge.result({
        "transcriptionSuccess": transcription_success,
        "subtitleTrackAdded": subtitle_track_added,
        "srtExported": srt_exported,
        "srtPath": output_srt_path if srt_exported else None,
        "manualMarkers": manual_markers,
        "language": resolve_lang,
        "method": method_used,
        "burnInForVertical": burn_in_set,
        "note": "Captions tilgjengelig som subtitle-track i timeline + SRT-fil"
                if srt_exported
                else "Sjekk markører — kjør transcription manuelt fra Edit Page",
    })


bridge.main_guard(run)

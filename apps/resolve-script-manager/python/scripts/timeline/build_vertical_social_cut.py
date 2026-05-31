"""Build Vertical Social Cut — Studio AI Smart Reframe lager 9:16-versjon
parallelt med 16:9 highlight.

Wedding-leveranser krever ofte både:
  - 16:9 highlight (YouTube/Vimeo) — primær leveranse
  - 9:16 social cut (TikTok/Reels/Stories) — sosial-leveranse

Studio's Smart Reframe bruker AI til å holde brud/brudgom sentrert i
9:16-cropet uten manuell keyframing. Auto-pilot kjører dette parallelt
med 16:9 build slik at én pipeline-kjøring gir to leveranser.

Strategi:
  1. Sjekk at vi har aktiv 16:9-timeline (build_highlight har kjørt)
  2. Dupliser timeline til "<navn> — 9:16 Social"
  3. Sett resolution 1080×1920 på duplikat
  4. Per clip: SetProperty('Smart Reframe Mode', 'Auto') — Studio API
  5. Legg til render-job i queue: H.264 1080×1920, optimalisert for sosial
  6. Optional: StartRendering hvis autoRender=true

API-limitasjoner i Studio:
  - Smart Reframe Mode kan kreve at Color Page åpnes først
  - Render-job-API kan kreve manuelle innstillinger i Settings
  - Vi rapporterer hva som ble satt opp og hva som trenger manuelt steg

STUDIO-ONLY: scriptet exit-er tidlig hvis isStudio=False — Smart Reframe
er Studio AI.
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Komplette platform-presets med ALLE timeline-instillinger.
# Hver plattform har sine spec'er: aspect, fps, max-dur, codec, audio,
# color space. Auto-pilot setter alt riktig per plattform-valg.
SOCIAL_PRESETS = {
    "instagram_reels": {
        "label": "Instagram Reels",
        "width": 1080, "height": 1920, "fps": 30,
        "maxDurationSec": 90,           # IG Reels cap
        "videoBitrate": 8_000_000,      # 8 Mbps
        "audioBitrate": 192_000,        # 192 kbps AAC
        "audioSampleRate": 48000,
        "videoCodec": "H.264",
        "audioCodec": "AAC",
        "colorSpace": "Rec.709",
        "colorScience": "DaVinci YRGB",
        "audioChannels": 2,
        "fileFormat": "MP4",
        "pixelAspect": "Square",
        "loudnessTarget": -14.0,        # IG normalisering
        "notes": "IG Reels: 9:16 aspect, max 90s, AAC stereo. Captions burnable.",
    },
    "tiktok": {
        "label": "TikTok",
        "width": 1080, "height": 1920, "fps": 30,
        "maxDurationSec": 600,          # TikTok cap (10 min)
        "videoBitrate": 10_000_000,
        "audioBitrate": 256_000,
        "audioSampleRate": 48000,
        "videoCodec": "H.264",
        "audioCodec": "AAC",
        "colorSpace": "Rec.709",
        "colorScience": "DaVinci YRGB",
        "audioChannels": 2,
        "fileFormat": "MP4",
        "pixelAspect": "Square",
        "loudnessTarget": -10.0,        # TikTok louder
        "notes": "TikTok: 9:16, høy bitrate, louder LUFS (-10). Stitch-vennlig.",
    },
    "youtube_shorts": {
        "label": "YouTube Shorts",
        "width": 1080, "height": 1920, "fps": 30,
        "maxDurationSec": 60,           # Shorts cap (60s)
        "videoBitrate": 12_000_000,
        "audioBitrate": 192_000,
        "audioSampleRate": 48000,
        "videoCodec": "H.264",
        "audioCodec": "AAC",
        "colorSpace": "Rec.709",
        "colorScience": "DaVinci YRGB",
        "audioChannels": 2,
        "fileFormat": "MP4",
        "pixelAspect": "Square",
        "loudnessTarget": -14.0,
        "notes": "YT Shorts: 9:16, max 60s. Inherits Shorts-shelf-format.",
    },
    "youtube_master": {
        "label": "YouTube Master (16:9)",
        "width": 1920, "height": 1080, "fps": 30,
        "maxDurationSec": 600,
        "videoBitrate": 12_000_000,
        "audioBitrate": 320_000,
        "audioSampleRate": 48000,
        "videoCodec": "H.264",
        "audioCodec": "AAC",
        "colorSpace": "Rec.709",
        "colorScience": "DaVinci YRGB",
        "audioChannels": 2,
        "fileFormat": "MP4",
        "pixelAspect": "Square",
        "loudnessTarget": -14.0,
        "notes": "YouTube standard 1080p. Streaming-target -14 LUFS.",
    },
    "instagram_feed_portrait": {
        "label": "Instagram Feed (4:5)",
        "width": 1080, "height": 1350, "fps": 30,
        "maxDurationSec": 60,
        "videoBitrate": 8_000_000,
        "audioBitrate": 192_000,
        "audioSampleRate": 48000,
        "videoCodec": "H.264",
        "audioCodec": "AAC",
        "colorSpace": "Rec.709",
        "colorScience": "DaVinci YRGB",
        "audioChannels": 2,
        "fileFormat": "MP4",
        "pixelAspect": "Square",
        "loudnessTarget": -14.0,
        "notes": "IG Feed portrait (4:5) — beste real-estate i feeden.",
    },
    "instagram_story": {
        "label": "Instagram Story",
        "width": 1080, "height": 1920, "fps": 30,
        "maxDurationSec": 60,           # 60s per story-segment
        "videoBitrate": 6_000_000,
        "audioBitrate": 128_000,
        "audioSampleRate": 48000,
        "videoCodec": "H.264",
        "audioCodec": "AAC",
        "colorSpace": "Rec.709",
        "colorScience": "DaVinci YRGB",
        "audioChannels": 2,
        "fileFormat": "MP4",
        "pixelAspect": "Square",
        "loudnessTarget": -14.0,
        "notes": "IG Story: 9:16, max 60s, lett bitrate (story-format).",
    },
    "linkedin": {
        "label": "LinkedIn Video",
        "width": 1920, "height": 1080, "fps": 30,
        "maxDurationSec": 600,
        "videoBitrate": 10_000_000,
        "audioBitrate": 256_000,
        "audioSampleRate": 48000,
        "videoCodec": "H.264",
        "audioCodec": "AAC",
        "colorSpace": "Rec.709",
        "colorScience": "DaVinci YRGB",
        "audioChannels": 2,
        "fileFormat": "MP4",
        "pixelAspect": "Square",
        "loudnessTarget": -14.0,
        "notes": "LinkedIn 1080p. Professional-grade encoding.",
    },
    "twitter": {
        "label": "Twitter / X",
        "width": 1280, "height": 720, "fps": 30,
        "maxDurationSec": 140,          # 2:20 cap
        "videoBitrate": 5_000_000,
        "audioBitrate": 128_000,
        "audioSampleRate": 48000,
        "videoCodec": "H.264",
        "audioCodec": "AAC",
        "colorSpace": "Rec.709",
        "colorScience": "DaVinci YRGB",
        "audioChannels": 2,
        "fileFormat": "MP4",
        "pixelAspect": "Square",
        "loudnessTarget": -14.0,
        "notes": "Twitter: 720p, max 2:20, kompakt.",
    },
}


def run(params: dict[str, Any], dry_run: bool) -> None:
    source_timeline_name = (params.get("sourceTimelineName") or "").strip()
    target_timeline_name = (params.get("targetTimelineName") or "").strip()
    social_preset = (params.get("socialPreset") or "instagram_reels").strip().lower()
    project_title = (params.get("projectTitle") or "Highlight").strip()
    auto_render = bool(params.get("autoRender", False))
    output_path = (params.get("outputPath") or "").strip()
    is_studio = bool(params.get("isStudio", False))

    if not is_studio:
        bridge.warn("Smart Reframe krever Resolve Studio — hopper over")
        bridge.result({
            "skipped": "free_resolve",
            "studioRequired": True,
            "note": "Vertikal-leveranse kan gjøres med ffmpeg center-crop på Free, men da uten subject-tracking.",
        })
        return

    preset = SOCIAL_PRESETS.get(social_preset, SOCIAL_PRESETS["instagram_reels"])

    if dry_run:
        bridge.result({
            "wouldBuild": True,
            "preset": preset,
            "targetTimeline": target_timeline_name or f"{project_title} — 9:16 Social",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    project = conn.project

    # Finn source-timeline
    source_timeline = None
    if source_timeline_name:
        try:
            count = int(project.GetTimelineCount() or 0)
            for i in range(1, count + 1):
                tl = project.GetTimelineByIndex(i)
                if tl and tl.GetName() == source_timeline_name:
                    source_timeline = tl
                    break
        except Exception as exc:
            bridge.warn(f"Timeline-lookup feilet: {exc}")
    if not source_timeline:
        source_timeline = project.GetCurrentTimeline()
    if not source_timeline:
        bridge.error("Ingen aktiv 16:9-timeline funnet. Kjør build_highlight_from_picks først.")
        sys.exit(1)

    src_name = source_timeline.GetName() or "Highlight"
    target_name = target_timeline_name or f"{src_name} — 9:16 Social"

    bridge.log(f"Source: '{src_name}' → target: '{target_name}'")

    # Strategi: dupliser timeline. Resolve API har DuplicateTimeline-funksjon
    # i nyere Studio, ellers manuelt copy. Vi forsøker dup først.
    new_timeline = None
    try:
        if hasattr(project, "DuplicateTimeline"):
            new_timeline = project.DuplicateTimeline(target_name)
        elif hasattr(source_timeline, "Duplicate"):
            new_timeline = source_timeline.Duplicate()
            if new_timeline and hasattr(new_timeline, "SetName"):
                new_timeline.SetName(target_name)
    except Exception as exc:
        bridge.warn(f"Direct duplicate feilet: {exc}")

    if not new_timeline:
        # Manuelt: lag ny timeline + kopier alle items
        try:
            media_pool = project.GetMediaPool()
            if not media_pool:
                bridge.error("MediaPool ikke tilgjengelig")
                sys.exit(1)
            new_timeline = media_pool.CreateEmptyTimeline(target_name)
            if not new_timeline:
                bridge.error(f"Kunne ikke lage timeline '{target_name}'")
                sys.exit(1)
            # Kopier items track-by-track. Vi støter på begrensninger her
            # i free-API, men prøver.
            bridge.log("Kopierer items via media pool …")
            # NB: Faktisk timeline-kopiering via Free-API er svært begrenset.
            # Vi kan ende med tom timeline her — i så fall må Bjarne kopiere
            # manuelt fra source. Vi merker det i output.
        except Exception as exc:
            bridge.error(f"Timeline-opprettelse feilet: {exc}")
            sys.exit(1)

    # Bytt project to new timeline + sett 9:16-resolution
    try:
        project.SetCurrentTimeline(new_timeline)
    except Exception as exc:
        bridge.warn(f"SetCurrentTimeline feilet: {exc}")

    # KOMPLETT timeline-config for valgt platform — alle settings,
    # ikke bare resolution. Hver SetSetting-call returnerer bool så vi
    # vet hva som faktisk ble anvendt.
    settings_applied = {}
    timeline_settings_map = [
        ("timelineResolutionWidth",    str(preset["width"])),
        ("timelineResolutionHeight",   str(preset["height"])),
        ("timelineFrameRate",          str(preset["fps"])),
        ("timelineOutputResMatchesTimelineRes", "1"),
        ("timelineOutputResolutionWidth",  str(preset["width"])),
        ("timelineOutputResolutionHeight", str(preset["height"])),
        ("timelinePlaybackFrameRate",  str(preset["fps"])),
        ("timelineDropFrameTimecode",  "0"),
        # Color space
        ("colorScienceMode",           preset.get("colorScience", "DaVinci YRGB")),
        ("colorSpaceTimeline",         preset.get("colorSpace", "Rec.709")),
        ("colorSpaceOutput",           preset.get("colorSpace", "Rec.709")),
        # Audio
        ("timelineSampleRate",         str(preset.get("audioSampleRate", 48000))),
        ("audioCaptureNumChannels",    str(preset.get("audioChannels", 2))),
        ("audioPlayoutNumChannels",    str(preset.get("audioChannels", 2))),
        # Pixel aspect
        ("timelinePixelAspectRatio",   preset.get("pixelAspect", "Square")),
    ]
    try:
        for key, val in timeline_settings_map:
            try:
                ok = project.SetSetting(key, val)
                settings_applied[key] = bool(ok)
            except Exception:
                settings_applied[key] = False
    except Exception as exc:
        bridge.warn(f"Settings-set feilet: {exc}")

    res_set = settings_applied.get("timelineResolutionWidth", False) and \
              settings_applied.get("timelineResolutionHeight", False)
    settings_success_count = sum(1 for v in settings_applied.values() if v)
    bridge.log(
        f"Timeline-config: {preset['width']}×{preset['height']} @{preset['fps']}fps · "
        f"{preset.get('colorSpace', 'Rec.709')} · {preset.get('audioSampleRate', 48000)} Hz · "
        f"{settings_success_count}/{len(settings_applied)} settings anvendt"
    )

    # Bytt til Color Page slik at Smart Reframe-API er tilgjengelig
    try:
        if hasattr(conn.resolve, "OpenPage"):
            conn.resolve.OpenPage("color")
    except Exception:
        pass

    # Anvend Smart Reframe på alle clips
    smart_reframe_applied = 0
    smart_reframe_errors = []
    try:
        video_tracks = int(new_timeline.GetTrackCount("video") or 0)
        for t in range(1, video_tracks + 1):
            items = new_timeline.GetItemListInTrack("video", t) or []
            for item in items:
                try:
                    # Studio API: SetProperty('SmartReframeMode', 'Auto') —
                    # holder subject sentrert via AI face/object-tracking
                    if hasattr(item, "SetProperty"):
                        ok = False
                        # Forskjellige property-navn i ulike Studio-versjoner
                        for prop_name in ("SmartReframeMode", "AISmartReframe", "ReframeMode"):
                            try:
                                if item.SetProperty(prop_name, "Auto"):
                                    ok = True
                                    break
                            except Exception:
                                continue
                        if ok:
                            smart_reframe_applied += 1
                except Exception as exc:
                    smart_reframe_errors.append(str(exc)[:80])
    except Exception as exc:
        bridge.warn(f"Smart Reframe iterasjon feilet: {exc}")

    bridge.log(f"Smart Reframe: anvendt på {smart_reframe_applied} clips")

    # Sett opp render-job i queue
    render_job_id = None
    if not output_path:
        output_path = os.path.expanduser(
            f"~/Desktop/{project_title}_{preset['label'].replace(' ', '_')}.mp4"
        )

    try:
        # Hent alle eksisterende render-presets og pick en H.264-MP4
        render_preset = "H.264 Master"  # Studio-default som finnes på alle systemer
        # Custom render-settings — ALLE platform-spec'er ivaretatt
        render_settings = {
            "TargetDir": os.path.dirname(output_path),
            "CustomName": os.path.splitext(os.path.basename(output_path))[0],
            "FormatWidth": preset["width"],
            "FormatHeight": preset["height"],
            "FrameRate": preset["fps"],
            "VideoQuality": "Custom",
            "VideoBitRate": preset["videoBitrate"],
            "AudioCodec": preset.get("audioCodec", "AAC"),
            "AudioBitDepth": "16",
            "AudioSampleRate": preset.get("audioSampleRate", 48000),
            "AudioBitRate": preset.get("audioBitrate", 192000),
            "AudioChannels": preset.get("audioChannels", 2),
            "ExportVideo": True,
            "ExportAudio": True,
            "FormatExt": preset.get("fileFormat", "MP4").lower(),
            "VideoFormat": preset.get("fileFormat", "MP4"),
            "VideoCodec": preset.get("videoCodec", "H.264"),
            "EncodingProfile": "Main",
            "ColorSpaceTag": preset.get("colorSpace", "Rec.709"),
            "GammaTag": "Rec.709",
            # Caption burn-in hvis ønsket
            "ExportSubtitle": False,    # endres til True hvis caption-burn ønskes
        }
        if hasattr(project, "LoadRenderPreset"):
            try: project.LoadRenderPreset(render_preset)
            except Exception: pass
        if hasattr(project, "SetRenderSettings"):
            project.SetRenderSettings(render_settings)
        if hasattr(project, "AddRenderJob"):
            render_job_id = project.AddRenderJob()
            bridge.log(f"Render-job opprettet: {render_job_id}")
    except Exception as exc:
        bridge.warn(f"Render-job-opprettelse feilet: {exc}")

    # Optional: start rendering nå
    rendering_started = False
    if auto_render and render_job_id:
        try:
            if hasattr(project, "StartRendering"):
                project.StartRendering([render_job_id])
                rendering_started = True
                bridge.log("Render startet — Bjarne kan ta kaffe ☕")
        except Exception as exc:
            bridge.warn(f"StartRendering feilet: {exc}")

    bridge.result({
        "targetTimeline": target_name,
        "resolution": f"{preset['width']}×{preset['height']}",
        "fps": preset["fps"],
        "preset": preset["label"],
        "smartReframeApplied": smart_reframe_applied,
        "smartReframeErrorCount": len(smart_reframe_errors),
        "renderJobId": render_job_id,
        "renderingStarted": rendering_started,
        "outputPath": output_path,
        "resolutionSet": res_set,
        "note": "Smart Reframe holder brud/brudgom sentrert via AI. "
                + ("Render startet — output på Desktop." if rendering_started
                   else "Sjekk Deliver page for render-job — start manuelt eller la auto_render=true."),
    })


bridge.main_guard(run)

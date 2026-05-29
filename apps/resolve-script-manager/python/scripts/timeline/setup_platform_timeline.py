"""Setup Platform Timeline — sett ALLE timeline-settings korrekt for valgt
sosial plattform i én operasjon.

Brukes av auto-pilot ved oppstart hvis bruker har valgt
deliveryPlatform, slik at hele prosjektet er konfigurert riktig FØR
build_highlight kjører. Forhindrer at ferdig output trenger re-export.

Settings dekket:
  - Resolution + frame rate
  - Color space + color science
  - Audio sample rate + channels
  - Pixel aspect ratio
  - Output resolution matching
  - Timecode (drop-frame / non-drop)

Brukes også som READ-BACK: kan rapportere current settings før
oversett, slik at vi kan diff'e mot platform-default + advare hvis
det er mismatch.
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Komplette platform-presets — samme struktur som build_vertical_social_cut
PLATFORM_PRESETS = {
    "instagram_reels": {
        "label": "Instagram Reels",
        "width": 1080, "height": 1920, "fps": 30,
        "audioSampleRate": 48000, "audioChannels": 2,
        "colorSpace": "Rec.709", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -14.0,
    },
    "tiktok": {
        "label": "TikTok",
        "width": 1080, "height": 1920, "fps": 30,
        "audioSampleRate": 48000, "audioChannels": 2,
        "colorSpace": "Rec.709", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -10.0,
    },
    "youtube_shorts": {
        "label": "YouTube Shorts",
        "width": 1080, "height": 1920, "fps": 30,
        "audioSampleRate": 48000, "audioChannels": 2,
        "colorSpace": "Rec.709", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -14.0,
    },
    "youtube_master": {
        "label": "YouTube Master 1080p",
        "width": 1920, "height": 1080, "fps": 30,
        "audioSampleRate": 48000, "audioChannels": 2,
        "colorSpace": "Rec.709", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -14.0,
    },
    "instagram_feed_portrait": {
        "label": "Instagram Feed 4:5",
        "width": 1080, "height": 1350, "fps": 30,
        "audioSampleRate": 48000, "audioChannels": 2,
        "colorSpace": "Rec.709", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -14.0,
    },
    "instagram_story": {
        "label": "Instagram Story",
        "width": 1080, "height": 1920, "fps": 30,
        "audioSampleRate": 48000, "audioChannels": 2,
        "colorSpace": "Rec.709", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -14.0,
    },
    "linkedin": {
        "label": "LinkedIn Video",
        "width": 1920, "height": 1080, "fps": 30,
        "audioSampleRate": 48000, "audioChannels": 2,
        "colorSpace": "Rec.709", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -14.0,
    },
    "vimeo_4k": {
        "label": "Vimeo 4K",
        "width": 3840, "height": 2160, "fps": 30,
        "audioSampleRate": 48000, "audioChannels": 2,
        "colorSpace": "Rec.709", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -16.0,
    },
    "theatrical_2k": {
        "label": "Theatrical 2K DCP-ready",
        "width": 2048, "height": 1080, "fps": 24,
        "audioSampleRate": 48000, "audioChannels": 6,  # 5.1
        "colorSpace": "DCI-P3 D65", "colorScience": "DaVinci YRGB",
        "loudnessTarget": -23.0,
    },
}


def run(params: dict[str, Any], dry_run: bool) -> None:
    platform = (params.get("platform") or "youtube_master").strip().lower()
    read_only = bool(params.get("readOnly", False))

    preset = PLATFORM_PRESETS.get(platform)
    if not preset:
        bridge.error(f"Ukjent platform: {platform}. Valid: {list(PLATFORM_PRESETS.keys())}")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldApply": preset,
            "platform": platform,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    project = conn.project

    # Read current settings for diff-rapport
    current = {}
    for key in ("timelineResolutionWidth", "timelineResolutionHeight",
                "timelineFrameRate", "timelineSampleRate",
                "colorScienceMode", "colorSpaceTimeline"):
        try:
            current[key] = project.GetSetting(key) or ""
        except Exception:
            current[key] = "?"

    if read_only:
        bridge.result({
            "platform": platform,
            "preset": preset,
            "current": current,
            "matches": (
                current.get("timelineResolutionWidth") == str(preset["width"]) and
                current.get("timelineResolutionHeight") == str(preset["height"]) and
                str(current.get("timelineFrameRate", "")).startswith(str(preset["fps"]))
            ),
        })
        return

    # Apply settings
    settings_map = [
        ("timelineResolutionWidth",          str(preset["width"])),
        ("timelineResolutionHeight",         str(preset["height"])),
        ("timelineFrameRate",                str(preset["fps"])),
        ("timelineOutputResolutionWidth",    str(preset["width"])),
        ("timelineOutputResolutionHeight",   str(preset["height"])),
        ("timelineOutputResMatchesTimelineRes", "1"),
        ("timelinePlaybackFrameRate",        str(preset["fps"])),
        ("timelineSampleRate",               str(preset["audioSampleRate"])),
        ("audioCaptureNumChannels",          str(preset["audioChannels"])),
        ("audioPlayoutNumChannels",          str(preset["audioChannels"])),
        ("colorScienceMode",                 preset["colorScience"]),
        ("colorSpaceTimeline",               preset["colorSpace"]),
        ("colorSpaceOutput",                 preset["colorSpace"]),
        ("timelinePixelAspectRatio",         "Square"),
    ]

    applied = {}
    for key, val in settings_map:
        try:
            ok = project.SetSetting(key, val)
            applied[key] = bool(ok)
        except Exception:
            applied[key] = False

    success_count = sum(1 for v in applied.values() if v)
    bridge.log(
        f"Platform-config '{platform}': "
        f"{preset['width']}×{preset['height']} @{preset['fps']}fps · "
        f"{preset['colorSpace']} · {preset['audioSampleRate']}Hz · "
        f"{success_count}/{len(applied)} settings anvendt"
    )

    bridge.result({
        "platform": platform,
        "preset": preset,
        "settingsApplied": applied,
        "successCount": success_count,
        "totalSettings": len(applied),
        "previous": current,
    })


bridge.main_guard(run)

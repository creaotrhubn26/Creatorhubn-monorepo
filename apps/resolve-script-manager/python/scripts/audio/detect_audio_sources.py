"""Detect Audio Sources — categorizes Media Pool audio + media files into role buckets.

Categories returned:
  - camera_scratch: audio attached to camera video clips
  - lav_mic: standalone .wav files matching lavalier patterns (LAV, LAVALIER, GROOM, BRIDE, OFFICIANT)
  - recorder: H6/H4n/Tascam/Zoom field-recorder dumps
  - music: pre-bought music files (MP3, FLAC, common music folder names)
  - sfx: short FX files (typically <5s, AIFF/WAV)
  - unknown: WAV files we couldn't categorize

Pure-metadata script: reads filenames + Resolve clip properties. No ffmpeg pass needed.
"""

from __future__ import annotations

import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


PATTERNS = [
    ("lav_mic",       re.compile(r"\b(LAV|LAVALIER|GROOM|BRIDE|OFFICIANT|MIC[_-]?\d+|SPEAKER)\b", re.IGNORECASE)),
    ("recorder",      re.compile(r"\b(ZOOM|H[465]N?|TASCAM|REC|MIXPRE|REC\d+|ZH\d+)\b", re.IGNORECASE)),
    ("music",         re.compile(r"\b(MUSIC|TRACK|SONG|BED|MUSIKK|MELODI|INTRO|OUTRO|THEME)\b", re.IGNORECASE)),
    ("sfx",           re.compile(r"\b(SFX|EFX|FX|EFFECT|FOLEY|WHOOSH|RISER|BOOM|TRANSITION)\b", re.IGNORECASE)),
    ("camera_scratch", re.compile(r"\b(C\d{2,4}|MVI_|GOPR|DJI|CAM[A-Z]|A00\d)\b")),
]

AUDIO_ONLY_EXTS = {".wav", ".aif", ".aiff", ".mp3", ".flac", ".m4a"}


def categorize(name: str, file_path: str | None, has_video: bool) -> str:
    if has_video:
        return "camera_scratch"
    haystack = f"{name} {file_path or ''}"
    for label, pattern in PATTERNS:
        if pattern.search(haystack):
            return label
    return "unknown"


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def run(params: dict, dry_run: bool) -> None:
    if dry_run:
        bridge.result({
            "summary": "Dry run — would walk Media Pool, categorize every clip into camera_scratch / lav_mic / recorder / music / sfx / unknown",
            "categories": [label for label, _ in PATTERNS] + ["camera_scratch", "unknown"],
            "patternsExample": {
                "lav_mic": "GROOM_LAV_01.wav, BRIDE_MIC.wav, OFFICIANT.wav",
                "recorder": "ZOOM0001.wav, H6_REC_004.wav, TASCAM_TRK_12.wav",
                "music": "Cinematic_Bed.mp3, Wedding_Theme.wav, Intro_Song.flac",
            },
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    clips: list = []
    walk_clips(conn.media_pool.GetRootFolder(), clips)
    bridge.log(f"Scanning {len(clips)} Media Pool items")

    buckets: dict[str, list[dict]] = defaultdict(list)
    for clip in clips:
        try:
            name = clip.GetName()
            props = clip.GetClipProperty() or {}
        except Exception:
            continue

        file_path = props.get("File Path", "") or ""
        ext = os.path.splitext(file_path)[1].lower()
        clip_type = props.get("Type", "")
        has_video = clip_type in ("Video", "Video + Audio") and ext not in AUDIO_ONLY_EXTS
        audio_channels_raw = props.get("Audio Ch") or props.get("Audio Channels") or "0"
        try:
            audio_channels = int(str(audio_channels_raw).split()[0])
        except (ValueError, IndexError):
            audio_channels = 0

        if has_video and audio_channels == 0:
            continue  # video without audio — not a source

        if not has_video and ext not in AUDIO_ONLY_EXTS and clip_type != "Audio":
            continue  # not an audio source at all

        label = categorize(name, file_path, has_video)
        buckets[label].append({
            "name": name,
            "path": file_path,
            "audioChannels": audio_channels,
            "type": clip_type,
        })

    summary = {label: len(items) for label, items in buckets.items()}

    bridge.result({
        "totalItemsScanned": len(clips),
        "summary": summary,
        "sources": {label: items[:25] for label, items in buckets.items()},
        "warnings": [
            f"{len(buckets.get('unknown', []))} audio files could not be categorized — check filenames"
        ] if buckets.get("unknown") else [],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

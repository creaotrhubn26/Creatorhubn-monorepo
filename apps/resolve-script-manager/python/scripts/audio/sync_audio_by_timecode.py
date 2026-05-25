"""Sync Audio by Timecode — pairs external audio with camera clips using matching Start TC."""

from __future__ import annotations

import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


AUDIO_EXTS = {".wav", ".aif", ".aiff", ".mp3", ".flac", ".m4a"}
EXTERNAL_RECORDER_PATTERN = re.compile(
    r"(ZOOM|H[465]N?|TASCAM|MIXPRE|REC|LAV|GROOM|BRIDE|OFFICIANT|MIC[_-]?\d+)",
    re.IGNORECASE,
)


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def is_external_audio(clip) -> bool:
    try:
        name = clip.GetName()
        props = clip.GetClipProperty() or {}
    except Exception:
        return False
    file_path = props.get("File Path", "")
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in AUDIO_EXTS:
        return False
    if EXTERNAL_RECORDER_PATTERN.search(name) or EXTERNAL_RECORDER_PATTERN.search(file_path):
        return True
    return props.get("Type", "") == "Audio"


def is_video_with_audio(clip) -> bool:
    try:
        props = clip.GetClipProperty() or {}
    except Exception:
        return False
    if props.get("Type") not in ("Video", "Video + Audio"):
        return False
    raw_channels = props.get("Audio Ch") or "0"
    try:
        return int(str(raw_channels).split()[0]) > 0
    except (ValueError, IndexError):
        return False


def run(params: dict, dry_run: bool) -> None:
    if dry_run:
        bridge.result({
            "summary": "Dry run — would scan Media Pool for video + external audio, pair by Start TC, call AutoSyncAudio('Timecode')",
            "tolerance": "1 second window",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    all_clips: list = []
    walk_clips(conn.media_pool.GetRootFolder(), all_clips)
    bridge.log(f"Scanning {len(all_clips)} clips for video + external audio")

    video_by_tc: dict[str, list] = defaultdict(list)
    audio_by_tc: dict[str, list] = defaultdict(list)

    for clip in all_clips:
        try:
            props = clip.GetClipProperty() or {}
            start_tc = (props.get("Start TC", "") or "")[:8]
        except Exception:
            continue
        if not start_tc:
            continue
        if is_external_audio(clip):
            audio_by_tc[start_tc].append(clip)
        elif is_video_with_audio(clip):
            video_by_tc[start_tc].append(clip)

    pairs: list[list] = []
    unmatched_audio: list = []
    for tc, audio_clips in audio_by_tc.items():
        matched_video = video_by_tc.get(tc, [])
        if matched_video:
            pairs.append(matched_video + audio_clips)
        else:
            unmatched_audio.extend(audio_clips)

    bridge.log(f"Found {len(pairs)} sync candidates · {len(unmatched_audio)} audio clips with no TC match")

    successful: list[dict] = []
    failed: list[dict] = []
    for group in pairs:
        try:
            ok = conn.media_pool.AutoSyncAudio(group, ["Sound"], "Timecode")
        except Exception as exc:
            failed.append({"clips": [c.GetName() for c in group], "error": str(exc)})
            continue
        names = [c.GetName() for c in group]
        (successful if ok else failed).append({"clips": names})

    bridge.result({
        "syncedGroups": len(successful),
        "failedGroups": len(failed),
        "unmatchedAudioCount": len(unmatched_audio),
        "unmatchedAudioSample": [c.GetName() for c in unmatched_audio[:10]],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

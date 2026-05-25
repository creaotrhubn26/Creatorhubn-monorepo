"""Check Missing Media — scans Media Pool for offline clips, mismatched FPS, mixed resolutions."""

from __future__ import annotations

import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def walk_clips(folder, accumulator: list) -> None:
    accumulator.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, accumulator)


def run(params: dict, dry_run: bool) -> None:
    if dry_run:
        bridge.result({
            "summary": "Dry run — would walk Media Pool and flag offline / mixed-fps / mixed-resolution clips",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    all_clips: list = []
    walk_clips(conn.media_pool.GetRootFolder(), all_clips)
    bridge.log(f"Scanning {len(all_clips)} clips across all bins")

    offline: list[str] = []
    no_audio: list[str] = []
    fps_counter: Counter = Counter()
    resolution_counter: Counter = Counter()
    issues: list[dict] = []

    for clip in all_clips:
        try:
            name = clip.GetName()
            props = clip.GetClipProperty() or {}
        except Exception:
            continue

        path = props.get("File Path", "")
        if path and not os.path.exists(path):
            offline.append(name)

        audio_channels = props.get("Audio Ch") or props.get("Audio Channels") or "0"
        try:
            ch = int(str(audio_channels).split()[0])
        except (ValueError, IndexError):
            ch = 0
        if path and ch == 0 and props.get("Type", "") in ("Video", "Video + Audio"):
            no_audio.append(name)

        fps = props.get("FPS")
        if fps:
            fps_counter[str(fps)] += 1
        resolution = props.get("Resolution")
        if resolution:
            resolution_counter[str(resolution)] += 1

    if len(fps_counter) > 1:
        issues.append({"kind": "mixed_fps", "values": dict(fps_counter)})
    if len(resolution_counter) > 2:  # 2 is common (camera + drone)
        issues.append({"kind": "mixed_resolution", "values": dict(resolution_counter)})

    bridge.result({
        "totalClips": len(all_clips),
        "offlineCount": len(offline),
        "offlineClips": offline[:50],
        "missingAudioCount": len(no_audio),
        "missingAudioClips": no_audio[:50],
        "fpsDistribution": dict(fps_counter),
        "resolutionDistribution": dict(resolution_counter),
        "issues": issues,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

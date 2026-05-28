"""Mark QC Issues on Timeline — kjør gap+silent-deteksjon og legg til
Resolve-markers ved hvert problem.

Markeren har farge basert på type:
  ⬛ Svart-gap:  Red marker
  🔇 Stille:    Yellow marker

Marker-note inneholder:
  - Type (gap/silent)
  - Varighet
  - For stille: forslag fra unusedSongs hvis tilgjengelig

Input:
  timelineName:    (optional) timeline å markere — default = current
  unusedSongs:     (optional) for silent-suggestion
  removeOldQc:     (optional, default true) fjern eksisterende QC-markers først

Output:
  markersAdded: int
  blackCount: int
  silentCount: int
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


QC_TAG = "[QC]"  # prefix på note slik vi kan rydde gamle QC-markers


def run(params: dict[str, Any], dry_run: bool) -> None:
    timeline_name = (params.get("timelineName") or "").strip()
    unused_songs = params.get("unusedSongs") or []
    remove_old_qc = bool(params.get("removeOldQc", True))

    if dry_run:
        bridge.result({"wouldMark": timeline_name or "current"})
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

    # 1. Ryd gamle QC-markers
    if remove_old_qc:
        try:
            markers = timeline.GetMarkers() or {}
            for frame, m in list(markers.items()):
                note = m.get("note", "")
                if note.startswith(QC_TAG):
                    timeline.DeleteMarkerAtFrame(frame)
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Could not clean old markers: {exc}")

    # 2. Kjør detect-scripts via import-hopp
    import importlib.util
    def load_module(rel_path: str):
        full = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), rel_path)
        spec = importlib.util.spec_from_file_location(os.path.basename(rel_path)[:-3], full)
        if not spec or not spec.loader: return None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    # 3. Gap-detection — vi går direkte mot timeline-items (samme logikk som detect_timeline_gaps)
    items = timeline.GetItemListInTrack("video", 1) or []
    items_sorted = sorted(items, key=lambda it: it.GetStart() or 0)

    bridge.progress(20, 100, "Markerer svarte mellomrom …")
    black_count = 0
    GAP_THRESHOLD_F = max(1, int(0.04 * fps))
    for i, item in enumerate(items_sorted):
        if i == 0: continue
        prev_end = items_sorted[i - 1].GetEnd() or 0
        item_start = item.GetStart() or 0
        if item_start > prev_end:
            dur_f = item_start - prev_end
            if dur_f >= GAP_THRESHOLD_F:
                dur_sec = dur_f / fps
                offset_frames = prev_end - start_frame
                note = f"{QC_TAG} ⬛ Svart-mellomrom ({dur_sec:.2f}s) — bruk ripple-delete"
                try:
                    ok = timeline.AddMarker(offset_frames, "Red", "QC: Svart-gap", note, max(1, dur_f))
                    if ok: black_count += 1
                except Exception as exc:  # noqa: BLE001
                    bridge.warn(f"Add marker failed: {exc}")

    bridge.progress(60, 100, "Markerer stille intervaller …")
    # 4. Silent-detection: samme logikk som detect_silent_sections
    end_frame = timeline.GetEndFrame() or 0
    total_frames = max(1, end_frame - start_frame)
    audio_count = timeline.GetTrackCount("audio") or 0
    has_audio = [False] * (total_frames + 1)
    for ai in range(1, audio_count + 1):
        for item in timeline.GetItemListInTrack("audio", ai) or []:
            s = (item.GetStart() or start_frame) - start_frame
            e = (item.GetEnd() or start_frame) - start_frame
            for f in range(max(0, s), min(len(has_audio), e)):
                has_audio[f] = True

    silent_count = 0
    in_silence = False
    silence_start_f = 0
    MIN_SILENCE_F = int(3.0 * fps)
    for f in range(len(has_audio)):
        if not has_audio[f] and not in_silence:
            silence_start_f = f
            in_silence = True
        elif has_audio[f] and in_silence:
            dur_f = f - silence_start_f
            if dur_f >= MIN_SILENCE_F:
                dur_sec = dur_f / fps
                # Foreslå sang
                sugg = ""
                if unused_songs and isinstance(unused_songs, list) and unused_songs:
                    song = unused_songs[silent_count % len(unused_songs)]
                    if isinstance(song, dict):
                        sugg = f" → forslag: {song.get('title','?')} — {song.get('artist','?')}"
                note = f"{QC_TAG} 🔇 Stille ({dur_sec:.1f}s){sugg}"
                try:
                    ok = timeline.AddMarker(silence_start_f, "Yellow", "QC: Stille", note, max(1, dur_f))
                    if ok: silent_count += 1
                except Exception as exc:  # noqa: BLE001
                    bridge.warn(f"Add marker failed: {exc}")
            in_silence = False
    if in_silence:
        dur_f = len(has_audio) - silence_start_f
        if dur_f >= MIN_SILENCE_F:
            try:
                ok = timeline.AddMarker(silence_start_f, "Yellow", "QC: Stille",
                                         f"{QC_TAG} 🔇 Stille ({dur_f/fps:.1f}s) — siste del", max(1, dur_f))
                if ok: silent_count += 1
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"Add marker failed: {exc}")

    bridge.progress(100, 100, "Ferdig")
    total = black_count + silent_count
    bridge.log(f"Timeline '{timeline.GetName()}': la til {total} QC-markers "
               f"({black_count} ⬛ + {silent_count} 🔇)")
    bridge.result({
        "timelineName": timeline.GetName(),
        "markersAdded": total,
        "blackCount": black_count,
        "silentCount": silent_count,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

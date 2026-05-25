"""Add Transcription Markers — places per-segment markers on the current Resolve timeline.

Each transcript segment becomes a marker at its start time, color-coded by speaker (if diarized).
Marker name shows the first 5-6 words of the segment. Marker note holds the full text.

Params:
  segments: [{start, end, text, speaker?}]
  startOffsetSeconds: shift all markers by N seconds (for stems exported from non-zero TC)
  color: optional override (else auto-derived per speaker)
"""

from __future__ import annotations

import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


SPEAKER_COLORS = ["Cyan", "Pink", "Green", "Yellow", "Sky", "Lavender", "Sand", "Magenta"]
DEFAULT_COLOR = "Cyan"


def color_for_speaker(speaker: str | None, override: str | None) -> str:
    if override:
        return override
    if not speaker:
        return DEFAULT_COLOR
    h = int(hashlib.sha1(speaker.encode("utf-8")).hexdigest(), 16)
    return SPEAKER_COLORS[h % len(SPEAKER_COLORS)]


def first_words(text: str, count: int = 6) -> str:
    words = text.strip().split()
    if not words:
        return "(empty)"
    head = " ".join(words[:count])
    if len(words) > count:
        head += "…"
    return head[:60]


def run(params: dict, dry_run: bool) -> None:
    segments = params.get("segments") or []
    start_offset = float(params.get("startOffsetSeconds", 0))
    color_override = params.get("color")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would add {len(segments)} timeline markers from transcript segments",
            "speakerColors": SPEAKER_COLORS,
            "namePreview": "First 6 words of each segment",
            "notePreview": "Full segment text in marker note",
        })
        return

    if not segments:
        bridge.error("segments list cannot be empty")
        sys.exit(1)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline.")
        sys.exit(1)

    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 25)
    except (TypeError, ValueError):
        fps = 25.0

    start_frame = int(timeline.GetStartFrame() or 0)
    end_frame = int(timeline.GetEndFrame() or 0)

    added: list[dict] = []
    skipped: list[dict] = []

    for seg in segments:
        seconds = float(seg.get("start", 0)) + start_offset
        frame = start_frame + int(seconds * fps)
        if frame > end_frame:
            skipped.append({"text": first_words(seg.get("text", ""), 4), "reason": "beyond timeline end"})
            continue
        text = seg.get("text", "").strip()
        name = first_words(text, 6)
        color = color_for_speaker(seg.get("speaker"), color_override)
        try:
            ok = timeline.AddMarker(frame, color, name, text[:500], 1, name)
            if ok:
                added.append({"frame": frame, "name": name, "color": color, "speaker": seg.get("speaker")})
            else:
                skipped.append({"text": name, "reason": "AddMarker returned false (likely overlap)"})
        except Exception as exc:
            skipped.append({"text": name, "reason": str(exc)})

    bridge.result({
        "timelineName": timeline.GetName(),
        "fps": fps,
        "markersAdded": len(added),
        "markersSkipped": len(skipped),
        "added": added[:30],
        "skipped": skipped[:30],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

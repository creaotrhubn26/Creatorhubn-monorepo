"""Export FCPXML from approved picks.

FCPXML v1.10 (Final Cut Pro X-format) er rikere enn EDL — kan beskrive:
  • Multiple video + audio tracks
  • Markers + comments
  • Transitions (cross-dissolve)
  • Color corrections (CDL)
  • Aspect-ratio + frame-rate

Resolve, Premiere, FCP, og Avid kan alle importere FCPXML.

Output: <source-basename>_picks.fcpxml ved siden av source-fil eller
spesifisert outputPath.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any
from xml.sax.saxutils import escape as xml_escape

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_PATH = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_highlight_picks.json"
)


def _seconds_to_rational(seconds: float, fps: float) -> str:
    """FCPXML expects time as rational fraction: 'N/Ds'.
    For 24fps: 1s = 24/24s, 1.5s = 36/24s.
    Use frames as numerator + fps as denominator."""
    frames = round(seconds * fps)
    # Normalize to common rate (e.g., 24000/1001 for 23.976)
    if abs(fps - 23.976) < 0.01:
        return f"{frames * 1001}/{int(fps * 1001)}s"
    if abs(fps - 29.97) < 0.01:
        return f"{frames * 1001}/{int(fps * 1001)}s"
    return f"{frames}/{int(fps)}s"


def _build_fcpxml(picks: list[dict], source_video: str, fps: float,
                   title: str, aspect: str = "16:9") -> str:
    width, height = (1920, 1080) if aspect == "16:9" else \
                     (1080, 1920) if aspect == "9:16" else \
                     (1080, 1080)
    base = os.path.basename(source_video)
    src_uid = "src-" + os.path.splitext(base)[0].replace(" ", "_")[:30]
    file_url = "file://" + source_video.replace(" ", "%20")

    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<!DOCTYPE fcpxml>')
    lines.append('<fcpxml version="1.10">')
    lines.append('  <resources>')
    lines.append(f'    <format id="r1" name="FFVideoFormat{width}p{int(fps)}" '
                 f'frameDuration="100/{int(fps * 100)}s" '
                 f'width="{width}" height="{height}" colorSpace="1-1-1 (Rec. 709)"/>')
    lines.append(f'    <asset id="{src_uid}" name="{xml_escape(base)}" '
                 f'start="0s" hasVideo="1" hasAudio="1" '
                 f'format="r1" duration="3600s">')
    lines.append(f'      <media-rep kind="original-media" src="{xml_escape(file_url)}"/>')
    lines.append(f'    </asset>')
    lines.append('  </resources>')
    lines.append('  <library>')
    lines.append(f'    <event name="{xml_escape(title)}">')
    lines.append(f'      <project name="{xml_escape(title)}">')
    lines.append('        <sequence format="r1" tcStart="0s" tcFormat="NDF">')
    lines.append('          <spine>')

    record_time = 0.0
    for i, p in enumerate(picks):
        src_start = float(p.get("startSec", 0))
        src_end = float(p.get("endSec", src_start + 1))
        dur = max(0.1, src_end - src_start)
        offset = record_time
        clip_name = f"shot#{p.get('index', i)} ({p.get('chapter', '?')})"
        lines.append(
            f'            <asset-clip name="{xml_escape(clip_name)}" '
            f'offset="{_seconds_to_rational(offset, fps)}" '
            f'duration="{_seconds_to_rational(dur, fps)}" '
            f'start="{_seconds_to_rational(src_start, fps)}" '
            f'ref="{src_uid}" '
            f'tcFormat="NDF">'
        )
        # Markers for this clip
        if p.get("comment"):
            lines.append(
                f'              <marker start="{_seconds_to_rational(src_start, fps)}" '
                f'duration="100/{int(fps * 100)}s" value="{xml_escape(p["comment"])}"/>'
            )
        lines.append('            </asset-clip>')
        record_time += dur

    lines.append('          </spine>')
    lines.append('        </sequence>')
    lines.append('      </project>')
    lines.append('    </event>')
    lines.append('  </library>')
    lines.append('</fcpxml>')
    return "\n".join(lines)


def run(params: dict[str, Any], dry_run: bool) -> None:
    cache_path = (params.get("cachePath") or CACHE_PATH).strip() or CACHE_PATH
    output_path = (params.get("outputPath") or "").strip()
    title_override = (params.get("title") or "").strip()
    aspect = (params.get("aspectRatio") or "16:9").strip()

    if not os.path.isfile(cache_path):
        bridge.error(f"Ingen picks-cache funnet ved {cache_path}")
        sys.exit(1)

    try:
        with open(cache_path) as f:
            cached = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        bridge.error(f"Could not read picks cache: {exc}")
        sys.exit(1)

    picks = cached.get("picks") or []
    source_video = cached.get("sourceVideo") or ""
    fps = float(cached.get("fps") or 24.0)

    if not picks:
        bridge.error("Picks cache has no approved picks")
        sys.exit(1)

    # Apply editor-state (samme som EDL/Resolve)
    overrides_raw = params.get("pickOverrides") or {}
    pick_order = params.get("pickOrder")
    excluded = params.get("excludedChapters") or []
    if overrides_raw or pick_order or excluded:
        if isinstance(overrides_raw, dict):
            ov = {}
            for k, v in overrides_raw.items():
                try: ov[int(k)] = v if isinstance(v, dict) else {}
                except (TypeError, ValueError): continue
            for p in picks:
                o = ov.get(p.get("index"))
                if not o: continue
                if "startSec" in o: p["startSec"] = float(o["startSec"])
                if "endSec"   in o: p["endSec"]   = float(o["endSec"])
        if isinstance(pick_order, list) and pick_order:
            order_map = {idx: i for i, idx in enumerate(pick_order)}
            picks = [p for p in picks if p.get("index") in order_map]
            picks.sort(key=lambda p: order_map[p["index"]])
        if isinstance(excluded, list) and excluded:
            ex = {str(c).lower() for c in excluded}
            picks = [p for p in picks if (p.get("chapter") or "details").lower() not in ex]
        bridge.log(f"Applied editor-state: {len(picks)} picks i FCPXML")

    base = os.path.splitext(os.path.basename(source_video or "Highlight"))[0]
    title = title_override or f"{base} — Post Agent picks"
    if not output_path:
        output_path = os.path.join(os.path.dirname(source_video) or os.path.expanduser("~/Desktop"),
                                    f"{base}_picks.fcpxml")
    output_path = os.path.expanduser(output_path)
    if not output_path.endswith(".fcpxml"):
        output_path += ".fcpxml"

    if dry_run:
        bridge.result({"wouldExport": output_path, "picks": len(picks), "fps": fps, "aspect": aspect})
        return

    bridge.progress(50, 100, "Building FCPXML…")
    xml = _build_fcpxml(picks, source_video, fps, title, aspect)
    with open(output_path, "w") as f:
        f.write(xml)
    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"Wrote {len(picks)} picks → {output_path}")
    bridge.result({
        "outputPath": output_path,
        "picks": len(picks),
        "fps": fps,
        "aspect": aspect,
        "title": title,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

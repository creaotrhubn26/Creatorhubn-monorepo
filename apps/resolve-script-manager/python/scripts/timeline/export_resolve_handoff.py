"""Export Resolve Handoff — eksporter agent-state som DaVinci Resolve-
kompatible timeline-filer.

Genererer to output-filer:
  1. <name>.xml — FCP7 XML med source-clip + chapter-markers + caption-
     spor. Importeres via Resolve File → Import Timeline. Markers blir
     til chapter markers i Edit-page.
  2. <name>.edl — Forenklet CMX 3600 EDL med basis-cuts. Brukes som
     fallback hvis XML feiler.

Strategi:
  - Source-video kobles til som master-clip
  - Chapter-grenser fra agent-config (chapters med pacingPct) plottes
    proporsjonalt over video-varighet → markers ved chapter-start
  - Captions (hvis tilgjengelig) blir til en separate subtitle-spor
    med per-segment titler (Resolve titles)
  - Lower-thirds (hvis tilgjengelig) blir merknader på timeline med
    speaker-navn og varighet

Output via bridge.result():
  {
    "xmlPath": "/path/handoff.xml",
    "edlPath": "/path/handoff.edl",
    "outputDir": "/path",
    "chapterMarkers": 8,
    "captionSubtitles": 124,
    "lowerThirdMarkers": 5,
  }

Input params:
  videoPath:    source-video som master-clip
  outputDir:    (optional) custom output-dir
  projectName:  (optional) navn på timeline (default 'Post Agent Handoff')
  chapters:     (optional) array av { id, label, pacingPct }
  captions:     (optional) WhisperTranscript-objekt med segments[]
  lowerThirds:  (optional) array av LowerThirdItem
  framerate:    (optional, default 25)
  resolution:   (optional, default '1920x1080')
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Any
from xml.dom import minidom
from xml.etree import ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _get_video_info(ffmpeg: str, video_path: str) -> dict[str, Any]:
    """Hent varighet, fps, bredde, høyde via ffprobe."""
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    result = {"durationSec": 0.0, "fps": 25.0, "width": 1920, "height": 1080}
    if not os.path.isfile(ffprobe):
        return result
    try:
        r = subprocess.run([
            ffprobe, "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate",
            "-show_entries", "format=duration",
            "-of", "csv=p=0", video_path,
        ], capture_output=True, text=True, timeout=20)
        if r.returncode == 0:
            lines = [l for l in r.stdout.strip().split("\n") if l]
            for line in lines:
                parts = line.split(",")
                # Stream-linje: width,height,r_frame_rate
                if len(parts) >= 3 and "/" in parts[2]:
                    result["width"] = int(parts[0])
                    result["height"] = int(parts[1])
                    num, den = parts[2].split("/")
                    if int(den) > 0:
                        result["fps"] = round(int(num) / int(den), 3)
                elif len(parts) == 1:
                    try: result["durationSec"] = float(parts[0])
                    except ValueError: pass
    except (subprocess.TimeoutExpired, ValueError) as exc:
        bridge.warn(f"ffprobe feilet: {exc}")
    return result


def _build_fcp7_xml(
    project_name: str,
    video_path: str,
    duration_sec: float,
    fps: float,
    width: int,
    height: int,
    chapters: list[dict[str, Any]] | None,
    captions: dict[str, Any] | None,
    lower_thirds: list[dict[str, Any]] | None,
) -> str:
    """Bygg FCP7 XML-string. FCP7 XML er widely supported av DaVinci
    Resolve, Premiere, Final Cut Pro 7, og er det mest kompatible
    handoff-formatet."""
    duration_frames = int(duration_sec * fps)

    xmeml = ET.Element("xmeml", version="5")
    project = ET.SubElement(xmeml, "project")
    ET.SubElement(project, "name").text = project_name
    children = ET.SubElement(project, "children")

    sequence = ET.SubElement(children, "sequence", id="seq-1")
    ET.SubElement(sequence, "name").text = project_name
    ET.SubElement(sequence, "duration").text = str(duration_frames)

    # Rate
    rate = ET.SubElement(sequence, "rate")
    ET.SubElement(rate, "ntsc").text = "FALSE"
    ET.SubElement(rate, "timebase").text = str(int(round(fps)))

    # Media
    media = ET.SubElement(sequence, "media")
    video = ET.SubElement(media, "video")

    # Format
    fmt = ET.SubElement(video, "format")
    sample_chars = ET.SubElement(fmt, "samplecharacteristics")
    ET.SubElement(sample_chars, "width").text = str(width)
    ET.SubElement(sample_chars, "height").text = str(height)

    # Video track med master-clip
    track = ET.SubElement(video, "track")
    clipitem = ET.SubElement(track, "clipitem", id="clip-1")
    ET.SubElement(clipitem, "name").text = os.path.basename(video_path)
    ET.SubElement(clipitem, "duration").text = str(duration_frames)
    ET.SubElement(clipitem, "start").text = "0"
    ET.SubElement(clipitem, "end").text = str(duration_frames)
    ET.SubElement(clipitem, "in").text = "0"
    ET.SubElement(clipitem, "out").text = str(duration_frames)

    # File-reference
    file_elem = ET.SubElement(clipitem, "file", id="file-1")
    ET.SubElement(file_elem, "name").text = os.path.basename(video_path)
    ET.SubElement(file_elem, "pathurl").text = f"file://{video_path}"
    ET.SubElement(file_elem, "duration").text = str(duration_frames)

    # Chapter-markers
    if chapters:
        cumulative_pct = 0.0
        for ch in chapters:
            pct = float(ch.get("pacingPct", 0))
            chapter_start_sec = (cumulative_pct / 100.0) * duration_sec
            cumulative_pct += pct
            marker = ET.SubElement(sequence, "marker")
            ET.SubElement(marker, "name").text = str(ch.get("label", "Chapter"))
            ET.SubElement(marker, "comment").text = (
                f"Auto-generated by Post Agent. "
                f"Chapter: {ch.get('id', '')}, "
                f"target {pct:.1f}%, priority: {ch.get('priorityHint', 'n/a')}"
            )
            ET.SubElement(marker, "in").text = str(int(chapter_start_sec * fps))
            ET.SubElement(marker, "out").text = "-1"

    # Lower-third markers
    if lower_thirds:
        for lt in lower_thirds:
            if not lt.get("enabled", True): continue
            start = float(lt.get("startTime", 0))
            duration = float(lt.get("duration", 6))
            marker = ET.SubElement(sequence, "marker")
            title = str(lt.get("title", "Lower Third"))
            subtitle = str(lt.get("subtitle", ""))
            label = f"LT: {title}" + (f" — {subtitle}" if subtitle else "")
            ET.SubElement(marker, "name").text = label
            ET.SubElement(marker, "comment").text = (
                f"Lower-third overlay. Position: {lt.get('position', 'bottom-left')}, "
                f"duration {duration:.1f}s"
            )
            ET.SubElement(marker, "in").text = str(int(start * fps))
            ET.SubElement(marker, "out").text = str(int((start + duration) * fps))

    # Caption-titles på subtitle-track
    if captions and captions.get("segments"):
        title_track = ET.SubElement(video, "track")
        for i, seg in enumerate(captions["segments"]):
            start_f = int(float(seg.get("start", 0)) * fps)
            end_f = int(float(seg.get("end", 0)) * fps)
            if end_f <= start_f: continue
            tclip = ET.SubElement(title_track, "clipitem",
                                   id=f"sub-{i}")
            ET.SubElement(tclip, "name").text = (
                str(seg.get("text", ""))[:80] or "(empty)"
            )
            ET.SubElement(tclip, "duration").text = str(end_f - start_f)
            ET.SubElement(tclip, "start").text = str(start_f)
            ET.SubElement(tclip, "end").text = str(end_f)
            ET.SubElement(tclip, "in").text = "0"
            ET.SubElement(tclip, "out").text = str(end_f - start_f)
            # Marker som title-effect
            effect = ET.SubElement(tclip, "effect")
            ET.SubElement(effect, "name").text = "Text"
            ET.SubElement(effect, "effecttype").text = "generator"
            param = ET.SubElement(effect, "parameter")
            ET.SubElement(param, "parameterid").text = "str"
            ET.SubElement(param, "value").text = str(seg.get("text", ""))

    # Pretty-print
    raw_xml = ET.tostring(xmeml, encoding="unicode")
    parsed = minidom.parseString(raw_xml)
    return parsed.toprettyxml(indent="  ")


def _build_edl(
    project_name: str,
    video_path: str,
    duration_sec: float,
    fps: float,
    chapters: list[dict[str, Any]] | None,
) -> str:
    """Bygg forenklet CMX 3600 EDL. EDL er enkel timeline-format som
    de fleste NLE-er forstår. Brukes som fallback hvis XML-import
    feiler i Resolve."""
    lines = [
        f"TITLE: {project_name}",
        "FCM: NON-DROP FRAME",
        "",
    ]
    base_name = os.path.basename(video_path).rsplit(".", 1)[0][:8].upper()

    def to_tc(sec: float) -> str:
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = int(sec % 60)
        f = int((sec % 1) * fps)
        return f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"

    # Hovedklipp først
    lines.append(f"001  {base_name:<8} V     C        "
                 f"{to_tc(0)} {to_tc(duration_sec)} "
                 f"{to_tc(0)} {to_tc(duration_sec)}")
    lines.append(f"* FROM CLIP NAME: {os.path.basename(video_path)}")
    lines.append("")

    # Chapter-markers som notes (EDL støtter ikke direkte markers)
    if chapters:
        cumulative_pct = 0.0
        for i, ch in enumerate(chapters):
            pct = float(ch.get("pacingPct", 0))
            chapter_start = (cumulative_pct / 100.0) * duration_sec
            cumulative_pct += pct
            lines.append(f"* CHAPTER {i+1}: {ch.get('label', '')} "
                         f"@ {to_tc(chapter_start)} "
                         f"(pacing: {pct:.1f}%)")
    return "\n".join(lines)


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' mangler")
        sys.exit(1)

    output_dir = (params.get("outputDir") or "").strip()
    if not output_dir:
        output_dir = os.path.expanduser(
            "~/Library/Application Support/"
            "no.creatorhubn.roleroom-post-agent/resolve_handoffs"
        )
    os.makedirs(output_dir, exist_ok=True)

    project_name = str(params.get("projectName") or "Post Agent Handoff")
    chapters = params.get("chapters") or []
    captions = params.get("captions") or None
    lower_thirds = params.get("lowerThirds") or []
    fps_override = params.get("framerate")

    if dry_run:
        bridge.result({
            "wouldWrite": output_dir,
            "projectName": project_name,
            "chaptersCount": len(chapters) if isinstance(chapters, list) else 0,
            "hasCaptions": bool(captions),
            "lowerThirdsCount": len(lower_thirds) if isinstance(lower_thirds, list) else 0,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    info = _get_video_info(ffmpeg, video_path)
    if info["durationSec"] <= 0:
        bridge.error("Kunne ikke lese video-varighet")
        sys.exit(1)

    fps = float(fps_override) if fps_override else info["fps"]
    duration_sec = info["durationSec"]
    width = info["width"]
    height = info["height"]

    bridge.log(
        f"Bygger handoff for {os.path.basename(video_path)}: "
        f"{duration_sec:.1f}s @ {fps}fps, {width}×{height}"
    )

    # Safe filename
    safe_name = "".join(c if c.isalnum() or c in "_-" else "_"
                        for c in project_name).strip("_")[:60] or "handoff"

    # Build XML
    xml_content = _build_fcp7_xml(
        project_name, video_path, duration_sec, fps, width, height,
        chapters if isinstance(chapters, list) else None,
        captions if isinstance(captions, dict) else None,
        lower_thirds if isinstance(lower_thirds, list) else None,
    )
    xml_path = os.path.join(output_dir, f"{safe_name}.xml")
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml_content)
    bridge.log(f"FCP7 XML skrevet → {xml_path}")

    # Build EDL fallback
    edl_content = _build_edl(
        project_name, video_path, duration_sec, fps,
        chapters if isinstance(chapters, list) else None,
    )
    edl_path = os.path.join(output_dir, f"{safe_name}.edl")
    with open(edl_path, "w", encoding="utf-8") as f:
        f.write(edl_content)
    bridge.log(f"EDL skrevet → {edl_path}")

    result = {
        "xmlPath": xml_path,
        "edlPath": edl_path,
        "outputDir": output_dir,
        "chapterMarkers": len(chapters) if isinstance(chapters, list) else 0,
        "captionSubtitles": len(captions.get("segments", []))
                            if isinstance(captions, dict) else 0,
        "lowerThirdMarkers": len([lt for lt in lower_thirds
                                   if isinstance(lt, dict) and lt.get("enabled", True)])
                              if isinstance(lower_thirds, list) else 0,
        "framerate": fps,
        "durationSec": round(duration_sec, 1),
    }
    bridge.log(
        f"Ferdig: {result['chapterMarkers']} chapter-markers, "
        f"{result['captionSubtitles']} caption-titles, "
        f"{result['lowerThirdMarkers']} lower-third-markers"
    )
    bridge.result(result)


bridge.main_guard(run)

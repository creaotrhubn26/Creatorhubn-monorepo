"""Scan and Organize Sources — flerkilde-scan med kamera-metadata.

Tar én eller flere kilder (SD/SSD/folders), skanner alle videoklipp, henter
kamera-metadata (make/model/serial/codec) og grupperer klipp per kamera.
Bruker brukes til å mappe kameraer til vinkel-nummer (Vinkel 1, 2, 3).

Input:
  sources: list of {path: str, role?: "card"|"folder"|"ssd"}

Output:
  cameras: [
    {
      id: str (unique key fra make+model+serial),
      make: str | None,
      model: str | None,
      serial: str | None,
      clips: [{ path, duration, createdAt, sizeBytes }],
      totalDuration: float,
      totalSizeBytes: int,
      suggestedAngle: int  (basert på antall klipp — flest = vinkel 1)
    }
  ]
  audioFiles: [{ path, duration, sizeBytes }]  # WAV/MP3 etc.
  totalSources: int
  totalClips: int
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


VIDEO_EXT = {".mp4", ".mov", ".mkv", ".m4v", ".avi", ".mts", ".m2ts", ".mxf", ".braw", ".r3d"}
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".flac", ".aif", ".aiff"}


def find_tool(name: str) -> str | None:
    p = shutil.which(name)
    if p: return p
    for base in ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"):
        full = os.path.join(base, name)
        if os.path.isfile(full): return full
    return None


def probe_camera(ffprobe: str, path: str) -> dict:
    """Hent kamera-metadata via ffprobe + filename-heuristics."""
    info = {
        "make": None, "model": None, "serial": None,
        "duration": 0.0, "createdAt": 0, "sizeBytes": 0,
        "codec": None, "width": 0, "height": 0,
    }
    try:
        r = subprocess.run([
            ffprobe, "-v", "error", "-print_format", "json",
            "-show_format", "-show_streams", path,
        ], capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            data = json.loads(r.stdout)
            fmt = data.get("format", {})
            tags = fmt.get("tags", {}) or {}
            vstream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
            vtags = vstream.get("tags", {}) or {}

            info["duration"] = float(fmt.get("duration") or 0)
            info["sizeBytes"] = int(fmt.get("size") or 0)
            info["codec"] = vstream.get("codec_name")
            info["width"] = int(vstream.get("width") or 0)
            info["height"] = int(vstream.get("height") or 0)
            # Make/model fra EXIF-lignende tags
            info["make"] = (tags.get("make") or vtags.get("make")
                            or tags.get("manufacturer") or vtags.get("manufacturer"))
            # major_brand er ofte generisk ("isom", "mp42", "qt  ") for eksportert MP4
            # → ikke bruk som model med mindre ingen ekte metadata finnes
            model = tags.get("model") or vtags.get("model")
            if not model:
                mb = tags.get("major_brand")
                if mb and mb.lower().strip() not in {"isom", "mp42", "qt  ", "qt", "iso2", "avc1", "mp41", "mp4v", "f4v "}:
                    model = mb
            info["model"] = model
            info["serial"] = (tags.get("serial_number") or vtags.get("serial_number")
                              or tags.get("uuid") or None)

            # creation_time
            creation = tags.get("creation_time") or vtags.get("creation_time")
            if creation:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(creation.replace("Z", "+00:00"))
                    info["createdAt"] = dt.timestamp()
                except (ValueError, TypeError):
                    pass
    except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError):
        pass

    if info["createdAt"] == 0:
        try: info["createdAt"] = os.path.getmtime(path)
        except OSError: pass

    # Filename-heuristics — fallback for kameraer som ikke skriver EXIF.
    # Sjekk også parent-mappens navn (Bjarne organiserer ofte i Canon_C80/, GoPro/, etc.)
    base = os.path.basename(path).lower()
    parent = os.path.basename(os.path.dirname(path)).lower()
    haystack = f"{parent}/{base}"
    if not info["model"]:
        if "c80" in haystack: info["model"] = "Canon C80"
        elif "c70" in haystack: info["model"] = "Canon C70"
        elif "c300" in haystack: info["model"] = "Canon C300"
        elif "r5c" in haystack: info["model"] = "Canon R5C"
        elif "r5" in haystack: info["model"] = "Canon R5"
        elif "fx3" in haystack: info["model"] = "Sony FX3"
        elif "fx6" in haystack: info["model"] = "Sony FX6"
        elif "fx9" in haystack: info["model"] = "Sony FX9"
        elif "a7s" in haystack: info["model"] = "Sony A7S"
        elif "fs7" in haystack: info["model"] = "Sony FS7"
        elif "bmpcc" in haystack or "blackmagic" in haystack: info["model"] = "Blackmagic Pocket"
        elif "gh5" in haystack or "gh6" in haystack: info["model"] = "Panasonic GH"
        elif "gopro" in haystack or "gh01" in base or "gh02" in base or "gx01" in base:
            info["model"] = "GoPro"
        elif "dji" in haystack or "mavic" in haystack: info["model"] = "DJI"
        elif "iphone" in haystack or "img_" in base: info["model"] = "iPhone"

    return info


def camera_key(info: dict) -> str:
    """Unik nøkkel per kamera. Bruker make+model+serial. Fallback til kun model."""
    parts = []
    if info.get("make"): parts.append(str(info["make"]).strip())
    if info.get("model"): parts.append(str(info["model"]).strip())
    if info.get("serial"): parts.append(str(info["serial"]).strip())
    if not parts: parts.append("Unknown")
    return " · ".join(parts)


def find_files(folder: str, exts: set) -> list[str]:
    out = []
    if not os.path.isdir(folder): return out
    for root, _, files in os.walk(folder):
        for f in files:
            if f.startswith("."): continue
            if os.path.splitext(f)[1].lower() in exts:
                out.append(os.path.join(root, f))
    return sorted(out)


def run(params: dict[str, Any], dry_run: bool) -> None:
    sources = params.get("sources") or []
    if not isinstance(sources, list) or not sources:
        bridge.error("sources required (list of {path: ...})")
        sys.exit(1)

    ffprobe = find_tool("ffprobe")
    if not ffprobe:
        bridge.error("ffprobe ikke funnet")
        sys.exit(1)

    # Samle alle video + audio-filer fra alle sources
    video_paths: list[str] = []
    audio_paths: list[str] = []
    for src in sources:
        p = src.get("path") if isinstance(src, dict) else (src if isinstance(src, str) else None)
        if not p or not os.path.isdir(p): continue
        video_paths.extend(find_files(p, VIDEO_EXT))
        audio_paths.extend(find_files(p, AUDIO_EXT))

    if not video_paths:
        bridge.error(f"Ingen videoklipp i {len(sources)} kilder")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldScan": len(video_paths),
            "audioCount": len(audio_paths),
        })
        return

    # Probe alle videoer
    cameras: dict[str, dict] = {}  # camera_key → {info, clips: []}
    for i, path in enumerate(video_paths):
        bridge.progress(int(80 * (i + 1) / len(video_paths)), 100,
                        f"Leser metadata {os.path.basename(path)} ({i+1}/{len(video_paths)})")
        meta = probe_camera(ffprobe, path)
        key = camera_key(meta)
        if key not in cameras:
            cameras[key] = {
                "id": f"cam_{len(cameras)}",
                "make": meta["make"],
                "model": meta["model"],
                "serial": meta["serial"],
                "clips": [],
                "totalDuration": 0.0,
                "totalSizeBytes": 0,
                "codec": meta["codec"],
                "resolution": f"{meta['width']}×{meta['height']}" if meta["width"] else None,
            }
        cameras[key]["clips"].append({
            "path": path,
            "duration": meta["duration"],
            "createdAt": meta["createdAt"],
            "sizeBytes": meta["sizeBytes"],
        })
        cameras[key]["totalDuration"] += meta["duration"]
        cameras[key]["totalSizeBytes"] += meta["sizeBytes"]

    # Sorter kameraer etter totalDuration (mest = sannsynligvis hoved-vinkel)
    sorted_cams = sorted(cameras.values(), key=lambda c: -c["totalDuration"])
    for i, cam in enumerate(sorted_cams):
        cam["suggestedAngle"] = i + 1
        cam["clipCount"] = len(cam["clips"])

    # Probe audio-filer (lett, kun duration + size)
    audio_files = []
    for i, path in enumerate(audio_paths):
        bridge.progress(80 + int(15 * (i + 1) / max(1, len(audio_paths))), 100,
                        f"Audio {os.path.basename(path)}")
        try:
            r = subprocess.run([
                ffprobe, "-v", "error", "-show_entries", "format=duration",
                "-of", "csv=p=0", path,
            ], capture_output=True, text=True, timeout=10)
            dur = float(r.stdout.strip() or 0)
        except (subprocess.TimeoutExpired, ValueError, OSError):
            dur = 0.0
        try:
            size = os.path.getsize(path)
        except OSError:
            size = 0
        audio_files.append({"path": path, "duration": dur, "sizeBytes": size})

    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"Fant {len(sorted_cams)} kameraer + {len(audio_files)} lyd-filer")
    bridge.result({
        "cameras": sorted_cams,
        "audioFiles": audio_files,
        "totalSources": len(sources),
        "totalClips": len(video_paths),
        "cameraCount": len(sorted_cams),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

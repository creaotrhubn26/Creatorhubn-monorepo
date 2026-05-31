"""Backup Multi-Source with Angles — kopier flere kilder (SD/SSD/mapper) til
en organisert DIT-struktur basert på vinkel-tilordninger fra wizard.

Struktur som lages:
  {ssdPath}/{ProjectName}_{YYYY-MM-DD}/
    01_Footage/
      Vinkel1_CanonC80/   ← angle 1 + kamera-model
      Vinkel2_SonyFX3/
      Vinkel3_GoPro/
    02_Audio/
    03_Music/
    04_Graphics/
    05_Editing/Resolve_Projects/
    06_Deliverables/

Input:
  sources:        list of {path, role, cameraId, angleNumber, angleLabel, cameraModel}
  ssdPath:        backup destinasjon
  projectName:    f.eks. "Hamis_Rukhma"
  audioFolders:   list of paths med eksterne lyd-filer (settes inn i 02_Audio/)

Output:
  projectRoot:    full path til root-mappa
  cameraMap:      {originalPath: newPath} per kopiert fil
  bins:           liste over bin-strukturer for Resolve (brukes av timeline-build)
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


VIDEO_EXT = {".mp4", ".mov", ".mkv", ".m4v", ".avi", ".mts", ".m2ts", ".mxf", ".braw"}
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".flac", ".aif", ".aiff"}


def safe_name(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", (s or "").strip())[:60]


def rsync_files(src_paths: list[str], dst_paths: list[str],
                progress_offset: int, progress_span: int) -> tuple[int, int]:
    """Kopier filer via shutil. Returnerer (copied, total_bytes)."""
    copied = 0
    total = 0
    n = len(src_paths)
    for i, (src, dst) in enumerate(zip(src_paths, dst_paths)):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.path.exists(dst) and os.path.getsize(dst) == os.path.getsize(src):
            copied += 1
            total += os.path.getsize(src)
            continue
        try:
            shutil.copy2(src, dst)
            total += os.path.getsize(dst)
            copied += 1
        except OSError as exc:
            bridge.warn(f"Copy failed {os.path.basename(src)}: {exc}")
        if (i + 1) % max(1, n // 20) == 0:
            bridge.progress(
                progress_offset + int(progress_span * (i + 1) / n),
                100,
                f"Kopierer {i+1}/{n} filer ({total / 1e9:.1f} GB)",
            )
    return copied, total


def run(params: dict[str, Any], dry_run: bool) -> None:
    sources_raw = params.get("sources") or []
    ssd_path = (params.get("ssdPath") or "").strip()
    project_name = (params.get("projectName") or "Untitled").strip()
    audio_folders = params.get("audioFolders") or []

    if not ssd_path or not os.path.isdir(ssd_path):
        bridge.error("ssdPath må peke på en eksisterende mappe")
        sys.exit(1)
    if not sources_raw:
        bridge.error("sources kan ikke være tom")
        sys.exit(1)

    # Bygg target-struktur
    safe_proj = safe_name(project_name)
    today = date.today().isoformat()
    project_root = os.path.join(ssd_path, f"{safe_proj}_{today}")

    bins_structure: list[dict] = []
    camera_map: dict[str, str] = {}  # originalPath → newPath
    src_paths: list[str] = []
    dst_paths: list[str] = []

    # Per kilde: bygg destination
    for src in sources_raw:
        if not isinstance(src, dict): continue
        path = src.get("path")
        if not path or not os.path.isdir(path): continue
        angle_n = int(src.get("angleNumber") or 0)
        camera_model = (src.get("cameraModel") or "").strip()
        angle_label = (src.get("angleLabel") or "").strip()

        # Mappenavn: "Vinkel1_CanonC80" eller "Vinkel1_HovedKamera"
        cam_short = safe_name(camera_model) or "Camera"
        bin_name = f"Vinkel{angle_n}_{cam_short}" if angle_n else cam_short
        if angle_label:
            bin_name = f"{bin_name}_{safe_name(angle_label)}"

        target_dir = os.path.join(project_root, "01_Footage", bin_name)
        bins_structure.append({
            "binName": bin_name,
            "angleNumber": angle_n,
            "cameraModel": camera_model,
            "path": target_dir,
        })

        # Enumerér alle video-filer i kilden
        for root, _, files in os.walk(path):
            for f in files:
                if f.startswith("."): continue
                if os.path.splitext(f)[1].lower() not in VIDEO_EXT: continue
                full = os.path.join(root, f)
                dst = os.path.join(target_dir, f)
                src_paths.append(full)
                dst_paths.append(dst)
                camera_map[full] = dst

    # Audio-filer
    audio_target = os.path.join(project_root, "02_Audio")
    audio_src: list[str] = []
    audio_dst: list[str] = []
    for folder in audio_folders:
        if not isinstance(folder, str) or not os.path.isdir(folder): continue
        for root, _, files in os.walk(folder):
            for f in files:
                if f.startswith("."): continue
                if os.path.splitext(f)[1].lower() not in AUDIO_EXT: continue
                full = os.path.join(root, f)
                dst = os.path.join(audio_target, f)
                audio_src.append(full); audio_dst.append(dst)
                camera_map[full] = dst

    total_files = len(src_paths) + len(audio_src)
    estimated_bytes = sum(os.path.getsize(p) for p in src_paths + audio_src if os.path.isfile(p))

    if dry_run:
        bridge.result({
            "wouldCopy": total_files,
            "estimatedGB": round(estimated_bytes / 1e9, 2),
            "projectRoot": project_root,
            "bins": bins_structure,
        })
        return

    # Lag mappestruktur
    bridge.progress(0, 100, f"Lager mappestruktur i {project_root}")
    for sub in ["01_Footage", "02_Audio", "03_Music", "04_Graphics",
                 "05_Editing/Resolve_Projects", "06_Deliverables"]:
        os.makedirs(os.path.join(project_root, sub), exist_ok=True)

    bridge.log(f"Kopierer {len(src_paths)} videoer + {len(audio_src)} audio-filer "
               f"({estimated_bytes / 1e9:.1f} GB)")

    # Video-kopier (10-80%)
    if src_paths:
        rsync_files(src_paths, dst_paths, 10, 70)

    # Audio-kopier (80-95%)
    if audio_src:
        rsync_files(audio_src, audio_dst, 80, 15)

    bridge.progress(100, 100, "Backup ferdig")
    bridge.log(f"DIT-struktur ferdig: {project_root}")

    # Skriv et "bins.json"-manifest i 05_Editing slik at timeline-build kan lese det
    manifest_path = os.path.join(project_root, "05_Editing", "bins.json")
    try:
        with open(manifest_path, "w") as f:
            json.dump({
                "projectName": project_name,
                "projectRoot": project_root,
                "bins": bins_structure,
                "audioPath": audio_target,
            }, f, indent=2)
    except OSError:
        pass

    bridge.result({
        "projectRoot": project_root,
        "bins": bins_structure,
        "cameraMap": camera_map,
        "filesCount": total_files,
        "totalBytes": estimated_bytes,
        "manifestPath": manifest_path,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

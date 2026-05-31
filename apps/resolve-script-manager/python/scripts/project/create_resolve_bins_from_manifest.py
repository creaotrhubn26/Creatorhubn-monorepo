"""Create Resolve Bins From Manifest — leser bins.json fra backup-kjøringen
og oppretter sub-bins i Resolve-prosjektets MediaPool, importerer klipp i
hver bin.

Forutsetter:
  - Resolve kjører + et prosjekt er åpent
  - bins.json eksisterer på sti (lagd av backup_multi_source_with_angles)

Bins-struktur som lages:
  Root/
    01_Footage/
      Vinkel1_CanonC80/  ← clips importert
      Vinkel2_SonyFX3/
      Vinkel3_GoPro/
    02_Audio/

Input:
  manifestPath: full path til bins.json
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def ensure_subfolder(media_pool, parent, name: str):
    """Returner subfolder med navn, opprett hvis ikke finnes."""
    children = parent.GetSubFolderList() or []
    for c in children:
        try:
            if c.GetName() == name:
                return c
        except Exception:  # noqa: BLE001
            continue
    return media_pool.AddSubFolder(parent, name)


def list_files(folder: str, exts: set) -> list[str]:
    out = []
    if not os.path.isdir(folder): return out
    for root, _, files in os.walk(folder):
        for f in files:
            if f.startswith("."): continue
            if os.path.splitext(f)[1].lower() in exts:
                out.append(os.path.join(root, f))
    return sorted(out)


VIDEO_EXT = {".mp4", ".mov", ".mkv", ".m4v", ".avi", ".mts", ".m2ts", ".mxf", ".braw"}
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".flac", ".aif", ".aiff"}


def run(params: dict[str, Any], dry_run: bool) -> None:
    manifest_path = (params.get("manifestPath") or "").strip()
    if not manifest_path or not os.path.isfile(manifest_path):
        bridge.error(f"manifestPath '{manifest_path}' is not a file")
        sys.exit(1)

    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        bridge.error(f"Could not read manifest: {exc}")
        sys.exit(1)

    project_root = manifest.get("projectRoot")
    bins = manifest.get("bins") or []
    audio_path = manifest.get("audioPath") or os.path.join(project_root or "", "02_Audio")

    if dry_run:
        bridge.result({
            "wouldCreate": len(bins) + 1,
            "bins": [b["binName"] for b in bins] + ["02_Audio"],
        })
        return

    bridge.progress(0, 100, "Connecting to Resolve…")
    conn = bridge.ResolveConnection()
    if not conn.connect():
        sys.exit(1)
    if not conn.project:
        bridge.error("No project open in Resolve. Åpne et prosjekt først.")
        sys.exit(1)

    media_pool = conn.media_pool
    if not media_pool:
        bridge.error("Could not get MediaPool")
        sys.exit(1)

    root_folder = media_pool.GetRootFolder()

    bridge.progress(15, 100, "Lager 01_Footage-bin …")
    footage_bin = ensure_subfolder(media_pool, root_folder, "01_Footage")

    imported_count = 0
    for i, b in enumerate(bins):
        bin_name = b.get("binName")
        bin_path = b.get("path")
        if not bin_name or not bin_path: continue

        bridge.progress(
            20 + int(60 * (i + 1) / max(1, len(bins))), 100,
            f"Lager bin '{bin_name}' + importerer klipp",
        )

        cam_bin = ensure_subfolder(media_pool, footage_bin, bin_name)
        media_pool.SetCurrentFolder(cam_bin)

        videos = list_files(bin_path, VIDEO_EXT)
        if videos:
            try:
                imported = media_pool.ImportMedia(videos)
                imported_count += len(imported) if imported else 0
                bridge.log(f"  {bin_name}: importert {len(videos)} klipp")
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"Import failed for {bin_name}: {exc}")

    # Audio-bin
    if audio_path and os.path.isdir(audio_path):
        bridge.progress(85, 100, "Lager 02_Audio-bin + importerer lyd …")
        audio_bin = ensure_subfolder(media_pool, root_folder, "02_Audio")
        media_pool.SetCurrentFolder(audio_bin)
        audio_files = list_files(audio_path, AUDIO_EXT)
        if audio_files:
            try:
                media_pool.ImportMedia(audio_files)
                imported_count += len(audio_files)
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"Audio import failed: {exc}")

    bridge.progress(100, 100, "Bins ferdig")
    bridge.log(f"Importert {imported_count} klipp totalt i {len(bins) + 1} bins")
    bridge.result({
        "binsCreated": len(bins) + 1,
        "clipsImported": imported_count,
        "projectRoot": project_root,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

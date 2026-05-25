"""Import Media from Folder — recursively imports media, preserving folder names as bins."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


MEDIA_EXTENSIONS = {
    ".mov", ".mp4", ".m4v", ".mxf", ".avi", ".mkv", ".braw", ".r3d", ".arri",
    ".wav", ".aif", ".aiff", ".mp3", ".flac",
    ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".dpx", ".exr",
}


def collect_media(root: str) -> dict[str, list[str]]:
    """Return {bin_name: [file_paths]} based on subfolder structure."""
    buckets: dict[str, list[str]] = {}
    for dirpath, _dirnames, filenames in os.walk(root):
        rel = os.path.relpath(dirpath, root)
        bin_name = "Root" if rel == "." else rel.replace(os.sep, " / ")
        media_files = [
            os.path.join(dirpath, name)
            for name in filenames
            if os.path.splitext(name)[1].lower() in MEDIA_EXTENSIONS
        ]
        if media_files:
            buckets[bin_name] = media_files
    return buckets


def run(params: dict, dry_run: bool) -> None:
    folder = params.get("mediaFolderPath")
    if not folder:
        bridge.error("Missing required input: mediaFolderPath")
        sys.exit(1)
    folder = os.path.expanduser(folder)
    if not os.path.isdir(folder):
        bridge.error(f"Folder does not exist: {folder}")
        sys.exit(1)

    buckets = collect_media(folder)
    total = sum(len(files) for files in buckets.values())
    bridge.log(f"Found {total} media files across {len(buckets)} subfolders")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would import {total} files into {len(buckets)} bins",
            "binsToCreate": list(buckets.keys()),
            "fileCountsByBin": {k: len(v) for k, v in buckets.items()},
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    media_pool = conn.media_pool
    root_folder = media_pool.GetRootFolder()

    imported = 0
    failed: list[str] = []
    for bin_name, files in buckets.items():
        bin_folder = root_folder
        if bin_name != "Root":
            existing = next(
                (f for f in root_folder.GetSubFolderList() if f.GetName() == bin_name),
                None,
            )
            bin_folder = existing or media_pool.AddSubFolder(root_folder, bin_name)
        if not bin_folder:
            failed.extend(files)
            continue
        media_pool.SetCurrentFolder(bin_folder)
        added = media_pool.ImportMedia(files) or []
        imported += len(added)
        if len(added) < len(files):
            failed.extend(files[len(added):])

    bridge.result({
        "imported": imported,
        "failed": len(failed),
        "binsTouched": list(buckets.keys()),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""Backup Card to SSD — copies files from a source path to an SSD with progress + verification.

Uses rsync under the hood for performance + restartability. After copy, runs a quick verify pass
(file count + byte total). Optional --params.fullSha=true does SHA-256 per file (slower).

Creates a DIT-style folder structure on the SSD:
  {ssdPath}/{ProjectName}_{YYYY-MM-DD}/
    01_Footage/
      {CameraLabel}/      ← clips grouped by camera detected in filename
    02_Audio/             ← .wav/.aif/.mp3 files
    03_Music/             ← (created empty)
    04_Graphics/          ← (created empty)
    05_Editing/Resolve_Projects/
    06_Deliverables/
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".mxf", ".avi", ".mkv", ".braw", ".r3d", ".arri"}
AUDIO_EXTS = {".wav", ".aif", ".aiff", ".mp3", ".flac", ".m4a"}


CAMERA_PATTERNS = [
    (re.compile(r"C80", re.IGNORECASE), "Canon_C80"),
    (re.compile(r"C70", re.IGNORECASE), "Canon_C70"),
    (re.compile(r"C300", re.IGNORECASE), "Canon_C300"),
    (re.compile(r"R5C", re.IGNORECASE), "Canon_R5C"),
    (re.compile(r"R5|EOS\s*R5", re.IGNORECASE), "Canon_R5"),
    (re.compile(r"R6|EOS\s*R6", re.IGNORECASE), "Canon_R6"),
    (re.compile(r"FX[369]", re.IGNORECASE), "Sony_FX"),
    (re.compile(r"A7S|A1\b", re.IGNORECASE), "Sony_Alpha"),
    (re.compile(r"VENICE", re.IGNORECASE), "Sony_Venice"),
    (re.compile(r"GH5|GH6|S1H|S5", re.IGNORECASE), "Panasonic"),
    (re.compile(r"MAVIC|INSPIRE|AIR\s*\d|DJI", re.IGNORECASE), "DJI_Drone"),
    (re.compile(r"URSA|POCKET|BRAW", re.IGNORECASE), "Blackmagic"),
    (re.compile(r"ALEXA|AMIRA", re.IGNORECASE), "ARRI"),
    (re.compile(r"\bRED\b|KOMODO", re.IGNORECASE), "RED"),
    (re.compile(r"iPhone|IMG_\d+", re.IGNORECASE), "iPhone"),
    (re.compile(r"GOPRO|HERO\d", re.IGNORECASE), "GoPro"),
]


def camera_label(filename: str) -> str:
    for pattern, label in CAMERA_PATTERNS:
        if pattern.search(filename):
            return label
    return "Unknown"


def make_folder_tree(base: str) -> dict[str, str]:
    """Create the DIT folder structure under base. Returns a map of category → path."""
    tree = {
        "footage": os.path.join(base, "01_Footage"),
        "audio": os.path.join(base, "02_Audio"),
        "music": os.path.join(base, "03_Music"),
        "graphics": os.path.join(base, "04_Graphics"),
        "editing": os.path.join(base, "05_Editing", "Resolve_Projects"),
        "deliverables": os.path.join(base, "06_Deliverables"),
    }
    for path in tree.values():
        os.makedirs(path, exist_ok=True)
    return tree


def quick_verify(src_paths: list[str], dst_paths: list[str]) -> tuple[int, int, list[dict]]:
    """File-count + size-match verification (no SHA). Fast."""
    mismatches: list[dict] = []
    ok_count = 0
    for src, dst in zip(src_paths, dst_paths):
        if not os.path.isfile(dst):
            mismatches.append({"src": src, "dst": dst, "error": "missing on destination"})
            continue
        try:
            src_size = os.path.getsize(src)
            dst_size = os.path.getsize(dst)
            if src_size != dst_size:
                mismatches.append({
                    "src": src, "dst": dst, "error": f"size mismatch ({src_size} vs {dst_size})"
                })
                continue
            ok_count += 1
        except OSError as exc:
            mismatches.append({"src": src, "dst": dst, "error": str(exc)})
    return ok_count, len(src_paths), mismatches


def sha256_file(path: str, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def full_sha_verify(src_paths: list[str], dst_paths: list[str]) -> tuple[int, list[dict]]:
    """Full SHA-256 verification — slow but bulletproof."""
    mismatches: list[dict] = []
    ok = 0
    for idx, (src, dst) in enumerate(zip(src_paths, dst_paths)):
        if (idx + 1) % 5 == 0:
            bridge.log(f"SHA verify {idx + 1}/{len(src_paths)}…")
        try:
            if sha256_file(src) == sha256_file(dst):
                ok += 1
            else:
                mismatches.append({"src": src, "dst": dst, "error": "SHA mismatch"})
        except OSError as exc:
            mismatches.append({"src": src, "dst": dst, "error": str(exc)})
    return ok, mismatches


def run(params: dict, dry_run: bool) -> None:
    source = params.get("sourcePath")
    ssd_path = params.get("ssdPath")
    project_name = params.get("projectName") or "Untitled"
    full_sha = bool(params.get("fullSha", False))

    if not source or not os.path.isdir(source):
        bridge.error("sourcePath required and must be a directory")
        sys.exit(1)
    if not ssd_path or not os.path.isdir(ssd_path):
        bridge.error("ssdPath required and must be a writable directory")
        sys.exit(1)

    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", project_name)
    today = date.today().isoformat()
    project_root = os.path.join(ssd_path, f"{safe_name}_{today}")

    if dry_run:
        # Count what we'd copy without doing it
        sample: list[str] = []
        total_bytes = 0
        for root, _dirs, files in os.walk(source):
            for fname in files:
                ext = os.path.splitext(fname)[1].lower()
                if ext in VIDEO_EXTS or ext in AUDIO_EXTS:
                    full = os.path.join(root, fname)
                    try:
                        total_bytes += os.path.getsize(full)
                    except OSError:
                        pass
                    sample.append(fname)
                    if len(sample) >= 5:
                        continue
        bridge.result({
            "summary": f"Dry run — would copy ~{len(sample)}+ files from {source} into {project_root}",
            "projectRoot": project_root,
            "estimatedBytes": total_bytes,
            "estimatedGB": round(total_bytes / 1_073_741_824, 2),
            "fullSha": full_sha,
            "folderStructure": [
                "01_Footage/{CameraLabel}/",
                "02_Audio/",
                "03_Music/",
                "04_Graphics/",
                "05_Editing/Resolve_Projects/",
                "06_Deliverables/",
            ],
        })
        return

    # Build folder tree
    bridge.log(f"Creating folder tree at {project_root}")
    tree = make_folder_tree(project_root)

    # Walk source, classify and plan copies
    src_paths: list[str] = []
    dst_paths: list[str] = []
    bytes_total = 0

    for root, _dirs, files in os.walk(source):
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            src = os.path.join(root, fname)
            try:
                size = os.path.getsize(src)
            except OSError:
                continue

            if ext in VIDEO_EXTS:
                cam = camera_label(fname)
                target_dir = os.path.join(tree["footage"], cam)
                os.makedirs(target_dir, exist_ok=True)
                dst = os.path.join(target_dir, fname)
                src_paths.append(src)
                dst_paths.append(dst)
                bytes_total += size
            elif ext in AUDIO_EXTS:
                dst = os.path.join(tree["audio"], fname)
                src_paths.append(src)
                dst_paths.append(dst)
                bytes_total += size

    if not src_paths:
        bridge.error("No video or audio files found in source")
        sys.exit(1)

    bridge.log(f"Copying {len(src_paths)} files · {bytes_total / 1_073_741_824:.1f} GB")

    # rsync per pair (preserves attrs, restartable)
    bytes_copied = 0
    failures: list[dict] = []
    total_files = len(src_paths)
    for idx, (src, dst) in enumerate(zip(src_paths, dst_paths)):
        bridge.progress(idx, total_files, f"Copying {os.path.basename(src)}")
        try:
            cmd = ["rsync", "-aP", "--no-W", "--inplace", src, dst]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            if r.returncode != 0:
                failures.append({"src": src, "dst": dst, "stderr": r.stderr.strip()[:200]})
                continue
            try:
                bytes_copied += os.path.getsize(dst)
            except OSError:
                pass
        except subprocess.TimeoutExpired:
            failures.append({"src": src, "dst": dst, "stderr": "timeout"})
        except Exception as exc:
            failures.append({"src": src, "dst": dst, "stderr": str(exc)})

        if (idx + 1) % 5 == 0 or idx == len(src_paths) - 1:
            pct = (idx + 1) / len(src_paths) * 100
            bridge.log(f"Copied {idx + 1}/{len(src_paths)} files ({pct:.0f}%) · {bytes_copied / 1_073_741_824:.1f} GB")

    # Verification pass
    bridge.log("Verifying file counts + sizes…")
    ok_quick, total_quick, quick_mismatches = quick_verify(src_paths, dst_paths)
    sha_ok = None
    sha_mismatches: list[dict] = []
    if full_sha:
        bridge.log("Starting full SHA-256 verification (slow)…")
        sha_ok, sha_mismatches = full_sha_verify(src_paths, dst_paths)

    bridge.result({
        "projectRoot": project_root,
        "filesCopied": len(src_paths) - len(failures),
        "filesFailed": len(failures),
        "bytesCopied": bytes_copied,
        "gbCopied": round(bytes_copied / 1_073_741_824, 2),
        "verifyQuick": {"ok": ok_quick, "total": total_quick, "mismatches": quick_mismatches[:10]},
        "verifyFullSha": None if not full_sha else {"ok": sha_ok, "mismatches": sha_mismatches[:10]},
        "failures": failures[:10],
        "newSourcePath": tree["footage"],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

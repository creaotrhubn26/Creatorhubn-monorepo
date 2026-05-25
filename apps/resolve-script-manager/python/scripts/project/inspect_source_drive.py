"""Inspect Source Drive — determines if a folder lives on an SD/CF card vs internal/external disk.

Detects camera-card structure (DCIM/PRIVATE-M4ROOT/CONTENT/CLIP) and reports drive metadata.
Used by Onboarding Wizard to suggest backup-before-import.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CARD_SIGNATURE_DIRS = ("DCIM", "PRIVATE/M4ROOT", "PRIVATE", "CONTENT", "CLIP", "AVCHD", "BPAV", "XDROOT")


def mount_root_for_path(path: str) -> str | None:
    """Find the mount point a path lives on by walking up to /Volumes/<name>."""
    abs_path = os.path.abspath(path)
    parts = abs_path.split(os.sep)
    if len(parts) >= 3 and parts[1] == "Volumes":
        return os.sep.join(parts[:3])
    return None


def looks_like_camera_card(mount: str) -> tuple[bool, list[str]]:
    if not os.path.isdir(mount):
        return False, []
    signals = []
    for sub in CARD_SIGNATURE_DIRS:
        candidate = os.path.join(mount, sub)
        if os.path.isdir(candidate):
            signals.append(sub)
    return bool(signals), signals


def diskutil_info(mount: str) -> dict:
    """Run diskutil info -plist on the mount point and return parsed dict (subset)."""
    try:
        out = subprocess.run(
            ["diskutil", "info", "-plist", mount],
            capture_output=True, timeout=10,
        )
        if out.returncode != 0:
            return {}
        plist_bytes = out.stdout
        # Lazy plist parse via plistlib
        import plistlib
        data = plistlib.loads(plist_bytes)
        return {
            "volumeName": data.get("VolumeName"),
            "fileSystem": data.get("FilesystemUserVisibleName") or data.get("FilesystemName"),
            "totalBytes": data.get("TotalSize"),
            "freeBytes": data.get("FreeSpace"),
            "removable": bool(data.get("RemovableMedia") or data.get("Ejectable")),
            "writable": bool(data.get("Writable")),
            "protocol": data.get("BusProtocol"),
            "deviceIdentifier": data.get("DeviceIdentifier"),
            "deviceModel": data.get("MediaName") or data.get("DeviceModel"),
        }
    except (subprocess.TimeoutExpired, ImportError, Exception):
        return {}


def run(params: dict, dry_run: bool) -> None:
    path = params.get("path")
    if not path:
        bridge.error("Missing required input: path")
        sys.exit(1)
    path = os.path.expanduser(path)
    if not os.path.exists(path):
        bridge.error(f"Path does not exist: {path}")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would inspect {path} and detect SD card vs SSD vs internal",
            "signatures": list(CARD_SIGNATURE_DIRS),
        })
        return

    abs_path = os.path.abspath(path)
    mount = mount_root_for_path(abs_path)
    is_card, signals = (False, [])
    drive_info: dict = {}

    if mount:
        is_card, signals = looks_like_camera_card(mount)
        drive_info = diskutil_info(mount)
    else:
        # Path is on the boot drive (internal) — get info for /
        drive_info = diskutil_info("/")

    result: dict = {
        "path": abs_path,
        "mountPoint": mount,
        "isCameraCard": is_card,
        "cardSignals": signals,
        "drive": drive_info,
        "kind": "camera_card" if is_card else (
            "removable" if drive_info.get("removable") else "internal_or_ssd"
        ),
        "recommendBackup": is_card,
    }

    bridge.result(result)


if __name__ == "__main__":
    bridge.main_guard(run)

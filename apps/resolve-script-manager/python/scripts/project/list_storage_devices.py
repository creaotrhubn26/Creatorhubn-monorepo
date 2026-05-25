"""List Storage Devices — enumerates mounted volumes via diskutil with size + protocol info.

Used by Onboarding Wizard to populate the "Pick an SSD"-dropdown when a backup is suggested.
Filters out:
  - The boot volume
  - The source card itself (passed via excludeMounts)
  - Time Machine / system snapshots
"""

from __future__ import annotations

import os
import plistlib
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


SKIP_NAMES = {"com.apple.TimeMachine.localsnapshots", "Recovery", "Preboot", "VM", "Update"}


def list_volumes() -> list[dict]:
    try:
        out = subprocess.run(
            ["diskutil", "list", "-plist"],
            capture_output=True, timeout=10,
        )
        if out.returncode != 0:
            return []
        data = plistlib.loads(out.stdout)
    except (subprocess.TimeoutExpired, Exception):
        return []

    volumes: list[dict] = []
    for entry in data.get("VolumesFromDisks", []):
        # entry is a volume name — we need to query each
        if entry in SKIP_NAMES:
            continue
        try:
            info_out = subprocess.run(
                ["diskutil", "info", "-plist", f"/Volumes/{entry}"],
                capture_output=True, timeout=10,
            )
            if info_out.returncode != 0:
                continue
            info = plistlib.loads(info_out.stdout)
        except (subprocess.TimeoutExpired, Exception):
            continue

        mount = info.get("MountPoint")
        if not mount or not os.path.isdir(mount):
            continue

        total = info.get("TotalSize", 0)
        free = info.get("FreeSpace", 0)
        is_boot = bool(info.get("BootVolume"))
        is_internal = info.get("BusProtocol") == "Apple Fabric"

        volumes.append({
            "mountPoint": mount,
            "volumeName": info.get("VolumeName"),
            "fileSystem": info.get("FilesystemUserVisibleName") or info.get("FilesystemName"),
            "totalBytes": int(total),
            "freeBytes": int(free),
            "totalGB": round(total / 1_073_741_824, 1) if total else 0,
            "freeGB": round(free / 1_073_741_824, 1) if free else 0,
            "removable": bool(info.get("RemovableMedia") or info.get("Ejectable")),
            "writable": bool(info.get("Writable")),
            "protocol": info.get("BusProtocol"),
            "deviceIdentifier": info.get("DeviceIdentifier"),
            "deviceModel": info.get("MediaName"),
            "isBoot": is_boot,
            "isInternal": is_internal,
        })

    return volumes


def run(params: dict, dry_run: bool) -> None:
    exclude_mounts = set(params.get("excludeMounts") or [])
    require_writable = bool(params.get("requireWritable", True))
    min_free_gb = float(params.get("minFreeGB", 0))

    if dry_run:
        bridge.result({
            "summary": "Dry run — would enumerate mounted volumes via diskutil",
            "filters": {
                "excludeMounts": list(exclude_mounts),
                "requireWritable": require_writable,
                "minFreeGB": min_free_gb,
            },
        })
        return

    all_volumes = list_volumes()
    filtered: list[dict] = []
    for vol in all_volumes:
        if vol["mountPoint"] in exclude_mounts:
            continue
        if vol.get("isBoot"):
            continue
        if require_writable and not vol.get("writable"):
            continue
        if min_free_gb and vol.get("freeGB", 0) < min_free_gb:
            continue
        filtered.append(vol)

    # Heuristic ordering: external + writable + most free space first
    filtered.sort(key=lambda v: (not v.get("removable", False), -v.get("freeGB", 0)))

    bridge.result({
        "totalDetected": len(all_volumes),
        "filteredCount": len(filtered),
        "volumes": filtered,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

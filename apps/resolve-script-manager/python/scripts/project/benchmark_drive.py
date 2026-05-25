"""Benchmark Drive — measures sustained write + read speed on a target path.

Writes a temp file with random data, syncs to disk, reads it back, measures MB/s for both.
Optional camera comparison: takes a camera label and reports if the drive meets that camera's
recommended sustained-write speed (from ssd_recommendations.json).

Params:
  path:            absolute path to test on (file written + deleted inside)
  testSizeBytes:   default 1 GB (good balance of accuracy vs. wear). Use smaller for quick tests.
  blockSizeBytes:  default 1 MB (matches typical media write patterns)
  iterations:      default 1 — number of passes (results averaged)
  cameraLabel:     optional — e.g. "Canon C80" — adds verdict vs. camera codec requirements

Output:
  writeMBs, readMBs, verdict ("ok"|"marginal"|"too_slow")
"""

from __future__ import annotations

import json
import os
import secrets
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


SSD_RECS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "templates", "ssd_recommendations.json",
)


def detect_drive_model(path: str) -> dict:
    """Use diskutil + system_profiler to find vendor/model + connection type."""
    info: dict = {"vendor": None, "model": None, "protocol": None, "linkSpeedMBs": None}

    # Find the volume's mount point
    try:
        result = subprocess.run(
            ["diskutil", "info", "-plist", path],
            capture_output=True, timeout=10,
        )
        if result.returncode == 0:
            import plistlib
            data = plistlib.loads(result.stdout)
            info["protocol"] = data.get("BusProtocol")
            info["model"] = data.get("MediaName") or data.get("IORegistryEntryName")
            info["volumeName"] = data.get("VolumeName")
    except Exception:
        pass

    # For USB-connected drives, system_profiler SPUSBDataType has speed info
    if info.get("protocol") and "USB" in (info["protocol"] or ""):
        try:
            sp = subprocess.run(
                ["system_profiler", "SPUSBDataType", "-json"],
                capture_output=True, timeout=10,
            )
            if sp.returncode == 0:
                tree = json.loads(sp.stdout)
                # Walk tree looking for entries with our drive
                _walk_usb_tree(tree.get("SPUSBDataType", []), info)
        except Exception:
            pass

    # For Thunderbolt
    if info.get("protocol") and "Thunderbolt" in (info["protocol"] or ""):
        try:
            sp = subprocess.run(
                ["system_profiler", "SPThunderboltDataType", "-json"],
                capture_output=True, timeout=10,
            )
            if sp.returncode == 0:
                tree = json.loads(sp.stdout)
                info["thunderboltInfo"] = "see SPThunderboltDataType"
        except Exception:
            pass

    return info


def _walk_usb_tree(items: list, info: dict) -> None:
    """Recursive walk through SPUSBDataType — pluck vendor + product + speed."""
    for item in items:
        if "_name" in item and not info.get("model"):
            info["model"] = item.get("_name")
        if "manufacturer" in item and not info.get("vendor"):
            info["vendor"] = item.get("manufacturer")
        if "device_speed" in item:
            info["usbSpeed"] = item.get("device_speed")
        if "_items" in item:
            _walk_usb_tree(item["_items"], info)


def benchmark_write(path: str, total_bytes: int, block_size: int) -> tuple[float, str]:
    """Write total_bytes to path with random data; return MB/s + temp filename."""
    temp_file = os.path.join(path, f".benchmark_write_{secrets.token_hex(4)}.tmp")
    try:
        block = secrets.token_bytes(block_size)
        blocks_to_write = total_bytes // block_size
        start = time.perf_counter()
        with open(temp_file, "wb", buffering=0) as fh:
            for _ in range(blocks_to_write):
                fh.write(block)
            os.fsync(fh.fileno())
        elapsed = time.perf_counter() - start
        if elapsed <= 0:
            return 0.0, temp_file
        mb_per_s = (total_bytes / 1_048_576) / elapsed
        return mb_per_s, temp_file
    except Exception as exc:
        bridge.warn(f"Write benchmark failed: {exc}")
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass
        return 0.0, temp_file


def benchmark_read(temp_file: str, block_size: int) -> float:
    """Read the temp file end-to-end; return MB/s."""
    if not os.path.isfile(temp_file):
        return 0.0
    total_bytes = os.path.getsize(temp_file)
    try:
        # Drop OS cache via purge (requires sudo on macOS — skip if unavailable, accept slight bias)
        subprocess.run(["sync"], capture_output=True, timeout=5)
        start = time.perf_counter()
        with open(temp_file, "rb", buffering=0) as fh:
            while True:
                buf = fh.read(block_size)
                if not buf:
                    break
        elapsed = time.perf_counter() - start
        if elapsed <= 0:
            return 0.0
        return (total_bytes / 1_048_576) / elapsed
    except Exception as exc:
        bridge.warn(f"Read benchmark failed: {exc}")
        return 0.0


def lookup_camera_requirement(camera_label: str | None) -> dict | None:
    if not camera_label:
        return None
    try:
        with open(SSD_RECS_PATH, "r", encoding="utf-8") as fh:
            recs = json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    by_camera = recs.get("byCamera", {})
    if camera_label in by_camera:
        return by_camera[camera_label]
    # Try fuzzy: any key containing the label
    for key, val in by_camera.items():
        if camera_label.lower() in key.lower():
            return val
    return None


def verdict(write_mbs: float, required_mbs: int | None) -> str:
    if not required_mbs:
        return "no_requirement"
    if write_mbs >= required_mbs * 1.5:
        return "fast_enough"
    if write_mbs >= required_mbs:
        return "ok"
    if write_mbs >= required_mbs * 0.7:
        return "marginal"
    return "too_slow"


def run(params: dict, dry_run: bool) -> None:
    path = params.get("path")
    test_size = int(params.get("testSizeBytes", 1_073_741_824))  # 1 GB default
    block_size = int(params.get("blockSizeBytes", 1_048_576))    # 1 MB
    iterations = int(params.get("iterations", 1))
    camera_label = params.get("cameraLabel")

    if not path or not os.path.isdir(path):
        bridge.error("path required and must be a writable directory")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would benchmark {path} with {test_size / 1_048_576:.0f} MB writes/reads",
            "method": "Sequential write + fsync + sequential read, 1 MB blocks",
            "params": {
                "testSizeMB": round(test_size / 1_048_576),
                "blockSizeKB": round(block_size / 1024),
                "iterations": iterations,
                "cameraLabel": camera_label,
            },
        })
        return

    # Verify we can write
    free = shutil.disk_usage(path).free
    if free < test_size * 2:
        bridge.error(f"Not enough free space ({free / 1_073_741_824:.1f} GB available, need {test_size * 2 / 1_073_741_824:.1f} GB)")
        sys.exit(1)

    bridge.log(f"Detecting drive at {path}")
    drive_info = detect_drive_model(path)

    write_runs: list[float] = []
    read_runs: list[float] = []
    temp_files: list[str] = []

    for i in range(iterations):
        bridge.log(f"Run {i + 1}/{iterations} — write…")
        write_mbs, temp_file = benchmark_write(path, test_size, block_size)
        temp_files.append(temp_file)
        if write_mbs > 0:
            write_runs.append(write_mbs)
            bridge.log(f"  Write: {write_mbs:.0f} MB/s")
        bridge.log(f"Run {i + 1}/{iterations} — read…")
        read_mbs = benchmark_read(temp_file, block_size)
        if read_mbs > 0:
            read_runs.append(read_mbs)
            bridge.log(f"  Read:  {read_mbs:.0f} MB/s")

    # Cleanup
    for f in temp_files:
        if os.path.isfile(f):
            try:
                os.remove(f)
            except OSError:
                pass

    avg_write = sum(write_runs) / len(write_runs) if write_runs else 0.0
    avg_read = sum(read_runs) / len(read_runs) if read_runs else 0.0

    camera_req = lookup_camera_requirement(camera_label)
    required_speed = camera_req.get("minSpeedMBs") if camera_req else None
    v = verdict(avg_write, required_speed)

    bridge.result({
        "path": path,
        "driveModel": drive_info,
        "writeMBs": round(avg_write, 1),
        "readMBs": round(avg_read, 1),
        "iterations": iterations,
        "testSizeMB": round(test_size / 1_048_576),
        "cameraLabel": camera_label,
        "cameraRequirementMBs": required_speed,
        "cameraCodec": (camera_req or {}).get("codecs"),
        "recommendedSSDs": (camera_req or {}).get("recommended"),
        "verdict": v,
        "verdictDescription": _verdict_text(v, avg_write, required_speed),
    })


def _verdict_text(v: str, write_mbs: float, required: int | None) -> str:
    if v == "fast_enough":
        return f"Fast enough — {write_mbs:.0f} MB/s is ≥1.5× the required {required} MB/s. Plenty of headroom."
    if v == "ok":
        return f"Just enough — {write_mbs:.0f} MB/s meets the {required} MB/s requirement but not by much."
    if v == "marginal":
        return f"Marginal — {write_mbs:.0f} MB/s is under target ({required} MB/s). Long-form codec recording may drop frames."
    if v == "too_slow":
        return f"Too slow — {write_mbs:.0f} MB/s is far below the {required} MB/s the camera needs. Consider upgrading."
    return f"{write_mbs:.0f} MB/s write — no camera target supplied for comparison."


if __name__ == "__main__":
    bridge.main_guard(run)

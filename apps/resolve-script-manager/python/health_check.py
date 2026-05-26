"""Health check — comprehensive system status for the Post Agent.

#110: returns Resolve + Python venv + ffmpeg + disk-space + GPU in one call.
This is what the frontend polls for the status dashboard, so checking
everything together saves multiple subprocess spawns.

Usage:
    python3 health_check.py [--dry-run]
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys

import bridge


VENV_PY_PATH = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
)

CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)


def _check_binary(name: str, version_flag: str = "-version") -> dict:
    path = shutil.which(name) or f"/opt/homebrew/bin/{name}"
    if not os.path.isfile(path):
        return {"installed": False, "path": None, "version": None}
    try:
        r = subprocess.run([path, version_flag], capture_output=True, text=True, timeout=5)
        version_line = (r.stdout + r.stderr).split("\n")[0]
    except Exception:  # noqa: BLE001
        version_line = "unknown"
    return {"installed": True, "path": path, "version": version_line}


def _check_disk_space(path: str) -> dict:
    """Free + total + percent-used for the disk hosting `path`."""
    try:
        total, used, free = shutil.disk_usage(path)
        return {
            "checked": True,
            "path": path,
            "totalGb": round(total / 2**30, 1),
            "freeGb": round(free / 2**30, 1),
            "percentFree": round(free / total * 100, 1) if total > 0 else 0,
            "warning": (free / total < 0.10) if total > 0 else False,
        }
    except OSError as exc:
        return {"checked": False, "path": path, "error": str(exc)}


def _check_venv() -> dict:
    """Verify the bundled venv exists and which pip-packages are importable."""
    if not os.path.isfile(VENV_PY_PATH):
        return {"installed": False, "path": None, "packages": {}}
    result = {"installed": True, "path": VENV_PY_PATH, "packages": {}}
    # Check the packages we actually use across scripts
    for pkg in ("librosa", "whisperx", "anthropic", "cv2", "webrtcvad",
                "ultralytics", "sklearn", "face_recognition"):
        try:
            r = subprocess.run(
                [VENV_PY_PATH, "-c",
                 f"import {pkg}; print(getattr({pkg}, '__version__', 'ok'))"],
                capture_output=True, text=True, timeout=10,
            )
            result["packages"][pkg] = {
                "available": r.returncode == 0,
                "version": r.stdout.strip() if r.returncode == 0 else None,
            }
        except subprocess.TimeoutExpired:
            result["packages"][pkg] = {"available": False, "version": None,
                                       "error": "timeout"}
    return result


def _check_cache_size() -> dict:
    """Sum of the post-agent cache dir — useful for the "clean cache" UX hint."""
    if not os.path.isdir(CACHE_DIR):
        return {"exists": False, "bytes": 0, "humanReadable": "0 B"}
    total = 0
    for root, _dirs, files in os.walk(CACHE_DIR):
        for fn in files:
            try:
                total += os.path.getsize(os.path.join(root, fn))
            except OSError:
                continue
    if total > 2**30:
        hr = f"{total / 2**30:.2f} GB"
    elif total > 2**20:
        hr = f"{total / 2**20:.1f} MB"
    elif total > 2**10:
        hr = f"{total / 2**10:.1f} KB"
    else:
        hr = f"{total} B"
    return {"exists": True, "bytes": total, "humanReadable": hr}


def run(params: dict, dry_run: bool) -> None:
    bridge.log("Health check starting", platform=platform.system(),
               python=sys.version.split()[0])

    status = {
        "pythonInstalled": True,
        "pythonVersion": sys.version.split()[0],
        "pythonExecutable": sys.executable,
        "platform": platform.system(),
        "macOsVersion": platform.mac_ver()[0] if platform.system() == "Darwin" else None,
        "venv": _check_venv(),
        "ffmpeg": _check_binary("ffmpeg"),
        "ffprobe": _check_binary("ffprobe"),
        "fpcalc": _check_binary("fpcalc", version_flag="-version"),
        "ytDlp": _check_binary("yt-dlp", version_flag="--version"),
        "homeDisk": _check_disk_space(os.path.expanduser("~")),
        "tmpDisk": _check_disk_space("/tmp"),
        "cacheSize": _check_cache_size(),
        "scriptingModuleFound": False,
        "scriptingModulePath": None,
        "fusionscriptLibPath": None,
        "resolveRunning": False,
        "projectOpen": False,
        "projectName": None,
        "timelineName": None,
        "timelineFps": None,
        "envResolveScriptApi": os.environ.get("RESOLVE_SCRIPT_API"),
        "envResolveScriptLib": os.environ.get("RESOLVE_SCRIPT_LIB"),
        "envAnthropicApiKey": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "envHfToken": bool(os.environ.get("HF_TOKEN")),
    }

    module_path = bridge._ensure_scripting_path()
    status["scriptingModuleFound"] = module_path is not None
    status["scriptingModulePath"] = module_path

    if not module_path:
        bridge.warn("DaVinciResolveScript module not found. Install Resolve Studio or set RESOLVE_SCRIPT_API.")
        bridge.result(status)
        return

    lib_path = bridge._ensure_fusionscript_lib()
    status["fusionscriptLibPath"] = lib_path
    if not lib_path:
        bridge.warn("fusionscript.so not found in standard locations. Set RESOLVE_SCRIPT_LIB to its path.")
        bridge.result(status)
        return

    conn = bridge.ResolveConnection()
    if conn.connect():
        status["resolveRunning"] = True
        if conn.project:
            status["projectOpen"] = True
            try:
                status["projectName"] = conn.project.GetName()
            except Exception:  # noqa: BLE001
                status["projectName"] = "(unknown)"
            try:
                tl = conn.project.GetCurrentTimeline()
                if tl:
                    status["timelineName"] = tl.GetName() or None
                    try:
                        status["timelineFps"] = tl.GetSetting("timelineFrameRate")
                    except Exception:  # noqa: BLE001
                        pass
            except Exception:  # noqa: BLE001
                pass
        bridge.log("Connected to Resolve", project=status["projectName"])
    else:
        bridge.warn("Resolve not reachable. Open DaVinci Resolve Studio to enable live scripts.")

    bridge.result(status)


if __name__ == "__main__":
    bridge.main_guard(run)

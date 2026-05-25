"""Check Dependencies — detects which tools the app needs are installed + their versions.

Returns per-tool status that drives the Dependencies modal:
  - Homebrew (the installer for everything else on macOS)
  - ffmpeg + ffprobe (Audio LUFS / clipping / Cull thumbnails / backup verify)
  - chromaprint (fpcalc) — for similar-clips audio fingerprint + retake detection
  - Python 3
  - pip packages: anthropic, whisperx
  - DaVinci Resolve scripting module + fusionscript.so + External Scripting flag
  - HuggingFace token presence (for diarization)

No installation here — purely detection. install_dependency.py handles the install side.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def check_brew() -> dict:
    path = shutil.which("brew") or "/opt/homebrew/bin/brew"
    if not os.path.isfile(path):
        return {"installed": False, "path": None, "version": None}
    try:
        r = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=5)
        version = r.stdout.split("\n")[0] if r.returncode == 0 else None
    except Exception:
        version = None
    return {"installed": True, "path": path, "version": version, "installCommand": None}


def check_brew_tool(name: str, install_target: str | None = None) -> dict:
    """Detect a Homebrew-managed CLI tool."""
    paths_to_try = [
        os.environ.get(f"RESOLVE_SCRIPT_MANAGER_{name.upper()}"),
        shutil.which(name),
        f"/opt/homebrew/bin/{name}",
        f"/usr/local/bin/{name}",
        f"/opt/local/bin/{name}",
    ]
    for path in paths_to_try:
        if path and os.path.isfile(path):
            try:
                r = subprocess.run([path, "-version"], capture_output=True, text=True, timeout=5)
                version_line = (r.stdout + r.stderr).split("\n")[0]
            except Exception:
                version_line = None
            return {
                "installed": True,
                "path": path,
                "version": version_line,
                "installCommand": None,
            }
    return {
        "installed": False,
        "path": None,
        "version": None,
        "installCommand": f"brew install {install_target or name}",
    }


def check_python_module(module: str) -> dict:
    # Check dedicated venv first (where install_dependency.py puts ML packages),
    # then system python, then python@3.12 (brew) as a fallback.
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    candidates = []
    if os.path.isfile(venv_py):
        candidates.append(venv_py)
    candidates.append(shutil.which("python3") or "/usr/bin/python3")
    for path in (
        "/opt/homebrew/opt/python@3.12/bin/python3.12",
        "/usr/local/opt/python@3.12/bin/python3.12",
        "/opt/homebrew/bin/python3.12",
        "/usr/local/bin/python3.12",
    ):
        if os.path.isfile(path) and path not in candidates:
            candidates.append(path)
    for python in candidates:
        try:
            r = subprocess.run(
                [python, "-c", f"import {module}; print(getattr({module}, '__version__', 'unknown'))"],
                capture_output=True, text=True, timeout=10,
            )
            if r.returncode == 0:
                version = r.stdout.strip()
                return {"installed": True, "path": python, "version": version, "installCommand": None}
        except Exception:
            continue
    return {
        "installed": False,
        "path": None,
        "version": None,
        "installCommand": f"pip3 install {module}",
    }


def check_resolve() -> dict:
    """Detect DaVinci Resolve installation + Studio license."""
    paths = [
        "/Applications/DaVinci Resolve.app",
        "/Applications/DaVinci Resolve/DaVinci Resolve.app",
        "/Applications/DaVinci Resolve Studio.app",
    ]
    bundle_id = None
    version = None
    arch = None
    for p in paths:
        if os.path.isdir(p):
            info_plist = os.path.join(p, "Contents/Info.plist")
            try:
                r = subprocess.run(
                    ["plutil", "-extract", "CFBundleIdentifier", "raw", info_plist],
                    capture_output=True, text=True, timeout=5,
                )
                bundle_id = r.stdout.strip()
                r2 = subprocess.run(
                    ["plutil", "-extract", "CFBundleShortVersionString", "raw", info_plist],
                    capture_output=True, text=True, timeout=5,
                )
                version = r2.stdout.strip()
                # Check arch
                exe = os.path.join(p, "Contents/MacOS/Resolve")
                if os.path.isfile(exe):
                    f = subprocess.run(["file", exe], capture_output=True, text=True, timeout=5)
                    if "arm64" in f.stdout and "x86_64" in f.stdout:
                        arch = "Universal"
                    elif "arm64" in f.stdout:
                        arch = "Apple Silicon"
                    elif "x86_64" in f.stdout:
                        arch = "Intel"
                return {
                    "installed": True,
                    "path": p,
                    "bundleId": bundle_id,
                    "version": version,
                    "architecture": arch,
                    "isStudio": bundle_id == "com.blackmagic-design.DaVinciResolve",
                    "isLite": bundle_id == "com.blackmagic-design.DaVinciResolveLite",
                    "installCommand": None,
                    "note": "Manual download from blackmagicdesign.com — Studio requires license key",
                }
            except Exception:
                continue
    return {
        "installed": False,
        "path": None,
        "installCommand": None,
        "note": "Download manually from blackmagicdesign.com (Studio required for external scripting)",
    }


def run(params: dict, dry_run: bool) -> None:
    if dry_run:
        bridge.result({
            "summary": "Dry run — would check Homebrew + ffmpeg + chromaprint + Python modules + Resolve",
            "tools": [
                "brew", "ffmpeg", "ffprobe", "fpcalc (chromaprint)", "python3",
                "anthropic (pip)", "whisperx (pip)", "DaVinci Resolve Studio",
            ],
        })
        return

    bridge.log("Checking dependencies…")
    bridge.progress(0, 8, "Homebrew")
    brew = check_brew()

    bridge.progress(1, 8, "ffmpeg")
    ffmpeg = check_brew_tool("ffmpeg")

    bridge.progress(2, 8, "ffprobe")
    ffprobe = check_brew_tool("ffprobe", install_target="ffmpeg")

    bridge.progress(3, 8, "chromaprint (fpcalc)")
    fpcalc = check_brew_tool("fpcalc", install_target="chromaprint")

    bridge.progress(4, 8, "Python")
    python = {
        "installed": shutil.which("python3") is not None,
        "path": shutil.which("python3"),
        "version": sys.version.split()[0],
        "installCommand": None,
    }

    bridge.progress(5, 8, "anthropic (pip)")
    anthropic = check_python_module("anthropic")

    bridge.progress(6, 9, "whisperx (pip)")
    whisperx_pkg = check_python_module("whisperx")

    bridge.progress(7, 9, "librosa (pip)")
    librosa_pkg = check_python_module("librosa")

    bridge.progress(8, 9, "DaVinci Resolve")
    resolve = check_resolve()

    bridge.progress(9, 9, "Done.")

    has_anthropic_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    has_hf_token = bool(os.environ.get("HF_TOKEN"))

    bridge.result({
        "tools": {
            "brew": brew,
            "ffmpeg": ffmpeg,
            "ffprobe": ffprobe,
            "fpcalc": fpcalc,
            "python3": python,
            "anthropic": anthropic,
            "whisperx": whisperx_pkg,
            "librosa": librosa_pkg,
            "resolve": resolve,
        },
        "credentials": {
            "ANTHROPIC_API_KEY": {"set": has_anthropic_key, "via": "Settings → Admin"},
            "HF_TOKEN": {"set": has_hf_token, "via": "Settings → Admin"},
        },
        "summary": {
            "brewReady": brew["installed"],
            "audioStackReady": ffmpeg["installed"] and ffprobe["installed"],
            "fingerprintReady": fpcalc["installed"],
            "pythonModulesReady": anthropic["installed"] and whisperx_pkg["installed"],
            "resolveReady": resolve.get("installed") and resolve.get("isStudio"),
        },
    })


if __name__ == "__main__":
    bridge.main_guard(run)

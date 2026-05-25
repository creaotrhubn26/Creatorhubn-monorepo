"""
DaVinci Resolve scripting bridge.

Centralises connection + JSON-event emission so individual scripts stay short.
All scripts in scripts/ are CLI entry points that import this module.

Resolve must be open with a project loaded for most scripts. In dry-run mode
we synthesise plausible objects so the UI can show what *would* happen.
"""

from __future__ import annotations

import json
import os
import platform
import sys
import time
from typing import Any


SCRIPTING_PATHS_MAC = (
    "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules",
    os.path.expanduser("~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"),
)


# `fusionscript.so` is the compiled C-extension DaVinciResolveScript.py dlopens.
# Default path inside DaVinciResolveScript.py assumes Resolve is installed in
# `/Applications/DaVinci Resolve/DaVinci Resolve.app/`, but many machines have
# it directly at `/Applications/DaVinci Resolve.app/`. We probe both, plus the
# Studio path, and set RESOLVE_SCRIPT_LIB so the import succeeds.
FUSIONSCRIPT_PATHS_MAC = (
    "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
    "/Applications/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
    "/Applications/DaVinci Resolve Studio.app/Contents/Libraries/Fusion/fusionscript.so",
    "/Applications/Blackmagic Design/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
)


def _ensure_fusionscript_lib() -> str | None:
    """Locate fusionscript.so and set RESOLVE_SCRIPT_LIB before DaVinciResolveScript imports it."""
    existing = os.environ.get("RESOLVE_SCRIPT_LIB")
    if existing and os.path.isfile(existing):
        return existing
    if platform.system() == "Darwin":
        for path in FUSIONSCRIPT_PATHS_MAC:
            if os.path.isfile(path):
                os.environ["RESOLVE_SCRIPT_LIB"] = path
                return path
    return None


VENV_PYTHON = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
)


def reexec_in_venv_if_present() -> None:
    """Re-exec the current script under the app's dedicated Python 3.12 venv.

    Tauri spawns scripts with the system `python3`, but ML packages (whisperx, anthropic,
    torch) live in a venv at ~/Library/Application Support/<bundle>/venv-py312 because
    PEP 668 blocks pip installs on brew-managed Python 3.12. Scripts that need those
    modules call this at startup — idempotent if already running under the venv.
    """
    if not os.path.isfile(VENV_PYTHON):
        return
    try:
        if os.path.realpath(sys.executable) == os.path.realpath(VENV_PYTHON):
            return
    except OSError:
        return
    os.execv(VENV_PYTHON, [VENV_PYTHON] + sys.argv)


def emit(kind: str, **payload: Any) -> None:
    """Write a newline-delimited JSON event to stdout — consumed by Node side."""
    record = {"type": kind, "ts": time.time(), **payload}
    sys.stdout.write(json.dumps(record, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def log(message: str, **extra: Any) -> None:
    emit("log", message=message, **extra)


def warn(message: str, **extra: Any) -> None:
    emit("warn", message=message, **extra)


def error(message: str, **extra: Any) -> None:
    emit("error", message=message, **extra)


def result(payload: Any) -> None:
    emit("result", value=payload)


def progress(current, total, label: str = "") -> None:
    """Emit a progress event the Tauri frontend uses to drive a progress bar.

    Long-running scripts should call this periodically so the UI can show ETA + cancel.
    """
    pct = 0
    try:
        if total > 0:
            pct = max(0, min(100, int(round((float(current) / float(total)) * 100))))
    except (TypeError, ZeroDivisionError):
        pct = 0
    emit("progress", current=current, total=total, percent=pct, label=label)


def _ensure_scripting_path() -> str | None:
    """Return resolved module dir, adding it to sys.path. None if not found."""
    candidates = []
    env_path = os.environ.get("RESOLVE_SCRIPT_API")
    if env_path:
        candidates.append(os.path.join(env_path, "Modules"))
    if platform.system() == "Darwin":
        candidates.extend(SCRIPTING_PATHS_MAC)

    for path in candidates:
        if path and os.path.isdir(path):
            if path not in sys.path:
                sys.path.insert(0, path)
            return path
    return None


def load_params() -> dict[str, Any]:
    """Read --params=<json> or --params-file=<path> from argv."""
    params: dict[str, Any] = {}
    for arg in sys.argv[1:]:
        if arg.startswith("--params="):
            try:
                params.update(json.loads(arg.removeprefix("--params=")))
            except json.JSONDecodeError as exc:
                error(f"Invalid --params JSON: {exc}")
        elif arg.startswith("--params-file="):
            path = arg.removeprefix("--params-file=")
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    params.update(json.load(handle))
            except (OSError, json.JSONDecodeError) as exc:
                error(f"Failed to read params file {path}: {exc}")
    return params


def is_dry_run() -> bool:
    return "--dry-run" in sys.argv


class ResolveConnection:
    """Lazy connection to a running DaVinci Resolve.

    Use as context manager. In dry-run mode .resolve is None and .project is None;
    scripts should branch on `dry_run`.
    """

    def __init__(self) -> None:
        self.resolve: Any = None
        self.project_manager: Any = None
        self.project: Any = None
        self.media_pool: Any = None
        self.module_path: str | None = None

    def connect(self) -> bool:
        self.module_path = _ensure_scripting_path()
        if not self.module_path:
            error("DaVinciResolveScript module not found on disk", remediation=(
                "Install DaVinci Resolve Studio, or set RESOLVE_SCRIPT_API "
                "to the Developer/Scripting directory."
            ))
            return False

        lib_path = _ensure_fusionscript_lib()
        if not lib_path:
            error(
                "fusionscript.so not found in any standard Resolve install location",
                remediation=(
                    "Set RESOLVE_SCRIPT_LIB to the absolute path of fusionscript.so "
                    "(typically inside DaVinci Resolve.app/Contents/Libraries/Fusion/)."
                ),
            )
            return False

        try:
            import DaVinciResolveScript as dvr  # type: ignore[import-not-found]
        except ImportError as exc:
            error(f"Failed to import DaVinciResolveScript: {exc}", resolveScriptLib=lib_path)
            return False

        try:
            self.resolve = dvr.scriptapp("Resolve")
        except Exception as exc:  # pragma: no cover — depends on Resolve runtime
            error(f"scriptapp(\"Resolve\") raised: {exc}")
            return False

        if self.resolve is None:
            error(
                "scriptapp(\"Resolve\") returned None — Resolve is running but external scripting is likely disabled.",
                remediation=(
                    "In Resolve: Preferences → System → General → 'External scripting using' "
                    "→ set to 'Local' (eller 'Network'). Save og restart Resolve. "
                    "Bekreft også at Resolve er forbi splash/welcome-skjermen med et prosjekt åpnet."
                ),
                fusionscriptLib=os.environ.get("RESOLVE_SCRIPT_LIB"),
                scriptingModule=self.module_path,
            )
            return False

        self.project_manager = self.resolve.GetProjectManager()
        self.project = self.project_manager.GetCurrentProject() if self.project_manager else None
        if self.project:
            self.media_pool = self.project.GetMediaPool()
        return True

    def require_project(self) -> bool:
        if not self.project:
            error("No project is open. Create or open a project in Resolve and retry.")
            return False
        return True


def main_guard(run):
    """Standard entry-point wrapper used by every CLI script."""
    try:
        params = load_params()
        dry_run = is_dry_run()
        run(params=params, dry_run=dry_run)
    except SystemExit:
        raise
    except Exception as exc:  # pragma: no cover — last-resort safety net
        error(f"Unhandled exception: {exc}")
        sys.exit(2)

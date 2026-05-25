"""Health check — verifies Python, Resolve scripting module, and a running Resolve instance.

Usage:
    python3 health_check.py [--dry-run]

Emits a single result event with the structured status, matching what
/api/davinci-resolve/system-status returns to the frontend.
"""

from __future__ import annotations

import os
import platform
import sys

import bridge


def run(params: dict, dry_run: bool) -> None:
    bridge.log("Health check starting", platform=platform.system(), python=sys.version.split()[0])

    status = {
        "pythonInstalled": True,
        "pythonVersion": sys.version.split()[0],
        "scriptingModuleFound": False,
        "scriptingModulePath": None,
        "fusionscriptLibPath": None,
        "resolveRunning": False,
        "projectOpen": False,
        "projectName": None,
        "envResolveScriptApi": os.environ.get("RESOLVE_SCRIPT_API"),
        "envResolveScriptLib": os.environ.get("RESOLVE_SCRIPT_LIB"),
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
            except Exception:
                status["projectName"] = "(unknown)"
        bridge.log("Connected to Resolve", project=status["projectName"])
    else:
        bridge.warn("Resolve not reachable. Open DaVinci Resolve Studio to enable live scripts.")

    bridge.result(status)


if __name__ == "__main__":
    bridge.main_guard(run)

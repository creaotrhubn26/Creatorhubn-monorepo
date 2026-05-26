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

    # Backoff schedule for scriptapp("Resolve") returning None
    # (Resolve running but not ready to serve, e.g. mid-splash).
    # Total wall-time worst-case: ~31s — long enough to ride out splash,
    # short enough that user doesn't think we hung.
    _CONNECT_BACKOFF_SEC = (1.0, 2.0, 4.0, 8.0, 16.0)

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

        # #109 — exponential backoff on scriptapp returning None.
        # Resolve typically takes 5-15s to become script-ready after launch.
        # Without backoff we'd fail immediately if user launches script before
        # Resolve has finished its splash + project-loading.
        attempts = 1 + len(self._CONNECT_BACKOFF_SEC)
        for attempt in range(attempts):
            try:
                self.resolve = dvr.scriptapp("Resolve")
            except Exception as exc:  # pragma: no cover — depends on Resolve runtime
                error(f"scriptapp(\"Resolve\") raised: {exc}")
                return False
            if self.resolve is not None:
                if attempt > 0:
                    log(f"Resolve scripting became available after {attempt} retry/retries")
                break
            if attempt >= len(self._CONNECT_BACKOFF_SEC):
                error(
                    "scriptapp(\"Resolve\") returned None after retries — "
                    "Resolve is running but external scripting is disabled.",
                    remediation=(
                        "In Resolve: Preferences → System → General → 'External scripting using' "
                        "→ set to 'Local' (eller 'Network'). Save og restart Resolve. "
                        "Bekreft også at Resolve er forbi splash/welcome-skjermen med et prosjekt åpnet."
                    ),
                    fusionscriptLib=os.environ.get("RESOLVE_SCRIPT_LIB"),
                    scriptingModule=self.module_path,
                    retries=attempt,
                )
                return False
            delay = self._CONNECT_BACKOFF_SEC[attempt]
            log(
                f"Resolve scripting not ready yet (attempt {attempt + 1}/{attempts}) — "
                f"retrying in {delay:.0f}s"
            )
            time.sleep(delay)

        self.project_manager = self.resolve.GetProjectManager()
        self.project = self.project_manager.GetCurrentProject() if self.project_manager else None
        if self.project:
            self.media_pool = self.project.GetMediaPool()

        # #142 — explicit context log so subsequent failures are diagnosable.
        # Logs project + current timeline + fps + start-frame in one place
        # at session start. Anyone re-reading logs to debug a sync-bug can
        # jump to "RESOLVE CONTEXT" and see exactly what was active.
        try:
            project_name = self.project.GetName() if self.project else "(no project)"
        except Exception:  # noqa: BLE001
            project_name = "(error reading name)"
        timeline_name = "(no timeline)"
        timeline_fps = "?"
        timeline_start = "?"
        timeline_start_tc = ""
        if self.project:
            try:
                tl = self.project.GetCurrentTimeline()
                if tl:
                    timeline_name = tl.GetName() or "(unnamed)"
                    try:
                        timeline_fps = tl.GetSetting("timelineFrameRate") or "?"
                    except Exception:  # noqa: BLE001
                        pass
                    try:
                        timeline_start = tl.GetStartFrame() or 0
                    except Exception:  # noqa: BLE001
                        pass
                    try:
                        timeline_start_tc = tl.GetStartTimecode() or ""
                    except Exception:  # noqa: BLE001
                        pass
            except Exception:  # noqa: BLE001
                pass
        log(
            "RESOLVE CONTEXT ── "
            f"project={project_name!r} "
            f"timeline={timeline_name!r} "
            f"fps={timeline_fps} "
            f"start_frame={timeline_start} "
            f"start_tc={timeline_start_tc!r}"
        )
        return True

    def ensure_alive(self) -> bool:
        """#141 — verify Resolve is still reachable mid-run.

        Long scripts (multi-minute imports, render-queue setups) can run
        while user accidentally quits Resolve. Calling this between
        operations lets us emit a clear error before we throw a confusing
        AttributeError on a dead handle.

        Returns True if alive, False if Resolve died (caller should bail).
        """
        if self.resolve is None:
            error("Resolve handle is None — connection was never established")
            return False
        try:
            # GetProjectManager is cheap and always works on a live handle.
            pm = self.resolve.GetProjectManager()
            if pm is None:
                error(
                    "Resolve project manager became None — Resolve may have "
                    "been quit or restarted mid-run. Re-open Resolve, ensure "
                    "your project is loaded, and re-run this script."
                )
                return False
            return True
        except Exception as exc:  # noqa: BLE001
            error(
                f"Resolve scripting handle died mid-run: {exc} — "
                "Resolve may have crashed or been quit. Re-open + retry."
            )
            return False

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


# ─── Idempotency checkpoints (#167) ───────────────────────────────────────
#
# Workflow steps that run as part of a multi-step pipeline often need to be
# re-runnable without re-doing work. The bridge stores a SHA256 of normalised
# input params on disk under
#   ~/Library/Application Support/.../checkpoints/<script_id>.json
# Scripts opt in by calling `idempotent_should_skip()` at the top of their
# run() function and bailing if it returns True.

_CHECKPOINT_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/checkpoints"
)


def _hash_params(params: dict[str, Any]) -> str:
    """Stable SHA256 of input params for idempotency-comparison. Sorts keys
    and serialises non-JSON values as repr() so dict-ordering doesn't
    change the hash."""
    import hashlib
    normalised = json.dumps(params or {}, sort_keys=True, default=repr)
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()[:16]


def idempotent_should_skip(
    script_id: str,
    params: dict[str, Any],
    verify_artifact: Any = None,
    max_age_seconds: int = 86400,
) -> bool:
    """Returns True if the same params + artifact were processed within
    `max_age_seconds` AND the verify_artifact (if callable) is still True.

    Callers:
        if bridge.idempotent_should_skip(
            "create_render_queue",
            params,
            verify_artifact=lambda: os.path.isdir(output_dir),
        ):
            bridge.log("Idempotency hit — already done, skipping")
            return

    Pass `verify_artifact` as a callable that checks whether the script's
    output still exists (file on disk, timeline in Resolve, etc.). If not
    set, we only compare params.
    """
    try:
        ckpt_path = os.path.join(_CHECKPOINT_DIR, f"{script_id}.json")
        if not os.path.isfile(ckpt_path):
            return False
        with open(ckpt_path, "r", encoding="utf-8") as f:
            stored = json.load(f)
    except (OSError, json.JSONDecodeError):
        return False
    if stored.get("paramsHash") != _hash_params(params):
        return False
    age = time.time() - float(stored.get("completedAt") or 0)
    if age > max_age_seconds:
        return False
    if callable(verify_artifact):
        try:
            if not verify_artifact():
                return False
        except Exception:  # noqa: BLE001
            return False
    return True


def idempotent_mark_done(
    script_id: str,
    params: dict[str, Any],
    artifact_hint: str = "",
) -> None:
    """Write a checkpoint after a successful run. Pair with
    idempotent_should_skip() at the top of run()."""
    try:
        os.makedirs(_CHECKPOINT_DIR, exist_ok=True)
        ckpt_path = os.path.join(_CHECKPOINT_DIR, f"{script_id}.json")
        with open(ckpt_path, "w", encoding="utf-8") as f:
            json.dump({
                "scriptId": script_id,
                "paramsHash": _hash_params(params),
                "completedAt": time.time(),
                "artifactHint": artifact_hint,
            }, f, indent=2)
    except OSError:
        pass  # Checkpoint failures are silent — they only hurt re-run perf


# ─── Content-addressable cache (#64) ──────────────────────────────────────
#
# Many scripts compute derived data from media files (librosa beats, ffprobe
# metadata, OpenCV face-detection, chroma fingerprints…). Same file +
# unchanged mtime ⇒ same derived data. The cache lives under
#   ~/Library/Application Support/.../derived_cache/<namespace>/<hash>.<ext>
# and is keyed on (file path, mtime ns, size) — same scheme as media_probe.rs.

_DERIVED_CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/derived_cache"
)


def cache_path_for(
    namespace: str,
    source_path: str,
    extra_key: str = "",
    extension: str = "json",
) -> str | None:
    """Return a deterministic cache-file path for a derived computation.

    Args:
        namespace: short ID for the kind of derived data
                  (e.g. "librosa-beats", "ffprobe", "phash").
        source_path: absolute path to the input media file.
        extra_key: optional param-string that affects the computation
                  (e.g. sample-rate, model-name). Mixed into the cache key
                  so changing the param invalidates without manual cleanup.
        extension: file extension for the cache artifact ("json", "npy",
                  "wav", "pkl"…).

    Returns:
        Absolute path to a (possibly not-yet-existing) cache file, or None
        if source_path doesn't exist on disk.

    Usage:
        cp = bridge.cache_path_for("librosa-beats", song_path,
                                   extra_key=f"sr={sr}")
        if cp and os.path.isfile(cp):
            # cache hit — load it
            with open(cp) as f: return json.load(f)
        # cache miss — compute, then write
        result = expensive_compute()
        with open(cp, "w") as f: json.dump(result, f)
    """
    import hashlib
    if not source_path or not os.path.isfile(source_path):
        return None
    try:
        stat = os.stat(source_path)
    except OSError:
        return None
    key_blob = f"{source_path}|{stat.st_mtime_ns}|{stat.st_size}|{extra_key}"
    digest = hashlib.sha256(key_blob.encode("utf-8")).hexdigest()[:16]
    ns_dir = os.path.join(_DERIVED_CACHE_DIR, namespace)
    try:
        os.makedirs(ns_dir, exist_ok=True)
    except OSError:
        return None
    return os.path.join(ns_dir, f"{digest}.{extension}")


# ─── Disk-space safety (#87) ──────────────────────────────────────────────

def check_disk_space(
    path: str,
    required_gb: float = 1.0,
    warn_only: bool = False,
) -> bool:
    """Verify that the volume hosting `path` has at least `required_gb` free.

    Returns True if sufficient space (or check failed gracefully).
    Returns False + emits an error if space is too low and warn_only=False.
    Emits a warning instead (and still returns True) when warn_only=True.

    Default 1 GB is reasonable for most scripts; renderers should pass
    higher values matching the expected output size.
    """
    import shutil
    try:
        _total, _used, free = shutil.disk_usage(path)
    except OSError as exc:
        warn(f"Could not check disk space at {path}: {exc}")
        return True  # don't block on probe failure
    free_gb = free / (2 ** 30)
    if free_gb >= required_gb:
        return True
    msg = (
        f"Disk-space warning: only {free_gb:.1f} GB free at {path} "
        f"(script expected at least {required_gb:.1f} GB)"
    )
    if warn_only:
        warn(msg)
        return True
    error(msg, freeGb=round(free_gb, 1), requiredGb=required_gb, path=path)
    return False

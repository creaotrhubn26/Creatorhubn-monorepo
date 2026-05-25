"""Auto Rough Cut — "Magic Cut" orchestrator.

Reads the active template's `magicCutPipeline` and runs each step as a child
subprocess, aggregating per-step progress into a single weighted progress stream
so the UI shows one continuous bar instead of N separate jobs.

Params:
  templateId:        which template's pipeline to use (e.g. "corporate_video")
  sourceFolder:      absolute path to footage folder
  targetDurationSec: target rough-cut length (passed through to scripts that care)
  model:             Claude model preference ("claude-haiku-4-5" | "claude-sonnet-4-6" | "local")
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


PYTHON_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _load_template(template_id: str) -> dict:
    path = os.path.join(PYTHON_ROOT, "templates", "_index.json")
    idx = json.load(open(path))
    for t in idx["templates"]:
        if t["id"] == template_id:
            tpath = os.path.join(PYTHON_ROOT, "templates", t["file"])
            return json.load(open(tpath))
    raise ValueError(f"Template '{template_id}' not found in _index.json")


def _resolve_script(script_id: str) -> str:
    registry = json.load(open(os.path.join(PYTHON_ROOT, "registry.json")))
    for s in registry["scripts"]:
        if s["id"] == script_id:
            return os.path.join(PYTHON_ROOT, s["scriptPath"])
    raise ValueError(f"Script '{script_id}' not in registry")


def _run_step(step: dict, params: dict, base_offset: int, step_weight: int) -> tuple[int, dict | None]:
    """Run one pipeline step. Stream child events to our stdout (so the UI sees them),
    but rewrite child `progress` events to be weighted against the overall pipeline.
    Returns (exit_code, last_result_payload)."""
    script_id = step["scriptId"]
    label = step.get("label", script_id)
    bridge.log(f"▸ Phase: {label}")

    try:
        script_path = _resolve_script(script_id)
    except ValueError as exc:
        bridge.error(str(exc))
        return 127, None

    cmd = [sys.executable, script_path, f"--params={json.dumps(params)}"]
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1, env=os.environ.copy()
    )
    assert proc.stdout is not None and proc.stderr is not None

    last_result: dict | None = None
    for line in iter(proc.stdout.readline, ""):
        line = line.rstrip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            bridge.log(line[:200])
            continue
        et = event.get("type")
        if et == "progress":
            inner_pct = event.get("percent", 0) or 0
            overall_pct = base_offset + int((inner_pct / 100.0) * step_weight)
            bridge.progress(overall_pct, 100, f"{label} · {event.get('label','') or ''}".rstrip(" ·"))
        elif et == "result":
            last_result = event.get("value")
            # Forward result inline as a log so the UI can show partial info
            bridge.log(f"  ✓ {label} done")
        elif et in ("log", "warn", "error"):
            # Prefix with phase label so user knows where we are
            msg = event.get("message", "")
            if et == "warn":
                bridge.warn(f"[{label}] {msg}")
            elif et == "error":
                bridge.error(f"[{label}] {msg}")
            else:
                bridge.log(f"[{label}] {msg[:240]}")
        else:
            # Pass through any other event types verbatim — lets cull_folder's
            # per-clip "clip_decision" events bubble up to CullTheater UI.
            forwarded = {k: v for k, v in event.items() if k not in ("type", "ts")}
            bridge.emit(et or "log", **forwarded)
        # ignore "started", "finished" — handled by our own envelope

    # Drain stderr (mostly Python tracebacks)
    stderr = proc.stderr.read()
    if stderr.strip():
        for ln in stderr.strip().splitlines()[:20]:
            bridge.log(f"[{label}/stderr] {ln[:240]}")

    return proc.wait(), last_result


def run(params: dict[str, Any], dry_run: bool) -> None:
    template_id = params.get("templateId") or ""
    source_folder = params.get("sourceFolder") or ""
    target_duration = int(params.get("targetDurationSec") or 90)
    model = params.get("model") or "claude-haiku-4-5"

    if not template_id:
        bridge.error("templateId is required")
        sys.exit(1)
    if not source_folder or not os.path.isdir(source_folder):
        bridge.error(f"sourceFolder must be an existing directory (got: {source_folder!r})")
        sys.exit(1)

    template = _load_template(template_id)
    pipeline = template.get("magicCutPipeline")
    if not pipeline:
        bridge.error(f"Template '{template_id}' has no magicCutPipeline defined")
        sys.exit(1)

    steps = pipeline.get("steps") or []
    total_weight = sum(int(s.get("weight", 1)) for s in steps) or 1

    bridge.log(f"Magic Cut: {pipeline.get('name','rough cut')}")
    bridge.log(f"Template: {template.get('name', template_id)} · {len(steps)} steps · target {target_duration}s")
    bridge.log(f"Source: {source_folder}")

    if dry_run:
        bridge.result({
            "templateId": template_id,
            "pipeline": pipeline.get("name"),
            "steps": [s["scriptId"] for s in steps],
            "wouldRun": True,
        })
        return

    base_offset = 0
    step_results: dict[str, Any] = {}
    # Common params with aliases — different scripts call the source folder
    # different names, so we send all of them. Each script picks what it needs.
    common_params: dict[str, Any] = {
        "templateId": template_id,
        "sourceFolder": source_folder,
        "sourcePath": source_folder,         # cull_folder
        "mediaFolderPath": source_folder,    # import_media_from_folder
        "folder": source_folder,             # generic fallback
        "targetDurationSec": target_duration,
        "model": model,
    }

    for i, step in enumerate(steps):
        step_weight = int(int(step.get("weight", 1)) / total_weight * 100)
        step_params = {**common_params, **(step.get("params") or {})}
        code, result = _run_step(step, step_params, base_offset, step_weight)
        if code != 0:
            bridge.error(
                f"Phase '{step.get('label')}' failed (exit {code}). "
                f"Completed {i}/{len(steps)} steps. Open Resolve to inspect partial state."
            )
            bridge.result({
                "completed": i,
                "totalSteps": len(steps),
                "failedAt": step.get("scriptId"),
                "partialResults": step_results,
            })
            sys.exit(code)
        if result is not None:
            step_results[step["scriptId"]] = result
            # Pipe step output forward: downstream steps see previous result
            # fields at top-level (e.g. cull → session, thumbnails → place_clips).
            if isinstance(result, dict):
                for k, v in result.items():
                    common_params[k] = v
        base_offset += step_weight

    bridge.progress(100, 100, "Done.")
    bridge.result({
        "completed": len(steps),
        "totalSteps": len(steps),
        "stepResults": step_results,
        "templateId": template_id,
        "pipeline": pipeline.get("name"),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

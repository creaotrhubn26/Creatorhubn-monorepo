"""Create Bins from Scenes — provisions Media Pool bins matching the Role Room
project's scene list, so the lead opens Resolve to a structure that mirrors
their pre-production breakdown.

Input via params:
  scenes: List[
    {
      sceneNumber?: int,
      title?: str,
      intExt?: "INT" | "EXT" | str,
      timeOfDay?: str,
    }
  ]

Behavior:
  - Connects to the CURRENT Resolve project (must be open).
  - For each scene, creates a top-level Media Pool bin named:
       "{NN} {title} {INT/EXT} {timeOfDay}"
    e.g. "01 Coffee shop INT DAG"
  - Skips scenes that already have a matching bin (by name) — idempotent.
  - In dry-run mode lists the bin names that WOULD be created.

Naming rationale: leading zero-padded sceneNumber keeps Resolve's Media Pool
sort matching the script order; remaining fields are space-separated so they
work in Resolve's restricted bin-name charset.
"""

from __future__ import annotations

import os
import re
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Resolve bin names disallow some chars; keep this loose but safe.
INVALID_BIN_CHARS = re.compile(r"[/\\:*?\"<>|]")


def format_bin_name(scene: dict, idx: int) -> str:
    raw_num = scene.get("sceneNumber")
    try:
        num = int(raw_num) if raw_num is not None else idx + 1
    except (TypeError, ValueError):
        num = idx + 1
    title = (scene.get("title") or "Scene").strip()
    int_ext = (scene.get("intExt") or "").strip().upper()
    time_of_day = (scene.get("timeOfDay") or "").strip().upper()
    parts = [f"{num:02d}", title]
    if int_ext:
        parts.append(int_ext)
    if time_of_day:
        parts.append(time_of_day)
    name = " ".join(parts)
    return INVALID_BIN_CHARS.sub("-", name)


def existing_bin_names(root_folder: Any) -> set[str]:
    names: set[str] = set()
    try:
        for sub in root_folder.GetSubFolderList() or []:
            try:
                names.add(sub.GetName())
            except Exception:  # noqa: BLE001 — Resolve API throws raw Lua-style errors
                continue
    except Exception:  # noqa: BLE001
        pass
    return names


def run(params: dict, dry_run: bool) -> None:
    scenes_raw = params.get("scenes") or []
    if isinstance(scenes_raw, str):
        # Tolerate JSON-stringified payload (Tauri sometimes serializes nested structures this way)
        import json as _json
        try:
            scenes_raw = _json.loads(scenes_raw)
        except _json.JSONDecodeError:
            bridge.error("scenes parameter is a string that isn't valid JSON")
            sys.exit(1)
    if not isinstance(scenes_raw, list):
        bridge.error("scenes must be an array")
        sys.exit(1)
    if not scenes_raw:
        bridge.error("scenes list is empty — nothing to create")
        sys.exit(1)

    planned: list[str] = []
    for idx, scene in enumerate(scenes_raw):
        if not isinstance(scene, dict):
            continue
        planned.append(format_bin_name(scene, idx))

    if dry_run:
        bridge.result({
            "summary": f"Would create {len(planned)} scene bins in the current Resolve project",
            "binsPlanned": planned,
            "exampleNames": planned[:5],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No current Resolve project — open one and try again")
        sys.exit(1)

    media_pool = conn.project.GetMediaPool()
    if not media_pool:
        bridge.error("Could not access Media Pool on current project")
        sys.exit(1)
    root_folder = media_pool.GetRootFolder()
    if not root_folder:
        bridge.error("Could not access root folder of Media Pool")
        sys.exit(1)

    already = existing_bin_names(root_folder)
    created: list[str] = []
    skipped: list[str] = []
    failed: list[dict] = []

    for i, name in enumerate(planned):
        bridge.progress(i, len(planned), name)
        if name in already:
            skipped.append(name)
            continue
        try:
            folder = media_pool.AddSubFolder(root_folder, name)
        except Exception as exc:  # noqa: BLE001
            failed.append({"name": name, "error": str(exc)})
            continue
        if folder:
            created.append(name)
        else:
            failed.append({"name": name, "error": "AddSubFolder returned None"})

    bridge.progress(len(planned), len(planned), "Done.")

    bridge.result({
        "projectName": conn.project.GetName() if conn.project else None,
        "binsCreated": created,
        "binsSkipped": skipped,
        "binsFailed": failed,
        "totalRequested": len(planned),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

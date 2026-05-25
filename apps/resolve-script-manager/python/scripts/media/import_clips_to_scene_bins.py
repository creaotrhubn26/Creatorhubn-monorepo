"""Import Clips to Scene Bins — imports already-downloaded captured clips
into the current Resolve project, placing each clip into the bin matching
its scene-number + scene-title (matching the bin-naming used by
create_bins_from_scenes.py).

Input via params:
  clips: List[
    {
      localPath: str,           # absolute path on disk (staging folder)
      sceneNumber?: int,
      sceneTitle?: str,
      takeNumber?: int,
      intExt?: str,
      timeOfDay?: str,
    }
  ]

Behavior:
  - Looks up the corresponding bin in Media Pool by formatted name
    (e.g. "01 Coffee shop INT DAG"). Creates the bin if missing.
  - Sets the bin as current, then ImportMedia([localPath]).
  - Doesn't move/rename the source file — staging folder is caller's
    responsibility to clean up later.
  - Reports {imported, failed, missingBins (now created)} so the lead
    can see which clips landed where.
"""

from __future__ import annotations

import os
import re
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


INVALID_BIN_CHARS = re.compile(r"[/\\:*?\"<>|]")


def format_bin_name(scene_number: Any, title: str | None, int_ext: str | None, time_of_day: str | None) -> str:
    try:
        num = int(scene_number) if scene_number is not None else 0
    except (TypeError, ValueError):
        num = 0
    safe_title = (title or "Scene").strip()
    parts = [f"{num:02d}", safe_title]
    ie = (int_ext or "").strip().upper()
    tod = (time_of_day or "").strip().upper()
    if ie:
        parts.append(ie)
    if tod:
        parts.append(tod)
    return INVALID_BIN_CHARS.sub("-", " ".join(parts))


def find_or_create_bin(media_pool: Any, root_folder: Any, bin_name: str, _cache: dict) -> Any | None:
    if bin_name in _cache:
        return _cache[bin_name]
    try:
        for sub in root_folder.GetSubFolderList() or []:
            try:
                if sub.GetName() == bin_name:
                    _cache[bin_name] = sub
                    return sub
            except Exception:  # noqa: BLE001
                continue
    except Exception:  # noqa: BLE001
        pass
    try:
        folder = media_pool.AddSubFolder(root_folder, bin_name)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"AddSubFolder('{bin_name}') threw: {exc}")
        return None
    if folder:
        _cache[bin_name] = folder
    return folder


def run(params: dict, dry_run: bool) -> None:
    clips_raw = params.get("clips") or []
    if isinstance(clips_raw, str):
        import json as _json
        try:
            clips_raw = _json.loads(clips_raw)
        except _json.JSONDecodeError:
            bridge.error("clips is a string but not valid JSON")
            sys.exit(1)
    if not isinstance(clips_raw, list) or not clips_raw:
        bridge.error("clips must be a non-empty array")
        sys.exit(1)

    # Pre-flight: filter to clips with existing local paths.
    plan: list[dict] = []
    missing_local: list[str] = []
    for c in clips_raw:
        if not isinstance(c, dict):
            continue
        local_path = (c.get("localPath") or "").strip()
        if not local_path:
            continue
        if not os.path.isfile(local_path):
            missing_local.append(local_path)
            continue
        bin_name = format_bin_name(
            c.get("sceneNumber"),
            c.get("sceneTitle"),
            c.get("intExt"),
            c.get("timeOfDay"),
        )
        plan.append({"local_path": local_path, "bin_name": bin_name, "raw": c})

    if not plan:
        bridge.error(
            "No clips with existing local files — caller must download "
            "presigned URLs to disk before invoking this script."
        )
        sys.exit(1)

    if dry_run:
        bins_planned: set[str] = {p["bin_name"] for p in plan}
        bridge.result({
            "summary": f"Would import {len(plan)} clips into {len(bins_planned)} bins",
            "binsPlanned": sorted(bins_planned),
            "clipsCount": len(plan),
            "missingLocal": missing_local,
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
        bridge.error("Could not access Media Pool")
        sys.exit(1)
    root_folder = media_pool.GetRootFolder()
    if not root_folder:
        bridge.error("Could not access Media Pool root folder")
        sys.exit(1)

    bin_cache: dict = {}
    imported: list[dict] = []
    failed: list[dict] = []
    bins_created: set[str] = set()

    for i, p in enumerate(plan):
        bridge.progress(i, len(plan), os.path.basename(p["local_path"]))
        bin_name = p["bin_name"]
        existed_before = bin_name in bin_cache or any(
            (sub.GetName() == bin_name)
            for sub in (root_folder.GetSubFolderList() or [])
        )
        folder = find_or_create_bin(media_pool, root_folder, bin_name, bin_cache)
        if not folder:
            failed.append({"file": p["local_path"], "bin": bin_name, "error": "could_not_resolve_bin"})
            continue
        if not existed_before:
            bins_created.add(bin_name)

        try:
            media_pool.SetCurrentFolder(folder)
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"SetCurrentFolder('{bin_name}') threw: {exc}")
            failed.append({"file": p["local_path"], "bin": bin_name, "error": f"set_current_folder: {exc}"})
            continue

        try:
            items = media_pool.ImportMedia([p["local_path"]])
        except Exception as exc:  # noqa: BLE001
            failed.append({"file": p["local_path"], "bin": bin_name, "error": f"import: {exc}"})
            continue
        if items:
            imported.append({"file": p["local_path"], "bin": bin_name})
        else:
            failed.append({"file": p["local_path"], "bin": bin_name, "error": "ImportMedia returned empty"})

    bridge.progress(len(plan), len(plan), "Done.")

    bridge.result({
        "projectName": conn.project.GetName(),
        "imported": imported,
        "failed": failed,
        "binsCreated": sorted(bins_created),
        "missingLocal": missing_local,
        "totalRequested": len(clips_raw),
        "totalImported": len(imported),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""Delete only timelines created by one Music Video Editor build.

Targets are resolved by both persistent Resolve unique ID and name, and the
active project ID must match the approved build manifest. Source media and
pre-existing timelines are never deleted.
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


MANIFEST_PATH = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_music_video_build.json"
)


def _load_manifest() -> dict:
    if not os.path.isfile(MANIFEST_PATH):
        return {}
    try:
        with open(MANIFEST_PATH) as source:
            return json.load(source)
    except (OSError, json.JSONDecodeError):
        return {}


def run(params: dict[str, Any], dry_run: bool) -> None:
    manifest = _load_manifest()
    operation_id = str(params.get("operationId") or manifest.get("operationId") or "").strip()
    expected_project_id = str(params.get("projectId") or manifest.get("projectId") or "").strip()
    targets = params.get("timelines") or manifest.get("timelines") or []
    if not manifest or not operation_id or not expected_project_id or not isinstance(targets, list) or not targets:
        bridge.error("Ingen gyldig Music Video-build finnes å angre.")
        return
    if manifest and manifest.get("operationId") not in (None, operation_id):
        bridge.error("Rollback-manifestet tilhører en annen build-operasjon.")
        return
    if manifest.get("projectId") != expected_project_id:
        bridge.error("Rollback-manifestet tilhører et annet Resolve-prosjekt.")
        return

    safe_targets = [
        {
            "uniqueId": str(target.get("uniqueId") or "").strip(),
            "name": str(target.get("name") or "").strip(),
        }
        for target in targets
        if isinstance(target, dict) and target.get("uniqueId") and target.get("name")
    ]
    if not safe_targets:
        bridge.error("Rollback krever både unik timeline-ID og navn for hvert mål.")
        return
    requested_keys = {(target["uniqueId"], target["name"]) for target in safe_targets}
    manifest_keys = {
        (str(target.get("uniqueId") or ""), str(target.get("name") or ""))
        for target in manifest.get("timelines") or []
        if isinstance(target, dict)
    }
    if not requested_keys.issubset(manifest_keys):
        bridge.error("Rollback-målene samsvarer ikke med build-manifestet.")
        return
    safe_targets = [
        {"uniqueId": unique_id, "name": name}
        for unique_id, name in sorted(requested_keys)
    ]
    if dry_run:
        bridge.result({
            "wouldRollback": operation_id,
            "projectId": expected_project_id,
            "timelines": safe_targets,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    try:
        project_id = project.GetUniqueId() or ""
    except Exception:  # noqa: BLE001
        project_id = ""
    if project_id != expected_project_id:
        bridge.error("Aktivt Resolve-prosjekt er ikke prosjektet rollbacken tilhører.")
        return

    target_keys = {(target["uniqueId"], target["name"]) for target in safe_targets}
    resolved = []
    untouched = []
    for index in range(1, int(project.GetTimelineCount() or 0) + 1):
        timeline = project.GetTimelineByIndex(index)
        if not timeline:
            continue
        try:
            key = (timeline.GetUniqueId() or "", timeline.GetName() or "")
        except Exception:  # noqa: BLE001
            continue
        if key in target_keys:
            resolved.append(timeline)
        else:
            untouched.append(timeline)
    if len(resolved) != len(target_keys):
        bridge.error(
            f"Rollback stoppet: fant {len(resolved)} av {len(target_keys)} eksakte timelines. "
            "Ingen timelines ble slettet."
        )
        return

    current = project.GetCurrentTimeline()
    if current in resolved and untouched:
        project.SetCurrentTimeline(untouched[0])
    if not conn.media_pool.DeleteTimelines(resolved):
        bridge.error("Resolve avviste sletting av Music Video-timelines.")
        return

    deleted_names = [target["name"] for target in safe_targets]
    if manifest.get("operationId") == operation_id:
        manifest["rolledBackAt"] = time.time()
        manifest["deletedTimelines"] = deleted_names
        try:
            with open(MANIFEST_PATH, "w") as target:
                json.dump(manifest, target, indent=2)
        except OSError as exc:
            bridge.warn(f"Timelines ble slettet, men manifestet kunne ikke oppdateres: {exc}")

    bridge.result({
        "rolledBack": True,
        "operationId": operation_id,
        "projectId": project_id,
        "deletedCount": len(deleted_names),
        "deletedTimelines": deleted_names,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

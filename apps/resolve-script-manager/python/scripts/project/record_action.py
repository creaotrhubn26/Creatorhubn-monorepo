"""Sidecar: før en utført handling inn i prosjektindeksen (actions/rollbacks).

Kalles fire-and-forget fra panelets main-prosess ETTER ekte (ikke-dry)
kjøringer — kobler handlingen til objekt-uid-er og evt. rollback-referansen
(backup-timeline-navnet) som ble tatt rett før. Trenger IKKE Resolve:
åpner databasen rått på prosjekt-GUID.

Params: guid, via, scriptId, params (JSON-streng), ok (true/false),
        result (JSON-streng, sammendrag), objects (JSON-liste uid-er),
        rollbackRef (valgfri: backup-timeline-navn)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402
from project_index import ProjectIndex  # noqa: E402


def run(params: dict, dry_run: bool) -> None:
    guid = (params.get("guid") or "").strip()
    if not guid:
        bridge.error("guid kreves.")
        return
    idx = ProjectIndex.open_raw(guid)

    def _load(key, default):
        v = params.get(key)
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return default
        return v if v is not None else default

    action_id = idx.record_action(
        via=params.get("via") or "panel",
        script_id=params.get("scriptId") or "?",
        params=_load("params", {}),
        dry_run=False,
        ok=str(params.get("ok", "true")).lower() in ("true", "1"),
        result=_load("result", {}),
        objects=_load("objects", []),
    )
    ref = (params.get("rollbackRef") or "").strip()
    if ref:
        idx.record_rollback(action_id, "backup-timeline", ref)
    idx.close()
    bridge.result({"actionId": action_id, "rollbackLinked": bool(ref), "dryRun": dry_run})


if __name__ == "__main__":
    bridge.main_guard(run)

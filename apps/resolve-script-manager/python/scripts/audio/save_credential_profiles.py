"""Save Credential Profiles — frontend lagrer profil-endringer.

Input:
  action: "upsert_profile" | "delete_profile" | "set_active" | "set_project_profile"
  payload: avhengig av action

Profiles:
  upsert_profile: { id?, name, credentials: {providerId: value, ...} }
    Hvis id finnes: oppdater. Ellers: lag ny.
  delete_profile: { id }
  set_active: { profileId }
  set_project_profile: { sourceVideo, profileId }  (eller profileId=null = fjern mapping)
"""

from __future__ import annotations

import os
import sys
import time
import uuid
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

from credential_store import load_store, save_store


def run(params: dict[str, Any], dry_run: bool) -> None:
    action = (params.get("action") or "").strip()
    payload = params.get("payload") or {}

    if dry_run:
        bridge.result({"wouldAct": action})
        return

    store = load_store()
    profiles = store.setdefault("profiles", [])

    if action == "upsert_profile":
        profile_id = payload.get("id")
        name = (payload.get("name") or "").strip()
        creds = payload.get("credentials") or {}
        if not name:
            bridge.error("name required")
            sys.exit(1)
        if profile_id:
            # Update existing
            for p in profiles:
                if p["id"] == profile_id:
                    p["name"] = name
                    # Merge credentials: nye verdier overskriver, blank betyr fjern
                    existing = p.setdefault("credentials", {})
                    for k, v in creds.items():
                        if v == "":
                            existing.pop(k, None)
                        else:
                            existing[k] = v
                    break
            else:
                bridge.error(f"Profile id '{profile_id}' not found")
                sys.exit(1)
        else:
            # Create new
            new_id = f"p_{uuid.uuid4().hex[:10]}"
            profiles.append({
                "id": new_id, "name": name,
                "credentials": {k: v for k, v in creds.items() if v},
                "createdAt": time.time(),
            })
            profile_id = new_id

    elif action == "delete_profile":
        profile_id = payload.get("id")
        if not profile_id:
            bridge.error("id required")
            sys.exit(1)
        if profile_id == "default":
            bridge.error("Kan ikke slette default-profil")
            sys.exit(1)
        store["profiles"] = [p for p in profiles if p["id"] != profile_id]
        if store.get("activeProfileId") == profile_id:
            store["activeProfileId"] = "default"
        # Fjern fra project-mapping
        pm = store.get("projectProfileMap") or {}
        store["projectProfileMap"] = {k: v for k, v in pm.items() if v != profile_id}

    elif action == "set_active":
        profile_id = payload.get("profileId")
        if not profile_id:
            bridge.error("profileId required")
            sys.exit(1)
        if not any(p["id"] == profile_id for p in profiles):
            bridge.error(f"Profile '{profile_id}' not found")
            sys.exit(1)
        store["activeProfileId"] = profile_id

    elif action == "set_project_profile":
        source = (payload.get("sourceVideo") or "").strip()
        profile_id = payload.get("profileId")
        if not source:
            bridge.error("sourceVideo required")
            sys.exit(1)
        pm = store.setdefault("projectProfileMap", {})
        if profile_id is None or profile_id == "":
            pm.pop(source, None)
        else:
            if not any(p["id"] == profile_id for p in profiles):
                bridge.error(f"Profile '{profile_id}' not found")
                sys.exit(1)
            pm[source] = profile_id

    else:
        bridge.error(f"Unknown action: {action}")
        sys.exit(1)

    save_store(store)
    bridge.log(f"Action '{action}' completed")
    bridge.result({"ok": True, "action": action})


if __name__ == "__main__":
    bridge.main_guard(run)

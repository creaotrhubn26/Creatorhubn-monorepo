"""Read Credential Profiles — frontend henter aktuelle profiler + active
+ project-mapping fra credential_profiles.json.

Maskerer credentials (returnerer bare hvor mange tegn) av sikkerhets-
hensyn. For ekte values må man bruke save_credential_profiles.
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

from credential_store import load_store


def _mask(value: str) -> str:
    if not value: return ""
    n = len(value)
    return "•" * min(n, 8) + (f" ({n} chars)" if n > 0 else "")


def run(params: dict[str, Any], dry_run: bool) -> None:
    if dry_run:
        bridge.result({"wouldRead": True})
        return
    store = load_store()
    masked_profiles = []
    for p in store.get("profiles", []):
        creds = p.get("credentials") or {}
        masked = {k: _mask(str(v)) for k, v in creds.items()}
        masked_profiles.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "credentialsMasked": masked,
            "credentialsConfigured": [k for k, v in creds.items() if str(v).strip()],
            "createdAt": p.get("createdAt"),
        })
    bridge.result({
        "profiles": masked_profiles,
        "activeProfileId": store.get("activeProfileId"),
        "projectProfileMap": store.get("projectProfileMap") or {},
    })


if __name__ == "__main__":
    bridge.main_guard(run)

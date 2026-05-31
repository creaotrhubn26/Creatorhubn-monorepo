"""Fetch Vault Music Secrets — list relevante credentials fra Role Room
Client Access Vault.

Bruker RR_BEARER_TOKEN fra app-settings. Returnerer ALLE vault-secrets
for prosjektet med platform-prefiks som ligner musikk-providers
(soundstripe/musicbed/artlist/etc.). Reveal av faktisk credential
skjer på separat request (krever 2FA-step-up).

Input:
  projectId: Role Room project-ID (fra producer-view)
  rrBaseUrl: (optional) default https://creatorhubn.com

Output:
  vaultSecrets: [{ id, platform, label, status, lastRevealedAt, requiresMfa }]
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Hvilke vault-platforms regnes som musikk-relaterte
MUSIC_PLATFORMS = {
    "soundstripe", "musicbed", "artlist", "audiojungle", "epidemic_sound",
    "epidemic", "storyblocks", "premiumbeat", "jamendo", "pixabay",
    "spotify_for_video", "music_subscription",
}


def run(params: dict[str, Any], dry_run: bool) -> None:
    project_id = (params.get("projectId") or "").strip()
    base_url = (params.get("rrBaseUrl") or "").strip().rstrip("/") or "https://creatorhubn.com"
    token = os.environ.get("RR_BEARER_TOKEN", "").strip()

    if not project_id:
        bridge.error("projectId required")
        sys.exit(1)
    if not token:
        bridge.error("RR_BEARER_TOKEN ikke satt — logg inn med Role Room i Settings")
        sys.exit(1)

    if dry_run:
        bridge.result({"wouldFetch": project_id})
        return

    url = f"{base_url}/api/role-room/projects/{urllib.parse.quote(project_id)}/producer/access-vault"
    try:
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "RoleRoomPostAgent/0.1",
        })
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        bridge.error(f"Role Room API {exc.code}: {exc.reason}")
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        bridge.error(f"Vault fetch failed: {exc.__class__.__name__}: {exc}")
        sys.exit(1)

    all_secrets = data.get("secrets") or []
    music_secrets = [
        {
            "id": s.get("id"),
            "platform": s.get("platform"),
            "label": s.get("label") or s.get("platform"),
            "status": s.get("status"),
            "tier": s.get("tier"),
            "ownerLabel": s.get("ownerLabel") or s.get("owner_label"),
            "lastRevealedAt": s.get("lastRevealedAt") or s.get("last_revealed_at"),
            "requiresMfa": (s.get("revealPolicy") or s.get("reveal_policy")) != "instant",
            "maskedReference": s.get("maskedReference") or s.get("masked_reference"),
        }
        for s in all_secrets
        if (s.get("platform") or "").lower() in MUSIC_PLATFORMS
    ]

    bridge.log(f"Fant {len(music_secrets)} musikk-vault-secrets av {len(all_secrets)} totalt")
    bridge.result({
        "vaultSecrets": music_secrets,
        "totalVaultSecrets": len(all_secrets),
        "projectId": project_id,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

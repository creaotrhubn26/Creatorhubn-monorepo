"""Credential Store — persisterer multi-tenant credential-profiler.

Use case: Bjarne har Soundstripe Pro for egne bryllup. Når han redigerer
for klient Acme Corp, bruker han Acme's Soundstripe-key. Når han redigerer
for paret Hamis & Rukhma, bruker han parets Artlist-lisens.

Storage: ~/Library/.../credential_profiles.json (klartekst — TODO: keychain).
"""

from __future__ import annotations

import json
import os
import time
from typing import Optional

CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
STORE_PATH = os.path.join(CACHE_DIR, "credential_profiles.json")


def _empty_store() -> dict:
    return {
        "profiles": [
            {"id": "default", "name": "Min egen", "credentials": {}, "createdAt": time.time()}
        ],
        "activeProfileId": "default",
        "projectProfileMap": {},
    }


def load_store() -> dict:
    if not os.path.isfile(STORE_PATH):
        return _empty_store()
    try:
        with open(STORE_PATH) as f:
            data = json.load(f)
        if not isinstance(data, dict): return _empty_store()
        data.setdefault("profiles", [])
        data.setdefault("activeProfileId", "default")
        data.setdefault("projectProfileMap", {})
        if not data["profiles"]:
            data = _empty_store()
        return data
    except (OSError, json.JSONDecodeError):
        return _empty_store()


def save_store(data: dict) -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(STORE_PATH, "w") as f:
        json.dump(data, f, indent=2)
    # Set restrictive permissions (0600) siden filen har credentials
    try:
        os.chmod(STORE_PATH, 0o600)
    except OSError:
        pass


def get_active_profile_for_source(source_video: Optional[str] = None) -> dict:
    """Returner aktiv profil. Hvis source_video har en spesifikk mapping,
    bruk den. Ellers global aktiv profil."""
    store = load_store()
    profile_id = store["activeProfileId"]
    if source_video and source_video in store["projectProfileMap"]:
        profile_id = store["projectProfileMap"][source_video]
    for p in store["profiles"]:
        if p["id"] == profile_id:
            return p
    # Fallback: første profil
    return store["profiles"][0] if store["profiles"] else _empty_store()["profiles"][0]


def apply_profile_to_env(profile: dict) -> None:
    """Sett os.environ-variabler fra profil-credentials så providers kan
    lese dem via os.environ.get()."""
    creds = profile.get("credentials") or {}
    for provider_id, key_value in creds.items():
        if not key_value: continue
        env_var = _provider_env_var(provider_id)
        if env_var:
            os.environ[env_var] = str(key_value)


def _provider_env_var(provider_id: str) -> Optional[str]:
    """Map provider-id → env-var-navn. Matcher Provider.key_env_var."""
    mapping = {
        "soundstripe": "SOUNDSTRIPE_API_KEY",
        "musicbed": "MUSICBED_API_KEY",
        "artlist": "ARTLIST_LICENSE_KEY",
        "audiojungle": "AUDIOJUNGLE_API_KEY",
        "epidemic": "EPIDEMIC_API_KEY",
        "storyblocks": "STORYBLOCKS_API_KEY",
        "premiumbeat": "PREMIUMBEAT_API_KEY",
        "jamendo": "JAMENDO_CLIENT_ID",
        "pixabay": "PIXABAY_API_KEY",
    }
    return mapping.get(provider_id)

"""Download Provider Track — last ned en spesifikk track fra en provider.

Brukes etter search_music_providers når brukeren har valgt en sang.
Trigger den providers download-metode, returnerer lokal WAV-path.
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

from music_providers import PROVIDERS_BY_ID
from music_providers.base import TrackResult
from credential_store import get_active_profile_for_source, apply_profile_to_env


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
DEST_DIR = os.path.join(CACHE_DIR, "provider_songs")


def run(params: dict[str, Any], dry_run: bool) -> None:
    provider_id = (params.get("provider") or "").strip()
    track_id = (params.get("trackId") or "").strip()
    download_url = (params.get("downloadUrl") or "").strip()
    title = (params.get("title") or "track").strip()
    artist = (params.get("artist") or "").strip()

    if not provider_id or provider_id not in PROVIDERS_BY_ID:
        bridge.error(f"Unknown provider: {provider_id}")
        sys.exit(1)
    if not track_id:
        bridge.error("trackId required")
        sys.exit(1)

    # Aktiv credential-profil (samme som ble brukt under søk)
    source_video = (params.get("sourceVideo") or "").strip() or None
    profile = get_active_profile_for_source(source_video)
    apply_profile_to_env(profile)

    provider = PROVIDERS_BY_ID[provider_id]
    if not provider.is_configured():
        bridge.error(f"{provider.name} ikke konfigurert i profil '{profile.get('name')}'")
        sys.exit(1)

    if dry_run:
        bridge.result({"wouldDownload": f"{title} — {artist}", "provider": provider_id})
        return

    track = TrackResult(
        provider=provider_id, track_id=track_id, title=title,
        artist=artist, download_url=download_url or None,
    )

    os.makedirs(DEST_DIR, exist_ok=True)
    bridge.progress(20, 100, f"Laster ned {title} fra {provider.name} …")
    wav_path = provider.download(track, DEST_DIR)
    if not wav_path:
        bridge.error(f"Download feilet eller ikke støttet av {provider.name}")
        sys.exit(1)

    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"Downloaded → {wav_path}")
    bridge.result({
        "wavPath": wav_path,
        "provider": provider_id,
        "title": title,
        "artist": artist,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

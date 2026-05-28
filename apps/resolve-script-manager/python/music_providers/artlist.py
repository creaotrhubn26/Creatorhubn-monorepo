"""Artlist — ingen offentlig API. Implementerer browser-launch-flow
i stedet: provider returnerer en search-URL som åpnes i nettleseren,
bruker laster ned WAV manuelt og drar inn via UI.

Vi støtter også LISENS-import: bruker limer inn lisens-koden Artlist gir
ved kjøp, vi logger lisensen sammen med klippet for senere referanse.
"""

from __future__ import annotations

import os
from typing import Optional
from urllib.parse import quote_plus

from .base import Provider, TrackResult


class ArtlistProvider(Provider):
    id = "artlist"
    name = "Artlist (browser-flow)"
    requires_key = False
    license_terms_url = "https://artlist.io/license"

    def search(self, query: str, limit: int = 20) -> list[TrackResult]:
        # Returnerer EN entry som peker bruker til Artlist sin egen søkeside.
        # UI håndterer dette spesielt: viser "Søk på Artlist.io →"-knapp.
        return [TrackResult(
            provider=self.id,
            track_id="artlist_search",
            title=f"Søk på Artlist.io: '{query}'",
            artist="(ingen offentlig API)",
            license_url=f"https://artlist.io/royalty-free-music?term={quote_plus(query)}",
            license_type="subscription",
            meta={"is_browser_link": True},
        )]

    def download(self, track: TrackResult, dest_dir: str) -> Optional[str]:
        # Direkte download ikke støttet. Returner None.
        return None

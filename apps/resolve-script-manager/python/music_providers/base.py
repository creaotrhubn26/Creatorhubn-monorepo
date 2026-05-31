"""Base abstractions for music providers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TrackResult:
    """Et søke-resultat fra en provider."""
    provider: str
    track_id: str
    title: str
    artist: str
    duration_sec: float = 0.0
    bpm: Optional[float] = None
    genre: Optional[str] = None
    mood: Optional[str] = None
    license_url: Optional[str] = None  # link til lisens-kjøp hvis paywallet
    preview_url: Optional[str] = None  # streaming-preview MP3
    download_url: Optional[str] = None  # direkte WAV/MP3 url (hvis tillatt)
    thumbnail_url: Optional[str] = None
    price_usd: Optional[float] = None  # kostnad for lisens (None = gratis/inkludert)
    license_type: str = "royalty_free"  # royalty_free | subscription | per_track | partner
    meta: dict = field(default_factory=dict)


class Provider:
    """Abstrakt base. Konkrete providers implementerer search + download."""

    id: str = ""
    name: str = ""
    requires_key: bool = False
    key_env_var: str = ""
    license_terms_url: str = ""

    def is_configured(self) -> bool:
        """True hvis providern er klar til bruk (har API-key/credentials)."""
        if not self.requires_key:
            return True
        import os
        return bool(os.environ.get(self.key_env_var, "").strip())

    def search(self, query: str, limit: int = 20) -> list[TrackResult]:
        raise NotImplementedError

    def download(self, track: TrackResult, dest_dir: str) -> Optional[str]:
        """Last ned track til dest_dir, returner WAV-path eller None.
        For paywallede providers uten download-API: returner None og bruker
        må fullføre kjøp manuelt via license_url."""
        raise NotImplementedError

"""Soundstripe — paywallet, krever API-key fra Pro-abonnement.

Search API docs (internal — kontakt support@soundstripe.com for dokumentasjon):
  GET https://api.soundstripe.com/v1/songs/search?q=<query>
    Authorization: Bearer <api_key>

Bruker må sette SOUNDSTRIPE_API_KEY i Settings → Music Providers.
Hvis ikke konfigurert, returner provider tom liste.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from typing import Optional

from .base import Provider, TrackResult


class SoundstripeProvider(Provider):
    id = "soundstripe"
    name = "Soundstripe (krever Pro)"
    requires_key = True
    key_env_var = "SOUNDSTRIPE_API_KEY"
    license_terms_url = "https://www.soundstripe.com/licensing"

    def search(self, query: str, limit: int = 20) -> list[TrackResult]:
        key = os.environ.get(self.key_env_var, "").strip()
        if not key: return []
        try:
            url = "https://api.soundstripe.com/v1/songs/search?" + urllib.parse.urlencode({
                "q": query, "limit": str(limit),
            })
            req = urllib.request.Request(url, headers={
                "Authorization": f"Bearer {key}",
                "User-Agent": "RoleRoomPostAgent/0.1",
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:  # noqa: BLE001
            return []

        results: list[TrackResult] = []
        for item in (data.get("data") or [])[:limit]:
            attrs = item.get("attributes", {}) or {}
            results.append(TrackResult(
                provider=self.id,
                track_id=str(item.get("id")),
                title=attrs.get("title", ""),
                artist=attrs.get("artist", ""),
                duration_sec=float(attrs.get("duration") or 0),
                bpm=float(attrs.get("bpm")) if attrs.get("bpm") else None,
                genre=attrs.get("genre"),
                mood=attrs.get("mood"),
                preview_url=attrs.get("preview_mp3"),
                download_url=attrs.get("download_wav"),
                thumbnail_url=attrs.get("artwork_url"),
                license_url=f"https://www.soundstripe.com/songs/{item.get('id')}",
                license_type="subscription",
                price_usd=0.0,  # inkludert i abonnement
            ))
        return results

    def download(self, track: TrackResult, dest_dir: str) -> Optional[str]:
        key = os.environ.get(self.key_env_var, "").strip()
        if not key or not track.download_url: return None
        os.makedirs(dest_dir, exist_ok=True)
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in track.title[:60])
        wav_path = os.path.join(dest_dir, f"soundstripe_{track.track_id}_{safe}.wav")
        if os.path.isfile(wav_path): return wav_path
        try:
            req = urllib.request.Request(track.download_url, headers={
                "Authorization": f"Bearer {key}",
                "User-Agent": "RoleRoomPostAgent/0.1",
            })
            with urllib.request.urlopen(req, timeout=180) as resp:
                with open(wav_path, "wb") as f:
                    f.write(resp.read())
            return wav_path
        except Exception:  # noqa: BLE001
            return None

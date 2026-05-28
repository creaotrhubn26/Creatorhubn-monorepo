"""Pixabay Music — gratis royalty-free, åpent API."""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
import subprocess
from typing import Optional

from .base import Provider, TrackResult


PIXABAY_DEMO_KEY = "9656065-a4094594c34f9ac14c7fc4c39"  # Pixabay's demo key


class PixabayProvider(Provider):
    id = "pixabay"
    name = "Pixabay Music (royalty-free)"
    requires_key = False
    key_env_var = "PIXABAY_API_KEY"
    license_terms_url = "https://pixabay.com/service/license-summary/"

    def _get_key(self) -> str:
        return os.environ.get(self.key_env_var, "").strip() or PIXABAY_DEMO_KEY

    def search(self, query: str, limit: int = 20) -> list[TrackResult]:
        # Pixabay API endpoint for music
        params = {
            "key": self._get_key(),
            "q": query,
            "per_page": str(max(3, min(limit, 50))),
        }
        url = "https://pixabay.com/api/music/?" + urllib.parse.urlencode(params)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "RoleRoomPostAgent/0.1"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:  # noqa: BLE001
            return []

        results: list[TrackResult] = []
        for hit in data.get("hits", []):
            results.append(TrackResult(
                provider=self.id,
                track_id=str(hit.get("id")),
                title=hit.get("title", ""),
                artist=hit.get("artist", ""),
                duration_sec=float(hit.get("duration") or 0),
                genre=hit.get("genre"),
                mood=hit.get("mood"),
                preview_url=hit.get("audio_url"),
                download_url=hit.get("audio_url"),
                thumbnail_url=hit.get("thumb"),
                license_type="royalty_free",
                price_usd=0.0,
            ))
        return results

    def download(self, track: TrackResult, dest_dir: str) -> Optional[str]:
        if not track.download_url: return None
        os.makedirs(dest_dir, exist_ok=True)
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in track.title[:60])
        ext = track.download_url.rsplit(".", 1)[-1].split("?")[0][:4] or "mp3"
        src_path = os.path.join(dest_dir, f"pixabay_{track.track_id}_{safe}.{ext}")
        if not os.path.isfile(src_path):
            try:
                req = urllib.request.Request(track.download_url,
                                              headers={"User-Agent": "RoleRoomPostAgent/0.1"})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    with open(src_path, "wb") as f:
                        f.write(resp.read())
            except Exception:  # noqa: BLE001
                return None
        wav_path = os.path.splitext(src_path)[0] + ".wav"
        if not os.path.isfile(wav_path):
            try:
                subprocess.run([
                    "ffmpeg", "-y", "-loglevel", "error", "-i", src_path,
                    "-ar", "48000", "-ac", "2", wav_path,
                ], capture_output=True, timeout=60)
            except Exception:  # noqa: BLE001
                return src_path
        return wav_path if os.path.isfile(wav_path) else src_path

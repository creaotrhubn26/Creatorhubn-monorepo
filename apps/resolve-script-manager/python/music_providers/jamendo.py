"""Jamendo — gratis royalty-free musikk-plattform med åpent API.
Ingen API-key trengs for grunnleggende søk.

API-docs: https://developer.jamendo.com/v3.0
"""

from __future__ import annotations

import json
import os
import subprocess
import urllib.parse
import urllib.request
from typing import Optional

from .base import Provider, TrackResult


JAMENDO_PUBLIC_CLIENT_ID = "9d9f42e3"  # Jamendo's offentlige demo-key


class JamendoProvider(Provider):
    id = "jamendo"
    name = "Jamendo (royalty-free)"
    requires_key = False
    license_terms_url = "https://www.jamendo.com/legal/creative-commons"

    def search(self, query: str, limit: int = 20) -> list[TrackResult]:
        params = {
            "client_id": JAMENDO_PUBLIC_CLIENT_ID,
            "format": "json",
            "limit": str(limit),
            "search": query,
            "include": "musicinfo",
            "audioformat": "mp31",
        }
        url = "https://api.jamendo.com/v3.0/tracks?" + urllib.parse.urlencode(params)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "RoleRoomPostAgent/0.1"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:  # noqa: BLE001
            return []

        results: list[TrackResult] = []
        for t in data.get("results", []):
            mi = t.get("musicinfo", {}) or {}
            results.append(TrackResult(
                provider=self.id,
                track_id=str(t.get("id")),
                title=t.get("name", ""),
                artist=t.get("artist_name", ""),
                duration_sec=float(t.get("duration") or 0),
                bpm=None,
                genre=", ".join(mi.get("tags", {}).get("genres", [])[:2]) or None,
                mood=", ".join(mi.get("tags", {}).get("vartags", [])[:2]) or None,
                preview_url=t.get("audio"),
                download_url=t.get("audiodownload"),
                thumbnail_url=t.get("album_image"),
                license_type="royalty_free",
                price_usd=0.0,
                meta={"license_cc": mi.get("licenses", {}).get("ccurl")},
            ))
        return results

    def download(self, track: TrackResult, dest_dir: str) -> Optional[str]:
        if not track.download_url:
            return None
        os.makedirs(dest_dir, exist_ok=True)
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in track.title[:60])
        mp3_path = os.path.join(dest_dir, f"jamendo_{track.track_id}_{safe}.mp3")
        if not os.path.isfile(mp3_path):
            try:
                req = urllib.request.Request(track.download_url, headers={"User-Agent": "RoleRoomPostAgent/0.1"})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    with open(mp3_path, "wb") as f:
                        f.write(resp.read())
            except Exception:  # noqa: BLE001
                return None

        # Konverter til WAV for konsistens med rest av audio-pipeline
        wav_path = os.path.splitext(mp3_path)[0] + ".wav"
        if not os.path.isfile(wav_path):
            try:
                subprocess.run([
                    "ffmpeg", "-y", "-loglevel", "error", "-i", mp3_path,
                    "-ar", "48000", "-ac", "2", wav_path,
                ], capture_output=True, timeout=60)
            except Exception:  # noqa: BLE001
                return mp3_path
        return wav_path if os.path.isfile(wav_path) else mp3_path

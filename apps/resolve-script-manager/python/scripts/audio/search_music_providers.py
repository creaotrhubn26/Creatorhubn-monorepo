"""Search Music Providers — unified søk over alle konfigurerte providers.

Input:
  query:        søkestreng
  providers:    (optional) liste av provider-IDs å begrense til
  limit:        max resultater per provider (default 10)

Output:
  results: [{ provider, trackId, title, artist, duration, bpm, genre, mood,
             previewUrl, downloadUrl, licenseUrl, thumbnailUrl, priceUsd,
             licenseType, meta }]
  providerStatuses: {provider: "ok"|"not_configured"|"error"}
"""

from __future__ import annotations

import dataclasses
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

from music_providers import ALL_PROVIDERS
from credential_store import get_active_profile_for_source, apply_profile_to_env


def _to_dict(r):
    d = dataclasses.asdict(r)
    # camelCase for frontend
    return {
        "provider": d["provider"],
        "trackId": d["track_id"],
        "title": d["title"],
        "artist": d["artist"],
        "duration": d["duration_sec"],
        "bpm": d["bpm"],
        "genre": d["genre"],
        "mood": d["mood"],
        "previewUrl": d["preview_url"],
        "downloadUrl": d["download_url"],
        "licenseUrl": d["license_url"],
        "thumbnailUrl": d["thumbnail_url"],
        "priceUsd": d["price_usd"],
        "licenseType": d["license_type"],
        "meta": d["meta"],
    }


def run(params: dict[str, Any], dry_run: bool) -> None:
    query = (params.get("query") or "").strip()
    requested = params.get("providers") or []
    limit = int(params.get("limit") or 10)
    source_video = (params.get("sourceVideo") or "").strip() or None

    if not query:
        bridge.error("query required")
        sys.exit(1)

    # Last aktiv credential-profil (per-prosjekt eller global)
    profile = get_active_profile_for_source(source_video)
    apply_profile_to_env(profile)
    bridge.log(f"Bruker profil: {profile.get('name', 'Min egen')}")

    providers_to_search = ALL_PROVIDERS
    if requested:
        ids = set(requested)
        providers_to_search = [p for p in ALL_PROVIDERS if p.id in ids]

    if dry_run:
        bridge.result({
            "wouldSearch": [p.id for p in providers_to_search],
            "query": query,
        })
        return

    all_results = []
    statuses: dict[str, str] = {}
    for p in providers_to_search:
        if not p.is_configured():
            statuses[p.id] = "not_configured"
            continue
        bridge.progress(
            int(100 * (len(statuses) + 1) / max(1, len(providers_to_search))), 100,
            f"Søker {p.name} …",
        )
        try:
            results = p.search(query, limit=limit)
            statuses[p.id] = "ok"
            for r in results:
                all_results.append(_to_dict(r))
        except Exception as exc:  # noqa: BLE001
            statuses[p.id] = f"error: {exc.__class__.__name__}"
            bridge.warn(f"{p.id} feilet: {exc}")

    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"Fant {len(all_results)} resultater fra {len([s for s in statuses.values() if s == 'ok'])} providers")
    bridge.result({
        "query": query,
        "results": all_results,
        "providerStatuses": statuses,
        "activeProfile": {"id": profile.get("id"), "name": profile.get("name")},
        "providersAvailable": [
            {"id": p.id, "name": p.name, "requiresKey": p.requires_key,
              "configured": p.is_configured(),
              "keyEnvVar": p.key_env_var, "licenseUrl": p.license_terms_url}
            for p in ALL_PROVIDERS
        ],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

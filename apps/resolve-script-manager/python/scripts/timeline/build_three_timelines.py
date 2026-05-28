"""Build Three Timelines — orchestrator som bygger long film + highlight
+ teaser i én sekvens i Resolve.

Brukes etter at extract_highlight_from_film har ferdigstilt + brukeren har
godkjent picks. Kjører:
  1. build_highlight_from_picks → "<Project> — highlight"
  2. build_delivery_variants med variant=long_film → "<Project> — long film"
  3. build_delivery_variants med variant=teaser → "<Project> — teaser"

Input:
  picksPath:      path til last_highlight_picks.json (default cache)
  projectName:    prefix på timeline-navn (default = source-basename)
  wanted:         dict med boolean-flags: longFilm, highlight, teaser
                  (default: alle tre true)
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)


def run(params: dict[str, Any], dry_run: bool) -> None:
    cache_path = (params.get("picksPath") or "").strip() or os.path.join(
        CACHE_DIR, "last_highlight_picks.json"
    )
    project_name = (params.get("projectName") or "").strip()
    wanted = params.get("wanted") or {"longFilm": True, "highlight": True, "teaser": True}

    if not os.path.isfile(cache_path):
        bridge.error(f"Picks-cache mangler: {cache_path}")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldBuild": [k for k, v in wanted.items() if v],
            "picksPath": cache_path,
        })
        return

    # Last bridge.run-modul dynamisk slik vi kan ringe scripts direkte.
    import importlib.util

    def load_module(rel_path: str):
        full = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), rel_path)
        spec = importlib.util.spec_from_file_location(os.path.basename(rel_path)[:-3], full)
        if not spec or not spec.loader:
            return None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    results = {}

    # Highlight
    if wanted.get("highlight"):
        bridge.progress(0, 100, "Bygger highlight-timeline …")
        try:
            mod = load_module("python/scripts/timeline/build_highlight_from_picks.py")
            if mod:
                mod.run({"cachePath": cache_path, "timelineName": f"{project_name} — Highlight"}, False)
                results["highlight"] = "ok"
        except SystemExit:
            results["highlight"] = "failed"
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Highlight build failed: {exc}")
            results["highlight"] = "failed"

    # Long film (via delivery_variants)
    if wanted.get("longFilm"):
        bridge.progress(35, 100, "Bygger long-film-timeline …")
        try:
            mod = load_module("python/scripts/timeline/build_delivery_variants.py")
            if mod:
                mod.run({
                    "variants": ["long_film"],
                    "timelinePrefix": project_name or None,
                }, False)
                results["longFilm"] = "ok"
        except SystemExit:
            results["longFilm"] = "failed"
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Long-film build failed: {exc}")
            results["longFilm"] = "failed"

    # Teaser (via delivery_variants)
    if wanted.get("teaser"):
        bridge.progress(70, 100, "Bygger teaser-timeline …")
        try:
            mod = load_module("python/scripts/timeline/build_delivery_variants.py")
            if mod:
                mod.run({
                    "variants": ["teaser"],
                    "timelinePrefix": project_name or None,
                }, False)
                results["teaser"] = "ok"
        except SystemExit:
            results["teaser"] = "failed"
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Teaser build failed: {exc}")
            results["teaser"] = "failed"

    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"Built timelines: {results}")
    bridge.result({
        "timelines": results,
        "projectName": project_name,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

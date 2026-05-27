"""List Archived Projects — enumerate picks/<name>_<ts>.json filer.

Returnerer metadata-liste (path, sourceVideo, title, savedAt, picksCount)
slik at frontend kan vise dem som "Mine prosjekter" på Home.
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
PICKS_DIR = os.path.join(CACHE_DIR, "picks")


def run(params: dict[str, Any], dry_run: bool) -> None:
    projects = []
    if os.path.isdir(PICKS_DIR):
        for name in sorted(os.listdir(PICKS_DIR), reverse=True):
            if not name.endswith(".json"):
                continue
            path = os.path.join(PICKS_DIR, name)
            try:
                with open(path) as f:
                    data = json.load(f)
            except (OSError, json.JSONDecodeError):
                continue
            source = data.get("sourceVideo") or ""
            title = (
                data.get("timelineName")
                or os.path.splitext(os.path.basename(source))[0]
                or os.path.splitext(name)[0]
            ).replace("_", " ").strip()
            picks = data.get("picks") or []
            projects.append({
                "picksPath": path,
                "sourceVideo": source,
                "title": title,
                "savedAt": os.path.getmtime(path),
                "picksCount": len(picks),
            })
    bridge.result({"projects": projects})


if __name__ == "__main__":
    bridge.main_guard(run)

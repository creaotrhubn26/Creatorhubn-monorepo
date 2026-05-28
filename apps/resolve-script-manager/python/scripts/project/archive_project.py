"""Archive Project — copy last_highlight_picks.json til en per-prosjekt-fil
slik at neste extract ikke overskriver. Returnerer arkiv-pathen.

Input:
  sourceVideo:  absolute path til kildevideo (brukes for navngiving)

Output:
  archivePath:  full path til picks/<safe-name>_<timestamp>.json
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
PICKS_DIR = os.path.join(CACHE_DIR, "picks")
LAST_CACHE = os.path.join(CACHE_DIR, "last_highlight_picks.json")


def run(params: dict[str, Any], dry_run: bool) -> None:
    source_video = (params.get("sourceVideo") or "").strip()
    if not source_video:
        bridge.error("sourceVideo required")
        sys.exit(1)

    if not os.path.isfile(LAST_CACHE):
        bridge.error(f"Ingen picks-cache funnet på {LAST_CACHE}")
        sys.exit(1)

    os.makedirs(PICKS_DIR, exist_ok=True)
    base = os.path.splitext(os.path.basename(source_video))[0]
    safe = re.sub(r"[^\w-]+", "_", base)[:80]
    ts = time.strftime("%Y%m%d_%H%M%S")
    archive_path = os.path.join(PICKS_DIR, f"{safe}_{ts}.json")

    if dry_run:
        bridge.result({"wouldArchive": archive_path})
        return

    shutil.copy2(LAST_CACHE, archive_path)
    # Også oppdater archive-fil med sourceVideo-felt hvis ikke der
    try:
        with open(archive_path) as f:
            data = json.load(f)
        if not data.get("sourceVideo"):
            data["sourceVideo"] = source_video
            with open(archive_path, "w") as f:
                json.dump(data, f, indent=2)
    except (OSError, json.JSONDecodeError):
        pass

    bridge.log(f"Archived → {archive_path}")
    try:
        from activity_log import log_activity
        log_activity(source_video, "manual_edit", f"Prosjekt arkivert",
                     summary=os.path.basename(archive_path))
    except Exception:  # noqa: BLE001
        pass
    bridge.result({
        "archivePath": archive_path,
        "sourceVideo": source_video,
        "savedAt": time.time(),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

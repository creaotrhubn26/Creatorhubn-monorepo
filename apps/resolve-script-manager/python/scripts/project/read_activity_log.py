"""Read Activity Log — frontend kaller dette ved Home-mount for å merge
inn Python-loggede aktiviteter i localStorage.

Returnerer alle activity-entries fra activity_log.jsonl, sortert nyest
først.
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
LOG_PATH = os.path.join(CACHE_DIR, "activity_log.jsonl")


def run(params: dict[str, Any], dry_run: bool) -> None:
    entries: list[dict] = []
    if os.path.isfile(LOG_PATH):
        try:
            with open(LOG_PATH) as f:
                for line in f:
                    line = line.strip()
                    if not line: continue
                    try: entries.append(json.loads(line))
                    except json.JSONDecodeError: continue
        except OSError:
            pass
    entries.sort(key=lambda e: -(e.get("ts") or 0))
    bridge.result({"entries": entries[:200]})


if __name__ == "__main__":
    bridge.main_guard(run)

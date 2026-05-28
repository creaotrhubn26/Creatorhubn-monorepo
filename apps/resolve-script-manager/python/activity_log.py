"""Activity Log Helper — appends activity-entries til en JSONL-fil som
frontend leser ved Home-mount og merger inn i localStorage.

Brukes av alle scripts som ferdigstiller en jobb (extract, archive,
backup, timelines, qc, etc.) slik at terminal-runs OG wizard-runs får
synlig aktivitet i UI.
"""

from __future__ import annotations

import json
import os
import time

CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
LOG_PATH = os.path.join(CACHE_DIR, "activity_log.jsonl")
MAX_LINES = 500


def log_activity(source_video: str | None, kind: str, label: str,
                  summary: str | None = None, **meta) -> None:
    """Append én activity-entry. Kind matcher ActivityKind i projectActivity.ts."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    entry = {
        "ts": int(time.time() * 1000),
        "kind": kind,
        "label": label,
        "summary": summary,
        "sourceVideo": source_video,
        "meta": meta or None,
    }
    try:
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        # Trunc til MAX_LINES for å unngå at filen vokser uendelig
        try:
            with open(LOG_PATH) as f:
                lines = f.readlines()
            if len(lines) > MAX_LINES:
                with open(LOG_PATH, "w") as f:
                    f.writelines(lines[-MAX_LINES:])
        except OSError:
            pass
    except OSError:
        pass

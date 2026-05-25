"""Connect to Resolve — minimal smoke test that returns project + page info."""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    bridge.log("Attempting Resolve connection")
    if dry_run:
        bridge.result({"summary": "Dry run — would resolve scriptapp('Resolve') and read current project"})
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return

    info = {
        "currentPage": None,
        "projectName": None,
        "timelineCount": 0,
        "currentTimeline": None,
    }
    try:
        info["currentPage"] = conn.resolve.GetCurrentPage()
    except Exception as exc:
        bridge.warn(f"Could not read current page: {exc}")
    if conn.project:
        try:
            info["projectName"] = conn.project.GetName()
            info["timelineCount"] = conn.project.GetTimelineCount()
            current = conn.project.GetCurrentTimeline()
            if current:
                info["currentTimeline"] = current.GetName()
        except Exception as exc:
            bridge.warn(f"Project introspection failed: {exc}")
    bridge.result(info)


if __name__ == "__main__":
    bridge.main_guard(run)

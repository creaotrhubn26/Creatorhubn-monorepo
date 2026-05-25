"""Learn From My Edit — diff the current Resolve timeline against the last
auto-placement snapshot to capture Bjarne's manual editing decisions.

Use case: after Post Agent auto-builds a beat-cut timeline, Bjarne usually
tweaks it manually — swaps a clip he didn't like, trims a cut, reorders.
This script captures those deltas so future auto-placements can learn:

  - 'When energy demand was 0.2 and you placed clip X, I usually swap it
    for clip Y. Penalize clip X in low-energy contexts.'
  - 'You consistently shorten my 2-second cuts to 1.4s at the build-up.'
  - 'You replace 60% of my intro clips. Try different selection heuristics
    at low demand.'

This script:
  1. Reads last_auto_placement.json (from place_clips_on_beat_grid)
  2. Reads the current Resolve timeline's V1 items
  3. Pairs them up by recordFrame (= segment position) and computes deltas
  4. Appends one learning record to preferences/edits_<timestamp>.json
  5. Updates the aggregated preferences/profile.json with running stats

The aggregated profile is what future assign_clips_to_beats reads to bias
its choices (clip_preference_scores per clip_path + global curve shifts).

Input params: none (auto-detects from cache)
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
PREFERENCES_DIR = os.path.join(CACHE_DIR, "preferences")
PROFILE_PATH = os.path.join(PREFERENCES_DIR, "profile.json")


def _load_snapshot() -> dict:
    path = os.path.join(CACHE_DIR, "last_auto_placement.json")
    if not os.path.isfile(path):
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _load_profile() -> dict:
    if not os.path.isfile(PROFILE_PATH):
        return {
            "version": 1,
            "totalLearningSessions": 0,
            "clipPreferences": {},   # clipPath → { keeps: n, replacements: n, contexts: [...] }
            "energyCurveDeltas": {}, # segmentBin → avg(user_demand − auto_demand)
            "durationDeltas": {},    # segmentBin → avg(user_duration − auto_duration) seconds
        }
    try:
        with open(PROFILE_PATH) as f:
            data = json.load(f)
            # Backfill if older schema
            for key in ("clipPreferences", "energyCurveDeltas", "durationDeltas"):
                data.setdefault(key, {})
            data.setdefault("totalLearningSessions", 0)
            return data
    except (OSError, json.JSONDecodeError):
        return {"version": 1, "totalLearningSessions": 0,
                "clipPreferences": {}, "energyCurveDeltas": {}, "durationDeltas": {}}


def _save_profile(profile: dict) -> None:
    os.makedirs(PREFERENCES_DIR, exist_ok=True)
    with open(PROFILE_PATH, "w") as f:
        json.dump(profile, f, indent=2)


def _read_current_v1_items() -> list[dict]:
    """Return current Resolve timeline's V1 items as { name, path, start, end, durationSec }."""
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.project:
        return []
    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        return []
    try:
        fps = float(timeline.GetSetting("timelineFrameRate") or 24)
    except Exception:  # noqa: BLE001
        fps = 24.0
    try:
        start_offset = int(timeline.GetStartFrame() or 0)
    except Exception:  # noqa: BLE001
        start_offset = 0
    items = []
    try:
        v1 = timeline.GetItemListInTrack("video", 1) or []
        for it in v1:
            try:
                pool_item = it.GetMediaPoolItem()
                path = ""
                if pool_item:
                    try:
                        path = pool_item.GetClipProperty("File Path") or ""
                    except Exception:  # noqa: BLE001
                        path = ""
                start = it.GetStart()
                end = it.GetEnd()
                items.append({
                    "name": it.GetName(),
                    "path": path,
                    "startFrame": start,
                    "endFrame": end,
                    "startSec": (start - start_offset) / fps if fps > 0 else 0,
                    "durationSec": (end - start) / fps if fps > 0 else 0,
                })
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"Skipping item due to: {exc}")
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"GetItemListInTrack threw: {exc}")
    return items


def _bin_energy(demand: float | None) -> str:
    """Bucket energy demand 0..1 into named bins for delta tracking."""
    if demand is None:
        return "unknown"
    d = float(demand)
    if d < 0.20: return "intro"
    if d < 0.45: return "rise"
    if d < 0.75: return "build"
    if d <= 1.0: return "climax"
    return "outro"


def run(params: dict[str, Any], dry_run: bool) -> None:
    snapshot = _load_snapshot()
    if not snapshot.get("segments"):
        bridge.error(
            "Ingen auto-placement-snapshot funnet. Kjør Place on Beat Grid "
            "først, så rediger timeline, deretter Learn From My Edit."
        )
        sys.exit(1)

    current_items = _read_current_v1_items()
    if not current_items:
        bridge.error(
            "Fant ingen klipp på V1 i nåværende Resolve-timeline. Åpne timeline-en "
            "auto-placement laget og prøv igjen."
        )
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldCompare": {
                "snapshotSegments": len(snapshot["segments"]),
                "currentV1Items": len(current_items),
                "timeline": snapshot.get("timelineName"),
            }
        })
        return

    # Match current items to snapshot segments by closest startSec
    auto_segs = snapshot["segments"]
    matches: list[dict] = []
    unmatched_current = list(current_items)
    for auto_seg in auto_segs:
        auto_start = auto_seg.get("startSec") or 0
        best = None
        best_d = 999.0
        for cur in unmatched_current:
            d = abs(cur["startSec"] - auto_start)
            if d < best_d:
                best_d = d
                best = cur
        # Allow up to 3 seconds drift
        if best and best_d <= 3.0:
            matches.append({"auto": auto_seg, "user": best})
            unmatched_current.remove(best)
        else:
            matches.append({"auto": auto_seg, "user": None})

    kept = 0
    replaced = 0
    removed = 0
    moved = 0
    inserted_by_user = len(unmatched_current)

    for m in matches:
        a = m["auto"]
        u = m["user"]
        if not u:
            removed += 1
            continue
        if a.get("clipPath") and u.get("path") and a["clipPath"] == u["path"]:
            kept += 1
            if abs((u["startSec"] - (a.get("startSec") or 0))) > 0.05:
                moved += 1
        else:
            replaced += 1

    bridge.log(
        f"Diff: {kept} kept, {replaced} replaced, {removed} removed, "
        f"{moved} moved, {inserted_by_user} inserted by you"
    )

    # Update profile
    profile = _load_profile()
    profile["totalLearningSessions"] = profile.get("totalLearningSessions", 0) + 1

    for m in matches:
        a = m["auto"]
        u = m["user"]
        auto_path = a.get("clipPath")
        bin_name = _bin_energy(a.get("energyDemand"))
        if not auto_path:
            continue

        clip_pref = profile["clipPreferences"].setdefault(auto_path, {
            "keeps": 0, "replacements": 0, "contexts": []
        })
        if u and u.get("path") == auto_path:
            clip_pref["keeps"] += 1
        else:
            clip_pref["replacements"] += 1
        clip_pref["contexts"].append(bin_name)
        clip_pref["contexts"] = clip_pref["contexts"][-30:]  # bounded

        # Duration delta per bin
        if u and a.get("durationSec"):
            delta = (u["durationSec"] or 0) - a["durationSec"]
            bin_durations = profile["durationDeltas"].setdefault(bin_name, {"sum": 0, "count": 0})
            bin_durations["sum"] += delta
            bin_durations["count"] += 1

    # Save individual session record
    os.makedirs(PREFERENCES_DIR, exist_ok=True)
    session_path = os.path.join(
        PREFERENCES_DIR, f"edit_{int(time.time())}.json"
    )
    with open(session_path, "w") as f:
        json.dump({
            "savedAt": time.time(),
            "timelineName": snapshot.get("timelineName"),
            "kept": kept, "replaced": replaced, "removed": removed,
            "moved": moved, "insertedByUser": inserted_by_user,
            "matches": [
                {
                    "auto": m["auto"],
                    "user": m["user"],
                    "verdict": (
                        "kept" if (m["user"] and m["user"].get("path") == (m["auto"].get("clipPath") or ""))
                        else "replaced" if m["user"]
                        else "removed"
                    ),
                }
                for m in matches
            ],
            "userInserted": unmatched_current,
        }, f, indent=2)

    _save_profile(profile)

    # Compute current-most-replaced clips (= clips user dislikes)
    most_replaced = sorted(
        profile["clipPreferences"].items(),
        key=lambda kv: kv[1]["replacements"] - kv[1]["keeps"],
        reverse=True,
    )[:5]

    bridge.result({
        "totalSessions": profile["totalLearningSessions"],
        "kept": kept,
        "replaced": replaced,
        "removed": removed,
        "moved": moved,
        "insertedByUser": inserted_by_user,
        "sessionRecord": session_path,
        "profilePath": PROFILE_PATH,
        "mostReplacedClips": [
            {"path": p, "replacements": v["replacements"], "keeps": v["keeps"]}
            for p, v in most_replaced if v["replacements"] > v["keeps"]
        ],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

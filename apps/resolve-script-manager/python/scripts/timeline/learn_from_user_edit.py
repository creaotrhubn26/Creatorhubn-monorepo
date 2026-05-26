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
            "version": 2,
            "totalLearningSessions": 0,
            "clipPreferences": {},   # clipPath → { keeps: n, replacements: n, contexts: [...], replacementStreak: n }
            "energyCurveDeltas": {}, # segmentBin → avg(user_demand − auto_demand)
            "durationDeltas": {},    # segmentBin → avg(user_duration − auto_duration) seconds
            "blacklist": [],         # clipPaths the user keeps rejecting (3x consecutive replacement)
        }
    try:
        with open(PROFILE_PATH) as f:
            data = json.load(f)
            for key in ("clipPreferences", "energyCurveDeltas", "durationDeltas"):
                data.setdefault(key, {})
            data.setdefault("totalLearningSessions", 0)
            data.setdefault("blacklist", [])
            data.setdefault("version", 2)
            return data
    except (OSError, json.JSONDecodeError):
        return {"version": 2, "totalLearningSessions": 0,
                "clipPreferences": {}, "energyCurveDeltas": {},
                "durationDeltas": {}, "blacklist": []}


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

    # Structured per-decision log (#44) — same info as the verdict in
    # session-record but in line-by-line log form for live progress reading.
    bridge.log("─── DECISIONS (auto pick → user verdict) ───")
    for idx, m in enumerate(matches):
        a = m["auto"]
        u = m["user"]
        auto_clip = os.path.basename(a.get("clipPath") or "?")
        bin_name = _bin_energy(a.get("energyDemand"))
        if not u:
            verdict = "REMOVED"
            details = ""
            removed += 1
        elif a.get("clipPath") and u.get("path") and a["clipPath"] == u["path"]:
            verdict = "KEPT"
            kept += 1
            if abs((u["startSec"] - (a.get("startSec") or 0))) > 0.05:
                verdict = "KEPT_MOVED"
                moved += 1
            details = f" dur {a.get('durationSec', 0):.1f}s → {u.get('durationSec', 0):.1f}s"
        else:
            verdict = "REPLACED"
            replaced += 1
            user_clip = os.path.basename(u.get("path") or "?")
            details = f" → {user_clip}"
        bridge.log(f"  [{idx:02d}] {bin_name:6s} {auto_clip:30s} {verdict}{details}")

    bridge.log(
        f"Summary: {kept} kept, {replaced} replaced, {removed} removed, "
        f"{moved} moved, {inserted_by_user} inserted by you"
    )

    # Update profile
    profile = _load_profile()
    profile["totalLearningSessions"] = profile.get("totalLearningSessions", 0) + 1

    blacklist_set: set[str] = set(profile.get("blacklist", []))
    newly_blacklisted: list[str] = []

    for m in matches:
        a = m["auto"]
        u = m["user"]
        auto_path = a.get("clipPath")
        bin_name = _bin_energy(a.get("energyDemand"))
        if not auto_path:
            continue

        clip_pref = profile["clipPreferences"].setdefault(auto_path, {
            "keeps": 0, "replacements": 0, "contexts": [],
            "replacementStreak": 0,
        })
        clip_pref.setdefault("replacementStreak", 0)
        if u and u.get("path") == auto_path:
            clip_pref["keeps"] += 1
            clip_pref["replacementStreak"] = 0  # reset on keep
        else:
            clip_pref["replacements"] += 1
            clip_pref["replacementStreak"] += 1
            # #50: auto-blacklist after 3 consecutive replacements
            if (clip_pref["replacementStreak"] >= 3
                    and auto_path not in blacklist_set):
                blacklist_set.add(auto_path)
                newly_blacklisted.append(auto_path)
                bridge.log(
                    f"  ⛔ BLACKLISTED {os.path.basename(auto_path)} "
                    f"({clip_pref['replacementStreak']} consecutive replacements)"
                )
        clip_pref["contexts"].append(bin_name)
        clip_pref["contexts"] = clip_pref["contexts"][-30:]

        # Duration delta per bin
        if u and a.get("durationSec"):
            delta = (u["durationSec"] or 0) - a["durationSec"]
            bin_durations = profile["durationDeltas"].setdefault(bin_name, {"sum": 0, "count": 0})
            bin_durations["sum"] += delta
            bin_durations["count"] += 1

    profile["blacklist"] = sorted(blacklist_set)

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

    # #49: write a human-readable markdown report next to the JSON session
    md_path = _write_markdown_report(
        session_path, snapshot, matches, kept, replaced, removed, moved,
        inserted_by_user, unmatched_current, newly_blacklisted, profile,
        most_replaced,
    )

    bridge.result({
        "totalSessions": profile["totalLearningSessions"],
        "kept": kept,
        "replaced": replaced,
        "removed": removed,
        "moved": moved,
        "insertedByUser": inserted_by_user,
        "sessionRecord": session_path,
        "markdownReport": md_path,
        "profilePath": PROFILE_PATH,
        "newlyBlacklisted": newly_blacklisted,
        "totalBlacklisted": len(profile["blacklist"]),
        "mostReplacedClips": [
            {"path": p, "replacements": v["replacements"], "keeps": v["keeps"]}
            for p, v in most_replaced if v["replacements"] > v["keeps"]
        ],
    })


def _write_markdown_report(session_path: str, snapshot: dict, matches: list,
                           kept: int, replaced: int, removed: int, moved: int,
                           inserted_by_user: int, unmatched_current: list,
                           newly_blacklisted: list[str], profile: dict,
                           most_replaced: list) -> str:
    """Generate a human-readable markdown summary of what the system learned.
    Useful for spot-checking that the learning loop captured what the user
    actually did, and for reviewing the profile evolution over time."""
    md_path = session_path.replace(".json", ".md")
    total = kept + replaced + removed
    keep_pct = (kept / total * 100) if total else 0
    replace_pct = (replaced / total * 100) if total else 0
    lines: list[str] = []
    lines.append(f"# Learning session — {snapshot.get('timelineName', 'unnamed')}")
    lines.append("")
    lines.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"Session #: {profile['totalLearningSessions']}")
    lines.append(f"Project: {snapshot.get('projectName', '?')}")
    lines.append("")
    lines.append("## Outcome")
    lines.append("")
    lines.append(f"- ✅ Kept: **{kept}** ({keep_pct:.0f}%)")
    lines.append(f"- 🔁 Replaced: **{replaced}** ({replace_pct:.0f}%)")
    lines.append(f"- 🗑 Removed: **{removed}**")
    lines.append(f"- ↔ Moved (kept clip, different position): **{moved}**")
    lines.append(f"- ➕ Inserted by you (not in auto-placement): **{inserted_by_user}**")
    lines.append("")
    if newly_blacklisted:
        lines.append("## ⛔ Newly blacklisted clips (3x consecutive replacement)")
        lines.append("")
        for path in newly_blacklisted:
            lines.append(f"- `{os.path.basename(path)}`")
        lines.append("")
        lines.append("_These clips will be filtered out of future auto-placements._")
        lines.append("")
    lines.append("## Per-segment decisions")
    lines.append("")
    lines.append("| # | Energy bin | Auto pick | Verdict |")
    lines.append("|---|------------|-----------|---------|")
    for idx, m in enumerate(matches):
        a = m["auto"]
        u = m["user"]
        bin_name = _bin_energy(a.get("energyDemand"))
        auto_clip = os.path.basename(a.get("clipPath") or "?")
        if not u:
            verdict = "🗑 removed"
        elif a.get("clipPath") == (u.get("path") or ""):
            if abs((u["startSec"] - (a.get("startSec") or 0))) > 0.05:
                verdict = "↔ moved"
            else:
                verdict = "✅ kept"
        else:
            verdict = f"🔁 → `{os.path.basename(u.get('path') or '?')}`"
        lines.append(f"| {idx} | {bin_name} | `{auto_clip}` | {verdict} |")
    if unmatched_current:
        lines.append("")
        lines.append("## You inserted these (not in auto-placement)")
        lines.append("")
        for u in unmatched_current[:20]:
            lines.append(
                f"- `{u.get('name', '?')}` at {u.get('startSec', 0):.1f}s "
                f"(dur {u.get('durationSec', 0):.1f}s)"
            )
    lines.append("")
    lines.append("## Profile state after this session")
    lines.append("")
    lines.append(f"- Total learning sessions: **{profile['totalLearningSessions']}**")
    lines.append(f"- Clips with history: **{len(profile['clipPreferences'])}**")
    lines.append(f"- Total blacklist: **{len(profile['blacklist'])}**")
    if most_replaced:
        lines.append("")
        lines.append("### Top 5 most-replaced clips (replacements − keeps)")
        lines.append("")
        for path, stats in most_replaced[:5]:
            delta = stats["replacements"] - stats["keeps"]
            lines.append(
                f"- `{os.path.basename(path)}` — "
                f"{stats['keeps']} keeps, {stats['replacements']} replacements (Δ {delta:+d})"
            )
    lines.append("")
    try:
        with open(md_path, "w") as f:
            f.write("\n".join(lines))
        bridge.log(f"Markdown report: {md_path}")
    except OSError as exc:
        bridge.warn(f"Could not write markdown report: {exc}")
        return ""
    return md_path


if __name__ == "__main__":
    bridge.main_guard(run)

"""Assign Clips to Beats — produces a beat-grid plan for music-video assembly.

Given a list of beat timestamps + a list of culled+scored clips, this script
decides which clip plays during each beat-segment. Uses a simple "energy-matched"
strategy: high-highlight-score clips land on downbeats / drops, lower-scored
clips fill the intro/outro. Clips longer than a single beat are placed once,
clips shorter than a segment are repeated or stretched (downstream choice).

Why this is its own step (not inside place_clips_on_beat_grid):
The assignment is pure logic — no Resolve API. Keeping it separate makes it
unit-testable and lets the UI preview the plan before committing to the
timeline (future feature: "Preview beat plan").

Params:
  beats:              [seconds, ...] from detect_music_beats
  downbeats:          [seconds, ...] from detect_music_beats (optional)
  session:            cull session with .decisions[] (from cull_folder)
  segmentBeats:       group N beats per cut (default 4 = one bar in 4/4)
  preferDownbeatCuts: if True, only cut on downbeats (default True)

Output:
  segments: [{
    startSec, endSec, durationSec,
    clipPath, clipName, qualityScore, highlightScore,
    energyRank, segmentIndex,
  }, ...]
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _kept_decisions_sorted(session: dict) -> list[dict]:
    """Return clips with decision=='keep', sorted by energy (highlightScore desc,
    qualityScore desc, then name for stability)."""
    decisions = (session or {}).get("decisions", []) or []
    kept = [d for d in decisions if d.get("decision") == "keep"]
    if not kept:
        # Fallback: include "maybe" if nothing was kept (otherwise empty timeline)
        kept = [d for d in decisions if d.get("decision") in ("keep", "maybe")]
    kept.sort(
        key=lambda d: (
            -(d.get("highlightScore") or 0),
            -(d.get("qualityScore") or 0),
            d.get("clipName") or "",
        )
    )
    return kept


def _build_segments(beats: list[float], segment_beats: int, prefer_downbeats: bool, downbeats: list[float]) -> list[tuple[float, float]]:
    """Return [(start_sec, end_sec), ...] — one entry per cut-segment."""
    if not beats:
        return []
    if prefer_downbeats and downbeats and len(downbeats) >= 2:
        cuts = downbeats
    else:
        # Walk beats with stride=segment_beats
        cuts = beats[::segment_beats]
    # Append final beat as the last endpoint so we close the timeline
    if cuts and cuts[-1] < beats[-1]:
        cuts = cuts + [beats[-1]]
    segments = []
    for i in range(len(cuts) - 1):
        segments.append((cuts[i], cuts[i + 1]))
    return segments


def _load_cached_beat_session() -> dict:
    """Fallback: read the last detect_music_beats result from disk so workflow
    steps can be run independently in the Tauri UI without manually re-passing
    the beats[] array."""
    import json as _json
    cache_path = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_beat_session.json"
    )
    if not os.path.isfile(cache_path):
        return {}
    try:
        with open(cache_path) as f:
            return _json.load(f)
    except (OSError, _json.JSONDecodeError):
        return {}


def _load_latest_cull_session() -> dict:
    """Fallback: find the most-recent cull session JSON saved by the Tauri
    save_cull_session command. Lets this step run independently after a
    Magic Cut without manually pasting the session JSON."""
    import json as _json
    sessions_dir = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/cull_sessions"
    )
    if not os.path.isdir(sessions_dir):
        return {}
    try:
        candidates = []
        for fn in os.listdir(sessions_dir):
            if not fn.endswith(".json"):
                continue
            path = os.path.join(sessions_dir, fn)
            try:
                candidates.append((os.path.getmtime(path), path))
            except OSError:
                continue
        if not candidates:
            return {}
        candidates.sort(reverse=True)
        with open(candidates[0][1]) as f:
            return _json.load(f)
    except (OSError, _json.JSONDecodeError):
        return {}


def run(params: dict[str, Any], dry_run: bool) -> None:
    beats: list[float] = params.get("beats") or []
    downbeats: list[float] = params.get("downbeats") or []
    session: dict = params.get("session") or {}
    segment_beats = int(params.get("segmentBeats") or 4)
    prefer_downbeats = bool(params.get("preferDownbeatCuts", True))

    if not beats:
        cached = _load_cached_beat_session()
        if cached.get("beats"):
            beats = cached["beats"]
            downbeats = downbeats or cached.get("downbeats") or []
            bridge.log(
                f"Using cached beat session from detect_music_beats "
                f"({len(beats)} beats, {cached.get('bpm', '?')} BPM, "
                f"from {os.path.basename(cached.get('musicPath', '?'))})"
            )

    if not beats:
        bridge.error(
            "beats[] is required — run detect_music_beats first. "
            "If this is auto_rough_cut, ensure detect_music_beats step ran successfully."
        )
        sys.exit(1)

    if not session or not session.get("decisions"):
        cached_session = _load_latest_cull_session()
        if cached_session.get("decisions"):
            session = cached_session
            n_keeps = sum(1 for d in session["decisions"] if d.get("decision") == "keep")
            bridge.log(
                f"Using latest cull session ({n_keeps} keeps from "
                f"{os.path.basename(session.get('sourcePath', '?'))})"
            )

    if not session or not session.get("decisions"):
        bridge.error("session.decisions[] is required — run cull_folder first.")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldAssign": True,
            "beatCount": len(beats),
            "clipCount": len([d for d in session["decisions"] if d.get("decision") == "keep"]),
        })
        return

    kept = _kept_decisions_sorted(session)
    if not kept:
        bridge.error("No clips marked 'keep' (or 'maybe') in the cull session.")
        sys.exit(1)

    segments = _build_segments(beats, segment_beats, prefer_downbeats, downbeats)
    if not segments:
        bridge.error("Could not derive any cut-segments from the beat grid.")
        sys.exit(1)

    bridge.log(
        f"Mapping {len(kept)} clips across {len(segments)} segments "
        f"(beat stride: {segment_beats}, prefer downbeats: {prefer_downbeats})"
    )

    # Strategy: rank-1 clip → highest-energy segment; rank-N → lowest-energy.
    # Highest-energy segments are typically the middle (build → drop), so we
    # interleave the sort: alternate around the centre to put best clips on
    # downbeats nearer the middle.
    n = len(segments)
    indices = []
    # Build [mid, mid-1, mid+1, mid-2, mid+2, ...] sequence
    mid = n // 2
    for offset in range(n):
        if offset % 2 == 0:
            target = mid + offset // 2
        else:
            target = mid - (offset // 2 + 1)
        if 0 <= target < n:
            indices.append(target)
    indices = indices[:n]

    # Round-robin clips if we have fewer than segments
    assignments: list[dict] = [{} for _ in range(n)]
    for energy_rank, seg_idx in enumerate(indices):
        clip = kept[energy_rank % len(kept)]
        start_sec, end_sec = segments[seg_idx]
        assignments[seg_idx] = {
            "segmentIndex": seg_idx,
            "startSec": round(start_sec, 3),
            "endSec": round(end_sec, 3),
            "durationSec": round(end_sec - start_sec, 3),
            "clipPath": clip.get("clipPath"),
            "clipName": clip.get("clipName"),
            "qualityScore": clip.get("qualityScore"),
            "highlightScore": clip.get("highlightScore"),
            "energyRank": energy_rank,
        }
        bridge.progress(energy_rank, n, f"Assigning clip {energy_rank + 1}/{n}")

    result = {
        "segments": assignments,
        "totalSegments": n,
        "uniqueClipsUsed": len({a.get("clipPath") for a in assignments if a.get("clipPath")}),
        "averageSegmentDurationSec": round(
            sum(a["durationSec"] for a in assignments) / max(1, n), 3
        ),
    }

    # Cache for place_clips_on_beat_grid to pick up (no UI piping yet)
    try:
        import json as _json, time as _time
        cache_dir = os.path.expanduser(
            "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
        )
        os.makedirs(cache_dir, exist_ok=True)
        cache_path = os.path.join(cache_dir, "last_beat_assignments.json")
        with open(cache_path, "w") as f:
            _json.dump({"savedAt": _time.time(), **result}, f)
        bridge.log(f"Cached beat assignments → {cache_path}")
    except OSError as exc:
        bridge.warn(f"Could not cache assignments: {exc}")

    bridge.result(result)


if __name__ == "__main__":
    bridge.main_guard(run)

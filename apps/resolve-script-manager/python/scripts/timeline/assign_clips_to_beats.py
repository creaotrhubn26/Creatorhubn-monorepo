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


def _probe_motion_score(ffmpeg: str, video_path: str, sample_seconds: float = 5.0) -> float | None:
    """Quick motion score via ffmpeg scdet — average per-frame scene-change
    delta over the first N seconds. Higher = more visual motion/cuts within
    the shot. Returns 0..1 (None on probe failure).
    """
    import re, subprocess
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-y",
        "-t", f"{sample_seconds:.1f}",
        "-i", video_path,
        "-vf", "scdet=threshold=0:sc_pass=0",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        deltas = [float(m) for m in re.findall(r"lavfi\.scd\.mafd=([\d.]+)", r.stderr)]
        if not deltas:
            return None
        avg = sum(deltas) / len(deltas)
        return min(1.0, avg / 30.0)
    except Exception:  # noqa: BLE001
        return None


def _ensure_motion_scores(decisions: list[dict]) -> None:
    """Populate 'motionScore' on each decision in-place (best-effort). Uses
    ffmpeg scdet on the first 5 seconds. Skips entries that already have it,
    so this only pays the probe cost once per cull session."""
    import shutil
    ffmpeg = (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
        or shutil.which("ffmpeg")
        or "/opt/homebrew/bin/ffmpeg"
    )
    if not os.path.isfile(ffmpeg):
        bridge.warn("ffmpeg not found — skipping motion probe (intro selection will fall back to duration heuristic)")
        return
    needed = [d for d in decisions if "motionScore" not in d and d.get("clipPath")]
    if not needed:
        return
    bridge.log(f"Probing motion-score for {len(needed)} clips (~5s sample each)…")
    for i, d in enumerate(needed):
        path = d.get("clipPath")
        if not path or not os.path.isfile(path):
            d["motionScore"] = None
            continue
        d["motionScore"] = _probe_motion_score(ffmpeg, path)
        if (i + 1) % 10 == 0:
            bridge.progress(i + 1, len(needed), f"Motion-score {i+1}/{len(needed)}")


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


def _synthesize_session_from_resolve() -> dict:
    """When no cull session exists, build a synthetic 'all-keeps' session
    from the currently-open Resolve project's Media Pool. Lets the
    music-video workflow run on a freshly-imported batch without a cull step.
    """
    try:
        conn = bridge.ResolveConnection()
        if not conn.connect() or not conn.project:
            return {}
        media_pool = conn.project.GetMediaPool()
        if not media_pool:
            return {}

        decisions = []
        seen_paths: set[str] = set()

        def _walk(folder):
            try:
                for clip in folder.GetClipList() or []:
                    try:
                        path = clip.GetClipProperty("File Path") or ""
                        name = clip.GetName() or ""
                        if not path or path in seen_paths:
                            continue
                        ext = os.path.splitext(path)[1].lower()
                        if ext not in {".mp4", ".mov", ".mxf", ".mts", ".m2ts", ".avi", ".mkv", ".m4v", ".braw"}:
                            continue
                        seen_paths.add(path)
                        try:
                            duration_str = clip.GetClipProperty("Duration") or ""
                        except Exception:  # noqa: BLE001
                            duration_str = ""
                        decisions.append({
                            "clipPath": path,
                            "clipName": name,
                            "decision": "keep",
                            "scene": None,
                            "durationSeconds": _parse_duration_string(duration_str),
                        })
                    except Exception:  # noqa: BLE001
                        continue
                for sub in folder.GetSubFolderList() or []:
                    _walk(sub)
            except Exception:  # noqa: BLE001
                pass

        _walk(media_pool.GetRootFolder())
        if not decisions:
            return {}
        return {
            "sourcePath": "(Resolve Media Pool)",
            "decisions": decisions,
            "synthesized": True,
        }
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Resolve fallback failed: {exc}")
        return {}


def _parse_duration_string(s: str) -> float | None:
    """Parse Resolve's duration string 'HH:MM:SS:FF' or 'HH:MM:SS.mmm' → seconds."""
    if not s:
        return None
    try:
        parts = s.replace(".", ":").split(":")
        if len(parts) == 4:
            h, m, sec, frames = parts
            return int(h) * 3600 + int(m) * 60 + int(sec) + int(frames) / 25.0
        if len(parts) == 3:
            h, m, sec = parts
            return int(h) * 3600 + int(m) * 60 + float(sec)
    except (ValueError, AttributeError):
        pass
    return None


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
        # Last-resort fallback: scan the currently-open Resolve project's
        # Media Pool for video clips and synthesize an all-keeps session.
        # Useful for music-video workflow that doesn't include a cull step.
        synthesized = _synthesize_session_from_resolve()
        if synthesized.get("decisions"):
            session = synthesized
            bridge.log(
                f"No cull session — using {len(session['decisions'])} clips from "
                f"current Resolve project's Media Pool"
            )

    if not session or not session.get("decisions"):
        bridge.error(
            "Trenger klipp å bruke på beat-gridet. Enten: (1) kjør cull_folder/Magic Cut først, "
            "ELLER (2) åpne et Resolve-prosjekt med klipp i Media Pool."
        )
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

    # Probe motion-scores so we can sort clips by visual energy.
    # Calm clips → intro/outro. Energetic clips → climax.
    _ensure_motion_scores(kept)

    segments = _build_segments(beats, segment_beats, prefer_downbeats, downbeats)
    if not segments:
        bridge.error("Could not derive any cut-segments from the beat grid.")
        sys.exit(1)

    bridge.log(
        f"Mapping {len(kept)} clips across {len(segments)} segments "
        f"(beat stride: {segment_beats}, prefer downbeats: {prefer_downbeats})"
    )

    # ─── Energy-curve assignment ─────────────────────────────────────────
    # Build a per-segment "energy demand" curve: low at start (intro), peaks
    # around 60-70% (climax / drop), tapers at end (outro). Each segment's
    # demand value is in [0..1].
    n = len(segments)

    def _energy_demand(seg_idx: int) -> float:
        # Smooth-step easing: starts flat-low, rises to peak around 0.65, falls
        x = seg_idx / max(1, n - 1)
        # Curve: 0 → 0.35 → 1.0 → 0.4 → 0
        if x < 0.15:
            return 0.05 + (x / 0.15) * 0.25         # intro 0.05 → 0.30
        if x < 0.65:
            return 0.30 + ((x - 0.15) / 0.50) * 0.70  # rise 0.30 → 1.00
        if x < 0.90:
            return 1.0 - ((x - 0.65) / 0.25) * 0.55   # peak fall 1.00 → 0.45
        return 0.45 - ((x - 0.90) / 0.10) * 0.35      # outro 0.45 → 0.10

    # Rank clips by motion-score (None falls to average so we don't penalize
    # unknowns). Tie-break on highlightScore + qualityScore.
    def _clip_energy(c: dict) -> float:
        m = c.get("motionScore")
        if m is None:
            return 0.5
        return float(m)

    # For each segment, find the clip whose energy best matches the demand.
    # Avoid using the same clip twice in a row if we have enough variety.
    available = list(kept)
    assignments: list[dict] = [{} for _ in range(n)]
    recent_clips: list[str] = []  # rolling window to avoid back-to-back repeats

    for seg_idx in range(n):
        if not available:
            available = list(kept)  # exhaustion: allow reuse
        demand = _energy_demand(seg_idx)
        # Sort available by absolute distance from demand
        scored = sorted(
            available,
            key=lambda c: (
                abs(_clip_energy(c) - demand),
                -(c.get("highlightScore") or 0),
                -(c.get("qualityScore") or 0),
            ),
        )
        # Skip last 3 used clips when possible
        pick = None
        for cand in scored:
            if cand.get("clipPath") not in recent_clips[-3:]:
                pick = cand
                break
        if pick is None:
            pick = scored[0]
        recent_clips.append(pick.get("clipPath"))

        start_sec, end_sec = segments[seg_idx]
        clip = pick
        assignments[seg_idx] = {
            "segmentIndex": seg_idx,
            "startSec": round(start_sec, 3),
            "endSec": round(end_sec, 3),
            "durationSec": round(end_sec - start_sec, 3),
            "clipPath": clip.get("clipPath"),
            "clipName": clip.get("clipName"),
            "qualityScore": clip.get("qualityScore"),
            "highlightScore": clip.get("highlightScore"),
            "motionScore": clip.get("motionScore"),
            "energyDemand": round(demand, 3),
        }
        bridge.progress(seg_idx, n, f"Assigning clip {seg_idx + 1}/{n} (demand {demand:.2f})")

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

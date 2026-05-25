"""Extract Highlight from Film — takes a long edited/exported wedding (or any
narrative) film and builds a highlight-reel timeline at >= the requested
minimum duration.

Workflow:
  1. ffmpeg scene-detect → list of shot boundaries in the source video
  2. Per shot: compute motion score (scdet/mafd) + audio energy (RMS)
     + duration weight (avoid very-short flash cuts)
  3. Score each shot — weighted combination
  4. Greedily pick highest-scoring shots until total duration >= minDurationSec
     (NOT longer than maxDurationSec)
  5. Sort picks back into chronological order (preserves narrative arc)
  6. Build a Resolve timeline that imports the source video + places the
     picked shots sequentially via AppendToTimeline (mediaType omitted so
     linked audio comes along)

Result: a 4-6 minute highlight built from the best moments of the long film,
in chronological order, ready for refinement.

Input params:
  videoPath:        absolute path to the source film (required)
  minDurationSec:   minimum highlight duration (default 240 = 4 min)
  maxDurationSec:   hard cap (default minDurationSec + 60 = 5 min)
  sceneThreshold:   ffmpeg scene-detect sensitivity (default 0.4)
  timelineName:     name for the new Resolve timeline (default '<basename> — highlight')
  audioWeight:      0..1 — how much audio energy contributes to score (default 0.4)
  motionWeight:     0..1 — how much motion contributes (default 0.6)
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

# Allow `signals` + `genre_weights` to be imported as top-level packages
# from inside scripts/timeline/, which is where this script lives.
_TIMELINE_DIR = os.path.dirname(os.path.abspath(__file__))
if _TIMELINE_DIR not in sys.path:
    sys.path.insert(0, _TIMELINE_DIR)

import signals as _signals_pkg  # noqa: E402
import genre_weights  # noqa: E402


SIDECAR_FFMPEG_PATHS = (
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
)
PTS_RE = re.compile(r"pts_time:([\d.]+)")


def find_ffmpeg() -> tuple[str | None, str | None]:
    env = os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG")
    if env and os.path.isfile(env):
        probe = env.replace("ffmpeg", "ffprobe")
        if os.path.isfile(probe):
            return env, probe
    ffm = shutil.which("ffmpeg")
    ffp = shutil.which("ffprobe")
    if ffm and ffp:
        return ffm, ffp
    for c in SIDECAR_FFMPEG_PATHS:
        if os.path.isfile(c):
            p = c.replace("ffmpeg", "ffprobe")
            if os.path.isfile(p):
                return c, p
    return None, None


def probe_duration_fps(ffprobe: str, path: str) -> tuple[float, float]:
    try:
        r = subprocess.run(
            [
                ffprobe, "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=r_frame_rate:format=duration",
                "-of", "json", path,
            ],
            capture_output=True, text=True, timeout=20,
        )
        data = json.loads(r.stdout or "{}")
    except Exception:  # noqa: BLE001
        return 0.0, 25.0
    stream = (data.get("streams") or [{}])[0]
    rate = stream.get("r_frame_rate", "25/1")
    try:
        num, den = rate.split("/")
        fps = float(num) / float(den) if float(den) > 0 else 25.0
    except (ValueError, ZeroDivisionError):
        fps = 25.0
    duration = float((data.get("format") or {}).get("duration") or 0.0)
    return duration, fps


def detect_cuts(ffmpeg: str, path: str, threshold: float) -> list[float]:
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-i", path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-an", "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        return sorted({float(m) for m in PTS_RE.findall(proc.stderr)})
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"detect_cuts failed: {exc}")
        return []


def shot_motion_score(ffmpeg: str, video: str, start: float, end: float) -> float:
    duration = max(0.05, end - start)
    cmd = [
        ffmpeg, "-hide_banner", "-nostats", "-y",
        "-ss", f"{start:.3f}",
        "-t", f"{duration:.3f}",
        "-i", video,
        "-vf", "scale=160:90,scdet=threshold=0:sc_pass=0",
        "-an", "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        deltas = [float(m) for m in re.findall(r"lavfi\.scd\.mafd=([\d.]+)", r.stderr)]
        if not deltas:
            return 0.0
        avg = sum(deltas) / len(deltas)
        return min(1.0, avg / 30.0)
    except Exception:  # noqa: BLE001
        return 0.0


def shot_audio_energy(ffmpeg: str, video: str, start: float, end: float) -> float:
    duration = max(0.05, end - start)
    cmd = [
        ffmpeg, "-hide_banner", "-nostats",
        "-ss", f"{start:.3f}",
        "-t", f"{duration:.3f}",
        "-i", video,
        "-vn", "-af", "volumedetect",
        "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        m = re.search(r"mean_volume: ([-\d.]+) dB", r.stderr)
        if not m:
            return 0.0
        db = float(m.group(1))
        # Map -60..0 dB to 0..1; clamp
        return max(0.0, min(1.0, (db + 60) / 60))
    except Exception:  # noqa: BLE001
        return 0.0


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' is not a file")
        sys.exit(1)

    try:
        min_dur = float(params.get("minDurationSec") or 240)
        max_dur = float(params.get("maxDurationSec") or min_dur + 60)
        threshold = float(params.get("sceneThreshold") or 0.4)
        audio_w = float(params.get("audioWeight") or 0.4)
        motion_w = float(params.get("motionWeight") or 0.6)
        start_offset = float(params.get("startOffsetSec") or 0)
        end_offset = float(params.get("endOffsetSec") or 0)  # 0 = use full length
    except (TypeError, ValueError):
        min_dur, max_dur, threshold, audio_w, motion_w = 240.0, 300.0, 0.4, 0.4, 0.6
        start_offset = end_offset = 0.0

    timeline_name = (params.get("timelineName") or "").strip() or (
        f"{os.path.splitext(os.path.basename(video_path))[0]} — highlight"
    )
    # When True, script stops after computing picks + extracting thumbnails.
    # User reviews/adjusts via the Tauri UI, then build_highlight_from_picks
    # is run to finalize the Resolve timeline.
    review_mode = bool(params.get("interactiveReview"))

    # Genre selection (#21) — controls signal weights + chapter targets
    genre_name = (params.get("genre") or "wedding").strip()
    genre_cfg = genre_weights.get(genre_name)
    use_signals = bool(params.get("useSignals", True))
    bridge.log(f"Genre: {genre_name} — {genre_cfg['description']}")

    ffmpeg, ffprobe = find_ffmpeg()
    if not ffmpeg or not ffprobe:
        bridge.error("ffmpeg/ffprobe not on PATH — install via Dependencies modal")
        sys.exit(1)

    bridge.progress(0, 100, "Probing video metadata…")
    duration, fps = probe_duration_fps(ffprobe, video_path)
    if duration < min_dur:
        bridge.error(
            f"Source film is {duration:.0f}s but minimum highlight is {min_dur:.0f}s — "
            "can't extract more than the source contains."
        )
        sys.exit(1)
    bridge.log(f"Source: {duration:.0f}s @ {fps} fps")

    # Apply source-range constraints if given
    effective_end = duration
    if end_offset > 0 and end_offset < duration:
        effective_end = end_offset
    if start_offset > 0 and start_offset < effective_end:
        bridge.log(f"Analyzing source range {start_offset:.1f}s → {effective_end:.1f}s "
                   f"({effective_end - start_offset:.1f}s of {duration:.1f}s total)")
    elif end_offset > 0:
        bridge.log(f"Analyzing source range 0.0s → {effective_end:.1f}s")

    bridge.progress(10, 100, "Detecting shot cuts…")
    cuts = detect_cuts(ffmpeg, video_path, threshold)
    if not cuts or cuts[0] > 0.05:
        cuts = [0.0] + cuts
    shots_raw = [(cuts[i], cuts[i + 1] if i + 1 < len(cuts) else duration) for i in range(len(cuts))]
    # Filter to the requested source range + drop ultra-short flash cuts
    shots = []
    for s, e in shots_raw:
        if e <= start_offset or s >= effective_end:
            continue
        clipped_s = max(s, start_offset)
        clipped_e = min(e, effective_end)
        if (clipped_e - clipped_s) >= 0.4:
            shots.append((clipped_s, clipped_e))
    bridge.log(f"Detected {len(shots)} shots in selected range (after filtering)")

    if not shots:
        bridge.error("No usable shots after cut detection")
        sys.exit(1)

    bridge.progress(20, 100, "Scoring each shot (motion + audio)…")
    shot_scores: list[dict] = []
    for i, (start, end) in enumerate(shots):
        motion = shot_motion_score(ffmpeg, video_path, start, end)
        audio = shot_audio_energy(ffmpeg, video_path, start, end)
        shot_dur = end - start
        # Length bonus: reward 1-6s shots, lightly penalize very long static ones
        length_factor = 1.0 if 1.0 <= shot_dur <= 6.0 else (0.7 if shot_dur < 1.0 else 0.85)
        base_score = (motion * motion_w + audio * audio_w) * length_factor
        shot_scores.append({
            "index": i,
            "startSec": round(start, 3),
            "endSec": round(end, 3),
            "durationSec": round(shot_dur, 3),
            "motion": round(motion, 3),
            "audio": round(audio, 3),
            "baseScore": round(base_score, 4),
            "score": round(base_score, 4),  # may be augmented below
            "signals": {},  # populated by signal pipeline
        })
        if (i + 1) % 10 == 0:
            bridge.progress(20 + int(35 * (i + 1) / len(shots)), 100, f"Scored {i + 1}/{len(shots)}")

    # ─── Signal pipeline (#15–#25) ─────────────────────────────────────────
    chapter_labels: dict[int, str] = {}
    signal_outputs: dict[str, dict[int, float]] = {}
    if use_signals:
        bridge.progress(55, 100, "Running advanced signals…")
        avail = _signals_pkg.available_signals(logger=lambda m: bridge.log(f"  {m}"))
        # Compute chapter labels FIRST (used for representation guarantee below)
        if "chapters" in avail:
            try:
                chapters_mod = avail["chapters"]
                chapter_labels = chapters_mod.compute_chapter_labels(
                    ffmpeg, video_path, shots, duration,
                    n_chapters=3 if genre_name == "wedding" else 3,
                )
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"chapters signal failed: {exc}")
        # Run remaining signals
        shot_tuples = [(s["startSec"], s["endSec"]) for s in shot_scores]
        weights = genre_cfg["weights"]
        for sig_name, mod in avail.items():
            if sig_name == "chapters":
                continue
            try:
                signal_outputs[sig_name] = mod.compute(ffmpeg, ffprobe, video_path, shot_tuples)
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"signal '{sig_name}' raised: {exc}")
                signal_outputs[sig_name] = {}

        # Combine signals into shot.score
        for shot in shot_scores:
            i = shot["index"]
            adjustment = 0.0
            for sig_name, output in signal_outputs.items():
                w = weights.get(sig_name, 0.0)
                if w == 0.0 or i not in output:
                    continue
                v = float(output[i])
                shot["signals"][sig_name] = round(v, 3)
                adjustment += w * v
            shot["score"] = round(shot["baseScore"] + adjustment, 4)
            if chapter_labels:
                shot["chapter"] = chapter_labels.get(i)

    bridge.progress(75, 100, "Picking best shots…")
    # Per-chapter quota picking (#18 + #20): if chapter_targets is set, allocate
    # a fraction of the total duration to each chapter and pick the best shots
    # within that chapter independently. This ensures the highlight isn't all-
    # ceremony or all-dance.
    chapter_targets = genre_cfg.get("chapter_targets") if use_signals else None
    if chapter_targets and chapter_labels:
        picked: list[dict] = []
        total = 0.0
        for chap, fraction in chapter_targets.items():
            chap_target = min_dur * fraction
            chap_max = max_dur * fraction
            chap_shots = [s for s in shot_scores if s.get("chapter") == chap]
            chap_shots.sort(key=lambda s: -s["score"])
            chap_total = 0.0
            for s in chap_shots:
                if chap_total + s["durationSec"] > chap_max:
                    continue
                picked.append(s)
                chap_total += s["durationSec"]
                if chap_total >= chap_target:
                    break
            total += chap_total
            bridge.log(f"  Chapter '{chap}': picked {chap_total:.1f}s "
                       f"(target {chap_target:.0f}s)")
    else:
        # Original greedy mode
        sorted_by_score = sorted(shot_scores, key=lambda s: -s["score"])
        picked = []
        total = 0.0
        for s in sorted_by_score:
            if total >= min_dur and total + s["durationSec"] > max_dur:
                continue
            picked.append(s)
            total += s["durationSec"]
            if total >= max_dur:
                break

    # Sort picks chronologically for narrative flow
    picked.sort(key=lambda s: s["startSec"])
    chapters_summary = ""
    if chapter_labels:
        used_chaps: dict[str, float] = {}
        for p in picked:
            c = p.get("chapter") or "?"
            used_chaps[c] = used_chaps.get(c, 0) + p["durationSec"]
        chapters_summary = " · " + ", ".join(
            f"{c}={d:.0f}s" for c, d in used_chaps.items()
        )
    bridge.log(
        f"Picked {len(picked)} shots totalling {total:.1f}s "
        f"(target {min_dur:.0f}s, cap {max_dur:.0f}s){chapters_summary}"
    )

    if dry_run:
        bridge.result({
            "summary": f"Would assemble {total:.0f}s highlight from {len(picked)} shots",
            "sourceDuration": duration,
            "totalShots": len(shots),
            "shotsPicked": len(picked),
            "highlightDuration": round(total, 1),
            "samplePicks": picked[:10],
            "signalsUsed": list(signal_outputs.keys()),
            "chaptersDetected": sorted(set(chapter_labels.values())) if chapter_labels else [],
            "genre": genre_name,
        })
        return

    # If interactive review, extract thumbnails + cache picks and stop.
    # build_highlight_from_picks finalizes the timeline once user approves.
    if review_mode:
        bridge.progress(80, 100, "Extracting thumbnails for review…")
        cache_dir = os.path.expanduser(
            "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
        )
        thumb_dir = os.path.join(cache_dir, "highlight_thumbs",
                                 os.path.splitext(os.path.basename(video_path))[0])
        os.makedirs(thumb_dir, exist_ok=True)
        for p in picked:
            mid = (p["startSec"] + p["endSec"]) / 2
            thumb_path = os.path.join(thumb_dir, f"shot_{p['index']:04d}.jpg")
            try:
                subprocess.run(
                    [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                     "-ss", f"{mid:.3f}", "-i", video_path,
                     "-vframes", "1", "-q:v", "5",
                     "-vf", "scale=320:180:force_original_aspect_ratio=decrease",
                     thumb_path],
                    capture_output=True, timeout=10,
                )
                if os.path.isfile(thumb_path):
                    p["thumbnailPath"] = thumb_path
            except Exception:  # noqa: BLE001
                pass
        # Save picks for the UI + the follow-up build script
        picks_payload = {
            "sourceVideo": video_path,
            "timelineName": timeline_name,
            "sourceDurationSec": duration,
            "fps": fps,
            "minDurationSec": min_dur,
            "maxDurationSec": max_dur,
            "totalDurationSec": total,
            "shotsAnalyzed": len(shots),
            "picks": picked,
        }
        picks_path = os.path.join(cache_dir, "last_highlight_picks.json")
        with open(picks_path, "w") as f:
            json.dump(picks_payload, f, indent=2)
        bridge.log(f"Cached {len(picked)} picks for interactive review → {picks_path}")
        bridge.progress(100, 100, "Klar for review")
        bridge.result({
            "reviewMode": True,
            "picksPath": picks_path,
            "picksCount": len(picked),
            "highlightDuration": round(total, 1),
            "samplePicks": picked[:10],
            "signalsUsed": list(signal_outputs.keys()),
            "chaptersDetected": sorted(set(chapter_labels.values())) if chapter_labels else [],
            "genre": genre_name,
        })
        return

    bridge.progress(85, 100, "Importing video + building timeline in Resolve…")
    conn = bridge.ResolveConnection()
    if not conn.connect():
        return
    if not conn.project:
        bridge.error("No current Resolve project — open one and try again")
        sys.exit(1)

    media_pool = conn.project.GetMediaPool()
    if not media_pool:
        bridge.error("Could not access Media Pool")
        sys.exit(1)

    # Import the source video
    items = media_pool.ImportMedia([video_path]) or []
    if not items:
        bridge.error(f"Could not import {video_path} into Media Pool")
        sys.exit(1)
    source_item = items[0]

    timeline = media_pool.CreateEmptyTimeline(timeline_name)
    if not timeline:
        bridge.error(f"CreateEmptyTimeline('{timeline_name}') returned None — name may exist")
        sys.exit(1)
    conn.project.SetCurrentTimeline(timeline)

    try:
        timeline_fps = float(timeline.GetSetting("timelineFrameRate") or fps)
    except Exception:  # noqa: BLE001
        timeline_fps = fps

    # Build append specs — each shot is a sub-range of the source item placed
    # sequentially. We DON'T set recordFrame so Resolve appends them in order.
    append_specs = []
    for p in picked:
        start_f = int(round(p["startSec"] * fps))
        end_f = int(round(p["endSec"] * fps)) - 1
        if end_f <= start_f:
            continue
        append_specs.append({
            "mediaPoolItem": source_item,
            "startFrame": start_f,
            "endFrame": end_f,
        })

    if not append_specs:
        bridge.error("No valid shot specs to append")
        sys.exit(1)

    bridge.log(f"Appending {len(append_specs)} shots to timeline")
    placed = media_pool.AppendToTimeline(append_specs)
    placed_count = len(placed) if isinstance(placed, list) else 0

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "timelineName": timeline_name,
        "sourceDurationSec": round(duration, 1),
        "totalShotsAnalyzed": len(shots),
        "shotsPicked": len(picked),
        "highlightDurationSec": round(total, 1),
        "placedCount": placed_count,
        "samplePicks": picked[:15],
        "signalsUsed": list(signal_outputs.keys()),
        "chaptersDetected": sorted(set(chapter_labels.values())) if chapter_labels else [],
        "genre": genre_name,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

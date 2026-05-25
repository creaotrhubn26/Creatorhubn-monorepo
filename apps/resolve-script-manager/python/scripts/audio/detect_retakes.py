"""Detect Retakes — finds repeated audio content (retakes / restarts) in a long recording.

Strategy:
  1. Run fpcalc on the source audio in overlapping windows (default 8s window, 4s hop)
  2. Compute pairwise Hamming distances between window fingerprints
  3. Pairs below threshold are "matching content"; merge adjacent matches into segments
  4. Group segments where multiple takes cover the same content
  5. Return takeGroups with timestamps + audio-confidence

Params:
  audioPath:     path to a long WAV (e.g. dialogue stem from Audio view)
  windowSeconds: analysis window length (default 8)
  hopSeconds:    window step (default 4)
  matchThreshold: 0.0–1.0 — lower = stricter (default 0.20 of bits)
  minTakeSeconds: minimum take duration (default 6 — filter out spurious matches)

Output structure:
  {
    "audioPath": "...",
    "totalDurationSeconds": 342.5,
    "windowCount": 86,
    "takeGroups": [
      {
        "groupId": "...",
        "contentDurationSeconds": 12.5,
        "takeCount": 3,
        "audioConfidence": 0.92,
        "takes": [
          {"takeId": "t1", "startSeconds": 45.2, "endSeconds": 57.7, "isHeroSuggestion": true},
          {"takeId": "t2", "startSeconds": 89.4, "endSeconds": 101.9},
          {"takeId": "t3", "startSeconds": 142.0, "endSeconds": 154.5}
        ]
      }
    ]
  }
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def find_tool(name: str) -> str | None:
    for candidate in (
        os.environ.get(f"RESOLVE_SCRIPT_MANAGER_{name.upper()}"),
        shutil.which(name),
        f"/opt/homebrew/bin/{name}",
        f"/usr/local/bin/{name}",
    ):
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def probe_duration(ffprobe: str, audio_path: str) -> float | None:
    try:
        out = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
            capture_output=True, text=True, timeout=10,
        )
        return float(out.stdout.strip()) if out.stdout.strip() else None
    except (subprocess.TimeoutExpired, ValueError):
        return None


def fingerprint_window(fpcalc: str, ffmpeg: str, audio_path: str, start: float, length: float) -> list[int] | None:
    """Extract a slice via ffmpeg piped to fpcalc, return raw fingerprint as ints."""
    # ffmpeg writes a WAV slice; fpcalc reads it. We use temp file to avoid pipe complexity.
    tmp_path = f"/tmp/retake_window_{uuid.uuid4().hex[:8]}.wav"
    try:
        ffmpeg_cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-t", f"{length:.3f}",
            "-i", audio_path,
            "-ac", "1", "-ar", "11025",
            tmp_path,
        ]
        r = subprocess.run(ffmpeg_cmd, capture_output=True, timeout=20)
        if r.returncode != 0 or not os.path.exists(tmp_path):
            return None
        fp_cmd = [fpcalc, "-length", str(int(length)), "-raw", tmp_path]
        r2 = subprocess.run(fp_cmd, capture_output=True, text=True, timeout=15)
        if r2.returncode != 0:
            return None
        for line in r2.stdout.splitlines():
            if line.startswith("FINGERPRINT="):
                raw = line[len("FINGERPRINT="):].strip()
                return [int(x) for x in raw.split(",") if x]
    except (subprocess.TimeoutExpired, ValueError):
        return None
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
    return None


def hamming_distance(a: list[int], b: list[int]) -> int:
    n = min(len(a), len(b))
    if n == 0:
        return 1 << 30
    return sum(bin(a[i] ^ b[i]).count("1") for i in range(n))


def merge_adjacent_matches(matches: list[tuple[int, int]], hop_seconds: float, window_seconds: float) -> list[list[tuple[int, int]]]:
    """Group temporally-adjacent matches into single 'segments'.

    matches is a list of (window_a_index, window_b_index) — both pointing into the
    same fingerprint array. Adjacent if both A and B advance by 1 step.
    """
    if not matches:
        return []
    matches_sorted = sorted(matches)
    runs: list[list[tuple[int, int]]] = [[matches_sorted[0]]]
    for pair in matches_sorted[1:]:
        last = runs[-1][-1]
        if pair[0] == last[0] + 1 and pair[1] == last[1] + 1:
            runs[-1].append(pair)
        else:
            runs.append([pair])
    return runs


def run(params: dict, dry_run: bool) -> None:
    audio_path = params.get("audioPath")
    window_seconds = float(params.get("windowSeconds", 8))
    hop_seconds = float(params.get("hopSeconds", 4))
    match_threshold = float(params.get("matchThreshold", 0.20))
    min_take_seconds = float(params.get("minTakeSeconds", 6))

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would fingerprint {audio_path or '<audioPath>'} in {window_seconds}s windows (hop {hop_seconds}s) and find retakes",
            "params": {
                "windowSeconds": window_seconds,
                "hopSeconds": hop_seconds,
                "matchThreshold": match_threshold,
                "minTakeSeconds": min_take_seconds,
            },
            "method": "chromaprint fpcalc per window + Hamming-distance pairwise + temporal merge",
            "requires": ["ffmpeg", "ffprobe", "fpcalc (brew install chromaprint)"],
        })
        return

    if not audio_path or not os.path.isfile(audio_path):
        bridge.error("audioPath required and must exist on disk")
        sys.exit(1)

    ffmpeg = find_tool("ffmpeg")
    ffprobe = find_tool("ffprobe")
    fpcalc = find_tool("fpcalc")
    if not (ffmpeg and ffprobe and fpcalc):
        missing = [name for name, val in (("ffmpeg", ffmpeg), ("ffprobe", ffprobe), ("fpcalc", fpcalc)) if not val]
        bridge.error(f"Missing tools: {', '.join(missing)}. Install via: brew install ffmpeg chromaprint")
        sys.exit(1)

    duration = probe_duration(ffprobe, audio_path)
    if not duration or duration < window_seconds * 2:
        bridge.error(f"Audio too short ({duration}s) — need at least {window_seconds * 2}s for retake detection")
        sys.exit(1)

    bridge.log(f"Analysing {duration:.1f}s audio with {window_seconds}s windows / {hop_seconds}s hop")

    # Stage 1: fingerprint every window
    starts: list[float] = []
    fingerprints: list[list[int]] = []
    t = 0.0
    total_windows_est = max(1, int(duration / hop_seconds))
    while t + window_seconds <= duration:
        fp = fingerprint_window(fpcalc, ffmpeg, audio_path, t, window_seconds)
        if fp:
            starts.append(t)
            fingerprints.append(fp)
        t += hop_seconds
        bridge.progress(int(t / hop_seconds), total_windows_est, f"Fingerprinting window @ {t:.0f}s")

    if len(fingerprints) < 2:
        bridge.warn("Not enough valid fingerprint windows — audio may be too quiet or too short")
        bridge.result({"audioPath": audio_path, "totalDurationSeconds": duration, "windowCount": 0, "takeGroups": []})
        return

    bridge.log(f"Stage 2: pairwise comparison of {len(fingerprints)} windows")

    # Stage 2: pairwise matching. Skip self and immediate neighbours (overlapping windows).
    sample_bits = min(len(fp) for fp in fingerprints) * 32
    threshold_bits = int(sample_bits * match_threshold)
    matches: list[tuple[int, int]] = []
    for i in range(len(fingerprints)):
        for j in range(i + 2, len(fingerprints)):  # i+2 skips overlapping neighbour
            if (starts[j] - starts[i]) < min_take_seconds:
                continue
            dist = hamming_distance(fingerprints[i], fingerprints[j])
            if dist <= threshold_bits:
                matches.append((i, j))

    # Stage 3: merge adjacent matches into segments
    runs = merge_adjacent_matches(matches, hop_seconds, window_seconds)

    # Stage 4: turn runs into take-groups
    # Each "run" is a sequence of matching windows: window i+k ↔ window j+k for k in 0..n
    # → Take A = [starts[i], starts[i+n] + window_seconds]
    # → Take B = [starts[j], starts[j+n] + window_seconds]
    raw_groups: list[dict] = []
    for run_pairs in runs:
        first = run_pairs[0]
        last = run_pairs[-1]
        i_start, j_start = first
        i_end, j_end = last
        a_start = starts[i_start]
        a_end = starts[i_end] + window_seconds
        b_start = starts[j_start]
        b_end = starts[j_end] + window_seconds
        if (a_end - a_start) < min_take_seconds:
            continue
        # Average normalized hamming as audio confidence (closer to 1 = better match)
        avg_dist = sum(
            hamming_distance(fingerprints[i], fingerprints[j]) for i, j in run_pairs
        ) / len(run_pairs)
        confidence = max(0.0, 1.0 - (avg_dist / sample_bits))

        raw_groups.append({
            "spanA": (a_start, a_end),
            "spanB": (b_start, b_end),
            "confidence": confidence,
        })

    # Stage 5: collapse overlapping groups — if two pairs share a span, they're the same take-group with 3+ takes
    consolidated: list[dict] = []
    used_indices: set[int] = set()
    for idx, group in enumerate(raw_groups):
        if idx in used_indices:
            continue
        all_spans: list[tuple[float, float]] = [group["spanA"], group["spanB"]]
        confidence_sum = group["confidence"]
        confidence_count = 1
        for other_idx, other in enumerate(raw_groups[idx + 1 :], start=idx + 1):
            if other_idx in used_indices:
                continue
            other_spans = [other["spanA"], other["spanB"]]
            if any(_spans_overlap(s1, s2) for s1 in all_spans for s2 in other_spans):
                all_spans.extend(other_spans)
                confidence_sum += other["confidence"]
                confidence_count += 1
                used_indices.add(other_idx)
        # Dedupe spans (collapse overlapping)
        deduped = _collapse_overlapping_spans(all_spans)
        if len(deduped) < 2:
            continue
        content_duration = max(end - start for start, end in deduped)
        consolidated.append({
            "groupId": hashlib.sha1(f"{deduped}".encode()).hexdigest()[:10],
            "contentDurationSeconds": round(content_duration, 1),
            "takeCount": len(deduped),
            "audioConfidence": round(confidence_sum / confidence_count, 2),
            "takes": [
                {
                    "takeId": f"t{i+1}",
                    "startSeconds": round(start, 2),
                    "endSeconds": round(end, 2),
                    "isHeroSuggestion": i == len(deduped) - 1,  # default: last take is usually the keeper
                }
                for i, (start, end) in enumerate(sorted(deduped))
            ],
        })

    bridge.log(f"Found {len(consolidated)} retake groups")

    bridge.result({
        "audioPath": audio_path,
        "totalDurationSeconds": round(duration, 1),
        "windowCount": len(fingerprints),
        "windowSeconds": window_seconds,
        "hopSeconds": hop_seconds,
        "takeGroups": consolidated,
    })


def _spans_overlap(s1: tuple[float, float], s2: tuple[float, float]) -> bool:
    return not (s1[1] < s2[0] or s2[1] < s1[0])


def _collapse_overlapping_spans(spans: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not spans:
        return []
    sorted_spans = sorted(spans)
    merged: list[tuple[float, float]] = [sorted_spans[0]]
    for span in sorted_spans[1:]:
        last_start, last_end = merged[-1]
        if span[0] <= last_end + 0.5:  # 0.5s gap tolerance
            merged[-1] = (last_start, max(last_end, span[1]))
        else:
            merged.append(span)
    return merged


if __name__ == "__main__":
    bridge.main_guard(run)

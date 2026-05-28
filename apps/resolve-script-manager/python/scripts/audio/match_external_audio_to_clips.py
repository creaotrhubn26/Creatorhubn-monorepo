"""Match External Audio to Clips — finn hvilke video-klipp som matcher
eksterne lyd-opptak (lavalier, zoom-recorder, etc.) via audio
cross-correlation, og kalkuler offset for sync.

Use case: Bjarne bruker Sony UWP-D lavalier på presten + brudgom. Mikrofon-
opptakene ligger i en separat mappe. Vi:
  1. For hver ekstern WAV/MP3
  2. For hver video-klipp i video-mappa
  3. Resample begge til 8kHz mono, sample først 30s
  4. Cross-correlation → finn beste offset + score
  5. Hvis score > 0.6 → match!

Output: list of matches: { externalAudio, clipPath, offsetSec, confidence }

Input:
  externalAudioFolder: mappe med eksterne lyd-opptak
  clipsFolder:         mappe med video-klipp (eller bruk clips-listen)
  clips (optional):    pre-fetched list med {path}-objekter (fra
                        scan_folder_multicam — sparer ny disk-scan)
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


AUDIO_EXT = {".wav", ".mp3", ".m4a", ".flac", ".aac", ".ogg"}
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".m4v", ".avi", ".mts", ".m2ts"}


def find_tool(name: str) -> str | None:
    p = shutil.which(name)
    if p: return p
    for base in ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"):
        full = os.path.join(base, name)
        if os.path.isfile(full): return full
    return None


def scan_audio_files(folder: str) -> list[str]:
    out = []
    for root, _, files in os.walk(folder):
        for f in files:
            if f.startswith("."): continue
            if os.path.splitext(f)[1].lower() in AUDIO_EXT:
                out.append(os.path.join(root, f))
    return sorted(out)


def extract_audio_sample(ffmpeg: str, path: str, duration_sec: float = 30.0):
    """Hent første N sekunder som 8kHz mono float32 array. None hvis feiler."""
    try:
        import numpy as np  # type: ignore
    except ImportError:
        return None
    try:
        r = subprocess.run([
            ffmpeg, "-y", "-i", path,
            "-vn", "-ac", "1", "-ar", "8000",
            "-t", str(duration_sec),
            "-f", "f32le", "-",
        ], capture_output=True, timeout=90)
        if r.returncode != 0: return None
        arr = np.frombuffer(r.stdout, dtype=np.float32)
        return arr if len(arr) > 4000 else None
    except (subprocess.TimeoutExpired, OSError):
        return None


def cross_correlate(a, b, max_offset_sec: float = 60.0, sr: int = 8000):
    """Beste cross-correlation score + offset (i sekunder) mellom a og b.
    Returnerer (score 0.0-1.0, offset_sec)."""
    try:
        import numpy as np  # type: ignore
    except ImportError:
        return 0.0, 0.0
    if a is None or b is None or len(a) < 100 or len(b) < 100:
        return 0.0, 0.0
    # Normaliser
    a = a - a.mean(); b = b - b.mean()
    if a.std() < 1e-6 or b.std() < 1e-6: return 0.0, 0.0
    a = a / a.std(); b = b / b.std()
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]

    max_offset = int(max_offset_sec * sr)
    step = sr // 10  # 100 ms steps
    best_score = 0.0
    best_offset = 0
    for offset in range(-max_offset, max_offset + 1, step):
        if offset >= 0:
            a_seg = a[offset:]
            b_seg = b[: len(a_seg)]
        else:
            b_seg = b[-offset:]
            a_seg = a[: len(b_seg)]
        if len(a_seg) < 1000: continue
        # Dot-product normalisert er korrelasjonen
        corr = float((a_seg * b_seg).mean())
        if corr > best_score:
            best_score = corr
            best_offset = offset
    return max(0.0, min(1.0, best_score)), best_offset / sr


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_folder = (params.get("externalAudioFolder") or "").strip()
    clips_folder = (params.get("clipsFolder") or "").strip()
    clips_arg = params.get("clips")  # list[{path: ...}]

    if not audio_folder or not os.path.isdir(audio_folder):
        bridge.error(f"externalAudioFolder '{audio_folder}' is not a directory")
        sys.exit(1)

    # Build clip-list: enten fra clips-array, eller scan clips_folder
    clip_paths: list[str] = []
    if isinstance(clips_arg, list):
        for c in clips_arg:
            if isinstance(c, dict) and isinstance(c.get("path"), str):
                clip_paths.append(c["path"])
            elif isinstance(c, str):
                clip_paths.append(c)
    if not clip_paths and clips_folder and os.path.isdir(clips_folder):
        for root, _, files in os.walk(clips_folder):
            for f in files:
                if f.startswith("."): continue
                if os.path.splitext(f)[1].lower() in VIDEO_EXT:
                    clip_paths.append(os.path.join(root, f))

    if not clip_paths:
        bridge.error("Ingen video-klipp å matche mot")
        sys.exit(1)

    audio_paths = scan_audio_files(audio_folder)
    if not audio_paths:
        bridge.error(f"Ingen lyd-filer i {audio_folder}")
        sys.exit(1)

    ffmpeg = find_tool("ffmpeg")
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    bridge.log(f"Matching {len(audio_paths)} eksterne lyd mot {len(clip_paths)} klipp")

    if dry_run:
        bridge.result({
            "audioCount": len(audio_paths),
            "clipCount": len(clip_paths),
            "wouldCompare": len(audio_paths) * len(clip_paths),
        })
        return

    # Pre-extract audio samples for alle klipp (1 gang per klipp, ikke per match)
    clip_samples: dict[str, Any] = {}
    for i, p in enumerate(clip_paths):
        bridge.progress(int(40 * (i + 1) / len(clip_paths)), 100,
                        f"Henter audio fra {os.path.basename(p)} ({i+1}/{len(clip_paths)})")
        clip_samples[p] = extract_audio_sample(ffmpeg, p)

    matches = []
    total_pairs = len(audio_paths) * len(clip_paths)
    pair_idx = 0
    for a_path in audio_paths:
        a_sample = extract_audio_sample(ffmpeg, a_path)
        if a_sample is None:
            bridge.warn(f"Could not extract audio: {os.path.basename(a_path)}")
            pair_idx += len(clip_paths)
            continue

        for c_path in clip_paths:
            pair_idx += 1
            bridge.progress(
                40 + int(55 * pair_idx / total_pairs), 100,
                f"Matcher {os.path.basename(a_path)} ↔ {os.path.basename(c_path)}",
            )
            score, offset = cross_correlate(a_sample, clip_samples[c_path])
            if score >= 0.4:
                matches.append({
                    "externalAudio": a_path,
                    "clipPath": c_path,
                    "offsetSec": round(offset, 3),
                    "confidence": round(score, 3),
                })

    # Sortér: høyest confidence først
    matches.sort(key=lambda m: -m["confidence"])

    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"Fant {len(matches)} match-kandidater")
    bridge.result({
        "matches": matches,
        "matchCount": len(matches),
        "audioCount": len(audio_paths),
        "clipCount": len(clip_paths),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

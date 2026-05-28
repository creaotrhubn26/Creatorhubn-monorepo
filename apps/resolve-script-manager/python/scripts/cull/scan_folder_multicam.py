"""Scan Folder for Multicam — finn video-klipp + grupper multicam-vinkler.

Algoritme (hybrid):
  1. ffprobe alle .mp4/.mov/.mkv-filer i mappa → hent creation_time + duration
  2. Grupper klipp som overlapper i tid (toleranse 5s)
  3. For grupper med usikker tids-metadata (klokker som ikke er synkronisert):
     - Sammenlign audio-fingerprints (16kHz mono, første 60s) via cross-correlation
     - Hvis cross-corr > 0.6 → samme moment, gruppér

Output:
  {
    clips: [{ path, duration, createdAt, sizeBytes, codec }, ...],
    multicamGroups: [
      {
        startSec: float,           # i kilde-time
        durationSec: float,
        angles: [path1, path2, ...],
        confidence: float          # 0.0-1.0
      }
    ]
  }
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from typing import Any
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


VIDEO_EXT = {".mp4", ".mov", ".mkv", ".m4v", ".avi", ".mts", ".m2ts"}


def find_tool(name: str) -> str | None:
    p = shutil.which(name)
    if p: return p
    for base in ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"):
        full = os.path.join(base, name)
        if os.path.isfile(full): return full
    return None


def probe_video(ffprobe: str, path: str) -> dict:
    """Hent creation_time, duration, video codec, audio sample-rate."""
    try:
        r = subprocess.run([
            ffprobe, "-v", "error", "-print_format", "json",
            "-show_format", "-show_streams", path,
        ], capture_output=True, text=True, timeout=30)
        if r.returncode != 0: return {}
        data = json.loads(r.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError):
        return {}

    fmt = data.get("format", {})
    streams = data.get("streams", [])
    vstream = next((s for s in streams if s.get("codec_type") == "video"), {})
    astream = next((s for s in streams if s.get("codec_type") == "audio"), {})

    duration = float(fmt.get("duration") or 0)
    creation = fmt.get("tags", {}).get("creation_time") or \
               vstream.get("tags", {}).get("creation_time")
    created_ts = None
    if creation:
        try:
            dt = datetime.fromisoformat(creation.replace("Z", "+00:00"))
            created_ts = dt.timestamp()
        except (ValueError, TypeError):
            pass
    if created_ts is None:
        # Fall back to file mtime
        try: created_ts = os.path.getmtime(path)
        except OSError: created_ts = 0

    return {
        "path": path,
        "duration": duration,
        "createdAt": created_ts,
        "sizeBytes": int(fmt.get("size") or 0),
        "codec": vstream.get("codec_name") or "?",
        "width": int(vstream.get("width") or 0),
        "height": int(vstream.get("height") or 0),
        "fps": _eval_fps(vstream.get("r_frame_rate", "0/1")),
        "audioSampleRate": int(astream.get("sample_rate") or 0),
    }


def _eval_fps(s: str) -> float:
    try:
        n, d = s.split("/")
        return round(float(n) / float(d), 2) if float(d) > 0 else 0.0
    except (ValueError, ZeroDivisionError):
        return 0.0


def find_videos(folder: str) -> list[str]:
    out = []
    for root, _, files in os.walk(folder):
        for f in files:
            if f.startswith("."): continue
            if os.path.splitext(f)[1].lower() in VIDEO_EXT:
                out.append(os.path.join(root, f))
    return sorted(out)


def group_by_overlap(clips: list[dict], tol_sec: float = 5.0) -> list[list[dict]]:
    """Gruppér klipp hvis time-intervallene overlapper (±tol)."""
    groups: list[list[dict]] = []
    sorted_clips = sorted(clips, key=lambda c: c.get("createdAt") or 0)
    for c in sorted_clips:
        placed = False
        start = c.get("createdAt") or 0
        end = start + (c.get("duration") or 0)
        for g in groups:
            for x in g:
                xs = x.get("createdAt") or 0
                xe = xs + (x.get("duration") or 0)
                if not (end + tol_sec < xs or start - tol_sec > xe):
                    g.append(c)
                    placed = True
                    break
            if placed: break
        if not placed:
            groups.append([c])
    return groups


def audio_xcorr_score(ffmpeg: str, path_a: str, path_b: str,
                      duration_sec: float = 30.0) -> float:
    """Cross-correlation av første 30s audio. Returnerer 0.0-1.0 score.
    Bruker ffmpeg + numpy direkte (lett vekt). 0 hvis feiler."""
    try:
        import numpy as np  # type: ignore
    except ImportError:
        return 0.0

    def extract(path: str) -> "np.ndarray | None":
        try:
            r = subprocess.run([
                ffmpeg, "-y", "-i", path,
                "-vn", "-ac", "1", "-ar", "8000",
                "-t", str(duration_sec),
                "-f", "f32le", "-",
            ], capture_output=True, timeout=60)
            if r.returncode != 0: return None
            arr = np.frombuffer(r.stdout, dtype=np.float32)
            return arr if len(arr) > 1000 else None
        except (subprocess.TimeoutExpired, OSError):
            return None

    a = extract(path_a)
    b = extract(path_b)
    if a is None or b is None: return 0.0

    # Normaliser
    a = a - a.mean(); b = b - b.mean()
    if a.std() < 1e-6 or b.std() < 1e-6: return 0.0
    a = a / a.std(); b = b / b.std()

    # Trunc til samme lengde
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]

    # Maks-corr over begrenset offset (±5s shift)
    max_offset = 5 * 8000
    best = 0.0
    for offset in range(-max_offset, max_offset + 1, 800):
        if offset >= 0:
            a_seg = a[offset:n - max_offset]
            b_seg = b[: len(a_seg)]
        else:
            b_seg = b[-offset:n - max_offset]
            a_seg = a[: len(b_seg)]
        if len(a_seg) < 100: continue
        corr = float((a_seg * b_seg).mean())
        if corr > best: best = corr
    return max(0.0, min(1.0, best))


def run(params: dict[str, Any], dry_run: bool) -> None:
    folder = (params.get("folder") or "").strip()
    audio_verify = bool(params.get("audioVerify", True))
    if not folder or not os.path.isdir(folder):
        bridge.error(f"folder '{folder}' is not a directory")
        sys.exit(1)

    ffprobe = find_tool("ffprobe")
    ffmpeg = find_tool("ffmpeg")
    if not ffprobe:
        bridge.error("ffprobe ikke funnet — installer via Dependencies modal")
        sys.exit(1)

    bridge.progress(0, 100, "Skanner mappe …")
    paths = find_videos(folder)
    if not paths:
        bridge.error(f"Ingen video-filer funnet i {folder}")
        sys.exit(1)
    bridge.log(f"Fant {len(paths)} video-filer")

    if dry_run:
        bridge.result({"folder": folder, "clipCount": len(paths)})
        return

    clips: list[dict] = []
    for i, p in enumerate(paths):
        bridge.progress(10 + int(50 * (i + 1) / len(paths)), 100,
                        f"Probing {os.path.basename(p)} ({i+1}/{len(paths)})")
        info = probe_video(ffprobe, p)
        if info: clips.append(info)

    bridge.progress(60, 100, "Grupperer multicam-klipp …")
    raw_groups = group_by_overlap(clips, tol_sec=5.0)

    # Audio-verify usikre grupper (>= 2 medlemmer + lavt confidence-tegn)
    multicam_groups = []
    for g in raw_groups:
        if len(g) < 2: continue
        # Confidence: høy hvis alle createdAt < 10s avstand fra hverandre
        starts = [c.get("createdAt") or 0 for c in g]
        spread = max(starts) - min(starts)
        confidence = 0.95 if spread < 10 else 0.7 if spread < 60 else 0.4

        # Audio-verify lave-confidence-grupper
        if audio_verify and ffmpeg and confidence < 0.8 and len(g) >= 2:
            score = audio_xcorr_score(ffmpeg, g[0]["path"], g[1]["path"])
            if score > 0.6:
                confidence = max(confidence, 0.85)
                bridge.log(f"  Audio-bekreftet ({score:.2f}): {os.path.basename(g[0]['path'])} ↔ {os.path.basename(g[1]['path'])}")
            else:
                confidence = min(confidence, 0.5)

        if confidence >= 0.5:
            multicam_groups.append({
                "startSec": min(starts),
                "durationSec": max(c.get("duration") or 0 for c in g),
                "angles": [c["path"] for c in g],
                "confidence": round(confidence, 2),
            })

    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"Multicam-grupper: {len(multicam_groups)}")
    bridge.result({
        "folder": folder,
        "clips": clips,
        "clipCount": len(clips),
        "multicamGroups": multicam_groups,
        "multicamGroupCount": len(multicam_groups),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

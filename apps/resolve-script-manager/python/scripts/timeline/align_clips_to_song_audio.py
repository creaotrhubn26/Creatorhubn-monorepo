"""Align Clips to Song Audio — for each video clip, listen to its audio,
find where in the source song that audio matches, and place the clip at
that exact timecode on the timeline.

Use case: Bjarne shot a wedding first-dance from 4 camera angles. Each
clip's CAMERA AUDIO captures the song faintly from the speakers. He
wants the clean YouTube-source song placed UNDER the timeline, with each
camera angle landing at the moment its audio matches the song. Result:
visuals stay in sync with the music when switching angles.

This differs from assign_clips_to_beats:
  - assign_clips_to_beats picks clips per BEAT-WINDOW by energy/scene
    matching (good when clips are unrelated B-roll for a music video)
  - align_clips_to_song_audio picks the SAME-MOMENT timecode per clip
    based on audio matching (good when clips ARE the song happening)

Approach (chroma cross-correlation in librosa):
  1. Load source song as chroma features at 22050 Hz
  2. For each video clip:
     a. Extract audio (mono, 22050 Hz) via ffmpeg
     b. Compute chroma for the clip's first ~10s
     c. Slide the clip's chroma fingerprint over the song's chroma
     d. Peak similarity = offset in song where the clip starts
     e. Confidence = peak prominence
  3. Output 'segments' compatible with place_clips_on_beat_grid:
     [{ clipPath, startSec, endSec, durationSec, matchConfidence, ... }]

Caches result so place_clips_on_beat_grid auto-picks it up.

Input params:
  sourceSongPath:  absolute path to the clean source song (audio file)
  clipPaths:       optional list of video file paths to align. If omitted,
                   scans the current Resolve project's Media Pool.
  minConfidence:   skip clips with peak prominence < this (default 0.05)
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


SIDECAR_FFMPEG_PATHS = (
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
)


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


def probe_duration(ffprobe: str, path: str) -> float:
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=15,
        )
        return float((r.stdout or "0").strip())
    except (subprocess.SubprocessError, ValueError):
        return 0.0


def gather_clips_from_resolve() -> list[str]:
    """Fallback: scan current Resolve project's Media Pool for video files."""
    paths: list[str] = []
    try:
        conn = bridge.ResolveConnection()
        if not conn.connect() or not conn.project:
            return paths
        mp = conn.project.GetMediaPool()
        if not mp:
            return paths
        seen: set[str] = set()

        def _walk(folder):
            for clip in folder.GetClipList() or []:
                try:
                    p = clip.GetClipProperty("File Path") or ""
                except Exception:  # noqa: BLE001
                    p = ""
                if p and p not in seen:
                    ext = os.path.splitext(p)[1].lower()
                    if ext in {".mp4", ".mov", ".mxf", ".mts", ".m2ts", ".avi", ".mkv", ".m4v"}:
                        seen.add(p)
                        paths.append(p)
            for sub in folder.GetSubFolderList() or []:
                _walk(sub)

        _walk(mp.GetRootFolder())
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Resolve scan failed: {exc}")
    return paths


def align_via_librosa(source_song_path: str, clip_audio_paths: list[tuple[str, str, float]],
                      min_confidence: float, search_start: float = 0.0,
                      search_end: float = 0.0, verify_mfcc: bool = True) -> list[dict]:
    """Run chroma cross-correlation in a librosa subprocess. Returns one match
    per clip with offset in song + confidence.

    clip_audio_paths: [(clip_path, extracted_audio_path, clip_duration_sec), ...]
    search_start / search_end: limit the search to a time-window in the source song
        (#61 — for long sources, lets caller narrow down where to look)
    verify_mfcc: after chroma match, verify with MFCC cosine similarity (#62)
    """
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    python = venv_py if os.path.isfile(venv_py) else "python3"

    payload = {
        "sourceSong": source_song_path,
        "clips": [{"path": p, "audio": a, "duration": d} for p, a, d in clip_audio_paths],
        "minConfidence": min_confidence,
        "searchStart": float(search_start),
        "searchEnd": float(search_end),
        "verifyMfcc": bool(verify_mfcc),
    }

    snippet = """
import sys, json
try:
  import librosa, numpy as np
except ImportError:
  print(json.dumps({'error': 'librosa_not_installed'})); sys.exit(0)

payload = json.loads(sys.stdin.read())
src_path = payload['sourceSong']
clips = payload['clips']
min_conf = float(payload.get('minConfidence', 0.05))
search_start = float(payload.get('searchStart', 0.0))
search_end = float(payload.get('searchEnd', 0.0))
verify_mfcc = bool(payload.get('verifyMfcc', True))
hop = 512
sr = 22050

# Source chroma — cache once
y_src, _ = librosa.load(src_path, sr=sr)
src_dur = len(y_src) / sr
ch_src = librosa.feature.chroma_cqt(y=y_src, sr=sr, hop_length=hop)

# (#62) Pre-compute source MFCC for verification — much cheaper than redoing
# per-clip. We just slice into it at the offset.
mfcc_src = librosa.feature.mfcc(y=y_src, sr=sr, n_mfcc=13, hop_length=hop) if verify_mfcc else None

def _norm(c):
  n = np.linalg.norm(c, axis=0, keepdims=True); n[n==0] = 1; return c / n
ch_src_n = _norm(ch_src)

# (#61) Constrain the search window if the caller hinted at a region.
# Default = whole song. End of 0 means open-ended.
frames_per_sec = sr / hop
start_frame = max(0, int(search_start * frames_per_sec))
end_frame = (
  int(search_end * frames_per_sec) if search_end > 0
  else ch_src_n.shape[1]
)
end_frame = min(end_frame, ch_src_n.shape[1])

results = []
for clip in clips:
  try:
    y_clip, _ = librosa.load(clip['audio'], sr=sr, duration=10.0)
  except Exception as exc:
    results.append({'clipPath': clip['path'], 'error': f'load_failed:{exc}'})
    continue
  if len(y_clip) < sr:
    results.append({'clipPath': clip['path'], 'error': 'too_short_or_silent'})
    continue
  ch_clip = _norm(librosa.feature.chroma_cqt(y=y_clip, sr=sr, hop_length=hop))
  win = ch_clip.shape[1]
  if ch_src_n.shape[1] < win:
    results.append({'clipPath': clip['path'], 'error': 'song_shorter_than_window'})
    continue
  max_i = end_frame - win + 1
  if max_i <= start_frame:
    results.append({'clipPath': clip['path'], 'error': 'search_window_too_narrow'})
    continue

  # (#61) Hierarchical search: coarse pass at stride 8, then fine-tune
  # within ±8 frames around the top 3 peaks. ~10× speed-up vs full scan
  # on 4-min songs, and similar accuracy.
  coarse_step = 8
  coarse = []
  for i in range(start_frame, max_i, coarse_step):
    sim = float(np.sum(ch_clip[:, :win] * ch_src_n[:, i:i+win]) / win)
    coarse.append((sim, i))
  coarse.sort(reverse=True)
  candidates = coarse[:3] if coarse else []
  best = (-1.0, start_frame); second = -1.0
  for _, ci in candidates:
    lo = max(start_frame, ci - coarse_step)
    hi = min(max_i, ci + coarse_step + 1)
    for i in range(lo, hi):
      sim = float(np.sum(ch_clip[:, :win] * ch_src_n[:, i:i+win]) / win)
      if sim > best[0]:
        second = best[0]; best = (sim, i)
      elif sim > second:
        second = sim
  offset_sec = best[1] * hop / sr
  rel_confidence = max(0.0, (best[0] - max(second, 0)) / max(best[0], 0.001))

  # (#62) MFCC-based verify: compute cosine similarity of source MFCC at
  # offset vs clip MFCC. Strong second-opinion that the chroma peak isn't
  # a false-positive on a repeating chord progression.
  verify_score = 1.0
  if verify_mfcc and mfcc_src is not None:
    try:
      mfcc_clip = librosa.feature.mfcc(y=y_clip, sr=sr, n_mfcc=13, hop_length=hop)
      mc_norm = mfcc_clip / (np.linalg.norm(mfcc_clip, axis=0, keepdims=True) + 1e-9)
      slice_end = min(best[1] + win, mfcc_src.shape[1])
      ms_slice = mfcc_src[:, best[1]:slice_end]
      if ms_slice.shape[1] >= win:
        ms_norm = ms_slice[:, :win] / (np.linalg.norm(ms_slice[:, :win], axis=0, keepdims=True) + 1e-9)
        verify_score = float(np.mean(np.sum(mc_norm[:, :win] * ms_norm, axis=0)))
      else:
        verify_score = 0.5  # can't verify near end of song; neutral
    except Exception:
      verify_score = 0.5

  # Combined confidence: chroma-relative × MFCC-absolute. Both must be strong
  # for a high final confidence. MFCC verify_score ranges -1..1; clamp to 0..1.
  mfcc_norm = max(0.0, min(1.0, (verify_score + 1) / 2))
  combined = rel_confidence * (0.6 + 0.4 * mfcc_norm)

  results.append({
    'clipPath': clip['path'],
    'startSec': offset_sec,
    'durationSec': clip['duration'],
    'endSec': min(src_dur, offset_sec + clip['duration']),
    'similarity': best[0],
    'matchConfidence': combined,
    'chromaConfidence': rel_confidence,
    'mfccVerify': mfcc_norm,
    'skip': combined < min_conf,
  })

print(json.dumps({'segments': results, 'sourceDuration': src_dur}))
"""

    try:
        proc = subprocess.run(
            [python, "-c", snippet],
            input=json.dumps(payload),
            capture_output=True, text=True, timeout=600,
        )
        for line in (proc.stdout or "").splitlines()[::-1]:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if "error" in data:
                    bridge.warn(f"librosa skipped: {data['error']}")
                    return []
                return data.get("segments") or []
            except json.JSONDecodeError:
                continue
        bridge.warn(f"librosa subprocess returned no JSON. stderr: {(proc.stderr or '')[:300]}")
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"librosa subprocess failed: {exc}")
    return []


def extract_clip_audio(ffmpeg: str, video_path: str, dest_path: str) -> bool:
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", video_path,
        "-t", "12.0",      # only need ~10s for matching
        "-ac", "1", "-ar", "22050",
        "-vn", "-f", "wav", dest_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=60)
        return r.returncode == 0 and os.path.isfile(dest_path)
    except Exception:  # noqa: BLE001
        return False


def run(params: dict[str, Any], dry_run: bool) -> None:
    source_song = (params.get("sourceSongPath") or "").strip()
    clip_paths = params.get("clipPaths") or []
    min_confidence = float(params.get("minConfidence") or 0.05)
    search_start = float(params.get("searchStartSec") or 0.0)
    search_end = float(params.get("searchEndSec") or 0.0)
    verify_mfcc = params.get("verifyWithMfcc")
    verify_mfcc = True if verify_mfcc is None else bool(verify_mfcc)

    if not source_song or not os.path.isfile(source_song):
        bridge.error(f"sourceSongPath '{source_song}' is not a file")
        sys.exit(1)

    if not clip_paths:
        clip_paths = gather_clips_from_resolve()
    if not clip_paths:
        bridge.error(
            "Trenger video-klipp å aligne. Enten: (1) passer 'clipPaths' eksplisitt, "
            "ELLER (2) åpne et Resolve-prosjekt med klipp i Media Pool."
        )
        sys.exit(1)

    ffmpeg, ffprobe = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH — install via Dependencies modal")
        sys.exit(1)

    bridge.log(f"Aligning {len(clip_paths)} clip(s) against {os.path.basename(source_song)}")

    if dry_run:
        bridge.result({
            "wouldAlignCount": len(clip_paths),
            "sourceSong": source_song,
        })
        return

    # Extract audio from each clip to a temp staging dir
    staging = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/staging/audio_align"
    )
    os.makedirs(staging, exist_ok=True)
    bridge.progress(0, 100, "Extracting clip audio…")
    clip_audio: list[tuple[str, str, float]] = []  # (clip_path, audio_path, clip_duration)
    for i, clip in enumerate(clip_paths):
        bridge.progress(int(40 * (i + 1) / len(clip_paths)), 100, f"Audio {i + 1}/{len(clip_paths)}")
        audio_dest = os.path.join(staging, f"clip_{i:03d}.wav")
        if extract_clip_audio(ffmpeg, clip, audio_dest):
            dur = probe_duration(ffprobe, clip)
            clip_audio.append((clip, audio_dest, dur))
        else:
            bridge.warn(f"Audio extraction failed for {os.path.basename(clip)} — skipping")

    if not clip_audio:
        bridge.error("Could not extract audio from any clips")
        sys.exit(1)

    range_msg = ""
    if search_start > 0 or search_end > 0:
        range_msg = f" (search range {search_start:.1f}s → {search_end:.1f}s)"
    bridge.progress(45, 100, f"Matching audio fingerprints against source song{range_msg}…")
    segments = align_via_librosa(
        source_song, clip_audio, min_confidence,
        search_start=search_start, search_end=search_end,
        verify_mfcc=verify_mfcc,
    )
    if not segments:
        bridge.error(
            "Audio-fingerprint matching feilet — sjekk at librosa er installert "
            "(Dependencies-modalen). Du kan også prøve assign_clips_to_beats istedenfor."
        )
        sys.exit(1)

    usable = [s for s in segments if not s.get("error") and not s.get("skip")]
    bridge.log(
        f"Matched {len(usable)}/{len(segments)} clips above confidence ≥ {min_confidence}"
    )

    if not usable:
        bridge.warn(
            "No clips passed the confidence threshold. Lower minConfidence or "
            "verify the source song is the same as what's in the video audio."
        )

    # Cache for place_clips_on_beat_grid in same format as assign_clips_to_beats output
    try:
        import time as _time
        cache_dir = os.path.expanduser(
            "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
        )
        cache_path = os.path.join(cache_dir, "last_beat_assignments.json")
        with open(cache_path, "w") as f:
            json.dump({"savedAt": _time.time(), "segments": usable, "alignedFromAudio": True}, f)
        bridge.log(f"Cached audio-aligned segments → {cache_path}")
    except OSError as exc:
        bridge.warn(f"Could not cache: {exc}")

    # Also write sourceSongPath to the beat-session cache so place_clips_on_beat_grid
    # auto-attaches this song
    try:
        beat_cache_path = os.path.join(
            os.path.expanduser("~/Library/Application Support/no.creatorhubn.roleroom-post-agent"),
            "last_beat_session.json",
        )
        beat_session: dict = {}
        if os.path.isfile(beat_cache_path):
            try:
                with open(beat_cache_path) as f:
                    beat_session = json.load(f)
            except (OSError, json.JSONDecodeError):
                beat_session = {}
        beat_session["musicPath"] = source_song
        with open(beat_cache_path, "w") as f:
            json.dump(beat_session, f)
    except OSError as exc:
        bridge.warn(f"Could not update beat-session cache: {exc}")

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "sourceSong": source_song,
        "totalClips": len(clip_paths),
        "audioExtracted": len(clip_audio),
        "matched": len(usable),
        "skipped": len(segments) - len(usable),
        "samples": usable[:10],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

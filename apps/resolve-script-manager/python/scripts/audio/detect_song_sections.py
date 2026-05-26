"""Detect Song Sections — strukturell segmentering via librosa.

Output: liste over song-seksjoner med label + start/end-tid:
  [{startSec, endSec, durationSec, label, energyRatio}, ...]

Labels detekteres heuristisk fra MFCC self-similarity-matrix:
  intro       : første seksjon, lavere energi enn snitt
  verse       : segment med moderat energi, gjentas
  pre_chorus  : kortere segment før energi-pike
  chorus      : høyere-energi segment som gjentas
  bridge      : unikt segment ulik alt annet (lav similarity til chorus)
  drop        : sterk RMS-increase rett etter en build-up
  outro       : siste seksjon med lavere energi

Algoritme:
  1. Librosa beat-track + chroma + MFCC per segment-frame
  2. Recurrence-matrix på MFCC → finn segment-grenser
  3. Cluster-segmenter via spectral-clustering så same-type sections får
     same label (e.g. verse-1 + verse-2 grupperes som "verse")
  4. Label clusters etter posisjon + energi + repetition:
       - første lavere-energi = intro
       - siste lavere-energi   = outro
       - høyest-energi recurring = chorus
       - moderat recurring     = verse
       - unique mid-song       = bridge
       - sterk RMS-jump        = drop

Caches resultat til last_song_sections.json — assign_clips_to_beats leser
det for per-section cut-density + clip-variety-policy.

#504 drop-detection · #505 build-up-detection · #506 bridge-detection ·
#507 chorus-detection · #508 verse-detection.
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

bridge.reexec_in_venv_if_present()


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent"
)
SECTIONS_CACHE_PATH = os.path.join(CACHE_DIR, "last_song_sections.json")


def _resolve_python() -> str:
    """Same venv-preference pattern as transcribe_audio.py."""
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    return venv_py if os.path.isfile(venv_py) else (shutil.which("python3") or "python3")


def _segment_via_librosa(audio_path: str) -> dict:
    """Run librosa structural segmentation in a subprocess so the heavy
    libs only load when needed. Returns parsed JSON or {} on failure."""
    snippet = """
import sys, json
try:
  import librosa, numpy as np
  from sklearn.cluster import SpectralClustering
except ImportError as exc:
  print(json.dumps({'error': f'missing_lib:{exc}'})); sys.exit(0)

path = sys.argv[1]
sr = 22050
y, _ = librosa.load(path, sr=sr)
duration = float(librosa.get_duration(y=y, sr=sr))

# Beat-synchronous features so MFCC frames align to musical grid
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
beat_mfcc = librosa.util.sync(mfcc, beats, aggregate=np.median)
beat_times = librosa.frames_to_time(beats, sr=sr).tolist()
if len(beat_times) < 8:
  print(json.dumps({'error': 'too_few_beats'})); sys.exit(0)

# Recurrence-matrix + Laplacian → spectral clustering for segment-labels
R = librosa.segment.recurrence_matrix(beat_mfcc, sym=True, mode='affinity')
n_clusters = min(6, max(2, len(beat_times) // 16))
try:
  clusters = SpectralClustering(
    n_clusters=n_clusters, affinity='precomputed', random_state=42,
    n_init=4
  ).fit_predict(R)
except Exception as exc:
  print(json.dumps({'error': f'cluster_failed:{exc}'})); sys.exit(0)

# Per-beat RMS for energy classification
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
beat_rms = librosa.util.sync(rms.reshape(1, -1), beats, aggregate=np.mean)[0]
mean_rms = float(np.mean(beat_rms))

# Group consecutive same-cluster beats into segments
segments = []
i = 0
while i < len(clusters):
  j = i
  while j + 1 < len(clusters) and clusters[j + 1] == clusters[i]:
    j += 1
  start_t = beat_times[i]
  end_t = beat_times[j + 1] if j + 1 < len(beat_times) else duration
  seg_rms = float(np.mean(beat_rms[i:j+1])) if j >= i else float(beat_rms[i])
  segments.append({
    'startSec': round(start_t, 3),
    'endSec': round(end_t, 3),
    'durationSec': round(end_t - start_t, 3),
    'cluster': int(clusters[i]),
    'meanRms': round(seg_rms, 5),
    'energyRatio': round(seg_rms / mean_rms, 3) if mean_rms > 0 else 1.0,
  })
  i = j + 1

# Detect drops: a segment where RMS jumps >+30% from previous within 3 beats
drops_per_segment = set()
for i in range(1, len(segments)):
  prev_e = segments[i-1]['energyRatio']
  this_e = segments[i]['energyRatio']
  if prev_e < 1.0 and this_e > 1.25 and (this_e - prev_e) > 0.4:
    drops_per_segment.add(i)

# Label clusters:
#   cluster with HIGHEST recurring energy = chorus
#   cluster with MODERATE recurring energy = verse
#   cluster appearing only once + mid-song + unique = bridge
#   first low-energy segment = intro
#   last low-energy segment = outro
cluster_stats = {}
for seg in segments:
  c = seg['cluster']
  cluster_stats.setdefault(c, {'count': 0, 'totalRms': 0, 'segIdxs': []})
  cluster_stats[c]['count'] += 1
  cluster_stats[c]['totalRms'] += seg['energyRatio']
for c, stats in cluster_stats.items():
  stats['avgEnergy'] = stats['totalRms'] / stats['count']

# Identify chorus + verse cluster by recurrence and energy
recurring = [c for c, s in cluster_stats.items() if s['count'] >= 2]
recurring.sort(key=lambda c: -cluster_stats[c]['avgEnergy'])
chorus_cluster = recurring[0] if recurring else None
verse_cluster = recurring[1] if len(recurring) >= 2 else None

# Bridge: a non-recurring cluster (count == 1) that lives in middle-third
unique_clusters = [c for c, s in cluster_stats.items() if s['count'] == 1]

for i, seg in enumerate(segments):
  c = seg['cluster']
  pos = (seg['startSec'] + seg['endSec']) / 2 / duration  # 0..1 position
  label = 'other'
  if i in drops_per_segment:
    label = 'drop'
  elif c == chorus_cluster:
    label = 'chorus'
  elif c == verse_cluster:
    label = 'verse'
  elif c in unique_clusters and 0.3 < pos < 0.75:
    label = 'bridge'
  elif i == 0 and seg['energyRatio'] < 1.0:
    label = 'intro'
  elif i == len(segments) - 1 and seg['energyRatio'] < 1.0:
    label = 'outro'
  elif i > 0 and segments[i-1]['energyRatio'] < seg['energyRatio'] and seg['energyRatio'] > 0.85:
    # Energy rising → likely pre_chorus or build-up
    label = 'pre_chorus' if seg['energyRatio'] < 1.15 else 'build_up'
  seg['label'] = label
  # Drop the raw cluster-id from output — it's a clustering artifact
  del seg['cluster']

print(json.dumps({
  'duration': duration,
  'tempo': float(tempo),
  'segments': segments,
  'beatCount': len(beat_times),
  'sectionCount': len(segments),
}))
"""
    python = _resolve_python()
    try:
        r = subprocess.run(
            [python, "-c", snippet, audio_path],
            capture_output=True, text=True, timeout=600,
        )
        for line in (r.stdout or "").splitlines()[::-1]:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if not isinstance(data, dict):
                    continue
                if "error" in data:
                    bridge.warn(f"Section detection skipped: {data['error']}")
                    return {}
                return data
            except json.JSONDecodeError:
                continue
        if r.returncode != 0:
            bridge.warn(f"librosa subprocess exited {r.returncode}: {(r.stderr or '')[-300:]}")
    except subprocess.TimeoutExpired:
        bridge.warn("Section detection timed out (10 min) — try shorter clip")
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"Section detection failed: {exc}")
    return {}


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("musicPath") or params.get("audioPath") or "").strip()
    # Fall back to the cached source-song path from last detect_music_beats run
    if not audio_path:
        beats_cache = os.path.join(CACHE_DIR, "last_beat_session.json")
        if os.path.isfile(beats_cache):
            try:
                with open(beats_cache) as f:
                    cached_beats = json.load(f)
                audio_path = (cached_beats.get("musicPath") or "").strip()
                if audio_path:
                    bridge.log(f"Using cached music from detect_music_beats: {os.path.basename(audio_path)}")
            except (OSError, json.JSONDecodeError):
                pass
    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(
            f"musicPath '{audio_path}' is not a file. Pass musicPath param or "
            "run detect_music_beats first."
        )
        sys.exit(1)

    # #64 — cache derived sections per audio-file hash
    cp = bridge.cache_path_for("song-sections", audio_path, extra_key="v2")
    if cp and os.path.isfile(cp) and not params.get("forceRecompute"):
        try:
            with open(cp, "r", encoding="utf-8") as f:
                cached = json.load(f)
            bridge.log(f"Section-cache hit: {len(cached.get('segments') or [])} sections")
            _write_session_cache(audio_path, cached)
            bridge.result({
                "fromCache": True,
                "audioPath": audio_path,
                **{k: v for k, v in cached.items() if k != "segments"},
                "sections": cached.get("segments") or [],
            })
            return
        except (OSError, json.JSONDecodeError):
            pass  # stale — recompute

    if dry_run:
        bridge.result({
            "wouldAnalyse": audio_path,
            "note": "Spectral-clustering structural segmentation",
        })
        return

    bridge.progress(5, 100, "Beat-tracking + MFCC-segmentering…")
    data = _segment_via_librosa(audio_path)
    if not data or not data.get("segments"):
        bridge.error(
            "Section detection returned empty. Sjekk at librosa + scikit-learn "
            "er installert (Dependencies-modalen)."
        )
        sys.exit(1)

    segs = data["segments"]
    bridge.log(f"Detected {len(segs)} sections (tempo {data.get('tempo', '?')} BPM)")
    # Log first 8 for sanity
    for s in segs[:8]:
        bridge.log(
            f"  {s['startSec']:6.1f}s → {s['endSec']:6.1f}s "
            f"[{s['label']:10s}] energy×{s['energyRatio']}"
        )
    if len(segs) > 8:
        bridge.log(f"  … ({len(segs) - 8} more)")

    # Write cache file (content-addressable) AND the convenience pointer-cache
    if cp:
        try:
            with open(cp, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except OSError:
            pass
    _write_session_cache(audio_path, data)

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "audioPath": audio_path,
        "tempo": data.get("tempo"),
        "sectionCount": len(segs),
        "labels": sorted(set(s["label"] for s in segs)),
        "sections": segs,
    })


def _write_session_cache(audio_path: str, data: dict) -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(SECTIONS_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "audioPath": audio_path,
            "tempo": data.get("tempo"),
            "duration": data.get("duration"),
            "segments": data.get("segments") or [],
        }, f, indent=2)


if __name__ == "__main__":
    bridge.main_guard(run)

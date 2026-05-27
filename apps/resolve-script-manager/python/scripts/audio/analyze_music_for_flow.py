"""Analyser musikk for Flow Map — beat structure, sections, RMS, silence,
spectral features per tid-segment.

Output:
  {
    "duration": float,
    "tempo": float,
    "beats": [t1, t2, ...],          # beat-times (sec)
    "downbeats": [t1, t2, ...],       # every 4th beat
    "sections": [                      # via librosa segment-decomposition
      { "startSec", "endSec", "label" }    # intro/verse/chorus/drop/bridge/outro
    ],
    "rms": [                          # 0.5s-windowed RMS, normalized 0-1
      { "t": 0.0, "value": 0.42 }, ...
    ],
    "silence": [                      # regions with RMS < threshold
      { "startSec", "endSec" }
    ],
    "spectralCentroid": [             # 0.5s-windowed brightness, normalized 0-1
      { "t": 0.0, "value": 0.55 }, ...
    ],
    "drops": [                        # detected energy-peaks (RMS-spikes)
      { "t": 12.5, "intensity": 0.85 }
    ]
  }

Input params:
  audioPath:  absolute path to .wav (required)
  outputPath: where to write JSON (optional; default ~/Library/.../music_flow/<name>.json)
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


CACHE_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/music_flow"
)


def available() -> bool:
    try:
        import librosa  # noqa: F401
        import numpy  # noqa: F401
        return True
    except ImportError:
        return False


def analyze(audio_path: str) -> dict:
    import librosa
    import numpy as np

    bridge.log(f"Loading {os.path.basename(audio_path)}…")
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = len(y) / sr
    bridge.log(f"Duration: {duration:.1f}s @ {sr} Hz")

    # ─── Beats + downbeats ───
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    tempo_val = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
    # Downbeats = every 4th beat (assumes 4/4 time)
    downbeats = [float(b) for b in beat_times[::4]]
    bridge.log(f"Tempo: {tempo_val:.1f} BPM, {len(beat_times)} beats, {len(downbeats)} downbeats")

    # ─── RMS energy curve (0.5s windows) ───
    hop = sr // 2  # 0.5s windows
    rms_raw = librosa.feature.rms(y=y, frame_length=sr, hop_length=hop)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms_raw)), sr=sr, hop_length=hop)
    rms_max = float(np.max(rms_raw)) if len(rms_raw) > 0 else 1.0
    rms_norm = (rms_raw / max(rms_max, 1e-6)).tolist()
    rms = [{"t": round(float(t), 2), "value": round(float(v), 3)}
           for t, v in zip(rms_times, rms_norm)]

    # ─── Silence regions (RMS < 0.05 of max for >= 1s) ───
    silence_thresh = 0.05
    silence = []
    in_silence = False
    sil_start = 0.0
    for i, v in enumerate(rms_norm):
        t = float(rms_times[i])
        if v < silence_thresh:
            if not in_silence:
                sil_start = t
                in_silence = True
        else:
            if in_silence:
                if t - sil_start >= 1.0:
                    silence.append({"startSec": round(sil_start, 2), "endSec": round(t, 2)})
                in_silence = False
    if in_silence and (duration - sil_start) >= 1.0:
        silence.append({"startSec": round(sil_start, 2), "endSec": round(duration, 2)})

    # ─── Spectral centroid (brightness, 0.5s windows) ───
    sc = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)[0]
    sc_max = float(np.max(sc)) if len(sc) > 0 else 1.0
    sc_norm = (sc / max(sc_max, 1e-6)).tolist()
    sc_times = librosa.frames_to_time(np.arange(len(sc)), sr=sr, hop_length=hop)
    spectral_centroid = [
        {"t": round(float(t), 2), "value": round(float(v), 3)}
        for t, v in zip(sc_times, sc_norm)
    ]

    # ─── Drop detection: RMS-spike (rising onset > 0.4 above local mean) ───
    drops = []
    window = 8  # 4s lookback for local mean
    for i in range(window, len(rms_norm)):
        local_mean = float(np.mean(rms_norm[i-window:i]))
        if rms_norm[i] > local_mean + 0.30 and rms_norm[i] > 0.55:
            t = float(rms_times[i])
            # Don't add adjacent drops within 4 seconds
            if not drops or (t - drops[-1]["t"]) > 4.0:
                drops.append({"t": round(t, 2), "intensity": round(rms_norm[i], 3)})

    # ─── Sections via spectral segmentation ───
    sections = []
    try:
        # Compute chroma + recurrence-based segmentation
        chroma = librosa.feature.chroma_cens(y=y, sr=sr, hop_length=sr//4)
        bounds = librosa.segment.agglomerative(chroma, k=min(6, max(2, int(duration / 30))))
        bound_times = librosa.frames_to_time(bounds, sr=sr, hop_length=sr//4)
        # Pad to full duration
        bound_times = sorted(set([0.0, *bound_times.tolist(), duration]))
        # Label sections heuristically: low-RMS = "intro/outro", high-RMS = "chorus", mid = "verse"
        for i in range(len(bound_times) - 1):
            s, e = bound_times[i], bound_times[i+1]
            # Find RMS-mean in this section
            sec_rms = [v for t, v in zip(rms_times.tolist(), rms_norm) if s <= t < e]
            mean_v = float(np.mean(sec_rms)) if sec_rms else 0.5
            # Heuristic labels
            if i == 0 and mean_v < 0.4:
                label = "intro"
            elif i == len(bound_times) - 2 and mean_v < 0.4:
                label = "outro"
            elif mean_v > 0.7:
                label = "chorus"
            elif mean_v > 0.55:
                label = "drop"
            elif mean_v < 0.35:
                label = "bridge"
            else:
                label = "verse"
            sections.append({
                "startSec": round(float(s), 2),
                "endSec":   round(float(e), 2),
                "label":    label,
                "rms":      round(mean_v, 3),
            })
    except Exception as e:
        bridge.warn(f"Section detection failed: {e}")
        # Fall back to single section
        sections = [{"startSec": 0.0, "endSec": round(duration, 2), "label": "song", "rms": 0.5}]
    bridge.log(f"Detected {len(sections)} sections")

    return {
        "audioPath": audio_path,
        "duration": round(duration, 2),
        "tempo": round(tempo_val, 1),
        "beats": [round(float(b), 3) for b in beat_times],
        "downbeats": downbeats,
        "sections": sections,
        "rms": rms,
        "silence": silence,
        "spectralCentroid": spectral_centroid,
        "drops": drops,
    }


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("audioPath") or "").strip()
    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(f"audioPath '{audio_path}' is not a file")
        sys.exit(1)
    if not available():
        bridge.error("librosa not available. Install in venv: pip install librosa numpy")
        sys.exit(1)

    bridge.progress(0, 100, "Analyzing music…")

    # Cache result by audio-path hash → safe filename
    os.makedirs(CACHE_DIR, exist_ok=True)
    base_name = os.path.basename(audio_path).rsplit(".", 1)[0]
    safe_name = "".join(c if c.isalnum() else "_" for c in base_name)[:60]
    cache_path = (params.get("outputPath") or "").strip() \
        or os.path.join(CACHE_DIR, f"{safe_name}.json")

    if not dry_run and os.path.isfile(cache_path):
        # Use cache if file exists and is recent (< 30 days)
        try:
            import time
            age = time.time() - os.path.getmtime(cache_path)
            if age < 30 * 24 * 3600:
                with open(cache_path) as f:
                    data = json.load(f)
                bridge.log(f"Using cached analysis: {cache_path}")
                bridge.progress(100, 100, "Cached")
                bridge.result(data)
                return
        except Exception:  # noqa: BLE001
            pass

    if dry_run:
        bridge.result({"wouldAnalyze": audio_path, "cachePath": cache_path})
        return

    try:
        data = analyze(audio_path)
    except Exception as e:  # noqa: BLE001
        bridge.error(f"Analysis failed: {e}")
        sys.exit(1)

    bridge.progress(95, 100, "Saving cache…")
    with open(cache_path, "w") as f:
        json.dump(data, f, indent=2)
    bridge.log(f"Saved: {cache_path}")
    bridge.progress(100, 100, "Ferdig")
    bridge.result(data)


if __name__ == "__main__":
    bridge.main_guard(run)

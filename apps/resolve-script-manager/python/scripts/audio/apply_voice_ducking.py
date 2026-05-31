"""Apply Voice Ducking — sidechain-compress music under voice slik at
narrasjon/dialog blir tydelig mens music er det atmosfæriske underlaget.

Brukes som final-mix-step etter at music er valgt for et chapter.
Standard params følger broadcast-konvensjoner:
  - Ratio 4:1 (moderat dempning)
  - Threshold -25dB (utløses av normal tale)
  - Attack 5ms (rask dempning ved første vokal-onset)
  - Release 400ms (gradvis tilbake-løft etter siste vokal)
  - Makeup-gain +3dB (kompenser for total volume-loss)

ffmpeg sidechaincompress-filter implementerer dette i én pass.

Output via bridge.result():
  {
    "outputPath": "/path/mix.mp4",
    "audioBitrate": "192k",
    "duckingApplied": true,
    "voiceTrack": "/path/voice.wav",
    "musicTrack": "/path/music.mp3"
  }

Input params:
  voicePath:    path til voice/narration-track (eller video med voice)
  musicPath:    path til music-track
  outputPath:   final mixed-output (mp4 med stereo audio)
  ratio:        (optional, default 4)
  threshold:    (optional, default -25)
  attackMs:     (optional, default 5)
  releaseMs:    (optional, default 400)
  makeupDb:     (optional, default 3)
  musicGainDb:  (optional, default -5)   — base music-volume når voice IKKE er på
  voiceBoostDb: (optional, default 0)    — voice-pre-amp
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    voice_path = (params.get("voicePath") or "").strip()
    music_path = (params.get("musicPath") or "").strip()
    output_path = (params.get("outputPath") or "").strip()

    if not voice_path or not os.path.isfile(voice_path):
        bridge.error(f"voicePath '{voice_path}' mangler")
        sys.exit(1)
    if not music_path or not os.path.isfile(music_path):
        bridge.error(f"musicPath '{music_path}' mangler")
        sys.exit(1)
    if not output_path:
        bridge.error("outputPath er påkrevd")
        sys.exit(1)

    ratio = float(params.get("ratio") or 4)
    threshold = float(params.get("threshold") or -25)
    attack_ms = float(params.get("attackMs") or 5)
    release_ms = float(params.get("releaseMs") or 400)
    makeup_db = float(params.get("makeupDb") or 3)
    music_gain_db = float(params.get("musicGainDb") or -5)
    voice_boost_db = float(params.get("voiceBoostDb") or 0)

    if dry_run:
        bridge.result({
            "wouldMix": output_path,
            "params": {
                "ratio": ratio, "threshold": threshold,
                "attackMs": attack_ms, "releaseMs": release_ms,
                "makeupDb": makeup_db,
            },
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    # Output-dir
    out_dir = os.path.dirname(output_path)
    if out_dir: os.makedirs(out_dir, exist_ok=True)

    # ffmpeg filter_complex:
    #   1. Voice som [0:a] med eventuell boost
    #   2. Music som [1:a] med base-gain
    #   3. sidechaincompress: voice som key, music som signal
    #   4. amix av ducked-music + voice → output
    filter_complex = (
        f"[0:a]volume={voice_boost_db}dB[v];"
        f"[1:a]volume={music_gain_db}dB[m];"
        f"[m][v]sidechaincompress="
        f"threshold={threshold}dB:"
        f"ratio={ratio}:"
        f"attack={attack_ms}:"
        f"release={release_ms}:"
        f"makeup={makeup_db}[ducked];"
        f"[ducked][v]amix=inputs=2:duration=longest:weights='1 1'[mix]"
    )

    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "warning",
        "-i", voice_path,
        "-i", music_path,
        "-filter_complex", filter_complex,
        "-map", "0:v?",  # behold video hvis tilstede
        "-map", "[mix]",
        "-c:v", "copy",  # ikke re-encode video
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]

    bridge.log(
        f"Sidechain-compress: ratio={ratio}:1, threshold={threshold}dB, "
        f"attack={attack_ms}ms, release={release_ms}ms, makeup={makeup_db}dB"
    )
    bridge.log(f"Music base-gain: {music_gain_db}dB · voice-boost: {voice_boost_db}dB")

    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if r.returncode != 0:
            bridge.error(f"Mixing feilet: {r.stderr[-500:]}")
            sys.exit(1)
    except subprocess.TimeoutExpired:
        bridge.error("Mixing timeout (30 min)")
        sys.exit(1)

    if not os.path.isfile(output_path):
        bridge.error("Output-fil ble ikke generert")
        sys.exit(1)

    try:
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
    except OSError:
        size_mb = 0

    bridge.log(f"Ferdig: {output_path} ({size_mb:.1f} MB)")
    bridge.result({
        "outputPath": output_path,
        "audioBitrate": "192k",
        "duckingApplied": True,
        "sizeMB": round(size_mb, 1),
        "voiceTrack": voice_path,
        "musicTrack": music_path,
        "params": {
            "ratio": ratio,
            "thresholdDb": threshold,
            "attackMs": attack_ms,
            "releaseMs": release_ms,
            "makeupDb": makeup_db,
            "musicGainDb": music_gain_db,
            "voiceBoostDb": voice_boost_db,
        },
    })


bridge.main_guard(run)

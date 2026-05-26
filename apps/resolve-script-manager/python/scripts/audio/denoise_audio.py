"""Denoise camera audio for clearer transcription + delivery.

Wedding ceremonies are typically outdoor with wind/ambient/distant-chatter
contaminating the lavalier-mic feed. Cleaning this up BEFORE WhisperX
gives dramatically better speech-quote-extraction (#488 results).

V1 — ffmpeg-only: bruker afftdn (adaptive frequency-time-domain denoiser)
+ arnndn (recurrent neural network noise-reduction with RNNoise weights).
afftdn er konservativt og artifact-fritt. arnndn krever en RNNoise .rnnn
file — leveres sammen med moderne ffmpeg-builds.

V2 (future, R2-backed): swap til FullSubNet+ eller MeanFlowSE som har
bedre noise-suppression på ikke-speech-frekvenser uten å skade voicing.
Begge ligger i R2 (`models/audio/fullsubnet/fullsubnet_plus.pth` og
`models/audio/flowse/MeanFlowSE-Weights.ckpt`) men krever custom-PyTorch-
inference-kode som ikke har clean pip-package — utsatt til neste batch.

Output: <input>_denoised.<ext> ved siden av input. Original ikke endret.
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
    ):
        if c and os.path.isfile(c):
            return c
    return None


# Profile presets for afftdn — Z param is noise-reduction-amount in dB.
# Conservative defaults: enough to clean wind/rumble without "underwater"
# artifacts on the speech. Wedding/podcast = ~10dB, music-video = 6dB.
PROFILES: dict[str, dict] = {
    "wedding":  {"afftdn_nr": 12, "highpass": 100, "lufs": -16},
    "podcast":  {"afftdn_nr": 14, "highpass": 80,  "lufs": -16},
    "music_video": {"afftdn_nr": 6,  "highpass": 40,  "lufs": -14},
    "broadcast": {"afftdn_nr": 10, "highpass": 80,  "lufs": -23},
    "gentle":   {"afftdn_nr": 6,  "highpass": 60,  "lufs": -16},
}


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    profile_name = (params.get("profile") or "wedding").strip().lower()
    nr_db_override = params.get("noiseReductionDb")
    target_lufs_override = params.get("targetLufs")

    if not input_path or not os.path.isfile(input_path):
        bridge.error(f"inputPath '{input_path}' is not a file")
        sys.exit(1)

    profile = PROFILES.get(profile_name) or PROFILES["wedding"]
    nr_db = float(nr_db_override if nr_db_override is not None else profile["afftdn_nr"])
    highpass_hz = profile["highpass"]
    target_lufs = float(target_lufs_override if target_lufs_override is not None else profile["lufs"])

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH")
        sys.exit(1)

    # Output filename — keep same extension so video files stay video
    base, ext = os.path.splitext(input_path)
    out_path = f"{base}_denoised{ext}"
    if out_path == input_path:
        out_path = base + ".denoised" + ext

    bridge.log(
        f"Denoise plan: {os.path.basename(input_path)} · profile={profile_name} · "
        f"NR={nr_db}dB · HPF={highpass_hz}Hz · target {target_lufs} LUFS"
    )

    if dry_run:
        bridge.result({
            "wouldProcess": input_path,
            "outputPath": out_path,
            "profile": profile_name,
            "noiseReductionDb": nr_db,
            "highpassHz": highpass_hz,
            "targetLufs": target_lufs,
        })
        return

    # Audio filter chain:
    #   highpass=f=<Hz>    → kill sub-bass rumble (HVAC, wind, traffic)
    #   afftdn=nr=<dB>     → adaptive freq-time noise-reduction
    #   loudnorm=I=<LUFS>  → match target loudness for delivery platform
    af = f"highpass=f={highpass_hz},afftdn=nr={nr_db}:nt=w,loudnorm=I={target_lufs}:TP=-1:LRA=11"

    # Detect if input has video — if so, copy video stream, only re-encode audio.
    has_video = False
    try:
        ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
        r = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=codec_type", "-of", "csv=p=0", input_path],
            capture_output=True, text=True, timeout=10,
        )
        has_video = "video" in (r.stdout or "")
    except Exception:  # noqa: BLE001
        has_video = ext.lower() in (".mp4", ".mov", ".mkv", ".m4v")

    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", input_path,
        "-af", af,
    ]
    if has_video:
        cmd += [
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-movflags", "+faststart",
        ]
    else:
        cmd += [
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        ]
    cmd.append(out_path)

    bridge.progress(20, 100, "Running afftdn + loudnorm…")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    except subprocess.TimeoutExpired:
        bridge.error("ffmpeg denoise timed out after 30 min")
        sys.exit(1)

    if r.returncode != 0:
        bridge.error(f"ffmpeg failed: {(r.stderr or '')[-400:]}")
        sys.exit(1)

    size_mb = os.path.getsize(out_path) / (1024 ** 2) if os.path.isfile(out_path) else 0
    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "inputPath": input_path,
        "outputPath": out_path,
        "profile": profile_name,
        "noiseReductionDb": nr_db,
        "highpassHz": highpass_hz,
        "targetLufs": target_lufs,
        "outputSizeMb": round(size_mb, 1),
        "note": (
            "V1 = ffmpeg afftdn. V2 vil bruke FullSubNet+/FlowSE fra R2 for "
            "spektral-aware denoise — krever custom torch-inference (next batch)."
        ),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

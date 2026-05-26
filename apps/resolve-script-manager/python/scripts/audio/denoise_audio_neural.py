"""FullSubNet+ neural audio-denoise — V2 over ffmpeg afftdn.

FullSubNet+ (Xinmeng Xu et al, ICASSP 2022) er state-of-art speech
enhancement med full-band + sub-band fusion-arkitektur. R2 har vekter:
  models/audio/fullsubnet/fullsubnet_plus.pth

Sammenlignet med ffmpeg afftdn V1:
  + Mye renere speech på outdoor-wind / music-bleed / crowd-noise
  + Behold mer detalj på voiced/unvoiced transitions
  + Native 16kHz/48kHz support
  - Krever PyTorch, ~real-time på Apple Silicon
  - Ikke clean pip-package — bruker reference impl fra forskerens repo

Implementation choice — siden FullSubNet+ ikke har clean pip-package og
arkitekturen er kompleks (~600 linjer kode), denne scripten:

  1. Sjekker om fullsubnet_plus repo er klonet til
     ~/Library/Application Support/.../fullsubnet_plus_repo/
  2. Hvis ikke: walker user gjennom git clone-kommando
  3. Hvis ja: shell'er ut til reference inference-script med R2-downloaded
     weights
  4. Hvis FullSubNet ikke tilgjengelig: fallback til ffmpeg V1 (samme
     som existing denoise_audio.py)

Future inline-arch: når FullSubNet+ får offisiell pip-pakke (mistenker
2026), inline arkitekturen direkte. Per nå er wrapper-tilnærmingen mer
robust.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

bridge.reexec_in_venv_if_present()


FULLSUBNET_REPO_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/"
    "fullsubnet_plus_repo"
)
FULLSUBNET_REPO_URL = "https://github.com/RookieJunChen/FullSubNet-plus.git"


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _ensure_repo() -> bool:
    """Returns True if FullSubNet+ reference repo is present locally."""
    if os.path.isdir(os.path.join(FULLSUBNET_REPO_DIR, "speech_enhance")):
        return True
    return False


def _clone_instructions() -> str:
    return (
        f"FullSubNet+ reference repo not found at {FULLSUBNET_REPO_DIR}. "
        f"Install: git clone {FULLSUBNET_REPO_URL} {FULLSUBNET_REPO_DIR}"
    )


def _run_fullsubnet_inference(input_wav: str, output_wav: str,
                              weights_path: str) -> bool:
    """Invoke reference inference-script. Returns True on success."""
    # Reference repo has speech_enhance/tools/inference.py
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    python = venv_py if os.path.isfile(venv_py) else (shutil.which("python3") or "python3")
    inference_py = os.path.join(
        FULLSUBNET_REPO_DIR, "speech_enhance", "tools", "inference.py",
    )
    if not os.path.isfile(inference_py):
        bridge.warn(f"FullSubNet+ inference script not found at {inference_py}")
        return False
    try:
        r = subprocess.run(
            [python, inference_py,
             "-C", os.path.join(FULLSUBNET_REPO_DIR, "speech_enhance",
                                "fullsubnet_plus", "config",
                                "inference.toml"),
             "-M", weights_path,
             "-I", input_wav,
             "-O", output_wav],
            capture_output=True, text=True, timeout=1800,
            cwd=FULLSUBNET_REPO_DIR,
        )
        if r.returncode != 0:
            bridge.warn(f"FullSubNet+ inference exit {r.returncode}: {(r.stderr or '')[-300:]}")
            return False
        return os.path.isfile(output_wav) and os.path.getsize(output_wav) > 1024
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"FullSubNet+ inference failed: {exc}")
        return False


def _ffmpeg_fallback(ffmpeg: str, input_path: str, output_path: str,
                     nr_db: float, highpass_hz: int, target_lufs: float) -> bool:
    """V1 fallback — same chain som denoise_audio.py."""
    af = f"highpass=f={highpass_hz},afftdn=nr={nr_db}:nt=w,loudnorm=I={target_lufs}:TP=-1:LRA=11"
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", input_path,
        "-af", af,
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        output_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        return r.returncode == 0 and os.path.isfile(output_path)
    except Exception:  # noqa: BLE001
        return False


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    target_lufs = float(params.get("targetLufs") or -16.0)
    force_fallback = bool(params.get("forceFfmpegFallback", False))

    if not input_path or not os.path.isfile(input_path):
        bridge.error(f"inputPath '{input_path}' is not a file")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH")
        sys.exit(1)

    base, ext = os.path.splitext(input_path)
    out_path = f"{base}_denoised_neural{ext}"

    # Step 1: try FullSubNet+ neural path
    use_neural = not force_fallback and bridge.r2_is_configured() and _ensure_repo()

    bridge.log(
        f"Neural-denoise plan: {os.path.basename(input_path)} → {out_path}"
        + (" (FullSubNet+)" if use_neural else " (ffmpeg fallback)")
    )

    if dry_run:
        bridge.result({
            "wouldProcess": input_path,
            "outputPath": out_path,
            "engine": "fullsubnet_plus" if use_neural else "ffmpeg_afftdn",
            "fallbackReason": (
                None if use_neural else
                ("R2 not configured" if not bridge.r2_is_configured() else
                 "FullSubNet+ repo not installed" if not _ensure_repo() else
                 "forceFfmpegFallback=True")
            ),
        })
        return

    if use_neural:
        bridge.progress(5, 100, "Downloading FullSubNet+ weights from R2…")
        weights = bridge.r2_download(
            "models/audio/fullsubnet/fullsubnet_plus.pth",
            expected_min_bytes=50_000_000,
        )
        if not weights:
            bridge.warn("R2 download failed — falling back to ffmpeg afftdn")
            use_neural = False

    if use_neural:
        # Extract audio to mono 16kHz WAV (FullSubNet's expected input)
        import tempfile
        fd, mono_wav = tempfile.mkstemp(prefix="fsn_in_", suffix=".wav")
        os.close(fd)
        bridge.progress(15, 100, "Extracting mono 16kHz audio…")
        try:
            subprocess.run(
                [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                 "-i", input_path,
                 "-vn", "-acodec", "pcm_s16le",
                 "-ar", "16000", "-ac", "1",
                 mono_wav],
                capture_output=True, timeout=300, check=True,
            )
            bridge.progress(30, 100, "Running FullSubNet+ inference…")
            denoised_wav = mono_wav.replace(".wav", "_denoised.wav")
            ok = _run_fullsubnet_inference(mono_wav, denoised_wav, weights)
            if not ok:
                bridge.warn("FullSubNet+ inference failed — falling back to ffmpeg")
                use_neural = False
            else:
                # Re-mux denoised audio with original video (if any)
                bridge.progress(80, 100, "Muxing denoised audio…")
                cmd = [
                    ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                    "-i", input_path, "-i", denoised_wav,
                    "-map", "0:v?", "-map", "1:a",
                    "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                    "-af", f"loudnorm=I={target_lufs}:TP=-1:LRA=11",
                    "-shortest", out_path,
                ]
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
                if r.returncode != 0:
                    bridge.warn(f"ffmpeg mux failed: {(r.stderr or '')[-300:]}")
                    use_neural = False
        finally:
            for f in (mono_wav, mono_wav.replace(".wav", "_denoised.wav")):
                try: os.unlink(f)
                except OSError: pass

    if not use_neural:
        bridge.progress(50, 100, "Running ffmpeg afftdn fallback…")
        if not _ffmpeg_fallback(ffmpeg, input_path, out_path,
                                nr_db=12, highpass_hz=100, target_lufs=target_lufs):
            bridge.error("Both FullSubNet+ and ffmpeg fallback failed")
            sys.exit(1)

    out_size = os.path.getsize(out_path) if os.path.isfile(out_path) else 0
    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "inputPath": input_path,
        "outputPath": out_path,
        "engine": "fullsubnet_plus" if use_neural else "ffmpeg_afftdn_fallback",
        "outputSizeMb": round(out_size / (1024**2), 2),
        "installHint": (
            None if use_neural or not bridge.r2_is_configured() else _clone_instructions()
        ),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

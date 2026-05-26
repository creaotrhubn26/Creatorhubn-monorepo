"""XTTS-v2 multilingual voice-cloning TTS for narrator-voiceover.

Use case: Bjarne har vows på Urdu, men ønsker norsk-narrator-track i
parallel for norske familie-medlemmer. ELLER engelsk-versjon med voice-
cloned narrator-stemme for international-distribution.

XTTS-v2 (Coqui, BSD-3-Clause for non-commercial; commercial requires
coqui-tts CPL license) støtter 17 språk inkludert norsk + engelsk +
spansk + arabisk. Cloner stemme fra 6-sekund reference-audio. Stemmen
kan være Bjarne sin egen, en kunde-recording, eller en pre-recorded
narrator-stemme.

Pipeline:
  1. Parse input-script (txt-fil eller direct text-param)
  2. Last reference-stemme (6+ sek WAV)
  3. XTTS-v2 inference per setning → concat med fade
  4. Output: <script-name>_narrator.wav (eller .mp4 hvis user passer
     bg-video for overlay)

Krever: pip install TTS (~3GB med torch + audio deps).
Modell auto-downloaded fra HF/Coqui CDN ved første run (~2GB).
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


SUPPORTED_LANGUAGES = {
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl",
    "cs", "ar", "zh", "ja", "hu", "ko", "hi", "no",  # NO supported via XTTS-v2
}


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _has_tts() -> tuple[bool, str | None]:
    try:
        from TTS.api import TTS  # noqa: F401
        return True, None
    except ImportError:
        return False, "pip install TTS  (~3GB inkl torch + audio deps)"


def run(params: dict[str, Any], dry_run: bool) -> None:
    text = (params.get("text") or "").strip()
    script_path = (params.get("scriptPath") or "").strip()
    reference_audio = (params.get("referenceAudio") or "").strip()
    language = (params.get("language") or "no").strip().lower()
    output_path = (params.get("outputPath") or "").strip()
    overlay_video = (params.get("overlayVideo") or "").strip()
    overlay_audio_db = float(params.get("backgroundAudioDb") or -18.0)

    if not text and script_path:
        if not os.path.isfile(script_path):
            bridge.error(f"scriptPath '{script_path}' not found")
            sys.exit(1)
        with open(script_path, "r", encoding="utf-8") as f:
            text = f.read().strip()
    if not text:
        bridge.error("Provide either 'text' or 'scriptPath' with narrator script")
        sys.exit(1)
    if not reference_audio or not os.path.isfile(reference_audio):
        bridge.error(
            f"referenceAudio '{reference_audio}' is required (6+ sec WAV of "
            "the voice we should clone for narration)"
        )
        sys.exit(1)
    if language not in SUPPORTED_LANGUAGES:
        bridge.error(
            f"Language '{language}' not supported by XTTS-v2. "
            f"Available: {sorted(SUPPORTED_LANGUAGES)}"
        )
        sys.exit(1)

    ok, hint = _has_tts()
    if not ok:
        bridge.error(f"TTS package not installed. Install: {hint}")
        sys.exit(1)

    if not output_path:
        base, _ext = os.path.splitext(script_path or reference_audio)
        suffix = "_narrator"
        output_path = f"{base}{suffix}.wav"
        if overlay_video:
            output_path = output_path.replace(".wav", ".mp4")

    bridge.log(
        f"XTTS-v2 plan: language={language} · {len(text)} chars · "
        f"ref={os.path.basename(reference_audio)} → {output_path}"
    )

    if dry_run:
        bridge.result({
            "wouldGenerate": output_path,
            "language": language,
            "characters": len(text),
            "referenceAudio": reference_audio,
            "overlayVideo": overlay_video or None,
        })
        return

    bridge.progress(5, 100, "Loading XTTS-v2 model (first run downloads ~2GB)…")
    from TTS.api import TTS  # type: ignore
    import torch  # type: ignore
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    # Coqui's flagship multilingual voice-clone model
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

    # WAV output path for TTS step
    tts_wav = output_path if output_path.endswith(".wav") else (
        os.path.splitext(output_path)[0] + ".wav"
    )

    bridge.progress(25, 100, "Synthesising voice…")
    try:
        tts.tts_to_file(
            text=text,
            file_path=tts_wav,
            speaker_wav=reference_audio,
            language=language,
        )
    except Exception as exc:  # noqa: BLE001
        bridge.error(f"XTTS-v2 inference failed: {exc}")
        sys.exit(1)

    # If user wants narrator over background video → mux via ffmpeg
    if overlay_video and os.path.isfile(overlay_video):
        ffmpeg = _find_ffmpeg()
        if not ffmpeg:
            bridge.error("ffmpeg not on PATH — cannot mux narrator over video")
            sys.exit(1)
        bridge.progress(75, 100, f"Muxing narrator over {os.path.basename(overlay_video)}…")
        # Mix: original video audio at backgroundAudioDb + narrator full
        amix_filter = (
            f"[0:a]volume={overlay_audio_db}dB[bg];"
            "[1:a]volume=0dB[fg];"
            "[bg][fg]amix=inputs=2:duration=longest:dropout_transition=2[aout]"
        )
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-i", overlay_video,
            "-i", tts_wav,
            "-filter_complex", amix_filter,
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart",
            output_path,
        ]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        except subprocess.TimeoutExpired:
            bridge.error("ffmpeg mux timed out")
            sys.exit(1)
        if r.returncode != 0:
            bridge.error(f"ffmpeg mux failed: {(r.stderr or '')[-300:]}")
            sys.exit(1)

    out_size = os.path.getsize(output_path) if os.path.isfile(output_path) else 0
    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "outputPath": output_path,
        "language": language,
        "characters": len(text),
        "referenceAudio": reference_audio,
        "outputSizeMb": round(out_size / (1024**2), 2),
        "muxedOverVideo": bool(overlay_video and output_path.endswith(".mp4")),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""Extract Audio Waveform Data — gir et array med peak-amplitude per
bucket for visualisering i UI (MulticamSyncStudio).

Skiller seg fra extract_music_preview (som lager statisk PNG) ved at
denne returnerer rå data så frontend kan vise interaktive synkende
waveforms med offset-justeringer.

Output via bridge.result():
  {
    "waveformData": [0.12, 0.34, 0.56, 0.78, ...],  // 200 buckets, 0-1
    "durationSec": 312.4,
    "bucketCount": 200,
    "filePath": "/path/source.mp4"
  }
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import wave
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


def _extract_wav_lowres(ffmpeg: str, src: str, out: str) -> bool:
    """Ekstraher som 8000 Hz mono — godt nok for waveform-visualisering
    og veldig kjapt."""
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", src,
        "-vn", "-ac", "1", "-ar", "8000",
        "-acodec", "pcm_s16le", out,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return r.returncode == 0 and os.path.isfile(out)
    except subprocess.TimeoutExpired:
        return False


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("audioPath") or "").strip()
    bucket_count = int(params.get("bucketCount") or 200)
    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(f"audioPath '{audio_path}' mangler")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldExtract": audio_path,
            "bucketCount": bucket_count,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = os.path.join(tmpdir, "audio.wav")
        if not _extract_wav_lowres(ffmpeg, audio_path, wav_path):
            bridge.error("Kunne ikke ekstrahere lyd")
            sys.exit(1)

        try:
            wf = wave.open(wav_path, "rb")
            sr = wf.getframerate()
            n_frames = wf.getnframes()
            raw = wf.readframes(n_frames)
            wf.close()
        except Exception as exc:
            bridge.error(f"Kunne ikke lese WAV: {exc}")
            sys.exit(1)

        import array
        samples = array.array("h")
        samples.frombytes(raw)

        duration = n_frames / sr
        bucket_size = max(1, n_frames // bucket_count)

        # Peak-amplitude per bucket
        waveform = []
        for i in range(bucket_count):
            start = i * bucket_size
            end = min(n_frames, (i + 1) * bucket_size)
            if end > start:
                chunk = samples[start:end]
                peak = max(abs(s) for s in chunk) / 32768.0
                waveform.append(round(peak, 3))
            else:
                waveform.append(0)

        bridge.result({
            "waveformData": waveform,
            "durationSec": round(duration, 2),
            "bucketCount": bucket_count,
            "filePath": audio_path,
        })


bridge.main_guard(run)

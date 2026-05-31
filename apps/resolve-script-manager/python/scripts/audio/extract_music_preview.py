"""Extract Music Preview — generér waveform-PNG og kort audio-preview
for music-library UI.

Output:
  - Waveform PNG: 600×100, viser amplitude over tid (mørk-lilla på
    transparent bakgrunn for Role Room brand-konsistens)
  - Audio preview: 30 sek mp3-clip startende fra 25% inn (typisk
    "chorus" eller "verse-2" — best representativt)
"""

from __future__ import annotations

import hashlib
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


def _get_duration(ffmpeg: str, path: str) -> float:
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    if os.path.isfile(ffprobe):
        try:
            r = subprocess.run([
                ffprobe, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "csv=p=0", path,
            ], capture_output=True, text=True, timeout=20)
            if r.returncode == 0:
                return float(r.stdout.strip() or 0)
        except (ValueError, subprocess.TimeoutExpired): pass
    return 0.0


def _path_hash(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("audioPath") or "").strip()
    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(f"audioPath '{audio_path}' mangler")
        sys.exit(1)

    output_dir = (params.get("outputDir") or "").strip()
    if not output_dir:
        output_dir = os.path.expanduser(
            "~/Library/Application Support/"
            "no.creatorhubn.roleroom-post-agent/music_previews"
        )
    os.makedirs(output_dir, exist_ok=True)

    if dry_run:
        bridge.result({
            "wouldGenerate": audio_path, "outputDir": output_dir,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    h = _path_hash(audio_path)
    duration = _get_duration(ffmpeg, audio_path)
    if duration <= 0:
        bridge.error("Kunne ikke lese duration")
        sys.exit(1)

    # Waveform PNG via showwavespic-filter (Role Room-lilla)
    waveform_png = os.path.join(output_dir, f"wave_{h}.png")
    cmd_wave = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", audio_path,
        "-filter_complex",
        "[0:a]aformat=channel_layouts=mono,"
        "showwavespic=s=600x100:colors=0xa030c0",
        "-frames:v", "1",
        waveform_png,
    ]
    try:
        subprocess.run(cmd_wave, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        bridge.warn("Waveform timeout")

    # Audio preview: 30 sek fra 25%-mark (typisk informativ del av låt)
    preview_start = max(0, min(duration * 0.25, max(0, duration - 30)))
    preview_dur = min(30.0, max(5.0, duration - preview_start))
    preview_mp3 = os.path.join(output_dir, f"preview_{h}.mp3")
    cmd_preview = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", str(preview_start), "-i", audio_path,
        "-t", str(preview_dur),
        "-c:a", "libmp3lame", "-b:a", "128k",
        "-ac", "2",
        preview_mp3,
    ]
    try:
        subprocess.run(cmd_preview, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        bridge.warn("Preview-mp3 timeout")

    wave_exists = os.path.isfile(waveform_png)
    preview_exists = os.path.isfile(preview_mp3)
    bridge.log(
        f"Waveform: {'OK' if wave_exists else 'FEIL'}, "
        f"Preview: {'OK' if preview_exists else 'FEIL'}"
    )
    bridge.result({
        "waveformImagePath": waveform_png if wave_exists else None,
        "previewAudioPath": preview_mp3 if preview_exists else None,
        "durationSec": round(duration, 1),
    })


bridge.main_guard(run)

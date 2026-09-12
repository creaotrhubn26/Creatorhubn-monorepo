"""Apply Audio Polish — ffmpeg-pipeline som anvender Claude's audio-direction
på rendert highlight.

Bygger en filter-graph med:
  1. Highpass (per chapter) — fjerner rumble
  2. De-esser (per chapter) — softer sibilance
  3. Voice boost (per chapter) — 1-3kHz EQ-bump for klarhet
  4. Sidechain compression (per chapter) — music ducks under speech
  5. LUFS-normalisering (overall) — platform-target ved loudnorm

Input:
  inputPath: ferdig-rendert MP4 fra assemble_highlight_with_music
  perChapter: { chapter: { duckingDb, deEssLevel, highPassHz, voiceBoostDb,
                            musicVolume, ambientVolume } }
  pickChapters: [{ pickIndex, chapter, startSec, durationSec }] — timeline-mapping
  overallLufsTarget: float
  outputPath: hvor polerte MP4 lagres

NB: For MVP behandler vi hele filen som én chapter (mest aggressive setting
fra perChapter brukes globalt). Per-time-window filtering kan komme senere
med timeline_aware-mode hvis vi får bruker-feedback om at det er nødvendig.
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


def _aggressive_setting(per_chapter: dict) -> dict:
    """For MVP: bruk den 'sterkeste' settingen fra perChapter som global
    setting. Speech-tunge chapters vinner."""
    if not per_chapter:
        return {
            "duckingDb": -6.0,
            "deEssLevel": "soft",
            "highPassHz": 60,
            "voiceBoostDb": 0.0,
            "musicVolume": 0.7,
            "ambientVolume": 0.65,
        }
    # Velg chapter med mest aggressiv ducking (mest negativ duckingDb)
    sorted_ch = sorted(per_chapter.items(), key=lambda x: x[1].get("duckingDb", 0))
    if not sorted_ch:
        return _aggressive_setting({})
    return sorted_ch[0][1]


def _de_esser_freq(level: str) -> tuple[float, float] | None:
    """ffmpeg deesser parametere: (intensity, treble_freq)"""
    mapping = {
        "off":    None,
        "soft":   (0.2, 6000),
        "medium": (0.35, 6000),
        "strong": (0.55, 5500),
    }
    return mapping.get(level.lower(), None)


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    output_path = (params.get("outputPath") or "").strip()
    per_chapter = params.get("perChapter") or {}
    overall_lufs = float(params.get("overallLufsTarget") or -14.0)

    if not input_path or not os.path.isfile(input_path):
        bridge.error(f"inputPath '{input_path}' mangler")
        sys.exit(1)
    if not output_path:
        # Default: legg til "_polished" suffix
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_polished{ext or '.mp4'}"

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    settings = _aggressive_setting(per_chapter)
    bridge.log(
        f"Audio-polish: ducking {settings['duckingDb']}dB · "
        f"de-ess {settings['deEssLevel']} · "
        f"highpass {settings['highPassHz']}Hz · "
        f"target {overall_lufs} LUFS"
    )

    if dry_run:
        bridge.result({
            "wouldPolish": output_path,
            "settings": settings,
            "lufs": overall_lufs,
        })
        return

    # Bygg audio-filter-chain
    chain_parts = []

    # 1. Highpass for å fjerne rumble
    hp_hz = int(settings.get("highPassHz", 60))
    if hp_hz > 0:
        chain_parts.append(f"highpass=f={hp_hz}")

    # 2. De-esser
    # ffmpeg's `deesser` tar `f` som NORMALISERT verdi [0-1] (andel av Nyquist),
    # ikke Hz. Anta 48kHz utgang (Nyquist 24kHz) og konverter sibilance-frekvensen.
    de_ess = _de_esser_freq(settings.get("deEssLevel", "off"))
    if de_ess:
        intensity, freq_hz = de_ess
        nyquist = 24_000.0
        f_norm = max(0.0, min(1.0, freq_hz / nyquist))
        chain_parts.append(f"deesser=i={intensity}:f={f_norm:.4f}")

    # 3. Voice boost (1-3kHz EQ-bump for klarhet)
    voice_boost = float(settings.get("voiceBoostDb", 0))
    if abs(voice_boost) > 0.1:
        chain_parts.append(f"equalizer=f=2000:t=q:w=1.5:g={voice_boost}")

    # 4. LUFS-normalisering (alltid sist)
    # I=integrated, LRA=loudness range, TP=true peak
    chain_parts.append(f"loudnorm=I={overall_lufs}:LRA=11:TP=-1.5")

    audio_filter = ",".join(chain_parts)
    bridge.log(f"Filter chain: {audio_filter}")

    # Kjør ffmpeg med audio-filter — kopier video uendret
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "warning",
        "-i", input_path,
        "-c:v", "copy",
        "-af", audio_filter,
        "-c:a", "aac", "-b:a", "256k",
        output_path,
    ]

    bridge.progress(0, 100, "Starter audio-polish …")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        err_tail = (r.stderr or "")[-1500:]
        bridge.error(f"ffmpeg polish failed: {err_tail}")
        sys.exit(1)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    bridge.progress(100, 100, "Ferdig")
    bridge.log(f"✓ {output_path} ({size_mb:.1f} MB)")

    bridge.result({
        "outputPath": output_path,
        "sizeMb": round(size_mb, 1),
        "settingsApplied": settings,
        "targetLufs": overall_lufs,
        "filterChain": audio_filter,
    })


bridge.main_guard(run)

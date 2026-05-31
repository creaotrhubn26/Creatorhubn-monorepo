"""Analyze Audio Beats — detect BPM + downbeat-tider fra audio/video-fil.

Brukes av Music Video Agent for å automatisk fylle BPM, beat-grid og
chapter-grenser uten manuell input.

Strategi (tre lag, faller stille tilbake):
  1. librosa (anbefalt) — robust beat-tracking + tempo-estimate
  2. aubio (lett, raskt) — onset + tempo
  3. pyloudnorm-fallback — kun energi-baseret onset, ingen BPM

Output via bridge.result():
  {
    "bpm": 124.5,
    "confidence": 0.87,        # 0-1 hvor sikker tempo-estimaten er
    "beatTimes": [0.41, 0.89, 1.37, ...],   # alle beats i sek
    "downbeatTimes": [0.41, 2.34, ...],     # bar-start (hver 4. beat)
    "beatsPerBar": 4,
    "totalBars": 116,
    "totalDurationSec": 224.7,
    "method": "librosa" | "aubio" | "fallback"
  }

Input params:
  audioPath:  sti til lyd- eller videofil (ffmpeg konverterer ved behov)
  startSec:   (optional) hopp over første N sekunder
  durationSec: (optional) analyser maks N sekunder
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
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


def _extract_audio_wav(ffmpeg: str, video_path: str, out_wav: str,
                       start_sec: float = 0, duration_sec: float | None = None) -> bool:
    """Konverter input til 22 050 Hz mono WAV (librosa standard sample-rate)."""
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"]
    if start_sec > 0:
        cmd += ["-ss", str(start_sec)]
    cmd += ["-i", video_path]
    if duration_sec is not None:
        cmd += ["-t", str(duration_sec)]
    cmd += [
        "-vn",  # no video
        "-ac", "1",  # mono
        "-ar", "22050",  # standard for librosa
        "-acodec", "pcm_s16le",
        out_wav,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return r.returncode == 0 and os.path.isfile(out_wav)
    except subprocess.TimeoutExpired:
        return False


def _analyze_with_librosa(wav_path: str) -> dict[str, Any] | None:
    """Robust BPM + beat-tracking via librosa. Returnerer None hvis ikke installert."""
    try:
        import librosa  # type: ignore
        import numpy as np
    except ImportError:
        return None

    try:
        y, sr = librosa.load(wav_path, sr=22050, mono=True)
        # Estimate tempo med dynamic programming beat-tracker
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

        # Tempo-confidence via onset-strength autocorrelation
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempogram = librosa.feature.tempogram(onset_envelope=onset_env, sr=sr)
        # Confidence = peak/std ratio på tempogram
        peak = float(np.max(tempogram))
        std = float(np.std(tempogram)) + 1e-6
        confidence = min(1.0, peak / (std * 4))

        bpm = float(tempo)
        beats_per_bar = 4
        # Downbeats: hver 4. beat (4/4 antakelse — kan utvides)
        downbeat_times = beat_times[::beats_per_bar]

        return {
            "bpm": round(bpm, 1),
            "confidence": round(confidence, 2),
            "beatTimes": [round(t, 3) for t in beat_times],
            "downbeatTimes": [round(t, 3) for t in downbeat_times],
            "beatsPerBar": beats_per_bar,
            "totalBars": len(downbeat_times),
            "totalDurationSec": round(librosa.get_duration(y=y, sr=sr), 1),
            "method": "librosa",
        }
    except Exception as exc:
        bridge.warn(f"librosa-analyse feilet: {exc}")
        return None


def _analyze_with_aubio(wav_path: str) -> dict[str, Any] | None:
    """Lett tempo-estimate via aubio. Returnerer None hvis ikke installert."""
    try:
        import aubio  # type: ignore
    except ImportError:
        return None

    try:
        win_s = 1024
        hop_s = win_s // 2
        s = aubio.source(wav_path, 22050, hop_s)
        sr = s.samplerate
        o = aubio.tempo("default", win_s, hop_s, sr)

        beat_times: list[float] = []
        total_frames = 0
        while True:
            samples, read = s()
            if o(samples):
                beat_times.append(o.get_last_s())
            total_frames += read
            if read < hop_s: break

        if len(beat_times) < 4:
            return None

        # BPM = 60 / median-IBI
        intervals = [b - a for a, b in zip(beat_times[:-1], beat_times[1:])]
        intervals.sort()
        median = intervals[len(intervals) // 2]
        bpm = round(60.0 / median, 1)

        beats_per_bar = 4
        downbeat_times = beat_times[::beats_per_bar]
        total_dur = total_frames / sr

        return {
            "bpm": bpm,
            "confidence": 0.65,  # aubio gir ikke confidence — fast estimat
            "beatTimes": [round(t, 3) for t in beat_times],
            "downbeatTimes": [round(t, 3) for t in downbeat_times],
            "beatsPerBar": beats_per_bar,
            "totalBars": len(downbeat_times),
            "totalDurationSec": round(total_dur, 1),
            "method": "aubio",
        }
    except Exception as exc:
        bridge.warn(f"aubio-analyse feilet: {exc}")
        return None


def _analyze_with_fallback(wav_path: str, ffmpeg: str) -> dict[str, Any]:
    """Siste utvei: ffmpeg ebur128 + simpel onset-deteksjon. Gir IKKE
    nøyaktig BPM — bare et estimat basert på energy-flux. Brukeren må
    fine-tune manuelt."""
    try:
        # Bruk ffmpeg's silencedetect for å finne energy-onsets som approx
        cmd = [
            ffmpeg, "-hide_banner", "-i", wav_path,
            "-af", "silencedetect=noise=-30dB:d=0.05",
            "-f", "null", "-",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        lines = r.stderr.split("\n")
        onset_times = []
        for line in lines:
            if "silence_end:" in line:
                try:
                    t = float(line.split("silence_end:")[1].split("|")[0].strip())
                    onset_times.append(t)
                except (ValueError, IndexError): continue

        if len(onset_times) < 4:
            return {
                "bpm": 120.0, "confidence": 0.0,
                "beatTimes": [], "downbeatTimes": [],
                "beatsPerBar": 4, "totalBars": 0, "totalDurationSec": 0.0,
                "method": "fallback-empty",
            }

        # Estimer BPM fra onset-intervall median
        intervals = [b - a for a, b in zip(onset_times[:-1], onset_times[1:])]
        intervals = [i for i in intervals if 0.2 < i < 1.5]  # filter outliers
        if not intervals:
            bpm = 120.0
        else:
            intervals.sort()
            median = intervals[len(intervals) // 2]
            bpm = round(60.0 / median, 1)

        return {
            "bpm": bpm,
            "confidence": 0.30,  # Lav — vi gjetter
            "beatTimes": [round(t, 3) for t in onset_times],
            "downbeatTimes": [round(t, 3) for t in onset_times[::4]],
            "beatsPerBar": 4,
            "totalBars": len(onset_times) // 4,
            "totalDurationSec": round(onset_times[-1], 1) if onset_times else 0.0,
            "method": "fallback",
        }
    except Exception as exc:
        bridge.warn(f"fallback-analyse feilet: {exc}")
        return {
            "bpm": 120.0, "confidence": 0.0,
            "beatTimes": [], "downbeatTimes": [],
            "beatsPerBar": 4, "totalBars": 0, "totalDurationSec": 0.0,
            "method": "fallback-empty",
        }


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("audioPath") or "").strip()
    start_sec = float(params.get("startSec") or 0)
    duration_sec_raw = params.get("durationSec")
    duration_sec = float(duration_sec_raw) if duration_sec_raw else None

    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(f"audioPath '{audio_path}' mangler eller eksisterer ikke")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldAnalyze": audio_path,
            "wouldCheckMethods": ["librosa", "aubio", "fallback"],
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet — kreves for audio-extraction")
        sys.exit(1)

    bridge.log(f"Analyserer beats fra {os.path.basename(audio_path)} …")

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = os.path.join(tmpdir, "audio.wav")
        if not _extract_audio_wav(ffmpeg, audio_path, wav_path,
                                  start_sec=start_sec,
                                  duration_sec=duration_sec):
            bridge.error("Kunne ikke extracte lyd fra source")
            sys.exit(1)

        # Try librosa → aubio → fallback
        result = _analyze_with_librosa(wav_path)
        if result is None:
            bridge.log("librosa ikke tilgjengelig — prøver aubio …")
            result = _analyze_with_aubio(wav_path)
        if result is None:
            bridge.log("aubio ikke tilgjengelig — bruker ffmpeg-fallback …")
            result = _analyze_with_fallback(wav_path, ffmpeg)

        bridge.log(
            f"BPM: {result['bpm']} (konfidens {result['confidence']}) "
            f"via {result['method']} · {result['totalBars']} bars"
        )
        bridge.result(result)


bridge.main_guard(run)

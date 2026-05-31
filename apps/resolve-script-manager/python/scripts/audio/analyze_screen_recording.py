"""Analyze Screen Recording — silence-gaps, klikk-momenter og narration-
segmenter for screen-capture-content.

Brukes av Screen Recording Agent for å:
  - Auto-trimme silens-gaps (>0.6s)
  - Identifisere klikk-momenter for click-zoom-keyframer
  - Detekt narration-segmenter for chapter-grenser

Strategi:
  1. ffmpeg silencedetect — finner stillhet-gaps
  2. Audio energy onset (RMS-flux) — kandidat-klikk
  3. Speech-segmenter = ikke-stillhet, ikke-klikk-burst

Output via bridge.result():
  {
    "totalDurationSec": 312.4,
    "silenceGaps": [
      { "startSec": 12.4, "endSec": 13.2, "durationSec": 0.8 },
      ...
    ],
    "speechSegments": [
      { "startSec": 0.0, "endSec": 12.4 },
      ...
    ],
    "clickCandidates": [
      { "atSec": 24.1, "confidence": 0.78 },
      ...
    ],
    "totalSilenceSec": 18.2,
    "trimSavingsSec": 14.6,   // hvor mye som kan trimmes hvis silenser >0.6s fjernes
    "totalSpeechSec": 294.2,
    "estimatedAfterTrimSec": 297.8
  }

Input params:
  audioPath:           sti til lyd- eller videofil
  silenceMinDurSec:    (optional, default 0.6) min varighet for å regnes
                       som silens som bør trimmes
  silenceNoiseDb:      (optional, default -30) audio-nivå under dette =
                       stillhet
  clickEnergyThreshold: (optional, default 1.8) RMS-flux ratio over
                        median for å regnes som klikk-kandidat
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


def _extract_audio_wav(ffmpeg: str, video_path: str, out_wav: str) -> bool:
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", video_path,
        "-vn", "-ac", "1", "-ar", "22050",
        "-acodec", "pcm_s16le",
        out_wav,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        return r.returncode == 0 and os.path.isfile(out_wav)
    except subprocess.TimeoutExpired:
        return False


def _detect_silences(ffmpeg: str, wav_path: str,
                     min_dur: float, noise_db: int) -> list[dict[str, float]]:
    """Bruk ffmpeg silencedetect for å finne stille-gaps."""
    cmd = [
        ffmpeg, "-hide_banner", "-i", wav_path,
        "-af", f"silencedetect=noise={noise_db}dB:d={min_dur}",
        "-f", "null", "-",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    lines = r.stderr.split("\n")
    silences: list[dict[str, float]] = []
    current_start: float | None = None
    for line in lines:
        if "silence_start:" in line:
            try:
                current_start = float(line.split("silence_start:")[1].strip())
            except (ValueError, IndexError): pass
        elif "silence_end:" in line and current_start is not None:
            try:
                end = float(line.split("silence_end:")[1].split("|")[0].strip())
                silences.append({
                    "startSec": round(current_start, 3),
                    "endSec": round(end, 3),
                    "durationSec": round(end - current_start, 3),
                })
                current_start = None
            except (ValueError, IndexError): pass
    return silences


def _detect_click_candidates(wav_path: str,
                              energy_threshold: float) -> list[dict[str, float]]:
    """Lett RMS-energi onset-deteksjon. Klikk lager karakteristisk burst
    av høyere energi enn talen — vi finner hvor RMS-deltaet plutselig
    øker. Ikke perfekt, men det fungerer som kandidatliste."""
    clicks: list[dict[str, float]] = []
    try:
        wf = wave.open(wav_path, "rb")
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
        wf.close()

        # Parse som int16 PCM
        import array
        samples = array.array("h")
        samples.frombytes(raw)

        # Window-RMS over 50 ms chunks
        win_sec = 0.05
        win_samples = max(1, int(sr * win_sec))
        rms_values: list[float] = []
        for i in range(0, len(samples) - win_samples, win_samples):
            chunk = samples[i:i + win_samples]
            sum_sq = 0
            for s in chunk: sum_sq += s * s
            rms = (sum_sq / win_samples) ** 0.5
            rms_values.append(rms)

        if len(rms_values) < 10:
            return []

        # Median som baseline; finn flux-toppen
        sorted_rms = sorted(rms_values)
        median = sorted_rms[len(sorted_rms) // 2]
        if median < 100:  # for stille audio
            return []

        # Onset hvis chunk-RMS > baseline*threshold AND høyere enn forrige
        last_click_time = -10.0
        for i in range(1, len(rms_values) - 1):
            if rms_values[i] > median * energy_threshold and \
               rms_values[i] > rms_values[i - 1] * 1.4:
                t = i * win_sec
                # Suppress: minst 0.2s mellom klikk-kandidater
                if t - last_click_time < 0.2: continue
                confidence = min(1.0, rms_values[i] / (median * energy_threshold * 2))
                clicks.append({"atSec": round(t, 3),
                               "confidence": round(confidence, 2)})
                last_click_time = t
    except Exception as exc:
        bridge.warn(f"Click-detect feilet: {exc}")
    return clicks


def _get_duration(wav_path: str) -> float:
    try:
        wf = wave.open(wav_path, "rb")
        sr = wf.getframerate()
        n = wf.getnframes()
        wf.close()
        return n / sr
    except Exception: return 0.0


def _derive_speech_segments(total_dur: float,
                             silences: list[dict[str, float]]) -> list[dict[str, float]]:
    """Speech = alt som ikke er silens."""
    if not silences:
        return [{"startSec": 0.0, "endSec": round(total_dur, 3)}]
    segments: list[dict[str, float]] = []
    cursor = 0.0
    for s in silences:
        if s["startSec"] > cursor:
            segments.append({
                "startSec": round(cursor, 3),
                "endSec": round(s["startSec"], 3),
            })
        cursor = s["endSec"]
    if cursor < total_dur:
        segments.append({
            "startSec": round(cursor, 3),
            "endSec": round(total_dur, 3),
        })
    return segments


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("audioPath") or "").strip()
    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(f"audioPath '{audio_path}' mangler")
        sys.exit(1)

    silence_min_dur = float(params.get("silenceMinDurSec") or 0.6)
    silence_noise_db = int(params.get("silenceNoiseDb") or -30)
    click_threshold = float(params.get("clickEnergyThreshold") or 1.8)

    if dry_run:
        bridge.result({
            "wouldAnalyze": audio_path,
            "silenceMinDur": silence_min_dur,
            "silenceNoiseDb": silence_noise_db,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    bridge.log(f"Analyserer screen-recording {os.path.basename(audio_path)} …")

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = os.path.join(tmpdir, "audio.wav")
        if not _extract_audio_wav(ffmpeg, audio_path, wav_path):
            bridge.error("Kunne ikke extracte lyd")
            sys.exit(1)

        total_dur = _get_duration(wav_path)
        bridge.progress(1, 3, "Detekterer silenser")
        silences = _detect_silences(ffmpeg, wav_path, silence_min_dur, silence_noise_db)
        bridge.progress(2, 3, f"{len(silences)} silenser funnet · detekterer klikk")
        clicks = _detect_click_candidates(wav_path, click_threshold)
        bridge.progress(3, 3, f"{len(clicks)} klikk-kandidater")

        speech_segments = _derive_speech_segments(total_dur, silences)
        total_silence = sum(s["durationSec"] for s in silences)
        total_speech = total_dur - total_silence
        # Trim-savings = silens-tid minus minimum-puste-buffer (0.2s per silens)
        trim_savings = max(0, total_silence - 0.2 * len(silences))
        estimated_after = total_dur - trim_savings

        result = {
            "totalDurationSec": round(total_dur, 1),
            "silenceGaps": silences,
            "speechSegments": speech_segments,
            "clickCandidates": clicks,
            "totalSilenceSec": round(total_silence, 1),
            "trimSavingsSec": round(trim_savings, 1),
            "totalSpeechSec": round(total_speech, 1),
            "estimatedAfterTrimSec": round(estimated_after, 1),
            "silenceCount": len(silences),
            "clickCount": len(clicks),
        }
        bridge.log(
            f"Stille: {result['totalSilenceSec']}s ({len(silences)} gaps) · "
            f"klikk-kandidater: {len(clicks)} · "
            f"trim-savings: {result['trimSavingsSec']}s"
        )
        bridge.result(result)


bridge.main_guard(run)

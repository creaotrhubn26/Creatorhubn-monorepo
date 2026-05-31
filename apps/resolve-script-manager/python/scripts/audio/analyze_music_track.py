"""Analyze Music Track — librosa-basert audio-analyse for music-library.

Output strukturert JSON som driver music-suggestion-matching mot
chapter-context og BPM-range, samt foundation for auto-ducking og
beat-aligned cuts.

Strategi:
  1. ffmpeg → 22050 Hz mono WAV (librosa-standard)
  2. librosa.beat.beat_track → BPM + beat_times
  3. librosa.feature.tonnetz / chroma → key + mode (Krumhansl-Schmuckler)
  4. librosa.feature.rms → energy_curve over tid (40 buckets)
  5. librosa.onset → segment-grenser → guess intro/verse/chorus/bridge/outro
  6. spectral features → genre/mood-tags via heuristikker

Output via bridge.result():
  {
    "bpm": 124.5,
    "bpmConfidence": 0.87,
    "key": "C", "mode": "major",
    "durationSec": 192.4,
    "energyCurve": [0.12, 0.18, ...],   // 40 buckets, normalized 0-1
    "energyAverage": 0.45,
    "energyPeak": 0.88,
    "spectralCentroidAvg": 1820.5,
    "rmsAvg": 0.18,
    "segments": [
      { "type": "intro", "start": 0, "end": 12.4, "energy": 0.25 },
      { "type": "verse", "start": 12.4, "end": 36.8, "energy": 0.45 },
      { "type": "chorus", "start": 36.8, "end": 60.2, "energy": 0.75 },
      ...
    ],
    "moodTags": ["energetic", "uplifting", "driving"],
    "suggestedFor": ["chorus", "high-energy", "outro"],
    "tags": [...],
    "method": "librosa"
  }
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


KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


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


def _extract_wav(ffmpeg: str, src: str, out: str) -> bool:
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", src, "-vn", "-ac", "1", "-ar", "22050",
        "-acodec", "pcm_s16le", out,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        return r.returncode == 0 and os.path.isfile(out)
    except subprocess.TimeoutExpired:
        return False


def _detect_key(chroma_avg: list[float]) -> tuple[str, str, float]:
    """Krumhansl-Schmuckler key-detection. Returnerer (key, mode, confidence)."""
    # Empiriske major + minor key-profiler (Krumhansl 1990)
    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

    def correlation(profile: list[float], offset: int) -> float:
        rotated = [chroma_avg[(i + offset) % 12] for i in range(12)]
        # Pearson correlation
        n = 12
        mean_p = sum(profile) / n
        mean_r = sum(rotated) / n
        cov = sum((profile[i] - mean_p) * (rotated[i] - mean_r) for i in range(n))
        var_p = sum((profile[i] - mean_p) ** 2 for i in range(n)) ** 0.5
        var_r = sum((rotated[i] - mean_r) ** 2 for i in range(n)) ** 0.5
        if var_p == 0 or var_r == 0: return 0
        return cov / (var_p * var_r)

    best_key = "C"
    best_mode = "major"
    best_corr = -1.0
    for i in range(12):
        c_maj = correlation(major_profile, i)
        c_min = correlation(minor_profile, i)
        if c_maj > best_corr:
            best_corr = c_maj
            best_key = KEY_NAMES[i]
            best_mode = "major"
        if c_min > best_corr:
            best_corr = c_min
            best_key = KEY_NAMES[i]
            best_mode = "minor"
    return (best_key, best_mode, max(0.0, min(1.0, (best_corr + 1) / 2)))


def _classify_segment(energy: float, position_pct: float) -> str:
    """Heuristisk klassifisering av segment-type basert på energi-nivå
    og posisjon i låten."""
    if position_pct < 0.10: return "intro"
    if position_pct > 0.85:
        return "outro" if energy < 0.45 else "final-chorus"
    if energy < 0.30: return "break"
    if energy > 0.65: return "chorus"
    if energy > 0.45: return "verse"
    return "bridge"


def _derive_mood_tags(
    energy_avg: float, energy_peak: float,
    spectral_centroid_avg: float, bpm: float,
    mode: str,
) -> list[str]:
    """Map audio-features til mood-tags. Hand-tuned heuristikker for
    konsistent vokabular."""
    tags = []
    # Energy-baserte
    if energy_avg > 0.55:
        tags.append("energetic")
    if energy_avg > 0.70:
        tags.append("intense")
    if energy_avg < 0.30:
        tags.append("calm")
    if energy_avg < 0.20:
        tags.append("ambient")
    if energy_peak > 0.85:
        tags.append("dynamic")

    # Spectral brightness (centroid)
    if spectral_centroid_avg > 2500:
        tags.append("bright")
    elif spectral_centroid_avg < 1200:
        tags.append("warm")

    # BPM
    if bpm < 80:
        tags.append("slow")
        tags.append("contemplative")
    elif bpm < 110:
        tags.append("midtempo")
    elif bpm < 140:
        tags.append("driving")
    else:
        tags.append("uptempo")

    # Mode
    if mode == "minor":
        tags.append("melancholic")
    else:
        tags.append("uplifting")

    return tags


def _derive_suggested_for(
    energy_avg: float, bpm: float, mode: str,
) -> list[str]:
    """Hvilke chapter-typer denne tracken passer i."""
    s = []
    if energy_avg < 0.30:
        s.extend(["intro", "atmospheric", "contemplative", "bridge"])
    elif energy_avg < 0.50:
        s.extend(["verse", "informational", "transitional"])
    elif energy_avg < 0.70:
        s.extend(["chorus", "build-up", "performance"])
    else:
        s.extend(["chorus", "drop", "high-energy", "outro"])

    if bpm > 120 and energy_avg > 0.55:
        s.append("trailer")
    if mode == "minor":
        s.extend(["emotional-peak", "narrative-tension"])
    return s


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("audioPath") or "").strip()
    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(f"audioPath '{audio_path}' mangler")
        sys.exit(1)

    if dry_run:
        bridge.result({"wouldAnalyze": audio_path})
        return

    try:
        import librosa  # type: ignore
        import numpy as np
    except ImportError:
        bridge.error(
            "librosa er ikke installert.\n"
            "  pip install librosa numpy"
        )
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    bridge.log(f"Analyserer {os.path.basename(audio_path)} …")
    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = os.path.join(tmpdir, "audio.wav")
        if not _extract_wav(ffmpeg, audio_path, wav_path):
            bridge.error("Kunne ikke extracte lyd")
            sys.exit(1)

        try:
            y, sr = librosa.load(wav_path, sr=22050, mono=True)
            duration_sec = float(librosa.get_duration(y=y, sr=sr))
            bridge.progress(1, 4, "BPM-deteksjon")

            # BPM
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
            bpm = float(tempo)
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)

            # Tempo-confidence
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempogram = librosa.feature.tempogram(onset_envelope=onset_env, sr=sr)
            peak = float(np.max(tempogram))
            std = float(np.std(tempogram)) + 1e-6
            bpm_confidence = min(1.0, peak / (std * 4))

            bridge.progress(2, 4, "Key-deteksjon")
            # Chroma → key
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            chroma_avg = chroma.mean(axis=1).tolist()
            key, mode, key_conf = _detect_key(chroma_avg)

            bridge.progress(3, 4, "Energi-kurve")
            # Energy-kurve (40 buckets)
            rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
            rms_normalized = (rms / (rms.max() + 1e-6)).tolist()
            n_buckets = 40
            bucket_size = max(1, len(rms_normalized) // n_buckets)
            energy_curve = []
            for i in range(n_buckets):
                start = i * bucket_size
                end = min(len(rms_normalized), (i + 1) * bucket_size)
                if end > start:
                    energy_curve.append(round(
                        float(np.mean(rms_normalized[start:end])), 3))
            energy_avg = float(np.mean(rms_normalized))
            energy_peak = float(np.max(rms_normalized))

            # Spectral centroid (brightness)
            centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            centroid_avg = float(np.mean(centroid))

            bridge.progress(4, 4, "Segment-grenser")
            # Segmenter via novelty-detection på chroma + RMS
            try:
                # Compute beat-synced features
                beat_chroma = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
                # Recurrence-baserte segmenter (forenklet)
                bound_frames = librosa.segment.agglomerative(beat_chroma, k=min(8, len(beat_frames) // 4))
                bound_times = librosa.frames_to_time(beat_frames[bound_frames], sr=sr)
                if len(bound_times) < 2:
                    bound_times = np.array([0, duration_sec])
            except Exception:
                # Fallback: even-spaced segments
                bound_times = np.linspace(0, duration_sec, 5)

            segments: list[dict[str, Any]] = []
            for i in range(len(bound_times) - 1):
                seg_start = float(bound_times[i])
                seg_end = float(bound_times[i + 1])
                # Energi for dette segmentet
                seg_start_buc = int((seg_start / duration_sec) * len(energy_curve))
                seg_end_buc = int((seg_end / duration_sec) * len(energy_curve))
                seg_energy = (
                    sum(energy_curve[seg_start_buc:seg_end_buc])
                    / max(1, seg_end_buc - seg_start_buc)
                )
                seg_type = _classify_segment(seg_energy, seg_start / duration_sec)
                segments.append({
                    "type": seg_type,
                    "start": round(seg_start, 2),
                    "end": round(seg_end, 2),
                    "energy": round(seg_energy, 3),
                })

            mood_tags = _derive_mood_tags(
                energy_avg, energy_peak, centroid_avg, bpm, mode,
            )
            suggested_for = _derive_suggested_for(energy_avg, bpm, mode)
            # Sammenslå mood + suggested for tags-felt
            all_tags = list(set(mood_tags + suggested_for))

            result = {
                "bpm": round(bpm, 1),
                "bpmConfidence": round(bpm_confidence, 2),
                "key": key,
                "mode": mode,
                "keyConfidence": round(key_conf, 2),
                "durationSec": round(duration_sec, 1),
                "energyCurve": energy_curve,
                "energyAverage": round(energy_avg, 3),
                "energyPeak": round(energy_peak, 3),
                "spectralCentroidAvg": round(centroid_avg, 1),
                "rmsAvg": round(float(np.mean(rms)), 3),
                "segments": segments,
                "beatCount": len(beat_times),
                "moodTags": mood_tags,
                "suggestedFor": suggested_for,
                "tags": all_tags,
                "method": "librosa",
            }

            bridge.log(
                f"BPM: {bpm:.1f} ({bpm_confidence*100:.0f}%) · "
                f"key: {key} {mode} · "
                f"energy: {energy_avg:.2f} · "
                f"{len(segments)} segmenter · "
                f"tags: {', '.join(all_tags[:5])}"
            )
            bridge.result(result)

        except Exception as exc:
            bridge.error(f"Librosa-analyse feilet: {exc}")
            sys.exit(1)


bridge.main_guard(run)

"""Sync Multicam Audio — finn sync-offset mellom kameraer via cross-
correlation av audio-waveforms.

Brukes for å auto-syncronisere multi-camera-opptak (bryllup, event,
podcast, dokumentar, short film, music video) til en felles tidslinje.

Strategi:
  1. Ekstraher mono 22050 Hz WAV fra hver source-video
  2. Velg referanse-klipp (default: lengste, eller spesifisert)
  3. For hver annen klipp: kjør scipy.signal.correlate mot referansen
  4. Peak-posisjon i correlation → tidsoffset
  5. Confidence basert på peak/median-ratio

Output via bridge.result():
  {
    "referenceClipIndex": 0,
    "syncResults": [
      {
        "clipIndex": 0,
        "filePath": "/path/cam1.mp4",
        "isReference": true,
        "offsetSec": 0.0,
        "confidence": 1.0,
        "durationSec": 312.4
      },
      {
        "clipIndex": 1,
        "filePath": "/path/cam2.mp4",
        "isReference": false,
        "offsetSec": 2.34,
        "confidence": 0.82,
        "durationSec": 308.1
      },
      ...
    ],
    "method": "scipy-correlate" | "numpy-correlate" | "fallback"
  }

Input params:
  clipPaths:        array av sti til video-filer
  referenceIndex:   (optional) hvilken klipp som er reference
                    (default: lengste klipp)
  analysisDurationSec: (optional, default 30) hvor mye av lyden å bruke
                       for cross-correlation
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


def _extract_wav(ffmpeg: str, src: str, out: str,
                  start_sec: float = 0,
                  duration_sec: float | None = None) -> bool:
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"]
    if start_sec > 0:
        cmd += ["-ss", str(start_sec)]
    cmd += ["-i", src]
    if duration_sec is not None:
        cmd += ["-t", str(duration_sec)]
    cmd += [
        "-vn", "-ac", "1", "-ar", "22050",
        "-acodec", "pcm_s16le", out,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        return r.returncode == 0 and os.path.isfile(out)
    except subprocess.TimeoutExpired:
        return False


def _load_wav_as_array(wav_path: str) -> tuple[list[int], int] | None:
    """Returnerer (samples, sample_rate) eller None ved feil."""
    try:
        wf = wave.open(wav_path, "rb")
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
        wf.close()
        import array
        samples = array.array("h")
        samples.frombytes(raw)
        return (list(samples), sr)
    except Exception as exc:
        bridge.warn(f"Kunne ikke lese WAV {wav_path}: {exc}")
        return None


def _cross_correlate_scipy(
    ref_samples: list[int], other_samples: list[int], sr: int,
) -> tuple[float, float] | None:
    """Best-quality cross-correlation via scipy. Returnerer
    (offset_sec, confidence). None hvis scipy ikke installert."""
    try:
        import numpy as np
        from scipy.signal import correlate  # type: ignore
    except ImportError:
        return None

    try:
        ref = np.array(ref_samples, dtype=np.float32)
        oth = np.array(other_samples, dtype=np.float32)
        # Normalize
        ref = (ref - ref.mean()) / (ref.std() + 1e-6)
        oth = (oth - oth.mean()) / (oth.std() + 1e-6)
        # Cross-correlate
        corr = correlate(oth, ref, mode="full", method="fft")
        # Find peak
        peak_idx = int(np.argmax(corr))
        # Convert to offset in samples (centered)
        offset_samples = peak_idx - (len(ref) - 1)
        offset_sec = offset_samples / sr
        # Confidence: peak / median ratio
        peak_val = float(corr[peak_idx])
        median_val = float(np.median(np.abs(corr))) + 1e-6
        confidence = min(1.0, peak_val / (median_val * 20))
        return (float(offset_sec), confidence)
    except Exception as exc:
        bridge.warn(f"scipy-correlate feilet: {exc}")
        return None


def _cross_correlate_numpy(
    ref_samples: list[int], other_samples: list[int], sr: int,
) -> tuple[float, float] | None:
    """numpy.correlate fallback (slower, time-domain)."""
    try:
        import numpy as np
    except ImportError:
        return None

    try:
        ref = np.array(ref_samples, dtype=np.float32)
        oth = np.array(other_samples, dtype=np.float32)
        ref = (ref - ref.mean()) / (ref.std() + 1e-6)
        oth = (oth - oth.mean()) / (oth.std() + 1e-6)
        # For lange arrays er numpy.correlate veldig treigt — bruk
        # downsampled-versjon for å akselerere
        downsample = max(1, len(ref) // 50000)
        if downsample > 1:
            ref = ref[::downsample]
            oth = oth[::downsample]
            effective_sr = sr / downsample
        else:
            effective_sr = sr
        corr = np.correlate(oth, ref, mode="full")
        peak_idx = int(np.argmax(corr))
        offset_samples = peak_idx - (len(ref) - 1)
        offset_sec = offset_samples / effective_sr
        peak_val = float(corr[peak_idx])
        median_val = float(np.median(np.abs(corr))) + 1e-6
        confidence = min(1.0, peak_val / (median_val * 20))
        return (float(offset_sec), confidence)
    except Exception as exc:
        bridge.warn(f"numpy-correlate feilet: {exc}")
        return None


def _energy_peak_fallback(
    ref_samples: list[int], other_samples: list[int], sr: int,
) -> tuple[float, float]:
    """Siste utvei: finn først loud-peak i hver, ta differansen som offset.
    Lav confidence, men bedre enn ingenting hvis numpy mangler."""
    def first_loud_peak(samples: list[int]) -> float:
        # Window i 50ms chunks, finn første over threshold
        win_size = int(0.05 * sr)
        threshold = max(abs(s) for s in samples) * 0.4
        for i in range(0, len(samples) - win_size, win_size):
            chunk = samples[i:i + win_size]
            if max(abs(s) for s in chunk) > threshold:
                return i / sr
        return 0.0

    ref_peak = first_loud_peak(ref_samples)
    other_peak = first_loud_peak(other_samples)
    offset = ref_peak - other_peak
    return (offset, 0.30)  # Lav confidence


def run(params: dict[str, Any], dry_run: bool) -> None:
    clip_paths = params.get("clipPaths") or []
    if not isinstance(clip_paths, list) or len(clip_paths) < 2:
        bridge.error("Minst 2 klipp-paths påkrevd")
        sys.exit(1)
    for p in clip_paths:
        if not isinstance(p, str) or not os.path.isfile(p):
            bridge.error(f"Klipp-fil mangler: {p}")
            sys.exit(1)

    reference_index_raw = params.get("referenceIndex")
    analysis_dur = float(params.get("analysisDurationSec") or 30)

    if dry_run:
        bridge.result({
            "wouldSync": len(clip_paths),
            "analysisDur": analysis_dur,
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet")
        sys.exit(1)

    # Hent varigheter
    durations = [_get_duration(ffmpeg, p) for p in clip_paths]

    # Bestem reference (default: lengste klipp)
    if reference_index_raw is not None:
        ref_idx = int(reference_index_raw)
        if ref_idx < 0 or ref_idx >= len(clip_paths):
            bridge.error(f"referenceIndex {ref_idx} out of range")
            sys.exit(1)
    else:
        ref_idx = int(max(range(len(durations)), key=lambda i: durations[i]))

    bridge.log(
        f"Synker {len(clip_paths)} klipp · referanse: "
        f"{os.path.basename(clip_paths[ref_idx])} ({durations[ref_idx]:.1f}s)"
    )

    # Ekstraher analyse-segmenter (de første analysis_dur sek av hver klipp)
    with tempfile.TemporaryDirectory() as tmpdir:
        wav_paths: list[str | None] = []
        for i, path in enumerate(clip_paths):
            wav_out = os.path.join(tmpdir, f"clip_{i}.wav")
            success = _extract_wav(
                ffmpeg, path, wav_out,
                start_sec=0,
                duration_sec=min(analysis_dur, durations[i]),
            )
            wav_paths.append(wav_out if success else None)
            bridge.progress(i + 1, len(clip_paths) * 2,
                             f"Ekstrahert lyd fra {os.path.basename(path)}")

        # Last reference
        ref_data = wav_paths[ref_idx]
        if not ref_data:
            bridge.error("Kunne ikke ekstrahere lyd fra referanse")
            sys.exit(1)
        ref_loaded = _load_wav_as_array(ref_data)
        if not ref_loaded:
            bridge.error("Kunne ikke laste referanse-WAV")
            sys.exit(1)
        ref_samples, sr = ref_loaded

        # Detect hvilken method som er tilgjengelig
        method = "scipy-correlate"
        try:
            import scipy.signal  # type: ignore  # noqa: F401
        except ImportError:
            try:
                import numpy  # type: ignore  # noqa: F401
                method = "numpy-correlate"
            except ImportError:
                method = "fallback"
        bridge.log(f"Method: {method}")

        sync_results: list[dict[str, Any]] = []
        for i, path in enumerate(clip_paths):
            bridge.progress(len(clip_paths) + i + 1, len(clip_paths) * 2,
                             f"Korrelerer {os.path.basename(path)}")

            if i == ref_idx:
                sync_results.append({
                    "clipIndex": i,
                    "filePath": path,
                    "isReference": True,
                    "offsetSec": 0.0,
                    "confidence": 1.0,
                    "durationSec": round(durations[i], 1),
                })
                continue

            wav = wav_paths[i]
            if not wav:
                sync_results.append({
                    "clipIndex": i,
                    "filePath": path,
                    "isReference": False,
                    "offsetSec": 0.0,
                    "confidence": 0.0,
                    "error": "Audio-extraction feilet",
                    "durationSec": round(durations[i], 1),
                })
                continue

            other_loaded = _load_wav_as_array(wav)
            if not other_loaded:
                sync_results.append({
                    "clipIndex": i,
                    "filePath": path,
                    "isReference": False,
                    "offsetSec": 0.0,
                    "confidence": 0.0,
                    "error": "WAV-load feilet",
                    "durationSec": round(durations[i], 1),
                })
                continue
            other_samples, other_sr = other_loaded

            # Kjør cross-correlation (sample-rates burde matche siden vi
            # ekstraherer alle som 22050)
            offset_conf = None
            if method == "scipy-correlate":
                offset_conf = _cross_correlate_scipy(ref_samples, other_samples, sr)
            if offset_conf is None and method in ("scipy-correlate", "numpy-correlate"):
                offset_conf = _cross_correlate_numpy(ref_samples, other_samples, sr)
            if offset_conf is None:
                offset_conf = _energy_peak_fallback(ref_samples, other_samples, sr)

            offset_sec, confidence = offset_conf

            sync_results.append({
                "clipIndex": i,
                "filePath": path,
                "isReference": False,
                "offsetSec": round(offset_sec, 3),
                "confidence": round(confidence, 2),
                "durationSec": round(durations[i], 1),
            })

        bridge.log(
            f"Ferdig: {sum(1 for r in sync_results if r.get('confidence', 0) > 0.5)} "
            f"av {len(sync_results) - 1} klipp synket med høy konfidens"
        )
        bridge.result({
            "referenceClipIndex": ref_idx,
            "syncResults": sync_results,
            "method": method,
            "analysisDurationSec": analysis_dur,
        })


bridge.main_guard(run)

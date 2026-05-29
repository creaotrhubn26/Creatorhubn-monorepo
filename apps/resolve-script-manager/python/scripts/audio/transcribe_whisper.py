"""Transcribe Whisper — generér transkript med segments, words og
timestamps fra audio/video.

Brukes som foundation for Caption Studio, transkript-aware Director-
chat, chapter-detection fra voice, og generell søk-i-prosjekt.

Tre-lags fallback (samme strategi som analyze_audio_beats):
  1. faster-whisper (anbefalt — CTranslate2-basert, 4x raskere enn
     original whisper, lokal CPU/GPU)
  2. whisper (original OpenAI whisper, slower men widely compatible)
  3. OpenAI Whisper API (cloud, krever OPENAI_API_KEY i env)

Output via bridge.result():
  {
    "language": "no",
    "languageProbability": 0.96,
    "durationSec": 312.4,
    "segments": [
      {
        "id": 0,
        "start": 0.0,
        "end": 4.2,
        "text": "Velkommen til episode 47 av podkasten.",
        "words": [
          { "word": "Velkommen", "start": 0.0, "end": 0.5,
            "probability": 0.92 },
          ...
        ]
      },
      ...
    ],
    "fullText": "Velkommen til episode 47 ...",
    "method": "faster-whisper" | "whisper" | "openai-api",
    "model": "base" | "small" | "medium" | ...
  }

Input params:
  audioPath:    sti til audio/video-fil
  model:        (optional) tiny|base|small|medium|large-v3 (default base)
  language:     (optional) "no" | "en" | "auto" (default auto)
  wordTimestamps: (optional, default true) inkluder per-ord timing
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


def _extract_audio_wav(ffmpeg: str, video_path: str, out_wav: str) -> bool:
    """Konverter til 16kHz mono WAV (Whisper's foretrukne format)."""
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", video_path,
        "-vn", "-ac", "1", "-ar", "16000",
        "-acodec", "pcm_s16le",
        out_wav,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        return r.returncode == 0 and os.path.isfile(out_wav)
    except subprocess.TimeoutExpired:
        return False


def _transcribe_with_faster_whisper(
    wav_path: str, model_size: str, language: str | None,
    word_timestamps: bool,
) -> dict[str, Any] | None:
    """Anbefalt path — faster-whisper er CTranslate2-basert og 4x raskere
    enn original whisper med samme kvalitet. Returnerer None hvis ikke
    installert."""
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError:
        return None

    try:
        # Auto-detect compute_type: prøv int8 først (lett), fall back til float16
        compute_type = "int8"
        try:
            model = WhisperModel(model_size, device="auto", compute_type=compute_type)
        except Exception:
            compute_type = "float16"
            try:
                model = WhisperModel(model_size, device="auto", compute_type=compute_type)
            except Exception:
                compute_type = "float32"
                model = WhisperModel(model_size, device="cpu", compute_type=compute_type)

        bridge.log(f"faster-whisper: model={model_size}, compute={compute_type}")

        segments_gen, info = model.transcribe(
            wav_path,
            language=language if language and language != "auto" else None,
            word_timestamps=word_timestamps,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        segments: list[dict[str, Any]] = []
        full_text_parts: list[str] = []
        for i, seg in enumerate(segments_gen):
            seg_dict: dict[str, Any] = {
                "id": i,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
            }
            if word_timestamps and seg.words:
                seg_dict["words"] = [
                    {
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 2),
                    }
                    for w in seg.words
                ]
            segments.append(seg_dict)
            full_text_parts.append(seg.text.strip())
            if i % 10 == 0:
                bridge.progress(int(seg.end), int(info.duration),
                                f"Transcribed {i+1} segments")

        return {
            "language": info.language,
            "languageProbability": round(info.language_probability, 2),
            "durationSec": round(info.duration, 1),
            "segments": segments,
            "fullText": " ".join(full_text_parts),
            "method": "faster-whisper",
            "model": model_size,
            "computeType": compute_type,
        }
    except Exception as exc:
        bridge.warn(f"faster-whisper feilet: {exc}")
        return None


def _transcribe_with_whisper(
    wav_path: str, model_size: str, language: str | None,
    word_timestamps: bool,
) -> dict[str, Any] | None:
    """Original OpenAI whisper (Python). Slower than faster-whisper."""
    try:
        import whisper  # type: ignore
    except ImportError:
        return None

    try:
        model = whisper.load_model(model_size)
        bridge.log(f"whisper (original): model={model_size}")
        result = model.transcribe(
            wav_path,
            language=language if language and language != "auto" else None,
            word_timestamps=word_timestamps,
            verbose=False,
        )

        segments: list[dict[str, Any]] = []
        for i, seg in enumerate(result.get("segments", [])):
            seg_dict: dict[str, Any] = {
                "id": i,
                "start": round(float(seg["start"]), 3),
                "end": round(float(seg["end"]), 3),
                "text": str(seg["text"]).strip(),
            }
            if word_timestamps and seg.get("words"):
                seg_dict["words"] = [
                    {
                        "word": str(w["word"]).strip(),
                        "start": round(float(w["start"]), 3),
                        "end": round(float(w["end"]), 3),
                        "probability": round(float(w.get("probability", 1.0)), 2),
                    }
                    for w in seg["words"]
                ]
            segments.append(seg_dict)

        # Hent total duration
        total_dur = max((s["end"] for s in segments), default=0)

        return {
            "language": result.get("language", "unknown"),
            "languageProbability": 0.95,  # whisper gir ikke confidence
            "durationSec": round(total_dur, 1),
            "segments": segments,
            "fullText": str(result.get("text", "")).strip(),
            "method": "whisper",
            "model": model_size,
        }
    except Exception as exc:
        bridge.warn(f"whisper feilet: {exc}")
        return None


def _transcribe_with_openai_api(
    audio_path: str, language: str | None,
) -> dict[str, Any] | None:
    """Cloud-fallback via OpenAI Whisper API. Krever OPENAI_API_KEY i
    miljøet — settes typisk via SettingsModal i UI'en."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        from openai import OpenAI  # type: ignore
    except ImportError:
        bridge.warn("openai-pakken ikke installert — `pip install openai`")
        return None

    try:
        client = OpenAI(api_key=api_key)
        bridge.log("Bruker OpenAI Whisper API (cloud)")
        with open(audio_path, "rb") as f:
            params = {
                "model": "whisper-1",
                "file": f,
                "response_format": "verbose_json",
                "timestamp_granularities": ["segment", "word"],
            }
            if language and language != "auto":
                params["language"] = language
            response = client.audio.transcriptions.create(**params)

        # response.segments + response.words er dataclasses i nyere
        # openai-py, men konverter til vanlige dicts
        segments: list[dict[str, Any]] = []
        full_text = getattr(response, "text", "")
        raw_segments = getattr(response, "segments", []) or []
        for i, seg in enumerate(raw_segments):
            seg_data = seg.model_dump() if hasattr(seg, "model_dump") else dict(seg)
            segments.append({
                "id": i,
                "start": round(float(seg_data.get("start", 0)), 3),
                "end": round(float(seg_data.get("end", 0)), 3),
                "text": str(seg_data.get("text", "")).strip(),
            })

        return {
            "language": getattr(response, "language", "unknown"),
            "languageProbability": 0.95,
            "durationSec": round(float(getattr(response, "duration", 0)), 1),
            "segments": segments,
            "fullText": str(full_text).strip(),
            "method": "openai-api",
            "model": "whisper-1",
        }
    except Exception as exc:
        bridge.warn(f"OpenAI API feilet: {exc}")
        return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    audio_path = (params.get("audioPath") or "").strip()
    if not audio_path or not os.path.isfile(audio_path):
        bridge.error(f"audioPath '{audio_path}' mangler")
        sys.exit(1)

    model_size = str(params.get("model") or "base").strip()
    language = str(params.get("language") or "auto").strip()
    word_timestamps = bool(params.get("wordTimestamps", True))

    if dry_run:
        bridge.result({
            "wouldTranscribe": audio_path,
            "model": model_size, "language": language,
            "wouldCheckMethods": ["faster-whisper", "whisper", "openai-api"],
        })
        return

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet — kreves for audio-extraction")
        sys.exit(1)

    bridge.log(f"Transcriber {os.path.basename(audio_path)} (model={model_size}, lang={language})")

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = os.path.join(tmpdir, "audio.wav")
        if not _extract_audio_wav(ffmpeg, audio_path, wav_path):
            bridge.error("Kunne ikke extracte lyd")
            sys.exit(1)

        # Try local methods first (no cloud cost)
        result = _transcribe_with_faster_whisper(
            wav_path, model_size, language, word_timestamps,
        )
        if result is None:
            bridge.log("faster-whisper ikke tilgjengelig — prøver whisper …")
            result = _transcribe_with_whisper(
                wav_path, model_size, language, word_timestamps,
            )
        if result is None:
            bridge.log("whisper ikke tilgjengelig — prøver OpenAI API …")
            result = _transcribe_with_openai_api(audio_path, language)

        if result is None:
            bridge.error(
                "Ingen Whisper-backend tilgjengelig. Installer en av:\n"
                "  pip install faster-whisper   (anbefalt)\n"
                "  pip install openai-whisper   (slower)\n"
                "Eller sett OPENAI_API_KEY for cloud-fallback."
            )
            sys.exit(1)

        bridge.log(
            f"Ferdig: {len(result['segments'])} segments, "
            f"språk={result['language']} ({(result['languageProbability'] * 100):.0f}%), "
            f"varighet={result['durationSec']}s via {result['method']}"
        )
        bridge.result(result)


bridge.main_guard(run)

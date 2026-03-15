#!/usr/bin/env python3
"""
WhisperX transcription + forced-alignment microservice.
Provides a simple OpenAI-like endpoint:
  POST /v1/audio/transcriptions
"""

from __future__ import annotations

import logging
import os
import tempfile
import threading
import traceback
from typing import Any, Dict, List, Tuple

from flask import Flask, jsonify, request
import torch
import whisperx

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)


WHISPERX_MODEL = os.getenv("WHISPERX_MODEL_SIZE", "large-v3")
WHISPERX_DEVICE_ENV = os.getenv("WHISPERX_DEVICE", "auto").strip().lower()
WHISPERX_COMPUTE_TYPE_ENV = os.getenv("WHISPERX_COMPUTE_TYPE", "").strip().lower()
WHISPERX_BATCH_SIZE = max(1, min(48, int(os.getenv("WHISPERX_BATCH_SIZE", "8"))))
WHISPERX_DEFAULT_LANGUAGE = os.getenv("WHISPERX_DEFAULT_LANGUAGE", "").strip().lower() or None
WHISPERX_WARMUP_ON_STARTUP = os.getenv("WHISPERX_WARMUP_ON_STARTUP", "true").strip().lower() not in {
    "0",
    "false",
    "off",
    "no",
}


def resolve_device() -> str:
    if WHISPERX_DEVICE_ENV in {"cpu", "cuda"}:
        return WHISPERX_DEVICE_ENV
    return "cuda" if torch.cuda.is_available() else "cpu"


WHISPERX_DEVICE = resolve_device()
WHISPERX_COMPUTE_TYPE = (
    WHISPERX_COMPUTE_TYPE_ENV
    if WHISPERX_COMPUTE_TYPE_ENV
    else ("float16" if WHISPERX_DEVICE == "cuda" else "int8")
)

MODEL_LOCK = threading.Lock()
ASR_MODELS: Dict[str, Any] = {}
ALIGN_MODELS: Dict[str, Tuple[Any, Any]] = {}
STARTUP_ERRORS: List[str] = []


def normalize_language_code(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip().lower()
    if not cleaned:
        return None
    aliases = {
        "nb": "no",
        "nn": "no",
        "norwegian": "no",
        "english": "en",
    }
    return aliases.get(cleaned, cleaned)


def to_confidence(value: Any, fallback: float = 0.7) -> float:
    if value is None:
        return fallback
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return fallback
    if numeric < 0:
        return max(0.0, min(1.0, float(torch.exp(torch.tensor(numeric)).item())))
    return max(0.0, min(1.0, numeric))


def get_asr_model(language: str | None):
    language_key = normalize_language_code(language) or "__auto__"
    with MODEL_LOCK:
        model = ASR_MODELS.get(language_key)
        if model is not None:
            return model
        logging.info(
            "Loading WhisperX ASR model=%s language=%s device=%s compute=%s",
            WHISPERX_MODEL,
            language_key,
            WHISPERX_DEVICE,
            WHISPERX_COMPUTE_TYPE,
        )
        model = whisperx.load_model(
            WHISPERX_MODEL,
            WHISPERX_DEVICE,
            compute_type=WHISPERX_COMPUTE_TYPE,
            language=None if language_key == "__auto__" else language_key,
        )
        ASR_MODELS[language_key] = model
        return model


def get_align_model(language: str):
    normalized = normalize_language_code(language) or "en"
    with MODEL_LOCK:
        cached = ALIGN_MODELS.get(normalized)
        if cached is not None:
            return cached
        logging.info("Loading WhisperX align model for language=%s device=%s", normalized, WHISPERX_DEVICE)
        model, metadata = whisperx.load_align_model(language_code=normalized, device=WHISPERX_DEVICE)
        ALIGN_MODELS[normalized] = (model, metadata)
        return model, metadata


def transcribe_with_alignment(audio_path: str, requested_language: str | None) -> Dict[str, Any]:
    language = normalize_language_code(requested_language) or WHISPERX_DEFAULT_LANGUAGE
    model = get_asr_model(language)
    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=WHISPERX_BATCH_SIZE, language=language)
    detected_language = normalize_language_code(result.get("language")) or language or "en"
    segments = result.get("segments", []) or []
    warnings: List[str] = []

    try:
        align_model, metadata = get_align_model(detected_language)
        aligned = whisperx.align(
            segments,
            align_model,
            metadata,
            audio,
            WHISPERX_DEVICE,
            return_char_alignments=False,
        )
        segments = aligned.get("segments", []) or segments
    except Exception as error:  # noqa: BLE001
        warnings.append(f"alignment_failed: {error}")

    normalized_segments: List[Dict[str, Any]] = []
    normalized_words: List[Dict[str, Any]] = []
    text_chunks: List[str] = []
    max_end = 0.0

    for idx, raw_segment in enumerate(segments):
        if not isinstance(raw_segment, dict):
            continue
        segment_text = str(raw_segment.get("text") or "").strip()
        start_raw = raw_segment.get("start")
        end_raw = raw_segment.get("end")
        try:
            start = float(start_raw)
            end = float(end_raw)
        except (TypeError, ValueError):
            continue
        if end <= start:
            end = start + 0.2
        confidence = to_confidence(raw_segment.get("score"), fallback=to_confidence(raw_segment.get("avg_logprob")))

        normalized_segments.append(
            {
                "id": idx + 1,
                "start": round(max(0.0, start), 3),
                "end": round(max(start, end), 3),
                "text": segment_text,
                "confidence": round(confidence, 3),
            }
        )
        if segment_text:
            text_chunks.append(segment_text)
        max_end = max(max_end, end)

        raw_words = raw_segment.get("words") or raw_segment.get("word_segments") or []
        if isinstance(raw_words, list):
            for word in raw_words:
                if not isinstance(word, dict):
                    continue
                word_token = str(word.get("word") or word.get("text") or "").strip()
                try:
                    word_start = float(word.get("start"))
                except (TypeError, ValueError):
                    continue
                word_end = word.get("end")
                try:
                    word_end_f = float(word_end)
                except (TypeError, ValueError):
                    word_end_f = word_start + 0.12
                if word_end_f <= word_start:
                    word_end_f = word_start + 0.12
                normalized_words.append(
                    {
                        "word": word_token,
                        "start": round(max(0.0, word_start), 3),
                        "end": round(max(word_start, word_end_f), 3),
                        "confidence": round(to_confidence(word.get("score"), fallback=0.65), 3),
                    }
                )

    return {
        "text": " ".join(text_chunks).strip() or str(result.get("text") or "").strip(),
        "language": detected_language,
        "duration": round(max_end, 3),
        "segments": normalized_segments,
        "words": normalized_words,
        "warnings": warnings,
    }


def warmup_models(language: str | None = None) -> Dict[str, Any]:
    resolved_language = normalize_language_code(language) or WHISPERX_DEFAULT_LANGUAGE or "en"
    get_asr_model(resolved_language)
    get_align_model(resolved_language)
    return {
        "status": "warm",
        "language": resolved_language,
        "device": WHISPERX_DEVICE,
        "compute_type": WHISPERX_COMPUTE_TYPE,
        "asr_cached": len(ASR_MODELS),
        "align_cached": len(ALIGN_MODELS),
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "healthy" if len(STARTUP_ERRORS) == 0 else "degraded",
            "model": WHISPERX_MODEL,
            "device": WHISPERX_DEVICE,
            "compute_type": WHISPERX_COMPUTE_TYPE,
            "batch_size": WHISPERX_BATCH_SIZE,
            "asr_cached": len(ASR_MODELS),
            "align_cached": len(ALIGN_MODELS),
            "startup_errors": STARTUP_ERRORS,
        }
    )


@app.route("/warmup", methods=["POST"])
def warmup():
    try:
        payload = request.get_json(silent=True) or {}
        language = normalize_language_code(payload.get("language")) if isinstance(payload, dict) else None
        status = warmup_models(language)
        return jsonify({"success": True, **status})
    except Exception as error:  # noqa: BLE001
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/v1/audio/transcriptions", methods=["POST"])
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "Missing file"}), 400

    uploaded = request.files["file"]
    if uploaded.filename is None:
        return jsonify({"error": "Invalid file"}), 400

    language = normalize_language_code(request.form.get("language"))
    response_format = (request.form.get("response_format") or "verbose_json").strip().lower()

    fd, tmp_path = tempfile.mkstemp(suffix=os.path.splitext(uploaded.filename)[1] or ".wav")
    os.close(fd)
    try:
        uploaded.save(tmp_path)
        payload = transcribe_with_alignment(tmp_path, language)
        if response_format != "verbose_json":
            return jsonify({"text": payload.get("text", "")})
        return jsonify({"data": payload, "provider": "whisperx"})
    except Exception as error:  # noqa: BLE001
        logging.error("WhisperX transcription failure: %s", error)
        logging.error(traceback.format_exc())
        return jsonify({"error": str(error)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    if WHISPERX_WARMUP_ON_STARTUP:
        try:
            warmup_models()
        except Exception as error:  # noqa: BLE001
            STARTUP_ERRORS.append(str(error))
            logging.error("WhisperX startup warmup failed: %s", error)
    port = int(os.getenv("PORT", "5003"))
    app.run(host="0.0.0.0", port=port, debug=False)

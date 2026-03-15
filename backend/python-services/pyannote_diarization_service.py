#!/usr/bin/env python3
"""
Pyannote Speaker Diarization Microservice
Advanced speaker diarization using pyannote.audio with optional segmentation-3.0 confidence scoring.
"""

from __future__ import annotations

import logging
import os
import tempfile
import threading
import time
import wave
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from flask import Flask, jsonify, request
from pyannote.audio import Inference, Model, Pipeline

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

HF_TOKEN = (os.getenv("HUGGINGFACE_TOKEN") or "").strip()
DIARIZATION_MODEL_ID = os.getenv("PYANNOTE_DIARIZATION_MODEL", "pyannote/speaker-diarization-3.1")
SEGMENTATION_MODEL_ID = os.getenv("PYANNOTE_SEGMENTATION_MODEL", "pyannote/segmentation-3.0")
ENABLE_SEGMENTATION_CONFIDENCE = (os.getenv("PYANNOTE_ENABLE_SEGMENTATION_CONFIDENCE", "true").strip().lower() in {"1", "true", "yes", "on"})

pipeline: Optional[Pipeline] = None
segmentation_inference: Optional[Inference] = None
startup_errors: List[str] = []
warmup_lock = threading.Lock()
warmup_state: Dict[str, Any] = {
    "status": "idle",
    "runs": 0,
    "completed": False,
    "last_started_at": None,
    "last_completed_at": None,
    "last_duration_ms": None,
    "last_error": None,
}

if not HF_TOKEN:
    startup_errors.append("HUGGINGFACE_TOKEN not set")
    logging.warning("HUGGINGFACE_TOKEN not set - pyannote services will be unavailable")
else:
    try:
        logging.info("Loading pyannote diarization pipeline: %s", DIARIZATION_MODEL_ID)
        pipeline = Pipeline.from_pretrained(DIARIZATION_MODEL_ID, use_auth_token=HF_TOKEN)
        logging.info("Loaded diarization pipeline successfully")
    except Exception as error:
        startup_errors.append(f"Failed to load diarization pipeline: {error}")
        logging.exception("Failed to load diarization pipeline")
        pipeline = None

    if ENABLE_SEGMENTATION_CONFIDENCE:
        try:
            logging.info("Loading pyannote segmentation model: %s", SEGMENTATION_MODEL_ID)
            segmentation_model = Model.from_pretrained(SEGMENTATION_MODEL_ID, use_auth_token=HF_TOKEN)
            segmentation_inference = Inference(segmentation_model)
            logging.info("Loaded segmentation model successfully")
        except Exception as error:
            startup_errors.append(f"Failed to load segmentation model: {error}")
            logging.exception("Failed to load segmentation model")
            segmentation_inference = None


def _build_segmentation_activity(audio_path: str) -> Optional[Tuple[np.ndarray, float, float]]:
    if segmentation_inference is None:
        return None
    result = segmentation_inference(audio_path)
    data = getattr(result, "data", None)
    sliding_window = getattr(result, "sliding_window", None)
    if data is None or sliding_window is None:
        return None
    values = np.asarray(data)
    if values.size == 0:
        return None
    if values.ndim == 1:
        frame_scores = values
    else:
        # segmentation-3.0 emits speaker-class activations per frame.
        # max activation is used as a speech-presence confidence proxy.
        frame_scores = np.max(values, axis=1)
    start_offset = float(getattr(sliding_window, "start", 0.0) or 0.0)
    step = float(getattr(sliding_window, "step", 0.01) or 0.01)
    return frame_scores.astype(float), start_offset, max(step, 1e-6)


def _confidence_for_interval(
    activity: np.ndarray,
    offset: float,
    step: float,
    start: float,
    end: float,
) -> Optional[float]:
    if not np.isfinite(start) or not np.isfinite(end) or end <= start:
        return None
    first = int(max(0, np.floor((start - offset) / step)))
    last = int(min(len(activity), np.ceil((end - offset) / step)))
    if last <= first:
        return None
    window = activity[first:last]
    if window.size == 0:
        return None
    return float(np.clip(np.mean(window), 0.0, 1.0))


def _is_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _build_silent_wav(duration_seconds: float = 0.8, sample_rate: int = 16000) -> str:
    frame_count = max(1, int(duration_seconds * sample_rate))
    fd, tmp_path = tempfile.mkstemp(suffix=".wav", prefix="pyannote-warmup-")
    os.close(fd)
    with wave.open(tmp_path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * frame_count)
    return tmp_path


def _run_warmup(force: bool = False) -> Dict[str, Any]:
    if pipeline is None:
        raise RuntimeError("Diarization pipeline unavailable")

    with warmup_lock:
        if warmup_state.get("status") == "running":
            return {
                "status": "running",
                "completed": bool(warmup_state.get("completed")),
                "runs": int(warmup_state.get("runs") or 0),
                "last_error": warmup_state.get("last_error"),
            }
        if warmup_state.get("completed") and not force:
            return {
                "status": "ready",
                "completed": True,
                "runs": int(warmup_state.get("runs") or 0),
                "last_completed_at": warmup_state.get("last_completed_at"),
                "last_duration_ms": warmup_state.get("last_duration_ms"),
                "cached": True,
            }
        warmup_state["status"] = "running"
        warmup_state["last_started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        warmup_state["last_error"] = None

    started_at = time.time()
    tmp_path = ""
    try:
        tmp_path = _build_silent_wav()
        diarization = pipeline(tmp_path, min_speakers=1, max_speakers=1)
        _ = list(diarization.itertracks(yield_label=True))
        if segmentation_inference is not None:
            try:
                _build_segmentation_activity(tmp_path)
            except Exception:
                logging.exception("Warmup segmentation pass failed")

        duration_ms = int(max(0, (time.time() - started_at) * 1000))
        with warmup_lock:
            warmup_state["status"] = "ready"
            warmup_state["completed"] = True
            warmup_state["runs"] = int(warmup_state.get("runs") or 0) + 1
            warmup_state["last_completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            warmup_state["last_duration_ms"] = duration_ms
            warmup_state["last_error"] = None
        return {
            "status": "ready",
            "completed": True,
            "runs": warmup_state["runs"],
            "last_completed_at": warmup_state["last_completed_at"],
            "last_duration_ms": duration_ms,
            "cached": False,
        }
    except Exception as error:
        with warmup_lock:
            warmup_state["status"] = "failed"
            warmup_state["completed"] = False
            warmup_state["runs"] = int(warmup_state.get("runs") or 0) + 1
            warmup_state["last_error"] = str(error)
        raise
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@app.route("/health", methods=["GET"])
def health():
    status = "healthy" if pipeline else "degraded"
    if not HF_TOKEN:
        status = "no_token"
    with warmup_lock:
        warmup_snapshot = {
            "status": warmup_state.get("status"),
            "completed": bool(warmup_state.get("completed")),
            "runs": int(warmup_state.get("runs") or 0),
            "last_started_at": warmup_state.get("last_started_at"),
            "last_completed_at": warmup_state.get("last_completed_at"),
            "last_duration_ms": warmup_state.get("last_duration_ms"),
            "last_error": warmup_state.get("last_error"),
        }
    return jsonify(
        {
            "status": status,
            "diarization_model": DIARIZATION_MODEL_ID,
            "segmentation_model": SEGMENTATION_MODEL_ID if ENABLE_SEGMENTATION_CONFIDENCE else None,
            "segmentation_enabled": ENABLE_SEGMENTATION_CONFIDENCE,
            "diarization_ready": pipeline is not None,
            "segmentation_ready": segmentation_inference is not None,
            "warmup": warmup_snapshot,
            "errors": startup_errors,
        }
    )


@app.route("/warmup", methods=["GET", "POST"])
def warmup():
    if pipeline is None:
        return jsonify({"error": "Diarization pipeline unavailable", "details": startup_errors}), 500

    force = _is_truthy(request.args.get("force"))
    payload = request.get_json(silent=True) or {}
    if isinstance(payload, dict):
        force = force or _is_truthy(payload.get("force"))

    try:
        result = _run_warmup(force=force)
        return jsonify(
            {
                "success": True,
                "status": result.get("status", "ready"),
                "force": force,
                "warmup": result,
            }
        )
    except Exception as error:
        logging.exception("Warmup failed")
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/v1/audio/diarization", methods=["POST"])
def diarize():
    """
    Perform speaker diarization on audio file.
    Returns speaker segments with timestamps and optional segmentation confidence.
    """
    if pipeline is None:
        return jsonify({"error": "Diarization pipeline unavailable", "details": startup_errors}), 500

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    audio_file = request.files["file"]
    min_speakers = request.form.get("min_speakers")
    max_speakers = request.form.get("max_speakers")
    extension = os.path.splitext(audio_file.filename or "")[1] or ".wav"

    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name

        logging.info("Diarizing file: %s", audio_file.filename)

        diarization_params: Dict[str, Any] = {}
        if min_speakers:
            diarization_params["min_speakers"] = int(min_speakers)
        if max_speakers:
            diarization_params["max_speakers"] = int(max_speakers)

        diarization = pipeline(tmp_path, **diarization_params)

        segmentation_activity = None
        if segmentation_inference is not None:
            try:
                segmentation_activity = _build_segmentation_activity(tmp_path)
            except Exception:
                logging.exception("Failed to run segmentation confidence pass")
                segmentation_activity = None

        segments: List[Dict[str, Any]] = []
        speakers = set()
        total_duration = 0.0

        for turn, _, speaker in diarization.itertracks(yield_label=True):
            start = float(turn.start)
            end = float(turn.end)
            confidence = None
            if segmentation_activity is not None:
                activity, offset, step = segmentation_activity
                confidence = _confidence_for_interval(activity, offset, step, start, end)
            segments.append(
                {
                    "start": start,
                    "end": end,
                    "speaker": str(speaker),
                    "duration": max(0.0, end - start),
                    "confidence": confidence,
                }
            )
            speakers.add(str(speaker))
            total_duration = max(total_duration, end)

        segments.sort(key=lambda item: float(item["start"]))
        response = {
            "num_speakers": len(speakers),
            "speakers": sorted(list(speakers)),
            "segments": segments,
            "total_duration": total_duration,
            "diarization_model": DIARIZATION_MODEL_ID,
            "segmentation_model": SEGMENTATION_MODEL_ID if segmentation_inference is not None else None,
            "segmentation_confidence_enabled": segmentation_inference is not None,
        }

        logging.info(
            "Diarization complete: %s speakers, %s segments (segmentation confidence: %s)",
            len(speakers),
            len(segments),
            segmentation_inference is not None,
        )
        return jsonify(response)
    except Exception as error:
        logging.exception("Diarization error")
        return jsonify({"error": str(error)}), 500
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


if pipeline is not None and _is_truthy(os.getenv("PYANNOTE_WARMUP_ON_STARTUP", "true")):
    def _startup_warmup_runner() -> None:
        try:
            _run_warmup(force=False)
            logging.info("Pyannote warmup completed at startup")
        except Exception:
            logging.exception("Pyannote startup warmup failed")

    threading.Thread(target=_startup_warmup_runner, daemon=True).start()


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5502))
    app.run(host="0.0.0.0", port=port, debug=False)

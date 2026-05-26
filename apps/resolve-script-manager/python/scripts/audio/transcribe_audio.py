"""Transcribe Audio — WhisperX local transcription with optional speaker diarization.

WhisperX runs entirely locally — fast on Apple Silicon (M-series unified memory). No API costs.
Returns per-segment timestamps + text + optional speaker labels.

Install (one-time):
    pip3 install whisperx
    # For diarization, also: pip3 install pyannote.audio + HuggingFace token

Params:
  audioPath:   path to audio/video file (WhisperX uses ffmpeg under the hood)
  model:       tiny | base | small | medium | large-v3 (default: base — fast, accurate enough)
  language:    "en", "no", "nb", "auto" (default: auto)
  diarize:     true to enable speaker labels (requires pyannote + HF_TOKEN)
  hfToken:     HuggingFace token (or use HF_TOKEN env var)

Output:
  segments: [{start, end, text, speaker, words: [...]}]
  language: detected
  durationSeconds
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

# Allow ai_models import as top-level from python/
_PYTHON_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PYTHON_ROOT not in sys.path:
    sys.path.insert(0, _PYTHON_ROOT)
try:
    import ai_models  # noqa: E402
except ImportError:
    ai_models = None  # type: ignore[assignment]

bridge.reexec_in_venv_if_present()


def _run_openai_whisper_from_r2(audio_path: str, model_name: str,
                                language: str | None) -> list[dict] | None:
    """#R2 alternative transcription path: openai-whisper + R2-downloaded .pt.

    Returns parsed segments or None on failure. Use when:
      - WhisperX is not installed
      - User wants to avoid HuggingFace download (offline / EU bandwidth)
      - R2 credentials are configured

    No diarization (openai-whisper doesn't support it). For speaker labels,
    fall back to WhisperX path.
    """
    if ai_models is None:
        return None
    # Map our short model name to R2 registry id
    r2_id_map = {
        "tiny":     "whisper-tiny",
        "base":     "whisper-base",
        "medium":   "whisper-medium",
        "large":    "whisper-large",
        "large-v2": "whisper-large",
        "large-v3": "whisper-large",  # only large-v2 in R2 — closest match
    }
    r2_id = r2_id_map.get(model_name)
    if not r2_id:
        bridge.warn(f"Model '{model_name}' not in R2 registry — using HuggingFace path")
        return None
    weights_path = ai_models.ensure_local_model(r2_id)
    if not weights_path:
        return None

    # Use openai-whisper directly
    try:
        import whisper  # type: ignore
    except ImportError:
        bridge.warn("openai-whisper not installed — `pip install openai-whisper`")
        return None
    try:
        # Whisper accepts a path-to-.pt as the model arg
        model = whisper.load_model(weights_path)
        result = model.transcribe(
            audio_path,
            language=None if not language or language == "auto" else language,
            verbose=False,
        )
        segments = []
        for seg in (result.get("segments") or []):
            segments.append({
                "start": float(seg.get("start", 0)),
                "end": float(seg.get("end", 0)),
                "text": (seg.get("text") or "").strip(),
                "speaker": None,  # openai-whisper has no diarization
                "words": seg.get("words", [])[:200] if isinstance(seg.get("words"), list) else [],
            })
        return segments
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"openai-whisper transcription failed: {exc}")
        return None


def find_whisperx() -> str | None:
    for candidate in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_WHISPERX"),
        shutil.which("whisperx"),
        "/opt/homebrew/bin/whisperx",
        "/usr/local/bin/whisperx",
    ):
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def find_python_with_whisperx() -> str | None:
    """Fallback: check if `python3 -m whisperx` works."""
    for python in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_PYTHON"),
        shutil.which("python3"),
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
    ):
        if not python or not os.path.isfile(python):
            continue
        try:
            r = subprocess.run([python, "-c", "import whisperx"], capture_output=True, timeout=10)
            if r.returncode == 0:
                return python
        except (subprocess.TimeoutExpired, OSError):
            continue
    return None


def run(params: dict, dry_run: bool) -> None:
    audio_path = params.get("audioPath")
    # #78: default to large-v3 (best accuracy for Norwegian + emotional speech in
    # wedding context). Users can override down to base/tiny for speed.
    model = params.get("model", "large-v3")
    language = params.get("language", "auto")
    hf_token = params.get("hfToken") or os.environ.get("HF_TOKEN")
    # #78: auto-enable diarization when HF token is present (and user didn't
    # explicitly opt out). Diarization on a multi-speaker wedding speech is
    # what makes the transcript actually useful for finding "Father of the
    # bride speaks" vs "Best man speaks" segments.
    if "diarize" in params:
        diarize = bool(params.get("diarize"))
    else:
        diarize = bool(hf_token)  # auto-on when we have a token
    if diarize and not hf_token:
        bridge.warn("diarize requested but no HF_TOKEN — disabling diarization")
        diarize = False

    if dry_run:
        whisperx = find_whisperx()
        python_with_whisperx = None if whisperx else find_python_with_whisperx()
        bridge.result({
            "summary": f"Dry run — would transcribe {audio_path or '<audioPath>'} with WhisperX model={model}, language={language}, diarize={diarize}",
            "whisperxCliFound": whisperx,
            "pythonModuleFound": python_with_whisperx,
            "outputShape": {
                "segments": [{"start": "float", "end": "float", "text": "str", "speaker": "str?", "words": "[]"}],
                "language": "str",
                "durationSeconds": "float",
            },
            "installInstructions": "pip3 install whisperx" + (" + HuggingFace token for diarization" if diarize else ""),
        })
        return

    if not audio_path or not os.path.isfile(audio_path):
        bridge.error("audioPath required and must exist on disk")
        sys.exit(1)

    # R2 alternative transcription path: prefer when explicit param set OR
    # when WhisperX isn't available and R2 is configured.
    prefer_r2 = bool(params.get("useR2Models", False))
    whisperx = find_whisperx()
    python_runner = None
    if not whisperx:
        python_runner = find_python_with_whisperx()
    if (prefer_r2 or (not whisperx and not python_runner)) and bridge.r2_is_configured():
        bridge.progress(5, 100, f"Trying R2-backed openai-whisper ({model})…")
        segments = _run_openai_whisper_from_r2(audio_path, model, language)
        if segments is not None:
            duration = max((s["end"] for s in segments), default=0.0)
            bridge.progress(100, 100, "Done.")
            bridge.result({
                "audioPath": audio_path,
                "model": model,
                "modelSource": "r2",
                "language": language if language != "auto" else None,
                "durationSeconds": duration,
                "diarizationEnabled": False,
                "segmentCount": len(segments),
                "segments": segments,
                "note": "Transcribed via openai-whisper + R2 weights (no diarization)",
            })
            return
        bridge.warn("R2 path failed, falling back to WhisperX")
    if not whisperx and not python_runner:
        bridge.error(
            "WhisperX not installed. Install via: pip3 install whisperx "
            "(needs ~2GB of dependencies — PyTorch + transformers). "
            "Or set RESOLVE_SCRIPT_MANAGER_WHISPERX to the path of the whisperx CLI. "
            "Alternatively configure R2 credentials in Settings for the lighter "
            "openai-whisper + R2-weights path."
        )
        sys.exit(1)

    bridge.progress(0, 100, f"Loading {model} model…")

    with tempfile.TemporaryDirectory(prefix="whisperx_out_") as out_dir:
        cmd: list[str]
        if whisperx:
            cmd = [whisperx, audio_path, "--model", model, "--output_dir", out_dir, "--output_format", "json"]
        else:
            cmd = [python_runner, "-m", "whisperx", audio_path, "--model", model, "--output_dir", out_dir, "--output_format", "json"]

        if language and language != "auto":
            cmd.extend(["--language", language])
        # WhisperX large-v3 needs explicit compute type on Apple Silicon
        # (default float16 isn't supported on MPS; use int8 for CPU-fallback).
        if model in ("large-v3", "large-v2", "large"):
            cmd.extend(["--compute_type", "int8"])
        if diarize:
            cmd.append("--diarize")
            if hf_token:
                cmd.extend(["--hf_token", hf_token])
            # Hint min/max speakers — wedding speeches usually 1-5 people
            cmd.extend(["--min_speakers", "1", "--max_speakers", "8"])

        bridge.log(
            f"Starting WhisperX model={model} language={language} "
            f"diarize={diarize}"
        )
        bridge.progress(10, 100, "Transcribing…")

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        except subprocess.TimeoutExpired:
            bridge.error("WhisperX timed out after 30 minutes — try a smaller model (tiny/base) or shorter audio.")
            sys.exit(1)

        if result.returncode != 0:
            stderr_tail = (result.stderr or "")[-400:]
            bridge.error(f"WhisperX failed: {stderr_tail}")
            sys.exit(1)

        bridge.progress(85, 100, "Parsing transcript…")

        # WhisperX writes <basename>.json into out_dir
        json_files = [f for f in os.listdir(out_dir) if f.endswith(".json")]
        if not json_files:
            bridge.error(f"WhisperX produced no JSON output in {out_dir}")
            sys.exit(1)

        json_path = os.path.join(out_dir, json_files[0])
        with open(json_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)

        segments = data.get("segments", [])
        # Normalise — WhisperX segment shape: {start, end, text, words?, speaker?}
        normalised: list[dict] = []
        for seg in segments:
            normalised.append({
                "start": float(seg.get("start", 0)),
                "end": float(seg.get("end", 0)),
                "text": (seg.get("text") or "").strip(),
                "speaker": seg.get("speaker"),
                "words": seg.get("words", [])[:200],  # cap for sanity
            })

        bridge.progress(100, 100, "Done.")

        # Estimate duration from last segment
        duration = max((s["end"] for s in normalised), default=0.0)

        bridge.result({
            "audioPath": audio_path,
            "model": model,
            "language": data.get("language"),
            "durationSeconds": duration,
            "diarizationEnabled": diarize,
            "segmentCount": len(normalised),
            "segments": normalised,
        })


if __name__ == "__main__":
    bridge.main_guard(run)

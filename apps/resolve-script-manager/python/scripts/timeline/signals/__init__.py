"""Highlight-scoring signals.

Each signal in this package implements:
    def available() -> bool
    def compute(ffmpeg: str, ffprobe: str, video: str,
                shots: list[tuple[float, float]]) -> dict[int, float]

`compute` returns a dict mapping shot-index -> score in [0, 1] (or
negative for penalty-signals). Signals are *optional*: missing
dependencies → `available()` returns False and the signal is skipped.

The orchestrator (`extract_highlight_from_film`) combines the available
signals using genre-specific weights (`genre_weights.py`).
"""

from __future__ import annotations

import importlib
from typing import Any, Callable, TypedDict


class SignalSpec(TypedDict):
    name: str
    module: str
    description: str
    requires: tuple[str, ...]  # pip-installable deps for human-readable messages


# All discoverable signals. Order is just for log-readability.
REGISTRY: tuple[SignalSpec, ...] = (
    {"name": "exposure", "module": "exposure",
     "description": "highlight/shadow clipping penalty",
     "requires": ("ffmpeg with signalstats",)},
    {"name": "slowmo", "module": "slowmo",
     "description": "slow-motion / cinematic-pace bonus",
     "requires": ("ffmpeg",)},
    {"name": "color_grade", "module": "color_grade",
     "description": "graded vs flat/log signal",
     "requires": ("ffmpeg with signalstats",)},
    {"name": "bokeh", "module": "bokeh",
     "description": "shallow-DOF / cinematic-framing bonus",
     "requires": ("opencv-python",)},
    {"name": "speech", "module": "speech",
     "description": "dialog-without-context penalty",
     "requires": ("webrtcvad",)},
    {"name": "emotional_peak", "module": "emotional_peak",
     "description": "audio crescendo + visual motion peak bonus",
     "requires": ("librosa",)},
    {"name": "faces", "module": "faces",
     "description": "couple/family face detection bonus",
     "requires": ("opencv-python", "(optional) face_recognition",)},
    {"name": "wedding_events", "module": "wedding_events",
     "description": "ring/kiss/dance/cake-cutting (YOLOv8)",
     "requires": ("ultralytics",)},
    {"name": "chapters", "module": "chapters",
     "description": "ceremony/reception/dance segmentation",
     "requires": ("librosa", "scikit-learn",)},
    {"name": "audio_events", "module": "audio_events",
     "description": "YAMNet audio-event detection (applaus/latter/gråt)",
     "requires": ("tensorflow", "tensorflow-hub",)},
    {"name": "aesthetic", "module": "aesthetic",
     "description": "LAION CLIP-aesthetic-predictor cinematic-score",
     "requires": ("open_clip_torch", "torch",)},
    {"name": "pose", "module": "pose",
     "description": "MediaPipe pose-landmarks → kneeling/praying/raised-hand",
     "requires": ("mediapipe",)},
    {"name": "open_vocab", "module": "open_vocab",
     "description": "GroundingDINO text-prompt detection (bride/ring/cake)",
     "requires": ("groundingdino-py", "torch",)},
)


def load(name: str):
    """Import the signal module by name. Returns module or None on failure."""
    try:
        return importlib.import_module(f"signals.{name}")
    except Exception:  # noqa: BLE001
        return None


def available_signals(logger: Callable[[str], None] | None = None) -> dict[str, Any]:
    """Return {name: module} for every signal whose `available()` is True."""
    out: dict[str, Any] = {}
    for spec in REGISTRY:
        mod = load(spec["module"])
        if mod is None:
            if logger:
                logger(f"signal '{spec['name']}': module not loadable")
            continue
        try:
            ok = bool(mod.available())
        except Exception as exc:  # noqa: BLE001
            if logger:
                logger(f"signal '{spec['name']}': available() raised {exc}")
            ok = False
        if ok:
            out[spec["name"]] = mod
            if logger:
                logger(f"signal '{spec['name']}': ✓ ready ({spec['description']})")
        elif logger:
            logger(
                f"signal '{spec['name']}': skipped (requires "
                f"{', '.join(spec['requires'])})"
            )
    return out

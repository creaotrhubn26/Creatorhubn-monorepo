"""Isolate vocals + stems via Demucs 4-stem source-separation.

Wedding use-case: i ceremony-audio er det ofte musikk fra speakerne MENS
brudgom snakker. Demucs splitter dette i 4 stem-spor:
  - vocals  (speech + sang)
  - drums   (rytmiske elementer)
  - bass    (lavfrekvens)
  - other   (alt annet — strings, pads, ambient)

Brukbare som:
  1. Bedre quote-extraction: kjør WhisperX kun på `vocals` for renere
     transkripsjon når musikk-speakere dominerer
  2. Music-video stem-cuts: cut på drums-onsets vs vocals-onsets separat
  3. Source-song-rebuild fra DIY-bryllup hvor original-fil er borte —
     ekstraher fra camera-audio + dub over senere

Ikke i R2 — bruker `demucs` pip-pakken (Meta/Facebook AI Research).
Models lastes ned automatisk fra HuggingFace ved første kjøring (~85MB
per model). Outputs i samme mappe som input som <basename>/vocals.wav etc.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

bridge.reexec_in_venv_if_present()


def _find_python_with_demucs() -> str | None:
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    candidates = []
    if os.path.isfile(venv_py):
        candidates.append(venv_py)
    candidates.append(shutil.which("python3") or "/usr/bin/python3")
    for py in candidates:
        try:
            r = subprocess.run(
                [py, "-c", "import demucs"],
                capture_output=True, timeout=10,
            )
            if r.returncode == 0:
                return py
        except (subprocess.SubprocessError, OSError):
            continue
    return None


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    model_name = (params.get("model") or "htdemucs").strip()
    # Valid demucs models: htdemucs (default), htdemucs_ft, mdx_extra, mdx_q
    # htdemucs = best quality, slow. mdx_q = fast/quantized.
    two_stems = (params.get("twoStems") or "").strip()  # "vocals" extracts vocals-only

    if not input_path or not os.path.isfile(input_path):
        bridge.error(f"inputPath '{input_path}' is not a file")
        sys.exit(1)

    python = _find_python_with_demucs()
    if not python:
        bridge.error(
            "demucs not installed. Install: pip install demucs "
            "(~1GB inkl PyTorch). Eller bruk venv-py312 via Dependencies-modalen."
        )
        sys.exit(1)

    out_dir = os.path.join(os.path.dirname(input_path), "stems")
    os.makedirs(out_dir, exist_ok=True)

    bridge.log(
        f"Demucs: {os.path.basename(input_path)} · model={model_name}"
        + (f" · two-stems={two_stems}" if two_stems else " · all 4 stems")
    )

    if dry_run:
        bridge.result({
            "wouldExtract": input_path,
            "outputDir": out_dir,
            "model": model_name,
            "stems": ["vocals", "drums", "bass", "other"] if not two_stems else [two_stems, "no_" + two_stems],
        })
        return

    # CLI invocation
    cmd = [
        python, "-m", "demucs.separate",
        "-n", model_name,
        "-o", out_dir,
    ]
    if two_stems:
        cmd += ["--two-stems", two_stems]
    cmd += ["-d", "mps" if _has_mps(python) else "cpu", input_path]

    bridge.progress(5, 100, f"Running Demucs ({model_name})…")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    except subprocess.TimeoutExpired:
        bridge.error("Demucs timed out (30 min)")
        sys.exit(1)
    if r.returncode != 0:
        bridge.error(f"Demucs failed: {(r.stderr or '')[-400:]}")
        sys.exit(1)

    # Output layout: <out_dir>/<model_name>/<basename>/vocals.wav etc.
    basename = os.path.splitext(os.path.basename(input_path))[0]
    result_dir = os.path.join(out_dir, model_name, basename)
    stems_found = {}
    if os.path.isdir(result_dir):
        for stem_file in os.listdir(result_dir):
            if stem_file.endswith(".wav"):
                stem_name = os.path.splitext(stem_file)[0]
                stem_path = os.path.join(result_dir, stem_file)
                stems_found[stem_name] = {
                    "path": stem_path,
                    "sizeMb": round(os.path.getsize(stem_path) / (1024**2), 1),
                }

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "inputPath": input_path,
        "outputDir": result_dir,
        "model": model_name,
        "stems": stems_found,
        "note": (
            "Stems kan brukes i build_highlight_from_picks via "
            "vocals→A_dialog-track + drums→A_music-track separat."
        ),
    })


def _has_mps(python: str) -> bool:
    """Detect if MPS (Apple Metal) is available — Demucs supports it natively."""
    try:
        r = subprocess.run(
            [python, "-c",
             "import torch; print('1' if torch.backends.mps.is_available() else '0')"],
            capture_output=True, text=True, timeout=10,
        )
        return r.stdout.strip() == "1"
    except Exception:  # noqa: BLE001
        return False


if __name__ == "__main__":
    bridge.main_guard(run)

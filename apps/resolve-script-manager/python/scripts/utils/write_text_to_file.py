"""Write Text To File — enkel utility som skriver tekst-content til
en spesifisert filsti. Brukes av frontend-komponenter (Caption Studio,
Resolve handoff) som trenger å lagre tekst-output til disk uten
@tauri-apps/plugin-fs.

Input params:
  content:     tekst-streng som skal skrives
  outputPath:  absolutt filsti
  encoding:    (optional, default utf-8)
"""

from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    content = params.get("content")
    output_path = (params.get("outputPath") or "").strip()
    encoding = (params.get("encoding") or "utf-8").strip()

    if content is None:
        bridge.error("content er påkrevd")
        sys.exit(1)
    if not output_path:
        bridge.error("outputPath er påkrevd")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "wouldWrite": output_path,
            "contentLength": len(str(content)),
        })
        return

    try:
        parent = os.path.dirname(output_path)
        if parent and not os.path.isdir(parent):
            os.makedirs(parent, exist_ok=True)
        with open(output_path, "w", encoding=encoding) as f:
            f.write(str(content))
        bridge.result({
            "outputPath": output_path,
            "bytesWritten": len(str(content).encode(encoding)),
        })
    except Exception as exc:
        bridge.error(f"Skriving feilet: {exc}")
        sys.exit(1)


bridge.main_guard(run)

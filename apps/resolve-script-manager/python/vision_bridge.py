"""
Apple Vision-bro — kaller den kompilerte Swift-sidecaren (`bin/vision_cli`)
direkte, samme mønster som ffmpeg. Degraderer pent: hvis binæren mangler,
returnerer funksjonene None, og kallerne faller tilbake på andre signaler.

Bygg sidecaren: `swiftc -O vision/vision_cli.swift -o bin/vision_cli`
(se docs/APPLE_VISION.md). På-enhet, gratis, offline.
"""
from __future__ import annotations
import os, json, subprocess

_ROOT = os.path.dirname(os.path.abspath(__file__))          # …/python
BIN = os.path.join(_ROOT, "bin", "vision_cli")


def available() -> bool:
    return os.path.exists(BIN) and os.access(BIN, os.X_OK)


def version_info() -> dict:
    return {"available": available(), "path": BIN if available() else None}


def analyze_video(path: str, fps: float = 2.0, requests: str = "pose,quality",
                  max_frames: int = 3600, timeout: int = 900):
    """→ {'fps', 'frames':[{t,persons,arms_raised,fall,face_quality,salient}]} eller None."""
    if not available() or not os.path.exists(path):
        return None
    try:
        r = subprocess.run(
            [BIN, "video", path, "--fps", str(fps), "--max-frames", str(max_frames),
             "--requests", requests],
            capture_output=True, text=True, timeout=timeout)
        return json.loads(r.stdout) if r.stdout.strip() else None
    except Exception:
        return None


def analyze_image(path: str, requests: str = "faces,pose,quality,saliency,text"):
    """→ dict (faces, face_quality, persons, arms_raised, horizontal, salient, text) eller None."""
    if not available() or not os.path.exists(path):
        return None
    try:
        r = subprocess.run([BIN, "image", path, "--requests", requests],
                           capture_output=True, text=True, timeout=120)
        return json.loads(r.stdout) if r.stdout.strip() else None
    except Exception:
        return None

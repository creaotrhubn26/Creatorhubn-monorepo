"""Detect log gamma in source video.

Bruker ffprobe + filnavn-mønstre for å oppdage om video er skutt i log
(C-Log, S-Log, V-Log, BMD Film, LogC, F-Log, N-Log, D-Log, Log3G10).

Output: { isLog: bool, profile: str, gamma: str, suggestedLut: str }

Brukes av onboarding-wizard for å auto-foreslå LUT KUN når video er log.
Rec.709/graded video skal IKKE få auto-LUT (oversaturerer).
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Filnavn-mønstre → log-profile-hints
LOG_PATTERNS = [
    (re.compile(r"\bC[-_]?Log\s*2|CLog2", re.IGNORECASE),       ("C-Log2", "Canon C-Log2 to Rec.709", "norwedfilm")),
    (re.compile(r"\bC[-_]?Log\s*3|CLog3", re.IGNORECASE),       ("C-Log3", "Canon C-Log3 to Rec.709", "norwedfilm")),
    (re.compile(r"\bS[-_]?Log\s*3|SLog3", re.IGNORECASE),       ("S-Log3", "Sony S-Log3 to Rec.709", "cinematic")),
    (re.compile(r"\bS[-_]?Log\s*2|SLog2", re.IGNORECASE),       ("S-Log2", "Sony S-Log2 to Rec.709", "cinematic")),
    (re.compile(r"\bV[-_]?Log|VLog", re.IGNORECASE),            ("V-Log", "Panasonic V-Log to Rec.709", "cinematic")),
    (re.compile(r"\bLogC|Arri\s*Log", re.IGNORECASE),           ("ARRI LogC", "ARRI LogC to Rec.709", "cinematic")),
    (re.compile(r"\bF[-_]?Log|FLog", re.IGNORECASE),            ("F-Log", "Fuji F-Log to Rec.709", "warm")),
    (re.compile(r"\bN[-_]?Log|NLog", re.IGNORECASE),            ("N-Log", "Nikon N-Log to Rec.709", "warm")),
    (re.compile(r"\bD[-_]?Log|DLog", re.IGNORECASE),            ("D-Log", "DJI D-Log to Rec.709", "warm")),
    (re.compile(r"BMD\s*Film|BRAW|Blackmagic\s*Film", re.IGNORECASE), ("Blackmagic Film", "BMD Film to Rec.709", "cinematic")),
    (re.compile(r"Log3G10|RED\s*Log", re.IGNORECASE),           ("Log3G10", "RED Log3G10 to Rec.709", "cinematic")),
]


def find_tool(name: str) -> str | None:
    for p in [shutil.which(name),
              f"/opt/homebrew/bin/{name}",
              f"/usr/local/bin/{name}",
              f"/usr/bin/{name}"]:
        if p and os.path.isfile(p):
            return p
    return None


def detect(video_path: str) -> dict:
    file_base = os.path.basename(video_path)

    # Strategy 1: pattern-match filename
    for pattern, (profile, lut_name, suggested_look) in LOG_PATTERNS:
        if pattern.search(file_base):
            return {
                "isLog": True,
                "profile": profile,
                "gamma": lut_name,
                "suggestedLut": suggested_look,
                "method": "filename",
            }

    # Strategy 2: ffprobe color metadata
    ffprobe = find_tool("ffprobe")
    if not ffprobe:
        return {
            "isLog": False,
            "profile": "unknown",
            "gamma": "rec.709 (assumed)",
            "suggestedLut": "none",
            "method": "ffprobe-not-available",
        }
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error",
             "-select_streams", "v:0",
             "-show_entries", "stream=color_space,color_transfer,color_primaries,codec_name,pix_fmt",
             "-of", "json", video_path],
            capture_output=True, text=True, timeout=20,
        )
        if r.returncode == 0:
            data = json.loads(r.stdout)
            stream = (data.get("streams") or [{}])[0]
            color_trc = (stream.get("color_transfer") or "").lower()
            color_space = (stream.get("color_space") or "").lower()
            color_pri = (stream.get("color_primaries") or "").lower()
            codec = (stream.get("codec_name") or "").lower()

            # Common log-gamma transfer functions
            log_trc_keywords = ["arib-std-b67", "smpte428", "smpte2084", "iec61966-2-4",
                                "log", "linear"]
            is_log = any(kw in color_trc for kw in log_trc_keywords)

            # BRAW / Cinema-DNG / R3D codecs er typisk log
            if codec in ("braw", "cinema_dng", "r3d", "prores"):
                is_log = True

            # Wide-gamut color primaries indikerer log/HDR
            wide_gamut = color_pri in ("bt2020", "smpte428", "smpte431", "smpte432")

            if is_log or wide_gamut:
                # Detect from codec/transfer
                profile = "Unknown log"
                lut_name = "Generic log → Rec.709"
                suggested = "cinematic"
                if codec == "braw" or "blackmagic" in (stream.get("codec_long_name", "") or "").lower():
                    profile, lut_name, suggested = "Blackmagic Film", "BMD Film to Rec.709", "cinematic"
                elif color_trc == "smpte428":
                    profile, lut_name, suggested = "DCI-P3 / log", "DCI to Rec.709", "cinematic"
                return {
                    "isLog": True,
                    "profile": profile,
                    "gamma": lut_name,
                    "suggestedLut": suggested,
                    "method": "ffprobe",
                    "colorTransfer": color_trc,
                    "colorSpace": color_space,
                    "colorPrimaries": color_pri,
                    "codec": codec,
                }
            return {
                "isLog": False,
                "profile": "Rec.709 / graded",
                "gamma": "no LUT needed (already graded)",
                "suggestedLut": "none",
                "method": "ffprobe",
                "colorTransfer": color_trc or "bt709",
                "colorSpace": color_space or "bt709",
                "colorPrimaries": color_pri or "bt709",
                "codec": codec,
            }
    except Exception as e:  # noqa: BLE001
        bridge.warn(f"ffprobe failed: {e}")

    return {
        "isLog": False,
        "profile": "unknown",
        "gamma": "rec.709 (default)",
        "suggestedLut": "none",
        "method": "default",
    }


def run(params: dict[str, Any], dry_run: bool) -> None:
    video_path = (params.get("videoPath") or "").strip()
    if not video_path or not os.path.isfile(video_path):
        bridge.error(f"videoPath '{video_path}' is not a file")
        sys.exit(1)

    if dry_run:
        bridge.result({"wouldDetect": video_path})
        return

    bridge.progress(0, 100, "Detecting log-gamma…")
    result = detect(video_path)
    bridge.log(
        f"Method: {result['method']} → {result['profile']} ({result['gamma']})"
    )
    bridge.progress(100, 100, "Ferdig")
    bridge.result(result)


if __name__ == "__main__":
    bridge.main_guard(run)

"""Detect Camera Profiles — reads Media Pool metadata + filenames, classifies log profile per clip."""

from __future__ import annotations

import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# Maps regex against clip name + camera metadata → (camera, log_profile, color_space, output_transform)
PROFILE_HINTS = [
    (re.compile(r"C80|EOS\s*C80", re.IGNORECASE), ("Canon C80", "C-Log2", "Cinema Gamut", "Canon C-Log2 to Rec.709")),
    (re.compile(r"C70|EOS\s*C70", re.IGNORECASE), ("Canon C70", "C-Log2", "Cinema Gamut", "Canon C-Log2 to Rec.709")),
    (re.compile(r"C300|C500", re.IGNORECASE), ("Canon Cinema EOS", "C-Log3", "Cinema Gamut", "Canon C-Log3 to Rec.709")),
    (re.compile(r"R5C", re.IGNORECASE), ("Canon R5C", "C-Log3", "Cinema Gamut", "Canon C-Log3 to Rec.709")),
    (re.compile(r"R5|EOS\s*R5", re.IGNORECASE), ("Canon R5", "C-Log3", "Cinema Gamut", "Canon C-Log3 to Rec.709")),
    (re.compile(r"FX3|FX6|FX9|A7S|A1\b", re.IGNORECASE), ("Sony Alpha/FX", "S-Log3", "S-Gamut3.Cine", "Sony S-Log3 to Rec.709")),
    (re.compile(r"VENICE", re.IGNORECASE), ("Sony Venice", "S-Log3", "S-Gamut3.Cine", "Sony S-Log3 to Rec.709")),
    (re.compile(r"GH5|GH6|S1H|S5|Lumix|VariCam", re.IGNORECASE), ("Panasonic", "V-Log", "V-Gamut", "Panasonic V-Log to Rec.709")),
    (re.compile(r"MAVIC|INSPIRE|AIR|DJI", re.IGNORECASE), ("DJI Drone", "D-Log", "D-Gamut", "DJI D-Log to Rec.709")),
    (re.compile(r"URSA|POCKET|BRAW", re.IGNORECASE), ("Blackmagic", "Blackmagic Film", "Blackmagic Wide Gamut", "BMD Film to Rec.709")),
    (re.compile(r"ALEXA|AMIRA", re.IGNORECASE), ("ARRI Alexa", "LogC", "ARRI Wide Gamut", "ARRI LogC to Rec.709")),
    (re.compile(r"RED\b|KOMODO|RAPTOR", re.IGNORECASE), ("RED", "Log3G10", "REDWideGamutRGB", "RED Log3G10 to Rec.709")),
    (re.compile(r"X-?T4|X-?H2|XH2|FUJI", re.IGNORECASE), ("Fujifilm", "F-Log", "F-Gamut", "Fuji F-Log to Rec.709")),
    (re.compile(r"Z9|Z8|Z6|NIKON", re.IGNORECASE), ("Nikon", "N-Log", "N-Gamut", "Nikon N-Log to Rec.709")),
    (re.compile(r"iPhone|IMG_\d+", re.IGNORECASE), ("iPhone", "Rec.709/HDR", "Rec.709", "none (already Rec.709)")),
]


def walk_clips(folder, acc):
    acc.extend(folder.GetClipList() or [])
    for sub in folder.GetSubFolderList() or []:
        walk_clips(sub, acc)


def classify(clip_name: str, metadata: dict, clip_property: dict) -> dict | None:
    camera_meta = (metadata or {}).get("Camera Type") or (metadata or {}).get("Camera Model") or ""
    file_path = (clip_property or {}).get("File Path", "")
    haystack = " ".join([clip_name, camera_meta, file_path])
    for pattern, (camera, log, gamut, transform) in PROFILE_HINTS:
        if pattern.search(haystack):
            return {
                "camera": camera,
                "logProfile": log,
                "colorSpace": gamut,
                "suggestedTransform": transform,
            }
    return None


def run(params: dict, dry_run: bool) -> None:
    if dry_run:
        bridge.result({
            "summary": "Dry run — would scan all clips and group by camera/log-profile",
            "supportedProfiles": [
                {"camera": camera, "logProfile": log}
                for _, (camera, log, _, _) in PROFILE_HINTS
            ],
            "output": "{ clipsByProfile, unknownCount, suggestedTransforms }",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    clips: list = []
    walk_clips(conn.media_pool.GetRootFolder(), clips)
    bridge.log(f"Scanning {len(clips)} clips for camera profile detection")

    by_profile: dict[str, list[str]] = defaultdict(list)
    unknown: list[str] = []
    transforms: dict[str, str] = {}

    for clip in clips:
        try:
            name = clip.GetName()
            metadata = clip.GetMetadata() or {}
            props = clip.GetClipProperty() or {}
        except Exception:
            continue
        profile = classify(name, metadata, props)
        if profile:
            key = f"{profile['camera']} · {profile['logProfile']}"
            by_profile[key].append(name)
            transforms[key] = profile["suggestedTransform"]
        else:
            unknown.append(name)

    bridge.result({
        "totalClips": len(clips),
        "clipsByProfile": {k: len(v) for k, v in by_profile.items()},
        "clipsByProfileSample": {k: v[:5] for k, v in by_profile.items()},
        "unknownCount": len(unknown),
        "unknownSample": unknown[:10],
        "suggestedTransforms": transforms,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

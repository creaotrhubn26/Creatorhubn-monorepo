"""Apply Camera LUT — sets the right input LUT per camera on every timeline item.

Maps camera profile (from detect_camera_profiles) to LUT file. Uses
TimelineItem.SetLUT(node_index, lut_path) — first-node LUT slot.
"""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


DEFAULT_MAPPING = {
    "Canon C80": "Canon C-Log2 to Rec.709 v1.1.cube",
    "Canon C70": "Canon C-Log2 to Rec.709 v1.1.cube",
    "Canon R5": "Canon C-Log3 to Rec.709 v1.0.cube",
    "Canon R5C": "Canon C-Log3 to Rec.709 v1.0.cube",
    "Canon Cinema EOS": "Canon C-Log3 to Rec.709 v1.0.cube",
    "Sony Alpha/FX": "From_SLog3SGamut3CineTo_LC-709.cube",
    "Sony Venice": "From_SLog3SGamut3CineTo_LC-709.cube",
    "Panasonic": "Panasonic V-Log to V-709.cube",
    "DJI Drone": "DJI_DLog-M_to_Rec709.cube",
    "Blackmagic": "Blackmagic Film Gen5 to Rec709 v1.0.cube",
    "ARRI Alexa": "From_LogC_to_Video_Rec709_v1.cube",
    "RED": "RED Log3G10 to Rec709.cube",
    "Fujifilm": "Fujifilm F-Log to Rec709.cube",
    "Nikon": "Nikon N-Log to Rec709.cube",
}


CAMERA_HINTS = [
    (re.compile(r"C80|EOS\s*C80", re.IGNORECASE), "Canon C80"),
    (re.compile(r"C70|EOS\s*C70", re.IGNORECASE), "Canon C70"),
    (re.compile(r"C300|C500", re.IGNORECASE), "Canon Cinema EOS"),
    (re.compile(r"R5C", re.IGNORECASE), "Canon R5C"),
    (re.compile(r"R5|EOS\s*R5", re.IGNORECASE), "Canon R5"),
    (re.compile(r"FX3|FX6|FX9|A7S|A1\b", re.IGNORECASE), "Sony Alpha/FX"),
    (re.compile(r"VENICE", re.IGNORECASE), "Sony Venice"),
    (re.compile(r"GH5|GH6|S1H|S5|Lumix|VariCam", re.IGNORECASE), "Panasonic"),
    (re.compile(r"MAVIC|INSPIRE|AIR|DJI", re.IGNORECASE), "DJI Drone"),
    (re.compile(r"URSA|POCKET|BRAW", re.IGNORECASE), "Blackmagic"),
    (re.compile(r"ALEXA|AMIRA", re.IGNORECASE), "ARRI Alexa"),
    (re.compile(r"RED\b|KOMODO|RAPTOR", re.IGNORECASE), "RED"),
    (re.compile(r"X-?T4|X-?H2|XH2|FUJI", re.IGNORECASE), "Fujifilm"),
    (re.compile(r"Z9|Z8|Z6|NIKON", re.IGNORECASE), "Nikon"),
]


def classify(name: str, metadata: dict, props: dict) -> str | None:
    camera_meta = (metadata or {}).get("Camera Type") or (metadata or {}).get("Camera Model") or ""
    file_path = (props or {}).get("File Path", "")
    haystack = " ".join([name, camera_meta, file_path])
    for pattern, label in CAMERA_HINTS:
        if pattern.search(haystack):
            return label
    return None


def run(params: dict, dry_run: bool) -> None:
    mapping = params.get("lutMapping") or DEFAULT_MAPPING
    track_index = int(params.get("trackIndex", 1))
    node_index = int(params.get("nodeIndex", 1))

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would apply per-camera LUT to node {node_index} of every clip on V{track_index}",
            "lutMapping": mapping,
            "method": "TimelineItem.SetLUT(node_index, lut_path)",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline")
        sys.exit(1)

    items = timeline.GetItemListInTrack("video", track_index) or []
    bridge.log(f"Processing {len(items)} items on V{track_index}")

    applied: list[dict] = []
    skipped: list[dict] = []
    failed: list[dict] = []

    for item in items:
        try:
            mp_item = item.GetMediaPoolItem()
            if not mp_item:
                skipped.append({"item": item.GetName(), "reason": "no media pool item"})
                continue
            name = mp_item.GetName()
            metadata = mp_item.GetMetadata() or {}
            props = mp_item.GetClipProperty() or {}
        except Exception as exc:
            failed.append({"item": "(unknown)", "error": str(exc)})
            continue

        profile = classify(name, metadata, props)
        if not profile or profile not in mapping:
            skipped.append({"item": name, "reason": f"profile '{profile}' not in mapping"})
            continue
        lut_path = mapping[profile]
        try:
            ok = item.SetLUT(node_index, lut_path)
        except Exception as exc:
            failed.append({"item": name, "profile": profile, "error": str(exc)})
            continue
        if ok:
            applied.append({"item": name, "profile": profile, "lut": lut_path})
        else:
            failed.append({"item": name, "profile": profile, "error": "SetLUT returned false"})

    bridge.result({
        "trackIndex": track_index,
        "nodeIndex": node_index,
        "appliedCount": len(applied),
        "skippedCount": len(skipped),
        "failedCount": len(failed),
        "applied": applied[:30],
        "skipped": skipped[:30],
        "failed": failed[:30],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

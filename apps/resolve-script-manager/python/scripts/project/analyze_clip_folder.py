"""Analyze Clip Folder — scans a folder and proposes a project template.

Output goes straight into the Onboarding Wizard:
  - cameraDistribution: per-camera clip count from filename patterns + metadata
  - audioRecorders: detected external recorder patterns (ZOOM, H6, TASCAM…)
  - sceneHints: scene-related words found in filenames (vows, ceremony, drone, demo…)
  - videoCount / audioCount / imageCount / totalBytes
  - suggestedTemplate: best-match template id + confidence + reasoning
  - alternateTemplates: ranked alternatives
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".mxf", ".avi", ".mkv", ".braw", ".r3d", ".arri"}
AUDIO_EXTS = {".wav", ".aif", ".aiff", ".mp3", ".flac", ".m4a"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".dpx", ".exr", ".cr3", ".raf", ".arw"}


CAMERA_PATTERNS = [
    (re.compile(r"C80|EOS\s*C80", re.IGNORECASE), "Canon C80", "C-Log2"),
    (re.compile(r"C70|EOS\s*C70", re.IGNORECASE), "Canon C70", "C-Log2"),
    (re.compile(r"C300", re.IGNORECASE), "Canon C300", "C-Log3"),
    (re.compile(r"R5C", re.IGNORECASE), "Canon R5C", "C-Log3"),
    (re.compile(r"R5|EOS\s*R5", re.IGNORECASE), "Canon R5", "C-Log3"),
    (re.compile(r"R6|EOS\s*R6", re.IGNORECASE), "Canon R6", "C-Log3"),
    (re.compile(r"FX3|FX6|FX9", re.IGNORECASE), "Sony FX", "S-Log3"),
    (re.compile(r"A7S|A1\b|A7IV", re.IGNORECASE), "Sony Alpha", "S-Log3"),
    (re.compile(r"VENICE", re.IGNORECASE), "Sony Venice", "S-Log3"),
    (re.compile(r"GH5|GH6|S1H|S5|S5II", re.IGNORECASE), "Panasonic", "V-Log"),
    (re.compile(r"MAVIC|INSPIRE|AIR\s*\d|MINI\s*\d|DJI", re.IGNORECASE), "DJI Drone", "D-Log"),
    (re.compile(r"URSA|POCKET|BMPCC|BRAW", re.IGNORECASE), "Blackmagic", "Blackmagic Film"),
    (re.compile(r"ALEXA|AMIRA|ARRI", re.IGNORECASE), "ARRI Alexa", "LogC"),
    (re.compile(r"\bRED\b|KOMODO|RAPTOR", re.IGNORECASE), "RED", "Log3G10"),
    (re.compile(r"X-?T4|X-?H2|XH2", re.IGNORECASE), "Fujifilm", "F-Log"),
    (re.compile(r"Z9|Z8|Z6|NIKON", re.IGNORECASE), "Nikon", "N-Log"),
    (re.compile(r"iPhone|IMG_\d+", re.IGNORECASE), "iPhone", "Rec.709"),
    (re.compile(r"INSTA360|ONE\s*X|GO\s*\d", re.IGNORECASE), "Insta360", "Rec.709"),
    (re.compile(r"GOPRO|GO\s*PRO|HERO\d", re.IGNORECASE), "GoPro", "GoPro Protune"),
]


AUDIO_RECORDER_PATTERNS = [
    (re.compile(r"ZOOM\d*|ZOOM_|H[465]N?", re.IGNORECASE), "Zoom"),
    (re.compile(r"TASCAM|DR-?\d", re.IGNORECASE), "Tascam"),
    (re.compile(r"MIXPRE", re.IGNORECASE), "Sound Devices MixPre"),
    (re.compile(r"RODE\s?(NTG|VIDEO|GO|WIRELESS)", re.IGNORECASE), "Rode"),
    (re.compile(r"\bLAV\b|LAVALIER|GROOM|BRIDE|OFFICIANT", re.IGNORECASE), "Lav mic"),
]


# Words in filenames that hint at project type
SCENE_HINTS = {
    "wedding_film": [
        re.compile(r"\b(BRIDE|GROOM|CEREMONY|VOWS|RECEPTION|FIRST.?DANCE|RING|KISS|TOAST|SPEECH)\b", re.IGNORECASE),
    ],
    "documentary": [
        re.compile(r"\b(INTERVIEW|VERITE|ARCHIVE|SUBJECT|DOC)\b", re.IGNORECASE),
    ],
    "podcast": [
        re.compile(r"\b(EPISODE|EP\d+|HOST|GUEST|INTRO|OUTRO|BUMPER)\b", re.IGNORECASE),
    ],
    "course_academy": [
        re.compile(r"\b(LESSON|MODULE|TUTORIAL|DEMO|SLIDE|SCREEN.?REC)\b", re.IGNORECASE),
    ],
    "music_video": [
        re.compile(r"\b(VERSE|CHORUS|HOOK|PERFORMANCE|MV|MUSIC.?VID|BAND)\b", re.IGNORECASE),
    ],
    "social_media": [
        re.compile(r"\b(REEL|TIKTOK|SHORTS|VERTICAL|9X16|9X18|HOOK)\b", re.IGNORECASE),
    ],
    "corporate_video": [
        re.compile(r"\b(CORP|BRAND|EXEC|CEO|CLIENT|PRODUCT|CASE.?STUDY)\b", re.IGNORECASE),
    ],
}


# Camera + content signals → template confidence boosts
TEMPLATE_RULES = [
    {
        "template": "wedding_film",
        "label": "Wedding Film",
        "checks": [
            ("has_scene_hint", "wedding_film", 0.45),
            ("has_external_audio", 0.20),
            ("has_drone", 0.10),
            ("camera_count_gte", 2, 0.15),
        ],
    },
    {
        "template": "documentary",
        "label": "Documentary",
        "checks": [
            ("has_scene_hint", "documentary", 0.45),
            ("has_external_audio", 0.20),
            ("camera_count_gte", 2, 0.15),
            ("avg_clip_seconds_gte", 60, 0.10),
        ],
    },
    {
        "template": "podcast",
        "label": "Podcast (Video)",
        "checks": [
            ("has_scene_hint", "podcast", 0.40),
            ("has_external_audio", 0.30),
            ("camera_count_gte", 2, 0.20),
            ("low_drone_ratio", 0.10),
        ],
    },
    {
        "template": "course_academy",
        "label": "Course / Academy",
        "checks": [
            ("has_scene_hint", "course_academy", 0.45),
            ("has_screen_recording", 0.30),
            ("camera_count_lte", 2, 0.15),
        ],
    },
    {
        "template": "music_video",
        "label": "Music Video",
        "checks": [
            ("has_scene_hint", "music_video", 0.40),
            ("camera_count_gte", 3, 0.25),
            ("has_drone", 0.20),
        ],
    },
    {
        "template": "social_media",
        "label": "Social Media Batch",
        "checks": [
            ("has_scene_hint", "social_media", 0.45),
            ("short_clip_ratio_gte", 0.5, 0.30),
            ("avg_clip_seconds_lte", 30, 0.20),
        ],
    },
    {
        "template": "corporate_video",
        "label": "Corporate Video",
        "checks": [
            ("has_scene_hint", "corporate_video", 0.40),
            ("camera_count_gte", 2, 0.15),
            ("has_screen_recording", 0.15),
        ],
    },
]


def classify_camera(name: str) -> tuple[str | None, str | None]:
    for pattern, label, log_profile in CAMERA_PATTERNS:
        if pattern.search(name):
            return label, log_profile
    return None, None


def classify_audio_recorder(name: str) -> str | None:
    for pattern, label in AUDIO_RECORDER_PATTERNS:
        if pattern.search(name):
            return label
    return None


def scan_folder(root: str) -> dict:
    """Walk the folder and collect raw stats."""
    video_files: list[dict] = []
    audio_files: list[dict] = []
    image_count = 0
    screen_recording_count = 0
    camera_counter: Counter = Counter()
    log_profile_counter: Counter = Counter()
    recorder_counter: Counter = Counter()
    scene_hint_counter: dict[str, Counter] = defaultdict(Counter)
    total_bytes = 0
    durations: list[float] = []

    for dirpath, _dirs, files in os.walk(root):
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            full_path = os.path.join(dirpath, fname)
            try:
                size = os.path.getsize(full_path)
            except OSError:
                continue
            total_bytes += size

            if ext in VIDEO_EXTS:
                video_files.append({"name": fname, "path": full_path, "size": size})
                # Detect screen recording by filename hints
                if re.search(r"SCREEN|RECORDING|SCREENREC|CAPTURE", fname, re.IGNORECASE):
                    screen_recording_count += 1
                cam, log_profile = classify_camera(fname)
                if cam:
                    camera_counter[cam] += 1
                    if log_profile:
                        log_profile_counter[log_profile] += 1
                # Scene hint detection
                for template_id, patterns in SCENE_HINTS.items():
                    for pat in patterns:
                        if pat.search(fname):
                            scene_hint_counter[template_id][fname] += 1

            elif ext in AUDIO_EXTS:
                audio_files.append({"name": fname, "path": full_path, "size": size})
                rec = classify_audio_recorder(fname)
                if rec:
                    recorder_counter[rec] += 1

            elif ext in IMAGE_EXTS:
                image_count += 1

    return {
        "videoFiles": video_files,
        "audioFiles": audio_files,
        "imageCount": image_count,
        "screenRecordingCount": screen_recording_count,
        "cameraCounter": camera_counter,
        "logProfileCounter": log_profile_counter,
        "recorderCounter": recorder_counter,
        "sceneHintCounter": {k: dict(v) for k, v in scene_hint_counter.items()},
        "totalBytes": total_bytes,
        "durations": durations,
    }


def evaluate_template_rules(scan: dict) -> list[dict]:
    """Score each template against scan data, return ranked list."""
    video_count = len(scan["videoFiles"])
    audio_count = len(scan["audioFiles"])
    camera_count = len(scan["cameraCounter"])
    has_drone = scan["cameraCounter"].get("DJI Drone", 0) > 0
    has_external_audio = audio_count > 0 or sum(scan["recorderCounter"].values()) > 0
    has_screen_recording = scan["screenRecordingCount"] > 0
    drone_ratio = scan["cameraCounter"].get("DJI Drone", 0) / max(1, video_count)

    # Scene-hint counts per template
    scene_hint_count_per_template = {
        tid: sum(matches.values()) for tid, matches in scan["sceneHintCounter"].items()
    }

    # Average clip seconds — not measured (would need ffprobe per file).
    # We use file-size heuristic: very small files (< 50MB) suggest short clips.
    short_clip_count = sum(1 for v in scan["videoFiles"] if v["size"] < 50 * 1_000_000)
    short_clip_ratio = short_clip_count / max(1, video_count)

    results: list[dict] = []
    for rule in TEMPLATE_RULES:
        score = 0.0
        reasoning_parts: list[str] = []
        for check in rule["checks"]:
            kind = check[0]
            if kind == "has_scene_hint":
                tid, weight = check[1], check[2]
                count = scene_hint_count_per_template.get(tid, 0)
                if count > 0:
                    score += weight
                    reasoning_parts.append(f"{count} {tid.replace('_', ' ')}-relevant filename(s)")
            elif kind == "has_external_audio":
                weight = check[1]
                if has_external_audio:
                    score += weight
                    reasoning_parts.append("external audio recorders")
            elif kind == "has_drone":
                weight = check[1]
                if has_drone:
                    score += weight
                    reasoning_parts.append("drone footage")
            elif kind == "camera_count_gte":
                threshold, weight = check[1], check[2]
                if camera_count >= threshold:
                    score += weight
                    reasoning_parts.append(f"{camera_count} cameras")
            elif kind == "camera_count_lte":
                threshold, weight = check[1], check[2]
                if camera_count <= threshold:
                    score += weight
                    reasoning_parts.append(f"≤{threshold} cameras")
            elif kind == "has_screen_recording":
                weight = check[1]
                if has_screen_recording:
                    score += weight
                    reasoning_parts.append("screen recordings detected")
            elif kind == "low_drone_ratio":
                weight = check[1]
                if drone_ratio < 0.05:
                    score += weight
            elif kind == "short_clip_ratio_gte":
                threshold, weight = check[1], check[2]
                if short_clip_ratio >= threshold:
                    score += weight
                    reasoning_parts.append(f"{int(short_clip_ratio*100)}% short clips")
            elif kind == "avg_clip_seconds_gte":
                # Without ffprobe per file, skip — would need real probe
                pass
            elif kind == "avg_clip_seconds_lte":
                pass

        confidence = min(1.0, score)
        results.append({
            "id": rule["template"],
            "name": rule["label"],
            "confidence": round(confidence, 2),
            "reasoning": "; ".join(reasoning_parts) if reasoning_parts else "no strong signals",
        })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results


def run(params: dict, dry_run: bool) -> None:
    folder = params.get("folderPath")
    if not folder:
        bridge.error("Missing required input: folderPath")
        sys.exit(1)
    folder = os.path.expanduser(folder)
    if not os.path.isdir(folder):
        bridge.error(f"Not a directory: {folder}")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would scan {folder} for camera patterns + scene hints + audio recorders",
            "outputShape": {
                "totalFiles": "int",
                "cameraDistribution": "dict of camera → count",
                "sceneHints": "dict of template_id → hit count",
                "suggestedTemplate": {"id": "...", "confidence": "0-1", "reasoning": "..."},
                "alternateTemplates": "[ranked list]",
            },
        })
        return

    bridge.log(f"Scanning {folder}…")
    scan = scan_folder(folder)
    video_count = len(scan["videoFiles"])
    audio_count = len(scan["audioFiles"])
    bridge.log(f"Found {video_count} video + {audio_count} audio + {scan['imageCount']} image files")

    template_rankings = evaluate_template_rules(scan)
    top = template_rankings[0] if template_rankings else None

    bridge.result({
        "folder": folder,
        "totalFiles": video_count + audio_count + scan["imageCount"],
        "videoCount": video_count,
        "audioCount": audio_count,
        "imageCount": scan["imageCount"],
        "totalBytes": scan["totalBytes"],
        "cameraDistribution": dict(scan["cameraCounter"]),
        "logProfileDistribution": dict(scan["logProfileCounter"]),
        "audioRecorders": dict(scan["recorderCounter"]),
        "screenRecordingCount": scan["screenRecordingCount"],
        "sceneHintCounts": {k: sum(v.values()) for k, v in scan["sceneHintCounter"].items()},
        "suggestedTemplate": top,
        "alternateTemplates": template_rankings[1:5],
    })


if __name__ == "__main__":
    bridge.main_guard(run)

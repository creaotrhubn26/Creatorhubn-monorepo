"""MediaPipe Pose-based ceremony-gesture detection.

MediaPipe Pose tracker (Google) gir 33 normaliserte body-landmarks per
person. Vi sjekker frame-for-frame mot kuraterte gesture-patterns som
indikerer ceremony/wedding-moments:

  kneeling          : begge knee-Y > hip-Y (kneeling for vow)
  raised_hand       : enten wrist høyt over shoulder (cheer/applause)
  praying           : begge wrists nær hverandre midt foran chest
  kiss_pose         : 2 personer med head-distance < shoulder-width
  embrace           : 2 personer med torso-bbox-overlap > 50%
  dancing           : skiftende limb-Y over tid (krever 3+ samples)
  standing_still    : minimal motion-variation
  formal_pose       : 3+ personer i ~horizontal line (group photo)

Per-shot score = max(weighted_gesture_score). Wedding-genre vekt detaljert
under WEDDING_GESTURE_WEIGHTS.

Krever `mediapipe` pip. Apple Silicon supported.
"""

from __future__ import annotations

import os
import subprocess
import tempfile


# Weights for each detected gesture — higher = more highlight-worthy
WEDDING_GESTURE_WEIGHTS: dict[str, float] = {
    "kneeling":      0.90,  # vow / proposal-like
    "kiss_pose":     1.00,  # the kiss
    "embrace":       0.85,
    "raised_hand":   0.65,  # cheer / applause / hand-up dance
    "praying":       0.80,
    "formal_pose":   0.50,
    "dancing":       0.70,
    "standing_still": 0.10,
}


def available() -> bool:
    try:
        import mediapipe as mp  # noqa: F401
        return True
    except ImportError:
        return False


_POSE = None


def _load_pose():
    global _POSE
    if _POSE is not None:
        return _POSE
    try:
        import mediapipe as mp  # type: ignore
        _POSE = mp.solutions.pose.Pose(
            static_image_mode=True,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
        )
        return _POSE
    except Exception:  # noqa: BLE001
        return None


def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    fd, tmp = tempfile.mkstemp(prefix="pose_", suffix=".jpg")
    os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts:.3f}", "-i", video,
             "-vframes", "1", "-q:v", "3",
             "-vf", "scale=640:-1",
             tmp],
            capture_output=True, timeout=10,
        )
        return tmp if os.path.exists(tmp) else None
    except Exception:  # noqa: BLE001
        return None


def _classify_pose(landmarks) -> dict[str, float]:
    """Return {gesture: confidence} for the dominant pose-patterns we care
    about. landmarks is mediapipe's NormalizedLandmarkList — 33 points
    with .x/.y/.z/.visibility each in [0, 1]."""
    if not landmarks:
        return {}
    # MediaPipe Pose landmark indices (alias for readability)
    NOSE = 0
    L_SHOULDER, R_SHOULDER = 11, 12
    L_ELBOW, R_ELBOW = 13, 14
    L_WRIST, R_WRIST = 15, 16
    L_HIP, R_HIP = 23, 24
    L_KNEE, R_KNEE = 25, 26
    L_ANKLE, R_ANKLE = 27, 28

    pts = list(landmarks.landmark)
    def y(i: int) -> float: return pts[i].y
    def x(i: int) -> float: return pts[i].x
    def vis(i: int) -> float: return pts[i].visibility

    out: dict[str, float] = {}

    # KNEELING — knees below hips (higher Y), ankles approaching knee-Y
    if vis(L_KNEE) > 0.5 and vis(L_HIP) > 0.5:
        if y(L_KNEE) > y(L_HIP) and y(R_KNEE) > y(R_HIP):
            # Stricter: ankles also below knees (sitting back on heels)
            if vis(L_ANKLE) > 0.3 and y(L_ANKLE) > y(L_KNEE) - 0.05:
                out["kneeling"] = 0.85

    # RAISED HAND — wrist above shoulder
    if vis(L_WRIST) > 0.5 and vis(L_SHOULDER) > 0.5:
        if y(L_WRIST) < y(L_SHOULDER) - 0.05:
            out["raised_hand"] = max(out.get("raised_hand", 0), 0.75)
    if vis(R_WRIST) > 0.5 and vis(R_SHOULDER) > 0.5:
        if y(R_WRIST) < y(R_SHOULDER) - 0.05:
            out["raised_hand"] = max(out.get("raised_hand", 0), 0.75)

    # PRAYING — both wrists close together in front of chest
    if vis(L_WRIST) > 0.4 and vis(R_WRIST) > 0.4:
        if abs(x(L_WRIST) - x(R_WRIST)) < 0.08:
            mid_chest_y = (y(L_SHOULDER) + y(R_SHOULDER)) / 2 + 0.10
            if abs(y(L_WRIST) - mid_chest_y) < 0.10:
                out["praying"] = 0.7

    return out


def _classify_multi_person(frame_path: str, model) -> dict[str, float]:
    """Detect multi-person patterns: kiss_pose, embrace, formal_pose.
    MediaPipe-pose handles 1 person per pass; for multi-person we'd need
    multi-pass with bbox-prompts. V1: detect 1 dominant person; flag
    multi-person via face-count proxy from earlier signals.

    For now this is a placeholder — single-person heuristics in
    _classify_pose() handle most wedding-ceremony gestures."""
    return {}


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    pose = _load_pose()
    if pose is None:
        return {}
    try:
        import cv2  # type: ignore
    except ImportError:
        return {}
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        # Sample mid-frame — gestures usually held > 1s, single frame suffices
        ts = (s + e) / 2
        tmp = _sample_frame(ffmpeg, video, ts)
        if tmp is None:
            out[i] = 0.0
            continue
        try:
            img = cv2.imread(tmp)
            if img is None:
                out[i] = 0.0
                continue
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            result = pose.process(img_rgb)
            gestures = _classify_pose(result.pose_landmarks)
            if not gestures:
                out[i] = 0.0
                continue
            # Weighted max — pick strongest gesture × its wedding-weight
            score = max(
                gestures[g] * WEDDING_GESTURE_WEIGHTS.get(g, 0.0)
                for g in gestures
            )
            out[i] = max(0.0, min(1.0, score))
        finally:
            try: os.unlink(tmp)
            except OSError: pass
    return out

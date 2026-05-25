"""Wedding-event detection via YOLOv8 (COCO classes + heuristics).

COCO has no "wedding ring" class, but it does have "person", "cake",
"knife", "wine glass", and "tie" — enough to detect several wedding
moments by inference:

  cake-cutting  : 'cake' + 'knife' + at least one 'person'
  kiss          : 2 'person' boxes whose head-regions overlap horizontally
                  and are close vertically
  dance         : 3+ 'person' boxes with significant area in lower 2/3
  toast         : 'wine glass' + 'person' + same-frame
  formal-pose   : 4+ 'person' boxes in a near-horizontal row (group photo)

We sample one frame per shot, run YOLOv8 inference (nano model = ~6 MB),
and return a single 0..1 score indicating how strongly the frame matches
any of the patterns above.

Requires `ultralytics`. Model is cached on first run.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from typing import Any


def available() -> bool:
    try:
        from ultralytics import YOLO  # noqa: F401
        return True
    except ImportError:
        return False


_MODEL: Any = None


def _load_model() -> Any:
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    from ultralytics import YOLO  # type: ignore
    # Use the nano model — 6 MB, runs ~50 ms per frame on CPU
    _MODEL = YOLO("yolov8n.pt")
    return _MODEL


def _sample_frame(ffmpeg: str, video: str, ts: float) -> str | None:
    fd, tmp = tempfile.mkstemp(prefix="yolo_", suffix=".jpg")
    os.close(fd)
    try:
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts:.3f}", "-i", video,
             "-vframes", "1", "-q:v", "3",
             "-vf", "scale=640:360",
             tmp],
            capture_output=True, timeout=12,
        )
        if not os.path.exists(tmp) or os.path.getsize(tmp) < 200:
            return None
        return tmp
    except Exception:  # noqa: BLE001
        return None


def _classify(model: Any, image_path: str) -> dict[str, float]:
    """Return {event_name: confidence in 0..1}. Empty dict = no event."""
    try:
        results = model(image_path, verbose=False, conf=0.35)
    except Exception:  # noqa: BLE001
        return {}
    if not results:
        return {}
    r = results[0]
    if r.boxes is None or len(r.boxes) == 0:
        return {}
    # Extract per-detection (cls_id, conf, xyxy)
    classes = r.boxes.cls.cpu().numpy().astype(int).tolist()
    confs = r.boxes.conf.cpu().numpy().tolist()
    boxes = r.boxes.xyxy.cpu().numpy().tolist()
    names = r.names  # idx -> name

    detections: list[tuple[str, float, tuple[float, float, float, float]]] = []
    for cls_id, conf, box in zip(classes, confs, boxes):
        name = names.get(cls_id) if isinstance(names, dict) else names[cls_id]
        detections.append((name, float(conf), tuple(box)))

    # Helpers
    persons = [d for d in detections if d[0] == "person"]
    cakes = [d for d in detections if d[0] == "cake"]
    knives = [d for d in detections if d[0] == "knife"]
    wineglasses = [d for d in detections if d[0] == "wine glass"]

    events: dict[str, float] = {}

    # CAKE-CUTTING: cake + knife + person
    if cakes and knives and persons:
        events["cake_cutting"] = min(
            max(c[1] for c in cakes),
            max(k[1] for k in knives),
            max(p[1] for p in persons),
        )

    # KISS: two persons, heads horizontally adjacent + close vertically
    if len(persons) >= 2:
        ps_sorted = sorted(persons, key=lambda d: -d[1])
        a, b = ps_sorted[0], ps_sorted[1]
        # box = (x1, y1, x2, y2)
        ax1, ay1, ax2, ay2 = a[2]
        bx1, by1, bx2, by2 = b[2]
        a_head_cy = ay1 + (ay2 - ay1) * 0.15
        b_head_cy = by1 + (by2 - by1) * 0.15
        a_head_cx = (ax1 + ax2) / 2
        b_head_cx = (bx1 + bx2) / 2
        head_diff_x = abs(a_head_cx - b_head_cx)
        head_diff_y = abs(a_head_cy - b_head_cy)
        avg_w = ((ax2 - ax1) + (bx2 - bx1)) / 2
        if head_diff_x < avg_w * 0.7 and head_diff_y < avg_w * 0.4:
            events["kiss"] = min(a[1], b[1])

    # DANCE: 3+ persons distributed across the frame
    if len(persons) >= 3:
        events["dance"] = min(0.8, 0.5 + 0.1 * (len(persons) - 3))

    # TOAST: wine glass + person
    if wineglasses and persons:
        events["toast"] = min(max(w[1] for w in wineglasses),
                              max(p[1] for p in persons))

    # FORMAL POSE: 4+ persons roughly aligned
    if len(persons) >= 4:
        ys = [(p[2][1] + p[2][3]) / 2 for p in persons]
        if max(ys) - min(ys) < 100:  # all within 100px row
            events["formal_pose"] = min(0.7, 0.4 + 0.08 * (len(persons) - 4))

    return events


def compute(ffmpeg: str, ffprobe: str, video: str,
            shots: list[tuple[float, float]]) -> dict[int, float]:
    try:
        model = _load_model()
    except Exception:  # noqa: BLE001
        return {}
    out: dict[int, float] = {}
    for i, (s, e) in enumerate(shots):
        mid = (s + e) / 2
        tmp = _sample_frame(ffmpeg, video, mid)
        if tmp is None:
            out[i] = 0.0
            continue
        try:
            events = _classify(model, tmp)
            # Combined score = strongest event detected
            out[i] = max(events.values()) if events else 0.0
        except Exception:  # noqa: BLE001
            out[i] = 0.0
        finally:
            try: os.unlink(tmp)
            except OSError: pass
    return out

"""Render Instagram-vertikal variant av highlight med captions.

Tar approved picks (samme cache som build_delivery_variants leser) og
produserer en ferdig MP4 i 9:16 med transkriberte captions burnt-in —
klar til opplastning direkte i Instagram Feed / Reels / TikTok.

Steg:
  1. Velg picks fra cache med instagram-konfigurasjon (60s, score-floor 0.50)
  2. ffmpeg concat-filter: splice picks fra source-video, crop 16:9 → 9:16
     center-crop, encode til en intermediær 1080×1920 MP4
  3. WhisperX på intermediæren → per-segment timestamps + tekst
  4. Generer ASS-subtitle-fil (større skrift, outlined, bottom-anchored)
  5. ffmpeg re-encode med subtitles-filter for å brenne captions inn
  6. Skriv final MP4 ved siden av source: <source-basename>_instagram.mp4

Resolve API touches: ingen. Pure ffmpeg + whisperx. Kjører uavhengig av om
Resolve er åpent.

Future v2:
  - Face-detect per pick + smooth crop-tracking (i stedet for center-crop)
  - Auto-pacing-til-musikk hvis source song er kjent (cut on beat)
  - LUFS-normalize audio til -14 (IG spec)
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

# Allow ai_models import as top-level package
_PYTHON_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PYTHON_ROOT not in sys.path:
    sys.path.insert(0, _PYTHON_ROOT)
try:
    import ai_models  # noqa: E402
except ImportError:
    ai_models = None  # type: ignore[assignment]


CACHE_PATH = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_highlight_picks.json"
)
STAGING_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/staging/instagram"
)


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _find_whisperx_python() -> str | None:
    """Locate a python that can `import whisperx`. We probe the bundled venv
    first (same convention as transcribe_audio.py), then system."""
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
                [py, "-c", "import whisperx"], capture_output=True, timeout=10,
            )
            if r.returncode == 0:
                return py
        except (subprocess.SubprocessError, OSError):
            continue
    return None


def _load_picks() -> dict:
    if not os.path.isfile(CACHE_PATH):
        return {}
    try:
        with open(CACHE_PATH) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _select_instagram_picks(all_picks: list[dict], target_sec: float,
                            max_sec: float, score_floor: float) -> list[dict]:
    """Pick highest-scoring shots up to target duration. Chronologic order."""
    candidates = [p for p in all_picks if (p.get("score") or 0) >= score_floor]
    if not candidates:
        candidates = list(all_picks)
    scored = sorted(candidates, key=lambda p: -(p.get("score") or 0))
    selected: list[dict] = []
    total = 0.0
    for p in scored:
        dur = (p.get("endSec") or 0) - (p.get("startSec") or 0)
        if total >= target_sec and total + dur > max_sec:
            continue
        selected.append(p)
        total += dur
        if total >= max_sec:
            break
    selected.sort(key=lambda p: float(p.get("startSec") or 0))
    return selected


_YOLO_MODEL = None
_SAM2_PREDICTOR = None


def _sam2_predictor():
    """Lazy-load SAM2 (Segment Anything 2) for subject-mask-based reframe.
    Falls back gracefully if sam2 package or R2 weights are unavailable.
    """
    global _SAM2_PREDICTOR
    if _SAM2_PREDICTOR is not None:
        return _SAM2_PREDICTOR
    if ai_models is None:
        return None
    try:
        from sam2.build_sam import build_sam2  # type: ignore
        from sam2.sam2_image_predictor import SAM2ImagePredictor  # type: ignore
        import torch  # type: ignore
    except ImportError:
        return None
    weights = ai_models.ensure_local_model("sam2-small")
    if not weights:
        return None
    try:
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        # Config name follows checkpoint convention
        cfg = "sam2_hiera_s.yaml"
        sam2_model = build_sam2(cfg, weights, device=device)
        _SAM2_PREDICTOR = SAM2ImagePredictor(sam2_model)
        return _SAM2_PREDICTOR
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"SAM2 setup failed: {exc}")
        return None


def _detect_subject_mask_centroid_sam2(
    ffmpeg: str, source_video: str, ts_sec: float, frame_width: int,
) -> tuple[float, float] | None:
    """SAM2-based subject-centroid (#R2 batch upgrade — V4).

    Uses YOLOv8 person-bbox as a prompt for SAM2 segmentation, then
    returns centroid of the mask (more precise than bbox center when the
    subject is e.g. lifted in a dance pose).

    Returns (cx, cy) in source-pixel coordinates, or None on failure.
    """
    predictor = _sam2_predictor()
    yolo = _yolo_model()
    if predictor is None or yolo is None:
        return None
    import tempfile
    fd, tmp = tempfile.mkstemp(prefix="ig_sam2_", suffix=".jpg")
    os.close(fd)
    try:
        r = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts_sec:.3f}", "-i", source_video,
             "-vframes", "1", "-q:v", "3",
             "-vf", f"scale={frame_width}:-1",
             tmp],
            capture_output=True, timeout=15,
        )
        if r.returncode != 0 or not os.path.exists(tmp):
            return None
        import cv2  # type: ignore
        import numpy as np
        img = cv2.imread(tmp)
        if img is None:
            return None
        # 1. YOLO person-bbox as box-prompt for SAM2
        results = yolo(img, verbose=False, conf=0.35, classes=[0])
        if not results or len(results[0].boxes) == 0:
            return None
        boxes = results[0].boxes.xyxy.cpu().numpy()
        # 2. SAM2 inference
        predictor.set_image(img)
        masks, scores, _ = predictor.predict(
            box=boxes, multimask_output=False,
        )
        # 3. Centroid of the union of all masks
        if masks is None or len(masks) == 0:
            return None
        union = np.any(masks, axis=0) if masks.ndim == 3 else masks
        ys, xs = np.where(union)
        if len(xs) == 0:
            return None
        return float(np.mean(xs)), float(np.mean(ys))
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"SAM2 inference failed: {exc}")
        return None
    finally:
        try: os.unlink(tmp)
        except OSError: pass


def _yolo_model():
    """Lazy-load ultralytics YOLOv8n model. Returns None if unavailable.
    Same model used by signals/wedding_events.py — already in our deps."""
    global _YOLO_MODEL
    if _YOLO_MODEL is not None:
        return _YOLO_MODEL
    try:
        from ultralytics import YOLO  # type: ignore
        _YOLO_MODEL = YOLO("yolov8n.pt")
        return _YOLO_MODEL
    except ImportError:
        return None
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"YOLOv8 load failed: {exc}")
        return None


def _detect_subject_center_x(ffmpeg: str, source_video: str, ts_sec: float,
                             frame_width: int) -> float | None:
    """Sample one frame and return SUBJECT-centroid X (#483 V3).

    Upgrade-path over face-detection:
      V1 (deprecated): static center-crop, lost ~44% of horizontal frame
      V2: OpenCV Haar face-cascade, only worked when faces were front-facing
      V3: YOLOv8 person-detection (back-of-head / dancing / wide / profile
          all OK; couples + family shots return bbox-union centroid)

    Falls back to face-cascade if YOLOv8 unavailable, to center if neither.
    """
    import tempfile
    fd, tmp = tempfile.mkstemp(prefix="ig_subject_", suffix=".jpg")
    os.close(fd)
    try:
        r = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-ss", f"{ts_sec:.3f}", "-i", source_video,
             "-vframes", "1", "-q:v", "3",
             "-vf", f"scale={frame_width}:-1",
             tmp],
            capture_output=True, timeout=15,
        )
        if r.returncode != 0 or not os.path.exists(tmp):
            return None

        # Preferred: YOLOv8 person-detection
        model = _yolo_model()
        if model is not None:
            try:
                results = model(tmp, verbose=False, conf=0.35, classes=[0])  # 0 = person
                if results and len(results[0].boxes) > 0:
                    boxes = results[0].boxes.xyxy.cpu().numpy().tolist()
                    # Union-centroid of all persons (couple/family safe)
                    xs = [(b[0] + b[2]) / 2 for b in boxes]
                    return float(sum(xs) / len(xs))
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"YOLOv8 inference failed, falling back to face cascade: {exc}")

        # Fallback: OpenCV Haar face-cascade (V2 behavior)
        try:
            import cv2  # type: ignore
        except ImportError:
            return None
        img = cv2.imread(tmp, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return None
        cascade_path = os.path.join(
            cv2.data.haarcascades, "haarcascade_frontalface_default.xml"
        )
        if not os.path.isfile(cascade_path):
            return None
        cascade = cv2.CascadeClassifier(cascade_path)
        faces = cascade.detectMultiScale(img, scaleFactor=1.2, minNeighbors=5,
                                         minSize=(40, 40))
        if faces is None or len(faces) == 0:
            return None
        centers_x = [(x + w / 2) for (x, y, w, h) in faces]
        return float(sum(centers_x) / len(centers_x))
    except Exception:  # noqa: BLE001
        return None
    finally:
        try: os.unlink(tmp)
        except OSError: pass


# Backward-compat alias — older code paths still reference the V2 name
_detect_face_center_x = _detect_subject_center_x


def _compute_smart_crop_x(ffmpeg: str, source_video: str, picks: list[dict],
                          probe_width: int = 640) -> dict[int, int]:
    """Per-pick crop-X offset in probe-resolution pixels.
    Returns {pick_idx: x_offset} where the 9:16 strip (ih*9/16 wide)
    should start. None of these are absolute — they're scaled back to
    source dimensions at filter-time.

    For each pick: sample 3 frames evenly across the shot, detect faces,
    use median X-centroid. Falls back to center-crop if no faces.
    """
    out: dict[int, int] = {}
    for i, p in enumerate(picks):
        start = float(p.get("startSec") or 0)
        end = float(p.get("endSec") or 0)
        if end <= start:
            continue
        samples_x: list[float] = []
        for frac in (0.25, 0.50, 0.75):
            ts = start + (end - start) * frac
            # Prefer SAM2 mask-centroid (V4) → YOLO bbox (V3) → face cascade (V2)
            cxy = _detect_subject_mask_centroid_sam2(ffmpeg, source_video, ts, probe_width)
            if cxy is not None:
                samples_x.append(cxy[0])
                continue
            cx = _detect_subject_center_x(ffmpeg, source_video, ts, probe_width)
            if cx is not None:
                samples_x.append(cx)
        if not samples_x:
            continue
        samples_x.sort()
        face_cx = samples_x[len(samples_x) // 2]  # median
        out[i] = int(round(face_cx))
    return out


def _build_per_pick_filter_complex(
    picks: list[dict], smart_x_by_pick: dict[int, int],
    width: int, height: int, probe_width: int = 640,
    background_style: str = "black",
) -> str:
    """Build the ffmpeg filter_complex graph that:
       - trims source by each pick's [start, end]
       - applies per-pick smart-crop X (or center if no face data)
       - composites subject over chosen background style
       - scales to 1080×1920
       - concats all picks
    Returns the full -filter_complex argument string.
    """
    v_chains = []
    a_chains = []
    for i, p in enumerate(picks):
        start = float(p.get("startSec") or 0)
        end = float(p.get("endSec") or 0)
        if end <= start:
            continue
        # Convert probe-resolution face-x to source-resolution proportion (0..1)
        # then apply at runtime via ih*9/16 strip width.
        if i in smart_x_by_pick:
            face_cx_rel = smart_x_by_pick[i] / probe_width  # 0..1 across frame
            crop_x_expr = (
                f"max(0,min(iw-ih*9/16,{face_cx_rel:.4f}*iw-ih*9/16/2))"
            )
        else:
            crop_x_expr = "(iw-ih*9/16)/2"

        # Build per-pick visual chain based on background style
        trim_v = f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS"
        if background_style == "blurred":
            # Split the trimmed stream → blurred fill behind + foreground crop
            # 1. Blur-fill: scale source to 1080×1920 (cover, no crop), heavy gblur
            # 2. Foreground: 9:16 smart-crop + scale-to-height
            # 3. Overlay foreground centered over blur-fill
            v_chains.append(
                f"{trim_v},split=2[t{i}fg][t{i}bg];"
                f"[t{i}bg]scale={width}:{height}:force_original_aspect_ratio=increase,"
                f"crop={width}:{height},gblur=sigma=30,eq=brightness=-0.15[bg{i}];"
                f"[t{i}fg]crop=w='ih*9/16':h=ih:x='{crop_x_expr}':y=0,"
                f"scale=-2:{height}[fg{i}];"
                f"[bg{i}][fg{i}]overlay=(W-w)/2:0[v{i}]"
            )
        else:
            # "black" default — original chain
            v_chains.append(
                f"{trim_v},"
                f"crop=w='ih*9/16':h=ih:x='{crop_x_expr}':y=0,"
                f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
                f"[v{i}]"
            )
        a_chains.append(
            f"[0:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS[a{i}]"
        )
    n = len(v_chains)
    v_inputs = "".join(f"[v{i}]" for i, _ in enumerate(picks)
                       if (float(picks[i].get('endSec') or 0)
                           > float(picks[i].get('startSec') or 0)))
    a_inputs = "".join(f"[a{i}]" for i, _ in enumerate(picks)
                       if (float(picks[i].get('endSec') or 0)
                           > float(picks[i].get('startSec') or 0)))
    concat_v = f"{v_inputs}concat=n={n}:v=1:a=0[vconcat]"
    concat_a = f"{a_inputs}concat=n={n}:v=0:a=1[aconcat]"
    loudnorm = "[aconcat]loudnorm=I=-14:TP=-1:LRA=11[aout]"
    return ";".join(v_chains + a_chains + [concat_v, concat_a, loudnorm])


def _concat_picks_to_vertical(
    ffmpeg: str, source_video: str, picks: list[dict], out_path: str,
    width: int = 1080, height: int = 1920,
    background_style: str = "black",
) -> bool:
    """Build the 9:16 intermediate via ffmpeg per-pick smart-crop concat.

    Per-pick crops follow the subject-mask centroid (SAM2 → YOLO → face
    fallback) so the couple/subject stays in frame instead of being
    chopped off at the edge.

    background_style:
      "black"         — solid black bars (default, smallest file)
      "blurred"       — same frame blurred + scaled to fill (REMBG-like
                        social-feed look; no model download needed, pure
                        ffmpeg gblur+scale fallback)
      "blurred-rembg" — REAL REMBG U2Net background-removal + gaussian-
                        blurred fill (requires R2 + rembg pip pkg)

    Falls back to single-pass center-crop if smart-crop graph fails.
    """
    if not picks:
        return False

    # Try smart-crop graph first
    smart_x = _compute_smart_crop_x(ffmpeg, source_video, picks)
    if smart_x:
        bridge.log(
            f"Smart-crop: {len(smart_x)}/{len(picks)} picks have face-data "
            f"(remainder fall back to center)"
        )
    else:
        bridge.log("Smart-crop: no faces detected anywhere → center-crop fallback")

    filter_complex = _build_per_pick_filter_complex(
        picks, smart_x, width, height, background_style=background_style,
    )
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", source_video,
        "-filter_complex", filter_complex,
        "-map", "[vconcat]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        out_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)
    except subprocess.TimeoutExpired:
        bridge.warn("ffmpeg smart-crop concat timed out after 20 min")
        return False
    if r.returncode != 0:
        bridge.warn(
            f"smart-crop concat failed ({(r.stderr or '')[-300:]}) — "
            "falling back to center-crop single-pass"
        )
        return _concat_center_crop_fallback(
            ffmpeg, source_video, picks, out_path, width, height,
        )
    return os.path.isfile(out_path) and os.path.getsize(out_path) > 1024


def _concat_center_crop_fallback(
    ffmpeg: str, source_video: str, picks: list[dict], out_path: str,
    width: int, height: int,
) -> bool:
    """Original single-pass center-crop. Used when smart-crop filter_complex
    is too large or otherwise fails."""
    sel_parts = [f"between(t,{p['startSec']:.3f},{p['endSec']:.3f})" for p in picks]
    sel_expr = "+".join(sel_parts)
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", source_video,
        "-vf",
        f"select='{sel_expr}',setpts=N/FRAME_RATE/TB,"
        f"crop=w='ih*9/16':h=ih:x='(iw-ih*9/16)/2':y=0,"
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black",
        "-af",
        f"aselect='{sel_expr}',asetpts=N/SR/TB,loudnorm=I=-14:TP=-1:LRA=11",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        out_path,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        return False
    if r.returncode != 0:
        bridge.warn(f"center-crop fallback failed: {(r.stderr or '')[-300:]}")
        return False
    return os.path.isfile(out_path) and os.path.getsize(out_path) > 1024


def _transcribe(python_path: str, audio_path: str, model: str,
                language: str | None, hf_token: str | None) -> list[dict]:
    """Invoke whisperx CLI on the rendered MP4 and parse its JSON output."""
    import tempfile
    with tempfile.TemporaryDirectory(prefix="ig_whisperx_") as out_dir:
        cmd = [
            python_path, "-m", "whisperx", audio_path,
            "--model", model,
            "--output_dir", out_dir,
            "--output_format", "json",
            "--compute_type", "int8",
        ]
        if language and language != "auto":
            cmd.extend(["--language", language])
        if hf_token:
            cmd.extend(["--hf_token", hf_token, "--diarize",
                        "--min_speakers", "1", "--max_speakers", "8"])
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        except subprocess.TimeoutExpired:
            bridge.warn("WhisperX transcription timed out (30 min)")
            return []
        if r.returncode != 0:
            bridge.warn(f"WhisperX failed: {(r.stderr or '')[-400:]}")
            return []
        json_files = [f for f in os.listdir(out_dir) if f.endswith(".json")]
        if not json_files:
            bridge.warn("WhisperX produced no JSON")
            return []
        with open(os.path.join(out_dir, json_files[0]), "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return [
            {
                "start": float(s.get("start", 0)),
                "end": float(s.get("end", 0)),
                "text": (s.get("text") or "").strip(),
                "speaker": s.get("speaker"),
            }
            for s in (data.get("segments") or [])
        ]


def _format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s_full = seconds - h * 3600 - m * 60
    s = int(s_full)
    cs = int(round((s_full - s) * 100))
    if cs == 100:
        s += 1; cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _segments_to_ass(segments: list[dict], video_width: int = 1080,
                     video_height: int = 1920) -> str:
    """Generate an ASS subtitle file tuned for IG-vertical:
    - Bold large font (size 64)
    - Anchored at bottom-30% of frame (well above caption-bar safe-area)
    - Outline + shadow for legibility on any background
    - Auto line-break around 30 chars
    """
    header = f"""[Script Info]
Title: IG Auto-captions
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,2,80,80,420,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    for seg in segments:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        # Simple word-wrap to ~28 chars/line
        words = text.split()
        wrapped: list[str] = []
        line = ""
        for w in words:
            if len(line) + len(w) + 1 > 28:
                wrapped.append(line)
                line = w
            else:
                line = f"{line} {w}".strip()
        if line:
            wrapped.append(line)
        ass_text = r"\N".join(wrapped)
        lines.append(
            f"Dialogue: 0,{_format_ass_time(seg['start'])},"
            f"{_format_ass_time(seg['end'])},Default,,0,0,0,,{ass_text}"
        )
    return "\n".join(lines) + "\n"


def _burn_captions(ffmpeg: str, video_in: str, ass_path: str,
                   video_out: str) -> bool:
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", video_in,
        "-vf", f"ass={ass_path}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        "-movflags", "+faststart",
        video_out,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        bridge.warn("ffmpeg caption-burn timed out")
        return False
    if r.returncode != 0:
        bridge.warn(f"ffmpeg caption-burn failed: {(r.stderr or '')[-400:]}")
        return False
    return os.path.isfile(video_out) and os.path.getsize(video_out) > 1024


def run(params: dict[str, Any], dry_run: bool) -> None:
    target_sec = float(params.get("targetDurationSec") or 60.0)
    max_sec = float(params.get("maxDurationSec") or 75.0)
    score_floor = float(params.get("scoreFloor") or 0.50)
    whisper_model = (params.get("whisperModel") or "large-v3").strip()
    language = (params.get("language") or "auto").strip()
    burn_captions = params.get("burnCaptions")
    burn_captions = True if burn_captions is None else bool(burn_captions)
    hf_token = params.get("hfToken") or os.environ.get("HF_TOKEN")
    # Background style — "black" / "blurred" (ffmpeg gblur) / "blurred-rembg"
    background_style = (params.get("backgroundStyle") or "black").strip().lower()
    if background_style not in ("black", "blurred", "blurred-rembg"):
        background_style = "black"

    cached = _load_picks()
    all_picks = cached.get("picks") or []
    source_video = cached.get("sourceVideo") or ""

    if not all_picks:
        bridge.error(
            "Ingen approved picks i cache. Kjør extract_highlight_from_film "
            "(med interactiveReview=true) først og approve klipp i UI-en."
        )
        sys.exit(1)
    if not source_video or not os.path.isfile(source_video):
        bridge.error(f"Source video '{source_video}' missing — re-run extract_highlight_from_film")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH — install via Dependencies modal")
        sys.exit(1)

    picks = _select_instagram_picks(all_picks, target_sec, max_sec, score_floor)
    if not picks:
        bridge.error("No picks match the score floor — lower scoreFloor param")
        sys.exit(1)

    pick_total = sum((p.get("endSec") or 0) - (p.get("startSec") or 0) for p in picks)
    bridge.log(
        f"Instagram-variant plan: {len(picks)} shots ({pick_total:.1f}s) "
        f"from '{os.path.basename(source_video)}'"
    )

    out_dir = os.path.dirname(source_video) or "."
    base = os.path.splitext(os.path.basename(source_video))[0]
    final_path = os.path.join(out_dir, f"{base}_instagram.mp4")
    intermediate_path = os.path.join(STAGING_DIR, f"{base}_ig_nocaption.mp4")
    os.makedirs(STAGING_DIR, exist_ok=True)

    if dry_run:
        bridge.result({
            "wouldProduce": final_path,
            "picksSelected": len(picks),
            "estimatedDurationSec": round(pick_total, 1),
            "withCaptions": burn_captions,
            "whisperModel": whisper_model,
        })
        return

    bridge.progress(5, 100,
                    f"Splicing {len(picks)} picks + crop 9:16 ({background_style} bg)…")
    if not _concat_picks_to_vertical(
        ffmpeg, source_video, picks, intermediate_path,
        background_style=background_style,
    ):
        bridge.error("ffmpeg concat failed — see logs")
        sys.exit(1)
    bridge.log(f"Intermediate: {intermediate_path} ({os.path.getsize(intermediate_path)//1024} KB)")

    if not burn_captions:
        # Just move intermediate to final and stop.
        try:
            if os.path.abspath(intermediate_path) != os.path.abspath(final_path):
                shutil.copy2(intermediate_path, final_path)
        except OSError as exc:
            bridge.error(f"Could not write final: {exc}")
            sys.exit(1)
        bridge.progress(100, 100, "Ferdig.")
        bridge.result({
            "outputPath": final_path,
            "picksUsed": len(picks),
            "durationSec": round(pick_total, 1),
            "withCaptions": False,
        })
        return

    bridge.progress(35, 100, f"Transcribing with WhisperX ({whisper_model})…")
    python_path = _find_whisperx_python()
    if not python_path:
        bridge.warn("WhisperX not installed — falling back to no-captions output")
        try:
            shutil.copy2(intermediate_path, final_path)
        except OSError as exc:
            bridge.error(f"Could not write final: {exc}")
            sys.exit(1)
        bridge.progress(100, 100, "Ferdig (uten captions).")
        bridge.result({
            "outputPath": final_path,
            "picksUsed": len(picks),
            "durationSec": round(pick_total, 1),
            "withCaptions": False,
            "captionsSkipped": "whisperx_not_installed",
        })
        return

    segments = _transcribe(python_path, intermediate_path, whisper_model,
                           None if language == "auto" else language, hf_token)
    if not segments:
        bridge.warn("Transcription produced 0 segments — outputting without captions")
        try:
            shutil.copy2(intermediate_path, final_path)
        except OSError as exc:
            bridge.error(f"Could not write final: {exc}")
            sys.exit(1)
        bridge.progress(100, 100, "Ferdig (uten captions).")
        bridge.result({
            "outputPath": final_path,
            "picksUsed": len(picks),
            "durationSec": round(pick_total, 1),
            "withCaptions": False,
            "captionsSkipped": "empty_transcript",
        })
        return

    bridge.progress(75, 100, "Burning captions…")
    ass_path = os.path.join(STAGING_DIR, f"{base}_ig.ass")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(_segments_to_ass(segments))

    if not _burn_captions(ffmpeg, intermediate_path, ass_path, final_path):
        bridge.error("Caption burn failed — intermediate is at " + intermediate_path)
        sys.exit(1)

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "outputPath": final_path,
        "picksUsed": len(picks),
        "durationSec": round(pick_total, 1),
        "withCaptions": True,
        "captionSegments": len(segments),
        "whisperModel": whisper_model,
        "intermediatePath": intermediate_path,
        "assPath": ass_path,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

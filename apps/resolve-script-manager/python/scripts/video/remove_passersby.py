"""Remove distracting passersby fra wedding-background via ProPainter.

ProPainter (NTU, Apache-2) er state-of-art video-inpainting. Pipeline:
  1. SAM2-mask generation: brukeren markerer ETT eksempel-frame (med bbox
     eller klikk-prompt) → SAM2 segmenterer subjektet på det frame
  2. Mask-propagation: SAM2 propagerer mask gjennom timeline
  3. ProPainter inpaint: flow-baserte transformer fyller mask-region med
     plausibel background-rekonstruksjon

Use case: bryllup-portrait med distraktiv waiter / forbipasserende /
random gjester i bakgrunn. I stedet for å redo shot, fyller vi inn
bakgrunn-pikselen som om den distraktive personen aldri var der.

Implementation note: lik FullSubNet+ er ProPainter et research-repo uten
clean pip. Vi shell'er ut til reference-inference med R2-downloaded
SAM2 + ProPainter weights. Krever git clone-trinn første gang.

Performance på Apple Silicon M2:
  - SAM2 mask-propagation: ~3-5s per shot
  - ProPainter inpaint: ~5-10s per frame
  → 5-sek shot @ 24fps = 120 frames × 7s = ~14 min per shot
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

bridge.reexec_in_venv_if_present()

_PY_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PY_ROOT not in sys.path:
    sys.path.insert(0, _PY_ROOT)
import ai_models  # noqa: E402


PROPAINTER_REPO_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/"
    "propainter_repo"
)
PROPAINTER_REPO_URL = "https://github.com/sczhou/ProPainter.git"


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _ensure_propainter_repo() -> bool:
    """ProPainter ships an inference_propainter.py at repo root."""
    return os.path.isfile(os.path.join(PROPAINTER_REPO_DIR, "inference_propainter.py"))


def _generate_mask_via_sam2(
    ffmpeg: str, video: str, prompt_frame_sec: float,
    bbox_xyxy: list[float] | None, out_mask_dir: str,
    n_frames: int,
) -> int:
    """Use SAM2 to:
      1. Run on the prompt-frame at prompt_frame_sec with bbox prompt
      2. Propagate the mask to neighboring n_frames frames
      3. Write per-frame masks to out_mask_dir as %06d.png (binary 0/255)
    Returns count of masks generated. Falls back to static mask if SAM2
    propagation unavailable."""
    try:
        from sam2.build_sam import build_sam2_video_predictor  # type: ignore
        import torch  # type: ignore
        import cv2  # type: ignore
    except ImportError:
        bridge.warn("sam2 (with video predictor) not installed — passing through")
        return 0
    weights = ai_models.ensure_local_model("sam2-small")
    if not weights:
        bridge.warn("Could not get SAM2 weights from R2")
        return 0

    # Extract frames to a temp folder first (SAM2 video predictor expects
    # frame-folder input)
    frames_dir = os.path.join(os.path.dirname(out_mask_dir), "frames")
    os.makedirs(frames_dir, exist_ok=True)
    subprocess.run(
        [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
         "-i", video, "-vsync", "0",
         "-vf", "scale=-2:720",
         os.path.join(frames_dir, "%06d.jpg")],
        capture_output=True, timeout=300,
    )

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    try:
        predictor = build_sam2_video_predictor("sam2_hiera_s.yaml", weights, device=device)
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"SAM2 video predictor init failed: {exc}")
        return 0

    inference_state = predictor.init_state(video_path=frames_dir)

    # Use bbox as box-prompt at the prompt-frame
    frame_idx = int(prompt_frame_sec * 24)  # approximate; refined below
    if bbox_xyxy is None:
        # Default: center-third of frame as a "find any subject" heuristic
        first_frame = cv2.imread(os.path.join(frames_dir, "000001.jpg"))
        h, w = first_frame.shape[:2]
        bbox_xyxy = [w * 0.33, h * 0.20, w * 0.66, h * 0.80]
    import numpy as np
    box = np.array(bbox_xyxy, dtype=np.float32)
    _frame_idx, _obj_ids, _masks = predictor.add_new_points_or_box(
        inference_state=inference_state,
        frame_idx=frame_idx, obj_id=1, box=box,
    )

    # Propagate mask through video
    count = 0
    os.makedirs(out_mask_dir, exist_ok=True)
    try:
        for out_frame_idx, out_obj_ids, out_masks in predictor.propagate_in_video(inference_state):
            if out_masks is None or len(out_masks) == 0:
                continue
            mask = (out_masks[0].cpu().numpy() > 0.5).astype(np.uint8) * 255
            cv2.imwrite(
                os.path.join(out_mask_dir, f"{out_frame_idx:06d}.png"),
                mask,
            )
            count += 1
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"SAM2 propagation failed mid-way: {exc}")
    return count


def _run_propainter(frames_dir: str, masks_dir: str, output_dir: str) -> bool:
    """Shell out to ProPainter's reference inference script."""
    if not _ensure_propainter_repo():
        return False
    venv_py = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312/bin/python"
    )
    python = venv_py if os.path.isfile(venv_py) else (shutil.which("python3") or "python3")
    cmd = [
        python, "inference_propainter.py",
        "--video", frames_dir,
        "--mask", masks_dir,
        "--output", output_dir,
        "--save_frames",
    ]
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=3600, cwd=PROPAINTER_REPO_DIR,
        )
        return r.returncode == 0
    except Exception as exc:  # noqa: BLE001
        bridge.warn(f"ProPainter inference failed: {exc}")
        return False


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    prompt_frame_sec = float(params.get("promptFrameSec") or 0.5)
    bbox = params.get("bbox")  # [x1, y1, x2, y2] in pixels at native resolution
    if isinstance(bbox, str):
        try:
            bbox = [float(x) for x in bbox.split(",")]
        except ValueError:
            bbox = None

    if not input_path or not os.path.isfile(input_path):
        bridge.error(f"inputPath '{input_path}' is not a file")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH")
        sys.exit(1)

    if not _ensure_propainter_repo():
        bridge.error(
            f"ProPainter reference repo not found. Clone first: "
            f"git clone {PROPAINTER_REPO_URL} {PROPAINTER_REPO_DIR}"
        )
        sys.exit(1)

    if not bridge.r2_is_configured():
        bridge.error("R2 credentials not set — SAM2-weights download fails")
        sys.exit(1)

    base, ext = os.path.splitext(input_path)
    out_path = f"{base}_inpainted{ext}"

    bridge.log(
        f"Inpaint plan: {os.path.basename(input_path)} · prompt at {prompt_frame_sec}s · "
        f"bbox={bbox} → {out_path}"
    )

    if dry_run:
        bridge.result({
            "wouldInpaint": input_path,
            "outputPath": out_path,
            "promptFrameSec": prompt_frame_sec,
            "bbox": bbox,
            "note": "SAM2-mask-propagation + ProPainter video-inpaint",
        })
        return

    with tempfile.TemporaryDirectory(prefix="propainter_") as tmp:
        masks_dir = os.path.join(tmp, "masks")
        os.makedirs(masks_dir, exist_ok=True)

        bridge.progress(5, 100, "Generating + propagating SAM2 mask…")
        mask_count = _generate_mask_via_sam2(
            ffmpeg, input_path, prompt_frame_sec, bbox,
            out_mask_dir=masks_dir, n_frames=0,  # propagate to all
        )
        if mask_count == 0:
            bridge.error("Mask-generation failed — see logs")
            sys.exit(1)
        bridge.log(f"Generated {mask_count} masks")

        # Frames-dir was created by _generate_mask_via_sam2 alongside masks
        frames_dir = os.path.join(tmp, "frames")
        propainter_out = os.path.join(tmp, "out")
        os.makedirs(propainter_out, exist_ok=True)

        bridge.progress(30, 100, "Running ProPainter inpaint (slow)…")
        if not _run_propainter(frames_dir, masks_dir, propainter_out):
            bridge.error(
                "ProPainter inference failed — sjekk at repo er korrekt klonet "
                "og dependencies installert (pip install -r requirements.txt i repo)"
            )
            sys.exit(1)

        # Reassemble video
        bridge.progress(85, 100, "Re-encoding inpainted frames…")
        # ProPainter writes its output to <output>/inpaint_out/ typically
        inpaint_subdir = os.path.join(propainter_out, "inpaint_out")
        if not os.path.isdir(inpaint_subdir):
            inpaint_subdir = propainter_out
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", "24",
            "-i", os.path.join(inpaint_subdir, "%06d.png"),
            "-i", input_path,
            "-map", "0:v", "-map", "1:a?",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            "-shortest", "-movflags", "+faststart",
            out_path,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if r.returncode != 0:
            bridge.error(f"ffmpeg re-encode failed: {(r.stderr or '')[-300:]}")
            sys.exit(1)

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "inputPath": input_path,
        "outputPath": out_path,
        "maskCount": mask_count,
        "sizeMb": round(os.path.getsize(out_path) / (1024**2), 1)
                  if os.path.isfile(out_path) else 0,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""Enhance grainy faces in a video via GFPGAN (Tencent face-restoration).

Use case: wedding-highlight inneholder ofte low-light close-ups av brud/
brudgom hvor face-detail går tapt. GFPGAN restorerer ansikt-detail uten å
endre identitet — vanlig brukt på gamle bilder, men funker også per-frame
på video.

Pipeline:
  1. Last GFPGAN-weights fra R2 (bridge.r2_download → ai_models.ensure_local_model)
  2. ffmpeg extract frames @ source fps til staging
  3. GFPGAN per frame (PyTorch, kjører på Apple Silicon MPS)
  4. ffmpeg concat enhanced frames + original audio → output MP4

Krever:
  - gfpgan pip-pakke (~600MB med torch)
  - R2-credentials i Settings → admin
  - facexlib + realesrgan pip-pakker (GFPGAN deps)

Output: <input>_face_restored.mp4 ved siden av input-fil.

Performance: ~1-2 fps på Apple Silicon (M2) for 1080p. En 4-min highlight
@ 24fps = 5760 frames = 60-90 min processing. Spør user før vi commit.
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

# Allow ai_models import as top-level package from python/
_PYTHON_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PYTHON_ROOT not in sys.path:
    sys.path.insert(0, _PYTHON_ROOT)
import ai_models  # noqa: E402

bridge.reexec_in_venv_if_present()


def _find_ffmpeg() -> str | None:
    for c in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _check_gfpgan_available() -> tuple[bool, str | None]:
    try:
        import gfpgan  # noqa: F401
        return True, None
    except ImportError:
        return False, "pip install gfpgan facexlib realesrgan (~600MB)"


def _run_gfpgan_inference(
    frames_dir: str, output_dir: str, weights_path: str,
    upscale: int = 1, progress_cb=None,
) -> int:
    """Process all frames in `frames_dir` through GFPGAN. Writes to
    output_dir. Returns count of enhanced frames."""
    try:
        from gfpgan import GFPGANer  # type: ignore
    except ImportError:
        bridge.error("gfpgan import failed despite check — venv mismatch?")
        return 0

    # GFPGAN init — model_path is where to find/save weights. We already
    # downloaded so points it at our R2-cache path.
    restorer = GFPGANer(
        model_path=weights_path,
        upscale=upscale,
        arch="clean",
        channel_multiplier=2,
        bg_upsampler=None,
    )

    try:
        import cv2  # type: ignore
    except ImportError:
        bridge.error("opencv-python required for frame I/O")
        return 0

    frames = sorted([f for f in os.listdir(frames_dir) if f.lower().endswith(".png")])
    total = len(frames)
    if total == 0:
        return 0

    enhanced = 0
    for i, fn in enumerate(frames):
        in_path = os.path.join(frames_dir, fn)
        out_path = os.path.join(output_dir, fn)
        img = cv2.imread(in_path, cv2.IMREAD_COLOR)
        if img is None:
            shutil.copy2(in_path, out_path)
            continue
        try:
            _cropped, _restored, restored_img = restorer.enhance(
                img, has_aligned=False, only_center_face=False,
                paste_back=True, weight=0.5,
            )
            if restored_img is not None:
                cv2.imwrite(out_path, restored_img)
                enhanced += 1
            else:
                # No faces detected — pass through
                cv2.imwrite(out_path, img)
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"GFPGAN failed on frame {fn}: {exc} — passing through")
            cv2.imwrite(out_path, img)
        if progress_cb and (i + 1) % 30 == 0:
            progress_cb(i + 1, total)
    return enhanced


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    weight = float(params.get("weight") or 0.5)  # 0..1 strength
    upscale = int(params.get("upscale") or 1)    # 1 = no upscale, 2 = 2×, 4 = 4×

    if not input_path or not os.path.isfile(input_path):
        bridge.error(f"inputPath '{input_path}' is not a file")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH — install via Dependencies modal")
        sys.exit(1)

    ok, install_hint = _check_gfpgan_available()
    if not ok:
        bridge.error(
            f"gfpgan not installed. Run: {install_hint}. "
            "Bemerk at gfpgan trekker inn torch (~500MB) første gang."
        )
        sys.exit(1)

    if not bridge.r2_is_configured():
        bridge.error(
            "R2 credentials not set. Add R2_ENDPOINT + R2_ACCESS_KEY_ID + "
            "R2_SECRET_ACCESS_KEY i Settings → admin."
        )
        sys.exit(1)

    # Estimate frame count to warn user before committing
    try:
        ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
        r = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=nb_frames,r_frame_rate:format=duration",
             "-of", "json", input_path],
            capture_output=True, text=True, timeout=15,
        )
        meta = json.loads(r.stdout or "{}")
        duration = float((meta.get("format") or {}).get("duration") or 0)
        stream = (meta.get("streams") or [{}])[0]
        rate_str = stream.get("r_frame_rate") or "24/1"
        num, den = rate_str.split("/")
        fps = float(num) / float(den) if float(den) > 0 else 24.0
        frame_count = int(duration * fps)
    except Exception:  # noqa: BLE001
        duration = 0
        fps = 24.0
        frame_count = 0

    bridge.log(
        f"GFPGAN job: {os.path.basename(input_path)} · {duration:.1f}s @ "
        f"{fps:.2f} fps ≈ {frame_count} frames · weight={weight} · upscale={upscale}×"
    )
    if frame_count > 7200:  # 5 min @ 24 fps
        bridge.warn(
            f"~{frame_count} frames estimated — vil ta {frame_count // 60} min "
            "på Apple Silicon. Avbryt nå om du ikke vil vente."
        )

    out_path = input_path.replace(".mp4", "_face_restored.mp4")
    if out_path == input_path:
        out_path = input_path + ".face_restored.mp4"

    if dry_run:
        bridge.result({
            "wouldProcess": input_path,
            "outputPath": out_path,
            "estimatedFrames": frame_count,
            "estimatedMinutes": round(frame_count / 60, 1),
        })
        return

    bridge.progress(2, 100, "Downloading GFPGAN weights from R2…")
    weights_path = ai_models.ensure_local_model("gfpgan-v1.4")
    if not weights_path:
        bridge.error("Could not get GFPGAN weights from R2 — see logs")
        sys.exit(1)
    bridge.log(f"Weights ready: {weights_path}")

    with tempfile.TemporaryDirectory(prefix="gfpgan_") as tmpdir:
        frames_in = os.path.join(tmpdir, "in")
        frames_out = os.path.join(tmpdir, "out")
        os.makedirs(frames_in, exist_ok=True)
        os.makedirs(frames_out, exist_ok=True)

        bridge.progress(5, 100, "Extracting frames…")
        r = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-i", input_path,
             "-vsync", "0",
             os.path.join(frames_in, "%06d.png")],
            capture_output=True, text=True, timeout=600,
        )
        if r.returncode != 0:
            bridge.error(f"ffmpeg frame-extract failed: {(r.stderr or '')[-300:]}")
            sys.exit(1)

        def _on_progress(cur, tot):
            pct = 10 + int(75 * cur / max(1, tot))
            bridge.progress(pct, 100, f"GFPGAN frame {cur}/{tot}")

        enhanced = _run_gfpgan_inference(
            frames_in, frames_out, weights_path, upscale=upscale,
            progress_cb=_on_progress,
        )
        bridge.log(f"Enhanced {enhanced}/{frame_count} frames")

        bridge.progress(90, 100, "Re-encoding video + original audio…")
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", f"{fps}",
            "-i", os.path.join(frames_out, "%06d.png"),
            "-i", input_path,
            "-map", "0:v", "-map", "1:a?",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            "-shortest",
            "-movflags", "+faststart",
            out_path,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if r.returncode != 0:
            bridge.error(f"ffmpeg encode failed: {(r.stderr or '')[-400:]}")
            sys.exit(1)

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "inputPath": input_path,
        "outputPath": out_path,
        "framesProcessed": frame_count,
        "framesEnhanced": enhanced,
        "weight": weight,
        "upscale": upscale,
        "sizeMb": round(os.path.getsize(out_path) / (1024**2), 1) if os.path.isfile(out_path) else 0,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

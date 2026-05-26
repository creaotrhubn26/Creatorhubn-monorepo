"""Upscale video to 4K via Real-ESRGAN (R2-downloaded weights).

Premium delivery format: convert a 1080p Resolve-render to 4K so
clients see a higher-resolution master. Real-ESRGAN x4plus generalizes
well on natural imagery (skin, fabric, foliage).

Performance on Apple Silicon M2:
  - 1080p → 4K @ 24fps:  ~0.8 fps  (1 frame per 1.2s)
  - 4-min highlight:     ~120-150 min processing time
  - 1080p → 4K @ 60fps:  ~0.3 fps (slower because more frames)

Use sparingly — typically once per project on the final master, not
on intermediate edits. Output: <input>_4k.mp4.
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

_PY_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PY_ROOT not in sys.path:
    sys.path.insert(0, _PY_ROOT)
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


def _probe_meta(ffmpeg: str, input_path: str) -> dict:
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height,r_frame_rate,nb_frames:format=duration",
             "-of", "json", input_path],
            capture_output=True, text=True, timeout=15,
        )
        return json.loads(r.stdout or "{}")
    except Exception:  # noqa: BLE001
        return {}


def _run_realesrgan(
    frames_dir: str, output_dir: str, weights_path: str,
    scale: int, progress_cb=None,
) -> int:
    """Process all frames through Real-ESRGAN. Returns count enhanced."""
    try:
        from realesrgan import RealESRGANer  # type: ignore
        from basicsr.archs.rrdbnet_arch import RRDBNet  # type: ignore
        import cv2  # type: ignore
    except ImportError as exc:
        bridge.error(
            f"realesrgan import failed: {exc}. Install: "
            "pip install basicsr realesrgan"
        )
        return 0

    # Real-ESRGAN x4plus architecture
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                    num_block=23, num_grow_ch=32, scale=4)
    upsampler = RealESRGANer(
        scale=4, model_path=weights_path, model=model,
        tile=256, tile_pad=10, pre_pad=0,
        half=False,  # Apple Silicon MPS doesn't support fp16 reliably
    )

    frames = sorted([f for f in os.listdir(frames_dir) if f.lower().endswith(".png")])
    total = len(frames)
    for i, fn in enumerate(frames):
        img = cv2.imread(os.path.join(frames_dir, fn), cv2.IMREAD_COLOR)
        if img is None:
            shutil.copy2(os.path.join(frames_dir, fn), os.path.join(output_dir, fn))
            continue
        try:
            output, _ = upsampler.enhance(img, outscale=scale)
            cv2.imwrite(os.path.join(output_dir, fn), output)
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Real-ESRGAN failed on {fn}: {exc} — copying source")
            cv2.imwrite(os.path.join(output_dir, fn), img)
        if progress_cb and (i + 1) % 20 == 0:
            progress_cb(i + 1, total)
    return total


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    scale = int(params.get("scale") or 4)
    if scale not in (2, 3, 4):
        bridge.warn(f"scale={scale} not standard — clamping to 4")
        scale = 4

    if not input_path or not os.path.isfile(input_path):
        bridge.error(f"inputPath '{input_path}' is not a file")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH")
        sys.exit(1)

    if not bridge.r2_is_configured():
        bridge.error("R2 credentials not set — configure i Settings → admin")
        sys.exit(1)

    meta = _probe_meta(ffmpeg, input_path)
    stream = (meta.get("streams") or [{}])[0]
    width = int(stream.get("width") or 1920)
    height = int(stream.get("height") or 1080)
    rate_str = stream.get("r_frame_rate") or "24/1"
    try:
        num, den = rate_str.split("/")
        fps = float(num) / float(den) if float(den) > 0 else 24.0
    except ValueError:
        fps = 24.0
    duration = float((meta.get("format") or {}).get("duration") or 0)
    frame_count = int(duration * fps)
    out_w = width * scale
    out_h = height * scale

    bridge.log(
        f"Real-ESRGAN: {os.path.basename(input_path)} {width}×{height}@{fps:.2f}fps "
        f"× {scale} → {out_w}×{out_h} · {frame_count} frames"
    )

    base, ext = os.path.splitext(input_path)
    out_path = f"{base}_{out_h}p{ext}"

    if dry_run:
        bridge.result({
            "wouldUpscale": input_path,
            "outputPath": out_path,
            "inputResolution": f"{width}×{height}",
            "outputResolution": f"{out_w}×{out_h}",
            "estimatedFrames": frame_count,
            "estimatedMinutes": round(frame_count / 48, 1),  # ~0.8 fps
        })
        return

    if frame_count > 7200:
        bridge.warn(
            f"~{frame_count} frames vil ta ~{frame_count // 48} min på "
            "Apple Silicon. Avbryt nå om du ikke vil vente."
        )

    bridge.progress(2, 100, "Downloading Real-ESRGAN weights from R2…")
    weights_path = ai_models.ensure_local_model("realesrgan-x4plus")
    if not weights_path:
        bridge.error("Could not get Real-ESRGAN weights from R2")
        sys.exit(1)

    with tempfile.TemporaryDirectory(prefix="esrgan_") as tmpdir:
        frames_in = os.path.join(tmpdir, "in")
        frames_out = os.path.join(tmpdir, "out")
        os.makedirs(frames_in, exist_ok=True)
        os.makedirs(frames_out, exist_ok=True)

        bridge.progress(5, 100, "Extracting frames…")
        r = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-i", input_path, "-vsync", "0",
             os.path.join(frames_in, "%06d.png")],
            capture_output=True, text=True, timeout=600,
        )
        if r.returncode != 0:
            bridge.error(f"ffmpeg frame-extract failed: {(r.stderr or '')[-300:]}")
            sys.exit(1)

        def _on_progress(cur, tot):
            pct = 10 + int(80 * cur / max(1, tot))
            bridge.progress(pct, 100, f"Upscale frame {cur}/{tot}")

        _run_realesrgan(frames_in, frames_out, weights_path, scale, _on_progress)

        bridge.progress(92, 100, "Re-encoding 4K + original audio…")
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", f"{fps}",
            "-i", os.path.join(frames_out, "%06d.png"),
            "-i", input_path,
            "-map", "0:v", "-map", "1:a?",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            "-shortest", "-movflags", "+faststart",
            out_path,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        if r.returncode != 0:
            bridge.error(f"ffmpeg encode failed: {(r.stderr or '')[-300:]}")
            sys.exit(1)

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "inputPath": input_path,
        "outputPath": out_path,
        "inputResolution": f"{width}×{height}",
        "outputResolution": f"{out_w}×{out_h}",
        "scale": scale,
        "framesProcessed": frame_count,
        "sizeMb": round(os.path.getsize(out_path) / (1024**2), 1) if os.path.isfile(out_path) else 0,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

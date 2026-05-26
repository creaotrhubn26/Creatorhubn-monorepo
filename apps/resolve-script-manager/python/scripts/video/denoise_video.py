"""Denoise video grain via Restormer (R2-weighted Transformer denoiser).

Outdoor/low-light wedding-ceremonies har ofte ISO 6400+ → synlig sensor-
grain selv på moderne kameraer. Restormer er state-of-art Transformer-
basert denoiser fra MMCV/Salman Khan's lab. R2 har 2 varianter:
  - restormer.pth                        (color denoising, general)
  - restormer_gaussian_color_denoising.pth (Gaussian-noise spesialist)

Pipeline mirrorer enhance_with_gfpgan + upscale_to_4k pattern.

Performance på Apple Silicon M2:
  - 1080p Restormer:        ~2 fps  → 4-min highlight ≈ 50-60 min
  - Mindre aggressiv enn FFmpeg hqdn3d men gir mer detalj-bevaring.
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


def _probe_meta(ffmpeg: str, path: str) -> dict:
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate:format=duration",
             "-of", "json", path],
            capture_output=True, text=True, timeout=15,
        )
        return json.loads(r.stdout or "{}")
    except Exception:  # noqa: BLE001
        return {}


def _run_restormer(
    frames_dir: str, output_dir: str, weights_path: str,
    progress_cb=None,
) -> int:
    """Restormer per frame. Returns count processed."""
    try:
        import torch  # type: ignore
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except ImportError as exc:
        bridge.error(f"torch/cv2 import failed: {exc}")
        return 0

    # Restormer architecture — load from state-dict only (model class needed)
    # Reference impl: https://github.com/swz30/Restormer
    try:
        from basicsr.archs.restormer_arch import Restormer  # type: ignore
    except ImportError:
        bridge.error(
            "Restormer arch not available — install basicsr: "
            "pip install basicsr"
        )
        return 0

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = Restormer(
        inp_channels=3, out_channels=3, dim=48,
        num_blocks=[4, 6, 6, 8], num_refinement_blocks=4,
        heads=[1, 2, 4, 8], ffn_expansion_factor=2.66,
        bias=False, LayerNorm_type="WithBias",
        dual_pixel_task=False,
    )
    try:
        state = torch.load(weights_path, map_location=device)
        # Different repos ship state under different keys
        sd = state.get("params", state.get("state_dict", state))
        model.load_state_dict(sd)
    except Exception as exc:  # noqa: BLE001
        bridge.error(f"Restormer state-dict load failed: {exc}")
        return 0
    model = model.to(device)
    model.eval()

    frames = sorted([f for f in os.listdir(frames_dir) if f.lower().endswith(".png")])
    total = len(frames)
    for i, fn in enumerate(frames):
        img = cv2.imread(os.path.join(frames_dir, fn), cv2.IMREAD_COLOR)
        if img is None:
            shutil.copy2(os.path.join(frames_dir, fn), os.path.join(output_dir, fn))
            continue
        try:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            tensor = torch.from_numpy(rgb).permute(2, 0, 1).float() / 255.
            tensor = tensor.unsqueeze(0).to(device)
            with torch.no_grad():
                out = model(tensor)
            out_np = out[0].permute(1, 2, 0).cpu().numpy() * 255.
            out_np = out_np.clip(0, 255).astype(np.uint8)
            cv2.imwrite(
                os.path.join(output_dir, fn),
                cv2.cvtColor(out_np, cv2.COLOR_RGB2BGR),
            )
        except Exception as exc:  # noqa: BLE001
            bridge.warn(f"Restormer failed on {fn}: {exc} — passing through")
            cv2.imwrite(os.path.join(output_dir, fn), img)
        if progress_cb and (i + 1) % 20 == 0:
            progress_cb(i + 1, total)
    return total


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
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
    rate_str = (meta.get("streams") or [{}])[0].get("r_frame_rate") or "24/1"
    try:
        num, den = rate_str.split("/")
        fps = float(num) / float(den) if float(den) > 0 else 24.0
    except ValueError:
        fps = 24.0
    duration = float((meta.get("format") or {}).get("duration") or 0)
    frame_count = int(duration * fps)

    base, ext = os.path.splitext(input_path)
    out_path = f"{base}_denoised{ext}"

    bridge.log(f"Restormer plan: {os.path.basename(input_path)} · {frame_count} frames")
    if dry_run:
        bridge.result({
            "wouldDenoise": input_path,
            "outputPath": out_path,
            "estimatedFrames": frame_count,
            "estimatedMinutes": round(frame_count / 120, 1),  # ~2 fps
        })
        return

    if frame_count > 7200:
        bridge.warn(
            f"~{frame_count} frames vil ta {frame_count // 120} min på "
            "Apple Silicon. Avbryt nå om du ikke vil vente."
        )

    bridge.progress(2, 100, "Downloading Restormer weights from R2…")
    weights = bridge.r2_download(
        "models/restormer/restormer.pth",
        expected_min_bytes=50_000_000,
    ) or bridge.r2_download(
        "models/restormer/restormer_gaussian_color_denoising.pth",
        expected_min_bytes=50_000_000,
    )
    if not weights:
        bridge.error("Could not get Restormer weights from R2")
        sys.exit(1)

    with tempfile.TemporaryDirectory(prefix="restormer_") as tmpdir:
        frames_in = os.path.join(tmpdir, "in")
        frames_out = os.path.join(tmpdir, "out")
        os.makedirs(frames_in, exist_ok=True)
        os.makedirs(frames_out, exist_ok=True)

        bridge.progress(5, 100, "Extracting frames…")
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-i", input_path, "-vsync", "0",
             os.path.join(frames_in, "%06d.png")],
            capture_output=True, text=True, timeout=600,
        )

        def _on_progress(cur, tot):
            pct = 10 + int(80 * cur / max(1, tot))
            bridge.progress(pct, 100, f"Restormer frame {cur}/{tot}")

        _run_restormer(frames_in, frames_out, weights, _on_progress)

        bridge.progress(92, 100, "Re-encoding…")
        subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-framerate", f"{fps}",
             "-i", os.path.join(frames_out, "%06d.png"),
             "-i", input_path,
             "-map", "0:v", "-map", "1:a?",
             "-c:v", "libx264", "-preset", "medium", "-crf", "20",
             "-pix_fmt", "yuv420p",
             "-c:a", "copy",
             "-shortest", "-movflags", "+faststart",
             out_path],
            capture_output=True, text=True, timeout=1800,
        )

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "outputPath": out_path,
        "framesProcessed": frame_count,
        "sizeMb": round(os.path.getsize(out_path) / (1024**2), 1)
                  if os.path.isfile(out_path) else 0,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

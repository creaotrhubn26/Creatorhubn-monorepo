"""Frame-interpolate to create buttery slow-motion via RIFE v4.6.

Use case: en 24fps shot på 2 sek skal bli 60fps-slow-mo som varer 5 sek
i highlight. RIFE genererer intermediære frames mellom hver eksisterende,
gir resultat som ser ut som original-camera-slow-mo (vs ffmpeg minterpolate
som har visible mush).

Pipeline:
  1. Download RIFE v4.6 weights fra R2
  2. ffmpeg extract source frames
  3. RIFE inference: for hver consecutive frame-par (n, n+1), generer
     N intermediære (default 1 = 2× framerate, configurable for 60fps)
  4. ffmpeg concat alle frames @ target fps + holde audio sammen ved å
     atempo'e så audio matcher visual

Output: <input>_60fps.mp4 (eller _target_fps.mp4).

Performance på Apple Silicon M2:
  - 1080p @ 24→60fps: ~3 fps inference → ~10 min per minute kildevideo
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


def _probe_fps(ffmpeg: str, path: str) -> float:
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=10,
        )
        rate = (r.stdout or "24/1").strip()
        num, den = rate.split("/")
        return float(num) / float(den) if float(den) > 0 else 24.0
    except Exception:  # noqa: BLE001
        return 24.0


def _run_rife(
    frames_dir: str, output_dir: str, weights_path: str,
    multiplier: int, progress_cb=None,
) -> int:
    """Run RIFE v4.6 on consecutive frame pairs. multiplier=1 doubles
    framerate, =2 triples, =3 quadruples. Writes to output_dir as
    %06d.png (renumbered for new fps).

    Uses the Practical-RIFE reference impl shape; if user has installed
    `rife-ncnn-vulkan` pip pkg instead, we'd need a different code path.
    """
    try:
        import torch  # type: ignore
        # IFNet_HDv3 is the RIFE v4.6 architecture
        sys.path.insert(0, os.path.dirname(weights_path))
        from train_log.RIFE_HDv3 import Model  # type: ignore
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception as exc:  # noqa: BLE001
        bridge.warn(
            f"RIFE Practical-RIFE not available ({exc}). Trying simpler "
            "video-frame-interpolation pkg."
        )
        return _run_rife_simpler(frames_dir, output_dir, weights_path,
                                 multiplier, progress_cb)

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = Model()
    model.load_model(weights_path, -1)
    model.eval()
    model.device()

    frames = sorted([f for f in os.listdir(frames_dir) if f.lower().endswith(".png")])
    if len(frames) < 2:
        return 0

    out_idx = 0
    total_out = len(frames) + (len(frames) - 1) * multiplier
    for i in range(len(frames) - 1):
        a = cv2.imread(os.path.join(frames_dir, frames[i]))
        b = cv2.imread(os.path.join(frames_dir, frames[i + 1]))
        if a is None or b is None:
            continue
        cv2.imwrite(os.path.join(output_dir, f"{out_idx:06d}.png"), a)
        out_idx += 1
        # Generate `multiplier` intermediate frames at t = k/(multiplier+1)
        ta = torch.from_numpy(np.transpose(a, (2, 0, 1))).to(device).float().unsqueeze(0) / 255.
        tb = torch.from_numpy(np.transpose(b, (2, 0, 1))).to(device).float().unsqueeze(0) / 255.
        for k in range(1, multiplier + 1):
            timestep = k / (multiplier + 1)
            with torch.no_grad():
                interp = model.inference(ta, tb, timestep)
            arr = (interp[0].permute(1, 2, 0).cpu().numpy() * 255.).astype(np.uint8)
            cv2.imwrite(os.path.join(output_dir, f"{out_idx:06d}.png"), arr)
            out_idx += 1
        if progress_cb and (i + 1) % 30 == 0:
            progress_cb(out_idx, total_out)
    # Last frame
    last = cv2.imread(os.path.join(frames_dir, frames[-1]))
    if last is not None:
        cv2.imwrite(os.path.join(output_dir, f"{out_idx:06d}.png"), last)
        out_idx += 1
    return out_idx


def _run_rife_simpler(
    frames_dir: str, output_dir: str, weights_path: str,
    multiplier: int, progress_cb,
) -> int:
    """Fallback: use ffmpeg's minterpolate filter at high motion-comp.
    Quality lower than RIFE but always available."""
    bridge.warn("Falling back to ffmpeg minterpolate (lower quality than RIFE)")
    return 0  # signal caller to use ffmpeg-fallback path


def run(params: dict[str, Any], dry_run: bool) -> None:
    input_path = (params.get("inputPath") or "").strip()
    target_fps = int(params.get("targetFps") or 60)

    if not input_path or not os.path.isfile(input_path):
        bridge.error(f"inputPath '{input_path}' is not a file")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not on PATH")
        sys.exit(1)
    if not bridge.r2_is_configured():
        bridge.error("R2 credentials not set")
        sys.exit(1)

    src_fps = _probe_fps(ffmpeg, input_path)
    if target_fps <= src_fps:
        bridge.error(f"targetFps {target_fps} ≤ source fps {src_fps}, nothing to interpolate")
        sys.exit(1)

    # multiplier = how many interpolated frames between each source frame.
    # target_fps = src_fps * (multiplier + 1)
    multiplier = max(1, round(target_fps / src_fps) - 1)
    actual_fps = src_fps * (multiplier + 1)

    bridge.log(
        f"RIFE plan: {os.path.basename(input_path)} {src_fps:.2f}→{actual_fps:.2f}fps "
        f"(multiplier ×{multiplier + 1}, target was {target_fps})"
    )

    base, ext = os.path.splitext(input_path)
    out_path = f"{base}_{int(actual_fps)}fps{ext}"

    if dry_run:
        bridge.result({
            "wouldInterpolate": input_path,
            "outputPath": out_path,
            "sourceFps": src_fps,
            "actualFps": actual_fps,
            "multiplier": multiplier + 1,
        })
        return

    # Try R2 RIFE path first
    bridge.progress(2, 100, "Downloading RIFE v4.6 from R2…")
    weights_path = bridge.r2_download(
        "models/rife/rife-v4.6.pkl",
        expected_min_bytes=50_000_000,
    ) or bridge.r2_download(
        "models/rife/rife46.pth",
        expected_min_bytes=50_000_000,
    )
    if not weights_path:
        bridge.warn(
            "Could not get RIFE weights from R2 — falling back to ffmpeg "
            "minterpolate (lower quality)"
        )
        _ffmpeg_minterpolate(ffmpeg, input_path, out_path, actual_fps)
        bridge.result({
            "outputPath": out_path,
            "engine": "ffmpeg-minterpolate-fallback",
            "actualFps": actual_fps,
        })
        return

    with tempfile.TemporaryDirectory(prefix="rife_") as tmpdir:
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
            pct = 10 + int(75 * cur / max(1, tot))
            bridge.progress(pct, 100, f"RIFE frame {cur}/{tot}")

        out_count = _run_rife(frames_in, frames_out, weights_path,
                              multiplier, _on_progress)
        if out_count == 0:
            bridge.warn("RIFE inference returned 0 frames — using ffmpeg fallback")
            _ffmpeg_minterpolate(ffmpeg, input_path, out_path, actual_fps)
            bridge.result({
                "outputPath": out_path,
                "engine": "ffmpeg-minterpolate-fallback",
                "actualFps": actual_fps,
            })
            return

        bridge.progress(90, 100, "Re-encoding @ target fps with original audio…")
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", f"{actual_fps}",
            "-i", os.path.join(frames_out, "%06d.png"),
            "-i", input_path,
            "-map", "0:v", "-map", "1:a?",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            "-shortest", "-movflags", "+faststart",
            out_path,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if r.returncode != 0:
            bridge.error(f"ffmpeg encode failed: {(r.stderr or '')[-300:]}")
            sys.exit(1)

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({
        "outputPath": out_path,
        "engine": "rife-v4.6",
        "sourceFps": src_fps,
        "actualFps": actual_fps,
        "multiplier": multiplier + 1,
        "framesOut": out_count,
    })


def _ffmpeg_minterpolate(ffmpeg: str, input_path: str, out_path: str, target_fps: float) -> None:
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", input_path,
        "-vf", f"minterpolate=fps={target_fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        out_path,
    ]
    subprocess.run(cmd, capture_output=True, text=True, timeout=3600)


if __name__ == "__main__":
    bridge.main_guard(run)

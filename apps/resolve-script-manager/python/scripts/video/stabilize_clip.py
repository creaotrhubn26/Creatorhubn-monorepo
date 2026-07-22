"""Stabiliser et klipp (eller et segment) — TIERED, auto-velger beste metode.

Bakgrunn: Gyroflow er best-i-klassen MEN krever at kilden har innebygd gyro/IMU-
data (GoPro/DJI/Insta360/Sony). Vanlig bryllups-/event-footage (mirrorless/telefon
uten gyro-logg) har ingenting Gyroflow kan jobbe mot. Derfor en tiered pipeline:

  1. Gyroflow            — hvis kamera-gyrodata finnes OG gyroflow-CLI er installert
  2. ffmpeg vid.stab     — 2-pass (vidstabdetect → vidstabtransform); trenger IKKE gyro
  3. ffmpeg deshake      — 1-pass, alltid tilgjengelig (fallback)

`method="auto"` (default) prøver 1→2→3 og faller ned til det som faktisk er
tilgjengelig, så knappen alltid gir et resultat. Ingen nye harde avhengigheter:
deshake er innebygd i ffmpeg. Ved segment (startSec/endSec) trimmes klippet først.

Output: <input>_stabilized.mp4 (eller _<start>-<end>_stabilized.mp4 for segment).
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
import bridge  # noqa: E402

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


def _ffprobe(ffmpeg: str) -> str:
    return ffmpeg.replace("ffmpeg", "ffprobe")


def _has_vidstab(ffmpeg: str) -> bool:
    try:
        r = subprocess.run([ffmpeg, "-hide_banner", "-filters"], capture_output=True, text=True, timeout=10)
        return "vidstabdetect" in (r.stdout or "")
    except Exception:  # noqa: BLE001
        return False


def _has_gyro(ffmpeg: str, path: str) -> bool:
    """True hvis klippet har en timet metadata-stream med gyro (GoPro gpmd, DJI/Sony camm)."""
    try:
        r = subprocess.run(
            [_ffprobe(ffmpeg), "-v", "error", "-show_entries",
             "stream=codec_tag_string,codec_name:stream_tags=handler_name", "-of", "json", path],
            capture_output=True, text=True, timeout=15,
        )
        blob = json.dumps(json.loads(r.stdout or "{}")).lower()
        return any(k in blob for k in ("gpmd", "gopro met", "camm", "dji meta", "gyro"))
    except Exception:  # noqa: BLE001
        return False


def _gyroflow_cli() -> str | None:
    for c in (
        shutil.which("gyroflow"),
        "/Applications/Gyroflow.app/Contents/MacOS/gyroflow",
    ):
        if c and os.path.isfile(c):
            return c
    return None


def _trim_args(start: Any, end: Any) -> list[str]:
    try:
        s, e = float(start), float(end)
        if e > s:
            return ["-ss", f"{s:.3f}", "-to", f"{e:.3f}"]
    except (TypeError, ValueError):
        pass
    return []


def run(params: dict[str, Any], dry_run: bool) -> None:
    src = (params.get("videoPath") or params.get("sourceVideo") or params.get("inputPath") or "").strip()
    if not src or not os.path.isfile(src):
        bridge.error(f"videoPath '{src}' er ikke en fil")
        sys.exit(1)

    start, end = params.get("startSec"), params.get("endSec")
    try:
        strength = float(params.get("strength")) if params.get("strength") is not None else 0.5
    except (TypeError, ValueError):
        strength = 0.5
    strength = max(0.0, min(1.0, strength))
    method = (params.get("method") or "auto").strip().lower()

    out = (params.get("outputPath") or "").strip()
    if not out:
        base, _ = os.path.splitext(src)
        seg = f"_{float(start):.1f}-{float(end):.1f}" if (start is not None and end is not None) else ""
        out = f"{base}{seg}_stabilized.mp4"

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg ikke funnet på PATH")
        sys.exit(1)

    # ── Velg metode (auto = beste tilgjengelige) ──
    chosen = method
    if method == "auto":
        if _has_gyro(ffmpeg, src) and _gyroflow_cli():
            chosen = "gyroflow"
        elif _has_vidstab(ffmpeg):
            chosen = "vidstab"
        else:
            chosen = "deshake"
    if chosen == "gyroflow" and not _gyroflow_cli():
        chosen = "vidstab" if _has_vidstab(ffmpeg) else "deshake"
    if chosen == "vidstab" and not _has_vidstab(ffmpeg):
        chosen = "deshake"

    if dry_run:
        bridge.result({"outputPath": out, "method": chosen, "strength": strength, "dryRun": True})
        return

    trim = _trim_args(start, end)
    bridge.progress(5, 100, f"Stabiliserer ({chosen}) …")

    # ── Tier 1: Gyroflow (gyrodata + CLI) ──
    if chosen == "gyroflow":
        gf = _gyroflow_cli()
        cmd = [gf, src, "--out", out, "--smoothness", f"{0.3 + strength * 0.7:.2f}"]
        if trim:
            cmd += ["--trim-start", f"{float(start):.3f}", "--trim-end", f"{float(end):.3f}"]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        except Exception as exc:  # noqa: BLE001
            r = None
            bridge.warn(f"gyroflow kastet: {exc}")
        if r is not None and r.returncode == 0 and os.path.isfile(out):
            bridge.progress(100, 100, "Ferdig.")
            bridge.result({"outputPath": out, "method": "gyroflow", "strength": strength})
            return
        bridge.warn("gyroflow feilet → faller tilbake til ffmpeg.")
        chosen = "vidstab" if _has_vidstab(ffmpeg) else "deshake"

    # ── Tier 2: ffmpeg vid.stab (2-pass) ──
    if chosen == "vidstab":
        trf = tempfile.NamedTemporaryFile(suffix=".trf", delete=False).name
        shakiness = int(round(3 + strength * 7))    # 3..10
        smoothing = int(round(10 + strength * 40))  # frame-vindu
        zoom = round(strength * 5, 1)               # % zoom for å skjule svarte kanter
        det = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", *trim, "-i", src,
               "-vf", f"vidstabdetect=shakiness={shakiness}:accuracy=15:result={trf}", "-f", "null", "-"]
        r1 = subprocess.run(det, capture_output=True, text=True, timeout=3600)
        if r1.returncode == 0:
            bridge.progress(55, 100, "Analyse ferdig — renderer stabilisert …")
            vf = (f"vidstabtransform=input={trf}:smoothing={smoothing}:zoom={zoom}:optzoom=1:interpol=linear,"
                  "unsharp=5:5:0.8:3:3:0.4")
            tr = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", *trim, "-i", src,
                  "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                  "-pix_fmt", "yuv420p", "-c:a", "copy", out]
            r2 = subprocess.run(tr, capture_output=True, text=True, timeout=3600)
            try:
                os.unlink(trf)
            except OSError:
                pass
            if r2.returncode == 0 and os.path.isfile(out):
                bridge.progress(100, 100, "Ferdig.")
                bridge.result({"outputPath": out, "method": "vidstab", "strength": strength, "zoomPct": zoom})
                return
            bridge.warn(f"vidstabtransform feilet → deshake: {(r2.stderr or '')[-200:]}")
        else:
            bridge.warn(f"vidstabdetect feilet → deshake: {(r1.stderr or '')[-200:]}")
        chosen = "deshake"

    # ── Tier 3: ffmpeg deshake (alltid tilgjengelig) ──
    # deshake KREVER at rx/ry er multiplum av 16 → snap til {16,32,48,64}.
    rng = max(16, min(64, int(round((16 + strength * 48) / 16)) * 16))
    vf = f"deshake=rx={rng}:ry={rng}:edge=mirror,unsharp=5:5:0.6"
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", *trim, "-i", src,
           "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18",
           "-pix_fmt", "yuv420p", "-c:a", "copy", out]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
    if r.returncode != 0 or not os.path.isfile(out):
        bridge.error(f"deshake feilet: {(r.stderr or '')[-300:]}")
        sys.exit(1)
    bridge.progress(100, 100, "Ferdig.")
    bridge.result({"outputPath": out, "method": "deshake", "strength": strength})


if __name__ == "__main__":
    bridge.main_guard(run)

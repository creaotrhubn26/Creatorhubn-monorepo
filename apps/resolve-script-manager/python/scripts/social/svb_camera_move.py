"""Social Vertikal B-kamera — STEG 4B: Keyframet kamera-flytt (push-in + drift) via ffmpeg.
PÅLITELIG alternativ til scriptet Fusion-keyframing. Bevarer farge urørt (grades likt).
Params: srcFile, srcInS, frames, outW, outH, srcW, srcH, zoom, xStart, xEnd, yCenter, outPath.
'frames' MÅ være lik shot-slottens dur_f. Output: ProRes 422 HQ mov."""
from __future__ import annotations
import os, sys, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    src = (params.get("srcFile") or "").strip()
    out = (params.get("outPath") or "").strip()
    ss = float(params.get("srcInS") or 0)
    frames = int(params.get("frames") or 0)
    ow = int(params.get("outW") or 1080); oh = int(params.get("outH") or 1920)
    sh = int(params.get("srcH") or 0)
    if sh <= 0 and src:
        try:
            sh = int(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0",
                  "-show_entries", "stream=height", "-of", "csv=p=0", src], text=True).strip() or 2160)
        except Exception:
            sh = 2160
    sw = int(params.get("srcW") or 0)
    if sw <= 0 and src:
        try:
            sw = int(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0",
                  "-show_entries", "stream=width", "-of", "csv=p=0", src], text=True).strip() or round(sh * 16 / 9))
        except Exception:
            sw = round(sh * 16 / 9)
    zoom = float(params.get("zoom") or 0.12)
    win_w = round(sh * ow / oh)                           # 9:16-vindu fra kilde (full høyde)
    center = sw / 2.0
    drift = (params.get("drift") or "left").lower()       # left | right | none
    drift_px = float(params.get("driftPx") or 200)
    if drift == "right":
        dx0, dx1 = center - drift_px, center + drift_px
    elif drift == "none":
        dx0 = dx1 = center
    else:                                                  # left (default): ender til venstre
        dx0, dx1 = center + drift_px, center - drift_px
    x_start = float(params.get("xStart") if params.get("xStart") is not None else dx0)
    x_end = float(params.get("xEnd") if params.get("xEnd") is not None else dx1)
    y_center = float(params.get("yCenter") if params.get("yCenter") is not None else (sh / 2 - 40))
    if not (src and out and frames > 1):
        bridge.error("Mangler srcFile/outPath/frames (frames>1)"); sys.exit(1)
    n1 = frames - 1
    E = f"((n/{n1})*(n/{n1})*(3-2*(n/{n1})))"
    vf = (f"crop=w='{win_w}/(1+{zoom}*{E})':h='{sh}/(1+{zoom}*{E})':"
          f"x='({x_start}+({x_end}-{x_start})*{E})-({win_w}/(1+{zoom}*{E}))/2':"
          f"y='{y_center}-({sh}/(1+{zoom}*{E}))/2',"
          f"scale={ow}:{oh}:flags=lanczos,setsar=1")
    # ProRes-profil: 3=422 HQ, 4=4444 (null tap, full 4:4:4 10-bit), 5=4444 XQ. Default 4444.
    profile = str(params.get("proresProfile") or "4")
    pix_fmt = params.get("pixFmt") or ("yuv444p10le" if profile in ("4", "5") else "yuv422p10le")
    cmd = ["ffmpeg", "-y", "-ss", f"{ss:.3f}", "-i", src, "-frames:v", str(frames), "-an",
           "-vf", vf, "-c:v", "prores_ks", "-profile:v", profile, "-pix_fmt", pix_fmt,
           "-color_range", "pc", "-colorspace", "bt709", "-r", "25", out]
    bridge.log(f"Rendrer kamera-flytt (ProRes profil {profile}, {pix_fmt}): " + os.path.basename(out))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        bridge.error("ffmpeg feilet: " + proc.stderr[-500:]); sys.exit(1)
    nb = 0
    try:
        nb = int(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0",
              "-show_entries", "stream=nb_frames", "-of", "csv=p=0", out], text=True).strip() or 0)
    except Exception:
        pass
    # preview-frames (start/midt/slutt) for UI-forhåndsvisning
    previews = []
    base = os.path.splitext(out)[0]
    import glob as _glob
    for f in _glob.glob(base + "_p*.jpg"):
        try: os.unlink(f)
        except OSError: pass
    mid = max(1, frames // 2); last = max(2, frames - 2)
    sel = f"select='eq(n\\,1)+eq(n\\,{mid})+eq(n\\,{last})'"
    try:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", out, "-vf", sel, "-vsync", "0",
                        base + "_p%02d.jpg"], check=True)
        previews = sorted(_glob.glob(base + "_p*.jpg"))
    except Exception as exc:
        bridge.warn(f"Kunne ikke lage preview: {exc}")
    try: size_bytes = os.path.getsize(out)
    except OSError: size_bytes = 0
    bridge.result({"outPath": out, "frames": nb or frames, "expectedFrames": frames,
                   "ok": (nb == frames) if nb else True, "previews": previews, "sizeBytes": size_bytes,
                   "proresProfile": profile,
                   "note": "Lim outPath inn som cameraMove for dette shotet (key=tlIn) ved STEG 3 (bygg)."})


if __name__ == "__main__":
    bridge.main_guard(run)

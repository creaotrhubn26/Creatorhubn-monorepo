"""Fix Underexposed Clips — KORRIGERENDE eksponering (ikke en look).

For en allerede farge-gradet film: ikke legg en LUT/look oppå. I stedet måles
hvert timeline-klipps luma (ffmpeg signalstats YAVG → IRE), og KUN de
undereksponerte løftes via en nøytral CDL (gain+lift, NodeIndex 1) skalert til
hvor mørkt klippet er. Godt-eksponerte klipp røres ikke.

Input:
  thresholdIRE:  under denne regnes klippet som undereksponert (default 35)
  targetIRE:     mål-midtone å løfte mot (default 42)
  maxSlope:      tak på gain (default 1.35)
  maxOffset:     tak på lift (default 0.08)
  srcFps:        kilde-fps (default 25)

Output: { clips, corrected, perClip:[{src, ire, slope, offset}] }
"""
from __future__ import annotations
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

FFMPEG = next((p for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg")
               if os.path.isfile(p) or p == "ffmpeg"), "ffmpeg")


def yavg_at(video, sec, dur=2.0):
    try:
        r = subprocess.run([FFMPEG, "-nostats", "-hide_banner", "-ss", f"{sec:.2f}", "-t", str(dur),
                            "-i", video, "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG",
                            "-f", "null", "-"], capture_output=True, text=True, timeout=20)
        vals = [float(m) for m in re.findall(r"YAVG=([\d.]+)", r.stderr)]
        return sum(vals) / len(vals) if vals else None
    except Exception:
        return None


def run(params: dict, dry_run: bool) -> None:
    thr = float(params.get("thresholdIRE") or 35)
    target = float(params.get("targetIRE") or 42)
    max_slope = float(params.get("maxSlope") or 1.35)
    max_offset = float(params.get("maxOffset") or 0.08)
    src_fps = float(params.get("srcFps") or 25)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    tl = conn.project.GetCurrentTimeline()
    if not tl:
        bridge.error("Ingen aktiv timeline"); sys.exit(1)
    items = tl.GetItemListInTrack("video", 1) or []
    if not items:
        bridge.error("Ingen video-klipp"); sys.exit(1)

    # finn kilde-fil via media pool item
    src_path = None
    try:
        mp_item = items[0].GetMediaPoolItem()
        src_path = mp_item.GetClipProperty("File Path")
    except Exception:
        pass
    if not src_path or not os.path.isfile(src_path):
        bridge.error("Fant ikke kilde-filsti for måling"); sys.exit(1)

    per = []; corrected = 0
    n = len(items)
    for i, it in enumerate(items):
        try:
            src_sec = it.GetSourceStartFrame() / src_fps
        except Exception:
            continue
        if (i + 1) % 10 == 0:
            bridge.progress(int(90 * (i + 1) / n), 100, f"Måler {i+1}/{n}")
        yavg = yavg_at(src_path, src_sec)
        if yavg is None:
            continue
        ire = (yavg - 16) * 100 / 219
        if ire >= thr:
            per.append({"src": round(src_sec, 1), "ire": round(ire, 1), "fixed": False})
            continue
        # skaler korreksjon til underskudd
        deficit = max(0.0, target - ire)
        slope = round(min(max_slope, 1 + deficit / 100 * 1.6), 3)
        offset = round(min(max_offset, deficit / 100 * 1.3), 4)
        if dry_run:
            corrected += 1; per.append({"src": round(src_sec, 1), "ire": round(ire, 1),
                                        "slope": slope, "offset": offset, "fixed": "dry"}); continue
        try:
            ok = it.SetCDL({"NodeIndex": "1",
                            "Slope": f"{slope} {slope} {slope}",
                            "Offset": f"{offset} {offset} {offset}",
                            "Power": "1.0 1.0 1.0", "Saturation": "1.0"})
            if ok:
                corrected += 1
            per.append({"src": round(src_sec, 1), "ire": round(ire, 1),
                        "slope": slope, "offset": offset, "fixed": bool(ok)})
        except Exception as exc:
            per.append({"src": round(src_sec, 1), "ire": round(ire, 1), "error": str(exc)[:80]})

    bridge.result({"clips": n, "corrected": corrected, "thresholdIRE": thr,
                   "underexposed": [x for x in per if x.get("ire", 99) < thr][:40]})


if __name__ == "__main__":
    bridge.main_guard(run)

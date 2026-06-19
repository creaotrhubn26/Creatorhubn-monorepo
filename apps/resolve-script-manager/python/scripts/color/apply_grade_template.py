"""Apply Grade Template — propagerer et ferdig node-tre (.drx-mal laget i UI via
Farge-node-veiviseren) til ALLE klipp på aktiv timeline via ApplyGradeFromDRX,
og setter per-klipp eksponering på «Eksponering»-noden for de undereksponerte.

Hvorfor: Resolve-scripting kan ikke OPPRETTE noder, men KAN anvende en .drx som
inneholder hele treet. Så: bygg treet én gang (veiviser) → propager her.

Input:
  drxPath:       sti til node-tre-malen (.drx) [required]
  exposureNode:  node-indeks for «Eksponering» i malen (default 2; log-mal: 3)
  thresholdIRE:  under denne løftes klippet (default 35)
  targetIRE:     mål-midtone (default 42)
  srcFps:        kilde-fps (default 25)

Output: { clips, applied, corrected }
"""
from __future__ import annotations
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

FF = next((p for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg")
           if os.path.isfile(p) or p == "ffmpeg"), "ffmpeg")


def yavg(video, sec, dur=2.0):
    try:
        r = subprocess.run([FF, "-nostats", "-hide_banner", "-ss", f"{sec:.2f}", "-t", str(dur), "-i", video,
                            "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"],
                           capture_output=True, text=True, timeout=20).stderr
        v = [float(m) for m in re.findall(r"YAVG=([\d.]+)", r)]
        return sum(v) / len(v) if v else None
    except Exception:
        return None


def run(params: dict, dry_run: bool) -> None:
    drx = (params.get("drxPath") or "").strip()
    if not drx or not os.path.isfile(drx):
        bridge.error(f"drxPath finnes ikke: {drx} — lag node-tre-malen i veiviseren først."); sys.exit(1)
    exp_node = int(params.get("exposureNode") or 2)
    thr = float(params.get("thresholdIRE") or 35)
    target = float(params.get("targetIRE") or 42)
    src_fps = float(params.get("srcFps") or 25)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    tl = conn.project.GetCurrentTimeline()
    if not tl:
        bridge.error("Ingen aktiv timeline"); sys.exit(1)
    items = tl.GetItemListInTrack("video", 1) or []
    if not items:
        bridge.error("Ingen klipp"); sys.exit(1)

    src_path = None
    try:
        src_path = items[0].GetMediaPoolItem().GetClipProperty("File Path")
    except Exception:
        pass

    if dry_run:
        bridge.result({"clips": len(items), "wouldApply": drx, "exposureNode": exp_node}); return

    applied = corrected = 0
    n = len(items)
    for i, it in enumerate(items):
        if (i + 1) % 10 == 0:
            bridge.progress(int(90 * (i + 1) / n), 100, f"Grader {i+1}/{n}")
        # 1) anvend node-tre-malen
        try:
            g = it.GetNodeGraph()
            if g and g.ApplyGradeFromDRX(drx, 0):
                applied += 1
        except Exception as exc:
            bridge.warn(f"ApplyGradeFromDRX feilet klipp {i}: {exc}")
            continue
        # 2) per-klipp eksponering på Eksponering-noden for undereksponerte
        if not src_path:
            continue
        try:
            sec = it.GetSourceStartFrame() / src_fps
        except Exception:
            continue
        y = yavg(src_path, sec)
        if y is None:
            continue
        ire = (y - 16) * 100 / 219
        if ire >= thr:
            continue
        deficit = max(0.0, target - ire)
        slope = round(min(1.35, 1 + deficit / 100 * 1.6), 3)
        offset = round(min(0.08, deficit / 100 * 1.3), 4)
        try:
            if it.SetCDL({"NodeIndex": str(exp_node), "Slope": f"{slope} {slope} {slope}",
                          "Offset": f"{offset} {offset} {offset}", "Power": "1.0 1.0 1.0", "Saturation": "1.0"}):
                corrected += 1
        except Exception:
            pass

    bridge.result({"clips": n, "applied": applied, "corrected": corrected,
                   "exposureNode": exp_node, "drx": os.path.basename(drx)})


if __name__ == "__main__":
    bridge.main_guard(run)

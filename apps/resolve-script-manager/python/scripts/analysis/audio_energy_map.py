"""Audio Energy Map — RMS-loudness per sekund over hele filmen → topper
(jubel/dhol/applaus/musikk-swell) og stille partier (intimt/seremoni). Brukes
til å plassere harde kutt på toppene og la stille partier puste.

Input:
  videoPath:  abs sti til kilde-video [required]
  outJson:    hvor kurven lagres (default ved siden av videoen)

Output: { durationSec, peaks:[{sec,db}], valleys:[{sec,db}], curve30s:[{sec,db}], jsonPath }
"""
from __future__ import annotations
import json, os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

FFMPEG = next((p for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg")
               if os.path.isfile(p) or p == "ffmpeg"), "ffmpeg")


def run(params: dict, dry_run: bool) -> None:
    video = (params.get("videoPath") or "").strip()
    if not video or not os.path.isfile(video):
        bridge.error(f"videoPath finnes ikke: {video}"); sys.exit(1)
    if dry_run:
        bridge.result({"would": "compute RMS per second", "video": video}); return

    fd, rms_txt = tempfile.mkstemp(prefix="rms_", suffix=".txt"); os.close(fd)
    bridge.progress(10, 100, "Analyserer lyd-energi…")
    af = (f"aresample=8000,asetnsamples=8000,astats=metadata=1:reset=1,"
          f"ametadata=print:key=lavfi.astats.Overall.RMS_level:file={rms_txt}")
    r = subprocess.run([FFMPEG, "-hide_banner", "-nostats", "-i", video, "-map", "0:a:0",
                        "-af", af, "-f", "null", "-"], capture_output=True, text=True, timeout=900)
    if not os.path.isfile(rms_txt):
        bridge.error("ffmpeg produserte ingen RMS-data (har videoen lyd?)"); sys.exit(1)

    secs = {}; ts = None
    for line in open(rms_txt):
        m = re.search(r"pts_time:([\d.]+)", line)
        if m: ts = int(float(m.group(1))); continue
        m = re.search(r"RMS_level=(-?[\d.]+|-?inf)", line)
        if m and ts is not None:
            v = m.group(1); secs[ts] = -120.0 if "inf" in v else float(v)
    os.unlink(rms_txt)
    if not secs:
        bridge.error("Klarte ikke parse RMS"); sys.exit(1)

    xs = sorted(secs); vals = [secs[t] for t in xs]
    # 3s rolling mean for peak/valley picking
    roll = []
    for t in xs:
        w = [secs[x] for x in xs if t-1 <= x <= t+1]
        roll.append((sum(w)/len(w), t))
    def spread(sorted_list, n, gap):
        out = []
        for v, t in sorted_list:
            if all(abs(t-o["sec"]) > gap for o in out):
                out.append({"sec": t, "db": round(v, 1)})
            if len(out) >= n: break
        return out
    peaks = spread(sorted(roll, reverse=True), 18, 20)
    valleys = spread(sorted(roll), 12, 25)
    curve = []
    for s in range(0, max(xs)+1, 30):
        ch = [secs[t] for t in xs if s <= t < s+30]
        if ch: curve.append({"sec": s, "db": round(sum(ch)/len(ch), 1)})

    out_json = (params.get("outJson") or os.path.splitext(video)[0] + ".energy.json").strip()
    payload = {"durationSec": len(xs), "peaks": peaks, "valleys": valleys, "curve30s": curve}
    try: json.dump(payload, open(out_json, "w"), indent=1)
    except OSError: out_json = "/tmp/audio_energy.json"; json.dump(payload, open(out_json, "w"), indent=1)

    bridge.progress(100, 100, "Ferdig.")
    bridge.result({**payload, "jsonPath": out_json})


if __name__ == "__main__":
    bridge.main_guard(run)

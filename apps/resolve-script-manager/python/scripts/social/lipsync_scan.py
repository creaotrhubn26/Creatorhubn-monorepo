"""Lip-sync sjekk — STEG 1: skann en ferdig timeline for bilde-vs-lyd desync (dual-system).
Sammenligner hvert kamera-klipps egen scratch (låst til bildet) mot opptaker-master-lyden
(separat WAV/recorder) via envelope-korr m/ bredt søk. Flagger klipp der bildet ikke matcher
ordene vi hører. READ-ONLY (rører ikke timeline). Returnerer seksjoner for markering.
Params: timelineName(valgfri=current), useInOut(bool), thresholdFrames, corrMin, searchS, chunkS."""
from __future__ import annotations
import os, sys, subprocess, tempfile
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

REC_EXT = (".wav", ".mp3", ".aif", ".aiff", ".m4a", ".flac")

def run(params: dict[str, Any], dry_run: bool) -> None:
    bridge.reexec_in_venv_if_present()
    import numpy as np
    from scipy.signal import correlate
    name = (params.get("timelineName") or "").strip()
    use_io = bool(params.get("useInOut", True))
    thr_f = float(params.get("thresholdFrames") or 2)
    corr_min = float(params.get("corrMin") or 0.45)
    search = float(params.get("searchS") or 70)
    chunk = float(params.get("chunkS") or 25)
    SR = 16000; HOP = 160

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    proj = conn.project
    tl = None
    if name:
        for i in range(1, proj.GetTimelineCount()+1):
            t = proj.GetTimelineByIndex(i)
            if t.GetName() == name: tl = t
    tl = tl or proj.GetCurrentTimeline()
    if not tl: bridge.error("Ingen timeline"); sys.exit(1)
    fps = float(tl.GetSetting("timelineFrameRate") or 25); start = int(tl.GetStartFrame())
    thr_s = thr_f / fps

    IN, OUT = start, int(tl.GetEndFrame())
    if use_io:
        try:
            mio = tl.GetMarkInOut()
            v = (mio or {}).get("video") or (mio or {}).get("audio")
            if v: IN, OUT = start + int(v["in"]), start + int(v["out"])
        except Exception: pass
    bridge.log(f"Skanner {tl.GetName()} {(IN-start)/fps:.0f}s–{(OUT-start)/fps:.0f}s")

    def ov(it): return it.GetStart() < OUT and it.GetEnd() > IN
    def src_paths_video():
        s = set()
        for trk in range(1, int(tl.GetTrackCount("video"))+1):
            for it in (tl.GetItemListInTrack("video", trk) or []):
                m = it.GetMediaPoolItem()
                if m: s.add(os.path.basename((m.GetClipProperty() or {}).get("File Path", "")))
        return s
    vid_srcs = src_paths_video()

    # --- GJENTAKELSE-deteksjon (sjekkes FØRST): bakover-hopp i src på samme lyd-spor+fil
    #     = duplisert tale. Dette er ofte den EKTE feilen bak "lip-sync off" på dual-system. ---
    repeats = []
    for trk in range(1, int(tl.GetTrackCount("audio"))+1):
        clips = sorted([it for it in (tl.GetItemListInTrack("audio", trk) or []) if ov(it)],
                       key=lambda x: x.GetStart())
        prev_out = None; prev_file = None
        for it in clips:
            m = it.GetMediaPoolItem()
            if not m: prev_out = None; prev_file = None; continue
            b = os.path.basename((m.GetClipProperty() or {}).get("File Path", ""))
            si = (it.GetSourceStartFrame() or 0)/fps
            so = si + (it.GetEnd()-it.GetStart())/fps
            if prev_out is not None and b == prev_file and si < prev_out - 1.0:  # >1s = ekte (ikke crossfade)
                repeats.append({"tlStartRel": int(it.GetStart()-start), "tlEndRel": int(it.GetEnd()-start),
                                "track": trk, "file": b, "backSec": round(prev_out - si, 1)})
            prev_out = so; prev_file = b
    repeats.sort(key=lambda x: x["tlStartRel"])
    if repeats:
        bridge.log(f"⚠️ Fant {len(repeats)} gjentakelse(r) i lyden (bakover-hopp >1s) — sjekk disse FØRST")

    # recorder-lyd (separat, ikke kamera-fil) i region -> intervaller
    recs = []  # (tl0,tl1,path,srcIn_s)
    for trk in range(1, int(tl.GetTrackCount("audio"))+1):
        for it in (tl.GetItemListInTrack("audio", trk) or []):
            if not ov(it): continue
            m = it.GetMediaPoolItem()
            if not m: continue
            p = (m.GetClipProperty() or {}).get("File Path", ""); b = os.path.basename(p)
            if b in vid_srcs: continue  # kamera-scratch, ikke master
            if os.path.splitext(b)[1].lower() not in REC_EXT: continue
            recs.append((it.GetStart(), it.GetEnd(), p, (it.GetSourceStartFrame() or 0)/fps, b))

    # topp-lag video-segmenter i region (per distinkt kamera-fil)
    insts = []
    for trk in range(1, int(tl.GetTrackCount("video"))+1):
        for it in (tl.GetItemListInTrack("video", trk) or []):
            if not ov(it): continue
            m = it.GetMediaPoolItem()
            if not m: continue
            p = (m.GetClipProperty() or {}).get("File Path", "")
            insts.append({"track": trk, "path": p, "file": os.path.basename(p),
                          "sf": it.GetStart(), "ef": it.GetEnd(), "src_in": (it.GetSourceStartFrame() or 0)/fps})
    # flatten (topp vinner)
    bnds = sorted(set([i["sf"] for i in insts]+[i["ef"] for i in insts]))
    segs = []
    for a, b in zip(bnds, bnds[1:]):
        if b <= IN or a >= OUT: continue
        mid = (a+b)/2; top = None
        for i in insts:
            if i["sf"] <= mid <= i["ef"] and (top is None or i["track"] > top["track"]): top = i
        if top: segs.append({"sf": max(a, IN), "ef": min(b, OUT), "path": top["path"], "file": top["file"],
                             "src_in": top["src_in"] + (max(a, IN)-top["sf"])/fps})

    def env(args, dur):
        with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as tf: o = tf.name
        r = subprocess.run(["ffmpeg","-y","-v","error"]+args+["-ac","1","-ar",str(SR),"-f","f32le",o],
                           capture_output=True, text=True)
        if r.returncode != 0: os.unlink(o); return None
        x = np.fromfile(o, dtype=np.float32); os.unlink(o)
        if len(x) < HOP*5: return None
        n = len(x)//HOP; e = np.log(np.sqrt((x[:n*HOP].reshape(n, HOP)**2).mean(1)+1e-9)+1e-6)
        return (e-e.mean())/(e.std()+1e-9)

    def rec_at(tl_frame):
        cand = [r for r in recs if r[0] <= tl_frame < r[1]]
        if not cand: return None
        cand.sort(key=lambda r: 0 if r[4].lower().endswith(".wav") else 1)
        return cand[0]

    _durcache = {}
    def filedur(p):
        if p not in _durcache:
            try: _durcache[p] = float(subprocess.check_output(["ffprobe","-v","error","-show_entries",
                  "format=duration","-of","csv=p=0", p], text=True))
            except Exception: _durcache[p] = 1e9
        return _durcache[p]

    def measure(seg):
        rc = rec_at((seg["sf"]+seg["ef"])//2)
        if not rc: return None
        ch = min(chunk, filedur(seg["path"]) - seg["src_in"] - 0.5)
        if ch < 5: return None
        ec = env(["-ss", f"{seg['src_in']:.3f}", "-i", seg["path"], "-t", f"{ch:.3f}"], ch)
        R0 = rc[3] + (seg["sf"]-rc[0])/fps   # recorder src som HØRES ved segment-start
        ew = env(["-ss", f"{max(0,R0-search):.3f}", "-i", rc[2], "-t", f"{ch+2*search:.3f}"], ch+2*search)
        if ec is None or ew is None: return None
        L = len(ec)
        if len(ew) <= L: return None
        num = correlate(ew, ec, mode="valid")
        ss = np.concatenate([[0], np.cumsum(ew**2)])
        wss = ss[L:L+len(num)] - ss[0:len(num)]
        ncc = num/(np.sqrt(L)*np.sqrt(wss)+1e-9)
        k = int(np.argmax(ncc)); peak = float(ncc[k])
        off = (max(0, R0-search) + k/100.0) - R0   # >0: bildet ligger foran lyden
        return off, peak

    byfile = {}
    for s in segs: byfile.setdefault(s["file"], []).append(s)
    flagged = []
    files = sorted(byfile.items(), key=lambda kv: -sum(x["ef"]-x["sf"] for x in kv[1]))
    for fi, (fname, fsegs) in enumerate(files):
        bridge.progress(fi+1, len(files), f"Måler {fname}")
        res = None
        for seg in sorted(fsegs, key=lambda x: -(x["ef"]-x["sf"]))[:5]:  # prøv opptil 5 segmenter
            res = measure(seg)
            if res is not None: break
        if res is None:
            bridge.log(f"  {fname}: ingen måling (mangler recorder / for kort kilde)"); continue
        off, peak = res
        status = "OFF" if (abs(off) > thr_s and peak >= corr_min) else "ok"
        bridge.log(f"  {fname}: offset {off:+.2f}s ({off*fps:+.0f}f) corr {peak:.2f} -> {status}")
        if status == "OFF":
            for s in fsegs:
                flagged.append({"tlStartRel": int(s["sf"]-start), "tlEndRel": int(s["ef"]-start),
                                "file": fname, "offsetSec": round(off, 2), "offsetFrames": round(off*fps, 1),
                                "corr": round(peak, 2)})
    # slå sammen sammenhengende flaggede seksjoner (samme fil)
    flagged.sort(key=lambda x: x["tlStartRel"])
    merged = []
    for f in flagged:
        if merged and merged[-1]["file"] == f["file"] and f["tlStartRel"] <= merged[-1]["tlEndRel"]+2:
            merged[-1]["tlEndRel"] = max(merged[-1]["tlEndRel"], f["tlEndRel"])
        else: merged.append(dict(f))
    def tc(rel): s=rel/fps; return f"01:{int(s//3600):02d}:{int((s%3600)//60):02d}:{int(s%60):02d}"
    rows = [{**m, "tcStart": tc(m["tlStartRel"]), "tcEnd": tc(m["tlEndRel"]),
             "durSec": round((m["tlEndRel"]-m["tlStartRel"])/fps, 1)} for m in merged]
    rep_rows = [{**r, "tcStart": tc(r["tlStartRel"]), "tcEnd": tc(r["tlEndRel"])} for r in repeats]
    if rep_rows:
        note = (f"⚠️ Fant {len(rep_rows)} GJENTAKELSE(R) i lyden (duplisert tale) — fiks disse FØRST; "
                f"de er ofte selve årsaken til 'lip-sync off'. Kjør scan på nytt ETTER at de er fikset — "
                f"offset-funn ({len(rows)}) kan være falske ved repetitiv lyd.")
    elif rows:
        note = ("Ingen gjentakelse. Fant mulige usynkede seksjoner — men NB: offset kan være FALSKT "
                "ved repetitiv tale (f.eks. vielsesløfter). Bekreft visuelt (preview/leppe-sjekk) før du markerer/fikser.")
    else:
        note = "Ingen gjentakelse og ingen desync over terskelen funnet."
    bridge.result({"timeline": tl.GetName(), "regionSec": [round((IN-start)/fps,1), round((OUT-start)/fps,1)],
                   "foundRepeats": len(rep_rows), "repeats": rep_rows,
                   "found": len(rows), "sections": rows, "thresholdFrames": thr_f, "note": note})


if __name__ == "__main__":
    bridge.main_guard(run)

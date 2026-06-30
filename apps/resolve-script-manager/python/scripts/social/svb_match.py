"""Social Vertikal B-kamera — STEG 2: Flatten topp-lag (EKSAKTE frames) + tids-match B-kamera → plan.json.
Ren Python (ffprobe). Params: workDir, fps, acamFilenameTimeRe, bcamDir, bcamGlob, offset(optional),
anchors(optional liste [{tlIn, bFile}]), fuzzS."""
from __future__ import annotations
import os, sys, json, re, glob, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _exif_tod(path: str):
    try:
        out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
              "format_tags=creation_time", "-of", "default=nw=1:nk=1", path], text=True).strip()
        t = out.split("T")[1][:8] if "T" in out else out[-8:]
        h, mi, s = t.split(":"); return int(h) * 3600 + int(mi) * 60 + int(float(s))
    except Exception:
        return None


def _dur(path: str) -> float:
    try:
        return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
               "format=duration", "-of", "csv=p=0", path], text=True))
    except Exception:
        return 0.0


def run(params: dict[str, Any], dry_run: bool) -> None:
    work = (params.get("workDir") or "").strip()
    fps = float(params.get("fps") or 25)
    name_re = params.get("acamFilenameTimeRe") or r"_(\d{6})\w\w_CANON"
    bcam_dir = (params.get("bcamDir") or "").strip()
    bcam_glob = params.get("bcamGlob") or "*.MP4"
    offset = params.get("offset")
    anchors = params.get("anchors") or []
    fuzz = float(params.get("fuzzS") or 4.0)
    if not work or not bcam_dir:
        bridge.error("Mangler workDir og/eller bcamDir"); sys.exit(1)
    insp = json.load(open(os.path.join(work, "inspect.json")))
    START = insp["start"]

    def a_tod(fn):
        m = re.search(name_re, fn)
        if not m:
            return None
        s = m.group(1); return int(s[:2]) * 3600 + int(s[2:4]) * 60 + int(s[4:6])

    # B-kamera intervaller via EXIF + varighet
    B = []
    files = sorted(glob.glob(os.path.join(bcam_dir, bcam_glob)))
    for idx, p in enumerate(files):
        tod = _exif_tod(p)
        if tod is not None:
            B.append({"file": os.path.basename(p), "tod": tod, "dur": _dur(p)})
        bridge.progress(idx + 1, len(files), "Leser B-kamera EXIF")
    bridge.log(f"B-kamera: {len(B)} klipp m/ tid-på-døgn")

    # flatten i heltalls-frames (topp-spor vinner)
    insts = []
    for tk, trk in insp["video"].items():
        tr = int(tk[1:])
        for c in trk["clips"]:
            insts.append({"track": tr, "file": c["file"], "sf": c["tl_start_f"],
                          "ef": c["tl_end_f"], "src_in_f": c["src_in_f"]})
    bnds = sorted(set([i["sf"] for i in insts] + [i["ef"] for i in insts]))
    segs = []
    for a, b in zip(bnds, bnds[1:]):
        mid = (a + b) / 2
        top = None
        for i in insts:
            if i["sf"] <= mid <= i["ef"] and (top is None or i["track"] > top["track"]):
                top = i
        if top is None:
            continue
        off = top["src_in_f"] - top["sf"]
        segs.append({"sf": a, "ef": b, "track": top["track"], "file": top["file"], "src_in_f": a + off})
    merged = []
    for s in segs:
        if merged and merged[-1]["file"] == s["file"] and merged[-1]["track"] == s["track"] and merged[-1]["ef"] == s["sf"]:
            merged[-1]["ef"] = s["ef"]
        else:
            merged.append(dict(s))

    def find_seg(tl_in_s):
        best = None; bd = 9
        for m in merged:
            d = abs((m["sf"] - START) / fps - tl_in_s)
            if d < bd:
                bd = d; best = m
        return best

    if offset is None and anchors:
        diffs = []
        for an in anchors:
            seg = find_seg(float(an["tlIn"])); bm = next((x for x in B if x["file"] == an["bFile"]), None)
            if seg and bm and a_tod(seg["file"]) is not None:
                diffs.append(bm["tod"] - (a_tod(seg["file"]) + seg["src_in_f"] / fps))
        if diffs:
            offset = sum(diffs) / len(diffs)
            bridge.log(f"Kalibrert OFFSET = {offset:.2f}s fra {len(diffs)} anker")

    def find_b(w_in, w_out):
        best = None; bestov = 0
        for b in B:
            ov = min(w_out, b["tod"] + b["dur"]) - max(w_in, b["tod"])
            if ov > bestov:
                bestov = ov; best = b
        if not best:
            return None
        full = (best["tod"] - fuzz) <= w_in and (best["tod"] + best["dur"] + fuzz) >= w_out
        return {"file": best["file"], "b_tod": best["tod"], "src_in": round(max(0.0, w_in - best["tod"]), 3),
                "cover": round(bestov, 2), "need": round(w_out - w_in, 2), "full": full}

    plan = []
    for m in merged:
        dur = m["ef"] - m["sf"]; tl_in = round((m["sf"] - START) / fps, 2)
        a_w = (a_tod(m["file"]) + m["src_in_f"] / fps) if (offset is not None and a_tod(m["file"]) is not None) else None
        b = find_b(a_w + offset, a_w + offset + dur / fps) if a_w is not None else None
        plan.append({"rec_sf": m["sf"], "dur_f": dur, "tl_in": tl_in, "a_file": m["file"],
                     "a_src_in_f": m["src_in_f"], "b": b})

    json.dump({"start": START, "fps": fps, "offset": offset, "plan": plan},
              open(os.path.join(work, "plan.json"), "w"), indent=2, ensure_ascii=False)
    nb = sum(1 for p in plan if p["b"] and p["b"]["full"])
    bridge.result({
        "offset": offset, "shots": len(plan), "bFull": nb, "fallbacks": len(plan) - nb,
        "planPath": os.path.join(work, "plan.json"),
        "rows": [{"tlIn": p["tl_in"], "durF": p["dur_f"], "aFile": p["a_file"],
                  "aSrcInF": p["a_src_in_f"],
                  "b": (p["b"]["file"] if p["b"] else None),
                  "bFull": bool(p["b"] and p["b"]["full"]),
                  "cover": (p["b"]["cover"] if p["b"] else 0),
                  "need": (p["b"]["need"] if p["b"] else round(p["dur_f"] / fps, 2))} for p in plan],
        "note": "Godkjenn shot-kartet. Fallback-rader (bFull=false) bruker A-klipp reframet (STEG 4).",
    })


if __name__ == "__main__":
    bridge.main_guard(run)

"""Social Vertikal B-kamera — STEG 3: Bygg vertikal V1 fra plan.json (EKSAKTE frames, kontiguøst).
B-treff: rot90+zoom-fill (lip-sync baket inn). Fallback: A-klipp reframet (pan fra STEG 4A).
Kamera-flytt: pre-rendret mov (STEG 4B). Bygger V1 helt på nytt.
Params: workDir, outTimeline, outW, outH, fps, bcamDir, bcamRotated90, fillZoom, fallbackZoom,
cameraMoves (dict "tlIn"->movPath), reframePans (dict "tlIn"->pan), corrMin, applyLipsync (bool)."""
from __future__ import annotations
import os, sys, json
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    work = (params.get("workDir") or "").strip()
    out_tl = (params.get("outTimeline") or "").strip()
    ow = int(params.get("outW") or 1080); oh = int(params.get("outH") or 1920)
    fps = float(params.get("fps") or 25)
    bcam = (params.get("bcamDir") or "").strip()
    rot = bool(params.get("bcamRotated90", True))
    fill = float(params.get("fillZoom") or 1.778)
    fbzoom = float(params.get("fallbackZoom") or 3.16)
    # float-nøkler så heltalls-tlIn (JS "0" vs Python "0.0") matcher robust
    cam_moves = {round(float(k), 2): v for k, v in (params.get("cameraMoves") or {}).items()}
    reframe = {round(float(k), 2): v for k, v in (params.get("reframePans") or {}).items()}
    corr_min = float(params.get("corrMin") or 0.6)
    apply_ls = bool(params.get("applyLipsync", True))
    if not (work and out_tl):
        bridge.error("Mangler workDir/outTimeline"); sys.exit(1)
    pl = json.load(open(os.path.join(work, "plan.json")))["plan"]
    offs = {}
    lp = os.path.join(work, "lipsync_offsets.json")
    if apply_ls and os.path.isfile(lp):
        offs = json.load(open(lp))

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    proj = conn.project; mp = conn.media_pool

    tl = None
    for i in range(1, proj.GetTimelineCount() + 1):
        t = proj.GetTimelineByIndex(i)
        if t.GetName() == out_tl:
            tl = t; break
    if tl is None:
        mp.SetCurrentFolder(mp.GetRootFolder())
        tl = mp.CreateEmptyTimeline(out_tl)
        tl.SetSetting("useCustomSettings", "1")
        tl.SetSetting("timelineResolutionWidth", str(ow)); tl.SetSetting("timelineResolutionHeight", str(oh))
        tl.SetSetting("timelineOutputResolutionWidth", str(ow)); tl.SetSetting("timelineOutputResolutionHeight", str(oh))
    proj.SetCurrentTimeline(tl)

    def walk(f, acc):
        for it in (f.GetClipList() or []):
            acc[os.path.basename((it.GetClipProperty() or {}).get("File Path", ""))] = it
        for s in (f.GetSubFolderList() or []):
            walk(s, acc)
    root = mp.GetRootFolder(); pool = {}; walk(root, pool)

    # importer manglende B-cam + kamera-flytt-filer
    need_paths = []
    for p in pl:
        if p.get("b") and p["b"]["full"] and p["b"]["file"] not in pool:
            need_paths.append(os.path.join(bcam, p["b"]["file"]))
    for mov in set(cam_moves.values()):
        if os.path.basename(mov) not in pool:
            need_paths.append(mov)
    need_paths = [p for p in dict.fromkeys(need_paths) if os.path.isfile(p)]
    if need_paths:
        rbin = None
        for sf in (root.GetSubFolderList() or []):
            if sf.GetName() == "SVB import":
                rbin = sf
        if not rbin:
            rbin = mp.AddSubFolder(root, "SVB import")
        mp.SetCurrentFolder(rbin)
        for it in (mp.ImportMedia(need_paths) or []):
            pool[os.path.basename((it.GetClipProperty() or {}).get("File Path", ""))] = it
        bridge.log(f"Importerte {len(need_paths)} filer")

    def mpi(fn):
        for k, v in pool.items():
            if fn in k:
                return v
        return None

    items = tl.GetItemListInTrack("video", 1) or []
    if items:
        tl.DeleteClips(items, False)

    clips = []; kinds = []
    for p in pl:
        dur = p["dur_f"]; rec = p["rec_sf"]; key = round(float(p["tl_in"]), 2)
        if key in cam_moves:
            m = mpi(os.path.basename(cam_moves[key])); sf = 0; kind = "cam"
        elif p.get("b") and p["b"]["full"]:
            o = offs.get(f'{p["a_file"]}|{p["b"]["file"]}', {})
            os_ = o.get("off_s", 0.0) if o.get("corr", 0) >= corr_min else 0.0
            sf = max(0, int(round((p["b"]["src_in"] - os_) * fps))); m = mpi(p["b"]["file"]); kind = "B"
        else:
            m = mpi(os.path.basename(p["a_file"])); sf = max(0, p["a_src_in_f"]); kind = "A"
        if not m:
            bridge.warn(f"MPI mangler for {key} ({kind})"); continue
        clips.append({"mediaPoolItem": m, "startFrame": sf, "endFrame": sf + dur - 1,
                      "mediaType": 1, "trackIndex": 1, "recordFrame": rec})
        kinds.append((kind, key, rec))
    mp.AppendToTimeline(clips)

    items = tl.GetItemListInTrack("video", 1) or []
    by_rf = {it.GetStart(): it for it in items}
    nB = nA = nC = 0
    for kind, key, rec in kinds:
        it = by_rf.get(rec)
        if not it:
            continue
        if kind == "B":
            it.SetProperty("RotationAngle", 90.0 if rot else 0.0)
            it.SetProperty("ZoomX", fill); it.SetProperty("ZoomY", fill)
            it.SetProperty("Pan", 0.0); it.SetProperty("Tilt", 0.0); nB += 1
        elif kind == "cam":
            for q, v in (("RotationAngle", 0.0), ("ZoomX", 1.0), ("ZoomY", 1.0), ("Pan", 0.0), ("Tilt", 0.0)):
                it.SetProperty(q, v)
            nC += 1
        else:
            it.SetProperty("RotationAngle", 0.0); it.SetProperty("ZoomX", fbzoom); it.SetProperty("ZoomY", fbzoom)
            if key in reframe:
                it.SetProperty("Pan", float(reframe[key]))
            it.SetProperty("Tilt", 0.0); nA += 1

    items = sorted(tl.GetItemListInTrack("video", 1) or [], key=lambda x: x.GetStart())
    bad = 0; prev = None
    for it in items:
        if prev is not None and it.GetStart() != prev + 1:
            bad += 1
        prev = it.GetEnd()
    end_s = (items[-1].GetEnd() + 1 - int(tl.GetStartFrame())) / fps if items else 0
    bridge.result({"timeline": out_tl, "clips": len(items), "bClips": nB, "aFallback": nA,
                   "cameraMoves": nC, "contiguityBreaks": bad, "videoEndSec": round(end_s, 2),
                   "lipsyncApplied": bool(offs),
                   "note": "Kjør STEG 6 (master-lyd) og STEG 7 (verifiser). Live Save persisterer."})


if __name__ == "__main__":
    bridge.main_guard(run)

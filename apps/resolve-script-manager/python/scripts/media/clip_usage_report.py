"""Where-used / unused — LIVE klipp-bruks-rapport. Resolves egen 'Usage'-kolonne er stale til hver
timeline er tvunget lastet; vi bygger en fersk rapport ved å gå gjennom ALLE timelines (GetTimelineByIndex
1..GetTimelineCount), lese items i alle video+audio-spor, og mappe item.GetMediaPoolItem() tilbake til
pool-klipp (stabil nøkkel = File Path, ellers GetName()). Per pool-klipp: usedIn:[{timeline,count,firstTC}].
UNUSED = pool-klipp med 0 bruk i NOEN timeline i DETTE prosjektet (betyr IKKE at fila kan slettes fra disk).
mode="scan" (default) er read-only. Kan være tregt på store prosjekter — vi emitter bridge.progress per timeline.
Params: mode (kun "scan")."""
from __future__ import annotations
import os, sys
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _walk(folder, acc):
    """Flat liste av alle MediaPoolItems i hele pool-treet."""
    for it in (folder.GetClipList() or []):
        acc.append(it)
    for s in (folder.GetSubFolderList() or []):
        _walk(s, acc)


def _clip_key(mp_item):
    """Stabil nøkkel for et pool-klipp: foretrekk File Path, fall tilbake til navn."""
    try:
        cp = mp_item.GetClipProperty() or {}
    except Exception:
        cp = {}
    fp = (cp.get("File Path") or "").strip()
    if fp:
        return fp
    try:
        nm = mp_item.GetName() or ""
    except Exception:
        nm = ""
    # Unik per objekt når hverken sti eller navn finnes, så ulike klipp ikke kolliderer.
    return f"name:{nm}" if nm else f"obj:{id(mp_item)}"


def _to_float(val, default=0.0):
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _frames_to_tc(total_frames, fps, drop_frame=False):
    """Frame-nummer → HH:MM:SS:FF (non-drop). fps avrundes til nærmeste heltall for FF-feltet."""
    fps_int = max(1, int(round(_to_float(fps, 25.0))))
    if total_frames < 0:
        total_frames = 0
    f = int(total_frames)
    ff = f % fps_int
    total_sec = f // fps_int
    ss = total_sec % 60
    mm = (total_sec // 60) % 60
    hh = (total_sec // 3600)
    sep = ";" if drop_frame else ":"
    return f"{hh:02d}:{mm:02d}:{ss:02d}{sep}{ff:02d}"


def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "scan").lower()
    if mode != "scan":
        bridge.error(f"Ukjent mode '{mode}' — clip_usage_report er read-only (kun 'scan').")
        sys.exit(1)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    proj = conn.project
    mp = proj.GetMediaPool()

    # 1) Indekser alle pool-klipp på stabil nøkkel.
    pool_items: list = []
    _walk(mp.GetRootFolder(), pool_items)
    by_key: dict[str, dict] = {}
    for it in pool_items:
        key = _clip_key(it)
        if key in by_key:
            continue
        try:
            cp = it.GetClipProperty() or {}
        except Exception:
            cp = {}
        try:
            name = it.GetName() or os.path.basename(cp.get("File Path") or "") or "(uten navn)"
        except Exception:
            name = "(uten navn)"
        by_key[key] = {
            "name": name,
            "path": (cp.get("File Path") or "").strip(),
            "uses": 0,
            "usedIn": [],      # [{timeline, count, firstTC}]
            "_perTl": {},      # timeline-navn -> {"count":int, "firstStart":int|None}
        }

    # 2) Gå gjennom ALLE timelines og tell bruk per pool-klipp.
    try:
        tl_count = int(proj.GetTimelineCount() or 0)
    except Exception:
        tl_count = 0

    scanned_timelines = 0
    for idx in range(1, tl_count + 1):
        bridge.progress(idx, tl_count, f"Skanner timeline {idx}/{tl_count}")
        try:
            tl = proj.GetTimelineByIndex(idx)
        except Exception:
            tl = None
        if not tl:
            continue
        scanned_timelines += 1
        try:
            tl_name = tl.GetName() or f"Timeline {idx}"
        except Exception:
            tl_name = f"Timeline {idx}"
        # Frame rate + start-frame for TC-konvertering.
        try:
            fps = tl.GetSetting("timelineFrameRate") or 25.0
        except Exception:
            fps = 25.0
        try:
            tl_start = int(_to_float(tl.GetStartFrame(), 0))
        except Exception:
            tl_start = 0

        for track_type in ("video", "audio"):
            try:
                n_tracks = int(tl.GetTrackCount(track_type) or 0)
            except Exception:
                n_tracks = 0
            for trk in range(1, n_tracks + 1):
                try:
                    items = tl.GetItemListInTrack(track_type, trk) or []
                except Exception:
                    items = []
                for item in items:
                    try:
                        mpi = item.GetMediaPoolItem()
                    except Exception:
                        mpi = None
                    if not mpi:
                        continue
                    key = _clip_key(mpi)
                    rec = by_key.get(key)
                    if rec is None:
                        # Item refererer et pool-klipp vi ikke fanget (sjelden) — ta det med.
                        try:
                            cp = mpi.GetClipProperty() or {}
                        except Exception:
                            cp = {}
                        try:
                            nm = mpi.GetName() or "(uten navn)"
                        except Exception:
                            nm = "(uten navn)"
                        rec = {"name": nm, "path": (cp.get("File Path") or "").strip(),
                               "uses": 0, "usedIn": [], "_perTl": {}}
                        by_key[key] = rec
                    rec["uses"] += 1
                    try:
                        start = int(_to_float(item.GetStart(), 0))
                    except Exception:
                        start = 0
                    per = rec["_perTl"].setdefault(tl_name, {"count": 0, "firstStart": None, "fps": fps, "start": tl_start})
                    per["count"] += 1
                    if per["firstStart"] is None or start < per["firstStart"]:
                        per["firstStart"] = start

    # 3) Bygg usedIn + firstTC, og skill ut unused.
    usage = []
    unused_list = []
    used_count = 0
    for rec in by_key.values():
        for tl_name, per in rec["_perTl"].items():
            first_start = per["firstStart"] if per["firstStart"] is not None else per["start"]
            # firstTC = klippets startposisjon i timeline-tidslinjen (record-TC), relativt timeline-start.
            first_tc = _frames_to_tc(int(first_start), per["fps"])
            rec["usedIn"].append({"timeline": tl_name, "count": per["count"], "firstTC": first_tc})
        rec["usedIn"].sort(key=lambda u: u["timeline"])
        if rec["uses"] > 0:
            used_count += 1
            usage.append({"name": rec["name"], "path": rec["path"], "uses": rec["uses"], "usedIn": rec["usedIn"]})
        else:
            unused_list.append({"name": rec["name"], "path": rec["path"]})

    usage.sort(key=lambda u: (-u["uses"], u["name"].lower()))
    unused_list.sort(key=lambda u: u["name"].lower())

    total = len(by_key)
    unused = len(unused_list)
    note = (
        f"Skannet {scanned_timelines} timeline(r): {used_count} av {total} pool-klipp er i bruk, "
        f"{unused} ubrukt. NB: 'ubrukt' betyr kun at klippet ikke ligger i NOEN timeline i DETTE "
        f"prosjektet — det slettes IKKE fra disk og kan fortsatt være ønsket arkiv-materiale."
    )
    if tl_count == 0:
        note = "Ingen timelines i prosjektet — alle pool-klipp regnes som ubrukt. " + note

    bridge.result({
        "clips": total,
        "used": used_count,
        "unused": unused,
        "timelinesScanned": scanned_timelines,
        "usage": usage,
        "unusedList": unused_list,
        "note": note,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

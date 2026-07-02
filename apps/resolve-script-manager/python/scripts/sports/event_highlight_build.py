"""
Sports Event — bygg highlight-timeline fra godkjente øyeblikk.

Tar de menneske-godkjente kandidatene (fra event_moment_scan + triage i UI) og
legger dem som subklipp på en NY timeline i Resolve. Timelinen blir fasit —
derfra finpusser editoren, legger musikk, og rendrer hele timelinen (render-vakt).

Rekkefølge: kronologisk (pr kamera/tid) eller etter score. Valgfrie handles.

params: { approved:[{clip_path,in_s,out_s,score?,camera?}] (påkr.),
          timeline_name?("Highlight – Sports Event"), order?("chrono"|"score"),
          handles_s?(0.0) }
result: { timeline, count, duration_s, order }
"""
from __future__ import annotations
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()

    approved = params.get("approved") or []
    if not approved:
        bridge.error("Ingen godkjente øyeblikk å bygge fra"); sys.exit(1)
    name = params.get("timeline_name") or "Highlight – Sports Event"
    order = params.get("order", "chrono")
    handles = float(params.get("handles_s", 0.0))

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen Resolve-prosjekt"); sys.exit(1)
    pr = conn.project
    mp = pr.GetMediaPool()
    mp.SetCurrentFolder(mp.GetRootFolder())

    # importer (dedupe pr sti) og cache mediaPoolItem + fps pr fil
    paths = []
    for a in approved:
        p = a.get("clip_path")
        if p and p not in paths:
            paths.append(p)
    imported = {}
    for p in paths:
        if not os.path.exists(p):
            bridge.warn(f"Mangler: {os.path.basename(p)}"); continue
        items = mp.ImportMedia([p])
        if items:
            it = items[0]
            try:
                fps = float(it.GetClipProperty("FPS") or pr.GetSetting("timelineFrameRate") or 25)
            except Exception:
                fps = float(pr.GetSetting("timelineFrameRate") or 25)
            imported[p] = (it, fps)
    if not imported:
        bridge.error("Fikk ikke importert noen klipp"); sys.exit(1)

    # rekkefølge
    items = [a for a in approved if a.get("clip_path") in imported]
    if order == "score":
        items.sort(key=lambda a: a.get("score", 0), reverse=True)
    else:
        items.sort(key=lambda a: (a.get("camera") or "", a.get("in_s", 0)))

    # bygg clipInfo-liste (source in/out i frames)
    clip_infos = []
    for a in items:
        it, fps = imported[a["clip_path"]]
        in_s = max(0.0, float(a.get("in_s", 0)) - handles)
        out_s = float(a.get("out_s", in_s + 3)) + handles
        clip_infos.append({
            "mediaPoolItem": it,
            "startFrame": int(round(in_s * fps)),
            "endFrame": max(int(round(in_s * fps)) + 1, int(round(out_s * fps))),
        })

    tl = mp.CreateEmptyTimeline(name)
    if not tl:
        bridge.error("Kunne ikke opprette timeline"); sys.exit(1)
    pr.SetCurrentTimeline(tl)
    mp.AppendToTimeline(clip_infos)

    fps_tl = float(pr.GetSetting("timelineFrameRate") or 25)
    dur = (tl.GetEndFrame() - tl.GetStartFrame()) / fps_tl
    bridge.log(f"Bygde «{name}» · {len(clip_infos)} øyeblikk · {dur:.1f}s · rekkefølge={order}")
    bridge.result({"timeline": name, "count": len(clip_infos),
                   "duration_s": round(dur, 1), "order": order})


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)

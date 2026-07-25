"""Plasseringsguide for ubrukte klipp (bryllup: hvor hører de hjemme?).

For hvert UBRUKT klipp: finn nærmeste BRUKTE nabo fra samme kamera
(opptaks-rekkefølge = naturlig filnavn-sortering, f.eks. C80_0234 → C80_0237)
og slå opp hvor i timelinen naboene ligger. Resultat: tidskode-hint per
ubrukt klipp («hører hjemme ≈ 01:23:40, mellom X @ 01:23:12 og Y @ 01:24:05»).

Valgfritt (markers=true): sett BLÅ markører i timelinen på hvert «hjemsted»
med navnene på de ubrukte klippene som hører til der. Dry-run setter ingen.

Forventer strukturen fra categorize_unused_clips: dag-bin/<kamera> (brukte)
+ dag-bin/UBRUKT/<kamera> (ubrukte). Kjøres ETTER kategorisering.

Params:
  bins=Dag 1,Dag 2   (kommaseparert, case-insensitiv contains-match)
  target=UBRUKT      (navnet på ubrukt-binnen)
  markers=false      (true → sett markører i timelinen)
  timeline=<navn>    (default: gjeldende)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402


from project_index import clip_identity as _shared_identity


def _identity(clip):
    """Delt identitet fra prosjektindeksen — ALDRI navn alene."""
    d = _shared_identity(clip)
    return d["uid"], d["path"]


def _natural_key(name: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name or "")]


def _frames_to_tc(frames: int, fps: float) -> str:
    fps_i = max(1, round(fps))
    f = int(frames)
    ff = f % fps_i
    s = f // fps_i
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}:{ff:02d}"


def run(params: dict, dry_run: bool) -> None:
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project

    tl_name = (params.get("timeline") or "").strip()
    timeline = None
    if tl_name:
        for i in range(1, int(project.GetTimelineCount() or 0) + 1):
            tl = project.GetTimelineByIndex(i)
            if tl and (tl.GetName() or "").strip() == tl_name:
                timeline = tl
                break
    else:
        timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen timeline.")
        return

    fps = float(timeline.GetSetting("timelineFrameRate") or 25.0)
    tl_start = int(timeline.GetStartFrame() or 0)
    want_markers = str(params.get("markers", "")).lower() in ("true", "1", "yes")

    # Timeline-indeks: klipp-identitet → tidligste posisjon (absolutte frames)
    pos: dict[str, int] = {}
    for kind in ("video", "audio"):
        for t in range(1, (timeline.GetTrackCount(kind) or 0) + 1):
            for it in timeline.GetItemListInTrack(kind, t) or []:
                try:
                    mpi = it.GetMediaPoolItem()
                except Exception:
                    mpi = None
                if not mpi:
                    continue
                uid, fpath = _identity(mpi)
                start = int(it.GetStart() or 0)
                for key in (uid, fpath):
                    if key and (key not in pos or start < pos[key]):
                        pos[key] = start

    # Finn dag-bins
    bin_names = [b.strip() for b in (params.get("bins") or "Dag 1,Dag 2").split(",") if b.strip()]
    target = (params.get("target") or "UBRUKT").strip()
    root = conn.media_pool.GetRootFolder()
    found: dict = {}

    def walk(folder):
        name = (folder.GetName() or "").strip()
        for w in bin_names:
            if w not in found and w.lower() in name.lower():
                found[w] = folder
        for sub in folder.GetSubFolderList() or []:
            walk(sub)

    walk(root)

    report = {"timeline": timeline.GetName(), "fps": fps, "markers": want_markers and not dry_run,
              "bins": [], "dryRun": dry_run}
    marker_groups: dict[int, list[str]] = {}

    for wanted, folder in found.items():
        ubrukt = next((s for s in folder.GetSubFolderList() or []
                       if (s.GetName() or "").strip().upper() == target.upper()), None)
        entry = {"bin": folder.GetName(), "cameras": [], "hints": 0, "noAnchor": 0}
        if not ubrukt:
            entry["note"] = f"Ingen «{target}»-bin — kjør kategorisering først."
            report["bins"].append(entry)
            continue
        day_cams = {(s.GetName() or "").strip(): s for s in folder.GetSubFolderList() or []
                    if (s.GetName() or "").strip().upper() != target.upper()}
        for ucam in ubrukt.GetSubFolderList() or []:
            cam_name = (ucam.GetName() or "").strip()
            unused_clips = ucam.GetClipList() or []
            used_clips = (day_cams.get(cam_name).GetClipList() or []) if day_cams.get(cam_name) else []
            # samlet opptaks-rekkefølge (naturlig filnavn-sort)
            merged = [(c, False) for c in unused_clips] + [(c, True) for c in used_clips]
            merged.sort(key=lambda cu: _natural_key(cu[0].GetName() or ""))
            # posisjon i timeline for brukte
            used_pos: list[tuple[int, str, int | None]] = []  # (idx, navn, tl-frames)
            for idx, (c, is_used) in enumerate(merged):
                if is_used:
                    uid, fpath = _identity(c)
                    p = pos.get(uid) or (pos.get(fpath) if fpath else None)
                    used_pos.append((idx, c.GetName() or "?", p))
            cam_entry = {"camera": cam_name, "unused": []}
            for idx, (c, is_used) in enumerate(merged):
                if is_used:
                    continue
                prev = next((u for u in reversed(used_pos) if u[0] < idx and u[2] is not None), None)
                nxt = next((u for u in used_pos if u[0] > idx and u[2] is not None), None)
                anchor = prev or nxt
                hint = {
                    "clip": c.GetName() or "?",
                    "prevUsed": {"name": prev[1], "tc": _frames_to_tc(prev[2], fps)} if prev else None,
                    "nextUsed": {"name": nxt[1], "tc": _frames_to_tc(nxt[2], fps)} if nxt else None,
                    "estTc": _frames_to_tc(anchor[2], fps) if anchor else None,
                }
                cam_entry["unused"].append(hint)
                if anchor:
                    entry["hints"] += 1
                    if want_markers:
                        marker_groups.setdefault(anchor[2], []).append(c.GetName() or "?")
                else:
                    entry["noAnchor"] += 1
            # sorter på hvor de hører hjemme
            cam_entry["unused"].sort(key=lambda h: h["estTc"] or "99")
            if cam_entry["unused"]:
                entry["cameras"].append(cam_entry)
        report["bins"].append(entry)

    if want_markers and not dry_run and marker_groups:
        added = 0
        for abs_frame, names in marker_groups.items():
            rel = max(0, abs_frame - tl_start)
            note = "Ubrukte klipp som hører hjemme her:\n" + "\n".join(sorted(names)[:20])
            label = f"UBRUKT ({len(names)})"
            try:
                if timeline.AddMarker(rel, "Blue", label, note, 1):
                    added += 1
            except Exception:
                pass
        report["markersAdded"] = added

    bridge.result(report)


if __name__ == "__main__":
    bridge.main_guard(run)

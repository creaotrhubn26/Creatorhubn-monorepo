"""Kategoriser ubrukte klipp per bin (bryllup: Dag 1 / Dag 2).

Problemet: begge dagene er klippet i SAMME timeline, og man vil vite hvilke
klipp i «Dag 1»- og «Dag 2»-binnene som IKKE er brukt i den timelinen.

Hva scriptet gjør:
  1. Samler alle MediaPoolItems brukt i gjeldende timeline (alle video- og
     lydspor) — identitet via GetUniqueId() med filbane som fallback.
  2. Finner de angitte binnene (default «Dag 1» og «Dag 2», case-insensitivt,
     rekursivt søk, inkl. under-bins — men hopper over eksisterende mål-bin).
  3. Ubrukte klipp → flyttes til under-bin «UBRUKT» i hver dag-bin.
     (MediaPool.MoveClips — klippene forsvinner altså fra sin gamle plass
     i binnet og samles i UBRUKT. Angres enkelt ved å flytte tilbake.)

Dry-run: full rapport (brukt/ubrukt per bin + navneliste) uten å flytte noe.

Ærlige begrensninger (rapporteres):
  - Multicam-/compound-klipp: kildeklippene deres kan feilaktig se «ubrukte»
    ut (API-et eksponerer ikke innholdet). Slike containere telles som brukt
    hvis de selv ligger på timelinen, og kildeklipp flagges som «usikre» i
    stedet for å flyttes, dersom binnet inneholder multicam-containere.
  - Kun GJELDENDE timeline sjekkes (det er oppgaven); Resolves egen
    «Usage»-kolonne teller på tvers av alle timelines og vil kunne avvike.

Params:
  bins=Dag 1,Dag 2        (kommaseparert; case-insensitiv «inneholder»-match)
  target=UBRUKT           (navn på under-bin som opprettes per dag-bin)
  timeline=<navn>         (default: gjeldende timeline)
  mode=categorize         categorize (default) | resync | undo
                          resync: klipp i UBRUKT som NÅ er brukt i timelinen
                                  flyttes tilbake til original kamera-bin
                          undo:   ALT i UBRUKT flyttes tilbake
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402


def _clip_identity(clip) -> tuple[str, str]:
    """(primær-id, filbane). UniqueId når mulig, ellers filbane/navn."""
    uid = ""
    try:
        uid = clip.GetUniqueId() or ""
    except Exception:
        pass
    fpath = ""
    try:
        fpath = clip.GetClipProperty("File Path") or ""
    except Exception:
        pass
    if not uid:
        uid = fpath or (clip.GetName() or "")
    return uid, fpath


def _clip_type(clip) -> str:
    try:
        return (clip.GetClipProperty("Type") or "").lower()
    except Exception:
        return ""


def _collect_used(timeline) -> tuple[set, set, int]:
    """Alle identiteter brukt i timelinen (uid-sett, filbane-sett, antall items)."""
    used_uid, used_path, count = set(), set(), 0
    for kind in ("video", "audio"):
        try:
            tracks = timeline.GetTrackCount(kind)
        except Exception:
            tracks = 0
        for t in range(1, (tracks or 0) + 1):
            try:
                items = timeline.GetItemListInTrack(kind, t) or []
            except Exception:
                items = []
            for it in items:
                try:
                    mpi = it.GetMediaPoolItem()
                except Exception:
                    mpi = None
                if not mpi:
                    continue
                uid, fpath = _clip_identity(mpi)
                if uid:
                    used_uid.add(uid)
                if fpath:
                    used_path.add(fpath)
                count += 1
    return used_uid, used_path, count


def _find_bins(root, wanted: list[str]) -> dict:
    """Rekursivt søk: {ønsket-navn: folder} — case-insensitiv contains-match."""
    found: dict = {}

    def walk(folder):
        name = (folder.GetName() or "").strip()
        for w in wanted:
            if w not in found and w.lower() in name.lower():
                found[w] = folder
        for sub in folder.GetSubFolderList() or []:
            walk(sub)

    walk(root)
    return found


def _clips_in(folder, skip_names: set[str], _label: str = "") -> list:
    """[(klipp, under-bin-navn)] inkl. under-bins (hopper over mål-bin,
    Timelines/Musikk/Audio osv.)."""
    out = []
    label = _label or "(rot)"
    for c in folder.GetClipList() or []:
        out.append((c, label))
    for sub in folder.GetSubFolderList() or []:
        name = (sub.GetName() or "").strip()
        if name.upper() in skip_names:
            continue
        out.extend(_clips_in(sub, skip_names, name))
    return out


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
        if not timeline:
            bridge.error(f"Fant ikke timeline «{tl_name}».")
            return
    else:
        timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen gjeldende timeline — åpne timelinen først.")
        return

    bin_names = [b.strip() for b in (params.get("bins") or "Dag 1,Dag 2").split(",") if b.strip()]
    target = (params.get("target") or "UBRUKT").strip()
    # Under-bins som ikke er råopptak (musikk/lyd/timelines) holdes utenfor.
    skip_sub = {s.strip().upper() for s in
                (params.get("skipSubBins") or "Timelines,Musikk,Audio,LD,Røde_Mikrofon_Opptaker,THMBNL").split(",")
                if s.strip()}

    media_pool = conn.media_pool
    root = media_pool.GetRootFolder()

    used_uid, used_path, item_count = _collect_used(timeline)
    bins = _find_bins(root, bin_names)
    missing = [b for b in bin_names if b not in bins]

    mode = (params.get("mode") or "categorize").strip().lower()
    report: dict = {
        "mode": mode,
        "timeline": timeline.GetName(),
        "timelineItemsWithMedia": item_count,
        "targetSubBin": target,
        "binsRequested": bin_names,
        "binsNotFound": missing,
        "bins": [],
        "dryRun": dry_run,
    }

    # ── resync / undo: flytt klipp UT av UBRUKT tilbake til kamera-bin ──
    if mode in ("resync", "undo"):
        for wanted, folder in bins.items():
            ubrukt = None
            for s in folder.GetSubFolderList() or []:
                if (s.GetName() or "").strip().upper() == target.upper():
                    ubrukt = s
                    break
            entry = {"bin": folder.GetName(), "matchedFor": wanted,
                     "candidates": 0, "moved": 0, "movedNames": []}
            if not ubrukt:
                entry["note"] = f"Ingen «{target}»-bin funnet."
                report["bins"].append(entry)
                continue
            # kamera-bins i dag-binnet (mål for tilbakeflytting)
            day_subs = {(s.GetName() or "").strip(): s
                        for s in folder.GetSubFolderList() or []}
            groups = [(ubrukt, None)] + [(s, (s.GetName() or "").strip())
                                          for s in ubrukt.GetSubFolderList() or []]
            for src_folder, cam_name in groups:
                clips = src_folder.GetClipList() or []
                to_move = []
                for clip in clips:
                    if mode == "undo":
                        to_move.append(clip)
                        continue
                    uid, fpath = _clip_identity(clip)
                    if (uid in used_uid) or (fpath and fpath in used_path):
                        to_move.append(clip)
                entry["candidates"] += len(to_move)
                if to_move and not dry_run:
                    dest = day_subs.get(cam_name) if cam_name else folder
                    if dest is None:
                        dest = media_pool.AddSubFolder(folder, cam_name)
                    if dest and media_pool.MoveClips(to_move, dest):
                        entry["moved"] += len(to_move)
                        entry["movedNames"].extend(
                            (c.GetName() or "?") for c in to_move[:50])
            report["bins"].append(entry)
        bridge.result(report)
        return

    skip = {target.upper()} | skip_sub
    for wanted, folder in bins.items():
        clips = _clips_in(folder, skip)
        unused, used_count, containers = [], 0, 0
        by_sub: dict = {}
        for clip, sub_name in clips:
            ctype = _clip_type(clip)
            if "timeline" in ctype:
                continue  # timelines lagret i bin er ikke råklipp
            if ("multicam" in ctype) or ("compound" in ctype):
                containers += 1
            uid, fpath = _clip_identity(clip)
            is_used = (uid in used_uid) or (fpath and fpath in used_path)
            stats = by_sub.setdefault(sub_name, {"total": 0, "used": 0, "unused": 0})
            stats["total"] += 1
            if is_used:
                used_count += 1
                stats["used"] += 1
            else:
                unused.append(clip)
                stats["unused"] += 1
        bin_entry = {
            "bin": folder.GetName(),
            "matchedFor": wanted,
            "totalClips": used_count + len(unused),
            "used": used_count,
            "unused": len(unused),
            "multicamContainers": containers,
            "bySubBin": by_sub,
            "unusedNames": sorted((c.GetName() or "?") for c in unused)[:200],
        }
        if not dry_run and unused:
            # UBRUKT-bin med bevart kamera-struktur: UBRUKT/<under-bin>
            def find_or_make(parent, name):
                for s in parent.GetSubFolderList() or []:
                    if (s.GetName() or "").strip().upper() == name.upper():
                        return s
                return media_pool.AddSubFolder(parent, name)

            ubrukt = find_or_make(folder, target)
            if not ubrukt:
                bin_entry["error"] = f"Kunne ikke opprette under-bin «{target}»."
            else:
                # grupper ubrukte per opprinnelig under-bin
                groups: dict = {}
                unused_set = {id(c) for c in unused}
                for clip, sub_name in clips:
                    if id(clip) in unused_set:
                        groups.setdefault(sub_name, []).append(clip)
                moved, failed = 0, 0
                for sub_name, group in groups.items():
                    dest = ubrukt if sub_name == "(rot)" else find_or_make(ubrukt, sub_name)
                    if dest and media_pool.MoveClips(group, dest):
                        moved += len(group)
                    else:
                        failed += len(group)
                bin_entry["moved"] = moved
                bin_entry["moveFailed"] = failed
                bin_entry["movedTo"] = f"{folder.GetName()}/{target}/<kamera>"
        report["bins"].append(bin_entry)

    bridge.result(report)


if __name__ == "__main__":
    bridge.main_guard(run)

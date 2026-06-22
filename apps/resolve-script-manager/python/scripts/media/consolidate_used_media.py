"""Portabel consolidate ('collect used media') — Resolves innebygde Media Management feiler stille på
relink i multi-timeline-prosjekter. Vi bygger vår egen: finn klipp som FAKTISK brukes på tvers av alle
timelines (where-used: GetMediaPoolItem per track-item), kopier kildefilene inn i én mappe (shutil.copy2,
behold filnavn, suffix ved kollisjon) og ReplaceClip hvert pool-klipp til den nye kopien → prosjektet peker
på den portable mappa (flytt mappa til annen disk/maskin, lenkene følger med).
Params: mode ("scan"|"apply"), destFolder (kun apply). mode="apply" honorerer dry_run (rapporterer planlagte
kopier, kopierer ingenting). Emitterer progress under kopiering."""
from __future__ import annotations
import os, sys, shutil
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _walk(folder, acc):
    """Samle alle MediaPoolItems rekursivt fra rot-folder + undermapper."""
    for it in (folder.GetClipList() or []):
        acc.append(it)
    for s in (folder.GetSubFolderList() or []):
        _walk(s, acc)


def _used_item_ids(proj):
    """Where-used: gå gjennom alle timelines, samle id(MediaPoolItem) for hvert track-item.
    Returnerer set av Python-objekt-id-er (stabil innen én prosess) for de pool-klippene som brukes."""
    used = set()
    count = proj.GetTimelineCount() or 0
    for ti in range(1, count + 1):
        tl = proj.GetTimelineByIndex(ti)
        if not tl:
            continue
        for track_type in ("video", "audio", "subtitle"):
            try:
                ntracks = int(tl.GetTrackCount(track_type) or 0)
            except Exception:
                ntracks = 0
            for trk in range(1, ntracks + 1):
                for it in (tl.GetItemListInTrack(track_type, trk) or []):
                    try:
                        mp_item = it.GetMediaPoolItem()
                    except Exception:
                        mp_item = None
                    if mp_item is not None:
                        used.add(id(mp_item))
    return used


def _safe_int(val):
    try:
        return int(str(val).strip())
    except (TypeError, ValueError):
        return 0


def _file_bytes(path):
    try:
        return os.path.getsize(path) if path and os.path.isfile(path) else 0
    except OSError:
        return 0


def _collect_used(proj):
    """Returner liste av (mpItem, filePath, name, bytes) for pool-klipp som brukes i ≥1 timeline
    og har en File Path (hopper over generatorer/compound uten kilde-fil)."""
    mp = proj.GetMediaPool()
    all_items = []
    _walk(mp.GetRootFolder(), all_items)
    used_ids = _used_item_ids(proj)
    used = []
    seen_paths = set()  # dedup på filsti — flere pool-klipp kan peke samme fil
    for it in all_items:
        if id(it) not in used_ids:
            continue
        cp = it.GetClipProperty() or {}
        fp = cp.get("File Path", "") or ""
        if not fp:
            continue  # generator/compound/timeline uten kilde-fil
        name = it.GetName() or os.path.basename(fp)
        nbytes = _file_bytes(fp)
        used.append({"item": it, "path": fp, "name": name, "bytes": nbytes})
        seen_paths.add(fp)
    return used, len(all_items)


def _unique_dest(dest_folder, basename, planned):
    """Returner kollisjonsfri destinasjon i dest_folder. `planned` = sett av allerede planlagte
    basenavn (lower) i denne kjøringen — så to ulike kilder med samme navn ikke overskriver hverandre."""
    root, ext = os.path.splitext(basename)
    candidate = basename
    n = 1
    while candidate.lower() in planned or os.path.exists(os.path.join(dest_folder, candidate)):
        candidate = f"{root}_{n}{ext}"
        n += 1
    planned.add(candidate.lower())
    return os.path.join(dest_folder, candidate)


def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "scan").lower()
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    proj = conn.project

    used, total_count = _collect_used(proj)
    used_count = len(used)

    if mode == "scan":
        total_bytes = sum(u["bytes"] for u in used)
        # samme fil kan brukes av flere pool-klipp; for portabel-størrelse teller unike kilde-filer
        by_path = {}
        for u in used:
            by_path.setdefault(u["path"], u["bytes"])
        unique_bytes = sum(by_path.values())
        gb = unique_bytes / (2 ** 30)
        items = [{"name": u["name"], "path": u["path"], "bytes": u["bytes"]} for u in used]
        bridge.result({
            "mode": "scan",
            "usedCount": used_count,
            "totalCount": total_count,
            "totalBytesEstimate": unique_bytes,
            "uniqueSourceFiles": len(by_path),
            "items": items,
            "note": (
                f"{used_count} av {total_count} pool-klipp brukes på tvers av timelines "
                f"({len(by_path)} unike kildefiler, ~{gb:.1f} GB). "
                "Velg en mål-mappe og kjør 'Gjør portabel' for å samle alt der og re-lenke prosjektet."
                if used_count else
                "Ingen brukte klipp med kilde-fil funnet (tomme timelines, eller kun generatorer/compound)."
            ),
        })
        return

    # mode == "apply": kopier brukte kildefiler til destFolder + ReplaceClip
    dest_folder = (params.get("destFolder") or "").strip()
    if not dest_folder:
        bridge.error("destFolder mangler — angi en mål-mappe for den portable kopien.")
        sys.exit(1)
    dest_folder = os.path.abspath(os.path.expanduser(dest_folder))

    if not used_count:
        bridge.result({
            "mode": "apply", "copied": 0, "relinked": 0, "failed": 0,
            "destFolder": dest_folder, "bytesCopied": 0,
            "note": "Ingen brukte klipp å samle — ingenting gjort.",
        })
        return

    # plan: én kopi per unik kildefil; flere pool-klipp på samme fil re-lenkes til samme kopi
    by_path = {}  # original path -> {dest, items:[mpItem], bytes}
    planned_names: set = set()
    for u in used:
        entry = by_path.get(u["path"])
        if entry is None:
            base = os.path.basename(u["path"])
            entry = {"dest": _unique_dest(dest_folder, base, planned_names),
                     "items": [], "bytes": u["bytes"], "exists": os.path.isfile(u["path"])}
            by_path[u["path"]] = entry
        entry["items"].append(u["item"])

    total_files = len(by_path)
    plan_bytes = sum(e["bytes"] for e in by_path.values())

    if dry_run:
        copies = [{"from": src, "to": e["dest"], "bytes": e["bytes"], "exists": e["exists"],
                   "poolClips": len(e["items"])} for src, e in by_path.items()]
        bridge.result({
            "mode": "apply", "dryRun": True, "destFolder": dest_folder,
            "plannedCopies": total_files, "plannedRelinks": used_count,
            "bytesToCopy": plan_bytes, "copies": copies,
            "note": (f"DRY-RUN: ville kopiert {total_files} kildefiler (~{plan_bytes / (2 ** 30):.1f} GB) "
                     f"til {dest_folder} og re-lenket {used_count} pool-klipp. Ingenting endret."),
        })
        return

    # diskplass-sjekk: trenger plass for alle filer som faktisk finnes på disk
    need_gb = plan_bytes / (2 ** 30)
    try:
        os.makedirs(dest_folder, exist_ok=True)
    except OSError as exc:
        bridge.error(f"Kunne ikke opprette mål-mappe {dest_folder}: {exc}")
        sys.exit(1)
    if not bridge.check_disk_space(dest_folder, required_gb=max(need_gb * 1.05, 0.5)):
        sys.exit(1)

    copied = 0
    relinked = 0
    failed = 0
    failed_paths: list[str] = []
    bytes_copied = 0
    i = 0
    for src, entry in by_path.items():
        i += 1
        dest = entry["dest"]
        bridge.progress(i, total_files, f"Kopierer {os.path.basename(src)} ({i}/{total_files})")
        # 1) kopier kildefil
        if not os.path.isfile(src):
            failed += 1
            failed_paths.append(src)
            continue
        try:
            if os.path.abspath(src) != os.path.abspath(dest):
                shutil.copy2(src, dest)
            copied += 1
            bytes_copied += _file_bytes(dest)
        except (OSError, shutil.Error) as exc:
            bridge.warn(f"Kopiering feilet for {src}: {exc}")
            failed += 1
            failed_paths.append(src)
            continue
        # 2) re-lenk alle pool-klipp som peker denne kilden → kopien
        for mp_item in entry["items"]:
            try:
                if mp_item.ReplaceClip(dest):
                    relinked += 1
                else:
                    failed_paths.append(f"{src} (ReplaceClip=False)")
            except Exception as exc:  # noqa: BLE001
                bridge.warn(f"ReplaceClip feilet for {src}: {exc}")
                failed_paths.append(f"{src} (ReplaceClip-exception)")

    bridge.result({
        "mode": "apply",
        "copied": copied,
        "relinked": relinked,
        "failed": failed,
        "destFolder": dest_folder,
        "bytesCopied": bytes_copied,
        "failedPaths": failed_paths[:15],
        "note": (
            f"Portabel kopi klar: kopierte {copied}/{total_files} kildefiler "
            f"(~{bytes_copied / (2 ** 30):.1f} GB) til {dest_folder} og re-lenket {relinked} pool-klipp. "
            + (f"{failed} fil(er) feilet (offline kilde?) — se failedPaths. " if failed else "")
            + "Lagre prosjektet; mappa kan nå flyttes til annen disk/maskin med lenkene intakt."
        ),
    })


if __name__ == "__main__":
    bridge.main_guard(run)

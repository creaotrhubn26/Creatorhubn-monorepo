"""Finn dupliserte klipp i Media Pool — Resolve har ingen innebygd dedupe. mode="scan" (read-only):
gå rekursivt gjennom hele media-poolen, grupper media-pool-items som peker på SAMME 'File Path'
(hard duplikat), og rapporter i tillegg samme-basenavn-ulik-sti som en mykere advarsel.
Returnerer {totalClips, duplicateGroups:[{path,count,binLocations,names}], sameNameDiffPath:[...]}.
Sletter INGENTING — sletting er en framtidig UI-handling. Params: mode (default "scan")."""
from __future__ import annotations
import os, sys
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _walk(folder, parent_path, acc):
    """Samle (item, bin-sti) rekursivt. bin-sti = 'Master/Bin/Subbin' for UX-lokalisering."""
    name = ""
    try:
        name = folder.GetName() or ""
    except Exception:
        name = ""
    here = f"{parent_path}/{name}" if parent_path else name
    for it in (folder.GetClipList() or []):
        acc.append((it, here))
    for s in (folder.GetSubFolderList() or []):
        _walk(s, here, acc)


def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "scan").lower()
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    mp = conn.project.GetMediaPool()
    if not mp:
        bridge.error("Fant ingen Media Pool i aktivt prosjekt")
        sys.exit(1)

    items: list = []
    _walk(mp.GetRootFolder(), "", items)
    total = len(items)

    # Grupper per File Path (hard duplikat) + per basenavn (myk advarsel).
    by_path: dict[str, dict] = {}
    by_base: dict[str, list] = {}
    skipped = 0
    for idx, (it, bin_path) in enumerate(items):
        try:
            cp = it.GetClipProperty() or {}
        except Exception:
            cp = {}
        fp = (cp.get("File Path") or "").strip()
        try:
            nm = it.GetName() or ""
        except Exception:
            nm = ""
        if not fp:
            # Timelines, compound clips, generators osv. har ingen fil — hopp over.
            skipped += 1
        else:
            g = by_path.setdefault(fp, {"path": fp, "names": [], "binLocations": []})
            g["names"].append(nm or os.path.basename(fp))
            g["binLocations"].append(bin_path)
            base = os.path.basename(fp).lower()
            by_base.setdefault(base, []).append({"path": fp, "name": nm, "bin": bin_path})
        if total:
            bridge.progress(idx + 1, total, f"Skanner media-pool ({len(by_path)} unike stier)")

    # Hard duplikater = samme File Path brukt av >1 media-pool-item.
    duplicate_groups = []
    redundant_entries = 0
    for fp, g in by_path.items():
        count = len(g["names"])
        if count > 1:
            redundant_entries += count - 1
            duplicate_groups.append({
                "path": fp,
                "count": count,
                "binLocations": g["binLocations"],
                "names": g["names"],
            })
    duplicate_groups.sort(key=lambda d: d["count"], reverse=True)

    # Myk advarsel: samme basenavn, men ulike fulle stier (ofte kopi på annen disk).
    same_name_diff_path = []
    for base, entries in by_base.items():
        distinct_paths = sorted({e["path"] for e in entries})
        if len(distinct_paths) > 1:
            same_name_diff_path.append({
                "basename": os.path.basename(distinct_paths[0]),
                "paths": distinct_paths,
                "count": len(distinct_paths),
            })
    same_name_diff_path.sort(key=lambda d: d["count"], reverse=True)

    if duplicate_groups:
        note = (
            f"Fant {len(duplicate_groups)} duplikat-gruppe(r) — {redundant_entries} "
            f"redundante media-pool-oppføringer peker på samme fil. "
            "Disse kan trygt fjernes (samme kilde refereres flere ganger). Ingenting er slettet."
        )
    elif same_name_diff_path:
        note = (
            "Ingen harde duplikater (samme filsti), men "
            f"{len(same_name_diff_path)} filnavn finnes på flere ulike stier — "
            "kan være kopier på ulike disker. Sjekk manuelt. Ingenting er slettet."
        )
    else:
        note = "Ingen dupliserte klipp funnet — hver fil refereres bare én gang i media-poolen."
    if same_name_diff_path and duplicate_groups:
        note += f" I tillegg: {len(same_name_diff_path)} filnavn på flere stier (mulige disk-kopier)."

    bridge.result({
        "mode": "scan",
        "totalClips": total,
        "withoutFilePath": skipped,
        "uniquePaths": len(by_path),
        "duplicateGroups": duplicate_groups,
        "redundantEntries": redundant_entries,
        "sameNameDiffPath": same_name_diff_path,
        "note": note,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

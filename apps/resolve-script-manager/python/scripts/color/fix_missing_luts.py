"""Missing-LUT-løser. mode="scan": finn klipp-noder som refererer en LUT-fil som IKKE finnes i
Resolves LUT-søkemapper (= 'Missing LUT'), grupper per LUT-navn, og SØK på disk etter matchende
.cube (LUT-mapper, Downloads, Movies, Volumes). mode="fix": kopier funnet fil inn i bruker-LUT-mappa
(bevar undermappe), RefreshLUTList, og re-pek nodene (SetLUT). Params: mode, lutRef, sourcePath, dryRun."""
from __future__ import annotations
import os, sys, glob, shutil, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

LUT_DIRS = [
    "/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT",
    os.path.expanduser("~/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT"),
    "/Library/Application Support/Blackmagic Design/DaVinci Resolve Studio/LUT",
]
# Søk KUN i små mapper (LUT-mapper + Downloads/Desktop) — ALDRI rekursiv glob over /Volumes (4TB = henger).
SEARCH_DIRS = [os.path.expanduser("~/Downloads"), os.path.expanduser("~/Desktop")]

# bygg basenavn-indeks over LUT-mappene én gang (de er små) → robust mot mappe-navn-mismatch
_LUT_INDEX = None
def _lut_index():
    global _LUT_INDEX
    if _LUT_INDEX is None:
        _LUT_INDEX = {}
        for d in LUT_DIRS:
            if not os.path.isdir(d): continue
            for root, _dirs, files in os.walk(d):
                for f in files:
                    if f.lower().endswith(".cube"):
                        _LUT_INDEX.setdefault(f.lower(), os.path.join(root, f))
    return _LUT_INDEX

def _exists_in_lutdirs(relpath):
    # Resolve slår opp LUT-er på EKSAKT relativ sti under LUT-mappene — så her må vi
    # matche eksakt (ikke basenavn). En fil med samme navn i en ANNEN mappe regnes IKKE
    # som present (Resolve viser «Missing LUT» selv om basenavnet finnes et annet sted).
    if os.path.isabs(relpath) and os.path.isfile(relpath): return relpath
    for d in LUT_DIRS:
        if os.path.isfile(os.path.join(d, relpath)): return os.path.join(d, relpath)
    return None

def _basename_elsewhere(relpath):
    # Brukes KUN som fiks-kilde: finnes basenavnet et sted i LUT-mappene (feil mappe-navn)?
    return _lut_index().get(os.path.basename(relpath).lower())

def _find_on_disk(basename, limit=8):
    hits = []
    # 1) Spotlight (raskt, hele disken indeksert)
    try:
        out = subprocess.run(["mdfind", "-name", basename], capture_output=True, text=True, timeout=15).stdout
        for line in out.splitlines():
            if os.path.basename(line) == basename and os.path.isfile(line) and line not in hits:
                hits.append(line)
                if len(hits) >= limit: return hits
    except Exception: pass
    # 2) grunne søk i LUT-mapper + Downloads/Desktop
    for root in LUT_DIRS + SEARCH_DIRS:
        if not os.path.isdir(root): continue
        for p in glob.glob(os.path.join(root, "**", basename), recursive=True):
            if os.path.isfile(p) and p not in hits:
                hits.append(p)
                if len(hits) >= limit: return hits
    return hits

def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "scan").lower()
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project(): sys.exit(1)
    res = conn.resolve; proj = conn.project; tl = proj.GetCurrentTimeline()
    if not tl: bridge.error("Ingen timeline"); sys.exit(1)

    # samle alle node-LUT-referanser per klipp
    refs = {}  # relpath -> {"clips":[(trackItem,node)], "count":int}
    for trk in range(1, int(tl.GetTrackCount("video"))+1):
        for it in (tl.GetItemListInTrack("video", trk) or []):
            try: nnodes = it.GetNumNodes() or 1
            except Exception: nnodes = 1
            for ni in range(1, nnodes+1):
                try: l = it.GetLUT(ni)
                except Exception: l = None
                if l:
                    refs.setdefault(l, {"clips": [], "count": 0})
                    refs[l]["clips"].append((it, ni)); refs[l]["count"] += 1

    if mode == "scan":
        missing = []; present = 0
        for rel, d in refs.items():
            found_path = _exists_in_lutdirs(rel)
            if found_path:
                present += 1; continue
            base = os.path.basename(rel)
            # wrong_folder = samme fil finnes i en ANNEN LUT-mappe (Resolve sier likevel «missing»
            # fordi den eksakte relative stien ikke finnes) → den vanligste, og helt auto-fiksbar.
            wrong = _basename_elsewhere(rel)
            cands = ([wrong] if wrong else []) + [c for c in _find_on_disk(base) if c != wrong]
            missing.append({"lut": rel, "name": base, "clipCount": d["count"],
                            "cause": "wrong_folder" if wrong else "not_found",
                            "foundAt": cands, "autoFixable": bool(cands)})
        bridge.result({"timeline": tl.GetName(), "referencedLuts": len(refs), "presentLuts": present,
                       "missing": missing, "foundMissing": len(missing),
                       "note": (f"⚠️ {len(missing)} LUT(er) mangler — " +
                                ("alle funnet på disk, klar til å fikses." if missing and all(m["autoFixable"] for m in missing)
                                 else "noen ikke funnet, velg fil i UX." if missing else "")
                                if missing else "Ingen manglende LUT-er — alle referanser finnes.")})
        return

    # mode == fix
    rel = (params.get("lutRef") or "").strip()
    srcpath = (params.get("sourcePath") or "").strip()
    if rel not in refs: bridge.error(f"LUT-ref '{rel}' brukes ikke i timelinen"); sys.exit(1)
    if not srcpath:
        srcpath = _basename_elsewhere(rel) or ""
    if not srcpath:
        c = _find_on_disk(os.path.basename(rel))
        srcpath = c[0] if c else ""
    if not (srcpath and os.path.isfile(srcpath)): bridge.error("Fant ikke kilde-LUT-fil"); sys.exit(1)
    # Kopier til den EKSAKTE relative stien Resolve leter etter, i en LUT-rot Resolve faktisk
    # skanner: helst roten kilde-fila allerede ligger i (garantert skannet), ellers første skrivbare.
    dest_root = None
    for dlut in LUT_DIRS:
        if os.path.isdir(dlut) and os.path.abspath(srcpath).startswith(os.path.abspath(dlut) + os.sep):
            dest_root = dlut; break
    if not dest_root:
        for dlut in LUT_DIRS:
            if os.path.isdir(dlut) and os.access(dlut, os.W_OK): dest_root = dlut; break
    dest_root = dest_root or LUT_DIRS[1]
    dest = os.path.join(dest_root, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.abspath(srcpath) != os.path.abspath(dest):
        shutil.copy2(srcpath, dest)
    # refresh + re-pek noder
    try: res.RefreshLUTList()
    except Exception:
        try: proj.RefreshLUTList()
        except Exception: pass
    fixed = 0
    for it, ni in refs[rel]["clips"]:
        try:
            if it.SetLUT(ni, rel): fixed += 1
        except Exception: pass
    bridge.result({"mode": "fix", "lut": rel, "copiedTo": dest, "reapplied": fixed,
                   "note": f"La LUT på eksakt sti ({dest}) + re-pekte {fixed} node(r). Missing-LUT skal være borte."})

if __name__ == "__main__":
    bridge.main_guard(run)

"""Manglende media / relink-løser — bedre enn Resolves innebygde. mode="scan": finn OFFLINE klipp
i media-pool (filsti finnes ikke), søk på disk via Spotlight (mdfind, raskt — ikke rekursiv glob).
mode="relink": ReplaceClip per item (pålitelig; RelinkClips returnerer ofte False).
Params: mode, relinks (liste [{oldPath,newPath}]), auto (bool: relink alle m/ ett treff), searchRoots."""
from __future__ import annotations
import os, sys, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

def _mdfind(basename, limit=8):
    hits = []
    try:
        out = subprocess.run(["mdfind", "-name", basename], capture_output=True, text=True, timeout=20).stdout
        for line in out.splitlines():
            if os.path.basename(line) == basename and os.path.isfile(line):
                hits.append(line)
                if len(hits) >= limit: break
    except Exception:
        pass
    return hits

def _find_fallback(basename, roots, limit=8):
    hits = []
    for r in roots:
        if not os.path.isdir(r): continue
        try:
            out = subprocess.run(["find", r, "-name", basename, "-type", "f"],
                                 capture_output=True, text=True, timeout=40).stdout
            for line in out.splitlines():
                if os.path.isfile(line) and line not in hits:
                    hits.append(line)
                    if len(hits) >= limit: return hits
        except Exception:
            continue
    return hits

def _walk(folder, acc):
    for it in (folder.GetClipList() or []):
        acc.append(it)
    for s in (folder.GetSubFolderList() or []):
        _walk(s, acc)

def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "scan").lower()
    roots = params.get("searchRoots") or []
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project(): sys.exit(1)
    mp = conn.project.GetMediaPool()
    items = []; _walk(mp.GetRootFolder(), items)
    by_path = {}
    for it in items:
        cp = it.GetClipProperty() or {}
        fp = cp.get("File Path", "")
        if fp: by_path.setdefault(fp, it)

    if mode == "scan":
        offline = []; online = 0; i = 0
        for fp, it in by_path.items():
            i += 1
            if os.path.isfile(fp): online += 1; continue
            base = os.path.basename(fp)
            cands = _mdfind(base) or (_find_fallback(base, roots) if roots else [])
            offline.append({"name": (it.GetName() or base), "oldPath": fp, "foundAt": cands,
                            "autoFixable": len(cands) == 1})
            bridge.progress(i, len(by_path), f"Sjekker media ({len(offline)} offline)")
        bridge.result({"clips": len(by_path), "online": online, "offline": len(offline), "items": offline,
                       "note": (f"⚠️ {len(offline)} offline klipp. " +
                                (f"{sum(1 for o in offline if o['autoFixable'])} har eksakt ett treff (auto-relink), "
                                 f"resten: velg riktig i UX." if offline else "")
                                if offline else "Alle media online — ingenting mangler.")})
        return

    # mode == relink
    relinks = params.get("relinks") or []
    if params.get("auto"):
        # bygg relinks fra scan: alle offline m/ ett treff
        for fp, it in by_path.items():
            if not os.path.isfile(fp):
                c = _mdfind(os.path.basename(fp))
                if len(c) == 1: relinks.append({"oldPath": fp, "newPath": c[0]})
    done = 0; fail = []
    for r in relinks:
        it = by_path.get(r.get("oldPath"))
        np = r.get("newPath")
        if not it or not np or not os.path.isfile(np): fail.append(r.get("oldPath")); continue
        try:
            if it.ReplaceClip(np): done += 1
            else: fail.append(r.get("oldPath"))
        except Exception:
            fail.append(r.get("oldPath"))
    bridge.result({"mode": "relink", "relinked": done, "failed": len(fail), "failedPaths": fail[:10],
                   "note": f"Relinket {done} klipp. " + (f"{len(fail)} feilet (sjekk sti)." if fail else "")})

if __name__ == "__main__":
    bridge.main_guard(run)

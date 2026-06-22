"""Batch root-remap — løser den vanligste offline-årsaken: hele disken byttet bokstav/navn eller flyttet
(E:\\ -> F:\\, /Volumes/Old -> /Volumes/New, eller Mac<->Win-syntaks). Remapper ALLE klipp på én gang i
stedet for å relinke hundrevis enkeltvis. mode="scan": finn offline klipp (File Path ikke på disk), grupper
på lengste felles brutte sti-prefiks, og AUTO-FORESLÅ ett nytt prefiks per gruppe ved å mdfind ett basenavn
og diffe funnet sti mot gammel sti. mode="apply": params {mappings:[{oldPrefix,newPrefix}]} → for hvert klipp
hvis startswith(oldPrefix): newPath = newPrefix + rest (normaliser separatorer), ReplaceClip hvis fila finnes.
Params: mode ("scan"|"apply"), mappings (liste), searchRoots (valgfri find-fallback)."""
from __future__ import annotations
import os, sys, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def _mdfind(basename, limit=8):
    """Spotlight-oppslag på basenavn — raskt, ALDRI rekursiv glob over /Volumes (4TB = henger)."""
    hits = []
    try:
        out = subprocess.run(["mdfind", "-name", basename], capture_output=True, text=True, timeout=20).stdout
        for line in out.splitlines():
            if os.path.basename(line) == basename and os.path.isfile(line) and line not in hits:
                hits.append(line)
                if len(hits) >= limit:
                    break
    except Exception:
        pass
    return hits


def _find_fallback(basename, roots, limit=8):
    """Valgfri find-fallback KUN over caller-oppgitte searchRoots (aldri hele disken)."""
    hits = []
    for r in roots:
        if not os.path.isdir(r):
            continue
        try:
            out = subprocess.run(["find", r, "-name", basename, "-type", "f"],
                                 capture_output=True, text=True, timeout=40).stdout
            for line in out.splitlines():
                if os.path.isfile(line) and line not in hits:
                    hits.append(line)
                    if len(hits) >= limit:
                        return hits
        except Exception:
            continue
    return hits


def _walk(folder, acc):
    for it in (folder.GetClipList() or []):
        acc.append(it)
    for s in (folder.GetSubFolderList() or []):
        _walk(s, acc)


def _split(path):
    """Del en sti i komponenter uavhengig av separator (Mac '/' vs Win '\\')."""
    norm = path.replace("\\", "/")
    return [p for p in norm.split("/") if p != ""]


def _longest_common_prefix(paths):
    """Lengste felles sti-prefiks over en liste stier, komponent-for-komponent (sep-agnostisk).
    Returnerer prefikset i ORIGINAL-form fra første sti (beholder dens separatorer)."""
    if not paths:
        return ""
    parts_lists = [_split(p) for p in paths]
    minlen = min(len(pl) for pl in parts_lists)
    common = 0
    for i in range(minlen):
        seg = parts_lists[0][i]
        if all(pl[i] == seg for pl in parts_lists):
            common += 1
        else:
            break
    if common == 0:
        return ""
    # Gjenskap prefikset i originalform fra første sti (med dens egne separatorer)
    first = paths[0]
    sep = "\\" if ("\\" in first and "/" not in first.replace("\\", "")) else "/"
    if first.startswith("//"):
        head = "//"
    elif first.startswith("/"):
        head = "/"
    else:
        head = ""
    return head + sep.join(_split(first)[:common])


def _derive_prefixes(old_path, found_path):
    """Diff gammel offline-sti mot funnet sti bakfra — felles hale = uendret understi.
    Returnerer (oldPrefix, newPrefix) der old_path = oldPrefix + hale og found_path = newPrefix + hale."""
    old_parts = _split(old_path)
    new_parts = _split(found_path)
    # match bakfra så lenge komponentene er like (case-insensitiv for robusthet Mac/Win)
    tail = 0
    while (tail < len(old_parts) and tail < len(new_parts)
           and old_parts[len(old_parts) - 1 - tail].lower() == new_parts[len(new_parts) - 1 - tail].lower()):
        tail += 1
    if tail == 0:
        return None, None
    old_pref_parts = old_parts[:len(old_parts) - tail]
    new_pref_parts = new_parts[:len(new_parts) - tail]
    old_sep = "\\" if ("\\" in old_path and "/" not in old_path.replace("\\", "")) else "/"
    old_head = "/" if old_path.startswith("/") else ""
    new_head = "/" if found_path.startswith("/") else ""
    old_pref = old_head + old_sep.join(old_pref_parts)
    new_pref = new_head + "/".join(new_pref_parts)
    return old_pref, new_pref


def _remap_path(path, old_prefix, new_prefix):
    """Bytt oldPrefix→newPrefix på en sti, normaliser separatorer i resten til '/' (Mac-target)."""
    rest = path[len(old_prefix):]
    rest = rest.replace("\\", "/")
    base = new_prefix.rstrip("/")
    rest = rest.lstrip("/")
    return base + "/" + rest if rest else base


def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "scan").lower()
    roots = params.get("searchRoots") or []
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    mp = conn.project.GetMediaPool()
    items = []
    _walk(mp.GetRootFolder(), items)

    # Bygg path->item-indeks + finn offline klipp
    by_path = {}
    for it in items:
        try:
            cp = it.GetClipProperty() or {}
        except Exception:
            cp = {}
        fp = cp.get("File Path", "") if isinstance(cp, dict) else ""
        if fp:
            by_path.setdefault(fp, it)
    offline_paths = [fp for fp in by_path if not os.path.isfile(fp)]

    if mode == "scan":
        if not offline_paths:
            bridge.result({"groups": [], "offlineClips": 0, "totalClips": len(by_path),
                           "note": "Alle media online — ingen disk-remap trengs."})
            return

        # Grupper offline stier på lengste felles brutte prefiks.
        # Strategi: gruppér først på rot-volum (første 2 komponenter, f.eks. /Volumes/Old eller E:),
        # deretter beregn LCP per gruppe — det fanger «hele disken flyttet»-tilfellet.
        groups_by_root: dict[str, list[str]] = {}
        for p in offline_paths:
            parts = _split(p)
            if p.startswith("/"):
                root_key = "/" + "/".join(parts[:2]) if len(parts) >= 2 else "/" + (parts[0] if parts else "")
            else:
                root_key = parts[0] if parts else p  # Windows drive eller UNC-rot
            groups_by_root.setdefault(root_key, []).append(p)

        groups = []
        total = len(groups_by_root)
        for gi, (_root, paths) in enumerate(groups_by_root.items(), start=1):
            old_prefix = _longest_common_prefix(paths) or os.path.dirname(paths[0])
            suggested = None
            sample_found = None
            confident = False
            # Auto-foreslå nytt prefiks: mdfind ett basenavn, diff funnet sti mot gammel
            sample_old = paths[0]
            for cand in paths[:5]:  # prøv noen til vi får ett unikt treff
                base = os.path.basename(cand.replace("\\", "/"))
                hits = _mdfind(base) or (_find_fallback(base, roots) if roots else [])
                if len(hits) == 1:
                    op, npref = _derive_prefixes(cand, hits[0])
                    if op and npref and cand.startswith(op):
                        # juster forslaget så det stemmer mot gruppens felles oldPrefix
                        if old_prefix and cand.startswith(old_prefix) and old_prefix != op:
                            # remap-restdelen mellom old_prefix og op er felles → newPrefix for hele gruppen
                            mid = op[len(old_prefix):] if op.startswith(old_prefix) else ""
                            suggested = (npref + ("/" + mid.replace("\\", "/").strip("/") if mid.strip("/") else "")) if mid else npref
                            # forenkle: bruk derive direkte mot gruppens prefiks
                            op2, np2 = _derive_prefixes(cand[:len(old_prefix)] + cand[len(old_prefix):], hits[0])
                            suggested = np2 if np2 else suggested
                            old_prefix = op2 or old_prefix
                        else:
                            old_prefix = op
                            suggested = npref
                        sample_old = cand
                        sample_found = hits[0]
                        confident = True
                        break
            groups.append({
                "oldPrefix": old_prefix,
                "suggestedNewPrefix": suggested,
                "clipCount": len(paths),
                "sampleOld": sample_old,
                "sampleFound": sample_found,
                "confident": confident,
            })
            bridge.progress(gi, total, f"Analyserer disk-grupper ({len(groups)})")

        n_conf = sum(1 for g in groups if g["confident"])
        bridge.result({
            "groups": groups,
            "offlineClips": len(offline_paths),
            "totalClips": len(by_path),
            "note": (f"⚠️ {len(offline_paths)} offline klipp i {len(groups)} disk-gruppe(r). "
                     + (f"{n_conf} gruppe(r) har et trygt auto-forslag (bekreft og kjør 'apply'). "
                        if n_conf else "Fant ingen sikre forslag — fyll inn nytt prefiks manuelt i UX. ")
                     + ("Resten: oppgi newPrefix selv." if n_conf < len(groups) else "")),
        })
        return

    # mode == apply
    mappings = params.get("mappings") or []
    mappings = [m for m in mappings if m.get("oldPrefix") and m.get("newPrefix")]
    if not mappings:
        bridge.error("Ingen gyldige mappings — oppgi {mappings:[{oldPrefix,newPrefix}]}")
        sys.exit(1)
    # lengste oldPrefix først så mest spesifikke mapping vinner
    mappings.sort(key=lambda m: len(m["oldPrefix"]), reverse=True)

    remapped = 0
    failed = 0
    failed_paths = []
    would = []  # for dry-run rapport
    targets = []
    for fp in by_path:
        if not os.path.isfile(fp):  # bare offline klipp er kandidater
            for m in mappings:
                if fp.startswith(m["oldPrefix"]):
                    new_path = _remap_path(fp, m["oldPrefix"], m["newPrefix"])
                    targets.append((fp, new_path))
                    break

    total = len(targets)
    for idx, (fp, new_path) in enumerate(targets, start=1):
        bridge.progress(idx, total, f"Remapper ({remapped} ok, {failed} feil)")
        if not os.path.isfile(new_path):
            failed += 1
            if len(failed_paths) < 10:
                failed_paths.append(fp)
            continue
        if dry_run:
            remapped += 1
            if len(would) < 10:
                would.append({"oldPath": fp, "newPath": new_path})
            continue
        it = by_path.get(fp)
        try:
            if it and it.ReplaceClip(new_path):
                remapped += 1
            else:
                failed += 1
                if len(failed_paths) < 10:
                    failed_paths.append(fp)
        except Exception:
            failed += 1
            if len(failed_paths) < 10:
                failed_paths.append(fp)

    if dry_run:
        bridge.result({
            "mode": "apply", "dryRun": True, "remapped": remapped, "failed": failed,
            "failedPaths": failed_paths[:10], "wouldRemap": would,
            "note": (f"Tørrkjøring: {remapped} klipp VILLE blitt remappet, {failed} har ingen fil på ny sti. "
                     "Kjør uten dry-run for å utføre.")})
        return

    bridge.result({
        "mode": "apply", "remapped": remapped, "failed": failed, "failedPaths": failed_paths[:10],
        "note": (f"Remappet {remapped} klipp via prefiks-bytte. "
                 + (f"{failed} feilet (fila finnes ikke på ny sti — sjekk prefiks)." if failed else "Alle traff."))})


if __name__ == "__main__":
    bridge.main_guard(run)

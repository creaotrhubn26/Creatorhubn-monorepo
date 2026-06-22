"""Offline-diagnose — meta-fiks for «rød offline»-feilen. Én offline-feil har MANGE årsaker; denne
klassifiserer HVER pool-klipp med filsti i nøyaktig én årsak: online / path_missing (fil ikke på disk) /
cloud_placeholder (sky-stub: size==0, st_blocks==0 m/ st_size>0, eller iCloud/fileprovider-attrs) /
codec_or_attr (fil finnes men codec/SDK mangler — BRAW/RED/ARRI/MXF e.l.) / conform_link (best-effort).
Hver klipp får et norsk forslag. Read-only — KUN mode="scan". Params: mode.
"""
from __future__ import annotations
import os, sys, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

# Kamera-/raw-formater som ofte krever egen SDK/decoder i Resolve (Studio) → «offline» selv om filen finnes.
_SDK_EXTS = {".braw", ".r3d", ".ari", ".arx", ".mxf", ".crm", ".cri"}

_SUGGESTIONS = {
    "online": "OK — filen er på disk og lesbar.",
    "path_missing": "Relink/remap sti (fil mangler på disk — flyttet/omdøpt disk).",
    "cloud_placeholder": "Last ned fra sky først (iCloud/Dropbox-stub — Hold alltid på denne enheten).",
    "codec_or_attr": "Installer kamera-SDK / sjekk codec (BRAW/RED/ARRI e.l. eller attributt-mismatch).",
    "conform_link": "Sjekk conform/relink i timeline (pool-klipp online, men timeline-kobling usikker).",
}


def _walk(folder, acc):
    """Rekursiv pool-traversering — samle ALLE klipp (rot + undermapper)."""
    if not folder:
        return
    for it in (folder.GetClipList() or []):
        acc.append(it)
    for s in (folder.GetSubFolderList() or []):
        _walk(s, acc)


def _is_cloud_placeholder(path):
    """Heuristikk for macOS dataless/online-only-stub. True = filen finnes som sti men ikke nedlastet."""
    try:
        st = os.stat(path)
    except OSError:
        return False
    # size==0 men eksisterer = klassisk placeholder
    if st.st_size == 0:
        return True
    # st_blocks==0 m/ st_size>0 = sparse/dataless (APFS sky-stub uten allokerte blokker)
    if getattr(st, "st_blocks", None) == 0 and st.st_size > 0:
        return True
    # mdls-attributter for iCloud/fileprovider/ubiquity (kun de som peker på ikke-nedlastet innhold)
    try:
        out = subprocess.run(
            ["mdls",
             "-name", "com.apple.ubiquity.bytesDownloaded",
             "-name", "kMDItemIsUbiquitousItem",
             "-name", "com.apple.fileprovider.fpfs#downloaded",
             path],
            capture_output=True, text=True, timeout=8,
        ).stdout
        low = out.lower()
        # ubiquitous item som ikke er fullt nedlastet
        if "kmditemisubiquitousitem = 1" in low and "bytesdownloaded = 0" in low:
            return True
    except Exception:
        pass
    return False


def _classify(path, mp_item):
    """Returner én årsak for et pool-klipp gitt filsti + media-pool-item."""
    # 1) Fil ikke på disk = path_missing (sjekk FØR placeholder så vi ikke stat-er ikke-eksisterende)
    if not os.path.isfile(path):
        return "path_missing"
    # 2) Sky-stub (finnes som sti, men data ikke lastet ned)
    if _is_cloud_placeholder(path):
        return "cloud_placeholder"
    # 3) Fil finnes m/ data, men codec/SDK-problem? Heuristikk: raw/MXF-ext, eller tomt Format/codec.
    ext = os.path.splitext(path)[1].lower()
    cp = {}
    try:
        cp = mp_item.GetClipProperty() or {}
    except Exception:
        cp = {}
    fmt = (cp.get("Format") or "").strip()
    vc = (cp.get("Video Codec") or cp.get("Codec") or "").strip()
    if ext in _SDK_EXTS:
        return "codec_or_attr"
    if not fmt and not vc:
        # filen er der m/ data, men Resolve klarer ikke lese format/codec = sannsynlig SDK/attr-mismatch
        return "codec_or_attr"
    # 4) Online — på disk, data finnes, codec lest OK
    return "online"


def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "scan").lower()
    if mode != "scan":
        bridge.error("Offline-diagnose er read-only — kun mode='scan' støttes.")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "clips": 0,
            "counts": {"online": 0, "path_missing": 0, "cloud_placeholder": 0, "codec_or_attr": 0},
            "items": [],
            "note": "Tørrkjøring — ville klassifisert hver pool-klipp med filsti i årsak (online/path_missing/cloud_placeholder/codec_or_attr).",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)

    mp = conn.project.GetMediaPool()
    items: list[Any] = []
    _walk(mp.GetRootFolder(), items)

    # Dedupe på filsti — samme fil kan ligge flere ganger i poolen.
    seen: dict[str, Any] = {}
    for it in items:
        try:
            cp = it.GetClipProperty() or {}
        except Exception:
            cp = {}
        fp = cp.get("File Path", "") or ""
        if fp:
            seen.setdefault(fp, it)

    counts = {"online": 0, "path_missing": 0, "cloud_placeholder": 0, "codec_or_attr": 0}
    out_items: list[dict[str, Any]] = []
    total = len(seen)
    i = 0
    for fp, it in seen.items():
        i += 1
        cause = _classify(fp, it)
        if cause in counts:
            counts[cause] += 1
        if cause != "online":
            try:
                name = it.GetName() or os.path.basename(fp)
            except Exception:
                name = os.path.basename(fp)
            out_items.append({
                "name": name,
                "path": fp,
                "cause": cause,
                "suggestion": _SUGGESTIONS.get(cause, ""),
            })
        bridge.progress(i, total, f"Diagnostiserer media ({len(out_items)} med problem)")

    problems = len(out_items)
    if problems == 0:
        note = f"Alle {total} klipp er online — ingen offline-årsaker funnet."
    else:
        parts = []
        if counts["path_missing"]:
            parts.append(f"{counts['path_missing']} mangler sti (relink)")
        if counts["cloud_placeholder"]:
            parts.append(f"{counts['cloud_placeholder']} sky-stub (last ned)")
        if counts["codec_or_attr"]:
            parts.append(f"{counts['codec_or_attr']} codec/SDK")
        note = (f"⚠️ {problems} av {total} klipp har problem — "
                + ", ".join(parts) + ". Se forslag per klipp.")
    note += (" Merk: conform_link (timeline-kobling) detekteres ikke pålitelig via API "
             "og er utelatt — sjekk manuelt hvis timeline viser offline mens pool er online.")

    bridge.result({
        "clips": total,
        "counts": counts,
        "items": out_items,
        "note": note,
    })


if __name__ == "__main__":
    bridge.main_guard(run)

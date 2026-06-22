"""Auto-organiser Media Pool — Resolve har ingen innebygd auto-sortering (3.parts-sorteren er Studio-betalt).
Lager bins automatisk + flytter klipp. Params: by ("camera"|"date"|"type", default "type"), mode ("scan"|"apply").
mode="scan": forhåndsvis gruppering (read-only) -> {by, groups:[{bin,clipCount,sample:[...]}]} UTEN å flytte.
mode="apply": mp.AddSubFolder per gruppe under root + mp.MoveClips (honorer dry_run). Returnerer {created,moved,groups}.
Grupperer: type=Video/Audio/Stills/Other (ext/Type); camera="Camera #"/"Camera"/filnavn-prefiks; date=YYYY-MM-DD.
Trygt: leser eksisterende bins først, hopper over klipp som allerede ligger riktig (ingen dobbelt-flytting)."""
from __future__ import annotations
import os, re, sys
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

VIDEO_EXT = {".mov", ".mp4", ".mxf", ".braw", ".r3d", ".avi", ".mkv", ".m4v", ".mts", ".m2ts", ".dng", ".crm", ".insv"}
AUDIO_EXT = {".wav", ".aif", ".aiff", ".mp3", ".m4a", ".flac", ".aac", ".caf", ".ogg"}
STILL_EXT = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".cr2", ".cr3", ".nef", ".arw", ".raf", ".heic", ".gif", ".bmp", ".psd"}

# Filnavn-prefiks → kamera-bøtte (når metadata mangler). C### = Canon Cinema, A7###/DSC = Sony, MVI = Canon DSLR, DJI = drone.
_CAM_PATTERNS = [
    (re.compile(r"^(DJI)[_-]?", re.I), "DJI"),
    (re.compile(r"^(MVI)[_-]?", re.I), "Canon MVI"),
    (re.compile(r"^(GX|GH)\d", re.I), "Panasonic"),
    (re.compile(r"^(GOPR|GX01|GH01)", re.I), "GoPro"),
    (re.compile(r"^(IMG)[_-]?", re.I), "iPhone/IMG"),
    (re.compile(r"^(DSC)[_-]?", re.I), "Sony DSC"),
    (re.compile(r"^(A7)\w*", re.I), "Sony A7"),
    (re.compile(r"^C\d{3,4}\b", re.I), "Canon Cinema"),  # C80/R5C: C0001 ...
    (re.compile(r"^(A|B|C|D)\d{3,4}[_-]", re.I), "Cam-prefix"),  # generisk A001_ / B002_
]
_DATE_RE = re.compile(r"(\d{4})[-:/. ]?(\d{2})[-:/. ]?(\d{2})")


def _walk(folder, acc):
    for it in (folder.GetClipList() or []):
        acc.append(it)
    for s in (folder.GetSubFolderList() or []):
        _walk(s, acc)


def _ext_of(cp, item):
    fp = cp.get("File Path") or ""
    if fp:
        return os.path.splitext(fp)[1].lower()
    name = (item.GetName() or "")
    return os.path.splitext(name)[1].lower()


def _bucket_type(cp, item):
    ext = _ext_of(cp, item)
    if ext in VIDEO_EXT:
        return "Video"
    if ext in AUDIO_EXT:
        return "Audio"
    if ext in STILL_EXT:
        return "Stills"
    # fallback på Resolve "Type"-feltet
    t = (cp.get("Type") or "").lower()
    if "video" in t:
        return "Video"
    if "audio" in t:
        return "Audio"
    if "still" in t or "image" in t:
        return "Stills"
    return "Other"


def _bucket_camera(cp, item):
    # 1) metadata
    for key in ("Camera #", "Camera", "Camera Type", "Cam"):
        v = (cp.get(key) or "").strip()
        if v:
            return v
    # 2) filnavn-prefiks
    name = os.path.basename(cp.get("File Path") or "") or (item.GetName() or "")
    for rx, label in _CAM_PATTERNS:
        if rx.match(name):
            return label
    return "Ukjent kamera"


def _bucket_date(cp, item):
    # 1) Resolve-felt
    for key in ("Date Created", "Date Modified", "Date Recorded", "Shot On"):
        v = (cp.get(key) or "").strip()
        if v:
            m = _DATE_RE.search(v)
            if m:
                return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # 2) fil-mtime
    fp = cp.get("File Path") or ""
    if fp and os.path.isfile(fp):
        try:
            import datetime
            return datetime.datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d")
        except OSError:
            pass
    return "Ukjent dato"


_BUCKETERS = {"type": _bucket_type, "camera": _bucket_camera, "date": _bucket_date}


def run(params: dict[str, Any], dry_run: bool) -> None:
    by = (params.get("by") or "type").lower()
    if by not in _BUCKETERS:
        bridge.error(f"Ugyldig 'by': {by!r} — bruk type/camera/date")
        sys.exit(1)
    mode = (params.get("mode") or "scan").lower()
    bucketer = _BUCKETERS[by]

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    mp = conn.project.GetMediaPool()
    root = mp.GetRootFolder()

    # Eksisterende top-level bins under root (leser FØRST — unngå dobbelt-binning).
    existing_bins = {}
    for sf in (root.GetSubFolderList() or []):
        try:
            existing_bins[sf.GetName()] = sf
        except Exception:
            continue

    # Bygg gruppering. Vi grupperer KUN klipp som ligger direkte i root —
    # klipp som allerede er i en bin lar vi ligge (de er sannsynligvis bevisst plassert).
    root_clips = root.GetClipList() or []
    groups: dict[str, list] = {}
    for it in root_clips:
        cp = it.GetClipProperty() or {}
        bin_name = bucketer(cp, it) or "Other"
        groups.setdefault(bin_name, []).append(it)

    def _sample(items):
        out = []
        for it in items[:5]:
            try:
                out.append(it.GetName() or "(uten navn)")
            except Exception:
                out.append("(uten navn)")
        return out

    group_summaries = [
        {"bin": name, "clipCount": len(its), "sample": _sample(its),
         "binExists": name in existing_bins}
        for name, its in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    ]

    if mode == "scan":
        total = sum(len(v) for v in groups.values())
        already_binned = len(_all_minus_root(root))
        note = (f"{by}-gruppering av {total} klipp i root → {len(groups)} bin(s). "
                f"{already_binned} klipp ligger allerede i bins (urørt). "
                "Kjør 'apply' for å opprette bins + flytte." if total else
                f"Ingen løse klipp i root å organisere ({already_binned} ligger allerede i bins).")
        bridge.result({"by": by, "mode": "scan", "rootClips": total,
                       "alreadyBinned": already_binned, "groups": group_summaries, "note": note})
        return

    if mode != "apply":
        bridge.error(f"Ugyldig 'mode': {mode!r} — bruk scan/apply")
        sys.exit(1)

    # mode == apply
    created = 0
    moved = 0
    done_groups = []
    n_groups = len(groups)
    idx = 0
    for name, items in groups.items():
        idx += 1
        bridge.progress(idx, n_groups, f"Organiserer '{name}' ({len(items)} klipp)")
        if dry_run:
            done_groups.append({"bin": name, "clipCount": len(items),
                                "binExists": name in existing_bins})
            created += 0 if name in existing_bins else 1
            moved += len(items)
            continue

        dest = existing_bins.get(name)
        if dest is None:
            try:
                dest = mp.AddSubFolder(root, name)
            except Exception as exc:
                bridge.warn(f"Kunne ikke opprette bin '{name}': {exc}")
                dest = None
            if dest is None:
                bridge.warn(f"Hopper over '{name}' — bin ikke opprettet")
                continue
            existing_bins[name] = dest
            created += 1

        # Flytt klippene. MoveClips krever at root er current folder for å plukke kilden;
        # men API-et tar klipp-objektene direkte, så vi setter bare destinasjon.
        try:
            mp.SetCurrentFolder(root)
        except Exception:
            pass
        try:
            ok = mp.MoveClips(items, dest)
            if ok:
                moved += len(items)
            else:
                bridge.warn(f"MoveClips returnerte False for '{name}'")
        except Exception as exc:
            bridge.warn(f"MoveClips feilet for '{name}': {exc}")
        done_groups.append({"bin": name, "clipCount": len(items),
                            "binExists": True})

    prefix = "[dry-run] " if dry_run else ""
    note = (f"{prefix}Opprettet {created} bin(s) + flyttet {moved} klipp ({by}-gruppering)."
            if (created or moved) else f"{prefix}Ingenting å organisere.")
    bridge.result({"by": by, "mode": "apply", "dryRun": dry_run,
                   "created": created, "moved": moved, "groups": done_groups, "note": note})


def _all_minus_root(root):
    """Klipp som allerede ligger i undermapper (ikke direkte i root)."""
    acc = []
    for sf in (root.GetSubFolderList() or []):
        _walk(sf, acc)
    return acc


if __name__ == "__main__":
    bridge.main_guard(run)

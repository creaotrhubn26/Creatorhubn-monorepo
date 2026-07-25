"""Disk-rydding — trygg opprydding av Resolve-cache og Post Agent-artefakter.

Prinsipp: kun REGENERERBART eller eget-artefakt slettes, aldri kildemateriale.
Aktivt prosjekts cache er FREDET (GUID-match mot project.GetUniqueId()).

Modi:
  scan    Kartlegg: render-cache per prosjekt-GUID (plassering fra
          perfCacheClipsLocation — API-fasit, ikke gjetting) m/ størrelse,
          alder og aktiv/inaktiv-status; gallery stills; Post Agent-
          artefakter (thumbs-cache, source_songs-staging, *.part);
          [backup]-timelines i prosjektet; ledig plass på cache-volumet.
  clean   targets=oldCache,artifacts,backupTimelines (kommaseparert):
            oldCache        cache-mapper som IKKE er aktivt prosjekt og er
                            eldre enn minAgeDays (default 7) — regenererbart
            artifacts       /tmp/postagent-thumbs, *.part, source_songs-wav
            backupTimelines «[backup …]»-timelines opprettet av sikkerhets-
                            kopiene (MediaPool.DeleteTimelines)
          Plan i dry-run; ekte kjøring verifiserer frigjort plass etterpå.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402

ARTIFACT_DIRS = [
    "/tmp/postagent-thumbs",
    os.path.expanduser("~/.local/state/trrpa/source_songs"),
    os.path.expanduser("~/Library/Application Support/post-agent/source_songs"),
]


def _du_gb(path: str) -> float:
    try:
        r = subprocess.run(["du", "-sk", path], capture_output=True, text=True, timeout=600)
        return round(int(r.stdout.split()[0]) / 1e6, 2)
    except Exception:
        return 0.0


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    mode = (params.get("mode") or "scan").strip().lower()
    min_age_days = float(params.get("minAgeDays") or 7)

    cache_root = ""
    try:
        cache_root = project.GetSetting("perfCacheClipsLocation") or ""
    except Exception:
        pass
    cur_guid = ""
    try:
        cur_guid = project.GetUniqueId() or ""
    except Exception:
        pass

    def cache_folders():
        out = []
        if cache_root and os.path.isdir(cache_root):
            for name in os.listdir(cache_root):
                p = os.path.join(cache_root, name)
                if not os.path.isdir(p) or name == "audio":
                    continue
                age_days = round((time.time() - os.path.getmtime(p)) / 86400, 1)
                is_current = bool(cur_guid) and name == cur_guid
                out.append({"folder": name, "path": p, "gb": _du_gb(p),
                            "ageDays": age_days, "isCurrentProject": is_current,
                            "deletable": not is_current and age_days >= min_age_days})
        return out

    def backup_timelines():
        out = []
        for i in range(1, int(project.GetTimelineCount() or 0) + 1):
            tl = project.GetTimelineByIndex(i)
            name = (tl.GetName() or "") if tl else ""
            if re.search(r"\[backup[ -]", name, re.I):
                out.append({"name": name, "_tl": tl})
        return out

    def artifacts():
        out = []
        for d in ARTIFACT_DIRS:
            if os.path.isdir(d):
                out.append({"path": d, "gb": _du_gb(d), "kind": "dir"})
        # .part-filer i kjente mål-mapper
        for root in (os.path.expanduser("~/Music/PostAgent"), cache_root or "/nonexistent"):
            if os.path.isdir(root):
                for dirpath, _dirs, files in os.walk(root):
                    for f in files:
                        if f.endswith(".part"):
                            fp = os.path.join(dirpath, f)
                            out.append({"path": fp, "gb": round(os.path.getsize(fp) / 1e9, 3),
                                        "kind": "part-fil"})
        return out

    if mode == "scan":
        caches = cache_folders()
        arts = artifacts()
        backups = backup_timelines()
        disk = {}
        if cache_root:
            try:
                u = shutil.disk_usage(cache_root)
                disk = {"volume": cache_root, "freeGb": round(u.free / 1e9, 1),
                        "totalGb": round(u.total / 1e9, 1)}
            except Exception:
                pass
        gallery = ""
        try:
            gallery = project.GetSetting("colorGalleryStillsLocation") or ""
        except Exception:
            pass
        reclaimable = round(sum(c["gb"] for c in caches if c["deletable"])
                            + sum(a["gb"] for a in arts), 1)
        bridge.result({"mode": mode, "cacheRoot": cache_root, "currentGuid": cur_guid,
                       "cacheFolders": caches,
                       "gallery": {"path": gallery, "gb": _du_gb(gallery) if gallery else 0},
                       "artifacts": arts,
                       "backupTimelines": [b["name"] for b in backups],
                       "disk": disk, "reclaimableGb": reclaimable,
                       "note": "Aktivt prosjekts cache er fredet. Sletting = regenererbar "
                               "cache + egne artefakter, aldri kildemateriale.",
                       "dryRun": dry_run})
        return

    if mode == "clean":
        targets = {t.strip().lower() for t in (params.get("targets") or "").split(",") if t.strip()}
        if not targets:
            bridge.error("clean krever targets=oldCache,artifacts,backupTimelines (velg).")
            return
        report = {"mode": mode, "targets": sorted(targets), "deleted": [],
                  "freedGb": 0.0, "errors": [], "dryRun": dry_run}
        free_before = None
        if cache_root:
            try:
                free_before = shutil.disk_usage(cache_root).free
            except Exception:
                pass

        if "oldcache" in targets:
            for c in cache_folders():
                if not c["deletable"]:
                    continue
                report["deleted"].append({"what": f"cache {c['folder'][:12]}… "
                                                  f"({c['gb']} GB, {c['ageDays']}d gammel)"})
                if not dry_run:
                    try:
                        shutil.rmtree(c["path"])
                        report["freedGb"] += c["gb"]
                    except Exception as e:
                        report["errors"].append(f"{c['folder'][:12]}: {str(e)[:100]}")
        if "artifacts" in targets:
            for a in artifacts():
                report["deleted"].append({"what": f"{a['kind']} {a['path']} ({a['gb']} GB)"})
                if not dry_run:
                    try:
                        if a["kind"] == "dir":
                            shutil.rmtree(a["path"])
                        else:
                            os.remove(a["path"])
                        report["freedGb"] += a["gb"]
                    except Exception as e:
                        report["errors"].append(f"{a['path']}: {str(e)[:100]}")
        if "backuptimelines" in targets:
            doomed = backup_timelines()
            for b in doomed:
                report["deleted"].append({"what": f"timeline «{b['name']}»"})
            if not dry_run and doomed:
                try:
                    if not conn.media_pool.DeleteTimelines([b["_tl"] for b in doomed]):
                        report["errors"].append("DeleteTimelines feilet")
                except Exception as e:
                    report["errors"].append(str(e)[:100])

        # resultatkontroll: faktisk frigjort plass på volumet
        if not dry_run and free_before is not None and cache_root:
            try:
                free_after = shutil.disk_usage(cache_root).free
                report["volumeFreedGb"] = round((free_after - free_before) / 1e9, 1)
                report["volumeFreeNowGb"] = round(free_after / 1e9, 1)
            except Exception:
                pass
        report["freedGb"] = round(report["freedGb"], 1)
        bridge.result(report)
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)

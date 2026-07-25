"""Bygg/vedlikehold den versjonerte prosjektindeksen (stabile ID-er).

Modi:
  build    Full indeksering: alle media pool-klipp (uid + filbane + kamera-
           metadata + valgfritt innholds-fingerprint), alle timelines (uid +
           tc-range), gjeldende timelines markører og undertekst-transkript.
           fingerprints=true (default) hasher første+siste MB per fil —
           tar litt tid på 1600 klipp, men gjør identiteten flytte-sikker.
  status   Meta (schema/Resolve-versjon/GUID) + tabell-tellinger.
  verify   Stikkprøve: N klipp (sampleSize=25) re-fingerprintes — avvik =
           filen er endret/erstattet siden indeksering → listes eksplisitt.
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402
from project_index import ProjectIndex, clip_identity, fingerprint  # noqa: E402


def _walk_clips(root):
    out = []

    def walk(folder):
        out.extend(folder.GetClipList() or [])
        for sub in folder.GetSubFolderList() or []:
            walk(sub)

    walk(root)
    return out


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    mode = (params.get("mode") or "build").strip().lower()
    idx = ProjectIndex(project, resolve=conn.resolve)

    if mode == "status":
        bridge.result({"mode": mode, "dbPath": idx.path, "meta": idx.meta(),
                       "counts": idx.counts(), "dryRun": dry_run})
        idx.close()
        return

    if mode == "verify":
        n = int(params.get("sampleSize") or 25)
        rows = idx.db.execute(
            "SELECT uid, name, path, fingerprint FROM clips "
            "WHERE fingerprint IS NOT NULL").fetchall()
        sample = random.sample(rows, min(n, len(rows))) if rows else []
        drift, checked = [], 0
        for uid, name, path, fp in sample:
            now = fingerprint(path)
            checked += 1
            if now is None:
                drift.append({"clip": name, "issue": "fil borte", "path": path})
            elif now != fp:
                drift.append({"clip": name, "issue": "INNHOLD ENDRET siden indeksering"})
        bridge.result({"mode": mode, "checked": checked, "drift": drift,
                       "ok": not drift, "dryRun": dry_run})
        idx.close()
        return

    # ── build ──
    want_fp = str(params.get("fingerprints", "true")).lower() in ("true", "1", "yes")
    clips = _walk_clips(conn.media_pool.GetRootFolder())
    indexed = fp_count = 0
    if not dry_run:
        for c in clips:
            ident = clip_identity(c, with_fingerprint=want_fp)
            if ident["fingerprint"]:
                fp_count += 1
            md = {}
            try:
                md = c.GetMetadata() or {}
            except Exception:
                pass
            fps = dur = None
            try:
                fps = float(c.GetClipProperty("FPS") or 0) or None
                frames = float(c.GetClipProperty("Frames") or 0)
                dur = round(frames / fps, 2) if (fps and frames) else None
            except Exception:
                pass
            idx.upsert_clip(ident, fps=fps, duration_sec=dur,
                            camera_type=md.get("Camera Type") or None,
                            camera_serial=md.get("Camera Serial #") or None)
            indexed += 1
        idx.commit()

    timelines = 0
    markers_n = transcripts_n = 0
    if not dry_run:
        for i in range(1, int(project.GetTimelineCount() or 0) + 1):
            tl = project.GetTimelineByIndex(i)
            if not tl:
                continue
            try:
                uid = tl.GetUniqueId() or f"idx:{i}"
                idx.upsert_timeline(uid, tl.GetName() or "?",
                                    float(tl.GetSetting("timelineFrameRate") or 0),
                                    int(tl.GetStartFrame() or 0), int(tl.GetEndFrame() or 0))
                timelines += 1
            except Exception:
                continue
        # markører + transkript for GJELDENDE timeline (de andre ved behov)
        cur = project.GetCurrentTimeline()
        if cur:
            cur_uid = cur.GetUniqueId() or "current"
            try:
                mk = cur.GetMarkers() or {}
                markers = [{"frame": f, "color": m.get("color"), "label": m.get("name"),
                            "note": m.get("note")} for f, m in mk.items()]
                idx.replace_markers(cur_uid, markers)
                markers_n = len(markers)
            except Exception:
                pass
            segs = []
            for t in range(1, (cur.GetTrackCount("subtitle") or 0) + 1):
                for it in cur.GetItemListInTrack("subtitle", t) or []:
                    try:
                        segs.append({"startFrame": int(it.GetStart() or 0),
                                     "endFrame": int(it.GetEnd() or 0),
                                     "text": (it.GetName() or "").strip()})
                    except Exception:
                        continue
            if segs:
                idx.replace_transcripts(cur_uid, segs)
                transcripts_n = len(segs)
        idx.commit()

    bridge.result({"mode": mode, "dbPath": idx.path,
                   "clipsIndexed": indexed if not dry_run else len(clips),
                   "fingerprints": fp_count, "timelines": timelines,
                   "markers": markers_n, "transcriptSegments": transcripts_n,
                   "meta": idx.meta(), "counts": idx.counts(), "dryRun": dry_run})
    idx.close()


if __name__ == "__main__":
    bridge.main_guard(run)

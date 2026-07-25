"""Klippe-assistenter — jump-cuts, tempo/rytme, alternative takes og vinkler.

Modi:
  jumpcuts   V1-kuttgrenser analyseres: samme kildeklipp delt (split-kutt)
             flagges direkte; nabo-klipp fra SAMME kamera sammenlignes
             visuelt (dHash siste/første frame — lik innramming = jump-cut-
             kandidat). markers=true → røde «JUMP CUT?»-markører.
  tempo      kutt-tetthet over tid (vindu 30s) + snitt-skuddlengde →
             tregeste/raskeste partier med tidskode. Ren lesing.
  takes      tc=<TC> (typisk playhead): klippet der → nabo-opptak fra samme
             kamera i opptaksrekkefølge (±5), med brukt/ubrukt-status.
  angles     tc=<TC>: andre kameraers klipp som dekker SAMME opptaks-
             øyeblikk (Start TC-overlapp) → alternative vinkler.

Params: bins=Dag 1,Dag 2 (for takes/angles kamera-oppslag), tc=<HH:MM:SS:FF>,
        maxCuts=200 (jumpcuts-tak), markers=false, dupThreshold=14
"""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402


def _ffmpeg() -> str:
    return shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"


def _dhash(path: str, at_sec: float) -> int | None:
    import os
    if not path or not os.path.isfile(path):
        return None
    r = subprocess.run([_ffmpeg(), "-v", "error", "-ss", f"{max(0.05, at_sec):.2f}", "-i", path,
                        "-frames:v", "1", "-vf", "scale=9:8:flags=area,format=gray",
                        "-f", "rawvideo", "-"], capture_output=True)
    d = r.stdout
    if len(d) < 72:
        return None
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (1 if d[y * 9 + x] > d[y * 9 + x + 1] else 0)
    return bits


def _tc_str(frames: int, fps: float) -> str:
    fps_i = max(1, round(fps))
    f = int(frames)
    s = f // fps_i
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}:{f % fps_i:02d}"


def _tc_frames(tc: str, fps: float) -> int:
    m = re.match(r"(\d+):(\d+):(\d+)[:;](\d+)", tc.strip())
    if not m:
        return 0
    h, mi, s, f = (int(x) for x in m.groups())
    return int((h * 3600 + mi * 60 + s) * round(fps) + f)


def _camera_token(name: str) -> str:
    """Kamera-heuristikk fra filnavn: prefiks før løpenummeret (A_0008C…)."""
    m = re.match(r"([A-Za-z]+_?\d{0,4})", name or "")
    return (m.group(1) if m else (name or ""))[:8].upper()


def _track_items(timeline, track: int):
    out = []
    for it in timeline.GetItemListInTrack("video", track) or []:
        try:
            mpi = it.GetMediaPoolItem()
        except Exception:
            mpi = None
        if not mpi:
            continue
        try:
            fpath = mpi.GetClipProperty("File Path") or ""
        except Exception:
            fpath = ""
        out.append({"start": int(it.GetStart() or 0), "end": int(it.GetEnd() or 0),
                    "name": mpi.GetName() or "?", "path": fpath, "track": track,
                    "leftOffset": int(it.GetLeftOffset() or 0), "mpi": mpi})
    out.sort(key=lambda x: x["start"])
    return out


def _all_items(timeline):
    """Alle videospor — klippet ligger ofte STABLET (63 spor i bryllups-
    prosjektet), så V1 alene er misvisende."""
    out = []
    for t in range(1, (timeline.GetTrackCount("video") or 0) + 1):
        out.extend(_track_items(timeline, t))
    out.sort(key=lambda x: (x["start"], x["track"]))
    return out


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen gjeldende timeline.")
        return
    fps = float(timeline.GetSetting("timelineFrameRate") or 25.0)
    tl_start = int(timeline.GetStartFrame() or 0)
    mode = (params.get("mode") or "tempo").strip().lower()

    # ── jumpcuts ──
    if mode == "jumpcuts":
        thresh = int(params.get("dupThreshold") or 14)
        max_cuts = int(params.get("maxCuts") or 200)
        want_markers = str(params.get("markers", "")).lower() in ("true", "1", "yes")
        all_items = _all_items(timeline)
        by_track: dict = {}
        for it in all_items:
            by_track.setdefault(it["track"], []).append(it)
        pairs = [(a, b) for tr_items in by_track.values()
                 for a, b in zip(tr_items, tr_items[1:])]
        pairs.sort(key=lambda ab: ab[1]["start"])
        items = all_items
        candidates = []
        hashed = 0
        for a, b in pairs:
            if len(candidates) >= max_cuts:
                break
            if b["start"] - a["end"] > fps:  # ikke et kutt — hull
                continue
            same_file = a["path"] and a["path"] == b["path"]
            reason = None
            if same_file:
                # samme kilde delt i to nabo-items — jump-cut kun når frames
                # faktisk er FJERNET (hopp > 0.2s); kontinuerlig split er ufarlig
                trim = b["leftOffset"] - (a["leftOffset"] + (a["end"] - a["start"]))
                if trim / fps >= 0.2:
                    reason = f"samme klipp delt (hopp på {round(trim / fps, 1)}s i kilden)"
                elif trim / fps <= -0.2:
                    reason = f"samme klipp delt med OVERLAPP ({round(-trim / fps, 1)}s vises to ganger)"
            elif _camera_token(a["name"]) == _camera_token(b["name"]):
                # samme kamera, ulike filer → visuell sjekk av grensen
                ha = _dhash(a["path"], (a["leftOffset"] + (a["end"] - a["start"]) - 2) / fps)
                hb = _dhash(b["path"], (b["leftOffset"] + 2) / fps)
                hashed += 1
                if ha is not None and hb is not None and bin(ha ^ hb).count("1") <= thresh:
                    reason = f"lik innramming over kuttet (avstand {bin(ha ^ hb).count('1')})"
            if reason:
                candidates.append({"frame": b["start"], "tc": _tc_str(b["start"], fps),
                                   "fromClip": a["name"], "toClip": b["name"], "reason": reason})
        added = 0
        if want_markers and not dry_run:
            for c in candidates:
                try:
                    if timeline.AddMarker(max(0, c["frame"] - tl_start), "Red", "JUMP CUT?",
                                          f"{c['fromClip']} → {c['toClip']}\n{c['reason']}", 1):
                        added += 1
                except Exception:
                    pass
        bridge.result({"mode": mode, "cutsChecked": len(pairs), "hashedPairs": hashed,
                       "tracks": len(by_track),
                       "candidates": candidates, "markersAdded": added, "dryRun": dry_run})
        return

    # ── tempo ──
    if mode == "tempo":
        items = _all_items(timeline)
        if len(items) < 2:
            bridge.result({"mode": mode, "note": "For få klipp i timelinen."})
            return
        window = int(30 * fps)
        t0, t1 = items[0]["start"], items[-1]["end"]
        curve = []
        for w in range(t0, t1, window):
            cuts = sum(1 for it in items if w <= it["start"] < w + window)
            curve.append({"tc": _tc_str(w, fps), "cutsPerMin": round(cuts * 2, 1)})
        shots = [(it["end"] - it["start"]) / fps for it in items]
        avg = sum(shots) / len(shots)
        by_len = sorted(zip(shots, items), key=lambda x: -x[0])
        slowest = [{"tc": _tc_str(it["start"], fps), "clip": it["name"], "sec": round(s, 1)}
                   for s, it in by_len[:5]]
        bridge.result({"mode": mode, "shots": len(items),
                       "tracks": int(timeline.GetTrackCount("video") or 0),
                       "avgShotSec": round(avg, 1),
                       "durationMin": round((t1 - t0) / fps / 60, 1),
                       "curve": curve[:200], "slowestShots": slowest, "dryRun": dry_run})
        return

    # ── takes / angles: felles oppslag av klippet under tc ──
    if mode in ("takes", "angles"):
        tc = (params.get("tc") or "").strip()
        if not tc:
            bridge.error(f"{mode} krever tc=<HH:MM:SS:FF> (playhead).")
            return
        frame = _tc_frames(tc, fps)
        items = _all_items(timeline)
        at = [it for it in items if it["start"] <= frame < it["end"]]
        cur = max(at, key=lambda it: it["track"]) if at else None  # øverste synlige
        if not cur:
            bridge.error(f"Fant ikke klipp på {tc}.")
            return

        # brukt-indeks + bin-vandring (kamera-mapper)
        used = set()
        for kind in ("video", "audio"):
            for t in range(1, (timeline.GetTrackCount(kind) or 0) + 1):
                for it in timeline.GetItemListInTrack(kind, t) or []:
                    try:
                        mpi = it.GetMediaPoolItem()
                        if mpi:
                            used.add(mpi.GetUniqueId() or mpi.GetName())
                    except Exception:
                        continue
        bin_names = [b.strip() for b in (params.get("bins") or "Dag 1,Dag 2").split(",") if b.strip()]
        folders = []  # (kamera-navn, [klipp])

        def walk(folder, wanted_hit):
            name = (folder.GetName() or "").strip()
            hit = wanted_hit or any(w.lower() in name.lower() for w in bin_names)
            clips = folder.GetClipList() or []
            if hit and clips:
                folders.append((name, clips))
            for sub in folder.GetSubFolderList() or []:
                walk(sub, hit)

        walk(conn.media_pool.GetRootFolder(), False)

        def rec_key(c):
            try:
                return ((c.GetClipProperty("Date Created") or ""),
                        (c.GetClipProperty("Start TC") or ""))
            except Exception:
                return ("", "")

        def describe(c, cam):
            uid = ""
            try:
                uid = c.GetUniqueId() or ""
            except Exception:
                pass
            try:
                dur = float(c.GetClipProperty("Frames") or 0) / fps
                stc = c.GetClipProperty("Start TC") or ""
            except Exception:
                dur, stc = 0, ""
            return {"clip": c.GetName() or "?", "camera": cam,
                    "startTc": stc, "durationSec": round(dur, 1),
                    "used": (uid or c.GetName()) in used}

        cur_name = cur["name"]
        cur_cam_tok = _camera_token(cur_name)
        result = {"mode": mode, "atTc": tc, "clip": cur_name, "dryRun": dry_run}

        if mode == "takes":
            home = next(((cam, clips) for cam, clips in folders
                         if any((c.GetName() or "") == cur_name for c in clips)), None)
            if not home:
                result["note"] = "Fant ikke klippets kamera-bin (sjekk bins-parameter)."
            else:
                cam, clips = home
                ordered = sorted(clips, key=rec_key)
                idx = next((i for i, c in enumerate(ordered) if (c.GetName() or "") == cur_name), 0)
                lo, hi = max(0, idx - 5), min(len(ordered), idx + 6)
                result["camera"] = cam
                result["neighbors"] = [describe(c, cam) for c in ordered[lo:hi]
                                       if (c.GetName() or "") != cur_name]
            bridge.result(result)
            return

        # angles: andre kameraer, Start TC-overlapp med gjeldende klipp
        try:
            cur_mpi = cur["mpi"]
            cur_stc = cur_mpi.GetClipProperty("Start TC") or ""
            cur_dur = float(cur_mpi.GetClipProperty("Frames") or 0) / fps
        except Exception:
            cur_stc, cur_dur = "", 0
        if not cur_stc:
            result["note"] = "Klippet mangler Start TC — kan ikke finne samtidige vinkler."
            bridge.result(result)
            return
        c0 = _tc_frames(cur_stc, fps)
        c1 = c0 + int(cur_dur * fps)
        alternatives = []
        for cam, clips in folders:
            for c in clips:
                name = c.GetName() or ""
                if name == cur_name or _camera_token(name) == cur_cam_tok:
                    continue
                try:
                    stc = c.GetClipProperty("Start TC") or ""
                    dur = float(c.GetClipProperty("Frames") or 0) / fps
                except Exception:
                    continue
                if not stc:
                    continue
                o0 = _tc_frames(stc, fps)
                if o0 < c1 and (o0 + int(dur * fps)) > c0:  # overlapp i opptakstid
                    alternatives.append(describe(c, cam))
        result["clipStartTc"] = cur_stc
        result["alternatives"] = alternatives[:30]
        result["alternativeCount"] = len(alternatives)
        bridge.result(result)
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)

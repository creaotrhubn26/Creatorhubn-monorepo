"""Sett inn ubrukte klipp i timelinen på anbefalt posisjon (bryllup: «fyll hullene»).

Tar imot valgene fra recommend_unused_insertions og setter dem inn med
posisjonert AppendToTimeline (recordFrame = ankeret). Segment-trim støttes
(startSec/endSec fra vision-analysen → kun sterkeste del settes inn).

Sikkerhet: klippene legges på et EGET b-roll-spor (nytt video-spor øverst
som opprettes ved behov), aldri oppå eksisterende klipp. Kolliderende
innsettinger på samme anker forskyves sekvensielt. Angre = slett items
fra sporet i Resolve (Edit-siden) — scriptet rører ingen eksisterende items.

Params:
  items=<JSON-liste>   [{"clip": "<navn>", "frame": <abs-frame>,
                         "startSec": <valgfri>, "endSec": <valgfri>}, ...]
                       (frame = anchorFrame fra anbefalingen, absolutt)
  track=<int>          valgfritt: eksisterende spor-indeks; default: nytt
                       video-spor opprettes øverst
  markers=true         Cyan-markør «SATT INN» per innsetting
  audio=false          default KUN VIDEO (mediaType 1): b-roll skal ikke dra
                       kamera-lyd over miksen — og linket lyd kolliderer i
                       lyd-rommet slik at innsettingen feiler stille
  markersOnly=false    true → kun grønne ANBEFALT-markører, ingen innsetting
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402


def _frames_to_tc(frames: int, fps: float) -> str:
    fps_i = max(1, round(fps))
    f = int(frames)
    s = f // fps_i
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}:{f % fps_i:02d}"


def run(params: dict, dry_run: bool) -> None:
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen gjeldende timeline.")
        return

    raw = params.get("items")
    if isinstance(raw, str):
        try:
            items = json.loads(raw)
        except Exception:
            bridge.error("items er ikke gyldig JSON.")
            return
    else:
        items = raw or []
    if not items:
        bridge.error("Ingen items å sette inn.")
        return

    fps = float(timeline.GetSetting("timelineFrameRate") or 25.0)
    want_markers = str(params.get("markers", "true")).lower() in ("true", "1", "yes")
    tl_start = int(timeline.GetStartFrame() or 0)

    # ── markersOnly: kun grønne ANBEFALT-markører, ingen innsetting ──
    # items kan ha valgfri "note" (f.eks. Claudes begrunnelse) per klipp.
    if str(params.get("markersOnly", "")).lower() in ("true", "1", "yes"):
        groups: dict[int, list] = {}
        for it in items:
            frame = max(int(it.get("frame") or 0), tl_start)
            groups.setdefault(frame, []).append(it)
        added = 0
        if not dry_run:
            for frame, group in groups.items():
                lines = [f"{g.get('clip', '?')}" + (f": {g['note']}" if g.get("note") else "")
                         for g in group[:8]]
                try:
                    if timeline.AddMarker(max(0, frame - tl_start), "Green",
                                          f"ANBEFALT ({len(group)})",
                                          "Ubrukte klipp som kunne passet her:\n" + "\n".join(lines), 1):
                        added += 1
                except Exception:
                    pass
        bridge.result({"timeline": timeline.GetName(), "markersOnly": True,
                       "anchors": len(groups), "markersAdded": added, "dryRun": dry_run})
        return

    # ── Finn MediaPoolItems: UID FØRST (stabil identitet), navn som fallback ──
    wanted_uids = {str(i.get("uid", "")).strip() for i in items if i.get("uid")}
    wanted = {str(i.get("clip", "")).strip() for i in items if i.get("clip")}
    by_uid: dict = {}
    by_name: dict = {}

    def walk(folder, in_ubrukt: bool):
        here = in_ubrukt or (folder.GetName() or "").strip().upper() == "UBRUKT"
        for c in folder.GetClipList() or []:
            try:
                u = c.GetUniqueId() or ""
            except Exception:
                u = ""
            if u and u in wanted_uids:
                by_uid[u] = c
            n = (c.GetName() or "").strip()
            if n in wanted and (n not in by_name or here):
                by_name[n] = c
        for sub in folder.GetSubFolderList() or []:
            walk(sub, here)

    walk(conn.media_pool.GetRootFolder(), False)
    missing = sorted(n for i in items
                     for n in [str(i.get("clip", "")).strip()]
                     if not (str(i.get("uid", "")).strip() in by_uid or n in by_name))

    # ── Spor: bruk angitt, ellers nytt video-spor øverst ──
    track_param = params.get("track")
    vtracks = int(timeline.GetTrackCount("video") or 1)
    plan_track = int(track_param) if track_param else vtracks + 1

    plan = []
    cursor = 0  # kollisjons-forskyvning på vårt spor
    for it in sorted(items, key=lambda x: int(x.get("frame") or 0)):
        name = str(it.get("clip", "")).strip()
        clip = by_uid.get(str(it.get("uid", "")).strip()) or by_name.get(name)
        if not clip:
            continue
        frame = max(int(it.get("frame") or 0), tl_start)
        try:
            clip_fps = float(clip.GetClipProperty("FPS") or fps)
            clip_frames = int(float(clip.GetClipProperty("Frames") or 0))
        except Exception:
            clip_fps, clip_frames = fps, 0
        s_sec, e_sec = it.get("startSec"), it.get("endSec")
        sf = int(float(s_sec) * clip_fps) if s_sec is not None else None
        ef = int(float(e_sec) * clip_fps) if e_sec is not None else None
        if ef is not None and clip_frames:
            ef = min(ef, clip_frames - 1)
        length = ((ef - sf) if (sf is not None and ef is not None)
                  else (clip_frames or int(4 * clip_fps)))
        length_tl = max(1, int(length * fps / clip_fps))
        if frame < cursor:  # samme anker → legg etter forrige innsetting
            frame = cursor
        cursor = frame + length_tl
        entry = {"clip": name, "recordFrame": frame, "tc": _frames_to_tc(frame, fps),
                 "trimmed": sf is not None,
                 "durationSec": round(length_tl / fps, 1)}
        # mediaType 1 = kun video: b-roll skal ikke dra kamera-lyd inn over
        # miksen, og linket lyd kolliderer i lyd-rommet (auto-opprettede
        # A-spor) slik at hele innsettingen feiler stille.
        info = {"mediaPoolItem": clip, "trackIndex": plan_track, "recordFrame": frame,
                "mediaType": 1}
        if str(params.get("audio", "")).lower() in ("true", "1", "yes"):
            info.pop("mediaType")
        if sf is not None:
            info["startFrame"] = sf
        if ef is not None:
            info["endFrame"] = ef
        plan.append((entry, info))

    report = {"timeline": timeline.GetName(), "fps": fps, "track": plan_track,
              "trackCreated": False, "planned": [e for e, _ in plan],
              "missing": missing, "inserted": 0, "failed": [],
              "markersAdded": 0, "dryRun": dry_run}
    if dry_run or not plan:
        bridge.result(report)
        return

    # ── Ekte kjøring ──
    if not track_param:
        try:
            if timeline.AddTrack("video"):
                report["trackCreated"] = True
        except Exception:
            pass
        # verifiser at sporet finnes; ellers fall tilbake til øverste
        if int(timeline.GetTrackCount("video") or 1) < plan_track:
            plan_track = int(timeline.GetTrackCount("video") or 1)
            report["track"] = plan_track
            for _e, info in plan:
                info["trackIndex"] = plan_track

    media_pool = conn.media_pool
    for entry, info in plan:
        ok = False
        try:
            res = media_pool.AppendToTimeline([info])
            # API-et kan returnere [None] eller fantom-objekter — stol kun på
            # at klippet faktisk ligger på sporet.
            ok = bool(res) and any(r is not None for r in (res if isinstance(res, list) else [res]))
            if ok:
                ok = any((i.GetName() or "").strip() == entry["clip"]
                         and int(i.GetStart() or -1) == entry["recordFrame"]
                         for i in timeline.GetItemListInTrack("video", info["trackIndex"]) or [])
        except Exception as e:
            entry["error"] = str(e)[:120]
        if ok:
            report["inserted"] += 1
            if want_markers:
                try:
                    rel = max(0, entry["recordFrame"] - tl_start)
                    if timeline.AddMarker(rel, "Cyan", "SATT INN",
                                          f"Ubrukt klipp satt inn: {entry['clip']}", 1):
                        report["markersAdded"] += 1
                except Exception:
                    pass
        else:
            report["failed"].append(entry["clip"])

    bridge.result(report)


if __name__ == "__main__":
    bridge.main_guard(run)

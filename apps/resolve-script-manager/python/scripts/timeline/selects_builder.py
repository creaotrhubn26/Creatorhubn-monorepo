"""Selects & rough cut — fra transkript til begrunnet EDL og ny timeline.

Kontrakt (Daniels krav): ALDRI «dette klippet virker best». Hver utvelgelse
returnerer: sourceClip (+uid), sourceIn/sourceOut (kilde-TC — bevart fra
klippets Start TC), timelineIn/timelineOut, transcriptExcerpt,
selectionReason (norsk), confidence, alternativeCandidate (annen vinkel
som dekker samme opptaks-øyeblikk, eller Claudes alternative segment).

Modi:
  select   Claude leser transkriptet (undertekst-sporet, indeksen, eller
           transcriptJson-param) m/ brief= og targetDurationSec= → velger
           sterke uttalelser, hopper over repetisjoner (beste instans),
           foreslår strammere formulering per pick («tighter»). Hvert pick
           kilde-mappes via V1 (LeftOffset) → full EDL-struktur + b-roll-
           kandidater fra UBRUKT (opptakstid-overlapp, uten vision).
  edl      Skriv utvalget (picksJson= fra select) som CMX3600-EDL + CSV
           til edlDir= (default ~/Movies/Leveranser/<prosjekt>).
  build    Bygg NY timeline (timelineName=) av utvalget — master røres
           aldri; video+lyd, kilde-utsnitt bevart.

Auth for select: ANTHROPIC_API_KEY-env (eller bearer= via proxy).
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402
from project_index import clip_identity  # noqa: E402


def _tc_str(frames: int, fps: float) -> str:
    fps_i = max(1, round(fps))
    f = int(round(frames))
    s = f // fps_i
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}:{f % fps_i:02d}"


def _tc_frames(tc: str, fps: float) -> int:
    m = re.match(r"(\d+):(\d+):(\d+)[:;](\d+)", (tc or "").strip())
    if not m:
        return 0
    h, mi, s, f = (int(x) for x in m.groups())
    return int((h * 3600 + mi * 60 + s) * round(fps) + f)


def _subtitle_segments(timeline, fps):
    segs = []
    for t in range(1, (timeline.GetTrackCount("subtitle") or 0) + 1):
        for it in timeline.GetItemListInTrack("subtitle", t) or []:
            try:
                segs.append({"startFrame": int(it.GetStart() or 0),
                             "endFrame": int(it.GetEnd() or 0),
                             "text": (it.GetName() or "").strip()})
            except Exception:
                continue
    segs.sort(key=lambda s: s["startFrame"])
    for s in segs:
        s["tc"] = _tc_str(s["startFrame"], fps)
    return segs


def _v1_map(timeline):
    """Alle videospor (stablet timeline: V1 alene er misvisende) —
    kilde-mapping velger ØVERSTE synlige klipp per delområde."""
    out = []
    for _track in range(1, (timeline.GetTrackCount("video") or 0) + 1):
      for it in timeline.GetItemListInTrack("video", _track) or []:
        try:
            mpi = it.GetMediaPoolItem()
        except Exception:
            mpi = None
        if not mpi:
            continue
        ident = clip_identity(mpi)
        try:
            start_tc = mpi.GetClipProperty("Start TC") or ""
            clip_fps = float(mpi.GetClipProperty("FPS") or 25)
        except Exception:
            start_tc, clip_fps = "", 25.0
        out.append({"start": int(it.GetStart() or 0), "end": int(it.GetEnd() or 0),
                    "leftOffset": int(it.GetLeftOffset() or 0), "mpi": mpi,
                    "uid": ident["uid"], "name": ident["name"], "track": _track,
                    "startTc": start_tc, "clipFps": clip_fps})
    out.sort(key=lambda x: x["start"])
    return out


def _source_events(v1, tl_s, tl_e, fps, _depth=0):
    """Kilde-mapping for timeline-range — velger ØVERSTE synlige klipp på
    midtpunktet, rekursivt for udekkede rester. Kilde-TC bevart."""
    if tl_e <= tl_s or _depth > 12:
        return []
    mid = (tl_s + tl_e) // 2
    at = [i for i in v1 if i["start"] <= mid < i["end"]]
    if not at:
        # ingen dekning på midtpunktet — prøv halvdelene
        if _depth > 8 or tl_e - tl_s < fps / 2:
            return []
        return (_source_events(v1, tl_s, mid, fps, _depth + 1)
                + _source_events(v1, mid, tl_e, fps, _depth + 1))
    item = max(at, key=lambda i: i["track"])  # øverste synlige
    o_s, o_e = max(tl_s, item["start"]), min(tl_e, item["end"])
    src_in = item["leftOffset"] + (o_s - item["start"])
    src_out = src_in + (o_e - o_s)
    base = _tc_frames(item["startTc"], item["clipFps"])
    ev = {"sourceClip": item["name"], "sourceUid": item["uid"],
          "srcInFrame": src_in, "srcOutFrame": src_out,
          "sourceIn": _tc_str(base + src_in, item["clipFps"]),
          "sourceOut": _tc_str(base + src_out, item["clipFps"]),
          "timelineIn": _tc_str(o_s, fps), "timelineOut": _tc_str(o_e, fps),
          "_mpi": item["mpi"], "_tlS": o_s, "_tlE": o_e}
    return (_source_events(v1, tl_s, o_s, fps, _depth + 1) + [ev]
            + _source_events(v1, o_e, tl_e, fps, _depth + 1))


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen gjeldende timeline.")
        return
    fps = float(timeline.GetSetting("timelineFrameRate") or 25.0)
    mode = (params.get("mode") or "select").strip().lower()

    # ── select ──
    if mode == "select":
        raw = params.get("transcriptJson")
        segs = json.loads(raw) if isinstance(raw, str) and raw.strip() else []
        if not segs:
            segs = _subtitle_segments(timeline, fps)
        if not segs:
            bridge.error("Ingen transkript — generer undertekster først "
                         "(🗣 Dialog-fanen) eller send transcriptJson.")
            return
        for s in segs:
            s.setdefault("tc", _tc_str(int(s["startFrame"]), fps))
        segs = segs[:300]
        brief = (params.get("brief") or "de sterkeste, mest følelsesladde og "
                 "innholdsrike uttalelsene").strip()
        target = float(params.get("targetDurationSec") or 90)

        listing = "\n".join(
            f"[{i}] {s['tc']} ({round((s['endFrame'] - s['startFrame']) / fps, 1)}s): "
            f"{s['text']}" for i, s in enumerate(segs))
        prompt = (
            "Du er en dokumentar-/bryllupsfilm-klipper som lager SELECTS fra et "
            f"transkript. Brief: {brief}. Mål-lengde: ~{int(target)} sekunder totalt.\n"
            "Regler: velg sammenhengende segment-spenn med de sterkeste uttalelsene; "
            "ved REPETISJON (samme poeng sagt flere ganger) velg beste instans og "
            "nevn det i begrunnelsen; foreslå STRAMMERE formulering der talen er "
            "omstendelig (hva kunne vært kuttet). Aldri vage begrunnelser.\n\n"
            f"TRANSKRIPT:\n{listing}\n\n"
            'Svar KUN med JSON: {"picks": [{"segments": [førsteIndex, sisteIndex], '
            '"reason": "<konkret norsk begrunnelse — HVORFOR akkurat dette>", '
            '"confidence": 0-100, "tighter": "<strammere formulering / hva som kan '
            'kuttes, eller null>", "alternativeSegments": [index, index] eller null}], '
            '"notes": "<evt. repetisjoner du hoppet over, med indekser>"}')
        try:
            bearer = params.get("bearer")
            if bearer:
                from anthropic_proxy import Anthropic  # type: ignore
                client = Anthropic(bearer_token=bearer)
            else:
                import anthropic  # type: ignore
                client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
            msg = client.messages.create(model=params.get("model") or "claude-sonnet-4-6",
                                         max_tokens=2000,
                                         messages=[{"role": "user", "content": prompt}])
            text = msg.content[0].text
            data = json.loads(text[text.find("{"):text.rfind("}") + 1])
        except Exception as e:
            bridge.error(f"Claude-utvelgelse feilet: {str(e)[:200]}")
            return

        v1 = _v1_map(timeline)

        # UBRUKT-klipp m/ opptakstid → b-roll-kandidater per pick
        unused = []
        def walk(folder, in_u):
            here = in_u or (folder.GetName() or "").strip().upper() == "UBRUKT"
            for c in folder.GetClipList() or []:
                if here:
                    try:
                        stc = c.GetClipProperty("Start TC") or ""
                        cf = float(c.GetClipProperty("FPS") or 25)
                        dur = float(c.GetClipProperty("Frames") or 0)
                    except Exception:
                        continue
                    if stc:
                        unused.append({"name": c.GetName() or "?",
                                       "rec0": _tc_frames(stc, cf),
                                       "rec1": _tc_frames(stc, cf) + int(dur),
                                       "fps": cf})
            for sub in folder.GetSubFolderList() or []:
                walk(sub, here)
        walk(conn.media_pool.GetRootFolder(), False)

        picks_out = []
        total_sec = 0.0
        for p in data.get("picks", []):
            span = p.get("segments") or []
            if len(span) < 1:
                continue
            i0, i1 = int(span[0]), int(span[-1])
            if not (0 <= i0 < len(segs) and 0 <= i1 < len(segs) and i0 <= i1):
                continue
            tl_s, tl_e = int(segs[i0]["startFrame"]), int(segs[i1]["endFrame"])
            excerpt = " ".join(s["text"] for s in segs[i0:i1 + 1])[:300]
            events = _source_events(v1, tl_s, tl_e, fps)
            # alternativ: annen vinkel som dekker samme opptaks-øyeblikk
            alt = None
            if events:
                ev = events[0]
                base = _tc_frames(next((x["startTc"] for x in v1
                                        if x["uid"] == ev["sourceUid"]), ""),
                                  events and 25 or 25)
                rec0 = _tc_frames(ev["sourceIn"], 25)
                for item in v1:
                    if item["uid"] == ev["sourceUid"] or not item["startTc"]:
                        continue
                    ib = _tc_frames(item["startTc"], item["clipFps"])
                    if ib <= rec0 <= ib + (item["end"] - item["start"]) + item["leftOffset"]:
                        alt = {"clip": item["name"], "sourceTc": item["startTc"],
                               "kind": "annen vinkel, samme øyeblikk"}
                        break
            if alt is None and p.get("alternativeSegments"):
                a = p["alternativeSegments"]
                ai = int(a[0]) if a else None
                if ai is not None and 0 <= ai < len(segs):
                    alt = {"transcriptExcerpt": segs[ai]["text"][:120],
                           "tc": segs[ai]["tc"], "kind": "alternativt segment"}
            # b-roll-kandidater: ubrukte klipp fra samme opptaks-vindu
            broll = []
            if events and events[0]["sourceIn"]:
                r0 = _tc_frames(events[0]["sourceIn"], 25)
                broll = [u["name"] for u in unused
                         if u["rec0"] - 3000 <= r0 <= u["rec1"] + 3000][:3]
            dur_sec = round((tl_e - tl_s) / fps, 1)
            total_sec += dur_sec
            picks_out.append({
                "events": [{k: v for k, v in e.items() if not k.startswith("_")}
                           for e in events],
                "timelineIn": _tc_str(tl_s, fps), "timelineOut": _tc_str(tl_e, fps),
                "_tlS": tl_s, "_tlE": tl_e,
                "durationSec": dur_sec,
                "transcriptExcerpt": excerpt,
                "selectionReason": p.get("reason") or "(mangler begrunnelse)",
                "confidence": p.get("confidence"),
                "tighterSuggestion": p.get("tighter"),
                "alternativeCandidate": alt,
                "brollCandidates": broll,
            })
        result = {"mode": mode, "brief": brief, "targetDurationSec": target,
                  "totalDurationSec": round(total_sec, 1),
                  "picks": [{k: v for k, v in p.items() if not k.startswith("_")}
                            for p in picks_out],
                  "notes": data.get("notes"), "segmentsRead": len(segs),
                  "dryRun": dry_run}
        # persister som forslag i indeksen
        if picks_out and not dry_run:
            try:
                from project_index import ProjectIndex
                import time as _t
                idx = ProjectIndex(project, resolve=conn.resolve)
                for p in result["picks"]:
                    idx.db.execute(
                        "INSERT INTO suggestions (kind, subject_uid, payload, status, created_ts) "
                        "VALUES (?,?,?,?,?)",
                        ("select", (p["events"][0]["sourceUid"] if p["events"] else ""),
                         json.dumps(p, ensure_ascii=False)[:4000], "new", _t.time()))
                idx.close()
            except Exception:
                pass
        bridge.result(result)
        return

    # ── edl / build: tar picksJson fra select ──
    raw = params.get("picksJson")
    picks = json.loads(raw) if isinstance(raw, str) and raw.strip() else []
    if not picks:
        bridge.error(f"{mode} krever picksJson=<picks fra select>.")
        return

    if mode == "edl":
        out_dir = os.path.expanduser(params.get("edlDir")
                                     or "~/Movies/Leveranser/"
                                     + re.sub(r"[^A-Za-z0-9_-]+", "_", project.GetName() or "p"))
        lines = ["TITLE: POST AGENT SELECTS", "FCM: NON-DROP FRAME", ""]
        csv = ["nr;sourceClip;sourceIn;sourceOut;timelineIn;timelineOut;"
               "confidence;reason;excerpt"]
        n = 0
        for p in picks:
            for e in p.get("events", []):
                n += 1
                reel = re.sub(r"[^A-Z0-9]", "", (e["sourceClip"] or "AX").upper())[:8] or "AX"
                lines.append(f"{n:03d}  {reel:8s} V     C        "
                             f"{e['sourceIn']} {e['sourceOut']} "
                             f"{e['timelineIn']} {e['timelineOut']}")
                lines.append(f"* FROM CLIP NAME: {e['sourceClip']}")
                lines.append(f"* COMMENT: {p.get('selectionReason', '')[:100]}")
                csv.append(f"{n};{e['sourceClip']};{e['sourceIn']};{e['sourceOut']};"
                           f"{e['timelineIn']};{e['timelineOut']};{p.get('confidence')};"
                           f"\"{p.get('selectionReason', '')}\";\"{p.get('transcriptExcerpt', '')[:120]}\"")
        report = {"mode": mode, "events": n, "dryRun": dry_run}
        if not dry_run:
            os.makedirs(out_dir, exist_ok=True)
            edl_path = os.path.join(out_dir, "POSTAGENT_SELECTS.edl")
            csv_path = os.path.join(out_dir, "POSTAGENT_SELECTS.csv")
            with open(edl_path, "w", encoding="utf-8") as fh:
                fh.write("\n".join(lines) + "\n")
            with open(csv_path, "w", encoding="utf-8") as fh:
                fh.write("\n".join(csv) + "\n")
            report["edlPath"], report["csvPath"] = edl_path, csv_path
        bridge.result(report)
        return

    if mode == "build":
        name = (params.get("timelineName") or "Selects (Post Agent)").strip()
        v1 = _v1_map(timeline)
        plan = []
        for p in picks:
            tl_s = _tc_frames(p["timelineIn"], fps)
            tl_e = _tc_frames(p["timelineOut"], fps)
            for e in _source_events(v1, tl_s, tl_e, fps):
                plan.append({"clip": e["sourceClip"],
                             "_info": {"mediaPoolItem": e["_mpi"],
                                       "startFrame": e["srcInFrame"],
                                       "endFrame": e["srcOutFrame"]}})
        report = {"mode": mode, "timelineName": name,
                  "planned": [pl["clip"] for pl in plan], "built": 0, "dryRun": dry_run}
        if dry_run or not plan:
            bridge.result(report)
            return
        new_tl = conn.media_pool.CreateEmptyTimeline(name)
        if not new_tl:
            bridge.error(f"Kunne ikke opprette «{name}» (finnes den alt?).")
            return
        try:
            new_tl.SetSetting("timelineFrameRate", str(fps))  # arv master-fps
        except Exception:
            pass
        project.SetCurrentTimeline(new_tl)
        for pl in plan:
            try:
                if conn.media_pool.AppendToTimeline([pl["_info"]]):
                    report["built"] += 1
            except Exception:
                pass
        report["note"] = f"Ny timeline «{name}» er åpen — master urørt."
        bridge.result(report)
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)
